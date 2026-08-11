import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { BestEffortTabularSyncHook } from '@/application/services/BestEffortTabularSyncHook.js'
import { TabularSyncConfigStore } from '@/infrastructure/excel/TabularSyncConfigStore.js'
import { TabularSyncEventStore } from '@/infrastructure/excel/TabularSyncEventStore.js'

function createLogger() {
  return {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
  }
}

function createDurableTables(db: Database): void {
  db.exec(`
    CREATE TABLE tabular_sync_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_identifier TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE tabular_sync_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_identifier TEXT NOT NULL UNIQUE,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      revision INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT,
      lease_owner TEXT,
      lease_expires_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    );
  `)
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (predicate()) return
    await new Promise<void>((resolve) => setTimeout(resolve, 1))
  }
  throw new Error('Timed out waiting for tabular sync invariant')
}

describe('BestEffortTabularSyncHook', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'tabular-sync-hook-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  test('loads config from file and coalesces same-table notifications', async () => {
    const configPath = join(tempDir, 'config.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        defaultTargetId: 'noop',
        targets: [
          {
            id: 'noop',
            kind: 'excel-file',
            workbookPath: '/tmp/nowhere.xlsx',
          },
        ],
        routes: [
          {
            tableIdentifier: 'users',
            targetId: 'noop',
          },
        ],
        syncDebounceMs: 5,
      }),
    )

    const tableRepository = {
      findById: mock(async (id: string) =>
        id === '1'
          ? {
              id: '1',
              identifier: 'users',
            }
          : null,
      ),
    }

    const hook = new BestEffortTabularSyncHook(
      tableRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      createLogger() as never,
      configPath,
    )

    expect(hook.isEnabled()).toBe(true)

    hook.notifyByIdentifier('users')
    hook.notifyByIdentifier('users')
    hook.notifyByTableId('1')

    await hook.flush()

    const status = hook.getStatus()

    expect(tableRepository.findById).toHaveBeenCalledTimes(1)
    expect(status.enabled).toBe(true)
    expect(status.configSource).toBe('file')
    expect(status.pendingCount).toBe(0)
    expect(status.totalNotifications).toBe(4)
    expect(status.totalExecutions).toBe(1)
    expect(status.totalFailed).toBe(1)
    expect(status.recentFailures.length).toBe(1)
    expect(status.tables[0]?.tableIdentifier).toBe('users')
    expect(status.tables[0]?.notifications).toBe(4)
    expect(status.tables[0]?.executions).toBe(1)
    expect(status.tables[0]?.failures).toBe(1)
    expect(status.tables[0]?.pending).toBe(false)
  })

  test('reloads active config from store without restart', async () => {
    const db = new Database(':memory:')
    db.exec(`
      CREATE TABLE tabular_sync_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_key TEXT NOT NULL UNIQUE,
        config_json TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    const store = new TabularSyncConfigStore(db)
    store.saveConfig(
      'alpha',
      {
        defaultTargetId: 'google-main',
        targets: [
          {
            id: 'google-main',
            kind: 'google-sheets',
            transport: 'google-tools-http',
            spreadsheetId: 'sheet-1',
            googleToolsBaseUrl: 'http://localhost:5678',
          },
        ],
        routes: [
          {
            tableIdentifier: 'users',
            targetId: 'google-main',
          },
        ],
        syncDebounceMs: 50,
      },
      { active: true },
    )

    const hook = new BestEffortTabularSyncHook(
      {
        findById: mock(async () => null),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      createLogger() as never,
      undefined,
      store,
    )

    expect(hook.getStatus().syncDebounceMs).toBe(50)
    expect(hook.getStatus().configSource).toBe('db')

    store.saveConfig(
      'alpha',
      {
        defaultTargetId: 'google-main',
        targets: [
          {
            id: 'google-main',
            kind: 'google-sheets',
            transport: 'google-tools-http',
            spreadsheetId: 'sheet-1',
            googleToolsBaseUrl: 'http://localhost:5678',
          },
        ],
        routes: [
          {
            tableIdentifier: 'users',
            targetId: 'google-main',
          },
        ],
        syncDebounceMs: 777,
      },
      { active: true },
    )

    expect(hook.getStatus().syncDebounceMs).toBe(777)

    await hook.dispose()
    db.close()
  })

  test('persists an explicit sync as a durable job and records its completion', async () => {
    const configPath = join(tempDir, 'durable-config.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        defaultTargetId: 'noop',
        targets: [{ id: 'noop', kind: 'excel-file', workbookPath: '/tmp/nowhere.xlsx' }],
        routes: [{ tableIdentifier: 'users', targetId: 'noop' }],
        syncDebounceMs: 5,
      }),
    )
    const db = new Database(':memory:')
    db.exec(`
      CREATE TABLE tabular_sync_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_identifier TEXT NOT NULL,
        mode TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE tabular_sync_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_identifier TEXT NOT NULL UNIQUE,
        mode TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        revision INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT,
        lease_owner TEXT,
        lease_expires_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT
      );
    `)
    const hook = new BestEffortTabularSyncHook(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      createLogger() as never,
      configPath,
      undefined,
      new TabularSyncEventStore(db),
    )
    const syncByIdentifier = mock(async () => ({ success: true }))
    ;(hook as unknown as { bridge: { syncByIdentifier: typeof syncByIdentifier } }).bridge = {
      syncByIdentifier,
    }

    expect(await hook.syncByIdentifier('users')).toBe(true)
    expect(syncByIdentifier).toHaveBeenCalledWith('users')
    expect(hook.getStatus().persistedJobs[0]?.status).toBe('succeeded')
    expect(hook.getStatus().persistedEvents[0]?.status).toBe('success')

    await hook.dispose()
    db.close()
  })

  test('runs independent tables with a bounded worker pool', async () => {
    const configPath = join(tempDir, 'parallel-config.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        targets: ['users', 'projects', 'events'].map((tableIdentifier) => ({
          id: tableIdentifier,
          kind: 'excel-file',
          workbookPath: `/tmp/${tableIdentifier}.xlsx`,
        })),
        routes: ['users', 'projects', 'events'].map((tableIdentifier) => ({
          tableIdentifier,
          targetId: tableIdentifier,
        })),
        syncDebounceMs: 50,
      }),
    )
    const db = new Database(':memory:')
    createDurableTables(db)
    const hook = new BestEffortTabularSyncHook(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      createLogger() as never,
      configPath,
      undefined,
      new TabularSyncEventStore(db),
      { maxConcurrentTables: 2 },
    )
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const started: string[] = []
    let active = 0
    let peak = 0
    const syncByIdentifier = mock(async (tableIdentifier: string) => {
      started.push(tableIdentifier)
      active++
      peak = Math.max(peak, active)
      await gate
      active--
      return { synced: true }
    })
    ;(hook as unknown as { bridge: unknown }).bridge = {
      supportsIdentifier: () => true,
      syncByIdentifier,
      clearByIdentifier: syncByIdentifier,
    }

    hook.notifyByIdentifier('users')
    hook.notifyByIdentifier('projects')
    hook.notifyByIdentifier('events')
    const flushing = hook.flush()
    await waitUntil(() => started.length === 2)

    expect(active).toBe(2)
    expect(started).toHaveLength(2)
    expect(hook.getStatus()).toEqual(
      expect.objectContaining({
        maxConcurrentTables: 2,
        activeExecutions: 2,
        peakConcurrentExecutions: 2,
      }),
    )

    release()
    await flushing

    expect(started.sort()).toEqual(['events', 'projects', 'users'])
    expect(peak).toBe(2)
    expect(hook.getStatus().activeExecutions).toBe(0)
    await hook.dispose()
    db.close()
  })

  test('serializes a trailing same-table revision and preserves its dirty IDs', async () => {
    const configPath = join(tempDir, 'revision-config.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        defaultTargetId: 'noop',
        targets: [
          { id: 'noop', kind: 'excel-file', workbookPath: '/tmp/nowhere.xlsx' },
        ],
        routes: [{ tableIdentifier: 'users', targetId: 'noop' }],
        syncDebounceMs: 50,
      }),
    )
    const db = new Database(':memory:')
    createDurableTables(db)
    const hook = new BestEffortTabularSyncHook(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      createLogger() as never,
      configPath,
      undefined,
      new TabularSyncEventStore(db),
      { maxConcurrentTables: 2 },
    )
    let releaseFirst: () => void = () => {}
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const calls: Array<{ dirtyNodeIds: readonly string[]; revision?: number }> = []
    let active = 0
    let peak = 0
    const syncDirtyByIdentifier = mock(
      async (
        _tableIdentifier: string,
        dirtyNodeIds: readonly string[],
        revision?: number,
      ) => {
        calls.push({ dirtyNodeIds, revision })
        active++
        peak = Math.max(peak, active)
        if (calls.length === 1) {
          await firstGate
        }
        active--
        return { synced: true }
      },
    )
    ;(hook as unknown as { bridge: unknown }).bridge = {
      supportsIdentifier: () => true,
      syncByIdentifier: mock(async () => ({ synced: true })),
      syncDirtyByIdentifier,
      clearByIdentifier: mock(async () => ({ synced: true })),
    }

    hook.notifyByIdentifier('users', 'node-1')
    const flushing = hook.flush()
    await waitUntil(() => calls.length === 1)
    hook.notifyByIdentifier('users', 'node-2')
    releaseFirst()
    await flushing

    expect(calls).toEqual([
      { dirtyNodeIds: ['node-1'], revision: 1 },
      { dirtyNodeIds: ['node-2'], revision: 2 },
    ])
    expect(peak).toBe(1)
    expect(hook.getStatus().totalExecutions).toBe(2)
    await hook.dispose()
    db.close()
  })

  test('skips an unsupported route before enqueueing or reading repositories', async () => {
    const configPath = join(tempDir, 'route-config.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        defaultTargetId: 'noop',
        targets: [
          { id: 'noop', kind: 'excel-file', workbookPath: '/tmp/nowhere.xlsx' },
        ],
        routes: [{ tableIdentifier: 'users', targetId: 'noop' }],
      }),
    )
    const db = new Database(':memory:')
    createDurableTables(db)
    const tableRepository = { findByIdentifier: mock(async () => null) }
    const hook = new BestEffortTabularSyncHook(
      tableRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      createLogger() as never,
      configPath,
      undefined,
      new TabularSyncEventStore(db),
    )

    expect(await hook.syncByIdentifier('missing')).toBe(false)
    expect(tableRepository.findByIdentifier).not.toHaveBeenCalled()
    expect(hook.getStatus().totalNotifications).toBe(0)
    expect(hook.getStatus().persistedJobs).toEqual([])
    await hook.dispose()
    db.close()
  })

  test('does not record success after a running lease is paused', async () => {
    const configPath = join(tempDir, 'pause-config.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        defaultTargetId: 'noop',
        targets: [
          { id: 'noop', kind: 'excel-file', workbookPath: '/tmp/nowhere.xlsx' },
        ],
        routes: [{ tableIdentifier: 'users', targetId: 'noop' }],
        syncDebounceMs: 50,
      }),
    )
    const db = new Database(':memory:')
    createDurableTables(db)
    const hook = new BestEffortTabularSyncHook(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      createLogger() as never,
      configPath,
      undefined,
      new TabularSyncEventStore(db),
    )
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let started = false
    ;(hook as unknown as { bridge: unknown }).bridge = {
      supportsIdentifier: () => true,
      syncByIdentifier: mock(async () => {
        started = true
        await gate
        return { synced: true }
      }),
      clearByIdentifier: mock(async () => ({ synced: true })),
    }

    hook.notifyByIdentifier('users')
    const flushing = hook.flush()
    await waitUntil(() => started)
    expect(hook.pauseByIdentifier('users')?.status).toBe('paused')
    release()
    await flushing

    const status = hook.getStatus()
    expect(status.tables[0]?.executions).toBe(1)
    expect(status.totalSucceeded).toBe(0)
    expect(status.totalFailed).toBe(0)
    expect(status.persistedEvents).toEqual([])
    expect(status.persistedJobs[0]?.status).toBe('paused')
    await hook.dispose()
    db.close()
  })

  test('keeps a failed quota write durable for backoff retry', async () => {
    const configPath = join(tempDir, 'retry-config.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        defaultTargetId: 'noop',
        targets: [
          { id: 'noop', kind: 'excel-file', workbookPath: '/tmp/nowhere.xlsx' },
        ],
        routes: [{ tableIdentifier: 'users', targetId: 'noop' }],
        syncDebounceMs: 0,
      }),
    )
    const db = new Database(':memory:')
    createDurableTables(db)
    const hook = new BestEffortTabularSyncHook(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      createLogger() as never,
      configPath,
      undefined,
      new TabularSyncEventStore(db),
    )
    ;(hook as unknown as { bridge: unknown }).bridge = {
      supportsIdentifier: () => true,
      syncByIdentifier: mock(async () => {
        throw new Error('quota exhausted')
      }),
      clearByIdentifier: mock(async () => ({ synced: true })),
    }

    expect(await hook.syncByIdentifier('users')).toBe(false)

    const status = hook.getStatus()
    expect(status.totalFailed).toBe(1)
    expect(status.persistedJobs[0]).toEqual(
      expect.objectContaining({
        status: 'retry_wait',
        attempts: 1,
        lastError: 'quota exhausted',
      }),
    )
    expect(status.persistedEvents[0]).toEqual(
      expect.objectContaining({
        status: 'failure',
        errorMessage: 'quota exhausted',
      }),
    )
    await hook.dispose()
    db.close()
  })
})

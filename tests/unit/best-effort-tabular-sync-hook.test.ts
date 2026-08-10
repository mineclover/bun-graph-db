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

    db.close()
  })
})

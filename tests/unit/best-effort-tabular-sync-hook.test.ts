import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { BestEffortTabularSyncHook } from '@/application/services/BestEffortTabularSyncHook.js'

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
})

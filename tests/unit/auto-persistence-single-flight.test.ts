import { describe, expect, test } from 'vitest'
import type { ILogger } from '../../src/application/ports/ILogger'
import { AutoPersistenceService } from '../../src/domain/services/AutoPersistenceService'

interface DeferredExport {
  promise: Promise<ReturnType<typeof successfulExport>>
  resolve: () => void
}

describe('AutoPersistenceService generation tracking', () => {
  test('keeps full JSONL write autosave opt-in by default', () => {
    let exportCalls = 0
    const service = new AutoPersistenceService({
      export: () => {
        exportCalls++
        return Promise.resolve(successfulExport())
      },
    } as never, quietLogger, {
      autoRestoreOnStartup: false,
      autoBackupOnShutdown: false,
    })

    service.markDirty()

    expect(service.getStatus()).toMatchObject({ isDirty: false, pendingSave: false, dirtyGeneration: 0 })
    expect(exportCalls).toBe(0)
  })

  test('coalesces concurrent force saves into a single export', async () => {
    const exports: DeferredExport[] = []
    const service = createService(exports)

    service.markDirty()
    const first = service.forceSave()
    const second = service.forceSave()

    await waitFor(() => exports.length === 1)
    expect(service.getStatus()).toMatchObject({ saveInProgress: true, dirtyGeneration: 1 })
    exports[0]?.resolve()

    expect(await first).toEqual({ success: true })
    expect(await second).toEqual({ success: true })
    expect(exports).toHaveLength(1)
    expect(service.getStatus()).toMatchObject({
      isDirty: false,
      saveInProgress: false,
      pendingSave: false,
      dirtyGeneration: 1,
      persistedGeneration: 1,
    })

    await service.shutdown()
  })

  test('does not lose mutations that arrive during an export', async () => {
    const exports: DeferredExport[] = []
    const service = createService(exports)

    service.markDirty()
    const save = service.forceSave()
    await waitFor(() => exports.length === 1)

    service.markDirty()
    exports[0]?.resolve()
    await waitFor(() => exports.length === 2)
    expect(service.getStatus()).toMatchObject({ isDirty: true, dirtyGeneration: 2, persistedGeneration: 1 })

    exports[1]?.resolve()
    expect(await save).toEqual({ success: true })
    expect(service.getStatus()).toMatchObject({
      isDirty: false,
      saveInProgress: false,
      pendingSave: false,
      dirtyGeneration: 2,
      persistedGeneration: 2,
    })

    await service.shutdown()
  })
})

function createService(exports: DeferredExport[]): AutoPersistenceService {
  const backupService = {
    export: () => {
      let resolvePromise: ((value: ReturnType<typeof successfulExport>) => void) | undefined
      const promise = new Promise<ReturnType<typeof successfulExport>>((resolve) => {
        resolvePromise = resolve
      })
      exports.push({
        promise,
        resolve: () => resolvePromise?.(successfulExport()),
      })
      return promise
    },
  }

  return new AutoPersistenceService(backupService as never, quietLogger, {
    autoRestoreOnStartup: false,
    autoBackupOnShutdown: false,
    autoSaveOnWrite: true,
    autoSaveDebounceMs: 60_000,
    backupDir: './unused-test-backup',
  })
}

function successfulExport() {
  return {
    success: true as const,
    outputDir: './unused-test-backup',
    files: [],
    stats: { tablesExported: 0, nodesExported: 1, relationsExported: 0, totalBytes: 0 },
    errors: [],
    warnings: [],
  }
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempts = 0; attempts < 100; attempts++) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 1))
  }
  throw new Error('Timed out waiting for persistence state')
}

const quietLogger: ILogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
}

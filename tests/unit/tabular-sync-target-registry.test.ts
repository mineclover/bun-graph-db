import { describe, expect, test } from 'vitest'
import { TabularSyncTargetRegistry } from '@/infrastructure/excel/TabularSyncTargetRegistry.js'

describe('TabularSyncTargetRegistry', () => {
  test('resolve should fail closed when route target is missing even if default target exists', () => {
    const registry = new TabularSyncTargetRegistry({
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
          targetId: 'missing-target',
          sheetName: 'users',
        },
      ],
    })

    expect(registry.resolve('users')).toBeNull()
  })
})

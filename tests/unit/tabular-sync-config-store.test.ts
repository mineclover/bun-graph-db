import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { TabularSyncConfigStore } from '@/infrastructure/excel/TabularSyncConfigStore.js'

function createStore() {
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
  return {
    db,
    store: new TabularSyncConfigStore(db),
  }
}

describe('TabularSyncConfigStore', () => {
  test('save, list, get, and activate configs', () => {
    const { db, store } = createStore()

    const alpha = {
      defaultTargetId: 'alpha',
      targets: [],
      routes: [],
    }
    const beta = {
      defaultTargetId: 'beta',
      targets: [],
      routes: [],
    }

    store.saveConfig('alpha', alpha, { active: true })
    store.saveConfig('beta', beta, { active: false })

    const listed = store.listConfigs()
    expect(listed.length).toBe(2)
    expect(listed.map(({ configKey }) => configKey)).toEqual(['beta', 'alpha'])
    expect(store.getActiveConfigRecord()?.configKey).toBe('alpha')
    expect(store.getConfigRecordByKey('beta')?.config.defaultTargetId).toBe('beta')

    store.activateConfig('beta')
    expect(store.getActiveConfigRecord()?.configKey).toBe('beta')

    db.close()
  })

  test('should activate Excel configs with a valid workbook path', () => {
    const { db, store } = createStore()

    store.saveConfig(
      'excel-live',
      {
        defaultTargetId: 'excel-preview',
        targets: [
          {
            id: 'excel-live',
            kind: 'excel-file',
            workbookPath: '/tmp/demo.xlsx',
          },
        ],
        routes: [
          {
            tableIdentifier: 'users',
            targetId: 'excel-live',
          },
        ],
      },
      { active: false },
    )

    expect(() => store.activateConfig('excel-live')).not.toThrow()
    expect(store.getActiveConfigRecord()?.configKey).toBe('excel-live')

    db.close()
  })

  test('should reject activating configs with unknown route targets', () => {
    const { db, store } = createStore()

    expect(() =>
      store.saveConfig(
        'broken',
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
              targetId: 'missing-target',
            },
          ],
        },
        { active: true },
      ),
    ).toThrow("references unknown target 'missing-target'")

    db.close()
  })
})

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
    expect(store.getActiveConfigRecord()?.configKey).toBe('alpha')
    expect(store.getConfigRecordByKey('beta')?.config.defaultTargetId).toBe('beta')

    store.activateConfig('beta')
    expect(store.getActiveConfigRecord()?.configKey).toBe('beta')

    db.close()
  })
})

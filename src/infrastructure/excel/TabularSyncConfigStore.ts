import type { Database } from 'bun:sqlite'
import type { TabularSyncConfig } from './TabularSyncConfig.js'

interface TabularSyncConfigRow {
  id: number
  config_key: string
  config_json: string
  is_active: number
  created_at: string
  updated_at: string
}

export interface TabularSyncConfigRecord {
  configKey: string
  config: TabularSyncConfig
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export class TabularSyncConfigStore {
  constructor(private readonly db: Database) {}

  getActiveConfig(): TabularSyncConfig | null {
    return this.getActiveConfigRecord()?.config || null
  }

  getActiveConfigRecord(): TabularSyncConfigRecord | null {
    const row = this.db
      .query<TabularSyncConfigRow, []>(
        `
          SELECT id, config_key, config_json, is_active, created_at, updated_at
          FROM tabular_sync_configs
          WHERE is_active = 1
          ORDER BY updated_at DESC, id DESC
          LIMIT 1
        `,
      )
      .get()

    if (!row) {
      return null
    }

    return this.mapRowToRecord(row)
  }

  getConfigByKey(configKey: string): TabularSyncConfig | null {
    return this.getConfigRecordByKey(configKey)?.config || null
  }

  getConfigRecordByKey(configKey: string): TabularSyncConfigRecord | null {
    const row = this.db
      .query<TabularSyncConfigRow, [string]>(
        `
          SELECT id, config_key, config_json, is_active, created_at, updated_at
          FROM tabular_sync_configs
          WHERE config_key = ?
          ORDER BY updated_at DESC, id DESC
          LIMIT 1
        `,
      )
      .get(configKey)

    if (!row) {
      return null
    }

    return this.mapRowToRecord(row)
  }

  saveConfig(
    configKey: string,
    config: TabularSyncConfig,
    options: { active?: boolean } = {},
  ): void {
    const isActive = options.active === true ? 1 : 0

    this.db.transaction(() => {
      if (isActive === 1) {
        this.db.run('UPDATE tabular_sync_configs SET is_active = 0 WHERE config_key != ?', [
          configKey,
        ])
      }

      this.db.run(
        `
          INSERT INTO tabular_sync_configs (config_key, config_json, is_active, created_at, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(config_key)
          DO UPDATE SET
            config_json = excluded.config_json,
            is_active = excluded.is_active,
            updated_at = CURRENT_TIMESTAMP
        `,
        [configKey, JSON.stringify(config), isActive],
      )
    })()
  }

  activateConfig(configKey: string): void {
    const row = this.db
      .query<Pick<TabularSyncConfigRow, 'config_key'>, [string]>(
        `
          SELECT config_key
          FROM tabular_sync_configs
          WHERE config_key = ?
          LIMIT 1
        `,
      )
      .get(configKey)

    if (!row) {
      throw new Error(`Tabular sync config '${configKey}' not found.`)
    }

    this.db.transaction(() => {
      this.db.run('UPDATE tabular_sync_configs SET is_active = 0')
      this.db.run(
        'UPDATE tabular_sync_configs SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE config_key = ?',
        [configKey],
      )
    })()
  }

  listConfigs(): TabularSyncConfigRecord[] {
    const rows = this.db
      .query<TabularSyncConfigRow, []>(
        `
          SELECT id, config_key, config_json, is_active, created_at, updated_at
          FROM tabular_sync_configs
          ORDER BY updated_at DESC
        `,
      )
      .all()

    return rows.map((row) => this.mapRowToRecord(row))
  }

  private mapRowToRecord(row: TabularSyncConfigRow): TabularSyncConfigRecord {
    return {
      configKey: row.config_key,
      config: JSON.parse(row.config_json) as TabularSyncConfig,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}

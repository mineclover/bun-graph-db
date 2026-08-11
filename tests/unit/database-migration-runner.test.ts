import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import {
  applyDatabaseMigrations,
  createDatabaseMigrations,
  type DatabaseMigration,
} from '../../src/infrastructure/database/sqlite/DatabaseMigrationRunner'

const minimalInitialSchema = `
  CREATE TABLE tables (id INTEGER PRIMARY KEY);
  CREATE TABLE nodes (
    id INTEGER PRIMARY KEY,
    table_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    title TEXT,
    description TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE attributes (id INTEGER PRIMARY KEY);
  CREATE TABLE node_attributes (
    id INTEGER PRIMARY KEY,
    node_id INTEGER NOT NULL,
    attribute_id INTEGER NOT NULL,
    value TEXT NOT NULL
  );
  CREATE TABLE templates (
    id INTEGER PRIMARY KEY,
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT,
    avg_execution_time_ms INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE template_executions (
    id INTEGER PRIMARY KEY,
    template_id INTEGER NOT NULL,
    executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER NOT NULL,
    variables_used TEXT,
    result_count INTEGER DEFAULT 0,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    user_context TEXT
  );
  CREATE TRIGGER update_template_executions_updated_at
  AFTER UPDATE ON template_executions
  FOR EACH ROW
  BEGIN
    UPDATE template_executions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
`

describe('DatabaseMigrationRunner', () => {
  test('applies every version exactly once and persists its ledger', () => {
    const database = new Database(':memory:')

    applyDatabaseMigrations(database, createDatabaseMigrations(minimalInitialSchema))
    applyDatabaseMigrations(database, createDatabaseMigrations(minimalInitialSchema))

    const appliedVersions = database.query<{ version: number }, []>('SELECT version FROM schema_migrations ORDER BY version').all()
    const jobColumns = database.query<{ name: string }, []>('PRAGMA table_info(tabular_sync_jobs)').all()

    expect(appliedVersions.map((migration) => migration.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(jobColumns.some((column) => column.name === 'revision')).toBe(true)
    expect(database.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'node_search_fts'").get()).toBeTruthy()
    expect(database.query("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_node_attributes_attr_value_node'").get()).toBeTruthy()
    expect(database.query("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_nodes_table_created_id'").get()).toBeTruthy()
    const updatedAtColumn = database
      .query<{ name: string; notnull: number; dflt_value: string | null }, []>('PRAGMA table_info(template_executions)')
      .all()
      .find((column) => column.name === 'updated_at')
    expect(updatedAtColumn?.notnull).toBe(1)
    expect(updatedAtColumn?.dflt_value?.toLowerCase()).toContain('current_timestamp')

    database.query('INSERT INTO templates (id) VALUES (1)').run()
    database.query('INSERT INTO template_executions (template_id, execution_time_ms) VALUES (1, 10), (1, 30)').run()
    expect(database.query<{ usage_count: number; avg_execution_time_ms: number }, []>('SELECT usage_count, avg_execution_time_ms FROM templates WHERE id = 1').get()).toEqual({
      usage_count: 2,
      avg_execution_time_ms: 20,
    })
    database.query('UPDATE template_executions SET execution_time_ms = 40 WHERE id = 1').run()
    expect(database.query<{ updated_at: string | null }, []>('SELECT updated_at FROM template_executions WHERE id = 1').get()?.updated_at).not.toBeNull()
    database.query("UPDATE template_executions SET updated_at = '2099-01-01T00:00:00.000Z' WHERE id = 1").run()
    expect(database.query<{ updated_at: string }, []>('SELECT updated_at FROM template_executions WHERE id = 1').get()?.updated_at).toBe('2099-01-01T00:00:00.000Z')

    database.close()
  })

  test('preserves historical execution timestamps while upgrading the legacy trigger', () => {
    const database = new Database(':memory:')
    const migrations = createDatabaseMigrations(minimalInitialSchema)
    applyDatabaseMigrations(database, migrations.filter((migration) => migration.version <= 6))
    database.query('INSERT INTO templates (id) VALUES (1)').run()
    database.query(`
      INSERT INTO template_executions (id, template_id, executed_at, execution_time_ms)
      VALUES (1, 1, '2020-01-02T03:04:05.000Z', 25)
    `).run()

    applyDatabaseMigrations(database, migrations)

    expect(database.query<{ executed_at: string; updated_at: string }, []>(`
      SELECT executed_at, updated_at FROM template_executions WHERE id = 1
    `).get()).toEqual({
      executed_at: '2020-01-02T03:04:05.000Z',
      updated_at: '2020-01-02T03:04:05.000Z',
    })
    database.query(`
      INSERT INTO template_executions (template_id, execution_time_ms)
      VALUES (1, 30)
    `).run()
    expect(database.query<{ updated_at: string | null }, []>(`
      SELECT updated_at FROM template_executions WHERE id = 2
    `).get()?.updated_at).not.toBeNull()

    database.close()
  })

  test('rolls back both a failed migration and its ledger entry', () => {
    const database = new Database(':memory:')
    const migrations: readonly DatabaseMigration[] = [
      {
        version: 1,
        name: 'create-stable-table',
        up: (db) => db.exec('CREATE TABLE stable_table (id INTEGER PRIMARY KEY)'),
      },
      {
        version: 2,
        name: 'failing-migration',
        up: (db) => db.exec('CREATE TABLE rolled_back_table (id INTEGER PRIMARY KEY); INSERT INTO missing_table VALUES (1)'),
      },
    ]

    expect(() => applyDatabaseMigrations(database, migrations)).toThrow('no such table: missing_table')

    expect(database.query('SELECT name FROM sqlite_master WHERE name = \'stable_table\'').get()).toBeTruthy()
    expect(database.query('SELECT name FROM sqlite_master WHERE name = \'rolled_back_table\'').get()).toBeNull()
    expect(database.query<{ version: number }, []>('SELECT version FROM schema_migrations ORDER BY version').all()).toEqual([
      { version: 1 },
    ])

    database.close()
  })

  test('refuses a database created by a newer migration set', () => {
    const database = new Database(':memory:')
    database.exec('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)')
    database.query('INSERT INTO schema_migrations (version, name) VALUES (99, \'future\')').run()

    expect(() => applyDatabaseMigrations(database, [])).toThrow('unknown to this service version')

    database.close()
  })
})

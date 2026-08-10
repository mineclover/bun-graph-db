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
    metadata TEXT
  );
`

describe('DatabaseMigrationRunner', () => {
  test('applies every version exactly once and persists its ledger', () => {
    const database = new Database(':memory:')

    applyDatabaseMigrations(database, createDatabaseMigrations(minimalInitialSchema))
    applyDatabaseMigrations(database, createDatabaseMigrations(minimalInitialSchema))

    const appliedVersions = database.query<{ version: number }, []>('SELECT version FROM schema_migrations ORDER BY version').all()
    const jobColumns = database.query<{ name: string }, []>('PRAGMA table_info(tabular_sync_jobs)').all()

    expect(appliedVersions.map((migration) => migration.version)).toEqual([1, 2, 3, 4, 5])
    expect(jobColumns.some((column) => column.name === 'revision')).toBe(true)
    expect(database.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'node_search_fts'").get()).toBeTruthy()

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

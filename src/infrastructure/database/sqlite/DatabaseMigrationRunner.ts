import type { Database } from 'bun:sqlite'

export interface DatabaseMigration {
  version: number
  name: string
  up: (database: Database) => void
}

interface AppliedMigration {
  version: number
  name: string
}

const MIGRATION_LEDGER_TABLE = 'schema_migrations'

/**
 * Applies ordered SQLite migrations and records each committed version in the
 * same transaction as its schema change. A database which was migrated by a
 * newer service version, or whose history no longer matches this binary, is
 * rejected rather than being started with an unknown schema.
 */
export function applyDatabaseMigrations(database: Database, migrations: readonly DatabaseMigration[]): void {
  assertMigrationDefinitions(migrations)

  database.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_LEDGER_TABLE} (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  const appliedMigrations = database
    .query<AppliedMigration, []>(`SELECT version, name FROM ${MIGRATION_LEDGER_TABLE} ORDER BY version ASC`)
    .all()
  const migrationsByVersion = new Map(migrations.map((migration) => [migration.version, migration]))

  for (const appliedMigration of appliedMigrations) {
    const definedMigration = migrationsByVersion.get(appliedMigration.version)
    if (!definedMigration) {
      throw new Error(
        `Database contains migration ${appliedMigration.version} (${appliedMigration.name}) unknown to this service version`,
      )
    }
    if (definedMigration.name !== appliedMigration.name) {
      throw new Error(
        `Database migration ${appliedMigration.version} name mismatch: expected '${definedMigration.name}', found '${appliedMigration.name}'`,
      )
    }
  }

  const appliedVersions = new Set(appliedMigrations.map((migration) => migration.version))
  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      continue
    }

    database.transaction(() => {
      migration.up(database)
      database
        .query(`INSERT INTO ${MIGRATION_LEDGER_TABLE} (version, name) VALUES ($version, $name)`)
        .run({ $version: migration.version, $name: migration.name })
    })()
  }
}

export function createDatabaseMigrations(initialSchema: string): readonly DatabaseMigration[] {
  return [
    {
      version: 1,
      name: 'initial-schema',
      up: (database) => database.exec(initialSchema),
    },
    {
      version: 2,
      name: 'nodes-metadata',
      up: (database) => {
        const nodeColumns = database.query<{ name: string }, []>('PRAGMA table_info(nodes)').all()
        if (!nodeColumns.some((column) => column.name === 'metadata')) {
          database.exec('ALTER TABLE nodes ADD COLUMN metadata TEXT')
        }
      },
    },
    {
      version: 3,
      name: 'node-search-fts',
      up: (database) => {
        database.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS node_search_fts USING fts5(
            node_id UNINDEXED,
            table_id UNINDEXED,
            content,
            tokenize = 'unicode61 remove_diacritics 2'
          );

          CREATE TRIGGER IF NOT EXISTS node_search_fts_insert
          AFTER INSERT ON nodes BEGIN
            INSERT INTO node_search_fts(rowid, node_id, table_id, content)
            VALUES (new.rowid, new.id, new.table_id, trim(coalesce(new.title, '') || ' ' || coalesce(new.description, '') || ' ' || coalesce(new.content, '') || ' ' || coalesce(new.metadata, '')));
          END;

          CREATE TRIGGER IF NOT EXISTS node_search_fts_update
          AFTER UPDATE OF table_id, content, title, description, metadata ON nodes BEGIN
            DELETE FROM node_search_fts WHERE rowid = old.rowid;
            INSERT INTO node_search_fts(rowid, node_id, table_id, content)
            VALUES (new.rowid, new.id, new.table_id, trim(coalesce(new.title, '') || ' ' || coalesce(new.description, '') || ' ' || coalesce(new.content, '') || ' ' || coalesce(new.metadata, '')));
          END;

          CREATE TRIGGER IF NOT EXISTS node_search_fts_delete
          AFTER DELETE ON nodes BEGIN
            DELETE FROM node_search_fts WHERE rowid = old.rowid;
          END;

          INSERT INTO node_search_fts(rowid, node_id, table_id, content)
          SELECT n.rowid, n.id, n.table_id, trim(coalesce(n.title, '') || ' ' || coalesce(n.description, '') || ' ' || coalesce(n.content, '') || ' ' || coalesce(n.metadata, ''))
          FROM nodes n
          WHERE NOT EXISTS (SELECT 1 FROM node_search_fts fts WHERE fts.rowid = n.rowid);
        `)
      },
    },
    {
      version: 4,
      name: 'tabular-sync-configs-and-events',
      up: (database) => {
        database.exec(`
          CREATE TABLE IF NOT EXISTS tabular_sync_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            config_key TEXT NOT NULL UNIQUE,
            config_json TEXT NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS tabular_sync_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_identifier TEXT NOT NULL,
            mode TEXT NOT NULL,
            status TEXT NOT NULL,
            error_message TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `)
      },
    },
    {
      version: 5,
      name: 'tabular-sync-jobs',
      up: (database) => {
        database.exec(`
          CREATE TABLE IF NOT EXISTS tabular_sync_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_identifier TEXT NOT NULL,
            mode TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'retry_wait', 'paused', 'succeeded', 'failed')),
            attempts INTEGER NOT NULL DEFAULT 0,
            revision INTEGER NOT NULL DEFAULT 0,
            next_attempt_at TEXT,
            lease_owner TEXT,
            lease_expires_at TEXT,
            last_error TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at TEXT,
            UNIQUE(table_identifier)
          );

          CREATE INDEX IF NOT EXISTS idx_tabular_sync_jobs_due
          ON tabular_sync_jobs(status, next_attempt_at);
        `)
      },
    },
  ]
}

function assertMigrationDefinitions(migrations: readonly DatabaseMigration[]): void {
  let previousVersion = 0
  const names = new Set<string>()

  for (const migration of migrations) {
    if (!Number.isSafeInteger(migration.version) || migration.version <= previousVersion) {
      throw new Error('Database migrations must use unique, strictly increasing positive integer versions')
    }
    if (!migration.name || names.has(migration.name)) {
      throw new Error('Database migrations must use unique, non-empty names')
    }
    previousVersion = migration.version
    names.add(migration.name)
  }
}

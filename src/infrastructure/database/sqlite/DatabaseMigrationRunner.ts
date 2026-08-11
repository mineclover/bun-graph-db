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

interface TableColumn {
  name: string
  notnull: number
  dflt_value: string | null
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
    {
      version: 6,
      name: 'node-search-page-indexes',
      up: (database) => {
        database.exec(`
          CREATE INDEX IF NOT EXISTS idx_node_attributes_attr_value_node
          ON node_attributes(attribute_id, value, node_id);

          CREATE INDEX IF NOT EXISTS idx_nodes_table_created_id
          ON nodes(table_id, created_at DESC, id);
        `)
      },
    },
    {
      version: 7,
      name: 'template-execution-timestamps-and-running-average',
      up: (database) => {
        normalizeTemplateExecutionTimestampContract(database)
        installTemplateExecutionTriggers(database)
      },
    },
    {
      version: 8,
      name: 'remove-redundant-unique-indexes',
      up: (database) => {
        // SQLite already maintains auto-indexes for the corresponding UNIQUE
        // constraints, so these copies only amplify writes and consume space.
        database.exec(`
          DROP INDEX IF EXISTS idx_nodes_table_content;
          DROP INDEX IF EXISTS idx_attribute_types_identifier;
          DROP INDEX IF EXISTS idx_attributes_table_identifier;
          DROP INDEX IF EXISTS idx_templates_identifier;
        `)
      },
    },
    {
      version: 9,
      name: 'skip-redundant-timestamp-writes',
      up: (database) => {
        for (const table of [
          'tables',
          'nodes',
          'attribute_types',
          'attributes',
          'node_attributes',
          'docs',
          'templates',
          'node_relations',
          'relation_types',
          'template_executions',
        ]) {
          const exists = database
            .query<{ name: string }, [string]>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
            .get(table)
          if (!exists) continue
          const columns = database.query<{ name: string }, []>(`PRAGMA table_info(${table})`).all()
          if (!columns.some((column) => column.name === 'updated_at')) continue
          database.exec(`
            DROP TRIGGER IF EXISTS update_${table}_updated_at;
            CREATE TRIGGER update_${table}_updated_at
            AFTER UPDATE ON ${table}
            FOR EACH ROW
            WHEN NEW.updated_at IS OLD.updated_at
            BEGIN
              UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END;
          `)
        }
      },
    },
    {
      version: 10,
      name: 'normalize-template-execution-timestamp-contract',
      up: (database) => {
        // Repairs databases which may have run an earlier development build of
        // migration 7 where updated_at was nullable and had no default.
        normalizeTemplateExecutionTimestampContract(database)
        installTemplateExecutionTriggers(database)
      },
    },
  ]
}

function normalizeTemplateExecutionTimestampContract(database: Database): void {
  const tableExists = database
    .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'template_executions'")
    .get()
  if (!tableExists) return

  const columns = database.query<TableColumn, []>('PRAGMA table_info(template_executions)').all()
  const updatedAt = columns.find((column) => column.name === 'updated_at')
  const normalizedDefault = updatedAt?.dflt_value?.replace(/[()'"\s]/g, '').toLowerCase()
  if (updatedAt?.notnull === 1 && normalizedDefault === 'current_timestamp') return

  const available = new Set(columns.map((column) => column.name))
  const selectOr = (column: string, fallback: string): string => available.has(column) ? column : fallback

  database.exec(`
    DROP TRIGGER IF EXISTS update_template_executions_updated_at;
    DROP TRIGGER IF EXISTS update_template_usage;
    ALTER TABLE template_executions RENAME TO template_executions_legacy_timestamp;

    CREATE TABLE template_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      execution_time_ms INTEGER NOT NULL,
      variables_used TEXT,
      result_count INTEGER DEFAULT 0,
      success BOOLEAN NOT NULL DEFAULT TRUE,
      error_message TEXT,
      user_context TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
    );

    INSERT INTO template_executions (
      id, template_id, executed_at, execution_time_ms, variables_used,
      result_count, success, error_message, user_context, updated_at
    )
    SELECT
      id,
      template_id,
      executed_at,
      execution_time_ms,
      ${selectOr('variables_used', 'NULL')},
      ${selectOr('result_count', '0')},
      ${selectOr('success', 'TRUE')},
      ${selectOr('error_message', 'NULL')},
      ${selectOr('user_context', 'NULL')},
      ${updatedAt ? 'coalesce(updated_at, executed_at, CURRENT_TIMESTAMP)' : 'coalesce(executed_at, CURRENT_TIMESTAMP)'}
    FROM template_executions_legacy_timestamp;

    DROP TABLE template_executions_legacy_timestamp;
  `)
}

function installTemplateExecutionTriggers(database: Database): void {
  database.exec(`
    DROP TRIGGER IF EXISTS update_template_executions_updated_at;
    CREATE TRIGGER update_template_executions_updated_at
    AFTER UPDATE ON template_executions
    FOR EACH ROW
    WHEN NEW.updated_at IS OLD.updated_at
    BEGIN
      UPDATE template_executions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

    DROP TRIGGER IF EXISTS update_template_usage;
    CREATE TRIGGER update_template_usage
    AFTER INSERT ON template_executions
    FOR EACH ROW
    BEGIN
      UPDATE templates
      SET
        usage_count = usage_count + 1,
        last_used_at = NEW.executed_at,
        avg_execution_time_ms =
          ((avg_execution_time_ms * usage_count) + NEW.execution_time_ms) / (usage_count + 1)
      WHERE id = NEW.template_id;
    END;
  `)
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

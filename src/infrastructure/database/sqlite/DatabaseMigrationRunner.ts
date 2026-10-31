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
    {
      version: 11,
      name: 'node-attributes-typed-value-num',
      up: (database) => {
        installTypedNodeAttributeProjection(database)
      },
    },
    {
      version: 12,
      name: 'fts-attributes-and-relation-traversal-indexes',
      up: (database) => {
        installAttributeFullTextAndRelationTraversalIndexes(database)
      },
    },
    {
      version: 13,
      name: 'persistent-node-embeddings',
      up: (database) => {
        installPersistentNodeEmbeddings(database)
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

function typedNumericValueSql(valueExpr: string, attributeIdExpr: string): string {
  return `(
    SELECT CASE
      WHEN at.json_type IN ('number', 'integer')
        AND trim(${valueExpr}) != ''
        AND json_valid(trim(${valueExpr})) = 1
        AND json_type(trim(${valueExpr})) IN ('integer', 'real')
        THEN CAST(trim(${valueExpr}) AS REAL)
      WHEN at.json_type = 'boolean'
        THEN CASE lower(trim(${valueExpr}))
          WHEN 'true' THEN 1.0
          WHEN '1' THEN 1.0
          WHEN 'false' THEN 0.0
          WHEN '0' THEN 0.0
          ELSE NULL
        END
      WHEN (
        at.json_type = 'datetime'
        OR (at.json_type = 'string' AND at.format IN ('date', 'date-time', 'datetime'))
      )
        THEN julianday(trim(${valueExpr}))
      ELSE NULL
    END
    FROM attributes a
    JOIN attribute_types at ON at.id = a.attribute_type_id
    WHERE a.id = ${attributeIdExpr}
  )`
}

function installTypedNodeAttributeProjection(database: Database): void {
  const hasNodeAttributes = database
    .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'node_attributes'")
    .get()
  if (!hasNodeAttributes) return

  const nodeAttrColumns = database.query<TableColumn, []>('PRAGMA table_info(node_attributes)').all()
  if (!nodeAttrColumns.some((column) => column.name === 'value_num')) {
    database.exec('ALTER TABLE node_attributes ADD COLUMN value_num REAL')
  }

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_node_attributes_attr_num_node
    ON node_attributes(attribute_id, value_num, node_id)
    WHERE value_num IS NOT NULL;
  `)

  const hasAttributeTypes = database
    .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'attribute_types'")
    .get()
  const attrColumns = database.query<TableColumn, []>('PRAGMA table_info(attributes)').all()
  const hasAttributeTypeId = attrColumns.some((column) => column.name === 'attribute_type_id')
  if (!hasAttributeTypes || !hasAttributeTypeId) return

  database.exec(`
    DROP TRIGGER IF EXISTS trg_node_attributes_sync_value_num_insert;
    CREATE TRIGGER trg_node_attributes_sync_value_num_insert
    AFTER INSERT ON node_attributes
    FOR EACH ROW
    BEGIN
      UPDATE node_attributes
      SET value_num = ${typedNumericValueSql('NEW.value', 'NEW.attribute_id')}
      WHERE id = NEW.id;
    END;

    DROP TRIGGER IF EXISTS trg_node_attributes_sync_value_num_update;
    CREATE TRIGGER trg_node_attributes_sync_value_num_update
    AFTER UPDATE OF value, attribute_id ON node_attributes
    FOR EACH ROW
    BEGIN
      UPDATE node_attributes
      SET value_num = ${typedNumericValueSql('NEW.value', 'NEW.attribute_id')}
      WHERE id = NEW.id;
    END;

    DROP TRIGGER IF EXISTS trg_attribute_types_refresh_value_num;
    CREATE TRIGGER trg_attribute_types_refresh_value_num
    AFTER UPDATE OF json_type, format ON attribute_types
    FOR EACH ROW
    BEGIN
      UPDATE node_attributes
      SET value_num = ${typedNumericValueSql('node_attributes.value', 'node_attributes.attribute_id')}
      WHERE attribute_id IN (SELECT id FROM attributes WHERE attribute_type_id = NEW.id);
    END;

    UPDATE node_attributes
    SET value_num = ${typedNumericValueSql('node_attributes.value', 'node_attributes.attribute_id')};
  `)
}

function installAttributeFullTextAndRelationTraversalIndexes(database: Database): void {
  const hasNodes = database
    .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'nodes'")
    .get()
  const hasNodeAttributes = database
    .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'node_attributes'")
    .get()

  if (hasNodes && hasNodeAttributes) {
    database.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS node_attribute_search_fts USING fts5(
        node_id UNINDEXED,
        table_id UNINDEXED,
        value,
        tokenize = 'unicode61 remove_diacritics 2'
      );

      DROP TRIGGER IF EXISTS node_attribute_search_fts_insert;
      CREATE TRIGGER node_attribute_search_fts_insert
      AFTER INSERT ON node_attributes
      BEGIN
        INSERT INTO node_attribute_search_fts(rowid, node_id, table_id, value)
        SELECT new.rowid, new.node_id, n.table_id, coalesce(new.value, '')
        FROM nodes n
        WHERE n.id = new.node_id;
      END;

      DROP TRIGGER IF EXISTS node_attribute_search_fts_update;
      CREATE TRIGGER node_attribute_search_fts_update
      AFTER UPDATE OF node_id, value ON node_attributes
      BEGIN
        DELETE FROM node_attribute_search_fts WHERE rowid = old.rowid;
        INSERT INTO node_attribute_search_fts(rowid, node_id, table_id, value)
        SELECT new.rowid, new.node_id, n.table_id, coalesce(new.value, '')
        FROM nodes n
        WHERE n.id = new.node_id;
      END;

      DROP TRIGGER IF EXISTS node_attribute_search_fts_delete;
      CREATE TRIGGER node_attribute_search_fts_delete
      AFTER DELETE ON node_attributes
      BEGIN
        DELETE FROM node_attribute_search_fts WHERE rowid = old.rowid;
      END;

      DROP TRIGGER IF EXISTS nodes_attribute_search_fts_table_update;
      CREATE TRIGGER nodes_attribute_search_fts_table_update
      AFTER UPDATE OF table_id ON nodes
      BEGIN
        DELETE FROM node_attribute_search_fts
        WHERE rowid IN (SELECT rowid FROM node_attributes WHERE node_id = new.id);
        INSERT INTO node_attribute_search_fts(rowid, node_id, table_id, value)
        SELECT na.rowid, na.node_id, new.table_id, coalesce(na.value, '')
        FROM node_attributes na
        WHERE na.node_id = new.id;
      END;

      INSERT INTO node_attribute_search_fts(rowid, node_id, table_id, value)
      SELECT na.rowid, na.node_id, n.table_id, coalesce(na.value, '')
      FROM node_attributes na
      JOIN nodes n ON n.id = na.node_id
      WHERE NOT EXISTS (
        SELECT 1 FROM node_attribute_search_fts fts WHERE fts.rowid = na.rowid
      );
    `)
  }

  const hasNodeRelations = database
    .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'node_relations'")
    .get()
  if (hasNodeRelations) {
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_node_relations_src_type_dst
      ON node_relations(source_node_id, relation_type_id, target_node_id)
      WHERE source_node_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_node_relations_dst_type_src
      ON node_relations(target_node_id, relation_type_id, source_node_id)
      WHERE target_node_id IS NOT NULL;
    `)
  }
}

function installPersistentNodeEmbeddings(database: Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS node_embeddings (
      node_id INTEGER PRIMARY KEY,
      table_id INTEGER NOT NULL,
      dimension INTEGER NOT NULL CHECK (dimension > 0),
      model TEXT NOT NULL DEFAULT 'default',
      vector_blob BLOB NOT NULL,
      norm REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_node_embeddings_table_dim
    ON node_embeddings(table_id, dimension);

    CREATE TABLE IF NOT EXISTS node_embedding_revisions (
      table_id INTEGER PRIMARY KEY,
      revision INTEGER NOT NULL DEFAULT 1
    );

    DROP TRIGGER IF EXISTS node_embeddings_rev_insert;
    CREATE TRIGGER node_embeddings_rev_insert
    AFTER INSERT ON node_embeddings
    BEGIN
      INSERT INTO node_embedding_revisions(table_id, revision)
      VALUES (new.table_id, 1)
      ON CONFLICT(table_id) DO UPDATE SET revision = revision + 1;
    END;

    DROP TRIGGER IF EXISTS node_embeddings_rev_update;
    CREATE TRIGGER node_embeddings_rev_update
    AFTER UPDATE ON node_embeddings
    BEGIN
      INSERT INTO node_embedding_revisions(table_id, revision)
      VALUES (new.table_id, 1)
      ON CONFLICT(table_id) DO UPDATE SET revision = revision + 1;
      INSERT INTO node_embedding_revisions(table_id, revision)
      VALUES (old.table_id, 1)
      ON CONFLICT(table_id) DO UPDATE SET revision = revision + 1;
    END;

    DROP TRIGGER IF EXISTS node_embeddings_rev_delete;
    CREATE TRIGGER node_embeddings_rev_delete
    AFTER DELETE ON node_embeddings
    BEGIN
      INSERT INTO node_embedding_revisions(table_id, revision)
      VALUES (old.table_id, 1)
      ON CONFLICT(table_id) DO UPDATE SET revision = revision + 1;
    END;
  `)

  const hasNodes = database
    .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'nodes'")
    .get()
  if (hasNodes) {
    database.exec(`
      DROP TRIGGER IF EXISTS nodes_embeddings_table_update;
      CREATE TRIGGER nodes_embeddings_table_update
      AFTER UPDATE OF table_id ON nodes
      BEGIN
        UPDATE node_embeddings
        SET table_id = new.table_id,
            updated_at = CURRENT_TIMESTAMP
        WHERE node_id = new.id;
      END;

      DROP TRIGGER IF EXISTS nodes_embeddings_node_delete;
      CREATE TRIGGER nodes_embeddings_node_delete
      AFTER DELETE ON nodes
      BEGIN
        DELETE FROM node_embeddings WHERE node_id = old.id;
      END;
    `)
  }

  const hasTables = database
    .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tables'")
    .get()
  if (hasTables) {
    database.exec(`
      DROP TRIGGER IF EXISTS tables_embeddings_table_delete;
      CREATE TRIGGER tables_embeddings_table_delete
      AFTER DELETE ON tables
      BEGIN
        DELETE FROM node_embeddings WHERE table_id = old.id;
      END;
    `)
  }
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

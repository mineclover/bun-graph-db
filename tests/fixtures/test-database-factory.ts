/**
 * Test Database Factory
 * Creates isolated SQLite databases for each test suite with enhanced TypeScript validation
 * ENFORCES file-based SQLite for enhanced test isolation and migration compatibility
 */

import { TestDatabase } from '../system-queries/fixtures/test-database-setup'
import type { Database } from 'bun:sqlite'
// Local type definitions (previously from migration-tools)
type DatabasePath = {
  readonly path: string
  readonly type: 'file' | 'memory'
  readonly isTemporary: boolean
}

type TestIsolationConfig = {
  readonly enableIsolation: boolean
  readonly cleanupStrategy: 'immediate' | 'deferred' | 'manual'
  readonly maxDatabaseAge: number
}

type TestType = 'unit' | 'integration' | 'e2e' | 'performance'

export interface TestEnvironment {
  readonly database: TestDatabase
  readonly databasePath: string
  readonly databaseInfo: DatabasePath
  readonly isolationConfig: TestIsolationConfig
  readonly testType?: TestType
  readonly cleanup: () => Promise<void>
}

export interface FileBasedValidationResult {
  readonly isValid: boolean
  readonly violations: readonly string[]
  readonly enforcementLevel: 'strict' | 'warning' | 'disabled'
  readonly validatedPaths: readonly string[]
}

export class TestDatabaseFactory {
  private static instances: Map<string, TestEnvironment> = new Map()

  /**
   * Create isolated database for test suite with enhanced TypeScript validation
   * ENFORCES file-based SQLite for enhanced test isolation and migration compatibility
   */
  static async createTestEnvironment(
    suiteName: string,
    testType?: TestType,
    _isolationLevel: 'basic' | 'enhanced' | 'complete' = 'enhanced'
  ): Promise<TestEnvironment> {
    // TypeScript validation
    if (typeof suiteName !== 'string' || suiteName.trim().length === 0) {
      throw new Error('Suite name must be a non-empty string')
    }

    // Check if already exists
    if (TestDatabaseFactory.instances.has(suiteName)) {
      await TestDatabaseFactory.cleanupTestEnvironment(suiteName)
    }

    // ENFORCE file-based databases - NO in-memory allowed
    const uniqueName = `${suiteName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const tempDir = '/tmp/bun-graph-db-tests'

    // Validate path security
    TestDatabaseFactory.validateSecurePath(tempDir)

    const testDb = new TestDatabase({
      name: uniqueName,
      inMemory: false, // MANDATORY: file-based for proper isolation
      tempDir
    })

    await testDb.setup()

    // Verify file-based enforcement
    if (testDb.path === ':memory:' || testDb.path.includes(':memory:')) {
      throw new Error(`CRITICAL: In-memory database detected for ${suiteName}. File-based enforcement failed.`)
    }

    // Initialize with app schema
    await TestDatabaseFactory.initializeAppSchema(testDb.getConnection())

    // Create enhanced database info
    const databaseInfo: DatabasePath = {
      path: testDb.path,
      isFileBase: true,
      isTemporary: true
    }

    // Create isolation config
    const isolationConfig: TestIsolationConfig = {
      enforceFileBased: true,
      tempDirectory: tempDir,
      uniqueNaming: true,
      cleanupOnExit: true
    }

    const environment: TestEnvironment = {
      database: testDb,
      databasePath: testDb.path,
      databaseInfo,
      isolationConfig,
      testType,
      cleanup: async () => {
        await testDb.teardown()
        TestDatabaseFactory.instances.delete(suiteName)
      }
    }

    TestDatabaseFactory.instances.set(suiteName, environment)
    return environment
  }

  /**
   * Initialize database with application schema
   */
  private static async initializeAppSchema(db: Database): void {
    // Create main application tables
    db.exec(`
      -- Tables table for metadata (matches production schema)
      CREATE TABLE IF NOT EXISTS tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Insert todos table metadata
      INSERT OR IGNORE INTO tables (id, identifier, description)
      VALUES (58, 'test-todos', 'Test todos table for doc system tests');

      -- Nodes table
      CREATE TABLE IF NOT EXISTS nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        title TEXT,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
        UNIQUE(table_id, content)
      );

      -- Attribute types table
      CREATE TABLE IF NOT EXISTS attribute_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT NOT NULL UNIQUE,
        json_type TEXT NOT NULL,
        format TEXT,
        description TEXT,
        validation_schema TEXT,
        reference_config TEXT,
        default_value TEXT,
        examples TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Attributes table
      CREATE TABLE IF NOT EXISTS attributes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER NOT NULL,
        identifier TEXT NOT NULL,
        attribute_type_id INTEGER NOT NULL,
        description TEXT,
        is_required BOOLEAN NOT NULL DEFAULT FALSE,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
        FOREIGN KEY (attribute_type_id) REFERENCES attribute_types(id) ON DELETE RESTRICT,
        UNIQUE(table_id, identifier)
      );

      -- Node attributes table
      CREATE TABLE IF NOT EXISTS node_attributes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id INTEGER NOT NULL,
        attribute_id INTEGER NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (attribute_id) REFERENCES attributes(id) ON DELETE CASCADE,
        UNIQUE(node_id, attribute_id)
      );

      -- Relation types table
      CREATE TABLE IF NOT EXISTS relation_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT NOT NULL UNIQUE,
        description TEXT,
        category TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Node relations table
      CREATE TABLE IF NOT EXISTS node_relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER NOT NULL,
        source_node_id INTEGER,
        source_external_id TEXT DEFAULT 'internal',
        target_node_id INTEGER,
        target_external_id TEXT DEFAULT 'internal',
        relation_type_id INTEGER NOT NULL,
        properties TEXT,
        strength INTEGER DEFAULT 1,
        confidence INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
        FOREIGN KEY (source_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (target_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (relation_type_id) REFERENCES relation_types(id) ON DELETE CASCADE,
        CHECK ((source_node_id IS NOT NULL AND source_external_id = 'internal') OR
               (source_node_id IS NULL AND source_external_id != 'internal')),
        CHECK ((target_node_id IS NOT NULL AND target_external_id = 'internal') OR
               (target_node_id IS NULL AND target_external_id != 'internal')),
        CHECK (strength >= 0 AND strength <= 4),
        CHECK (confidence >= 0 AND confidence <= 4),
        UNIQUE(table_id, source_node_id, source_external_id, target_node_id, target_external_id, relation_type_id)
      );

      -- Todos table
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Documentation table
      CREATE TABLE IF NOT EXISTS docs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        content TEXT NOT NULL,
        is_active BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (table_id) REFERENCES tables (id),
        UNIQUE(table_id, category, version)
      );

      -- Template tables for GraphQL templates (Enhanced Schema)
      CREATE TABLE IF NOT EXISTS templates (
        -- Basic identifiers
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT NOT NULL UNIQUE,

        -- Metadata
        name TEXT NOT NULL DEFAULT '',
        description TEXT,
        version TEXT DEFAULT '1.0.0',
        is_active BOOLEAN DEFAULT TRUE,
        tags TEXT, -- JSON array of tags

        -- GraphQL specific
        query_text TEXT NOT NULL,
        query_name TEXT, -- Extracted GraphQL operation name
        operation_type TEXT NOT NULL,
        variables_schema TEXT, -- JSON schema for variables
        default_variables TEXT, -- JSON default variable values
        applicable_tables TEXT, -- JSON array of applicable table names
        complexity_score INTEGER DEFAULT 1,

        -- Performance tracking
        usage_count INTEGER DEFAULT 0,
        last_used_at TEXT,
        avg_execution_time_ms INTEGER DEFAULT 0,

        -- Timestamps
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Performance and search indexes for templates
      CREATE INDEX IF NOT EXISTS idx_templates_query_name ON templates(query_name);
      CREATE INDEX IF NOT EXISTS idx_templates_operation_type ON templates(operation_type);
      CREATE INDEX IF NOT EXISTS idx_templates_complexity ON templates(complexity_score);
      CREATE INDEX IF NOT EXISTS idx_templates_performance ON templates(avg_execution_time_ms, usage_count);
      CREATE INDEX IF NOT EXISTS idx_templates_last_used ON templates(last_used_at);
      CREATE INDEX IF NOT EXISTS idx_templates_query_op ON templates(query_name, operation_type);
      CREATE INDEX IF NOT EXISTS idx_templates_op_complexity ON templates(operation_type, complexity_score);
      CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(is_active);
      CREATE INDEX IF NOT EXISTS idx_templates_version ON templates(version);

      -- System stats tables (for system queries tests)
      CREATE TABLE IF NOT EXISTS system_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        cpu_usage REAL,
        memory_usage REAL,
        disk_usage REAL,
        uptime INTEGER
      );

      CREATE TABLE IF NOT EXISTS memory_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_memory INTEGER,
        free_memory INTEGER,
        used_memory INTEGER,
        buffer_cache INTEGER
      );

      CREATE TABLE IF NOT EXISTS health_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        service_name TEXT NOT NULL,
        status TEXT NOT NULL,
        response_time REAL,
        error_message TEXT
      );

      -- Insert default attribute types
      INSERT OR IGNORE INTO attribute_types (identifier, json_type, format, description, validation_schema, reference_config, default_value, examples) VALUES
        ('string', 'string', NULL, 'Basic string type', NULL, NULL, '""', '["hello", "world"]'),
        ('boolean', 'boolean', NULL, 'Boolean true/false', NULL, NULL, 'false', '[true, false]'),
        ('integer', 'integer', NULL, 'Integer number', '{"minimum": 0}', NULL, '0', '[1, 42, 100]'),
        ('number', 'number', NULL, 'Decimal number', NULL, NULL, '0.0', '[1.5, 3.14, 100.0]'),
        ('date', 'string', 'date', 'Date in YYYY-MM-DD format', '{"pattern": "^\\\\d{4}-\\\\d{2}-\\\\d{2}$"}', NULL, '"2024-01-01"', '["2024-01-01", "2023-12-31"]'),
        ('datetime', 'string', 'date-time', 'ISO 8601 datetime', NULL, NULL, '"2024-01-01T00:00:00Z"', '["2024-01-01T12:00:00Z", "2023-12-31T23:59:59Z"]'),
        ('email', 'string', 'email', 'Email address', NULL, NULL, '"user@example.com"', '["user@domain.com", "test@example.org"]'),
        ('uri', 'string', 'uri', 'URI/URL', NULL, NULL, '"https://example.com"', '["https://example.com", "http://localhost:3000"]'),
        ('uuid', 'string', 'uuid', 'UUID identifier', '{"pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"}', NULL, '"00000000-0000-0000-0000-000000000000"', '["123e4567-e89b-12d3-a456-426614174000"]'),
        ('text', 'string', NULL, 'Long text content', '{"minLength": 0}', NULL, '""', '["Short text", "Lorem ipsum dolor sit amet..."]'),
        ('json', 'object', NULL, 'JSON object', NULL, NULL, '{}', '[{"key": "value"}, {"name": "John", "age": 30}]'),
        ('array', 'array', NULL, 'JSON array', NULL, NULL, '[]', '[["item1", "item2"], [1, 2, 3]]');

      -- Insert default relation types
      INSERT OR IGNORE INTO relation_types (identifier, description, category) VALUES
        ('depends_on', 'Direct dependency', 'structural'),
        ('related_to', 'Related entity', 'semantic'),
        ('extends', 'Extension relationship', 'hierarchy'),
        ('implements', 'Implementation relationship', 'structural'),
        ('references', 'Reference relationship', 'reference'),
        ('parent_of', 'Parent-child relationship', 'hierarchy'),
        ('linked_to', 'Bidirectional link', 'semantic');

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_nodes_table_content ON nodes(table_id, content);
      CREATE INDEX IF NOT EXISTS idx_attribute_types_identifier ON attribute_types(identifier);
      CREATE INDEX IF NOT EXISTS idx_attribute_types_json_type ON attribute_types(json_type);
      CREATE INDEX IF NOT EXISTS idx_attributes_table_identifier ON attributes(table_id, identifier);
      CREATE INDEX IF NOT EXISTS idx_attributes_type ON attributes(attribute_type_id);
      CREATE INDEX IF NOT EXISTS idx_node_attributes_node ON node_attributes(node_id);
      CREATE INDEX IF NOT EXISTS idx_node_attributes_attr ON node_attributes(attribute_id);
      CREATE INDEX IF NOT EXISTS idx_node_relations_source ON node_relations(source_node_id);
      CREATE INDEX IF NOT EXISTS idx_node_relations_target ON node_relations(target_node_id);
      CREATE INDEX IF NOT EXISTS idx_node_relations_source_ext ON node_relations(source_external_id);
      CREATE INDEX IF NOT EXISTS idx_node_relations_target_ext ON node_relations(target_external_id);
      CREATE INDEX IF NOT EXISTS idx_node_relations_type ON node_relations(relation_type_id);
      CREATE INDEX IF NOT EXISTS idx_node_relations_table ON node_relations(table_id);
      CREATE INDEX IF NOT EXISTS idx_docs_table_category ON docs(table_id, category);
      CREATE INDEX IF NOT EXISTS idx_docs_active ON docs(is_active);
      CREATE INDEX IF NOT EXISTS idx_system_stats_timestamp ON system_stats(timestamp);
      CREATE INDEX IF NOT EXISTS idx_memory_stats_timestamp ON memory_stats(timestamp);
      CREATE INDEX IF NOT EXISTS idx_health_checks_timestamp ON health_checks(timestamp);
    `)
  }

  /**
   * Get existing test environment
   */
  static getTestEnvironment(suiteName: string): TestEnvironment | null {
    return TestDatabaseFactory.instances.get(suiteName) || null
  }

  /**
   * Cleanup specific test environment
   */
  static async cleanupTestEnvironment(suiteName: string): Promise<void> {
    const env = TestDatabaseFactory.instances.get(suiteName)
    if (env) {
      await env.cleanup()
    }
  }

  /**
   * Cleanup all test environments
   */
  static async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(TestDatabaseFactory.instances.values()).map(env => env.cleanup())
    await Promise.all(cleanupPromises)
    TestDatabaseFactory.instances.clear()
  }

  /**
   * DEPRECATED: Create in-memory database for unit tests
   * This method is deprecated in favor of file-based databases for better isolation
   */
  static async createInMemoryEnvironment(suiteName: string): Promise<TestEnvironment> {
    console.warn(`WARNING: createInMemoryEnvironment is deprecated for ${suiteName}. Use createTestEnvironment for file-based isolation.`)

    // Force file-based even for "in-memory" requests
    return TestDatabaseFactory.createTestEnvironment(`legacy-${suiteName}`)
  }

  /**
   * Validates that all active databases are file-based with enhanced TypeScript validation
   */
  static validateFileBasedEnforcement(): FileBasedValidationResult {
    const violations: string[] = []
    const validatedPaths: string[] = []

    for (const [suiteName, env] of TestDatabaseFactory.instances.entries()) {
      validatedPaths.push(env.databasePath)

      // Check for in-memory database patterns
      if (env.databasePath === ':memory:' || env.databasePath.includes(':memory:')) {
        violations.push(`Suite "${suiteName}" using in-memory database: ${env.databasePath}`)
      }

      // Validate file-based requirements
      if (!env.databaseInfo.isFileBase) {
        violations.push(`Suite "${suiteName}" database info indicates non-file-based: ${env.databasePath}`)
      }

      // Validate isolation config
      if (!env.isolationConfig.enforceFileBased) {
        violations.push(`Suite "${suiteName}" isolation config allows non-file-based databases`)
      }

      // Validate path structure for temporary files
      if (env.databaseInfo.isTemporary && !env.databasePath.includes('/tmp/bun-graph-db-tests/')) {
        violations.push(`Suite "${suiteName}" temporary database not in expected directory: ${env.databasePath}`)
      }
    }

    return {
      isValid: violations.length === 0,
      violations: Object.freeze(violations),
      enforcementLevel: 'strict',
      validatedPaths: Object.freeze(validatedPaths)
    }
  }

  /**
   * Validate secure path to prevent directory traversal attacks
   */
  private static validateSecurePath(path: string): void {
    // Check for directory traversal patterns
    if (path.includes('..') || path.includes('~')) {
      throw new Error(`Insecure path detected: ${path}`)
    }

    // Ensure path is absolute for temp directories
    if (path.startsWith('/tmp/') && !path.includes('..')) {
      return // Valid temp path
    }

    throw new Error(`Invalid database path: ${path}. Must be in /tmp/ directory.`)
  }

  /**
   * Create file-based environment for migration testing
   * Enhanced method specifically for test migration system
   */
  static async createFileBasedEnvironment(
    suiteName: string,
    testType: TestType,
    options: {
      isolationLevel?: 'basic' | 'enhanced' | 'complete'
      customTempDir?: string
      metadata?: Record<string, unknown>
    } = {}
  ): Promise<TestEnvironment> {
    const { isolationLevel = 'complete', customTempDir, metadata } = options

    // Use custom temp directory if provided (with validation)
    if (customTempDir) {
      TestDatabaseFactory.validateSecurePath(customTempDir)
    }

    const env = await TestDatabaseFactory.createTestEnvironment(suiteName, testType, isolationLevel)

    // Add metadata if provided
    if (metadata) {
      (env as any).metadata = metadata
    }

    return env
  }
}

// Global cleanup on process exit
process.on('exit', () => {
  TestDatabaseFactory.cleanupAll()
})

process.on('SIGINT', async () => {
  await TestDatabaseFactory.cleanupAll()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await TestDatabaseFactory.cleanupAll()
  process.exit(0)
})
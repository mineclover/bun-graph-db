/**
 * Test Database Factory
 * Creates isolated SQLite databases for each test suite with enhanced TypeScript validation
 * ENFORCES file-based SQLite for enhanced test isolation and migration compatibility
 */

import { TestDatabase } from '../system-queries/fixtures/test-database-setup'
import type { Database } from 'bun:sqlite'
import type {
  DatabasePath,
  TestIsolationConfig,
  TestType,
  FileSystemError
} from '../../src/migration-tools/types/MigrationTypes'

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
    isolationLevel: 'basic' | 'enhanced' | 'complete' = 'enhanced'
  ): Promise<TestEnvironment> {
    // TypeScript validation
    if (typeof suiteName !== 'string' || suiteName.trim().length === 0) {
      throw new Error('Suite name must be a non-empty string')
    }

    // Check if already exists
    if (this.instances.has(suiteName)) {
      await this.cleanupTestEnvironment(suiteName)
    }

    // ENFORCE file-based databases - NO in-memory allowed
    const uniqueName = `${suiteName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const tempDir = '/tmp/bun-graph-db-tests'

    // Validate path security
    this.validateSecurePath(tempDir)

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
    await this.initializeAppSchema(testDb.getConnection())

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
        this.instances.delete(suiteName)
      }
    }

    this.instances.set(suiteName, environment)
    return environment
  }

  /**
   * Initialize database with application schema
   */
  private static async initializeAppSchema(db: Database): void {
    // Create main application tables
    db.exec(`
      -- Tables table for metadata
      CREATE TABLE IF NOT EXISTS tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        schema_version INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Insert todos table metadata
      INSERT OR IGNORE INTO tables (id, name) VALUES (58, 'todos');

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

      -- Template tables for GraphQL templates
      CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT NOT NULL UNIQUE,
        query_text TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

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

      -- Indexes for performance
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
    return this.instances.get(suiteName) || null
  }

  /**
   * Cleanup specific test environment
   */
  static async cleanupTestEnvironment(suiteName: string): Promise<void> {
    const env = this.instances.get(suiteName)
    if (env) {
      await env.cleanup()
    }
  }

  /**
   * Cleanup all test environments
   */
  static async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.instances.values()).map(env => env.cleanup())
    await Promise.all(cleanupPromises)
    this.instances.clear()
  }

  /**
   * DEPRECATED: Create in-memory database for unit tests
   * This method is deprecated in favor of file-based databases for better isolation
   */
  static async createInMemoryEnvironment(suiteName: string): Promise<TestEnvironment> {
    console.warn(`WARNING: createInMemoryEnvironment is deprecated for ${suiteName}. Use createTestEnvironment for file-based isolation.`)

    // Force file-based even for "in-memory" requests
    return this.createTestEnvironment(`legacy-${suiteName}`)
  }

  /**
   * Validates that all active databases are file-based with enhanced TypeScript validation
   */
  static validateFileBasedEnforcement(): FileBasedValidationResult {
    const violations: string[] = []
    const validatedPaths: string[] = []

    for (const [suiteName, env] of this.instances.entries()) {
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
      this.validateSecurePath(customTempDir)
    }

    const env = await this.createTestEnvironment(suiteName, testType, isolationLevel)

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
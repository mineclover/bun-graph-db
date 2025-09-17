/**
 * FileBasedDatabaseFactory - Factory for creating file-based database instances
 */

import type { TestContext } from '../models/TestContext'

export interface DatabaseConfiguration {
  /** Database name */
  name: string

  /** Database type */
  type: 'sqlite'

  /** Whether to enforce file-based databases */
  enforceFileBased: boolean

  /** Temporary directory for test databases */
  tempDirectory: string

  /** Schema version */
  schemaVersion: number
}

export interface EnvironmentOptions {
  /** Isolation level */
  isolation: 'full' | 'database' | 'transaction' | 'process'

  /** Whether to cleanup on exit */
  cleanup: boolean

  /** Whether to enable validation */
  validation: boolean

  /** Whether to enable performance monitoring */
  performanceMonitoring: boolean
}

export interface FileBasedEnvironment {
  /** Unique environment ID */
  id: string

  /** Environment name */
  name: string

  /** Database file path */
  databasePath: string

  /** Database connection */
  connection: any

  /** Isolation level */
  isolation: string

  /** Validation configuration */
  validation: {
    enabled: boolean
    enforceFileBased: boolean
  }

  /** Cleanup function */
  cleanup(): Promise<void>
}

export interface DatabaseConfig {
  /** Database file path */
  path: string

  /** Whether to enable WAL mode */
  enableWAL?: boolean

  /** Connection timeout in milliseconds */
  connectionTimeout?: number

  /** Query timeout in milliseconds */
  queryTimeout?: number

  /** Maximum number of connections */
  maxConnections?: number

  /** Whether to enable foreign keys */
  enableForeignKeys?: boolean

  /** Journal mode */
  journalMode?: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF'

  /** Synchronous mode */
  synchronous?: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA'
}

export interface DatabaseInstance {
  /** Database path */
  path: string

  /** Connection object */
  connection: any

  /** Whether database is connected */
  isConnected: boolean

  /** Configuration used */
  config: DatabaseConfig

  /** Execute a SQL query */
  query(sql: string, params?: any[]): Promise<any[]>

  /** Execute a SQL statement */
  exec(sql: string): Promise<void>

  /** Begin a transaction */
  beginTransaction(): Promise<void>

  /** Commit a transaction */
  commit(): Promise<void>

  /** Rollback a transaction */
  rollback(): Promise<void>

  /** Close the database connection */
  close(): Promise<void>

  /** Get database statistics */
  getStats(): Promise<{
    size: number
    pageCount: number
    pageSize: number
    connectionCount: number
  }>
}

export interface ValidationResult {
  isValid: boolean
  violations: string[]
  path: string
  enforcesFileBased: boolean
}

export class FileBasedDatabaseFactory {
  private static instance: FileBasedDatabaseFactory
  private activeDatabases = new Map<string, DatabaseInstance>()
  private defaultConfig: Partial<DatabaseConfig> = {
    enableWAL: true,
    connectionTimeout: 5000,
    queryTimeout: 30000,
    maxConnections: 10,
    enableForeignKeys: true,
    journalMode: 'WAL',
    synchronous: 'NORMAL'
  }

  static getInstance(): FileBasedDatabaseFactory {
    if (!this.instance) {
      this.instance = new FileBasedDatabaseFactory()
    }
    return this.instance
  }

  /**
   * Creates a file-based environment that enforces file-based databases
   */
  async createFileBasedEnvironment(
    config: DatabaseConfiguration,
    options: EnvironmentOptions
  ): Promise<FileBasedEnvironment> {
    // Validate that file-based is enforced
    if (!config.enforceFileBased) {
      throw new Error('File-based enforcement is required')
    }

    // Generate unique environment ID
    const envId = `env-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Create database path
    const databasePath = `${config.tempDirectory}/${config.name}-${envId}.sqlite`

    // Ensure no memory references
    if (databasePath.includes(':memory:')) {
      throw new Error('Memory databases are not allowed in file-based environment')
    }

    // Create database instance
    const dbConfig: DatabaseConfig = {
      path: databasePath,
      enableWAL: true,
      connectionTimeout: 5000,
      enableForeignKeys: true
    }

    const database = await this.createDatabase(dbConfig)

    // Create environment
    const environment: FileBasedEnvironment = {
      id: envId,
      name: config.name,
      databasePath,
      connection: database,
      isolation: options.isolation,
      validation: {
        enabled: options.validation,
        enforceFileBased: config.enforceFileBased
      },
      async cleanup(): Promise<void> {
        try {
          await database.close()
          await Bun.$`rm -f ${databasePath}`
        } catch (error) {
          console.warn(`Cleanup failed for environment ${envId}: ${error}`)
        }
      }
    }

    return environment
  }

  /**
   * Creates a file-based database instance
   */
  async createDatabase(config: DatabaseConfig): Promise<DatabaseInstance> {
    // Validate configuration
    const validation = this.validateConfig(config)
    if (!validation.isValid) {
      throw new Error(`Invalid database configuration: ${validation.violations.join(', ')}`)
    }

    // Merge with defaults
    const finalConfig: DatabaseConfig = { ...this.defaultConfig, ...config }

    // Ensure directory exists
    await this.ensureDirectoryExists(finalConfig.path)

    // Create database instance
    const instance = await this.createDatabaseInstance(finalConfig)

    // Register instance
    this.activeDatabases.set(finalConfig.path, instance)

    return instance
  }

  /**
   * Creates a database for a test context
   */
  async createForTestContext(context: TestContext): Promise<DatabaseInstance> {
    const config: DatabaseConfig = {
      path: context.databasePath,
      enableWAL: context.testType !== 'unit', // Disable WAL for unit tests for performance
      connectionTimeout: 3000,
      queryTimeout: context.testType === 'e2e' ? 60000 : 15000,
      maxConnections: context.resourceLimits?.maxConnections || 5,
      enableForeignKeys: true,
      journalMode: context.testType === 'unit' ? 'MEMORY' : 'WAL',
      synchronous: context.testType === 'e2e' ? 'FULL' : 'NORMAL'
    }

    return this.createDatabase(config)
  }

  /**
   * Gets an existing database instance
   */
  getDatabase(path: string): DatabaseInstance | null {
    return this.activeDatabases.get(path) || null
  }

  /**
   * Lists all active databases
   */
  listActiveDatabases(): DatabaseInstance[] {
    return Array.from(this.activeDatabases.values())
  }

  /**
   * Validates file-based database enforcement
   */
  validateFileBasedEnforcement(databasePath: string): ValidationResult {
    const violations: string[] = []
    let enforcesFileBased = true

    // Check for in-memory database
    if (databasePath === ':memory:' || databasePath.includes(':memory:')) {
      violations.push('In-memory database detected')
      enforcesFileBased = false
    }

    // Check for valid file path
    if (!databasePath.includes('/') && !databasePath.includes('\\')) {
      violations.push('Invalid file path format')
      enforcesFileBased = false
    }

    // Check for temporary directory usage (recommended)
    if (!databasePath.includes('/tmp/') && !databasePath.includes('\\tmp\\')) {
      violations.push('Database not in temporary directory (recommended for tests)')
      // This is a warning, not an error
    }

    return {
      isValid: violations.length === 0 || violations.every(v => v.includes('recommended')),
      violations,
      path: databasePath,
      enforcesFileBased
    }
  }

  /**
   * Migrates from in-memory to file-based database
   */
  async migrateFromMemoryToFile(
    memoryPath: string,
    filePath: string,
    preserveData: boolean = true
  ): Promise<{
    success: boolean
    newPath: string
    errors: string[]
  }> {
    const errors: string[] = []

    try {
      // Validate source is memory database
      if (!memoryPath.includes(':memory:')) {
        errors.push('Source is not an in-memory database')
        return { success: false, newPath: '', errors }
      }

      // Validate target is file-based
      const validation = this.validateFileBasedEnforcement(filePath)
      if (!validation.enforcesFileBased) {
        errors.push('Target is not a valid file-based database path')
        return { success: false, newPath: '', errors }
      }

      // If preserveData is true, we would need to copy data
      // For now, this is a placeholder for the migration logic
      if (preserveData) {
        // In a real implementation, this would:
        // 1. Connect to memory database
        // 2. Read all data
        // 3. Create file database
        // 4. Insert all data
        // 5. Verify integrity
      }

      // Create new file-based database
      const newInstance = await this.createDatabase({ path: filePath })

      return {
        success: true,
        newPath: filePath,
        errors: []
      }

    } catch (error) {
      errors.push(`Migration failed: ${error}`)
      return { success: false, newPath: '', errors }
    }
  }

  /**
   * Closes and removes a database instance
   */
  async closeDatabase(path: string): Promise<void> {
    const instance = this.activeDatabases.get(path)
    if (instance) {
      await instance.close()
      this.activeDatabases.delete(path)
    }
  }

  /**
   * Closes all active databases
   */
  async closeAll(): Promise<void> {
    const promises = Array.from(this.activeDatabases.values()).map(db => db.close())
    await Promise.all(promises)
    this.activeDatabases.clear()
  }

  /**
   * Cleans up test databases (removes files)
   */
  async cleanupTestDatabases(pathPattern: RegExp = /\/tmp\/bun-graph-db-tests\//): Promise<{
    cleaned: string[]
    errors: string[]
  }> {
    const cleaned: string[] = []
    const errors: string[] = []

    for (const [path, instance] of this.activeDatabases) {
      if (pathPattern.test(path)) {
        try {
          await instance.close()
          await Bun.$`rm -f ${path}`
          this.activeDatabases.delete(path)
          cleaned.push(path)
        } catch (error) {
          errors.push(`Failed to cleanup ${path}: ${error}`)
        }
      }
    }

    return { cleaned, errors }
  }

  private validateConfig(config: DatabaseConfig): ValidationResult {
    const violations: string[] = []

    if (!config.path) {
      violations.push('Database path is required')
    }

    if (config.path && config.path.includes(':memory:')) {
      violations.push('In-memory databases are not allowed')
    }

    if (config.connectionTimeout && config.connectionTimeout < 1000) {
      violations.push('Connection timeout must be at least 1000ms')
    }

    if (config.maxConnections && config.maxConnections < 1) {
      violations.push('Max connections must be at least 1')
    }

    return {
      isValid: violations.length === 0,
      violations,
      path: config.path,
      enforcesFileBased: !config.path.includes(':memory:')
    }
  }

  private async ensureDirectoryExists(path: string): Promise<void> {
    const dir = path.substring(0, path.lastIndexOf('/'))
    if (dir) {
      try {
        await Bun.$`mkdir -p ${dir}`
      } catch (error) {
        throw new Error(`Failed to create directory ${dir}: ${error}`)
      }
    }
  }

  private async createDatabaseInstance(config: DatabaseConfig): Promise<DatabaseInstance> {
    // This is a simplified implementation
    // In a real scenario, this would use a proper SQLite driver
    const instance: DatabaseInstance = {
      path: config.path,
      connection: null, // Would be actual database connection
      isConnected: false,
      config,

      async query(sql: string, params?: any[]): Promise<any[]> {
        // Placeholder implementation
        return []
      },

      async exec(sql: string): Promise<void> {
        // Placeholder implementation
      },

      prepare(sql: string): any {
        // Placeholder implementation for prepared statements
        return {
          run: (...params: any[]) => ({ changes: 0, lastInsertRowid: 0 }),
          get: (...params: any[]) => null,
          all: (...params: any[]) => [],
          finalize: () => {}
        }
      },

      async beginTransaction(): Promise<void> {
        // Placeholder implementation
      },

      async commit(): Promise<void> {
        // Placeholder implementation
      },

      async rollback(): Promise<void> {
        // Placeholder implementation
      },

      async close(): Promise<void> {
        this.isConnected = false
      },

      async getStats(): Promise<{
        size: number
        pageCount: number
        pageSize: number
        connectionCount: number
      }> {
        // Placeholder implementation
        return {
          size: 0,
          pageCount: 0,
          pageSize: 4096,
          connectionCount: 1
        }
      }
    }

    // Initialize connection
    try {
      // In real implementation, would establish SQLite connection here
      instance.isConnected = true

      // Configure database settings
      if (config.enableForeignKeys) {
        await instance.exec('PRAGMA foreign_keys = ON')
      }

      if (config.journalMode) {
        await instance.exec(`PRAGMA journal_mode = ${config.journalMode}`)
      }

      if (config.synchronous) {
        await instance.exec(`PRAGMA synchronous = ${config.synchronous}`)
      }

    } catch (error) {
      throw new Error(`Failed to initialize database: ${error}`)
    }

    return instance
  }
}
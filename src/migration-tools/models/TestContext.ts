/**
 * TestContext model - Represents an isolated test execution context
 */

export type IsolationLevel = 'process' | 'database' | 'transaction' | 'full'
export type TestContextType = 'unit' | 'integration' | 'e2e' | 'infrastructure'

export interface ResourceLimits {
  /** Maximum number of database connections */
  maxConnections?: number

  /** Maximum number of files that can be allocated */
  maxFiles?: number

  /** Maximum memory usage in bytes */
  maxMemory?: number

  /** Maximum execution time in milliseconds */
  maxExecutionTime?: number

  /** Maximum I/O operations */
  maxIOOperations?: number
}

export interface ResourceUsage {
  /** Current number of active connections */
  connectionCount: number

  /** Current number of allocated files */
  fileCount: number

  /** Current memory usage in bytes */
  memoryUsage: number

  /** Current execution time in milliseconds */
  executionTime: number

  /** Number of I/O operations performed */
  ioOperations: number
}

export interface ContextResources {
  /** List of allocated files */
  files: string[]

  /** List of active database connections */
  connections: string[]

  /** List of spawned processes */
  processes: string[]

  /** Allocated memory blocks */
  memoryBlocks: string[]

  /** Temporary directories */
  tempDirectories: string[]
}

export interface CleanupResult {
  /** Whether cleanup was successful */
  success: boolean

  /** Resources that were successfully freed */
  resourcesFreed: {
    files: number
    connections: number
    processes: number
    memoryBlocks: number
    tempDirectories: number
  }

  /** Any errors encountered during cleanup */
  errors: string[]

  /** Time taken for cleanup in milliseconds */
  cleanupTime: number
}

export interface ValidationResult {
  /** Whether the context state is valid */
  isValid: boolean

  /** File integrity check result */
  fileIntegrity: boolean

  /** Database connection health */
  connectionHealth: boolean

  /** Data consistency check */
  dataConsistency: boolean

  /** Database type (should be 'file-based') */
  databaseType: 'file-based' | 'memory' | 'unknown'

  /** Any validation errors */
  errors: string[]

  /** Validation warnings */
  warnings: string[]
}

export interface TestContext {
  /** Unique identifier for this context */
  id: string

  /** Suite name for this context */
  suiteName: string

  /** Database instance */
  database: any // TestDatabase type from fixtures

  /** Path to the database file */
  databasePath: string

  /** Level of isolation for this context */
  isolationLevel: IsolationLevel

  /** Test type this context supports */
  testType: TestContextType

  /** Resources allocated to this context */
  resources: ContextResources

  /** Current resource usage */
  resourceUsage: ResourceUsage

  /** Resource limits for this context */
  resourceLimits?: ResourceLimits

  /** Whether file-based database is enforced */
  enforceFileBased: boolean

  /** Context warnings */
  warnings: string[]

  /** Context creation timestamp */
  createdAt: Date

  /** Whether context has been cleaned up */
  isCleanedUp: boolean

  /** Additional context-specific properties */
  metadata?: {
    /** Process isolation enabled */
    processIsolation?: boolean

    /** Database isolation enabled */
    databaseIsolation?: boolean

    /** Transaction isolation enabled */
    transactionIsolation?: boolean

    /** E2E specific configuration */
    e2eSupport?: boolean

    /** Performance monitoring enabled */
    performanceMonitoring?: boolean

    /** Validation enabled */
    validation?: boolean
  }

  /** Allocate a file resource */
  allocateFile(filename: string): Promise<void>

  /** Allocate a database connection */
  allocateConnection(connectionId: string): Promise<void>

  /** Allocate a process resource */
  allocateProcess(processId: string): Promise<void>

  /** Validate current context state */
  validateState(): Promise<ValidationResult>

  /** Cleanup all resources and close context */
  cleanup(): Promise<CleanupResult>
}

export class TestContextValidator {
  /**
   * Validates a test context configuration
   */
  static validateConfiguration(config: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!config) {
      errors.push('Context configuration cannot be null or undefined')
      return { isValid: false, errors }
    }

    // Required fields
    if (!config.suiteName || typeof config.suiteName !== 'string') {
      errors.push('suiteName is required and must be a string')
    } else if (config.suiteName.trim().length === 0) {
      errors.push('suiteName cannot be empty')
    }

    if (!config.testType || !['unit', 'integration', 'e2e', 'infrastructure'].includes(config.testType)) {
      errors.push('testType must be one of: unit, integration, e2e, infrastructure')
    }

    if (!config.isolationLevel || !['process', 'database', 'transaction', 'full'].includes(config.isolationLevel)) {
      errors.push('isolationLevel must be one of: process, database, transaction, full')
    }

    if (typeof config.enforceFileBased !== 'boolean') {
      errors.push('enforceFileBased must be a boolean')
    }

    if (typeof config.cleanupOnExit !== 'boolean') {
      errors.push('cleanupOnExit must be a boolean')
    }

    // Resource limits validation
    if (config.resourceLimits) {
      const limits = config.resourceLimits

      if (limits.maxConnections !== undefined && (typeof limits.maxConnections !== 'number' || limits.maxConnections < 0)) {
        errors.push('resourceLimits.maxConnections must be a non-negative number')
      }

      if (limits.maxFiles !== undefined && (typeof limits.maxFiles !== 'number' || limits.maxFiles < 0)) {
        errors.push('resourceLimits.maxFiles must be a non-negative number')
      }

      if (limits.maxMemory !== undefined && (typeof limits.maxMemory !== 'number' || limits.maxMemory < 0)) {
        errors.push('resourceLimits.maxMemory must be a non-negative number')
      }

      if (limits.maxExecutionTime !== undefined && (typeof limits.maxExecutionTime !== 'number' || limits.maxExecutionTime < 0)) {
        errors.push('resourceLimits.maxExecutionTime must be a non-negative number')
      }

      if (limits.maxIOOperations !== undefined && (typeof limits.maxIOOperations !== 'number' || limits.maxIOOperations < 0)) {
        errors.push('resourceLimits.maxIOOperations must be a non-negative number')
      }
    }

    // Conflicting configuration checks
    if (config.enforceFileBased && config.preferMemory) {
      // This is a warning, not an error - should be handled by override
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Validates a test context state
   */
  static validateContextState(context: TestContext): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Basic state validation
    if (!context.id || context.id.trim().length === 0) {
      errors.push('Context ID is missing or empty')
    }

    if (!context.suiteName || context.suiteName.trim().length === 0) {
      errors.push('Suite name is missing or empty')
    }

    // Database validation
    let databaseType: 'file-based' | 'memory' | 'unknown' = 'unknown'
    let connectionHealth = false
    let fileIntegrity = false

    try {
      if (context.databasePath) {
        if (context.databasePath === ':memory:' || context.databasePath.includes(':memory:')) {
          databaseType = 'memory'
          if (context.enforceFileBased) {
            errors.push('In-memory database detected but file-based is enforced')
          }
        } else if (context.databasePath.includes('/tmp/bun-graph-db-tests/')) {
          databaseType = 'file-based'
          fileIntegrity = true
        }
      }

      // Test database connection
      if (context.database && typeof context.database.getConnection === 'function') {
        const conn = context.database.getConnection()
        if (conn && typeof conn.exec === 'function') {
          connectionHealth = true
        }
      }
    } catch (error) {
      errors.push(`Database validation failed: ${error}`)
    }

    // Resource validation
    if (context.resourceLimits) {
      if (context.resourceLimits.maxConnections && context.resourceUsage.connectionCount > context.resourceLimits.maxConnections) {
        errors.push(`Connection count (${context.resourceUsage.connectionCount}) exceeds limit (${context.resourceLimits.maxConnections})`)
      }

      if (context.resourceLimits.maxFiles && context.resourceUsage.fileCount > context.resourceLimits.maxFiles) {
        errors.push(`File count (${context.resourceUsage.fileCount}) exceeds limit (${context.resourceLimits.maxFiles})`)
      }

      if (context.resourceLimits.maxMemory && context.resourceUsage.memoryUsage > context.resourceLimits.maxMemory) {
        errors.push(`Memory usage (${context.resourceUsage.memoryUsage}) exceeds limit (${context.resourceLimits.maxMemory})`)
      }
    }

    // Cleanup state validation
    if (context.isCleanedUp) {
      if (context.resources.files.length > 0 || context.resources.connections.length > 0) {
        warnings.push('Context marked as cleaned up but still has allocated resources')
      }
    }

    // Data consistency check
    const dataConsistency = context.resources.files.length === context.resourceUsage.fileCount &&
                          context.resources.connections.length === context.resourceUsage.connectionCount

    if (!dataConsistency) {
      warnings.push('Resource tracking inconsistency detected')
    }

    return {
      isValid: errors.length === 0,
      fileIntegrity,
      connectionHealth,
      dataConsistency,
      databaseType,
      errors,
      warnings
    }
  }

  /**
   * Creates default resource limits based on test type
   */
  static getDefaultResourceLimits(testType: TestContextType): ResourceLimits {
    switch (testType) {
      case 'unit':
        return {
          maxConnections: 5,
          maxFiles: 10,
          maxMemory: 50 * 1024 * 1024, // 50MB
          maxExecutionTime: 30000, // 30 seconds
          maxIOOperations: 1000
        }

      case 'integration':
        return {
          maxConnections: 15,
          maxFiles: 50,
          maxMemory: 200 * 1024 * 1024, // 200MB
          maxExecutionTime: 120000, // 2 minutes
          maxIOOperations: 5000
        }

      case 'e2e':
        return {
          maxConnections: 25,
          maxFiles: 100,
          maxMemory: 500 * 1024 * 1024, // 500MB
          maxExecutionTime: 300000, // 5 minutes
          maxIOOperations: 10000
        }

      case 'infrastructure':
        return {
          maxConnections: 10,
          maxFiles: 20,
          maxMemory: 100 * 1024 * 1024, // 100MB
          maxExecutionTime: 60000, // 1 minute
          maxIOOperations: 2000
        }

      default:
        return {
          maxConnections: 10,
          maxFiles: 20,
          maxMemory: 100 * 1024 * 1024,
          maxExecutionTime: 60000,
          maxIOOperations: 2000
        }
    }
  }

  /**
   * Suggests isolation level based on test type and requirements
   */
  static suggestIsolationLevel(testType: TestContextType, requirements?: { performanceCritical?: boolean; resourceIntensive?: boolean }): IsolationLevel {
    if (requirements?.performanceCritical) {
      return 'database' // Lighter isolation for performance
    }

    if (requirements?.resourceIntensive) {
      return 'full' // Maximum isolation for resource-intensive tests
    }

    switch (testType) {
      case 'unit':
        return 'database' // Database isolation sufficient for unit tests

      case 'integration':
        return 'full' // Full isolation for integration tests

      case 'e2e':
        return 'full' // Maximum isolation for E2E tests

      case 'infrastructure':
        return 'process' // Process isolation for infrastructure tests

      default:
        return 'database'
    }
  }
}
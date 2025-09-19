/**
 * Test Database Lifecycle Management Contract
 *
 * Defines the interface and behavior contract for test database management
 * including creation, setup, reset, and cleanup operations.
 */

export interface TestDatabaseContract {
  /**
   * Create a new test database with unique identifier
   * @returns Promise resolving to database path and cleanup function
   */
  createTestDatabase(): Promise<{
    path: string
    cleanup: () => Promise<void>
  }>

  /**
   * Initialize database with system monitoring schema
   * @param dbPath - Path to the SQLite database file
   * @returns Promise resolving to Database instance
   */
  initializeSchema(dbPath: string): Promise<Database>

  /**
   * Reset database to clean state (preserve schema, clear data)
   * @param db - Database instance to reset
   * @returns Promise resolving when reset is complete
   */
  resetDatabase(db: Database): Promise<void>

  /**
   * Validate database integrity and schema
   * @param db - Database instance to validate
   * @returns Promise resolving to validation result
   */
  validateDatabase(db: Database): Promise<{
    isValid: boolean
    errors: string[]
  }>
}

export interface TestDatabaseOptions {
  /** Prefix for database filename */
  prefix?: string
  /** Enable SQLite optimizations for testing */
  optimizeForTesting?: boolean
  /** Preserve database on test failure for debugging */
  preserveOnFailure?: boolean
}

export interface DatabaseMetrics {
  /** Database file size in bytes */
  fileSize: number
  /** Number of database connections */
  connectionCount: number
  /** Database creation timestamp */
  createdAt: Date
  /** Last operation timestamp */
  lastActivity: Date
}

/**
 * Contract for test database manager singleton
 */
export interface TestDatabaseManagerContract {
  /**
   * Create managed test database instance
   * @param options - Database configuration options
   * @returns Promise resolving to managed database instance
   */
  createManaged(options?: TestDatabaseOptions): Promise<{
    path: string
    db: Database
    metrics: DatabaseMetrics
    cleanup: () => Promise<void>
  }>

  /**
   * Clean up all managed database instances
   * @returns Promise resolving when all instances are cleaned up
   */
  cleanupAll(): Promise<void>

  /**
   * Get metrics for all active database instances
   * @returns Array of database metrics
   */
  getAllMetrics(): DatabaseMetrics[]
}

/**
 * Expected behavior contract for test database operations
 */
export const TestDatabaseBehaviorContract = {
  /**
   * Database creation requirements
   */
  creation: {
    /** Must generate unique file paths for concurrent tests */
    uniquePaths: true,
    /** Must create files in system temporary directory */
    useTemporaryDirectory: true,
    /** Must apply SQLite optimizations for testing */
    applyOptimizations: true,
  },

  /**
   * Schema initialization requirements
   */
  schemaInitialization: {
    /** Must create all required system monitoring tables */
    createSystemTables: true,
    /** Must apply appropriate indexes for performance */
    createIndexes: true,
    /** Must complete within performance threshold */
    maxInitializationTime: 100, // milliseconds
  },

  /**
   * Database reset requirements
   */
  reset: {
    /** Must clear all data from all tables */
    clearAllData: true,
    /** Must preserve all schema elements */
    preserveSchema: true,
    /** Must complete within performance threshold */
    maxResetTime: 50, // milliseconds
  },

  /**
   * Cleanup requirements
   */
  cleanup: {
    /** Must close database connections before file removal */
    closeConnections: true,
    /** Must remove database files from filesystem */
    removeFiles: true,
    /** Must handle cleanup errors gracefully */
    gracefulErrorHandling: true,
    /** Must not fail tests due to cleanup issues */
    nonBlockingFailure: true,
  },

  /**
   * Performance requirements
   */
  performance: {
    /** Maximum time for database creation and setup */
    maxSetupTime: 100, // milliseconds
    /** Maximum time for database cleanup */
    maxCleanupTime: 50, // milliseconds
    /** Maximum file size for empty test database */
    maxEmptyDatabaseSize: 1024 * 1024, // 1MB
  },

  /**
   * Isolation requirements
   */
  isolation: {
    /** Each test must use separate database files */
    separateFiles: true,
    /** Concurrent tests must not interfere */
    noInterference: true,
    /** Database paths must be unpredictable */
    unpredictablePaths: true,
  },
} as const

/**
 * Validation contract for test database state
 */
export interface DatabaseValidationContract {
  /**
   * Validate database schema matches expected structure
   */
  validateSchema(db: Database): {
    isValid: boolean
    missingTables: string[]
    missingIndexes: string[]
    schemaErrors: string[]
  }

  /**
   * Validate database is in clean state (no data)
   */
  validateCleanState(db: Database): {
    isEmpty: boolean
    tableRowCounts: Record<string, number>
    nonEmptyTables: string[]
  }

  /**
   * Validate database performance characteristics
   */
  validatePerformance(db: Database): {
    meetsRequirements: boolean
    queryResponseTime: number
    connectionTime: number
    performanceIssues: string[]
  }
}

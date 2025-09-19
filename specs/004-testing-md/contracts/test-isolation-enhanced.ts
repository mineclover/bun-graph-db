/**
 * Enhanced Test Isolation Contracts
 * Extensions to existing TestIsolationHelpers for file-based SQLite migration
 */

// Enhanced Test Context (extends existing IsolatedTestContext)
export interface EnhancedTestContext {
  type: 'unit' | 'integration' | 'e2e'
  suiteName: string
  database?: EnhancedTestEnvironment
  server?: TestGraphQLServer
  graphqlRequest?: (query: string, variables?: Record<string, any>) => Promise<any>
  cleanup: () => Promise<void>

  // New migration-specific properties
  migrationMetadata: {
    originalFilePath?: string
    migrationDate?: string
    performanceBaseline?: PerformanceMetrics
  }

  // Enhanced validation capabilities
  validation: {
    functionalEquivalence: boolean
    isolationVerified: boolean
    resourcesCleanedUp: boolean
  }
}

// Enhanced Database Environment (file-based only)
export interface EnhancedTestEnvironment {
  database: {
    getConnection: () => any // SQLite Database instance
    getFilePath: () => string // Absolute path to SQLite file
    close: () => void
  }
  cleanup: () => Promise<void>

  // Migration-specific enhancements
  migration: {
    isFileBased: () => boolean // Must always return true
    validateIsolation: () => Promise<boolean>
    measureCleanupTime: () => Promise<number>
  }
}

// Enhanced Test Isolation Helpers Contract
export interface EnhancedTestIsolationHelpers {
  /**
   * Setup unit test with file-based SQLite (NO in-memory)
   */
  setupUnitTestFileBased(suiteName: string): Promise<EnhancedTestContext>

  /**
   * Setup integration test with file-based SQLite and isolated server
   */
  setupIntegrationTestFileBased(suiteName: string): Promise<EnhancedTestContext>

  /**
   * Setup E2E test with full isolation and seed data
   */
  setupE2ETestFileBased(suiteName: string, options?: E2ETestOptions): Promise<EnhancedTestContext>

  /**
   * Validate migration maintains functional equivalence
   */
  validateMigrationEquivalence(
    legacyTestFn: () => Promise<any>,
    migratedTestFn: () => Promise<any>
  ): Promise<boolean>

  /**
   * Verify test isolation (parallel execution safe)
   */
  verifyTestIsolation(contexts: EnhancedTestContext[]): Promise<boolean>

  /**
   * Measure test performance for migration comparison
   */
  measureTestPerformance(testName: string, testFn: () => Promise<void>): Promise<PerformanceMetrics>

  /**
   * Cleanup all test resources and verify no file accumulation
   */
  cleanupAllResources(): Promise<CleanupReport>
}

// File-Based Database Factory Contract
export interface FileBasedDatabaseFactory {
  /**
   * Create file-based SQLite environment (NEVER in-memory)
   */
  createFileBasedEnvironment(suiteName: string): Promise<EnhancedTestEnvironment>

  /**
   * Generate unique file path for test database
   */
  generateUniqueFilePath(suiteName: string): string

  /**
   * Verify database file exists and is accessible
   */
  verifyDatabaseFile(filePath: string): Promise<boolean>

  /**
   * Clean up database file and verify removal
   */
  cleanupDatabaseFile(filePath: string): Promise<boolean>

  /**
   * List all active test database files
   */
  listActiveTestDatabases(): Promise<string[]>
}

// Migration Validation Contract
export interface MigrationValidator {
  /**
   * Compare test results before and after migration
   */
  compareTestResults(
    legacyResults: TestExecutionResult,
    migratedResults: TestExecutionResult
  ): ValidationResult

  /**
   * Verify parallel execution compatibility
   */
  verifyParallelExecution(testContexts: EnhancedTestContext[]): Promise<boolean>

  /**
   * Check resource cleanup effectiveness
   */
  validateResourceCleanup(beforeCleanup: ResourceSnapshot, afterCleanup: ResourceSnapshot): boolean

  /**
   * Detect performance anomalies
   */
  detectPerformanceAnomalies(
    baseline: PerformanceMetrics,
    current: PerformanceMetrics
  ): AnomalyReport
}

// Supporting Types
export interface E2ETestOptions {
  seedData?: boolean
  mockExternalServices?: boolean
  enableLogging?: boolean
  performanceTracking?: boolean
}

export interface TestExecutionResult {
  success: boolean
  duration: number
  testCount: number
  passedCount: number
  failedCount: number
  errors: string[]
  output: any
}

export interface PerformanceMetrics {
  executionTime: number
  setupTime: number
  teardownTime: number
  memoryUsage: number
  databaseOperations: number
  successRate: number
}

export interface CleanupReport {
  filesRemoved: string[]
  portsReleased: number[]
  cleanupDuration: number
  success: boolean
  errors: string[]
}

export interface ResourceSnapshot {
  activeDatabaseFiles: string[]
  activeServerPorts: number[]
  memoryUsage: number
  temporaryFiles: string[]
}

export interface AnomalyReport {
  anomalyDetected: boolean
  anomalyType: 'performance' | 'resource' | 'functional'
  severity: 'low' | 'medium' | 'high'
  details: string
  recommendation: string
}

// Configuration for Enhanced Test Isolation
export interface EnhancedTestConfig {
  databaseConfig: {
    basePath: string
    filePrefix: string
    maxFileSize: number
    cleanupTimeout: number
  }

  serverConfig: {
    portRange: { min: number; max: number }
    startupTimeout: number
    shutdownTimeout: number
  }

  performanceConfig: {
    maxExecutionTime: number
    maxVariancePercent: number
    minSuccessRate: number
    enableProfiling: boolean
  }

  isolationConfig: {
    enableParallelValidation: boolean
    maxConcurrentTests: number
    resourceCheckInterval: number
  }
}

// Error Types for Enhanced Testing
export class TestIsolationError extends Error {
  constructor(
    message: string,
    public readonly context: EnhancedTestContext,
    public readonly isolationType: 'database' | 'server' | 'resource'
  ) {
    super(message)
    this.name = 'TestIsolationError'
  }
}

export class FileBasedDatabaseError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly operation: 'create' | 'access' | 'cleanup'
  ) {
    super(message)
    this.name = 'FileBasedDatabaseError'
  }
}

export class MigrationValidationError extends Error {
  constructor(
    message: string,
    public readonly validationType: 'functional' | 'performance' | 'isolation',
    public readonly details: Record<string, any>
  ) {
    super(message)
    this.name = 'MigrationValidationError'
  }
}

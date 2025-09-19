/**
 * Test Migration API Contracts
 * TypeScript interfaces for test migration operations
 */

// Core Migration Operations
export interface MigrationTarget {
  filePath: string
  category: 'unit' | 'integration' | 'e2e'
  complexity: 'low' | 'medium' | 'high'
  dependencies: string[]
  migrationStatus: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back'
  priority: number
}

export interface TestContext {
  suiteName: string
  type: 'unit' | 'integration' | 'e2e'
  databasePath: string // File-based SQLite, NOT :memory:
  serverPort: number | null
  seedDataEnabled: boolean
  mockingEnabled: boolean
  cleanupRequired: boolean
}

export interface MigrationReport {
  targetFilePath: string
  originalFilePath: string
  migrationDate: string
  migrationDuration: number
  issuesEncountered: string[]
  strategyImprovements: string[]
  functionalValidation: ValidationResult
  performanceComparison: PerformanceComparison
}

export interface PerformanceComparison {
  testSuite: string
  legacyExecutionTime: number
  migratedExecutionTime: number
  executionTimeVariance: number
  successRate: number
  resourceCleanupTime: number
  anomalyDetected: boolean
}

export interface ValidationResult {
  testFilePath: string
  functionalEquivalence: boolean
  isolationVerified: boolean
  resourceCleanupVerified: boolean
  rollbackRequired: boolean
  validationErrors: string[]
  validationDate: string
}

// Migration Service Contract
export interface MigrationService {
  /**
   * Analyze legacy test file and determine migration approach
   */
  analyzeMigrationTarget(filePath: string): Promise<MigrationTarget>

  /**
   * Execute migration from legacy to Test Isolation Strategy
   */
  executeMigration(target: MigrationTarget): Promise<MigrationReport>

  /**
   * Validate migrated test maintains functional equivalence
   */
  validateMigration(report: MigrationReport): Promise<ValidationResult>

  /**
   * Rollback migration if validation fails
   */
  rollbackMigration(target: MigrationTarget): Promise<boolean>

  /**
   * Generate migration progress report
   */
  generateProgressReport(): Promise<MigrationProgressReport>
}

// Test Context Management Contract
export interface TestContextManager {
  /**
   * Create isolated test environment with file-based SQLite
   */
  createTestContext(suiteName: string, type: TestContext['type']): Promise<TestContext>

  /**
   * Cleanup test environment and remove resources
   */
  cleanupTestContext(context: TestContext): Promise<void>

  /**
   * Verify test context isolation (no conflicts)
   */
  verifyIsolation(contexts: TestContext[]): Promise<boolean>
}

// Performance Monitoring Contract
export interface PerformanceMonitor {
  /**
   * Measure test execution performance
   */
  measureExecution(testSuite: string, executeFn: () => Promise<void>): Promise<PerformanceMetrics>

  /**
   * Compare legacy vs migrated performance
   */
  comparePerformance(
    legacy: PerformanceMetrics,
    migrated: PerformanceMetrics
  ): PerformanceComparison

  /**
   * Detect performance anomalies
   */
  detectAnomalies(comparison: PerformanceComparison): boolean
}

// Supporting Types
export interface PerformanceMetrics {
  executionTime: number
  successRate: number
  resourceCleanupTime: number
  memoryUsage?: number
  errorCount: number
}

export interface MigrationProgressReport {
  totalTests: number
  migratedTests: number
  failedMigrations: number
  pendingMigrations: number
  strategyImprovements: string[]
  overallSuccessRate: number
}

// Configuration Contracts
export interface MigrationConfig {
  sourceDirectory: string
  targetDirectory: string
  databaseBasePath: string
  serverPortRange: { min: number; max: number }
  performanceThresholds: {
    maxVariancePercent: number
    minSuccessRate: number
  }
  rollbackOnFailure: boolean
}

// CLI Command Contracts
export interface MigrationCommand {
  command: 'analyze' | 'migrate' | 'validate' | 'rollback' | 'report'
  filePath?: string
  category?: 'unit' | 'integration' | 'e2e'
  force?: boolean
  dryRun?: boolean
}

export interface MigrationCommandResult {
  success: boolean
  message: string
  data?: any
  errors?: string[]
}

// Error Types
export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly target?: MigrationTarget
  ) {
    super(message)
    this.name = 'MigrationError'
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly validationErrors: string[],
    public readonly filePath: string
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class ContextError extends Error {
  constructor(
    message: string,
    public readonly context: TestContext,
    public readonly operation: string
  ) {
    super(message)
    this.name = 'ContextError'
  }
}

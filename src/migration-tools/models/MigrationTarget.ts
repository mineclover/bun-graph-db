/**
 * MigrationTarget model - Represents a test file target for migration
 */

export type TestType = 'unit' | 'integration' | 'e2e'
export type MigrationPriority = 'low' | 'medium' | 'high' | 'critical'
export type EstimatedEffort = 'low' | 'medium' | 'high' | 'very-high' | 'maximum'

export interface MigrationTarget {
  /** Path to the test file to be migrated */
  testFilePath: string

  /** Type of test (unit, integration, e2e) */
  testType: TestType

  /** Priority level for migration */
  migrationPriority: MigrationPriority

  /** Complexity score (0.0 to 1.0) */
  complexity: number

  /** List of dependencies required by this test */
  dependencies: string[]

  /** Estimated effort level */
  estimatedEffort: EstimatedEffort

  /** Optional: Original file path if this is a migration */
  originalFilePath?: string

  /** Optional: Additional metadata */
  metadata?: {
    /** Size of the test file in bytes */
    fileSize?: number

    /** Last modified timestamp */
    lastModified?: Date

    /** Number of test cases */
    testCaseCount?: number

    /** Performance requirements */
    performanceRequirements?: {
      maxExecutionTime?: number
      maxMemoryUsage?: number
      maxIOOperations?: number
    }

    /** Migration-specific options */
    migrationOptions?: {
      preserveOriginal?: boolean
      enableBackup?: boolean
      validateAfterMigration?: boolean
    }
  }
}

export class MigrationTargetValidator {
  /**
   * Validates a migration target object
   */
  static validate(target: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!target) {
      errors.push('Migration target cannot be null or undefined')
      return { isValid: false, errors }
    }

    // Required fields validation
    if (!target.testFilePath || typeof target.testFilePath !== 'string') {
      errors.push('testFilePath is required and must be a string')
    }

    if (!target.testType || !['unit', 'integration', 'e2e'].includes(target.testType)) {
      errors.push('testType must be one of: unit, integration, e2e')
    }

    if (!target.migrationPriority || !['low', 'medium', 'high', 'critical'].includes(target.migrationPriority)) {
      errors.push('migrationPriority must be one of: low, medium, high, critical')
    }

    if (typeof target.complexity !== 'number' || target.complexity < 0 || target.complexity > 1) {
      errors.push('complexity must be a number between 0.0 and 1.0')
    }

    if (!Array.isArray(target.dependencies)) {
      errors.push('dependencies must be an array')
    }

    if (!target.estimatedEffort || !['low', 'medium', 'high', 'very-high', 'maximum'].includes(target.estimatedEffort)) {
      errors.push('estimatedEffort must be one of: low, medium, high, very-high, maximum')
    }

    // Path validation
    if (target.testFilePath) {
      if (!target.testFilePath.includes('.test.')) {
        errors.push('testFilePath should contain ".test." to indicate it is a test file')
      }

      if (target.testFilePath.includes(':memory:')) {
        errors.push('testFilePath should not reference in-memory databases')
      }
    }

    // Metadata validation
    if (target.metadata) {
      if (target.metadata.fileSize && (typeof target.metadata.fileSize !== 'number' || target.metadata.fileSize < 0)) {
        errors.push('metadata.fileSize must be a positive number')
      }

      if (target.metadata.lastModified && !(target.metadata.lastModified instanceof Date)) {
        errors.push('metadata.lastModified must be a Date object')
      }

      if (target.metadata.testCaseCount && (typeof target.metadata.testCaseCount !== 'number' || target.metadata.testCaseCount < 0)) {
        errors.push('metadata.testCaseCount must be a positive number')
      }

      // Performance requirements validation
      if (target.metadata.performanceRequirements) {
        const perf = target.metadata.performanceRequirements

        if (perf.maxExecutionTime && (typeof perf.maxExecutionTime !== 'number' || perf.maxExecutionTime <= 0)) {
          errors.push('performanceRequirements.maxExecutionTime must be a positive number')
        }

        if (perf.maxMemoryUsage && (typeof perf.maxMemoryUsage !== 'number' || perf.maxMemoryUsage <= 0)) {
          errors.push('performanceRequirements.maxMemoryUsage must be a positive number')
        }

        if (perf.maxIOOperations && (typeof perf.maxIOOperations !== 'number' || perf.maxIOOperations <= 0)) {
          errors.push('performanceRequirements.maxIOOperations must be a positive number')
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Creates a default migration target with minimal required fields
   */
  static createDefault(testFilePath: string, testType: TestType): MigrationTarget {
    return {
      testFilePath,
      testType,
      migrationPriority: 'medium',
      complexity: 0.5,
      dependencies: [],
      estimatedEffort: 'medium'
    }
  }

  /**
   * Estimates complexity based on target characteristics
   */
  static estimateComplexity(target: Partial<MigrationTarget>): number {
    let complexity = 0.1 // Base complexity

    // Test type complexity
    if (target.testType === 'unit') complexity += 0.1
    else if (target.testType === 'integration') complexity += 0.3
    else if (target.testType === 'e2e') complexity += 0.5

    // Dependencies complexity
    if (target.dependencies) {
      complexity += Math.min(target.dependencies.length * 0.05, 0.3)
    }

    // File size complexity (if available)
    if (target.metadata?.fileSize) {
      if (target.metadata.fileSize > 10000) complexity += 0.1 // Large files
      if (target.metadata.fileSize > 50000) complexity += 0.1 // Very large files
    }

    // Test case count complexity
    if (target.metadata?.testCaseCount) {
      if (target.metadata.testCaseCount > 10) complexity += 0.1
      if (target.metadata.testCaseCount > 50) complexity += 0.1
    }

    return Math.min(complexity, 1.0) // Cap at 1.0
  }

  /**
   * Suggests migration priority based on complexity and test type
   */
  static suggestPriority(target: Partial<MigrationTarget>): MigrationPriority {
    const complexity = target.complexity || this.estimateComplexity(target)

    if (target.testType === 'e2e') {
      return complexity > 0.7 ? 'critical' : 'high'
    }

    if (target.testType === 'integration') {
      if (complexity > 0.8) return 'high'
      if (complexity > 0.5) return 'medium'
      return 'low'
    }

    // Unit tests
    if (complexity > 0.9) return 'high'
    if (complexity > 0.6) return 'medium'
    return 'low'
  }

  /**
   * Suggests estimated effort based on complexity and dependencies
   */
  static suggestEffort(target: Partial<MigrationTarget>): EstimatedEffort {
    const complexity = target.complexity || this.estimateComplexity(target)
    const depCount = target.dependencies?.length || 0

    const totalScore = complexity + (depCount * 0.1)

    if (totalScore > 0.9) return 'maximum'
    if (totalScore > 0.7) return 'very-high'
    if (totalScore > 0.5) return 'high'
    if (totalScore > 0.3) return 'medium'
    return 'low'
  }
}
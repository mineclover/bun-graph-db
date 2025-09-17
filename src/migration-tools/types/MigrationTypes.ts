/**
 * Core TypeScript types and interfaces for the Test Migration System
 * These types provide strict typing and validation for the migration process
 */

// Base types for test categorization
export type TestType = 'unit' | 'integration' | 'e2e'
export type MigrationPriority = 'low' | 'medium' | 'high' | 'critical'
export type EstimatedEffort = 'low' | 'medium' | 'high' | 'extreme'
export type TestComplexity = number // 0.0 to 1.0

// Database related types
export interface DatabasePath {
  readonly path: string
  readonly isFileBase: boolean
  readonly isTemporary: boolean
}

export interface TestIsolationConfig {
  readonly enforceFileBased: boolean
  readonly tempDirectory: string
  readonly uniqueNaming: boolean
  readonly cleanupOnExit: boolean
}

// Migration target definition
export interface MigrationTarget {
  readonly testFilePath: string
  readonly testType: TestType
  readonly migrationPriority: MigrationPriority
  readonly complexity: TestComplexity
  readonly dependencies: readonly string[]
  readonly estimatedEffort: EstimatedEffort
  readonly metadata?: Record<string, unknown>
}

// Migration analysis results
export interface PerformanceImpact {
  readonly executionTime: number // milliseconds
  readonly resourceUsage: {
    readonly memory: number // MB
    readonly cpu: number // percentage
  }
  readonly parallelizability: boolean
}

export interface MigrationAnalysis {
  readonly target: MigrationTarget
  readonly feasibility: number // 0.0 to 1.0
  readonly risks: readonly string[]
  readonly recommendations: readonly string[]
  readonly estimatedTime: number // minutes
  readonly requiredTools: readonly string[]
  readonly performanceImpact: PerformanceImpact
}

// Migration execution context
export interface TestContext {
  readonly suiteName: string
  readonly databasePath: string
  readonly testType: TestType
  readonly isolationLevel: 'basic' | 'enhanced' | 'complete'
  readonly startTime: Date
  readonly environment: Record<string, string>
}

// Migration report
export interface MigrationExecutionResult {
  readonly success: boolean
  readonly executionTime: number
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
  readonly metricsCollected: Record<string, number>
}

export interface MigrationReport {
  readonly target: MigrationTarget
  readonly context: TestContext
  readonly analysis: MigrationAnalysis
  readonly execution: MigrationExecutionResult
  readonly timestamp: Date
  readonly version: string
}

// Performance comparison
export interface PerformanceBaseline {
  readonly testName: string
  readonly executionTime: number
  readonly memoryUsage: number
  readonly timestamp: Date
}

export interface PerformanceComparison {
  readonly baseline: PerformanceBaseline
  readonly current: PerformanceBaseline
  readonly variance: {
    readonly executionTime: number // percentage
    readonly memoryUsage: number // percentage
  }
  readonly isAnomaly: boolean // >50% variance
  readonly recommendations: readonly string[]
}

// Validation results
export interface ValidationRule {
  readonly name: string
  readonly description: string
  readonly severity: 'error' | 'warning' | 'info'
}

export interface ValidationIssue {
  readonly rule: ValidationRule
  readonly message: string
  readonly location?: string
  readonly suggestedFix?: string
}

export interface ValidationResult {
  readonly isValid: boolean
  readonly issues: readonly ValidationIssue[]
  readonly score: number // 0.0 to 1.0
  readonly timestamp: Date
}

// Error types
export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'MigrationError'
  }
}

export class ValidationError extends MigrationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

export class FileSystemError extends MigrationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'FILESYSTEM_ERROR', details)
    this.name = 'FileSystemError'
  }
}

// Utility types for type safety
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

export type AsyncResult<T, E = Error> = Promise<Result<T, E>>

// Type guards
export function isValidTestType(type: string): type is TestType {
  return ['unit', 'integration', 'e2e'].includes(type)
}

export function isValidMigrationPriority(priority: string): priority is MigrationPriority {
  return ['low', 'medium', 'high', 'critical'].includes(priority)
}

export function isValidComplexity(complexity: number): complexity is TestComplexity {
  return typeof complexity === 'number' && complexity >= 0 && complexity <= 1
}

// Validation helpers
export function validateMigrationTarget(target: unknown): target is MigrationTarget {
  if (!target || typeof target !== 'object') {
    return false
  }

  const t = target as Record<string, unknown>

  return (
    typeof t.testFilePath === 'string' &&
    isValidTestType(t.testType as string) &&
    isValidMigrationPriority(t.migrationPriority as string) &&
    isValidComplexity(t.complexity as number) &&
    Array.isArray(t.dependencies) &&
    t.dependencies.every(dep => typeof dep === 'string') &&
    ['low', 'medium', 'high', 'extreme'].includes(t.estimatedEffort as string)
  )
}

export function validateTestContext(context: unknown): context is TestContext {
  if (!context || typeof context !== 'object') {
    return false
  }

  const c = context as Record<string, unknown>

  return (
    typeof c.suiteName === 'string' &&
    typeof c.databasePath === 'string' &&
    isValidTestType(c.testType as string) &&
    ['basic', 'enhanced', 'complete'].includes(c.isolationLevel as string) &&
    c.startTime instanceof Date &&
    typeof c.environment === 'object'
  )
}
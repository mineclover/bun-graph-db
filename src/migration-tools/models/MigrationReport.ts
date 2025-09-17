/**
 * MigrationReport model - Represents the result and analysis of a migration operation
 */

import type { MigrationTarget } from './MigrationTarget'
import type { TestContext } from './TestContext'

export type MigrationStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'rolled-back'
export type MigrationPhase = 'analysis' | 'validation' | 'preparation' | 'execution' | 'verification' | 'cleanup'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface MigrationMetrics {
  /** Total execution time in milliseconds */
  executionTime: number

  /** Time spent in each phase */
  phaseTimings: Record<MigrationPhase, number>

  /** Number of files processed */
  filesProcessed: number

  /** Number of dependencies resolved */
  dependenciesResolved: number

  /** Memory usage during migration */
  memoryUsage: {
    peak: number
    average: number
    final: number
  }

  /** I/O operations performed */
  ioOperations: {
    reads: number
    writes: number
    totalBytes: number
  }

  /** Database operations */
  databaseOperations: {
    connections: number
    queries: number
    transactions: number
  }
}

export interface MigrationRisk {
  /** Risk identifier */
  id: string

  /** Risk description */
  description: string

  /** Risk severity level */
  level: RiskLevel

  /** Risk category */
  category: 'performance' | 'compatibility' | 'data-integrity' | 'security' | 'dependency' | 'resource'

  /** Probability of risk occurring (0.0 to 1.0) */
  probability: number

  /** Potential impact if risk occurs */
  impact: string

  /** Suggested mitigation strategies */
  mitigation: string[]

  /** Whether risk has been addressed */
  addressed: boolean
}

export interface MigrationRecommendation {
  /** Recommendation identifier */
  id: string

  /** Recommendation description */
  description: string

  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical'

  /** Category of recommendation */
  category: 'performance' | 'best-practice' | 'security' | 'maintainability' | 'testing'

  /** Specific actions to take */
  actions: string[]

  /** Expected benefits */
  benefits: string[]

  /** Implementation effort required */
  effort: 'minimal' | 'low' | 'medium' | 'high' | 'substantial'

  /** Whether recommendation has been implemented */
  implemented: boolean
}

export interface PerformanceComparison {
  /** Baseline performance metrics (before migration) */
  baseline: {
    executionTime: number
    memoryUsage: number
    ioOperations: number
    databaseConnections: number
  }

  /** Post-migration performance metrics */
  migrated: {
    executionTime: number
    memoryUsage: number
    ioOperations: number
    databaseConnections: number
  }

  /** Performance improvements */
  improvements: {
    executionTimeReduction: number // Percentage
    memoryReduction: number // Percentage
    ioEfficiency: number // Percentage
    databaseEfficiency: number // Percentage
  }

  /** Performance regressions */
  regressions: {
    executionTimeIncrease: number // Percentage
    memoryIncrease: number // Percentage
    ioOverhead: number // Percentage
    databaseOverhead: number // Percentage
  }

  /** Overall performance score */
  overallScore: number // 0.0 to 1.0 (1.0 = perfect)
}

export interface FileBasedEnforcement {
  /** Whether file-based database was enforced */
  enforced: boolean

  /** Previous database type */
  previousType: 'memory' | 'file-based' | 'unknown'

  /** Current database type */
  currentType: 'file-based' | 'error'

  /** Database file path */
  databasePath: string

  /** Validation results */
  validation: {
    pathValid: boolean
    fileExists: boolean
    accessible: boolean
    noMemoryReferences: boolean
  }

  /** Any violations detected */
  violations: string[]

  /** Compliance score */
  complianceScore: number // 0.0 to 1.0
}

export interface MigrationEvidence {
  /** Migration logs */
  logs: string[]

  /** Screenshots or visual evidence (if applicable) */
  screenshots: string[]

  /** Performance traces */
  traces: any[]

  /** Error stack traces */
  errorTraces: string[]

  /** Configuration snapshots */
  configSnapshots: any[]

  /** Database schema comparisons */
  schemaComparisons: any[]
}

export interface RollbackInfo {
  /** Path to backup files */
  backupPath: string

  /** Rollback command to execute */
  rollbackCommand: string

  /** Backup timestamp */
  timestamp: Date

  /** Backup file size */
  backupSize: number

  /** Rollback complexity */
  complexity: 'simple' | 'moderate' | 'complex'

  /** Estimated rollback time */
  estimatedRollbackTime: number

  /** Additional rollback notes */
  notes: string[]
}

export interface MigrationReport {
  /** Report identifier */
  id: string

  /** Migration target that was processed */
  target: MigrationTarget

  /** Migration status */
  status: MigrationStatus

  /** Current phase */
  currentPhase: MigrationPhase

  /** Whether migration was successful */
  success: boolean

  /** Path to migrated file (if successful) */
  migratedFilePath: string | null

  /** Migration execution metrics */
  metrics: MigrationMetrics

  /** Performance comparison */
  performanceComparison: PerformanceComparison

  /** File-based enforcement results */
  fileBasedEnforcement: FileBasedEnforcement

  /** Identified risks */
  risks: MigrationRisk[]

  /** Migration recommendations */
  recommendations: MigrationRecommendation[]

  /** Migration warnings */
  warnings: string[]

  /** Migration errors */
  errors: string[]

  /** Test context used */
  testContext?: TestContext

  /** Rollback information */
  rollbackInfo?: RollbackInfo

  /** Migration evidence */
  evidence: MigrationEvidence

  /** Report generation timestamp */
  generatedAt: Date

  /** Report generation metadata */
  metadata: {
    /** Migration tool version */
    toolVersion: string

    /** Environment information */
    environment: string

    /** User who performed migration */
    performedBy: string

    /** Additional tags */
    tags: string[]
  }
}

export class MigrationReportBuilder {
  private report: Partial<MigrationReport>

  constructor(target: MigrationTarget) {
    this.report = {
      id: this.generateReportId(),
      target,
      status: 'pending',
      currentPhase: 'analysis',
      success: false,
      migratedFilePath: null,
      risks: [],
      recommendations: [],
      warnings: [],
      errors: [],
      evidence: {
        logs: [],
        screenshots: [],
        traces: [],
        errorTraces: [],
        configSnapshots: [],
        schemaComparisons: []
      },
      generatedAt: new Date(),
      metadata: {
        toolVersion: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        performedBy: process.env.USER || 'system',
        tags: []
      }
    }
  }

  private generateReportId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `migration-${timestamp}-${random}`
  }

  setStatus(status: MigrationStatus): this {
    this.report.status = status
    return this
  }

  setPhase(phase: MigrationPhase): this {
    this.report.currentPhase = phase
    return this
  }

  setSuccess(success: boolean): this {
    this.report.success = success
    return this
  }

  setMigratedFilePath(path: string): this {
    this.report.migratedFilePath = path
    return this
  }

  setMetrics(metrics: MigrationMetrics): this {
    this.report.metrics = metrics
    return this
  }

  setPerformanceComparison(comparison: PerformanceComparison): this {
    this.report.performanceComparison = comparison
    return this
  }

  setFileBasedEnforcement(enforcement: FileBasedEnforcement): this {
    this.report.fileBasedEnforcement = enforcement
    return this
  }

  addRisk(risk: MigrationRisk): this {
    if (!this.report.risks) this.report.risks = []
    this.report.risks.push(risk)
    return this
  }

  addRecommendation(recommendation: MigrationRecommendation): this {
    if (!this.report.recommendations) this.report.recommendations = []
    this.report.recommendations.push(recommendation)
    return this
  }

  addWarning(warning: string): this {
    if (!this.report.warnings) this.report.warnings = []
    this.report.warnings.push(warning)
    return this
  }

  addError(error: string): this {
    if (!this.report.errors) this.report.errors = []
    this.report.errors.push(error)
    return this
  }

  setTestContext(context: TestContext): this {
    this.report.testContext = context
    return this
  }

  setRollbackInfo(rollbackInfo: RollbackInfo): this {
    this.report.rollbackInfo = rollbackInfo
    return this
  }

  addLog(log: string): this {
    if (!this.report.evidence) {
      this.report.evidence = { logs: [], screenshots: [], traces: [], errorTraces: [], configSnapshots: [], schemaComparisons: [] }
    }
    this.report.evidence.logs.push(log)
    return this
  }

  addErrorTrace(trace: string): this {
    if (!this.report.evidence) {
      this.report.evidence = { logs: [], screenshots: [], traces: [], errorTraces: [], configSnapshots: [], schemaComparisons: [] }
    }
    this.report.evidence.errorTraces.push(trace)
    return this
  }

  addTag(tag: string): this {
    if (!this.report.metadata) {
      this.report.metadata = { toolVersion: '1.0.0', environment: 'development', performedBy: 'system', tags: [] }
    }
    this.report.metadata.tags.push(tag)
    return this
  }

  build(): MigrationReport {
    // Validate required fields
    if (!this.report.target) {
      throw new Error('Migration target is required')
    }

    if (!this.report.metrics) {
      // Create default metrics
      this.report.metrics = {
        executionTime: 0,
        phaseTimings: {
          analysis: 0,
          validation: 0,
          preparation: 0,
          execution: 0,
          verification: 0,
          cleanup: 0
        },
        filesProcessed: 0,
        dependenciesResolved: 0,
        memoryUsage: { peak: 0, average: 0, final: 0 },
        ioOperations: { reads: 0, writes: 0, totalBytes: 0 },
        databaseOperations: { connections: 0, queries: 0, transactions: 0 }
      }
    }

    if (!this.report.performanceComparison) {
      // Create default performance comparison
      this.report.performanceComparison = {
        baseline: { executionTime: 0, memoryUsage: 0, ioOperations: 0, databaseConnections: 0 },
        migrated: { executionTime: 0, memoryUsage: 0, ioOperations: 0, databaseConnections: 0 },
        improvements: { executionTimeReduction: 0, memoryReduction: 0, ioEfficiency: 0, databaseEfficiency: 0 },
        regressions: { executionTimeIncrease: 0, memoryIncrease: 0, ioOverhead: 0, databaseOverhead: 0 },
        overallScore: 0.5
      }
    }

    if (!this.report.fileBasedEnforcement) {
      // Create default file-based enforcement
      this.report.fileBasedEnforcement = {
        enforced: false,
        previousType: 'unknown',
        currentType: 'file-based',
        databasePath: '',
        validation: { pathValid: false, fileExists: false, accessible: false, noMemoryReferences: false },
        violations: [],
        complianceScore: 0.0
      }
    }

    return this.report as MigrationReport
  }
}

export class MigrationReportAnalyzer {
  /**
   * Calculates overall migration success score
   */
  static calculateSuccessScore(report: MigrationReport): number {
    let score = 0.0

    // Base success (40%)
    if (report.success) score += 0.4

    // Performance score (20%)
    score += report.performanceComparison.overallScore * 0.2

    // File-based compliance (20%)
    score += report.fileBasedEnforcement.complianceScore * 0.2

    // Risk mitigation (10%)
    const totalRisks = report.risks.length
    const addressedRisks = report.risks.filter(r => r.addressed).length
    if (totalRisks > 0) {
      score += (addressedRisks / totalRisks) * 0.1
    } else {
      score += 0.1 // No risks is good
    }

    // Error penalty (10%)
    const errorPenalty = Math.min(report.errors.length * 0.02, 0.1)
    score -= errorPenalty

    return Math.max(0.0, Math.min(1.0, score))
  }

  /**
   * Identifies critical issues in the migration report
   */
  static identifyCriticalIssues(report: MigrationReport): string[] {
    const issues: string[] = []

    // Migration failure
    if (!report.success) {
      issues.push('Migration failed to complete successfully')
    }

    // File-based enforcement violations
    if (!report.fileBasedEnforcement.enforced) {
      issues.push('File-based database enforcement was not applied')
    }

    if (report.fileBasedEnforcement.violations.length > 0) {
      issues.push(`File-based violations detected: ${report.fileBasedEnforcement.violations.join(', ')}`)
    }

    // Critical risks
    const criticalRisks = report.risks.filter(r => r.level === 'critical' && !r.addressed)
    if (criticalRisks.length > 0) {
      issues.push(`Unaddressed critical risks: ${criticalRisks.map(r => r.description).join(', ')}`)
    }

    // Performance regressions
    if (report.performanceComparison.regressions.executionTimeIncrease > 50) {
      issues.push(`Significant execution time regression: ${report.performanceComparison.regressions.executionTimeIncrease}%`)
    }

    if (report.performanceComparison.regressions.memoryIncrease > 100) {
      issues.push(`Significant memory usage regression: ${report.performanceComparison.regressions.memoryIncrease}%`)
    }

    // Error count
    if (report.errors.length > 5) {
      issues.push(`High error count: ${report.errors.length} errors encountered`)
    }

    return issues
  }

  /**
   * Generates summary statistics for the migration
   */
  static generateSummary(report: MigrationReport): {
    overallScore: number
    criticalIssues: string[]
    recommendations: number
    risksAddressed: number
    performanceImpact: 'positive' | 'neutral' | 'negative'
    complianceScore: number
  } {
    const overallScore = this.calculateSuccessScore(report)
    const criticalIssues = this.identifyCriticalIssues(report)

    // Determine performance impact
    const perfComparison = report.performanceComparison
    let performanceImpact: 'positive' | 'neutral' | 'negative'

    const netExecutionChange = perfComparison.improvements.executionTimeReduction - perfComparison.regressions.executionTimeIncrease
    const netMemoryChange = perfComparison.improvements.memoryReduction - perfComparison.regressions.memoryIncrease

    if (netExecutionChange > 10 || netMemoryChange > 10) {
      performanceImpact = 'positive'
    } else if (netExecutionChange < -10 || netMemoryChange < -10) {
      performanceImpact = 'negative'
    } else {
      performanceImpact = 'neutral'
    }

    return {
      overallScore,
      criticalIssues,
      recommendations: report.recommendations.length,
      risksAddressed: report.risks.filter(r => r.addressed).length,
      performanceImpact,
      complianceScore: report.fileBasedEnforcement.complianceScore
    }
  }
}
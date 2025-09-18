/**
 * ValidationResult model - Represents validation results for migration operations
 */

export type ValidationSeverity = 'info' | 'warning' | 'error' | 'critical'
export type ValidationType = 'syntax' | 'dependency' | 'performance' | 'security' | 'compatibility' | 'file-based'

export interface ValidationIssue {
  /** Issue identifier */
  id: string

  /** Issue type */
  type: ValidationType

  /** Issue severity */
  severity: ValidationSeverity

  /** Issue description */
  description: string

  /** Location where issue was found */
  location?: {
    file?: string
    line?: number
    column?: number
    function?: string
  }

  /** Detailed explanation */
  details: string

  /** Suggested fix or remediation */
  suggestion?: string

  /** Auto-fixable flag */
  autoFixable: boolean

  /** Related issues */
  relatedIssues?: string[]
}

export interface FileAnalysis {
  /** Whether the file exists */
  exists: boolean

  /** File size in bytes */
  size: number

  /** Last modified timestamp */
  lastModified: Date

  /** Whether syntax is valid */
  syntaxValid: boolean

  /** Detected file encoding */
  encoding: string

  /** Number of lines */
  lineCount: number

  /** File permissions */
  permissions: {
    readable: boolean
    writable: boolean
    executable: boolean
  }

  /** File content analysis */
  content: {
    /** Detected test framework */
    testFramework?: string

    /** Number of test cases */
    testCaseCount: number

    /** Number of imports */
    importCount: number

    /** Detected dependencies */
    dependencies: string[]

    /** In-memory database usage detected */
    memoryDatabaseUsage: boolean

    /** File-based database usage detected */
    fileBasedDatabaseUsage: boolean
  }

  /** Syntax analysis */
  syntax: {
    /** Language detected */
    language: string

    /** TypeScript/JavaScript specific analysis */
    typescript?: {
      hasTypes: boolean
      configErrors: string[]
      missingTypes: string[]
    }

    /** Syntax errors */
    errors: ValidationIssue[]
  }
}

export interface DependencyCheck {
  /** Whether all dependencies are resolved */
  allResolved: boolean

  /** List of missing dependencies */
  missingDependencies: string[]

  /** List of resolved dependencies */
  resolvedDependencies: string[]

  /** Version conflicts */
  versionConflicts: {
    dependency: string
    required: string
    found: string
    severity: ValidationSeverity
  }[]

  /** Circular dependencies */
  circularDependencies: string[][]

  /** Deprecated dependencies */
  deprecatedDependencies: {
    name: string
    reason: string
    alternative?: string
  }[]

  /** Security vulnerabilities in dependencies */
  securityVulnerabilities: {
    dependency: string
    vulnerability: string
    severity: ValidationSeverity
    cve?: string
  }[]
}

export interface PerformanceRisk {
  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high' | 'critical'

  /** Risk factors contributing to performance issues */
  factors: {
    factor: string
    impact: 'low' | 'medium' | 'high'
    description: string
  }[]

  /** Estimated performance impact */
  estimatedImpact: {
    executionTime: number // Percentage increase
    memoryUsage: number // Percentage increase
    ioOperations: number // Percentage increase
  }

  /** Performance recommendations */
  recommendations: string[]

  /** Benchmark requirements */
  benchmarkRequirements?: {
    minExecutionTime: number
    maxExecutionTime: number
    maxMemoryUsage: number
    maxIOOperations: number
  }
}

export interface DatabaseValidation {
  /** Whether file-based database is enforced */
  enforcesFileBased: boolean

  /** In-memory database usage detected */
  memoryUsageDetected: boolean

  /** Database connection validation */
  connectionValidation: {
    /** Whether connections are properly configured */
    properlyConfigured: boolean

    /** Connection string analysis */
    connectionString?: {
      valid: boolean
      type: 'file-based' | 'memory' | 'network' | 'unknown'
      path?: string
      issues: string[]
    }

    /** Connection pooling analysis */
    pooling?: {
      enabled: boolean
      maxConnections?: number
      issues: string[]
    }
  }

  /** File path validation */
  pathValidation: {
    /** Whether database paths are valid */
    validPaths: boolean

    /** Detected file paths */
    filePaths: string[]

    /** Path issues */
    pathIssues: ValidationIssue[]
  }

  /** Database schema validation */
  schemaValidation?: {
    /** Whether schema is valid */
    valid: boolean

    /** Schema issues */
    issues: ValidationIssue[]

    /** Migration requirements */
    migrationRequired: boolean
  }
}

export interface ParallelExecutionSafety {
  /** Whether parallel execution is safe */
  isSafe: boolean

  /** Detected conflicts */
  conflicts: {
    type: 'resource' | 'data' | 'configuration' | 'dependency'
    description: string
    severity: ValidationSeverity
    affectedResources: string[]
  }[]

  /** Recommendations for parallel execution */
  recommendations: string[]

  /** Isolation requirements */
  isolationRequirements: {
    level: 'none' | 'process' | 'database' | 'filesystem' | 'full'
    reason: string
  }

  /** Resource contention analysis */
  resourceContention: {
    /** Shared resources */
    sharedResources: string[]

    /** Contention probability */
    contentionProbability: number // 0.0 to 1.0

    /** Mitigation strategies */
    mitigationStrategies: string[]
  }
}

export interface ValidationResult {
  /** Whether validation passed overall */
  isValid: boolean

  /** Validation timestamp */
  timestamp: Date

  /** Validation errors (prevent operation) */
  errors: ValidationIssue[]

  /** Validation warnings (allow but flag) */
  warnings: ValidationIssue[]

  /** Validation suggestions (optimization opportunities) */
  suggestions: string[]

  /** File analysis results */
  fileAnalysis: FileAnalysis

  /** Dependency check results */
  dependencyCheck: DependencyCheck

  /** Performance risk assessment */
  performanceRisk: PerformanceRisk

  /** Database validation results */
  databaseValidation: DatabaseValidation

  /** Parallel execution safety analysis */
  parallelExecutionSafety: ParallelExecutionSafety

  /** Validation summary */
  summary: {
    /** Total issues by severity */
    issueCounts: Record<ValidationSeverity, number>

    /** Validation score (0.0 to 1.0) */
    score: number

    /** Critical blockers */
    criticalBlockers: string[]

    /** Top recommendations */
    topRecommendations: string[]
  }

  /** Validation metadata */
  metadata: {
    /** Validator version */
    validatorVersion: string

    /** Validation rules applied */
    rulesApplied: string[]

    /** Validation duration */
    duration: number

    /** Environment context */
    environment: string
  }
}

export class ValidationResultBuilder {
  private result: Partial<ValidationResult>

  constructor() {
    this.result = {
      isValid: true,
      timestamp: new Date(),
      errors: [],
      warnings: [],
      suggestions: [],
      summary: {
        issueCounts: { info: 0, warning: 0, error: 0, critical: 0 },
        score: 1.0,
        criticalBlockers: [],
        topRecommendations: []
      },
      metadata: {
        validatorVersion: '1.0.0',
        rulesApplied: [],
        duration: 0,
        environment: process.env.NODE_ENV || 'development'
      }
    }
  }

  addError(issue: ValidationIssue): this {
    if (!this.result.errors) this.result.errors = []
    this.result.errors.push(issue)
    this.result.isValid = false
    this.updateSummary()
    return this
  }

  addWarning(issue: ValidationIssue): this {
    if (!this.result.warnings) this.result.warnings = []
    this.result.warnings.push(issue)
    this.updateSummary()
    return this
  }

  addSuggestion(suggestion: string): this {
    if (!this.result.suggestions) this.result.suggestions = []
    this.result.suggestions.push(suggestion)
    this.updateSummary()
    return this
  }

  setFileAnalysis(analysis: FileAnalysis): this {
    this.result.fileAnalysis = analysis

    // Auto-add issues from file analysis
    if (!analysis.exists) {
      this.addError({
        id: 'file-not-found',
        type: 'compatibility',
        severity: 'error',
        description: 'Target file does not exist',
        details: 'The specified migration target file could not be found',
        suggestion: 'Verify the file path is correct',
        autoFixable: false
      })
    }

    if (!analysis.syntaxValid) {
      this.addError({
        id: 'syntax-invalid',
        type: 'syntax',
        severity: 'error',
        description: 'File contains syntax errors',
        details: 'The target file has syntax errors that prevent migration',
        suggestion: 'Fix syntax errors before attempting migration',
        autoFixable: false
      })
    }

    if (analysis.content.memoryDatabaseUsage) {
      this.addWarning({
        id: 'memory-database-detected',
        type: 'file-based',
        severity: 'warning',
        description: 'In-memory database usage detected',
        details: 'The file uses in-memory databases which will be migrated to file-based',
        suggestion: 'Review database initialization code after migration',
        autoFixable: true
      })
    }

    return this
  }

  setDependencyCheck(check: DependencyCheck): this {
    this.result.dependencyCheck = check

    // Auto-add issues from dependency check
    check.missingDependencies.forEach(dep => {
      this.addError({
        id: `missing-dependency-${dep}`,
        type: 'dependency',
        severity: 'error',
        description: `Missing dependency: ${dep}`,
        details: `Required dependency ${dep} is not available`,
        suggestion: `Install ${dep} or remove dependency`,
        autoFixable: false
      })
    })

    check.securityVulnerabilities.forEach(vuln => {
      this.addIssue({
        id: `security-vulnerability-${vuln.dependency}`,
        type: 'security',
        severity: vuln.severity,
        description: `Security vulnerability in ${vuln.dependency}`,
        details: vuln.vulnerability,
        suggestion: 'Update to a secure version',
        autoFixable: false
      }, vuln.severity)
    })

    return this
  }

  setPerformanceRisk(risk: PerformanceRisk): this {
    this.result.performanceRisk = risk

    if (risk.riskLevel === 'critical' || risk.riskLevel === 'high') {
      this.addWarning({
        id: 'high-performance-risk',
        type: 'performance',
        severity: risk.riskLevel === 'critical' ? 'critical' : 'warning',
        description: `High performance risk detected: ${risk.riskLevel}`,
        details: `Performance factors: ${risk.factors.map(f => f.factor).join(', ')}`,
        suggestion: risk.recommendations.join('; '),
        autoFixable: false
      })
    }

    return this
  }

  setDatabaseValidation(validation: DatabaseValidation): this {
    this.result.databaseValidation = validation

    if (validation.memoryUsageDetected && validation.enforcesFileBased) {
      this.addWarning({
        id: 'memory-database-with-enforcement',
        type: 'file-based',
        severity: 'warning',
        description: 'In-memory database usage detected with file-based enforcement',
        details: 'File will be migrated to use file-based databases',
        suggestion: 'Review database configuration after migration',
        autoFixable: true
      })
    }

    if (!validation.connectionValidation.properlyConfigured) {
      this.addError({
        id: 'database-connection-misconfigured',
        type: 'compatibility',
        severity: 'error',
        description: 'Database connections are not properly configured',
        details: 'Database connection configuration has issues',
        suggestion: 'Fix database connection configuration',
        autoFixable: false
      })
    }

    return this
  }

  setParallelExecutionSafety(safety: ParallelExecutionSafety): this {
    this.result.parallelExecutionSafety = safety

    if (!safety.isSafe) {
      this.addWarning({
        id: 'parallel-execution-unsafe',
        type: 'compatibility',
        severity: 'warning',
        description: 'Parallel execution may not be safe',
        details: `Conflicts detected: ${safety.conflicts.map(c => c.description).join('; ')}`,
        suggestion: safety.recommendations.join('; '),
        autoFixable: false
      })
    }

    safety.conflicts.forEach(conflict => {
      if (conflict.severity === 'error' || conflict.severity === 'critical') {
        this.addError({
          id: `parallel-conflict-${conflict.type}`,
          type: 'compatibility',
          severity: conflict.severity,
          description: `Parallel execution conflict: ${conflict.description}`,
          details: `Affected resources: ${conflict.affectedResources.join(', ')}`,
          suggestion: 'Implement proper isolation or avoid parallel execution',
          autoFixable: false
        })
      }
    })

    return this
  }

  private addIssue(issue: ValidationIssue, severity: ValidationSeverity): void {
    switch (severity) {
      case 'critical':
      case 'error':
        this.addError(issue)
        break
      case 'warning':
        this.addWarning(issue)
        break
      case 'info':
        this.addSuggestion(issue)
        break
    }
  }

  private updateSummary(): void {
    const summary = this.result.summary!

    // Update issue counts
    summary.issueCounts = {
      info: this.result.suggestions?.length || 0,
      warning: this.result.warnings?.length || 0,
      error: this.result.errors?.length || 0,
      critical: (this.result.errors?.filter(e => e.severity === 'critical').length || 0)
    }

    // Calculate validation score
    const totalIssues = summary.issueCounts.info + summary.issueCounts.warning +
                       summary.issueCounts.error + summary.issueCounts.critical

    if (totalIssues === 0) {
      summary.score = 1.0
    } else {
      const penaltyScore = (summary.issueCounts.critical * 0.4) +
                          (summary.issueCounts.error * 0.3) +
                          (summary.issueCounts.warning * 0.1) +
                          (summary.issueCounts.info * 0.02)
      summary.score = Math.max(0, 1.0 - (penaltyScore / 10))
    }

    // Update critical blockers
    summary.criticalBlockers = (this.result.errors || [])
      .filter(e => e.severity === 'critical')
      .map(e => e.description)

    // Update top recommendations
    const allSuggestions = [
      ...(this.result.warnings || []).map(w => w.suggestion).filter(Boolean),
      ...(this.result.suggestions || [])
    ] as string[]

    summary.topRecommendations = allSuggestions.slice(0, 5)
  }

  build(): ValidationResult {
    // Ensure all required fields are present
    if (!this.result.fileAnalysis) {
      this.result.fileAnalysis = this.createDefaultFileAnalysis()
    }

    if (!this.result.dependencyCheck) {
      this.result.dependencyCheck = this.createDefaultDependencyCheck()
    }

    if (!this.result.performanceRisk) {
      this.result.performanceRisk = this.createDefaultPerformanceRisk()
    }

    if (!this.result.databaseValidation) {
      this.result.databaseValidation = this.createDefaultDatabaseValidation()
    }

    if (!this.result.parallelExecutionSafety) {
      this.result.parallelExecutionSafety = this.createDefaultParallelExecutionSafety()
    }

    this.updateSummary()
    return this.result as ValidationResult
  }

  private createDefaultFileAnalysis(): FileAnalysis {
    return {
      exists: false,
      size: 0,
      lastModified: new Date(),
      syntaxValid: false,
      encoding: 'utf-8',
      lineCount: 0,
      permissions: { readable: false, writable: false, executable: false },
      content: {
        testCaseCount: 0,
        importCount: 0,
        dependencies: [],
        memoryDatabaseUsage: false,
        fileBasedDatabaseUsage: false
      },
      syntax: {
        language: 'unknown',
        errors: []
      }
    }
  }

  private createDefaultDependencyCheck(): DependencyCheck {
    return {
      allResolved: false,
      missingDependencies: [],
      resolvedDependencies: [],
      versionConflicts: [],
      circularDependencies: [],
      deprecatedDependencies: [],
      securityVulnerabilities: []
    }
  }

  private createDefaultPerformanceRisk(): PerformanceRisk {
    return {
      riskLevel: 'medium',
      factors: [],
      estimatedImpact: { executionTime: 0, memoryUsage: 0, ioOperations: 0 },
      recommendations: []
    }
  }

  private createDefaultDatabaseValidation(): DatabaseValidation {
    return {
      enforcesFileBased: true,
      memoryUsageDetected: false,
      connectionValidation: {
        properlyConfigured: true
      },
      pathValidation: {
        validPaths: true,
        filePaths: [],
        pathIssues: []
      }
    }
  }

  private createDefaultParallelExecutionSafety(): ParallelExecutionSafety {
    return {
      isSafe: false,
      conflicts: [],
      recommendations: [],
      isolationRequirements: { level: 'none', reason: 'No analysis performed' },
      resourceContention: {
        sharedResources: [],
        contentionProbability: 0.5,
        mitigationStrategies: []
      }
    }
  }
}
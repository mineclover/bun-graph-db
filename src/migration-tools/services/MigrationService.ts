/**
 * MigrationService - Core service for test migration operations
 */

import type { MigrationTarget } from '../models/MigrationTarget'
import type { MigrationReport } from '../models/MigrationReport'
import type { ValidationResult } from '../models/ValidationResult'
import type { TestContext } from '../models/TestContext'
import { MigrationReportBuilder } from '../models/MigrationReport'
import { ValidationResultBuilder } from '../models/ValidationResult'

export type MigrationResult = MigrationReport

export interface MigrationOptions {
  /** Whether to perform a dry run without making changes */
  dryRun?: boolean

  /** Whether to create backup before migration */
  createBackup?: boolean

  /** Whether to validate after migration */
  validateAfterMigration?: boolean

  /** Whether to preserve original file */
  preserveOriginal?: boolean

  /** Custom test context to use */
  testContext?: TestContext

  /** Whether to enforce file-based databases */
  enforceFileBased?: boolean

  /** Whether to enable performance monitoring */
  performanceMonitoring?: boolean
}

export interface MigrationAnalysis {
  /** Target being analyzed */
  target: MigrationTarget

  /** Validation results */
  validation: ValidationResult

  /** Estimated migration effort in hours */
  estimatedEffort: number

  /** Detected complexity factors */
  complexityFactors: string[]

  /** Risk assessment */
  risks: {
    level: 'low' | 'medium' | 'high' | 'critical'
    description: string
    mitigation: string
  }[]

  /** File-based database enforcement assessment */
  fileBasedEnforcement: {
    currentType: 'memory' | 'file-based' | 'unknown'
    enforcementRequired: boolean
    violations: string[]
  }
}

export interface MigrationExecutionOptions {
  /** Whether to create backup before migration */
  createBackup?: boolean

  /** Whether to validate after migration */
  validateAfterMigration?: boolean

  /** Whether to preserve original file */
  preserveOriginal?: boolean

  /** Custom test context to use */
  testContext?: TestContext

  /** Whether to enforce file-based databases */
  enforceFileBased?: boolean
}

export class MigrationService {
  private static instance: MigrationService

  static getInstance(): MigrationService {
    if (!this.instance) {
      this.instance = new MigrationService()
    }
    return this.instance
  }

  /**
   * Analyzes a migration target for complexity, risks, and requirements
   */
  async analyze(target: MigrationTarget): Promise<MigrationAnalysis> {
    const validationBuilder = new ValidationResultBuilder()

    // File analysis
    const fileExists = await this.checkFileExists(target.testFilePath)
    if (!fileExists) {
      validationBuilder.addError({
        id: 'file-not-found',
        type: 'compatibility',
        severity: 'error',
        description: `Test file not found: ${target.testFilePath}`,
        details: 'The specified test file does not exist',
        suggestion: 'Verify the file path is correct',
        autoFixable: false
      })
    }

    // Analyze file content for database usage
    const fileContent = fileExists ? await this.readFileContent(target.testFilePath) : ''
    const fileBasedEnforcement = this.analyzeFileBasedEnforcement(fileContent)

    // Detect complexity factors
    const complexityFactors = this.detectComplexityFactors(fileContent, target)

    // Risk assessment
    const risks = this.assessRisks(target, complexityFactors, fileBasedEnforcement)

    // Estimate effort
    const estimatedEffort = this.estimateEffort(target, complexityFactors, risks)

    const validation = validationBuilder.build()

    return {
      target,
      validation,
      estimatedEffort,
      complexityFactors,
      risks,
      fileBasedEnforcement
    }
  }

  /**
   * Validates a migration target before execution
   */
  async validate(target: MigrationTarget): Promise<ValidationResult> {
    const builder = new ValidationResultBuilder()

    // Basic target validation
    const targetValidation = await this.validateTarget(target)
    if (!targetValidation.isValid) {
      targetValidation.errors.forEach(error => {
        builder.addError({
          id: `target-validation-${Date.now()}`,
          type: 'compatibility',
          severity: 'error',
          description: error,
          details: 'Target validation failed',
          suggestion: 'Fix target configuration',
          autoFixable: false
        })
      })
    }

    // File existence and readability
    const fileExists = await this.checkFileExists(target.testFilePath)
    if (!fileExists) {
      builder.addError({
        id: 'file-not-found',
        type: 'compatibility',
        severity: 'error',
        description: 'Target file does not exist',
        details: `File not found: ${target.testFilePath}`,
        suggestion: 'Verify file path',
        autoFixable: false
      })
    }

    // Dependency validation
    if (target.dependencies.length > 0) {
      const missingDeps = await this.checkDependencies(target.dependencies)
      missingDeps.forEach(dep => {
        builder.addWarning({
          id: `missing-dep-${dep}`,
          type: 'dependency',
          severity: 'warning',
          description: `Missing dependency: ${dep}`,
          details: `Required dependency ${dep} may not be available`,
          suggestion: `Install ${dep}`,
          autoFixable: false
        })
      })
    }

    return builder.build()
  }

  /**
   * Executes migration for a target
   */
  async executeMigration(
    target: MigrationTarget,
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    const reportBuilder = new MigrationReportBuilder(target)

    try {
      reportBuilder
        .setStatus('in-progress')
        .setPhase('analysis')
        .addLog(options.dryRun ? 'Starting migration dry run' : 'Starting migration execution')

      // Pre-migration validation
      reportBuilder.setPhase('validation')
      const validation = await this.validate(target)
      if (!validation.isValid) {
        validation.errors.forEach(error => {
          reportBuilder.addError(error.description)
        })
        return reportBuilder
          .setStatus('failed')
          .setSuccess(false)
          .addLog('Migration failed during validation')
          .build()
      }

      // Analysis phase
      reportBuilder.setPhase('analysis')
      const analysis = await this.analyze(target)

      // Add risks to report
      analysis.risks.forEach(risk => {
        reportBuilder.addRisk({
          id: `risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          description: risk.description,
          level: risk.level,
          category: 'compatibility',
          probability: this.calculateRiskProbability(risk.level),
          impact: risk.description,
          mitigation: [risk.mitigation],
          addressed: false
        })
      })

      // Preparation phase
      reportBuilder.setPhase('preparation')
      if (options.createBackup) {
        await this.createBackup(target.testFilePath)
        reportBuilder.addLog('Backup created')
      }

      // Execution phase
      reportBuilder.setPhase('execution')
      if (options.dryRun) {
        // Simulate migration without making changes
        reportBuilder
          .setMigratedFilePath(`${target.testFilePath}.dry-run-preview`)
          .addLog('Dry run completed - no changes made')
      } else {
        const migratedPath = await this.performMigration(target, options)
        reportBuilder
          .setMigratedFilePath(migratedPath)
          .addLog('Migration completed successfully')
      }

      // Verification phase
      if (options.validateAfterMigration && !options.dryRun) {
        reportBuilder.setPhase('verification')
        // Get the migrated path from the build process
        const currentReport = reportBuilder.build()
        if (currentReport.migratedFilePath) {
          const postValidation = await this.validateMigratedFile(currentReport.migratedFilePath)
          if (!postValidation.isValid) {
            reportBuilder.addWarning('Post-migration validation found issues')
          }
        }
      }

      // Cleanup phase
      reportBuilder.setPhase('cleanup')
      await this.cleanup(target, options)

      return reportBuilder
        .setStatus('completed')
        .setSuccess(true)
        .addLog('Migration completed successfully')
        .build()

    } catch (error) {
      return reportBuilder
        .setStatus('failed')
        .setSuccess(false)
        .addError(`Migration failed: ${error}`)
        .addErrorTrace(String(error))
        .build()
    }
  }

  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      const file = Bun.file(filePath)
      return await file.exists()
    } catch {
      return false
    }
  }

  private async readFileContent(filePath: string): Promise<string> {
    try {
      const file = Bun.file(filePath)
      return await file.text()
    } catch {
      return ''
    }
  }

  private analyzeFileBasedEnforcement(content: string): {
    currentType: 'memory' | 'file-based' | 'unknown'
    enforcementRequired: boolean
    violations: string[]
  } {
    const violations: string[] = []
    let currentType: 'memory' | 'file-based' | 'unknown' = 'unknown'

    // Check for in-memory database usage
    if (content.includes(':memory:')) {
      currentType = 'memory'
      violations.push('In-memory database usage detected (:memory:)')
    }

    // Check for file-based database patterns
    if (content.includes('.sqlite') || content.includes('.db') || content.includes('/tmp/')) {
      currentType = 'file-based'
    }

    return {
      currentType,
      enforcementRequired: currentType === 'memory',
      violations
    }
  }

  private detectComplexityFactors(content: string, target: MigrationTarget): string[] {
    const factors: string[] = []

    if (target.dependencies.length > 5) {
      factors.push('High dependency count')
    }

    if (content.length > 10000) {
      factors.push('Large file size')
    }

    if (content.includes('async') && content.includes('await')) {
      factors.push('Asynchronous code patterns')
    }

    if (content.includes('database') || content.includes('sqlite')) {
      factors.push('Database integration')
    }

    if (target.testType === 'e2e') {
      factors.push('End-to-end test complexity')
    }

    return factors
  }

  private assessRisks(
    target: MigrationTarget,
    complexityFactors: string[],
    fileBasedEnforcement: any
  ): Array<{level: 'low' | 'medium' | 'high' | 'critical', description: string, mitigation: string}> {
    const risks: Array<{level: 'low' | 'medium' | 'high' | 'critical', description: string, mitigation: string}> = []

    if (fileBasedEnforcement.enforcementRequired) {
      risks.push({
        level: 'medium',
        description: 'In-memory database migration required',
        mitigation: 'Replace :memory: with file-based database path'
      })
    }

    if (complexityFactors.length > 3) {
      risks.push({
        level: 'high',
        description: 'High complexity migration',
        mitigation: 'Plan migration in phases, test thoroughly'
      })
    }

    if (target.testType === 'e2e' && complexityFactors.includes('Database integration')) {
      risks.push({
        level: 'critical',
        description: 'E2E test with database dependencies',
        mitigation: 'Implement proper test isolation and cleanup'
      })
    }

    return risks
  }

  private estimateEffort(
    target: MigrationTarget,
    complexityFactors: string[],
    risks: any[]
  ): number {
    let baseHours = 1.0

    // Adjust for complexity
    baseHours += complexityFactors.length * 0.5

    // Adjust for risks
    risks.forEach(risk => {
      switch (risk.level) {
        case 'critical': baseHours += 2.0; break
        case 'high': baseHours += 1.5; break
        case 'medium': baseHours += 1.0; break
        case 'low': baseHours += 0.5; break
      }
    })

    // Adjust for test type
    switch (target.testType) {
      case 'e2e': baseHours *= 1.5; break
      case 'integration': baseHours *= 1.2; break
      case 'unit': baseHours *= 1.0; break
    }

    return Math.round(baseHours * 10) / 10 // Round to 1 decimal
  }

  private async validateTarget(target: MigrationTarget): Promise<{isValid: boolean, errors: string[]}> {
    const errors: string[] = []

    if (!target.testFilePath) {
      errors.push('Test file path is required')
    }

    if (!target.testType) {
      errors.push('Test type is required')
    }

    if (target.complexity < 0 || target.complexity > 1) {
      errors.push('Complexity must be between 0 and 1')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  private async checkDependencies(dependencies: string[]): Promise<string[]> {
    // Simplified dependency check - in real implementation would check package.json, etc.
    return dependencies.filter(dep => {
      // For now, assume common test dependencies are available
      const commonDeps = ['bun', 'sqlite', 'jest', 'vitest', 'typescript']
      return !commonDeps.includes(dep)
    })
  }

  private async createBackup(filePath: string): Promise<void> {
    try {
      const content = await this.readFileContent(filePath)
      const backupPath = `${filePath}.backup.${Date.now()}`
      await Bun.write(backupPath, content)
    } catch (error) {
      throw new Error(`Failed to create backup: ${error}`)
    }
  }

  private async performMigration(
    target: MigrationTarget,
    options: MigrationExecutionOptions
  ): Promise<string> {
    const content = await this.readFileContent(target.testFilePath)

    // Replace in-memory database references with file-based
    let migratedContent = content

    if (options.enforceFileBased !== false) {
      migratedContent = migratedContent.replace(
        /:memory:/g,
        '/tmp/bun-graph-db-tests/test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.sqlite'
      )
    }

    // Write migrated content
    const migratedPath = options.preserveOriginal
      ? `${target.testFilePath}.migrated`
      : target.testFilePath

    await Bun.write(migratedPath, migratedContent)
    return migratedPath
  }

  private async validateMigratedFile(filePath: string): Promise<ValidationResult> {
    const builder = new ValidationResultBuilder()

    try {
      const content = await this.readFileContent(filePath)

      // Check that no :memory: references remain
      if (content.includes(':memory:')) {
        builder.addWarning({
          id: 'memory-references-remain',
          type: 'file-based',
          severity: 'warning',
          description: 'In-memory database references still present',
          details: 'Migration may not have been complete',
          suggestion: 'Review migration results',
          autoFixable: true
        })
      }

      return builder.build()
    } catch (error) {
      builder.addError({
        id: 'validation-failed',
        type: 'compatibility',
        severity: 'error',
        description: 'Failed to validate migrated file',
        details: String(error),
        suggestion: 'Check file permissions and content',
        autoFixable: false
      })
      return builder.build()
    }
  }

  private async cleanup(target: MigrationTarget, options: MigrationExecutionOptions): Promise<void> {
    // Cleanup operations would go here
    // For now, this is a placeholder
  }

  private calculateRiskProbability(level: 'low' | 'medium' | 'high' | 'critical'): number {
    switch (level) {
      case 'critical': return 0.9
      case 'high': return 0.7
      case 'medium': return 0.5
      case 'low': return 0.2
      default: return 0.5
    }
  }
}
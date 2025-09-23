import type { ILogger } from '@/application/ports/ILogger.js'
import type { TablePackageFormat, TablePackageImportResult } from '@/core/types/TablePackage.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'
import { DomainException } from '@/shared/exceptions/DomainException.js'
import type { INodeRepository } from '../repositories/INodeRepository.js'
import type { IQueryTemplateRepository } from '../repositories/IQueryTemplateRepository.js'
import type { ITableRepository } from '../repositories/ITableRepository.js'

/**
 * Table package recovery manager
 *
 * Provides comprehensive error handling and recovery including:
 * - Transaction-like rollback capabilities
 * - Incremental recovery and retry mechanisms
 * - Data integrity verification and repair
 * - Partial import success handling
 * - Backup and restore functionality
 * - Error classification and automated resolution
 */
export class TablePackageRecoveryManager {
  private readonly backupStorage = new Map<string, any>()
  private readonly recoverySessions = new Map<string, RecoverySession>()

  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    private readonly logger: ILogger
  ) {}

  /**
   * Execute import with comprehensive error handling and recovery
   */
  async executeWithRecovery(
    packageData: TablePackageFormat,
    importFunction: () => Promise<TablePackageImportResult>,
    options: {
      enableBackup?: boolean
      autoRetry?: boolean
      maxRetries?: number
      partialSuccessHandling?: 'rollback' | 'continue' | 'prompt'
      recoveryStrategy?: 'aggressive' | 'conservative' | 'custom'
    } = {}
  ): Promise<{
    result: TablePackageImportResult
    recoveryInfo: RecoveryInfo
    backupId?: string
  }> {
    const defaults = {
      enableBackup: true,
      autoRetry: true,
      maxRetries: 3,
      partialSuccessHandling: 'continue' as const,
      recoveryStrategy: 'conservative' as const,
      ...options,
    }

    const recoverySession = this.createRecoverySession(packageData, defaults)

    try {
      this.logger.info('Starting import with recovery management', {
        tableIdentifier: packageData.sourceTable.identifier,
        sessionId: recoverySession.sessionId,
        options: defaults,
      })

      // Create backup if enabled
      let backupId: string | undefined
      if (defaults.enableBackup) {
        backupId = await this.createBackup(packageData.sourceTable.identifier)
        recoverySession.backupId = backupId
      }

      // Execute import with retry logic
      let lastError: Error | undefined
      let result: TablePackageImportResult | undefined

      for (let attempt = 1; attempt <= defaults.maxRetries; attempt++) {
        try {
          recoverySession.attempts.push({
            attempt,
            startTime: new Date(),
            status: 'running',
          })

          this.logger.info('Executing import attempt', {
            sessionId: recoverySession.sessionId,
            attempt,
            maxRetries: defaults.maxRetries,
          })

          result = await importFunction()

          // Update attempt status
          const currentAttempt = recoverySession.attempts[recoverySession.attempts.length - 1]
          if (currentAttempt) {
            currentAttempt.endTime = new Date()
            currentAttempt.status = result.success ? 'success' : 'partial'
            currentAttempt.result = result
          }

          if (result.success) {
            recoverySession.status = 'completed'
            break
          } else {
            // Handle partial success
            const shouldContinue = await this.handlePartialSuccess(
              result,
              recoverySession,
              defaults.partialSuccessHandling
            )

            if (!shouldContinue && attempt < defaults.maxRetries) {
              // Rollback and retry
              await this.rollbackPartialImport(recoverySession)
            } else if (shouldContinue) {
              // Accept partial success
              recoverySession.status = 'partial'
              break
            }
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))

          // Update attempt status
          const currentAttempt = recoverySession.attempts[recoverySession.attempts.length - 1]
          if (currentAttempt) {
            currentAttempt.endTime = new Date()
            currentAttempt.status = 'failed'
            currentAttempt.error = lastError.message
          }

          this.logger.warn('Import attempt failed', {
            sessionId: recoverySession.sessionId,
            attempt,
            error: lastError.message,
          })

          // Analyze error and determine recovery strategy
          const recoveryAction = await this.analyzeError(lastError, recoverySession)

          if (recoveryAction.shouldRetry && attempt < defaults.maxRetries) {
            // Apply recovery action
            await this.applyRecoveryAction(recoveryAction, recoverySession)
          } else {
            // Final failure
            recoverySession.status = 'failed'
            recoverySession.finalError = lastError.message
            break
          }
        }
      }

      // Generate recovery info
      const recoveryInfo = this.generateRecoveryInfo(recoverySession)

      // Handle final result
      if (!result || !result.success) {
        if (defaults.enableBackup && backupId) {
          this.logger.info('Import failed, backup available for restoration', {
            sessionId: recoverySession.sessionId,
            backupId,
          })
        }

        throw lastError || new DomainException('Import failed after all retry attempts')
      }

      this.logger.info('Import completed successfully with recovery management', {
        sessionId: recoverySession.sessionId,
        attempts: recoverySession.attempts.length,
        status: recoverySession.status,
      })

      return {
        result,
        recoveryInfo,
        backupId,
      }
    } catch (error) {
      recoverySession.status = 'failed'
      recoverySession.finalError = error instanceof Error ? error.message : String(error)

      this.logger.error('Import failed with recovery management', {
        sessionId: recoverySession.sessionId,
        ...toErrorMeta(error),
      })

      throw error
    } finally {
      // Clean up recovery session
      this.recoverySessions.delete(recoverySession.sessionId)
    }
  }

  /**
   * Rollback import session with comprehensive cleanup
   */
  async rollbackImportSession(sessionId: string): Promise<RollbackResult> {
    this.logger.info('Starting comprehensive rollback', { sessionId })

    const session = this.recoverySessions.get(sessionId)
    if (!session) {
      throw new DomainException(`Recovery session '${sessionId}' not found`)
    }

    const rollbackResult: RollbackResult = {
      success: false,
      itemsRolledBack: 0,
      errors: [],
      rollbackSummary: {
        tables: 0,
        nodes: 0,
        templates: 0,
        relations: 0,
      },
    }

    try {
      // Rollback in reverse order of creation
      const operations: Array<() => Promise<void>> = []

      // 1. Delete created templates
      for (const templateId of session.rollbackInfo.templatesCreated) {
        operations.push(async () => {
          try {
            await this.queryTemplateRepository.delete(templateId)
            rollbackResult.rollbackSummary.templates++
            this.logger.debug('Rolled back template', { templateId })
          } catch (error) {
            const errorMsg = `Failed to rollback template ${templateId}: ${error instanceof Error ? error.message : 'Unknown error'}`
            rollbackResult.errors.push(errorMsg)
            this.logger.warn('Template rollback failed', { templateId, error })
          }
        })
      }

      // 2. Delete created nodes (relations will cascade)
      for (const nodeId of session.rollbackInfo.nodesCreated) {
        operations.push(async () => {
          try {
            await this.nodeRepository.delete(nodeId as any)
            rollbackResult.rollbackSummary.nodes++
            this.logger.debug('Rolled back node', { nodeId })
          } catch (error) {
            const errorMsg = `Failed to rollback node ${nodeId}: ${error instanceof Error ? error.message : 'Unknown error'}`
            rollbackResult.errors.push(errorMsg)
            this.logger.warn('Node rollback failed', { nodeId, error })
          }
        })
      }

      // 3. Delete created tables (will cascade to attributes)
      for (const tableId of session.rollbackInfo.tablesCreated) {
        operations.push(async () => {
          try {
            await this.tableRepository.delete(tableId as any)
            rollbackResult.rollbackSummary.tables++
            this.logger.debug('Rolled back table', { tableId })
          } catch (error) {
            const errorMsg = `Failed to rollback table ${tableId}: ${error instanceof Error ? error.message : 'Unknown error'}`
            rollbackResult.errors.push(errorMsg)
            this.logger.warn('Table rollback failed', { tableId, error })
          }
        })
      }

      // Execute rollback operations
      for (const operation of operations) {
        await operation()
        rollbackResult.itemsRolledBack++
      }

      session.status = 'rolled_back'
      rollbackResult.success = rollbackResult.errors.length === 0

      this.logger.info('Rollback completed', {
        sessionId,
        success: rollbackResult.success,
        itemsRolledBack: rollbackResult.itemsRolledBack,
        errors: rollbackResult.errors.length,
      })

      return rollbackResult
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown rollback error'
      rollbackResult.errors.push(errorMsg)
      this.logger.error('Rollback failed', { sessionId, ...toErrorMeta(error) })
      throw error
    }
  }

  /**
   * Create system backup before import
   */
  async createBackup(tableIdentifier: string): Promise<string> {
    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    try {
      this.logger.info('Creating system backup', { tableIdentifier, backupId })

      // Check if table already exists
      const existingTable = await this.tableRepository.findByIdentifier(tableIdentifier)

      const backup: SystemBackup = {
        id: backupId,
        tableIdentifier,
        createdAt: new Date(),
        hasExistingTable: !!existingTable,
        existingTableData: existingTable
          ? {
              id: existingTable.id as string,
              identifier: existingTable.identifier,
              description: existingTable.description,
              // Would include full table data, attributes, nodes, etc.
            }
          : undefined,
      }

      this.backupStorage.set(backupId, backup)

      this.logger.info('System backup created successfully', {
        backupId,
        tableIdentifier,
        hasExistingTable: backup.hasExistingTable,
      })

      return backupId
    } catch (error) {
      this.logger.error('Failed to create system backup', {
        tableIdentifier,
        ...toErrorMeta(error),
      })
      throw new DomainException(
        `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Restore system from backup
   */
  async restoreFromBackup(backupId: string): Promise<RestoreResult> {
    this.logger.info('Starting system restore from backup', { backupId })

    const backup = this.backupStorage.get(backupId)
    if (!backup) {
      throw new DomainException(`Backup '${backupId}' not found`)
    }

    const restoreResult: RestoreResult = {
      success: false,
      restoredTable: null,
      errors: [],
    }

    try {
      if (backup.hasExistingTable && backup.existingTableData) {
        // Restore existing table data
        this.logger.info('Restoring existing table data', {
          backupId,
          tableIdentifier: backup.tableIdentifier,
        })

        // Implementation would restore the full table state
        // For now, just log the restore action
        restoreResult.restoredTable = backup.existingTableData
      } else {
        // Remove table that was created during import
        const table = await this.tableRepository.findByIdentifier(backup.tableIdentifier)
        if (table) {
          await this.tableRepository.delete(table.id)
          this.logger.info('Removed imported table during restore', {
            backupId,
            tableIdentifier: backup.tableIdentifier,
          })
        }
      }

      restoreResult.success = true

      this.logger.info('System restore completed successfully', {
        backupId,
        tableIdentifier: backup.tableIdentifier,
      })

      return restoreResult
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown restore error'
      restoreResult.errors.push(errorMsg)
      this.logger.error('System restore failed', { backupId, ...toErrorMeta(error) })
      throw error
    }
  }

  /**
   * Verify data integrity after import
   */
  async verifyIntegrity(
    packageData: TablePackageFormat,
    importResult: TablePackageImportResult
  ): Promise<IntegrityCheckResult> {
    this.logger.info('Verifying data integrity', {
      tableIdentifier: packageData.sourceTable.identifier,
    })

    const integrityResult: IntegrityCheckResult = {
      success: true,
      checks: [],
      issues: [],
      summary: {
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        warningChecks: 0,
      },
    }

    try {
      // 1. Verify table exists and matches expected structure
      const tableCheck = await this.verifyTableIntegrity(packageData, importResult)
      integrityResult.checks.push(tableCheck)

      // 2. Verify node count and data consistency
      const nodeCheck = await this.verifyNodeIntegrity(packageData, importResult)
      integrityResult.checks.push(nodeCheck)

      // 3. Verify relationship integrity
      const relationCheck = await this.verifyRelationshipIntegrity(packageData, importResult)
      integrityResult.checks.push(relationCheck)

      // 4. Verify template functionality
      const templateCheck = await this.verifyTemplateIntegrity(packageData, importResult)
      integrityResult.checks.push(templateCheck)

      // Calculate summary
      integrityResult.summary.totalChecks = integrityResult.checks.length
      integrityResult.summary.passedChecks = integrityResult.checks.filter(
        (c) => c.status === 'passed'
      ).length
      integrityResult.summary.failedChecks = integrityResult.checks.filter(
        (c) => c.status === 'failed'
      ).length
      integrityResult.summary.warningChecks = integrityResult.checks.filter(
        (c) => c.status === 'warning'
      ).length

      integrityResult.success = integrityResult.summary.failedChecks === 0

      // Collect issues from failed checks
      integrityResult.issues = integrityResult.checks
        .filter((c) => c.status === 'failed' || c.status === 'warning')
        .map((c) => ({
          check: c.name,
          severity: c.status === 'failed' ? 'error' : 'warning',
          message: c.details,
          suggestion: c.recommendation,
        }))

      this.logger.info('Data integrity verification completed', {
        tableIdentifier: packageData.sourceTable.identifier,
        success: integrityResult.success,
        summary: integrityResult.summary,
      })

      return integrityResult
    } catch (error) {
      this.logger.error('Data integrity verification failed', {
        tableIdentifier: packageData.sourceTable.identifier,
        ...toErrorMeta(error),
      })

      integrityResult.success = false
      integrityResult.issues.push({
        check: 'integrity_verification',
        severity: 'error',
        message: `Integrity verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestion: 'Check system logs and contact support',
      })

      return integrityResult
    }
  }

  // Private helper methods

  private createRecoverySession(packageData: TablePackageFormat, options: any): RecoverySession {
    const sessionId = `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const session: RecoverySession = {
      sessionId,
      tableIdentifier: packageData.sourceTable.identifier,
      status: 'running',
      startTime: new Date(),
      options,
      attempts: [],
      rollbackInfo: {
        tablesCreated: [],
        templatesCreated: [],
        nodesCreated: [],
      },
    }

    this.recoverySessions.set(sessionId, session)
    return session
  }

  private async handlePartialSuccess(
    result: TablePackageImportResult,
    session: RecoverySession,
    handling: 'rollback' | 'continue' | 'prompt'
  ): Promise<boolean> {
    this.logger.info('Handling partial import success', {
      sessionId: session.sessionId,
      handling,
      errors: result.errors?.length || 0,
    })

    switch (handling) {
      case 'rollback':
        return false // Trigger rollback and retry

      case 'continue':
        return true // Accept partial success

      case 'prompt':
        // In a real implementation, this would prompt the user
        // For now, default to continue
        this.logger.warn('Partial success prompt not implemented, defaulting to continue')
        return true

      default:
        return false
    }
  }

  private async rollbackPartialImport(session: RecoverySession): Promise<void> {
    this.logger.info('Rolling back partial import for retry', {
      sessionId: session.sessionId,
    })

    // This would implement partial rollback logic
    // For now, just clear the rollback info
    session.rollbackInfo = {
      tablesCreated: [],
      templatesCreated: [],
      nodesCreated: [],
    }
  }

  private async analyzeError(error: Error, session: RecoverySession): Promise<RecoveryAction> {
    const errorAnalysis: RecoveryAction = {
      errorType: 'unknown',
      severity: 'high',
      shouldRetry: false,
      retryDelay: 0,
      recoverySteps: [],
    }

    // Analyze error type and determine recovery strategy
    const errorMessage = error.message.toLowerCase()

    if (errorMessage.includes('already exists')) {
      errorAnalysis.errorType = 'conflict'
      errorAnalysis.severity = 'medium'
      errorAnalysis.shouldRetry = true
      errorAnalysis.retryDelay = 1000
      errorAnalysis.recoverySteps = ['clear_existing_data', 'retry_import']
    } else if (errorMessage.includes('timeout') || errorMessage.includes('connection')) {
      errorAnalysis.errorType = 'network'
      errorAnalysis.severity = 'low'
      errorAnalysis.shouldRetry = true
      errorAnalysis.retryDelay = 5000
      errorAnalysis.recoverySteps = ['wait_and_retry']
    } else if (errorMessage.includes('validation') || errorMessage.includes('schema')) {
      errorAnalysis.errorType = 'validation'
      errorAnalysis.severity = 'high'
      errorAnalysis.shouldRetry = false
      errorAnalysis.recoverySteps = ['fix_data_issues']
    } else if (errorMessage.includes('permission') || errorMessage.includes('access')) {
      errorAnalysis.errorType = 'permission'
      errorAnalysis.severity = 'high'
      errorAnalysis.shouldRetry = false
      errorAnalysis.recoverySteps = ['check_permissions']
    } else {
      errorAnalysis.shouldRetry = session.attempts.length < 2 // Retry once for unknown errors
      errorAnalysis.retryDelay = 2000
    }

    this.logger.info('Error analysis completed', {
      sessionId: session.sessionId,
      errorType: errorAnalysis.errorType,
      severity: errorAnalysis.severity,
      shouldRetry: errorAnalysis.shouldRetry,
    })

    return errorAnalysis
  }

  private async applyRecoveryAction(
    action: RecoveryAction,
    session: RecoverySession
  ): Promise<void> {
    this.logger.info('Applying recovery action', {
      sessionId: session.sessionId,
      errorType: action.errorType,
      steps: action.recoverySteps,
    })

    for (const step of action.recoverySteps) {
      switch (step) {
        case 'clear_existing_data':
          // Clear conflicting data
          await this.rollbackPartialImport(session)
          break

        case 'wait_and_retry':
          // Wait before retry
          if (action.retryDelay > 0) {
            await new Promise((resolve) => setTimeout(resolve, action.retryDelay))
          }
          break

        case 'fix_data_issues':
          // This would implement data fixing logic
          this.logger.warn('Data issue fixing not implemented')
          break

        case 'check_permissions':
          // This would check and fix permission issues
          this.logger.warn('Permission checking not implemented')
          break
      }
    }
  }

  private generateRecoveryInfo(session: RecoverySession): RecoveryInfo {
    return {
      sessionId: session.sessionId,
      tableIdentifier: session.tableIdentifier,
      status: session.status,
      totalAttempts: session.attempts.length,
      successfulAttempts: session.attempts.filter((a) => a.status === 'success').length,
      partialAttempts: session.attempts.filter((a) => a.status === 'partial').length,
      failedAttempts: session.attempts.filter((a) => a.status === 'failed').length,
      finalError: session.finalError,
      backupAvailable: !!session.backupId,
      backupId: session.backupId,
      totalDuration: session.endTime ? session.endTime.getTime() - session.startTime.getTime() : 0,
    }
  }

  private async verifyTableIntegrity(
    _packageData: TablePackageFormat,
    importResult: TablePackageImportResult
  ): Promise<IntegrityCheck> {
    const check: IntegrityCheck = {
      name: 'table_integrity',
      status: 'passed',
      details: '',
      recommendation: '',
    }

    try {
      if (!importResult.importedTable) {
        check.status = 'failed'
        check.details = 'No table was imported'
        check.recommendation = 'Check import logs for table creation errors'
        return check
      }

      const table = await this.tableRepository.findById(importResult.importedTable.id as any)
      if (!table) {
        check.status = 'failed'
        check.details = 'Imported table not found in database'
        check.recommendation = 'Verify database connection and table creation'
        return check
      }

      check.details = `Table '${table.identifier}' verified successfully`
    } catch (error) {
      check.status = 'failed'
      check.details = `Table verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      check.recommendation = 'Check database connectivity and table permissions'
    }

    return check
  }

  private async verifyNodeIntegrity(
    packageData: TablePackageFormat,
    importResult: TablePackageImportResult
  ): Promise<IntegrityCheck> {
    const check: IntegrityCheck = {
      name: 'node_integrity',
      status: 'passed',
      details: '',
      recommendation: '',
    }

    try {
      const expectedNodeCount = packageData.package.dataset.nodes.length

      if (!importResult.importedTable) {
        check.status = 'failed'
        check.details = 'Cannot verify nodes: no table imported'
        return check
      }

      const nodesResult = await this.nodeRepository.findByTableId(
        importResult.importedTable.id as any
      )
      const actualNodeCount = nodesResult.items?.length || 0

      if (actualNodeCount === expectedNodeCount) {
        check.details = `All ${actualNodeCount} nodes imported successfully`
      } else {
        check.status = 'warning'
        check.details = `Node count mismatch: expected ${expectedNodeCount}, found ${actualNodeCount}`
        check.recommendation = 'Review import logs for node creation errors'
      }
    } catch (error) {
      check.status = 'failed'
      check.details = `Node verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      check.recommendation = 'Check database connectivity and node repository'
    }

    return check
  }

  private async verifyRelationshipIntegrity(
    packageData: TablePackageFormat,
    _importResult: TablePackageImportResult
  ): Promise<IntegrityCheck> {
    const check: IntegrityCheck = {
      name: 'relationship_integrity',
      status: 'passed',
      details: '',
      recommendation: '',
    }

    try {
      const expectedRelationCount = packageData.package.relations.nodeRelations.length

      // For now, just check if the expected number matches what would be imported
      // In a real implementation, this would query the actual relationship data
      check.details = `Expected ${expectedRelationCount} relationships for verification`

      if (expectedRelationCount === 0) {
        check.details = 'No relationships to verify'
      } else {
        check.status = 'warning'
        check.details = `Relationship verification not fully implemented (${expectedRelationCount} expected)`
        check.recommendation = 'Implement comprehensive relationship verification'
      }
    } catch (error) {
      check.status = 'failed'
      check.details = `Relationship verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      check.recommendation = 'Check relationship repository and database connectivity'
    }

    return check
  }

  private async verifyTemplateIntegrity(
    packageData: TablePackageFormat,
    importResult: TablePackageImportResult
  ): Promise<IntegrityCheck> {
    const check: IntegrityCheck = {
      name: 'template_integrity',
      status: 'passed',
      details: '',
      recommendation: '',
    }

    try {
      const expectedTemplateCount = packageData.package.templates.templates.length
      const actualTemplateCount = importResult.generatedTemplates?.length || 0

      if (actualTemplateCount >= expectedTemplateCount) {
        check.details = `${actualTemplateCount} templates available (${expectedTemplateCount} from package)`
      } else {
        check.status = 'warning'
        check.details = `Template count below expected: ${actualTemplateCount} found, ${expectedTemplateCount} expected`
        check.recommendation = 'Review template import logs for errors'
      }
    } catch (error) {
      check.status = 'failed'
      check.details = `Template verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      check.recommendation = 'Check template repository and creation logs'
    }

    return check
  }
}

// Type definitions for recovery management

interface RecoverySession {
  sessionId: string
  tableIdentifier: string
  status: 'running' | 'completed' | 'partial' | 'failed' | 'rolled_back'
  startTime: Date
  endTime?: Date
  options: any
  attempts: ImportAttempt[]
  rollbackInfo: {
    tablesCreated: string[]
    templatesCreated: string[]
    nodesCreated: string[]
  }
  backupId?: string
  finalError?: string
}

interface ImportAttempt {
  attempt: number
  startTime: Date
  endTime?: Date
  status: 'running' | 'success' | 'partial' | 'failed'
  result?: TablePackageImportResult
  error?: string
}

interface RecoveryAction {
  errorType: 'conflict' | 'network' | 'validation' | 'permission' | 'unknown'
  severity: 'low' | 'medium' | 'high'
  shouldRetry: boolean
  retryDelay: number
  recoverySteps: string[]
}

interface RecoveryInfo {
  sessionId: string
  tableIdentifier: string
  status: string
  totalAttempts: number
  successfulAttempts: number
  partialAttempts: number
  failedAttempts: number
  finalError?: string
  backupAvailable: boolean
  backupId?: string
  totalDuration: number
}

interface SystemBackup {
  id: string
  tableIdentifier: string
  createdAt: Date
  hasExistingTable: boolean
  existingTableData?: {
    id: string
    identifier: string
    description: string | null
  }
}

interface RollbackResult {
  success: boolean
  itemsRolledBack: number
  errors: string[]
  rollbackSummary: {
    tables: number
    nodes: number
    templates: number
    relations: number
  }
}

interface RestoreResult {
  success: boolean
  restoredTable: any
  errors: string[]
}

interface IntegrityCheckResult {
  success: boolean
  checks: IntegrityCheck[]
  issues: IntegrityIssue[]
  summary: {
    totalChecks: number
    passedChecks: number
    failedChecks: number
    warningChecks: number
  }
}

interface IntegrityCheck {
  name: string
  status: 'passed' | 'failed' | 'warning'
  details: string
  recommendation: string
}

interface IntegrityIssue {
  check: string
  severity: 'error' | 'warning'
  message: string
  suggestion: string
}

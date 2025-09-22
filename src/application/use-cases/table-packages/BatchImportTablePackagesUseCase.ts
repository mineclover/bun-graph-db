import type { ILogger } from '@/application/ports/ILogger.js'
import type {
  ImportSession,
  TablePackageFormat,
  TablePackageImportOptions,
  TablePackageImportResult,
} from '@/core/types/TablePackage.js'
import type { ITablePackageService } from '@/domain/services/ITablePackageService.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.ts'

export interface BatchImportRequest {
  packages: TablePackageFormat[]
  options?: TablePackageImportOptions
  createSession?: boolean // Whether to create a tracking session
}

export interface BatchImportResponse {
  success: boolean
  results: TablePackageImportResult[]
  session?: ImportSession
  summary: {
    total: number
    succeeded: number
    failed: number
    skipped: number
  }
  error?: string
}

export class BatchImportTablePackagesUseCase {
  constructor(
    private readonly tablePackageService: ITablePackageService,
    private readonly logger: ILogger
  ) {}

  async execute(request: BatchImportRequest): Promise<BatchImportResponse> {
    try {
      this.logger.info('Executing batch table package import', {
        packagesCount: request.packages.length,
        createSession: request.createSession,
        options: request.options,
      })

      // Validate input
      if (!request.packages || request.packages.length === 0) {
        return {
          success: false,
          results: [],
          summary: { total: 0, succeeded: 0, failed: 0, skipped: 0 },
          error: 'No packages provided for import',
        }
      }

      // Set default options
      const options: TablePackageImportOptions = {
        conflictResolution: 'skip',
        importData: true,
        importRelations: true,
        importTemplates: true,
        preserveStatistics: true,
        validateIntegrity: true,
        generateTemplates: true,
        ...request.options,
      }

      // Create session if requested
      let session: ImportSession | undefined
      if (request.createSession) {
        session = await this.tablePackageService.createImportSession(request.packages)
        this.logger.info('Created import session', { sessionId: session.sessionId })
      }

      try {
        // Resolve import order based on dependencies
        const tableIdentifiers = request.packages.map((p) => p.sourceTable.identifier)
        const importOrder = await this.tablePackageService.resolveImportOrder(tableIdentifiers)

        this.logger.info('Resolved import order', {
          original: tableIdentifiers,
          resolved: importOrder,
        })

        // Execute imports in dependency order
        const results: TablePackageImportResult[] = []
        let succeeded = 0
        let failed = 0
        let skipped = 0

        for (const identifier of importOrder) {
          const packageData = request.packages.find((p) => p.sourceTable.identifier === identifier)
          if (!packageData) {
            this.logger.warn('Package not found for identifier', { identifier })
            continue
          }

          try {
            this.logger.info('Importing package', { identifier })

            const result = await this.tablePackageService.importTablePackage(packageData, options)
            results.push(result)

            if (result.success) {
              succeeded++
              this.logger.info('Package import succeeded', {
                identifier,
                resolvedIdentifier: result.importedTable?.identifier,
                templatesGenerated: result.generatedTemplates?.length || 0,
              })

              // Update session if exists
              if (session) {
                session.packagesImported.push(identifier)
                session.packagesRemaining = session.packagesRemaining.filter(
                  (id) => id !== identifier
                )

                if (result.importedTable?.id) {
                  session.rollbackInfo.tablesCreated.push(result.importedTable.id)
                }
                if (result.generatedTemplates) {
                  session.rollbackInfo.templatesCreated.push(
                    ...result.generatedTemplates.map((t) => t.id).filter(Boolean)
                  )
                }
              }
            } else {
              failed++
              this.logger.warn('Package import failed', {
                identifier,
                errors: result.errors,
              })

              // Update session with errors
              if (session) {
                session.errors.push(`${identifier}: ${result.errors.join(', ')}`)
              }

              // Decide whether to continue or stop based on conflict resolution strategy
              if (
                options.conflictResolution === 'skip' &&
                result.errors.some((e) => e.includes('already exists'))
              ) {
                skipped++
                this.logger.info('Skipping remaining packages due to conflicts')
                break
              }
            }
          } catch (error) {
            failed++
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'

            this.logger.error('Package import error', { identifier, ...toErrorMeta(error) })

            results.push({
              success: false,
              errors: [errorMessage],
              warnings: [],
            })

            if (session) {
              session.errors.push(`${identifier}: ${errorMessage}`)
            }

            // Stop on critical errors
            if (options.conflictResolution !== 'skip') {
              this.logger.error('Stopping batch import due to critical error')
              break
            }
          }
        }

        // Update session status
        if (session) {
          session.status = failed > 0 ? 'failed' : 'completed'
          session.completedAt = new Date()

          this.logger.info('Updated session status', {
            sessionId: session.sessionId,
            status: session.status,
            succeeded,
            failed,
          })
        }

        const summary = {
          total: request.packages.length,
          succeeded,
          failed,
          skipped,
        }

        this.logger.info('Batch import completed', summary)

        return {
          success: failed === 0,
          results,
          session,
          summary,
        }
      } catch (error) {
        // Mark session as failed if it exists
        if (session) {
          session.status = 'failed'
          session.completedAt = new Date()
          session.errors.push(error instanceof Error ? error.message : 'Unknown batch import error')
        }

        throw error
      }
    } catch (error) {
      this.logger.error('Batch import use case failed', {
        packagesCount: request.packages.length,
        ...toErrorMeta(error),
      })

      return {
        success: false,
        results: [],
        summary: {
          total: request.packages.length,
          succeeded: 0,
          failed: request.packages.length,
          skipped: 0,
        },
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }
}

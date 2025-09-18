import type { ITablePackageService } from '@/domain/services/ITablePackageService.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type {
  TablePackageFormat,
  TablePackageImportOptions,
  TablePackageImportResult,
} from '@/core/types/TablePackage.js'

export interface ImportTablePackageRequest {
  packageData?: TablePackageFormat
  packagePath?: string // Alternative: import from file system
  options?: TablePackageImportOptions
}

export interface ImportTablePackageResponse {
  success: boolean
  result?: TablePackageImportResult
  error?: string
}

export class ImportTablePackageUseCase {
  constructor(
    private readonly tablePackageService: ITablePackageService,
    private readonly logger: ILogger
  ) {}

  async execute(request: ImportTablePackageRequest): Promise<ImportTablePackageResponse> {
    try {
      this.logger.info('Executing table package import', {
        hasPackageData: !!request.packageData,
        packagePath: request.packagePath,
        options: request.options,
      })

      // Validate input - must have either packageData or packagePath
      if (!request.packageData && !request.packagePath) {
        return {
          success: false,
          error: 'Either packageData or packagePath is required',
        }
      }

      // Load package data if path provided
      let packageData = request.packageData
      if (!packageData && request.packagePath) {
        packageData = await this.loadPackageFromFile(request.packagePath)
      }

      if (!packageData) {
        return {
          success: false,
          error: 'Failed to load package data',
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

      // Validate package before import
      const conflicts = await this.tablePackageService.validatePackage(packageData, options)
      const errors = conflicts.filter(c => c.severity === 'error')

      if (errors.length > 0 && options.conflictResolution === 'skip') {
        this.logger.warn('Table package import validation failed', {
          tableIdentifier: packageData.sourceTable.identifier,
          errors: errors.map(e => e.message),
        })

        return {
          success: false,
          error: `Validation failed: ${errors[0]?.message || 'Unknown validation error'}`,
        }
      }

      // Execute import
      const result = await this.tablePackageService.importTablePackage(packageData, options)

      if (!result.success) {
        this.logger.warn('Table package import failed', {
          tableIdentifier: packageData.sourceTable.identifier,
          errors: result.errors,
        })

        return {
          success: false,
          result,
          error: result.errors[0] || 'Import failed',
        }
      }

      this.logger.info('Table package import completed successfully', {
        originalIdentifier: packageData.sourceTable.identifier,
        resolvedIdentifier: result.importedTable?.identifier,
        templatesGenerated: result.generatedTemplates?.length || 0,
        conflictsResolved: result.resolvedConflicts?.length || 0,
      })

      return {
        success: true,
        result,
      }
    } catch (error) {
      this.logger.error('Table package import use case failed', {
        packagePath: request.packagePath,
        error,
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  private async loadPackageFromFile(packagePath: string): Promise<TablePackageFormat | undefined> {
    try {
      const fs = await import('node:fs/promises')
      const content = await fs.readFile(packagePath, 'utf8')
      return JSON.parse(content) as TablePackageFormat
    } catch (error) {
      this.logger.error('Failed to load package from file', { packagePath, error })
      return undefined
    }
  }
}
import type { ILogger } from '@/application/ports/ILogger.js'
import type { TablePackageExportOptions, TablePackageExportResult } from '@/core/types/TablePackage.js'
import type { ITablePackageService } from '@/domain/services/ITablePackageService.js'

export interface ExportTablePackageRequest {
  tableIdentifier: string
  options?: TablePackageExportOptions
  outputPath?: string // Optional file system path for export
}

export interface ExportTablePackageResponse {
  success: boolean
  result?: TablePackageExportResult
  exportPath?: string
  error?: string
}

export class ExportTablePackageUseCase {
  constructor(
    private readonly tablePackageService: ITablePackageService,
    private readonly logger: ILogger,
  ) {}

  async execute(request: ExportTablePackageRequest): Promise<ExportTablePackageResponse> {
    try {
      this.logger.info('Executing table package export', {
        tableIdentifier: request.tableIdentifier,
        options: request.options,
      })

      // Validate input
      if (!request.tableIdentifier || request.tableIdentifier.trim() === '') {
        return {
          success: false,
          error: 'Table identifier is required',
        }
      }

      // Set default options
      const options: TablePackageExportOptions = {
        includeData: true,
        includeRelations: true,
        includeTemplates: true,
        includeStatistics: false,
        resolveDependencies: true,
        prettyPrint: true,
        ...request.options,
      }

      // Execute export
      const result = await this.tablePackageService.exportTable(request.tableIdentifier, options)

      if (!result.success) {
        this.logger.warn('Table package export failed', {
          tableIdentifier: request.tableIdentifier,
          errors: result.errors,
        })

        return {
          success: false,
          result,
          error: result.errors[0] || 'Export failed',
        }
      }

      // Optionally write to file system
      let exportPath: string | undefined
      if (request.outputPath && result.tablePackage) {
        exportPath = await this.writePackageToFile(result.tablePackage, request.outputPath, options.prettyPrint)
      }

      this.logger.info('Table package export completed successfully', {
        tableIdentifier: request.tableIdentifier,
        exportPath,
        nodesCount: result.tablePackage?.package.dataset.nodes.length || 0,
        templatesCount: result.tablePackage?.package.templates.templates.length || 0,
      })

      return {
        success: true,
        result,
        exportPath,
      }
    } catch (error) {
      this.logger.error('Table package export use case failed', {
        tableIdentifier: request.tableIdentifier,
        error,
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  private async writePackageToFile(packageData: any, outputPath: string, prettyPrint?: boolean): Promise<string> {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')

    // Ensure directory exists
    const dir = path.dirname(outputPath)
    await fs.mkdir(dir, { recursive: true })

    // Write package to file
    const content = prettyPrint ? JSON.stringify(packageData, null, 2) : JSON.stringify(packageData)

    await fs.writeFile(outputPath, content, 'utf8')

    return outputPath
  }
}

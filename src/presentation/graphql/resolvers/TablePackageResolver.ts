import type { ILogger } from '@/application/ports/ILogger.js'
import { ExportTablePackageUseCase } from '@/application/use-cases/table-packages/ExportTablePackageUseCase.js'
import type { ITablePackageService } from '@/domain/services/ITablePackageService.js'
import { BaseResolver } from '../base/BaseResolver.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'

export class TablePackageResolver extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly tablePackageService: ITablePackageService,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  // Query Resolvers

  async exportTablePackage(_: any, args: any): Promise<any> {
    return this.handleQuery(async () => {
      const useCase = new ExportTablePackageUseCase(this.tablePackageService, this.logger)

      const response = await useCase.execute({
        tableIdentifier: args.input.tableIdentifier,
        options: args.input.options || {},
      })

      if (!response.success) {
        return {
          success: false,
          tablePackage: null,
          dependencyOrder: [],
          packagePath: null,
          errors: [response.error || 'Export failed'],
          warnings: [],
        }
      }

      return {
        success: true,
        tablePackage: response.result?.tablePackage
          ? this.mapTablePackageFormat(response.result.tablePackage)
          : null,
        dependencyOrder: response.result?.dependencyOrder || [],
        packagePath: response.exportPath || null,
        errors: response.result?.errors || [],
        warnings: response.result?.warnings || [],
      }
    }, 'exportTablePackage')
  }

  async exportRelatedTablePackages(_: any, args: any): Promise<any> {
    return this.handleQuery(async () => {
      const results = await this.tablePackageService.exportRelatedTables(
        args.tableIdentifiers,
        args.options || {}
      )

      return results.map((result) => ({
        success: result.success,
        tablePackage: result.tablePackage ? this.mapTablePackageFormat(result.tablePackage) : null,
        dependencyOrder: result.dependencyOrder || [],
        packagePath: result.packagePath || null,
        errors: result.errors ?? [],
        warnings: result.warnings ?? [],
      }))
    }, 'exportRelatedTablePackages')
  }

  async analyzeTableDependencies(_: any, args: any): Promise<any> {
    return this.handleQuery(async () => {
      const results = []
      for (const tableIdentifier of args.tableIdentifiers) {
        const result = await this.tablePackageService.analyzeDependencies(tableIdentifier)
        results.push(result)
      }
      return results
    }, 'operation-name')
  }

  async resolveImportOrder(_: any, args: any): Promise<any> {
    return this.handleQuery(async () => {
      return await this.tablePackageService.resolveImportOrder(args.tableIdentifiers)
    }, 'operation-name')
  }

  async validateTablePackage(_: any, args: any): Promise<any> {
    return this.handleQuery(async () => {
      const packageData = this.mapTablePackageInput(args.packageData)
      const options = args.options
        ? this.mapImportOptions(args.options)
        : { conflictResolution: 'skip' }

      const conflicts = await this.tablePackageService.validatePackage(packageData, options)
      return conflicts.map(this.mapPackageConflict)
    }, 'operation-name')
  }

  async getImportSession(_: any, args: any): Promise<any> {
    return this.handleQuery(async () => {
      const session = await this.tablePackageService.getImportSession(args.sessionId)
      return session ? this.mapImportSession(session) : null
    }, 'operation-name')
  }

  async listImportSessions(_: any, _args: any): Promise<any> {
    return this.handleQuery(async () => {
      // This would require a method to list all sessions
      // For now, return empty array
      return []
    }, 'operation-name')
  }

  async previewGeneratedTemplates(_: any, args: any): Promise<any> {
    return this.handleQuery(async () => {
      const result = await this.tablePackageService.generateTableTemplates(
        args.tableIdentifier,
        args.options || {}
      )

      return {
        success: result.success,
        templates: result.templates.map((t) => ({
          id: '', // Will be set after creation
          identifier: t.identifier,
          name: t.name,
          operationType: t.operationType,
        })),
        errors: result.errors,
      }
    }, 'operation-name')
  }

  // Mutation Resolvers

  async importTablePackage(_: any, args: any): Promise<any> {
    try {
      const packageData = this.mapTablePackageInput(args.input.packageData)
      const options = args.input.options
        ? this.mapImportOptions(args.input.options)
        : { conflictResolution: 'skip' }

      const result = await this.tablePackageService.importTablePackage(packageData, options)

      // Debug logging to understand what's being returned
      this.logger.info('Import result details', {
        success: result.success,
        importedTable: result.importedTable,
        importedTableType: typeof result.importedTable,
        importedTableId: result.importedTable?.id,
        importedTableIdType: typeof result.importedTable?.id,
      })

      return {
        success: result.success,
        importedTable: result.success ? result.importedTable : null,
        generatedTemplates: result.generatedTemplates || [],
        resolvedConflicts: result.resolvedConflicts?.map(this.mapResolvedConflict) || [],
        errors: result.errors ?? [],
        warnings: result.warnings ?? [],
      }
    } catch (error) {
      this.logger.error(`Import table package failed`, toErrorMeta(error))
      return {
        success: false,
        importedTable: null,
        generatedTemplates: [],
        resolvedConflicts: [],
        errors: [error instanceof Error ? error.message : 'Unknown import error'],
        warnings: [],
      }
    }
  }

  async importTablePackages(_: any, args: any): Promise<any> {
    return this.handleMutation(async () => {
      const packages = args.packages.map((pkg: any) => this.mapTablePackageInput(pkg))
      const options = args.options
        ? this.mapImportOptions(args.options)
        : { conflictResolution: 'skip' }

      const results = await this.tablePackageService.importTablePackages(packages, options)

      return results.map((result) => ({
        success: result.success,
        importedTable: result.importedTable,
        generatedTemplates: result.generatedTemplates || [],
        resolvedConflicts: result.resolvedConflicts?.map(this.mapResolvedConflict) || [],
        errors: result.errors ?? [],
        warnings: result.warnings ?? [],
      }))
    }, 'importTablePackages')
  }

  async batchExportTablePackages(_: any, args: any): Promise<any> {
    return this.handleMutation(async () => {
      const results = await this.tablePackageService.exportRelatedTables(
        args.input.tableIdentifiers,
        args.input.options || {}
      )

      let exportedCount = 0
      let failedCount = 0
      const mappedResults = results.map((result) => {
        if (result.success) {
          exportedCount++
        } else {
          failedCount++
        }

        return {
          success: result.success,
          tablePackage: result.tablePackage
            ? this.mapTablePackageFormat(result.tablePackage)
            : null,
          dependencyOrder: result.dependencyOrder || [],
          packagePath: result.packagePath || null,
          errors: result.errors ?? [],
          warnings: result.warnings ?? [],
        }
      })

      return {
        success: failedCount === 0,
        results: mappedResults,
        exportedCount,
        failedCount,
        outputDirectory: args.input.outputDirectory || null,
        errors: results.flatMap((r) => r.errors || []),
      }
    }, 'operation-name')
  }

  async batchImportTablePackages(_: any, args: any): Promise<any> {
    try {
      const packages = args.input.packages.map((pkg: any) => this.mapTablePackageInput(pkg))
      const options = args.input.options
        ? this.mapImportOptions(args.input.options)
        : { conflictResolution: 'skip' }

      // Create session if requested
      let session = null
      if (args.input.createSession) {
        session = await this.tablePackageService.createImportSession(packages)
      }

      const results = await this.tablePackageService.importTablePackages(packages, options)

      let importedCount = 0
      let failedCount = 0
      results.forEach((result) => {
        if (result.success) {
          importedCount++
        } else {
          failedCount++
        }
      })

      return {
        success: failedCount === 0,
        results: results.map((result, index) => ({
          packageIdentifier: packages[index]?.sourceTable?.identifier || `package-${index}`,
          success: result.success,
          importedTable: result.importedTable,
          generatedTemplates: result.generatedTemplates || [],
          resolvedConflicts: result.resolvedConflicts?.map(this.mapResolvedConflict) || [],
          errors: result.errors ?? [],
          warnings: result.warnings ?? [],
        })),
        summary: {
          total: results.length,
          succeeded: importedCount,
          failed: failedCount,
          skipped: 0,
        },
        importedCount,
        failedCount,
        session: session ? this.mapImportSession(session) : null,
        errors: results.flatMap((r) => r.errors ?? []),
      }
    } catch (error) {
      this.logger.error(`Batch import table packages failed`, toErrorMeta(error))
      return {
        success: false,
        results: [],
        summary: {
          total: 0,
          succeeded: 0,
          failed: 1,
          skipped: 0,
        },
        importedCount: 0,
        failedCount: 1,
        session: null,
        errors: [error instanceof Error ? error.message : 'Unknown batch import error'],
      }
    }
  }

  async createImportSession(_: any, args: any): Promise<any> {
    return this.handleMutation(async () => {
      const packages = args.packages.map((pkg: any) => this.mapTablePackageInput(pkg))
      const session = await this.tablePackageService.createImportSession(packages)

      return this.mapImportSession(session)
    }, 'operation-name')
  }

  async rollbackImportSession(_: any, args: any): Promise<any> {
    return this.handleMutation(async () => {
      await this.tablePackageService.rollbackImportSession(args.sessionId)
      const session = await this.tablePackageService.getImportSession(args.sessionId)

      return session ? this.mapImportSession(session) : null
    }, 'operation-name')
  }

  async generateTableTemplates(_: any, args: any): Promise<any> {
    return this.handleMutation(async () => {
      const result = await this.tablePackageService.generateTableTemplates(
        args.tableIdentifier,
        args.options || {}
      )

      return {
        success: result.success,
        templates: result.templates.map((t) => ({
          id: '', // Will be set after creation
          identifier: t.identifier,
          name: t.name,
          operationType: t.operationType,
        })),
        errors: result.errors,
      }
    }, 'operation-name')
  }

  async exportTablePackageToFile(_: any, args: any): Promise<any> {
    return this.handleMutation(async () => {
      const useCase = new ExportTablePackageUseCase(this.tablePackageService, this.logger)

      const response = await useCase.execute({
        tableIdentifier: args.tableIdentifier,
        options: args.options || {},
        outputPath: args.outputPath,
      })

      if (!response.success) {
        return {
          success: false,
          tablePackage: null,
          dependencyOrder: [],
          packagePath: null,
          errors: [response.error || 'Export failed'],
          warnings: [],
        }
      }

      return {
        success: true,
        tablePackage: response.result?.tablePackage
          ? this.mapTablePackageFormat(response.result.tablePackage)
          : null,
        dependencyOrder: response.result?.dependencyOrder || [],
        packagePath: response.exportPath || null,
        errors: response.result?.errors || [],
        warnings: response.result?.warnings || [],
      }
    }, 'operation-name')
  }

  async importTablePackageFromFile(_: any, args: any): Promise<any> {
    return this.handleMutation(async () => {
      const fs = await import('node:fs/promises')

      try {
        // Read the package file
        const fileContent = await fs.readFile(args.filePath, 'utf8')
        const packageData = JSON.parse(fileContent)

        const options = args.options
          ? this.mapImportOptions(args.options)
          : { conflictResolution: 'skip' }
        const result = await this.tablePackageService.importTablePackage(packageData, options)

        return {
          success: result.success,
          importedTable: result.importedTable,
          generatedTemplates: result.generatedTemplates || [],
          resolvedConflicts: result.resolvedConflicts?.map(this.mapResolvedConflict) || [],
          errors: result.errors ?? [],
          warnings: result.warnings ?? [],
        }
      } catch (error) {
        return {
          success: false,
          importedTable: null,
          generatedTemplates: [],
          resolvedConflicts: [],
          errors: [error instanceof Error ? error.message : 'Failed to read package file'],
          warnings: [],
        }
      }
    }, 'operation-name')
  }

  // Helper mapping methods

  private mapTablePackageFormat(packageData: any): any {
    return {
      version: packageData.version,
      exportedAt: packageData.exportedAt,
      sourceTable: packageData.sourceTable,
      dependencies: packageData.dependencies,
      package: {
        schema: packageData.package.schema,
        dataset: packageData.package.dataset,
        relations: packageData.package.relations,
        templates: packageData.package.templates,
      },
    }
  }

  private mapTablePackageInput(input: any): any {
    return {
      version: input.version,
      exportedAt: input.exportedAt,
      sourceTable: input.sourceTable,
      dependencies: input.dependencies,
      package: {
        schema: input.package.schema,
        dataset: input.package.dataset,
        relations: input.package.relations,
        templates: input.package.templates,
      },
    }
  }

  private mapImportOptions(options: any): any {
    return {
      conflictResolution: options.conflictResolution?.toLowerCase() || 'skip',
      importData: options.importData,
      importRelations: options.importRelations,
      importTemplates: options.importTemplates,
      preserveStatistics: options.preserveStatistics,
      validateIntegrity: options.validateIntegrity,
      generateTemplates: options.generateTemplates,
      newTablePrefix: options.newTablePrefix,
    }
  }

  private mapResolvedConflict(conflict: any): any {
    return {
      type: conflict.type?.toUpperCase() || 'TABLE',
      originalName: conflict.originalName,
      resolvedName: conflict.resolvedName,
      action: conflict.action?.toUpperCase() || 'SKIPPED',
    }
  }

  private mapImportSession(session: any): any {
    return {
      sessionId: session.sessionId,
      status: session.status?.toUpperCase() || 'PENDING',
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() || null,
      packagesImported: session.packagesImported,
      packagesRemaining: session.packagesRemaining,
      rollbackInfo: session.rollbackInfo,
      errors: session.errors,
    }
  }

  private mapPackageConflict(conflict: any): any {
    return {
      type: conflict.type?.toUpperCase() || 'TABLE_EXISTS',
      severity: conflict.severity?.toUpperCase() || 'ERROR',
      message: conflict.message,
      context: conflict.context,
      suggestedResolution: conflict.suggestedResolution,
    }
  }
}

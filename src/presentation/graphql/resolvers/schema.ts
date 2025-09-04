import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { SchemaExportUseCase } from '@/application/use-cases/export/SchemaExportUseCase.js'
import type { SchemaImportUseCase } from '@/application/use-cases/import/SchemaImportUseCase.js'

interface SchemaResolverDependencies {
  tableRepository: ITableRepository
  schemaExportUseCase: SchemaExportUseCase
  schemaImportUseCase: SchemaImportUseCase
  logger: ILogger
}

export function createSchemaResolvers(dependencies: SchemaResolverDependencies) {
  const { tableRepository, schemaExportUseCase, schemaImportUseCase, logger } = dependencies

  return {
    Query: {
      exportTable: async (_: any, args: { tableId: string, options?: any }) => {
        try {
          const { tableId, options = {} } = args
          return await schemaExportUseCase.exportTable(tableId, options)
        } catch (error) {
          logger.error('Failed to export table', { tableId: args.tableId, error })
          throw error
        }
      },

      exportAllTables: async (_: any, args: { options?: any }) => {
        try {
          const { options = {} } = args
          return await schemaExportUseCase.exportAllTables(options)
        } catch (error) {
          logger.error('Failed to export all tables', { error })
          throw error
        }
      }
    },

    Mutation: {
      importSchema: async (_: any, args: { exportData: any, options?: any }) => {
        try {
          const { exportData, options = {} } = args
          return await schemaImportUseCase.importSchema(exportData, options)
        } catch (error) {
          logger.error('Failed to import schema', { error })
          throw error
        }
      }
    }
  }
}
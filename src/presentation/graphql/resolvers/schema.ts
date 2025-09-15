import type { ILogger } from '@/application/ports/ILogger.js'
import type { SchemaExportUseCase } from '@/application/use-cases/export/SchemaExportUseCase.js'
import type { SchemaImportUseCase } from '@/application/use-cases/import/SchemaImportUseCase.js'
import type {
  ExportAllTablesArgs,
  ExportTableArgs,
  GraphQLParent,
  ImportSchemaArgs,
} from '@/core/types/GraphQLTypes.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'

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
      exportTable: async (_: GraphQLParent, args: ExportTableArgs) => {
        try {
          const { tableId, options = {} } = args
          const exportOptions = {
            includeData: options.includeData,
            includeRelations: options.includeRelations,
            compression: options.compression,
            format:
              options.format === 'json' || options.format === 'yaml'
                ? (options.format as 'json' | 'yaml')
                : undefined,
          }
          return await schemaExportUseCase.exportTable(tableId, exportOptions)
        } catch (error) {
          logger.error('Failed to export table', { tableId: args.tableId, error })
          throw error
        }
      },

      exportAllTables: async (_: GraphQLParent, args: ExportAllTablesArgs) => {
        try {
          const { options = {} } = args
          const exportOptions = {
            includeData: options.includeData,
            includeRelations: options.includeRelations,
            compression: options.compression,
            format:
              options.format === 'json' || options.format === 'yaml'
                ? (options.format as 'json' | 'yaml')
                : undefined,
          }
          return await schemaExportUseCase.exportAllTables(exportOptions)
        } catch (error) {
          logger.error('Failed to export all tables', { error })
          throw error
        }
      },
    },

    Mutation: {
      importSchema: async (_: GraphQLParent, args: ImportSchemaArgs) => {
        try {
          const { exportData, options = {} } = args
          const importOptions = {
            ...options,
            conflictResolution: ['skip', 'overwrite', 'merge', 'fail'].includes(
              options.conflictResolution as string
            )
              ? (options.conflictResolution as 'skip' | 'overwrite' | 'merge' | 'fail')
              : undefined,
          }
          return await schemaImportUseCase.importSchema(exportData, importOptions)
        } catch (error) {
          logger.error('Failed to import schema', { error })
          throw error
        }
      },
    },
  }
}

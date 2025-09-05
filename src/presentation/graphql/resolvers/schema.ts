import type { ILogger } from '@/application/ports/ILogger.js'
import type { SchemaExportUseCase } from '@/application/use-cases/export/SchemaExportUseCase.js'
import type { SchemaImportUseCase } from '@/application/use-cases/import/SchemaImportUseCase.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type {
  ExportAllTablesArgs,
  ExportTableArgs,
  GraphQLParent,
  ImportSchemaArgs,
} from '../types/GraphQLTypes.js'

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
          return await schemaExportUseCase.exportTable(tableId, options)
        } catch (error) {
          logger.error('Failed to export table', { tableId: args.tableId, error })
          throw error
        }
      },

      exportAllTables: async (_: GraphQLParent, args: ExportAllTablesArgs) => {
        try {
          const { options = {} } = args
          return await schemaExportUseCase.exportAllTables(options)
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
          return await schemaImportUseCase.importSchema(exportData, options)
        } catch (error) {
          logger.error('Failed to import schema', { error })
          throw error
        }
      },
    },
  }
}

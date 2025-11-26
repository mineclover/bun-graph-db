import type { IResolvers } from '@graphql-tools/utils'
import type { GraphQLContext } from '@/core/types/GraphQLTypes.js'
import type { ExportMutations } from '@/presentation/graphql/mutations/ExportMutations.js'

export function createExportResolvers(
  exportMutations: ExportMutations
): IResolvers<any, GraphQLContext> {
  return {
    Query: {
      getSupportedExportFormats: () => exportMutations.getSupportedExportFormats(),
      validateExportOptions: (parent, args, context) =>
        exportMutations.validateExportOptions(parent, args, context),
      getExportHistory: (parent, args, context) =>
        exportMutations.getExportHistory(parent, args, context),
    },

    Mutation: {
      exportTableNodes: (parent, args, context) =>
        exportMutations.exportTableNodes(parent, args, context),
      exportMultipleTables: (parent, args, context) =>
        exportMutations.exportMultipleTables(parent, args, context),
    },

    Table: {
      exportNodes: async (parent, args, context) => {
        // Transform args to include tableId from parent
        const input = {
          ...args.input,
          tableId: parent.id,
        }
        return exportMutations.exportTableNodes(parent, { input }, context)
      },

      exportPreview: async (parent, args, context) => {
        // Create preview input with fixed options
        const input = {
          tableId: parent.id,
          format: args.format.toLowerCase(),
          includeAttributes: true,
          includeMetadata: true,
          attributeFormat: 'nested' as const,
          dateFormat: 'iso' as const,
          limit: 10, // Always limit preview to 10 rows
          offset: 0,
          compression: false,
          prettyPrint: true,
        }
        return exportMutations.exportTableNodes(parent, { input }, context)
      },
    },
  }
}

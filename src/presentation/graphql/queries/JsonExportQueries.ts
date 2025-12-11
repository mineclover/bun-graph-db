/**
 * JSON Export GraphQL Queries
 *
 * Handles JSON export operations in Flat and HFI Protocol formats
 */

import type { GraphQLResolveInfo } from 'graphql'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { TableId } from '@/core/types/CommonTypes.js'
import type { FlatJsonExport, HFIProtocolExport, JsonExportFormat, JsonExportOptions } from '@/core/types/JsonExport.js'
import type { JsonExportService } from '@/domain/services/JsonExportService.js'

/** GraphQL enum format values */
type GraphQLExportFormat = 'FLAT' | 'HFI'

/** GraphQL input for export options */
interface JsonExportOptionsInput {
  format?: GraphQLExportFormat
  includeRelations?: boolean
  includePositions?: boolean
  includeThemes?: boolean
  includeStateConnections?: boolean
  prettyPrint?: boolean
  nodeIds?: string[]
  tags?: string[]
}

/** GraphQL query arguments */
interface ExportTableJsonArgs {
  tableId: string
  options?: JsonExportOptionsInput
}

/** GraphQL response type */
interface JsonExportResponse {
  success: boolean
  format: GraphQLExportFormat
  json: string | null
  data: FlatJsonExport | HFIProtocolExport | null
  nodeCount: number
  errors: string[]
  warnings: string[]
}

/** Context for JsonExport queries */
export interface JsonExportQueriesContext {
  jsonExportService: JsonExportService
  logger: ILogger
}

/** Convert GraphQL format enum to service format */
function toServiceFormat(format: GraphQLExportFormat | undefined): JsonExportFormat {
  if (!format) return 'flat'
  return format.toLowerCase() as JsonExportFormat
}

/** Convert service format to GraphQL format enum */
function toGraphQLFormat(format: JsonExportFormat): GraphQLExportFormat {
  return format.toUpperCase() as GraphQLExportFormat
}

export class JsonExportQueries {
  /**
   * Export table data to JSON format
   */
  static async exportTableJson(
    _parent: unknown,
    args: ExportTableJsonArgs,
    context: JsonExportQueriesContext,
    _info: GraphQLResolveInfo,
  ): Promise<JsonExportResponse> {
    const { jsonExportService, logger } = context

    try {
      logger.info('[GraphQL] exportTableJson query called', {
        tableId: args.tableId,
        options: args.options,
      })

      // Convert GraphQL options to service options
      const serviceOptions: JsonExportOptions = {
        format: toServiceFormat(args.options?.format),
        includeRelations: args.options?.includeRelations ?? true,
        includePositions: args.options?.includePositions ?? false,
        includeThemes: args.options?.includeThemes ?? false,
        includeStateConnections: args.options?.includeStateConnections ?? false,
        prettyPrint: args.options?.prettyPrint ?? true,
        nodeIds: args.options?.nodeIds,
        tags: args.options?.tags,
      }

      const result = await jsonExportService.exportTable(args.tableId as TableId, serviceOptions)

      logger.info('[GraphQL] exportTableJson completed', {
        success: result.success,
        format: result.format,
        nodeCount: result.nodeCount,
      })

      return {
        success: result.success,
        format: toGraphQLFormat(result.format),
        json: result.json ?? null,
        data: result.data ?? null,
        nodeCount: result.nodeCount,
        errors: result.errors,
        warnings: result.warnings,
      }
    } catch (error) {
      logger.error('[GraphQL] exportTableJson failed', { error })
      return {
        success: false,
        format: args.options?.format ?? 'FLAT',
        json: null,
        data: null,
        nodeCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
      }
    }
  }
}

import type { ILogger } from '@/application/ports/ILogger.js'
import type {
  TableNodesExportInput,
  TableNodesExportOutput,
} from '@/application/dtos/TableNodesExportDto.js'
import {
  createDefaultExportOptions,
  validateExportInput,
} from '@/application/dtos/TableNodesExportDto.js'
import type { TableNodesExportUseCase } from '@/application/use-cases/export/TableNodesExportUseCase.js'
import type { GraphQLContext, GraphQLParent } from '@/core/types/GraphQLTypes.js'
import { GraphQLError } from 'graphql'
import { BaseResolver } from '../base/BaseResolver.js'

export class ExportMutations extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly tableNodesExportUseCase: TableNodesExportUseCase,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  async exportTableNodes(_: GraphQLParent, args: { input: TableNodesExportInput }, context?: GraphQLContext) {
    try {
      this.logger.info('Executing mutation: exportTableNodes', { input: args.input })

      const input: TableNodesExportInput = {
        ...args.input,
        format: args.input.format.toLowerCase(),
        attributeFormat: args.input.attributeFormat?.toLowerCase() || 'nested',
        dateFormat: args.input.dateFormat?.toLowerCase() || 'iso',
      }

      const options = {
        format: input.format,
        includeAttributes: input.includeAttributes ?? true,
        includeMetadata: input.includeMetadata ?? true,
        attributeFormat: input.attributeFormat as any,
        dateFormat: input.dateFormat as any,
        limit: input.limit,
        offset: input.offset,
        compression: input.compression ?? false,
        prettyPrint: input.prettyPrint ?? true,
        saveToFile: input.saveToFile ?? false,
        outputDirectory: input.outputDirectory,
        filename: input.filename,
      }

      const result = await this.tableNodesExportUseCase.execute(input.tableId, options)

      // Convert binary data to base64 if needed
      let data: string | undefined
      let binaryData: string | undefined

      if (result.data) {
        if (Buffer.isBuffer(result.data)) {
          binaryData = result.data.toString('base64')
        } else {
          data = result.data
        }
      }

      this.logger.info('Mutation completed: exportTableNodes', {
        success: result.success,
        format: result.format,
        dataLength: data?.length || binaryData?.length || 0
      })

      return {
        success: result.success,
        format: result.format,
        data,
        binaryData,
        filePath: result.filePath,
        metadata: result.metadata,
        errors: result.errors || [],
      }
    } catch (error) {
      this.logger.error('Export table nodes failed', { error: error instanceof Error ? error.message : String(error) })
      return {
        success: false,
        format: args.input.format.toLowerCase(),
        metadata: {
          exportedAt: new Date().toISOString(),
          tableId: args.input.tableId,
          tableIdentifier: 'unknown',
          totalNodes: 0,
          exportedNodes: 0,
          format: args.input.format.toLowerCase(),
        },
        errors: [error instanceof Error ? error.message : String(error)],
      }
    }
  }

  async exportMultipleTables(_: GraphQLParent, args: {
    tableIds: string[],
    format: string,
    options?: Partial<TableNodesExportInput>
  }, context?: GraphQLContext) {
    try {
      this.logger.info('Executing mutation: exportMultipleTables', {
        tableIds: args.tableIds,
        format: args.format
      })

      const results: TableNodesExportOutput[] = []

      const defaultOptions = {
        format: args.format.toLowerCase(),
        includeAttributes: args.options?.includeAttributes ?? true,
        includeMetadata: args.options?.includeMetadata ?? true,
        attributeFormat: (args.options?.attributeFormat?.toLowerCase() || 'nested') as any,
        dateFormat: (args.options?.dateFormat?.toLowerCase() || 'iso') as any,
        limit: args.options?.limit,
        offset: args.options?.offset,
        compression: args.options?.compression ?? false,
        prettyPrint: args.options?.prettyPrint ?? true,
      }

      // Export each table
      for (const tableId of args.tableIds) {
        try {
          const result = await this.tableNodesExportUseCase.execute(tableId, defaultOptions)

          // Convert binary data to base64 if needed
          let data: string | undefined
          let binaryData: string | undefined

          if (result.data) {
            if (Buffer.isBuffer(result.data)) {
              binaryData = result.data.toString('base64')
            } else {
              data = result.data
            }
          }

          results.push({
            success: result.success,
            format: result.format,
            data,
            binaryData,
            metadata: result.metadata,
            errors: result.errors || [],
          })
        } catch (error) {
          results.push({
            success: false,
            format: args.format.toLowerCase(),
            metadata: {
              exportedAt: new Date().toISOString(),
              tableId,
              tableIdentifier: 'unknown',
              totalNodes: 0,
              exportedNodes: 0,
              format: args.format.toLowerCase(),
            },
            errors: [error instanceof Error ? error.message : String(error)],
          })
        }
      }

      this.logger.info('Mutation completed: exportMultipleTables', {
        tableCount: args.tableIds.length,
        successCount: results.filter(r => r.success).length
      })

      return results
    } catch (error) {
      this.logger.error('Export multiple tables failed', { error: error instanceof Error ? error.message : String(error) })
      throw new GraphQLError(`Bulk export failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Query methods for export functionality
  getSupportedExportFormats() {
    return ['CSV', 'JSON', 'EXCEL', 'XML', 'YAML']
  }

  async validateExportOptions(_: GraphQLParent, args: { input: TableNodesExportInput }, context?: GraphQLContext) {
    try {
      const input: TableNodesExportInput = {
        ...args.input,
        format: args.input.format.toLowerCase(),
        attributeFormat: args.input.attributeFormat?.toLowerCase() || 'nested',
        dateFormat: args.input.dateFormat?.toLowerCase() || 'iso',
      }

      const errors = validateExportInput(input)
      const warnings: string[] = []

      // Add warnings for large exports
      if (input.limit && input.limit > 10000) {
        warnings.push('Large exports (>10,000 rows) may take significant time to complete')
      }

      if (input.format === 'excel' && input.limit && input.limit > 50000) {
        warnings.push('Excel format has a practical limit of ~50,000 rows for optimal performance')
      }

      // Estimate file size and duration
      let estimatedFileSize = 'Unknown'
      let estimatedDuration = 'Unknown'

      if (errors.length === 0) {
        const estimatedRows = input.limit || 1000
        const avgRowSize = input.format === 'csv' ? 200 : 500 // bytes per row estimate
        const sizeBytes = estimatedRows * avgRowSize

        if (sizeBytes < 1024) {
          estimatedFileSize = `${sizeBytes} B`
        } else if (sizeBytes < 1024 * 1024) {
          estimatedFileSize = `${(sizeBytes / 1024).toFixed(1)} KB`
        } else {
          estimatedFileSize = `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`
        }

        // Rough duration estimate
        const processingTimeMs = Math.max(1000, estimatedRows * 0.1) // 0.1ms per row minimum
        estimatedDuration = processingTimeMs < 1000 ? '<1s' : `${Math.ceil(processingTimeMs / 1000)}s`
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        estimatedFileSize,
        estimatedDuration,
      }
    } catch (error) {
      throw new GraphQLError(`Validation failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async getExportHistory(_: GraphQLParent, args: { tableId?: string, limit?: number }, context?: GraphQLContext) {
    // This would need to be implemented with an export history repository
    // For now, return empty array
    return []
  }
}
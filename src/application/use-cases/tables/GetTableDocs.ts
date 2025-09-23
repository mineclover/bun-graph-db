import * as AttributeDto from '@/application/dtos/AttributeDto.js'
import * as NodeDto from '@/application/dtos/NodeDto.js'
import type {
  GetTableDocsInput,
  GetTableDocsOutput,
  TableDocsDto,
} from '@/application/dtos/TableDocsDto.js'
import * as TableDto from '@/application/dtos/TableDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { queryTemplateToDto } from '@/presentation/dto/QueryTemplateDto.js'

export class GetTableDocsUseCase {
  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    private readonly logger: ILogger
  ) {}

  async execute(input: GetTableDocsInput): Promise<GetTableDocsOutput> {
    this.logger.info('GetTableDocs use case started', { input })

    try {
      // Find table by ID or identifier
      let table = null
      if (input.tableId) {
        table = await this.tableRepository.findById(input.tableId)
      } else if (input.identifier) {
        table = await this.tableRepository.findByIdentifier(input.identifier)
      } else {
        throw new Error('Either tableId or identifier must be provided')
      }

      if (!table) {
        this.logger.warn('Table not found', { input })
        return { tableDocs: null }
      }

      // Get table attributes
      const attributesResult = await this.attributeRepository.findByTableId(table.id)
      const attributeDtos = AttributeDto.fromEntities(attributesResult.data || [])

      // Get sample nodes if requested
      let sampleNodes: any[] | undefined
      if (input.includeSampleNodes) {
        const sampleLimit = input.sampleLimit || 3
        const nodesResult = await this.nodeRepository.findByTableId(table.id, {
          limit: sampleLimit,
          offset: 0,
        })
        sampleNodes = NodeDto.fromEntities(nodesResult.data || [])
      }

      // Get related templates if requested
      let relatedTemplates: any[] | undefined
      if (input.includeRelatedTemplates) {
        const templates = await this.queryTemplateRepository.findByApplicableTable(
          table.identifier,
          true
        )
        relatedTemplates = templates.map((template) => queryTemplateToDto(template))
      }

      // Get usage stats if requested
      let usageStats: any | undefined
      if (input.includeUsageStats) {
        const totalNodesResult = await this.nodeRepository.findByTableId(table.id)
        const totalNodes = totalNodesResult.totalCount || 0

        usageStats = {
          totalNodes,
          lastActivity: table.updatedAt.toISOString(),
          createdToday: 0, // Would need additional queries for this
          updatedToday: 0, // Would need additional queries for this
        }
      }

      // Build comprehensive table documentation
      const tableDocs: TableDocsDto = {
        table: TableDto.fromEntity(table),
        schema: {
          attributes: attributeDtos,
          attributeCount: attributeDtos.length,
        },
        sampleNodes,
        relatedTemplates,
        usageStats,
        documentation: {
          description: table.description || 'No description available',
          usageExamples: [
            'Basic node creation with required attributes',
            'Query nodes with filtering by attribute values',
            'Update node attributes with validation',
          ],
          bestPractices: [
            'Always validate required attributes before node creation',
            'Use appropriate data types for attribute values',
            'Consider indexing for frequently queried attributes',
          ],
        },
        generatedAt: new Date().toISOString(),
      }

      this.logger.info('GetTableDocs use case completed successfully', {
        tableId: table.id,
        attributeCount: attributeDtos.length,
        templatesCount: relatedTemplates?.length || 0,
      })

      return { tableDocs }
    } catch (error) {
      this.logger.error('GetTableDocs use case failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        input,
      })
      throw error
    }
  }
}

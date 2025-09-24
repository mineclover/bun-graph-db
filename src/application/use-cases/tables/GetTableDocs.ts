import * as AttributeDto from '@/application/dtos/AttributeDto.js'
import { DocDto } from '@/application/dtos/DocDto.js'
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
import type { IDocRepository } from '@/domain/repositories/IDocRepository.js'
import { queryTemplateToDto } from '@/presentation/dto/QueryTemplateDto.js'

export class GetTableDocsUseCase {
  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    private readonly docRepository: IDocRepository,
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

      // Get docs if requested
      let docs: any | undefined
      if (input.includeDocs !== false) { // Include docs by default
        const allDocs = await this.docRepository.findByTableIds([table.id])
        const docDtos = DocDto.fromEntities(allDocs)
        
        // Organize docs by category (get active docs for each category)
        const docsByCategory: Record<string, any> = {}
        for (const doc of docDtos) {
          if (doc.isActive) {
            docsByCategory[doc.category.toLowerCase()] = doc
          }
        }

        docs = {
          usage: docsByCategory.usage || null,
          guide: docsByCategory.guide || null,
          example: docsByCategory.example || null,
          spec: docsByCategory.spec || null,
          general: docsByCategory.general || null,
          allDocs: docDtos,
          docCount: docDtos.length
        }
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

      // Build final table documentation structure
      const tableDocs: TableDocsDto = {
        table: TableDto.fromEntity(table),
        schema: {
          attributes: attributeDtos,
          attributeCount: attributeDtos.length,
        },
        docs,
        relatedTemplates,
        generatedAt: new Date().toISOString(),
      }

      this.logger.info('GetTableDocs use case completed successfully', {
        tableId: table.id,
        attributeCount: attributeDtos.length,
        docsCount: docs?.docCount || 0,
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

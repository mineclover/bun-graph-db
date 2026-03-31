import * as AttributeDto from '@/application/dtos/AttributeDto.js'
import { DocDto as DomainDocDto } from '@/application/dtos/DocDto.js'
import { queryTemplateToDto } from '@/application/dtos/QueryTemplateDto.js'
import type { DocDto, GetTableDocsInput, GetTableDocsOutput, TableDocsDto } from '@/application/dtos/TableDocsDto.js'
import * as TableDto from '@/application/dtos/TableDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { IDocRepository } from '@/domain/repositories/IDocRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { LegacyAIMetadataAdapter } from '@/infrastructure/ai-metadata/LegacyAIMetadataAdapter.js'

interface AttributeMetadata {
  searchable?: boolean
}

interface AttributeDtoWithTypeInfo {
  attributeType?: {
    dataType?: string
  }
}

interface TableDocsCollection {
  usage?: DocDto
  guide?: DocDto
  example?: DocDto
  spec?: DocDto
  general?: DocDto
  allDocs: DocDto[]
  docCount: number
}

function toTableDocsDocDto(doc: DomainDocDto): DocDto {
  return {
    id: doc.id,
    title: `${doc.category} v${doc.version}`,
    content: doc.content,
    type: doc.category,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }
}

export class GetTableDocsUseCase {
  private aiMetadataAdapter: LegacyAIMetadataAdapter
  private readonly nodeAttributeRepository: INodeAttributeRepository
  private readonly queryTemplateRepository: IQueryTemplateRepository
  private readonly relationTypeRepository: IRelationTypeRepository
  private readonly docRepository: IDocRepository
  private readonly logger: ILogger

  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly nodeRepository: INodeRepository,
    nodeAttributeRepositoryOrQueryTemplateRepository: INodeAttributeRepository | IQueryTemplateRepository,
    queryTemplateRepositoryOrRelationTypeRepository: IQueryTemplateRepository | IRelationTypeRepository,
    relationTypeRepositoryOrDocRepository: IRelationTypeRepository | IDocRepository,
    docRepositoryOrLogger: IDocRepository | ILogger,
    logger?: ILogger,
  ) {
    const isLegacySignature = logger === undefined

    if (isLegacySignature) {
      this.nodeAttributeRepository = {
        findByNodeId: async () => [],
      } as unknown as INodeAttributeRepository
      this.queryTemplateRepository = nodeAttributeRepositoryOrQueryTemplateRepository as IQueryTemplateRepository
      this.relationTypeRepository = queryTemplateRepositoryOrRelationTypeRepository as IRelationTypeRepository
      this.docRepository = relationTypeRepositoryOrDocRepository as IDocRepository
      this.logger = (docRepositoryOrLogger as ILogger) || this.createNoopLogger()
    } else {
      this.nodeAttributeRepository = nodeAttributeRepositoryOrQueryTemplateRepository as INodeAttributeRepository
      this.queryTemplateRepository = queryTemplateRepositoryOrRelationTypeRepository as IQueryTemplateRepository
      this.relationTypeRepository = relationTypeRepositoryOrDocRepository as IRelationTypeRepository
      this.docRepository = docRepositoryOrLogger as IDocRepository
      this.logger = logger || this.createNoopLogger()
    }

    this.aiMetadataAdapter = new LegacyAIMetadataAdapter(this.logger)
    // Initialize the enhanced system
    this.aiMetadataAdapter.initialize().catch((error) => {
      this.logger.warn('AI metadata adapter initialization failed', { error })
    })
  }

  private createNoopLogger(): ILogger {
    return {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    }
  }

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
      const attributesResult = await this.attributeRepository.findByTableId(table.id, { limit: 1000, offset: 0 })
      const attributeDtos = AttributeDto.fromEntities(attributesResult.data || [])
      const attributeDtoById = new Map(attributeDtos.map((attributeDto) => [attributeDto.id, attributeDto]))
      const attributeEntities = attributesResult.data || []
      const aiMetadataAttributes = await Promise.all(
        attributeEntities.map(async (attribute) => {
          const attributeDto = attributeDtoById.get(attribute.getId())
          const attributeType =
            (await this.attributeTypeRepository.findById(attribute.getAttributeTypeId())) ||
            (this.attributeTypeRepository.findByIdentifier
              ? await this.attributeTypeRepository.findByIdentifier(attribute.getAttributeTypeId())
              : null)

          const metadata = (attribute.getParsedMetadata() || {}) as AttributeMetadata
          const explicitSearchable = metadata.searchable

          return {
            ...AttributeDto.fromEntity(attribute),
            required: attribute.getIsRequired(),
            searchable: explicitSearchable === undefined ? undefined : explicitSearchable === true,
            attributeType: {
              dataType:
                attributeType?.getIdentifier?.() ||
                attributeType?.getJsonType?.() ||
                (attributeDto as AttributeDtoWithTypeInfo | undefined)?.attributeType?.dataType ||
                attribute.getAttributeTypeId(),
            },
          }
        }),
      )

      // Get docs if requested
      let docs: TableDocsCollection | undefined
      if (input.includeDocs !== false) {
        // Include docs by default
        const allDocs = await this.docRepository.findByTableIds([table.id])
        const docDtos = DomainDocDto.fromEntities(allDocs).map((doc) => toTableDocsDocDto(doc))

        // Organize docs by category (get active docs for each category)
        const docsByCategory: Record<string, DocDto> = {}
        for (const doc of docDtos) {
          docsByCategory[doc.type.toLowerCase()] = doc
        }

        docs = {
          usage: docsByCategory.usage,
          guide: docsByCategory.guide,
          example: docsByCategory.example,
          spec: docsByCategory.spec,
          general: docsByCategory.general,
          allDocs: docDtos,
          docCount: docDtos.length,
        }
      }

      // Get related templates if requested
      let relatedTemplates: ReturnType<typeof queryTemplateToDto>[] | undefined
      if (input.includeRelatedTemplates || input.includeAiMetadata) {
        const templateSearch =
          this.queryTemplateRepository.search &&
          (await this.queryTemplateRepository.search({
            limit: 1000,
            includeUniversal: true,
          }))

        const templatesSource =
          templateSearch?.items ||
          (this.queryTemplateRepository.findByApplicableTable
            ? await this.queryTemplateRepository.findByApplicableTable(table.identifier, true)
            : [])

        const templates = templatesSource.filter((template) => {
          const applicableTables = template.getApplicableTables()
          if (!applicableTables || applicableTables.length === 0) {
            return true
          }

          return applicableTables.includes(table.identifier) || applicableTables.includes(table.id)
        })
        const dedupedTemplates = Array.from(new Map(templates.map((template) => [template.getIdentifier(), template])).values())
        relatedTemplates = dedupedTemplates.map((template) => queryTemplateToDto(template))
      }

      let sampleData:
        | {
            entries: Array<{ nodeId: string; title: string; content: string; attributes: Record<string, unknown> }>
            totalCount: number
            hasMore: boolean
            nodes: Array<{ id: string; content: string; attributes: Record<string, unknown> }>
            relationships: Array<{ from: string; to: string; type: string }>
          }
        | undefined
      if (input.includeAiMetadata || input.includeSampleNodes) {
        const sampleLimit = input.sampleLimit || 5
        const nodesResult =
          (await this.nodeRepository.findByTableId(table.id, { limit: sampleLimit, offset: 0 })) ||
          {
            data: [],
            nodes: [],
          }
        const totalNodeCount = (await this.nodeRepository.countByTableId(table.id)) || 0
        const attributeIdentifierById = new Map(attributeEntities.map((attribute) => [attribute.getId(), attribute.getIdentifier()]))
        const sampleNodes = (nodesResult.data || nodesResult.nodes || []).slice(0, sampleLimit)

        const sampleEntries = await Promise.all(
          sampleNodes.map(async (node) => {
            const nodeAttributes = await this.nodeAttributeRepository.findByNodeId(node.getId())
            const attributes = Object.fromEntries(
              nodeAttributes.map((nodeAttribute) => [
                attributeIdentifierById.get(nodeAttribute.getAttributeId()) || nodeAttribute.getAttributeId(),
                nodeAttribute.getParsedValue(),
              ]),
            )

            return {
              nodeId: node.getId(),
              title: node.getTitle() || node.getContent(),
              content: node.getContent(),
              attributes,
            }
          }),
        )

        sampleData = {
          entries: sampleEntries,
          totalCount: totalNodeCount,
          hasMore: totalNodeCount > sampleEntries.length,
          nodes: sampleEntries.map((entry) => ({
            id: entry.nodeId,
            content: entry.content,
            attributes: entry.attributes,
          })),
          relationships: this.relationTypeRepository ? [] : [],
        }
      }

      // Generate AI metadata if requested
      let aiMetadata: TableDocsDto['aiMetadata']
      if (input.includeAiMetadata) {
        aiMetadata = await this.aiMetadataAdapter.generateAiMetadata(
          table,
          aiMetadataAttributes,
          relatedTemplates?.map((template) => ({
            identifier: template.identifier,
            name: template.name,
            description: template.description,
          })),
          sampleData,
          input.sampleLimit || 5,
        )
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
        aiMetadata,
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

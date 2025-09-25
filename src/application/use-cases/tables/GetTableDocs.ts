import * as AttributeDto from '@/application/dtos/AttributeDto.js'
import { DocDto } from '@/application/dtos/DocDto.js'
import type {
  GetTableDocsInput,
  GetTableDocsOutput,
  TableDocsDto,
} from '@/application/dtos/TableDocsDto.js'
import * as TableDto from '@/application/dtos/TableDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { IDocRepository } from '@/domain/repositories/IDocRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { queryTemplateToDto } from '@/presentation/dto/QueryTemplateDto.js'

export class GetTableDocsUseCase {
  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly attributeRepository: IAttributeRepository,
    readonly _attributeTypeRepository: IAttributeTypeRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    private readonly relationTypeRepository: IRelationTypeRepository,
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
      if (input.includeDocs !== false) {
        // Include docs by default
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
          docCount: docDtos.length,
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

      // Generate AI metadata if requested
      let aiMetadata: any | undefined
      if (input.includeAiMetadata) {
        aiMetadata = await this.generateAiMetadata(
          table,
          attributeDtos,
          relatedTemplates,
          input.sampleLimit || 5
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

  private async generateAiMetadata(
    table: any,
    attributes: any[],
    relatedTemplates: any[] = [],
    sampleLimit: number = 5
  ) {
    try {
      // Generate schema information
      const schemaInfo = await this.generateSchemaInfo(attributes)

      // Generate usage patterns from templates
      const usagePatterns = await this.generateUsagePatterns(relatedTemplates, attributes.length)

      // Generate sample data
      const sampleData = await this.generateSampleData(table.id, sampleLimit)

      return {
        schemaInfo,
        usagePatterns,
        sampleData: sampleData.nodes.length > 0 ? sampleData : undefined,
      }
    } catch (error) {
      this.logger.warn('Failed to generate AI metadata', {
        tableId: table.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return undefined
    }
  }

  private async generateSchemaInfo(attributes: any[]) {
    const dataTypes: { [key: string]: string } = {}
    const requiredFields: string[] = []
    const searchableFields: string[] = []
    const relationshipCapabilities: string[] = []

    // Process attributes to extract data types and capabilities
    for (const attr of attributes) {
      if (attr.attributeType) {
        dataTypes[attr.identifier] = attr.attributeType.dataType || 'string'

        // Determine searchable fields based on data type
        if (['string', 'text'].includes(attr.attributeType.dataType)) {
          searchableFields.push(attr.identifier)
        }

        // Mark required fields (this could be enhanced with actual schema validation)
        if (attr.identifier === 'title' || attr.identifier === 'name') {
          requiredFields.push(attr.identifier)
        }
      }
    }

    // Get available relationship types
    try {
      const relationTypes = await this.relationTypeRepository.findAll({ limit: 100, offset: 0 })
      relationshipCapabilities.push(...(relationTypes.data || []).map((rt) => rt.getIdentifier()))
    } catch (error) {
      this.logger.debug('Could not fetch relation types for AI metadata', { error })
    }

    return {
      dataTypes,
      requiredFields,
      searchableFields,
      relationshipCapabilities,
    }
  }

  private async generateUsagePatterns(templates: any[] = [], attributeCount: number) {
    const commonQueries: { pattern: string; description: string; example: string }[] = []
    const templateRecommendations: { templateId: string; useCase: string }[] = []

    // Generate common query patterns
    commonQueries.push({
      pattern: 'Basic node search',
      description: 'Search nodes by content or attributes',
      example: 'searchNodes(tableId: $tableId, searchQuery: { textSearch: "keyword", limit: 10 })',
    })

    commonQueries.push({
      pattern: 'Create node with attributes',
      description: 'Create a new node and set its attributes',
      example: 'createNode(input: { tableId: $tableId, content: $content })',
    })

    if (attributeCount > 0) {
      commonQueries.push({
        pattern: 'Filter by attributes',
        description: 'Search nodes with attribute-based filters',
        example:
          'searchNodes(tableId: $tableId, searchQuery: { conditions: [{ filters: [{ field: $field, operator: "equals", value: $value }] }] })',
      })
    }

    // Process templates for recommendations
    for (const template of templates.slice(0, 5)) {
      // Limit to top 5 templates
      templateRecommendations.push({
        templateId: template.identifier,
        useCase: this.inferTemplateUseCase(template),
      })
    }

    // Determine query complexity based on attributes and templates
    let queryComplexity: 'simple' | 'moderate' | 'complex' = 'simple'
    if (attributeCount > 5 || templates.length > 10) {
      queryComplexity = 'moderate'
    }
    if (attributeCount > 10 || templates.length > 20) {
      queryComplexity = 'complex'
    }

    return {
      commonQueries,
      templateRecommendations,
      queryComplexity,
    }
  }

  private async generateSampleData(tableId: string, sampleLimit: number) {
    try {
      const nodesResult = await this.nodeRepository.findByTableId(tableId)
      const nodes = (nodesResult.nodes || []).slice(0, sampleLimit)

      const sampleNodes = nodes.map((node) => ({
        id: node.getId(),
        content: node.getContent(),
        attributes: {}, // Attributes would need to be fetched separately
      }))

      // For now, relationships are not included as we'd need a more complex query
      const relationships: Array<{ from: string; to: string; type: string }> = []

      return {
        nodes: sampleNodes,
        relationships,
      }
    } catch (error) {
      this.logger.debug('Could not generate sample data for AI metadata', { tableId, error })
      return { nodes: [], relationships: [] }
    }
  }

  private inferTemplateUseCase(template: any): string {
    const name = template.name?.toLowerCase() || ''
    const identifier = template.identifier?.toLowerCase() || ''

    if (name.includes('create') || identifier.includes('create')) {
      return 'Data creation and population'
    }
    if (name.includes('search') || identifier.includes('search') || name.includes('find')) {
      return 'Data search and retrieval'
    }
    if (name.includes('update') || identifier.includes('update')) {
      return 'Data modification'
    }
    if (name.includes('relation') || identifier.includes('relation')) {
      return 'Relationship management'
    }
    if (name.includes('analysis') || identifier.includes('analysis')) {
      return 'Data analysis and reporting'
    }

    return 'General purpose query'
  }
}

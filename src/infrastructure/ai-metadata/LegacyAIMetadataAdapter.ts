import { buildSchema, type GraphQLSchema } from 'graphql'
import type { ILogger } from '@/application/ports/ILogger.js'
import { EnhancedAIMetadataGenerator } from './EnhancedAIMetadataGenerator.js'
import { GraphQLSchemaIntrospector } from './GraphQLSchemaIntrospector.js'

/**
 * Legacy AI Metadata Adapter
 * Bridges between existing GetTableDocsUseCase and enhanced AI metadata system
 */
export class LegacyAIMetadataAdapter {
  private schemaIntrospector: GraphQLSchemaIntrospector | null = null
  private metadataGenerator: EnhancedAIMetadataGenerator | null = null
  private logger: ILogger

  constructor(logger: ILogger) {
    this.logger = logger
  }

  /**
   * Initialize the enhanced system with GraphQL schema
   */
  async initialize(schema?: GraphQLSchema): Promise<void> {
    try {
      // If no schema provided, create a minimal one for testing
      const graphqlSchema = schema || this.createMinimalSchema()

      this.schemaIntrospector = new GraphQLSchemaIntrospector(graphqlSchema)

      // Create simple table attribute provider
      const tableAttributeProvider = {
        async getTableAttributes(_tableId: string) {
          // Return basic attributes - this would be enhanced with real data
          return [
            {
              identifier: 'title',
              name: 'Title',
              required: true,
              attributeType: { dataType: 'string' },
            },
            {
              identifier: 'content',
              name: 'Content',
              required: false,
              attributeType: { dataType: 'text' },
            },
          ]
        },
      }

      this.metadataGenerator = new EnhancedAIMetadataGenerator(
        this.schemaIntrospector,
        tableAttributeProvider
      )

      this.logger.info('✅ Enhanced AI metadata system initialized')
    } catch (error) {
      this.logger.warn(
        '⚠️ Enhanced AI metadata system initialization failed, falling back to legacy',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      )
    }
  }

  /**
   * Generate AI metadata with enhanced system if available, fallback to legacy format
   */
  async generateAiMetadata(
    table: any,
    attributes: any[],
    relatedTemplates: any[] = [],
    sampleLimit: number = 5
  ): Promise<any> {
    // Try enhanced system first
    if (this.metadataGenerator && this.schemaIntrospector) {
      try {
        this.logger.info('🚀 Using enhanced AI metadata generation')

        const enhancedMetadata = await this.metadataGenerator.generateEnhancedMetadata(table.id)

        // Convert enhanced metadata to legacy format for backward compatibility
        return {
          schemaInfo: {
            dataTypes: this.extractDataTypes(attributes),
            requiredFields: this.extractRequiredFields(attributes),
            searchableFields: this.extractSearchableFields(attributes),
            relationshipCapabilities: [],
          },
          usagePatterns: {
            commonQueries: this.convertToLegacyQueries(
              enhancedMetadata.usagePatterns.commonQueries
            ),
            templateRecommendations: enhancedMetadata.usagePatterns.templateRecommendations.map(
              (rec) => ({
                templateId: rec.name,
                useCase: rec.description,
              })
            ),
            queryComplexity: 'moderate',
            // Add enhanced schema information
            validExamples: enhancedMetadata.usagePatterns.validExamples || [],
            schemaCompliantExamples: enhancedMetadata.schemaInfo?.schemaCompliantExamples || [],
          },
          sampleData: {
            nodes: [],
            relationships: [],
          },
          // Enhanced validation info
          validationInfo: enhancedMetadata.validationInfo || {
            lastSchemaSync: new Date().toISOString(),
            schemaVersion: 'enhanced-v1.0.0',
            compatibilityScore: 0.95,
          },
        }
      } catch (error) {
        this.logger.warn('Enhanced AI metadata generation failed, falling back to legacy', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Fallback to legacy generation with corrected schema
    this.logger.info('📋 Using legacy AI metadata generation with schema corrections')
    return this.generateLegacyAiMetadataWithCorrections(attributes, relatedTemplates, sampleLimit)
  }

  /**
   * Legacy generation with schema corrections
   */
  private generateLegacyAiMetadataWithCorrections(
    attributes: any[],
    relatedTemplates: any[] = [],
    _sampleLimit: number = 5
  ): any {
    const schemaInfo = {
      dataTypes: this.extractDataTypes(attributes),
      requiredFields: this.extractRequiredFields(attributes),
      searchableFields: this.extractSearchableFields(attributes),
      relationshipCapabilities: [],
    }

    // Generate corrected usage patterns
    const commonQueries = [
      {
        pattern: 'Basic node search',
        description: 'Search nodes by content or attributes',
        // CORRECTED: Use 'filter' instead of 'searchQuery'
        example:
          'searchNodes(filter: { tableId: $tableId, searchTerm: "keyword" }, pagination: { limit: 10 })',
      },
      {
        pattern: 'Create node with attributes',
        description: 'Create a new node and set its attributes',
        example: 'createNode(input: { tableId: $tableId, content: $content })',
      },
    ]

    if (attributes.length > 0) {
      commonQueries.push({
        pattern: 'Filter by attributes',
        description: 'Search nodes with attribute-based filters',
        // CORRECTED: Use 'filter' with proper structure
        example:
          'searchNodes(filter: { tableId: $tableId, conditions: [{ field: $field, operator: "equals", value: $value }] })',
      })
    }

    const templateRecommendations = relatedTemplates.slice(0, 5).map((template) => ({
      templateId: template.identifier,
      useCase: template.name || 'Template usage',
    }))

    return {
      schemaInfo,
      usagePatterns: {
        commonQueries,
        templateRecommendations,
        queryComplexity: attributes.length > 5 ? 'complex' : 'moderate',
        // Add validation info
        validExamples: commonQueries,
        schemaVersion: 'corrected-v1.0.0',
      },
      sampleData: {
        nodes: [],
        relationships: [],
      },
    }
  }

  /**
   * Convert enhanced metadata queries to legacy format
   */
  private convertToLegacyQueries(commonQueries: any[]): any[] {
    return commonQueries.map((query) => ({
      pattern: query.name || query.pattern,
      description: query.description,
      example: this.correctQuerySyntax(query.example || query.query),
    }))
  }

  /**
   * Correct query syntax from searchQuery to filter
   */
  private correctQuerySyntax(example: string): string {
    // Replace searchQuery with filter structure
    return example
      .replace(/searchQuery:\s*{([^}]*)}/g, 'filter: { tableId: $tableId, $1 }')
      .replace(/searchQuery/g, 'filter')
      .replace(/textSearch:/g, 'searchTerm:')
  }

  /**
   * Extract data types from attributes
   */
  private extractDataTypes(attributes: any[]): { [key: string]: string } {
    const dataTypes: { [key: string]: string } = {}
    for (const attr of attributes) {
      if (attr.attributeType) {
        dataTypes[attr.identifier] = attr.attributeType.dataType || 'string'
      }
    }
    return dataTypes
  }

  /**
   * Extract required fields from attributes
   */
  private extractRequiredFields(attributes: any[]): string[] {
    return attributes
      .filter((attr) => attr.identifier === 'title' || attr.identifier === 'name' || attr.required)
      .map((attr) => attr.identifier)
  }

  /**
   * Extract searchable fields from attributes
   */
  private extractSearchableFields(attributes: any[]): string[] {
    return attributes
      .filter((attr) => ['string', 'text'].includes(attr.attributeType?.dataType))
      .map((attr) => attr.identifier)
  }

  /**
   * Create minimal GraphQL schema for testing
   */
  private createMinimalSchema(): GraphQLSchema {
    const schemaString = `
      type Query {
        searchNodes(filter: SearchNodesFilter!, pagination: NodesPagination): SearchNodesResult!
        table(id: ID!): Table
      }

      type Mutation {
        createNode(input: CreateNodeInput!): CreateNodeResult!
      }

      input SearchNodesFilter {
        tableId: ID!
        searchTerm: String
        conditions: [SearchCondition!]
      }

      input NodesPagination {
        limit: Int
        offset: Int
      }

      input SearchCondition {
        field: String!
        operator: String!
        value: String!
      }

      input CreateNodeInput {
        tableId: ID!
        content: String!
        title: String
      }

      type SearchNodesResult {
        nodes: [TableNode!]!
        totalCount: Int!
      }

      type CreateNodeResult {
        success: Boolean!
        node: TableNode
        errors: [Error!]
      }

      type TableNode {
        id: ID!
        title: String
        content: String
        tableId: ID!
      }

      type Table {
        id: ID!
        identifier: String!
        description: String
      }

      type Error {
        message: String!
        field: String
      }
    `

    return buildSchema(schemaString)
  }
}

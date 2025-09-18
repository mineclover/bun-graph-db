import type { ITableRepository } from '../repositories/ITableRepository.js'
import type { IAttributeRepository } from '../repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '../repositories/IAttributeTypeRepository.js'
import type { IQueryTemplateRepository } from '../repositories/IQueryTemplateRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { QueryTemplate } from '../entities/QueryTemplate.js'

/**
 * Enhanced template generator for table packages
 *
 * Generates sophisticated GraphQL templates including:
 * - CRUD operations with full field selections
 * - Search with filtering, sorting, and pagination
 * - Batch operations with error handling
 * - Relationship queries with nested selections
 * - Advanced validation and type safety
 */
export class EnhancedTemplateGenerator {
  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    private readonly logger: ILogger
  ) {}

  /**
   * Generate comprehensive templates for a table
   */
  async generateTableTemplates(
    tableIdentifier: string,
    options: {
      includeCreate?: boolean
      includeRead?: boolean
      includeUpdate?: boolean
      includeDelete?: boolean
      includeSearch?: boolean
      includeBatch?: boolean
      includeRelations?: boolean
      includeValidation?: boolean
      includeSubscriptions?: boolean
    } = {}
  ): Promise<{
    success: boolean
    templates: Array<{
      identifier: string
      name: string
      operationType: string
      query: string
      variables?: Record<string, any>
      description?: string
    }>
    errors: string[]
  }> {
    const defaults = {
      includeCreate: true,
      includeRead: true,
      includeUpdate: true,
      includeDelete: true,
      includeSearch: true,
      includeBatch: false,
      includeRelations: true,
      includeValidation: true,
      includeSubscriptions: false,
      ...options,
    }

    const templates = []
    const errors = []

    try {
      this.logger.info('Generating enhanced templates', { tableIdentifier, options: defaults })

      // Get table info and schema
      const table = await this.tableRepository.findByIdentifier(tableIdentifier)
      if (!table) {
        return {
          success: false,
          templates: [],
          errors: [`Table '${tableIdentifier}' not found`],
        }
      }

      const tableSchema = await this.getTableSchema(table.id as string)

      const tableNameCamel = this.toCamelCase(tableIdentifier)
      const tableNamePascal = this.toPascalCase(tableIdentifier)

      // 1. Create operation with validation
      if (defaults.includeCreate) {
        templates.push(await this.generateCreateTemplate(
          tableIdentifier,
          tableNameCamel,
          tableNamePascal,
          tableSchema,
          defaults.includeValidation
        ))
      }

      // 2. Read operations (single and list)
      if (defaults.includeRead) {
        templates.push(
          await this.generateGetByIdTemplate(tableIdentifier, tableNameCamel, tableNamePascal, tableSchema),
          await this.generateListTemplate(tableIdentifier, tableNameCamel, tableNamePascal, tableSchema)
        )
      }

      // 3. Update operation with partial updates
      if (defaults.includeUpdate) {
        templates.push(await this.generateUpdateTemplate(
          tableIdentifier,
          tableNameCamel,
          tableNamePascal,
          tableSchema,
          defaults.includeValidation
        ))
      }

      // 4. Delete operations (single and cascade)
      if (defaults.includeDelete) {
        templates.push(
          await this.generateDeleteTemplate(tableIdentifier, tableNameCamel, tableNamePascal),
          await this.generateDeleteCascadeTemplate(tableIdentifier, tableNameCamel, tableNamePascal)
        )
      }

      // 5. Advanced search with filtering and sorting
      if (defaults.includeSearch) {
        templates.push(
          await this.generateSearchTemplate(tableIdentifier, tableNameCamel, tableNamePascal, tableSchema),
          await this.generateFilterTemplate(tableIdentifier, tableNameCamel, tableNamePascal, tableSchema)
        )
      }

      // 6. Batch operations
      if (defaults.includeBatch) {
        templates.push(
          await this.generateBatchCreateTemplate(tableIdentifier, tableNameCamel, tableNamePascal, tableSchema),
          await this.generateBatchUpdateTemplate(tableIdentifier, tableNameCamel, tableNamePascal, tableSchema),
          await this.generateBatchDeleteTemplate(tableIdentifier, tableNameCamel, tableNamePascal)
        )
      }

      // 7. Relationship queries
      if (defaults.includeRelations) {
        templates.push(
          await this.generateRelationshipTemplate(tableIdentifier, tableNameCamel, tableNamePascal),
          await this.generateNestedQueryTemplate(tableIdentifier, tableNameCamel, tableNamePascal, tableSchema)
        )
      }

      // 8. Subscriptions for real-time updates
      if (defaults.includeSubscriptions) {
        templates.push(
          await this.generateSubscriptionTemplate(tableIdentifier, tableNameCamel, tableNamePascal),
          await this.generateChangeStreamTemplate(tableIdentifier, tableNameCamel, tableNamePascal)
        )
      }

      // Create templates in repository
      for (const template of templates) {
        try {
          // Template creation

          const queryTemplate = QueryTemplate.create(
            template.identifier,
            template.name,
            template.query,
            [tableIdentifier, template.operationType, 'export-import', 'table-package', 'enhanced'],
            {
              description: template.description || `Enhanced ${template.operationType} template for ${tableIdentifier} table`,
              complexityScore: this.calculateComplexityScore(template.query),
              applicableTables: [tableIdentifier],
              variablesSchema: template.variables ? {
                type: 'object',
                properties: template.variables,
                required: this.extractRequiredVariables(template.query)
              } : undefined,
            }
          )

          await this.queryTemplateRepository.create(queryTemplate)
        } catch (error) {
          errors.push(`Failed to create template '${template.identifier}': ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      this.logger.info('Enhanced template generation completed', {
        tableIdentifier,
        templatesGenerated: templates.length,
        errors: errors.length,
      })

      return {
        success: errors.length === 0,
        templates,
        errors,
      }
    } catch (error) {
      this.logger.error('Enhanced template generation failed', { tableIdentifier, error })
      return {
        success: false,
        templates: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      }
    }
  }

  /**
   * Generate create template with validation
   */
  private async generateCreateTemplate(
    tableIdentifier: string,
    tableNameCamel: string,
    tableNamePascal: string,
    tableSchema: any,
    includeValidation: boolean
  ) {
    const _inputFields = this.generateInputFields(tableSchema, 'create')
    const outputFields = this.generateOutputFields(tableSchema)
    const validationFields = includeValidation ? this.generateValidationFields() : ''

    return {
      identifier: `create-${tableIdentifier}-enhanced`,
      name: `Create ${tableNamePascal} (Enhanced)`,
      operationType: 'mutation',
      description: `Create a new ${tableIdentifier} record with comprehensive validation and error handling`,
      query: `mutation Create${tableNamePascal}Enhanced($input: Create${tableNamePascal}Input!) {
  create${tableNamePascal}(input: $input) {
    success
    ${tableNameCamel} {
      ${outputFields}
    }
    errors {
      message
      field
      code
      ${validationFields}
    }
    warnings {
      message
      field
    }
    metadata {
      createdAt
      version
      checksum
    }
  }
}`,
      variables: {
        input: {
          type: 'object',
          description: `Input data for creating a new ${tableIdentifier}`,
          properties: this.generateVariableProperties(tableSchema, 'create'),
          required: this.getRequiredFields(tableSchema, 'create')
        }
      },
    }
  }

  /**
   * Generate get by ID template with comprehensive field selection
   */
  private async generateGetByIdTemplate(
    tableIdentifier: string,
    tableNameCamel: string,
    tableNamePascal: string,
    tableSchema: any
  ) {
    const outputFields = this.generateOutputFields(tableSchema)

    return {
      identifier: `get-${tableIdentifier}-by-id-enhanced`,
      name: `Get ${tableNamePascal} by ID (Enhanced)`,
      operationType: 'query',
      description: `Retrieve a single ${tableIdentifier} record by ID with all available fields`,
      query: `query Get${tableNamePascal}ByIdEnhanced($id: ID!, $includeRelations: Boolean = false) {
  ${tableNameCamel}(id: $id) {
    ${outputFields}

    # Relations (conditional)
    relations @include(if: $includeRelations) {
      outgoing {
        id
        type
        target {
          id
          nodeType
        }
        strength
        properties
      }
      incoming {
        id
        type
        source {
          id
          nodeType
        }
        strength
        properties
      }
    }

    # Metadata
    metadata {
      version
      checksum
      lastModifiedBy
      tags
    }

    # Audit trail
    auditLog {
      action
      timestamp
      user
      changes {
        field
        oldValue
        newValue
      }
    }
  }
}`,
      variables: {
        id: {
          type: 'string',
          description: 'Unique identifier of the record to retrieve',
          format: 'uuid'
        },
        includeRelations: {
          type: 'boolean',
          description: 'Whether to include relationship data',
          default: false
        }
      },
    }
  }

  /**
   * Generate list template with pagination and sorting
   */
  private async generateListTemplate(
    tableIdentifier: string,
    tableNameCamel: string,
    tableNamePascal: string,
    tableSchema: any
  ) {
    const outputFields = this.generateOutputFields(tableSchema, true) // Simplified for list view

    return {
      identifier: `list-${tableIdentifier}-enhanced`,
      name: `List ${tableNamePascal} (Enhanced)`,
      operationType: 'query',
      description: `List ${tableIdentifier} records with advanced pagination, sorting, and filtering`,
      query: `query List${tableNamePascal}Enhanced(
  $filter: ${tableNamePascal}FilterInput,
  $sort: ${tableNamePascal}SortInput,
  $pagination: PaginationInput,
  $includeRelations: Boolean = false,
  $includeAttributes: Boolean = false
) {
  ${tableNameCamel}s(
    filter: $filter,
    sort: $sort,
    pagination: $pagination
  ) {
    items {
      ${outputFields}

      # Conditional fields
      relations @include(if: $includeRelations) {
        count
        types
      }

      attributes @include(if: $includeAttributes) {
        key
        value
        type
      }
    }

    pagination {
      total
      page
      pageSize
      hasNextPage
      hasPreviousPage
      totalPages
    }

    aggregations {
      count
      distinctCount
      statistics {
        field
        min
        max
        avg
        sum
      }
    }

    facets {
      field
      values {
        value
        count
      }
    }
  }
}`,
      variables: {
        filter: {
          type: 'object',
          description: 'Filtering criteria',
          properties: this.generateFilterProperties(tableSchema)
        },
        sort: {
          type: 'object',
          description: 'Sorting configuration',
          properties: {
            field: { type: 'string', enum: this.getFieldNames(tableSchema) },
            direction: { type: 'string', enum: ['ASC', 'DESC'], default: 'ASC' }
          }
        },
        pagination: {
          type: 'object',
          description: 'Pagination parameters',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
          }
        },
        include: {
          type: 'object',
          description: 'Optional data to include',
          properties: {
            relations: { type: 'boolean', default: false },
            attributes: { type: 'boolean', default: false }
          }
        }
      },
    }
  }

  /**
   * Generate advanced search template with full-text search
   */
  private async generateSearchTemplate(
    tableIdentifier: string,
    _tableNameCamel: string,
    tableNamePascal: string,
    tableSchema: any
  ) {
    return {
      identifier: `search-${tableIdentifier}-enhanced`,
      name: `Search ${tableNamePascal} (Enhanced)`,
      operationType: 'query',
      description: `Advanced search for ${tableIdentifier} records with full-text search, faceted search, and relevance scoring`,
      query: `query Search${tableNamePascal}Enhanced(
  $query: String!,
  $filters: ${tableNamePascal}SearchFiltersInput,
  $facets: [String!],
  $highlight: Boolean = false,
  $pagination: PaginationInput
) {
  search${tableNamePascal}(
    query: $query,
    filters: $filters,
    facets: $facets,
    highlight: $highlight,
    pagination: $pagination
  ) {
    items {
      score
      ${this.generateOutputFields(tableSchema, true)}

      highlights @include(if: $highlight) {
        field
        fragments
      }

      explanation {
        value
        description
        details
      }
    }

    pagination {
      total
      page
      pageSize
      hasNextPage
      hasPreviousPage
    }

    facets {
      field
      values {
        value
        count
        selected
      }
    }

    suggestions {
      text
      frequency
      type
    }

    searchMetadata {
      totalHits
      maxScore
      searchTime
      queryInterpretation
    }
  }
}`,
      variables: {
        query: {
          type: 'string',
          description: 'Search query string',
          minLength: 1
        },
        filters: {
          type: 'object',
          description: 'Additional search filters',
          properties: this.generateSearchFilterProperties(tableSchema)
        }
      },
    }
  }

  /**
   * Generate batch create template
   */
  private async generateBatchCreateTemplate(
    tableIdentifier: string,
    tableNameCamel: string,
    tableNamePascal: string,
    tableSchema: any
  ) {
    return {
      identifier: `batch-create-${tableIdentifier}-enhanced`,
      name: `Batch Create ${tableNamePascal} (Enhanced)`,
      operationType: 'mutation',
      description: `Create multiple ${tableIdentifier} records in a single transaction with comprehensive error handling`,
      query: `mutation BatchCreate${tableNamePascal}Enhanced(
  $items: [Create${tableNamePascal}Input!]!,
  $options: BatchCreateOptionsInput
) {
  batchCreate${tableNamePascal}(items: $items, options: $options) {
    success
    totalItems
    processedItems

    results {
      index
      success
      ${tableNameCamel} {
        ${this.generateOutputFields(tableSchema, true)}
      }
      errors {
        message
        field
        code
      }
    }

    summary {
      successful
      failed
      skipped
      totalProcessingTime
    }

    transaction {
      id
      status
      rollbackInfo
    }

    errors {
      message
      type
      affectedIndexes
    }
  }
}`,
      variables: {
        items: {
          type: 'array',
          description: 'Array of items to create',
          items: {
            type: 'object',
            properties: this.generateVariableProperties(tableSchema, 'create')
          },
          minItems: 1,
          maxItems: 100
        },
        options: {
          type: 'object',
          description: 'Batch processing options',
          properties: {
            continueOnError: { type: 'boolean', default: false },
            validateAll: { type: 'boolean', default: true },
            transactional: { type: 'boolean', default: true }
          }
        }
      },
    }
  }

  /**
   * Generate subscription template for real-time updates
   */
  private async generateSubscriptionTemplate(
    tableIdentifier: string,
    tableNameCamel: string,
    tableNamePascal: string
  ) {
    return {
      identifier: `subscribe-${tableIdentifier}-changes`,
      name: `Subscribe to ${tableNamePascal} Changes`,
      operationType: 'subscription',
      description: `Real-time subscription to ${tableIdentifier} record changes`,
      query: `subscription Subscribe${tableNamePascal}Changes(
  $filter: ${tableNamePascal}SubscriptionFilterInput,
  $events: [${tableNamePascal}EventType!]
) {
  ${tableNameCamel}Changes(filter: $filter, events: $events) {
    eventType
    timestamp

    before {
      id
      version
    }

    after {
      ${this.generateOutputFields({}, true)}
    }

    changes {
      field
      oldValue
      newValue
      changeType
    }

    metadata {
      userId
      sessionId
      source
      reason
    }
  }
}`,
      variables: {
        filter: {
          type: 'object',
          description: 'Filter for which changes to receive',
          properties: {
            ids: { type: 'array', items: { type: 'string' } },
            userId: { type: 'string' }
          }
        },
        events: {
          type: 'array',
          description: 'Event types to subscribe to',
          items: { type: 'string', enum: ['CREATED', 'UPDATED', 'DELETED'] },
          default: ['CREATED', 'UPDATED', 'DELETED']
        }
      },
    }
  }

  // Helper methods

  private async getTableSchema(tableId: string): Promise<any> {
    try {
      const attributesResult = await this.attributeRepository.findByTableId(tableId as any)
      const attributes = attributesResult.items || []

      const schema: {
        attributes: Array<{
          identifier: string
          type: string
          description: string | null
          required: boolean
        }>
        types: Map<string, any>
      } = {
        attributes: [],
        types: new Map()
      }

      for (const attr of attributes) {
        const attrType = await this.attributeTypeRepository.findById(attr.getAttributeTypeId())
        schema.attributes.push({
          identifier: attr.getIdentifier(),
          type: attrType?.getJsonType() || 'string',
          description: attr.getDescription(),
          required: attr.getIsRequired()
        } as {
          identifier: string
          type: string
          description: string | null
          required: boolean
        })
      }

      return schema
    } catch (error) {
      this.logger.warn('Failed to get table schema', { tableId, error })
      return { attributes: [], types: new Map() }
    }
  }

  private generateInputFields(tableSchema: any, operation: 'create' | 'update'): string {
    if (!tableSchema.attributes) return 'content\n  metadata'

    return tableSchema.attributes
      .filter((attr: any) => operation === 'update' || attr.required)
      .map((attr: any) => `${this.sanitizeFieldName(attr.identifier)}`)
      .join('\n  ') || 'content\n  metadata'
  }

  private generateOutputFields(tableSchema: any, simplified = false): string {
    const baseFields = `
      id
      externalId
      nodeType
      content
      createdAt
      updatedAt`

    if (simplified) return baseFields

    const attributeFields = tableSchema.attributes?.length > 0
      ? `\n      attributes {\n        ${tableSchema.attributes
          .map((attr: any) => this.sanitizeFieldName(attr.identifier))
          .join('\n        ')}\n      }`
      : ''

    return baseFields + attributeFields
  }

  /**
   * Sanitize field names for GraphQL compatibility
   * Remove dots and other invalid characters
   */
  private sanitizeFieldName(fieldName: string): string {
    return fieldName
      .replace(/\./g, '_') // Replace dots with underscores
      .replace(/[^a-zA-Z0-9_]/g, '_') // Replace other invalid chars with underscores
      .replace(/^[^a-zA-Z_]/, '_') // Ensure it starts with a letter or underscore
  }

  private generateValidationFields(): string {
    return `
      severity
      context
      suggestions`
  }

  private generateVariableProperties(tableSchema: any, _operation: 'create' | 'update'): Record<string, any> {
    const properties: Record<string, any> = {}

    if (tableSchema.attributes) {
      for (const attr of tableSchema.attributes) {
        const sanitizedField = this.sanitizeFieldName(attr.identifier)
        properties[sanitizedField] = {
          type: this.mapTypeToJsonSchema(attr.type),
          description: attr.description
        }
      }
    }

    return properties
  }

  private generateFilterProperties(tableSchema: any): Record<string, any> {
    const properties: Record<string, any> = {
      ids: { type: 'array', items: { type: 'string' } },
      createdAfter: { type: 'string', format: 'date-time' },
      createdBefore: { type: 'string', format: 'date-time' },
      updatedAfter: { type: 'string', format: 'date-time' },
      updatedBefore: { type: 'string', format: 'date-time' }
    }

    if (tableSchema.attributes) {
      for (const attr of tableSchema.attributes) {
        const sanitizedField = this.sanitizeFieldName(attr.identifier)
        properties[sanitizedField] = {
          type: this.mapTypeToJsonSchema(attr.type),
          description: `Filter by ${attr.identifier}`
        }
      }
    }

    return properties
  }

  private generateSearchFilterProperties(tableSchema: any): Record<string, any> {
    return {
      ...this.generateFilterProperties(tableSchema),
      tags: { type: 'array', items: { type: 'string' } },
      hasRelations: { type: 'boolean' },
      relationTypes: { type: 'array', items: { type: 'string' } }
    }
  }

  private getRequiredFields(tableSchema: any, operation: 'create' | 'update'): string[] {
    if (!tableSchema.attributes) return []

    return tableSchema.attributes
      .filter((attr: any) => operation === 'create' && attr.required)
      .map((attr: any) => this.sanitizeFieldName(attr.identifier))
  }

  private getFieldNames(tableSchema: any): string[] {
    const baseFields = ['id', 'createdAt', 'updatedAt']

    if (tableSchema.attributes) {
      return [...baseFields, ...tableSchema.attributes.map((attr: any) => this.sanitizeFieldName(attr.identifier))]
    }

    return baseFields
  }

  private mapTypeToJsonSchema(type: string): string {
    const typeMap: Record<string, string> = {
      'string': 'string',
      'integer': 'integer',
      'number': 'number',
      'boolean': 'boolean',
      'array': 'array',
      'object': 'object'
    }

    return typeMap[type?.toLowerCase()] || 'string'
  }

  private calculateComplexityScore(query: string): number {
    // Simple complexity calculation based on query features
    let score = 1

    if (query.includes('pagination')) score += 1
    if (query.includes('filter')) score += 1
    if (query.includes('sort')) score += 1
    if (query.includes('relations')) score += 2
    if (query.includes('search')) score += 2
    if (query.includes('subscription')) score += 3
    if (query.includes('batch')) score += 2

    return Math.min(score, 10)
  }

  private extractRequiredVariables(query: string): string[] {
    // Extract required variables from GraphQL query
    const requiredVars: string[] = []
    const regex = /\$(\w+):\s*(\w+)!/g
    let match

    while ((match = regex.exec(query)) !== null) {
      if (match[1]) {
        requiredVars.push(match[1])
      }
    }

    return requiredVars
  }

  // Utility methods for case conversion
  private toCamelCase(str: string): string {
    return str.replace(/-([a-z])/g, (g) => g[1]?.toUpperCase() || g)
  }

  private toPascalCase(str: string): string {
    const camel = this.toCamelCase(str)
    return camel.charAt(0).toUpperCase() + camel.slice(1)
  }

  // Additional template generators for other operations...

  private async generateUpdateTemplate(
    tableIdentifier: string,
    tableNameCamel: string,
    tableNamePascal: string,
    tableSchema: any,
    _includeValidation: boolean
  ) {
    return {
      identifier: `update-${tableIdentifier}-enhanced`,
      name: `Update ${tableNamePascal} (Enhanced)`,
      operationType: 'mutation',
      description: `Update ${tableIdentifier} record with partial updates and optimistic concurrency control`,
      query: `mutation Update${tableNamePascal}Enhanced(
  $id: ID!,
  $input: Update${tableNamePascal}Input!,
  $version: String,
  $ifMatch: String
) {
  update${tableNamePascal}(
    id: $id,
    input: $input,
    version: $version,
    ifMatch: $ifMatch
  ) {
    success
    ${tableNameCamel} {
      ${this.generateOutputFields(tableSchema)}
    }
    changes {
      field
      oldValue
      newValue
    }
    errors {
      message
      field
      code
    }
    metadata {
      version
      updatedAt
      updatedBy
    }
  }
}`,
      variables: {
        id: { type: 'string', description: 'Record ID to update' },
        input: {
          type: 'object',
          description: 'Fields to update',
          properties: this.generateVariableProperties(tableSchema, 'update')
        },
        version: { type: 'string', description: 'Expected version for optimistic locking' },
        ifMatch: { type: 'string', description: 'ETag for conditional updates' }
      }
    }
  }

  private async generateDeleteTemplate(
    tableIdentifier: string,
    _tableNameCamel: string,
    tableNamePascal: string
  ) {
    return {
      identifier: `delete-${tableIdentifier}-enhanced`,
      name: `Delete ${tableNamePascal} (Enhanced)`,
      operationType: 'mutation',
      description: `Delete ${tableIdentifier} record with confirmation and audit trail`,
      query: `mutation Delete${tableNamePascal}Enhanced(
  $id: ID!,
  $confirm: Boolean = false,
  $reason: String
) {
  delete${tableNamePascal}(id: $id, confirm: $confirm, reason: $reason) {
    success
    deletedId: id
    deletedAt
    audit {
      reason
      deletedBy
      backup {
        location
        retention
      }
    }
    errors {
      message
      code
    }
  }
}`,
      variables: {
        id: { type: 'string', description: 'Record ID to delete' },
        confirm: { type: 'boolean', description: 'Confirmation flag', default: false },
        reason: { type: 'string', description: 'Reason for deletion' }
      }
    }
  }

  private async generateDeleteCascadeTemplate(
    tableIdentifier: string,
    _tableNameCamel: string,
    tableNamePascal: string
  ) {
    return {
      identifier: `delete-cascade-${tableIdentifier}-enhanced`,
      name: `Delete ${tableNamePascal} Cascade (Enhanced)`,
      operationType: 'mutation',
      description: `Delete ${tableIdentifier} record and all related records`,
      query: `mutation DeleteCascade${tableNamePascal}Enhanced(
  $id: ID!,
  $dryRun: Boolean = false,
  $maxDepth: Int = 3
) {
  deleteCascade${tableNamePascal}(
    id: $id,
    dryRun: $dryRun,
    maxDepth: $maxDepth
  ) {
    success
    impact {
      affectedTables
      totalRecords
      dependencies {
        table
        count
        depth
      }
    }
    executed @skip(if: $dryRun) {
      deletedIds
      deletedAt
      transactionId
    }
    errors {
      message
      code
      blockers {
        table
        count
        reason
      }
    }
  }
}`,
      variables: {
        id: { type: 'string', description: 'Record ID to delete' },
        dryRun: { type: 'boolean', description: 'Preview mode', default: false },
        maxDepth: { type: 'integer', description: 'Maximum cascade depth', default: 3 }
      }
    }
  }

  private async generateFilterTemplate(
    tableIdentifier: string,
    tableNameCamel: string,
    tableNamePascal: string,
    tableSchema: any
  ) {
    return {
      identifier: `filter-${tableIdentifier}-enhanced`,
      name: `Filter ${tableNamePascal} (Enhanced)`,
      operationType: 'query',
      description: `Advanced filtering for ${tableIdentifier} records with faceted search`,
      query: `query Filter${tableNamePascal}Enhanced(
  $where: ${tableNamePascal}WhereInput!,
  $orderBy: [${tableNamePascal}OrderByInput!],
  $take: Int = 20,
  $skip: Int = 0,
  $facets: [String!]
) {
  ${tableNameCamel}s(
    where: $where,
    orderBy: $orderBy,
    take: $take,
    skip: $skip
  ) {
    items {
      ${this.generateOutputFields(tableSchema, true)}
    }

    count
    hasMore

    facets(fields: $facets) {
      field
      values {
        value
        count
        percentage
      }
    }

    aggregations {
      field
      min
      max
      avg
      sum
      count
      distinctCount
    }
  }
}`,
      variables: {
        where: {
          type: 'object',
          description: 'Complex filtering conditions',
          properties: this.generateWhereProperties(tableSchema)
        },
        orderBy: {
          type: 'array',
          description: 'Sorting options',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              direction: { type: 'string', enum: ['ASC', 'DESC'] }
            }
          }
        }
      }
    }
  }

  private async generateBatchUpdateTemplate(
    tableIdentifier: string,
    _tableNameCamel: string,
    tableNamePascal: string,
    tableSchema: any
  ) {
    return {
      identifier: `batch-update-${tableIdentifier}-enhanced`,
      name: `Batch Update ${tableNamePascal} (Enhanced)`,
      operationType: 'mutation',
      description: `Update multiple ${tableIdentifier} records with batch processing`,
      query: `mutation BatchUpdate${tableNamePascal}Enhanced(
  $updates: [${tableNamePascal}UpdateInput!]!,
  $options: BatchUpdateOptionsInput
) {
  batchUpdate${tableNamePascal}(updates: $updates, options: $options) {
    success
    totalItems
    processedItems

    results {
      id
      success
      version
      changes {
        field
        oldValue
        newValue
      }
      errors {
        message
        field
        code
      }
    }

    summary {
      successful
      failed
      unchanged
      conflicts
    }

    transaction {
      id
      status
      rollbackInfo
    }
  }
}`,
      variables: {
        updates: {
          type: 'array',
          description: 'Array of update operations',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              data: {
                type: 'object',
                properties: this.generateVariableProperties(tableSchema, 'update')
              },
              version: { type: 'string' }
            }
          }
        }
      }
    }
  }

  private async generateBatchDeleteTemplate(
    tableIdentifier: string,
    _tableNameCamel: string,
    tableNamePascal: string
  ) {
    return {
      identifier: `batch-delete-${tableIdentifier}-enhanced`,
      name: `Batch Delete ${tableNamePascal} (Enhanced)`,
      operationType: 'mutation',
      description: `Delete multiple ${tableIdentifier} records in batch`,
      query: `mutation BatchDelete${tableNamePascal}Enhanced(
  $ids: [ID!]!,
  $where: ${tableNamePascal}WhereInput,
  $options: BatchDeleteOptionsInput
) {
  batchDelete${tableNamePascal}(ids: $ids, where: $where, options: $options) {
    success
    deletedCount

    results {
      id
      success
      deletedAt
      errors {
        message
        code
      }
    }

    audit {
      operation
      deletedBy
      reason
      backup {
        location
        retention
      }
    }

    errors {
      message
      code
      failedIds
    }
  }
}`,
      variables: {
        ids: {
          type: 'array',
          description: 'Array of IDs to delete',
          items: { type: 'string' }
        },
        where: {
          type: 'object',
          description: 'Alternative: delete by criteria'
        }
      }
    }
  }

  private async generateRelationshipTemplate(
    tableIdentifier: string,
    tableNameCamel: string,
    tableNamePascal: string
  ) {
    return {
      identifier: `${tableIdentifier}-relationships-enhanced`,
      name: `${tableNamePascal} Relationships (Enhanced)`,
      operationType: 'query',
      description: `Query relationships for ${tableIdentifier} records with graph traversal`,
      query: `query ${tableNamePascal}RelationshipsEnhanced(
  $id: ID!,
  $relationTypes: [String!],
  $direction: RelationDirection = BOTH,
  $depth: Int = 1,
  $filter: RelationFilterInput
) {
  ${tableNameCamel}(id: $id) {
    id
    relations(
      types: $relationTypes,
      direction: $direction,
      depth: $depth,
      filter: $filter
    ) {
      path {
        node {
          id
          nodeType
          content
        }
        relationship {
          id
          type
          strength
          properties
          direction
        }
      }

      summary {
        totalRelations
        typeDistribution {
          type
          count
        }
        depthDistribution {
          depth
          count
        }
      }

      graph {
        nodes {
          id
          type
          properties
        }
        edges {
          source
          target
          type
          weight
        }
      }
    }
  }
}`,
      variables: {
        id: { type: 'string', description: 'Root node ID' },
        relationTypes: {
          type: 'array',
          description: 'Filter by relation types',
          items: { type: 'string' }
        },
        direction: {
          type: 'string',
          enum: ['IN', 'OUT', 'BOTH'],
          default: 'BOTH'
        },
        depth: { type: 'integer', minimum: 1, maximum: 5, default: 1 }
      }
    }
  }

  private async generateNestedQueryTemplate(
    tableIdentifier: string,
    tableNameCamel: string,
    tableNamePascal: string,
    tableSchema: any
  ) {
    return {
      identifier: `${tableIdentifier}-nested-query-enhanced`,
      name: `${tableNamePascal} Nested Query (Enhanced)`,
      operationType: 'query',
      description: `Complex nested query for ${tableIdentifier} with related data`,
      query: `query ${tableNamePascal}NestedQueryEnhanced(
  $filter: ${tableNamePascal}FilterInput,
  $includeNodes: Boolean = false,
  $includeAttributes: Boolean = false,
  $includeHistory: Boolean = false,
  $includeAnalytics: Boolean = false
) {
  ${tableNameCamel}s(filter: $filter) {
    items {
      ${this.generateOutputFields(tableSchema, true)}

      # Related nodes (conditional)
      relatedNodes @include(if: $includeNodes) {
        type
        items {
          id
          content
          relationship {
            type
            strength
          }
        }
      }

      # Attributes (conditional)
      attributes @include(if: $includeAttributes) {
        key
        value
        type
        metadata
      }

      # History (conditional)
      history @include(if: $includeHistory) {
        version
        changes {
          field
          oldValue
          newValue
          timestamp
          user
        }
      }

      # Analytics (conditional)
      analytics @include(if: $includeAnalytics) {
        views
        lastAccessed
        popularity
        tags
      }
    }

    pagination {
      total
      hasNextPage
    }

    related {
      summary {
        totalNodes
        relationshipCounts
      }
    }
  }
}`,
      variables: {
        filter: {
          type: 'object',
          description: 'Main query filter'
        },
        includeRelated: {
          type: 'object',
          description: 'What related data to include',
          properties: {
            nodes: { type: 'boolean', default: false },
            attributes: { type: 'boolean', default: false },
            history: { type: 'boolean', default: false },
            analytics: { type: 'boolean', default: false }
          }
        }
      }
    }
  }

  private async generateChangeStreamTemplate(
    tableIdentifier: string,
    tableNameCamel: string,
    tableNamePascal: string
  ) {
    return {
      identifier: `${tableIdentifier}-change-stream-enhanced`,
      name: `${tableNamePascal} Change Stream (Enhanced)`,
      operationType: 'subscription',
      description: `Real-time change stream for ${tableIdentifier} with filtering and aggregation`,
      query: `subscription ${tableNamePascal}ChangeStreamEnhanced(
  $filter: ${tableNamePascal}ChangeFilterInput,
  $aggregateBy: String,
  $bufferTime: Int = 1000
) {
  ${tableNameCamel}ChangeStream(
    filter: $filter,
    aggregateBy: $aggregateBy,
    bufferTime: $bufferTime
  ) {
    eventType
    timestamp
    batchId

    changes {
      id
      changeType
      data {
        ${this.generateOutputFields({}, true)}
      }
      metadata {
        version
        source
        user
      }
    }

    aggregations @include(if: $aggregateBy) {
      field
      count
      summary
    }

    stream {
      position
      lag
      throughput
    }
  }
}`,
      variables: {
        filter: {
          type: 'object',
          description: 'Filter for change events'
        },
        aggregateBy: {
          type: 'string',
          description: 'Field to aggregate changes by'
        },
        bufferTime: {
          type: 'integer',
          description: 'Buffer time in milliseconds',
          default: 1000
        }
      }
    }
  }

  private generateWhereProperties(tableSchema: any): Record<string, any> {
    const properties: Record<string, any> = {
      AND: { type: 'array', items: { $ref: '#' } },
      OR: { type: 'array', items: { $ref: '#' } },
      NOT: { $ref: '#' },
      id: {
        type: 'object',
        properties: {
          equals: { type: 'string' },
          in: { type: 'array', items: { type: 'string' } },
          notIn: { type: 'array', items: { type: 'string' } }
        }
      }
    }

    if (tableSchema.attributes) {
      for (const attr of tableSchema.attributes) {
        const sanitizedField = this.sanitizeFieldName(attr.identifier)
        properties[sanitizedField] = this.generateFieldWhereClause(attr.type)
      }
    }

    return properties
  }

  private generateFieldWhereClause(type: string): any {
    const baseClause = {
      equals: { type: this.mapTypeToJsonSchema(type) },
      not: { type: this.mapTypeToJsonSchema(type) },
      in: { type: 'array', items: { type: this.mapTypeToJsonSchema(type) } },
      notIn: { type: 'array', items: { type: this.mapTypeToJsonSchema(type) } }
    }

    if (type === 'string') {
      return {
        ...baseClause,
        contains: { type: 'string' },
        startsWith: { type: 'string' },
        endsWith: { type: 'string' },
        mode: { type: 'string', enum: ['default', 'insensitive'] }
      }
    }

    if (type === 'number' || type === 'integer') {
      return {
        ...baseClause,
        lt: { type: this.mapTypeToJsonSchema(type) },
        lte: { type: this.mapTypeToJsonSchema(type) },
        gt: { type: this.mapTypeToJsonSchema(type) },
        gte: { type: this.mapTypeToJsonSchema(type) }
      }
    }

    return baseClause
  }
}
/**
 * Schema Discovery Service
 * Helps users discover available GraphQL operations and their variants
 */
interface DiscoveryTypeRef {
  kind?: string
  name?: string | null
  ofType?: DiscoveryTypeRef | null
}

interface DiscoveryArgument {
  name: string
  type: DiscoveryTypeRef
  description?: string | null
  defaultValue?: unknown
}

interface DiscoveryField {
  name: string
  description?: string | null
  type: DiscoveryTypeRef
  args?: readonly DiscoveryArgument[]
}

interface DiscoveryType {
  name: string
  kind: string
  fields?: readonly DiscoveryField[]
  inputFields?: readonly DiscoveryArgument[]
}

interface DiscoverySchema {
  types: readonly DiscoveryType[]
}

export class SchemaDiscoveryService {
  private schema: DiscoverySchema

  constructor(schema: DiscoverySchema) {
    // schema is now the introspection result, not a GraphQL schema object
    this.schema = schema
  }

  /**
   * Discover all variations of a search operation
   */
  async discoverSearchOperations(baseOperation: string = 'searchNodes'): Promise<SearchOperationDiscovery> {
    console.log(`🔍 Discovering variations of ${baseOperation}`)

    // The schema is now the introspection result directly
    if (!this.schema?.types) {
      throw new Error('Invalid schema: types not found in introspection result')
    }

    console.log(`📊 Schema contains ${this.schema.types.length} types`)

    const queryType = this.schema.types.find((type) => type && type.name === 'Query')

    if (!queryType) {
      console.log(
        '❌ Query type not found in schema types:',
        this.schema.types.map((t) => t?.name).filter(Boolean),
      )
      throw new Error('Query type not found in schema')
    }

    if (queryType.kind !== 'OBJECT') {
      console.log(`❌ Query type has wrong kind: ${queryType.kind}, expected: OBJECT`)
      throw new Error('Query type is not an OBJECT type')
    }

    if (!queryType.fields) {
      console.log('❌ Query type has no fields')
      throw new Error('Query type has no fields')
    }

    console.log(`📋 Query type has ${queryType.fields.length} fields`)

    // Find all search-related operations with null safety
    const searchOperations = queryType.fields.filter(
      (field) =>
        field?.name && (field.name.toLowerCase().includes('search') || field.name.toLowerCase().includes('node')),
    )

    console.log(
      `🔍 Found ${searchOperations.length} search-related operations:`,
      searchOperations.map((op) => op.name),
    )

    const operations: SearchOperation[] = []

    for (const operation of searchOperations) {
      const operationInfo: SearchOperation = {
        name: operation.name,
        description: operation.description || '',
        parameters: this.extractParameters(operation),
        examples: await this.generateExamples(operation.name),
        complexity: this.assessComplexity(operation),
        useCases: this.identifyUseCases(operation.name, operation.description || ''),
      }

      operations.push(operationInfo)
    }

    return {
      baseOperation,
      operations,
      recommendedForNewUsers: operations.filter((op) => op.complexity === 'simple'),
      advancedOperations: operations.filter((op) => op.complexity === 'complex'),
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Discover all filter options for SearchNodesFilter
   */
  async discoverFilterOptions(): Promise<FilterDiscovery> {
    console.log(`🔍 Discovering SearchNodesFilter options`)

    // The schema is now the introspection result directly
    if (!this.schema?.types) {
      throw new Error('Invalid schema: types not found in introspection result')
    }

    const filterType = this.schema.types.find((type) => type.name === 'SearchNodesFilter')

    if (!filterType || filterType.kind !== 'INPUT_OBJECT' || !filterType.inputFields) {
      throw new Error('SearchNodesFilter type not found in schema')
    }

    const filterOptions: FilterOption[] = []

    for (const field of filterType.inputFields) {
      const option: FilterOption = {
        name: field.name,
        type: this.getTypeName(field.type),
        description: field.description || '',
        required: this.isRequired(field.type),
        examples: this.generateFilterExamples(field.name, field.type),
        supportedOperators: this.getSupportedOperators(field.name),
      }

      filterOptions.push(option)
    }

    return {
      filterType: 'SearchNodesFilter',
      options: filterOptions,
      basicOptions: filterOptions.filter((opt) => ['search', 'tableId', 'content'].includes(opt.name)),
      advancedOptions: filterOptions.filter((opt) =>
        ['query', 'attributeFilters', 'relationFilters'].includes(opt.name),
      ),
      examples: this.generateFilterCombinationExamples(),
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Generate comprehensive search examples with explanations
   */
  async generateSearchExamples(tableId: string): Promise<SearchExample[]> {
    const examples: SearchExample[] = [
      {
        name: 'Basic Text Search',
        description: 'Simple text search across all node content',
        query: `query BasicSearch($filter: SearchNodesFilter!) {
  searchNodes(filter: $filter) {
    nodes { id title content }
    totalCount
  }
}`,
        variables: {
          filter: { tableId, search: 'engineer' },
        },
        explanation: 'Searches for the word "engineer" in all node content and attributes',
      },

      {
        name: 'Advanced Query Syntax',
        description: 'Natural language query with operators',
        query: `query AdvancedSearch($filter: SearchNodesFilter!) {
  searchNodes(filter: $filter) {
    nodes { id title content }
    totalCount
  }
}`,
        variables: {
          filter: {
            tableId,
            query: 'age:25..35 AND department:"Engineering" AND name:john*',
          },
        },
        explanation: 'Finds people aged 25-35, in Engineering department, with names starting with "john"',
      },

      {
        name: 'Attribute-Based Filtering',
        description: 'Filter using structured attribute filters',
        query: `query AttributeSearch($filter: SearchNodesFilter!) {
  searchNodes(filter: $filter) {
    nodes { id title content attributes }
    totalCount
  }
}`,
        variables: {
          filter: {
            tableId,
            attributeFilters: [
              { attributeId: 'age', value: '30', operator: 'GTE' },
              { attributeId: 'department', value: 'Engineering', operator: 'EQUALS' },
            ],
          },
        },
        explanation: 'Structured filtering for people aged 30+ in Engineering department',
      },

      {
        name: 'Relationship-Based Search',
        description: 'Find nodes based on their connections',
        query: `query RelationSearch($filter: SearchNodesFilter!) {
  searchNodes(filter: $filter) {
    nodes { id title content }
    totalCount
  }
}`,
        variables: {
          filter: {
            tableId,
            relationFilters: [
              {
                relationTypeId: 'employs',
                direction: 'INCOMING',
                targetNodeId: 'company-123',
              },
            ],
          },
        },
        explanation: 'Finds people employed by company-123',
      },

      {
        name: 'Advanced Search with Sorting',
        description: 'Advanced search operation with multi-criteria sorting',
        query: `query AdvancedSearchWithSort($filter: SearchNodesFilter!, $sort: MultiCriteriaSortInput) {
  searchNodesAdvanced(filter: $filter, sort: $sort) {
    nodes { id title content }
    totalCount
    sortingMetadata {
      appliedCriteria
      performanceStats
    }
  }
}`,
        variables: {
          filter: { tableId, search: 'engineer' },
          sort: {
            primary: { field: 'relevanceScore', direction: 'DESC' },
            secondary: { field: 'createdAt', direction: 'ASC' },
          },
        },
        explanation: 'Advanced search with relevance-based sorting and creation date as secondary',
      },
    ]

    return examples
  }

  // Helper methods
  private extractParameters(operation: DiscoveryField): OperationParameter[] {
    if (!operation.args || !Array.isArray(operation.args)) {
      return []
    }

    return operation.args
      .filter((arg) => arg?.name && arg.type) // Filter out null/invalid args
      .map((arg) => ({
        name: arg.name,
        type: this.getTypeName(arg.type),
        required: this.isRequired(arg.type),
        description: arg.description || '',
      }))
  }

  private async generateExamples(operationName: string): Promise<string[]> {
    const examples: { [key: string]: string[] } = {
      searchNodes: [
        'Basic text search with pagination',
        'Content-specific search with filters',
        'Table-scoped search operations',
      ],
      searchNodesAdvanced: [
        'Multi-criteria sorting with performance insights',
        'Complex query patterns with optimization',
        'Advanced analytics and metadata',
      ],
      nodesWithSorting: [
        'Custom sort functions with computed fields',
        'Performance-optimized sorting strategies',
        'Extensible sorting capabilities',
      ],
    }

    return examples[operationName] || ['Basic usage example']
  }

  private assessComplexity(operation: DiscoveryField): 'simple' | 'medium' | 'complex' {
    const paramCount = operation.args?.length || 0
    const hasAdvancedSorting = operation.name.includes('Advanced') || operation.name.includes('Sorting')
    const hasCustom = operation.name.includes('Custom')

    if (hasCustom || hasAdvancedSorting) return 'complex'
    if (paramCount > 3) return 'medium'
    return 'simple'
  }

  private identifyUseCases(name: string, _description: string): string[] {
    const useCases: { [key: string]: string[] } = {
      searchNodes: ['General content search', 'User directory lookups', 'Product catalog search'],
      searchNodesAdvanced: [
        'Performance-critical applications',
        'Complex data analysis',
        'Multi-dimensional sorting needs',
      ],
      nodesWithSorting: ['Custom business logic sorting', 'Dynamic ranking systems', 'Extensible sort capabilities'],
    }

    return useCases[name] || ['General purpose operations']
  }

  private getTypeName(type: DiscoveryTypeRef | null | undefined): string {
    // Add null safety for type object
    if (!type) {
      return 'Unknown'
    }

    if (type.kind === 'NON_NULL') {
      return `${this.getTypeName(type.ofType)}!`
    }
    if (type.kind === 'LIST') {
      return `[${this.getTypeName(type.ofType)}]`
    }
    return type.name || 'Unknown'
  }

  private isRequired(type: DiscoveryTypeRef | null | undefined): boolean {
    return !!(type && type.kind === 'NON_NULL')
  }

  private generateFilterExamples(fieldName: string, _type: DiscoveryTypeRef | null | undefined): string[] {
    const examples: { [key: string]: string[] } = {
      search: ['"engineer"', '"senior developer"', '"project manager"'],
      content: ['"React component"', '"API documentation"', '"user guide"'],
      query: ['age:25..35', 'department:"Engineering" AND location:"SF"', 'salary:>50000 AND experience:>=3'],
      tableId: ['"person-table"', '"product-table"', '"project-table"'],
      attributeFilters: ['[{attributeId: "age", value: "30", operator: "GTE"}]'],
      relationFilters: ['[{relationTypeId: "employs", direction: "INCOMING"}]'],
    }

    return examples[fieldName] || ['Basic example']
  }

  private getSupportedOperators(fieldName: string): string[] {
    const operators: { [key: string]: string[] } = {
      search: ['CONTAINS', 'EQUALS'],
      content: ['CONTAINS', 'EQUALS'],
      query: ['NATURAL_LANGUAGE'],
      attributeFilters: ['EQUALS', 'CONTAINS', 'GTE', 'LTE', 'GT', 'LT', 'RANGE'],
      relationFilters: ['EXISTS', 'EQUALS'],
    }

    return operators[fieldName] || ['EQUALS']
  }

  private generateFilterCombinationExamples(): FilterCombinationExample[] {
    return [
      {
        name: 'Text + Attribute Combination',
        description: 'Combine text search with attribute filtering',
        example: {
          search: 'engineer',
          attributeFilters: [{ attributeId: 'experience', value: '5', operator: 'GTE' }],
        },
      },
      {
        name: 'Query Syntax + Relationships',
        description: 'Advanced query with relationship constraints',
        example: {
          query: 'department:"Engineering" AND level:senior',
          relationFilters: [{ relationTypeId: 'reports_to', direction: 'OUTGOING' }],
        },
      },
      {
        name: 'Multi-Filter Complex Search',
        description: 'Comprehensive filtering across all dimensions',
        example: {
          search: 'technical',
          query: 'experience:>=3 AND location:remote',
          attributeFilters: [{ attributeId: 'skills', value: 'react', operator: 'CONTAINS' }],
          relationFilters: [{ relationTypeId: 'works_on', direction: 'OUTGOING' }],
        },
      },
    ]
  }
}

// Type definitions
export interface SearchOperationDiscovery {
  baseOperation: string
  operations: SearchOperation[]
  recommendedForNewUsers: SearchOperation[]
  advancedOperations: SearchOperation[]
  timestamp: string
}

export interface SearchOperation {
  name: string
  description: string
  parameters: OperationParameter[]
  examples: string[]
  complexity: 'simple' | 'medium' | 'complex'
  useCases: string[]
}

export interface OperationParameter {
  name: string
  type: string
  required: boolean
  description: string
}

export interface FilterDiscovery {
  filterType: string
  options: FilterOption[]
  basicOptions: FilterOption[]
  advancedOptions: FilterOption[]
  examples: FilterCombinationExample[]
  timestamp: string
}

export interface FilterOption {
  name: string
  type: string
  description: string
  required: boolean
  examples: string[]
  supportedOperators: string[]
}

export interface FilterCombinationExample {
  name: string
  description: string
  example: Record<string, unknown>
}

export interface SearchExample {
  name: string
  description: string
  query: string
  variables: Record<string, unknown>
  explanation: string
}

export interface OperationDiscovery {
  operationName: string
  variations: string[]
  parameters: OperationParameter[]
  examples: SearchExample[]
}

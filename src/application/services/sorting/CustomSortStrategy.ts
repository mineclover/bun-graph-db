import type {
  EnhancedSortOption,
  SortContext,
  SortResult,
} from '@/domain/value-objects/SortStrategy.js'
import { SortStrategy } from '@/domain/value-objects/SortStrategy.js'
import {
  type CustomSortFunction,
  CustomSortFunctionRegistry,
  globalCustomSortRegistry,
} from './CustomSortFunctionRegistry.js'

/**
 * Sort strategy that integrates with the CustomSortFunctionRegistry
 * to enable extensible custom sort operations
 */
export class CustomSortStrategy extends SortStrategy {
  constructor(private readonly registry: CustomSortFunctionRegistry = globalCustomSortRegistry) {
    super()
  }

  override canHandle(field: string, dataType: string): boolean {
    // Check if any registered custom function can handle this field/dataType combination
    const applicableFunctions = this.registry.getByDataType(dataType)
    return applicableFunctions.length > 0 || field.startsWith('_custom_')
  }

  buildSortClause(field: string, direction: 'asc' | 'desc', context: SortContext): SortResult {
    // For basic sort clause, try to find a suitable custom function
    const customFunction = this.findBestCustomFunction(field, context, {})

    if (!customFunction) {
      throw new Error(`No custom sort function available for field '${field}'`)
    }

    try {
      return this.registry.execute(customFunction.id, field, direction, context)
    } catch (error) {
      throw new Error(
        `Custom sort function '${customFunction.id}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  override buildEnhancedSortClause(
    sortOption: EnhancedSortOption,
    context: SortContext
  ): SortResult {
    const { field, direction, customComparator } = sortOption

    // If customComparator is provided, it should contain the custom function identifier and parameters
    let functionId: string
    let parameters: Record<string, any> = {}

    if (customComparator) {
      try {
        const customConfig =
          typeof customComparator === 'string' ? JSON.parse(customComparator) : customComparator

        if (typeof customConfig === 'object' && customConfig.functionId) {
          functionId = customConfig.functionId
          parameters = customConfig.parameters || {}
        } else {
          throw new Error('Invalid custom comparator configuration')
        }
      } catch (error) {
        throw new Error(
          `Failed to parse custom comparator: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    } else {
      // Find best custom function automatically
      const customFunction = this.findBestCustomFunction(field, context, {})
      if (!customFunction) {
        throw new Error(`No custom sort function available for field '${field}'`)
      }
      functionId = customFunction.id
    }

    try {
      return this.registry.execute(functionId, field, direction, context, parameters)
    } catch (error) {
      throw new Error(
        `Custom sort function '${functionId}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  getPriority(): number {
    // Medium priority - should be checked after specialized strategies but before generic ones
    return 40
  }

  /**
   * Find the best custom function for a given field and context
   */
  private findBestCustomFunction(
    field: string,
    context: SortContext,
    _parameters: Record<string, any>
  ): CustomSortFunction | null {
    // First, try to find by exact field name match in function tags
    let candidates = this.registry.search(field)

    if (candidates.length === 0) {
      // Try to find by data type
      const dataType = this.detectDataType(field, context)
      candidates = this.registry.getByDataType(dataType)
    }

    if (candidates.length === 0) {
      return null
    }

    // Return the highest priority function
    return candidates.reduce((best, current) => (current.priority > best.priority ? current : best))
  }

  /**
   * Detect data type for a field from context
   */
  protected override detectDataType(field: string, context: SortContext): string {
    // Check system fields
    if (['created_at', 'updated_at'].includes(field)) {
      return 'datetime'
    }
    if (['title', 'content'].includes(field)) {
      return 'string'
    }

    // Check available attributes
    const attribute = context.availableAttributes.find((attr) => attr.identifier === field)
    return attribute?.dataType || 'string'
  }

  /**
   * Get all available custom functions for a data type
   */
  getAvailableCustomFunctions(dataType?: string): CustomSortFunction[] {
    if (dataType) {
      return this.registry.getByDataType(dataType)
    }
    return this.registry.getAll()
  }

  /**
   * Get custom function by ID
   */
  getCustomFunction(functionId: string): CustomSortFunction | undefined {
    return this.registry.get(functionId)
  }

  /**
   * Search for custom functions
   */
  searchCustomFunctions(query: string): CustomSortFunction[] {
    return this.registry.search(query)
  }

  /**
   * Get custom functions by tag
   */
  getCustomFunctionsByTag(tag: string): CustomSortFunction[] {
    return this.registry.getByTag(tag)
  }

  /**
   * Get usage statistics for custom functions
   */
  getCustomFunctionStats(functionId?: string) {
    if (functionId) {
      return this.registry.getUsageStats(functionId)
    }
    return this.registry.getAllUsageStats()
  }

  /**
   * Get registry information
   */
  getRegistryInfo() {
    return this.registry.getInfo()
  }
}

/**
 * Register all built-in custom sort functions
 */
export function registerAllBuiltInCustomSortFunctions(
  registry: CustomSortFunctionRegistry = globalCustomSortRegistry
): void {
  // Natural string sorting (alphanumeric)
  registry.register({
    id: 'natural-string',
    name: 'Natural String Sort',
    description: 'Sorts strings naturally (e.g., "item2" before "item10")',
    supportedDataTypes: ['string', 'text'],
    priority: 60,
    version: '1.0.0',
    tags: ['string', 'natural', 'alphanumeric'],
    handler: (field, direction, context) => {
      const _collator = new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: 'base',
      })

      const _sortFn = direction === 'asc' ? 1 : -1

      return {
        sqlClause: `ORDER BY ${context.nodeAlias}.${field} COLLATE NOCASE ${direction.toUpperCase()}`,
        parameters: [],
      }
    },
    examples: [
      {
        title: 'Sort file names naturally',
        description: 'Sorts filenames like file1, file2, file10 in correct order',
        field: 'filename',
        direction: 'asc',
        expectedSql: 'ORDER BY n.filename COLLATE NOCASE ASC',
      },
    ],
  })

  // Length-based sorting
  registry.register({
    id: 'length-sort',
    name: 'Length-based Sort',
    description: 'Sorts by string length first, then alphabetically',
    supportedDataTypes: ['string', 'text'],
    priority: 45,
    version: '1.0.0',
    tags: ['string', 'length'],
    parameters: {
      secondary_sort: {
        name: 'secondary_sort',
        type: 'string',
        required: false,
        description: 'Secondary sort direction: asc, desc, or none',
        defaultValue: 'asc',
        validation: {
          allowedValues: ['asc', 'desc', 'none'],
        },
      },
    },
    handler: (field, direction, context, parameters = {}) => {
      const secondarySort = parameters.secondary_sort || 'asc'
      const lengthOrder = direction === 'asc' ? 'ASC' : 'DESC'

      let clause = `LENGTH(${context.nodeAlias}.${field}) ${lengthOrder}`

      if (secondarySort !== 'none') {
        const secondaryOrder = secondarySort === 'asc' ? 'ASC' : 'DESC'
        clause += `, ${context.nodeAlias}.${field} ${secondaryOrder}`
      }

      return {
        sqlClause: `ORDER BY ${clause}`,
        parameters: [],
      }
    },
    examples: [
      {
        title: 'Sort by description length',
        description: 'Sort descriptions by length, then alphabetically',
        field: 'description',
        direction: 'asc',
        parameters: { secondary_sort: 'asc' },
        expectedSql: 'ORDER BY LENGTH(n.description) ASC, n.description ASC',
      },
    ],
  })

  // Relevance scoring
  registry.register({
    id: 'relevance-score',
    name: 'Relevance Score Sort',
    description: 'Sorts by relevance score based on search terms',
    supportedDataTypes: ['string', 'text'],
    priority: 80,
    version: '1.0.0',
    tags: ['relevance', 'search', 'scoring'],
    parameters: {
      search_terms: {
        name: 'search_terms',
        type: 'array',
        required: true,
        description: 'Array of search terms to score relevance against',
      },
      boost_exact: {
        name: 'boost_exact',
        type: 'number',
        required: false,
        description: 'Boost factor for exact matches',
        defaultValue: 2.0,
        validation: { min: 1.0, max: 10.0 },
      },
    },
    handler: (field, direction, context, parameters = {}) => {
      const searchTerms = parameters.search_terms || []
      const boostExact = parameters.boost_exact || 2.0

      if (searchTerms.length === 0) {
        throw new Error('search_terms parameter is required for relevance scoring')
      }

      // Build relevance scoring SQL
      const relevanceExpressions = searchTerms
        .map((_term: string, index: number) => {
          const paramName = `search_term_${index}`
          return `(
            CASE
              WHEN ${context.nodeAlias}.${field} LIKE '%' || $${paramName} || '%' THEN ${boostExact}
              WHEN ${context.nodeAlias}.${field} LIKE '%' || LOWER($${paramName}) || '%' THEN 1
              ELSE 0
            END
          )`
        })
        .join(' + ')

      const scoreExpression = `(${relevanceExpressions}) AS relevance_score`
      const orderDirection = direction === 'asc' ? 'ASC' : 'DESC'

      return {
        sqlClause: `ORDER BY ${scoreExpression} ${orderDirection}`,
        parameters: searchTerms,
      }
    },
    examples: [
      {
        title: 'Sort by search relevance',
        description: 'Sort content by relevance to search terms',
        field: 'content',
        direction: 'desc',
        parameters: { search_terms: ['typescript', 'sort'], boost_exact: 2.5 },
        expectedSql:
          "ORDER BY ((CASE WHEN n.content LIKE '%' || $search_term_0 || '%' THEN 2.5 WHEN n.content LIKE '%' || LOWER($search_term_0) || '%' THEN 1 ELSE 0 END) + (CASE WHEN n.content LIKE '%' || $search_term_1 || '%' THEN 2.5 WHEN n.content LIKE '%' || LOWER($search_term_1) || '%' THEN 1 ELSE 0 END)) AS relevance_score DESC",
      },
    ],
  })

  // Random sorting with seed
  registry.register({
    id: 'seeded-random',
    name: 'Seeded Random Sort',
    description: 'Random sorting with reproducible results using a seed',
    supportedDataTypes: ['*'], // Works with any data type
    priority: 30,
    version: '1.0.0',
    tags: ['random', 'seed', 'shuffle'],
    parameters: {
      seed: {
        name: 'seed',
        type: 'number',
        required: false,
        description: 'Seed value for reproducible random sorting',
        defaultValue: Date.now(),
        validation: { min: 0 },
      },
    },
    handler: (_field, direction, context, parameters = {}) => {
      const seed = parameters.seed || Date.now()

      // Use seed to create deterministic random ordering
      return {
        sqlClause: `ORDER BY (${seed} + ${context.nodeAlias}.id * 31) % 1000 ${direction === 'asc' ? 'ASC' : 'DESC'}`,
        parameters: [],
      }
    },
    examples: [
      {
        title: 'Random but reproducible order',
        description: 'Shuffle items randomly but get same order with same seed',
        field: 'id',
        direction: 'asc',
        parameters: { seed: 12345 },
        expectedSql: 'ORDER BY (12345 + n.id * 31) % 1000 ASC',
      },
    ],
  })
}

/**
 * Register a specific built-in function by name
 */
export function registerBuiltInCustomSortFunction(
  functionName: 'natural-string' | 'length-sort' | 'relevance-score' | 'seeded-random',
  registry: CustomSortFunctionRegistry = globalCustomSortRegistry
): void {
  // First register all, then keep only the requested one
  const tempRegistry = new CustomSortFunctionRegistry({ enableStats: false })
  registerAllBuiltInCustomSortFunctions(tempRegistry)

  const targetFunction = tempRegistry.get(functionName)
  if (targetFunction) {
    registry.register(targetFunction)
  } else {
    throw new Error(`Built-in function '${functionName}' not found`)
  }
}

// Export the built-in functions for testing
export const BuiltInCustomSortFunctions = {
  registerAll: registerAllBuiltInCustomSortFunctions,
  register: registerBuiltInCustomSortFunction
}

// Auto-register built-in functions
registerAllBuiltInCustomSortFunctions()

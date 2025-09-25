import { SortStrategy, type SortContext, type MultiCriteriaSortResult } from '@/domain/value-objects/SortStrategy.js'
import { NumericSortStrategy } from './NumericSortStrategy.js'
import { DateTimeSortStrategy } from './DateTimeSortStrategy.js'
import { TextSortStrategy } from './TextSortStrategy.js'
import type { AttributeTypeInfo } from '@/application/services/SearchQueryParser.js'

export interface SortOption {
  field: string
  direction: 'asc' | 'desc'
  nullHandling?: 'first' | 'last' | 'default'
}

export class SortStrategyFactory {
  private static strategies: SortStrategy[] = [
    new NumericSortStrategy(),
    new DateTimeSortStrategy(),
    new TextSortStrategy(), // TextSortStrategy has lowest priority, acts as fallback
  ]

  /**
   * Get the appropriate sort strategy for a field based on its data type
   */
  static getStrategy(field: string, availableAttributes: AttributeTypeInfo[]): SortStrategy {
    // Handle system fields
    if (['created_at', 'updated_at'].includes(field)) {
      return this.strategies.find(s => s instanceof DateTimeSortStrategy)!
    }

    if (['title', 'content'].includes(field)) {
      return this.strategies.find(s => s instanceof TextSortStrategy)!
    }

    // Find attribute info
    const attributeInfo = availableAttributes.find(attr => attr.identifier === field)
    const dataType = attributeInfo?.dataType || 'string'

    // Find the best strategy by priority
    const applicableStrategies = this.strategies.filter(strategy =>
      strategy.canHandle(field, dataType)
    )

    if (applicableStrategies.length === 0) {
      // Fallback to TextSortStrategy
      return this.strategies.find(s => s instanceof TextSortStrategy)!
    }

    // Return the strategy with highest priority
    return applicableStrategies.reduce((best, current) =>
      current.getPriority() > best.getPriority() ? current : best
    )
  }

  /**
   * Build sort clauses for multiple fields with proper priority handling
   */
  static buildMultiCriteriaSort(
    sortOptions: SortOption[],
    context: SortContext
  ): MultiCriteriaSortResult {
    if (sortOptions.length === 0) {
      return {
        sqlClause: '',
        parameters: [],
        sortFields: []
      }
    }

    const sortClauses: string[] = []
    const parameters: any[] = []
    const sortFields: string[] = []

    for (const sortOption of sortOptions) {
      try {
        const strategy = this.getStrategy(sortOption.field, context.availableAttributes)
        const result = strategy.buildSortClause(sortOption.field, sortOption.direction, context)

        if (result.sqlClause.trim()) {
          sortClauses.push(result.sqlClause)
          parameters.push(...result.parameters)
          sortFields.push(sortOption.field)
        }
      } catch (error) {
        // Skip invalid sort fields rather than failing the entire query
        console.warn(`Failed to build sort clause for field '${sortOption.field}':`, error)
        continue
      }
    }

    return {
      sqlClause: sortClauses.length > 0 ? `ORDER BY ${sortClauses.join(', ')}` : '',
      parameters,
      sortFields
    }
  }

  /**
   * Validate that all sort fields are available in the context
   */
  static validateSortOptions(
    sortOptions: SortOption[],
    availableAttributes: AttributeTypeInfo[]
  ): { valid: SortOption[]; invalid: SortOption[] } {
    const systemFields = ['created_at', 'updated_at', 'title', 'content']
    const attributeIdentifiers = availableAttributes.map(attr => attr.identifier)
    const allValidFields = [...systemFields, ...attributeIdentifiers]

    const valid: SortOption[] = []
    const invalid: SortOption[] = []

    for (const sortOption of sortOptions) {
      if (allValidFields.includes(sortOption.field)) {
        valid.push(sortOption)
      } else {
        invalid.push(sortOption)
      }
    }

    return { valid, invalid }
  }

  /**
   * Get information about available sort strategies and their capabilities
   */
  static getStrategyInfo(): {
    strategyType: string
    handledDataTypes: string[]
    priority: number
    description: string
  }[] {
    return this.strategies.map(strategy => {
      const strategyType = strategy.constructor.name
      let handledDataTypes: string[] = []
      let description = ''

      if (strategy instanceof NumericSortStrategy) {
        handledDataTypes = ['number', 'integer', 'float', 'decimal']
        description = 'Handles numeric sorting with proper type casting and null handling'
      } else if (strategy instanceof DateTimeSortStrategy) {
        handledDataTypes = ['datetime', 'date', 'timestamp']
        description = 'Handles temporal sorting with various datetime formats'
      } else if (strategy instanceof TextSortStrategy) {
        handledDataTypes = ['string', 'text', 'varchar', 'json', 'unknown']
        description = 'Handles text sorting with case-insensitive collation and natural sorting'
      }

      return {
        strategyType,
        handledDataTypes,
        priority: strategy.getPriority(),
        description
      }
    })
  }

  /**
   * Add a custom sort strategy to the factory
   */
  static addStrategy(strategy: SortStrategy): void {
    this.strategies.push(strategy)
    // Sort by priority (highest first)
    this.strategies.sort((a, b) => b.getPriority() - a.getPriority())
  }

  /**
   * Remove all custom strategies and reset to default
   */
  static resetToDefaults(): void {
    this.strategies = [
      new NumericSortStrategy(),
      new DateTimeSortStrategy(),
      new TextSortStrategy(),
    ]
  }
}
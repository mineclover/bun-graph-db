import type { AttributeTypeInfo } from '@/application/services/SearchQueryParser.js'
import type {
  EnhancedSortOption,
  MultiCriteriaSortResult,
  SortContext,
  SortStrategy,
} from '@/domain/value-objects/SortStrategy.js'
import { type AdaptiveSortResult, buildOptimizedSort, createExecutionPlan } from './AdaptiveSortEngine.js'
import { AggregateSortStrategy } from './AggregateSortStrategy.js'
import { type CachedSortOptions, type CachedSortResult, globalCachedSortEngine } from './CachedSortEngine.js'
import type { CustomSortFunction, CustomSortUsageStats } from './CustomSortFunctionRegistry.js'
import { CustomSortStrategy } from './CustomSortStrategy.js'
import { DateTimeSortStrategy } from './DateTimeSortStrategy.js'
import { NumericSortStrategy } from './NumericSortStrategy.js'
import { RelationshipSortStrategy } from './RelationshipSortStrategy.js'
import { RelevanceSortStrategy } from './RelevanceSortStrategy.js'
import { getOptimizationRecommendation } from './SortComplexityAnalyzer.js'
import type { CacheStats } from './SortResultCache.js'
import { TextSortStrategy } from './TextSortStrategy.js'

export interface SortOption {
  field: string
  direction: 'asc' | 'desc'
  nullHandling?: 'first' | 'last' | 'default'
}

const strategies: SortStrategy[] = [
  new AggregateSortStrategy(), // High priority: 75
  new RelationshipSortStrategy(), // High priority: 85
  new RelevanceSortStrategy(), // High priority: 80
  new CustomSortStrategy(), // Medium priority: 40
  new NumericSortStrategy(),
  new DateTimeSortStrategy(),
  new TextSortStrategy(), // TextSortStrategy has lowest priority, acts as fallback
]

const customSortStrategy = new CustomSortStrategy()

/**
 * Get the appropriate sort strategy for a field based on its data type
 */
export function getStrategy(field: string, availableAttributes: AttributeTypeInfo[]): SortStrategy {
  // Handle system fields
  if (['created_at', 'updated_at'].includes(field)) {
    return strategies.find((s) => s instanceof DateTimeSortStrategy)!
  }

  if (['title', 'content'].includes(field)) {
    return strategies.find((s) => s instanceof TextSortStrategy)!
  }

  // Find attribute info
  const attributeInfo = availableAttributes.find((attr) => attr.identifier === field)
  const dataType = attributeInfo?.dataType || 'string'

  // Find the best strategy by priority
  const applicableStrategies = strategies.filter((strategy) => strategy.canHandle(field, dataType))

  if (applicableStrategies.length === 0) {
    // Fallback to TextSortStrategy
    return strategies.find((s) => s instanceof TextSortStrategy)!
  }

  // Return the strategy with highest priority
  return applicableStrategies.reduce((best, current) => (current.getPriority() > best.getPriority() ? current : best))
}

/**
 * Build sort clauses for multiple fields with proper priority handling
 */
export function buildMultiCriteriaSort(sortOptions: SortOption[], context: SortContext): MultiCriteriaSortResult {
  if (sortOptions.length === 0) {
    return {
      sqlClause: '',
      parameters: [],
      sortFields: [],
    }
  }

  const sortClauses: string[] = []
  const parameters: any[] = []
  const sortFields: string[] = []

  for (const sortOption of sortOptions) {
    try {
      const strategy = getStrategy(sortOption.field, context.availableAttributes)
      const result = strategy.buildSortClause(sortOption.field, sortOption.direction, context)

      if (result.sqlClause.trim()) {
        sortClauses.push(result.sqlClause)
        parameters.push(...result.parameters)
        sortFields.push(sortOption.field)
      }
    } catch (error) {
      // Skip invalid sort fields rather than failing the entire query
      console.warn(`Failed to build sort clause for field '${sortOption.field}':`, error)
    }
  }

  return {
    sqlClause: sortClauses.length > 0 ? `ORDER BY ${sortClauses.join(', ')}` : '',
    parameters,
    sortFields,
  }
}

/**
 * Validate that all sort fields are available in the context
 */
export function validateSortOptions(
  sortOptions: SortOption[],
  availableAttributes: AttributeTypeInfo[],
): { valid: SortOption[]; invalid: SortOption[] } {
  const systemFields = ['created_at', 'updated_at', 'title', 'content']
  const attributeIdentifiers = availableAttributes.map((attr) => attr.identifier)
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
export function getStrategyInfo(): {
  strategyType: string
  handledDataTypes: string[]
  priority: number
  description: string
}[] {
  return strategies.map((strategy) => {
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
    } else if (strategy instanceof RelevanceSortStrategy) {
      handledDataTypes = ['string']
      description = 'Handles relevance-based sorting with multiple text matching algorithms'
    } else if (strategy instanceof RelationshipSortStrategy) {
      handledDataTypes = ['number']
      description = 'Handles relationship-based sorting with centrality and connection metrics'
    } else if (strategy instanceof AggregateSortStrategy) {
      handledDataTypes = ['number']
      description = 'Handles aggregate sorting with mathematical functions and grouping'
    }

    return {
      strategyType,
      handledDataTypes,
      priority: strategy.getPriority(),
      description,
    }
  })
}

/**
 * Add a custom sort strategy to the factory
 */
export function addStrategy(strategy: SortStrategy): void {
  strategies.push(strategy)
  // Sort by priority (highest first)
  strategies.sort((a, b) => b.getPriority() - a.getPriority())
}

/**
 * Remove all custom strategies and reset to default
 */
export function resetToDefaults(): void {
  strategies.length = 0
  strategies.push(
    new AggregateSortStrategy(),
    new RelationshipSortStrategy(),
    new RelevanceSortStrategy(),
    new NumericSortStrategy(),
    new DateTimeSortStrategy(),
    new TextSortStrategy(),
  )
}

/**
 * Build enhanced sort clauses for multiple fields with EnhancedSortOption
 */
export function buildEnhancedMultiCriteriaSort(
  sortOptions: EnhancedSortOption[],
  context: SortContext,
): MultiCriteriaSortResult {
  if (sortOptions.length === 0) {
    return {
      sqlClause: '',
      parameters: [],
      sortFields: [],
    }
  }

  const sortClauses: string[] = []
  const parameters: any[] = []
  const sortFields: string[] = []

  for (const sortOption of sortOptions) {
    try {
      // Detect data type from enhanced option or context
      const dataType = sortOption.dataType || detectDataTypeFromContext(sortOption.field, context)

      const strategy = getStrategyByDataType(sortOption.field, dataType, context.availableAttributes)

      // Use enhanced method if available, fallback to basic method
      const result = strategy.buildEnhancedSortClause
        ? strategy.buildEnhancedSortClause(sortOption, context)
        : strategy.buildSortClause(sortOption.field, sortOption.direction, context)

      if (result.sqlClause.trim()) {
        sortClauses.push(result.sqlClause)
        parameters.push(...result.parameters)
        sortFields.push(sortOption.field)
      }
    } catch (error) {
      // Skip invalid sort fields rather than failing the entire query
      console.warn(`Failed to build enhanced sort clause for field '${sortOption.field}':`, error)
    }
  }

  return {
    sqlClause: sortClauses.length > 0 ? `ORDER BY ${sortClauses.join(', ')}` : '',
    parameters,
    sortFields,
  }
}

/**
 * Get strategy specifically by data type
 */
function getStrategyByDataType(
  field: string,
  dataType: string,
  _availableAttributes: AttributeTypeInfo[],
): SortStrategy {
  // Find the best strategy by priority
  const applicableStrategies = strategies.filter((strategy) => strategy.canHandle(field, dataType))

  if (applicableStrategies.length === 0) {
    // Fallback to TextSortStrategy
    return strategies.find((s) => s instanceof TextSortStrategy)!
  }

  // Return the strategy with highest priority
  return applicableStrategies.reduce((best, current) => (current.getPriority() > best.getPriority() ? current : best))
}

/**
 * Detect data type from sort context and field information
 */
function detectDataTypeFromContext(field: string, context: SortContext): string {
  // Handle system fields
  if (['created_at', 'updated_at'].includes(field)) {
    return 'datetime'
  }
  if (['title', 'content'].includes(field)) {
    return 'string'
  }

  // Find attribute info
  const attributeInfo = context.availableAttributes.find((attr) => attr.identifier === field)
  return attributeInfo?.dataType || 'string'
}

/**
 * Validate enhanced sort options
 */
export function validateEnhancedSortOptions(
  sortOptions: EnhancedSortOption[],
  availableAttributes: AttributeTypeInfo[],
): { valid: EnhancedSortOption[]; invalid: EnhancedSortOption[] } {
  const systemFields = ['created_at', 'updated_at', 'title', 'content']
  const attributeIdentifiers = availableAttributes.map((attr) => attr.identifier)
  const allValidFields = [...systemFields, ...attributeIdentifiers]

  const valid: EnhancedSortOption[] = []
  const invalid: EnhancedSortOption[] = []

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
 * Build optimized sort with performance analysis and adaptive strategy selection
 */
export function buildOptimizedSortFactory(
  sortOptions: EnhancedSortOption[],
  context: SortContext,
  options: {
    estimatedDataSize?: number
    performanceBudget?: 'interactive' | 'background' | 'batch'
    allowApproximateResults?: boolean
  } = {},
): AdaptiveSortResult {
  return buildOptimizedSort(sortOptions, context, options)
}

/**
 * Analyze sort complexity without executing the sort
 */
export function analyzeSortComplexity(
  sortOptions: EnhancedSortOption[],
  context: SortContext,
  estimatedDataSize: number = 1000,
) {
  return createExecutionPlan(sortOptions, context, estimatedDataSize)
}

/**
 * Get performance recommendations for sort operations
 */
export function getPerformanceRecommendations(
  sortOptions: EnhancedSortOption[],
  context: SortContext,
  estimatedDataSize: number = 1000,
): {
  complexity: 'low' | 'medium' | 'high' | 'extreme'
  recommendations: string[]
  estimatedCost: number
  cacheRecommended: boolean
} {
  const { metrics, hint } = getOptimizationRecommendation(sortOptions, context, estimatedDataSize)

  const recommendations: string[] = []

  // Add general recommendations based on complexity
  if (metrics.overallComplexity === 'high' || metrics.overallComplexity === 'extreme') {
    recommendations.push('Consider implementing pagination for large result sets')
    recommendations.push('Enable result caching to avoid recomputation')
  }

  if (metrics.indexUtilization < 0.5) {
    recommendations.push('Add database indexes for frequently sorted fields')
  }

  if (metrics.computedFieldsCount > 3) {
    recommendations.push('Consider pre-computing complex sort criteria as materialized columns')
  }

  if (hint.indexSuggestion) {
    recommendations.push(hint.indexSuggestion)
  }

  return {
    complexity: metrics.overallComplexity,
    recommendations,
    estimatedCost: hint.estimatedCost,
    cacheRecommended: hint.cacheRecommended,
  }
}

/**
 * Build cached optimized sort with intelligent caching system
 */
export function buildCachedOptimizedSort(
  sortOptions: EnhancedSortOption[],
  context: SortContext,
  options: CachedSortOptions = {},
): CachedSortResult {
  return globalCachedSortEngine.buildOptimizedSort(sortOptions, context, options)
}

/**
 * Build multiple cached sorts with shared caching benefits
 */
export function buildMultipleCachedSorts(
  requests: Array<{
    sortOptions: EnhancedSortOption[]
    context: SortContext
    options?: CachedSortOptions
  }>,
): CachedSortResult[] {
  return globalCachedSortEngine.buildMultipleSorts(requests)
}

/**
 * Get sort caching statistics and performance insights
 */
export function getCacheStats(): CacheStats {
  return globalCachedSortEngine.getCacheStats()
}

/**
 * Get performance insights from cache usage patterns
 */
export function getCachePerformanceInsights(): {
  mostExpensiveQueries: Array<{ complexity: string; cost: number; count: number }>
  cacheEfficiency: { hitRate: number; recommendation: string }
  memoryUsage: { current: number; max: number; recommendation: string }
} {
  return globalCachedSortEngine.getPerformanceInsights()
}

/**
 * Prewarm cache with common sort patterns for a table
 */
export async function prewarmTableCache(
  tableId: string,
  context: SortContext,
  commonPatterns?: EnhancedSortOption[][],
): Promise<{
  cached: number
  skipped: number
  errors: number
}> {
  return globalCachedSortEngine.prewarmTableCache(tableId, context, commonPatterns)
}

/**
 * Invalidate cached entries for a specific table
 */
export function invalidateTableCache(tableId: string): number {
  return globalCachedSortEngine.invalidateTableCache(tableId)
}

/**
 * Clear all cached sort results (useful for testing or manual refresh)
 */
export function clearSortCache(): void {
  globalCachedSortEngine.clearCache()
}

/**
 * Clean up expired cache entries
 */
export function cleanupSortCache(): number {
  return globalCachedSortEngine.cleanupCache()
}

// Custom Sort Function Management

/**
 * Get all available custom sort functions
 */
export function getCustomSortFunctions(dataType?: string): CustomSortFunction[] {
  return customSortStrategy.getAvailableCustomFunctions(dataType)
}

/**
 * Get a specific custom sort function by ID
 */
export function getCustomSortFunction(functionId: string): CustomSortFunction | undefined {
  return customSortStrategy.getCustomFunction(functionId)
}

/**
 * Search custom sort functions by query
 */
export function searchCustomSortFunctions(query: string): CustomSortFunction[] {
  return customSortStrategy.searchCustomFunctions(query)
}

/**
 * Get custom sort functions by tag
 */
export function getCustomSortFunctionsByTag(tag: string): CustomSortFunction[] {
  return customSortStrategy.getCustomFunctionsByTag(tag)
}

/**
 * Get usage statistics for custom sort functions
 */
export function getCustomSortFunctionStats(
  functionId?: string,
): CustomSortUsageStats | CustomSortUsageStats[] | undefined {
  return customSortStrategy.getCustomFunctionStats(functionId)
}

/**
 * Get custom sort function registry information
 */
export function getCustomSortRegistryInfo() {
  return customSortStrategy.getRegistryInfo()
}

/**
 * Register a new custom sort function
 */
export function registerCustomSortFunction(sortFunction: CustomSortFunction) {
  // Access the registry through the custom sort strategy
  const registry = (customSortStrategy as any).registry
  return registry.register(sortFunction)
}

/**
 * Unregister a custom sort function
 */
export function unregisterCustomSortFunction(functionId: string): boolean {
  // Access the registry through the custom sort strategy
  const registry = (customSortStrategy as any).registry
  return registry.unregister(functionId)
}

/**
 * Export all custom sort functions to JSON
 */
export function exportCustomSortFunctions(): string {
  // Access the registry through the custom sort strategy
  const registry = (customSortStrategy as any).registry
  return registry.exportToJSON()
}

/**
 * Clear all custom sort function usage statistics
 */
export function clearCustomSortFunctionStats(): void {
  // Access the registry through the custom sort strategy
  const registry = (customSortStrategy as any).registry
  registry.clearStats()
}

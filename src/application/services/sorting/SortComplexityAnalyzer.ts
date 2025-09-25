import type { EnhancedSortOption, SortContext } from '@/domain/value-objects/SortStrategy.js'

export interface ComplexityMetrics {
  dataSize: number
  sortOptionsCount: number
  computedFieldsCount: number
  aggregationComplexity: number
  relationshipDepth: number
  textSearchComplexity: number
  indexUtilization: number
  overallComplexity: 'low' | 'medium' | 'high' | 'extreme'
}

export interface PerformanceHint {
  strategy: 'database' | 'memory' | 'hybrid' | 'lazy'
  reasoning: string
  estimatedCost: number
  cacheRecommended: boolean
  indexSuggestion?: string
}

export interface SortOptimization {
  useIndex: boolean
  cacheResults: boolean
  batchSize?: number
  parallelization?: boolean
  approximateResults?: boolean
  strategy: 'exact' | 'approximate' | 'sampled'
}

const COMPLEXITY_THRESHOLDS = {
  dataSize: {
    small: 100,
    medium: 1000,
    large: 10000,
  },
  sortOptions: {
    simple: 1,
    moderate: 3,
    complex: 5,
  },
  textSearch: {
    basic: 10, // Character count for basic text search
    moderate: 50, // Character count for moderate complexity
    complex: 200, // Character count for complex text operations
  },
}

/**
 * Analyze the complexity of a sort operation
 */
export function analyzeSortComplexity(
  sortOptions: EnhancedSortOption[],
  context: SortContext,
  estimatedDataSize: number = 1000
): ComplexityMetrics {
  const dataSize = estimatedDataSize
  const sortOptionsCount = sortOptions.length

  // Count different types of sort operations
  const computedFieldsCount = countComputedFields(sortOptions)
  const aggregationComplexity = calculateAggregationComplexity(sortOptions)
  const relationshipDepth = calculateRelationshipDepth(sortOptions)
  const textSearchComplexity = calculateTextSearchComplexity(sortOptions)
  const indexUtilization = calculateIndexUtilization(sortOptions, context)

  // Calculate overall complexity score
  const complexityScore = calculateOverallComplexity({
    dataSize,
    sortOptionsCount,
    computedFieldsCount,
    aggregationComplexity,
    relationshipDepth,
    textSearchComplexity,
    indexUtilization,
  })

  return {
    dataSize,
    sortOptionsCount,
    computedFieldsCount,
    aggregationComplexity,
    relationshipDepth,
    textSearchComplexity,
    indexUtilization,
    overallComplexity: complexityScore,
  }
}

/**
 * Generate performance optimization hints based on complexity analysis
 */
export function generatePerformanceHints(metrics: ComplexityMetrics): PerformanceHint {
  const { overallComplexity, dataSize, computedFieldsCount, aggregationComplexity } = metrics

  // Database strategy for simple operations on indexed fields
  if (overallComplexity === 'low' && metrics.indexUtilization > 0.7) {
    return {
      strategy: 'database',
      reasoning: 'Simple operation with good index utilization - leverage database sorting',
      estimatedCost: estimateDatabaseCost(metrics),
      cacheRecommended: false,
      indexSuggestion: 'Consider composite index for multi-field sorts',
    }
  }

  // Memory strategy for small datasets with complex operations
  if (dataSize < COMPLEXITY_THRESHOLDS.dataSize.medium && computedFieldsCount > 0) {
    return {
      strategy: 'memory',
      reasoning: 'Small dataset with computed fields - sort in memory for flexibility',
      estimatedCost: estimateMemoryCost(metrics),
      cacheRecommended: true,
    }
  }

  // Hybrid strategy for medium complexity
  if (overallComplexity === 'medium' || aggregationComplexity > 2) {
    return {
      strategy: 'hybrid',
      reasoning: 'Moderate complexity - combine database pre-filtering with memory sorting',
      estimatedCost: estimateHybridCost(metrics),
      cacheRecommended: true,
      indexSuggestion: 'Add indexes for filtering, sort computed fields in memory',
    }
  }

  // Lazy strategy for high complexity operations
  return {
    strategy: 'lazy',
    reasoning: 'High complexity operation - use pagination and lazy evaluation',
    estimatedCost: estimateLazyCost(metrics),
    cacheRecommended: true,
    indexSuggestion: 'Critical: Add indexes for all sort fields',
  }
}

/**
 * Generate optimization configuration for sort execution
 */
export function generateOptimization(
  metrics: ComplexityMetrics,
  hint: PerformanceHint
): SortOptimization {
  const useIndex = metrics.indexUtilization > 0.5
  const cacheResults = hint.cacheRecommended

  let strategy: 'exact' | 'approximate' | 'sampled' = 'exact'
  let batchSize: number | undefined
  let parallelization = false
  let approximateResults = false

  switch (hint.strategy) {
    case 'database':
      strategy = 'exact'
      break

    case 'memory':
      strategy = 'exact'
      parallelization = metrics.sortOptionsCount > 2
      break

    case 'hybrid':
      strategy = 'exact'
      batchSize = Math.max(100, Math.floor(metrics.dataSize / 10))
      parallelization = true
      break

    case 'lazy':
      if (metrics.dataSize > COMPLEXITY_THRESHOLDS.dataSize.large) {
        strategy = 'approximate'
        approximateResults = true
      }
      batchSize = Math.min(1000, Math.floor(metrics.dataSize / 20))
      parallelization = true
      break
  }

  return {
    useIndex,
    cacheResults,
    batchSize,
    parallelization,
    approximateResults,
    strategy,
  }
}

/**
 * Count computed fields in sort options
 */
function countComputedFields(sortOptions: EnhancedSortOption[]): number {
  return sortOptions.filter(
    (option) =>
      option.field.startsWith('_') ||
      option.customComparator ||
      ['_relevance', '_relationship', '_aggregate', '_count', '_sum', '_avg'].some((prefix) =>
        option.field.startsWith(prefix)
      )
  ).length
}

/**
 * Calculate aggregation complexity score
 */
function calculateAggregationComplexity(sortOptions: EnhancedSortOption[]): number {
  let complexity = 0

  for (const option of sortOptions) {
    if (option.field.startsWith('_aggregate') || option.field.startsWith('_agg_')) {
      // Parse custom comparator for aggregation parameters
      if (option.customComparator) {
        try {
          const params = JSON.parse(option.customComparator)

          // Complex aggregation functions add more complexity
          if (['median', 'stddev'].includes(params.aggregateFunction)) {
            complexity += 3
          } else if (['sum', 'avg', 'min', 'max'].includes(params.aggregateFunction)) {
            complexity += 2
          } else {
            complexity += 1
          }

          // Grouping adds complexity
          if (params.groupBy && params.groupBy !== 'default') {
            complexity += 2
          }

          // Time-based grouping adds more complexity
          if (params.groupBy === 'time_period') {
            complexity += 1
          }
        } catch {
          complexity += 1 // Default complexity for unparseable aggregation
        }
      } else {
        complexity += 1
      }
    }
  }

  return complexity
}

/**
 * Calculate relationship traversal depth
 */
function calculateRelationshipDepth(sortOptions: EnhancedSortOption[]): number {
  let maxDepth = 0

  for (const option of sortOptions) {
    if (option.field.startsWith('_relationship') || option.field.startsWith('_connection')) {
      if (option.customComparator) {
        try {
          const params = JSON.parse(option.customComparator)
          const depth = params.maxDepth || 1
          maxDepth = Math.max(maxDepth, depth)

          // Complex algorithms add to effective depth
          if (['betweenness', 'pagerank'].includes(params.algorithm)) {
            maxDepth = Math.max(maxDepth, depth + 1)
          }
        } catch {
          maxDepth = Math.max(maxDepth, 1)
        }
      } else {
        maxDepth = Math.max(maxDepth, 1)
      }
    }
  }

  return maxDepth
}

/**
 * Calculate text search complexity
 */
function calculateTextSearchComplexity(sortOptions: EnhancedSortOption[]): number {
  let complexity = 0

  for (const option of sortOptions) {
    if (option.field === '_relevance' || option.field.startsWith('_relevance_')) {
      if (option.customComparator) {
        try {
          const params = JSON.parse(option.customComparator)
          const searchTerms = params.searchTerms || []
          const algorithm = params.algorithm || 'simple-match'

          // Algorithm complexity
          const algorithmComplexity =
            (
              {
                'simple-match': 1,
                fuzzy: 2,
                levenshtein: 3,
                'tf-idf': 4,
              } as Record<string, number>
            )[algorithm] || 1

          // Search terms length complexity
          const termsComplexity = searchTerms.reduce(
            (sum: number, term: string) =>
              sum + Math.min(3, term.length / COMPLEXITY_THRESHOLDS.textSearch.basic),
            0
          )

          complexity += algorithmComplexity + termsComplexity
        } catch {
          complexity += 1
        }
      } else {
        complexity += 1
      }
    }
  }

  return complexity
}

/**
 * Calculate index utilization score
 */
function calculateIndexUtilization(
  sortOptions: EnhancedSortOption[],
  context: SortContext
): number {
  const systemFields = ['created_at', 'updated_at', 'title', 'content']
  const totalFields = sortOptions.length

  if (totalFields === 0) return 1.0

  let indexableFields = 0

  for (const option of sortOptions) {
    // System fields are typically indexed
    if (systemFields.includes(option.field)) {
      indexableFields += 1
      continue
    }

    // Simple attribute fields can be indexed
    const attribute = context.availableAttributes.find((attr) => attr.identifier === option.field)
    if (attribute && !option.field.startsWith('_')) {
      // Numeric and date fields are more indexable
      if (['number', 'integer', 'float', 'date', 'datetime'].includes(attribute.dataType)) {
        indexableFields += 1
      } else if (attribute.dataType === 'string' && !option.customComparator) {
        indexableFields += 0.7 // Partial indexability for text
      }
    }

    // Computed fields are not indexable
    if (option.field.startsWith('_') || option.customComparator) {
    }
  }

  return Math.min(1.0, indexableFields / totalFields)
}

/**
 * Calculate overall complexity score
 */
function calculateOverallComplexity(params: {
  dataSize: number
  sortOptionsCount: number
  computedFieldsCount: number
  aggregationComplexity: number
  relationshipDepth: number
  textSearchComplexity: number
  indexUtilization: number
}): 'low' | 'medium' | 'high' | 'extreme' {
  const {
    dataSize,
    sortOptionsCount,
    computedFieldsCount,
    aggregationComplexity,
    relationshipDepth,
    textSearchComplexity,
    indexUtilization,
  } = params

  let score = 0

  // Data size factor
  if (dataSize > COMPLEXITY_THRESHOLDS.dataSize.large) {
    score += 4
  } else if (dataSize > COMPLEXITY_THRESHOLDS.dataSize.medium) {
    score += 2
  } else {
    score += 1
  }

  // Sort options count
  if (sortOptionsCount > COMPLEXITY_THRESHOLDS.sortOptions.complex) {
    score += 3
  } else if (sortOptionsCount > COMPLEXITY_THRESHOLDS.sortOptions.moderate) {
    score += 2
  } else {
    score += 1
  }

  // Computed fields penalty
  score += Math.min(5, computedFieldsCount * 2)

  // Aggregation complexity
  score += Math.min(4, aggregationComplexity)

  // Relationship depth
  score += Math.min(3, relationshipDepth)

  // Text search complexity
  score += Math.min(3, textSearchComplexity)

  // Index utilization benefit
  score -= Math.floor(indexUtilization * 3)

  // Classify complexity
  if (score <= 4) return 'low'
  if (score <= 8) return 'medium'
  if (score <= 12) return 'high'
  return 'extreme'
}

/**
 * Cost estimation methods
 */
function estimateDatabaseCost(metrics: ComplexityMetrics): number {
  return (
    Math.log2(metrics.dataSize) * metrics.sortOptionsCount * (1 / (metrics.indexUtilization + 0.1))
  )
}

function estimateMemoryCost(metrics: ComplexityMetrics): number {
  return metrics.dataSize * Math.log(metrics.dataSize) * metrics.sortOptionsCount * 0.1
}

function estimateHybridCost(metrics: ComplexityMetrics): number {
  const dbCost = estimateDatabaseCost(metrics) * 0.6
  const memoryCost = estimateMemoryCost(metrics) * 0.4
  return dbCost + memoryCost
}

function estimateLazyCost(metrics: ComplexityMetrics): number {
  return Math.sqrt(metrics.dataSize) * metrics.sortOptionsCount * 2
}

/**
 * Public method to get optimization recommendations
 */
export function getOptimizationRecommendation(
  sortOptions: EnhancedSortOption[],
  context: SortContext,
  estimatedDataSize: number = 1000
): {
  metrics: ComplexityMetrics
  hint: PerformanceHint
  optimization: SortOptimization
} {
  const metrics = analyzeSortComplexity(sortOptions, context, estimatedDataSize)
  const hint = generatePerformanceHints(metrics)
  const optimization = generateOptimization(metrics, hint)

  return { metrics, hint, optimization }
}

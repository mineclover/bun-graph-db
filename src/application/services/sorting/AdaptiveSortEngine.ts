import type { EnhancedSortOption, MultiCriteriaSortResult, SortContext } from '@/domain/value-objects/SortStrategy.js'
import {
  type ComplexityMetrics,
  getOptimizationRecommendation,
  type PerformanceHint,
  type SortOptimization,
} from './SortComplexityAnalyzer.js'
import { buildEnhancedMultiCriteriaSort } from './SortStrategyFactory.js'

export interface AdaptiveSortResult extends MultiCriteriaSortResult {
  performance: {
    strategy: 'database' | 'memory' | 'hybrid' | 'lazy'
    estimatedCost: number
    cacheRecommended: boolean
    metrics: ComplexityMetrics
    optimization: SortOptimization
  }
  warnings: string[]
  suggestions: string[]
}

export interface SortExecutionPlan {
  phases: SortExecutionPhase[]
  totalEstimatedCost: number
  cacheStrategy: 'none' | 'partial' | 'full'
  parallelizable: boolean
}

export interface SortExecutionPhase {
  name: string
  sortOptions: EnhancedSortOption[]
  strategy: 'database' | 'memory' | 'hybrid' | 'lazy'
  estimatedCost: number
  dependencies: string[]
}

const PERFORMANCE_BUDGETS = {
  interactive: 100, // ms - for real-time UI interactions
  background: 1000, // ms - for background processing
  batch: 10000, // ms - for batch operations
}

/**
 * Main entry point: Build an optimized sort strategy based on complexity analysis
 */
export function buildOptimizedSort(
  sortOptions: EnhancedSortOption[],
  context: SortContext,
  options: {
    estimatedDataSize?: number
    performanceBudget?: 'interactive' | 'background' | 'batch'
    allowApproximateResults?: boolean
  } = {},
): AdaptiveSortResult {
  const { estimatedDataSize = 1000, performanceBudget = 'background', allowApproximateResults = false } = options

  // Get optimization recommendation from complexity analyzer
  const { metrics, hint, optimization } = getOptimizationRecommendation(sortOptions, context, estimatedDataSize)

  // Apply performance budget constraints
  const budgetMs = PERFORMANCE_BUDGETS[performanceBudget]
  const adjustedHint = applyPerformanceBudget(hint, budgetMs, allowApproximateResults)
  const adjustedOptimization = adjustOptimizationForBudget(optimization, budgetMs)

  // Build the actual sort clauses based on strategy
  const sortResult = executeSortStrategy(sortOptions, context, adjustedHint.strategy, adjustedOptimization)

  // Generate warnings and suggestions
  const warnings = generateWarnings(metrics, hint, budgetMs)
  const suggestions = generateSuggestions(metrics, hint, optimization)

  return {
    ...sortResult,
    performance: {
      strategy: adjustedHint.strategy,
      estimatedCost: adjustedHint.estimatedCost,
      cacheRecommended: adjustedHint.cacheRecommended,
      metrics,
      optimization: adjustedOptimization,
    },
    warnings,
    suggestions,
  }

  /**
   * Create a detailed execution plan for complex sort operations
   */
  function _createExecutionPlanInternal(
    sortOptions: EnhancedSortOption[],
    context: SortContext,
    estimatedDataSize: number = 1000,
  ): SortExecutionPlan {
    const { metrics, hint, optimization } = getOptimizationRecommendation(sortOptions, context, estimatedDataSize)

    // Separate sort options into phases based on dependencies
    const phases = createExecutionPhases(sortOptions, context, hint, optimization)

    const totalEstimatedCost = phases.reduce((sum, phase) => sum + phase.estimatedCost, 0)
    const cacheStrategy = determineCacheStrategy(optimization, metrics)
    const parallelizable = optimization.parallelization || false

    return {
      phases,
      totalEstimatedCost,
      cacheStrategy,
      parallelizable,
    }
  }

  /**
   * Execute sort strategy based on performance hint
   */
  function executeSortStrategy(
    sortOptions: EnhancedSortOption[],
    context: SortContext,
    strategy: 'database' | 'memory' | 'hybrid' | 'lazy',
    optimization: SortOptimization,
  ): MultiCriteriaSortResult {
    switch (strategy) {
      case 'database':
        return executeDatabaseSort(sortOptions, context, optimization)

      case 'memory':
        return executeMemorySort(sortOptions, context, optimization)

      case 'hybrid':
        return executeHybridSort(sortOptions, context, optimization)

      case 'lazy':
        return executeLazySort(sortOptions, context, optimization)

      default:
        // Fallback to standard factory method
        return buildEnhancedMultiCriteriaSort(sortOptions, context)
    }
  }

  /**
   * Database-optimized sort execution
   */
  function executeDatabaseSort(
    sortOptions: EnhancedSortOption[],
    context: SortContext,
    optimization: SortOptimization,
  ): MultiCriteriaSortResult {
    // Prioritize simple, indexable fields for database sorting
    const indexableOptions = sortOptions.filter((option) => !option.field.startsWith('_') && !option.customComparator)

    const computedOptions = sortOptions.filter((option) => option.field.startsWith('_') || option.customComparator)

    // Build database sort for indexable fields
    const databaseResult = buildEnhancedMultiCriteriaSort(indexableOptions, context)

    // Add computed fields with reduced priority if any
    if (computedOptions.length > 0 && optimization.strategy === 'exact') {
      const computedResult = buildEnhancedMultiCriteriaSort(computedOptions, context)

      return {
        sqlClause: [databaseResult.sqlClause, computedResult.sqlClause].filter((clause) => clause.trim()).join(' '),
        parameters: [...databaseResult.parameters, ...computedResult.parameters],
        sortFields: [...databaseResult.sortFields, ...computedResult.sortFields],
      }
    }

    return databaseResult
  }

  /**
   * Memory-optimized sort execution (delegates to database but with memory hints)
   */
  function executeMemorySort(
    sortOptions: EnhancedSortOption[],
    context: SortContext,
    optimization: SortOptimization,
  ): MultiCriteriaSortResult {
    // For SQLite, we still generate SQL but with memory-friendly patterns
    // This could be extended to include post-processing hints
    const result = buildEnhancedMultiCriteriaSort(sortOptions, context)

    // Add memory optimization hints as SQL comments for debugging
    if (optimization.batchSize) {
      result.sqlClause += ` /* batch_size: ${optimization.batchSize} */`
    }

    if (optimization.parallelization) {
      result.sqlClause += ` /* parallelizable: true */`
    }

    return result
  }

  /**
   * Hybrid sort execution - combine database pre-filtering with computed sorts
   */
  function executeHybridSort(
    sortOptions: EnhancedSortOption[],
    context: SortContext,
    _optimization: SortOptimization,
  ): MultiCriteriaSortResult {
    // Separate simple and complex sort criteria
    const simpleOptions: EnhancedSortOption[] = []
    const complexOptions: EnhancedSortOption[] = []

    for (const option of sortOptions) {
      if (option.field.startsWith('_') || option.customComparator) {
        complexOptions.push(option)
      } else {
        simpleOptions.push(option)
      }
    }

    // Build database sort for simple fields first
    const simpleResult =
      simpleOptions.length > 0
        ? buildEnhancedMultiCriteriaSort(simpleOptions, context)
        : { sqlClause: '', parameters: [], sortFields: [] }

    // Add complex sorts with lower priority
    const complexResult =
      complexOptions.length > 0
        ? buildEnhancedMultiCriteriaSort(complexOptions, context)
        : { sqlClause: '', parameters: [], sortFields: [] }

    // Combine results with simple sorts taking priority
    const combinedClauses = [simpleResult.sqlClause, complexResult.sqlClause]
      .filter((clause) => clause.trim())
      .join(' ')

    return {
      sqlClause: combinedClauses,
      parameters: [...simpleResult.parameters, ...complexResult.parameters],
      sortFields: [...simpleResult.sortFields, ...complexResult.sortFields],
    }
  }

  /**
   * Lazy sort execution with pagination hints
   */
  function executeLazySort(
    sortOptions: EnhancedSortOption[],
    context: SortContext,
    optimization: SortOptimization,
  ): MultiCriteriaSortResult {
    const result = buildEnhancedMultiCriteriaSort(sortOptions, context)

    // Add lazy evaluation hints
    if (optimization.batchSize) {
      result.sqlClause += ` /* lazy_batch_size: ${optimization.batchSize} */`
    }

    if (optimization.approximateResults) {
      result.sqlClause += ` /* approximate_results: true */`
    }

    return result
  }

  /**
   * Apply performance budget constraints to hint
   */
  function applyPerformanceBudget(
    hint: PerformanceHint,
    budgetMs: number,
    _allowApproximateResults: boolean,
  ): PerformanceHint {
    if (hint.estimatedCost <= budgetMs) {
      return hint // No changes needed
    }

    // If over budget, escalate to more aggressive strategies
    if (hint.strategy === 'database' && hint.estimatedCost > budgetMs) {
      return {
        ...hint,
        strategy: 'lazy',
        reasoning: `Escalated to lazy strategy due to performance budget (${budgetMs}ms)`,
        estimatedCost: Math.min(hint.estimatedCost * 0.6, budgetMs),
        cacheRecommended: true,
      }
    }

    if (hint.strategy === 'memory' && hint.estimatedCost > budgetMs) {
      return {
        ...hint,
        strategy: 'hybrid',
        reasoning: `Escalated to hybrid strategy due to performance budget (${budgetMs}ms)`,
        estimatedCost: Math.min(hint.estimatedCost * 0.8, budgetMs),
      }
    }

    return hint
  }

  /**
   * Adjust optimization settings based on performance budget
   */
  function adjustOptimizationForBudget(optimization: SortOptimization, budgetMs: number): SortOptimization {
    // For tight budgets, enable approximation and smaller batch sizes
    if (budgetMs <= PERFORMANCE_BUDGETS.interactive) {
      return {
        ...optimization,
        approximateResults: true,
        batchSize: Math.min(optimization.batchSize || 1000, 100),
        strategy: 'approximate',
        parallelization: true,
      }
    }

    return optimization
  }

  /**
   * Create execution phases for complex operations
   */
  function createExecutionPhases(
    sortOptions: EnhancedSortOption[],
    _context: SortContext,
    hint: PerformanceHint,
    _optimization: SortOptimization,
  ): SortExecutionPhase[] {
    const phases: SortExecutionPhase[] = []

    // Phase 1: Simple indexed fields
    const simpleOptions = sortOptions.filter((option) => !option.field.startsWith('_') && !option.customComparator)

    if (simpleOptions.length > 0) {
      phases.push({
        name: 'indexed-sort',
        sortOptions: simpleOptions,
        strategy: 'database',
        estimatedCost: hint.estimatedCost * 0.3,
        dependencies: [],
      })
    }

    // Phase 2: Computed fields that depend on relationships
    const relationshipOptions = sortOptions.filter(
      (option) => option.field.startsWith('_relationship') || option.field.startsWith('_connection'),
    )

    if (relationshipOptions.length > 0) {
      phases.push({
        name: 'relationship-analysis',
        sortOptions: relationshipOptions,
        strategy: hint.strategy === 'database' ? 'database' : 'hybrid',
        estimatedCost: hint.estimatedCost * 0.4,
        dependencies: phases.length > 0 ? ['indexed-sort'] : [],
      })
    }

    // Phase 3: Text analysis and aggregations
    const complexOptions = sortOptions.filter(
      (option) =>
        (option.field.startsWith('_relevance') || option.field.startsWith('_aggregate')) &&
        !relationshipOptions.includes(option),
    )

    if (complexOptions.length > 0) {
      phases.push({
        name: 'complex-computation',
        sortOptions: complexOptions,
        strategy: (hint.strategy === 'lazy' ? 'lazy' : 'memory') as 'database' | 'memory' | 'hybrid' | 'lazy',
        estimatedCost: hint.estimatedCost * 0.3,
        dependencies: phases.map((p) => p.name),
      })
    }

    // If no phases created, create a single comprehensive phase
    if (phases.length === 0) {
      phases.push({
        name: 'comprehensive-sort',
        sortOptions: sortOptions,
        strategy: hint.strategy as 'database' | 'memory' | 'hybrid' | 'lazy',
        estimatedCost: hint.estimatedCost,
        dependencies: [],
      })
    }

    return phases
  }

  /**
   * Determine caching strategy based on optimization and metrics
   */
  function determineCacheStrategy(
    optimization: SortOptimization,
    metrics: ComplexityMetrics,
  ): 'none' | 'partial' | 'full' {
    if (!optimization.cacheResults) {
      return 'none'
    }

    if (metrics.overallComplexity === 'extreme' || metrics.computedFieldsCount > 3) {
      return 'full'
    }

    if (metrics.overallComplexity === 'high' || metrics.sortOptionsCount > 3) {
      return 'partial'
    }

    return 'none'
  }

  /**
   * Generate performance warnings
   */
  function generateWarnings(metrics: ComplexityMetrics, hint: PerformanceHint, budgetMs: number): string[] {
    const warnings: string[] = []

    if (metrics.overallComplexity === 'extreme') {
      warnings.push('Extremely complex sort operation detected - consider simplifying or adding indexes')
    }

    if (hint.estimatedCost > budgetMs) {
      warnings.push(`Estimated cost (${hint.estimatedCost}ms) exceeds performance budget (${budgetMs}ms)`)
    }

    if (metrics.indexUtilization < 0.3) {
      warnings.push('Low index utilization - most sort fields cannot leverage database indexes')
    }

    if (metrics.computedFieldsCount > 5) {
      warnings.push('High number of computed fields may impact performance significantly')
    }

    if (metrics.relationshipDepth > 3) {
      warnings.push('Deep relationship traversal detected - consider denormalizing frequently accessed paths')
    }

    return warnings
  }

  /**
   * Generate optimization suggestions
   */
  function generateSuggestions(
    metrics: ComplexityMetrics,
    hint: PerformanceHint,
    optimization: SortOptimization,
  ): string[] {
    const suggestions: string[] = []

    if (hint.indexSuggestion) {
      suggestions.push(hint.indexSuggestion)
    }

    if (metrics.overallComplexity === 'high' || metrics.overallComplexity === 'extreme') {
      suggestions.push('Consider implementing result pagination to improve perceived performance')
    }

    if (optimization.cacheResults) {
      suggestions.push('Enable result caching to avoid recomputation of complex sorts')
    }

    if (optimization.parallelization) {
      suggestions.push('Sort operations can be parallelized for better performance')
    }

    if (metrics.textSearchComplexity > 3) {
      suggestions.push('Consider implementing dedicated full-text search indexes for text relevance sorting')
    }

    if (metrics.aggregationComplexity > 4) {
      suggestions.push('Consider pre-computing complex aggregations as materialized views')
    }

    return suggestions
  }
}

/**
 * Create a detailed execution plan for complex sort operations
 */
export function createExecutionPlan(
  sortOptions: EnhancedSortOption[],
  context: SortContext,
  estimatedDataSize: number = 1000,
): SortExecutionPlan {
  const { hint, optimization } = getOptimizationRecommendation(sortOptions, context, estimatedDataSize)

  // This is a simplified execution plan implementation
  // For complex phase-based execution, use buildOptimizedSort instead
  const phases: SortExecutionPhase[] = [
    {
      name: 'unified-sort',
      sortOptions: sortOptions,
      strategy: hint.strategy as 'database' | 'memory' | 'hybrid' | 'lazy',
      estimatedCost: hint.estimatedCost,
      dependencies: [],
    },
  ]

  const totalEstimatedCost = hint.estimatedCost
  const cacheStrategy = optimization.cacheResults ? 'partial' : 'none'
  const parallelizable = optimization.parallelization || false

  return {
    phases,
    totalEstimatedCost,
    cacheStrategy,
    parallelizable,
  }
}

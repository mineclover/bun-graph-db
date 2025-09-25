import { describe, expect, it } from 'bun:test'
import {
  buildOptimizedSort,
  createExecutionPlan,
} from '../../src/application/services/sorting/AdaptiveSortEngine'
import {
  analyzeSortComplexity,
  generatePerformanceHints,
} from '../../src/application/services/sorting/SortComplexityAnalyzer'
import {
  analyzeSortComplexity as analyzeSortComplexityFactory,
  buildEnhancedMultiCriteriaSort,
  buildOptimizedSortFactory,
  getPerformanceRecommendations,
} from '../../src/application/services/sorting/SortStrategyFactory'
import {
  type EnhancedSortOption,
  type SortContext,
  SortDirection,
} from '../../src/domain/value-objects/SortStrategy'

describe('Performance Optimization Engine', () => {
  const mockContext: SortContext = {
    availableAttributes: [
      { identifier: 'name', dataType: 'string' },
      { identifier: 'age', dataType: 'number' },
      { identifier: 'score', dataType: 'number' },
      { identifier: 'category', dataType: 'string' },
      { identifier: 'date_joined', dataType: 'datetime' },
    ],
    tableAlias: 't',
    nodeAlias: 'n',
    attributeAlias: 'na',
  }

  describe('SortComplexityAnalyzer', () => {
    it('should analyze low complexity sorts correctly', () => {
      const sortOptions: EnhancedSortOption[] = [{ field: 'name', direction: SortDirection.ASC }]

      const metrics = analyzeSortComplexity(sortOptions, mockContext, 100)

      expect(metrics.overallComplexity).toBe('low')
      expect(metrics.computedFieldsCount).toBe(0)
      expect(metrics.sortOptionsCount).toBe(1)
      expect(metrics.indexUtilization).toBeGreaterThan(0.5)
    })

    it('should analyze high complexity sorts with computed fields', () => {
      const sortOptions: EnhancedSortOption[] = [
        {
          field: '_relevance',
          direction: SortDirection.DESC,
          customComparator: JSON.stringify({
            searchTerms: ['complex search term with many words'],
            algorithm: 'tf-idf',
          }),
        },
        {
          field: '_aggregate_sum',
          direction: SortDirection.DESC,
          customComparator: JSON.stringify({
            aggregateFunction: 'sum',
            sourceField: 'score',
            groupBy: 'related_nodes',
          }),
        },
        {
          field: '_relationship_count',
          direction: SortDirection.DESC,
          customComparator: JSON.stringify({
            relationshipTypes: ['friend', 'colleague'],
            direction: 'both',
            algorithm: 'betweenness',
          }),
        },
      ]

      const metrics = analyzeSortComplexity(sortOptions, mockContext, 10000)

      expect(metrics.overallComplexity).toMatch(/high|extreme/)
      expect(metrics.computedFieldsCount).toBe(3)
      expect(metrics.aggregationComplexity).toBeGreaterThan(0)
      expect(metrics.textSearchComplexity).toBeGreaterThan(0)
      expect(metrics.relationshipDepth).toBeGreaterThan(0)
    })

    it('should generate appropriate performance hints for different complexities', () => {
      const simpleSort: EnhancedSortOption[] = [{ field: 'age', direction: SortDirection.DESC }]

      const complexSort: EnhancedSortOption[] = [
        { field: '_relevance', direction: SortDirection.DESC },
        { field: '_aggregate_avg', direction: SortDirection.ASC },
        { field: 'name', direction: SortDirection.ASC },
      ]

      const simpleMetrics = analyzeSortComplexity(simpleSort, mockContext, 500)
      const simpleHints = generatePerformanceHints(simpleMetrics)

      const complexMetrics = analyzeSortComplexity(complexSort, mockContext, 10000)
      const complexHints = generatePerformanceHints(complexMetrics)

      expect(simpleHints.strategy).toBe('database')
      expect(complexHints.strategy).toMatch(/hybrid|memory|lazy/)
      expect(complexHints.cacheRecommended).toBe(true)
    })
  })

  describe('AdaptiveSortEngine', () => {
    it('should build optimized sort with performance analysis', () => {
      const sortOptions: EnhancedSortOption[] = [
        { field: 'name', direction: SortDirection.ASC },
        { field: 'age', direction: SortDirection.DESC },
      ]

      const result = buildOptimizedSort(sortOptions, mockContext, {
        estimatedDataSize: 1000,
        performanceBudget: 'background',
      })

      expect(result.sqlClause).toBeTruthy()
      expect(result.performance).toBeDefined()
      expect(result.performance.strategy).toMatch(/database|memory|hybrid|lazy/)
      expect(result.performance.metrics).toBeDefined()
      expect(result.warnings).toBeDefined()
      expect(result.suggestions).toBeDefined()
    })

    it('should handle interactive performance budget constraints', () => {
      const expensiveSortOptions: EnhancedSortOption[] = [
        { field: '_relevance', direction: SortDirection.DESC },
        { field: '_aggregate_sum', direction: SortDirection.DESC },
        { field: '_relationship_count', direction: SortDirection.DESC },
      ]

      const interactiveResult = buildOptimizedSort(expensiveSortOptions, mockContext, {
        estimatedDataSize: 10000,
        performanceBudget: 'interactive',
      })

      const batchResult = buildOptimizedSort(expensiveSortOptions, mockContext, {
        estimatedDataSize: 10000,
        performanceBudget: 'batch',
      })

      // Interactive should be more aggressive in optimization
      expect(interactiveResult.performance.optimization.approximateResults).toBe(true)
      expect(interactiveResult.performance.optimization.parallelization).toBe(true)
      expect(interactiveResult.performance.estimatedCost).toBeLessThanOrEqual(
        batchResult.performance.estimatedCost
      )
    })

    it('should create detailed execution plans for complex operations', () => {
      const complexSortOptions: EnhancedSortOption[] = [
        { field: 'created_at', direction: SortDirection.DESC }, // Simple indexed field
        { field: '_relationship_count', direction: SortDirection.DESC }, // Relationship computation
        { field: '_relevance', direction: SortDirection.DESC }, // Text analysis
      ]

      const plan = createExecutionPlan(complexSortOptions, mockContext, 5000)

      expect(plan.phases).toBeDefined()
      expect(plan.phases.length).toBeGreaterThan(0)
      expect(plan.totalEstimatedCost).toBeGreaterThan(0)
      expect(plan.cacheStrategy).toMatch(/none|partial|full/)

      // Should have phases for different types of operations
      const phaseNames = plan.phases.map((p) => p.name)
      expect(
        phaseNames.some((name) =>
          name.includes('indexed') ||
          name.includes('comprehensive') ||
          name.includes('relationship') ||
          name.includes('complex') ||
          name.includes('unified')
        )
      ).toBe(true)
    })

    it('should generate appropriate warnings for performance issues', () => {
      const problematicSort: EnhancedSortOption[] = [
        { field: '_relevance', direction: SortDirection.DESC },
        { field: '_aggregate_median', direction: SortDirection.ASC },
        { field: '_relationship_pagerank', direction: SortDirection.DESC },
        { field: '_aggregate_stddev', direction: SortDirection.ASC },
        { field: 'unknown_field', direction: SortDirection.ASC },
      ]

      const result = buildOptimizedSort(problematicSort, mockContext, {
        estimatedDataSize: 50000,
        performanceBudget: 'interactive', // Tight budget
      })

      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.suggestions.length).toBeGreaterThan(0)

      // Should warn about high complexity
      const hasComplexityWarning = result.warnings.some(
        (w) => w.includes('complex') || w.includes('performance') || w.includes('budget')
      )
      expect(hasComplexityWarning).toBe(true)
    })
  })

  describe('SortStrategyFactory Integration', () => {
    it('should provide optimized sort through factory', () => {
      const sortOptions: EnhancedSortOption[] = [
        { field: 'age', direction: SortDirection.DESC },
        { field: '_relevance', direction: SortDirection.DESC },
      ]

      const optimizedResult = buildOptimizedSortFactory(sortOptions, mockContext, {
        estimatedDataSize: 2000,
      })

      expect(optimizedResult.sqlClause).toBeTruthy()
      expect(optimizedResult.performance).toBeDefined()
      expect(optimizedResult.performance.metrics.overallComplexity).toMatch(
        /low|medium|high|extreme/
      )
    })

    it('should analyze sort complexity without execution', () => {
      const sortOptions: EnhancedSortOption[] = [
        { field: 'name', direction: SortDirection.ASC },
        { field: '_aggregate_count', direction: SortDirection.DESC },
      ]

      const plan = analyzeSortComplexityFactory(sortOptions, mockContext, 1500)

      expect(plan.phases).toBeDefined()
      expect(plan.totalEstimatedCost).toBeGreaterThan(0)
    })

    it('should provide performance recommendations', () => {
      const sortOptions: EnhancedSortOption[] = [
        { field: 'category', direction: SortDirection.ASC },
        { field: 'age', direction: SortDirection.DESC },
      ]

      const recommendations = getPerformanceRecommendations(sortOptions, mockContext, 800)

      expect(recommendations.complexity).toMatch(/low|medium|high|extreme/)
      expect(recommendations.recommendations).toBeDefined()
      expect(recommendations.estimatedCost).toBeGreaterThan(0)
      expect(typeof recommendations.cacheRecommended).toBe('boolean')
    })

    it('should maintain backward compatibility', () => {
      const basicSort: EnhancedSortOption[] = [{ field: 'name', direction: SortDirection.ASC }]

      // Standard method should still work
      const standardResult = buildEnhancedMultiCriteriaSort(basicSort, mockContext)

      // Optimized method should work
      const optimizedResult = buildOptimizedSortFactory(basicSort, mockContext)

      expect(standardResult.sqlClause).toBeTruthy()
      expect(optimizedResult.sqlClause).toBeTruthy()
      expect(standardResult.sortFields).toEqual(['name'])
      expect(optimizedResult.sortFields).toEqual(['name'])
    })
  })

  describe('Edge Cases and Validation', () => {
    it('should handle empty sort options gracefully', () => {
      const emptySort: EnhancedSortOption[] = []

      const metrics = analyzeSortComplexity(emptySort, mockContext, 1000)

      expect(metrics.overallComplexity).toBe('low')
      expect(metrics.sortOptionsCount).toBe(0)

      const optimizedResult = buildOptimizedSort(emptySort, mockContext)

      expect(optimizedResult.sqlClause).toBe('')
      expect(optimizedResult.sortFields).toEqual([])
    })

    it('should handle invalid custom comparator data', () => {
      const invalidSort: EnhancedSortOption[] = [
        {
          field: '_relevance',
          direction: SortDirection.DESC,
          customComparator: 'invalid-json-data',
        },
      ]

      const metrics = analyzeSortComplexity(invalidSort, mockContext, 1000)

      // Should not crash and should provide reasonable defaults
      expect(metrics.computedFieldsCount).toBe(1)
      expect(metrics.textSearchComplexity).toBeGreaterThanOrEqual(0)
    })

    it('should provide consistent recommendations across multiple calls', () => {
      const sortOptions: EnhancedSortOption[] = [
        { field: 'age', direction: SortDirection.DESC },
        { field: 'name', direction: SortDirection.ASC },
      ]

      const rec1 = getPerformanceRecommendations(sortOptions, mockContext, 1000)

      const rec2 = getPerformanceRecommendations(sortOptions, mockContext, 1000)

      expect(rec1.complexity).toBe(rec2.complexity)
      expect(rec1.cacheRecommended).toBe(rec2.cacheRecommended)
      expect(Math.abs(rec1.estimatedCost - rec2.estimatedCost)).toBeLessThan(0.1)
    })
  })
})

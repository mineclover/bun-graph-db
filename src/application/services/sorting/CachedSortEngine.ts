import type { EnhancedSortOption, SortContext } from '@/domain/value-objects/SortStrategy.js'
import { SortDirection } from '@/domain/value-objects/SortStrategy.js'
import { type AdaptiveSortResult, buildOptimizedSort } from './AdaptiveSortEngine.js'
import { analyzeSortComplexity } from './SortComplexityAnalyzer.js'
import { type CacheEntryMetadata, globalSortCache, type SortResultCache } from './SortResultCache.js'

/**
 * Cached version of AdaptiveSortEngine that leverages intelligent caching
 * to improve performance for repeated and expensive sort operations
 */

export interface CachedSortOptions {
  estimatedDataSize?: number
  performanceBudget?: 'interactive' | 'background' | 'batch'
  allowApproximateResults?: boolean
  enableCaching?: boolean
  cacheKey?: string // Optional custom cache key
  tableId?: string // For cache metadata
}

export interface CachedSortResult extends AdaptiveSortResult {
  cached: boolean
  cacheKey: string
  cacheMetadata?: {
    hitRate: number
    cacheAge?: number // milliseconds since cached
    generationTime?: number // how long it took to generate originally
  }
}

export class CachedSortEngine {
  constructor(private readonly cache: SortResultCache = globalSortCache) {}

  /**
   * Build optimized sort with intelligent caching
   */
  buildOptimizedSort(
    sortOptions: EnhancedSortOption[],
    context: SortContext,
    options: CachedSortOptions = {},
  ): CachedSortResult {
    const {
      estimatedDataSize = 1000,
      performanceBudget = 'background',
      allowApproximateResults = false,
      enableCaching = true,
      cacheKey: customCacheKey,
      tableId,
    } = options

    // Generate cache key
    const cacheKey =
      customCacheKey ||
      this.cache.generateCacheKey(sortOptions, context, {
        estimatedDataSize,
        performanceBudget,
        allowApproximateResults,
      })

    // Try to get from cache first
    if (enableCaching) {
      const cachedResult = this.getCachedResult(cacheKey, sortOptions, context, options)
      if (cachedResult) {
        return cachedResult
      }
    }

    // Not in cache or caching disabled, generate fresh result
    const startTime = Date.now()
    const result = buildOptimizedSort(sortOptions, context, {
      estimatedDataSize,
      performanceBudget,
      allowApproximateResults,
    })
    const generationTime = Date.now() - startTime

    // Create metadata for caching decision
    const metadata: CacheEntryMetadata = {
      complexity: result.performance.metrics.overallComplexity,
      estimatedCost: result.performance.estimatedCost,
      dataSize: estimatedDataSize,
      tableId,
      sortFieldsCount: result.sortFields.length,
      computedFieldsCount: result.performance.metrics.computedFieldsCount,
      indexUtilization: result.performance.metrics.indexUtilization,
    }

    // Cache the result if it should be cached
    if (enableCaching && this.cache.shouldCache(metadata)) {
      this.cache.set(cacheKey, result, metadata)
    }

    return {
      ...result,
      cached: false,
      cacheKey,
      cacheMetadata: {
        hitRate: this.getCacheHitRate(),
        generationTime,
      },
    }
  }

  /**
   * Build sort with cache warming for expected queries
   */
  async buildWithCacheWarming(
    sortOptions: EnhancedSortOption[],
    context: SortContext,
    options: CachedSortOptions & {
      warmupQueries?: Array<{
        sortOptions: EnhancedSortOption[]
        context: SortContext
        options?: CachedSortOptions
      }>
    } = {},
  ): Promise<CachedSortResult> {
    const { warmupQueries = [], ...baseOptions } = options

    // Execute primary query
    const result = this.buildOptimizedSort(sortOptions, context, baseOptions)

    // Warm up cache with related queries (asynchronously)
    if (warmupQueries.length > 0) {
      setTimeout(() => {
        this.warmupCache(warmupQueries)
      }, 0)
    }

    return result
  }

  /**
   * Batch process multiple sort requests with shared caching
   */
  buildMultipleSorts(
    requests: Array<{
      sortOptions: EnhancedSortOption[]
      context: SortContext
      options?: CachedSortOptions
    }>,
  ): CachedSortResult[] {
    return requests.map((request) =>
      this.buildOptimizedSort(request.sortOptions, request.context, request.options || {}),
    )
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats()
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Clean up expired cache entries
   */
  cleanupCache(): number {
    return this.cache.cleanup()
  }

  /**
   * Precompute and cache common sort patterns for a table
   */
  async prewarmTableCache(
    tableId: string,
    context: SortContext,
    commonPatterns: EnhancedSortOption[][] = [],
  ): Promise<{
    cached: number
    skipped: number
    errors: number
  }> {
    let cached = 0,
      skipped = 0,
      errors = 0

    // Default common patterns if none provided
    if (commonPatterns.length === 0) {
      commonPatterns = this.generateCommonPatterns(context)
    }

    for (const sortOptions of commonPatterns) {
      try {
        const result = this.buildOptimizedSort(sortOptions, context, {
          tableId,
          enableCaching: true,
        })

        if (result.cached) {
          skipped++
        } else {
          cached++
        }
      } catch (error) {
        errors++
        console.warn(`Failed to prewarm cache for pattern:`, error)
      }
    }

    return { cached, skipped, errors }
  }

  /**
   * Invalidate cache entries for a specific table
   */
  invalidateTableCache(tableId: string): number {
    const entries = this.cache.getEntries()
    let invalidated = 0

    for (const entry of entries) {
      if (entry.metadata.tableId === tableId) {
        this.cache.delete(entry.key)
        invalidated++
      }
    }

    return invalidated
  }

  /**
   * Get performance insights based on cache usage patterns
   */
  getPerformanceInsights(): {
    mostExpensiveQueries: Array<{ complexity: string; cost: number; count: number }>
    cacheEfficiency: { hitRate: number; recommendation: string }
    memoryUsage: { current: number; max: number; recommendation: string }
  } {
    const stats = this.cache.getStats()
    const entries = this.cache.getEntries()

    // Analyze expensive queries
    const expensiveQueries = entries
      .filter((entry) => entry.metadata.complexity === 'high' || entry.metadata.complexity === 'extreme')
      .reduce(
        (acc, entry) => {
          const key = `${entry.metadata.complexity}-${Math.floor(entry.metadata.estimatedCost / 100) * 100}`
          acc[key] = (acc[key] || 0) + entry.accessCount
          return acc
        },
        {} as Record<string, number>,
      )

    const mostExpensiveQueries = Object.entries(expensiveQueries)
      .map(([key, count]) => {
        const [complexity, costRange] = key.split('-')
        return {
          complexity: complexity || 'unknown',
          cost: parseInt(costRange || '0', 10),
          count,
        }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Cache efficiency analysis
    const cacheEfficiency = {
      hitRate: stats.hitRate,
      recommendation:
        stats.hitRate < 50
          ? 'Consider increasing cache size or TTL for better performance'
          : stats.hitRate > 90
            ? 'Excellent cache performance'
            : 'Good cache performance',
    }

    // Memory usage analysis
    const memoryUsage = {
      current: stats.memoryUsage,
      max: 50 * 1024 * 1024, // Default max from config
      recommendation:
        stats.memoryUsage > 40 * 1024 * 1024
          ? 'Consider reducing cache size or implementing more aggressive eviction'
          : 'Memory usage is within acceptable limits',
    }

    return {
      mostExpensiveQueries,
      cacheEfficiency,
      memoryUsage,
    }
  }

  // Private helper methods

  private getCachedResult(
    cacheKey: string,
    sortOptions: EnhancedSortOption[],
    context: SortContext,
    options: CachedSortOptions,
  ): CachedSortResult | null {
    const cachedResult = this.cache.get(cacheKey)

    if (!cachedResult) {
      return null
    }

    // Calculate cache age
    const entries = this.cache.getEntries()
    const entry = entries.find((e) => e.key === cacheKey)
    const cacheAge = entry ? Date.now() - entry.timestamp : 0

    return {
      ...cachedResult,
      // Add cached-specific properties to base result
      performance: {
        strategy: 'database' as const,
        estimatedCost: 0,
        cacheRecommended: false,
        metrics: analyzeSortComplexity(sortOptions, context, options.estimatedDataSize || 1000),
        optimization: {
          useIndex: true,
          cacheResults: true,
          strategy: 'exact' as const,
        },
      },
      warnings: [],
      suggestions: [],
      cached: true,
      cacheKey,
      cacheMetadata: {
        hitRate: this.getCacheHitRate(),
        cacheAge,
      },
    }
  }

  private getCacheHitRate(): number {
    const stats = this.cache.getStats()
    return stats.hitRate
  }

  private async warmupCache(
    queries: Array<{
      sortOptions: EnhancedSortOption[]
      context: SortContext
      options?: CachedSortOptions
    }>,
  ): Promise<void> {
    for (const query of queries) {
      try {
        this.buildOptimizedSort(query.sortOptions, query.context, {
          ...query.options,
          enableCaching: true,
        })
      } catch (error) {
        console.warn('Cache warmup failed for query:', error)
      }
    }
  }

  private generateCommonPatterns(context: SortContext): EnhancedSortOption[][] {
    const patterns: EnhancedSortOption[][] = []

    // Single field sorts on system fields
    const systemFields = ['created_at', 'updated_at', 'title', 'content']
    for (const field of systemFields) {
      patterns.push([{ field, direction: SortDirection.DESC }])
      patterns.push([{ field, direction: SortDirection.ASC }])
    }

    // Single field sorts on available attributes
    for (const attr of context.availableAttributes.slice(0, 5)) {
      patterns.push([{ field: attr.identifier, direction: SortDirection.DESC }])
      patterns.push([{ field: attr.identifier, direction: SortDirection.ASC }])
    }

    // Common multi-field combinations
    patterns.push([
      { field: 'created_at', direction: SortDirection.DESC },
      { field: 'title', direction: SortDirection.ASC },
    ])

    if (context.availableAttributes.length > 0 && context.availableAttributes[0]) {
      patterns.push([
        { field: context.availableAttributes[0].identifier, direction: SortDirection.DESC },
        { field: 'created_at', direction: SortDirection.DESC },
      ])
    }

    return patterns
  }
}

/**
 * Global cached sort engine instance
 */
export const globalCachedSortEngine = new CachedSortEngine()

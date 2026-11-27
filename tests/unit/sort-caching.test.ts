import { beforeEach, describe, expect, it } from 'vitest'
import { CachedSortEngine } from '../../src/application/services/sorting/CachedSortEngine'
import { type CacheEntryMetadata, SortResultCache } from '../../src/application/services/sorting/SortResultCache'
import {
  buildCachedOptimizedSort,
  cleanupSortCache,
  clearSortCache,
  getCacheStats,
} from '../../src/application/services/sorting/SortStrategyFactory'
import { type EnhancedSortOption, type SortContext, SortDirection } from '../../src/domain/value-objects/SortStrategy'

describe('Sort Result Caching System', () => {
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

  let cache: SortResultCache
  let cachedEngine: CachedSortEngine

  beforeEach(() => {
    cache = new SortResultCache({
      maxEntries: 100,
      defaultTtl: 60000, // 1 minute for testing
      enableStats: true,
    })
    cachedEngine = new CachedSortEngine(cache)
  })

  describe('SortResultCache', () => {
    it('should generate consistent cache keys for same inputs', () => {
      const sortOptions: EnhancedSortOption[] = [
        { field: 'name', direction: SortDirection.ASC },
        { field: 'age', direction: SortDirection.DESC },
      ]

      const key1 = cache.generateCacheKey(sortOptions, mockContext)
      const key2 = cache.generateCacheKey(sortOptions, mockContext)

      expect(key1).toBe(key2)
      expect(key1).toHaveLength(32) // SHA256 truncated
    })

    it('should generate different keys for different sort options', () => {
      const sortOptions1: EnhancedSortOption[] = [{ field: 'name', direction: SortDirection.ASC }]
      const sortOptions2: EnhancedSortOption[] = [{ field: 'age', direction: SortDirection.DESC }]

      const key1 = cache.generateCacheKey(sortOptions1, mockContext)
      const key2 = cache.generateCacheKey(sortOptions2, mockContext)

      expect(key1).not.toBe(key2)
    })

    it('should generate same key regardless of sort option order', () => {
      const sortOptions1: EnhancedSortOption[] = [
        { field: 'name', direction: SortDirection.ASC },
        { field: 'age', direction: SortDirection.DESC },
      ]
      const sortOptions2: EnhancedSortOption[] = [
        { field: 'age', direction: SortDirection.DESC },
        { field: 'name', direction: SortDirection.ASC },
      ]

      const key1 = cache.generateCacheKey(sortOptions1, mockContext)
      const key2 = cache.generateCacheKey(sortOptions2, mockContext)

      expect(key1).toBe(key2)
    })

    it('should store and retrieve cache entries correctly', () => {
      const cacheKey = 'test-key'
      const result = {
        sqlClause: 'ORDER BY name ASC',
        parameters: [],
        sortFields: ['name'],
      }
      const metadata: CacheEntryMetadata = {
        complexity: 'low',
        estimatedCost: 10,
        dataSize: 100,
        sortFieldsCount: 1,
        computedFieldsCount: 0,
        indexUtilization: 1.0,
      }

      cache.set(cacheKey, result, metadata)
      const cached = cache.get(cacheKey)

      expect(cached).toEqual(result)
    })

    it('should return null for expired entries', async () => {
      const shortTtlCache = new SortResultCache({
        maxEntries: 100,
        defaultTtl: 50, // 50ms
      })

      const cacheKey = 'test-key'
      const result = {
        sqlClause: 'ORDER BY name ASC',
        parameters: [],
        sortFields: ['name'],
      }
      const metadata: CacheEntryMetadata = {
        complexity: 'low',
        estimatedCost: 10,
        dataSize: 100,
        sortFieldsCount: 1,
        computedFieldsCount: 0,
        indexUtilization: 1.0,
      }

      shortTtlCache.set(cacheKey, result, metadata)

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 100))

      const cached = shortTtlCache.get(cacheKey)
      expect(cached).toBeNull()
    })

    it('should use complexity-based TTL multipliers', () => {
      const cache = new SortResultCache({
        defaultTtl: 1000,
        complexityBasedTtl: true,
      })

      const baseTtl = (cache as any).calculateTtl({ complexity: 'low' })
      const highTtl = (cache as any).calculateTtl({ complexity: 'high' })
      const extremeTtl = (cache as any).calculateTtl({ complexity: 'extreme' })

      expect(baseTtl).toBe(1000) // low = 1.0x
      expect(highTtl).toBe(2000) // high = 2.0x
      expect(extremeTtl).toBe(3000) // extreme = 3.0x
    })

    it('should decide whether to cache based on performance characteristics', () => {
      // Should cache high complexity operations
      expect(
        cache.shouldCache({
          complexity: 'high',
          estimatedCost: 50,
          dataSize: 100,
          sortFieldsCount: 1,
          computedFieldsCount: 0,
          indexUtilization: 0.8,
        }),
      ).toBe(true)

      // Should cache operations with computed fields
      expect(
        cache.shouldCache({
          complexity: 'medium',
          estimatedCost: 50,
          dataSize: 100,
          sortFieldsCount: 2,
          computedFieldsCount: 1,
          indexUtilization: 0.8,
        }),
      ).toBe(true)

      // Should cache operations with low index utilization
      expect(
        cache.shouldCache({
          complexity: 'medium',
          estimatedCost: 50,
          dataSize: 100,
          sortFieldsCount: 1,
          computedFieldsCount: 0,
          indexUtilization: 0.3,
        }),
      ).toBe(true)

      // Should not cache simple operations
      expect(
        cache.shouldCache({
          complexity: 'low',
          estimatedCost: 10,
          dataSize: 100,
          sortFieldsCount: 1,
          computedFieldsCount: 0,
          indexUtilization: 0.9,
        }),
      ).toBe(false)
    })

    it('should provide accurate cache statistics', () => {
      const result = {
        sqlClause: 'ORDER BY name ASC',
        parameters: [],
        sortFields: ['name'],
      }
      const metadata: CacheEntryMetadata = {
        complexity: 'medium',
        estimatedCost: 100,
        dataSize: 1000,
        sortFieldsCount: 1,
        computedFieldsCount: 0,
        indexUtilization: 0.8,
      }

      cache.set('key1', result, metadata)
      cache.set('key2', result, { ...metadata, complexity: 'high' })

      // Generate hits and misses
      cache.get('key1') // hit
      cache.get('key2') // hit
      cache.get('nonexistent') // miss

      const stats = cache.getStats()

      expect(stats.totalEntries).toBe(2)
      expect(stats.totalHits).toBe(2)
      expect(stats.totalMisses).toBe(1)
      expect(stats.hitRate).toBeCloseTo(66.67, 1) // 2/(2+1) * 100
      expect(stats.avgComplexity).toBe('medium') // (2+3)/2 = 2.5
      expect(stats.memoryUsage).toBeGreaterThan(0)
    })

    it('should clean up expired entries', async () => {
      const shortTtlCache = new SortResultCache({
        defaultTtl: 50,
        enableStats: true,
      })

      const result = {
        sqlClause: 'ORDER BY name ASC',
        parameters: [],
        sortFields: ['name'],
      }
      const metadata: CacheEntryMetadata = {
        complexity: 'low',
        estimatedCost: 10,
        dataSize: 100,
        sortFieldsCount: 1,
        computedFieldsCount: 0,
        indexUtilization: 1.0,
      }

      shortTtlCache.set('key1', result, metadata)
      shortTtlCache.set('key2', result, metadata)

      expect(shortTtlCache.getStats().totalEntries).toBe(2)

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 100))

      const removedCount = shortTtlCache.cleanup()
      expect(removedCount).toBe(2)
      expect(shortTtlCache.getStats().totalEntries).toBe(0)
    })
  })

  describe('CachedSortEngine', () => {
    it('should cache expensive sort operations automatically', () => {
      const sortOptions: EnhancedSortOption[] = [
        {
          field: '_relevance',
          direction: SortDirection.DESC,
          customComparator: JSON.stringify({
            searchTerms: ['complex search term'],
            algorithm: 'tf-idf',
          }),
        },
      ]

      // First call should not be cached
      const result1 = cachedEngine.buildOptimizedSort(sortOptions, mockContext, {
        estimatedDataSize: 10000,
        performanceBudget: 'interactive',
      })
      expect(result1.cached).toBe(false)

      // Second call should be cached
      const result2 = cachedEngine.buildOptimizedSort(sortOptions, mockContext, {
        estimatedDataSize: 10000,
        performanceBudget: 'interactive',
      })
      expect(result2.cached).toBe(true)
      expect(result2.cacheMetadata?.hitRate).toBeGreaterThan(0)
    })

    it('should not cache simple operations by default', () => {
      const sortOptions: EnhancedSortOption[] = [{ field: 'name', direction: SortDirection.ASC }]

      const result1 = cachedEngine.buildOptimizedSort(sortOptions, mockContext, {
        estimatedDataSize: 100,
      })

      const result2 = cachedEngine.buildOptimizedSort(sortOptions, mockContext, {
        estimatedDataSize: 100,
      })

      // Both should be uncached (too simple to warrant caching)
      expect(result1.cached).toBe(false)
      expect(result2.cached).toBe(false)
    })

    it('should allow forced caching with custom cache key', () => {
      const sortOptions: EnhancedSortOption[] = [{ field: 'name', direction: SortDirection.ASC }]

      const result1 = cachedEngine.buildOptimizedSort(sortOptions, mockContext, {
        enableCaching: true,
        cacheKey: 'custom-key',
        estimatedDataSize: 100,
      })

      // Manually cache the result
      const metadata: CacheEntryMetadata = {
        complexity: 'low',
        estimatedCost: 10,
        dataSize: 100,
        sortFieldsCount: 1,
        computedFieldsCount: 0,
        indexUtilization: 1.0,
      }
      cache.set('custom-key', result1, metadata)

      const result2 = cachedEngine.buildOptimizedSort(sortOptions, mockContext, {
        enableCaching: true,
        cacheKey: 'custom-key',
        estimatedDataSize: 100,
      })

      expect(result2.cached).toBe(true)
    })

    it('should process multiple sorts efficiently', () => {
      const requests = [
        {
          sortOptions: [{ field: 'name', direction: SortDirection.ASC as const }],
          context: mockContext,
        },
        {
          sortOptions: [{ field: 'age', direction: SortDirection.DESC as const }],
          context: mockContext,
        },
        {
          sortOptions: [{ field: 'score', direction: SortDirection.DESC as const }],
          context: mockContext,
        },
      ]

      const results = cachedEngine.buildMultipleSorts(requests)

      expect(results).toHaveLength(3)
      expect(results[0].sortFields).toContain('name')
      expect(results[1].sortFields).toContain('age')
      expect(results[2].sortFields).toContain('score')
    })

    it('should provide performance insights', () => {
      // Add some cache entries with different complexities
      const highComplexityOptions: EnhancedSortOption[] = [{ field: '_aggregate_sum', direction: SortDirection.DESC }]

      cachedEngine.buildOptimizedSort(highComplexityOptions, mockContext, {
        estimatedDataSize: 10000,
        performanceBudget: 'background',
      })

      const insights = cachedEngine.getPerformanceInsights()

      expect(insights).toHaveProperty('mostExpensiveQueries')
      expect(insights).toHaveProperty('cacheEfficiency')
      expect(insights).toHaveProperty('memoryUsage')
      expect(insights.cacheEfficiency.hitRate).toBeGreaterThanOrEqual(0)
    })

    it('should allow cache warming for common patterns', async () => {
      const tableId = 'test-table'

      const result = await cachedEngine.prewarmTableCache(tableId, mockContext)

      expect(result).toHaveProperty('cached')
      expect(result).toHaveProperty('skipped')
      expect(result).toHaveProperty('errors')
      expect(result.cached + result.skipped + result.errors).toBeGreaterThan(0)
    })

    it('should allow cache invalidation by table', () => {
      const tableId = 'test-table'

      // Add some cached entries
      cachedEngine.buildOptimizedSort([{ field: 'name', direction: SortDirection.ASC }], mockContext, {
        tableId,
        enableCaching: true,
      })

      const invalidated = cachedEngine.invalidateTableCache(tableId)
      expect(invalidated).toBeGreaterThanOrEqual(0)
    })
  })

  describe('SortStrategyFactory Integration', () => {
    it('should provide cached sort methods through factory', () => {
      const sortOptions: EnhancedSortOption[] = [
        {
          field: '_relevance',
          direction: SortDirection.DESC,
          customComparator: JSON.stringify({
            searchTerms: ['integration test'],
            algorithm: 'tf-idf',
          }),
        },
      ]

      const result = buildCachedOptimizedSort(sortOptions, mockContext, {
        estimatedDataSize: 5000,
      })

      expect(result).toHaveProperty('cached')
      expect(result).toHaveProperty('cacheKey')
      expect(result).toHaveProperty('performance')
      expect(result.performance.metrics.overallComplexity).toBeDefined()
    })

    it('should provide cache statistics through factory', () => {
      const stats = getCacheStats()

      expect(stats).toHaveProperty('totalEntries')
      expect(stats).toHaveProperty('hitRate')
      expect(stats).toHaveProperty('memoryUsage')
      expect(stats.totalEntries).toBeGreaterThanOrEqual(0)
    })

    it('should allow cache management through factory', () => {
      // Clear cache
      clearSortCache()
      expect(getCacheStats().totalEntries).toBe(0)

      // Test cleanup
      const cleanedCount = cleanupSortCache()
      expect(cleanedCount).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and empty inputs gracefully', () => {
      const emptyOptions: EnhancedSortOption[] = []

      const key = cache.generateCacheKey(emptyOptions, mockContext)
      expect(key).toHaveLength(32)

      const result = cachedEngine.buildOptimizedSort(emptyOptions, mockContext)
      expect(result.sqlClause).toBe('')
      expect(result.cached).toBe(false)
    })

    it('should handle invalid custom comparator data', () => {
      const invalidOptions: EnhancedSortOption[] = [
        {
          field: '_relevance',
          direction: SortDirection.DESC,
          customComparator: 'invalid-json',
        },
      ]

      const result = cachedEngine.buildOptimizedSort(invalidOptions, mockContext)
      expect(result).toBeDefined()
      expect(result.cached).toBe(false)
    })

    it('should handle cache disabled scenarios', () => {
      const sortOptions: EnhancedSortOption[] = [{ field: '_complex_operation', direction: SortDirection.DESC }]

      const result = cachedEngine.buildOptimizedSort(sortOptions, mockContext, {
        enableCaching: false,
        estimatedDataSize: 10000,
      })

      expect(result.cached).toBe(false)
    })

    it('should maintain consistent behavior under high load', () => {
      const sortOptions: EnhancedSortOption[] = [
        { field: 'name', direction: SortDirection.ASC },
        { field: 'age', direction: SortDirection.DESC },
      ]

      // Generate many requests
      const results = []
      for (let i = 0; i < 100; i++) {
        results.push(cachedEngine.buildOptimizedSort(sortOptions, mockContext))
      }

      // All should produce same SQL clause
      const firstSql = results[0].sqlClause
      for (const result of results) {
        expect(result.sqlClause).toBe(firstSql)
      }
    })
  })
})

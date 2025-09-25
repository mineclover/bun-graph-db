import crypto from 'node:crypto'
import type {
  EnhancedSortOption,
  MultiCriteriaSortResult,
  SortContext,
} from '@/domain/value-objects/SortStrategy.js'
import type { ComplexityMetrics } from './SortComplexityAnalyzer.js'

/**
 * Comprehensive sort result caching system with intelligent cache key generation
 * and performance-aware cache strategies
 */

export interface CacheEntry {
  key: string
  result: MultiCriteriaSortResult
  metadata: CacheEntryMetadata
  timestamp: number
  accessCount: number
  lastAccess: number
}

export interface CacheEntryMetadata {
  complexity: ComplexityMetrics['overallComplexity']
  estimatedCost: number
  dataSize: number
  tableId?: string
  sortFieldsCount: number
  computedFieldsCount: number
  indexUtilization: number
}

export interface CacheStats {
  totalEntries: number
  hitRate: number
  avgComplexity: string
  totalHits: number
  totalMisses: number
  memoryUsage: number
  oldestEntry?: number
  newestEntry?: number
}

export interface CacheConfig {
  maxEntries: number
  defaultTtl: number // in milliseconds
  maxMemoryUsage: number // in bytes
  complexityBasedTtl: boolean
  enableLRU: boolean
  enableStats: boolean
  compressionThreshold: number // entry size threshold for compression
}

export class SortResultCache {
  private cache = new Map<string, CacheEntry>()
  private hits = 0
  private misses = 0
  private readonly config: CacheConfig

  // Performance-based TTL multipliers
  private readonly TTL_MULTIPLIERS = {
    low: 1.0, // Base TTL for low complexity
    medium: 1.5, // 50% longer TTL for medium complexity
    high: 2.0, // Double TTL for high complexity
    extreme: 3.0, // Triple TTL for extreme complexity
  } as const

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxEntries: config.maxEntries ?? 1000,
      defaultTtl: config.defaultTtl ?? 15 * 60 * 1000, // 15 minutes
      maxMemoryUsage: config.maxMemoryUsage ?? 50 * 1024 * 1024, // 50MB
      complexityBasedTtl: config.complexityBasedTtl ?? true,
      enableLRU: config.enableLRU ?? true,
      enableStats: config.enableStats ?? true,
      compressionThreshold: config.compressionThreshold ?? 10 * 1024, // 10KB
    }
  }

  /**
   * Generate intelligent cache key based on sort parameters
   */
  generateCacheKey(
    sortOptions: EnhancedSortOption[],
    context: SortContext,
    additionalParams: Record<string, any> = {}
  ): string {
    // Create normalized sort key components
    const sortKey = this.normalizeSortOptions(sortOptions)
    const contextKey = this.normalizeContext(context)
    const paramsKey = this.normalizeParams(additionalParams)

    // Combine components and hash for consistent key length
    const combinedKey = `${sortKey}|${contextKey}|${paramsKey}`
    return crypto.createHash('sha256').update(combinedKey).digest('hex').substring(0, 32)
  }

  /**
   * Get cached sort result if available and valid
   */
  get(cacheKey: string): MultiCriteriaSortResult | null {
    const entry = this.cache.get(cacheKey)

    if (!entry) {
      this.misses++
      return null
    }

    // Check if entry is expired
    const now = Date.now()
    const ttl = this.calculateTtl(entry.metadata)

    if (now - entry.timestamp > ttl) {
      this.cache.delete(cacheKey)
      this.misses++
      return null
    }

    // Update access statistics
    entry.accessCount++
    entry.lastAccess = now
    this.hits++

    return entry.result
  }

  /**
   * Store sort result in cache with metadata
   */
  set(cacheKey: string, result: MultiCriteriaSortResult, metadata: CacheEntryMetadata): void {
    const now = Date.now()

    // Check memory usage before adding
    if (this.shouldEvict()) {
      this.evictEntries()
    }

    const entry: CacheEntry = {
      key: cacheKey,
      result: this.compressResult(result),
      metadata,
      timestamp: now,
      accessCount: 1,
      lastAccess: now,
    }

    this.cache.set(cacheKey, entry)
  }

  /**
   * Check if result should be cached based on performance characteristics
   */
  shouldCache(metadata: CacheEntryMetadata): boolean {
    // Always cache high complexity operations
    if (metadata.complexity === 'high' || metadata.complexity === 'extreme') {
      return true
    }

    // Cache medium complexity with computed fields
    if (metadata.complexity === 'medium' && metadata.computedFieldsCount > 0) {
      return true
    }

    // Cache operations with low index utilization (expensive database operations)
    if (metadata.indexUtilization < 0.5) {
      return true
    }

    // Cache operations with high estimated cost
    if (metadata.estimatedCost > 100) {
      return true
    }

    // Cache large dataset operations
    if (metadata.dataSize > 1000) {
      return true
    }

    return false
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    if (!this.config.enableStats) {
      return {
        totalEntries: this.cache.size,
        hitRate: 0,
        avgComplexity: 'unknown',
        totalHits: 0,
        totalMisses: 0,
        memoryUsage: 0,
      }
    }

    const entries = Array.from(this.cache.values())
    const totalRequests = this.hits + this.misses
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0

    // Calculate average complexity
    const complexityWeights = { low: 1, medium: 2, high: 3, extreme: 4 }
    const avgComplexityScore =
      entries.length > 0
        ? entries.reduce((sum, entry) => sum + complexityWeights[entry.metadata.complexity], 0) /
          entries.length
        : 0

    const avgComplexity =
      avgComplexityScore <= 1.5
        ? 'low'
        : avgComplexityScore <= 2.5
          ? 'medium'
          : avgComplexityScore <= 3.5
            ? 'high'
            : 'extreme'

    // Estimate memory usage
    const memoryUsage = entries.reduce((total, entry) => {
      const entrySize =
        JSON.stringify(entry.result).length + JSON.stringify(entry.metadata).length + 200 // overhead estimate
      return total + entrySize
    }, 0)

    const timestamps = entries.map((e) => e.timestamp)
    const oldestEntry = timestamps.length > 0 ? Math.min(...timestamps) : undefined
    const newestEntry = timestamps.length > 0 ? Math.max(...timestamps) : undefined

    return {
      totalEntries: this.cache.size,
      hitRate: Math.round(hitRate * 100) / 100,
      avgComplexity,
      totalHits: this.hits,
      totalMisses: this.misses,
      memoryUsage,
      oldestEntry,
      newestEntry,
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    const now = Date.now()
    let removedCount = 0

    for (const [key, entry] of this.cache.entries()) {
      const ttl = this.calculateTtl(entry.metadata)
      if (now - entry.timestamp > ttl) {
        this.cache.delete(key)
        removedCount++
      }
    }

    return removedCount
  }

  /**
   * Get cache entries for debugging/monitoring
   */
  getEntries(): CacheEntry[] {
    return Array.from(this.cache.values())
  }

  /**
   * Remove specific cache entry
   */
  delete(cacheKey: string): boolean {
    return this.cache.delete(cacheKey)
  }

  // Private helper methods

  private normalizeSortOptions(sortOptions: EnhancedSortOption[]): string {
    // Sort by field name to ensure consistent key regardless of array order
    const normalized = [...sortOptions]
      .sort((a, b) => a.field.localeCompare(b.field))
      .map((option) => ({
        field: option.field,
        direction: option.direction,
        dataType: option.dataType || 'string',
        caseSensitive: option.caseSensitive || false,
        customComparator: option.customComparator
          ? crypto.createHash('md5').update(option.customComparator).digest('hex')
          : undefined,
      }))

    return JSON.stringify(normalized)
  }

  private normalizeContext(context: SortContext): string {
    const normalized = {
      tableAlias: context.tableAlias,
      nodeAlias: context.nodeAlias,
      attributeAlias: context.attributeAlias,
      // Sort attributes to ensure consistent key
      availableAttributes: [...context.availableAttributes]
        .sort((a, b) => a.identifier.localeCompare(b.identifier))
        .map((attr) => ({
          identifier: attr.identifier,
          dataType: attr.dataType,
        })),
    }

    return JSON.stringify(normalized)
  }

  private normalizeParams(params: Record<string, any>): string {
    // Sort object keys for consistent serialization
    const sortedParams = Object.keys(params)
      .sort()
      .reduce(
        (obj, key) => {
          obj[key] = params[key]
          return obj
        },
        {} as Record<string, any>
      )

    return JSON.stringify(sortedParams)
  }

  private calculateTtl(metadata: CacheEntryMetadata): number {
    if (!this.config.complexityBasedTtl) {
      return this.config.defaultTtl
    }

    const multiplier = this.TTL_MULTIPLIERS[metadata.complexity]
    let ttl = this.config.defaultTtl * multiplier

    // Extend TTL for expensive operations
    if (metadata.estimatedCost > 1000) {
      ttl *= 1.5
    }

    // Extend TTL for low index utilization (expensive to recalculate)
    if (metadata.indexUtilization < 0.3) {
      ttl *= 1.3
    }

    return Math.floor(ttl)
  }

  private compressResult(result: MultiCriteriaSortResult): MultiCriteriaSortResult {
    const resultStr = JSON.stringify(result)

    // Only compress large results
    if (resultStr.length < this.config.compressionThreshold) {
      return result
    }

    // For now, return as-is. In production, you might use compression libraries
    // like gzip or brotli for large SQL clauses
    return result
  }

  private shouldEvict(): boolean {
    if (this.cache.size >= this.config.maxEntries) {
      return true
    }

    // Check memory usage estimation
    const estimatedMemory = this.cache.size * 2048 // rough estimate per entry
    if (estimatedMemory > this.config.maxMemoryUsage) {
      return true
    }

    return false
  }

  private evictEntries(): void {
    if (!this.config.enableLRU) {
      // Simple random eviction if LRU is disabled
      const entries = Array.from(this.cache.keys())
      const toRemove = Math.floor(this.config.maxEntries * 0.1) // Remove 10%

      for (let i = 0; i < toRemove && i < entries.length; i++) {
        const randomKey = entries[Math.floor(Math.random() * entries.length)]
        if (randomKey) {
          this.cache.delete(randomKey)
        }
      }
      return
    }

    // LRU eviction: remove least recently used entries
    const entries = Array.from(this.cache.entries()).sort(
      (a, b) => a[1].lastAccess - b[1].lastAccess
    )

    const toRemove = Math.floor(this.config.maxEntries * 0.2) // Remove 20%

    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const entry = entries[i]
      if (entry) {
        this.cache.delete(entry[0])
      }
    }
  }
}

/**
 * Global cache instance for sort results
 * Can be configured via environment variables or DI container
 */
export const globalSortCache = new SortResultCache({
  maxEntries: parseInt(process.env.SORT_CACHE_MAX_ENTRIES || '1000', 10),
  defaultTtl: parseInt(process.env.SORT_CACHE_TTL || '900000', 10), // 15 minutes
  maxMemoryUsage: parseInt(process.env.SORT_CACHE_MAX_MEMORY || '52428800', 10), // 50MB
  complexityBasedTtl: process.env.SORT_CACHE_COMPLEXITY_TTL !== 'false',
  enableLRU: process.env.SORT_CACHE_ENABLE_LRU !== 'false',
  enableStats: process.env.SORT_CACHE_ENABLE_STATS !== 'false',
})

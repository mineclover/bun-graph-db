import { describe, expect, test } from 'bun:test'
import { AggregateSortStrategy } from '../../src/application/services/sorting/AggregateSortStrategy.js'
import { RelationshipSortStrategy } from '../../src/application/services/sorting/RelationshipSortStrategy.js'
import { RelevanceSortStrategy } from '../../src/application/services/sorting/RelevanceSortStrategy.js'
import {
  type EnhancedSortOption,
  type SortContext,
  SortDirection,
} from '../../src/domain/value-objects/SortStrategy.js'

describe('Additional Sort Strategies Tests', () => {
  describe('RelationshipSortStrategy', () => {
    test('should handle relationship field detection', () => {
      const strategy = new RelationshipSortStrategy()
      expect(strategy.canHandle('_connection_count', 'number')).toBe(true)
      expect(strategy.canHandle('_relationship_count', 'number')).toBe(true)
      expect(strategy.canHandle('_centrality', 'number')).toBe(true)
      expect(strategy.canHandle('regular_field', 'string')).toBe(false)
    })

    test('should build relationship sort clause', () => {
      const strategy = new RelationshipSortStrategy()
      const mockContext = {
        tableId: 'test-table',
        attributeMappings: new Map(),
        searchTerms: [],
      }

      const result = strategy.buildSortClause('_connection_count', 'desc', mockContext)
      expect(result.sqlClause).toContain('COUNT(*)')
      expect(result.sqlClause).toContain('DESC')
      expect(result.sqlClause).toContain('node_relations')
    })

    test('should get correct priority', () => {
      const strategy = new RelationshipSortStrategy()
      expect(strategy.getPriority()).toBe(85)
    })
  })

  describe('AggregateSortStrategy', () => {
    test('should handle aggregate field detection', () => {
      const strategy = new AggregateSortStrategy()
      expect(strategy.canHandle('_aggregate_sum', 'number')).toBe(true)
      expect(strategy.canHandle('_agg_count', 'number')).toBe(true)
      expect(strategy.canHandle('_count', 'number')).toBe(true)
      expect(strategy.canHandle('_sum', 'number')).toBe(true)
      expect(strategy.canHandle('_avg', 'number')).toBe(true)
      expect(strategy.canHandle('_min', 'number')).toBe(true)
      expect(strategy.canHandle('_max', 'number')).toBe(true)
      expect(strategy.canHandle('regular_field', 'string')).toBe(false)
    })

    test('should build aggregate sort clause', () => {
      const strategy = new AggregateSortStrategy()
      const mockContext: SortContext = {
        availableAttributes: [
          { identifier: 'name', dataType: 'string' },
          { identifier: 'age', dataType: 'number' },
        ],
        tableAlias: 't',
        nodeAlias: 'n',
        attributeAlias: 'na',
      }

      const result = strategy.buildSortClause('_count', 'desc', mockContext)
      expect(result.sqlClause).toContain('COUNT(*)')
      expect(result.sqlClause).toContain('DESC')
      expect(result.parameters).toBeDefined()
    })

    test('should get correct priority', () => {
      const strategy = new AggregateSortStrategy()
      expect(strategy.getPriority()).toBe(75)
    })
  })

  describe('RelevanceSortStrategy', () => {
    test('should handle relevance field detection', () => {
      const strategy = new RelevanceSortStrategy()
      expect(strategy.canHandle('_relevance', 'string')).toBe(true)
      expect(strategy.canHandle('_relevance_score', 'number')).toBe(true)
      expect(strategy.canHandle('_relevance_ranking', 'number')).toBe(true)
      expect(strategy.canHandle('regular_field', 'string')).toBe(false)
    })

    test('should build relevance sort clause', () => {
      const strategy = new RelevanceSortStrategy()
      const mockContext: SortContext = {
        availableAttributes: [
          { identifier: 'name', dataType: 'string' },
          { identifier: 'content', dataType: 'string' },
        ],
        tableAlias: 't',
        nodeAlias: 'n',
        attributeAlias: 'na',
      }

      const result = strategy.buildSortClause('_relevance', 'desc', mockContext)
      expect(result.sqlClause).toContain('LENGTH(n.content)')
      expect(result.sqlClause).toContain('DESC')
      expect(result.parameters).toBeDefined()
    })

    test('should build enhanced relevance sort clause with search terms', () => {
      const strategy = new RelevanceSortStrategy()
      const mockContext: SortContext = {
        availableAttributes: [
          { identifier: 'name', dataType: 'string' },
          { identifier: 'content', dataType: 'string' },
        ],
        tableAlias: 't',
        nodeAlias: 'n',
        attributeAlias: 'na',
      }

      const sortOption: EnhancedSortOption = {
        field: '_relevance',
        direction: SortDirection.DESC,
        customComparator: JSON.stringify({
          algorithm: 'simple-match',
          searchTerms: ['test', 'search'],
          weights: { content: 1.0, title: 1.5 },
        }),
      }

      const result = strategy.buildEnhancedSortClause(sortOption, mockContext)
      expect(result.sqlClause).toContain('CASE')
      expect(result.sqlClause).toContain('DESC')
      expect(result.parameters.length).toBeGreaterThan(0)
    })

    test('should get correct priority', () => {
      const strategy = new RelevanceSortStrategy()
      expect(strategy.getPriority()).toBe(80)
    })
  })

  describe('Integration Tests', () => {
    test('should have different priorities for proper ordering', () => {
      const relationshipStrategy = new RelationshipSortStrategy()
      const aggregateStrategy = new AggregateSortStrategy()
      const relevanceStrategy = new RelevanceSortStrategy()

      const relationshipPriority = relationshipStrategy.getPriority()
      const aggregatePriority = aggregateStrategy.getPriority()
      const relevancePriority = relevanceStrategy.getPriority()

      expect(relationshipPriority).toBe(85)
      expect(aggregatePriority).toBe(75)
      expect(relevancePriority).toBe(80)
    })

    test('should handle field detection correctly', () => {
      const relationshipStrategy = new RelationshipSortStrategy()
      const aggregateStrategy = new AggregateSortStrategy()
      const relevanceStrategy = new RelevanceSortStrategy()

      // Test field ownership
      expect(relationshipStrategy.canHandle('_connection_count', 'number')).toBe(true)
      expect(aggregateStrategy.canHandle('_count', 'number')).toBe(true)
      expect(relevanceStrategy.canHandle('_relevance', 'string')).toBe(true)

      // Test non-overlapping fields
      expect(relationshipStrategy.canHandle('_count', 'number')).toBe(false)
      expect(aggregateStrategy.canHandle('_relevance', 'string')).toBe(false)
      expect(relevanceStrategy.canHandle('_connection_count', 'number')).toBe(false)
    })
  })
})

import { beforeEach, describe, expect, it } from 'bun:test'
import {
  type CustomSortFunction,
  CustomSortFunctionRegistry,
} from '../../src/application/services/sorting/CustomSortFunctionRegistry'
import {
  BuiltInCustomSortFunctions,
  CustomSortStrategy,
} from '../../src/application/services/sorting/CustomSortStrategy'
import {
  getCustomSortFunction,
  getCustomSortFunctionStats,
  getCustomSortFunctions,
  getCustomSortRegistryInfo,
  registerCustomSortFunction,
  searchCustomSortFunctions,
  unregisterCustomSortFunction,
} from '../../src/application/services/sorting/SortStrategyFactory'
import { type SortContext, SortDirection } from '../../src/domain/value-objects/SortStrategy'

describe('Custom Sort Functions System', () => {
  const mockContext: SortContext = {
    availableAttributes: [
      { identifier: 'name', dataType: 'string' },
      { identifier: 'age', dataType: 'number' },
      { identifier: 'score', dataType: 'number' },
      { identifier: 'category', dataType: 'string' },
      { identifier: 'description', dataType: 'text' },
    ],
    tableAlias: 't',
    nodeAlias: 'n',
    attributeAlias: 'na',
  }

  let registry: CustomSortFunctionRegistry
  let customStrategy: CustomSortStrategy

  beforeEach(() => {
    registry = new CustomSortFunctionRegistry({ enableStats: true })
    customStrategy = new CustomSortStrategy(registry)
  })

  describe('CustomSortFunctionRegistry', () => {
    it('should register and retrieve custom sort functions', () => {
      const customFunction: CustomSortFunction = {
        id: 'test-sort',
        name: 'Test Sort',
        description: 'A test sort function',
        supportedDataTypes: ['string'],
        priority: 50,
        version: '1.0.0',
        tags: ['test'],
        handler: (field, direction, context) => ({
          sqlClause: `ORDER BY ${context.nodeAlias}.${field} ${direction.toUpperCase()}`,
          parameters: [],
        }),
      }

      const result = registry.register(customFunction)
      expect(result.success).toBe(true)
      expect(result.id).toBe('test-sort')

      const retrieved = registry.get('test-sort')
      expect(retrieved).toBeDefined()
      expect(retrieved?.name).toBe('Test Sort')
    })

    it('should validate function ID format', () => {
      const invalidFunction: CustomSortFunction = {
        id: '123-invalid-start',
        name: 'Invalid Function',
        description: 'Function with invalid ID',
        supportedDataTypes: ['string'],
        priority: 50,
        version: '1.0.0',
        tags: [],
        handler: () => ({ sqlClause: '', parameters: [] }),
      }

      const result = registry.register(invalidFunction)
      expect(result.success).toBe(false)
      expect(result.error).toContain('alphanumeric with underscores/hyphens')
    })

    it('should prevent duplicate function IDs', () => {
      const function1: CustomSortFunction = {
        id: 'duplicate-test',
        name: 'First Function',
        description: 'First function',
        supportedDataTypes: ['string'],
        priority: 50,
        version: '1.0.0',
        tags: [],
        handler: () => ({ sqlClause: '', parameters: [] }),
      }

      const function2: CustomSortFunction = {
        id: 'duplicate-test',
        name: 'Second Function',
        description: 'Second function with same ID',
        supportedDataTypes: ['string'],
        priority: 60,
        version: '1.0.0',
        tags: [],
        handler: () => ({ sqlClause: '', parameters: [] }),
      }

      const result1 = registry.register(function1)
      expect(result1.success).toBe(true)

      const result2 = registry.register(function2)
      expect(result2.success).toBe(false)
      expect(result2.error).toContain('already exists')
    })

    it('should filter functions by data type', () => {
      const stringFunction: CustomSortFunction = {
        id: 'string-sort',
        name: 'String Sort',
        description: 'String sorting function',
        supportedDataTypes: ['string', 'text'],
        priority: 50,
        version: '1.0.0',
        tags: ['string'],
        handler: () => ({ sqlClause: '', parameters: [] }),
      }

      const numberFunction: CustomSortFunction = {
        id: 'number-sort',
        name: 'Number Sort',
        description: 'Number sorting function',
        supportedDataTypes: ['number', 'integer'],
        priority: 60,
        version: '1.0.0',
        tags: ['number'],
        handler: () => ({ sqlClause: '', parameters: [] }),
      }

      registry.register(stringFunction)
      registry.register(numberFunction)

      const stringFunctions = registry.getByDataType('string')
      expect(stringFunctions).toHaveLength(1)
      expect(stringFunctions[0].id).toBe('string-sort')

      const numberFunctions = registry.getByDataType('number')
      expect(numberFunctions).toHaveLength(1)
      expect(numberFunctions[0].id).toBe('number-sort')

      const textFunctions = registry.getByDataType('text')
      expect(textFunctions).toHaveLength(1)
      expect(textFunctions[0].id).toBe('string-sort')
    })

    it('should search functions by name, description, and tags', () => {
      const searchFunction: CustomSortFunction = {
        id: 'searchable-sort',
        name: 'Advanced Search Sort',
        description: 'Sophisticated sorting algorithm for complex queries',
        supportedDataTypes: ['string'],
        priority: 70,
        version: '1.0.0',
        tags: ['search', 'algorithm', 'advanced'],
        handler: () => ({ sqlClause: '', parameters: [] }),
      }

      registry.register(searchFunction)

      // Search by name
      const nameResults = registry.search('Advanced')
      expect(nameResults).toHaveLength(1)
      expect(nameResults[0].id).toBe('searchable-sort')

      // Search by description
      const descResults = registry.search('Sophisticated')
      expect(descResults).toHaveLength(1)

      // Search by tag
      const tagResults = registry.search('algorithm')
      expect(tagResults).toHaveLength(1)

      // Search with no matches
      const noResults = registry.search('nonexistent')
      expect(noResults).toHaveLength(0)
    })

    it('should execute custom sort functions with parameter validation', () => {
      const parameterizedFunction: CustomSortFunction = {
        id: 'param-sort',
        name: 'Parameterized Sort',
        description: 'Sort function with parameters',
        supportedDataTypes: ['string'],
        priority: 50,
        version: '1.0.0',
        tags: ['parameters'],
        parameters: {
          boost_factor: {
            name: 'boost_factor',
            type: 'number',
            required: true,
            description: 'Boost factor for sorting',
            validation: { min: 1, max: 10 },
          },
          case_sensitive: {
            name: 'case_sensitive',
            type: 'boolean',
            required: false,
            description: 'Case sensitive sorting',
            defaultValue: false,
          },
        },
        handler: (field, direction, context, parameters = {}) => {
          const boost = parameters.boost_factor || 1
          const caseSensitive = parameters.case_sensitive || false

          const collation = caseSensitive ? '' : 'COLLATE NOCASE'
          return {
            sqlClause: `ORDER BY ${context.nodeAlias}.${field} * ${boost} ${collation} ${direction.toUpperCase()}`,
            parameters: [],
          }
        },
      }

      registry.register(parameterizedFunction)

      // Execute with valid parameters
      const result1 = registry.execute('param-sort', 'name', 'asc', mockContext, {
        boost_factor: 5,
        case_sensitive: true,
      })
      expect(result1.sqlClause).toContain('* 5')
      expect(result1.sqlClause).not.toContain('COLLATE NOCASE')

      // Execute with missing required parameter
      expect(() => {
        registry.execute('param-sort', 'name', 'asc', mockContext, {})
      }).toThrow('Parameter validation failed')

      // Execute with parameter out of range
      expect(() => {
        registry.execute('param-sort', 'name', 'asc', mockContext, {
          boost_factor: 15,
        })
      }).toThrow('must be at most 10')
    })

    it('should track usage statistics', () => {
      const statsFunction: CustomSortFunction = {
        id: 'stats-sort',
        name: 'Stats Sort',
        description: 'Function for testing statistics',
        supportedDataTypes: ['string'],
        priority: 50,
        version: '1.0.0',
        tags: ['stats'],
        handler: () => ({ sqlClause: 'ORDER BY name ASC', parameters: [] }),
      }

      registry.register(statsFunction)

      // Execute multiple times
      registry.execute('stats-sort', 'name', 'asc', mockContext)
      registry.execute('stats-sort', 'name', 'desc', mockContext)
      registry.execute('stats-sort', 'name', 'asc', mockContext)

      const stats = registry.getUsageStats('stats-sort')
      expect(stats).toBeDefined()
      expect(stats!.callCount).toBe(3)
      expect(stats!.errorCount).toBe(0)
      expect(stats!.successRate).toBe(100)
      expect(stats!.averageExecutionTime).toBeGreaterThanOrEqual(0)
    })

    it('should handle function execution errors gracefully', () => {
      const errorFunction: CustomSortFunction = {
        id: 'error-sort',
        name: 'Error Sort',
        description: 'Function that throws errors',
        supportedDataTypes: ['string'],
        priority: 50,
        version: '1.0.0',
        tags: ['error'],
        handler: () => {
          throw new Error('Intentional test error')
        },
      }

      registry.register(errorFunction)

      expect(() => {
        registry.execute('error-sort', 'name', 'asc', mockContext)
      }).toThrow('Intentional test error')

      // Check error statistics
      const stats = registry.getUsageStats('error-sort')
      expect(stats!.errorCount).toBe(1)
      expect(stats!.successRate).toBe(0)
    })

    it('should export and provide registry information', () => {
      const testFunction: CustomSortFunction = {
        id: 'export-test',
        name: 'Export Test',
        description: 'Function for export testing',
        supportedDataTypes: ['string', 'number'],
        priority: 50,
        version: '1.0.0',
        tags: ['export', 'test'],
        handler: () => ({ sqlClause: '', parameters: [] }),
      }

      registry.register(testFunction)

      const info = registry.getInfo()
      expect(info.totalFunctions).toBe(1)
      expect(info.functionsByDataType.string).toBe(1)
      expect(info.functionsByDataType.number).toBe(1)
      expect(info.functionsByTag.export).toBe(1)
      expect(info.functionsByTag.test).toBe(1)

      const exportData = registry.exportToJSON()
      const parsed = JSON.parse(exportData)
      expect(parsed.functions).toHaveLength(1)
      expect(parsed.functions[0].id).toBe('export-test')
    })
  })

  describe('CustomSortStrategy', () => {
    beforeEach(() => {
      const testFunction: CustomSortFunction = {
        id: 'test-custom-sort',
        name: 'Test Custom Sort',
        description: 'Test custom sort function',
        supportedDataTypes: ['string'],
        priority: 60,
        version: '1.0.0',
        tags: ['test'],
        handler: (field, direction, context) => ({
          sqlClause: `ORDER BY UPPER(${context.nodeAlias}.${field}) ${direction.toUpperCase()}`,
          parameters: [],
        }),
      }
      registry.register(testFunction)
    })

    it('should determine if it can handle specific field/dataType combinations', () => {
      // Should handle fields with registered functions
      expect(customStrategy.canHandle('name', 'string')).toBe(true)

      // Should handle _custom_ prefixed fields
      expect(customStrategy.canHandle('_custom_sort', 'any')).toBe(true)

      // Should not handle unregistered combinations
      expect(customStrategy.canHandle('unknown', 'unknown')).toBe(false)
    })

    it('should build sort clauses using registered functions', () => {
      const result = customStrategy.buildSortClause('name', 'asc', mockContext)

      expect(result.sqlClause).toContain('ORDER BY UPPER(n.name) ASC')
      expect(result.parameters).toEqual([])
    })

    it('should build enhanced sort clauses with custom comparators', () => {
      const sortOption = {
        field: 'name',
        direction: SortDirection.DESC,
        customComparator: JSON.stringify({
          functionId: 'test-custom-sort',
          parameters: {},
        }),
      }

      const result = customStrategy.buildEnhancedSortClause(sortOption, mockContext)
      expect(result.sqlClause).toContain('ORDER BY UPPER(n.name) DESC')
    })

    it('should handle invalid custom comparator configurations', () => {
      const sortOption = {
        field: 'name',
        direction: SortDirection.ASC,
        customComparator: 'invalid-json',
      }

      expect(() => {
        customStrategy.buildEnhancedSortClause(sortOption, mockContext)
      }).toThrow('Failed to parse custom comparator')
    })

    it('should provide access to custom function management', () => {
      const allFunctions = customStrategy.getAvailableCustomFunctions()
      expect(allFunctions).toHaveLength(1)
      expect(allFunctions[0].id).toBe('test-custom-sort')

      const stringFunctions = customStrategy.getAvailableCustomFunctions('string')
      expect(stringFunctions).toHaveLength(1)

      const specificFunction = customStrategy.getCustomFunction('test-custom-sort')
      expect(specificFunction).toBeDefined()
      expect(specificFunction!.name).toBe('Test Custom Sort')

      const searchResults = customStrategy.searchCustomFunctions('Test')
      expect(searchResults).toHaveLength(1)

      const tagResults = customStrategy.getCustomFunctionsByTag('test')
      expect(tagResults).toHaveLength(1)
    })

    it('should return correct priority', () => {
      expect(customStrategy.getPriority()).toBe(40)
    })
  })

  describe('BuiltInCustomSortFunctions', () => {
    it('should register all built-in functions correctly', () => {
      const testRegistry = new CustomSortFunctionRegistry({ enableStats: false })
      BuiltInCustomSortFunctions.registerAll(testRegistry)

      const allFunctions = testRegistry.getAll()
      expect(allFunctions.length).toBeGreaterThan(0)

      // Check for specific built-in functions
      const naturalString = testRegistry.get('natural-string')
      expect(naturalString).toBeDefined()
      expect(naturalString!.name).toBe('Natural String Sort')

      const lengthSort = testRegistry.get('length-sort')
      expect(lengthSort).toBeDefined()
      expect(lengthSort!.name).toBe('Length-based Sort')

      const relevanceScore = testRegistry.get('relevance-score')
      expect(relevanceScore).toBeDefined()
      expect(relevanceScore!.name).toBe('Relevance Score Sort')

      const seededRandom = testRegistry.get('seeded-random')
      expect(seededRandom).toBeDefined()
      expect(seededRandom!.name).toBe('Seeded Random Sort')
    })

    it('should execute natural string sorting correctly', () => {
      const testRegistry = new CustomSortFunctionRegistry({ enableStats: false })
      BuiltInCustomSortFunctions.registerAll(testRegistry)

      const result = testRegistry.execute('natural-string', 'filename', 'asc', mockContext)
      expect(result.sqlClause).toContain('ORDER BY n.filename COLLATE NOCASE ASC')
    })

    it('should execute length-based sorting with parameters', () => {
      const testRegistry = new CustomSortFunctionRegistry({ enableStats: false })
      BuiltInCustomSortFunctions.registerAll(testRegistry)

      const result = testRegistry.execute('length-sort', 'description', 'asc', mockContext, {
        secondary_sort: 'desc',
      })
      expect(result.sqlClause).toContain('LENGTH(n.description) ASC, n.description DESC')
    })

    it('should execute relevance scoring with search terms', () => {
      const testRegistry = new CustomSortFunctionRegistry({ enableStats: false })
      BuiltInCustomSortFunctions.registerAll(testRegistry)

      const result = testRegistry.execute('relevance-score', 'content', 'desc', mockContext, {
        search_terms: ['test', 'sort'],
        boost_exact: 3.0,
      })
      expect(result.sqlClause).toContain('relevance_score DESC')
      expect(result.parameters).toEqual(['test', 'sort'])
    })

    it('should execute seeded random sorting', () => {
      const testRegistry = new CustomSortFunctionRegistry({ enableStats: false })
      BuiltInCustomSortFunctions.registerAll(testRegistry)

      const result = testRegistry.execute('seeded-random', 'id', 'asc', mockContext, {
        seed: 12345,
      })
      expect(result.sqlClause).toContain('(12345 + n.id * 31) % 1000 ASC')
    })

    it('should register individual built-in functions', () => {
      const testRegistry = new CustomSortFunctionRegistry({ enableStats: false })

      BuiltInCustomSortFunctions.register('natural-string', testRegistry)

      const allFunctions = testRegistry.getAll()
      expect(allFunctions).toHaveLength(1)
      expect(allFunctions[0].id).toBe('natural-string')
    })
  })

  describe('SortStrategyFactory Integration', () => {
    it('should provide custom sort function management methods', () => {
      // Test getting custom functions
      const customFunctions = getCustomSortFunctions()
      expect(Array.isArray(customFunctions)).toBe(true)

      const stringFunctions = getCustomSortFunctions('string')
      expect(Array.isArray(stringFunctions)).toBe(true)

      // Test search functionality
      const searchResults = searchCustomSortFunctions('natural')
      expect(Array.isArray(searchResults)).toBe(true)

      // Test registry info
      const registryInfo = getCustomSortRegistryInfo()
      expect(registryInfo).toHaveProperty('totalFunctions')
      expect(registryInfo).toHaveProperty('functionsByDataType')
      expect(registryInfo).toHaveProperty('functionsByTag')
    })

    it('should allow registration of new custom functions', () => {
      const customFunction: CustomSortFunction = {
        id: 'factory-test-sort',
        name: 'Factory Test Sort',
        description: 'Test function via factory',
        supportedDataTypes: ['string'],
        priority: 70,
        version: '1.0.0',
        tags: ['factory-test'],
        handler: () => ({ sqlClause: 'ORDER BY test', parameters: [] }),
      }

      const result = registerCustomSortFunction(customFunction)
      expect(result.success).toBe(true)

      const retrieved = getCustomSortFunction('factory-test-sort')
      expect(retrieved).toBeDefined()
      expect(retrieved!.name).toBe('Factory Test Sort')

      // Clean up
      unregisterCustomSortFunction('factory-test-sort')
    })

    it('should provide usage statistics through factory', () => {
      const stats = getCustomSortFunctionStats()
      expect(Array.isArray(stats)).toBe(true)

      // Test individual function stats
      const builtinFunctions = getCustomSortFunctions()
      if (builtinFunctions.length > 0) {
        const individualStats = getCustomSortFunctionStats(builtinFunctions[0].id)
        expect(individualStats).toBeDefined()
      }
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty registry gracefully', () => {
      const emptyRegistry = new CustomSortFunctionRegistry({ enableStats: false })
      const emptyStrategy = new CustomSortStrategy(emptyRegistry)

      expect(emptyStrategy.canHandle('test', 'string')).toBe(false)
      expect(() => {
        emptyStrategy.buildSortClause('test', 'asc', mockContext)
      }).toThrow('No custom sort function available')

      const allFunctions = emptyStrategy.getAvailableCustomFunctions()
      expect(allFunctions).toHaveLength(0)

      const searchResults = emptyStrategy.searchCustomFunctions('test')
      expect(searchResults).toHaveLength(0)
    })

    it('should handle invalid function execution gracefully', () => {
      const invalidFunction: CustomSortFunction = {
        id: 'invalid-handler',
        name: 'Invalid Handler',
        description: 'Function with invalid handler',
        supportedDataTypes: ['string'],
        priority: 50,
        version: '1.0.0',
        tags: ['invalid'],
        handler: () => {
          throw new Error('Handler execution failed')
        },
      }

      registry.register(invalidFunction)

      expect(() => {
        customStrategy.buildSortClause('name', 'asc', mockContext)
      }).toThrow("Custom sort function 'invalid-handler' failed")
    })

    it('should handle missing custom functions for enhanced sort', () => {
      const sortOption = {
        field: 'unknown_field',
        direction: SortDirection.ASC,
        customComparator: JSON.stringify({
          functionId: 'nonexistent-function',
          parameters: {},
        }),
      }

      expect(() => {
        customStrategy.buildEnhancedSortClause(sortOption, mockContext)
      }).toThrow("Custom sort function 'nonexistent-function' failed")
    })

    it('should maintain consistent state under high load', () => {
      const loadFunction: CustomSortFunction = {
        id: 'load-test-sort',
        name: 'Load Test Sort',
        description: 'Function for load testing',
        supportedDataTypes: ['string'],
        priority: 50,
        version: '1.0.0',
        tags: ['load'],
        handler: (field, direction, context) => ({
          sqlClause: `ORDER BY ${context.nodeAlias}.${field} ${direction.toUpperCase()}`,
          parameters: [],
        }),
      }

      registry.register(loadFunction)

      // Execute many operations concurrently
      const promises = Array.from({ length: 100 }, (_, _i) => {
        return new Promise<void>((resolve) => {
          const result = registry.execute('load-test-sort', 'name', 'asc', mockContext)
          expect(result.sqlClause).toContain('ORDER BY n.name ASC')
          resolve()
        })
      })

      return Promise.all(promises).then(() => {
        const stats = registry.getUsageStats('load-test-sort')
        expect(stats!.callCount).toBe(100)
        expect(stats!.successRate).toBe(100)
      })
    })
  })
})

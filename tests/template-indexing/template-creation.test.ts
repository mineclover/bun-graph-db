/**
 * Template Creation Tests
 * 
 * Tests for template creation with automatic parsing:
 * - QueryTemplate.create() with auto-parsing
 * - Database serialization (toDatabase())
 * - Schema field population (query_name, operation_type)
 * - Legacy compatibility (templateType vs operationType)
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import { testTemplates } from '../fixtures/test-templates.js'
import Database from 'bun:sqlite'

describe('Template Creation with Auto-Parsing', () => {
  let testDb: Database

  beforeEach(() => {
    testDb = new Database(':memory:')
    // Create test schema
    testDb.exec(`
      CREATE TABLE templates (
        identifier TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        query_text TEXT NOT NULL,
        query_name TEXT,
        operation_type TEXT,
        variables_schema TEXT,
        complexity_score INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_used_at TEXT,
        avg_execution_time_ms INTEGER DEFAULT 0,
        usage_count INTEGER DEFAULT 0
      )
    `)
  })

  afterEach(() => {
    testDb.close()
  })

  describe('QueryTemplate.create() Auto-Parsing', () => {
    it('should automatically extract query name and operation type', () => {
      testTemplates.forEach(template => {
        const queryTemplate = QueryTemplate.create(
          template.identifier,
          template.name,
          template.queryText,
          ['test'], // tags
          {
            variablesSchema: template.variablesSchema,
            description: template.description
          }
        )

        expect(queryTemplate.queryName).toBe(template.expectedQueryName)
        expect(queryTemplate.operationType).toBe(template.expectedOperationType)
      })
    })

    it('should calculate complexity score automatically', () => {
      const simpleTemplate = testTemplates.find(t => t.identifier === 'test-simple-query')!
      const complexTemplate = testTemplates.find(t => t.identifier === 'test-nested-query')!

      const simple = QueryTemplate.create(
        simpleTemplate.identifier,
        simpleTemplate.name,
        simpleTemplate.queryText,
        ['test']
      )

      const complex = QueryTemplate.create(
        complexTemplate.identifier,
        complexTemplate.name,
        complexTemplate.queryText,
        ['test']
      )

      expect(simple.complexityScore).toBeLessThan(complex.complexityScore)
      expect(simple.complexityScore).toBeGreaterThan(0)
      expect(complex.complexityScore).toBeGreaterThan(3)
    })

    it('should allow manual complexity score override', () => {
      const template = testTemplates[0]
      const customComplexity = 7

      const queryTemplate = QueryTemplate.create(
        template.identifier,
        template.name,
        template.queryText,
        ['test'],
        {
          complexityScore: customComplexity
        }
      )

      expect(queryTemplate.complexityScore).toBe(customComplexity)
    })

    it('should handle anonymous queries correctly', () => {
      const anonymousTemplate = testTemplates.find(t => t.identifier === 'test-anonymous-query')!

      const queryTemplate = QueryTemplate.create(
        anonymousTemplate.identifier,
        anonymousTemplate.name,
        anonymousTemplate.queryText,
        ['test']
      )

      expect(queryTemplate.queryName).toBeNull()
      expect(queryTemplate.operationType).toBe('query')
      expect(queryTemplate.complexityScore).toBeGreaterThan(0)
      expect(queryTemplate.complexityScore).toBeLessThan(5)
    })

    it('should set default values for optional fields', () => {
      const template = testTemplates[0]

      const queryTemplate = QueryTemplate.create(
        template.identifier,
        template.name,
        template.queryText,
        ['test']
      )

      expect(queryTemplate.usageCount).toBe(0)
      expect(queryTemplate.avgExecutionTimeMs).toBe(0)
      expect(queryTemplate.lastUsedAt).toBeNull()
      expect(queryTemplate.createdAt).toBeInstanceOf(Date)
    })
  })

  describe('Database Serialization', () => {
    it('should serialize to database format correctly', () => {
      testTemplates.forEach(template => {
        const queryTemplate = QueryTemplate.create(
          template.identifier,
          template.name,
          template.queryText,
          ['test'],
          {
            variablesSchema: template.variablesSchema,
            description: template.description
          }
        )

        const dbRow = queryTemplate.toDatabase()

        expect(dbRow.identifier).toBe(template.identifier)
        expect(dbRow.name).toBe(template.name)
        expect(dbRow.query_text).toBe(template.queryText)
        expect(dbRow.query_name).toBe(template.expectedQueryName)
        expect(dbRow.operation_type).toBe(template.expectedOperationType)
        if (template.variablesSchema) {
          expect(dbRow.variables_schema).toBe(JSON.stringify(template.variablesSchema))
        } else {
          expect(dbRow.variables_schema).toBeNull()
        }
        expect(typeof dbRow.complexity_score).toBe('number')
        expect(dbRow.created_at).toBeTruthy()
      })
    })

    it('should handle null values correctly in serialization', () => {
      const template = testTemplates.find(t => t.identifier === 'test-anonymous-query')!

      const queryTemplate = QueryTemplate.create(
        template.identifier,
        template.name,
        template.queryText,
        ['test']
      )

      const dbRow = queryTemplate.toDatabase()

      expect(dbRow.query_name).toBeNull()
      expect(dbRow.variables_schema).toBeNull()
      expect(dbRow.description).toBeNull()
      expect(dbRow.last_used_at).toBeNull()
    })

    it('should serialize performance tracking fields', () => {
      const template = testTemplates[0]

      const queryTemplate = QueryTemplate.create(
        template.identifier,
        template.name,
        template.queryText,
        ['test']
      )

      const dbRow = queryTemplate.toDatabase()

      expect(dbRow.usage_count).toBe(0)
      expect(dbRow.avg_execution_time_ms).toBe(0)
      expect(dbRow.last_used_at).toBeNull()
    })
  })

  describe('Legacy Compatibility', () => {
    it('should maintain backwards compatibility with templateType', () => {
      const template = testTemplates.find(t => t.expectedOperationType === 'mutation')!

      const queryTemplate = QueryTemplate.create(
        template.identifier,
        template.name,
        template.queryText,
        ['test']
      )

      // Both properties should return the same value
      expect(queryTemplate.operationType).toBe('mutation')
      expect(queryTemplate.templateType).toBe('mutation')
    })

    it('should handle legacy templateType in constructor', () => {
      const template = testTemplates[0]

      const queryTemplate = new QueryTemplate(
        null, // id
        template.identifier,
        template.name,
        null, // description
        template.queryText,
        null, // queryName
        'query', // operationType
        null, // variablesSchema
        null, // defaultVariables
        null, // applicableTables
        'query', // templateType (legacy)
        5, // complexityScore
        0, // usageCount
        null, // lastUsedAt
        0, // avgExecutionTimeMs
        '1.0.0', // version
        true, // isActive
        ['test'], // tags
        new Date(), // createdAt
        new Date() // updatedAt
      )

      expect(queryTemplate.operationType).toBe('query')
      expect(queryTemplate.templateType).toBe('query')
    })
  })

  describe('Performance Tracking Methods', () => {
    it('should update execution statistics correctly', () => {
      const template = testTemplates[0]

      const queryTemplate = QueryTemplate.create(
        template.identifier,
        template.name,
        template.queryText,
        ['test']
      )

      // Simulate multiple executions (returns new instances)
      let updated1 = queryTemplate.updateExecutionStats(100) // 100ms
      expect(updated1.usageCount).toBe(1)
      expect(updated1.avgExecutionTimeMs).toBe(100)
      expect(updated1.lastUsedAt).toBeInstanceOf(Date)

      let updated2 = updated1.updateExecutionStats(200) // 200ms
      expect(updated2.usageCount).toBe(2)
      expect(updated2.avgExecutionTimeMs).toBe(150) // (100 + 200) / 2

      let updated3 = updated2.updateExecutionStats(300) // 300ms
      expect(updated3.usageCount).toBe(3)
      expect(updated3.avgExecutionTimeMs).toBe(200) // (100 + 200 + 300) / 3
    })

    it('should handle edge cases in execution stats', () => {
      const template = testTemplates[0]

      const queryTemplate = QueryTemplate.create(
        template.identifier,
        template.name,
        template.queryText,
        ['test']
      )

      // Test with zero execution time
      let updated1 = queryTemplate.updateExecutionStats(0)
      expect(updated1.avgExecutionTimeMs).toBe(0)
      expect(updated1.usageCount).toBe(1)

      // Test with floating point execution time
      let updated2 = updated1.updateExecutionStats(123.456)
      expect(updated2.avgExecutionTimeMs).toBe(62) // Rounded average
      expect(updated2.usageCount).toBe(2)
    })
  })

  describe('Error Handling', () => {
    it('should throw on invalid GraphQL syntax during creation', () => {
      expect(() => {
        QueryTemplate.create(
          'invalid-syntax',
          'Invalid Query',
          'query {',
          ['test']
        )
      }).toThrow()
    })

    it('should validate required fields', () => {
      expect(() => {
        QueryTemplate.create(
          '',
          'Test',
          'query { health }',
          ['test']
        )
      }).toThrow() // Should throw due to empty identifier

      expect(() => {
        QueryTemplate.create(
          'test',
          'Test',
          '',
          ['test']
        )
      }).toThrow() // Should throw due to empty queryText
    })
  })
})
/**
 * GraphQL Parsing Tests
 *
 * Tests for GraphQLParser utility functionality including:
 * - Query name extraction from SDL
 * - Operation type detection (query/mutation/subscription)
 * - Complexity score calculation
 * - Syntax validation
 * - Variable extraction
 */

import { describe, expect, it } from 'bun:test'
import {
  calculateComplexityScore,
  extractOperationInfo,
  validateQuerySyntax,
} from '@/core/utils/GraphQLParser.js'
import { errorTestCases, sampleQueries } from '../fixtures/sample-queries.js'
import { testTemplates } from '../fixtures/test-templates.js'

describe('GraphQLParser', () => {
  describe('Operation Info Extraction', () => {
    it('should extract query name and operation type correctly', () => {
      const operationInfo = extractOperationInfo(sampleQueries.simpleQuery)

      expect(operationInfo.queryName).toBe('GetUser')
      expect(operationInfo.operationType).toBe('query')
    })

    it('should handle anonymous queries', () => {
      const operationInfo = extractOperationInfo(sampleQueries.anonymousQuery)

      expect(operationInfo.queryName).toBeNull()
      expect(operationInfo.operationType).toBe('query')
    })

    it('should detect mutation operations', () => {
      const operationInfo = extractOperationInfo(sampleQueries.mutation)

      expect(operationInfo.queryName).toBe('CreateUser')
      expect(operationInfo.operationType).toBe('mutation')
    })

    it('should detect subscription operations', () => {
      const operationInfo = extractOperationInfo(sampleQueries.subscription)

      expect(operationInfo.queryName).toBe('NodeUpdates')
      expect(operationInfo.operationType).toBe('subscription')
    })

    it('should handle complex nested queries', () => {
      const operationInfo = extractOperationInfo(sampleQueries.nestedQuery)

      expect(operationInfo.queryName).toBe('GetNodeWithRelations')
      expect(operationInfo.operationType).toBe('query')
    })

    it('should handle queries with complex variables', () => {
      const operationInfo = extractOperationInfo(sampleQueries.complexVariablesQuery)

      expect(operationInfo.queryName).toBe('SearchNodes')
      expect(operationInfo.operationType).toBe('query')
    })
  })

  describe('Complexity Calculation', () => {
    it('should calculate correct complexity for simple queries', () => {
      const complexity = calculateComplexityScore(sampleQueries.simpleQuery)
      expect(complexity).toBeGreaterThan(0)
      expect(complexity).toBeLessThan(5)
    })

    it('should assign higher complexity to nested queries', () => {
      const simpleComplexity = calculateComplexityScore(sampleQueries.simpleQuery)
      const complexComplexity = calculateComplexityScore(sampleQueries.nestedQuery)

      expect(complexComplexity).toBeGreaterThan(simpleComplexity)
    })

    it('should handle anonymous queries complexity', () => {
      const complexity = calculateComplexityScore(sampleQueries.anonymousQuery)
      expect(complexity).toBeGreaterThan(0)
      expect(complexity).toBeLessThan(5) // Should be low complexity
    })
  })

  describe('Query Validation', () => {
    it('should validate correct GraphQL syntax', () => {
      const result1 = validateQuerySyntax(sampleQueries.simpleQuery)
      const result2 = validateQuerySyntax(sampleQueries.complexQuery)
      const result3 = validateQuerySyntax(sampleQueries.mutation)

      expect(result1.isValid).toBe(true)
      expect(result1.errors).toHaveLength(0)
      expect(result2.isValid).toBe(true)
      expect(result2.errors).toHaveLength(0)
      expect(result3.isValid).toBe(true)
      expect(result3.errors).toHaveLength(0)
    })

    it('should return validation errors for invalid syntax', () => {
      const result1 = validateQuerySyntax('invalid graphql')
      const result2 = validateQuerySyntax('query {')
      const result3 = validateQuerySyntax('')

      expect(result1.isValid).toBe(false)
      expect(result1.errors.length).toBeGreaterThan(0)
      expect(result2.isValid).toBe(false)
      expect(result2.errors.length).toBeGreaterThan(0)
      expect(result3.isValid).toBe(false)
      expect(result3.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Template Test Cases Validation', () => {
    it('should correctly parse all test template queries', () => {
      testTemplates.forEach((template) => {
        const operationInfo = extractOperationInfo(template.queryText)

        expect(operationInfo.queryName).toBe(template.expectedQueryName)
        expect(operationInfo.operationType).toBe(template.expectedOperationType)

        const complexity = calculateComplexityScore(template.queryText)
        expect(complexity).toBeGreaterThan(0)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed queries gracefully', () => {
      errorTestCases.forEach((testCase) => {
        if (testCase.expectError) {
          expect(() => extractOperationInfo(testCase.queryText)).toThrow()
        }
      })
    })

    it('should provide meaningful error messages', () => {
      try {
        extractOperationInfo('query {')
        expect(true).toBe(false) // Should not reach this line
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toContain('Failed to parse GraphQL operation')
      }
    })
  })

  describe('Performance', () => {
    it('should parse queries efficiently', () => {
      const startTime = performance.now()

      // Parse multiple queries
      for (let i = 0; i < 100; i++) {
        extractOperationInfo(sampleQueries.simpleQuery)
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Should complete 100 parses in less than 100ms
      expect(totalTime).toBeLessThan(100)
    })
  })
})

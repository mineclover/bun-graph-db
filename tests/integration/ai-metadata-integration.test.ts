/**
 * AIMetadata Integration Tests
 *
 * Integration tests for AIMetadata functionality through GraphQL API
 * - End-to-end AIMetadata retrieval
 * - GraphQL schema validation
 * - Real database integration
 * - Performance validation
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import {
  enableLegacyAiMetadataCompatibility,
  type IsolatedTestContext,
  setupIntegrationTest,
} from '../fixtures/test-isolation-helpers'
import {
  insertAttribute,
  insertNode,
  insertNodeAttributes,
  insertTable,
  insertTemplate,
} from '../fixtures/ai-metadata-fixtures'

const SUITE_NAME = 'ai-metadata-integration'
let testContext: IsolatedTestContext

describe('AIMetadata Integration Tests', () => {
  beforeAll(async () => {
    console.log('🚀 Setting up AIMetadata integration test environment...')
    testContext = await setupIntegrationTest(SUITE_NAME)
    enableLegacyAiMetadataCompatibility(testContext.database?.database.getConnection())
    console.log('✅ AIMetadata integration test environment ready')
    console.log(`🌐 GraphQL Server: ${testContext.server?.url}`)
    console.log(`💾 Database: ${testContext.database?.databasePath}`)
  }, 30000)

  afterAll(async () => {
    console.log('🧹 Cleaning up AIMetadata integration test environment...')
    await testContext.cleanup()
    console.log('✅ Cleanup completed')
  }, 10000)

  describe('GraphQL Schema Integration', () => {
    test('should have AIMetadata types in GraphQL schema', async () => {
      const query = `
        query IntrospectAIMetadata {
          __type(name: "AIMetadata") {
            name
            kind
            fields {
              name
              type {
                name
                kind
                ofType {
                  name
                }
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query)

      expect(result.data).toBeDefined()
      expect(result.data.__type).toBeDefined()
      expect(result.data.__type.name).toBe('AIMetadata')

      const fields = result.data.__type.fields
      const fieldNames = fields.map((field: any) => field.name)

      // Verify expected AIMetadata fields
      expect(fieldNames).toContain('schemaInfo')
      expect(fieldNames).toContain('usagePatterns')
      expect(fieldNames).toContain('sampleData')
    })

    test('should have AISchemaInfo type definition', async () => {
      const query = `
        query IntrospectAISchemaInfo {
          __type(name: "AISchemaInfo") {
            name
            fields {
              name
              type {
                name
                kind
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query)

      expect(result.data.__type).toBeDefined()
      expect(result.data.__type.name).toBe('AISchemaInfo')

      const fieldNames = result.data.__type.fields.map((field: any) => field.name)
      expect(fieldNames).toContain('dataTypes')
      expect(fieldNames).toContain('requiredFields')
      expect(fieldNames).toContain('searchableFields')
      expect(fieldNames).toContain('relationshipCapabilities')
    })

    test('should have AIUsagePatterns type definition', async () => {
      const query = `
        query IntrospectAIUsagePatterns {
          __type(name: "AIUsagePatterns") {
            name
            fields {
              name
              type {
                name
                kind
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query)

      expect(result.data.__type).toBeDefined()
      expect(result.data.__type.name).toBe('AIUsagePatterns')

      const fieldNames = result.data.__type.fields.map((field: any) => field.name)
      expect(fieldNames).toContain('commonQueries')
      expect(fieldNames).toContain('templateRecommendations')
      expect(fieldNames).toContain('queryComplexity')
    })
  })

  describe('End-to-End AIMetadata Retrieval', () => {
    test('should create test data and retrieve AIMetadata', async () => {
      const db = testContext.database?.database.getConnection()

      // Create test table
      const table = insertTable(db as any, {
        identifier: 'test-users',
        description: 'Test user table for AIMetadata',
      })
      const tableId = table.id

      insertAttribute(db as any, {
        tableId,
        identifier: 'name',
        name: 'Full Name',
        attributeTypeIdentifier: 'text',
        required: true,
        searchable: true,
      })
      insertAttribute(db as any, {
        tableId,
        identifier: 'email',
        name: 'Email Address',
        attributeTypeIdentifier: 'email',
        required: true,
        searchable: true,
      })
      insertAttribute(db as any, {
        tableId,
        identifier: 'age',
        name: 'Age',
        attributeTypeIdentifier: 'number',
        required: false,
        searchable: false,
      })

      insertTemplate(db as any, {
        identifier: 'create-test-user',
        name: 'Create Test User',
        description: 'Creates a test user',
        query: 'query CreateTestUser { healthCheck { status } }',
        tableId,
        tableIdentifier: table.identifier,
      })
      insertTemplate(db as any, {
        identifier: 'update-test-user',
        name: 'Update Test User',
        description: 'Updates a test user',
        query: 'query UpdateTestUser { healthCheck { status } }',
        tableId,
        tableIdentifier: table.identifier,
      })

      const john = insertNode(db as any, { tableId, title: 'John Doe', content: 'Software Engineer' })
      const jane = insertNode(db as any, { tableId, title: 'Jane Smith', content: 'Product Manager' })
      insertNodeAttributes(db as any, {
        nodeId: john.id,
        tableId,
        values: {
          name: 'John Doe',
          email: 'john.doe@company.com',
          age: '30',
        },
      })
      insertNodeAttributes(db as any, {
        nodeId: jane.id,
        tableId,
        values: {
          name: 'Jane Smith',
          email: 'jane.smith@company.com',
          age: '28',
        },
      })

      // Query AIMetadata through GraphQL
      const query = `
        query GetTableWithAIMetadata($tableId: ID!) {
          table(id: $tableId) {
            id
            identifier
            name
            description
            aiMetadata {
              schemaInfo {
                dataTypes
                requiredFields
                searchableFields
                relationshipCapabilities
              }
              usagePatterns {
                commonQueries {
                  pattern
                  description
                  example
                }
                templateRecommendations {
                  templateId
                  useCase
                }
                queryComplexity
              }
              sampleData {
                entries {
                  nodeId
                  title
                  content
                  attributes
                }
                totalCount
                hasMore
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query, {
        tableId,
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.table).toBeDefined()
      expect(result.data.table.aiMetadata).toBeDefined()

      const aiMetadata = result.data.table.aiMetadata

      // Verify schema info
      expect(aiMetadata.schemaInfo).toBeDefined()
      expect(aiMetadata.schemaInfo.dataTypes).toBeDefined()
      expect(Array.isArray(aiMetadata.schemaInfo.requiredFields)).toBe(true)
      expect(Array.isArray(aiMetadata.schemaInfo.searchableFields)).toBe(true)

      // Verify usage patterns
      expect(aiMetadata.usagePatterns).toBeDefined()
      expect(Array.isArray(aiMetadata.usagePatterns.commonQueries)).toBe(true)
      expect(Array.isArray(aiMetadata.usagePatterns.templateRecommendations)).toBe(true)
      expect(['simple', 'moderate', 'complex']).toContain(aiMetadata.usagePatterns.queryComplexity)

      // Verify sample data
      expect(aiMetadata.sampleData).toBeDefined()
      expect(Array.isArray(aiMetadata.sampleData.entries)).toBe(true)
      expect(typeof aiMetadata.sampleData.totalCount).toBe('number')
      expect(typeof aiMetadata.sampleData.hasMore).toBe('boolean')

      console.log('✅ AIMetadata integration test completed successfully')
    })

    test('should handle non-existent table gracefully', async () => {
      const query = `
        query GetNonExistentTable($tableId: ID!) {
          table(id: $tableId) {
            id
            aiMetadata {
              schemaInfo {
                dataTypes
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query, {
        tableId: 'non-existent-table-id',
      })

      // Should return null for non-existent table without errors
      expect(result.data.table).toBeNull()
      expect(result.errors).toBeUndefined()
    })

    test('should support custom sample limits', async () => {
      const db = testContext.database?.database.getConnection()

      // Create table with multiple nodes
      const table = insertTable(db as any, {
        identifier: 'sample-test',
        description: 'Sample Test Table',
      })
      const tableId = table.id

      // Create multiple sample nodes
      for (let i = 1; i <= 10; i++) {
        insertNode(db as any, {
          tableId,
          title: `Sample ${i}`,
          content: `Content ${i}`,
        })
      }

      // Query with specific sample limit
      const query = `
        query GetTableWithLimitedSamples($tableId: ID!, $sampleLimit: Int) {
          table(id: $tableId) {
            id
            aiMetadata(sampleLimit: $sampleLimit) {
              sampleData {
                entries {
                  nodeId
                  title
                }
                totalCount
                hasMore
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query, {
        tableId,
        sampleLimit: 3,
      })

      expect(result.data.table.aiMetadata.sampleData.entries.length).toBeLessThanOrEqual(3)
    })
  })

  describe('Performance and Scalability', () => {
    test('should handle large tables efficiently', async () => {
      const db = testContext.database?.database.getConnection()
      const table = insertTable(db as any, {
        identifier: 'large-table',
        description: 'Large Table Test',
      })
      const tableId = table.id

      // Create many attributes
      for (let i = 1; i <= 50; i++) {
        insertAttribute(db as any, {
          tableId,
          identifier: `field_${i}`,
          name: `Field ${i}`,
          attributeTypeIdentifier: 'text',
          required: i <= 10,
          searchable: i % 2 === 1,
        })
      }

      const startTime = performance.now()

      const query = `
        query GetLargeTable($tableId: ID!) {
          table(id: $tableId) {
            id
            aiMetadata {
              schemaInfo {
                dataTypes
                requiredFields
                searchableFields
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query, {
        tableId,
      })

      const duration = performance.now() - startTime

      expect(result.data.table.aiMetadata).toBeDefined()
      expect(duration).toBeLessThan(2000) // Should complete within 2 seconds

      const schemaInfo = result.data.table.aiMetadata.schemaInfo
      expect(schemaInfo.requiredFields.length).toBe(10) // First 10 attributes are required
      expect(schemaInfo.searchableFields.length).toBe(25) // Half are searchable
    })

    test('should handle concurrent AIMetadata requests', async () => {
      const db = testContext.database?.database.getConnection()
      const tableIds: string[] = []

      // Create multiple test tables
      for (let i = 1; i <= 5; i++) {
        const table = insertTable(db as any, {
          identifier: `concurrent-${i}`,
          description: `Concurrent Test ${i}`,
        })
        tableIds.push(table.id)

        insertAttribute(db as any, {
          tableId: table.id,
          identifier: 'name',
          name: 'Name',
          attributeTypeIdentifier: 'text',
          required: true,
          searchable: true,
        })
      }

      const query = `
        query GetTableAIMetadata($tableId: ID!) {
          table(id: $tableId) {
            id
            aiMetadata {
              schemaInfo {
                requiredFields
                searchableFields
              }
            }
          }
        }
      `

      const startTime = performance.now()

      // Send concurrent requests
      const promises = tableIds.map((tableId) => testContext.graphqlRequest?.(query, { tableId }))

      const results = await Promise.all(promises)
      const duration = performance.now() - startTime

      // All requests should succeed
      results.forEach((result, index) => {
        expect(result.data.table).toBeDefined()
        expect(result.data.table.id).toBe(tableIds[index])
        expect(result.data.table.aiMetadata).toBeDefined()
      })

      // Should handle concurrent requests efficiently
      expect(duration).toBeLessThan(3000) // < 3 seconds for 5 concurrent requests
    })

    test('should cache AIMetadata appropriately', async () => {
      const db = testContext.database?.database.getConnection()
      const table = insertTable(db as any, {
        identifier: 'cache-test',
        description: 'Cache Test Table',
      })
      const tableId = table.id

      const query = `
        query GetTableAIMetadata($tableId: ID!) {
          table(id: $tableId) {
            id
            aiMetadata {
              schemaInfo {
                dataTypes
              }
            }
          }
        }
      `

      // First request
      const startTime1 = performance.now()
      const result1 = await testContext.graphqlRequest?.(query, { tableId })
      const _duration1 = performance.now() - startTime1

      // Second request (should be potentially faster if cached)
      const startTime2 = performance.now()
      const result2 = await testContext.graphqlRequest?.(query, { tableId })
      const _duration2 = performance.now() - startTime2

      // Both should return valid data
      expect(result1.data.table.aiMetadata).toBeDefined()
      expect(result2.data.table.aiMetadata).toBeDefined()

      // Data should be consistent
      expect(result1.data.table.id).toBe(result2.data.table.id)
    })
  })

  describe('Data Quality and Validation', () => {
    test('should provide accurate schema information', async () => {
      const db = testContext.database?.database.getConnection()
      const table = insertTable(db as any, {
        identifier: 'accuracy-test',
        description: 'Accuracy Test',
      })
      const tableId = table.id

      // Create attributes with specific characteristics
      insertAttribute(db as any, {
        tableId,
        identifier: 'required_field',
        name: 'Required Field',
        attributeTypeIdentifier: 'text',
        required: true,
        searchable: false,
      })
      insertAttribute(db as any, {
        tableId,
        identifier: 'searchable_field',
        name: 'Searchable Field',
        attributeTypeIdentifier: 'text',
        required: false,
        searchable: true,
      })
      insertAttribute(db as any, {
        tableId,
        identifier: 'both_field',
        name: 'Required and Searchable',
        attributeTypeIdentifier: 'text',
        required: true,
        searchable: true,
      })
      insertAttribute(db as any, {
        tableId,
        identifier: 'neither_field',
        name: 'Neither Required nor Searchable',
        attributeTypeIdentifier: 'text',
        required: false,
        searchable: false,
      })

      const query = `
        query GetAccuracyTest($tableId: ID!) {
          table(id: $tableId) {
            id
            aiMetadata {
              schemaInfo {
                dataTypes
                requiredFields
                searchableFields
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query, { tableId })

      const schemaInfo = result.data.table.aiMetadata.schemaInfo

      // Verify required fields
      expect(schemaInfo.requiredFields).toContain('required_field')
      expect(schemaInfo.requiredFields).toContain('both_field')
      expect(schemaInfo.requiredFields).not.toContain('searchable_field')
      expect(schemaInfo.requiredFields).not.toContain('neither_field')

      // Verify searchable fields
      expect(schemaInfo.searchableFields).toContain('searchable_field')
      expect(schemaInfo.searchableFields).toContain('both_field')
      expect(schemaInfo.searchableFields).not.toContain('required_field')
      expect(schemaInfo.searchableFields).not.toContain('neither_field')

      // Verify data types
      expect(schemaInfo.dataTypes).toHaveProperty('required_field')
      expect(schemaInfo.dataTypes).toHaveProperty('searchable_field')
      expect(schemaInfo.dataTypes).toHaveProperty('both_field')
      expect(schemaInfo.dataTypes).toHaveProperty('neither_field')
    })

    test('should handle various attribute types correctly', async () => {
      const db = testContext.database?.database.getConnection()
      const table = insertTable(db as any, {
        identifier: 'types-test',
        description: 'Types Test',
      })
      const tableId = table.id

      // Create attributes with different types
      insertAttribute(db as any, {
        tableId,
        identifier: 'text_field',
        name: 'Text Field',
        attributeTypeIdentifier: 'text',
        required: true,
        searchable: true,
      })
      insertAttribute(db as any, {
        tableId,
        identifier: 'number_field',
        name: 'Number Field',
        attributeTypeIdentifier: 'number',
        required: true,
        searchable: false,
      })
      insertAttribute(db as any, {
        tableId,
        identifier: 'email_field',
        name: 'Email Field',
        attributeTypeIdentifier: 'email',
        required: true,
        searchable: true,
      })
      insertAttribute(db as any, {
        tableId,
        identifier: 'date_field',
        name: 'Date Field',
        attributeTypeIdentifier: 'date',
        required: false,
        searchable: false,
      })

      const query = `
        query GetTypesTest($tableId: ID!) {
          table(id: $tableId) {
            id
            aiMetadata {
              schemaInfo {
                dataTypes
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query, { tableId })

      const dataTypes = result.data.table.aiMetadata.schemaInfo.dataTypes

      // Verify type mappings
      expect(dataTypes.text_field).toBe('text')
      expect(dataTypes.number_field).toBe('number')
      expect(dataTypes.email_field).toBe('email')
      expect(dataTypes.date_field).toBe('date')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle tables with no attributes', async () => {
      const db = testContext.database?.database.getConnection()
      const table = insertTable(db as any, {
        identifier: 'empty-attrs',
        description: 'Empty Attributes',
      })
      const tableId = table.id

      const query = `
        query GetEmptyAttrsTable($tableId: ID!) {
          table(id: $tableId) {
            id
            aiMetadata {
              schemaInfo {
                dataTypes
                requiredFields
                searchableFields
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query, { tableId })

      expect(result.data.table.aiMetadata).toBeDefined()

      const schemaInfo = result.data.table.aiMetadata.schemaInfo
      expect(schemaInfo.requiredFields).toEqual([])
      expect(schemaInfo.searchableFields).toEqual([])
      expect(typeof schemaInfo.dataTypes).toBe('object')
    })

    test('should handle tables with no templates', async () => {
      const db = testContext.database?.database.getConnection()
      const table = insertTable(db as any, {
        identifier: 'no-templates',
        description: 'No Templates',
      })
      const tableId = table.id

      const query = `
        query GetNoTemplatesTable($tableId: ID!) {
          table(id: $tableId) {
            id
            aiMetadata {
              usagePatterns {
                templateRecommendations {
                  templateId
                  useCase
                }
                queryComplexity
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query, { tableId })

      expect(result.data.table.aiMetadata).toBeDefined()

      const usagePatterns = result.data.table.aiMetadata.usagePatterns
      expect(usagePatterns.templateRecommendations).toEqual([])
      expect(usagePatterns.queryComplexity).toBe('simple')
    })

    test('should handle database connection issues gracefully', async () => {
      // This test would require mocking database failures
      // For now, test basic error handling through invalid queries

      const query = `
        query GetInvalidTable {
          table(id: null) {
            aiMetadata {
              schemaInfo {
                dataTypes
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest?.(query)

      // Should handle null ID gracefully
      expect(result.errors).toBeDefined()
      expect(result.errors[0].message).toContain('null')
    })
  })
})

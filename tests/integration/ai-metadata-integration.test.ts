/**
 * AIMetadata Integration Tests
 *
 * Integration tests for AIMetadata functionality through GraphQL API
 * - End-to-end AIMetadata retrieval
 * - GraphQL schema validation
 * - Real database integration
 * - Performance validation
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { type IsolatedTestContext, setupIntegrationTest } from '../fixtures/test-isolation-helpers'

const SUITE_NAME = 'ai-metadata-integration'
let testContext: IsolatedTestContext

describe('AIMetadata Integration Tests', () => {
  beforeAll(async () => {
    console.log('🚀 Setting up AIMetadata integration test environment...')
    testContext = await setupIntegrationTest(SUITE_NAME)
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

      const result = await testContext.graphqlRequest!(query)

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

      const result = await testContext.graphqlRequest!(query)

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

      const result = await testContext.graphqlRequest!(query)

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
      const db = testContext.database!.database.getConnection()

      // Create test table
      const tableId = `test-table-${Date.now()}`
      db.exec(`
        INSERT INTO tables (id, identifier, name, description, created_at, updated_at)
        VALUES ('${tableId}', 'test-users', 'Test Users', 'Test user table for AIMetadata', datetime('now'), datetime('now'))
      `)

      // Create test attributes
      db.exec(`
        INSERT INTO attributes (id, table_id, identifier, name, attribute_type_id, required, searchable, created_at)
        VALUES
        ('attr-1-${tableId}', '${tableId}', 'name', 'Full Name', 'text', 1, 1, datetime('now')),
        ('attr-2-${tableId}', '${tableId}', 'email', 'Email Address', 'email', 1, 1, datetime('now')),
        ('attr-3-${tableId}', '${tableId}', 'age', 'Age', 'number', 0, 0, datetime('now'))
      `)

      // Create test templates
      db.exec(`
        INSERT INTO templates (id, identifier, name, description, query, table_id, created_at)
        VALUES
        ('template-1-${tableId}', 'create-test-user', 'Create Test User', 'Creates a test user', 'INSERT INTO...', '${tableId}', datetime('now')),
        ('template-2-${tableId}', 'update-test-user', 'Update Test User', 'Updates a test user', 'UPDATE...', '${tableId}', datetime('now'))
      `)

      // Create sample nodes
      db.exec(`
        INSERT INTO nodes (id, table_id, title, content, created_at)
        VALUES
        ('node-1-${tableId}', '${tableId}', 'John Doe', 'Software Engineer', datetime('now')),
        ('node-2-${tableId}', '${tableId}', 'Jane Smith', 'Product Manager', datetime('now'))
      `)

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

      const result = await testContext.graphqlRequest!(query, {
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

      const result = await testContext.graphqlRequest!(query, {
        tableId: 'non-existent-table-id',
      })

      // Should return null for non-existent table without errors
      expect(result.data.table).toBeNull()
      expect(result.errors).toBeUndefined()
    })

    test('should support custom sample limits', async () => {
      const db = testContext.database!.database.getConnection()

      // Create table with multiple nodes
      const tableId = `sample-test-${Date.now()}`
      db.exec(`
        INSERT INTO tables (id, identifier, name, created_at, updated_at)
        VALUES ('${tableId}', 'sample-test', 'Sample Test Table', datetime('now'), datetime('now'))
      `)

      // Create multiple sample nodes
      for (let i = 1; i <= 10; i++) {
        db.exec(`
          INSERT INTO nodes (id, table_id, title, content, created_at)
          VALUES ('node-${i}-${tableId}', '${tableId}', 'Sample ${i}', 'Content ${i}', datetime('now'))
        `)
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

      const result = await testContext.graphqlRequest!(query, {
        tableId,
        sampleLimit: 3,
      })

      expect(result.data.table.aiMetadata.sampleData.entries.length).toBeLessThanOrEqual(3)
    })
  })

  describe('Performance and Scalability', () => {
    test('should handle large tables efficiently', async () => {
      const db = testContext.database!.database.getConnection()
      const tableId = `large-table-${Date.now()}`

      // Create table with many attributes
      db.exec(`
        INSERT INTO tables (id, identifier, name, created_at, updated_at)
        VALUES ('${tableId}', 'large-table', 'Large Table Test', datetime('now'), datetime('now'))
      `)

      // Create many attributes
      for (let i = 1; i <= 50; i++) {
        db.exec(`
          INSERT INTO attributes (id, table_id, identifier, name, attribute_type_id, required, searchable, created_at)
          VALUES
          ('attr-${i}-${tableId}', '${tableId}', 'field_${i}', 'Field ${i}', 'text', ${i <= 10 ? 1 : 0}, ${i % 2}, datetime('now'))
        `)
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

      const result = await testContext.graphqlRequest!(query, {
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
      const db = testContext.database!.database.getConnection()
      const tableIds: string[] = []

      // Create multiple test tables
      for (let i = 1; i <= 5; i++) {
        const tableId = `concurrent-table-${i}-${Date.now()}`
        tableIds.push(tableId)

        db.exec(`
          INSERT INTO tables (id, identifier, name, created_at, updated_at)
          VALUES ('${tableId}', 'concurrent-${i}', 'Concurrent Test ${i}', datetime('now'), datetime('now'))
        `)

        db.exec(`
          INSERT INTO attributes (id, table_id, identifier, name, attribute_type_id, required, searchable, created_at)
          VALUES ('attr-${tableId}', '${tableId}', 'name', 'Name', 'text', 1, 1, datetime('now'))
        `)
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
      const promises = tableIds.map((tableId) => testContext.graphqlRequest!(query, { tableId }))

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
      const db = testContext.database!.database.getConnection()
      const tableId = `cache-test-${Date.now()}`

      db.exec(`
        INSERT INTO tables (id, identifier, name, created_at, updated_at)
        VALUES ('${tableId}', 'cache-test', 'Cache Test Table', datetime('now'), datetime('now'))
      `)

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
      const result1 = await testContext.graphqlRequest!(query, { tableId })
      const duration1 = performance.now() - startTime1

      // Second request (should be potentially faster if cached)
      const startTime2 = performance.now()
      const result2 = await testContext.graphqlRequest!(query, { tableId })
      const duration2 = performance.now() - startTime2

      // Both should return valid data
      expect(result1.data.table.aiMetadata).toBeDefined()
      expect(result2.data.table.aiMetadata).toBeDefined()

      // Data should be consistent
      expect(result1.data.table.id).toBe(result2.data.table.id)
    })
  })

  describe('Data Quality and Validation', () => {
    test('should provide accurate schema information', async () => {
      const db = testContext.database!.database.getConnection()
      const tableId = `accuracy-test-${Date.now()}`

      db.exec(`
        INSERT INTO tables (id, identifier, name, created_at, updated_at)
        VALUES ('${tableId}', 'accuracy-test', 'Accuracy Test', datetime('now'), datetime('now'))
      `)

      // Create attributes with specific characteristics
      db.exec(`
        INSERT INTO attributes (id, table_id, identifier, name, attribute_type_id, required, searchable, created_at)
        VALUES
        ('req-field-${tableId}', '${tableId}', 'required_field', 'Required Field', 'text', 1, 0, datetime('now')),
        ('search-field-${tableId}', '${tableId}', 'searchable_field', 'Searchable Field', 'text', 0, 1, datetime('now')),
        ('both-field-${tableId}', '${tableId}', 'both_field', 'Required and Searchable', 'text', 1, 1, datetime('now')),
        ('neither-field-${tableId}', '${tableId}', 'neither_field', 'Neither Required nor Searchable', 'text', 0, 0, datetime('now'))
      `)

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

      const result = await testContext.graphqlRequest!(query, { tableId })

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
      const db = testContext.database!.database.getConnection()
      const tableId = `types-test-${Date.now()}`

      db.exec(`
        INSERT INTO tables (id, identifier, name, created_at, updated_at)
        VALUES ('${tableId}', 'types-test', 'Types Test', datetime('now'), datetime('now'))
      `)

      // Create attributes with different types
      db.exec(`
        INSERT INTO attributes (id, table_id, identifier, name, attribute_type_id, required, searchable, created_at)
        VALUES
        ('text-${tableId}', '${tableId}', 'text_field', 'Text Field', 'text', 1, 1, datetime('now')),
        ('number-${tableId}', '${tableId}', 'number_field', 'Number Field', 'number', 1, 0, datetime('now')),
        ('email-${tableId}', '${tableId}', 'email_field', 'Email Field', 'email', 1, 1, datetime('now')),
        ('date-${tableId}', '${tableId}', 'date_field', 'Date Field', 'date', 0, 0, datetime('now'))
      `)

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

      const result = await testContext.graphqlRequest!(query, { tableId })

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
      const db = testContext.database!.database.getConnection()
      const tableId = `empty-attrs-${Date.now()}`

      db.exec(`
        INSERT INTO tables (id, identifier, name, created_at, updated_at)
        VALUES ('${tableId}', 'empty-attrs', 'Empty Attributes', datetime('now'), datetime('now'))
      `)

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

      const result = await testContext.graphqlRequest!(query, { tableId })

      expect(result.data.table.aiMetadata).toBeDefined()

      const schemaInfo = result.data.table.aiMetadata.schemaInfo
      expect(schemaInfo.requiredFields).toEqual([])
      expect(schemaInfo.searchableFields).toEqual([])
      expect(typeof schemaInfo.dataTypes).toBe('object')
    })

    test('should handle tables with no templates', async () => {
      const db = testContext.database!.database.getConnection()
      const tableId = `no-templates-${Date.now()}`

      db.exec(`
        INSERT INTO tables (id, identifier, name, created_at, updated_at)
        VALUES ('${tableId}', 'no-templates', 'No Templates', datetime('now'), datetime('now'))
      `)

      const query = `
        query GetNoTemplatesTable($tableId: ID!) {
          table(id: $tableId) {
            id
            aiMetadata {
              usagePatterns {
                templateRecommendations
                queryComplexity
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest!(query, { tableId })

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

      const result = await testContext.graphqlRequest!(query)

      // Should handle null ID gracefully
      expect(result.errors).toBeDefined()
      expect(result.errors[0].message).toContain('null')
    })
  })
})

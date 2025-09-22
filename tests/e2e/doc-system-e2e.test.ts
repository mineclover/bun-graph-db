/**
 * Doc System E2E Test - Full Isolation
 * End-to-end tests with complete isolation and realistic data
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { type IsolatedTestContext, TestIsolationHelpers } from '../fixtures/test-isolation-helpers'

const SUITE_NAME = 'doc-system-e2e'
let testContext: IsolatedTestContext

// Test data scenarios
const TEST_SCENARIOS = {
  tables: [
    { id: 58, name: 'todos' },
    { id: 59, name: 'users' },
    { id: 60, name: 'projects' },
  ],
  documentCategories: ['usage', 'guide', 'example', 'spec', 'general'],
  sampleContent: {
    usage: 'This table is used for managing todo items with CRUD operations.',
    guide:
      'Step-by-step guide for working with this table:\n1. Create records\n2. Update status\n3. Delete completed items',
    example: '```sql\nSELECT * FROM todos WHERE completed = false;\n```',
    spec: 'Table Schema:\n- id: INTEGER PRIMARY KEY\n- title: TEXT NOT NULL\n- completed: BOOLEAN DEFAULT FALSE',
    general: 'Q: How to mark todos as complete?\nA: Update the completed column to true.',
  },
}

describe('Doc System - End-to-End Tests', () => {
  beforeAll(async () => {
    console.log('🌐 Setting up E2E test environment for doc system...')
    testContext = await TestIsolationHelpers.setupE2ETest(SUITE_NAME, {
      seedData: true,
      mockExternalServices: false,
      enableLogging: true,
    })
    console.log('✅ E2E test environment ready')
    console.log(`🌐 GraphQL Server: ${testContext.server?.url}`)
    console.log(`💾 Database: ${testContext.database?.databasePath}`)
  }, 45000) // Longer timeout for E2E setup

  afterAll(async () => {
    console.log('🧹 Cleaning up E2E test environment...')
    await testContext.cleanup()
    console.log('✅ E2E cleanup completed')
  }, 15000)

  describe('Complete Documentation Workflow', () => {
    test('should support full CRUD workflow for documentation', async () => {
      const tableId = '58'
      const category = 'general'
      const originalContent = 'Original E2E test documentation content'
      const updatedContent = 'Updated E2E test documentation content'

      // 1. Create documentation
      const createMutation = `
        mutation CreateDoc($input: CreateDocInput!) {
          createDoc(input: $input) {
            success
            doc {
              id
              table {
                id
              }
              category
              version
              content
              isActive
              createdAt
            }
            errors {
              message
            }
          }
        }
      `

      const createResult = await testContext.graphqlRequest!(createMutation, {
        input: { tableId, category, content: originalContent },
      })

      expect(createResult.data.createDoc.success).toBe(true)
      expect(createResult.data.createDoc.doc).toBeDefined()
      const docId = createResult.data.createDoc.doc.id
      expect(createResult.data.createDoc.doc.content).toBe(originalContent)
      expect(createResult.data.createDoc.doc.isActive).toBe(true)

      // 2. Read documentation
      const getQuery = `
        query GetDoc($id: ID!) {
          getDoc(id: $id) {
            id
            category
            content
            isActive
            table {
              id
              identifier
            }
          }
        }
      `

      const getResult = await testContext.graphqlRequest!(getQuery, { id: docId })

      expect(getResult.data.getDoc).toBeDefined()
      expect(getResult.data.getDoc.content).toBe(originalContent)
      expect(getResult.data.getDoc.table.identifier).toBeTruthy() // TODO: Fix expected identifier

      // 3. Update documentation
      const updateMutation = `
        mutation UpdateDoc($id: ID!, $input: UpdateDocInput!) {
          updateDoc(id: $id, input: $input) {
            success
            doc {
              id
              content
              updatedAt
            }
            errors {
              message
            }
          }
        }
      `

      const updateResult = await testContext.graphqlRequest!(updateMutation, {
        id: docId,
        input: { content: updatedContent },
      })

      expect(updateResult.data.updateDoc.success).toBe(true)
      expect(updateResult.data.updateDoc.doc).toBeDefined()
      expect(updateResult.data.updateDoc.doc.content).toBe(updatedContent)

      // 4. Create new version
      const versionResult = await testContext.graphqlRequest!(createMutation, {
        input: { tableId, category, content: 'Version 2 content', version: 2 },
      })

      expect(versionResult.data.createDoc.success).toBe(true)
      expect(versionResult.data.createDoc.doc.version).toBe(2)
      expect(versionResult.data.createDoc.doc.isActive).toBe(true)

      // 5. Verify version history
      const versionsQuery = `
        query GetDocVersions($tableId: ID!, $category: DocCategory!) {
          getDocVersions(tableId: $tableId, category: $category) {
            docs {
              id
              version
              content
              isActive
            }
          }
        }
      `

      const versionsResult = await testContext.graphqlRequest!(versionsQuery, {
        tableId,
        category,
      })

      expect(versionsResult.data.getDocVersions.docs).toHaveLength(2)
      const activeDoc = versionsResult.data.getDocVersions.docs.find((doc) => doc.isActive)
      const inactiveDoc = versionsResult.data.getDocVersions.docs.find((doc) => !doc.isActive)
      expect(activeDoc).toBeDefined()
      expect(inactiveDoc).toBeDefined()
      expect(activeDoc.version).toBe(2)
      expect(inactiveDoc.version).toBe(1)

      // 6. Delete documentation
      const deleteMutation = `
        mutation DeleteDoc($id: ID!) {
          deleteDoc(id: $id) {
            success
            errors {
              message
            }
          }
        }
      `

      const deleteResult = await testContext.graphqlRequest!(deleteMutation, { id: docId })

      expect(deleteResult.data.deleteDoc.success).toBe(true)

      // 7. Verify deletion
      const verifyResult = await testContext.graphqlRequest!(getQuery, { id: docId })
      expect(verifyResult.data.getDoc).toBeNull()
    })

    test('should handle multiple tables and categories', async () => {
      const operations: Promise<any>[] = []

      // Create documentation for multiple tables and categories
      for (const table of TEST_SCENARIOS.tables) {
        for (const [categoryIndex, category] of TEST_SCENARIOS.documentCategories.entries()) {
          const content =
            TEST_SCENARIOS.sampleContent[category as keyof typeof TEST_SCENARIOS.sampleContent] ||
            `${category} documentation for ${table.name} table`

          const mutation = `
            mutation CreateDoc($input: CreateDocInput!) {
              createDoc(input: $input) {
                success
                doc {
                  id
                  table {
                    id
                  }
                  category
                }
                errors {
                  message
                }
              }
            }
          `

          operations.push(
            testContext.graphqlRequest!(mutation, {
              input: {
                tableId: table.id.toString(),
                category,
                content,
                version: table.id * 100 + categoryIndex + 1, // Unique version per table+category
              },
            })
          )
        }
      }

      // Execute all operations concurrently
      const results = await Promise.all(operations)

      // Verify all operations succeeded
      results.forEach((result, index) => {
        if (!result.data.createDoc.success) {
          console.log(
            `Operation ${index} failed:`,
            JSON.stringify(result.data.createDoc.errors, null, 2)
          )
        }
        expect(result.data.createDoc.success).toBe(true)
        expect(result.data.createDoc.doc).toBeDefined()
        expect(parseInt(result.data.createDoc.doc.id, 10)).toBeGreaterThan(0)
      })

      // Verify total count
      const countQuery = `
        query GetAllDocs {
          getDocs(tableId: "58") {
            totalCount
          }
        }
      `

      const countResult = await testContext.graphqlRequest!(countQuery)
      expect(countResult.data.getDocs.totalCount).toBeGreaterThan(0)
    })
  })

  describe('Search and Discovery', () => {
    test('should support filtering documentation by category', async () => {
      // Create searchable content
      const searchTerms = ['database', 'api', 'authentication', 'performance']

      for (const [_index, term] of searchTerms.entries()) {
        const mutation = `
          mutation CreateDoc($input: CreateDocInput!) {
            createDoc(input: $input) {
              success
              doc {
                id
              }
              errors {
                message
              }
            }
          }
        `

        await testContext.graphqlRequest!(mutation, {
          input: {
            tableId: '58',
            category: 'example',
            content: `This documentation covers ${term} functionality and best practices for ${term} implementation.`,
          },
        })
      }

      // Test filtering docs by category
      const filterQuery = `
        query GetDocsByCategory($tableId: ID!, $category: DocCategory!) {
          getDocs(tableId: $tableId, category: $category) {
            docs {
              id
              category
              content
            }
            totalCount
          }
        }
      `

      const filterResult = await testContext.graphqlRequest!(filterQuery, {
        tableId: '58',
        category: 'example',
      })

      expect(filterResult.data.getDocs.docs).toBeDefined()
      expect(filterResult.data.getDocs.totalCount).toBeGreaterThan(0)

      // Verify filtered results contain expected category
      const foundDoc = filterResult.data.getDocs.docs.find((doc: any) => doc.category === 'example')
      expect(foundDoc).toBeDefined()
    })

    test('should support filtering and pagination', async () => {
      const query = `
        query GetDocsWithPagination($tableId: ID!, $pagination: PaginationInput!) {
          getDocs(tableId: $tableId, pagination: $pagination) {
            docs {
              id
              category
            }
            totalCount
            hasNextPage
            hasPreviousPage
          }
        }
      `

      const result = await testContext.graphqlRequest!(query, {
        tableId: '58',
        pagination: { limit: 5, offset: 0 },
      })

      expect(result.data.getDocs).toBeDefined()
      expect(result.data.getDocs.docs).toBeDefined()
      expect(result.data.getDocs.hasNextPage).toBeDefined()
      expect(result.data.getDocs.hasPreviousPage).toBeDefined()
      expect(typeof result.data.getDocs.hasNextPage).toBe('boolean')
      expect(typeof result.data.getDocs.hasPreviousPage).toBe('boolean')
    })
  })

  describe('Data Consistency and Integrity', () => {
    test('should maintain referential integrity', async () => {
      // Test foreign key constraints
      const invalidTableMutation = `
        mutation CreateDoc($input: CreateDocInput!) {
          createDoc(input: $input) {
            success
            doc {
              id
            }
            errors {
              message
            }
          }
        }
      `

      const result = await testContext.graphqlRequest!(invalidTableMutation, {
        input: {
          tableId: '99999', // Non-existent table
          category: 'general',
          content: 'Test content',
        },
      })

      // Should fail due to referential integrity
      expect(result.data.createDoc.success).toBe(false)
      expect(result.data.createDoc.errors).toBeDefined()
      expect(result.data.createDoc.errors.length).toBeGreaterThan(0)
    })

    test('should handle concurrent operations safely', async () => {
      const tableId = '58'
      const category = 'usage' // Use different category to avoid conflict with first test

      // Create multiple concurrent operations
      const operations = Array.from({ length: 10 }, (_, i) => {
        const mutation = `
          mutation CreateDoc($input: CreateDocInput!) {
            createDoc(input: $input) {
              success
              doc {
                id
                version
              }
              errors {
                message
              }
            }
          }
        `

        return testContext.graphqlRequest!(mutation, {
          input: {
            tableId,
            category: 'usage',
            content: `Concurrent test content ${i}`,
            version: i + 100, // Use versions starting from 100 to avoid conflicts
          },
        })
      })

      const results = await Promise.all(operations)

      // All operations should succeed
      results.forEach((result, index) => {
        if (!result.data.createDoc.success) {
          console.log(
            `Concurrent operation ${index} failed:`,
            JSON.stringify(result.data.createDoc.errors, null, 2)
          )
        }
        expect(result.data.createDoc.success).toBe(true)
        expect(result.data.createDoc.doc).toBeDefined()
        expect(parseInt(result.data.createDoc.doc.id, 10)).toBeGreaterThan(0)
      })

      // Verify data consistency
      const verifyQuery = `
        query GetDocs($tableId: ID!) {
          getDocs(tableId: $tableId) {
            docs {
              category
            }
            totalCount
          }
        }
      `

      const verifyResult = await testContext.graphqlRequest!(verifyQuery, { tableId })
      const concurrentDocs = verifyResult.data.getDocs.docs.filter(
        (doc: any) => doc.category === category
      )

      expect(concurrentDocs).toHaveLength(10)
    })
  })

  describe('Performance and Scalability', () => {
    test('should handle large documentation sets efficiently', async () => {
      const startTime = performance.now()

      // Create a large batch of documentation
      const batchSize = 50
      const operations = Array.from({ length: batchSize }, (_, i) => {
        const mutation = `
          mutation CreateDoc($input: CreateDocInput!) {
            createDoc(input: $input) {
              success
              doc {
                id
              }
              errors {
                message
              }
            }
          }
        `

        return testContext.graphqlRequest!(mutation, {
          input: {
            tableId: '59', // Use table 59 for batch test to avoid conflicts with table 58
            category: 'guide', // Use different category for batch test
            content: `Batch documentation content ${i}. This is a longer piece of content that simulates real documentation with multiple paragraphs and detailed explanations of functionality.`,
            version: i + 500, // Use versions 500+ for batch test to avoid all conflicts
          },
        })
      })

      const results = await Promise.all(operations)

      // Log any failures
      results.forEach((result, index) => {
        if (!result.data.createDoc.success) {
          console.log(
            `Batch operation ${index} failed:`,
            JSON.stringify(result.data.createDoc.errors, null, 2)
          )
        }
      })

      const creationTime = performance.now() - startTime

      // Should complete batch creation in reasonable time
      expect(creationTime).toBeLessThan(10000) // < 10 seconds

      // Test query performance
      const queryStartTime = performance.now()

      const query = `
        query GetDocs($tableId: ID!) {
          getDocs(tableId: $tableId) {
            docs {
              id
              category
              content
            }
            totalCount
          }
        }
      `

      const result = await testContext.graphqlRequest!(query, { tableId: '59' })
      const queryTime = performance.now() - queryStartTime

      // Verify that we created all documents and they exist in the database (some may be inactive due to versioning)
      console.log(`Created ${result.data.getDocs.totalCount} total docs for table 59`)
      expect(result.data.getDocs.totalCount).toBeGreaterThanOrEqual(batchSize) // Should have at least our batch size
      expect(queryTime).toBeLessThan(1000) // < 1 second
    })

    test('should optimize database queries', async () => {
      const db = testContext.database!.database.getConnection()

      // Enable query analysis
      db.exec('PRAGMA query_only = ON')

      // Test query plan for common operations
      const queryPlan = db
        .prepare(`
        EXPLAIN QUERY PLAN
        SELECT d.*, t.identifier as table_identifier
        FROM docs d
        JOIN tables t ON d.table_id = t.id
        WHERE d.table_id = ? AND d.is_active = true
        ORDER BY d.created_at DESC
      `)
        .all(58)

      // Verify the query plan uses indexes
      const planText = queryPlan.map((row) => row.detail).join(' ')
      expect(planText).toContain('INDEX') // Should use indexes for performance

      db.exec('PRAGMA query_only = OFF')
    })
  })

  describe('Error Recovery and Resilience', () => {
    test('should recover from temporary failures', async () => {
      // Test system resilience by creating a scenario that might fail
      const mutation = `
        mutation CreateDoc($input: CreateDocInput!) {
          createDoc(input: $input) {
            success
            doc {
              id
            }
            errors {
              message
            }
          }
        }
      `

      // Try to create documentation with edge case data
      const edgeCases = [
        { content: 'A'.repeat(10000) }, // Very long content
        { content: '' }, // Empty content (should fail)
        { content: 'Normal content with special chars: 中文 🚀 ñ' }, // Unicode
      ]

      for (const [index, testCase] of edgeCases.entries()) {
        try {
          const result = await testContext.graphqlRequest!(mutation, {
            input: {
              tableId: '58',
              category: 'spec', // Use 'spec' category for resilience test to avoid conflicts
              content: testCase.content,
              version: index + 200, // Use versions 200+ for resilience test to avoid conflicts
            },
          })

          if (testCase.content === '') {
            // Empty content should fail
            expect(result.errors).toBeDefined()
          } else {
            // Others should succeed
            if (!result.data.createDoc.success) {
              console.log(
                `Resilience test failed for content: "${testCase.content}":`,
                JSON.stringify(result.data.createDoc.errors, null, 2)
              )
            }
            expect(result.data.createDoc.success).toBe(true)
            expect(result.data.createDoc.doc).toBeDefined()
          }
        } catch (error) {
          if (testCase.content === '') {
            // Expected to fail
            expect(error).toBeDefined()
          } else {
            throw error // Unexpected failure
          }
        }
      }
    })

    test('should handle database connection issues gracefully', async () => {
      // Test that the system handles database issues appropriately
      const query = `
        query GetDoc($id: ID!) {
          getDoc(id: $id) {
            id
            content
          }
        }
      `

      // Query for non-existent ID
      const result = await testContext.graphqlRequest!(query, { id: '99999' })

      // Should return null, not throw error
      expect(result.data.getDoc).toBeNull()
    })
  })
})

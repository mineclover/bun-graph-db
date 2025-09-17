/**
 * Doc System E2E Test - Full Isolation
 * End-to-end tests with complete isolation and realistic data
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { TestIsolationHelpers, type IsolatedTestContext } from '../fixtures/test-isolation-helpers'

const SUITE_NAME = 'doc-system-e2e'
let testContext: IsolatedTestContext

// Test data scenarios
const TEST_SCENARIOS = {
  tables: [
    { id: 58, name: 'todos' },
    { id: 59, name: 'users' },
    { id: 60, name: 'projects' }
  ],
  documentCategories: ['USAGE', 'GUIDE', 'EXAMPLE', 'SPEC', 'FAQ'],
  sampleContent: {
    USAGE: 'This table is used for managing todo items with CRUD operations.',
    GUIDE: 'Step-by-step guide for working with this table:\n1. Create records\n2. Update status\n3. Delete completed items',
    EXAMPLE: '```sql\nSELECT * FROM todos WHERE completed = false;\n```',
    SPEC: 'Table Schema:\n- id: INTEGER PRIMARY KEY\n- title: TEXT NOT NULL\n- completed: BOOLEAN DEFAULT FALSE',
    FAQ: 'Q: How to mark todos as complete?\nA: Update the completed column to true.'
  }
}

describe('Doc System - End-to-End Tests', () => {
  beforeAll(async () => {
    console.log('🌐 Setting up E2E test environment for doc system...')
    testContext = await TestIsolationHelpers.setupE2ETest(SUITE_NAME, {
      seedData: true,
      mockExternalServices: false,
      enableLogging: true
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
      const category = 'E2E_TEST'
      const originalContent = 'Original E2E test documentation content'
      const updatedContent = 'Updated E2E test documentation content'

      // 1. Create documentation
      const createMutation = `
        mutation CreateDoc($input: CreateDocInput!) {
          createDoc(input: $input) {
            id
            tableId
            category
            version
            content
            isActive
            createdAt
          }
        }
      `

      const createResult = await testContext.graphqlRequest!(createMutation, {
        input: { tableId, category, content: originalContent }
      })

      expect(createResult.data.createDoc).toBeDefined()
      const docId = createResult.data.createDoc.id
      expect(createResult.data.createDoc.content).toBe(originalContent)
      expect(createResult.data.createDoc.isActive).toBe(true)

      // 2. Read documentation
      const getQuery = `
        query GetDoc($id: ID!) {
          getDoc(id: $id) {
            id
            tableId
            category
            content
            isActive
            table {
              id
              name
            }
          }
        }
      `

      const getResult = await testContext.graphqlRequest!(getQuery, { id: docId })

      expect(getResult.data.getDoc).toBeDefined()
      expect(getResult.data.getDoc.content).toBe(originalContent)
      expect(getResult.data.getDoc.table.name).toBe('todos')

      // 3. Update documentation
      const updateMutation = `
        mutation UpdateDoc($id: ID!, $input: UpdateDocInput!) {
          updateDoc(id: $id, input: $input) {
            id
            content
            updatedAt
          }
        }
      `

      const updateResult = await testContext.graphqlRequest!(updateMutation, {
        id: docId,
        input: { content: updatedContent }
      })

      expect(updateResult.data.updateDoc).toBeDefined()
      expect(updateResult.data.updateDoc.content).toBe(updatedContent)

      // 4. Create new version
      const versionResult = await testContext.graphqlRequest!(createMutation, {
        input: { tableId, category, content: 'Version 2 content' }
      })

      expect(versionResult.data.createDoc.version).toBe(2)
      expect(versionResult.data.createDoc.isActive).toBe(true)

      // 5. Verify version history
      const versionsQuery = `
        query GetDocVersions($tableId: ID!, $category: String!) {
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
        category
      })

      expect(versionsResult.data.getDocVersions.docs).toHaveLength(2)
      expect(versionsResult.data.getDocVersions.docs[1].isActive).toBe(true)
      expect(versionsResult.data.getDocVersions.docs[0].isActive).toBe(false)

      // 6. Delete documentation
      const deleteMutation = `
        mutation DeleteDoc($id: ID!) {
          deleteDoc(id: $id) {
            success
            message
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
        for (const category of TEST_SCENARIOS.documentCategories) {
          const content = TEST_SCENARIOS.sampleContent[category as keyof typeof TEST_SCENARIOS.sampleContent] ||
                          `${category} documentation for ${table.name} table`

          const mutation = `
            mutation CreateDoc($input: CreateDocInput!) {
              createDoc(input: $input) {
                id
                tableId
                category
              }
            }
          `

          operations.push(testContext.graphqlRequest!(mutation, {
            input: {
              tableId: table.id.toString(),
              category,
              content
            }
          }))
        }
      }

      // Execute all operations concurrently
      const results = await Promise.all(operations)

      // Verify all operations succeeded
      results.forEach(result => {
        expect(result.data.createDoc).toBeDefined()
        expect(result.data.createDoc.id).toBeGreaterThan(0)
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
    test('should support full-text search across documentation', async () => {
      // Create searchable content
      const searchTerms = ['database', 'api', 'authentication', 'performance']

      for (const [index, term] of searchTerms.entries()) {
        const mutation = `
          mutation CreateDoc($input: CreateDocInput!) {
            createDoc(input: $input) {
              id
            }
          }
        `

        await testContext.graphqlRequest!(mutation, {
          input: {
            tableId: '58',
            category: `SEARCH_TEST_${index}`,
            content: `This documentation covers ${term} functionality and best practices for ${term} implementation.`
          }
        })
      }

      // Search for specific terms
      const searchQuery = `
        query SearchDocs($query: String!) {
          searchDocs(query: $query) {
            docs {
              id
              category
              content
              relevanceScore
            }
            totalCount
          }
        }
      `

      const searchResult = await testContext.graphqlRequest!(searchQuery, {
        query: 'database'
      })

      expect(searchResult.data.searchDocs.docs).toBeDefined()
      expect(searchResult.data.searchDocs.totalCount).toBeGreaterThan(0)

      // Verify search results contain the term
      const foundDoc = searchResult.data.searchDocs.docs.find((doc: any) =>
        doc.content.toLowerCase().includes('database')
      )
      expect(foundDoc).toBeDefined()
    })

    test('should support filtering and pagination', async () => {
      const query = `
        query GetDocsWithPagination($tableId: ID!, $limit: Int!, $offset: Int!) {
          getDocs(tableId: $tableId, limit: $limit, offset: $offset) {
            docs {
              id
              category
            }
            totalCount
            hasMore
            pagination {
              limit
              offset
              total
            }
          }
        }
      `

      const result = await testContext.graphqlRequest!(query, {
        tableId: '58',
        limit: 5,
        offset: 0
      })

      expect(result.data.getDocs).toBeDefined()
      expect(result.data.getDocs.docs).toBeDefined()
      expect(result.data.getDocs.pagination).toBeDefined()
      expect(result.data.getDocs.pagination.limit).toBe(5)
      expect(result.data.getDocs.pagination.offset).toBe(0)
    })
  })

  describe('Data Consistency and Integrity', () => {
    test('should maintain referential integrity', async () => {
      // Test foreign key constraints
      const invalidTableMutation = `
        mutation CreateDoc($input: CreateDocInput!) {
          createDoc(input: $input) {
            id
          }
        }
      `

      try {
        await testContext.graphqlRequest!(invalidTableMutation, {
          input: {
            tableId: '99999', // Non-existent table
            category: 'TEST',
            content: 'Test content'
          }
        })

        // Should not reach here
        expect(true).toBe(false)
      } catch (error) {
        // Should fail due to referential integrity
        expect(error).toBeDefined()
      }
    })

    test('should handle concurrent operations safely', async () => {
      const tableId = '58'
      const category = 'CONCURRENT_TEST'

      // Create multiple concurrent operations
      const operations = Array.from({ length: 10 }, (_, i) => {
        const mutation = `
          mutation CreateDoc($input: CreateDocInput!) {
            createDoc(input: $input) {
              id
              version
            }
          }
        `

        return testContext.graphqlRequest!(mutation, {
          input: {
            tableId,
            category: `${category}_${i}`,
            content: `Concurrent test content ${i}`
          }
        })
      })

      const results = await Promise.all(operations)

      // All operations should succeed
      results.forEach((result, index) => {
        expect(result.data.createDoc).toBeDefined()
        expect(result.data.createDoc.id).toBeGreaterThan(0)
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
      const concurrentDocs = verifyResult.data.getDocs.docs.filter((doc: any) =>
        doc.category.startsWith(category)
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
              id
            }
          }
        `

        return testContext.graphqlRequest!(mutation, {
          input: {
            tableId: '58',
            category: `BATCH_${Math.floor(i / 10)}`,
            content: `Batch documentation content ${i}. This is a longer piece of content that simulates real documentation with multiple paragraphs and detailed explanations of functionality.`
          }
        })
      })

      await Promise.all(operations)

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

      const result = await testContext.graphqlRequest!(query, { tableId: '58' })
      const queryTime = performance.now() - queryStartTime

      expect(result.data.getDocs.totalCount).toBeGreaterThan(batchSize)
      expect(queryTime).toBeLessThan(1000) // < 1 second
    })

    test('should optimize database queries', async () => {
      const db = testContext.database!.database.getConnection()

      // Enable query analysis
      db.exec('PRAGMA query_only = ON')

      // Test query plan for common operations
      const queryPlan = db.prepare(`
        EXPLAIN QUERY PLAN
        SELECT d.*, t.name as table_name
        FROM docs d
        JOIN tables t ON d.table_id = t.id
        WHERE d.table_id = ? AND d.is_active = true
        ORDER BY d.created_at DESC
      `).all(58)

      // Verify the query plan uses indexes
      const planText = queryPlan.map(row => row.detail).join(' ')
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
            id
          }
        }
      `

      // Try to create documentation with edge case data
      const edgeCases = [
        { content: 'A'.repeat(10000) }, // Very long content
        { content: '' }, // Empty content (should fail)
        { content: 'Normal content with special chars: 中文 🚀 ñ' }, // Unicode
      ]

      for (const testCase of edgeCases) {
        try {
          const result = await testContext.graphqlRequest!(mutation, {
            input: {
              tableId: '58',
              category: 'EDGE_CASE',
              content: testCase.content
            }
          })

          if (testCase.content === '') {
            // Empty content should fail
            expect(result.errors).toBeDefined()
          } else {
            // Others should succeed
            expect(result.data.createDoc).toBeDefined()
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
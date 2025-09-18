/**
 * Doc System Test - Isolated Database Version
 * Demonstrates migrated test using isolated GraphQL server
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { GraphQLTestServerManager } from './fixtures/test-graphql-server'

const SUITE_NAME = 'doc-system-isolated'
const TEST_TIMEOUT = 15000

// Test Data
let TEST_TABLE_ID: string // Will be created during test setup
const TEST_CONTENT = {
  USAGE: 'This is usage documentation for the todos table. It explains how to use the todos functionality.',
  GUIDE: 'This is a guide documentation for the todos table. Step-by-step instructions.',
  EXAMPLE: 'This is example documentation with code samples for the todos table.',
  SPEC: 'This is specification documentation for the todos table schema.',
  GENERAL: 'This is general documentation for the todos table overview.'
}

// Global test server
let graphqlRequest: (query: string, variables?: Record<string, any>) => Promise<any>

describe('Doc System - Isolated Database Test Suite', () => {
  beforeAll(async () => {
    console.log('🚀 Starting isolated GraphQL server for Doc System tests...')

    // Start isolated server with dedicated database
    const server = await GraphQLTestServerManager.startServerForSuite(SUITE_NAME)
    console.log(`✅ Server started at: ${server.url}`)
    console.log(`📁 Database path: ${server.database.databasePath}`)

    // Create request helper
    graphqlRequest = GraphQLTestServerManager.createRequestHelper(SUITE_NAME)

    // Verify server is working
    const healthCheck = await graphqlRequest(`
      query {
        __schema {
          types {
            name
          }
        }
      }
    `)

    expect(healthCheck.data).toBeDefined()
    console.log('✅ GraphQL server health check passed')

    // Use the fixed test table ID (created by TestDatabaseFactory)
    TEST_TABLE_ID = '58'  // This matches the INSERT OR IGNORE INTO tables (id, identifier, description) VALUES (58, 'test-todos', ...)
    console.log(`✅ Using test table with ID: ${TEST_TABLE_ID}`)
  }, TEST_TIMEOUT)

  afterAll(async () => {
    console.log('🧹 Cleaning up isolated test environment...')
    await GraphQLTestServerManager.stopServerForSuite(SUITE_NAME)
    console.log('✅ Cleanup completed')
  }, TEST_TIMEOUT)

  describe('📝 Doc Mutations', () => {
    test('createDoc - Create USAGE documentation', async () => {
      const mutation = `
        mutation CreateDoc($input: CreateDocInput!) {
          createDoc(input: $input) {
            success
            doc {
              id
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

      const variables = {
        input: {
          tableId: TEST_TABLE_ID,
          category: 'usage',
          content: TEST_CONTENT.USAGE
        }
      }

      const result = await graphqlRequest(mutation, variables)

      expect(result.errors).toBeUndefined()
      expect(result.data.createDoc.success).toBe(true)
      expect(result.data.createDoc.doc).toBeDefined()
      expect(result.data.createDoc.doc.category).toBe('usage')
      expect(result.data.createDoc.doc.content).toBe(TEST_CONTENT.USAGE)
      expect(result.data.createDoc.doc.version).toBe(1)
      expect(result.data.createDoc.doc.isActive).toBe(true)
    })

    test('createDoc - Create multiple categories', async () => {
      const categories = ['guide', 'example', 'spec'] // lowercase enum values

      for (const category of categories) {
        const mutation = `
          mutation CreateDoc($input: CreateDocInput!) {
            createDoc(input: $input) {
              success
              doc {
                id
                category
                version
                isActive
              }
              errors {
                message
              }
            }
          }
        `

        const variables = {
          input: {
            tableId: TEST_TABLE_ID,
            category,
            content: TEST_CONTENT[category.toUpperCase() as keyof typeof TEST_CONTENT]
          }
        }

        const result = await graphqlRequest(mutation, variables)

        expect(result.errors).toBeUndefined()
        expect(result.data.createDoc.success).toBe(true)
        expect(result.data.createDoc.doc.category).toBe(category)
        expect(result.data.createDoc.doc.version).toBe(1)
        expect(result.data.createDoc.doc.isActive).toBe(true)
      }
    })
  })

  describe('🔍 Doc Queries', () => {
    test('getDocs - Get all docs for a table', async () => {
      const query = `
        query GetDocs($tableId: ID!) {
          getDocs(tableId: $tableId) {
            docs {
              id
              category
              version
              isActive
              content
            }
            totalCount
            hasNextPage
          }
        }
      `

      const variables = { tableId: TEST_TABLE_ID }
      const result = await graphqlRequest(query, variables)

      expect(result.errors).toBeUndefined()
      expect(result.data.getDocs).toBeDefined()
      expect(result.data.getDocs.docs).toBeDefined()
      expect(Array.isArray(result.data.getDocs.docs)).toBe(true)
      expect(result.data.getDocs.docs.length).toBeGreaterThan(0)
      expect(result.data.getDocs.totalCount).toBeGreaterThan(0)
    })

    test('getActiveDoc - Get active doc by table and category', async () => {
      const query = `
        query GetActiveDoc($tableId: ID!, $category: DocCategory!) {
          getActiveDoc(tableId: $tableId, category: $category) {
            id
            category
            version
            content
            isActive
          }
        }
      `

      const variables = {
        tableId: TEST_TABLE_ID,
        category: 'usage'
      }

      const result = await graphqlRequest(query, variables)

      expect(result.errors).toBeUndefined()
      expect(result.data.getActiveDoc).toBeDefined()
      expect(result.data.getActiveDoc.category).toBe('usage')
      expect(result.data.getActiveDoc.isActive).toBe(true)
      expect(result.data.getActiveDoc.content).toBe(TEST_CONTENT.USAGE)
    })
  })

  describe('🔄 Doc Field Resolvers', () => {
    test('Doc.table - Resolve table field', async () => {
      const query = `
        query GetDocWithTable($tableId: ID!) {
          getDocs(tableId: $tableId) {
            docs {
              id
              category
              table {
                id
                identifier
              }
            }
          }
        }
      `

      const variables = { tableId: TEST_TABLE_ID }
      const result = await graphqlRequest(query, variables)

      expect(result.errors).toBeUndefined()
      expect(result.data.getDocs.docs).toBeDefined()
      expect(result.data.getDocs.docs.length).toBeGreaterThan(0)

      const doc = result.data.getDocs.docs[0]
      expect(doc.table).toBeDefined()
      expect(doc.table.id).toBe(TEST_TABLE_ID)
      expect(doc.table.identifier).toBeDefined()
    })
  })

  describe('❌ Error Handling', () => {
    test('createDoc - Invalid table ID', async () => {
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

      const variables = {
        input: {
          tableId: '999999', // Non-existent table
          category: 'usage',
          content: 'Test content'
        }
      }

      const result = await graphqlRequest(mutation, variables)

      expect(result.errors).toBeUndefined()
      expect(result.data.createDoc.success).toBe(false)
      expect(result.data.createDoc.errors).toBeDefined()
      expect(result.data.createDoc.errors[0].message).toContain('Table with id')
    })

    test('createDoc - Empty content', async () => {
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

      const variables = {
        input: {
          tableId: TEST_TABLE_ID,
          category: 'usage',
          content: '' // Empty content
        }
      }

      const result = await graphqlRequest(mutation, variables)

      // Allow for server errors when content is empty
      if (result.errors) {
        expect(result.errors[0].message).toBeDefined()
      } else {
        expect(result.data.createDoc.success).toBe(false)
        expect(result.data.createDoc.errors).toBeDefined()
        expect(result.data.createDoc.errors[0].message).toContain('Content cannot be empty')
      }
    })
  })
})
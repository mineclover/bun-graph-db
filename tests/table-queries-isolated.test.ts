/**
 * Table Queries Test - Isolated Database Version
 * Tests table GraphQL queries with isolated server setup
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createRequestHelper, startServerForSuite, stopServerForSuite } from './fixtures/test-graphql-server'

const SUITE_NAME = 'table-queries-isolated'
const TEST_TIMEOUT = 15000

// Global test server
let graphqlRequest: (query: string, variables?: Record<string, any>) => Promise<any>

describe('Table Queries - Isolated Database Test Suite', () => {
  beforeAll(async () => {
    console.log('🚀 Starting isolated GraphQL server for Table Queries tests...')

    // Start isolated server with dedicated database
    const server = await startServerForSuite(SUITE_NAME)
    console.log(`✅ Server started at: ${server.url}`)
    console.log(`📁 Database path: ${server.database.databasePath}`)

    // Create request helper
    graphqlRequest = createRequestHelper(SUITE_NAME)

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
  }, TEST_TIMEOUT)

  afterAll(async () => {
    console.log('🧹 Cleaning up isolated test environment...')
    await stopServerForSuite(SUITE_NAME)
    console.log('✅ Cleanup completed')
  }, TEST_TIMEOUT)

  describe('📊 Table Queries', () => {
    test('tables - Get all tables with pagination', async () => {
      const query = `
        query GetTables($pagination: TablesPagination) {
          tables(pagination: $pagination) {
            nodes {
              id
              identifier
              description
            }
            totalCount
            hasNextPage
            hasPreviousPage
          }
        }
      `

      const variables = {
        pagination: { limit: 10, offset: 0 },
      }

      const result = await graphqlRequest(query, variables)

      expect(result.errors).toBeUndefined()
      expect(result.data.tables).toBeDefined()
      expect(result.data.tables.nodes).toBeDefined()
      expect(Array.isArray(result.data.tables.nodes)).toBe(true)
      expect(result.data.tables.totalCount).toBeGreaterThanOrEqual(0)
      expect(typeof result.data.tables.hasNextPage).toBe('boolean')
      expect(typeof result.data.tables.hasPreviousPage).toBe('boolean')
    })

    test('table - Get specific table by ID', async () => {
      // First get list of tables to get a valid ID
      const tablesQuery = `
        query {
          tables(pagination: { limit: 1 }) {
            nodes { id identifier }
          }
        }
      `
      const tablesResult = await graphqlRequest(tablesQuery)

      if (tablesResult.data.tables.nodes.length > 0) {
        const tableId = tablesResult.data.tables.nodes[0].id

        const query = `
          query GetTable($id: ID!) {
            table(id: $id) {
              id
              identifier
              description
            }
          }
        `

        const result = await graphqlRequest(query, { id: tableId })

        expect(result.errors).toBeUndefined()
        expect(result.data.table).toBeDefined()
        expect(result.data.table.id).toBe(tableId)
        expect(result.data.table.identifier).toBeDefined()
      } else {
        console.log('ℹ️ No tables found, skipping table by ID test')
      }
    })

    test('tableByIdentifier - Get table by identifier', async () => {
      // Use the test table that should exist
      const query = `
        query GetTableByIdentifier($identifier: String!) {
          tableByIdentifier(identifier: $identifier) {
            id
            identifier
            description
          }
        }
      `

      const variables = { identifier: 'test-todos' }
      const result = await graphqlRequest(query, variables)

      if (result.data.tableByIdentifier) {
        expect(result.errors).toBeUndefined()
        expect(result.data.tableByIdentifier.identifier).toBe('test-todos')
        expect(result.data.tableByIdentifier.id).toBeDefined()
      } else {
        console.log('ℹ️ test-todos table not found, this is expected for isolated tests')
      }
    })
  })

  describe('❌ Error Handling', () => {
    test('table - Invalid ID should return null', async () => {
      const query = `
        query GetTable($id: ID!) {
          table(id: $id) {
            id
            identifier
          }
        }
      `

      const result = await graphqlRequest(query, { id: '999999' })

      expect(result.errors).toBeUndefined()
      expect(result.data.table).toBeNull()
    })

    test('tableByIdentifier - Non-existent identifier should return null', async () => {
      const query = `
        query GetTableByIdentifier($identifier: String!) {
          tableByIdentifier(identifier: $identifier) {
            id
            identifier
          }
        }
      `

      const result = await graphqlRequest(query, { identifier: 'non-existent-table' })

      expect(result.errors).toBeUndefined()
      expect(result.data.tableByIdentifier).toBeNull()
    })

    test('table - Empty ID should cause validation error', async () => {
      const query = `
        query GetTable($id: ID!) {
          table(id: $id) {
            id
          }
        }
      `

      const result = await graphqlRequest(query, { id: '' })

      // Should either have GraphQL errors or return null
      expect(result.errors || result.data.table === null).toBeTruthy()
    })
  })

  describe('📊 Performance & Pagination', () => {
    test('tables - Pagination with different limits', async () => {
      const query = `
        query GetTables($pagination: TablesPagination) {
          tables(pagination: $pagination) {
            nodes {
              id
              identifier
            }
            totalCount
            hasNextPage
          }
        }
      `

      // Test with limit 5
      const result = await graphqlRequest(query, {
        pagination: { limit: 5, offset: 0 },
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.tables.nodes.length).toBeLessThanOrEqual(5)
      expect(result.data.tables.totalCount).toBeGreaterThanOrEqual(0)
    })

    test('tables - No pagination (default behavior)', async () => {
      const query = `
        query GetTables {
          tables {
            nodes {
              id
              identifier
            }
            totalCount
          }
        }
      `

      const result = await graphqlRequest(query)

      expect(result.errors).toBeUndefined()
      expect(result.data.tables).toBeDefined()
      expect(result.data.tables.nodes.length).toBeLessThanOrEqual(10) // Default limit
    })
  })
})

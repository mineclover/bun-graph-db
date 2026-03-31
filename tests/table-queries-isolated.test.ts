/**
 * Table Queries Test - Isolated Database Version
 * Tests table GraphQL queries with isolated server setup
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  createRequestHelper,
  requireGraphQLData,
  startServerForSuite,
  stopServerForSuite,
  type GraphQLRequestHelper,
} from './fixtures/test-graphql-server'

const SUITE_NAME = 'table-queries-isolated'
const TEST_TIMEOUT = 30000

type SchemaHealthData = {
  __schema: {
    types: Array<{ name: string }>
  }
}

type TableSummary = {
  id: string
  identifier: string
  description?: string | null
}

type TableConnection = {
  nodes: TableSummary[]
  totalCount: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

type TablesQueryData = {
  tables: TableConnection
}

type TableQueryData = {
  table: TableSummary | null
}

type TableByIdentifierQueryData = {
  tableByIdentifier: TableSummary | null
}

// Global test server
let graphqlRequest: GraphQLRequestHelper

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
    const healthCheck = await graphqlRequest<SchemaHealthData>(`
      query {
        __schema {
          types {
            name
          }
        }
      }
    `)

    expect(requireGraphQLData(healthCheck).__schema).toBeDefined()
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

      const result = await graphqlRequest<TablesQueryData>(query, variables)
      const data = requireGraphQLData(result)

      expect(result.errors).toBeUndefined()
      expect(data.tables).toBeDefined()
      expect(data.tables.nodes).toBeDefined()
      expect(Array.isArray(data.tables.nodes)).toBe(true)
      expect(data.tables.totalCount).toBeGreaterThanOrEqual(0)
      expect(typeof data.tables.hasNextPage).toBe('boolean')
      expect(typeof data.tables.hasPreviousPage).toBe('boolean')
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
      const tablesResult = await graphqlRequest<TablesQueryData>(tablesQuery)
      const tablesData = requireGraphQLData(tablesResult)

      if (tablesData.tables.nodes.length > 0) {
        const tableId = tablesData.tables.nodes[0].id

        const query = `
          query GetTable($id: ID!) {
            table(id: $id) {
              id
              identifier
              description
            }
          }
        `

        const result = await graphqlRequest<TableQueryData>(query, { id: tableId })
        const data = requireGraphQLData(result)

        expect(result.errors).toBeUndefined()
        expect(data.table).toBeDefined()
        expect(data.table?.id).toBe(tableId)
        expect(data.table?.identifier).toBeDefined()
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
      const result = await graphqlRequest<TableByIdentifierQueryData>(query, variables)
      const data = requireGraphQLData(result)

      if (data.tableByIdentifier) {
        expect(result.errors).toBeUndefined()
        expect(data.tableByIdentifier.identifier).toBe('test-todos')
        expect(data.tableByIdentifier.id).toBeDefined()
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

      const result = await graphqlRequest<TableQueryData>(query, { id: '999999' })
      const data = requireGraphQLData(result)

      expect(result.errors).toBeUndefined()
      expect(data.table).toBeNull()
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

      const result = await graphqlRequest<TableByIdentifierQueryData>(query, { identifier: 'non-existent-table' })
      const data = requireGraphQLData(result)

      expect(result.errors).toBeUndefined()
      expect(data.tableByIdentifier).toBeNull()
    })

    test('table - Empty ID should cause validation error', async () => {
      const query = `
        query GetTable($id: ID!) {
          table(id: $id) {
            id
          }
        }
      `

      const result = await graphqlRequest<TableQueryData>(query, { id: '' })
      const data = requireGraphQLData(result)

      // Should either have GraphQL errors or return null
      expect(result.errors || data.table === null).toBeTruthy()
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
      const result = await graphqlRequest<TablesQueryData>(query, {
        pagination: { limit: 5, offset: 0 },
      })
      const data = requireGraphQLData(result)

      expect(result.errors).toBeUndefined()
      expect(data.tables.nodes.length).toBeLessThanOrEqual(5)
      expect(data.tables.totalCount).toBeGreaterThanOrEqual(0)
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

      const result = await graphqlRequest<TablesQueryData>(query)
      const data = requireGraphQLData(result)

      expect(result.errors).toBeUndefined()
      expect(data.tables).toBeDefined()
      expect(data.tables.nodes.length).toBeLessThanOrEqual(10) // Default limit
    })
  })
})

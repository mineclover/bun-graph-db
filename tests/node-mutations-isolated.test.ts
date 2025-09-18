/**
 * Node Mutations Test - Isolated Database Version
 * Tests GraphQL node mutations with isolated server setup
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { GraphQLTestServerManager } from './fixtures/test-graphql-server'

const SUITE_NAME = 'node-mutations-isolated'
const TEST_TIMEOUT = 15000

// Global test server
let graphqlRequest: (query: string, variables?: Record<string, any>) => Promise<any>

describe('Node Mutations - Isolated Database Test Suite', () => {
  beforeAll(async () => {
    console.log('🚀 Starting isolated GraphQL server for Node Mutations tests...')

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
  }, TEST_TIMEOUT)

  afterAll(async () => {
    console.log('🧹 Cleaning up isolated test environment...')
    await GraphQLTestServerManager.stopServerForSuite(SUITE_NAME)
    console.log('✅ Cleanup completed')
  }, TEST_TIMEOUT)

  describe('🆕 Node Creation', () => {
    let testTableId: string

    beforeAll(async () => {
      // Create a test table first
      const createTableMutation = `
        mutation CreateTestTable($input: CreateTableInput!) {
          createTable(input: $input) {
            success
            table {
              id
              identifier
            }
            errors {
              message
            }
          }
        }
      `

      const tableResult = await graphqlRequest(createTableMutation, {
        input: {
          identifier: 'test-table-for-nodes',
          description: 'Test table for node mutations'
        }
      })

      expect(tableResult.errors).toBeUndefined()
      expect(tableResult.data.createTable.success).toBe(true)
      testTableId = tableResult.data.createTable.table.id
      console.log(`✅ Created test table with ID: ${testTableId}`)
    })

    test('createNode - Create node with content', async () => {
      const mutation = `
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            success
            node {
              id
              content
              table {
                id
              }
              createdAt
              updatedAt
            }
            errors {
              message
              code
            }
          }
        }
      `

      const variables = {
        input: {
          content: 'Test node content',
          tableId: testTableId
        }
      }

      const result = await graphqlRequest(mutation, variables)

      console.log('🔍 CreateNode result:', JSON.stringify(result, null, 2))

      expect(result.errors).toBeUndefined()
      expect(result.data.createNode.success).toBe(true)
      expect(result.data.createNode.node).toBeDefined()
      expect(result.data.createNode.node.content).toBe('Test node content')
      expect(result.data.createNode.node.table.id).toBe(testTableId)
      expect(result.data.createNode.node.id).toBeDefined()
      expect(result.data.createNode.errors).toEqual([])
    })

    test('createNode - Create node with different content', async () => {
      const mutation = `
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            success
            node {
              id
              content
            }
          }
        }
      `

      const variables = {
        input: {
          content: 'Another test node',
          tableId: testTableId
        }
      }

      const result = await graphqlRequest(mutation, variables)

      expect(result.errors).toBeUndefined()
      expect(result.data.createNode.success).toBe(true)
      expect(result.data.createNode.node.content).toBe('Another test node')
    })

    test('createNode - Validation errors', async () => {
      const mutation = `
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            success
            node {
              id
            }
            errors {
              message
              code
              field
            }
          }
        }
      `

      // Test with empty content
      const result = await graphqlRequest(mutation, {
        input: {
          content: '',
          tableId: testTableId
        }
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.createNode.success).toBe(false)
      expect(result.data.createNode.errors.length).toBeGreaterThan(0)
      expect(result.data.createNode.node).toBeNull()
    })

    test('createNode - Invalid table ID should fail', async () => {
      const mutation = `
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            success
            errors {
              message
              code
            }
          }
        }
      `

      const result = await graphqlRequest(mutation, {
        input: {
          content: 'Test content',
          tableId: '999999'
        }
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.createNode.success).toBe(false)
      expect(result.data.createNode.errors.length).toBeGreaterThan(0)
    })
  })

  describe('✏️ Node Updates', () => {
    let testNodeId: string
    let testTableId: string

    beforeAll(async () => {
      // Create test table
      const createTableMutation = `
        mutation CreateTestTable($input: CreateTableInput!) {
          createTable(input: $input) {
            table { id }
          }
        }
      `

      const tableResult = await graphqlRequest(createTableMutation, {
        input: {
          identifier: 'test-table-for-updates',
          description: 'Test table for node updates'
        }
      })

      testTableId = tableResult.data.createTable.table.id

      // Create test node
      const createNodeMutation = `
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            node { id }
          }
        }
      `

      const nodeResult = await graphqlRequest(createNodeMutation, {
        input: {
          content: 'Original content',
          tableId: testTableId
        }
      })

      testNodeId = nodeResult.data.createNode.node.id
    })

    test('updateNode - Update node content', async () => {
      const mutation = `
        mutation UpdateNode($id: ID!, $input: UpdateNodeInput!) {
          updateNode(id: $id, input: $input) {
            success
            node {
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

      const result = await graphqlRequest(mutation, {
        id: testNodeId,
        input: {
          content: 'Updated content'
        }
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.updateNode.success).toBe(true)
      expect(result.data.updateNode.node.content).toBe('Updated content')
      expect(result.data.updateNode.node.id).toBe(testNodeId)
      expect(result.data.updateNode.errors).toEqual([])
    })

    test('updateNode - Invalid node ID should fail', async () => {
      const mutation = `
        mutation UpdateNode($id: ID!, $input: UpdateNodeInput!) {
          updateNode(id: $id, input: $input) {
            success
            errors {
              message
              code
            }
          }
        }
      `

      const result = await graphqlRequest(mutation, {
        id: '999999',
        input: {
          content: 'Updated content'
        }
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.updateNode.success).toBe(false)
      expect(result.data.updateNode.errors.length).toBeGreaterThan(0)
    })

    test('updateNode - Empty content should fail', async () => {
      const mutation = `
        mutation UpdateNode($id: ID!, $input: UpdateNodeInput!) {
          updateNode(id: $id, input: $input) {
            success
            errors {
              message
              code
            }
          }
        }
      `

      const result = await graphqlRequest(mutation, {
        id: testNodeId,
        input: {
          content: ''
        }
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.updateNode.success).toBe(false)
      expect(result.data.updateNode.errors.length).toBeGreaterThan(0)
    })
  })

  describe('🗑️ Node Deletion', () => {
    let testNodeId: string
    let testTableId: string

    beforeAll(async () => {
      // Create test table
      const createTableMutation = `
        mutation CreateTestTable($input: CreateTableInput!) {
          createTable(input: $input) {
            table { id }
          }
        }
      `

      const tableResult = await graphqlRequest(createTableMutation, {
        input: {
          identifier: 'test-table-for-deletion',
          description: 'Test table for node deletion'
        }
      })

      testTableId = tableResult.data.createTable.table.id

      // Create test node
      const createNodeMutation = `
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            node { id }
          }
        }
      `

      const nodeResult = await graphqlRequest(createNodeMutation, {
        input: {
          content: 'Node to be deleted',
          tableId: testTableId
        }
      })

      testNodeId = nodeResult.data.createNode.node.id
    })

    test('deleteNode - Delete existing node', async () => {
      const mutation = `
        mutation DeleteNode($id: ID!) {
          deleteNode(id: $id) {
            success
            errors {
              message
            }
          }
        }
      `

      const result = await graphqlRequest(mutation, {
        id: testNodeId
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.deleteNode.success).toBe(true)
      expect(result.data.deleteNode.errors).toEqual([])

      // Verify node is deleted by trying to query it
      const queryDeletedNode = `
        query GetNode($id: ID!) {
          node(id: $id) {
            id
          }
        }
      `

      const queryResult = await graphqlRequest(queryDeletedNode, { id: testNodeId })
      expect(queryResult.data.node).toBeNull()
    })

    test('deleteNode - Invalid node ID should fail', async () => {
      const mutation = `
        mutation DeleteNode($id: ID!) {
          deleteNode(id: $id) {
            success
            errors {
              message
              code
            }
          }
        }
      `

      const result = await graphqlRequest(mutation, {
        id: '999999'
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.deleteNode.success).toBe(false)
      expect(result.data.deleteNode.errors.length).toBeGreaterThan(0)
    })
  })

  describe('🔍 Node Querying After Mutations', () => {
    let testNodeId: string
    let testTableId: string

    beforeAll(async () => {
      // Create test table
      const createTableMutation = `
        mutation CreateTestTable($input: CreateTableInput!) {
          createTable(input: $input) {
            table { id }
          }
        }
      `

      const tableResult = await graphqlRequest(createTableMutation, {
        input: {
          identifier: 'test-table-for-querying',
          description: 'Test table for node querying'
        }
      })

      testTableId = tableResult.data.createTable.table.id

      // Create test node
      const createNodeMutation = `
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            node { id }
          }
        }
      `

      const nodeResult = await graphqlRequest(createNodeMutation, {
        input: {
          content: 'Node for query testing',
          tableId: testTableId
        }
      })

      testNodeId = nodeResult.data.createNode.node.id
    })

    test('Query created node by ID', async () => {
      const query = `
        query GetNode($id: ID!) {
          node(id: $id) {
            id
            content
            table {
              id
              identifier
            }
          }
        }
      `

      const result = await graphqlRequest(query, { id: testNodeId })

      expect(result.errors).toBeUndefined()
      expect(result.data.node).toBeDefined()
      expect(result.data.node.id).toBe(testNodeId)
      expect(result.data.node.content).toBe('Node for query testing')
      expect(result.data.node.table.id).toBe(testTableId)
    })
  })

  describe('📊 Performance & Data Integrity', () => {
    let testTableId: string

    beforeAll(async () => {
      // Create test table
      const createTableMutation = `
        mutation CreateTestTable($input: CreateTableInput!) {
          createTable(input: $input) {
            table { id }
          }
        }
      `

      const tableResult = await graphqlRequest(createTableMutation, {
        input: {
          identifier: 'test-table-for-performance',
          description: 'Test table for performance testing'
        }
      })

      testTableId = tableResult.data.createTable.table.id
    })

    test('createNode - Bulk node creation performance', async () => {
      const mutation = `
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            success
            node {
              id
              content
            }
          }
        }
      `

      const startTime = Date.now()
      const promises = []

      // Create 10 nodes concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(
          graphqlRequest(mutation, {
            input: {
              content: `Performance test node ${i}`,
              tableId: testTableId
            }
          })
        )
      }

      const results = await Promise.all(promises)
      const endTime = Date.now()

      // Verify all nodes were created successfully
      results.forEach(result => {
        expect(result.errors).toBeUndefined()
        expect(result.data.createNode.success).toBe(true)
      })

      console.log(`✅ Created 10 nodes in ${endTime - startTime}ms`)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
    })

    test('createNode - Duplicate content handling', async () => {
      const mutation = `
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            success
            node {
              id
            }
            errors {
              message
              code
            }
          }
        }
      `

      const nodeContent = 'Duplicate content test'

      // Create first node
      const result1 = await graphqlRequest(mutation, {
        input: {
          content: nodeContent,
          tableId: testTableId
        }
      })

      expect(result1.data.createNode.success).toBe(true)

      // Try to create duplicate
      const result2 = await graphqlRequest(mutation, {
        input: {
          content: nodeContent,
          tableId: testTableId
        }
      })

      // Should either succeed (if duplicates allowed) or fail gracefully
      expect(result2.errors).toBeUndefined()
      // The behavior depends on business rules - just ensure it doesn't crash
    })
  })
})
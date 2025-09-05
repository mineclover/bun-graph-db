/**
 * Basic Node Queries API Tests
 * 
 * Direct HTTP-based testing of node query operations
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { GraphQLClient, createDevGraphQLClient } from '../../clients/GraphQLClient.js'
import type { Node } from '../../../../src/domain/entities/Node.js'

describe('Node Queries - Direct API Tests', () => {
  let client: GraphQLClient
  let testTableId: string

  beforeAll(async () => {
    client = createDevGraphQLClient()
    
    // Create test table for queries
    const createTableMutation = `
      mutation CreateTable($input: CreateTableInput!) {
        createTable(input: $input) {
          id
          name
        }
      }
    `
    
    const tableResult = await client.mutation(createTableMutation, {
      input: {
        name: 'API Test Table',
        description: 'Table for direct API testing'
      }
    })
    
    expect(tableResult.isSuccess).toBe(true)
    expect(tableResult.data?.data?.createTable).toBeDefined()
    testTableId = tableResult.data?.data?.createTable.id
  })

  afterAll(async () => {
    // Cleanup: Delete test table
    if (testTableId) {
      const deleteTableMutation = `
        mutation DeleteTable($id: ID!) {
          deleteTable(id: $id)
        }
      `
      
      await client.mutation(deleteTableMutation, { id: testTableId })
    }
  })

  describe('Basic Node Retrieval', () => {
    test('should retrieve all nodes with direct API call', async () => {
      const query = `
        query GetAllNodes {
          nodes {
            id
            content
            title
            description
            createdAt
            updatedAt
          }
        }
      `

      const result = await client.query(query)

      // Validate HTTP response
      expect(result.status).toBe(200)
      expect(result.isSuccess).toBe(true)
      expect(result.hasErrors).toBe(false)

      // Validate GraphQL response structure
      expect(result.data?.data).toBeDefined()
      expect(result.data?.data?.nodes).toBeInstanceOf(Array)

      // Validate response timing
      expect(result.timing.duration).toBeLessThan(5000) // 5 seconds max
    })

    test('should retrieve node by ID with direct API call', async () => {
      // First create a test node
      const createNodeMutation = `
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            id
            content
            title
            description
          }
        }
      `

      const createResult = await client.mutation(createNodeMutation, {
        input: {
          tableId: testTableId,
          content: 'Test Node Content',
          title: 'Test Node Title',
          description: 'Test node for API testing'
        }
      })

      expect(createResult.isSuccess).toBe(true)
      const nodeId = createResult.data?.data?.createNode.id

      // Now query the created node
      const query = `
        query GetNodeById($id: ID!) {
          node(id: $id) {
            id
            content
            title
            description
            table {
              id
              name
            }
          }
        }
      `

      const result = await client.query(query, { id: nodeId })

      // Validate response
      expect(result.status).toBe(200)
      expect(result.isSuccess).toBe(true)
      expect(result.data?.data?.node).toBeDefined()
      expect(result.data?.data?.node.id).toBe(nodeId)
      expect(result.data?.data?.node.content).toBe('Test Node Content')
      expect(result.data?.data?.node.table.id).toBe(testTableId)

      // Validate performance
      expect(result.timing.duration).toBeLessThan(1000) // 1 second max for single node
    })

    test('should handle non-existent node ID gracefully', async () => {
      const query = `
        query GetNodeById($id: ID!) {
          node(id: $id) {
            id
            content
          }
        }
      `

      const result = await client.query(query, { id: 'non-existent-id' })

      // Should return null for non-existent node, not an error
      expect(result.status).toBe(200)
      expect(result.data?.data?.node).toBeNull()
      expect(result.hasErrors).toBe(false)
    })
  })

  describe('Node Filtering and Pagination', () => {
    test('should filter nodes by table ID', async () => {
      const query = `
        query GetNodesByTable($tableId: ID!) {
          nodesByTable(tableId: $tableId) {
            id
            content
            table {
              id
              name
            }
          }
        }
      `

      const result = await client.query(query, { tableId: testTableId })

      expect(result.isSuccess).toBe(true)
      expect(result.data?.data?.nodesByTable).toBeInstanceOf(Array)
      
      // All returned nodes should belong to the specified table
      const nodes = result.data?.data?.nodesByTable || []
      nodes.forEach((node: any) => {
        expect(node.table.id).toBe(testTableId)
      })
    })

    test('should support pagination in node queries', async () => {
      const query = `
        query GetNodesWithPagination($first: Int, $after: String) {
          nodes(first: $first, after: $after) {
            id
            content
          }
        }
      `

      const result = await client.query(query, { first: 5 })

      expect(result.isSuccess).toBe(true)
      expect(result.data?.data?.nodes).toBeInstanceOf(Array)
      
      const nodes = result.data?.data?.nodes || []
      expect(nodes.length).toBeLessThanOrEqual(5)
    })

    test('should search nodes by content', async () => {
      const query = `
        query SearchNodes($searchTerm: String!) {
          searchNodes(query: $searchTerm) {
            id
            content
            title
            relevanceScore
          }
        }
      `

      const result = await client.query(query, { searchTerm: 'test' })

      expect(result.isSuccess).toBe(true)
      expect(result.data?.data?.searchNodes).toBeInstanceOf(Array)

      // Validate search results contain search term
      const searchResults = result.data?.data?.searchNodes || []
      searchResults.forEach((node: any) => {
        const hasSearchTerm = 
          node.content?.toLowerCase().includes('test') ||
          node.title?.toLowerCase().includes('test')
        expect(hasSearchTerm).toBe(true)
      })
    })
  })

  describe('Node Relationships', () => {
    test('should retrieve node with relationships', async () => {
      const query = `
        query GetNodeWithRelationships($id: ID!) {
          node(id: $id) {
            id
            content
            relations {
              id
              relationType
              sourceNode {
                id
                content
              }
              targetNode {
                id
                content
              }
            }
          }
        }
      `

      // Create a test node first
      const createResult = await client.mutation(`
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            id
          }
        }
      `, {
        input: {
          tableId: testTableId,
          content: 'Node with relationships'
        }
      })

      const nodeId = createResult.data?.data?.createNode.id
      const result = await client.query(query, { id: nodeId })

      expect(result.isSuccess).toBe(true)
      expect(result.data?.data?.node).toBeDefined()
      expect(result.data?.data?.node.relations).toBeInstanceOf(Array)
    })

    test('should retrieve connected nodes', async () => {
      const query = `
        query GetConnectedNodes($id: ID!, $depth: Int) {
          node(id: $id) {
            id
            content
            connectedNodes(depth: $depth) {
              id
              content
              distance
            }
          }
        }
      `

      const createResult = await client.mutation(`
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            id
          }
        }
      `, {
        input: {
          tableId: testTableId,
          content: 'Connected node test'
        }
      })

      const nodeId = createResult.data?.data?.createNode.id
      const result = await client.query(query, { id: nodeId, depth: 2 })

      expect(result.isSuccess).toBe(true)
      expect(result.data?.data?.node.connectedNodes).toBeInstanceOf(Array)
    })
  })

  describe('Performance and Reliability', () => {
    test('should handle high-frequency requests', async () => {
      const query = `
        query QuickNodeQuery {
          nodes(first: 1) {
            id
            content
          }
        }
      `

      const requests = Array(10).fill(null).map(() => client.query(query))
      const results = await Promise.all(requests)

      // All requests should succeed
      results.forEach(result => {
        expect(result.isSuccess).toBe(true)
        expect(result.timing.duration).toBeLessThan(2000)
      })
    })

    test('should handle concurrent requests efficiently', async () => {
      const query = `
        query ConcurrentTest($id: ID!) {
          node(id: $id) {
            id
            content
          }
        }
      `

      const createResult = await client.mutation(`
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            id
          }
        }
      `, {
        input: {
          tableId: testTableId,
          content: 'Concurrent test node'
        }
      })

      const nodeId = createResult.data?.data?.createNode.id
      const concurrentRequests = 5
      const startTime = Date.now()

      const requests = Array(concurrentRequests)
        .fill(null)
        .map(() => client.query(query, { id: nodeId }))

      const results = await Promise.all(requests)
      const totalTime = Date.now() - startTime

      // Validate all requests succeeded
      results.forEach(result => {
        expect(result.isSuccess).toBe(true)
        expect(result.data?.data?.node.id).toBe(nodeId)
      })

      // Concurrent requests should be faster than sequential
      expect(totalTime).toBeLessThan(concurrentRequests * 500) // Much faster than sequential
    })

    test('should measure query performance', async () => {
      const query = `
        query PerformanceTest {
          nodes(first: 10) {
            id
            content
            title
            createdAt
          }
        }
      `

      const benchmark = await client.benchmark(query, 20)

      expect(benchmark.iterations).toBe(20)
      expect(benchmark.success).toBeGreaterThan(15) // At least 75% success rate
      expect(benchmark.timing.average).toBeLessThan(2000) // Average under 2 seconds
      expect(benchmark.timing.p95).toBeLessThan(3000) // 95th percentile under 3 seconds
    })
  })

  describe('Error Handling', () => {
    test('should handle malformed queries gracefully', async () => {
      const malformedQuery = `
        query MalformedQuery {
          nodes {
            id
            nonExistentField
          }
        }
      `

      const result = await client.query(malformedQuery)

      expect(result.status).toBe(200) // GraphQL returns 200 even for query errors
      expect(result.hasErrors).toBe(true)
      expect(result.data?.errors).toBeDefined()
      expect(result.data?.errors?.[0]?.message).toContain('Cannot query field')
    })

    test('should handle server errors appropriately', async () => {
      // Test with invalid variables that might cause server errors
      const query = `
        query TestServerError($invalidId: ID!) {
          node(id: $invalidId) {
            id
          }
        }
      `

      const result = await client.query(query, { invalidId: null })

      // Should handle gracefully without throwing
      expect(result).toBeDefined()
      expect(result.status).toBeOneOf([200, 400, 500])
    })
  })
})
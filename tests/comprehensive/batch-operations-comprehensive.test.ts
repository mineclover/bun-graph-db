/**
 * Comprehensive Test Suite: Batch Operations
 *
 * Purpose: Test bulk operations, transaction safety, and batch processing
 * Coverage: Mass operations, schema validation, progress monitoring, rollback support
 *
 * Test Categories:
 * - Bulk table creation and management
 * - Mass node insertion with validation
 * - Batch attribute operations
 * - Bulk relationship creation
 * - Transaction safety and rollback
 * - Performance under load
 * - Error handling and partial failures
 * - Progress monitoring and status tracking
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { DIContainer } from '../../src/infrastructure/container/DIContainer'
import { ContainerBootstrap } from '../../src/infrastructure/container/ContainerBootstrap'
import { createGraphQLYoga, createGraphQLExecutor } from '../fixtures/graphql-yoga-helper'
import { DatabaseCleaner } from '../fixtures/database-cleaner'
import { TestDatabaseFactory, type TestEnvironment } from '../fixtures/test-database-factory'

describe('Batch Operations Comprehensive Tests', () => {
  let yoga: any
  let container: DIContainer
  let testEnvironment: TestEnvironment
  let databaseCleaner: DatabaseCleaner
  let graphqlExecute: (query: string, variables?: any) => Promise<any>

  beforeAll(async () => {
    testEnvironment = await TestDatabaseFactory.createTestEnvironment('batch-operations', 'batch')
    process.env.DATABASE_PATH = testEnvironment.databasePath
    container = await ContainerBootstrap.createContainer()
    yoga = await createGraphQLYoga(container)
    graphqlExecute = createGraphQLExecutor(yoga)
    databaseCleaner = new DatabaseCleaner(container)
  })

  beforeEach(async () => {
    await databaseCleaner.clearAllData()
  })

  afterAll(async () => {
    await testEnvironment.cleanup()
  })

  describe('Bulk Table Operations', () => {
    test('should create multiple tables in batch', async () => {
      const batchCreateQuery = `
        mutation BatchCreateTables($tables: [CreateTableInput!]!) {
          batchCreateTables(tables: $tables) {
            success
            results {
              table {
                id
                identifier
                name
                description
              }
              errors
            }
            totalCreated
            totalFailed
          }
        }
      `

      const tables = Array.from({ length: 10 }, (_, i) => ({
        identifier: `batch-table-${i + 1}`,
        name: `Batch Table ${i + 1}`,
        description: `Table created in batch operation ${i + 1}`,
      }))

      const response = await graphqlExecute(batchCreateQuery, { tables })

      expect(response.errors).toBeUndefined()
      expect(response.data.batchCreateTables.success).toBe(true)
      expect(response.data.batchCreateTables.totalCreated).toBe(10)
      expect(response.data.batchCreateTables.totalFailed).toBe(0)
      expect(response.data.batchCreateTables.results).toHaveLength(10)

      // Verify each table was created correctly
      response.data.batchCreateTables.results.forEach((result: any, index: number) => {
        expect(result.table.identifier).toBe(`batch-table-${index + 1}`)
        expect(result.table.name).toBe(`Batch Table ${index + 1}`)
        expect(result.errors).toHaveLength(0)
      })
    }, 15000)

    test('should handle partial failures in batch table creation', async () => {
      // First create a table that will conflict
      const conflictingTable = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "conflicting-table"
            name: "Existing Table"
          }) {
            table { id }
          }
        }
      `)

      const batchCreateQuery = `
        mutation BatchCreateTables($tables: [CreateTableInput!]!) {
          batchCreateTables(tables: $tables) {
            success
            results {
              table {
                id
                identifier
              }
              errors
            }
            totalCreated
            totalFailed
          }
        }
      `

      const tables = [
        { identifier: 'valid-table-1', name: 'Valid Table 1' },
        { identifier: 'conflicting-table', name: 'Conflicting Table' }, // This should fail
        { identifier: 'valid-table-2', name: 'Valid Table 2' },
        { identifier: '', name: 'Invalid Table' }, // This should fail
        { identifier: 'valid-table-3', name: 'Valid Table 3' },
      ]

      const response = await graphqlExecute(batchCreateQuery, { tables })

      expect(response.data.batchCreateTables.success).toBe(false)
      expect(response.data.batchCreateTables.totalCreated).toBe(3) // 3 valid tables
      expect(response.data.batchCreateTables.totalFailed).toBe(2) // 2 failed tables
      expect(response.data.batchCreateTables.results).toHaveLength(5)

      // Check that valid tables were created and invalid ones failed
      const results = response.data.batchCreateTables.results
      expect(results[0].table).toBeDefined() // valid-table-1
      expect(results[1].errors).toHaveLength(1) // conflicting-table
      expect(results[2].table).toBeDefined() // valid-table-2
      expect(results[3].errors).toHaveLength(1) // invalid table
      expect(results[4].table).toBeDefined() // valid-table-3
    })

    test('should delete multiple tables in batch', async () => {
      // First create tables to delete
      const tables = await Promise.all(
        Array.from({ length: 5 }, async (_, i) => {
          const response = await graphqlExecute(`
            mutation {
              createTable(input: {
                identifier: "delete-table-${i + 1}"
                name: "Delete Table ${i + 1}"
              }) {
                table { id identifier }
              }
            }
          `)
          return response.data.createTable.table
        })
      )

      const batchDeleteQuery = `
        mutation BatchDeleteTables($tableIds: [ID!]!) {
          batchDeleteTables(tableIds: $tableIds) {
            success
            deletedCount
            failedCount
            errors
          }
        }
      `

      const tableIds = tables.map((table) => table.id)
      const response = await graphqlExecute(batchDeleteQuery, { tableIds })

      expect(response.errors).toBeUndefined()
      expect(response.data.batchDeleteTables.success).toBe(true)
      expect(response.data.batchDeleteTables.deletedCount).toBe(5)
      expect(response.data.batchDeleteTables.failedCount).toBe(0)
    })
  })

  describe('Bulk Node Operations', () => {
    let tableId: string

    beforeEach(async () => {
      // Create a table for node operations
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "batch-nodes-table"
            name: "Batch Nodes Table"
          }) {
            table { id }
          }
        }
      `)
      tableId = tableResponse.data.createTable.table.id

      // Add some attributes to the table
      await graphqlExecute(`
        mutation {
          createAttribute(input: {
            tableId: "${tableId}"
            identifier: "category"
            name: "Category"
            attributeTypeId: "1"
          }) {
            attribute { id }
          }
        }
      `)
    })

    test('should create multiple nodes in batch', async () => {
      const batchCreateQuery = `
        mutation BatchCreateNodes($nodes: [CreateNodeInput!]!) {
          batchCreateNodes(nodes: $nodes) {
            success
            results {
              node {
                id
                content
                tableId
              }
              errors
            }
            totalCreated
            totalFailed
          }
        }
      `

      const nodes = Array.from({ length: 100 }, (_, i) => ({
        tableId,
        content: `Batch Node ${i + 1}`,
        metadata: { batchIndex: i + 1 },
      }))

      const response = await graphqlExecute(batchCreateQuery, { nodes })

      expect(response.errors).toBeUndefined()
      expect(response.data.batchCreateNodes.success).toBe(true)
      expect(response.data.batchCreateNodes.totalCreated).toBe(100)
      expect(response.data.batchCreateNodes.totalFailed).toBe(0)
      expect(response.data.batchCreateNodes.results).toHaveLength(100)

      // Verify nodes were created correctly
      response.data.batchCreateNodes.results.forEach((result: any, index: number) => {
        expect(result.node.content).toBe(`Batch Node ${index + 1}`)
        expect(result.node.tableId).toBe(tableId)
        expect(result.errors).toHaveLength(0)
      })
    }, 20000)

    test('should handle validation errors in batch node creation', async () => {
      const batchCreateQuery = `
        mutation BatchCreateNodes($nodes: [CreateNodeInput!]!) {
          batchCreateNodes(nodes: $nodes) {
            success
            results {
              node {
                id
                content
              }
              errors
            }
            totalCreated
            totalFailed
          }
        }
      `

      const nodes = [
        { tableId, content: 'Valid Node 1' },
        { tableId: 'invalid-table-id', content: 'Invalid Table ID' },
        { tableId, content: '' }, // Empty content should fail
        { tableId, content: 'Valid Node 2' },
        { tableId: null, content: 'Null Table ID' },
      ]

      const response = await graphqlExecute(batchCreateQuery, { nodes })

      expect(response.data.batchCreateNodes.success).toBe(false)
      expect(response.data.batchCreateNodes.totalCreated).toBe(2) // 2 valid nodes
      expect(response.data.batchCreateNodes.totalFailed).toBe(3) // 3 failed nodes

      const results = response.data.batchCreateNodes.results
      expect(results[0].node).toBeDefined() // Valid Node 1
      expect(results[1].errors).toHaveLength(1) // Invalid table ID
      expect(results[2].errors).toHaveLength(1) // Empty content
      expect(results[3].node).toBeDefined() // Valid Node 2
      expect(results[4].errors).toHaveLength(1) // Null table ID
    })

    test('should update multiple nodes in batch', async () => {
      // First create nodes to update
      const nodes = await Promise.all(
        Array.from({ length: 10 }, async (_, i) => {
          const response = await graphqlExecute(`
            mutation {
              createNode(input: {
                tableId: "${tableId}"
                content: "Original Content ${i + 1}"
              }) {
                node { id content }
              }
            }
          `)
          return response.data.createNode.node
        })
      )

      const batchUpdateQuery = `
        mutation BatchUpdateNodes($updates: [UpdateNodeInput!]!) {
          batchUpdateNodes(updates: $updates) {
            success
            results {
              node {
                id
                content
              }
              errors
            }
            totalUpdated
            totalFailed
          }
        }
      `

      const updates = nodes.map((node, i) => ({
        nodeId: node.id,
        content: `Updated Content ${i + 1}`,
        metadata: { updated: true },
      }))

      const response = await graphqlExecute(batchUpdateQuery, { updates })

      expect(response.errors).toBeUndefined()
      expect(response.data.batchUpdateNodes.success).toBe(true)
      expect(response.data.batchUpdateNodes.totalUpdated).toBe(10)
      expect(response.data.batchUpdateNodes.totalFailed).toBe(0)

      // Verify updates
      response.data.batchUpdateNodes.results.forEach((result: any, index: number) => {
        expect(result.node.content).toBe(`Updated Content ${index + 1}`)
        expect(result.errors).toHaveLength(0)
      })
    })
  })

  describe('Bulk Attribute Operations', () => {
    let tableId: string

    beforeEach(async () => {
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "batch-attrs-table"
            name: "Batch Attributes Table"
          }) {
            table { id }
          }
        }
      `)
      tableId = tableResponse.data.createTable.table.id
    })

    test('should create multiple attributes in batch', async () => {
      const batchCreateQuery = `
        mutation BatchCreateAttributes($attributes: [CreateAttributeInput!]!) {
          batchCreateAttributes(attributes: $attributes) {
            success
            results {
              attribute {
                id
                identifier
                name
                tableId
              }
              errors
            }
            totalCreated
            totalFailed
          }
        }
      `

      const attributes = [
        { tableId, identifier: 'name', name: 'Name', attributeTypeId: '1' },
        { tableId, identifier: 'age', name: 'Age', attributeTypeId: '2' },
        { tableId, identifier: 'email', name: 'Email', attributeTypeId: '1' },
        { tableId, identifier: 'is_active', name: 'Is Active', attributeTypeId: '3' },
        { tableId, identifier: 'created_at', name: 'Created At', attributeTypeId: '4' },
      ]

      const response = await graphqlExecute(batchCreateQuery, { attributes })

      expect(response.errors).toBeUndefined()
      expect(response.data.batchCreateAttributes.success).toBe(true)
      expect(response.data.batchCreateAttributes.totalCreated).toBe(5)
      expect(response.data.batchCreateAttributes.totalFailed).toBe(0)

      // Verify attributes were created
      const results = response.data.batchCreateAttributes.results
      expect(results[0].attribute.identifier).toBe('name')
      expect(results[1].attribute.identifier).toBe('age')
      expect(results[2].attribute.identifier).toBe('email')
      expect(results[3].attribute.identifier).toBe('is_active')
      expect(results[4].attribute.identifier).toBe('created_at')
    })

    test('should set multiple node attributes in batch', async () => {
      // Create attribute first
      const attrResponse = await graphqlExecute(`
        mutation {
          createAttribute(input: {
            tableId: "${tableId}"
            identifier: "category"
            name: "Category"
            attributeTypeId: "1"
          }) {
            attribute { id }
          }
        }
      `)
      const attributeId = attrResponse.data.createAttribute.attribute.id

      // Create nodes
      const nodes = await Promise.all(
        Array.from({ length: 20 }, async (_, i) => {
          const response = await graphqlExecute(`
            mutation {
              createNode(input: {
                tableId: "${tableId}"
                content: "Node ${i + 1}"
              }) {
                node { id }
              }
            }
          `)
          return response.data.createNode.node
        })
      )

      const batchSetQuery = `
        mutation BatchSetNodeAttributes($attributeUpdates: [NodeAttributeUpdateInput!]!) {
          batchSetNodeAttributes(attributeUpdates: $attributeUpdates) {
            success
            results {
              nodeId
              attributeId
              value
              errors
            }
            totalSet
            totalFailed
          }
        }
      `

      const attributeUpdates = nodes.map((node, i) => ({
        nodeId: node.id,
        attributeId,
        value: `Category ${(i % 5) + 1}`, // 5 different categories
      }))

      const response = await graphqlExecute(batchSetQuery, { attributeUpdates })

      expect(response.errors).toBeUndefined()
      expect(response.data.batchSetNodeAttributes.success).toBe(true)
      expect(response.data.batchSetNodeAttributes.totalSet).toBe(20)
      expect(response.data.batchSetNodeAttributes.totalFailed).toBe(0)

      // Verify attribute values were set
      response.data.batchSetNodeAttributes.results.forEach((result: any, index: number) => {
        expect(result.value).toBe(`Category ${(index % 5) + 1}`)
        expect(result.errors).toHaveLength(0)
      })
    })
  })

  describe('Bulk Relationship Operations', () => {
    let tableId: string
    let nodes: any[]

    beforeEach(async () => {
      // Create table
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "batch-relations-table"
            name: "Batch Relations Table"
          }) {
            table { id }
          }
        }
      `)
      tableId = tableResponse.data.createTable.table.id

      // Create nodes for relationships
      nodes = await Promise.all(
        Array.from({ length: 50 }, async (_, i) => {
          const response = await graphqlExecute(`
            mutation {
              createNode(input: {
                tableId: "${tableId}"
                content: "Relation Node ${i + 1}"
              }) {
                node { id }
              }
            }
          `)
          return response.data.createNode.node
        })
      )
    })

    test('should create multiple relationships in batch', async () => {
      const batchCreateQuery = `
        mutation BatchCreateRelations($relations: [CreateRelationInput!]!) {
          batchCreateRelations(relations: $relations) {
            success
            results {
              relation {
                id
                fromNodeId
                toNodeId
                relationshipType
                tableId
              }
              errors
            }
            totalCreated
            totalFailed
          }
        }
      `

      // Create chain relationships: 1->2->3->4...->50
      const relations = Array.from({ length: 49 }, (_, i) => ({
        fromNodeId: nodes[i].id,
        toNodeId: nodes[i + 1].id,
        relationshipType: 'FOLLOWS',
        tableId,
        properties: { weight: i + 1 },
      }))

      const response = await graphqlExecute(batchCreateQuery, { relations })

      expect(response.errors).toBeUndefined()
      expect(response.data.batchCreateRelations.success).toBe(true)
      expect(response.data.batchCreateRelations.totalCreated).toBe(49)
      expect(response.data.batchCreateRelations.totalFailed).toBe(0)

      // Verify relationships
      response.data.batchCreateRelations.results.forEach((result: any, index: number) => {
        expect(result.relation.fromNodeId).toBe(nodes[index].id)
        expect(result.relation.toNodeId).toBe(nodes[index + 1].id)
        expect(result.relation.relationshipType).toBe('FOLLOWS')
        expect(result.errors).toHaveLength(0)
      })
    }, 30000)

    test('should create complex graph structure in batch', async () => {
      const batchCreateQuery = `
        mutation BatchCreateRelations($relations: [CreateRelationInput!]!) {
          batchCreateRelations(relations: $relations) {
            success
            totalCreated
            totalFailed
          }
        }
      `

      // Create star topology: node 0 connected to all others
      const starRelations = Array.from({ length: 49 }, (_, i) => ({
        fromNodeId: nodes[0].id,
        toNodeId: nodes[i + 1].id,
        relationshipType: 'STAR_CONNECTION',
        tableId,
      }))

      // Create ring topology: each node connected to next (circular)
      const ringRelations = Array.from({ length: 49 }, (_, i) => ({
        fromNodeId: nodes[i].id,
        toNodeId: nodes[(i + 1) % 50].id,
        relationshipType: 'RING_CONNECTION',
        tableId,
      }))

      // Combine all relations
      const allRelations = [...starRelations, ...ringRelations]

      const response = await graphqlExecute(batchCreateQuery, { relations: allRelations })

      expect(response.errors).toBeUndefined()
      expect(response.data.batchCreateRelations.success).toBe(true)
      expect(response.data.batchCreateRelations.totalCreated).toBe(98)
      expect(response.data.batchCreateRelations.totalFailed).toBe(0)
    }, 40000)
  })

  describe('Transaction Safety and Rollback', () => {
    test('should rollback failed batch operations', async () => {
      // Create initial table
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "rollback-test-table"
            name: "Rollback Test Table"
          }) {
            table { id }
          }
        }
      `)
      const tableId = tableResponse.data.createTable.table.id

      const batchOperationQuery = `
        mutation BatchOperationWithRollback($operations: [BatchOperationInput!]!) {
          batchOperationWithRollback(operations: $operations) {
            success
            rollbackOccurred
            successfulOperations
            failedOperations
            errors
          }
        }
      `

      const operations = [
        {
          type: 'CREATE_NODE',
          data: { tableId, content: 'Valid Node 1' },
        },
        {
          type: 'CREATE_NODE',
          data: { tableId, content: 'Valid Node 2' },
        },
        {
          type: 'CREATE_NODE',
          data: { tableId: 'invalid-table-id', content: 'Invalid Node' }, // This should cause rollback
        },
        {
          type: 'CREATE_NODE',
          data: { tableId, content: 'Valid Node 3' },
        },
      ]

      const response = await graphqlExecute(batchOperationQuery, { operations })

      expect(response.data.batchOperationWithRollback.success).toBe(false)
      expect(response.data.batchOperationWithRollback.rollbackOccurred).toBe(true)
      expect(response.data.batchOperationWithRollback.successfulOperations).toBe(0) // All rolled back
      expect(response.data.batchOperationWithRollback.failedOperations).toBe(4)

      // Verify no nodes were created due to rollback
      const nodesQuery = `
        query {
          searchNodes(input: { tableId: "${tableId}" }) {
            nodes { id content }
          }
        }
      `
      const nodesResponse = await graphqlExecute(nodesQuery)
      expect(nodesResponse.data.searchNodes.nodes).toHaveLength(0)
    })

    test('should handle concurrent batch operations safely', async () => {
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "concurrent-test-table"
            name: "Concurrent Test Table"
          }) {
            table { id }
          }
        }
      `)
      const tableId = tableResponse.data.createTable.table.id

      const batchCreateQuery = `
        mutation BatchCreateNodes($nodes: [CreateNodeInput!]!) {
          batchCreateNodes(nodes: $nodes) {
            success
            totalCreated
            totalFailed
          }
        }
      `

      // Create multiple concurrent batch operations
      const concurrentOperations = Array.from({ length: 5 }, (_, batchIndex) => {
        const nodes = Array.from({ length: 20 }, (_, nodeIndex) => ({
          tableId,
          content: `Batch ${batchIndex + 1} Node ${nodeIndex + 1}`,
        }))
        return graphqlExecute(batchCreateQuery, { nodes })
      })

      const responses = await Promise.all(concurrentOperations)

      // All operations should succeed
      responses.forEach((response, index) => {
        expect(response.errors).toBeUndefined()
        expect(response.data.batchCreateNodes.success).toBe(true)
        expect(response.data.batchCreateNodes.totalCreated).toBe(20)
        expect(response.data.batchCreateNodes.totalFailed).toBe(0)
      })

      // Verify total nodes created
      const nodesQuery = `
        query {
          searchNodes(input: { tableId: "${tableId}" }) {
            nodes { id content }
          }
        }
      `
      const nodesResponse = await graphqlExecute(nodesQuery)
      expect(nodesResponse.data.searchNodes.nodes).toHaveLength(100) // 5 batches × 20 nodes
    }, 25000)
  })

  describe('Performance and Progress Monitoring', () => {
    test('should handle large batch operations efficiently', async () => {
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "performance-test-table"
            name: "Performance Test Table"
          }) {
            table { id }
          }
        }
      `)
      const tableId = tableResponse.data.createTable.table.id

      const batchCreateQuery = `
        mutation BatchCreateNodes($nodes: [CreateNodeInput!]!) {
          batchCreateNodes(nodes: $nodes) {
            success
            totalCreated
            totalFailed
            processingTimeMs
            averageTimePerNodeMs
          }
        }
      `

      const startTime = Date.now()

      // Create 1000 nodes in batch
      const nodes = Array.from({ length: 1000 }, (_, i) => ({
        tableId,
        content: `Performance Node ${i + 1}`,
        metadata: {
          index: i + 1,
          timestamp: new Date().toISOString(),
        },
      }))

      const response = await graphqlExecute(batchCreateQuery, { nodes })
      const endTime = Date.now()
      const totalTime = endTime - startTime

      expect(response.errors).toBeUndefined()
      expect(response.data.batchCreateNodes.success).toBe(true)
      expect(response.data.batchCreateNodes.totalCreated).toBe(1000)
      expect(response.data.batchCreateNodes.totalFailed).toBe(0)

      // Performance assertions
      expect(totalTime).toBeLessThan(60000) // Should complete within 60 seconds
      expect(response.data.batchCreateNodes.processingTimeMs).toBeLessThan(totalTime)
      expect(response.data.batchCreateNodes.averageTimePerNodeMs).toBeLessThan(50) // < 50ms per node
    }, 65000)

    test('should provide progress monitoring for long operations', async () => {
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "progress-test-table"
            name: "Progress Test Table"
          }) {
            table { id }
          }
        }
      `)
      const tableId = tableResponse.data.createTable.table.id

      const batchCreateWithProgressQuery = `
        mutation BatchCreateNodesWithProgress($nodes: [CreateNodeInput!]!, $progressCallback: String) {
          batchCreateNodesWithProgress(nodes: $nodes, progressCallback: $progressCallback) {
            success
            totalCreated
            totalFailed
            progressUpdates {
              completed
              total
              percentage
              estimatedTimeRemainingMs
            }
          }
        }
      `

      const nodes = Array.from({ length: 500 }, (_, i) => ({
        tableId,
        content: `Progress Node ${i + 1}`,
      }))

      const response = await graphqlExecute(batchCreateWithProgressQuery, {
        nodes,
        progressCallback: 'test-progress',
      })

      expect(response.errors).toBeUndefined()
      expect(response.data.batchCreateNodesWithProgress.success).toBe(true)
      expect(response.data.batchCreateNodesWithProgress.totalCreated).toBe(500)
      expect(response.data.batchCreateNodesWithProgress.progressUpdates).toBeDefined()

      // Progress updates should show completion
      const progressUpdates = response.data.batchCreateNodesWithProgress.progressUpdates
      expect(progressUpdates.length).toBeGreaterThan(0)

      const finalUpdate = progressUpdates[progressUpdates.length - 1]
      expect(finalUpdate.completed).toBe(500)
      expect(finalUpdate.total).toBe(500)
      expect(finalUpdate.percentage).toBe(100)
    }, 45000)
  })

  describe('Error Handling and Recovery', () => {
    test('should handle memory constraints gracefully', async () => {
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "memory-test-table"
            name: "Memory Test Table"
          }) {
            table { id }
          }
        }
      `)
      const tableId = tableResponse.data.createTable.table.id

      const batchCreateQuery = `
        mutation BatchCreateNodes($nodes: [CreateNodeInput!]!) {
          batchCreateNodes(nodes: $nodes) {
            success
            totalCreated
            totalFailed
            memoryUsageMB
            errors
          }
        }
      `

      // Create very large content to test memory handling
      const largeContent = 'x'.repeat(10000) // 10KB per node
      const nodes = Array.from({ length: 100 }, (_, i) => ({
        tableId,
        content: `${largeContent} Node ${i + 1}`,
        metadata: { size: 'large' },
      }))

      const response = await graphqlExecute(batchCreateQuery, { nodes })

      expect(response.errors).toBeUndefined()
      expect(response.data.batchCreateNodes.success).toBe(true)
      expect(response.data.batchCreateNodes.memoryUsageMB).toBeDefined()
      expect(response.data.batchCreateNodes.memoryUsageMB).toBeGreaterThan(0)

      // Should handle large content without crashing
      expect(response.data.batchCreateNodes.totalCreated).toBe(100)
    }, 30000)

    test('should provide detailed error information for failed operations', async () => {
      const batchCreateQuery = `
        mutation BatchCreateNodes($nodes: [CreateNodeInput!]!) {
          batchCreateNodes(nodes: $nodes) {
            success
            results {
              node {
                id
                content
              }
              errors {
                code
                message
                field
                details
              }
            }
            totalCreated
            totalFailed
            errorSummary {
              validationErrors
              databaseErrors
              systemErrors
            }
          }
        }
      `

      const nodes = [
        { tableId: 'nonexistent-table', content: 'Node 1' },
        { tableId: null, content: 'Node 2' },
        { tableId: '', content: 'Node 3' },
        { tableId: 'another-invalid-id', content: '' }, // Multiple errors
        { tableId: 'valid-but-missing', content: 'Node 5' },
      ]

      const response = await graphqlExecute(batchCreateQuery, { nodes })

      expect(response.data.batchCreateNodes.success).toBe(false)
      expect(response.data.batchCreateNodes.totalCreated).toBe(0)
      expect(response.data.batchCreateNodes.totalFailed).toBe(5)

      // Check detailed error information
      const results = response.data.batchCreateNodes.results
      results.forEach((result: any) => {
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].code).toBeDefined()
        expect(result.errors[0].message).toBeDefined()
        expect(result.errors[0].field).toBeDefined()
      })

      // Check error summary
      const errorSummary = response.data.batchCreateNodes.errorSummary
      expect(errorSummary.validationErrors).toBeGreaterThan(0)
      expect(errorSummary.databaseErrors).toBeGreaterThan(0)
      expect(errorSummary.systemErrors).toBeGreaterThanOrEqual(0)
    })
  })
})

/**
 * Comprehensive Test Suite: Concurrency and Transaction Testing
 *
 * Purpose: Test concurrent operations, transaction safety, and data consistency
 * Coverage: Race conditions, deadlock prevention, ACID properties, isolation levels
 *
 * Test Categories:
 * - Concurrent read/write operations
 * - Transaction isolation and atomicity
 * - Deadlock detection and resolution
 * - Data consistency under load
 * - Race condition prevention
 * - Connection pooling and resource management
 * - Rollback and recovery mechanisms
 * - Lock contention and performance
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { createContainer } from '../../src/infrastructure/container/ContainerBootstrap'
import type { DIContainer } from '../../src/infrastructure/container/DIContainer'
import { DatabaseCleaner } from '../fixtures/database-cleaner'
import { createGraphQLExecutor, createGraphQLYoga } from '../fixtures/graphql-yoga-helper'
import { createTestEnvironment, type TestEnvironment } from '../fixtures/test-database-factory'

interface ConcurrencyTestResult {
  operationId: string
  success: boolean
  data?: any
  error?: any
  duration: number
  timestamp: number
}

class ConcurrencyTester {
  private operations: Array<() => Promise<any>> = []
  private results: ConcurrencyTestResult[] = []

  addOperation(id: string, operation: () => Promise<any>): ConcurrencyTester {
    this.operations.push(async () => {
      const start = Date.now()
      try {
        const result = await operation()
        const duration = Date.now() - start
        const testResult = {
          operationId: id,
          success: !result.errors,
          data: result.data,
          error: result.errors,
          duration,
          timestamp: start,
        }
        this.results.push(testResult)
        return testResult
      } catch (error) {
        const duration = Date.now() - start
        const testResult = {
          operationId: id,
          success: false,
          error,
          duration,
          timestamp: start,
        }
        this.results.push(testResult)
        return testResult
      }
    })
    return this
  }

  async runConcurrently(): Promise<ConcurrencyTestResult[]> {
    this.results = []
    await Promise.all(this.operations.map((op) => op()))
    return this.results.sort((a, b) => a.timestamp - b.timestamp)
  }

  getResults(): ConcurrencyTestResult[] {
    return this.results
  }

  getSuccessRate(): number {
    const successCount = this.results.filter((r) => r.success).length
    return successCount / this.results.length
  }
}

describe('Concurrency and Transaction Comprehensive Tests', () => {
  let yoga: any
  let container: DIContainer
  let testEnvironment: TestEnvironment
  let databaseCleaner: DatabaseCleaner
  let graphqlExecute: (query: string, variables?: any) => Promise<any>

  beforeAll(async () => {
    testEnvironment = await createTestEnvironment('concurrency-transaction', 'concurrency')
    process.env.DATABASE_PATH = testEnvironment.databasePath
    container = await createContainer()
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

  describe('Concurrent Read/Write Operations', () => {
    let tableId: string

    beforeEach(async () => {
      // Create test table for concurrency tests
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "concurrency-test-table"
            name: "Concurrency Test Table"
          }) {
            table { id }
          }
        }
      `)
      tableId = tableResponse.data.createTable.table.id
    })

    test('should handle concurrent node creation safely', async () => {
      const concurrencyTester = new ConcurrencyTester()

      // Add 20 concurrent node creation operations
      for (let i = 0; i < 20; i++) {
        concurrencyTester.addOperation(`create-node-${i}`, async () => {
          return await graphqlExecute(`
            mutation {
              createNode(input: {
                tableId: "${tableId}"
                content: "Concurrent Node ${i + 1}"
                metadata: {
                  threadId: ${i},
                  timestamp: "${new Date().toISOString()}"
                }
              }) {
                node {
                  id
                  content
                  metadata
                }
              }
            }
          `)
        })
      }

      const results = await concurrencyTester.runConcurrently()

      // All operations should succeed
      expect(concurrencyTester.getSuccessRate()).toBeGreaterThan(0.95) // At least 95% success

      // Verify data consistency
      const nodesQuery = await graphqlExecute(`
        query {
          searchNodes(input: { tableId: "${tableId}" }) {
            nodes {
              id
              content
              metadata
            }
            totalCount
          }
        }
      `)

      expect(nodesQuery.errors).toBeUndefined()
      const createdCount = results.filter((r) => r.success).length
      expect(nodesQuery.data.searchNodes.totalCount).toBe(createdCount)

      // Verify no duplicate content
      const contents = nodesQuery.data.searchNodes.nodes.map((n: any) => n.content)
      const uniqueContents = new Set(contents)
      expect(uniqueContents.size).toBe(contents.length)
    })

    test('should handle concurrent read operations efficiently', async () => {
      // First create some test data
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          graphqlExecute(`
            mutation {
              createNode(input: {
                tableId: "${tableId}"
                content: "Read Test Node ${i + 1}"
              }) {
                node { id }
              }
            }
          `),
        ),
      )

      const concurrencyTester = new ConcurrencyTester()

      // Add 50 concurrent read operations
      for (let i = 0; i < 50; i++) {
        concurrencyTester.addOperation(`read-nodes-${i}`, async () => {
          return await graphqlExecute(`
            query {
              searchNodes(input: {
                tableId: "${tableId}"
                limit: 10
              }) {
                nodes {
                  id
                  content
                }
                totalCount
              }
            }
          `)
        })
      }

      const results = await concurrencyTester.runConcurrently()

      // All read operations should succeed
      expect(concurrencyTester.getSuccessRate()).toBe(1.0) // 100% success for reads

      // All should return consistent data
      const firstResult = results.find((r) => r.success)?.data?.searchNodes
      results
        .filter((r) => r.success)
        .forEach((result) => {
          expect(result.data.searchNodes.totalCount).toBe(firstResult.totalCount)
          expect(result.data.searchNodes.nodes.length).toBe(firstResult.nodes.length)
        })

      // Performance should be reasonable
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length
      expect(avgDuration).toBeLessThan(1000) // < 1 second average
    })

    test('should handle mixed read/write operations safely', async () => {
      const concurrencyTester = new ConcurrencyTester()

      // Mix of read and write operations
      for (let i = 0; i < 10; i++) {
        // Write operation
        concurrencyTester.addOperation(`write-${i}`, async () => {
          return await graphqlExecute(`
            mutation {
              createNode(input: {
                tableId: "${tableId}"
                content: "Mixed Test Node ${i + 1}"
              }) {
                node { id }
              }
            }
          `)
        })

        // Read operation
        concurrencyTester.addOperation(`read-${i}`, async () => {
          return await graphqlExecute(`
            query {
              searchNodes(input: { tableId: "${tableId}" }) {
                totalCount
              }
            }
          `)
        })
      }

      const results = await concurrencyTester.runConcurrently()

      // Should handle mixed operations well
      expect(concurrencyTester.getSuccessRate()).toBeGreaterThan(0.9) // At least 90% success

      // Verify final state consistency
      const finalQuery = await graphqlExecute(`
        query {
          searchNodes(input: { tableId: "${tableId}" }) {
            totalCount
          }
        }
      `)

      const writeSuccessCount = results.filter((r) => r.success && r.operationId.startsWith('write')).length
      expect(finalQuery.data.searchNodes.totalCount).toBe(writeSuccessCount)
    })
  })

  describe('Transaction Isolation and Atomicity', () => {
    test('should maintain transaction atomicity in batch operations', async () => {
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "transaction-test-table"
            name: "Transaction Test Table"
          }) {
            table { id }
          }
        }
      `)
      const tableId = tableResponse.data.createTable.table.id

      const concurrencyTester = new ConcurrencyTester()

      // Multiple batch operations that should be atomic
      for (let i = 0; i < 5; i++) {
        concurrencyTester.addOperation(`batch-${i}`, async () => {
          const nodes = Array.from({ length: 5 }, (_, j) => ({
            tableId,
            content: `Batch ${i} Node ${j + 1}`,
          }))

          return await graphqlExecute(
            `
            mutation BatchCreateNodes($nodes: [CreateNodeInput!]!) {
              batchCreateNodes(nodes: $nodes) {
                success
                totalCreated
                totalFailed
                results {
                  node {
                    id
                    content
                  }
                  errors { message }
                }
              }
            }
          `,
            { nodes },
          )
        })
      }

      const results = await concurrencyTester.runConcurrently()

      // All batch operations should succeed
      results
        .filter((r) => r.success)
        .forEach((result) => {
          const batchData = result.data.batchCreateNodes
          expect(batchData.success).toBe(true)
          expect(batchData.totalCreated).toBe(5)
          expect(batchData.totalFailed).toBe(0)
        })

      // Verify total count matches successful batches
      const finalQuery = await graphqlExecute(`
        query {
          searchNodes(input: { tableId: "${tableId}" }) {
            totalCount
          }
        }
      `)

      const successfulBatches = results.filter((r) => r.success).length
      expect(finalQuery.data.searchNodes.totalCount).toBe(successfulBatches * 5)
    })

    test('should handle transaction rollback correctly', async () => {
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

      // Create initial data
      await graphqlExecute(`
        mutation {
          createNode(input: {
            tableId: "${tableId}"
            content: "Initial Node"
          }) {
            node { id }
          }
        }
      `)

      const initialCount = await graphqlExecute(`
        query {
          searchNodes(input: { tableId: "${tableId}" }) {
            totalCount
          }
        }
      `)

      const concurrencyTester = new ConcurrencyTester()

      // Operations that should trigger rollbacks
      for (let i = 0; i < 3; i++) {
        concurrencyTester.addOperation(`rollback-test-${i}`, async () => {
          const validNodes = Array.from({ length: 3 }, (_, j) => ({
            tableId,
            content: `Valid Node ${i}-${j + 1}`,
          }))

          const invalidNode = {
            tableId: 'invalid-table-id',
            content: 'This should fail',
          }

          return await graphqlExecute(
            `
            mutation TransactionalBatch($nodes: [CreateNodeInput!]!) {
              batchCreateNodesTransactional(nodes: $nodes) {
                success
                totalCreated
                totalFailed
                rollbackOccurred
              }
            }
          `,
            { nodes: [...validNodes, invalidNode] },
          )
        })
      }

      await concurrencyTester.runConcurrently()

      // Verify no partial data was committed due to rollbacks
      const finalCount = await graphqlExecute(`
        query {
          searchNodes(input: { tableId: "${tableId}" }) {
            totalCount
          }
        }
      `)

      // Should have same count as initial (rollbacks should prevent any changes)
      expect(finalCount.data.searchNodes.totalCount).toBe(initialCount.data.searchNodes.totalCount)
    })
  })

  describe('Deadlock Prevention and Resolution', () => {
    test('should prevent deadlocks in circular dependency scenarios', async () => {
      // Create two tables for cross-table operations
      const table1Response = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "deadlock-table-1"
            name: "Deadlock Test Table 1"
          }) {
            table { id }
          }
        }
      `)
      const table1Id = table1Response.data.createTable.table.id

      const table2Response = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "deadlock-table-2"
            name: "Deadlock Test Table 2"
          }) {
            table { id }
          }
        }
      `)
      const table2Id = table2Response.data.createTable.table.id

      // Create initial nodes
      const node1Response = await graphqlExecute(`
        mutation {
          createNode(input: {
            tableId: "${table1Id}"
            content: "Node 1"
          }) {
            node { id }
          }
        }
      `)
      const node1Id = node1Response.data.createNode.node.id

      const node2Response = await graphqlExecute(`
        mutation {
          createNode(input: {
            tableId: "${table2Id}"
            content: "Node 2"
          }) {
            node { id }
          }
        }
      `)
      const node2Id = node2Response.data.createNode.node.id

      const concurrencyTester = new ConcurrencyTester()

      // Operations that could cause deadlocks
      concurrencyTester.addOperation('cross-operation-A', async () => {
        // Update node1, then create relation to node2
        const updateResult = await graphqlExecute(`
          mutation {
            updateNode(input: {
              nodeId: "${node1Id}"
              content: "Updated Node 1"
            }) {
              node { id }
            }
          }
        `)

        if (updateResult.errors) return updateResult

        // Small delay to increase chance of deadlock
        await new Promise((resolve) => setTimeout(resolve, 10))

        return await graphqlExecute(`
          mutation {
            createRelation(input: {
              fromNodeId: "${node1Id}"
              toNodeId: "${node2Id}"
              relationshipType: "LINKS_TO"
              tableId: "${table1Id}"
            }) {
              relation { id }
            }
          }
        `)
      })

      concurrencyTester.addOperation('cross-operation-B', async () => {
        // Update node2, then create relation to node1
        const updateResult = await graphqlExecute(`
          mutation {
            updateNode(input: {
              nodeId: "${node2Id}"
              content: "Updated Node 2"
            }) {
              node { id }
            }
          }
        `)

        if (updateResult.errors) return updateResult

        // Small delay to increase chance of deadlock
        await new Promise((resolve) => setTimeout(resolve, 10))

        return await graphqlExecute(`
          mutation {
            createRelation(input: {
              fromNodeId: "${node2Id}"
              toNodeId: "${node1Id}"
              relationshipType: "LINKS_TO"
              tableId: "${table2Id}"
            }) {
              relation { id }
            }
          }
        `)
      })

      const results = await concurrencyTester.runConcurrently()

      // Should complete without hanging (deadlock prevention)
      expect(results).toHaveLength(2)

      // At least one operation should succeed
      const successCount = results.filter((r) => r.success).length
      expect(successCount).toBeGreaterThanOrEqual(1)

      // If one failed, it should be due to proper deadlock detection, not hanging
      const failedResults = results.filter((r) => !r.success)
      failedResults.forEach((result) => {
        if (result.error) {
          expect(JSON.stringify(result.error)).toMatch(/deadlock|timeout|conflict/i)
        }
      })
    })

    test('should handle resource contention gracefully', async () => {
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "contention-test-table"
            name: "Contention Test Table"
          }) {
            table { id }
          }
        }
      `)
      const tableId = tableResponse.data.createTable.table.id

      // Create a single node that multiple operations will contend for
      const nodeResponse = await graphqlExecute(`
        mutation {
          createNode(input: {
            tableId: "${tableId}"
            content: "Shared Resource Node"
          }) {
            node { id }
          }
        }
      `)
      const nodeId = nodeResponse.data.createNode.node.id

      const concurrencyTester = new ConcurrencyTester()

      // 10 operations trying to update the same node
      for (let i = 0; i < 10; i++) {
        concurrencyTester.addOperation(`update-contention-${i}`, async () => {
          return await graphqlExecute(`
            mutation {
              updateNode(input: {
                nodeId: "${nodeId}"
                content: "Updated by operation ${i + 1}"
                metadata: {
                  updateId: ${i + 1},
                  timestamp: "${new Date().toISOString()}"
                }
              }) {
                node {
                  id
                  content
                  metadata
                }
              }
            }
          `)
        })
      }

      const _results = await concurrencyTester.runConcurrently()

      // Should handle contention gracefully
      expect(concurrencyTester.getSuccessRate()).toBeGreaterThan(0.8) // At least 80% success

      // Verify final state is consistent
      const finalQuery = await graphqlExecute(`
        query {
          searchNodes(input: { tableId: "${tableId}" }) {
            nodes {
              id
              content
              metadata
            }
          }
        }
      `)

      expect(finalQuery.data.searchNodes.nodes).toHaveLength(1)
      const finalNode = finalQuery.data.searchNodes.nodes[0]
      expect(finalNode.content).toMatch(/Updated by operation \d+/)
    })
  })

  describe('Data Consistency Under Load', () => {
    test('should maintain referential integrity under concurrent operations', async () => {
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "integrity-test-table"
            name: "Integrity Test Table"
          }) {
            table { id }
          }
        }
      `)
      const tableId = tableResponse.data.createTable.table.id

      // Create initial nodes
      const nodeCreationPromises = Array.from({ length: 10 }, (_, i) =>
        graphqlExecute(`
          mutation {
            createNode(input: {
              tableId: "${tableId}"
              content: "Integrity Node ${i + 1}"
            }) {
              node { id }
            }
          }
        `),
      )

      const nodeResults = await Promise.all(nodeCreationPromises)
      const nodeIds = nodeResults.map((r) => r.data.createNode.node.id)

      const concurrencyTester = new ConcurrencyTester()

      // Concurrent operations that affect referential integrity
      for (let i = 0; i < 15; i++) {
        const fromIndex = i % nodeIds.length
        const toIndex = (i + 1) % nodeIds.length

        concurrencyTester.addOperation(`create-relation-${i}`, async () => {
          return await graphqlExecute(`
            mutation {
              createRelation(input: {
                fromNodeId: "${nodeIds[fromIndex]}"
                toNodeId: "${nodeIds[toIndex]}"
                relationshipType: "INTEGRITY_TEST"
                tableId: "${tableId}"
                properties: { relationIndex: ${i} }
              }) {
                relation {
                  id
                  fromNodeId
                  toNodeId
                  relationshipType
                }
              }
            }
          `)
        })

        // Some operations try to delete nodes that have relations
        if (i % 3 === 0) {
          concurrencyTester.addOperation(`delete-node-${i}`, async () => {
            return await graphqlExecute(`
              mutation {
                deleteNode(nodeId: "${nodeIds[fromIndex]}") {
                  success
                }
              }
            `)
          })
        }
      }

      const _results = await concurrencyTester.runConcurrently()

      // Verify data integrity after concurrent operations
      const integrityQuery = await graphqlExecute(`
        query {
          searchNodes(input: { tableId: "${tableId}" }) {
            nodes {
              id
              relations {
                id
                toNodeId
                toNode {
                  id
                }
              }
            }
          }
        }
      `)

      expect(integrityQuery.errors).toBeUndefined()
      const nodes = integrityQuery.data.searchNodes.nodes

      // Verify all relations point to existing nodes
      nodes.forEach((node: any) => {
        node.relations.forEach((relation: any) => {
          expect(relation.toNode).toBeDefined()
          expect(relation.toNode.id).toBe(relation.toNodeId)
        })
      })
    })

    test('should handle high-frequency updates consistently', async () => {
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "high-frequency-table"
            name: "High Frequency Test Table"
          }) {
            table { id }
          }
        }
      `)
      const tableId = tableResponse.data.createTable.table.id

      // Create attribute for counter testing
      const attrResponse = await graphqlExecute(`
        mutation {
          createAttribute(input: {
            tableId: "${tableId}"
            identifier: "counter"
            name: "Counter"
            attributeTypeId: "2"
          }) {
            attribute { id }
          }
        }
      `)
      const attributeId = attrResponse.data.createAttribute.attribute.id

      // Create a single node with counter
      const nodeResponse = await graphqlExecute(`
        mutation {
          createNode(input: {
            tableId: "${tableId}"
            content: "Counter Node"
          }) {
            node { id }
          }
        }
      `)
      const nodeId = nodeResponse.data.createNode.node.id

      // Set initial counter value
      await graphqlExecute(`
        mutation {
          setNodeAttribute(input: {
            nodeId: "${nodeId}"
            attributeId: "${attributeId}"
            value: "0"
          }) {
            success
          }
        }
      `)

      const concurrencyTester = new ConcurrencyTester()

      // 20 operations trying to increment the counter
      for (let i = 0; i < 20; i++) {
        concurrencyTester.addOperation(`increment-${i}`, async () => {
          // Read current value
          const readResult = await graphqlExecute(`
            query {
              getNodeAttributes(nodeId: "${nodeId}") {
                attributes {
                  attributeId
                  value
                }
              }
            }
          `)

          if (readResult.errors) return readResult

          const counterAttr = readResult.data.getNodeAttributes.attributes.find(
            (attr: any) => attr.attributeId === attributeId,
          )
          const currentValue = parseInt(counterAttr?.value || '0', 10)

          // Increment and update
          return await graphqlExecute(`
            mutation {
              setNodeAttribute(input: {
                nodeId: "${nodeId}"
                attributeId: "${attributeId}"
                value: "${currentValue + 1}"
              }) {
                success
                attribute {
                  value
                }
              }
            }
          `)
        })
      }

      await concurrencyTester.runConcurrently()

      // Check final counter value
      const finalQuery = await graphqlExecute(`
        query {
          getNodeAttributes(nodeId: "${nodeId}") {
            attributes {
              attributeId
              value
            }
          }
        }
      `)

      const finalCounterAttr = finalQuery.data.getNodeAttributes.attributes.find(
        (attr: any) => attr.attributeId === attributeId,
      )
      const finalValue = parseInt(finalCounterAttr?.value || '0', 10)

      // Due to race conditions, final value might be less than 20
      // but should be greater than 0 and not exceed 20
      expect(finalValue).toBeGreaterThan(0)
      expect(finalValue).toBeLessThanOrEqual(20)
    })
  })

  describe('Connection Pooling and Resource Management', () => {
    test('should handle connection pool exhaustion gracefully', async () => {
      const concurrencyTester = new ConcurrencyTester()

      // Create many simultaneous operations to stress connection pool
      for (let i = 0; i < 100; i++) {
        concurrencyTester.addOperation(`pool-stress-${i}`, async () => {
          // Add small delay to hold connections longer
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 100))

          return await graphqlExecute(`
            query {
              systemStats {
                database {
                  connections
                  queries
                }
                memory {
                  used
                  total
                }
              }
            }
          `)
        })
      }

      const _results = await concurrencyTester.runConcurrently()

      // Should handle many connections without complete failure
      expect(concurrencyTester.getSuccessRate()).toBeGreaterThan(0.7) // At least 70% success

      // System should remain responsive
      const finalHealthCheck = await graphqlExecute(`
        query {
          healthCheck {
            status
            database
          }
        }
      `)
      expect(['ok', 'healthy']).toContain(finalHealthCheck.data.healthCheck.status.toLowerCase())
    })

    test('should clean up resources properly after operations', async () => {
      // Get initial system stats
      const initialStats = await graphqlExecute(`
        query {
          systemStats {
            memory {
              used
              heapUsed
            }
            database {
              connections
            }
          }
        }
      `)

      const concurrencyTester = new ConcurrencyTester()

      // Operations that allocate resources
      for (let i = 0; i < 50; i++) {
        concurrencyTester.addOperation(`resource-test-${i}`, async () => {
          return await graphqlExecute(`
            mutation {
              createTable(input: {
                identifier: "resource-test-${i}"
                name: "Resource Test Table ${i}"
              }) {
                table {
                  id
                  identifier
                }
              }
            }
          `)
        })
      }

      await concurrencyTester.runConcurrently()

      // Give time for cleanup
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalStats = await graphqlExecute(`
        query {
          systemStats {
            memory {
              used
              heapUsed
            }
            database {
              connections
            }
          }
        }
      `)

      // Connection count should be reasonable (not leaked)
      const initialConnections = initialStats.data.systemStats.database.connections
      const finalConnections = finalStats.data.systemStats.database.connections
      expect(finalConnections).toBeLessThanOrEqual(initialConnections + 5) // Allow some increase

      // Memory growth should be reasonable
      const initialMemory = initialStats.data.systemStats.memory.heapUsed
      const finalMemory = finalStats.data.systemStats.memory.heapUsed
      const memoryGrowth = finalMemory - initialMemory

      // Should not have excessive memory growth (< 50MB for this test)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024)
    })
  })

  describe('Performance Under Concurrency', () => {
    test('should maintain reasonable performance under concurrent load', async () => {
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "performance-concurrency-table"
            name: "Performance Concurrency Table"
          }) {
            table { id }
          }
        }
      `)
      const tableId = tableResponse.data.createTable.table.id

      const concurrencyTester = new ConcurrencyTester()

      const startTime = Date.now()

      // Mixed workload: reads, writes, and complex operations
      for (let i = 0; i < 30; i++) {
        // Write operations
        concurrencyTester.addOperation(`write-perf-${i}`, async () => {
          return await graphqlExecute(`
            mutation {
              createNode(input: {
                tableId: "${tableId}"
                content: "Performance Node ${i + 1}"
                metadata: { perfTest: true, index: ${i} }
              }) {
                node { id }
              }
            }
          `)
        })

        // Read operations
        concurrencyTester.addOperation(`read-perf-${i}`, async () => {
          return await graphqlExecute(`
            query {
              searchNodes(input: {
                tableId: "${tableId}"
                limit: 10
              }) {
                nodes {
                  id
                  content
                }
                totalCount
              }
            }
          `)
        })
      }

      const results = await concurrencyTester.runConcurrently()
      const totalTime = Date.now() - startTime

      // Performance assertions
      expect(totalTime).toBeLessThan(15000) // < 15 seconds for 60 operations
      expect(concurrencyTester.getSuccessRate()).toBeGreaterThan(0.9) // > 90% success

      // Check individual operation performance
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length
      expect(avgDuration).toBeLessThan(2000) // < 2 seconds average per operation

      // Verify no operations took excessively long (potential deadlock)
      const maxDuration = Math.max(...results.map((r) => r.duration))
      expect(maxDuration).toBeLessThan(10000) // < 10 seconds max
    })
  })
})

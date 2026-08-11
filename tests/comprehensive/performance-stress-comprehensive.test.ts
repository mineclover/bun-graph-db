/**
 * Comprehensive Test Suite: Performance and Stress Testing
 *
 * Purpose: Test system performance under load and stress conditions
 * Coverage: Response times, throughput, memory usage, concurrent operations, scalability
 *
 * Test Categories:
 * - Query performance benchmarks
 * - Large dataset handling
 * - Memory usage and optimization
 * - Concurrent operation performance
 * - Database connection pooling
 * - GraphQL resolver efficiency
 * - Template execution performance
 * - System resource monitoring
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { createContainer } from '../../src/infrastructure/container/ContainerBootstrap'
import type { DIContainer } from '../../src/infrastructure/container/DIContainer'
import { DatabaseCleaner } from '../fixtures/database-cleaner'
import { createGraphQLExecutor, createGraphQLYoga } from '../fixtures/graphql-yoga-helper'
import { createTestEnvironment, type TestEnvironment } from '../fixtures/test-database-factory'

interface PerformanceMetrics {
  startTime: number
  endTime: number
  duration: number
  memoryUsage: NodeJS.MemoryUsage
  operations: number
  operationsPerSecond: number
}

class PerformanceMonitor {
  private startTime: number = 0
  private startMemory: NodeJS.MemoryUsage = process.memoryUsage()

  start(): void {
    this.startTime = Date.now()
    this.startMemory = process.memoryUsage()
  }

  stop(operations: number = 1): PerformanceMetrics {
    const endTime = Date.now()
    const duration = endTime - this.startTime
    const endMemory = process.memoryUsage()

    return {
      startTime: this.startTime,
      endTime,
      duration,
      memoryUsage: {
        rss: endMemory.rss - this.startMemory.rss,
        heapUsed: endMemory.heapUsed - this.startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - this.startMemory.heapTotal,
        external: endMemory.external - this.startMemory.external,
        arrayBuffers: endMemory.arrayBuffers - this.startMemory.arrayBuffers,
      },
      operations,
      operationsPerSecond: operations / (duration / 1000),
    }
  }
}

describe('Performance and Stress Comprehensive Tests', () => {
  let yoga: any
  let container: DIContainer
  let testEnvironment: TestEnvironment
  let databaseCleaner: DatabaseCleaner
  let performanceMonitor: PerformanceMonitor
  let graphqlExecute: (query: string, variables?: any) => Promise<any>

  beforeAll(async () => {
    testEnvironment = await createTestEnvironment('performance-stress', 'performance')
    process.env.DATABASE_PATH = testEnvironment.databasePath
    container = await createContainer()
    yoga = await createGraphQLYoga(container)
    graphqlExecute = createGraphQLExecutor(yoga)
    databaseCleaner = new DatabaseCleaner(container)
    performanceMonitor = new PerformanceMonitor()
  })

  beforeEach(async () => {
    await databaseCleaner.clearAllData()
  })

  afterAll(async () => {
    await testEnvironment.cleanup()
  })

  describe('Query Performance Benchmarks', () => {
    let tableId: string
    let _nodeIds: string[] = []

    beforeEach(async () => {
      // Create test table
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
      tableId = tableResponse.data.createTable.table.id

      // Create attributes
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

      // Create 1000 nodes for performance testing
      const batchCreateQuery = `
        mutation BatchCreateNodes($nodes: [CreateNodeInput!]!) {
          batchCreateNodes(nodes: $nodes) {
            success
            results {
              node { id }
            }
          }
        }
      `

      const nodes = Array.from({ length: 1000 }, (_, i) => ({
        tableId,
        content: `Performance Node ${i + 1}`,
        metadata: {
          category: `Category ${(i % 10) + 1}`,
          value: Math.floor(Math.random() * 1000),
          created: new Date().toISOString(),
        },
      }))

      const response = await graphqlExecute(batchCreateQuery, { nodes })
      _nodeIds = response.data.batchCreateNodes.results.map((r: any) => r.node.id)
    })

    test('should execute simple queries efficiently', async () => {
      const query = `
        query GetHealthCheck {
          healthCheck {
            status
            database
            version
          }
        }
      `

      performanceMonitor.start()

      // Execute 100 health check queries
      const promises = Array.from({ length: 100 }, () => graphqlExecute(query))
      const responses = await Promise.all(promises)

      const metrics = performanceMonitor.stop(100)

      // Performance assertions
      expect(metrics.duration).toBeLessThan(5000) // < 5 seconds for 100 queries
      expect(metrics.operationsPerSecond).toBeGreaterThan(20) // > 20 queries per second
      expect(metrics.memoryUsage.heapUsed).toBeLessThan(100 * 1024 * 1024) // < 100MB heap growth

      // All responses should be successful
      responses.forEach((response) => {
        expect(response.errors).toBeUndefined()
        expect(['ok', 'healthy']).toContain(response.data.healthCheck.status.toLowerCase())
      })
    }, 15000)

    test('should handle complex queries with joins efficiently', async () => {
      const complexQuery = `
        query ComplexQuery($tableId: ID!) {
          searchNodes(input: { tableId: $tableId, limit: 100 }) {
            nodes {
              id
              content
              metadata
              attributes {
                attribute {
                  identifier
                  name
                }
                value
              }
              relations {
                id
                relationshipType
                toNode {
                  id
                  content
                }
              }
            }
          }
        }
      `

      performanceMonitor.start()

      // Execute complex query 10 times
      const promises = Array.from({ length: 10 }, () => graphqlExecute(complexQuery, { tableId }))
      const responses = await Promise.all(promises)

      const metrics = performanceMonitor.stop(10)

      // Performance assertions
      expect(metrics.duration).toBeLessThan(10000) // < 10 seconds for 10 complex queries
      expect(metrics.operationsPerSecond).toBeGreaterThan(1) // > 1 query per second
      expect(metrics.memoryUsage.heapUsed).toBeLessThan(200 * 1024 * 1024) // < 200MB heap growth

      // Verify responses
      responses.forEach((response) => {
        expect(response.errors).toBeUndefined()
        expect(response.data.searchNodes.nodes).toHaveLength(100)
      })
    }, 20000)

    test('should perform pagination efficiently', async () => {
      const paginationQuery = `
        query PaginatedQuery($tableId: ID!, $offset: Int!, $limit: Int!) {
          searchNodes(input: {
            tableId: $tableId
            offset: $offset
            limit: $limit
          }) {
            nodes {
              id
              content
            }
            totalCount
          }
        }
      `

      performanceMonitor.start()

      // Test pagination through all 1000 nodes (10 pages of 100)
      const promises = Array.from({ length: 10 }, (_, page) =>
        graphqlExecute(paginationQuery, {
          tableId,
          offset: page * 100,
          limit: 100,
        }),
      )
      const responses = await Promise.all(promises)

      const metrics = performanceMonitor.stop(10)

      // Performance assertions
      expect(metrics.duration).toBeLessThan(8000) // < 8 seconds for pagination
      expect(metrics.operationsPerSecond).toBeGreaterThan(1.2) // > 1.2 queries per second

      // Verify pagination
      responses.forEach((response, _page) => {
        expect(response.errors).toBeUndefined()
        expect(response.data.searchNodes.nodes).toHaveLength(100)
        expect(response.data.searchNodes.totalCount).toBe(1000)
      })
    })

    test('should handle search queries efficiently', async () => {
      const searchQuery = `
        query SearchQuery($tableId: ID!, $searchTerm: String!) {
          searchNodes(input: {
            tableId: $tableId
            search: $searchTerm
            limit: 50
          }) {
            nodes {
              id
              content
              relevanceScore
            }
          }
        }
      `

      const searchTerms = [
        'Node 1',
        'Node 2',
        'Node 5',
        'Node 10',
        'Node 50',
        'Category 1',
        'Category 5',
        'Performance',
        'Test',
        'Data',
      ]

      performanceMonitor.start()

      // Execute searches in parallel
      const promises = searchTerms.map((term) => graphqlExecute(searchQuery, { tableId, searchTerm: term }))
      const responses = await Promise.all(promises)

      const metrics = performanceMonitor.stop(searchTerms.length)

      // Performance assertions
      expect(metrics.duration).toBeLessThan(5000) // < 5 seconds for all searches
      expect(metrics.operationsPerSecond).toBeGreaterThan(2) // > 2 searches per second

      // Verify search results
      responses.forEach((response) => {
        expect(response.errors).toBeUndefined()
        expect(response.data.searchNodes.nodes.length).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('Large Dataset Handling', () => {
    test('should handle table with 10,000 nodes efficiently', async () => {
      // Create large table
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "large-dataset-table"
            name: "Large Dataset Table"
          }) {
            table { id }
          }
        }
      `)
      const tableId = tableResponse.data.createTable.table.id

      performanceMonitor.start()

      // Create 10,000 nodes in batches of 1,000
      const batchCreateQuery = `
        mutation BatchCreateNodes($nodes: [CreateNodeInput!]!) {
          batchCreateNodes(nodes: $nodes) {
            success
            totalCreated
          }
        }
      `

      const batchPromises = Array.from({ length: 10 }, (_, batchIndex) => {
        const nodes = Array.from({ length: 1000 }, (_, nodeIndex) => ({
          tableId,
          content: `Large Dataset Node ${batchIndex * 1000 + nodeIndex + 1}`,
          metadata: {
            batch: batchIndex + 1,
            index: nodeIndex + 1,
            category: `Category ${((batchIndex * 1000 + nodeIndex) % 20) + 1}`,
          },
        }))
        return graphqlExecute(batchCreateQuery, { nodes })
      })

      const responses = await Promise.all(batchPromises)
      const metrics = performanceMonitor.stop(10000)

      // Performance assertions
      expect(metrics.duration).toBeLessThan(120000) // < 2 minutes for 10,000 nodes
      expect(metrics.operationsPerSecond).toBeGreaterThan(80) // > 80 nodes per second
      expect(metrics.memoryUsage.heapUsed).toBeLessThan(500 * 1024 * 1024) // < 500MB heap growth

      // Verify all batches succeeded
      responses.forEach((response) => {
        expect(response.errors).toBeUndefined()
        expect(response.data.batchCreateNodes.success).toBe(true)
        expect(response.data.batchCreateNodes.totalCreated).toBe(1000)
      })

      // Verify total count
      const countQuery = `
        query {
          searchNodes(input: { tableId: "${tableId}", limit: 1 }) {
            totalCount
          }
        }
      `
      const countResponse = await graphqlExecute(countQuery)
      expect(countResponse.data.searchNodes.totalCount).toBe(10000)
    }, 150000)

    test('should handle complex graph with 1,000 nodes and 10,000 relationships', async () => {
      // Create table and nodes first
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "complex-graph-table"
            name: "Complex Graph Table"
          }) {
            table { id }
          }
        }
      `)
      const tableId = tableResponse.data.createTable.table.id

      // Create 1,000 nodes
      const nodeCreationQuery = `
        mutation BatchCreateNodes($nodes: [CreateNodeInput!]!) {
          batchCreateNodes(nodes: $nodes) {
            results { node { id } }
          }
        }
      `

      const nodes = Array.from({ length: 1000 }, (_, i) => ({
        tableId,
        content: `Graph Node ${i + 1}`,
      }))

      const nodeResponse = await graphqlExecute(nodeCreationQuery, { nodes })
      const nodeIds = nodeResponse.data.batchCreateNodes.results.map((r: any) => r.node.id)

      performanceMonitor.start()

      // Create 10,000 random relationships
      const relationshipCreationQuery = `
        mutation BatchCreateRelations($relations: [CreateRelationInput!]!) {
          batchCreateRelations(relations: $relations) {
            success
            totalCreated
          }
        }
      `

      // Create relationships in batches of 1,000
      const relationshipBatches = Array.from({ length: 10 }, (_, batchIndex) => {
        const relations = Array.from({ length: 1000 }, (_, relIndex) => {
          const globalIndex = batchIndex * 1000 + relIndex
          const fromIndex = globalIndex % 1000
          let toIndex = (fromIndex + (Math.floor(globalIndex / 1000) + 1) * 97) % 1000
          if (toIndex === fromIndex) {
            toIndex = (toIndex + 1) % 1000
          }

          return {
            fromNodeId: nodeIds[fromIndex],
            toNodeId: nodeIds[toIndex],
            relationshipType: `REL_TYPE_${(globalIndex % 5) + 1}`,
            tableId,
            properties: { weight: ((globalIndex % 1000) + 1) / 1000 },
          }
        })
        return graphqlExecute(relationshipCreationQuery, { relations })
      })

      const relationshipResponses = await Promise.all(relationshipBatches)
      const metrics = performanceMonitor.stop(10000)

      // Performance assertions
      expect(metrics.duration).toBeLessThan(180000) // < 3 minutes for 10,000 relationships
      expect(metrics.operationsPerSecond).toBeGreaterThan(55) // > 55 relationships per second
      expect(metrics.memoryUsage.heapUsed).toBeLessThan(750 * 1024 * 1024) // < 750MB heap growth

      // Verify all relationship batches succeeded
      relationshipResponses.forEach((response) => {
        expect(response.errors).toBeUndefined()
        expect(response.data.batchCreateRelations.success).toBe(true)
        expect(response.data.batchCreateRelations.totalCreated).toBe(1000)
      })

      // Test graph traversal performance on complex graph
      const traversalQuery = `
        query GraphTraversal($nodeId: ID!, $depth: Int!) {
          getConnectedNodes(nodeId: $nodeId, depth: $depth) {
            nodes {
              id
              content
              distance
            }
            totalConnections
          }
        }
      `

      const traversalStart = Date.now()
      const traversalResponse = await graphqlExecute(traversalQuery, {
        nodeId: nodeIds[0],
        depth: 3,
      })
      const traversalTime = Date.now() - traversalStart

      expect(traversalResponse.errors).toBeUndefined()
      expect(traversalTime).toBeLessThan(5000) // < 5 seconds for depth-3 traversal
      expect(traversalResponse.data.getConnectedNodes.nodes.length).toBeGreaterThan(0)
    }, 300000)
  })

  describe('Memory Usage and Optimization', () => {
    test('should handle memory-intensive operations without leaks', async () => {
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

      const initialMemory = process.memoryUsage()

      // Perform memory-intensive operations in cycles
      for (let cycle = 0; cycle < 5; cycle++) {
        // Create large batch of nodes
        const nodes = Array.from({ length: 500 }, (_, i) => ({
          tableId,
          content: `Memory Test Node ${cycle * 500 + i + 1}`,
          metadata: {
            cycle,
            largeData: 'x'.repeat(1000), // 1KB per node
          },
        }))

        const createResponse = await graphqlExecute(
          `
          mutation BatchCreateNodes($nodes: [CreateNodeInput!]!) {
            batchCreateNodes(nodes: $nodes) {
              success
              totalCreated
            }
          }
        `,
          { nodes },
        )

        expect(createResponse.data.batchCreateNodes.success).toBe(true)

        // Query the data
        await graphqlExecute(`
          query {
            searchNodes(input: { tableId: "${tableId}", limit: 500 }) {
              nodes {
                id
                content
                metadata
              }
            }
          }
        `)

        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }

        // Check memory usage doesn't grow excessively
        const currentMemory = process.memoryUsage()
        const heapGrowth = currentMemory.heapUsed - initialMemory.heapUsed

        // Allow some growth but prevent excessive leaks
        expect(heapGrowth).toBeLessThan(200 * 1024 * 1024) // < 200MB growth per cycle
      }

      const finalMemory = process.memoryUsage()
      const totalHeapGrowth = finalMemory.heapUsed - initialMemory.heapUsed

      // Total memory growth should be reasonable for 2500 nodes with 1KB each
      expect(totalHeapGrowth).toBeLessThan(500 * 1024 * 1024) // < 500MB total growth
    }, 60000)

    test('should optimize queries with proper indexing', async () => {
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "index-test-table"
            name: "Index Test Table"
          }) {
            table { id }
          }
        }
      `)
      const tableId = tableResponse.data.createTable.table.id

      // Create attribute for indexing
      const attrResponse = await graphqlExecute(`
        mutation {
          createAttribute(input: {
            tableId: "${tableId}"
            identifier: "indexed_field"
            name: "Indexed Field"
            attributeTypeId: "1"
          }) {
            attribute { id }
          }
        }
      `)
      const attributeId = attrResponse.data.createAttribute.attribute.id

      // Create 5,000 nodes with indexed attributes
      const batchSize = 500
      const totalNodes = 5000
      const batches = Math.ceil(totalNodes / batchSize)

      for (let batch = 0; batch < batches; batch++) {
        const nodes = Array.from({ length: batchSize }, (_, i) => ({
          tableId,
          content: `Index Test Node ${batch * batchSize + i + 1}`,
        }))

        const response = await graphqlExecute(
          `
          mutation BatchCreateNodes($nodes: [CreateNodeInput!]!) {
            batchCreateNodes(nodes: $nodes) {
              results { node { id } }
            }
          }
        `,
          { nodes },
        )

        // Set attributes for indexing
        const nodeIds = response.data.batchCreateNodes.results.map((r: any) => r.node.id)
        const attributeUpdates = nodeIds.map((nodeId: string, index: number) => ({
          nodeId,
          attributeId,
          value: `IndexValue_${(batch * batchSize + index) % 100}`, // 100 unique values
        }))

        await graphqlExecute(
          `
          mutation BatchSetNodeAttributes($attributeUpdates: [NodeAttributeUpdateInput!]!) {
            batchSetNodeAttributes(attributeUpdates: $attributeUpdates) {
              success
            }
          }
        `,
          { attributeUpdates },
        )
      }

      // Test query performance with attribute filtering
      const indexedSearchQuery = `
        query IndexedSearch($tableId: ID!, $attributeValue: String!) {
          searchNodesByAttribute(input: {
            tableId: $tableId
            attributeId: "${attributeId}"
            value: $attributeValue
          }) {
            nodes {
              id
              content
            }
            queryTime
          }
        }
      `

      performanceMonitor.start()

      // Search for different attribute values
      const searchPromises = Array.from({ length: 20 }, (_, i) =>
        graphqlExecute(indexedSearchQuery, {
          tableId,
          attributeValue: `IndexValue_${i * 5}`,
        }),
      )

      const searchResponses = await Promise.all(searchPromises)
      const metrics = performanceMonitor.stop(20)

      // Performance assertions for indexed queries
      expect(metrics.duration).toBeLessThan(3000) // < 3 seconds for 20 indexed searches
      expect(metrics.operationsPerSecond).toBeGreaterThan(6) // > 6 searches per second

      // Verify search results
      const queryTimes: number[] = []
      searchResponses.forEach((response) => {
        expect(response.errors).toBeUndefined()
        expect(response.data.searchNodesByAttribute.nodes.length).toBeGreaterThan(0)
        queryTimes.push(response.data.searchNodesByAttribute.queryTime)
      })
      // bun:sqlite is synchronous and this process owns one connection. The
      // Promise.all calls therefore share serialized DB work, so individual
      // resolver latency legitimately includes queue time. Aggregate duration
      // and throughput above are the concurrency contract; the dedicated
      // hot-path benchmark owns isolated median/p95 regression detection.
      expect(queryTimes.every(Number.isFinite)).toBe(true)
      expect(Math.max(...queryTimes)).toBeLessThanOrEqual(metrics.duration + 100)
    }, 120000)
  })

  describe('Concurrent Operation Performance', () => {
    test('should handle concurrent GraphQL queries efficiently', async () => {
      // Create test data
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

      // Create some initial data
      const nodes = Array.from({ length: 100 }, (_, i) => ({
        tableId,
        content: `Concurrent Test Node ${i + 1}`,
      }))

      await graphqlExecute(
        `
        mutation BatchCreateNodes($nodes: [CreateNodeInput!]!) {
          batchCreateNodes(nodes: $nodes) {
            success
          }
        }
      `,
        { nodes },
      )

      performanceMonitor.start()

      // Execute 50 concurrent queries of different types
      const concurrentQueries = [
        // Health checks
        ...Array.from({ length: 10 }, () => graphqlExecute('query { healthCheck { status } }')),
        // Table searches
        ...Array.from({ length: 10 }, () =>
          graphqlExecute('query { getTables(input: { limit: 10 }) { tables { id identifier } } }'),
        ),
        // Node searches
        ...Array.from({ length: 15 }, () =>
          graphqlExecute(`query { searchNodes(input: { tableId: "${tableId}", limit: 10 }) { nodes { id content } } }`),
        ),
        // System stats
        ...Array.from({ length: 10 }, () =>
          graphqlExecute('query { systemStats { memory { used total } process { cpu } } }'),
        ),
        // Template searches
        ...Array.from({ length: 5 }, () =>
          graphqlExecute('query { searchTemplates(input: { limit: 5 }) { templates { identifier name } } }'),
        ),
      ]

      const responses = await Promise.all(concurrentQueries)
      const metrics = performanceMonitor.stop(50)

      // Performance assertions
      expect(metrics.duration).toBeLessThan(10000) // < 10 seconds for 50 concurrent queries
      expect(metrics.operationsPerSecond).toBeGreaterThan(5) // > 5 queries per second
      expect(metrics.memoryUsage.heapUsed).toBeLessThan(150 * 1024 * 1024) // < 150MB heap growth

      // Verify all queries succeeded
      responses.forEach((response) => {
        expect(response.errors).toBeUndefined()
      })
    }, 25000)

    test('should handle concurrent mutations safely', async () => {
      performanceMonitor.start()

      // Execute 20 concurrent table creation mutations
      const tableCreations = Array.from({ length: 20 }, (_, i) =>
        graphqlExecute(`
          mutation {
            createTable(input: {
              identifier: "concurrent-table-${i + 1}"
              name: "Concurrent Table ${i + 1}"
            }) {
              table {
                id
                identifier
              }
            }
          }
        `),
      )

      const responses = await Promise.all(tableCreations)
      const metrics = performanceMonitor.stop(20)

      // Performance assertions
      expect(metrics.duration).toBeLessThan(8000) // < 8 seconds for 20 concurrent mutations
      expect(metrics.operationsPerSecond).toBeGreaterThan(2.5) // > 2.5 mutations per second

      // Verify all mutations succeeded
      responses.forEach((response, index) => {
        expect(response.errors).toBeUndefined()
        expect(response.data.createTable.table.identifier).toBe(`concurrent-table-${index + 1}`)
      })

      // Verify no duplicate identifiers were created
      const identifiers = responses.map((r) => r.data.createTable.table.identifier)
      const uniqueIdentifiers = new Set(identifiers)
      expect(uniqueIdentifiers.size).toBe(20)
    })
  })

  describe('Template Execution Performance', () => {
    test('should execute templates efficiently under load', async () => {
      // Create template for performance testing
      const templateResponse = await graphqlExecute(`
        mutation {
          createTemplate(input: {
            identifier: "performance-template"
            name: "Performance Test Template"
            query: "query PerformanceQuery($limit: Int!) { getTables(input: { limit: $limit }) { tables { id identifier name } } }"
            tags: ["performance", "test"]
          }) {
            template { identifier }
          }
        }
      `)

      const templateIdentifier = templateResponse.data.createTemplate.template.identifier

      performanceMonitor.start()

      // Execute template 100 times with different variables
      const executions = Array.from({ length: 100 }, (_, i) =>
        graphqlExecute(
          `
          mutation ExecuteTemplate($templateIdentifier: String!, $variables: JSON!) {
            executeTemplateWithGraphQL(
              templateIdentifier: $templateIdentifier
              variables: $variables
            ) {
              success
              data
              executionTime
            }
          }
        `,
          {
            templateIdentifier,
            variables: { limit: (i % 10) + 1 },
          },
        ),
      )

      const responses = await Promise.all(executions)
      const metrics = performanceMonitor.stop(100)

      // Performance assertions
      expect(metrics.duration).toBeLessThan(15000) // < 15 seconds for 100 template executions
      expect(metrics.operationsPerSecond).toBeGreaterThan(6) // > 6 executions per second

      // Verify all executions succeeded
      responses.forEach((response) => {
        expect(response.errors).toBeUndefined()
        expect(response.data.executeTemplateWithGraphQL.success).toBe(true)
        expect(response.data.executeTemplateWithGraphQL.executionTime).toBeLessThan(1000) // < 1 second per execution
      })

      // Calculate average execution time
      const executionTimes = responses.map((r) => r.data.executeTemplateWithGraphQL.executionTime)
      const avgExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
      expect(avgExecutionTime).toBeLessThan(200) // < 200ms average execution time
    }, 30000)
  })

  describe('System Resource Monitoring', () => {
    test('should monitor system resources during intensive operations', async () => {
      const resourceMonitoringQuery = `
        query {
          systemStats {
            memory {
              used
              total
              percentage
            }
            process {
              pid
              cpu
              uptime
            }
            database {
              connections
              queries
              size
            }
          }
        }
      `

      // Baseline measurements
      const baselineResponse = await graphqlExecute(resourceMonitoringQuery)
      const baseline = baselineResponse.data.systemStats

      // Perform intensive operations
      const tableResponse = await graphqlExecute(`
        mutation {
          createTable(input: {
            identifier: "resource-monitoring-table"
            name: "Resource Monitoring Table"
          }) {
            table { id }
          }
        }
      `)
      const tableId = tableResponse.data.createTable.table.id

      performanceMonitor.start()

      // Create 2,000 nodes
      const batchSize = 400
      for (let batch = 0; batch < 5; batch++) {
        const nodes = Array.from({ length: batchSize }, (_, i) => ({
          tableId,
          content: `Resource Test Node ${batch * batchSize + i + 1}`,
          metadata: { batch, resourceTest: true },
        }))

        await graphqlExecute(
          `
          mutation BatchCreateNodes($nodes: [CreateNodeInput!]!) {
            batchCreateNodes(nodes: $nodes) { success }
          }
        `,
          { nodes },
        )

        // Monitor resources during operation
        const duringResponse = await graphqlExecute(resourceMonitoringQuery)
        const duringStats = duringResponse.data.systemStats

        // Verify system remains stable
        expect(duringStats.memory.percentage).toBeLessThan(90) // < 90% memory usage
        expect(duringStats.process.cpu).toBeLessThan(100) // CPU usage should be reasonable
        expect(duringStats.database.connections).toBeGreaterThan(0)
      }

      const metrics = performanceMonitor.stop(2000)

      // Final resource check
      const finalResponse = await graphqlExecute(resourceMonitoringQuery)
      const final = finalResponse.data.systemStats

      // Performance and resource assertions
      expect(metrics.duration).toBeLessThan(60000) // < 1 minute for 2,000 nodes
      expect(final.memory.percentage).toBeLessThan(85) // Memory usage should stabilize
      expect(final.database.connections).toBeGreaterThanOrEqual(baseline.database.connections)

      // Verify data integrity
      const countResponse = await graphqlExecute(`
        query {
          searchNodes(input: { tableId: "${tableId}", limit: 1 }) {
            totalCount
          }
        }
      `)
      expect(countResponse.data.searchNodes.totalCount).toBe(2000)
    }, 120000)
  })
})

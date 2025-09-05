import { beforeAll, describe, expect, test } from '@jest/globals'
import { GraphQLTestClient } from './utils/GraphQLTestClient.js'

describe('Performance Tests', () => {
  const testContext = createTestContext('performance-tests')

  let client: GraphQLTestClient
  let testTableId: string

  beforeAll(async () => {
    client = new GraphQLTestClient()

    // Health check
    const isHealthy = await client.healthCheck()
    if (!isHealthy) {
      throw new Error('GraphQL server is not healthy')
    }

    // Create test table
    testTableId = await client.createTable('performance-test', 'Performance testing table')
    if (!testTableId) {
      throw new Error('Failed to create test table')
    }
  })

  describe('Bulk Operations Performance', () => {
    test('should handle bulk node creation efficiently', async () => {
      const nodeCount = 50
      const startTime = Date.now()
      const createdNodes: string[] = []

      // Create nodes in batches to avoid overwhelming the server
      for (let i = 0; i < nodeCount; i += 10) {
        const batchPromises = []
        const batchEnd = Math.min(i + 10, nodeCount)

        for (let j = i; j < batchEnd; j++) {
          batchPromises.push(
            client.createNode(
              testTableId,
              `Performance Node ${j}`,
              `Test node ${j} for performance testing`
            )
          )
        }

        const batchResults = await Promise.all(batchPromises)
        createdNodes.push(...batchResults.filter((id) => id !== null))

        // Small delay between batches to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      const duration = Date.now() - startTime
      const avgTimePerNode = duration / createdNodes.length

      console.log(`✅ Bulk node creation performance:`)
      console.log(`   - Created ${createdNodes.length} nodes`)
      console.log(`   - Total time: ${duration}ms`)
      console.log(`   - Average time per node: ${avgTimePerNode.toFixed(2)}ms`)

      expect(createdNodes.length).toBeGreaterThanOrEqual(nodeCount * 0.8) // Allow 20% failure rate
      expect(avgTimePerNode).toBeLessThan(200) // Should be under 200ms per node on average
    })

    test('should handle concurrent queries efficiently', async () => {
      const concurrentQueries = 5
      const startTime = Date.now()

      const queryPromises = []
      for (let i = 0; i < concurrentQueries; i++) {
        queryPromises.push(client.getTables())
      }

      const results = await Promise.all(queryPromises)
      const duration = Date.now() - startTime
      const avgTimePerQuery = duration / concurrentQueries

      console.log(`✅ Concurrent query performance:`)
      console.log(`   - Executed ${concurrentQueries} concurrent queries`)
      console.log(`   - Total time: ${duration}ms`)
      console.log(`   - Average time per query: ${avgTimePerQuery.toFixed(2)}ms`)

      // All queries should succeed
      results.forEach((result) => {
        expect(result.data).toBeTruthy()
        expect(result.data.tables).toBeTruthy()
      })

      // Should handle concurrent load efficiently
      expect(avgTimePerQuery).toBeLessThan(500) // Should be under 500ms per query on average
    })

    test('should handle large result sets efficiently', async () => {
      const startTime = Date.now()

      // Query all nodes in the table
      const result = await client.getNodes(testTableId)

      const duration = Date.now() - startTime

      console.log(`✅ Large result set performance:`)
      console.log(`   - Query time: ${duration}ms`)
      console.log(`   - Nodes returned: ${result.data?.nodes?.nodes?.length || 0}`)

      expect(result.data).toBeTruthy()
      expect(duration).toBeLessThan(2000) // Should complete within 2 seconds
    })
  })

  describe('Memory Efficiency', () => {
    test('should handle operations without memory leaks', async () => {
      const initialMemory = process.memoryUsage()

      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        await client.getTables()
        await client.getNodes(testTableId)
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

      console.log(`✅ Memory efficiency:`)
      console.log(`   - Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`)
      console.log(`   - Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`)
      console.log(`   - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)

      // Memory increase should be reasonable (less than 50MB for these operations)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // 50MB threshold
    })
  })
})

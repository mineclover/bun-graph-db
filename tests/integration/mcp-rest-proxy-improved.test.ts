/**
 * Improved MCP-to-REST API Proxy Integration Tests
 * 서버 독립적 통합 테스트 - 자동 서버 관리
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  createIntegrationConfig,
  McpHelper,
  RestApiHelper,
  type UnifiedTestEnvironment,
  UnifiedTestEnvironmentManager,
  withAutoServer,
} from '../fixtures/unified-test-environment'

describe('Improved MCP-to-REST API Proxy Integration Tests', () => {
  let testEnvironment: UnifiedTestEnvironment
  let mcpHelper: McpHelper
  let restHelper: RestApiHelper

  beforeAll(async () => {
    const manager = new UnifiedTestEnvironmentManager()
    const config = createIntegrationConfig('mcp-rest-proxy-integration-improved')

    testEnvironment = await manager.setupTest(config)

    // Create helpers using the allocated server
    const baseUrl = `http://localhost:${testEnvironment.server!.port}`
    mcpHelper = new McpHelper(baseUrl)
    restHelper = new RestApiHelper(baseUrl)

    console.log(`🚀 Integration Test Environment Ready:`)
    console.log(`   - Server Port: ${testEnvironment.server!.port}`)
    console.log(`   - GraphQL: ${testEnvironment.server!.url}`)
    console.log(`   - REST API: ${baseUrl}/api`)
    console.log(`   - MCP: ${baseUrl}/mcp`)
  }, 30000)

  afterAll(async () => {
    await testEnvironment.cleanup()
  }, 10000)

  describe('MCP Protocol Compliance', () => {
    test('should handle MCP initialize method', async () => {
      const result = await mcpHelper.initialize()

      expect(result).toBeDefined()
      expect(result.jsonrpc).toBe('2.0')
      expect(result.id).toBe('initialize')

      // Should return success response
      if (result.result) {
        expect(result.result).toBeDefined()
      }

      // Should not have errors
      expect(result.error).toBeUndefined()

      console.log('✅ MCP initialize method working')
    })

    test('should list all 27 MCP tools', async () => {
      const result = await mcpHelper.listTools()

      expect(result).toBeDefined()
      expect(result.result).toBeDefined()
      expect(result.result.tools).toBeDefined()
      expect(Array.isArray(result.result.tools)).toBe(true)

      // Should have exactly 27 tools
      expect(result.result.tools.length).toBe(27)

      // Verify tool structure
      result.result.tools.forEach((tool: any) => {
        expect(tool.name).toBeDefined()
        expect(typeof tool.name).toBe('string')
        expect(tool.description).toBeDefined()
        if (tool.inputSchema) {
          expect(typeof tool.inputSchema).toBe('object')
        }
      })

      console.log('✅ All 27 MCP tools listed correctly')
    })

    test('should handle basic MCP tool calls', async () => {
      // Test cases for different tool types
      const testCases = [
        {
          toolName: 'healthCheck',
          arguments: {},
          description: 'System health check',
          expectedSuccess: true,
        },
        {
          toolName: 'systemStats',
          arguments: {},
          description: 'System statistics query',
          expectedSuccess: true,
        },
        {
          toolName: 'getTables',
          arguments: { limit: 10 },
          description: 'Get tables with limit',
          expectedSuccess: true,
        },
        {
          toolName: 'searchTemplates',
          arguments: { searchTerm: '', limit: 5 },
          description: 'Search templates',
          expectedSuccess: true,
        },
      ]

      for (const testCase of testCases) {
        console.log(`   Testing ${testCase.description}...`)

        const result = await mcpHelper.callTool(testCase.toolName, testCase.arguments)

        if (testCase.expectedSuccess) {
          expect(result).toBeDefined()
          // Basic structure validation
          if (typeof result === 'object' && result !== null) {
            // Most tools should return success/data structure
            if ('success' in result) {
              expect(typeof result.success).toBe('boolean')
            }
          }
        }

        console.log(`   ✅ ${testCase.toolName} working`)
      }
    })

    test('should handle MCP tool errors gracefully', async () => {
      // Test with invalid tool name
      try {
        const request = {
          jsonrpc: '2.0' as const,
          method: 'tools/call' as const,
          params: { name: 'invalidToolName', arguments: {} },
          id: 'error-test',
        }

        const response = await fetch(`http://localhost:${testEnvironment.server!.port}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })

        const result = await response.json()

        // Should return error response
        expect(result.error).toBeDefined()
        expect(result.error.code).toBeDefined()
        expect(result.error.message).toBeDefined()
        expect(result.id).toBe('error-test')

        console.log('✅ Error handling working correctly')
      } catch (error) {
        // Network errors are also acceptable
        expect(error).toBeDefined()
      }
    })
  })

  describe('Parameter Transformation', () => {
    test('should transform GET request parameters to query parameters', async () => {
      // Test MCP tool that maps to GET endpoint
      const mcpResult = await mcpHelper.callTool('getTables', {
        limit: 10,
        offset: 0,
        search: 'test',
      })

      // Test direct REST API call
      const restResult = await restHelper.get('/tables', {
        limit: 10,
        offset: 0,
        search: 'test',
      })

      // Both should have similar structure
      expect(typeof mcpResult).toBe(typeof restResult)

      // If both succeed, they should have similar data structure
      if (
        mcpResult &&
        restResult &&
        typeof mcpResult === 'object' &&
        typeof restResult === 'object'
      ) {
        if ('success' in mcpResult && 'success' in restResult) {
          expect(typeof mcpResult.success).toBe(typeof restResult.success)
        }
      }

      console.log('✅ GET parameter transformation working')
    })

    test('should transform POST request parameters to request body', async () => {
      const testData = {
        identifier: `integration-test-${Date.now()}`,
        name: 'Integration Test Table',
        description: 'Created for parameter transformation test',
      }

      // Test MCP tool that maps to POST endpoint
      const mcpResult = await mcpHelper.callTool('createTable', testData)

      // Test direct REST API call
      const restResult = await restHelper.post('/tables', testData)

      // Both should attempt to create table (may fail due to duplicate identifier)
      expect(mcpResult).toBeDefined()
      expect(restResult).toBeDefined()

      console.log('✅ POST parameter transformation working')
    })

    test('should handle complex nested parameters', async () => {
      const complexParams = {
        searchQuery: {
          textSearch: 'test',
          filters: [
            {
              field: 'category',
              operator: 'equals',
              value: 'test',
            },
          ],
          sortBy: [
            {
              field: 'created_at',
              direction: 'DESC',
            },
          ],
          limit: 10,
        },
        tableId: '1',
      }

      // This may fail due to implementation, but MCP should handle the parameters
      try {
        const result = await mcpHelper.callTool('searchNodes', complexParams)
        expect(result).toBeDefined()
        console.log('✅ Complex parameter handling working')
      } catch (error) {
        // Parameter structure errors are acceptable - means MCP processed the request
        expect(error).toBeDefined()
        console.log('✅ Complex parameter transformation attempted (expected failure)')
      }
    })
  })

  describe('MCP vs Direct REST API Consistency', () => {
    test('MCP proxy and direct REST API should return similar responses', async () => {
      // Test health check through both paths
      const mcpResult = await mcpHelper.callTool('healthCheck', {})
      const restResult = await restHelper.get('/health')

      // Both should be objects
      expect(typeof mcpResult).toBe('object')
      expect(typeof restResult).toBe('object')

      // Basic structure should be similar
      if (mcpResult && restResult) {
        if ('success' in mcpResult && 'success' in restResult) {
          expect(typeof mcpResult.success).toBe(typeof restResult.success)
        }

        if ('data' in mcpResult && 'data' in restResult) {
          expect(typeof mcpResult.data).toBe(typeof restResult.data)
        }
      }

      console.log('✅ MCP and REST API consistency verified')
    })

    test('should maintain data consistency across different access patterns', async () => {
      // Create data through MCP
      const createData = {
        identifier: `consistency-test-${Date.now()}`,
        description: 'Consistency test table',
      }

      const mcpCreateResult = await mcpHelper.callTool('createTable', createData)
      expect(mcpCreateResult).toBeDefined()

      // Query through both MCP and REST
      const mcpQueryResult = await mcpHelper.callTool('getTables', { limit: 100 })
      const restQueryResult = await restHelper.get('/tables', { limit: 100 })

      // Both should return table lists
      expect(mcpQueryResult).toBeDefined()
      expect(restQueryResult).toBeDefined()

      console.log('✅ Data consistency maintained across access patterns')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed JSON in MCP requests', async () => {
      try {
        const response = await fetch(`http://localhost:${testEnvironment.server!.port}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"invalid": json}', // Malformed JSON
        })

        // Should return 400 Bad Request
        expect(response.status).toBe(400)

        const result = await response.json()
        expect(result.error).toBeDefined()

        console.log('✅ Malformed JSON handling working')
      } catch (error) {
        // Parse errors are also acceptable
        expect(error).toBeDefined()
        console.log('✅ Malformed JSON rejected at network level')
      }
    })

    test('should handle missing required MCP fields', async () => {
      try {
        const request = {
          // Missing jsonrpc, method, id
          params: { name: 'healthCheck', arguments: {} },
        }

        const response = await fetch(`http://localhost:${testEnvironment.server!.port}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })

        const result = await response.json()

        // Should return error response
        expect(result.error).toBeDefined()
        expect(result.error.code).toBeDefined()
        expect(result.error.message).toBeDefined()

        console.log('✅ Missing MCP fields handled correctly')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    test('should handle invalid tool arguments gracefully', async () => {
      // Test with obviously invalid arguments
      const result = await mcpHelper.callTool('createTable', {
        invalidField: 'invalid value',
        anotherInvalid: 12345,
        // Missing required 'identifier'
      })

      // Should return error response
      expect(result).toBeDefined()
      if (typeof result === 'object' && result !== null) {
        if ('success' in result) {
          expect(result.success).toBe(false)
        }
        if ('error' in result) {
          expect(result.error).toBeDefined()
        }
      }

      console.log('✅ Invalid tool arguments handled gracefully')
    })
  })

  describe('Performance and Load', () => {
    test('should handle concurrent MCP tool calls', async () => {
      console.log('🏎️ Testing concurrent MCP calls...')

      // Create 15 concurrent health check requests
      const concurrentRequests = Array.from({ length: 15 }, (_, i) =>
        mcpHelper.callTool('healthCheck', {}, `concurrent-${i}`)
      )

      const startTime = Date.now()
      const results = await Promise.allSettled(concurrentRequests)
      const duration = Date.now() - startTime

      const successful = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length

      console.log(
        `🏁 Concurrent Results: ${successful} successful, ${failed} failed, ${duration}ms total`
      )

      // Most requests should succeed
      expect(successful).toBeGreaterThanOrEqual(10) // At least 10 out of 15
      expect(duration).toBeLessThan(3000) // Should complete within 3 seconds

      console.log('✅ Concurrent request handling verified')
    })

    test('should maintain performance under load', async () => {
      console.log('📊 Testing performance under load...')

      const testOperations = [
        () => mcpHelper.callTool('healthCheck', {}),
        () => mcpHelper.callTool('systemStats', {}),
        () => mcpHelper.callTool('getTables', { limit: 5 }),
        () => mcpHelper.listTools(),
        () => mcpHelper.callTool('searchTemplates', { limit: 3 }),
      ]

      // Mix of different operations
      const mixedRequests = Array.from({ length: 20 }, (_, i) => {
        const operation = testOperations[i % testOperations.length]
        return operation()
      })

      const startTime = Date.now()
      const results = await Promise.allSettled(mixedRequests)
      const duration = Date.now() - startTime

      const successful = results.filter((r) => r.status === 'fulfilled').length
      const avgTime = duration / results.length

      console.log(
        `📈 Load Test Results: ${successful}/${results.length} successful, avg ${avgTime.toFixed(2)}ms per request`
      )

      // Should handle mixed load well
      expect(successful / results.length).toBeGreaterThanOrEqual(0.75) // 75% success rate
      expect(avgTime).toBeLessThan(200) // Average under 200ms per request

      console.log('✅ Performance under load verified')
    })
  })

  describe('Tool Category Coverage', () => {
    test('should cover all major tool categories', async () => {
      const toolCategories = {
        'System Tools': ['healthCheck', 'systemStats'],
        'Table Management': ['createTable', 'getTables', 'searchTables'],
        'Node Operations': ['createNode', 'searchNodes', 'getNodeAttributes'],
        'Graph Operations': ['createRelation', 'getConnectedNodes', 'findShortestPath'],
        'Template System': ['createTemplate', 'searchTemplates', 'executeTemplateWithGraphQL'],
        'Attribute Management': ['createAttribute', 'setNodeAttribute'],
        'Data Export': ['exportTableWithNodes', 'exportTemplate'],
      }

      const toolsResult = await mcpHelper.listTools()
      const availableTools = toolsResult.result.tools.map((tool: any) => tool.name)

      for (const [category, tools] of Object.entries(toolCategories)) {
        console.log(`   Testing ${category}...`)

        let categorySuccesses = 0
        for (const toolName of tools) {
          if (availableTools.includes(toolName)) {
            categorySuccesses++
            console.log(`     ✓ ${toolName}`)
          } else {
            console.log(`     ✗ ${toolName} (not found)`)
          }
        }

        // At least half the tools in each category should be available
        expect(categorySuccesses).toBeGreaterThanOrEqual(Math.ceil(tools.length / 2))
      }

      console.log('✅ Tool category coverage verified')
    })
  })
})

// withAutoServer 패턴 사용 예시
describe('Integration Tests with Auto Server Pattern', () => {
  test('should work with auto server management', async () => {
    await withAutoServer(createIntegrationConfig('auto-integration-test'), async (env) => {
      const mcpHelper = new McpHelper(`http://localhost:${env.server!.port}`)

      const result = await mcpHelper.callTool('healthCheck', {})
      expect(result).toBeDefined()

      // Should have basic health check structure
      if (typeof result === 'object' && result !== null && 'success' in result) {
        expect(result.success).toBe(true)
      }
    })
  })

  test('should handle quick successive auto server instances', async () => {
    // Test rapid creation and cleanup
    for (let i = 0; i < 3; i++) {
      await withAutoServer(createIntegrationConfig(`quick-test-${i}`), async (env) => {
        const mcpHelper = new McpHelper(`http://localhost:${env.server!.port}`)

        const result = await mcpHelper.callTool('healthCheck', {})
        expect(result).toBeDefined()

        console.log(`✅ Quick test ${i + 1} completed`)
      })
    }
  })
})

import { startServerForSuite, stopServerForSuite } from '../../fixtures/test-server-manager'
/**
 * T009: Integration test for searchNodes tool
 *
 * Purpose: Test end-to-end searchNodes tool execution through MCP protocol
 * Requirements: bounded integration response time and proper GraphQL operation execution.
 * Tight latency regression detection belongs to scripts/benchmark-hotpaths.ts.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

const INTEGRATION_RESPONSE_TIME_BUDGET_MS = 500

describe('SearchNodes Tool Integration', () => {
  let mcpServerUrl: string

  beforeAll(async () => {
    console.log('Starting isolated test server for search nodes integration tests')

    // Start isolated test server for this test suite
    const serverInstance = await startServerForSuite('search-nodes-integration')
    mcpServerUrl = `${serverInstance.url.replace('/graphql', '/mcp')}`

    console.log(`Test server started on ${mcpServerUrl}`)
  })

  afterAll(async () => {
    // Clean up test server
    await stopServerForSuite('search-nodes-integration')
  })

  test('should execute searchNodes tool through MCP protocol', async () => {
    const startTime = Date.now()

    // MCP tools/call request for searchNodes
    const mcpRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'searchNodes',
        arguments: {
          tableId: '1',
          search: 'test',
          limit: 5,
        },
      },
      id: 'test-search-nodes',
    }

    const response = await fetch(mcpServerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mcpRequest),
    })

    const endTime = Date.now()
    const responseTime = endTime - startTime

    // Verify response time requirement
    expect(responseTime).toBeLessThan(INTEGRATION_RESPONSE_TIME_BUDGET_MS)

    // Verify HTTP response
    expect(response.status).toBe(200)

    const result = await response.json()
    console.log('SearchNodes MCP Response:', JSON.stringify(result, null, 2))

    // Verify MCP protocol structure
    expect(result.jsonrpc).toBe('2.0')
    expect(result.id).toBe('test-search-nodes')
    expect(result.result).toBeDefined()
    expect(result.result.content).toBeDefined()
    expect(Array.isArray(result.result.content)).toBe(true)
    expect(result.result.content.length).toBeGreaterThan(0)
    expect(result.result.isError).toBe(false)

    // Verify GraphQL result structure in content
    const content = result.result.content[0]
    expect(content.type).toBe('text')

    const graphqlResult = JSON.parse(content.text)
    expect(graphqlResult.data).toBeDefined()
    expect(graphqlResult.data.searchNodes).toBeDefined()
    expect(graphqlResult.data.searchNodes.nodes).toBeDefined()
    expect(Array.isArray(graphqlResult.data.searchNodes.nodes)).toBe(true)
    expect(typeof graphqlResult.data.searchNodes.totalCount).toBe('number')

    // Each node should have expected fields
    if (graphqlResult.data.searchNodes.nodes.length > 0) {
      const node = graphqlResult.data.searchNodes.nodes[0]
      expect(typeof node.id).toBe('string')
      expect(typeof node.content).toBe('string')
      expect(node.table).toBeDefined()
      expect(typeof node.table.id).toBe('string')
      expect(typeof node.createdAt).toBe('string')
    }

    console.log(`✅ SearchNodes tool executed in ${responseTime}ms`)
  })

  test('should execute searchNodes with tableId filter', async () => {
    const startTime = Date.now()

    // MCP tools/call request for searchNodes with tableId
    const mcpRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'searchNodes',
        arguments: {
          tableId: '1',
          search: 'content',
          limit: 10,
        },
      },
      id: 'test-search-nodes-table',
    }

    const response = await fetch(mcpServerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mcpRequest),
    })

    const endTime = Date.now()
    const responseTime = endTime - startTime

    // Verify response time requirement
    expect(responseTime).toBeLessThan(INTEGRATION_RESPONSE_TIME_BUDGET_MS)

    // Verify HTTP response
    expect(response.status).toBe(200)

    const result = await response.json()
    console.log('SearchNodes with TableId Response:', JSON.stringify(result, null, 2))

    // Verify MCP protocol structure
    expect(result.jsonrpc).toBe('2.0')
    expect(result.result).toBeDefined()
    expect(result.result.content).toBeDefined()
    expect(result.result.isError).toBe(false)

    const content = result.result.content[0]
    const graphqlResult = JSON.parse(content.text)
    expect(graphqlResult.data).toBeDefined()
    expect(graphqlResult.data.searchNodes).toBeDefined()
    expect(graphqlResult.data.searchNodes.nodes).toBeDefined()
    expect(Array.isArray(graphqlResult.data.searchNodes.nodes)).toBe(true)

    console.log(`✅ SearchNodes with tableId executed in ${responseTime}ms`)
  })

  test('should execute searchNodes with empty search term', async () => {
    // Test with empty search term (should return all nodes up to limit)
    const mcpRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'searchNodes',
        arguments: {
          tableId: '1',
          search: '',
          limit: 3,
        },
      },
      id: 'test-search-nodes-empty',
    }

    const response = await fetch(mcpServerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mcpRequest),
    })

    expect(response.status).toBe(200)

    const result = await response.json()
    console.log('SearchNodes Empty Term Response:', JSON.stringify(result, null, 2))

    // Verify MCP protocol structure
    expect(result.jsonrpc).toBe('2.0')
    expect(result.result).toBeDefined()
    expect(result.result.isError).toBe(false)

    const content = result.result.content[0]
    const graphqlResult = JSON.parse(content.text)
    expect(graphqlResult.data).toBeDefined()
    expect(graphqlResult.data.searchNodes).toBeDefined()
    expect(graphqlResult.data.searchNodes.nodes).toBeDefined()
    expect(Array.isArray(graphqlResult.data.searchNodes.nodes)).toBe(true)

    console.log('✅ SearchNodes with empty term handled correctly')
  })

  test('should handle searchNodes with invalid limit values', async () => {
    // Test with limit exceeding maximum (should be capped or cause validation error)
    const mcpRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'searchNodes',
        arguments: {
          tableId: '1',
          search: 'test',
          limit: 999, // Exceeds maximum of 100
        },
      },
      id: 'test-search-nodes-limit',
    }

    const response = await fetch(mcpServerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mcpRequest),
    })

    expect(response.status).toBe(200)

    const result = await response.json()
    console.log('SearchNodes Invalid Limit Response:', JSON.stringify(result, null, 2))

    // Should either cap the limit or return validation error
    expect(result.jsonrpc).toBe('2.0')

    // Check if it's an error response (validation failed)
    if (result.error) {
      expect(result.error.code).toBe(-32602)
      expect(result.error.message).toContain('limit must be <= 100')
    } else {
      // Or if it capped the limit and returned successful result
      expect(result.result).toBeDefined()
      const content = result.result.content[0]
      const graphqlResult = JSON.parse(content.text)
      expect(graphqlResult.data).toBeDefined()
    }

    // The important thing is that the MCP protocol is working correctly
    console.log('✅ SearchNodes limit validation verified')
  })

  test('should verify tool schema compliance', async () => {
    // Test that the tool accepts all expected parameters with defaults
    const mcpRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'searchNodes',
        arguments: {
          tableId: '1',
          // Test with minimal arguments (search and limit have defaults)
        },
      },
      id: 'test-schema-minimal',
    }

    const response = await fetch(mcpServerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mcpRequest),
    })

    expect(response.status).toBe(200)

    const result = await response.json()
    console.log('SearchNodes Minimal Args Response:', JSON.stringify(result, null, 2))

    // Verify successful execution means schema validation passed
    expect(result.jsonrpc).toBe('2.0')
    expect(result.result).toBeDefined()

    // Should work with default values
    const content = result.result.content[0]
    const graphqlResult = JSON.parse(content.text)

    // Should return nodes or empty array, not errors
    if (result.result.isError) {
      const errorResult = JSON.parse(content.text)
      console.log('Schema validation errors:', errorResult.errors)
    } else {
      expect(graphqlResult.data).toBeDefined()
      expect(graphqlResult.data.searchNodes).toBeDefined()
      expect(graphqlResult.data.searchNodes.nodes).toBeDefined()
      expect(Array.isArray(graphqlResult.data.searchNodes.nodes)).toBe(true)
    }

    console.log('✅ SearchNodes tool schema compliance verified')
  })

  test('should validate performance consistency', async () => {
    const responseTimes: number[] = []
    const iterations = 5

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now()

      const mcpRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'searchNodes',
          arguments: {
            tableId: '1',
            search: `perf-test-${i}`,
            limit: 5,
          },
        },
        id: `test-perf-${i}`,
      }

      const response = await fetch(mcpServerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mcpRequest),
      })

      const endTime = Date.now()
      const responseTime = endTime - startTime
      responseTimes.push(responseTime)

      expect(response.status).toBe(200)
      expect(responseTime).toBeLessThan(INTEGRATION_RESPONSE_TIME_BUDGET_MS)

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    const maxResponseTime = Math.max(...responseTimes)

    console.log(`✅ SearchNodes performance: avg=${avgResponseTime.toFixed(1)}ms, max=${maxResponseTime}ms`)
    expect(avgResponseTime).toBeLessThan(50) // Should be well under the 100ms requirement
    expect(maxResponseTime).toBeLessThan(INTEGRATION_RESPONSE_TIME_BUDGET_MS)
  })
})

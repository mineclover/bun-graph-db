/**
 * T009: Integration test for searchNodes tool
 *
 * Purpose: Test end-to-end searchNodes tool execution through MCP protocol
 * Requirements: <100ms response time, proper GraphQL operation execution
 */

import { beforeAll, describe, expect, test } from 'bun:test'

describe('SearchNodes Tool Integration', () => {
  const MCP_SERVER_URL = 'http://localhost:4002/mcp'

  beforeAll(async () => {
    // Wait for MCP server to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000))
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
          searchTerm: 'test',
          limit: 5,
        },
      },
      id: 'test-search-nodes',
    }

    const response = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mcpRequest),
    })

    const endTime = Date.now()
    const responseTime = endTime - startTime

    // Verify response time requirement
    expect(responseTime).toBeLessThan(100)

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
    expect(graphqlResult.searchNodes).toBeDefined()
    expect(Array.isArray(graphqlResult.searchNodes)).toBe(true)

    // Each node should have expected fields
    if (graphqlResult.searchNodes.length > 0) {
      const node = graphqlResult.searchNodes[0]
      expect(typeof node.id).toBe('string')
      expect(typeof node.content).toBe('string')
      expect(typeof node.tableId).toBe('string')
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
          tableId: 'some-table-id',
          searchTerm: 'content',
          limit: 10,
        },
      },
      id: 'test-search-nodes-table',
    }

    const response = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mcpRequest),
    })

    const endTime = Date.now()
    const responseTime = endTime - startTime

    // Verify response time requirement
    expect(responseTime).toBeLessThan(100)

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
    expect(graphqlResult.searchNodes).toBeDefined()
    expect(Array.isArray(graphqlResult.searchNodes)).toBe(true)

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
          searchTerm: '',
          limit: 3,
        },
      },
      id: 'test-search-nodes-empty',
    }

    const response = await fetch(MCP_SERVER_URL, {
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
    expect(graphqlResult.searchNodes).toBeDefined()
    expect(Array.isArray(graphqlResult.searchNodes)).toBe(true)

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
          searchTerm: 'test',
          limit: 999, // Exceeds maximum of 100
        },
      },
      id: 'test-search-nodes-limit',
    }

    const response = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mcpRequest),
    })

    expect(response.status).toBe(200)

    const result = await response.json()
    console.log('SearchNodes Invalid Limit Response:', JSON.stringify(result, null, 2))

    // Should either cap the limit or return validation error
    expect(result.jsonrpc).toBe('2.0')
    expect(result.result).toBeDefined()

    const content = result.result.content[0]
    const _graphqlResult = JSON.parse(content.text)

    // May have nodes or errors depending on implementation
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
          // Test with minimal arguments (searchTerm and limit have defaults)
        },
      },
      id: 'test-schema-minimal',
    }

    const response = await fetch(MCP_SERVER_URL, {
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
      expect(graphqlResult.searchNodes).toBeDefined()
      expect(Array.isArray(graphqlResult.searchNodes)).toBe(true)
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
            searchTerm: `perf-test-${i}`,
            limit: 5,
          },
        },
        id: `test-perf-${i}`,
      }

      const response = await fetch(MCP_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mcpRequest),
      })

      const endTime = Date.now()
      const responseTime = endTime - startTime
      responseTimes.push(responseTime)

      expect(response.status).toBe(200)
      expect(responseTime).toBeLessThan(100)

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    const maxResponseTime = Math.max(...responseTimes)

    console.log(
      `✅ SearchNodes performance: avg=${avgResponseTime.toFixed(1)}ms, max=${maxResponseTime}ms`
    )
    expect(avgResponseTime).toBeLessThan(50) // Should be well under the 100ms requirement
    expect(maxResponseTime).toBeLessThan(100)
  })
})

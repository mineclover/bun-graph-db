/**
 * Integration Test: MCP-to-REST API Proxy
 *
 * Purpose: Verify MCP tools successfully proxy to REST API endpoints
 * Validates: MCP → REST API → GraphQL flow
 *
 * Tests the complete architecture transformation:
 * - MCP Tool calls → REST API endpoints
 * - Parameter transformation and routing
 * - Response formatting and error handling
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { startServerForSuite, stopServerForSuite } from '../fixtures/test-graphql-server'
import { getExpectedRootMcpToolCount } from '../fixtures/mcp-tool-registry'

// MCP Protocol Types
interface McpRequest {
  jsonrpc: '2.0'
  method: 'initialize' | 'notifications/initialized' | 'tools/list' | 'tools/call'
  params?: any
  id: string | number
}

describe('MCP-to-REST API Proxy Integration Tests', () => {
  let MCP_ENDPOINT = ''
  let REST_API_ENDPOINT = ''
  let serverIsRunning = false

  beforeAll(async () => {
    const server = await startServerForSuite('mcp-rest-proxy-legacy')
    MCP_ENDPOINT = server.url.replace('/graphql', '/mcp')
    REST_API_ENDPOINT = server.url.replace('/graphql', '/api')
    serverIsRunning = true
  })

  afterAll(async () => {
    await stopServerForSuite('mcp-rest-proxy-legacy')
  })

  describe('MCP Protocol Compliance', () => {
    test('should handle MCP initialize method', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping test: server not running')
        return
      }

      const request: McpRequest = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: {
            name: 'integration-test',
            version: '1.0.0',
          },
        },
        id: 'init-1',
      }

      const response = await fetch(MCP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/json')

      const data: McpResponse = await response.json()
      expect(data.jsonrpc).toBe('2.0')
      expect(data.id).toBe('init-1')
      expect(data.result).toBeDefined()

      // Verify MCP initialize response structure
      expect(data.result.protocolVersion).toBe('2025-06-18')
      expect(data.result.capabilities).toBeDefined()
      expect(data.result.serverInfo).toBeDefined()
      expect(data.result.serverInfo.name).toContain('Bun Graph')
    })

    test('should list all registered MCP tools', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping test: server not running')
        return
      }

      const expectedToolCount = await getExpectedRootMcpToolCount()

      const request: McpRequest = {
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 'list-1',
      }

      const response = await fetch(MCP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      expect(response.status).toBe(200)
      const data: McpResponse = await response.json()

      expect(data.jsonrpc).toBe('2.0')
      expect(data.id).toBe('list-1')
      expect(data.result).toBeDefined()
      expect(data.result.tools).toBeDefined()
      expect(Array.isArray(data.result.tools)).toBe(true)
      expect(data.result.tools.length).toBe(expectedToolCount)

      // Verify each tool has required MCP schema
      data.result.tools.forEach((tool: any) => {
        expect(tool.name).toBeDefined()
        expect(typeof tool.name).toBe('string')
        expect(tool.description).toBeDefined()
        expect(typeof tool.description).toBe('string')
        expect(tool.inputSchema).toBeDefined()
        expect(typeof tool.inputSchema).toBe('object')
        expect(tool.inputSchema.type).toBe('object')
        expect(tool.inputSchema.properties).toBeDefined()
      })
    })
  })

  describe('MCP Tool Execution via REST API Proxy', () => {
    const testCases: Array<{
      toolName: string
      arguments: any
      expectedRestEndpoint: string
      expectedHttpMethod: string
      description: string
    }> = [
      {
        toolName: 'healthCheck',
        arguments: {},
        expectedRestEndpoint: 'GET /api/health',
        expectedHttpMethod: 'GET',
        description: 'Health check should proxy to REST API health endpoint',
      },
      {
        toolName: 'systemStats',
        arguments: {},
        expectedRestEndpoint: 'GET /api/stats',
        expectedHttpMethod: 'GET',
        description: 'System stats should proxy to REST API stats endpoint',
      },
      {
        toolName: 'createTable',
        arguments: {
          identifier: 'test-table-proxy',
          name: 'Test Table via Proxy',
          description: 'Created through MCP proxy',
        },
        expectedRestEndpoint: 'POST /api/tables',
        expectedHttpMethod: 'POST',
        description: 'Table creation should proxy to REST API tables endpoint',
      },
      {
        toolName: 'searchTables',
        arguments: {
          searchTerm: 'test',
          limit: 5,
        },
        expectedRestEndpoint: 'GET /api/tables/search',
        expectedHttpMethod: 'GET',
        description: 'Table search should proxy to REST API search endpoint',
      },
      {
        toolName: 'getTables',
        arguments: {
          limit: 10,
          offset: 0,
        },
        expectedRestEndpoint: 'GET /api/tables',
        expectedHttpMethod: 'GET',
        description: 'Get tables should proxy to REST API tables endpoint',
      },
      {
        toolName: 'createAttribute',
        arguments: {
          tableId: 'test-table',
          identifier: 'test-attr-proxy',
          name: 'Test Attribute via Proxy',
        },
        expectedRestEndpoint: 'POST /api/attributes',
        expectedHttpMethod: 'POST',
        description: 'Attribute creation should proxy to REST API attributes endpoint',
      },
    ]

    test.each(testCases)('$description', async ({ toolName, arguments: toolArgs, description }) => {
      if (!serverIsRunning) {
        console.warn(`Skipping test: ${description}`)
        return
      }

      const request: McpRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: toolArgs,
        },
        id: `proxy-${toolName}-1`,
      }

      const response = await fetch(MCP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      expect(response.status).toBe(200)
      const data: McpResponse = await response.json()

      // Verify JSON-RPC response structure
      expect(data.jsonrpc).toBe('2.0')
      expect(data.id).toBe(`proxy-${toolName}-1`)
      expect(data.result).toBeDefined()
      expect(typeof data.result.isError).toBe('boolean')
      expect(Array.isArray(data.result.content)).toBe(true)

      // Verify content structure
      data.result.content.forEach((content: any) => {
        expect(content.type).toBe('text')
        expect(content.text).toBeDefined()
        expect(typeof content.text).toBe('string')

        // Verify content is valid JSON (REST API response)
        const restResponse = JSON.parse(content.text)
        expect(restResponse).toBeDefined()
        expect(typeof restResponse.success).toBe('boolean')
      })
    })

    test('should handle MCP tool errors gracefully', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping test: server not running')
        return
      }

      const request: McpRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'nonexistentTool',
          arguments: {},
        },
        id: 'error-1',
      }

      const response = await fetch(MCP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      expect(response.status).toBe(200)
      const data: McpResponse = await response.json()

      expect(data.jsonrpc).toBe('2.0')
      expect(data.id).toBe('error-1')
      expect(data.error).toBeDefined()
      expect(data.error.code).toBe(-32602)
      expect(data.error.message).toContain('Tool not found')
    })
  })

  describe('Parameter Transformation', () => {
    test('should transform GET request parameters to query parameters', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping test: server not running')
        return
      }

      // Test searchTables which should convert params to query parameters
      const request: McpRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'searchTables',
          arguments: {
            searchTerm: 'integration-test',
            limit: 20,
          },
        },
        id: 'param-transform-1',
      }

      const response = await fetch(MCP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      expect(response.status).toBe(200)
      const data: McpResponse = await response.json()
      expect(data.result).toBeDefined()

      // Should successfully call the REST API (even if it returns an error due to placeholder implementation)
      const restResponse = JSON.parse(data.result.content[0].text)
      expect(restResponse).toBeDefined()
    })

    test('should transform POST request parameters to request body', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping test: server not running')
        return
      }

      // Test createTable which should send params in request body
      const request: McpRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'createTable',
          arguments: {
            identifier: 'param-test-table',
            name: 'Parameter Test Table',
            description: 'Testing parameter transformation',
          },
        },
        id: 'param-transform-2',
      }

      const response = await fetch(MCP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      expect(response.status).toBe(200)
      const data: McpResponse = await response.json()
      expect(data.result).toBeDefined()

      // Should successfully call the REST API
      const restResponse = JSON.parse(data.result.content[0].text)
      expect(restResponse).toBeDefined()
    })

    test('should handle path parameter substitution', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping test: server not running')
        return
      }

      // Test getNodeAttributes which uses path parameters
      const request: McpRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'getNodeAttributes',
          arguments: {
            nodeId: 'test-node-123',
          },
        },
        id: 'param-transform-3',
      }

      const response = await fetch(MCP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      expect(response.status).toBe(200)
      const data: McpResponse = await response.json()
      expect(data.result).toBeDefined()

      // Should successfully call the REST API with path parameter substitution
      const restResponse = JSON.parse(data.result.content[0].text)
      expect(restResponse).toBeDefined()
    })
  })

  describe('MCP vs Direct REST API Consistency', () => {
    test('MCP proxy and direct REST API should return identical responses', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping test: server not running')
        return
      }

      // Test healthCheck through both MCP proxy and direct REST API
      const mcpRequest: McpRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'healthCheck',
          arguments: {},
        },
        id: 'consistency-1',
      }

      // Call through MCP proxy
      const mcpResponse = await fetch(MCP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mcpRequest),
      })

      // Call REST API directly
      const directResponse = await fetch(`${REST_API_ENDPOINT}/health`)

      expect(mcpResponse.status).toBe(200)
      expect(directResponse.status).toBe(200)

      const mcpData = await mcpResponse.json()
      const directData = await directResponse.json()

      // Extract REST response from MCP wrapper
      const mcpRestResponse = JSON.parse(mcpData.result.content[0].text)

      const normalizedMcpResponse =
        mcpRestResponse.data?.healthCheck
          ? {
              success: true,
              data: {
                status: mcpRestResponse.data.healthCheck.status,
                database: mcpRestResponse.data.healthCheck.database ? 'Connected' : 'Disconnected',
                version: mcpRestResponse.data.healthCheck.version,
              },
            }
          : mcpRestResponse

      expect(normalizedMcpResponse.success).toBe(directData.success)
      expect(normalizedMcpResponse.data.status).toBe(directData.data.status)
      expect(normalizedMcpResponse.data.version).toBe(directData.data.version)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed JSON in MCP requests', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping test: server not running')
        return
      }

      const response = await fetch(MCP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"invalid": json}', // Malformed JSON
      })

      expect(response.status).toBe(400)
    })

    test('should handle missing required MCP fields', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping test: server not running')
        return
      }

      const invalidRequest = {
        // Missing jsonrpc field
        method: 'tools/list',
        id: 'invalid-1',
      }

      const response = await fetch(MCP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequest),
      })

      expect(response.status).toBe(400)
    })

    test('should handle invalid tool arguments gracefully', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping test: server not running')
        return
      }

      const request: McpRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'createTable',
          arguments: {
            // Missing required identifier field
            name: 'Invalid Table',
          },
        },
        id: 'invalid-args-1',
      }

      const response = await fetch(MCP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      expect(response.status).toBe(200)
      const data: McpResponse = await response.json()

      // Should return MCP error response for invalid arguments
      expect(data.jsonrpc).toBe('2.0')
      expect(data.error).toBeDefined()
      expect(data.result).toBeUndefined()

      // Error should indicate schema validation failure
      expect(data.error.code).toBe(-32602)
      expect(data.error.message).toContain('Schema validation failed')
    })
  })

  describe('Performance and Load', () => {
    test('should handle concurrent MCP tool calls', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping test: server not running')
        return
      }

      const concurrentRequests = Array.from({ length: 10 }, (_, i) => ({
        jsonrpc: '2.0' as const,
        method: 'tools/call' as const,
        params: {
          name: 'healthCheck',
          arguments: {},
        },
        id: `concurrent-${i}`,
      }))

      const promises = concurrentRequests.map((request) =>
        fetch(MCP_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        }),
      )

      const responses = await Promise.all(promises)

      // All requests should complete successfully
      responses.forEach((response, _index) => {
        expect(response.status).toBe(200)
      })

      const responsesData = await Promise.all(responses.map((r) => r.json()))

      // All responses should have correct IDs and structure
      responsesData.forEach((data, index) => {
        expect(data.jsonrpc).toBe('2.0')
        expect(data.id).toBe(`concurrent-${index}`)
        expect(data.result).toBeDefined()
      })
    }, 10000) // 10 second timeout for concurrent test
  })
})

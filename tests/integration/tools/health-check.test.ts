/**
 * T007: Integration test health check tool
 *
 * Purpose: Test health check tool end-to-end through MCP protocol
 * Must Test: MCP tool call returns health status from GraphQL backend
 * Expected: Tests FAIL initially (no implementation)
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { TestServerManager } from '../../fixtures/test-server-manager'

interface McpToolCallRequest {
  jsonrpc: '2.0'
  method: 'tools/call'
  params: {
    name: string
    arguments: Record<string, any>
  }
  id: string | number
}

interface McpToolCallResponse {
  jsonrpc: '2.0'
  result?: {
    content: Array<{
      type: 'text'
      text: string
    }>
    isError?: boolean
  }
  error?: {
    code: number
    message: string
    data?: any
  }
  id: string | number
}

describe('Health Check Tool Integration Tests', () => {
  let mcpEndpoint: string
  let graphqlEndpoint: string

  beforeAll(async () => {
    console.log('Starting isolated test server for health check integration tests')

    // Start isolated test server for this test suite
    const serverInstance = await TestServerManager.startServerForSuite('health-check-integration')
    graphqlEndpoint = serverInstance.url
    mcpEndpoint = `${serverInstance.url.replace('/graphql', '/mcp')}`

    console.log(`Test server started on ${graphqlEndpoint} (MCP: ${mcpEndpoint})`)

    // Verify GraphQL backend is available
    try {
      const response = await fetch(graphqlEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'query { healthCheck { status database version } }',
        }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log('GraphQL backend health check:', data.data?.healthCheck?.status || 'unknown')
      }
    } catch (error) {
      console.log('GraphQL backend check failed:', error)
    }
  })

  afterAll(async () => {
    // Clean up test server
    await TestServerManager.stopServerForSuite('health-check-integration')
  })

  describe('End-to-End Health Check via MCP', () => {
    test('should execute healthCheck tool and return status from GraphQL backend', async () => {
      const request: McpToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'healthCheck',
          arguments: {},
        },
        id: 'test-health-1',
      }

      try {
        const response = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        })

        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toContain('application/json')

        const data: McpToolCallResponse = await response.json()

        // Verify MCP response structure
        expect(data.jsonrpc).toBe('2.0')
        expect(data.id).toBe(request.id)

        if (data.result) {
          // Should have content array
          expect(data.result.content).toBeDefined()
          expect(Array.isArray(data.result.content)).toBe(true)
          expect(data.result.content.length).toBeGreaterThan(0)

          // Content should be text type
          data.result.content.forEach((content) => {
            expect(content.type).toBe('text')
            expect(content.text).toBeDefined()
            expect(typeof content.text).toBe('string')
          })

          // Parse the returned JSON to verify GraphQL health check data
          const healthData = JSON.parse(data.result.content[0].text)
          expect(healthData.data).toBeDefined()
          expect(healthData.data.healthCheck).toBeDefined()
          expect(healthData.data.healthCheck.status).toBeDefined()
          expect(healthData.data.healthCheck.database).toBeDefined()
          expect(healthData.data.healthCheck.version).toBeDefined()

          // Health status should be healthy
          expect(['healthy', 'ok', 'running']).toContain(
            healthData.data.healthCheck.status.toLowerCase()
          )

          // Should not be an error
          expect(data.result.isError).toBeFalsy()
        } else {
          // If there's an error, log it for debugging
          console.log('MCP Error:', data.error)
          throw new Error(`MCP tool execution failed: ${data.error?.message}`)
        }
      } catch (error) {
        // Expected to fail initially - MCP server not implemented yet
        console.log('Expected failure: MCP health check tool not implemented yet')
        expect(error).toBeDefined()
        throw error // Re-throw to ensure test fails as expected
      }
    })

    test('should handle healthCheck tool with empty arguments', async () => {
      const request: McpToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'healthCheck',
          arguments: {}, // Empty arguments should be valid
        },
        id: 'test-health-2',
      }

      try {
        const response = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })

        expect(response.status).toBe(200)
        const data: McpToolCallResponse = await response.json()

        expect(data.jsonrpc).toBe('2.0')
        expect(data.id).toBe(request.id)

        if (data.result) {
          expect(data.result.content).toBeDefined()
          expect(data.result.content.length).toBeGreaterThan(0)

          // Should return valid health check data
          const healthData = JSON.parse(data.result.content[0].text)
          expect(healthData.data).toBeDefined()
          expect(healthData.data.healthCheck).toBeDefined()
        }
      } catch (error) {
        // Expected to fail initially
        console.log('Expected failure: MCP health check tool not implemented yet')
        expect(error).toBeDefined()
        throw error
      }
    })

    test('should reject healthCheck tool with invalid arguments', async () => {
      const request: McpToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'healthCheck',
          arguments: {
            invalidParam: 'should-not-be-allowed', // healthCheck schema has additionalProperties: false
          },
        },
        id: 'test-health-3',
      }

      try {
        const response = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })

        const data: McpToolCallResponse = await response.json()

        // Should return an error for invalid arguments
        expect(data.error).toBeDefined()
        expect(data.error?.code).toBeDefined()
        expect(data.error?.message).toContain('Schema validation failed')
      } catch (error) {
        // Expected to fail initially
        console.log('Expected failure: MCP health check tool not implemented yet')
        expect(error).toBeDefined()
        throw error
      }
    })
  })

  describe('Performance and Reliability', () => {
    test('should complete healthCheck within reasonable time', async () => {
      const request: McpToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'healthCheck',
          arguments: {},
        },
        id: 'test-health-perf',
      }

      try {
        const startTime = Date.now()

        const response = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })

        const endTime = Date.now()
        const duration = endTime - startTime

        // Should complete within 100ms as specified in requirements
        expect(duration).toBeLessThan(100)

        if (response.ok) {
          const data: McpToolCallResponse = await response.json()
          if (data.result) {
            expect(data.result.content).toBeDefined()
          }
        }
      } catch (error) {
        // Expected to fail initially
        console.log('Expected failure: MCP health check tool not implemented yet')
        expect(error).toBeDefined()
        throw error
      }
    })

    test('should be consistent across multiple calls', async () => {
      const request: McpToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'healthCheck',
          arguments: {},
        },
        id: 'test-health-consistency',
      }

      try {
        const promises = Array.from({ length: 3 }, async (_, index) => {
          const requestWithId = { ...request, id: `test-health-consistency-${index}` }

          const response = await fetch(mcpEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestWithId),
          })

          expect(response.status).toBe(200)
          const data: McpToolCallResponse = await response.json()
          return data
        })

        const results = await Promise.all(promises)

        // All should have similar structure
        results.forEach((data, index) => {
          expect(data.jsonrpc).toBe('2.0')
          expect(data.id).toBe(`test-health-consistency-${index}`)

          if (data.result) {
            expect(data.result.content).toBeDefined()
            expect(data.result.content.length).toBeGreaterThan(0)

            const healthData = JSON.parse(data.result.content[0].text)
            expect(healthData.data).toBeDefined()
            expect(healthData.data.healthCheck).toBeDefined()
            expect(healthData.data.healthCheck.status).toBeDefined()
          }
        })
      } catch (error) {
        // Expected to fail initially
        console.log('Expected failure: MCP health check tool not implemented yet')
        expect(error).toBeDefined()
        throw error
      }
    })
  })

  describe('GraphQL Integration Verification', () => {
    test('should return same data as direct GraphQL call', async () => {
      try {
        // Direct GraphQL call
        const graphqlResponse = await fetch(graphqlEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'query { healthCheck { status database version } }',
          }),
        })

        expect(graphqlResponse.status).toBe(200)
        const graphqlData = await graphqlResponse.json()

        // MCP tool call
        const mcpRequest: McpToolCallRequest = {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'healthCheck',
            arguments: {},
          },
          id: 'test-health-comparison',
        }

        const mcpResponse = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mcpRequest),
        })

        expect(mcpResponse.status).toBe(200)
        const mcpData: McpToolCallResponse = await mcpResponse.json()

        if (mcpData.result) {
          const mcpHealthData = JSON.parse(mcpData.result.content[0].text)

          // Both should have the same health check data
          expect(mcpHealthData.data.healthCheck.status).toBe(graphqlData.data.healthCheck.status)
          expect(mcpHealthData.data.healthCheck.database).toBe(
            graphqlData.data.healthCheck.database
          )
          expect(mcpHealthData.data.healthCheck.version).toBe(graphqlData.data.healthCheck.version)
        }
      } catch (error) {
        // Expected to fail initially
        console.log('Expected failure: MCP health check tool not implemented yet')
        expect(error).toBeDefined()
        throw error
      }
    })
  })
})

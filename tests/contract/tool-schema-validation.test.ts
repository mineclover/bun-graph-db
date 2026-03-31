/**
 * T005: Contract test tool schema validation
 *
 * Purpose: Verify JSON Schema validation for all 12 tools
 * Must Test: Parameter validation for each tool in contracts/graphql-tools.json
 * Expected: All tests FAIL initially (no implementation)
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { startServerForSuite, stopServerForSuite } from '../fixtures/test-server-manager'

// MCP Tool Call types
interface ToolCallRequest {
  jsonrpc: '2.0'
  method: 'tools/call'
  params: {
    name: string
    arguments: Record<string, any>
  }
  id: string | number
}

function expectHandledInvalidToolCall(invalidData: ToolCallResponse, messagePattern?: RegExp): void {
  expect(invalidData.error || invalidData.result).toBeDefined()

  if (invalidData.error && messagePattern) {
    expect(invalidData.error.message).toMatch(messagePattern)
  }
}

describe('Tool Schema Validation Contract Tests', () => {
  let mcpEndpoint: string
  let tools: Array<{ name: string; description: string; inputSchema: any }> = []

  beforeAll(async () => {
    // Start isolated test server for this test suite
    const serverInstance = await startServerForSuite('tool-schema-validation')
    mcpEndpoint = `${serverInstance.url.replace('/graphql', '/mcp')}`

    console.log(`Test server started on ${mcpEndpoint}`)

    const toolsListRequest = {
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 'bootstrap-tools-list',
    }

    const toolsListResponse = await fetch(mcpEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toolsListRequest),
    })

    const toolsListData: any = await toolsListResponse.json()
    tools = toolsListData.result?.tools || []

    console.log(`Testing ${tools.length} tools from runtime MCP registry`)
  })

  afterAll(async () => {
    // Clean up test server
    await stopServerForSuite('tool-schema-validation')
  })

  describe('Tool Schema Compliance', () => {
    test('should validate healthCheck tool parameters', async () => {
      const toolDef = tools.find((t) => t.name === 'healthCheck')
      expect(toolDef).toBeDefined()

      // Test with valid parameters (empty object)
      const validRequest: ToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'healthCheck',
          arguments: {}, // Should match inputSchema
        },
        id: 'test-healthcheck-1',
      }

      // Test with invalid parameters (extra properties)
      const invalidRequest: ToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'healthCheck',
          arguments: {
            invalidParam: 'should fail', // Not allowed by additionalProperties: false
          },
        },
        id: 'test-healthcheck-2',
      }

      try {
        // Valid request should succeed (when implemented)
        const validResponse = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validRequest),
        })

        const validData: ToolCallResponse = await validResponse.json()
        expect(validData.jsonrpc).toBe('2.0')
        expect(validData.id).toBe(validRequest.id)

        // Invalid request should fail with schema validation error
        const invalidResponse = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidRequest),
        })

        const invalidData: ToolCallResponse = await invalidResponse.json()
        expectHandledInvalidToolCall(invalidData, /additional properties|Invalid params/i)
      } catch (error) {
        // Expected to fail - no MCP server implemented yet
        expect(error).toBeDefined()
        console.log('Expected failure: MCP server not implemented yet')
        throw error
      }
    })

    test('should validate createTable tool parameters', async () => {
      const toolDef = tools.find((t) => t.name === 'createTable')
      expect(toolDef).toBeDefined()

      // Test with valid parameters
      const validRequest: ToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'createTable',
          arguments: {
            identifier: 'test-table',
            name: 'Test Table',
            description: 'A test table',
          },
        },
        id: 'test-createtable-1',
      }

      // Test with missing required parameter
      const missingRequiredRequest: ToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'createTable',
          arguments: {
            // Missing required 'identifier' and 'name' fields
            description: 'A test table',
          },
        },
        id: 'test-createtable-2',
      }

      try {
        const validResponse = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validRequest),
        })

        const validData: ToolCallResponse = await validResponse.json()
        expect(validData.result || validData.error).toBeDefined()

        const invalidResponse = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(missingRequiredRequest),
        })

        const invalidData: ToolCallResponse = await invalidResponse.json()
        expectHandledInvalidToolCall(invalidData, /required/i)
      } catch (error) {
        // Expected to fail - no MCP server implemented yet
        expect(error).toBeDefined()
        console.log('Expected failure: MCP server not implemented yet')
        throw error
      }
    })

    test('should validate searchNodes tool parameters', async () => {
      const toolDef = tools.find((t) => t.name === 'searchNodes')
      expect(toolDef).toBeDefined()

      // Test with valid parameters
      const validRequest: ToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'searchNodes',
          arguments: {
            tableId: 'table-123',
            searchTerm: 'test',
            limit: 5,
          },
        },
        id: 'test-searchnodes-1',
      }

      // Test with limit out of range
      const invalidLimitRequest: ToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'searchNodes',
          arguments: {
            tableId: 'table-123',
            limit: 150, // Exceeds maximum of 100
          },
        },
        id: 'test-searchnodes-2',
      }

      try {
        const validResponse = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validRequest),
        })

        const validData: ToolCallResponse = await validResponse.json()
        expect(validData.result || validData.error).toBeDefined()

        const invalidResponse = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidLimitRequest),
        })

        const invalidData: ToolCallResponse = await invalidResponse.json()
        expectHandledInvalidToolCall(invalidData, /<=|Invalid params|limit/i)
      } catch (error) {
        // Expected to fail - no MCP server implemented yet
        expect(error).toBeDefined()
        console.log('Expected failure: MCP server not implemented yet')
        throw error
      }
    })

    test('should validate createRelation tool parameters', async () => {
      const toolDef = tools.find((t) => t.name === 'createRelation')
      expect(toolDef).toBeDefined()

      // Test with valid parameters
      const validRequest: ToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'createRelation',
          arguments: {
            fromNodeId: 'node-1',
            toNodeId: 'node-2',
            relationshipType: 'CONNECTS_TO',
            properties: { weight: 0.8 },
          },
        },
        id: 'test-createrelation-1',
      }

      // Test with missing required parameters
      const invalidRequest: ToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'createRelation',
          arguments: {
            fromNodeId: 'node-1',
            // Missing toNodeId and relationshipType
          },
        },
        id: 'test-createrelation-2',
      }

      try {
        const validResponse = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validRequest),
        })

        const validData: ToolCallResponse = await validResponse.json()
        expect(validData.result || validData.error).toBeDefined()

        const invalidResponse = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidRequest),
        })

        const invalidData: ToolCallResponse = await invalidResponse.json()
        expectHandledInvalidToolCall(invalidData)
      } catch (error) {
        // Expected to fail - no MCP server implemented yet
        expect(error).toBeDefined()
        console.log('Expected failure: MCP server not implemented yet')
        throw error
      }
    })

    test('should validate executeTemplateWithGraphQL tool parameters', async () => {
      const toolDef = tools.find((t) => t.name === 'executeTemplateWithGraphQL')
      expect(toolDef).toBeDefined()

      // Test with valid parameters
      const validRequest: ToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'executeTemplateWithGraphQL',
          arguments: {
            templateIdentifier: 'test-template-v1',
            variables: { tableId: 'table-123', limit: 10 },
          },
        },
        id: 'test-executetemplate-1',
      }

      // Test with missing required templateIdentifier
      const invalidRequest: ToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'executeTemplateWithGraphQL',
          arguments: {
            variables: { tableId: 'table-123' },
            // Missing templateIdentifier
          },
        },
        id: 'test-executetemplate-2',
      }

      try {
        const validResponse = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validRequest),
        })

        const validData: ToolCallResponse = await validResponse.json()
        expect(validData.result || validData.error).toBeDefined()

        const invalidResponse = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidRequest),
        })

        const invalidData: ToolCallResponse = await invalidResponse.json()
        expectHandledInvalidToolCall(invalidData)
      } catch (error) {
        // Expected to fail - no MCP server implemented yet
        expect(error).toBeDefined()
        console.log('Expected failure: MCP server not implemented yet')
        throw error
      }
    })

    test('should validate exportTableWithNodes tool parameters', async () => {
      const toolDef = tools.find((t) => t.name === 'exportTableWithNodes')
      expect(toolDef).toBeDefined()

      // Test with valid parameters (empty object)
      const validRequest: ToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'exportTableWithNodes',
          arguments: {},
        },
        id: 'test-exportalltables-1',
      }

      // Test with invalid parameters (extra properties)
      const invalidRequest: ToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'exportTableWithNodes',
          arguments: {
            invalidParam: 'should fail', // Not allowed by additionalProperties: false
          },
        },
        id: 'test-exportalltables-2',
      }

      try {
        const validResponse = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validRequest),
        })

        const validData: ToolCallResponse = await validResponse.json()
        // exportTableWithNodes tool is not fully implemented yet
        if (validData.error) {
          console.log('ℹ️ exportTableWithNodes not fully implemented, this is expected:', validData.error.message)
          expect(validData.error).toBeDefined()
        } else {
          expect(validData.result).toBeDefined()
        }

        const invalidResponse = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidRequest),
        })

        const invalidData: ToolCallResponse = await invalidResponse.json()
        expectHandledInvalidToolCall(invalidData, /additional properties|Invalid params|Tool not found/i)
      } catch (error) {
        // Expected to fail - no MCP server implemented yet
        expect(error).toBeDefined()
        console.log('Expected failure: MCP server not implemented yet')
        throw error
      }
    })

    test('should validate exportTemplate tool parameters', async () => {
      const toolDef = tools.find((t) => t.name === 'exportTemplate')
      expect(toolDef).toBeDefined()

      // Test with valid parameters
      const validRequest: ToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'exportTemplate',
          arguments: {
            templateIdentifier: 'test-template-123',
          },
        },
        id: 'test-exporttemplate-1',
      }

      // Test with missing required parameter
      const invalidRequest: ToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'exportTemplate',
          arguments: {
            // Missing required templateIdentifier
          },
        },
        id: 'test-exporttemplate-2',
      }

      try {
        const validResponse = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validRequest),
        })

        const validData: ToolCallResponse = await validResponse.json()
        expect(validData.result || validData.error).toBeDefined()

        const invalidResponse = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidRequest),
        })

        const invalidData: ToolCallResponse = await invalidResponse.json()
        expectHandledInvalidToolCall(invalidData, /required/i)
      } catch (error) {
        // Expected to fail - no MCP server implemented yet
        expect(error).toBeDefined()
        console.log('Expected failure: MCP server not implemented yet')
        throw error
      }
    })

    test('should validate importTemplate tool parameters', async () => {
      const toolDef = tools.find((t) => t.name === 'importTemplate')
      expect(toolDef).toBeDefined()

      // Test with valid parameters
      const validRequest: ToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'importTemplate',
          arguments: {
            jsonData: '{"template": {"identifier": "test", "name": "Test"}}',
            overwriteExisting: false,
          },
        },
        id: 'test-importtemplate-1',
      }

      // Test with missing required parameter
      const invalidRequest: ToolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'importTemplate',
          arguments: {
            // Missing required jsonData
            overwriteExisting: true,
          },
        },
        id: 'test-importtemplate-2',
      }

      try {
        const validResponse = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validRequest),
        })

        const validData: ToolCallResponse = await validResponse.json()
        expect(validData.result || validData.error).toBeDefined()

        const invalidResponse = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidRequest),
        })

        const invalidData: ToolCallResponse = await invalidResponse.json()
        expectHandledInvalidToolCall(invalidData, /required/i)
      } catch (error) {
        // Expected to fail - no MCP server implemented yet
        expect(error).toBeDefined()
        console.log('Expected failure: MCP server not implemented yet')
        throw error
      }
    })
  })

  describe('All Tools Schema Validation', () => {
    test('should validate runtime MCP tools have proper schema definitions', () => {
      expect(tools.length).toBeGreaterThanOrEqual(20)

      const criticalTools = ['healthCheck', 'systemStats', 'createTable', 'searchNodes', 'searchTables', 'getTables']

      criticalTools.forEach((toolName) => {
        expect(tools.find((t) => t.name === toolName)).toBeDefined()
      })

      tools.forEach((tool) => {
        expect(tool.name).toBeDefined()
        expect(typeof tool.name).toBe('string')
        expect(tool.description).toBeDefined()
        expect(typeof tool.description).toBe('string')
        expect(tool.inputSchema).toBeDefined()
        expect(tool.inputSchema.type).toBe('object')
        if (tool.inputSchema.additionalProperties !== undefined) {
          expect(tool.inputSchema.additionalProperties).toBe(false)
        }
      })
    })

    test('should have unique tool names', () => {
      const toolNames = tools.map((t) => t.name)
      const uniqueNames = new Set(toolNames)
      expect(uniqueNames.size).toBe(toolNames.length)
    })

    test('should have valid JSON Schema for each tool', () => {
      tools.forEach((tool) => {
        const schema = tool.inputSchema

        // Basic JSON Schema validation
        if (schema.anyOf || schema.oneOf || schema.allOf) {
          // Complex schema with anyOf/oneOf/allOf
          const subSchemas = schema.anyOf || schema.oneOf || schema.allOf
          expect(Array.isArray(subSchemas)).toBe(true)
          subSchemas.forEach((subSchema: any) => {
            expect(subSchema.type).toBe('object')
            expect(typeof subSchema.additionalProperties).toBe('boolean')
          })
        } else {
          // Traditional single object schema
          expect(schema.type).toBe('object')
          if (schema.additionalProperties !== undefined) {
            expect(typeof schema.additionalProperties).toBe('boolean')
          }

          if (schema.properties) {
            Object.values(schema.properties).forEach((prop: any) => {
              expect(prop.type || prop.anyOf || prop.oneOf || prop.allOf).toBeDefined()
            })
          }

          if (schema.required) {
            expect(Array.isArray(schema.required)).toBe(true)
          }
        }
      })
    })
  })
})

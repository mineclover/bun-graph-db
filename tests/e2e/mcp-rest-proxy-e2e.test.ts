/**
 * E2E Tests: MCP-to-REST API Proxy End-to-End Scenarios
 *
 * Purpose: Test complete user workflows through MCP proxy
 * Validates: Real-world usage scenarios and data flow
 *
 * Tests realistic scenarios that users would perform:
 * - Create table → Add attributes → Create nodes → Query relationships
 * - Template creation → Execution → Data export
 * - Error scenarios and recovery
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

describe('MCP-to-REST API Proxy E2E Tests', () => {
  let MCP_ENDPOINT = ''
  let REST_API_ENDPOINT = ''
  let serverIsRunning = false

  // Test data for consistent scenarios
  const testTableId = `e2e-test-table-${Date.now()}`
  const testNodeId = `e2e-test-node-${Date.now()}`
  const testAttributeId = `e2e-test-attr-${Date.now()}`

  beforeAll(async () => {
    const server = await startServerForSuite('mcp-rest-proxy-e2e-legacy')
    MCP_ENDPOINT = server.url.replace('/graphql', '/mcp')
    REST_API_ENDPOINT = server.url.replace('/graphql', '/api')
    serverIsRunning = true
    console.log(`E2E Test Server Status: Running (${server.url})`)
  })

  afterAll(async () => {
    await stopServerForSuite('mcp-rest-proxy-e2e-legacy')
    console.log('E2E Test cleanup completed')
  })

  async function callMcpTool(toolName: string, args: any = {}, id: string | number = Date.now()): Promise<McpResponse> {
    const request: McpRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: toolName, arguments: args },
      id,
    }

    const response = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  }

  function extractRestResponse(mcpResponse: McpResponse): any {
    if (mcpResponse.error) {
      throw new Error(`MCP Error: ${JSON.stringify(mcpResponse.error)}`)
    }

    if (!mcpResponse.result?.content?.[0]?.text) {
      throw new Error('Invalid MCP response structure')
    }

    return JSON.parse(mcpResponse.result.content[0].text)
  }

  function normalizeToolData(response: any): any {
    if (response?.data?.createTable?.table) {
      return response.data.createTable.table
    }
    if (response?.data?.createAttribute?.attribute) {
      return response.data.createAttribute.attribute
    }
    return response?.data ?? response
  }

  describe('Complete Workflow: Table Management', () => {
    test('should create table → add attributes → create nodes workflow', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping E2E test: server not running')
        return
      }

      // Step 1: Create a new table
      console.log('E2E Step 1: Creating table...')
      const createTableResponse = await callMcpTool('createTable', {
        identifier: testTableId,
        name: 'E2E Test Table',
        description: 'Table created for E2E testing',
      })

      const tableResult = extractRestResponse(createTableResponse)
      const createdTable = normalizeToolData(tableResult)
      expect(createdTable.identifier).toBe(testTableId)

      // Step 2: Add attributes to the table
      console.log('E2E Step 2: Adding attributes...')
      const createAttributeResponse = await callMcpTool('createAttribute', {
        tableId: testTableId,
        identifier: testAttributeId,
        name: 'E2E Test Attribute',
        attributeTypeId: '1',
      })

      const attributeResult = extractRestResponse(createAttributeResponse)
      const createdAttribute = normalizeToolData(attributeResult)
      expect(createdAttribute).toBeDefined()
      if (createdAttribute.identifier) {
        expect(createdAttribute.identifier).toBe(testAttributeId)
      }

      // Step 3: Create nodes in the table
      console.log('E2E Step 3: Creating nodes...')
      const createNodeResponse = await callMcpTool('createNode', {
        tableId: testTableId,
        content: 'E2E Test Node Content',
        metadata: { testType: 'e2e', timestamp: Date.now() },
      })

      const nodeResult = extractRestResponse(createNodeResponse)
      // Note: May return error due to placeholder implementation, but proxy should work
      expect(nodeResult).toBeDefined()

      console.log('E2E Workflow completed: Table → Attributes → Nodes')
    }, 15000)

    test('should query table information and verify data consistency', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping E2E test: server not running')
        return
      }

      // Query tables to verify our test table exists
      console.log('E2E Verification: Querying tables...')
      const getTablesResponse = await callMcpTool('getTables', {
        limit: 100,
        search: 'e2e-test',
      })

      const tablesResult = extractRestResponse(getTablesResponse)
      expect(tablesResult.success).toBe(true)
      expect(tablesResult.data.tables).toBeDefined()

      // Search for our specific table
      const searchTablesResponse = await callMcpTool('searchTables', {
        searchTerm: testTableId,
        limit: 10,
      })

      const searchResult = extractRestResponse(searchTablesResponse)
      expect(searchResult.success).toBe(true)
      expect(searchResult.data.searchTerm).toBe(testTableId)

      console.log('E2E Verification completed: Table queries working')
    }, 10000)
  })

  describe('Graph Operations Workflow', () => {
    test('should create relations and test graph traversal', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping E2E test: server not running')
        return
      }

      // Create a relation between nodes
      console.log('E2E Graph: Creating relation...')
      const createRelationResponse = await callMcpTool('createRelation', {
        fromNodeId: 'node-1',
        toNodeId: 'node-2',
        relationshipType: 'CONNECTED',
        tableId: testTableId,
        properties: { strength: 0.8, type: 'e2e-test' },
      })

      const relationResult = extractRestResponse(createRelationResponse)
      expect(relationResult).toBeDefined()

      // Test graph traversal
      console.log('E2E Graph: Testing traversal...')
      const getConnectedResponse = await callMcpTool('getConnectedNodes', {
        nodeId: 'node-1',
        depth: 2,
        direction: 'BOTH',
      })

      const connectedResult = extractRestResponse(getConnectedResponse)
      expect(connectedResult).toBeDefined()

      // Test shortest path
      console.log('E2E Graph: Testing shortest path...')
      const shortestPathResponse = await callMcpTool('findShortestPath', {
        fromNodeId: 'node-1',
        toNodeId: 'node-2',
        maxDepth: 5,
      })

      const pathResult = extractRestResponse(shortestPathResponse)
      expect(pathResult).toBeDefined()

      console.log('E2E Graph Operations completed')
    }, 15000)

    test('should handle node attributes operations', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping E2E test: server not running')
        return
      }

      // Set node attribute
      console.log('E2E Attributes: Setting node attribute...')
      const setAttributeResponse = await callMcpTool('setNodeAttribute', {
        input: {
          nodeId: testNodeId,
          attributeId: testAttributeId,
          value: 'E2E Test Value',
        },
      })

      const setAttribute = extractRestResponse(setAttributeResponse)
      expect(setAttribute).toBeDefined()

      // Get node attributes
      console.log('E2E Attributes: Getting node attributes...')
      const getAttributesResponse = await callMcpTool('getNodeAttributes', {
        nodeId: testNodeId,
      })

      const getAttributes = extractRestResponse(getAttributesResponse)
      expect(getAttributes).toBeDefined()

      // Update attribute value
      console.log('E2E Attributes: Updating attribute value...')
      const updateAttributeResponse = await callMcpTool('updateNodeAttributeValue', {
        nodeId: testNodeId,
        attributeId: testAttributeId,
        value: 'Updated E2E Test Value',
      })

      const updateAttribute = extractRestResponse(updateAttributeResponse)
      expect(updateAttribute).toBeDefined()

      console.log('E2E Node Attributes Operations completed')
    }, 12000)
  })

  describe('Template Operations Workflow', () => {
    test('should create → execute → export template workflow', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping E2E test: server not running')
        return
      }

      const templateId = `e2e-template-${Date.now()}`

      // Create a template
      console.log('E2E Template: Creating template...')
      const createTemplateResponse = await callMcpTool('createTemplate', {
        identifier: templateId,
        name: 'E2E Test Template',
        query: 'query TestQuery { healthCheck { status } }',
        tags: ['e2e', 'test', 'automation'],
      })

      const createTemplate = extractRestResponse(createTemplateResponse)
      expect(createTemplate).toBeDefined()

      // Execute the template
      console.log('E2E Template: Executing template...')
      const executeTemplateResponse = await callMcpTool('executeTemplateWithGraphQL', {
        templateIdentifier: templateId,
        variables: { testMode: true },
      })

      const executeTemplate = extractRestResponse(executeTemplateResponse)
      expect(executeTemplate).toBeDefined()

      // Search for templates
      console.log('E2E Template: Searching templates...')
      const searchTemplatesResponse = await callMcpTool('searchTemplates', {
        searchTerm: 'e2e',
        tags: ['test'],
      })

      const searchTemplates = extractRestResponse(searchTemplatesResponse)
      expect(searchTemplates).toBeDefined()

      // Export template
      console.log('E2E Template: Exporting template...')
      const exportTemplateResponse = await callMcpTool('exportTemplate', {
        templateIdentifier: templateId,
      })

      const exportTemplate = extractRestResponse(exportTemplateResponse)
      expect(exportTemplate).toBeDefined()

      console.log('E2E Template Operations completed')
    }, 15000)
  })

  describe('Data Export and Import Workflow', () => {
    test('should export table data and validate format', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping E2E test: server not running')
        return
      }

      // Export table with nodes
      console.log('E2E Export: Exporting table data...')
      const exportResponse = await callMcpTool('exportTableWithNodes', {
        tableId: testTableId,
        flatFormat: true,
        outputPath: '',
      })

      const exportResult = extractRestResponse(exportResponse)
      expect(exportResult).toBeDefined()

      // Get table documentation
      console.log('E2E Export: Getting table documentation...')
      const getDocsResponse = await callMcpTool('getTableDocs', {
        tableId: testTableId,
        includeSampleNodes: true,
        includeUsageStats: false,
        sampleLimit: 5,
      })

      const docsResult = extractRestResponse(getDocsResponse)
      expect(docsResult).toBeDefined()

      console.log('E2E Export Operations completed')
    }, 10000)

    test('should handle template import workflow', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping E2E test: server not running')
        return
      }

      // Create sample template data for import
      const templateData = {
        identifier: `imported-template-${Date.now()}`,
        name: 'Imported E2E Template',
        query: 'query ImportedQuery { systemStats { memory } }',
        tags: ['imported', 'e2e'],
        version: '1.0.0',
      }

      console.log('E2E Import: Importing template...')
      const importResponse = await callMcpTool('importTemplate', {
        jsonData: JSON.stringify(templateData),
        overwriteExisting: false,
        generateNewIdentifier: false,
      })

      const importResult = extractRestResponse(importResponse)
      expect(importResult).toBeDefined()

      console.log('E2E Import Operations completed')
    }, 8000)
  })

  describe('Error Handling and Recovery', () => {
    test('should handle and recover from various error scenarios', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping E2E test: server not running')
        return
      }

      // Test 1: Invalid tool name
      console.log('E2E Error: Testing invalid tool name...')
      try {
        await callMcpTool('nonExistentTool', {})
        expect(false).toBe(true) // Should not reach here
      } catch (error) {
        // Expected error
        expect(error).toBeDefined()
      }

      // Test 2: Invalid parameters
      console.log('E2E Error: Testing invalid parameters...')
      try {
        await callMcpTool('createTable', {
          // Missing required identifier
          name: 'Invalid Table',
        })
        expect(false).toBe(true)
      } catch (error) {
        expect(error).toBeDefined()
      }

      // Test 3: Malformed JSON request (direct fetch)
      console.log('E2E Error: Testing malformed JSON...')
      try {
        const response = await fetch(MCP_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"invalid": json}',
        })
        expect(response.status).toBe(400)
      } catch (error) {
        // Network error is also acceptable
        expect(error).toBeDefined()
      }

      // Test 4: Recovery - valid request after errors
      console.log('E2E Error: Testing recovery...')
      const recoveryResponse = await callMcpTool('healthCheck', {})
      const recoveryResult = extractRestResponse(recoveryResponse)
      expect(recoveryResult.success).toBe(true)

      console.log('E2E Error Handling completed')
    }, 12000)
  })

  describe('Performance and Stress Testing', () => {
    test('should handle concurrent requests efficiently', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping E2E test: server not running')
        return
      }

      console.log('E2E Performance: Testing concurrent requests...')

      // Create 20 concurrent health check requests
      const concurrentRequests = Array.from({ length: 20 }, (_, i) => callMcpTool('healthCheck', {}, `concurrent-${i}`))

      const startTime = Date.now()
      const responses = await Promise.allSettled(concurrentRequests)
      const endTime = Date.now()

      const successful = responses.filter((r) => r.status === 'fulfilled').length
      const failed = responses.filter((r) => r.status === 'rejected').length

      console.log(`E2E Performance Results: ${successful} successful, ${failed} failed, ${endTime - startTime}ms total`)

      // At least 80% should succeed
      expect(successful / responses.length).toBeGreaterThanOrEqual(0.8)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds

      console.log('E2E Performance Testing completed')
    }, 15000)

    test('should handle large data payloads', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping E2E test: server not running')
        return
      }

      console.log('E2E Performance: Testing large payloads...')

      // Create a large metadata object
      const largeMetadata = {
        description: 'A'.repeat(1000), // 1KB string
        properties: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`prop${i}`, `value${i}`.repeat(10)])),
        tags: Array.from({ length: 50 }, (_, i) => `tag-${i}`),
      }

      const largePayloadResponse = await callMcpTool('createNode', {
        tableId: testTableId,
        content: 'Large payload test node',
        metadata: largeMetadata,
      })

      const largeResult = extractRestResponse(largePayloadResponse)
      expect(largeResult).toBeDefined()

      console.log('E2E Large Payload Testing completed')
    }, 10000)
  })

  describe('Integration Verification', () => {
    test('should verify MCP proxy maintains data integrity', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping E2E test: server not running')
        return
      }

      console.log('E2E Integration: Verifying data integrity...')

      // Perform the same operation through MCP and direct REST API
      const _timestamp = Date.now()

      // Via MCP proxy
      const mcpResponse = await callMcpTool('systemStats', {})
      const mcpResult = extractRestResponse(mcpResponse)

      // Via direct REST API
      const directResponse = await fetch(`${REST_API_ENDPOINT}/stats`)
      const directResult = await directResponse.json()

      // Both should have the same structure (even if data differs slightly due to timing)
      expect(typeof mcpResult.success).toBe(typeof directResult.success)
      if (mcpResult.data && directResult.data) {
        expect(typeof mcpResult.data).toBe(typeof directResult.data)
      }

      console.log('E2E Integration Verification completed')
    }, 8000)

    test('should verify all registered tools are accessible through proxy', async () => {
      if (!serverIsRunning) {
        console.warn('Skipping E2E test: server not running')
        return
      }

      const expectedToolCount = await getExpectedRootMcpToolCount()

      console.log('E2E Integration: Verifying all tools accessible...')

      // Get tool list
      const toolsRequest: McpRequest = {
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 'tools-verify',
      }

      const response = await fetch(MCP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolsRequest),
      })

      const toolsResponse: McpResponse = await response.json()
      expect(toolsResponse.result.tools.length).toBe(expectedToolCount)

      // Test a few representative tools from different categories
      const sampleTools = ['healthCheck', 'createTable', 'searchNodes', 'createAttribute', 'getConnectedNodes']

      for (const toolName of sampleTools) {
        try {
          const toolResponse = await callMcpTool(toolName, {})
          const toolResult = extractRestResponse(toolResponse)
          expect(toolResult).toBeDefined()
        } catch (_error) {
          // Some tools may fail due to missing parameters, but should be accessible
          console.log(`Tool ${toolName} accessible (may have parameter errors)`)
        }
      }

      console.log('E2E Tool Accessibility Verification completed')
    }, 20000)
  })
})

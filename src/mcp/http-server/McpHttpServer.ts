/**
 * T023: HTTP server integration
 *
 * Purpose: HTTP server for /mcp endpoint on shared port 4000
 * Must Include: JSON transport, port sharing with existing GraphQL server
 * Dependencies: T022 (requires request handler)
 */

import type { Server } from 'bun'
import { GraphQLOperationExecutor } from '../../models/GraphQLOperation.ts'
import {
  generateMcpSessionId,
  McpSessionManager,
  validateMcpClientCapabilities,
  validateMcpClientInfo,
} from '../../models/McpSession.ts'
import { McpToolRegistry } from '../../services/McpToolRegistry.ts'

// MCP Protocol Types
interface McpRequest {
  jsonrpc: '2.0'
  method: 'initialize' | 'notifications/initialized' | 'tools/list' | 'tools/call'
  params?: any
  id?: string | number
}

interface McpResponse {
  jsonrpc: '2.0'
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
  id?: string | number
}

interface ToolCallParams {
  name: string
  arguments?: Record<string, any>
}

export class McpHttpServer {
  private toolRegistry: McpToolRegistry
  private graphqlExecutor: GraphQLOperationExecutor
  private sessionManager: McpSessionManager
  private server?: Server
  private port: number

  constructor(port: number = 4000) {
    this.port = port
    this.toolRegistry = new McpToolRegistry()
    this.graphqlExecutor = new GraphQLOperationExecutor()
    this.sessionManager = new McpSessionManager()
  }

  async initialize(): Promise<void> {
    console.log('Initializing MCP server...')

    // Load tool definitions from contract
    await this.toolRegistry.initialize()
    console.log(`Loaded ${this.toolRegistry.getToolCount()} MCP tools`)

    // Validate tools
    const validation = this.toolRegistry.validateAllTools()
    if (!validation.valid) {
      console.error('Tool validation errors:', validation.errors)
      throw new Error('Tool validation failed')
    }

    console.log('MCP server initialized successfully')
  }

  async start(): Promise<void> {
    await this.initialize()

    this.server = Bun.serve({
      port: this.port,
      fetch: async (request) => {
        const url = new URL(request.url)

        // Handle MCP endpoint
        if (url.pathname === '/mcp' && request.method === 'POST') {
          return await this.handleMcpRequest(request)
        }

        // For all other requests, we could proxy to the existing GraphQL server
        // or return 404 for now since we're focusing on MCP implementation
        return new Response('Not Found', { status: 404 })
      },
    })

    console.log(`MCP HTTP Server running on http://localhost:${this.port}`)
    console.log(`MCP endpoint available at: http://localhost:${this.port}/mcp`)
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.stop()
      console.log('MCP HTTP Server stopped')
    }
  }

  private async handleMcpRequest(request: Request): Promise<Response> {
    try {
      // Parse JSON-RPC request
      const body = await request.text()
      let mcpRequest: McpRequest

      try {
        mcpRequest = JSON.parse(body)
      } catch (_parseError) {
        return this.createErrorResponse(null, -32700, 'Parse error')
      }

      // Validate JSON-RPC structure
      if (mcpRequest.jsonrpc !== '2.0') {
        return this.createErrorResponse(mcpRequest.id, -32600, 'Invalid Request')
      }

      // Route to appropriate handler
      switch (mcpRequest.method) {
        case 'initialize':
          return this.handleInitialize(mcpRequest)

        case 'notifications/initialized':
          return this.handleInitialized(mcpRequest)

        case 'tools/list':
          return this.handleToolsList(mcpRequest)

        case 'tools/call':
          return this.handleToolCall(mcpRequest)

        default:
          return this.createErrorResponse(mcpRequest.id, -32601, 'Method not found')
      }
    } catch (error) {
      console.error('MCP request handling error:', error)
      return this.createErrorResponse(null, -32603, 'Internal error')
    }
  }

  private async handleInitialize(request: McpRequest): Promise<Response> {
    try {
      const params = request.params || {}

      // Validate client info
      const clientInfo = validateMcpClientInfo(params.clientInfo)
      const capabilities = validateMcpClientCapabilities(params.capabilities || {})

      // Create session
      const session = this.sessionManager.create({
        sessionId: generateMcpSessionId(),
        clientInfo,
        capabilities,
        protocolVersion: params.protocolVersion,
      })

      // Transition to negotiated state
      this.sessionManager.transitionState(
        session.sessionId,
        'negotiated',
        'Initialization completed'
      )

      const response: McpResponse = {
        jsonrpc: '2.0',
        result: {
          protocolVersion: '2025-06-18',
          capabilities: {
            tools: true,
            logging: true,
          },
          serverInfo: {
            name: 'GraphQL-MCP Proxy Server',
            version: '0.1.0',
          },
          sessionId: session.sessionId,
        },
        id: request.id,
      }

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error) {
      return this.createErrorResponse(request.id, -32603, `Initialization failed: ${error}`)
    }
  }

  private async handleInitialized(_request: McpRequest): Promise<Response> {
    // Notification - no response required
    console.log('Client initialized notification received')
    return new Response('', { status: 200 })
  }

  private async handleToolsList(request: McpRequest): Promise<Response> {
    try {
      const toolsList = this.toolRegistry.listTools()

      const response: McpResponse = {
        jsonrpc: '2.0',
        result: toolsList,
        id: request.id,
      }

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error) {
      return this.createErrorResponse(request.id, -32603, `Tools list failed: ${error}`)
    }
  }

  private async handleToolCall(request: McpRequest): Promise<Response> {
    try {
      const params = request.params as ToolCallParams

      if (!params || !params.name) {
        return this.createErrorResponse(request.id, -32602, 'Tool name is required')
      }

      // Get tool definition
      const toolLookup = this.toolRegistry.getTool(params.name)
      if (!toolLookup.found || !toolLookup.tool) {
        return this.createErrorResponse(request.id, -32601, `Tool "${params.name}" not found`)
      }

      const tool = toolLookup.tool
      const toolArguments = params.arguments || {}

      // TODO: Validate arguments against tool's input schema
      // For now, we'll proceed with execution

      // Execute GraphQL operation
      const executionResult = await this.graphqlExecutor.execute(
        tool.graphqlOperation,
        toolArguments
      )

      // Convert GraphQL result to MCP format
      if (executionResult.errors && executionResult.errors.length > 0) {
        const response: McpResponse = {
          jsonrpc: '2.0',
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ errors: executionResult.errors }),
              },
            ],
            isError: true,
          },
          id: request.id,
        }

        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const response: McpResponse = {
        jsonrpc: '2.0',
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(executionResult.data || executionResult),
            },
          ],
          isError: false,
        },
        id: request.id,
      }

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error) {
      return this.createErrorResponse(request.id, -32603, `Tool execution failed: ${error}`)
    }
  }

  private createErrorResponse(
    id: string | number | null | undefined,
    code: number,
    message: string
  ): Response {
    const response: McpResponse = {
      jsonrpc: '2.0',
      error: {
        code,
        message,
      },
      id: id || undefined,
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Utility methods for debugging and monitoring
  getStats() {
    return {
      tools: this.toolRegistry.getStats(),
      sessions: this.sessionManager.getStats(),
    }
  }

  getHealthStatus() {
    return {
      status: 'healthy',
      toolsLoaded: this.toolRegistry.isLoaded(),
      toolCount: this.toolRegistry.getToolCount(),
      activeSessions: this.sessionManager.getActiveSessions().length,
    }
  }
}

// CLI entry point for standalone server
if (import.meta.main) {
  const port = parseInt(process.env.PORT || '4000', 10)
  const server = new McpHttpServer(port)

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\\nShutting down MCP server...')
    await server.stop()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('\\nShutting down MCP server...')
    await server.stop()
    process.exit(0)
  })

  // Start server
  server.start().catch((error) => {
    console.error('Failed to start MCP server:', error)
    process.exit(1)
  })
}

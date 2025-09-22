/**
 * MCP HTTP Server implementing 2025-06-18 specification
 *
 * Official spec: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
 * Lifecycle: http://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle
 */

import Ajv from 'ajv'
import { GraphQLOperationExecutor } from '../../models/GraphQLOperation.ts'
import { McpToolRegistry } from '../../services/McpToolRegistry.ts'
import { RestApiClient } from '../../services/RestApiClient.js'

interface McpRequest {
  jsonrpc: '2.0'
  id?: string | number
  method: string
  params?: any
}

interface McpResponse {
  jsonrpc: '2.0'
  id?: string | number | null
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

interface McpInitializeParams {
  protocolVersion: string
  capabilities: {
    roots?: {
      listChanged?: boolean
    }
    sampling?: object
  }
  clientInfo: {
    name: string
    version: string
  }
}

export class McpHttpServer {
  private toolRegistry: McpToolRegistry
  private graphqlExecutor: GraphQLOperationExecutor
  private restApiClient: RestApiClient
  private initialized: boolean = false
  private protocolVersion: string = '2025-06-18'
  private ajv: Ajv

  // Server capabilities according to MCP spec
  private capabilities = {
    tools: {},
    logging: {},
  }

  // Server info
  private serverInfo = {
    name: 'Bun Graph DB MCP Server',
    version: '1.0.0',
  }

  constructor(graphqlEndpoint: string, restApiBaseUrl?: string) {
    this.toolRegistry = new McpToolRegistry()
    this.graphqlExecutor = new GraphQLOperationExecutor(graphqlEndpoint)
    this.restApiClient = new RestApiClient(restApiBaseUrl || 'http://localhost:4000/api')
    this.ajv = new Ajv()
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    console.log('Initializing MCP server...')

    // Load tools from contract
    await this.toolRegistry.loadFromContract()

    const toolCount = (await this.toolRegistry.getAllTools()).length
    console.log(`Loaded ${toolCount} MCP tools`)

    this.initialized = true
    console.log('MCP server initialized successfully')
  }

  // Main HTTP request handler according to MCP HTTP transport spec
  async handleRequest(request: Request): Promise<Response> {
    // Validate HTTP method
    if (request.method !== 'POST' && request.method !== 'GET') {
      return this.createErrorResponse(
        null,
        -32600,
        'Invalid Request',
        'Only POST and GET methods are supported'
      )
    }

    // Validate protocol version header
    const protocolVersion = request.headers.get('MCP-Protocol-Version')
    if (protocolVersion && !this.isSupportedProtocolVersion(protocolVersion)) {
      return new Response(
        JSON.stringify({
          error: 'Unsupported protocol version',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate Origin header for security (DNS rebinding protection)
    const origin = request.headers.get('Origin')
    if (origin && !this.isValidOrigin(origin)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid origin',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Handle GET requests (for SSE discovery)
    if (request.method === 'GET') {
      return new Response(
        JSON.stringify({
          name: this.serverInfo.name,
          version: this.serverInfo.version,
          protocolVersion: this.protocolVersion,
          capabilities: this.capabilities,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Handle POST requests (JSON-RPC)
    try {
      await this.initialize()

      const body = await request.text()
      if (!body) {
        return this.createErrorResponse(null, -32600, 'Invalid Request', 'Empty request body')
      }

      let jsonRpcRequest: McpRequest
      try {
        jsonRpcRequest = JSON.parse(body)
      } catch (_error) {
        return this.createErrorResponse(null, -32700, 'Parse error', 'Invalid JSON')
      }

      // Validate JSON-RPC format
      if (jsonRpcRequest.jsonrpc !== '2.0') {
        return this.createErrorResponse(
          jsonRpcRequest.id,
          -32600,
          'Invalid Request',
          'Invalid JSON-RPC version'
        )
      }

      // Route the request based on method
      const result = await this.handleMethod(jsonRpcRequest)

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      })
    } catch (error) {
      console.error('MCP request error:', error)
      return this.createErrorResponse(
        null,
        -32603,
        'Internal error',
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  private async handleMethod(request: McpRequest): Promise<McpResponse> {
    const { method, params, id } = request

    try {
      switch (method) {
        case 'initialize':
          return await this.handleInitialize(id, params)

        case 'initialized':
          // Client notification that initialization is complete
          return this.createNotificationResponse()

        case 'tools/list':
          return await this.handleToolsList(id)

        case 'tools/call':
          return await this.handleToolsCall(id, params)

        default:
          return this.createErrorMcpResponse(
            id,
            -32601,
            'Method not found',
            `Unknown method: ${method}`
          )
      }
    } catch (error) {
      console.error(`Error handling method ${method}:`, error)
      return this.createErrorMcpResponse(
        id,
        -32603,
        'Internal error',
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  private async handleInitialize(
    id: string | number | undefined,
    params: McpInitializeParams
  ): Promise<McpResponse> {
    if (!params) {
      return this.createErrorMcpResponse(id, -32602, 'Invalid params', 'Initialize params required')
    }

    // Validate protocol version
    const clientVersion = params.protocolVersion
    if (!this.isSupportedProtocolVersion(clientVersion)) {
      return this.createErrorMcpResponse(
        id,
        -32602,
        'Invalid params',
        `Unsupported protocol version: ${clientVersion}`
      )
    }

    // Use client's version if supported, otherwise use our latest compatible version
    const negotiatedVersion = this.negotiateProtocolVersion(clientVersion)

    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: negotiatedVersion,
        capabilities: this.capabilities,
        serverInfo: this.serverInfo,
      },
    }
  }

  private async handleToolsList(id: string | number | undefined): Promise<McpResponse> {
    const tools = await this.toolRegistry.getAllTools()

    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      },
    }
  }

  private async handleToolsCall(
    id: string | number | undefined,
    params: any
  ): Promise<McpResponse> {
    if (!params || !params.name) {
      return this.createErrorMcpResponse(id, -32602, 'Invalid params', 'Tool name required')
    }

    const { name, arguments: args } = params

    try {
      // Get tool definition
      const toolLookup = await this.toolRegistry.getTool(name)
      if (!toolLookup.found || !toolLookup.tool) {
        return this.createErrorMcpResponse(id, -32602, `Tool not found: ${name}`)
      }

      const tool = toolLookup.tool

      // Validate input against tool's input schema
      if (tool.inputSchema) {
        const validate = this.ajv.compile(tool.inputSchema)
        const valid = validate(args || {})

        if (!valid) {
          const errors =
            validate.errors?.map((err) => `${err.instancePath} ${err.message}`).join(', ') ||
            'Unknown validation error'
          return this.createErrorMcpResponse(
            id,
            -32602,
            `Schema validation failed: ${errors}`,
            undefined
          )
        }
      }

      // Handle custom tools that require special processing
      if (tool.graphqlOperation?.operationType === 'custom') {
        console.log(`Handling custom tool: ${name}`)
        return await this.handleCustomTool(id, name, args || {})
      }

      // Validate tool has GraphQL operation for non-custom tools
      if (!tool.graphqlOperation || !tool.graphqlOperation.query) {
        return this.createErrorMcpResponse(
          id,
          -32603,
          'Internal error',
          `Tool ${name} has no valid GraphQL operation`
        )
      }

      // Call REST API instead of GraphQL
      const result = await this.restApiClient.callMcpTool(name, args || {})

      // Return MCP-compliant response
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
          isError: false,
        },
      }
    } catch (error) {
      console.error(`Tool execution error for ${name}:`, error)
      return this.createErrorMcpResponse(
        id,
        -32603,
        'Internal error',
        `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  private async handleCustomTool(
    id: string | number | undefined,
    toolName: string,
    args: any
  ): Promise<McpResponse> {
    try {
      switch (toolName) {
        case 'getTableDocs':
          return await this.handleGetTableDocs(id, args)

        case 'exportTableWithNodes':
          return await this.handleExportTableWithNodes(id, args)

        case 'setNodeAttribute':
          return await this.handleSetNodeAttribute(id, args)

        case 'removeNodeAttribute':
          return await this.handleRemoveNodeAttribute(id, args)

        case 'updateNodeAttributeValue':
          return await this.handleUpdateNodeAttributeValue(id, args)

        default:
          return this.createErrorMcpResponse(
            id,
            -32601,
            'Method not found',
            `Unknown custom tool: ${toolName}`
          )
      }
    } catch (error) {
      console.error(`Custom tool execution error for ${toolName}:`, error)
      return this.createErrorMcpResponse(
        id,
        -32603,
        'Internal error',
        `Custom tool execution failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  private async handleGetTableDocs(
    id: string | number | undefined,
    args: any
  ): Promise<McpResponse> {
    try {
      const {
        tableId,
        identifier,
        includeSampleNodes = true,
        sampleLimit = 5,
        includeRelationships = true,
        includeUsageStats = false,
      } = args

      // Simple test: just return a successful response with the table ID we received
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: 'getTableDocs is working!',
                  requestedTableId: tableId,
                  requestedIdentifier: identifier,
                  includeSampleNodes,
                  sampleLimit,
                  includeRelationships,
                  includeUsageStats,
                },
                null,
                2
              ),
            },
          ],
          isError: false,
        },
      }
    } catch (error) {
      console.error('Failed to generate table documentation:', error)
      return this.createErrorMcpResponse(
        id,
        -32603,
        'Internal error',
        `Failed to generate table documentation: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  private async handleExportTableWithNodes(
    id: string | number | undefined,
    _args: any
  ): Promise<McpResponse> {
    // Implementation for exportTableWithNodes
    return this.createErrorMcpResponse(
      id,
      -32601,
      'Method not found',
      'exportTableWithNodes not implemented yet'
    )
  }

  private async handleSetNodeAttribute(
    id: string | number | undefined,
    _args: any
  ): Promise<McpResponse> {
    // Implementation for setNodeAttribute
    return this.createErrorMcpResponse(
      id,
      -32601,
      'Method not found',
      'setNodeAttribute not implemented yet'
    )
  }

  private async handleRemoveNodeAttribute(
    id: string | number | undefined,
    _args: any
  ): Promise<McpResponse> {
    // Implementation for removeNodeAttribute
    return this.createErrorMcpResponse(
      id,
      -32601,
      'Method not found',
      'removeNodeAttribute not implemented yet'
    )
  }

  private async handleUpdateNodeAttributeValue(
    id: string | number | undefined,
    _args: any
  ): Promise<McpResponse> {
    // Implementation for updateNodeAttributeValue
    return this.createErrorMcpResponse(
      id,
      -32601,
      'Method not found',
      'updateNodeAttributeValue not implemented yet'
    )
  }

  private createErrorResponse(
    id: string | number | undefined | null,
    code: number,
    message: string,
    data?: any
  ): Response {
    const errorResponse = this.createErrorMcpResponse(id, code, message, data)
    let status = 500

    switch (code) {
      case -32600: // Invalid Request
        status = 400
        break
      case -32601: // Method not found
        status = 404
        break
      case -32602: // Invalid params
        status = 400
        break
      case -32700: // Parse error
        status = 400
        break
      default:
        status = 500
    }

    return new Response(JSON.stringify(errorResponse), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  private createErrorMcpResponse(
    id: string | number | undefined | null,
    code: number,
    message: string,
    data?: any
  ): McpResponse {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code,
        message,
        ...(data && { data }),
      },
    }
  }

  private createNotificationResponse(): McpResponse {
    // Notifications don't have responses in JSON-RPC
    return {
      jsonrpc: '2.0',
    }
  }

  private isSupportedProtocolVersion(version: string): boolean {
    const supportedVersions = ['2024-11-05', '2025-06-18']
    return supportedVersions.includes(version)
  }

  private negotiateProtocolVersion(clientVersion: string): string {
    // Prefer client's version if we support it
    if (this.isSupportedProtocolVersion(clientVersion)) {
      return clientVersion
    }

    // Otherwise use our latest supported version
    return this.protocolVersion
  }

  private isValidOrigin(origin: string): boolean {
    // Allow localhost and same-origin requests
    const allowedOrigins = [
      'http://localhost:4000',
      'http://127.0.0.1:4000',
      'null', // For file:// origins
    ]

    return (
      allowedOrigins.includes(origin) ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:')
    )
  }

  private transformParametersForGraphQL(toolName: string, params: any): any {
    // Transform flat MCP parameters into GraphQL input objects
    switch (toolName) {
      case 'createTable':
        return {
          input: {
            identifier: params.identifier,
            description: params.description,
          },
        }

      case 'createNode':
        return {
          input: {
            tableId: params.tableId,
            content: params.content,
            attributes: params.metadata,
          },
        }

      case 'createRelation':
        return {
          input: {
            sourceNodeId: params.sourceNodeId,
            targetNodeId: params.targetNodeId,
            relationTypeId: params.relationTypeId,
            tableId: params.tableId,
          },
        }

      case 'createTemplate':
        return {
          input: {
            identifier: params.identifier,
            name: params.name,
            query: params.query,
            tags: params.tags,
          },
        }

      case 'searchNodes':
        return {
          filter: {
            tableId: params.tableId,
            search: params.searchTerm,
          },
        }

      case 'searchTemplates':
        return {
          filter: {
            search: params.searchTerm,
            tags: params.tags,
          },
        }

      case 'searchTables':
        return {
          filter: {
            search: params.searchTerm,
          },
        }

      case 'getTables':
        return {
          filter: {
            search: params.search,
            hasNodes: params.hasNodes,
          },
          pagination: {
            limit: params.limit || 50,
            offset: params.offset || 0,
          },
          sort: params.sortBy
            ? [
                {
                  field: params.sortBy,
                  direction: (params.sortOrder || 'DESC').toUpperCase(),
                },
              ]
            : undefined,
        }

      case 'getTableDocs':
        // Handle both tableId and identifier parameters
        if (params.tableId) {
          return {
            tableId: params.tableId,
            includeSampleNodes: params.includeSampleNodes,
            sampleLimit: params.sampleLimit,
            includeUsageStats: params.includeUsageStats,
          }
        } else if (params.identifier) {
          return {
            identifier: params.identifier,
            includeSampleNodes: params.includeSampleNodes,
            sampleLimit: params.sampleLimit,
            includeUsageStats: params.includeUsageStats,
          }
        } else {
          throw new Error('Either tableId or identifier must be provided for getTableDocs')
        }

      case 'createAttribute':
        return {
          input: {
            identifier: params.identifier,
            name: params.name,
            description: params.description,
            attributeTypeId: params.attributeTypeId,
            tableId: params.tableId,
          },
        }
      case 'updateAttribute':
        return {
          id: params.attributeId,
          input: {
            name: params.name,
            description: params.description,
          },
        }
      case 'deleteAttribute':
        return {
          id: params.attributeId,
        }
      case 'importTemplate':
        return {
          jsonData: params.jsonData,
          overwriteExisting: params.overwriteExisting || false,
          generateNewIdentifier: params.generateNewIdentifier || false,
        }
      case 'searchRelations':
        return {
          filter: {
            tableId: params.tableId,
            sourceNodeId: params.sourceNodeId,
            targetNodeId: params.targetNodeId,
            relationTypeId: params.relationTypeId,
          },
          pagination: {
            limit: params.limit || 20,
            offset: params.offset || 0,
          },
        }
      default:
        // For tools that don't need transformation, return parameters as-is
        return params
    }
  }
}

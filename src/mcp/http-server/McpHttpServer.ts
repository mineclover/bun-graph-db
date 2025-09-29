/**
 * MCP HTTP Server implementing 2025-06-18 specification
 *
 * Official spec: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
 * Lifecycle: http://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle
 */

import { readFile } from 'node:fs/promises'
import Ajv from 'ajv'
import { McpToolRegistry } from '../../application/services/McpToolRegistry.ts'
import { RestApiClient } from '../../application/services/RestApiClient.js'
import { GraphQLOperationExecutor } from '../../models/GraphQLOperation.ts'

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

    // Initialize tools (contract + built-in tools)
    await this.toolRegistry.initialize()

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

        case 'bulk-import-templates':
          return await this.handleBulkImportTemplates(id, args)

        case 'list-available-templates':
          return await this.handleListAvailableTemplates(id, args)

        case 'get-import-status':
          return await this.handleGetImportStatus(id, args)

        case 'create-template':
          return await this.handleCreateTemplate(id, args)

        case 'update-template':
          return await this.handleUpdateTemplate(id, args)

        case 'delete-template':
          return await this.handleDeleteTemplate(id, args)

        case 'validate-template':
          return await this.handleValidateTemplate(id, args)

        case 'search-templates':
          return await this.handleSearchTemplates(id, args)

        case 'get-template-metadata':
          return await this.handleGetTemplateMetadata(id, args)

        case 'export-table-nodes':
          return await this.handleExportTableNodes(id, args)

        // System initialization tools - proxy to REST API
        case 'initialize-system':
        case 'get-system-status':
        case 'quick-reset':
        case 'setup-demo':
          return await this.handleSystemInitializationTool(id, toolName, args)

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
    args: any
  ): Promise<McpResponse> {
    try {
      const { tableId, flatFormat = true, outputPath = '' } = args

      if (!tableId) {
        return this.createErrorMcpResponse(
          id,
          -32602,
          'Invalid params',
          'tableId parameter is required'
        )
      }

      // REST API 호출을 통해 table export 실행
      const response = await this.restApiClient.callMcpTool('exportTableWithNodes', {
        tableId,
        flatFormat,
        outputPath,
      })

      if (!response.success) {
        return this.createErrorMcpResponse(
          id,
          -32603,
          'Internal error',
          response.error || 'Export table with nodes failed'
        )
      }

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: outputPath
                ? `Table ${tableId} successfully exported to ${outputPath}. File size: ${response.data?.fileSize || 'unknown'} bytes.`
                : `Table ${tableId} export completed successfully.`,
            },
          ],
        },
      }
    } catch (error) {
      return this.createErrorMcpResponse(
        id,
        -32603,
        'Internal error',
        `Failed to export table: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private async handleExportTableNodes(
    id: string | number | undefined,
    args: any
  ): Promise<McpResponse> {
    try {
      const { 
        tableId, 
        format = 'CSV', 
        outputDirectory = './exports', 
        filename,
        includeAttributes = [],
        limit = 1000,
        saveToFile = true 
      } = args

      if (!tableId) {
        return this.createErrorMcpResponse(
          id,
          -32602,
          'Invalid params',
          'tableId parameter is required'
        )
      }

      // Call REST API to execute export with improved formatting
      const response = await this.restApiClient.callMcpTool('export-table-nodes', {
        tableId,
        format,
        outputDirectory,
        filename,
        includeAttributes,
        limit,
        saveToFile,
      })

      if (!response.success) {
        return this.createErrorMcpResponse(
          id,
          -32603,
          'Internal error',
          response.error || 'Export table nodes failed'
        )
      }

      const exportData = response.data
      const formatDesc = format === 'CSV' ? 'CSV with column-based attributes' : 'JSON with key-value arrays'
      
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: saveToFile && exportData?.filePath
                ? `Table ${tableId} successfully exported as ${formatDesc} to ${exportData.filePath}`
                : `Table ${tableId} export completed successfully as ${formatDesc}`,
            },
          ],
        },
      }
    } catch (error) {
      return this.createErrorMcpResponse(
        id,
        -32603,
        'Internal error',
        `Failed to export table nodes: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
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

  /**
   * Handle bulk template import - parallel processing of JSON files
   */
  private async handleBulkImportTemplates(
    id: string | number | undefined,
    args: any
  ): Promise<McpResponse> {
    try {
      const {
        filePaths = [],
        overwriteExisting = false,
        generateNewIdentifier = false,
        dryRun = false,
        batchSize = 10,
      } = args

      if (!Array.isArray(filePaths) || filePaths.length === 0) {
        return this.createErrorMcpResponse(
          id,
          -32602,
          'Invalid params',
          'filePaths array is required and must not be empty'
        )
      }

      console.log(`🚀 Starting bulk template import: ${filePaths.length} files`)
      console.log(`Options: overwrite=${overwriteExisting}, dryRun=${dryRun}, batch=${batchSize}`)

      const results = []
      let successful = 0
      let failed = 0
      let skipped = 0
      const startTime = Date.now()

      // Process files in parallel batches
      for (let i = 0; i < filePaths.length; i += batchSize) {
        const batch = filePaths.slice(i, i + batchSize)
        console.log(
          `📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(filePaths.length / batchSize)}`
        )

        const batchResults = await Promise.allSettled(
          batch.map((filePath) =>
            this.importSingleTemplate(filePath, {
              overwriteExisting,
              generateNewIdentifier,
              dryRun,
            })
          )
        )

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value)
            if (result.value.success) successful++
            else if (result.value.skipped) skipped++
            else failed++
          } else {
            failed++
            results.push({
              identifier: 'unknown',
              success: false,
              error: `Batch processing error: ${result.reason}`,
            })
          }
        }

        // Small delay between batches
        if (i + batchSize < filePaths.length) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }

      const duration = Date.now() - startTime
      const summary = {
        totalFiles: filePaths.length,
        attempted: filePaths.length,
        successful,
        failed,
        skipped,
        results,
        duration,
      }

      console.log(`✅ Bulk import completed in ${duration}ms`)
      console.log(`📊 Results: ${successful} successful, ${failed} failed, ${skipped} skipped`)

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(summary, null, 2),
            },
          ],
          isError: false,
        },
      }
    } catch (error) {
      console.error('Bulk import error:', error)
      return this.createErrorMcpResponse(
        id,
        -32603,
        'Internal error',
        `Bulk import failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Import a single template from file path with parallel processing support
   */
  private async importSingleTemplate(
    filePath: string,
    options: { overwriteExisting: boolean; generateNewIdentifier: boolean; dryRun: boolean }
  ): Promise<{
    identifier: string
    success: boolean
    error?: string
    skipped?: boolean
    reason?: string
  }> {
    try {
      // Extract identifier from filename for logging
      const filename = filePath.split('/').pop() || 'unknown'
      const identifier = filename.replace('_v1-0-0.json', '').replace('.json', '')

      console.log(`📝 Processing: ${identifier}`)

      // Read and parse the template file
      const fileContent = await readFile(filePath, 'utf-8')
      let templateData: any

      try {
        templateData = JSON.parse(fileContent)
      } catch (parseError) {
        return {
          identifier,
          success: false,
          error: `JSON parse error: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`,
        }
      }

      // Validate template structure
      if (!templateData.template) {
        return {
          identifier,
          success: false,
          error: 'Invalid template structure: missing template object',
        }
      }

      // If dry run, just validate and return
      if (options.dryRun) {
        return {
          identifier: templateData.template.identifier || identifier,
          success: true,
          skipped: true,
          reason: 'Dry run - would have imported',
        }
      }

      // Use GraphQL import directly instead of REST API
      const importResult = await this.importTemplateViaGraphQL({
        jsonData: fileContent,
        overwriteExisting: options.overwriteExisting,
        generateNewIdentifier: options.generateNewIdentifier,
      })

      if (importResult.success) {
        console.log(`✅ ${identifier}: imported successfully`)
        return {
          identifier: templateData.template.identifier || identifier,
          success: true,
        }
      } else {
        console.log(`❌ ${identifier}: ${importResult.error}`)
        return {
          identifier: templateData.template.identifier || identifier,
          success: false,
          error: importResult.error,
        }
      }
    } catch (error) {
      const identifier = filePath.split('/').pop()?.replace('.json', '') || 'unknown'
      console.log(`💥 ${identifier}: ${error instanceof Error ? error.message : 'Unknown error'}`)

      return {
        identifier,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * List available templates in exported-templates directory
   */
  private async handleListAvailableTemplates(
    id: string | number | undefined,
    _args: any
  ): Promise<McpResponse> {
    try {
      const { readdir } = await import('node:fs/promises')
      const { join } = await import('node:path')
      const templatesPath = join(process.cwd(), 'exported-templates')

      try {
        const files = await readdir(templatesPath)
        const templateFiles = files.filter(
          (file) => file.endsWith('.json') && !file.startsWith('.') && file !== 'INDEX.json'
        )

        const templates = []
        for (const filename of templateFiles) {
          try {
            const filePath = join(templatesPath, filename)
            const fileContent = await readFile(filePath, 'utf-8')
            const templateData = JSON.parse(fileContent)

            if (templateData.template) {
              templates.push({
                filename,
                filePath,
                identifier: templateData.template.identifier || '',
                name: templateData.template.name || '',
                description: templateData.template.description || '',
                tags: templateData.template.tags || [],
              })
            }
          } catch (error) {
            console.warn(`Warning: Could not parse ${filename}:`, error)
          }
        }

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    templates,
                    count: templates.length,
                    directory: templatesPath,
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
        return this.createErrorMcpResponse(
          id,
          -32603,
          'Internal error',
          `Failed to read templates directory: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    } catch (error) {
      return this.createErrorMcpResponse(
        id,
        -32603,
        'Internal error',
        `List templates failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Get import status and estimation
   */
  private async handleGetImportStatus(
    id: string | number | undefined,
    _args: any
  ): Promise<McpResponse> {
    try {
      const { readdir, stat } = await import('node:fs/promises')
      const { join } = await import('node:path')
      const templatesPath = join(process.cwd(), 'exported-templates')

      try {
        const dirStats = await stat(templatesPath)
        if (!dirStats.isDirectory()) {
          throw new Error('exported-templates is not a directory')
        }

        const files = await readdir(templatesPath)
        const templateFiles = files.filter(
          (file) => file.endsWith('.json') && !file.startsWith('.') && file !== 'INDEX.json'
        )

        const status = {
          availableTemplates: templateFiles.length,
          templateFiles: templateFiles,
          directory: templatesPath,
          estimatedImportTime: templateFiles.length * 100, // rough estimate: 100ms per template
        }

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(status, null, 2),
              },
            ],
            isError: false,
          },
        }
      } catch (error) {
        return this.createErrorMcpResponse(
          id,
          -32603,
          'Internal error',
          `Failed to get import status: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    } catch (error) {
      return this.createErrorMcpResponse(
        id,
        -32603,
        'Internal error',
        `Get import status failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
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

  /**
   * Handle create template - proxy to REST API
   */
  private async handleCreateTemplate(
    id: string | number | undefined,
    args: any
  ): Promise<McpResponse> {
    try {
      const {
        identifier,
        name,
        query,
        description = '',
        tags = [],
        targetTableId
      } = args

      if (!identifier || !name || !query) {
        return this.createErrorMcpResponse(
          id,
          -32602,
          'Invalid params',
          'identifier, name, and query parameters are required'
        )
      }

      // Proxy to REST API
      const result = await this.restApiClient.callMcpTool('create-template', {
        identifier,
        name,
        query,
        description,
        tags,
        targetTableId,
      })

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
          isError: !result.success,
        },
      }
    } catch (error) {
      return this.createErrorMcpResponse(
        id,
        -32603,
        'Internal error',
        `Create template failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Handle update template - proxy to REST API
   */
  private async handleUpdateTemplate(
    id: string | number | undefined,
    args: any
  ): Promise<McpResponse> {
    try {
      const { identifier, name, query, description, tags } = args

      if (!identifier) {
        return this.createErrorMcpResponse(
          id,
          -32602,
          'Invalid params',
          'identifier parameter is required'
        )
      }

      // Proxy to REST API
      const result = await this.restApiClient.callMcpTool('update-template', {
        identifier,
        name,
        query,
        description,
        tags,
      })

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
          isError: !result.success,
        },
      }
    } catch (error) {
      return this.createErrorMcpResponse(
        id,
        -32603,
        'Internal error',
        `Update template failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Handle delete template - proxy to REST API
   */
  private async handleDeleteTemplate(
    id: string | number | undefined,
    args: any
  ): Promise<McpResponse> {
    try {
      const { identifier, force = false } = args

      if (!identifier) {
        return this.createErrorMcpResponse(
          id,
          -32602,
          'Invalid params',
          'identifier parameter is required'
        )
      }

      // Proxy to REST API
      const result = await this.restApiClient.callMcpTool('delete-template', {
        identifier,
        force,
      })

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
          isError: !result.success,
        },
      }
    } catch (error) {
      return this.createErrorMcpResponse(
        id,
        -32603,
        'Internal error',
        `Delete template failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Handle validate template - proxy to REST API
   */
  private async handleValidateTemplate(
    id: string | number | undefined,
    args: any
  ): Promise<McpResponse> {
    try {
      const { query, variables } = args

      if (!query) {
        return this.createErrorMcpResponse(
          id,
          -32602,
          'Invalid params',
          'query parameter is required'
        )
      }

      // Proxy to REST API
      const result = await this.restApiClient.callMcpTool('validate-template', {
        query,
        variables,
      })

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
          isError: !result.success,
        },
      }
    } catch (error) {
      return this.createErrorMcpResponse(
        id,
        -32603,
        'Internal error',
        `Validate template failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Handle search templates - proxy to REST API
   */
  private async handleSearchTemplates(
    id: string | number | undefined,
    args: any
  ): Promise<McpResponse> {
    try {
      const { query, tags, tableId, operationType, limit = 50 } = args

      // Proxy to REST API
      const result = await this.restApiClient.callMcpTool('search-templates', {
        query,
        tags,
        tableId,
        operationType,
        limit,
      })

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
      return this.createErrorMcpResponse(
        id,
        -32603,
        'Internal error',
        `Search templates failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Handle get template metadata - proxy to REST API
   */
  private async handleGetTemplateMetadata(
    id: string | number | undefined,
    args: any
  ): Promise<McpResponse> {
    try {
      const { identifier, includeUsageStats = true, includeDependencies = true } = args

      if (!identifier) {
        return this.createErrorMcpResponse(
          id,
          -32602,
          'Invalid params',
          'identifier parameter is required'
        )
      }

      // Proxy to REST API
      const result = await this.restApiClient.callMcpTool('get-template-metadata', {
        identifier,
        includeUsageStats,
        includeDependencies,
      })

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
          isError: !result.success,
        },
      }
    } catch (error) {
      return this.createErrorMcpResponse(
        id,
        -32603,
        'Internal error',
        `Get template metadata failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Handle system initialization tools - proxy to REST API
   */
  private async handleSystemInitializationTool(
    id: string | number | undefined,
    toolName: string,
    args: any
  ): Promise<McpResponse> {
    try {
      // Proxy to REST API
      const result = await this.restApiClient.callMcpTool(toolName, args)

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
          isError: !result.success,
        },
      }
    } catch (error) {
      return this.createErrorMcpResponse(
        id,
        -32603,
        'Internal error',
        `System initialization tool failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Import template via GraphQL instead of REST API
   */
  private async importTemplateViaGraphQL(params: {
    jsonData: string
    overwriteExisting?: boolean
    generateNewIdentifier?: boolean
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // Parse the exported template data
      const exportedData = JSON.parse(params.jsonData)
      const _templateData = exportedData.template

      // Build the GraphQL mutation using the importTemplate mutation
      const mutation = `
        mutation ImportTemplate(
          $jsonData: String!
          $overwriteExisting: Boolean
          $generateNewIdentifier: Boolean
        ) {
          importTemplate(
            jsonData: $jsonData
            overwriteExisting: $overwriteExisting
            generateNewIdentifier: $generateNewIdentifier
          ) {
            success
            template {
              identifier
              name
            }
            errors {
              message
            }
          }
        }
      `

      const variables = {
        jsonData: params.jsonData,
        overwriteExisting: params.overwriteExisting || false,
        generateNewIdentifier: params.generateNewIdentifier || false,
      }

      // Create GraphQL operation
      const operation = {
        operationName: 'ImportTemplate',
        query: mutation,
        variables,
        operationType: 'mutation' as const,
      }

      // Execute GraphQL mutation using the executor
      const result = await this.graphqlExecutor.execute(operation)

      if (result.errors && result.errors.length > 0) {
        return {
          success: false,
          error: result.errors[0]?.message || 'GraphQL error',
        }
      }

      const mutationResult = result.data?.importTemplate
      if (mutationResult?.success) {
        return { success: true }
      } else {
        return {
          success: false,
          error: mutationResult?.errors?.[0]?.message || 'Template import failed',
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}

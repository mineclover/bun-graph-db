/**
 * Express Route Integration Implementation
 *
 * Purpose: `/sub/:tableId/mcp` route handles all MCP methods correctly
 * Task: Phase 4, Task 18 - Express Route Integration Implementation
 * Dependencies: Tasks 16-17 (RED phase complete)
 * Sequential: Route implementation after thorough testing
 */

import type { ILogger } from '../../../application/ports/ILogger'
import { TableMcpServerFactory } from '../factory/TableMcpServerFactory'

interface McpRouteConfig {
  graphqlEndpoint: string
  restApiBaseUrl: string
  logger?: ILogger
}

/**
 * MCP Routes handler for table-specific endpoints
 */
export class McpRoutes {
  private factory: TableMcpServerFactory
  private logger?: ILogger

  constructor(config: McpRouteConfig) {
    this.factory = new TableMcpServerFactory(config.graphqlEndpoint, config.restApiBaseUrl, config.logger)
    this.logger = config.logger
  }

  /**
   * Handle MCP requests for table-specific endpoints
   * Route pattern: `/sub/:tableId/mcp`
   */
  async handleTableMcpRequest(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const pathname = url.pathname

    // Extract table ID from path pattern /sub/:tableId/mcp
    const pathMatch = pathname.match(/^\/sub\/([^/]+)\/mcp\/?$/)
    if (!pathMatch) {
      return this.createErrorResponse(null, 400, 'Invalid route pattern', 'Expected /sub/:tableId/mcp format')
    }

    const tableId = decodeURIComponent(pathMatch[1] || '')

    this.logger?.debug(`MCP request for table: ${tableId}`)

    try {
      // Validate HTTP method
      if (request.method !== 'POST' && request.method !== 'GET') {
        return this.createErrorResponse(null, 405, 'Method Not Allowed', 'Only POST and GET methods are supported')
      }

      // Validate table ID format
      const tableValidation = this.validateTableId(tableId)
      if (!tableValidation.valid) {
        return this.createErrorResponse(null, 400, 'Invalid table ID', tableValidation.error)
      }

      // Get or create MCP server for this table
      const mcpServer = await this.factory.getServerForTable(tableId)
      if (!mcpServer) {
        return this.createErrorResponse(
          null,
          404,
          'Table not found',
          `Table '${tableId}' does not exist or is not accessible`,
        )
      }

      // Handle GET requests (server info)
      if (request.method === 'GET') {
        return this.handleGetRequest(mcpServer, tableId)
      }

      // Handle POST requests (JSON-RPC)
      return await this.handlePostRequest(request, mcpServer, tableId)
    } catch (error) {
      this.logger?.error(`MCP request error for table ${tableId}:`, { error })
      return this.createErrorResponse(
        null,
        500,
        'Internal Server Error',
        error instanceof Error ? error.message : 'Unknown error',
      )
    }
  }

  /**
   * Handle GET requests (server discovery)
   */
  private handleGetRequest(mcpServer: any, tableId: string): Response {
    const serverInfo = {
      name: `Bun Graph DB MCP Server - Table ${tableId}`,
      version: '1.0.0',
      protocolVersion: '2025-06-18',
      capabilities: {
        tools: {},
        logging: {},
      },
      tableId,
      toolCount: mcpServer.getTableToolsCount(),
      initialized: mcpServer.isTableInitialized(),
    }

    return new Response(JSON.stringify(serverInfo), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    })
  }

  /**
   * Handle POST requests (JSON-RPC)
   */
  private async handlePostRequest(request: Request, mcpServer: any, tableId: string): Promise<Response> {
    try {
      // Validate Content-Type
      const contentType = request.headers.get('Content-Type')
      if (!contentType || !contentType.includes('application/json')) {
        return this.createErrorResponse(null, 400, 'Invalid Content-Type', 'Content-Type must be application/json')
      }

      // Parse request body
      const body = await request.text()
      if (!body) {
        return this.createErrorResponse(null, 400, 'Empty request body', 'JSON-RPC request body is required')
      }

      let jsonRpcRequest: any
      try {
        jsonRpcRequest = JSON.parse(body)
      } catch (_parseError) {
        return this.createErrorResponse(null, -32700, 'Parse error', 'Invalid JSON in request body')
      }

      // Validate JSON-RPC format
      if (!jsonRpcRequest || jsonRpcRequest.jsonrpc !== '2.0') {
        return this.createErrorResponse(
          jsonRpcRequest?.id || null,
          -32600,
          'Invalid Request',
          'Invalid JSON-RPC 2.0 format',
        )
      }

      // Add table context to request for logging
      this.logger?.debug(`JSON-RPC method ${jsonRpcRequest.method} for table ${tableId}`)

      // Create a new request with the JSON-RPC body for the MCP server
      const mcpRequest = new Request(request.url, {
        method: 'POST',
        headers: request.headers,
        body: body,
      })

      // Delegate to the table-specific MCP server
      return await mcpServer.handleRequest(mcpRequest)
    } catch (error) {
      this.logger?.error(`Error processing POST request for table ${tableId}:`, { error })
      return this.createErrorResponse(
        null,
        500,
        'Internal Server Error',
        error instanceof Error ? error.message : 'Request processing failed',
      )
    }
  }

  /**
   * Validate table ID format and security
   */
  private validateTableId(tableId: string): { valid: boolean; error?: string } {
    // Check for empty or null
    if (!tableId || typeof tableId !== 'string' || tableId.trim() === '') {
      return { valid: false, error: 'Table ID cannot be empty' }
    }

    const trimmed = tableId.trim()

    // Check length constraints
    if (trimmed.length === 0) {
      return { valid: false, error: 'Table ID cannot be empty after trimming' }
    }

    if (trimmed.length > 255) {
      return { valid: false, error: 'Table ID is too long (max 255 characters)' }
    }

    // Security: prevent path traversal
    if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
      return { valid: false, error: 'Table ID contains invalid path characters' }
    }

    // Security: prevent script injection patterns
    const dangerousPatterns = [
      '<script',
      'javascript:',
      'data:',
      'vbscript:',
      'onload=',
      'onerror=',
      'eval(',
      'function(',
      'setTimeout(',
      'setInterval(',
    ]

    const lowerTableId = trimmed.toLowerCase()
    for (const pattern of dangerousPatterns) {
      if (lowerTableId.includes(pattern)) {
        return { valid: false, error: 'Table ID contains potentially dangerous content' }
      }
    }

    // Basic format validation (allow alphanumeric, hyphens, underscores)
    const validFormat = /^[a-zA-Z0-9_-]+$/.test(trimmed)
    if (!validFormat) {
      return {
        valid: false,
        error: 'Table ID can only contain letters, numbers, hyphens, and underscores',
      }
    }

    return { valid: true }
  }

  /**
   * Create standardized error response
   */
  private createErrorResponse(id: string | number | null, code: number, message: string, data?: any): Response {
    let status = 500

    // Map JSON-RPC error codes to HTTP status codes
    switch (code) {
      case -32700: // Parse error
      case -32600: // Invalid Request
      case -32602: // Invalid params
        status = 400
        break
      case -32601: // Method not found
        status = 404
        break
      case 400:
      case 404:
      case 405:
        status = code
        break
      default:
        status = 500
    }

    // Create JSON-RPC error response for RPC errors
    if (code < 0) {
      const errorResponse = {
        jsonrpc: '2.0',
        id: id,
        error: {
          code,
          message,
          ...(data && { data }),
        },
      }

      return new Response(JSON.stringify(errorResponse), {
        status: status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create standard HTTP error response for HTTP errors
    const errorResponse = {
      error: message,
      ...(data && { details: data }),
    }

    return new Response(JSON.stringify(errorResponse), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  /**
   * Get factory statistics for monitoring
   */
  getFactoryStats(): {
    totalServers: number
    serverDetails: Array<{
      tableId: string
      initialized: boolean
      toolCount: number
    }>
  } {
    return this.factory.getStats()
  }

  /**
   * Health check for all active servers
   */
  async healthCheck(): Promise<{
    healthy: string[]
    unhealthy: Array<{ tableId: string; error: string }>
  }> {
    return await this.factory.healthCheck()
  }

  /**
   * Clear all cached servers (useful for testing or memory management)
   */
  clearCache(): void {
    this.factory.clearAll()
  }

  /**
   * Refresh server for specific table
   */
  async refreshTable(tableId: string): Promise<boolean> {
    try {
      const server = await this.factory.refreshServerForTable(tableId)
      return server !== null
    } catch (error) {
      this.logger?.error(`Failed to refresh table ${tableId}:`, { error })
      return false
    }
  }
}

/**
 * Create MCP routes handler with configuration
 */
export function createMcpRoutes(config: McpRouteConfig): McpRoutes {
  return new McpRoutes(config)
}

/**
 * Middleware for handling table MCP requests in Bun server
 */
export function createTableMcpMiddleware(config: McpRouteConfig) {
  const mcpRoutes = new McpRoutes(config)

  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url)
    const pathname = url.pathname

    // Check if this is a table MCP request
    if (pathname.match(/^\/sub\/[^/]+\/mcp\/?$/)) {
      return await mcpRoutes.handleTableMcpRequest(request)
    }

    return null // Not handled by this middleware
  }
}

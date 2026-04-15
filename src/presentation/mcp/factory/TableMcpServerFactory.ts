/**
 * Table MCP Server Factory Implementation
 *
 * Purpose: Creates table-specific MCP server instances with proper tool lists
 * Task: Phase 3, Task 13 - MCP Server Factory Implementation
 * Dependencies: Tasks 11-12 (RED phase complete)
 * Sequential: Implements after comprehensive testing
 */

import type { ILogger } from '../../../application/ports/ILogger'
import type { TableSchemaProjectionService } from '../../../application/services/TableSchemaProjectionService'
import { TableMcpServer } from './TableMcpServer'

interface TableValidationResult {
  exists: boolean
  id?: string
  identifier?: string
  error?: string
}

interface TableLookupCandidate {
  id?: unknown
  identifier?: unknown
}

/**
 * Singleton instance for global access
 */
let globalFactoryInstance: TableMcpServerFactory | null = null

/**
 * Factory for creating and managing table-specific MCP servers
 */
export class TableMcpServerFactory {
  private servers: Map<string, TableMcpServer> = new Map()
  private graphqlEndpoint: string
  private restApiBaseUrl: string
  private logger?: ILogger
  private projectionService?: Pick<TableSchemaProjectionService, 'project'>

  constructor(
    graphqlEndpoint: string,
    restApiBaseUrl: string,
    logger?: ILogger,
    projectionService?: Pick<TableSchemaProjectionService, 'project'>,
  ) {
    this.graphqlEndpoint = graphqlEndpoint
    this.restApiBaseUrl = restApiBaseUrl
    this.logger = logger
    this.projectionService = projectionService

    // Set as global instance
    globalFactoryInstance = this
  }

  /**
   * Get the global factory instance
   */
  static getInstance(): TableMcpServerFactory | null {
    return globalFactoryInstance
  }

  /**
   * Create or get existing MCP server for a table
   */
  async getServerForTable(tableId: string): Promise<TableMcpServer | null> {
    try {
      // First validate that the table exists
      const validation = await this.validateTable(tableId)
      if (!validation.exists) {
        this.logger?.warn(`Table ${tableId} does not exist: ${validation.error}`)
        return null
      }

      // Check if we already have a server for this table
      if (this.servers.has(tableId)) {
        const existingServer = this.servers.get(tableId)
        if (existingServer) {
          this.logger?.debug(`Returning existing MCP server for table ${tableId}`)
          return existingServer
        }
      }

      // Create new server for this table
      this.logger?.info(`Creating new MCP server for table ${tableId}`)
      const server = new TableMcpServer(tableId, this.graphqlEndpoint, this.restApiBaseUrl, {
        projectionService: this.projectionService,
      })

      // Initialize the server
      await server.initialize()

      // Cache the server
      this.servers.set(tableId, server)

      this.logger?.info(`MCP server created for table ${tableId} with ${server.getTableToolsCount()} tools`)

      return server
    } catch (error) {
      this.logger?.error(`Failed to create MCP server for table ${tableId}:`, { error })
      return null
    }
  }

  /**
   * Validate that a table exists and is accessible
   */
  private async validateTable(tableId: string): Promise<TableValidationResult> {
    try {
      // Basic table ID validation
      if (!tableId || typeof tableId !== 'string' || tableId.trim() === '') {
        return {
          exists: false,
          error: 'Invalid table ID: empty or invalid format',
        }
      }

      // Sanitize table ID
      const sanitizedTableId = this.sanitizeTableId(tableId)
      if (!sanitizedTableId) {
        return {
          exists: false,
          error: 'Invalid table ID: contains invalid characters',
        }
      }

      const response = await this.checkTableViaGraphQL(sanitizedTableId)

      return response
    } catch (error) {
      this.logger?.error(`Table validation error for ${tableId}:`, { error })
      return {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown validation error',
      }
    }
  }

  /**
   * Check table existence via GraphQL so validation is not affected by REST pagination limits.
   */
  private async checkTableViaGraphQL(tableId: string): Promise<TableValidationResult> {
    try {
      const response = await fetch(this.graphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query ValidateTable($tableId: ID!, $identifier: String!) {
              byId: table(id: $tableId) {
                id
                identifier
              }
              byIdentifier: tableByIdentifier(identifier: $identifier) {
                id
                identifier
              }
            }
          `,
          variables: {
            tableId,
            identifier: tableId,
          },
        }),
      })

      if (!response.ok) {
        return this.checkTableViaRestApi(tableId)
      }

      const data = (await response.json()) as {
        data?: {
          byId?: TableLookupCandidate
          byIdentifier?: TableLookupCandidate
        }
      }
      const table = data?.data?.byId || data?.data?.byIdentifier

      if (!table) {
        return {
          exists: false,
          error: 'Table not found',
        }
      }

      return {
        exists: true,
        id: this.toOptionalString(table.id),
        identifier: this.toOptionalString(table.identifier),
      }
    } catch {
      return this.checkTableViaRestApi(tableId)
    }
  }

  /**
   * Check table existence via REST API
   */
  private async checkTableViaRestApi(tableId: string): Promise<TableValidationResult> {
    try {
      const response = await fetch(`${this.restApiBaseUrl}/tables`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        return {
          exists: false,
          error: `REST API error: ${response.status} ${response.statusText}`,
        }
      }

      const data = (await response.json()) as {
        data?: { tables?: TableLookupCandidate[] }
        tables?: TableLookupCandidate[]
      }

      // Look for the table in the response
      // Assuming the API returns { success: true, data: { tables: [...] } }
      const tables = data?.data?.tables || data?.tables || []

      if (Array.isArray(tables)) {
        const table = tables.find((candidate) => this.matchesTableLookupCandidate(candidate, tableId))

        if (table) {
          return {
            exists: true,
            id: this.toOptionalString(table.id),
            identifier: this.toOptionalString(table.identifier),
          }
        }
      }

      return {
        exists: false,
        error: 'Table not found in API response',
      }
    } catch (error) {
      return {
        exists: false,
        error: error instanceof Error ? error.message : 'REST API check failed',
      }
    }
  }

  /**
   * Sanitize table ID to prevent injection attacks
   */
  private sanitizeTableId(tableId: string): string | null {
    // Remove any potentially dangerous characters
    const sanitized = tableId.trim()

    // Only allow alphanumeric characters, hyphens, underscores
    const validPattern = /^[a-zA-Z0-9_-]+$/

    if (!validPattern.test(sanitized)) {
      return null
    }

    // Additional length check
    if (sanitized.length === 0 || sanitized.length > 255) {
      return null
    }

    // Prevent path traversal patterns
    if (sanitized.includes('..') || sanitized.includes('/') || sanitized.includes('\\')) {
      return null
    }

    return sanitized
  }

  private matchesTableLookupCandidate(candidate: TableLookupCandidate, tableId: string): boolean {
    return (
      candidate.id === tableId ||
      candidate.identifier === tableId ||
      String(candidate.id) === tableId ||
      String(candidate.identifier) === tableId
    )
  }

  private toOptionalString(value: unknown): string | undefined {
    if (value === null || value === undefined) {
      return undefined
    }

    return typeof value === 'string' ? value : String(value)
  }

  /**
   * Remove cached server for a table
   */
  removeServerForTable(tableId: string): boolean {
    const removed = this.servers.delete(tableId)
    if (removed) {
      this.logger?.info(`Removed cached MCP server for table ${tableId}`)
    }
    return removed
  }

  /**
   * Refresh server for a table (remove and recreate)
   */
  async refreshServerForTable(tableId: string): Promise<TableMcpServer | null> {
    this.removeServerForTable(tableId)
    return await this.getServerForTable(tableId)
  }

  /**
   * Get all active servers
   */
  getActiveServers(): Map<string, TableMcpServer> {
    return new Map(this.servers)
  }

  /**
   * Get server statistics
   */
  getStats(): {
    totalServers: number
    serverDetails: Array<{
      tableId: string
      initialized: boolean
      toolCount: number
    }>
  } {
    const serverDetails = Array.from(this.servers.entries()).map(([tableId, server]) => ({
      tableId,
      initialized: server.isTableInitialized(),
      toolCount: server.getTableToolsCount(),
    }))

    return {
      totalServers: this.servers.size,
      serverDetails,
    }
  }

  /**
   * Clear all cached servers
   */
  clearAll(): void {
    const count = this.servers.size
    this.servers.clear()
    this.logger?.info(`Cleared ${count} cached MCP servers`)
  }

  /**
   * Preload servers for multiple tables
   */
  async preloadServers(tableIds: string[]): Promise<{
    successful: string[]
    failed: Array<{ tableId: string; error: string }>
  }> {
    const successful: string[] = []
    const failed: Array<{ tableId: string; error: string }> = []

    this.logger?.info(`Preloading MCP servers for ${tableIds.length} tables`)

    // Process in parallel batches to avoid overwhelming the system
    const batchSize = 5
    for (let i = 0; i < tableIds.length; i += batchSize) {
      const batch = tableIds.slice(i, i + batchSize)

      const results = await Promise.allSettled(
        batch.map(async (tableId) => {
          const server = await this.getServerForTable(tableId)
          if (server) {
            return { tableId, success: true }
          } else {
            throw new Error('Server creation failed')
          }
        }),
      )

      results.forEach((result, index) => {
        const tableId = batch[index]
        if (tableId && result.status === 'fulfilled') {
          successful.push(tableId)
        } else if (tableId && result.status === 'rejected') {
          failed.push({
            tableId,
            error: (result.reason as Error)?.message || 'Unknown error',
          })
        }
      })

      // Small delay between batches
      if (i + batchSize < tableIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    this.logger?.info(`Preloading complete: ${successful.length} successful, ${failed.length} failed`)

    return { successful, failed }
  }

  /**
   * Health check for all active servers
   */
  async healthCheck(): Promise<{
    healthy: string[]
    unhealthy: Array<{ tableId: string; error: string }>
  }> {
    const healthy: string[] = []
    const unhealthy: Array<{ tableId: string; error: string }> = []

    for (const [tableId, server] of this.servers.entries()) {
      try {
        if (server.isTableInitialized()) {
          healthy.push(tableId)
        } else {
          unhealthy.push({
            tableId,
            error: 'Server not initialized',
          })
        }
      } catch (error) {
        unhealthy.push({
          tableId,
          error: error instanceof Error ? error.message : 'Health check failed',
        })
      }
    }

    return { healthy, unhealthy }
  }

  /**
   * Refresh MCP servers for tables affected by template changes
   * Extracts table IDs from template tags (format: "table:tableId")
   */
  async refreshServersForTemplateTags(tags: string[]): Promise<{
    refreshed: string[]
    failed: Array<{ tableId: string; error: string }>
  }> {
    const refreshed: string[] = []
    const failed: Array<{ tableId: string; error: string }> = []

    // Extract table IDs from tags (format: "table:tableId")
    const tableIds = tags
      .filter((tag) => tag.startsWith('table:'))
      .map((tag) => tag.replace('table:', ''))
      .filter((id) => id.length > 0)

    if (tableIds.length === 0) {
      this.logger?.debug('No table tags found in template, skipping cache refresh')
      return { refreshed, failed }
    }

    this.logger?.info(`Refreshing MCP servers for ${tableIds.length} tables: ${tableIds.join(', ')}`)

    for (const tableId of tableIds) {
      try {
        // Only refresh if the server is already cached
        if (this.servers.has(tableId)) {
          const server = await this.refreshServerForTable(tableId)
          if (server) {
            refreshed.push(tableId)
            this.logger?.info(`Successfully refreshed MCP server cache for table ${tableId}`)
          } else {
            failed.push({ tableId, error: 'Server refresh returned null' })
          }
        } else {
          this.logger?.debug(`Table ${tableId} not cached, skipping refresh`)
        }
      } catch (error) {
        failed.push({
          tableId,
          error: error instanceof Error ? error.message : 'Unknown error during refresh',
        })
        this.logger?.error(`Failed to refresh MCP server for table ${tableId}:`, { error })
      }
    }

    return { refreshed, failed }
  }
}

/**
 * Utility function to refresh MCP server cache for template changes
 * Can be called from any part of the application without direct factory access
 */
export async function refreshMcpCacheForTemplate(tags: string[]): Promise<{
  refreshed: string[]
  failed: Array<{ tableId: string; error: string }>
}> {
  const factory = TableMcpServerFactory.getInstance()
  if (!factory) {
    console.warn('[MCP Cache] No factory instance available, skipping cache refresh')
    return { refreshed: [], failed: [] }
  }
  return factory.refreshServersForTemplateTags(tags)
}

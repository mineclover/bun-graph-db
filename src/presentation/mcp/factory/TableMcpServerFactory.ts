/**
 * Table MCP Server Factory Implementation
 *
 * Purpose: Creates table-specific MCP server instances with proper tool lists
 * Task: Phase 3, Task 13 - MCP Server Factory Implementation
 * Dependencies: Tasks 11-12 (RED phase complete)
 * Sequential: Implements after comprehensive testing
 */

import type { ILogger } from '../../../application/ports/ILogger'
import { TableSchemaProjectionService } from '../../../application/services/TableSchemaProjectionService'
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

interface TableMcpCacheRefreshResult {
  refreshed: string[]
  skipped: string[]
  failed: Array<{ tableId: string; error: string }>
}

interface TableMcpCacheRemovalResult {
  removed: string[]
  skipped: string[]
}

export interface TableMcpServerCacheOptions {
  /** Maximum number of initialized table servers retained by this factory. */
  maxServers?: number
  /** How long a successful table lookup can be reused before revalidation. */
  validationTtlMs?: number
  /** Injectable clock used by deterministic cache lifecycle tests. */
  now?: () => number
}

interface TableMcpServerCacheMetadata {
  lastValidatedAt: number
}

const DEFAULT_MAX_TABLE_SERVERS = 64
const DEFAULT_TABLE_VALIDATION_TTL_MS = 5 * 60 * 1000
const MCP_DEBUG_ENABLED =
  process.env.BUN_GRAPH_DB_MCP_DEBUG === '1' ||
  process.env.BUN_GRAPH_DB_MCP_DEBUG === 'true'

function debugMcpCache(message: string): void {
  if (MCP_DEBUG_ENABLED) console.debug(message)
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
  private serverMetadata: Map<string, TableMcpServerCacheMetadata> = new Map()
  private serverFlights: Map<string, Promise<TableMcpServer | null>> = new Map()
  private tableFlights: Map<string, Set<Promise<TableMcpServer | null>>> = new Map()
  private cacheGenerations: Map<string, number> = new Map()
  private graphqlEndpoint: string
  private restApiBaseUrl: string
  private logger?: ILogger
  private projectionService?: Pick<TableSchemaProjectionService, 'project'>
  private internalBridgeToken: string | undefined
  private maxServers: number
  private validationTtlMs: number
  private now: () => number

  constructor(
    graphqlEndpoint: string,
    restApiBaseUrl: string,
    logger?: ILogger,
    projectionService?: Pick<TableSchemaProjectionService, 'project'>,
    internalBridgeToken = process.env.BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN,
    cacheOptions: TableMcpServerCacheOptions = {},
  ) {
    this.graphqlEndpoint = graphqlEndpoint
    this.restApiBaseUrl = restApiBaseUrl
    this.logger = logger
    this.projectionService = projectionService
    const token = internalBridgeToken?.trim()
    this.internalBridgeToken = token || undefined
    this.maxServers = this.normalizePositiveInteger(
      cacheOptions.maxServers,
      DEFAULT_MAX_TABLE_SERVERS,
    )
    this.validationTtlMs = this.normalizeNonNegativeInteger(
      cacheOptions.validationTtlMs,
      DEFAULT_TABLE_VALIDATION_TTL_MS,
    )
    this.now = cacheOptions.now ?? Date.now

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
    const cachedServer = this.getFreshCachedServer(tableId)
    if (cachedServer) return cachedServer

    const activeFlight = this.serverFlights.get(tableId)
    if (activeFlight) return activeFlight

    const generation = this.getCacheGeneration(tableId)
    const flight = this.resolveServerForTable(tableId, generation)
    this.serverFlights.set(tableId, flight)
    const tableFlights = this.tableFlights.get(tableId) ?? new Set()
    tableFlights.add(flight)
    this.tableFlights.set(tableId, tableFlights)

    try {
      return await flight
    } finally {
      if (this.serverFlights.get(tableId) === flight) {
        this.serverFlights.delete(tableId)
      }
      const trackedFlights = this.tableFlights.get(tableId)
      trackedFlights?.delete(flight)
      if (trackedFlights?.size === 0) {
        this.tableFlights.delete(tableId)
        this.cacheGenerations.delete(tableId)
      }
    }
  }

  private getFreshCachedServer(tableId: string): TableMcpServer | undefined {
    const server = this.servers.get(tableId)
    if (!server) return undefined

    if (server.isClosed?.()) {
      this.servers.delete(tableId)
      this.serverMetadata.delete(tableId)
      return undefined
    }

    const metadata = this.serverMetadata.get(tableId)
    if (
      metadata &&
      this.now() - metadata.lastValidatedAt >= this.validationTtlMs
    ) {
      return undefined
    }

    // Servers injected by older callers/tests have no metadata. Treat their
    // insertion as a successful validation rather than reintroducing a lookup
    // on every cache hit.
    if (!metadata) {
      this.serverMetadata.set(tableId, { lastValidatedAt: this.now() })
    }
    this.touchCachedServer(tableId, server)
    this.logger?.debug(`Returning cached MCP server for table ${tableId}`)
    return server
  }

  private async resolveServerForTable(
    tableId: string,
    generation: number,
  ): Promise<TableMcpServer | null> {
    try {
      const validation = await this.validateTable(tableId)
      if (this.getCacheGeneration(tableId) !== generation) return null

      if (!validation.exists) {
        await this.evictServer(tableId, false)
        this.logger?.warn(
          `Table ${tableId} does not exist: ${validation.error}`,
        )
        return null
      }

      const existingServer = this.servers.get(tableId)
      if (existingServer && !existingServer.isClosed?.()) {
        this.serverMetadata.set(tableId, { lastValidatedAt: this.now() })
        this.touchCachedServer(tableId, existingServer)
        return existingServer
      }

      if (existingServer) {
        await this.evictServer(tableId, false)
      }

      this.logger?.info(`Creating new MCP server for table ${tableId}`)
      const server = await this.createServerForTable(tableId)

      // An explicit refresh/removal that happened while validation or
      // initialization was pending wins over the stale creation.
      if (this.getCacheGeneration(tableId) !== generation) {
        await server.close()
        return null
      }

      this.servers.set(tableId, server)
      this.serverMetadata.set(tableId, { lastValidatedAt: this.now() })
      await this.enforceCacheLimit(tableId)

      this.logger?.info(
        `MCP server created for table ${tableId} with ${server.getTableToolsCount()} tools`,
      )
      return server
    } catch (error) {
      this.logger?.error(`Failed to create MCP server for table ${tableId}:`, {
        error,
      })
      return null
    }
  }

  private async createServerForTable(tableId: string): Promise<TableMcpServer> {
    const server = new TableMcpServer(
      tableId,
      this.graphqlEndpoint,
      this.restApiBaseUrl,
      {
        projectionService: this.projectionService,
      },
    )
    try {
      await server.initialize()
      return server
    } catch (error) {
      await server.close().catch(() => undefined)
      throw error
    }
  }

  private touchCachedServer(tableId: string, server: TableMcpServer): void {
    this.servers.delete(tableId)
    this.servers.set(tableId, server)
  }

  private async enforceCacheLimit(protectedTableId: string): Promise<void> {
    while (this.servers.size > this.maxServers) {
      const oldestTableId = this.servers.keys().next().value as
        | string
        | undefined
      if (!oldestTableId) return
      if (oldestTableId === protectedTableId && this.servers.size === 1) return
      await this.evictServer(oldestTableId, true)
    }
  }

  private async evictServer(
    tableId: string,
    incrementGeneration: boolean,
  ): Promise<boolean> {
    const server = this.servers.get(tableId)
    const hadFlight = this.tableFlights.has(tableId)
    this.servers.delete(tableId)
    this.serverMetadata.delete(tableId)
    if (incrementGeneration) this.bumpCacheGeneration(tableId)
    if (server) await server.close()
    return Boolean(server || hadFlight)
  }

  private getCacheGeneration(tableId: string): number {
    return this.cacheGenerations.get(tableId) ?? 0
  }

  private bumpCacheGeneration(tableId: string): void {
    this.cacheGenerations.set(tableId, this.getCacheGeneration(tableId) + 1)
    this.serverFlights.delete(tableId)
    if (!this.tableFlights.has(tableId)) {
      this.cacheGenerations.delete(tableId)
    }
  }

  private normalizePositiveInteger(
    value: number | undefined,
    fallback: number,
  ): number {
    return Number.isFinite(value) && (value as number) > 0
      ? Math.floor(value as number)
      : fallback
  }

  private normalizeNonNegativeInteger(
    value: number | undefined,
    fallback: number,
  ): number {
    return Number.isFinite(value) && (value as number) >= 0
      ? Math.floor(value as number)
      : fallback
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
        error:
          error instanceof Error ? error.message : 'Unknown validation error',
      }
    }
  }

  /**
   * Check table existence via GraphQL so validation is not affected by REST pagination limits.
   */
  private async checkTableViaGraphQL(
    tableId: string,
  ): Promise<TableValidationResult> {
    try {
      const response = await fetch(this.graphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.internalAuthorizationHeaders(this.graphqlEndpoint),
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
  private async checkTableViaRestApi(
    tableId: string,
  ): Promise<TableValidationResult> {
    try {
      const response = await fetch(`${this.restApiBaseUrl}/tables`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...this.internalAuthorizationHeaders(this.restApiBaseUrl),
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
        const table = tables.find((candidate) =>
          this.matchesTableLookupCandidate(candidate, tableId),
        )

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
    if (
      sanitized.includes('..') ||
      sanitized.includes('/') ||
      sanitized.includes('\\')
    ) {
      return null
    }

    return sanitized
  }

  private matchesTableLookupCandidate(
    candidate: TableLookupCandidate,
    tableId: string,
  ): boolean {
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

  private isLoopbackUrl(value: string): boolean {
    try {
      const hostname = new URL(value).hostname
      return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1'
    } catch {
      return false
    }
  }

  private internalAuthorizationHeaders(url: string): HeadersInit {
    return this.internalBridgeToken && this.isLoopbackUrl(url)
      ? { Authorization: `Bearer ${this.internalBridgeToken}` }
      : {}
  }

  /**
   * Remove cached server for a table
   */
  removeServerForTable(tableId: string): boolean {
    const server = this.servers.get(tableId)
    const removed = Boolean(server || this.tableFlights.has(tableId))
    this.servers.delete(tableId)
    this.serverMetadata.delete(tableId)
    this.bumpCacheGeneration(tableId)
    if (removed) {
      void server?.close().catch((error) => {
        this.logger?.warn(`Failed to close cached MCP server for table ${tableId}`, { error })
      })
      this.logger?.info(`Removed cached MCP server for table ${tableId}`)
    }
    return removed
  }

  /**
   * Refresh server for a table (remove and recreate)
   */
  async refreshServerForTable(tableId: string): Promise<TableMcpServer | null> {
    await this.closeServerForTable(tableId)
    return await this.getServerForTable(tableId)
  }

  private async closeServerForTable(tableId: string): Promise<boolean> {
    const server = this.servers.get(tableId)
    const removed = Boolean(server || this.tableFlights.has(tableId))
    this.servers.delete(tableId)
    this.serverMetadata.delete(tableId)
    this.bumpCacheGeneration(tableId)
    if (server) {
      await server.close()
      this.logger?.info(`Closed cached MCP server for table ${tableId}`)
    }
    return removed
  }

  /**
   * Refresh cached server instances for one table schema without creating caches
   * for tables that have not already been requested.
   */
  async refreshServersForTableSchema(
    tableReferences: string | string[],
  ): Promise<TableMcpCacheRefreshResult> {
    const refreshed: string[] = []
    const skipped: string[] = []
    const failed: Array<{ tableId: string; error: string }> = []
    const references = this.normalizeTableReferences(tableReferences)

    if (references.length === 0) {
      return { refreshed, skipped, failed }
    }

    const cachedTableIds =
      await this.findCachedServerKeysForTableReferences(references)
    const cachedTableIdSet = new Set(cachedTableIds)

    for (const reference of references) {
      if (!cachedTableIdSet.has(reference) && !this.servers.has(reference)) {
        skipped.push(reference)
      }
    }

    for (const tableId of cachedTableIds) {
      try {
        const server = await this.refreshServerForTable(tableId)
        if (server) {
          refreshed.push(tableId)
          this.logger?.info(
            `Refreshed table-scoped MCP schema cache for table ${tableId}`,
          )
        } else {
          failed.push({ tableId, error: 'Server refresh returned null' })
        }
      } catch (error) {
        failed.push({
          tableId,
          error:
            error instanceof Error
              ? error.message
              : 'Unknown error during refresh',
        })
        this.logger?.error(
          `Failed to refresh table-scoped MCP schema cache for table ${tableId}:`,
          { error },
        )
      }
    }

    return { refreshed, skipped, failed }
  }

  /**
   * Remove cached server instances for a table that is being deleted.
   */
  removeServersForTableSchema(
    tableReferences: string | string[],
  ): TableMcpCacheRemovalResult {
    const removed: string[] = []
    const skipped: string[] = []
    const references = this.normalizeTableReferences(tableReferences)

    for (const tableId of references) {
      if (this.removeServerForTable(tableId)) {
        removed.push(tableId)
      } else {
        skipped.push(tableId)
      }
    }

    return { removed, skipped }
  }

  private normalizeTableReferences(
    tableReferences: string | string[],
  ): string[] {
    const references = Array.isArray(tableReferences)
      ? tableReferences
      : [tableReferences]

    return Array.from(
      new Set(references.map((reference) => reference?.trim()).filter(Boolean)),
    )
  }

  private async findCachedServerKeysForTableReferences(
    tableReferences: string[],
  ): Promise<string[]> {
    const referenceSet = new Set(tableReferences)
    const matchedTableIds = new Set<string>()

    for (const tableId of this.servers.keys()) {
      if (referenceSet.has(tableId)) {
        matchedTableIds.add(tableId)
        continue
      }

      const validation = await this.validateTable(tableId)
      if (
        validation.exists &&
        ((validation.id && referenceSet.has(validation.id)) ||
          (validation.identifier && referenceSet.has(validation.identifier)))
      ) {
        matchedTableIds.add(tableId)
      }
    }

    return Array.from(matchedTableIds)
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
    const serverDetails = Array.from(this.servers.entries()).map(
      ([tableId, server]) => ({
        tableId,
        initialized: server.isTableInitialized(),
        toolCount: server.getTableToolsCount(),
      }),
    )

    return {
      totalServers: this.servers.size,
      serverDetails,
    }
  }

  /**
   * Clear all cached servers
   */
  clearAll(): void {
    void this.closeAll()
  }

  /** Close all cached table MCP servers and release their per-table tool state. */
  async closeAll(): Promise<void> {
    const servers = Array.from(this.servers.values())
    const flights = Array.from(this.tableFlights.values()).flatMap((entries) =>
      Array.from(entries),
    )
    const tableIds = new Set([
      ...this.servers.keys(),
      ...this.tableFlights.keys(),
    ])
    for (const tableId of tableIds) this.bumpCacheGeneration(tableId)
    this.servers.clear()
    this.serverMetadata.clear()
    this.serverFlights.clear()
    const results = await Promise.allSettled(servers.map((server) => server.close()))
    await Promise.allSettled(flights)
    const failures = results.filter((result) => result.status === 'rejected')
    if (failures.length > 0) {
      this.logger?.warn(`Failed to close ${failures.length} cached MCP server(s)`)
    }
    this.logger?.info(`Closed ${servers.length} cached MCP servers`)
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

    this.logger?.info(
      `Preloading complete: ${successful.length} successful, ${failed.length} failed`,
    )

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
      this.logger?.debug(
        'No table tags found in template, skipping cache refresh',
      )
      return { refreshed, failed }
    }

    this.logger?.info(
      `Refreshing MCP servers for ${tableIds.length} tables: ${tableIds.join(', ')}`,
    )

    for (const tableId of tableIds) {
      try {
        // Only refresh if the server is already cached
        if (this.servers.has(tableId)) {
          const server = await this.refreshServerForTable(tableId)
          if (server) {
            refreshed.push(tableId)
            this.logger?.info(
              `Successfully refreshed MCP server cache for table ${tableId}`,
            )
          } else {
            failed.push({ tableId, error: 'Server refresh returned null' })
          }
        } else {
          this.logger?.debug(`Table ${tableId} not cached, skipping refresh`)
        }
      } catch (error) {
        failed.push({
          tableId,
          error:
            error instanceof Error
              ? error.message
              : 'Unknown error during refresh',
        })
        this.logger?.error(
          `Failed to refresh MCP server for table ${tableId}:`,
          { error },
        )
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
    debugMcpCache('[MCP Cache] No factory instance available, skipping cache refresh')
    return { refreshed: [], failed: [] }
  }
  return factory.refreshServersForTemplateTags(tags)
}

/**
 * Utility function to refresh cached table-scoped MCP schemas after table schema changes.
 */
export async function refreshMcpCacheForTableSchema(
  tableReferences: string | string[],
): Promise<TableMcpCacheRefreshResult> {
  const normalizedReferences = Array.from(
    new Set(
      (Array.isArray(tableReferences) ? tableReferences : [tableReferences])
        .map((reference) => reference?.trim())
        .filter(Boolean),
    ),
  )
  for (const tableId of normalizedReferences) {
    TableSchemaProjectionService.clearCache(tableId)
  }

  const factory = TableMcpServerFactory.getInstance()
  if (!factory) {
    debugMcpCache('[MCP Cache] No factory instance available, skipping table schema cache refresh')
    return {
      refreshed: [],
      skipped: Array.isArray(tableReferences)
        ? tableReferences
        : [tableReferences],
      failed: [],
    }
  }

  return factory.refreshServersForTableSchema(tableReferences)
}

/**
 * Utility function to remove cached table-scoped MCP schemas after table deletion.
 */
export function removeMcpCacheForTableSchema(
  tableReferences: string | string[],
): TableMcpCacheRemovalResult {
  const factory = TableMcpServerFactory.getInstance()
  if (!factory) {
    debugMcpCache('[MCP Cache] No factory instance available, skipping table schema cache removal')
    return {
      removed: [],
      skipped: Array.isArray(tableReferences)
        ? tableReferences
        : [tableReferences],
    }
  }

  return factory.removeServersForTableSchema(tableReferences)
}

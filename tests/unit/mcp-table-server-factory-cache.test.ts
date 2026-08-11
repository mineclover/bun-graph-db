import { describe, expect, mock, test } from 'bun:test'
import { TableSchemaProjectionService } from '../../src/application/services/TableSchemaProjectionService'
import {
  refreshMcpCacheForTableSchema,
  TableMcpServerFactory,
} from '../../src/presentation/mcp/factory/TableMcpServerFactory'

type FakeTableServer = {
  close: ReturnType<typeof mock>
  getTableToolsCount: () => number
  isClosed: () => boolean
  isTableInitialized: () => boolean
}

function fakeTableServer(): FakeTableServer {
  let closed = false
  return {
    close: mock(async () => {
      closed = true
    }),
    getTableToolsCount: () => 1,
    isClosed: () => closed,
    isTableInitialized: () => true,
  }
}

type FactoryInternals = {
  servers: Map<string, FakeTableServer>
  serverMetadata: Map<string, { lastValidatedAt: number }>
  serverFlights: Map<string, Promise<FakeTableServer | null>>
  validateTable: (tableId: string) => Promise<{ exists: boolean; error?: string }>
  createServerForTable: (tableId: string) => Promise<FakeTableServer>
}

function internals(factory: TableMcpServerFactory): FactoryInternals {
  return factory as unknown as FactoryInternals
}

describe('TableMcpServerFactory table schema cache invalidation', () => {
  test('refreshes only cached servers matching the changed table', async () => {
    const factory = new TableMcpServerFactory(
      'http://factory-cache.test/graphql',
      'http://factory-cache.test/api',
    )
    const servers = (factory as unknown as { servers: Map<string, unknown> })
      .servers
    const unchangedServer = {
      isTableInitialized: () => true,
      getTableToolsCount: () => 1,
    }

    servers.set('table_a', {
      isTableInitialized: () => true,
      getTableToolsCount: () => 1,
    })
    servers.set('table_b', unchangedServer)

    const refreshServerForTable = mock(async (tableId: string) => {
      const refreshedServer = {
        tableId,
        isTableInitialized: () => true,
        getTableToolsCount: () => 2,
      }
      servers.set(tableId, refreshedServer)
      return refreshedServer
    })
    factory.refreshServerForTable =
      refreshServerForTable as typeof factory.refreshServerForTable

    const result = await factory.refreshServersForTableSchema('table_a')

    expect(refreshServerForTable).toHaveBeenCalledTimes(1)
    expect(refreshServerForTable).toHaveBeenCalledWith('table_a')
    expect(result.refreshed).toEqual(['table_a'])
    expect(result.failed).toEqual([])
    expect(servers.get('table_b')).toBe(unchangedServer)
  })

  test('does not create a table MCP server when the changed table is not cached', async () => {
    const factory = new TableMcpServerFactory(
      'http://factory-cache.test/graphql',
      'http://factory-cache.test/api',
    )
    const refreshServerForTable = mock(async () => null)
    factory.refreshServerForTable =
      refreshServerForTable as typeof factory.refreshServerForTable

    const result =
      await factory.refreshServersForTableSchema('table_not_cached')

    expect(refreshServerForTable).not.toHaveBeenCalled()
    expect(result.refreshed).toEqual([])
    expect(result.skipped).toEqual(['table_not_cached'])
    expect(result.failed).toEqual([])
  })

  test('serves a fresh cached server without revalidating the table', async () => {
    const factory = new TableMcpServerFactory(
      'http://factory-cache.test/graphql',
      'http://factory-cache.test/api',
    )
    const state = internals(factory)
    const server = fakeTableServer()
    const validateTable = mock(async () => ({ exists: true }))
    state.servers.set('table_a', server)
    state.validateTable = validateTable

    const first = await factory.getServerForTable('table_a')
    const second = await factory.getServerForTable('table_a')

    expect(first).toBe(server)
    expect(second).toBe(server)
    expect(validateTable).not.toHaveBeenCalled()
    await factory.closeAll()
  })

  test('revalidates an expired cached server without rebuilding it', async () => {
    let now = 0
    const factory = new TableMcpServerFactory(
      'http://factory-cache.test/graphql',
      'http://factory-cache.test/api',
      undefined,
      undefined,
      undefined,
      { validationTtlMs: 100, now: () => now },
    )
    const state = internals(factory)
    const server = fakeTableServer()
    const validateTable = mock(async () => ({ exists: true }))
    const createServer = mock(async () => fakeTableServer())
    state.servers.set('table_a', server)
    state.serverMetadata.set('table_a', { lastValidatedAt: 0 })
    state.validateTable = validateTable
    state.createServerForTable = createServer
    now = 101

    const resolved = await factory.getServerForTable('table_a')

    expect(resolved).toBe(server)
    expect(validateTable).toHaveBeenCalledTimes(1)
    expect(createServer).not.toHaveBeenCalled()
    await factory.closeAll()
  })

  test('coalesces concurrent cache misses into one validation and creation', async () => {
    const factory = new TableMcpServerFactory(
      'http://factory-cache.test/graphql',
      'http://factory-cache.test/api',
    )
    const state = internals(factory)
    const server = fakeTableServer()
    let releaseValidation!: () => void
    const validationGate = new Promise<void>((resolve) => {
      releaseValidation = resolve
    })
    const validateTable = mock(async () => {
      await validationGate
      return { exists: true }
    })
    const createServer = mock(async () => server)
    state.validateTable = validateTable
    state.createServerForTable = createServer

    const requests = Array.from({ length: 8 }, () =>
      factory.getServerForTable('table_a'),
    )
    releaseValidation()
    const resolved = await Promise.all(requests)

    expect(resolved.every((candidate) => candidate === server)).toBe(true)
    expect(validateTable).toHaveBeenCalledTimes(1)
    expect(createServer).toHaveBeenCalledTimes(1)
    await factory.closeAll()
  })

  test('evicts the least recently used server when the cache is full', async () => {
    const factory = new TableMcpServerFactory(
      'http://factory-cache.test/graphql',
      'http://factory-cache.test/api',
      undefined,
      undefined,
      undefined,
      { maxServers: 2 },
    )
    const state = internals(factory)
    const created = new Map<string, FakeTableServer>()
    state.validateTable = mock(async () => ({ exists: true }))
    state.createServerForTable = mock(async (tableId: string) => {
      const server = fakeTableServer()
      created.set(tableId, server)
      return server
    })

    await factory.getServerForTable('table_a')
    await factory.getServerForTable('table_b')
    await factory.getServerForTable('table_a')
    await factory.getServerForTable('table_c')

    expect(factory.getActiveServers().has('table_a')).toBe(true)
    expect(factory.getActiveServers().has('table_b')).toBe(false)
    expect(factory.getActiveServers().has('table_c')).toBe(true)
    expect(created.get('table_b')?.close).toHaveBeenCalledTimes(1)
    await factory.closeAll()
  })

  test('does not publish a server invalidated while creation is in flight', async () => {
    const factory = new TableMcpServerFactory(
      'http://factory-cache.test/graphql',
      'http://factory-cache.test/api',
    )
    const state = internals(factory)
    const server = fakeTableServer()
    let releaseCreation!: () => void
    const creationGate = new Promise<void>((resolve) => {
      releaseCreation = resolve
    })
    const createServer = mock(async () => {
      await creationGate
      return server
    })
    state.validateTable = mock(async () => ({ exists: true }))
    state.createServerForTable = createServer

    const pending = factory.getServerForTable('table_a')
    while (createServer.mock.calls.length === 0) await Promise.resolve()
    expect(factory.removeServerForTable('table_a')).toBe(true)
    releaseCreation()

    expect(await pending).toBeNull()
    expect(factory.getActiveServers().has('table_a')).toBe(false)
    expect(server.close).toHaveBeenCalledTimes(1)
  })

  test('closeAll waits for stale invalidated flights and prevents zombie caches', async () => {
    const factory = new TableMcpServerFactory(
      'http://factory-cache.test/graphql',
      'http://factory-cache.test/api',
    )
    const state = internals(factory)
    const server = fakeTableServer()
    let releaseCreation!: () => void
    const creationGate = new Promise<void>((resolve) => {
      releaseCreation = resolve
    })
    const createServer = mock(async () => {
      await creationGate
      return server
    })
    state.validateTable = mock(async () => ({ exists: true }))
    state.createServerForTable = createServer

    const pending = factory.getServerForTable('table_a')
    while (createServer.mock.calls.length === 0) await Promise.resolve()
    factory.removeServerForTable('table_a')

    let closeCompleted = false
    const closing = factory.closeAll().then(() => {
      closeCompleted = true
    })
    await Promise.resolve()
    expect(closeCompleted).toBe(false)

    releaseCreation()
    expect(await pending).toBeNull()
    await closing

    expect(closeCompleted).toBe(true)
    expect(factory.getActiveServers().size).toBe(0)
    expect(server.close).toHaveBeenCalledTimes(1)
  })

  test('schema refresh invalidates the shared projection cache first', async () => {
    const projectionCache = (
      TableSchemaProjectionService as unknown as {
        cache: Map<string, unknown>
      }
    ).cache
    projectionCache.set('table_projection_cache', {
      sourceKey: 'stale',
      projection: {},
    })

    await refreshMcpCacheForTableSchema([
      ' table_projection_cache ',
      'table_projection_cache',
    ])

    expect(projectionCache.has('table_projection_cache')).toBe(false)
  })
})

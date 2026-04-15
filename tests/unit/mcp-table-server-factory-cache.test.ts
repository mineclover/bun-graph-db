import { describe, expect, mock, test } from 'bun:test'
import { TableMcpServerFactory } from '../../src/presentation/mcp/factory/TableMcpServerFactory'

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
})

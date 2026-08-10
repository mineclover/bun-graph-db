import { describe, expect, test } from 'bun:test'
import {
  McpToolRegistry,
  ROOT_MCP_TOOL_CONTRACT_VERSION,
} from '../../src/application/services/McpToolRegistry'

describe('root MCP tool contract', () => {
  test('loads the versioned contract and publishes deterministic metadata', async () => {
    const registry = new McpToolRegistry()
    await registry.initialize()

    const listed = registry.listTools().tools
    expect(registry.isLoaded()).toBe(true)
    expect(listed.length).toBeGreaterThan(0)
    expect(listed.map((tool) => tool.name)).toEqual([...listed.map((tool) => tool.name)].sort())

    const createTable = registry.getTool('createTable').tool
    expect(createTable).toEqual(
      expect.objectContaining({
        contractVersion: ROOT_MCP_TOOL_CONTRACT_VERSION,
        access: { action: 'write', scope: 'global' },
      }),
    )

    const healthCheck = registry.getTool('healthCheck').tool
    expect(healthCheck?.access).toEqual({ action: 'read', scope: 'global' })

    expect(registry.resolveAccess('createAttribute', { tableId: 'alpha' })).toEqual({
      action: 'write',
      scope: 'table',
      tableIdArgument: 'tableId',
      tableId: 'alpha',
    })

    const readerTools = registry.listTools({ role: 'reader' }).tools
    expect(readerTools.map((tool) => tool.name)).toContain('healthCheck')
    expect(readerTools.map((tool) => tool.name)).not.toContain('createTable')
  })
})

import { describe, expect, test, vi } from 'vitest'
import type { McpToolAudience } from '../../src/application/services/McpToolRegistry'
import { McpHttpServer } from '../../src/mcp/http-server/McpHttpServer'
import { MODERN_MCP_PROTOCOL_VERSION } from '../../src/mcp/http-server/modern-protocol'
import {
  TableMcpServer,
  type TableMcpJsonRpcRequest,
} from '../../src/presentation/mcp/factory/TableMcpServer'
import { McpRoutes } from '../../src/presentation/mcp/routes/mcp-routes'

const modernMeta = {
  'io.modelcontextprotocol/protocolVersion': MODERN_MCP_PROTOCOL_VERSION,
  'io.modelcontextprotocol/clientCapabilities': {},
}

function modernHeaders(method: string): Headers {
  return new Headers({
    'Content-Type': 'application/json',
    'MCP-Protocol-Version': MODERN_MCP_PROTOCOL_VERSION,
    'Mcp-Method': method,
  })
}

function modernToolsListRequest(id: number): Request {
  return new Request('http://localhost/mcp', {
    method: 'POST',
    headers: modernHeaders('tools/list'),
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'tools/list',
      params: { _meta: modernMeta },
    }),
  })
}

describe('MCP hot-path caches', () => {
  test('table route parses the body once and delegates the parsed envelope', async () => {
    const routes = new McpRoutes({
      graphqlEndpoint: 'http://route-hotpath.test/graphql',
      restApiBaseUrl: 'http://route-hotpath.test/api',
    })
    const handleParsedRequest = vi.fn(
      async (request: TableMcpJsonRpcRequest) =>
        new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {} })),
    )
    const handleRequest = vi.fn(async () => new Response(null))
    const getServerForTable = vi.fn(async () => ({
      handleParsedRequest,
      handleRequest,
    }))
    ;(routes as unknown as {
      factory: { getServerForTable: typeof getServerForTable }
    }).factory = { getServerForTable }

    const request = new Request('http://route-hotpath.test/sub/table_a/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/list',
      }),
    })
    const readBody = vi.fn(request.text.bind(request))
    Object.defineProperty(request, 'text', { value: readBody })

    const response = await routes.handleTableMcpRequest(request)

    expect(response.status).toBe(200)
    expect(readBody).toHaveBeenCalledTimes(1)
    expect(handleParsedRequest).toHaveBeenCalledTimes(1)
    expect(handleParsedRequest.mock.calls[0]?.[0]).toMatchObject({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/list',
    })
    expect(handleRequest).not.toHaveBeenCalled()
  })

  test('root tools/list reuses its audience projection and serialized result', async () => {
    const server = new McpHttpServer('http://root-hotpath.test/graphql')
    await server.initialize()
    const state = server as unknown as {
      toolRegistry: {
        listTools: (audience?: McpToolAudience) => { tools: unknown[] }
      }
      toolsListCache: Map<string, unknown>
    }
    const listTools = vi.fn(state.toolRegistry.listTools.bind(state.toolRegistry))
    state.toolRegistry.listTools = listTools

    const first = await server.handleRequest(modernToolsListRequest(1))
    const second = await server.handleRequest(modernToolsListRequest(2))
    const firstBody = (await first.json()) as { id: number; result: unknown }
    const secondBody = (await second.json()) as { id: number; result: unknown }

    expect(firstBody.id).toBe(1)
    expect(secondBody.id).toBe(2)
    expect(secondBody.result).toEqual(firstBody.result)
    expect(listTools).toHaveBeenCalledTimes(1)
    expect(state.toolsListCache.size).toBe(1)

    await server.close()
    expect(state.toolsListCache.size).toBe(0)
  })

  test('root tools/call compiles each stable input schema once', async () => {
    const server = new McpHttpServer('http://validator-hotpath.test/graphql')
    await server.initialize()
    const state = server as unknown as {
      ajv: { compile: (schema: object) => unknown }
      validatorCache: WeakMap<object, unknown>
    }
    const compile = vi.fn(state.ajv.compile.bind(state.ajv))
    state.ajv.compile = compile

    const call = (id: number) =>
      server.handleRequest(
        new Request('http://validator-hotpath.test/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id,
            method: 'tools/call',
            params: { name: 'createTable', arguments: {} },
          }),
        }),
      )

    const first = await call(1)
    const second = await call(2)
    const firstBody = (await first.json()) as { error?: { code?: number } }
    const secondBody = (await second.json()) as { error?: { code?: number } }

    expect(firstBody.error?.code).toBe(-32602)
    expect(secondBody.error?.code).toBe(-32602)
    expect(compile).toHaveBeenCalledTimes(1)

    await server.close()
  })

  test('table tools/list caches sorted audience results until close', async () => {
    const server = new TableMcpServer(
      'table_a',
      'http://table-hotpath.test/graphql',
    )
    const state = server as unknown as {
      tableInitialized: boolean
      tableTools: Map<string, {
        name: string
        description: string
        inputSchema: object
        operationType: 'query' | 'mutation'
      }>
      toolsListCache: Map<string, unknown>
    }
    state.tableInitialized = true
    state.tableTools.set('z-write', {
      name: 'z-write',
      description: 'write',
      inputSchema: { type: 'object' },
      operationType: 'mutation',
    })
    state.tableTools.set('a-read', {
      name: 'a-read',
      description: 'read',
      inputSchema: { type: 'object' },
      operationType: 'query',
    })
    const request: TableMcpJsonRpcRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: { _meta: modernMeta },
    }

    const first = await server.handleParsedRequest(
      request,
      modernHeaders('tools/list'),
    )
    const second = await server.handleParsedRequest(
      { ...request, id: 2 },
      modernHeaders('tools/list'),
    )
    const firstBody = (await first.json()) as {
      result: { tools: Array<{ name: string }> }
    }
    const secondBody = (await second.json()) as {
      result: { tools: Array<{ name: string }> }
    }

    expect(firstBody.result.tools.map((tool) => tool.name)).toEqual([
      'a-read',
      'z-write',
    ])
    expect(secondBody.result).toEqual(firstBody.result)
    expect(state.toolsListCache.size).toBe(1)

    await server.close()
    expect(state.toolsListCache.size).toBe(0)
  })
})

import { describe, expect, test } from 'bun:test'
import {
  MODERN_MCP_PROTOCOL_VERSION,
  validateModernMcpRequest,
  withModernResult,
} from '../../src/mcp/http-server/modern-protocol'
import { McpHttpServer } from '../../src/mcp/http-server/McpHttpServer'
import { TableMcpServer } from '../../src/presentation/mcp/factory/TableMcpServer'

const modernMeta = {
  'io.modelcontextprotocol/protocolVersion': MODERN_MCP_PROTOCOL_VERSION,
  'io.modelcontextprotocol/clientCapabilities': {},
  'io.modelcontextprotocol/clientInfo': {
    name: 'bun-graph-db-contract-test',
    version: '1.0.0',
  },
}

function headers(method: string, extra: Record<string, string> = {}): Headers {
  return new Headers({
    'MCP-Protocol-Version': MODERN_MCP_PROTOCOL_VERSION,
    'Mcp-Method': method,
    ...extra,
  })
}

function discoverRequest(): Request {
  return new Request('http://localhost/mcp', {
    method: 'POST',
    headers: headers('server/discover'),
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'server/discover',
      params: { _meta: modernMeta },
    }),
  })
}

function toolsListRequest(): Request {
  return new Request('http://localhost/mcp', {
    method: 'POST',
    headers: headers('tools/list'),
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: { _meta: modernMeta },
    }),
  })
}

describe('MCP 2026-07-28 stateless protocol envelope', () => {
  test('accepts a server/discover request with matching per-request metadata and headers', () => {
    const error = validateModernMcpRequest(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'server/discover',
        params: { _meta: modernMeta },
      },
      headers('server/discover'),
    )

    expect(error).toBeUndefined()
  })

  test('rejects a request whose wire headers do not match its method', () => {
    const error = validateModernMcpRequest(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: { _meta: modernMeta },
      },
      headers('server/discover'),
    )

    expect(error).toMatchObject({ code: -32020, message: 'Header mismatch' })
  })

  test('requires Mcp-Name to match the tools/call name', () => {
    const error = validateModernMcpRequest(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { _meta: modernMeta, name: 'expected-tool', arguments: {} },
      },
      headers('tools/call', { 'Mcp-Name': 'different-tool' }),
    )

    expect(error).toMatchObject({ code: -32020, message: 'Header mismatch' })
  })

  test('adds complete result metadata without discarding existing metadata', () => {
    const result = withModernResult(
      { tools: [], _meta: { source: 'cache' } },
      { name: 'bun-graph-db', version: '1.0.0' },
    )

    expect(result).toMatchObject({
      resultType: 'complete',
      _meta: {
        source: 'cache',
        'io.modelcontextprotocol/serverInfo': { name: 'bun-graph-db', version: '1.0.0' },
      },
    })
  })

  test('root server exposes the modern discover envelope', async () => {
    const server = new McpHttpServer('http://localhost:4000/graphql')
    const response = await server.handleRequest(discoverRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      result: {
        supportedVersions: expect.arrayContaining([MODERN_MCP_PROTOCOL_VERSION]),
        capabilities: { tools: {} },
        resultType: 'complete',
        _meta: {
          'io.modelcontextprotocol/serverInfo': expect.objectContaining({
            name: 'Bun Graph Database - MCP Server',
          }),
        },
      },
    })
  })

  test('close is idempotent and prevents new root MCP requests', async () => {
    const server = new McpHttpServer('http://localhost:4000/graphql')

    await Promise.all([server.close(), server.close()])
    const response = await server.handleRequest(discoverRequest())
    const body = (await response.json()) as { error?: { code?: number; message?: string } }

    expect(server.isClosed()).toBe(true)
    expect(response.status).toBe(503)
    expect(body.error).toMatchObject({ code: -32000, message: 'Server unavailable' })
  })

  test('root tools/list is complete, cacheable, and deterministically ordered', async () => {
    const server = new McpHttpServer('http://localhost:4000/graphql')
    const response = await server.handleRequest(toolsListRequest())
    const body = (await response.json()) as {
      result: { tools: Array<{ name: string }>; ttlMs: number; cacheScope: string; resultType: string }
    }

    expect(response.status).toBe(200)
    expect(body.result.ttlMs).toBe(300000)
    expect(body.result.cacheScope).toBe('public')
    expect(body.result.resultType).toBe('complete')
    expect(body.result.tools.map((tool) => tool.name)).toEqual(
      [...body.result.tools.map((tool) => tool.name)].sort(),
    )
  })

  test('root tools/list omits write tools for reader principals', async () => {
    const server = new McpHttpServer('http://localhost:4000/graphql')
    const response = await server.handleRequest(toolsListRequest(), { role: 'reader' })
    const body = (await response.json()) as {
      result: { tools: Array<{ name: string; _meta?: { action?: string } }>; cacheScope: string }
    }

    expect(body.result.tools.map((tool) => tool.name)).toContain('healthCheck')
    expect(body.result.tools.map((tool) => tool.name)).not.toContain('createTable')
    expect(body.result.tools.every((tool) => tool._meta?.action === 'read')).toBe(true)
    expect(body.result.cacheScope).toBe('private')
  })

  test('table server exposes the modern discover envelope', async () => {
    const server = new TableMcpServer('table-1', 'http://localhost:4000/graphql')
    const response = await server.handleRequest(discoverRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      result: {
        supportedVersions: expect.arrayContaining([MODERN_MCP_PROTOCOL_VERSION]),
        capabilities: { tools: {} },
        resultType: 'complete',
        _meta: {
          'io.modelcontextprotocol/serverInfo': expect.objectContaining({
            name: 'Bun Graph Database - Table table-1 MCP',
          }),
        },
      },
    })
  })

  test('table server close releases its request boundary and is idempotent', async () => {
    const server = new TableMcpServer('table-1', 'http://localhost:4000/graphql')

    await Promise.all([server.close(), server.close()])
    const response = await server.handleRequest(discoverRequest())

    expect(server.isClosed()).toBe(true)
    expect(response.status).toBe(503)
  })

  test('table tools/list omits write tools for reader principals', async () => {
    const server = new TableMcpServer('table-1', 'http://localhost:4000/graphql')
    const response = await server.handleRequest(toolsListRequest(), { role: 'reader' })
    const body = (await response.json()) as {
      result: { tools: Array<{ _meta?: { action?: string } }>; cacheScope: string }
    }

    expect(body.result.cacheScope).toBe('private')
    expect(body.result.tools.every((tool) => tool._meta?.action === 'read')).toBe(true)
  })
})

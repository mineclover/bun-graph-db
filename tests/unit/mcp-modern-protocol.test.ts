import { describe, expect, test } from 'vitest'
import {
  LATEST_LEGACY_MCP_PROTOCOL_VERSION,
  MODERN_MCP_PROTOCOL_VERSION,
  SUPPORTED_MCP_PROTOCOL_VERSIONS,
  decodeMcpNameHeader,
  isValidMcpOrigin,
  validateJsonRpcBatch,
  validateModernMcpRequest,
  withModernResult,
  withStructuredToolResult,
} from '../../src/mcp/http-server/modern-protocol'
import { McpHttpServer } from '../../src/mcp/http-server/McpHttpServer'
import { TableMcpServer } from '../../src/presentation/mcp/factory/TableMcpServer'
import { createMcpRoutes } from '../../src/presentation/mcp/routes/mcp-routes'

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
    'Content-Type': 'application/json',
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

  test('root and table GET discovery advertise 2026-07-28 and 2025-11-25 LTS support', async () => {
    const rootServer = new McpHttpServer('http://localhost:4000/graphql')
    const getResponse = await rootServer.handleRequest(new Request('http://localhost/mcp', { method: 'GET' }))
    const info = (await getResponse.json()) as {
      protocolVersion: string
      supportedVersions: string[]
      capabilities: Record<string, unknown>
      legacyCapabilities: Record<string, unknown>
    }

    expect(getResponse.status).toBe(200)
    expect(getResponse.headers.get('MCP-Protocol-Version')).toBe(MODERN_MCP_PROTOCOL_VERSION)
    expect(info.protocolVersion).toBe(MODERN_MCP_PROTOCOL_VERSION)
    expect(info.supportedVersions).toEqual([...SUPPORTED_MCP_PROTOCOL_VERSIONS])
    expect(info.supportedVersions).toContain(LATEST_LEGACY_MCP_PROTOCOL_VERSION)
    expect(info.capabilities).toEqual({ tools: {} })
    expect(info.legacyCapabilities).toEqual({ tools: {}, logging: {} })
  })

  test('negotiates 2025-11-25 LTS and 2025-03-26 on initialize', async () => {
    const server = new McpHttpServer('http://localhost:4000/graphql')

    for (const version of ['2025-11-25', '2025-03-26']) {
      const response = await server.handleRequest(
        new Request('http://localhost/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: `init-${version}`,
            method: 'initialize',
            params: {
              protocolVersion: version,
              capabilities: {},
              clientInfo: { name: 'compat-client', version: '1.0.0' },
            },
          }),
        }),
      )
      const body = (await response.json()) as { result: { protocolVersion: string; instructions?: string } }
      expect(response.status).toBe(200)
      expect(body.result.protocolVersion).toBe(version)
      expect(typeof body.result.instructions).toBe('string')
      if (version === '2025-11-25') {
        expect(response.headers.get('MCP-Protocol-Version')).toBe('2025-11-25')
      }
    }
  })

  test('rejects unsupported future modern protocol version with -32022', async () => {
    const server = new McpHttpServer('http://localhost:4000/graphql')
    const futureVersion = '2026-09-01'
    const response = await server.handleRequest(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': futureVersion,
          'Mcp-Method': 'server/discover',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 99,
          method: 'server/discover',
          params: {
            _meta: {
              ...modernMeta,
              'io.modelcontextprotocol/protocolVersion': futureVersion,
            },
          },
        }),
      }),
    )
    const body = (await response.json()) as {
      id: number
      error: { code: number; message: string; data: { requested: string; supported: string[] } }
    }

    expect(response.status).toBe(400)
    expect(body.id).toBe(99)
    expect(body.error.code).toBe(-32022)
    expect(body.error.data.requested).toBe(futureVersion)
    expect(body.error.data.supported).toContain(MODERN_MCP_PROTOCOL_VERSION)
  })

  test('rejects legacy initialize carrying modern header and rejects modern-enveloped initialize as -32601', async () => {
    const server = new McpHttpServer('http://localhost:4000/graphql')

    const headerOnly = await server.handleRequest(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': MODERN_MCP_PROTOCOL_VERSION,
          'Mcp-Method': 'initialize',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: { protocolVersion: '2025-11-25', capabilities: {} },
        }),
      }),
    )
    const headerOnlyBody = (await headerOnly.json()) as { error: { code: number; message: string } }
    expect(headerOnly.status).toBe(400)
    expect(headerOnlyBody.error).toMatchObject({ code: -32020, message: 'Header mismatch' })

    const envelopedInit = await server.handleRequest(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: headers('initialize'),
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'initialize',
          params: { _meta: modernMeta },
        }),
      }),
    )
    const envelopedInitBody = (await envelopedInit.json()) as { error: { code: number; message: string } }
    expect(envelopedInit.status).toBe(200)
    expect(envelopedInitBody.error).toMatchObject({ code: -32601, message: 'Method not found' })
  })

  test('trims RFC 9110 OWS and decodes SEP-2243 base64 Mcp-Name sentinels', () => {
    const encodedTool = `=?base64?${Buffer.from('searchNodes', 'utf8').toString('base64')}?=`
    expect(decodeMcpNameHeader(`  ${encodedTool}\t`)).toEqual({ value: 'searchNodes' })
    expect(decodeMcpNameHeader('=?base64?not-valid!base64?=')).toHaveProperty('error')

    const error = validateModernMcpRequest(
      {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: { _meta: modernMeta, name: 'searchNodes', arguments: {} },
      },
      new Headers({
        'MCP-Protocol-Version': ` \t${MODERN_MCP_PROTOCOL_VERSION} `,
        'Mcp-Method': ' tools/call\t',
        'Mcp-Name': ` ${encodedTool} `,
      }),
    )
    expect(error).toBeUndefined()
  })

  test('propagates SEP-414 W3C trace context in modern responses and validates trace value types', async () => {
    const server = new McpHttpServer('http://localhost:4000/graphql')
    const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'

    const pingResponse = await server.handleRequest(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: headers('ping'),
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'ping-1',
          method: 'ping',
          params: {
            _meta: {
              ...modernMeta,
              traceparent,
              baggage: 'tenant=demo',
            },
          },
        }),
      }),
    )
    const pingBody = (await pingResponse.json()) as {
      result: { resultType: string; _meta: Record<string, unknown> }
    }
    expect(pingResponse.status).toBe(200)
    expect(pingResponse.headers.get('MCP-Protocol-Version')).toBe(MODERN_MCP_PROTOCOL_VERSION)
    expect(pingBody.result.resultType).toBe('complete')
    expect(pingBody.result._meta.traceparent).toBe(traceparent)
    expect(pingBody.result._meta.baggage).toBe('tenant=demo')

    const badTrace = validateModernMcpRequest(
      {
        jsonrpc: '2.0',
        id: 'bad-trace',
        method: 'ping',
        params: { _meta: { ...modernMeta, traceparent: 12345 } },
      },
      headers('ping'),
    )
    expect(badTrace).toMatchObject({ code: -32602, message: 'Invalid params' })
  })

  test('handles ping and HTTP 202 notifications on modern 2026-07-28 and 2025-11-25 across root and table servers', async () => {
    const rootServer = new McpHttpServer('http://localhost:4000/graphql')
    const tableServer = new TableMcpServer('table-1', 'http://localhost:4000/graphql')

    for (const server of [rootServer, tableServer]) {
      const modernNote = await server.handleRequest(
        new Request('http://localhost/mcp', {
          method: 'POST',
          headers: headers('notifications/cancelled'),
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'notifications/cancelled',
            params: {
              requestId: 'req-1',
              _meta: { 'io.modelcontextprotocol/protocolVersion': MODERN_MCP_PROTOCOL_VERSION },
            },
          }),
        }),
      )
      expect(modernNote.status).toBe(202)
      expect(await modernNote.text()).toBe('')
      expect(modernNote.headers.get('MCP-Protocol-Version')).toBe(MODERN_MCP_PROTOCOL_VERSION)

      const ltsNote = await server.handleRequest(
        new Request('http://localhost/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'MCP-Protocol-Version': '2025-11-25',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'notifications/initialized',
            params: {},
          }),
        }),
      )
      expect(ltsNote.status).toBe(202)
      expect(await ltsNote.text()).toBe('')
      expect(ltsNote.headers.get('MCP-Protocol-Version')).toBe('2025-11-25')

      const tablePing = await server.handleRequest(
        new Request('http://localhost/mcp', {
          method: 'POST',
          headers: headers('ping'),
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 77,
            method: 'ping',
            params: { _meta: modernMeta },
          }),
        }),
      )
      expect(tablePing.status).toBe(200)
      expect(await tablePing.json()).toMatchObject({
        jsonrpc: '2.0',
        id: 77,
        result: { resultType: 'complete' },
      })
    }
  })

  test('enforces HTTP 405 with Allow header, HTTP 415 on non-JSON Content-Type, and JSON-RPC batch rejection', async () => {
    const server = new McpHttpServer('http://localhost:4000/graphql')

    const delResponse = await server.handleRequest(new Request('http://localhost/mcp', { method: 'DELETE' }))
    expect(delResponse.status).toBe(405)
    expect(delResponse.headers.get('Allow')).toBe('POST, GET')

    const unsupportedType = await server.handleRequest(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: '{}',
      }),
    )
    expect(unsupportedType.status).toBe(415)

    expect(validateJsonRpcBatch([])).toMatchObject({ code: -32600, message: 'Invalid Request' })
    const batchResponse = await server.handleRequest(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ jsonrpc: '2.0', id: 1, method: 'ping' }]),
      }),
    )
    expect(batchResponse.status).toBe(400)
    expect(await batchResponse.json()).toMatchObject({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request' },
    })
  })

  test('projects ToolAnnotations and 2020-12 outputSchema in tools/list for root and table servers', async () => {
    const rootServer = new McpHttpServer('http://localhost:4000/graphql')
    const rootList = (await (await rootServer.handleRequest(toolsListRequest())).json()) as {
      result: {
        tools: Array<{
          name: string
          annotations?: Record<string, unknown>
          outputSchema?: Record<string, unknown>
        }>
      }
    }

    const healthCheck = rootList.result.tools.find((t) => t.name === 'healthCheck')
    const deleteTemplate = rootList.result.tools.find((t) => t.name === 'delete-template')
    const rootProjection = rootList.result.tools.find((t) => t.name === 'get-root-openapi-projection')
    expect(healthCheck?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, idempotentHint: true })
    expect(healthCheck?.outputSchema).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
    })
    expect(rootProjection?.outputSchema).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
    })
    expect(deleteTemplate?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true })

    const tableServer = new TableMcpServer('table-1', 'http://localhost:4000/graphql')
    const tableList = (await (await tableServer.handleRequest(toolsListRequest())).json()) as {
      result: {
        tools: Array<{
          name: string
          annotations?: Record<string, unknown>
          outputSchema?: Record<string, unknown>
        }>
      }
    }
    const tableProjection = tableList.result.tools.find((t) => t.name === 'get-openapi-projection-table-1')
    expect(tableProjection?.annotations).toMatchObject({ readOnlyHint: true })
    expect(tableProjection?.outputSchema).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
    })
  })

  test('populates structuredContent (SEP-2106) and returns isError:true validation errors for 2026-07-28 & 2025-11-25', async () => {
    const structured = withStructuredToolResult({
      content: [{ type: 'text', text: '{"ok":true,"count":2}' }],
      isError: false,
    })
    expect(structured).toMatchObject({
      structuredContent: { ok: true, count: 2 },
    })

    const server = new McpHttpServer('http://localhost:4000/graphql')
    const invalidModernCall = await server.handleRequest(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: headers('tools/call', { 'Mcp-Name': 'healthCheck' }),
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 101,
          method: 'tools/call',
          params: {
            _meta: modernMeta,
            name: 'healthCheck',
            arguments: { unexpectedField: true },
          },
        }),
      }),
    )
    const modernCallBody = (await invalidModernCall.json()) as {
      result: { isError: boolean; structuredContent?: { success: boolean; error: string } }
    }
    expect(invalidModernCall.status).toBe(200)
    expect(modernCallBody.result.isError).toBe(true)
    expect(modernCallBody.result.structuredContent?.success).toBe(false)

    const rootProjCall = await server.handleRequest(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: headers('tools/call', { 'Mcp-Name': 'get-root-openapi-projection' }),
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 102,
          method: 'tools/call',
          params: {
            _meta: modernMeta,
            name: 'get-root-openapi-projection',
            arguments: {},
          },
        }),
      }),
    )
    const rootProjBody = (await rootProjCall.json()) as {
      result: { isError: boolean; structuredContent?: { validation?: { valid: boolean } } }
    }
    expect(rootProjCall.status).toBe(200)
    expect(rootProjBody.result.isError).toBe(false)
    expect(rootProjBody.result.structuredContent?.validation?.valid).toBe(true)
  })

  test('validates Origin headers consistently across root /mcp and table /sub/:tableId/mcp and rejects malformed UTF-8 base64 Mcp-Name', async () => {
    // Valid ASCII base64 sentinel works and malformed UTF-8 sequences fail cleanly
    const invalidUtf8Base64 = `=?base64?${Buffer.from([0xff, 0xfe, 0xfd]).toString('base64')}?=`
    expect(decodeMcpNameHeader(invalidUtf8Base64)).toHaveProperty('error')

    expect(isValidMcpOrigin('http://localhost:4141', {})).toBe(true)
    expect(isValidMcpOrigin('http://[::1]:4141', {})).toBe(true)
    expect(isValidMcpOrigin('null', {})).toBe(true)
    expect(isValidMcpOrigin('https://evil.example', {})).toBe(false)
    expect(
      isValidMcpOrigin('https://app.example.com', {
        BUN_GRAPH_DB_ALLOWED_ORIGINS: 'https://app.example.com',
      }),
    ).toBe(true)

    const rootServer = new McpHttpServer('http://localhost:4000/graphql')
    const blockedRoot = await rootServer.handleRequest(
      new Request('http://localhost/mcp', {
        method: 'GET',
        headers: { Origin: 'https://evil.example' },
      }),
    )
    expect(blockedRoot.status).toBe(403)

    const previousAllowedOrigins = process.env.BUN_GRAPH_DB_ALLOWED_ORIGINS
    try {
      process.env.BUN_GRAPH_DB_ALLOWED_ORIGINS = 'https://app.example.com'
      const allowedRoot = await rootServer.handleRequest(
        new Request('http://localhost/mcp', {
          method: 'GET',
          headers: { Origin: 'https://app.example.com' },
        }),
      )
      expect(allowedRoot.status).toBe(200)
      const allowedRootJson = (await allowedRoot.json()) as {
        modernCapabilities?: Record<string, unknown>
        legacyCapabilities?: Record<string, unknown>
      }
      expect(allowedRootJson.modernCapabilities).toEqual({ tools: {} })
      expect(allowedRootJson.legacyCapabilities).toEqual({ tools: {}, logging: {} })

      const tableRoutes = createMcpRoutes({
        graphqlEndpoint: 'http://localhost:4000/graphql',
        restApiBaseUrl: 'http://localhost:4000/api',
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              data: {
                byId: { id: 'alpha', identifier: 'alpha' },
                byIdentifier: { id: 'alpha', identifier: 'alpha' },
                table: { id: 'alpha', identifier: 'alpha', description: 'Alpha' },
                searchTemplates: { templates: [] },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      })

      const blockedTable = await tableRoutes.handleTableMcpRequest(
        new Request('http://localhost/sub/alpha/mcp', {
          method: 'GET',
          headers: { Origin: 'https://evil.example' },
        }),
      )
      expect(blockedTable.status).toBe(403)

      const methodNotAllowed = await tableRoutes.handleTableMcpRequest(
        new Request('http://localhost/sub/alpha/mcp', { method: 'DELETE' }),
      )
      expect(methodNotAllowed.status).toBe(405)
      expect(methodNotAllowed.headers.get('Allow')).toBe('POST, GET')

      const badContentType = await tableRoutes.handleTableMcpRequest(
        new Request('http://localhost/sub/alpha/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: '{}',
        }),
      )
      expect(badContentType.status).toBe(415)

      const allowedTableGet = await tableRoutes.handleTableMcpRequest(
        new Request('http://localhost/sub/alpha/mcp', {
          method: 'GET',
          headers: { Origin: 'https://app.example.com' },
        }),
      )
      expect(allowedTableGet.status).toBe(200)
      expect(await allowedTableGet.json()).toMatchObject({
        name: 'Bun Graph Database - Table alpha MCP',
        protocolVersion: MODERN_MCP_PROTOCOL_VERSION,
        capabilities: { tools: {}, logging: {} },
        modernCapabilities: { tools: {} },
        legacyCapabilities: { tools: {}, logging: {} },
      })
    } finally {
      if (previousAllowedOrigins === undefined) {
        delete process.env.BUN_GRAPH_DB_ALLOWED_ORIGINS
      } else {
        process.env.BUN_GRAPH_DB_ALLOWED_ORIGINS = previousAllowedOrigins
      }
    }
  })
})

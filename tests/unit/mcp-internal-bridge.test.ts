import { describe, expect, test } from 'bun:test'
import { RestApiClient } from '../../src/application/services/RestApiClient'
import { GraphQLOperationExecutor, type FetchLike } from '../../src/models/GraphQLOperation'
import { McpToolController } from '../../src/presentation/http/controllers/McpToolController'
import { TableMcpServer } from '../../src/presentation/mcp/factory/TableMcpServer'

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
}

describe('MCP internal loopback & in-process bridge credential', () => {
  test('propagates the configured bearer credential to local GraphQL and REST calls', async () => {
    const receivedAuthorization: string[] = []
    const localServer = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch(request) {
        receivedAuthorization.push(request.headers.get('Authorization') || '')
        return Response.json({ data: { healthCheck: { status: 'ok' } }, success: true })
      },
    })
    const token = 'test-internal-bridge-token'
    const baseUrl = `http://127.0.0.1:${localServer.port}`

    try {
      const graphql = new GraphQLOperationExecutor(`${baseUrl}/graphql`, token)
      const rest = new RestApiClient(`${baseUrl}/api`, token)

      await graphql.execute({
        operationName: 'HealthCheck',
        operationType: 'query',
        query: 'query HealthCheck { __typename }',
        variables: {},
      })
      await rest.healthCheck()

      expect(receivedAuthorization).toEqual([`Bearer ${token}`, `Bearer ${token}`])
    } finally {
      localServer.stop(true)
    }
  })

  test('dispatches GraphQL, REST, and McpToolController calls in-process via FetchLike without TCP sockets', async () => {
    const dispatchedRequests: Array<{ url: string; auth: string | null }> = []
    const token = 'in-process-bridge-token-0123456789abcdef'
    const inProcessFetch: FetchLike = async (input, init) => {
      const req = input instanceof Request ? input : new Request(String(input), init)
      dispatchedRequests.push({
        url: req.url,
        auth: req.headers.get('Authorization'),
      })
      return Response.json({
        data: {
          tabularSyncStatus: { enabled: false, totalExecutions: 0 },
          healthCheck: { status: 'OK' },
        },
        success: true,
      })
    }

    const graphql = new GraphQLOperationExecutor(
      'http://localhost:4321/graphql',
      token,
      inProcessFetch,
    )
    const rest = new RestApiClient('http://localhost:4321/api', token, inProcessFetch)
    const controller = new McpToolController(
      noopLogger as never,
      4321,
      inProcessFetch,
      token,
    )

    await graphql.execute({
      operationName: 'HealthCheck',
      operationType: 'query',
      query: 'query HealthCheck { healthCheck { status } }',
      variables: {},
    })
    await rest.healthCheck()

    let responsePayload: unknown
    const mockRes = {
      status() {
        return this
      },
      json(payload: unknown) {
        responsePayload = payload
        return this
      },
    }
    await controller.getTabularSyncStatus({ body: {} } as never, mockRes as never)
    expect((responsePayload as { success?: boolean })?.success).toBe(true)

    expect(dispatchedRequests).toEqual([
      { url: 'http://localhost:4321/graphql', auth: `Bearer ${token}` },
      { url: 'http://localhost:4321/api/health', auth: `Bearer ${token}` },
      { url: 'http://localhost:4321/graphql', auth: `Bearer ${token}` },
    ])
  })

  test('TableMcpServer enforces reader role and tableIds scope before dispatching GraphQL', async () => {
    let graphqlCalls = 0
    const inProcessFetch: FetchLike = async () => {
      graphqlCalls++
      return Response.json({
        data: {
          searchTemplates: {
            templates: [
              {
                identifier: 'cross-table-template',
                name: 'Cross Table Query',
                description: 'Reads another table',
                query: 'query CrossTable { table(id: "other-table") { id } }',
                tags: ['table:table-a'],
              },
              {
                identifier: 'disguised-write-template',
                name: 'Disguised Write',
                description: 'Bypasses naive regex via GraphQL comment + brace without space',
                query: '# harmless comment\nmutation{ createNode(input: { tableId: "table-a", content: "sneaky" }) { success } }',
                tags: ['table:table-a'],
              },
            ],
          },
          table: { id: 'table-a', identifier: 'alpha' },
        },
      })
    }

    const server = new TableMcpServer(
      'table-a',
      'http://in-process.local/graphql',
      'http://in-process.local/api',
      {
        fetchImpl: inProcessFetch,
        internalBridgeToken: 'bridge-secret-0123456789abcdef012345',
      },
    )

    await server.initialize()
    const callsAfterInit = graphqlCalls

    // 1. Reader role cannot call write CRUD tool (hidden with -32601 Method not found)
    const readerCrudResponse = await server.handleRequest(
      new Request('http://in-process.local/tables/table-a/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'create-table-table-a-node',
            arguments: { content: 'blocked write' },
          },
        }),
      }),
      { id: 'reader-token', role: 'reader', tableIds: ['table-a'] },
    )
    const readerCrudJson = (await readerCrudResponse.json()) as {
      error?: { code: number; message: string }
    }
    expect(readerCrudJson.error?.code).toBe(-32601)
    expect(graphqlCalls).toBe(callsAfterInit)

    // 2. Reader role cannot execute a template whose anonymous selection calls a write field
    const readerDisguisedResponse = await server.handleRequest(
      new Request('http://in-process.local/tables/table-a/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'disguised-write-template',
            arguments: {},
          },
        }),
      }),
      { id: 'reader-token', role: 'reader', tableIds: ['table-a'] },
    )
    const readerDisguisedJson = (await readerDisguisedResponse.json()) as {
      result?: { isError?: boolean; content?: Array<{ text: string }> }
    }
    expect(readerDisguisedJson.result?.isError).toBe(true)
    expect(readerDisguisedJson.result?.content?.[0]?.text).toContain(
      'reader role cannot execute write operations',
    )
    expect(graphqlCalls).toBe(callsAfterInit)

    // 3. Scoped caller on table-a cannot execute a template targeting other-table
    const crossTableResponse = await server.handleRequest(
      new Request('http://in-process.local/tables/table-a/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'cross-table-template',
            arguments: {},
          },
        }),
      }),
      { id: 'scoped-writer', role: 'writer', tableIds: ['table-a'] },
    )
    const crossTableJson = (await crossTableResponse.json()) as {
      result?: { isError?: boolean; content?: Array<{ text: string }> }
    }
    expect(crossTableJson.result?.isError).toBe(true)
    expect(crossTableJson.result?.content?.[0]?.text).toContain('outside caller table scope')
    expect(graphqlCalls).toBe(callsAfterInit)
  })
})

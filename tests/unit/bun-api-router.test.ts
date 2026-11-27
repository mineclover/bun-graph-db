import { describe, expect, test } from 'vitest'
import { RestApiClient } from '../../src/application/services/RestApiClient'
import type { HttpControllerRequest, HttpControllerResponse } from '../../src/presentation/http/adapters/BunControllerAdapter'
import { API_ENDPOINT_MAPPING } from '../../src/presentation/http/routes/ApiEndpointMapping'
import { createBunApiRouter } from '../../src/presentation/http/routes/BunApiRouter'

function createRouter(overrides: {
  graphDb?: Record<string, unknown>
  attribute?: Record<string, unknown>
  graph?: Record<string, unknown>
} = {}) {
  const logger = { debug() {}, info() {}, warn() {}, error() {} }
  const graphDbController = {
    async updateNode(request: HttpControllerRequest, response: HttpControllerResponse) {
      response.status(202).type('text/plain').send({ nodeId: request.params.nodeId, body: request.body })
    },
    async getNode(request: HttpControllerRequest, response: HttpControllerResponse) {
      response.json({ gotNode: request.params.nodeId })
    },
    async deleteNode(request: HttpControllerRequest, response: HttpControllerResponse) {
      response.json({ deletedNode: request.params.nodeId })
    },
    async createTable(request: HttpControllerRequest, response: { json(value: unknown): unknown }) {
      response.json({ body: request.body })
    },
    async getTable(request: HttpControllerRequest, response: HttpControllerResponse) {
      response.json({ gotTable: request.params.tableId })
    },
    async deleteTable(request: HttpControllerRequest, response: HttpControllerResponse) {
      response.json({ deletedTable: request.params.tableId })
    },
    async searchTables(_request: HttpControllerRequest, response: HttpControllerResponse) {
      response.json({ searchedTables: true })
    },
    async searchNodes(_request: HttpControllerRequest, response: HttpControllerResponse) {
      response.json({ searchedNodes: true })
    },
    async deleteRelation(request: HttpControllerRequest, response: HttpControllerResponse) {
      response.json({ deletedRelation: request.params.relationId })
    },
    async listRelationTypes(_request: HttpControllerRequest, response: HttpControllerResponse) {
      response.json({ listedRelationTypes: true })
    },
    async createRelationType(request: HttpControllerRequest, response: HttpControllerResponse) {
      response.json({ createdRelationType: request.body })
    },
    async exportTemplate(request: HttpControllerRequest, response: HttpControllerResponse) {
      response.json({ exported: request.params.templateIdentifier })
    },
    async importTemplate(request: HttpControllerRequest, response: HttpControllerResponse) {
      response.json({ imported: request.body })
    },
    ...overrides.graphDb,
  }
  const attributeController = {
    async updateAttribute(request: HttpControllerRequest, response: HttpControllerResponse) {
      response.json({ updatedAttribute: request.params.attributeId, body: request.body })
    },
    async deleteAttribute(request: HttpControllerRequest, response: HttpControllerResponse) {
      response.json({ deletedAttribute: request.params.attributeId })
    },
    async getTableAttributes(request: HttpControllerRequest, response: HttpControllerResponse) {
      response.json({ tableId: request.params.tableId })
    },
    async getTableColumns(request: HttpControllerRequest, response: HttpControllerResponse) {
      response.json({ tableColumnsFor: request.params.tableId })
    },
    async configureTableColumn(request: HttpControllerRequest, response: HttpControllerResponse) {
      response.json({
        configuredColumn: {
          tableId: request.params.tableId,
          attributeIdentifier: request.params.attributeIdentifier,
          body: request.body,
        },
      })
    },
    ...overrides.attribute,
  }
  const graphController = {
    async getTableDocs(request: HttpControllerRequest, response: HttpControllerResponse) {
      response.json({ tableDocsFor: request.params.tableId ?? null })
    },
    async getNodeRelations(request: HttpControllerRequest, response: HttpControllerResponse) {
      response.json({ nodeRelationsFor: request.params.nodeId })
    },
    async searchRelations(_request: HttpControllerRequest, response: HttpControllerResponse) {
      response.json({ searchedRelations: true })
    },
    ...overrides.graph,
  }

  return createBunApiRouter({
    logger: logger as never,
    graphDbController: graphDbController as never,
    attributeController: attributeController as never,
    graphController: graphController as never,
    mcpToolController: {} as never,
  })
}

describe('Bun API router', () => {
  test('preserves the direct health response without invoking a controller', async () => {
    const router = createRouter({
      graphDb: {
        async healthCheck() {
          throw new Error('health controller must not be called')
        },
      },
    })

    const response = await router(new Request('http://localhost/api/health'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(await response.json()).toMatchObject({
      success: true,
      data: { status: 'OK', database: 'Connected', version: '1.0.0' },
    })
  })

  test('adapts JSON bodies and dynamic node parameters for controller calls', async () => {
    const router = createRouter()
    const response = await router(
      new Request('http://localhost/api/nodes/node-123?ignored=value', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'updated' }),
      }),
    )

    expect(response.status).toBe(202)
    expect(response.headers.get('content-type')).toBe('text/plain')
    expect(await response.json()).toEqual({ nodeId: 'node-123', body: { title: 'updated' } })
  })

  test('uses an empty body for malformed JSON, matching the previous direct Bun handler', async () => {
    const router = createRouter()
    const response = await router(
      new Request('http://localhost/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid',
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ body: {} })
  })

  test('keeps unknown API routes as a plain 404 response', async () => {
    const router = createRouter()
    const response = await router(new Request('http://localhost/api/not-a-route'))

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type') ?? '').toMatch(/^(|text\/plain;charset=UTF-8)$/i)
    expect(await response.text()).toBe('Not Found')
  })

  test('wires previously unmounted controller routes and enforces strict /api/nodes/:nodeId matching', async () => {
    const router = createRouter()

    expect(await (await router(new Request('http://localhost/api/tables/t1/docs'))).json()).toEqual({
      tableDocsFor: 't1',
    })
    expect(await (await router(new Request('http://localhost/api/nodes/n1/relations'))).json()).toEqual({
      nodeRelationsFor: 'n1',
    })
    expect(await (await router(new Request('http://localhost/api/relations/search'))).json()).toEqual({
      searchedRelations: true,
    })
    expect(await (await router(new Request('http://localhost/api/templates/tpl-1/export'))).json()).toEqual({
      exported: 'tpl-1',
    })
    expect(
      await (
        await router(
          new Request('http://localhost/api/templates/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonData: '{}' }),
          }),
        )
      ).json(),
    ).toEqual({ imported: { jsonData: '{}' } })
    expect(
      await (
        await router(
          new Request('http://localhost/api/attributes/attr-1', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: 'updated' }),
          }),
        )
      ).json(),
    ).toEqual({ updatedAttribute: 'attr-1', body: { description: 'updated' } })
    expect(
      await (
        await router(
          new Request('http://localhost/api/attributes/attr-1', {
            method: 'DELETE',
          }),
        )
      ).json(),
    ).toEqual({ deletedAttribute: 'attr-1' })
    expect(await (await router(new Request('http://localhost/api/attributes/tables/t1'))).json()).toEqual({
      tableId: 't1',
    })
    expect(await (await router(new Request('http://localhost/api/tables/t1'))).json()).toEqual({
      gotTable: 't1',
    })
    expect(
      await (await router(new Request('http://localhost/api/tables/t1', { method: 'DELETE' }))).json(),
    ).toEqual({ deletedTable: 't1' })
    expect(await (await router(new Request('http://localhost/api/tables/search'))).json()).toEqual({
      searchedTables: true,
    })
    expect(await (await router(new Request('http://localhost/api/tables/t1/columns'))).json()).toEqual({
      tableColumnsFor: 't1',
    })
    expect(
      await (
        await router(
          new Request('http://localhost/api/tables/t1/columns/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ facetable: true }),
          }),
        )
      ).json(),
    ).toEqual({
      configuredColumn: { tableId: 't1', attributeIdentifier: 'status', body: { facetable: true } },
    })
    expect(await (await router(new Request('http://localhost/api/nodes/n1'))).json()).toEqual({
      gotNode: 'n1',
    })
    expect(
      await (await router(new Request('http://localhost/api/nodes/n1', { method: 'DELETE' }))).json(),
    ).toEqual({ deletedNode: 'n1' })
    expect(await (await router(new Request('http://localhost/api/nodes/search'))).json()).toEqual({
      searchedNodes: true,
    })
    expect(
      await (await router(new Request('http://localhost/api/relations/r1', { method: 'DELETE' }))).json(),
    ).toEqual({ deletedRelation: 'r1' })
    expect(await (await router(new Request('http://localhost/api/relation-types'))).json()).toEqual({
      listedRelationTypes: true,
    })
    expect(
      await (
        await router(
          new Request('http://localhost/api/relation-types', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: 'cites' }),
          }),
        )
      ).json(),
    ).toEqual({ createdRelationType: { identifier: 'cites' } })

    const nestedNodePatch = await router(
      new Request('http://localhost/api/nodes/n1/unknown', {
        method: 'PATCH',
        body: '{}',
      }),
    )
    expect(nestedNodePatch.status).toBe(404)

    const nestedNodeAttributes = await router(new Request('http://localhost/api/nodes/n1/extra/attributes'))
    expect(nestedNodeAttributes.status).toBe(404)

    const nestedTableExport = await router(
      new Request('http://localhost/api/tables/t1/extra/export', { method: 'POST' }),
    )
    expect(nestedTableExport.status).toBe(404)
  })

  test('RestApiClient forwards PUT on updateNode, omits empty DELETE body, and keeps DELETE JSON body on removeNodeAttribute', async () => {
    const captured: Array<{ url: string; method?: string; body?: string }> = []
    const client = new RestApiClient('http://localhost:4141/api', undefined, async (input, init) => {
      captured.push({
        url: String(input),
        method: init?.method,
        body: typeof init?.body === 'string' ? init.body : undefined,
      })
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })

    await client.callMcpTool('updateNode', { nodeId: 'n1', content: 'next' })
    await client.callMcpTool('removeNodeAttribute', { nodeId: 'n1', attributeId: 'a1' })
    await client.callMcpTool('deleteNode', { nodeId: 'n1' })

    expect(captured[0]).toEqual({
      url: 'http://localhost:4141/api/nodes/n1',
      method: 'PUT',
      body: JSON.stringify({ content: 'next' }),
    })
    expect(captured[1]).toEqual({
      url: 'http://localhost:4141/api/node-attributes',
      method: 'DELETE',
      body: JSON.stringify({ nodeId: 'n1', attributeId: 'a1' }),
    })
    expect(captured[2]).toEqual({
      url: 'http://localhost:4141/api/nodes/n1',
      method: 'DELETE',
      body: undefined,
    })
  })

  test('maps every /api/mcp-tools/call entry to POST', () => {
    const mcpCallEntries = Object.entries(API_ENDPOINT_MAPPING).filter(([, target]) =>
      target.endsWith('/api/mcp-tools/call'),
    )
    expect(mcpCallEntries.length).toBeGreaterThan(0)
    for (const [toolName, target] of mcpCallEntries) {
      expect(target, `${toolName} must use POST /api/mcp-tools/call`).toBe('POST /api/mcp-tools/call')
    }
  })
})

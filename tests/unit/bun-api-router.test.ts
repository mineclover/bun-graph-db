import { describe, expect, test } from 'bun:test'
import type { HttpControllerRequest, HttpControllerResponse } from '../../src/presentation/http/adapters/BunControllerAdapter'
import { createBunApiRouter } from '../../src/presentation/http/routes/BunApiRouter'

function createRouter(overrides: Record<string, unknown> = {}) {
  const logger = { debug() {}, info() {}, warn() {}, error() {} }
  const graphDbController = {
    async updateNode(request: HttpControllerRequest, response: HttpControllerResponse) {
      response.status(202).type('text/plain').send({ nodeId: request.params.nodeId, body: request.body })
    },
    async createTable(request: HttpControllerRequest, response: { json(value: unknown): unknown }) {
      response.json({ body: request.body })
    },
    ...overrides,
  }

  return createBunApiRouter({
    logger: logger as never,
    graphDbController: graphDbController as never,
    attributeController: {} as never,
    graphController: {} as never,
    mcpToolController: {} as never,
  })
}

describe('Bun API router', () => {
  test('preserves the direct health response without invoking a controller', async () => {
    const router = createRouter({
      async healthCheck() {
        throw new Error('health controller must not be called')
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
    expect(response.headers.get('content-type')).toBeNull()
    expect(await response.text()).toBe('Not Found')
  })
})

import { describe, expect, test } from 'bun:test'
import { createBunControllerContext } from '../../src/presentation/http/adapters/BunControllerAdapter'

describe('BunControllerAdapter', () => {
  test('creates a bodyless 304 response while preserving validator headers', async () => {
    const context = await createBunControllerContext(new Request('http://localhost/tables/1/openapi'))
    context.response.setHeader?.('ETag', '"projection-hash"')
    context.response.status(304).send('')

    const response = context.toResponse()

    expect(response.status).toBe(304)
    expect(response.headers.get('etag')).toBe('"projection-hash"')
    expect(response.headers.has('content-type')).toBe(false)
    expect(await response.text()).toBe('')
  })
})

/**
 * Minimal HTTP contract shared by the Bun adapter and REST controllers.
 *
 * Controllers deliberately depend on this small surface instead of a server
 * framework. Express requests/responses are structurally compatible, so the
 * legacy Express router can continue to use the same controllers.
 */
// biome-ignore lint/suspicious/noExplicitAny: Endpoint-specific controller validation narrows JSON request bodies.
export interface HttpControllerRequest<TParams extends object = Record<string, string>, TBody = any> {
  method: string
  url: string
  path: string
  query: Record<string, unknown>
  params: TParams
  headers: Record<string, string | string[] | undefined>
  body: TBody
}

export interface HttpControllerResponse {
  status(code: number): this
  type(contentType: string): this
  json(data: unknown): this
  send(data: unknown): this
}

export type HttpControllerHandler = (
  request: HttpControllerRequest,
  response: HttpControllerResponse,
) => void | Promise<void>

export interface BunControllerContext {
  request: HttpControllerRequest
  response: HttpControllerResponse
  toResponse(): Response
}

/**
 * Adapts a Web-standard Request to the controller contract and captures its
 * response. Body parsing intentionally mirrors the old direct handler:
 * only POST, PUT, and PATCH bodies are parsed and malformed JSON becomes {}.
 */
export async function createBunControllerContext(request: Request, params: Record<string, string> = {}): Promise<BunControllerContext> {
  const url = new URL(request.url)
  const method = request.method
  let body: unknown = {}

  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    try {
      body = await request.json()
    } catch {
      body = {}
    }
  }

  let responseData: unknown
  let statusCode = 200
  let contentType = 'application/json'

  const response: HttpControllerResponse = {
    status(code) {
      statusCode = code
      return this
    },
    type(nextContentType) {
      contentType = nextContentType
      return this
    },
    json(data) {
      responseData = data
      return this
    },
    send(data) {
      responseData = data
      return this
    },
  }

  return {
    request: {
      method,
      url: url.pathname + url.search,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      params,
      headers: Object.fromEntries(request.headers.entries()),
      body,
    },
    response,
    toResponse: () => {
      const responseBody = typeof responseData === 'string' ? responseData : JSON.stringify(responseData)
      return new Response(responseBody, {
        status: statusCode,
        headers: { 'Content-Type': contentType },
      })
    },
  }
}

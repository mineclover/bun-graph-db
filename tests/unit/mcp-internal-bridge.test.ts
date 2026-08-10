import { describe, expect, test } from 'bun:test'
import { RestApiClient } from '../../src/application/services/RestApiClient'
import { GraphQLOperationExecutor } from '../../src/models/GraphQLOperation'

describe('MCP internal loopback bridge credential', () => {
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
})

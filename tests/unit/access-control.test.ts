import { describe, expect, test } from 'vitest'
import { AccessControl, authorizeExternalRequest } from '../../src/application/security/AccessControl'

function request(headers: HeadersInit = {}): Request {
  return new Request('http://localhost/sub/alpha/mcp', { headers })
}

const tableWrite = {
  action: 'write' as const,
  endpoint: '/sub/alpha/mcp',
  tableId: 'alpha',
}

describe('AccessControl', () => {
  test('requires credentials when enabled', () => {
    const control = AccessControl.fromEnvironment({ NODE_ENV: 'production' })
    const decision = control.authorize(request(), tableWrite)

    expect(decision).toEqual({ allowed: false, status: 401, code: 'authentication_required' })
  })

  test('allows a table-scoped writer only for its table', () => {
    const control = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({ writerToken: { id: 'writer-a', role: 'writer', tableIds: ['alpha'] } }),
    })

    const allowed = control.authorize(request({ Authorization: 'Bearer writerToken' }), tableWrite)
    const hidden = control.authorize(request({ Authorization: 'Bearer writerToken' }), { ...tableWrite, tableId: 'beta' })

    expect(allowed).toEqual({
      allowed: true,
      principal: { id: 'writer-a', role: 'writer', tableIds: ['alpha'] },
    })
    expect(hidden).toEqual({ allowed: false, status: 404, code: 'not_found' })
  })

  test('does not let a reader perform writes', () => {
    const control = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({ readerToken: { role: 'reader', tableIds: ['*'] } }),
    })
    const decision = control.authorize(request({ 'X-API-Key': 'readerToken' }), tableWrite)

    expect(decision).toEqual({ allowed: false, status: 403, code: 'forbidden' })
  })

  test('rejects disallowed browser origins before credentials are evaluated', () => {
    const control = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ALLOWED_ORIGINS: 'https://app.example.test',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({ adminToken: { role: 'admin' } }),
    })
    const decision = control.authorize(
      request({ Authorization: 'Bearer adminToken', Origin: 'https://attacker.example.test' }),
      tableWrite,
    )

    expect(decision).toEqual({ allowed: false, status: 404, code: 'not_found' })
  })

  test('applies a per-principal rate limit', () => {
    const control = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({ writerToken: { role: 'writer' } }),
      BUN_GRAPH_DB_RATE_LIMIT_ENABLED: 'true',
      BUN_GRAPH_DB_RATE_LIMIT_MAX: '1',
      BUN_GRAPH_DB_RATE_LIMIT_WINDOW_MS: '60000',
    })

    expect(control.authorize(request({ Authorization: 'Bearer writerToken' }), tableWrite).allowed).toBe(true)
    expect(control.authorize(request({ Authorization: 'Bearer writerToken' }), tableWrite)).toEqual({
      allowed: false,
      status: 429,
      code: 'rate_limited',
    })
  })

  test('classifies MCP tool calls and GraphQL mutations as writes', async () => {
    const control = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({
        reader: { id: 'reader', role: 'reader' },
        writer: { id: 'writer', role: 'writer' },
      }),
    })

    const list = await authorizeExternalRequest(
      control,
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: { Authorization: 'Bearer reader' },
        body: JSON.stringify({ method: 'tools/list' }),
      }),
    )
    expect(list.allowed).toBe(true)

    const healthCheck = await authorizeExternalRequest(
      control,
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: { Authorization: 'Bearer reader' },
        body: JSON.stringify({ method: 'tools/call', params: { name: 'healthCheck' } }),
      }),
      (name) => (name === 'healthCheck' ? { action: 'read' } : undefined),
    )
    expect(healthCheck.allowed).toBe(true)

    const toolCall = await authorizeExternalRequest(
      control,
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: { Authorization: 'Bearer reader' },
        body: JSON.stringify({ method: 'tools/call', params: { name: 'createTable' } }),
      }),
      (name) => (name === 'createTable' ? { action: 'write' } : undefined),
    )
    expect(toolCall).toMatchObject({ allowed: false, status: 403, code: 'forbidden' })

    const mutation = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer writer' },
        body: JSON.stringify({ query: 'mutation { createNode(input: {}) { id } }' }),
      }),
    )
    expect(mutation.allowed).toBe(true)
  })

  test('applies table scope to root MCP calls when the contract extracts a table argument', async () => {
    const control = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({
        writer: { role: 'writer', tableIds: ['alpha'] },
      }),
    })

    const decision = await authorizeExternalRequest(
      control,
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: { Authorization: 'Bearer writer' },
        body: JSON.stringify({
          method: 'tools/call',
          params: { name: 'createAttribute', arguments: { tableId: 'beta' } },
        }),
      }),
      (name, argumentsValue) => {
        if (name !== 'createAttribute' || !argumentsValue || typeof argumentsValue !== 'object') return undefined
        return { action: 'write', tableId: (argumentsValue as { tableId?: string }).tableId }
      },
    )

    expect(decision).toEqual({ allowed: false, status: 404, code: 'not_found' })
  })

  test('applies table scope to GraphQL variables and literal input arguments', async () => {
    const control = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({
        writer: { role: 'writer', tableIds: ['alpha'] },
      }),
    })

    const variableDecision = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer writer' },
        body: JSON.stringify({
          query: 'mutation Update($input: UpdateNodeInput!) { updateNode(input: $input) { id } }',
          variables: { input: { tableId: 'beta' } },
        }),
      }),
    )
    expect(variableDecision).toEqual({ allowed: false, status: 404, code: 'not_found' })

    const literalDecision = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer writer' },
        body: JSON.stringify({
          query: 'mutation { createNode(input: { tableIdentifier: "beta" }) { id } }',
        }),
      }),
    )
    expect(literalDecision).toEqual({ allowed: false, status: 404, code: 'not_found' })
  })

  test('does not allow REST to bypass authentication or table-scoped write policy', async () => {
    const control = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({
        writer: { role: 'writer', tableIds: ['alpha'] },
      }),
    })
    const body = JSON.stringify({ tableId: 'beta', content: 'restricted write' })

    const unauthenticated = await authorizeExternalRequest(
      control,
      new Request('http://localhost/api/nodes', { method: 'POST', body }),
    )
    expect(unauthenticated).toEqual({ allowed: false, status: 401, code: 'authentication_required' })

    const outOfScope = await authorizeExternalRequest(
      control,
      new Request('http://localhost/api/nodes', {
        method: 'POST',
        headers: { Authorization: 'Bearer writer', 'Content-Type': 'application/json' },
        body,
      }),
    )
    expect(outOfScope).toEqual({ allowed: false, status: 404, code: 'not_found' })
  })

  test('resolves node ownership before allowing ID-only GraphQL reads or mutations', async () => {
    const control = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({
        writer: { role: 'writer', tableIds: ['alpha'] },
        reader: { role: 'reader', tableIds: ['alpha'] },
      }),
    })
    const resolver = { resolveNodeTableId: async () => 'beta' }

    const mutation = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer writer' },
        body: JSON.stringify({ query: 'mutation { deleteNode(id: "node-in-beta") { success } }' }),
      }),
      undefined,
      resolver,
    )
    expect(mutation).toEqual({ allowed: false, status: 404, code: 'not_found' })

    const read = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer reader' },
        body: JSON.stringify({ query: 'query { node(id: "node-in-beta") { id } }' }),
      }),
      undefined,
      resolver,
    )
    expect(read).toEqual({ allowed: false, status: 404, code: 'not_found' })

    const missing = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer writer' },
        body: JSON.stringify({ query: 'mutation { deleteNode(id: "missing-node") { success } }' }),
      }),
      undefined,
      { resolveNodeTableId: async () => undefined },
    )
    expect(missing).toEqual({ allowed: false, status: 404, code: 'not_found' })
  })

  test('accepts only the configured internal bridge bearer token as the MCP bridge principal', async () => {
    const bridgeToken = 'a'.repeat(48)
    const control = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN: bridgeToken,
    })

    const decision = await authorizeExternalRequest(
      control,
      new Request('http://localhost/api/tables', {
        method: 'POST',
        headers: { Authorization: `Bearer ${bridgeToken}` },
        body: JSON.stringify({ identifier: 'bridge-created' }),
      }),
    )
    expect(decision).toEqual({
      allowed: true,
      principal: { id: 'internal-mcp-bridge', role: 'admin', tableIds: ['*'] },
    })
  })

  test('rejects oversized requests and GraphQL queries beyond the configured complexity', async () => {
    const oversizedControl = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({ reader: { role: 'reader' } }),
      BUN_GRAPH_DB_MAX_REQUEST_BYTES: '1',
    })
    const oversized = await authorizeExternalRequest(
      oversizedControl,
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: { Authorization: 'Bearer reader' },
        body: JSON.stringify({ method: 'tools/list' }),
      }),
    )
    expect(oversized).toMatchObject({ allowed: false, status: 413, code: 'request_too_large' })

    const complexityControl = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({ reader: { role: 'reader' } }),
      BUN_GRAPH_DB_GRAPHQL_MAX_COMPLEXITY: '1',
    })
    const tooComplex = await authorizeExternalRequest(
      complexityControl,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer reader' },
        body: JSON.stringify({ query: 'query { first { second } }' }),
      }),
    )
    expect(tooComplex).toMatchObject({ allowed: false, status: 400, code: 'query_too_complex' })
  })

  test('blocks unused GraphQL variable spoofing, multi-root-field scope piggybacking, and non-admin DDL/backup fields', async () => {
    const control = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({
        scopedReader: { id: 'reader-alpha', role: 'reader', tableIds: ['alpha'] },
        scopedWriter: { id: 'writer-alpha', role: 'writer', tableIds: ['alpha'] },
        globalWriter: { id: 'writer-global', role: 'writer', tableIds: ['*'] },
        adminToken: { id: 'admin-1', role: 'admin', tableIds: ['*'] },
      }),
    })

    // 1. Unused top-level variables must not grant table scope to global queries/mutations
    const unusedVarQuery = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer scopedReader' },
        body: JSON.stringify({
          query: 'query { tables { nodes { id } } }',
          variables: { tableId: 'alpha' },
        }),
      }),
    )
    expect(unusedVarQuery).toEqual({ allowed: false, status: 403, code: 'forbidden' })

    const unusedVarDeleteTable = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer scopedWriter' },
        body: JSON.stringify({
          query: 'mutation { deleteTable(id: "99") { success } }',
          variables: { tableId: 'alpha' },
        }),
      }),
    )
    expect(unusedVarDeleteTable).toEqual({ allowed: false, status: 403, code: 'forbidden' })

    // 2. Multi-root-field scope piggybacking must be denied when any root field is unscoped
    const piggybackQuery = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer scopedReader' },
        body: JSON.stringify({
          query: 'query { searchNodes(filter: { tableId: "alpha" }) { totalCount } tables { nodes { id } } }',
        }),
      }),
    )
    expect(piggybackQuery).toEqual({ allowed: false, status: 403, code: 'forbidden' })

    const piggybackMutation = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer scopedWriter' },
        body: JSON.stringify({
          query:
            'mutation { createNode(input: { tableId: "alpha", content: "ok" }) { node { id } } createTable(input: { identifier: "sneaky" }) { table { id } } }',
        }),
      }),
    )
    expect(piggybackMutation).toEqual({ allowed: false, status: 403, code: 'forbidden' })

    // 3. Filesystem backup/restore and global DDL root fields require admin even when tableIds are passed
    for (const token of ['scopedWriter', 'globalWriter']) {
      const exportDecision = await authorizeExternalRequest(
        control,
        new Request('http://localhost/graphql', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            query: 'mutation { exportJsonl(options: { outputDir: "/tmp/out", tableIds: ["alpha"] }) { success } }',
          }),
        }),
      )
      expect(exportDecision).toEqual({ allowed: false, status: 403, code: 'forbidden' })

      const inspectDecision = await authorizeExternalRequest(
        control,
        new Request('http://localhost/graphql', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            query: 'query { inspectJsonlBackup(inputDir: "/tmp/out") { valid } }',
          }),
        }),
      )
      expect(inspectDecision).toEqual({ allowed: false, status: 403, code: 'forbidden' })
    }

    const adminExport = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer adminToken' },
        body: JSON.stringify({
          query: 'mutation { exportJsonl(options: { outputDir: "/tmp/out" }) { success } }',
        }),
      }),
    )
    expect(adminExport.allowed).toBe(true)
  })

  test('allows table-scoped callers to inspect their own table root fields and reconciles numeric IDs with identifiers', async () => {
    const control = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({
        ordersReader: { id: 'orders-reader', role: 'reader', tableIds: ['orders'] },
      }),
    })
    const resolver = {
      resolveNodeTableId: async (nodeId: string) => (nodeId === '42' ? '1' : nodeId === '99' ? '2' : undefined),
      resolveTableIdentity: async (ref: string) => {
        if (ref === '1' || ref === 'orders') return { id: '1', identifier: 'orders' }
        if (ref === '2' || ref === 'payments') return { id: '2', identifier: 'payments' }
        return undefined
      },
    }

    const ownByIdentifier = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer ordersReader' },
        body: JSON.stringify({ query: 'query { tableByIdentifier(identifier: "orders") { id } }' }),
      }),
      undefined,
      resolver,
    )
    expect(ownByIdentifier.allowed).toBe(true)

    const ownByNumericId = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer ordersReader' },
        body: JSON.stringify({ query: 'query { table(id: "1") { id } }' }),
      }),
      undefined,
      resolver,
    )
    expect(ownByNumericId.allowed).toBe(true)

    const ownNodeById = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer ordersReader' },
        body: JSON.stringify({ query: 'query { node(id: "42") { id } }' }),
      }),
      undefined,
      resolver,
    )
    expect(ownNodeById.allowed).toBe(true)

    const otherTable = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer ordersReader' },
        body: JSON.stringify({ query: 'query { table(id: "2") { id } }' }),
      }),
      undefined,
      resolver,
    )
    expect(otherTable).toEqual({ allowed: false, status: 404, code: 'not_found' })

    const otherNode = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer ordersReader' },
        body: JSON.stringify({ query: 'query { node(id: "99") { id } }' }),
      }),
      undefined,
      resolver,
    )
    expect(otherNode).toEqual({ allowed: false, status: 404, code: 'not_found' })
  })

  test('extracts hierarchy node arguments (rootNodeId, nodeIdA/B, newParentId) and gates moveHierarchyNode', async () => {
    const control = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({
        readerAlpha: { id: 'reader-a', role: 'reader', tableIds: ['1'] },
        writerAlpha: { id: 'writer-a', role: 'writer', tableIds: ['1'] },
      }),
    })
    const resolver = {
      resolveNodeTableId: async (nodeId: string) =>
        nodeId === '10' || nodeId === '11' ? '1' : nodeId === '20' ? '2' : undefined,
      resolveTableIdentity: async (ref: string) =>
        ref === '1' ? { id: '1', identifier: 'alpha' } : ref === '2' ? { id: '2', identifier: 'beta' } : undefined,
    }

    const lcaSameTable = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer readerAlpha' },
        body: JSON.stringify({
          query: 'query { getLowestCommonAncestor(nodeIdA: "10", nodeIdB: "11") { found } }',
        }),
      }),
      undefined,
      resolver,
    )
    expect(lcaSameTable.allowed).toBe(true)

    const lcaCrossTable = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer readerAlpha' },
        body: JSON.stringify({
          query: 'query { getLowestCommonAncestor(nodeIdA: "10", nodeIdB: "20") { found } }',
        }),
      }),
      undefined,
      resolver,
    )
    expect(lcaCrossTable).toEqual({ allowed: false, status: 404, code: 'not_found' })

    const ownMove = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer writerAlpha' },
        body: JSON.stringify({
          query: 'mutation { moveHierarchyNode(input: { nodeId: "11", newParentId: "10" }) { success } }',
        }),
      }),
      undefined,
      resolver,
    )
    expect(ownMove.allowed).toBe(true)

    const crossParentMove = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer writerAlpha' },
        body: JSON.stringify({
          query: 'mutation { moveHierarchyNode(input: { nodeId: "11", newParentId: "20" }) { success } }',
        }),
      }),
      undefined,
      resolver,
    )
    expect(crossParentMove).toEqual({ allowed: false, status: 404, code: 'not_found' })
  })

  test('allows anonymous /health and /api/health liveness while allowing GET /mcp for authenticated readers', async () => {
    const control = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({
        reader: { id: 'ro', role: 'reader', tableIds: ['*'] },
      }),
    })

    const rootHealth = await authorizeExternalRequest(control, new Request('http://localhost/health'))
    const apiHealth = await authorizeExternalRequest(control, new Request('http://localhost/api/health'))
    expect(rootHealth).toEqual({ allowed: true })
    expect(apiHealth).toEqual({ allowed: true })

    const unauthMcpGet = await authorizeExternalRequest(control, new Request('http://localhost/mcp'))
    expect(unauthMcpGet).toEqual({ allowed: false, status: 401, code: 'authentication_required' })

    const authMcpGet = await authorizeExternalRequest(
      control,
      new Request('http://localhost/mcp', { headers: { Authorization: 'Bearer reader' } }),
    )
    expect(authMcpGet).toEqual({
      allowed: true,
      principal: { id: 'ro', role: 'reader', tableIds: ['*'] },
    })
  })

  test('fails closed on DELETE /api/relations/:id when resolveRelationTableId is omitted', async () => {
    const control = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({
        writer: { id: 'writer-alpha', role: 'writer', tableIds: ['alpha'] },
        admin: { id: 'admin-1', role: 'admin', tableIds: ['*'] },
      }),
    })

    const writerDenied = await authorizeExternalRequest(
      control,
      new Request('http://localhost/api/relations/rel-1', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer writer' },
      }),
    )
    expect(writerDenied).toEqual({ allowed: false, status: 403, code: 'forbidden' })

    const adminAllowed = await authorizeExternalRequest(
      control,
      new Request('http://localhost/api/relations/rel-1', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer admin' },
      }),
    )
    expect(adminAllowed.allowed).toBe(true)
  })

  test('enforces tableDocumentation, GraphQL relation scoping, and admin-only sync/system queries', async () => {
    const control = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({
        readerAlpha: { id: 'reader-alpha', role: 'reader', tableIds: ['alpha'] },
        writerAlpha: { id: 'writer-alpha', role: 'writer', tableIds: ['alpha'] },
        admin: { id: 'admin-1', role: 'admin', tableIds: ['*'] },
      }),
    })

    const resolver = {
      async resolveTableIdentity(tableRef: string) {
        if (tableRef === 'alpha' || tableRef === 't-alpha') {
          return { id: 't-alpha', identifier: 'alpha' }
        }
        if (tableRef === 'beta' || tableRef === 't-beta') {
          return { id: 't-beta', identifier: 'beta' }
        }
        return null
      },
      async resolveRelationTableId(relationId: string) {
        if (relationId === 'rel-alpha') return 'alpha'
        if (relationId === 'rel-beta') return 'beta'
        return null
      },
    }

    const ownDoc = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer readerAlpha' },
        body: JSON.stringify({
          query: 'query { tableDocumentation(identifier: "t-alpha") { table { id } } }',
        }),
      }),
      undefined,
      resolver,
    )
    expect(ownDoc.allowed).toBe(true)

    const crossDoc = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer readerAlpha' },
        body: JSON.stringify({
          query: 'query { tableDocumentation(tableId: "t-beta") { table { id } } }',
        }),
      }),
      undefined,
      resolver,
    )
    expect(crossDoc).toEqual({ allowed: false, status: 404, code: 'not_found' })

    const ownRelationRead = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer readerAlpha' },
        body: JSON.stringify({
          query: 'query { nodeRelation(id: "rel-alpha") { id } }',
        }),
      }),
      undefined,
      resolver,
    )
    expect(ownRelationRead.allowed).toBe(true)

    const crossRelationDelete = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer writerAlpha' },
        body: JSON.stringify({
          query: 'mutation { deleteRelation(id: "rel-beta") { success } }',
        }),
      }),
      undefined,
      resolver,
    )
    expect(crossRelationDelete).toEqual({ allowed: false, status: 404, code: 'not_found' })

    const failClosedDeleteWithoutResolver = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer writerAlpha' },
        body: JSON.stringify({
          query: 'mutation { deleteRelation(id: "rel-alpha") { success } }',
        }),
      }),
    )
    expect(failClosedDeleteWithoutResolver).toEqual({ allowed: false, status: 403, code: 'forbidden' })

    const writerTabularStatus = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer writerAlpha' },
        body: JSON.stringify({
          query: 'query { tabularSyncStatus(tableIdentifier: "alpha") { enabled } }',
        }),
      }),
      undefined,
      resolver,
    )
    expect(writerTabularStatus).toEqual({ allowed: false, status: 403, code: 'forbidden' })

    const writerSystemStats = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer writerAlpha' },
        body: JSON.stringify({
          query: 'query { systemStats { memory { used } } }',
        }),
      }),
    )
    expect(writerSystemStats).toEqual({ allowed: false, status: 403, code: 'forbidden' })

    const adminTabularStatus = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer admin' },
        body: JSON.stringify({
          query: 'query { tabularSyncStatus(tableIdentifier: "alpha") { enabled } }',
        }),
      }),
      undefined,
      resolver,
    )
    expect(adminTabularStatus.allowed).toBe(true)
  })
})

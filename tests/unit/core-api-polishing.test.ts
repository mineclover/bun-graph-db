import { describe, expect, test } from 'vitest'
import { AccessControl, authorizeExternalRequest } from '@/application/security/AccessControl.js'
import { resolveEmbeddingColumnExecutionOptions, type TableColumnProfile } from '@/domain/value-objects/ColumnConfig.js'
import { createPortableGraphNode } from '@/infrastructure/container/PortableBootstrap.js'
import { Database } from '@/infrastructure/database/sqlite/SqliteAdapter.js'
import { GraphDbApiController } from '@/presentation/http/controllers/GraphDbApiController.js'

interface ApiEnvelope<T = Record<string, unknown>> {
  success: boolean
  data: T
  error?: string
}

async function readJson<T = Record<string, unknown>>(response: Response): Promise<ApiEnvelope<T>> {
  return (await response.json()) as ApiEnvelope<T>
}

describe('Core API Polishing & Security Parity', () => {
  test('supports full REST CRUD lifecycle for tables, columns, nodes (with metadata), relation types, and relations', async () => {
    const db = new Database(':memory:')
    const node = await createPortableGraphNode(db, { databaseLabel: ':memory:' })

    try {
      // 1. Table CRUD: create, get by id, get by identifier
      const createTableRes = await node.fetch(
        new Request('http://localhost/api/tables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: 'docs_items', description: 'Docs table' }),
        }),
      )
      expect(createTableRes.status).toBe(200)
      const createdTable = await readJson<{ id: string; identifier: string }>(createTableRes)
      expect(createdTable.success).toBe(true)
      const tableId = createdTable.data.id

      const getByIdRes = await node.fetch(new Request(`http://localhost/api/tables/${tableId}`))
      expect(getByIdRes.status).toBe(200)
      expect((await readJson<{ identifier: string }>(getByIdRes)).data.identifier).toBe('docs_items')

      const getByIdentifierRes = await node.fetch(new Request('http://localhost/api/tables/docs_items'))
      expect(getByIdentifierRes.status).toBe(200)
      expect((await readJson<{ id: string }>(getByIdentifierRes)).data.id).toBe(tableId)

      // 2. Attributes & ColumnConfig REST
      const createAttrRes = await node.fetch(
        new Request('http://localhost/api/attributes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableId,
            identifier: 'status',
            name: 'Status',
            attributeTypeId: '1',
            description: 'Workflow status',
            isRequired: false,
            metadata: { owner: 'ia-team' },
            options: {
              role: 'status',
              facetable: true,
              filterable: true,
              enumValues: ['draft', 'published'],
              displayOrder: 1,
            },
          }),
        }),
      )
      expect(createAttrRes.status).toBe(200)
      const createdAttr = await readJson<{
        id: string
        columnConfig?: { role?: string; enumValues?: string[] } | null
      }>(createAttrRes)
      expect(createdAttr.data.columnConfig).toMatchObject({
        role: 'status',
        enumValues: ['draft', 'published'],
      })
      const attrId = createdAttr.data.id

      const listAttrsRes = await node.fetch(
        new Request(`http://localhost/api/attributes/tables/${tableId}`),
      )
      expect(listAttrsRes.status).toBe(200)
      const listedAttrs = await readJson<{
        tableId: string
        attributes: Array<{
          identifier: string
          description: string | null
          isRequired: boolean
          metadata: Record<string, unknown> | null
          columnConfig: { role?: string; facetable?: boolean } | null
        }>
      }>(listAttrsRes)
      expect(listedAttrs.data.attributes).toHaveLength(1)
      expect(listedAttrs.data.attributes[0]).toMatchObject({
        identifier: 'status',
        description: 'Workflow status',
        isRequired: false,
        metadata: expect.objectContaining({ owner: 'ia-team' }),
        columnConfig: expect.objectContaining({ role: 'status', facetable: true }),
      })

      // Update attribute options while preserving existing metadata keys
      const updateAttrRes = await node.fetch(
        new Request(`http://localhost/api/attributes/${attrId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            options: {
              role: 'status',
              facetable: true,
              sortable: true,
              enumValues: ['draft', 'published', 'archived'],
            },
          }),
        }),
      )
      expect(updateAttrRes.status).toBe(200)
      const updatedAttr = await readJson<{
        metadata: Record<string, unknown> | null
        columnConfig: { sortable?: boolean; enumValues?: string[] } | null
      }>(updateAttrRes)
      expect(updatedAttr.data.metadata).toMatchObject({ owner: 'ia-team' })
      expect(updatedAttr.data.columnConfig).toMatchObject({
        sortable: true,
        enumValues: ['draft', 'published', 'archived'],
      })

      // Dedicated table columns endpoints (by identifier)
      const getColumnsRes = await node.fetch(
        new Request('http://localhost/api/tables/docs_items/columns'),
      )
      expect(getColumnsRes.status).toBe(200)
      const profile = await readJson<{
        tableIdentifier?: string
        facetableColumns: string[]
        sortableColumns: string[]
      }>(getColumnsRes)
      expect(profile.data.tableIdentifier).toBe('docs_items')
      expect(profile.data.facetableColumns).toContain('status')
      expect(profile.data.sortableColumns).toContain('status')

      const configureColumnRes = await node.fetch(
        new Request('http://localhost/api/tables/docs_items/columns/status', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: {
              role: 'status',
              facetable: true,
              searchable: true,
              enumValues: ['draft', 'published'],
            },
          }),
        }),
      )
      expect(configureColumnRes.status).toBe(200)
      const configured = await readJson<{
        column: { config: { searchable?: boolean } }
      }>(configureColumnRes)
      expect(configured.data.column.config.searchable).toBe(true)

      // 3. Node CRUD with metadata preservation & attribute hydration
      const createNodeARes = await node.fetch(
        new Request('http://localhost/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableId,
            title: 'Alpha Doc',
            content: 'Alpha content',
            metadata: { iaKey: 'alpha-doc', source: 'rest' },
            attributes: { status: 'published' },
          }),
        }),
      )
      expect(createNodeARes.status).toBe(200)
      const nodeAData = await readJson<{
        id: string
        metadata: Record<string, unknown> | null
      }>(createNodeARes)
      expect(nodeAData.data.metadata).toEqual({ iaKey: 'alpha-doc', source: 'rest' })
      const nodeAId = nodeAData.data.id

      const getNodeARes = await node.fetch(new Request(`http://localhost/api/nodes/${nodeAId}`))
      expect(getNodeARes.status).toBe(200)
      const fetchedNodeA = await readJson<{
        id: string
        metadata: Record<string, unknown> | null
        attributes: Record<string, unknown>
      }>(getNodeARes)
      expect(fetchedNodeA.data.metadata).toEqual({ iaKey: 'alpha-doc', source: 'rest' })
      expect(fetchedNodeA.data.attributes).toEqual({ status: 'published' })

      const patchNodeARes = await node.fetch(
        new Request(`http://localhost/api/nodes/${nodeAId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Alpha Doc v2' }),
        }),
      )
      expect(patchNodeARes.status).toBe(200)

      const createNodeBRes = await node.fetch(
        new Request('http://localhost/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableId,
            title: 'Beta Doc',
            content: 'Beta content',
          }),
        }),
      )
      const nodeBId = (await readJson<{ id: string }>(createNodeBRes)).data.id

      // 4. RelationType & Relation CRUD (both canonical and legacy field names)
      const createRtRes = await node.fetch(
        new Request('http://localhost/api/relation-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: 'citesRef',
            description: 'Document citation',
            category: 'reference',
          }),
        }),
      )
      expect(createRtRes.status).toBe(200)

      const duplicateRtRes = await node.fetch(
        new Request('http://localhost/api/relation-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: 'citesRef' }),
        }),
      )
      expect(duplicateRtRes.status).toBe(409)

      const listRtRes = await node.fetch(new Request('http://localhost/api/relation-types'))
      expect(listRtRes.status).toBe(200)
      const rtList = await readJson<{ relationTypes: Array<{ identifier: string }> }>(listRtRes)
      expect(rtList.data.relationTypes.some((rt) => rt.identifier === 'citesRef')).toBe(true)

      const canonicalRelRes = await node.fetch(
        new Request('http://localhost/api/relations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableId,
            sourceNodeId: nodeAId,
            targetNodeId: nodeBId,
            relationType: 'citesRef',
            confidence: 3,
          }),
        }),
      )
      expect(canonicalRelRes.status).toBe(200)
      const createdRel = await readJson<{
        id: string
        sourceNodeId: string
        fromNodeId: string
        targetNodeId: string
        toNodeId: string
        relationType: string
        relationshipType: string
      }>(canonicalRelRes)
      expect(createdRel.data).toMatchObject({
        sourceNodeId: nodeAId,
        fromNodeId: nodeAId,
        targetNodeId: nodeBId,
        toNodeId: nodeBId,
        relationType: 'citesRef',
        relationshipType: 'citesRef',
      })

      // Delete relation -> 404 when deleted again
      const delRelRes = await node.fetch(
        new Request(`http://localhost/api/relations/${createdRel.data.id}`, { method: 'DELETE' }),
      )
      expect(delRelRes.status).toBe(200)
      const delRelAgain = await node.fetch(
        new Request(`http://localhost/api/relations/${createdRel.data.id}`, { method: 'DELETE' }),
      )
      expect(delRelAgain.status).toBe(404)

      // Legacy relation field names still work
      const legacyRelRes = await node.fetch(
        new Request('http://localhost/api/relations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableId,
            fromNodeId: nodeBId,
            toNodeId: nodeAId,
            relationshipType: 'citesRef',
          }),
        }),
      )
      expect(legacyRelRes.status).toBe(200)

      // Delete node -> 404 afterwards
      const delNodeRes = await node.fetch(
        new Request(`http://localhost/api/nodes/${nodeAId}`, { method: 'DELETE' }),
      )
      expect(delNodeRes.status).toBe(200)
      const getDeletedNode = await node.fetch(new Request(`http://localhost/api/nodes/${nodeAId}`))
      expect(getDeletedNode.status).toBe(404)

      // Delete table -> 404 afterwards
      const delTableRes = await node.fetch(
        new Request(`http://localhost/api/tables/${tableId}`, { method: 'DELETE' }),
      )
      expect(delTableRes.status).toBe(200)
      const getDeletedTable = await node.fetch(new Request(`http://localhost/api/tables/${tableId}`))
      expect(getDeletedTable.status).toBe(404)

      // Browser-safe stats
      const statsRes = await node.fetch(new Request('http://localhost/api/stats'))
      expect(statsRes.status).toBe(200)
      const stats = await readJson<{ memory: { percentage: number }; process: { platform: string } }>(
        statsRes,
      )
      expect(Number.isFinite(stats.data.memory.percentage)).toBe(true)
    } finally {
      await node.dispose()
    }
  })

  test('systemStats handles zero heapTotal without NaN and missing process stats', async () => {
    const logger = { debug() {}, info() {}, warn() {}, error() {} }
    const controller = new GraphDbApiController(logger as never)

    const originalMemoryUsage = process.memoryUsage
    Object.defineProperty(process, 'memoryUsage', {
      configurable: true,
      value: () => ({ rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 }),
    })

    try {
      let captured: unknown
      const mockRes = {
        status() {
          return this
        },
        type() {
          return this
        },
        setHeader() {
          return this
        },
        json(payload: unknown) {
          captured = payload
        },
        send(payload: unknown) {
          captured = payload
        },
      }
      await controller.systemStats({ params: {}, query: {}, body: {}, headers: {} } as never, mockRes as never)
      expect(captured).toMatchObject({
        success: true,
        data: {
          memory: { used: 0, total: 0, percentage: 0 },
        },
      })
    } finally {
      Object.defineProperty(process, 'memoryUsage', {
        configurable: true,
        value: originalMemoryUsage,
      })
    }
  })

  test('AccessControl enforces reader/writer/admin and relation ownership on new REST routes', async () => {
    const control = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({
        readerAlpha: { id: 'r-a', role: 'reader', tableIds: ['alpha'] },
        writerAlpha: { id: 'w-a', role: 'writer', tableIds: ['alpha'] },
        adminToken: { id: 'adm', role: 'admin', tableIds: ['*'] },
      }),
    })
    const resolver = {
      resolveNodeTableId: async (nodeId: string) =>
        nodeId === 'n-alpha' ? '1' : nodeId === 'n-beta' ? '2' : undefined,
      resolveRelationTableId: async (relId: string) =>
        relId === 'rel-alpha' ? '1' : relId === 'rel-beta' ? '2' : undefined,
      resolveTableIdentity: async (ref: string) =>
        ref === '1' || ref === 'alpha'
          ? { id: '1', identifier: 'alpha' }
          : ref === '2' || ref === 'beta'
            ? { id: '2', identifier: 'beta' }
            : undefined,
    }

    // Unauthenticated request is rejected, and table-scoped reader can read own table but not other table
    expect(
      await authorizeExternalRequest(
        control,
        new Request('http://localhost/api/tables/alpha'),
        undefined,
        resolver,
      ),
    ).toEqual({ allowed: false, status: 401, code: 'authentication_required' })
    expect(
      await authorizeExternalRequest(
        control,
        new Request('http://localhost/api/tables/alpha', {
          headers: { Authorization: 'Bearer readerAlpha' },
        }),
        undefined,
        resolver,
      ),
    ).toMatchObject({ allowed: true })
    expect(
      await authorizeExternalRequest(
        control,
        new Request('http://localhost/api/tables/beta', {
          headers: { Authorization: 'Bearer readerAlpha' },
        }),
        undefined,
        resolver,
      ),
    ).toEqual({ allowed: false, status: 404, code: 'not_found' })

    // Reader cannot write columns or delete relation
    expect(
      await authorizeExternalRequest(
        control,
        new Request('http://localhost/api/tables/alpha/columns/status', {
          method: 'PUT',
          headers: { Authorization: 'Bearer readerAlpha', 'Content-Type': 'application/json' },
          body: JSON.stringify({ facetable: true }),
        }),
        undefined,
        resolver,
      ),
    ).toEqual({ allowed: false, status: 403, code: 'forbidden' })

    // Writer can delete own relation and node, gets 404 for beta resources, and 403 for admin-only table delete / relation-type create
    expect(
      (
        await authorizeExternalRequest(
          control,
          new Request('http://localhost/api/relations/rel-alpha', {
            method: 'DELETE',
            headers: { Authorization: 'Bearer writerAlpha' },
          }),
          undefined,
          resolver,
        )
      ).allowed,
    ).toBe(true)
    expect(
      await authorizeExternalRequest(
        control,
        new Request('http://localhost/api/relations/rel-beta', {
          method: 'DELETE',
          headers: { Authorization: 'Bearer writerAlpha' },
        }),
        undefined,
        resolver,
      ),
    ).toEqual({ allowed: false, status: 404, code: 'not_found' })
    expect(
      await authorizeExternalRequest(
        control,
        new Request('http://localhost/api/tables/alpha', {
          method: 'DELETE',
          headers: { Authorization: 'Bearer writerAlpha' },
        }),
        undefined,
        resolver,
      ),
    ).toEqual({ allowed: false, status: 403, code: 'forbidden' })
    expect(
      await authorizeExternalRequest(
        control,
        new Request('http://localhost/api/relation-types', {
          method: 'POST',
          headers: { Authorization: 'Bearer writerAlpha', 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: 'newRel' }),
        }),
        undefined,
        resolver,
      ),
    ).toEqual({ allowed: false, status: 403, code: 'forbidden' })
    expect(
      (
        await authorizeExternalRequest(
          control,
          new Request('http://localhost/api/tables/alpha', {
            method: 'DELETE',
            headers: { Authorization: 'Bearer adminToken' },
          }),
          undefined,
          resolver,
        )
      ).allowed,
    ).toBe(true)
  })

  test('resolveEmbeddingColumnExecutionOptions aggregates opt-in embedding columns consistently', () => {
    const emptyProfile: TableColumnProfile = {
      tableId: 't1',
      columns: [],
      facetableColumns: [],
      searchableColumns: [],
      sortableColumns: [],
      filterableColumns: [],
      visibleColumns: [],
      hiddenColumns: [],
      enumConstraints: {},
      defaultValues: {},
      embeddingColumns: [],
    }
    expect(resolveEmbeddingColumnExecutionOptions(emptyProfile)).toBeNull()

    const activeProfile: TableColumnProfile = {
      ...emptyProfile,
      embeddingColumns: [
        {
          identifier: 'summary',
          config: {
            enabled: true,
            includeContent: false,
            model: 'google/embeddinggemma-2',
          },
        },
        {
          identifier: 'semantic_index',
          config: {
            enabled: true,
            sourceColumns: ['summary', 'tags'],
            includeTitle: false,
            task: 'semantic_similarity',
          },
        },
      ],
    }

    expect(resolveEmbeddingColumnExecutionOptions(activeProfile)).toEqual({
      enabledColumns: ['summary', 'semantic_index'],
      attributeIdentifiers: ['summary', 'tags'],
      includeTitle: false,
      includeContent: false,
      task: 'semantic_similarity',
      model: 'google/embeddinggemma-2',
    })
    expect(
      resolveEmbeddingColumnExecutionOptions(activeProfile, 'override-model')?.model,
    ).toBe('override-model')
  })
})

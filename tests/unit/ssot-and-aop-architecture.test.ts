import { describe, expect, test, vi } from 'vitest'
import { TableSchemaLifecycleAspect } from '@/application/aspects/TableSchemaLifecycleAspect.js'
import {
  ADMIN_ONLY_GRAPHQL_ROOT_FIELDS,
  AccessControl,
  authorizeExternalRequest,
  TABLE_SCOPED_GRAPHQL_MUTATION_FIELDS,
} from '@/application/security/AccessControl.js'
import { TableSchemaProjectionService } from '@/application/services/TableSchemaProjectionService.js'
import { TableTemplateAutoGenerator } from '@/application/services/TableTemplateAutoGenerator.js'
import {
  extractRestAttributeTableId,
  extractRestExactNodeId,
  extractRestExactRelationId,
  extractRestExactTableId,
  extractRestNodePathParam,
  extractRestTablePathParam,
  isRestAdminRoute,
  isRestReadOnlyOperation,
} from '@/core/contracts/RestRouteContract.js'
import { Attribute } from '@/domain/entities/Attribute.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import { createContainer } from '@/infrastructure/container/ContainerBootstrap.js'
import { createPortableGraphNode } from '@/infrastructure/container/PortableBootstrap.js'
import { createGraphDbRuntimeSurface } from '@/infrastructure/container/RuntimeSurfaceFactory.js'
import { RepositoryTokens } from '@/infrastructure/container/tokens/RepositoryTokens.js'
import { Database } from '@/infrastructure/database/sqlite/SqliteAdapter.js'
import type { FetchLike } from '@/models/GraphQLOperation.js'
import {
  executeHttpController,
  type HttpExecutionTelemetry,
} from '@/presentation/http/aspects/HttpExecutionPipeline.js'
import { createBunApiRouter } from '@/presentation/http/routes/BunApiRouter.js'
import {
  ConflictException,
  DomainException,
  NotFoundException,
  ValidationException,
} from '@/shared/exceptions/DomainException.js'

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} }

describe('SSOT & AOP Architecture Consolidation', () => {
  test('RestRouteContract preserves consistent REST path extraction, read-only, and admin classification', () => {
    expect(extractRestTablePathParam('/api/tables/orders/columns')).toBe('orders')
    expect(extractRestTablePathParam('/api/tables/search')).toBeUndefined()
    expect(extractRestTablePathParam('/api/tables/docs')).toBeUndefined()

    expect(extractRestExactTableId('/api/tables/orders')).toBe('orders')
    expect(extractRestExactTableId('/api/tables/orders/columns')).toBeUndefined()
    expect(extractRestExactTableId('/api/tables/search')).toBeUndefined()

    expect(extractRestNodePathParam('/api/nodes/n-1/relations')).toBe('n-1')
    expect(extractRestNodePathParam('/api/nodes/hybrid-search')).toBeUndefined()
    expect(extractRestExactNodeId('/api/nodes/n-1')).toBe('n-1')
    expect(extractRestExactNodeId('/api/nodes/shortest-path')).toBeUndefined()

    expect(extractRestAttributeTableId('/api/attributes/tables/t-42')).toBe('t-42')
    expect(extractRestExactRelationId('/api/relations/rel-7')).toBe('rel-7')
    expect(extractRestExactRelationId('/api/relations/search')).toBeUndefined()

    expect(isRestReadOnlyOperation('GET', '/api/tables')).toBe(true)
    expect(isRestReadOnlyOperation('POST', '/api/nodes/hybrid-search')).toBe(true)
    expect(isRestReadOnlyOperation('POST', '/api/nodes/shortest-path')).toBe(true)
    expect(isRestReadOnlyOperation('POST', '/api/nodes')).toBe(false)

    expect(isRestAdminRoute('DELETE', '/api/tables/alpha')).toBe(true)
    expect(isRestAdminRoute('GET', '/api/tables/alpha')).toBe(false)
    expect(isRestAdminRoute('POST', '/api/relation-types')).toBe(true)
    expect(isRestAdminRoute('GET', '/api/relation-types')).toBe(false)
  })

  test('AccessControl classifies 100% of GraphQL SDL Mutation fields with zero overlap and enforces admin boundaries', async () => {
    const db = new Database(':memory:')
    const node = await createPortableGraphNode(db, { databaseLabel: ':memory:' })

    try {
      const mutationType = node.schema.getMutationType()
      expect(mutationType).toBeDefined()
      const sdlMutations = Object.keys(mutationType?.getFields() ?? {}).filter(
        (field) => !field.startsWith('_'),
      )

      const overlap = [...ADMIN_ONLY_GRAPHQL_ROOT_FIELDS].filter((field) =>
        TABLE_SCOPED_GRAPHQL_MUTATION_FIELDS.has(field),
      )
      expect(overlap).toEqual([])

      const unclassified = sdlMutations.filter(
        (field) =>
          !ADMIN_ONLY_GRAPHQL_ROOT_FIELDS.has(field) &&
          !TABLE_SCOPED_GRAPHQL_MUTATION_FIELDS.has(field),
      )
      expect(unclassified).toEqual([])

      const control = AccessControl.fromEnvironment({
        NODE_ENV: 'production',
        BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({
          writerAlpha: { id: 'w-a', role: 'writer', tableIds: ['alpha'] },
        }),
      })

      const exportBlocked = await authorizeExternalRequest(
        control,
        new Request('http://localhost/graphql', {
          method: 'POST',
          headers: { Authorization: 'Bearer writerAlpha' },
          body: JSON.stringify({
            query: 'mutation { exportTableNodes(input: { tableId: "alpha" }) { success } }',
          }),
        }),
      )
      expect(exportBlocked).toEqual({ allowed: false, status: 403, code: 'forbidden' })

      const syncConfigBlocked = await authorizeExternalRequest(
        control,
        new Request('http://localhost/graphql', {
          method: 'POST',
          headers: { Authorization: 'Bearer writerAlpha' },
          body: JSON.stringify({
            query: 'mutation { saveTabularSyncConfig(input: { configJson: "{}" }) { success } }',
          }),
        }),
      )
      expect(syncConfigBlocked).toEqual({ allowed: false, status: 403, code: 'forbidden' })
    } finally {
      await node.dispose()
    }
  })

  test('Attribute entity and SQLite repository hydrate isRequired as strict boolean', async () => {
    expect(
      Attribute.fromDatabase(
        '1',
        '1',
        'flag_false',
        'Flag False',
        '1',
        null,
        0,
        null,
        new Date(),
        new Date(),
      ).getIsRequired(),
    ).toBe(false)
    expect(
      Attribute.fromDatabase(
        '2',
        '1',
        'flag_true',
        'Flag True',
        '1',
        null,
        1,
        null,
        new Date(),
        new Date(),
      ).getIsRequired(),
    ).toBe(true)

    const db = new Database(':memory:')
    const node = await createPortableGraphNode(db, { databaseLabel: ':memory:' })
    try {
      const tableRes = await (
        await node.fetch(
          new Request('http://localhost/api/tables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: 'bool_check' }),
          }),
        )
      ).json() as { data: { id: string } }
      const tableId = tableRes.data.id

      await node.fetch(
        new Request('http://localhost/api/attributes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableId, identifier: 'opt_field', isRequired: false }),
        }),
      )
      await node.fetch(
        new Request('http://localhost/api/attributes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableId, identifier: 'req_field', isRequired: true }),
        }),
      )

      const attrRepo = await node.container.resolve<IAttributeRepository>(
        RepositoryTokens.ATTRIBUTE_REPOSITORY,
      )
      const optAttr = await attrRepo.findByTableIdAndIdentifier(tableId, 'opt_field')
      const reqAttr = await attrRepo.findByTableIdAndIdentifier(tableId, 'req_field')

      expect(optAttr?.getIsRequired()).toBe(false)
      expect(reqAttr?.getIsRequired()).toBe(true)
      expect(typeof optAttr?.getIsRequired()).toBe('boolean')
      expect(typeof reqAttr?.getIsRequired()).toBe('boolean')
    } finally {
      await node.dispose()
    }
  })

  test('createGraphDbRuntimeSurface exposes unified IA/Memory MCP tools, REST router, and resource access resolver', async () => {
    const db = new Database(':memory:')
    const container = await createContainer()
    // Build an isolated in-memory portable surface via createPortableGraphNode's container helper pattern
    const node = await createPortableGraphNode(db, { databaseLabel: ':memory:' })

    try {
      const dummyFetch: FetchLike = async (input, init) => {
        const req = input instanceof Request ? input : new Request(String(input), init)
        return await node.fetch(req)
      }
      const surface = await createGraphDbRuntimeSurface(node.container, {
        graphqlEndpointUrl: 'http://localhost/graphql',
        restApiBaseUrl: 'http://localhost/api',
        port: 0,
        inProcessFetch: dummyFetch,
      })

      try {
        expect(surface.iaService).toBeDefined()
        expect(surface.aiMemoryService).toBeDefined()
        expect(typeof surface.resourceAccessResolver.resolveNodeTableId).toBe('function')
        expect(typeof surface.resourceAccessResolver.resolveRelationTableId).toBe('function')
        expect(typeof surface.resourceAccessResolver.resolveTableIdentity).toBe('function')

        const listRes = await surface.mcpServer.handleRequest(
          new Request('http://localhost/mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'MCP-Protocol-Version': '2026-07-28',
              'Mcp-Method': 'tools/list',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 'list-tools',
              method: 'tools/list',
              params: {
                _meta: {
                  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
                  'io.modelcontextprotocol/clientCapabilities': {},
                },
              },
            }),
          }),
        )
        expect(listRes.status).toBe(200)
        const parsed = (await listRes.json()) as {
          result: { tools: Array<{ name: string }> }
        }
        const names = parsed.result.tools.map((t) => t.name)
        expect(names).toContain('memory-remember')
        expect(names).toContain('ia-apply-blueprint')
      } finally {
        await surface.dispose()
      }
    } finally {
      await node.dispose()
      await container.dispose().catch(() => undefined)
    }
  })

  test('TableSchemaLifecycleAspect invalidates projection caches, marks templates stale, and isolates hook errors', async () => {
    const clearSpy = vi.spyOn(TableSchemaProjectionService, 'clearCache')
    const staleSpy = vi
      .spyOn(TableTemplateAutoGenerator.prototype, 'markAutoGeneratedTemplatesStale')
      .mockResolvedValue({ marked: 2, scanned: 3 })
    const notifyByTableId = vi.fn(() => {
      throw new Error('tabular sync offline')
    })
    const notifyClearByIdentifier = vi.fn(() => {
      throw new Error('clear hook offline')
    })
    const warnSpy = vi.fn()

    const aspect = new TableSchemaLifecycleAspect({
      logger: { ...noopLogger, warn: warnSpy },
      attributeRepository: {} as IAttributeRepository,
      attributeTypeRepository: {} as IAttributeTypeRepository,
      queryTemplateRepository: {} as IQueryTemplateRepository,
      tabularSyncHook: { notifyByTableId, notifyClearByIdentifier },
    })

    try {
      await aspect.onTableSchemaChanged(['t-1', 't-1', 't-2'], 'testChange')
      expect(clearSpy).toHaveBeenCalledWith('t-1')
      expect(clearSpy).toHaveBeenCalledWith('t-2')
      expect(staleSpy).toHaveBeenCalledTimes(2)
      expect(notifyByTableId).toHaveBeenCalledWith('t-1')
      expect(notifyByTableId).toHaveBeenCalledWith('t-2')
      expect(warnSpy).toHaveBeenCalled()

      aspect.onTableDeleted('t-1', 'alpha', 'testDelete')
      expect(notifyClearByIdentifier).toHaveBeenCalledWith('alpha')
    } finally {
      clearSpy.mockRestore()
      staleSpy.mockRestore()
    }
  })

  test('InformationArchitectureService.configureColumn triggers TableSchemaLifecycleAspect on schema change', async () => {
    const db = new Database(':memory:')
    const node = await createPortableGraphNode(db, { databaseLabel: ':memory:' })
    const clearSpy = vi.spyOn(TableSchemaProjectionService, 'clearCache')

    try {
      await node.ia.applyBlueprint({
        name: 'Lifecycle Check',
        tables: [
          {
            identifier: 'items',
            attributes: [
              {
                identifier: 'priority',
                typeIdentifier: 'string',
                options: { role: 'priority', facetable: false },
              },
            ],
          },
        ],
      })
      clearSpy.mockClear()

      const updated = await node.ia.configureColumn('items', 'priority', {
        role: 'priority',
        facetable: true,
        sortable: true,
      })
      expect(updated.config.facetable).toBe(true)
      expect(clearSpy).toHaveBeenCalled()
    } finally {
      clearSpy.mockRestore()
      await node.dispose()
    }
  })

  test('HttpExecutionPipeline maps thrown DomainExceptions uniformly and invokes mutation hooks only for 2xx writes', async () => {
    const mutationEvents: HttpExecutionTelemetry[] = []
    const completedEvents: HttpExecutionTelemetry[] = []

    const hooks = {
      onMutationSuccess(event: HttpExecutionTelemetry) {
        mutationEvents.push(event)
      },
      onRequestCompleted(event: HttpExecutionTelemetry) {
        completedEvents.push(event)
      },
    }

    const domainRes = await executeHttpController(
      new Request('http://localhost/api/nodes', { method: 'POST', body: '{}' }),
      () => {
        throw new DomainException('domain rejection')
      },
      {},
      noopLogger,
      hooks,
    )
    expect(domainRes.status).toBe(400)

    const validationRes = await executeHttpController(
      new Request('http://localhost/api/nodes', { method: 'POST', body: '{}' }),
      () => {
        throw new ValidationException('bad payload')
      },
      {},
      noopLogger,
      hooks,
    )
    expect(validationRes.status).toBe(422)

    const notFoundRes = await executeHttpController(
      new Request('http://localhost/api/nodes/missing', { method: 'DELETE' }),
      () => {
        throw new NotFoundException('missing node')
      },
      { nodeId: 'missing' },
      noopLogger,
      hooks,
    )
    expect(notFoundRes.status).toBe(404)

    const conflictRes = await executeHttpController(
      new Request('http://localhost/api/relation-types', { method: 'POST', body: '{}' }),
      () => {
        throw new ConflictException('already exists')
      },
      {},
      noopLogger,
      hooks,
    )
    expect(conflictRes.status).toBe(409)

    // None of the 4xx writes should fire onMutationSuccess
    expect(mutationEvents).toHaveLength(0)

    const router = createBunApiRouter({
      logger: noopLogger,
      graphDbController: {
        async createNode(_req: unknown, res: { json(v: unknown): void }) {
          res.json({ success: true })
        },
      } as never,
      attributeController: {} as never,
      graphController: {
        async hybridSearchNodes(_req: unknown, res: { json(v: unknown): void }) {
          res.json({ success: true })
        },
        async getTables(_req: unknown, res: { json(v: unknown): void }) {
          res.json({ success: true })
        },
      } as never,
      mcpToolController: {} as never,
      hooks,
    })

    await router(new Request('http://localhost/api/tables'))
    await router(
      new Request('http://localhost/api/nodes/hybrid-search', {
        method: 'POST',
        body: '{}',
      }),
    )
    expect(mutationEvents).toHaveLength(0)

    await router(
      new Request('http://localhost/api/nodes', {
        method: 'POST',
        body: '{}',
      }),
    )
    expect(mutationEvents).toHaveLength(1)
    expect(mutationEvents[0]).toMatchObject({
      method: 'POST',
      path: '/api/nodes',
      status: 200,
      isMutation: true,
    })
    expect(completedEvents.length).toBeGreaterThanOrEqual(6)
    expect(completedEvents.every((e) => e.durationMs >= 0)).toBe(true)
  })

  test('normalizes SQLite boolean flags (0/1 and booleans) in Doc.fromDatabase and QueryTemplate.fromDatabase', async () => {
    const { Doc } = await import('@/domain/entities/Doc.js')
    const { QueryTemplate } = await import('@/domain/entities/QueryTemplate.js')

    const now = new Date('2026-01-01T00:00:00.000Z')
    const docInactive = Doc.fromDatabase('d1', 't1', 'general', 1, 'content', 0, now, now)
    const docActive = Doc.fromDatabase('d2', 't1', 'general', 1, 'content', 1, now, now)
    expect(docInactive.isActive).toBe(false)
    expect(docActive.isActive).toBe(true)

    const tplInactive = QueryTemplate.fromDatabase(
      'q1',
      'tpl-inactive',
      'Inactive Template',
      null,
      'query { healthCheck { status } }',
      null,
      'query',
      null,
      null,
      null,
      'query',
      1,
      0,
      null,
      null,
      '1.0',
      0,
      null,
      now.toISOString(),
      now.toISOString(),
    )
    const tplActive = QueryTemplate.fromDatabase(
      'q2',
      'tpl-active',
      'Active Template',
      null,
      'query { healthCheck { status } }',
      null,
      'query',
      null,
      null,
      null,
      'query',
      1,
      0,
      null,
      null,
      '1.0',
      1,
      null,
      now.toISOString(),
      now.toISOString(),
    )
    expect(tplInactive.getIsActive()).toBe(false)
    expect(tplActive.getIsActive()).toBe(true)
  })
})

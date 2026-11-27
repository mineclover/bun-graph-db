import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { AccessControl } from '@/application/security/AccessControl.js'
import { Attribute } from '@/domain/entities/Attribute.js'
import { AttributeType } from '@/domain/entities/AttributeType.js'
import { Node } from '@/domain/entities/Node.js'
import { NodeAttribute } from '@/domain/entities/NodeAttribute.js'
import { NodeRelation } from '@/domain/entities/NodeRelation.js'
import { RelationType } from '@/domain/entities/RelationType.js'
import { Table } from '@/domain/entities/Table.js'
import {
  type CloudflareR2BucketLike,
  type CloudflareR2ObjectBodyLike,
  InMemorySnapshotStorage,
  R2BucketSnapshotStorage,
} from '@/domain/ports/ISnapshotStoragePort.js'
import { RelationDirection } from '@/domain/value-objects/RelationQuery.js'
import {
  LogicalOperator,
  SearchOperator,
  type SearchQuery,
} from '@/domain/value-objects/SearchFilter.js'
import { EMBEDDED_INITIAL_SCHEMA_SQL } from '@/generated/embedded-assets.js'
import {
  applyDatabaseMigrations,
  createDatabaseMigrations,
} from '@/infrastructure/database/sqlite/DatabaseMigrationRunner.js'
import {
  type DoSqlStorageCursor,
  type DoStorageLike,
  DoSqliteDatabase,
} from '@/infrastructure/database/sqlite/DoSqliteAdapter.js'
import {
  CLOUDFLARE_DO_HARD_PARAM_LIMIT,
  CLOUDFLARE_DO_MAX_BIND_PARAMS,
  translateNamedParamsToPositional,
} from '@/infrastructure/database/sqlite/SqlitePort.js'
import { configureSqliteDatabase } from '@/infrastructure/database/sqlite/SqlitePragmas.js'
import { SqliteAttributeRepository } from '@/infrastructure/database/sqlite/SqliteAttributeRepository.js'
import { SqliteAttributeTypeRepository } from '@/infrastructure/database/sqlite/SqliteAttributeTypeRepository.js'
import { SqliteGraphRepository } from '@/infrastructure/database/sqlite/SqliteGraphRepository.js'
import { SqliteNodeAttributeRepository } from '@/infrastructure/database/sqlite/SqliteNodeAttributeRepository.js'
import { SqliteNodeRelationRepository } from '@/infrastructure/database/sqlite/SqliteNodeRelationRepository.js'
import { SqliteNodeRepository } from '@/infrastructure/database/sqlite/SqliteNodeRepository.js'
import { SqliteNodeSearchRepository } from '@/infrastructure/database/sqlite/SqliteNodeSearchRepository.js'
import { SqliteRelationTypeRepository } from '@/infrastructure/database/sqlite/SqliteRelationTypeRepository.js'
import { SqliteTableRepository } from '@/infrastructure/database/sqlite/SqliteTableRepository.js'
import {
  createCloudflareDurableObjectNode,
  routeSingleNodeRequest,
} from '@/presentation/cloudflare/CloudflareSingleNodeWorker.js'

const FORBIDDEN_DO_PRAGMAS = [
  'journal_mode',
  'wal_autocheckpoint',
  'mmap_size',
  'synchronous',
  'busy_timeout',
  'cache_size',
  'temp_store',
  'user_version',
] as const

function requireValue<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${label} to be defined`)
  }
  return value
}

function containsUnquotedNamedParam(sql: string): string | null {
  let i = 0
  while (i < sql.length) {
    const ch = sql[i]
    if (ch === "'") {
      i += 1
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          i += 2
          continue
        }
        if (sql[i] === "'") {
          i += 1
          break
        }
        i += 1
      }
      continue
    }
    if (ch === '"') {
      i += 1
      while (i < sql.length) {
        if (sql[i] === '"' && sql[i + 1] === '"') {
          i += 2
          continue
        }
        if (sql[i] === '"') {
          i += 1
          break
        }
        i += 1
      }
      continue
    }
    if (ch === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i + 2)
      i = nl === -1 ? sql.length : nl + 1
      continue
    }
    if (ch === '/' && sql[i + 1] === '*') {
      const close = sql.indexOf('*/', i + 2)
      i = close === -1 ? sql.length : close + 2
      continue
    }
    if ((ch === '$' || ch === ':' || ch === '@') && i + 1 < sql.length) {
      const next = sql[i + 1] ?? ''
      if (/[A-Za-z_]/.test(next)) {
        const match = sql.slice(i).match(/^[$:@][A-Za-z_][A-Za-z0-9_]*/)
        if (match) {
          return match[0]
        }
      }
    }
    i += 1
  }
  return null
}

function isRowReturningSql(query: string): boolean {
  return (
    /^\s*(?:select|pragma|with|explain)\b/i.test(query) ||
    /\breturning\b/i.test(query)
  )
}

function toSqlInput(value: unknown): SQLInputValue {
  if (value === undefined || value === null) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    ArrayBuffer.isView(value)
  ) {
    return value as SQLInputValue
  }
  return String(value)
}

class StrictMockCloudflareDoStorage implements DoStorageLike {
  readonly raw = new DatabaseSync(':memory:')
  maxObservedBindings = 0
  executedPragmas: string[] = []
  private txActive = false

  readonly sql = {
    exec: <TRow = Record<string, unknown>>(
      query: string,
      ...bindings: unknown[]
    ): DoSqlStorageCursor<TRow> => {
      if (bindings.length > CLOUDFLARE_DO_HARD_PARAM_LIMIT) {
        throw new Error(
          `StrictMockCloudflareDoStorage: parameter count ${bindings.length} exceeds limit ${CLOUDFLARE_DO_HARD_PARAM_LIMIT}`,
        )
      }
      this.maxObservedBindings = Math.max(
        this.maxObservedBindings,
        bindings.length,
      )

      const lower = query.toLowerCase()
      if (lower.includes('pragma')) {
        for (const forbidden of FORBIDDEN_DO_PRAGMAS) {
          if (new RegExp(`pragma\\s+${forbidden}\\b`, 'i').test(query)) {
            throw new Error(
              `StrictMockCloudflareDoStorage: unsupported PRAGMA '${forbidden}' in DO SQLite`,
            )
          }
        }
        this.executedPragmas.push(query.trim())
      }

      const namedParam = containsUnquotedNamedParam(query)
      if (namedParam) {
        throw new Error(
          `StrictMockCloudflareDoStorage: named SQL parameter '${namedParam}' is not allowed in DO SQLite`,
        )
      }

      const normalized = bindings.map(toSqlInput)
      let rows: TRow[] = []
      let rowsRead = 0
      let rowsWritten = 0

      if (normalized.length === 0 && !isRowReturningSql(query)) {
        const beforeRow = this.raw
          .prepare('SELECT total_changes() AS count')
          .get() as { count: number }
        this.raw.exec(query)
        const afterRow = this.raw
          .prepare('SELECT total_changes() AS count')
          .get() as { count: number }
        rowsWritten = Math.max(0, afterRow.count - beforeRow.count)
      } else {
        const stmt = this.raw.prepare(query)
        if (isRowReturningSql(query)) {
          rows = stmt.all(...normalized) as TRow[]
          rowsRead = rows.length
          rowsWritten = /\breturning\b/i.test(query) ? rows.length : 0
        } else {
          const res = stmt.run(...normalized)
          rowsWritten = Number(res.changes)
        }
      }

      return {
        rowsRead,
        rowsWritten,
        toArray: () => rows,
        one: () => {
          if (rows.length === 0) {
            throw new Error('Expected one row from DO SQL cursor')
          }
          return rows[0] as TRow
        },
        [Symbol.iterator]: () => rows[Symbol.iterator](),
      }
    },
  }

  transactionSync<T>(callback: () => T): T {
    if (this.txActive) {
      throw new Error(
        'StrictMockCloudflareDoStorage: re-entrant top-level transactionSync is forbidden',
      )
    }
    this.txActive = true
    this.raw.exec('BEGIN IMMEDIATE')
    try {
      const value = callback()
      if (
        value !== null &&
        typeof value === 'object' &&
        'then' in value &&
        typeof (value as { then?: unknown }).then === 'function'
      ) {
        throw new Error(
          'StrictMockCloudflareDoStorage: transactionSync callback must be synchronous',
        )
      }
      this.raw.exec('COMMIT')
      return value
    } catch (error) {
      try {
        this.raw.exec('ROLLBACK')
      } catch {
        // Ignore rollback failure when already aborted.
      }
      throw error
    } finally {
      this.txActive = false
    }
  }

  close(): void {
    this.raw.close()
  }
}

describe('Cloudflare Durable Object SQLite portability', () => {
  it('applies migrations v1..v14 and configures pragmas without unsupported PRAGMAs or named params', () => {
    const storage = new StrictMockCloudflareDoStorage()
    const db = new DoSqliteDatabase(storage)

    try {
      configureSqliteDatabase(db, ':cloudflare-do:test')
      applyDatabaseMigrations(
        db,
        createDatabaseMigrations(EMBEDDED_INITIAL_SCHEMA_SQL),
      )

      const applied = db
        .query<{ version: number; name: string }, []>(
          'SELECT version, name FROM schema_migrations ORDER BY version ASC',
        )
        .all()

      expect(applied.length).toBeGreaterThanOrEqual(14)
      expect(applied[0]).toEqual({ version: 1, name: 'initial-schema' })
      expect(applied[applied.length - 1]?.version).toBe(14)
      expect(storage.executedPragmas.some((p) => p.includes('foreign_keys = ON'))).toBe(true)
      expect(storage.maxObservedBindings).toBeLessThanOrEqual(
        CLOUDFLARE_DO_MAX_BIND_PARAMS,
      )
    } finally {
      db.close()
      storage.close()
    }
  })

  it('rejects >100 bound params and translates named params outside literals/comments', () => {
    const storage = new StrictMockCloudflareDoStorage()
    const db = new DoSqliteDatabase(storage)

    try {
      const translated = translateNamedParamsToPositional(
        "SELECT '$version' AS lit, /* $name */ $version AS ver, :name AS nm -- :ignored",
        { $version: 7, ':name': 'edge' },
      )
      expect(translated).toEqual({
        sql: "SELECT '$version' AS lit, /* $name */ ? AS ver, ? AS nm -- :ignored",
        params: [7, 'edge'],
      })

      const row = db
        .query<{ lit: string; ver: number; nm: string }, [Record<string, unknown>]>(
          "SELECT '$version' AS lit, $version AS ver, :name AS nm",
        )
        .get({ $version: 7, ':name': 'edge' })
      expect(row).toEqual({ lit: '$version', ver: 7, nm: 'edge' })

      const tooMany = new Array<number>(101).fill(1)
      const placeholders = tooMany.map(() => '?').join(',')
      expect(() =>
        db.query(`SELECT ${placeholders}`).all(...tooMany),
      ).toThrow(/100/)
    } finally {
      db.close()
      storage.close()
    }
  })

  it('chunks 220-node and 220-edge batch operations strictly within <=90 bind parameters per query', async () => {
    const storage = new StrictMockCloudflareDoStorage()
    const db = new DoSqliteDatabase(storage)

    try {
      configureSqliteDatabase(db, ':cloudflare-do:batch')
      applyDatabaseMigrations(
        db,
        createDatabaseMigrations(EMBEDDED_INITIAL_SCHEMA_SQL),
      )

      const tableRepo = new SqliteTableRepository(db)
      const attrTypeRepo = new SqliteAttributeTypeRepository(db)
      const attrRepo = new SqliteAttributeRepository(db)
      const nodeRepo = new SqliteNodeRepository(db)
      const nodeAttrRepo = new SqliteNodeAttributeRepository(db)
      const relTypeRepo = new SqliteRelationTypeRepository(db)
      const relRepo = new SqliteNodeRelationRepository(db)
      const searchRepo = new SqliteNodeSearchRepository(db)
      const graphRepo = new SqliteGraphRepository(db)

      const table = Table.create('batch_table', 'DO SQLite chunking verification')
      await tableRepo.save(table)
      const savedTable = requireValue(
        await tableRepo.findByIdentifier('batch_table'),
        'savedTable',
      )
      const tableId = savedTable.id

      const strAttrType = AttributeType.create(
        'text_short',
        'string',
        undefined,
        'Short string',
      )
      await attrTypeRepo.save(strAttrType)
      const savedAttrType = requireValue(
        await attrTypeRepo.findByIdentifier('text_short'),
        'savedAttrType',
      )
      const tagAttr = Attribute.create(
        tableId,
        'tag',
        savedAttrType.getId(),
        'Tag',
      )
      await attrRepo.save(tagAttr)
      const savedAttr = requireValue(
        await attrRepo.findByTableIdAndIdentifier(tableId, 'tag'),
        'savedAttr',
      )
      const tagAttrId = savedAttr.getId()

      const relType = RelationType.create('linked_to', 'Directed test edge')
      await relTypeRepo.save(relType)
      const savedRelType = requireValue(
        await relTypeRepo.findByIdentifier('linked_to'),
        'savedRelType',
      )
      const relTypeId = savedRelType.getId()

      const nodeIds: string[] = []
      const tagValues: string[] = []
      for (let i = 0; i < 220; i += 1) {
        const content = `batch-node-${i}`
        const node = Node.create(tableId, content, `Node ${i}`)
        await nodeRepo.save(node)
        const persisted = requireValue(
          await nodeRepo.findByTableIdAndContent(tableId, content),
          'persisted node',
        )
        const nodeId = persisted.getId()
        nodeIds.push(nodeId)
        const tag = `tag-${i}`
        tagValues.push(tag)
        await nodeAttrRepo.save(NodeAttribute.create(nodeId, tagAttrId, tag))
      }

      for (let i = 0; i < nodeIds.length - 1; i += 1) {
        const sourceId = requireValue(nodeIds[i], 'source node id')
        const targetId = requireValue(nodeIds[i + 1], 'target node id')
        await relRepo.save(
          NodeRelation.create(
            tableId,
            sourceId,
            'internal',
            targetId,
            'internal',
            relTypeId,
          ),
        )
      }

      const byIds = await nodeRepo.findByIds(nodeIds)
      expect(byIds).toHaveLength(220)

      const existingIds = await nodeRepo.findExistingIds(nodeIds)
      expect(existingIds.size).toBe(220)

      const attrsByNodeIds = await nodeAttrRepo.findByNodeIds(nodeIds)
      expect(attrsByNodeIds).toHaveLength(220)

      const adjRelationsBoth = await relRepo.findAdjacentByNodeIds(
        nodeIds,
        'BOTH',
        [relTypeId],
      )
      expect(adjRelationsBoth.size).toBe(220)
      const node100Id = requireValue(nodeIds[100], 'nodeIds[100]')
      const node99Id = requireValue(nodeIds[99], 'nodeIds[99]')
      const node101Id = requireValue(nodeIds[101], 'nodeIds[101]')
      expect(adjRelationsBoth.get(node100Id)?.length).toBe(2)

      const adjTargetsBoth = await relRepo.findAdjacentEdgeTargetsByNodeIds(
        nodeIds,
        'BOTH',
        [relTypeId],
      )
      expect(adjTargetsBoth.size).toBe(220)
      expect(new Set(adjTargetsBoth.get(node100Id))).toEqual(
        new Set([node99Id, node101Id]),
      )

      const hydrated = searchRepo.hydrateNodesByIds(nodeIds)
      expect(hydrated).toHaveLength(220)

      const searchQuery: SearchQuery = {
        conditions: [
          {
            logicalOperator: LogicalOperator.AND,
            filters: [
              {
                field: 'tag',
                operator: SearchOperator.IN,
                value: tagValues.slice(0, 120),
                valueType: 'string',
              },
            ],
          },
        ],
        limit: 50,
        offset: 0,
      }
      const filteredSearch = await searchRepo.searchNodes(
        tableId,
        searchQuery,
        [
          {
            id: tagAttrId,
            identifier: 'tag',
            dataType: 'string',
          },
        ],
      )
      expect(filteredSearch.totalCount).toBe(120)

      const depChain = await graphRepo.getDependencyChain(
        tableId,
        requireValue(nodeIds[5], 'nodeIds[5]'),
        RelationDirection.BOTH,
        ['linked_to'],
        3,
      )
      expect(depChain.length).toBeGreaterThanOrEqual(5)

      const paths = await graphRepo.findPathsBetweenNodes(
        tableId,
        nodeIds.slice(0, 60),
        nodeIds.slice(1, 61),
        2,
        ['linked_to'],
      )
      expect(paths.length).toBeGreaterThan(0)

      expect(storage.maxObservedBindings).toBeLessThanOrEqual(
        CLOUDFLARE_DO_MAX_BIND_PARAMS,
      )
    } finally {
      db.close()
      storage.close()
    }
  })

  it('serves GraphQL hierarchy, traversal, analytics queries, and REST routes via CloudflareSingleNodeWorker', async () => {
    const storage = new StrictMockCloudflareDoStorage()
    const bucketMap = new Map<
      string,
      { body: Uint8Array; customMetadata?: Record<string, string> }
    >()
    const mockR2Bucket: CloudflareR2BucketLike = {
      async put(key, value, opts) {
        const bytes =
          typeof value === 'string'
            ? new TextEncoder().encode(value)
            : value instanceof ArrayBuffer
              ? new Uint8Array(value)
              : new Uint8Array(
                  value.buffer,
                  value.byteOffset,
                  value.byteLength,
                )
        bucketMap.set(key, {
          body: new Uint8Array(bytes),
          customMetadata: opts?.customMetadata,
        })
      },
      async get(key): Promise<CloudflareR2ObjectBodyLike | null> {
        const item = bucketMap.get(key)
        if (!item) return null
        return {
          size: item.body.byteLength,
          customMetadata: item.customMetadata,
          uploaded: new Date(),
          async arrayBuffer() {
            return item.body.buffer.slice(
              item.body.byteOffset,
              item.body.byteOffset + item.body.byteLength,
            ) as ArrayBuffer
          },
        }
      },
      async delete(keys) {
        const list = Array.isArray(keys) ? keys : [keys]
        for (const k of list) bucketMap.delete(k)
      },
      async list(opts) {
        const prefix = opts?.prefix
        const objects = [...bucketMap.keys()]
          .filter((k) => !prefix || k.startsWith(prefix))
          .sort()
          .map((key) => ({ key }))
        return { objects }
      },
    }

    const doNode = createCloudflareDurableObjectNode(storage, {
      snapshotBucket: mockR2Bucket,
      nodeKey: 'workspace-alpha',
    })

    const stubByName = new Map<string, ReturnType<typeof createCloudflareDurableObjectNode>>()
    stubByName.set('workspace-alpha', doNode)

    const env = {
      GRAPH_NODE: {
        idFromName(name: string) {
          return name
        },
        get(id: unknown) {
          return stubByName.get(String(id)) ?? doNode
        },
        getByName(name: string) {
          return stubByName.get(name) ?? doNode
        },
      },
      SNAPSHOT_BUCKET: mockR2Bucket,
      DEFAULT_NODE_KEY: 'workspace-alpha',
    }

    try {
      // Invalid node key should fail closed with 400
      const badKeyResp = await routeSingleNodeRequest(
        new Request('https://worker.local/health', {
          headers: { 'x-graph-node-key': 'bad/key with spaces' },
        }),
        env,
      )
      expect(badKeyResp.status).toBe(400)

      // Health endpoint reports DO SQLite driver and bind param ceiling
      const healthResp = await routeSingleNodeRequest(
        new Request('https://worker.local/health', {
          headers: { 'x-graph-node-key': 'workspace-alpha' },
        }),
        env,
      )
      expect(healthResp.status).toBe(200)
      const healthJson = (await healthResp.json()) as {
        status: string
        driver: string
        maxBindParams: number
      }
      expect(healthJson.status).toBe('OK')
      expect(healthJson.driver).toBe('cloudflare-do-sqlite')
      expect(healthJson.maxBindParams).toBe(CLOUDFLARE_DO_MAX_BIND_PARAMS)

      const runGql = async <TData>(
        query: string,
        variables?: Record<string, unknown>,
      ): Promise<TData> => {
        const resp = await routeSingleNodeRequest(
          new Request('https://worker.local/graphql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-graph-node-key': 'workspace-alpha',
            },
            body: JSON.stringify({ query, variables }),
          }),
          env,
        )
        expect(resp.status).toBe(200)
        const payload = (await resp.json()) as {
          data?: TData
          errors?: Array<{ message: string }>
        }
        expect(payload.errors).toBeUndefined()
        return payload.data as TData
      }

      // Create hierarchy table, nodes, and parent relations via GraphQL
      const createdTable = await runGql<{
        createTable: { table: { id: string } }
      }>(`
        mutation {
          createTable(input: { identifier: "org_tree", description: "DO org" }) {
            table { id }
          }
        }
      `)
      const tableId = createdTable.createTable.table.id

      const relTypeRes = await runGql<{
        createRelationType: { relationType: { id: string } }
      }>(`
        mutation {
          createRelationType(input: { identifier: "parent", description: "Hierarchy parent" }) {
            relationType { id }
          }
        }
      `)
      const relTypeId = relTypeRes.createRelationType.relationType.id

      const mkNode = async (content: string) => {
        const res = await runGql<{ createNode: { node: { id: string } } }>(
          `
          mutation($tableId: ID!, $content: String!) {
            createNode(input: { tableId: $tableId, content: $content, title: $content }) {
              node { id }
            }
          }
        `,
          { tableId, content },
        )
        return res.createNode.node.id
      }

      const rootId = await mkNode('root-node')
      const childId = await mkNode('child-node')
      const leafId = await mkNode('leaf-node')

      const mkRel = async (sourceId: string, targetId: string) => {
        await runGql(
          `
          mutation($tableId: ID!, $sourceId: ID!, $targetId: ID!, $relationTypeId: ID!) {
            createRelation(input: {
              tableId: $tableId
              sourceNodeId: $sourceId
              targetNodeId: $targetId
              relationTypeId: $relationTypeId
            }) {
              relation { id }
            }
          }
        `,
          { tableId, sourceId, targetId, relationTypeId: relTypeId },
        )
      }
      await mkRel(rootId, childId)
      await mkRel(childId, leafId)

      // Hierarchy + Traversal + Track 2 analytics queries
      const gqlCheck = await runGql<{
        getDescendants: { entries: Array<{ node: { id: string }; depth: number }> }
        getAncestors: { ancestors: Array<{ node: { id: string }; depth: number }> }
        getConnectedNodes: { nodes: Array<{ id: string }> }
        node: {
          connectedNodes: Array<{ id: string }>
          shortestPath: Array<{ id: string }>
        } | null
        customSortFunctions: Array<{ id: string }>
        nodeAttributeAnalytics: { totalAttributes: number }
        templatePerformanceAnalytics: { totalTemplates: number }
      }>(
        `
        query($rootId: ID!, $leafId: ID!, $tableId: ID!) {
          getDescendants(nodeId: $rootId, relationTypeId: "parent", maxDepth: 4) {
            entries {
              node { id }
              depth
            }
          }
          getAncestors(nodeId: $leafId, relationTypeId: "parent", maxDepth: 4) {
            ancestors {
              node { id }
              depth
            }
          }
          getConnectedNodes(nodeId: $rootId, depth: 2, direction: OUTGOING, relationTypeIds: ["parent"]) {
            nodes { id }
          }
          node(id: $rootId) {
            connectedNodes(depth: 2, direction: "OUTGOING", relationTypes: ["parent"]) {
              id
            }
            shortestPath(targetNodeId: $leafId, maxDepth: 4) {
              id
            }
          }
          customSortFunctions {
            id
          }
          nodeAttributeAnalytics(tableId: $tableId) {
            totalAttributes
          }
          templatePerformanceAnalytics {
            totalTemplates
          }
        }
      `,
        { rootId, leafId, tableId },
      )

      expect(gqlCheck.getDescendants.entries.map((d) => d.node.id)).toEqual([
        childId,
        leafId,
      ])
      expect(gqlCheck.getAncestors.ancestors.map((a) => a.node.id)).toEqual([
        rootId,
        childId,
      ])
      expect(gqlCheck.getConnectedNodes.nodes.map((n) => n.id)).toEqual([
        childId,
        leafId,
      ])
      expect(gqlCheck.node?.connectedNodes.map((n) => n.id)).toEqual([
        childId,
        leafId,
      ])
      expect(gqlCheck.node?.shortestPath.map((n) => n.id)).toEqual([
        rootId,
        childId,
        leafId,
      ])
      expect(gqlCheck.customSortFunctions.length).toBeGreaterThanOrEqual(4)
      expect(gqlCheck.nodeAttributeAnalytics.totalAttributes).toBe(0)
      expect(gqlCheck.templatePerformanceAnalytics.totalTemplates).toBeGreaterThanOrEqual(4)

      // REST traversal endpoints via portable Web Fetch
      const connectedRest = await routeSingleNodeRequest(
        new Request(
          `https://worker.local/api/nodes/${rootId}/connected?depth=2&direction=OUTGOING`,
          { headers: { 'x-graph-node-key': 'workspace-alpha' } },
        ),
        env,
      )
      expect(connectedRest.status).toBe(200)
      const connectedJson = (await connectedRest.json()) as {
        success: boolean
        data: { connectedNodes: Array<{ id: string }> }
      }
      expect(connectedJson.success).toBe(true)
      expect(connectedJson.data.connectedNodes.map((n) => n.id)).toEqual([
        childId,
        leafId,
      ])

      const pathRest = await routeSingleNodeRequest(
        new Request('https://worker.local/api/nodes/shortest-path', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-graph-node-key': 'workspace-alpha',
          },
          body: JSON.stringify({
            fromNodeId: rootId,
            toNodeId: leafId,
            maxDepth: 4,
          }),
        }),
        env,
      )
      expect(pathRest.status).toBe(200)
      const pathJson = (await pathRest.json()) as {
        success: boolean
        data: { path: string[]; nodes: Array<{ id: string }>; distance: number }
      }
      expect(pathJson.success).toBe(true)
      expect(pathJson.data.distance).toBe(2)
      expect(pathJson.data.path).toEqual([rootId, childId, leafId])
      expect(pathJson.data.nodes.map((n) => n.id)).toEqual([
        rootId,
        childId,
        leafId,
      ])

      // Root /mcp and table /sub/:tableId/mcp parity on PortableBootstrap / CloudflareSingleNodeWorker
      const getRootMcp = await routeSingleNodeRequest(
        new Request('https://worker.local/mcp', {
          method: 'GET',
          headers: { 'x-graph-node-key': 'workspace-alpha' },
        }),
        env,
      )
      expect(getRootMcp.status).toBe(200)
      expect(await getRootMcp.json()).toMatchObject({
        protocolVersion: '2026-07-28',
        modernCapabilities: { tools: {} },
      })

      const deleteRootMcp = await routeSingleNodeRequest(
        new Request('https://worker.local/mcp', {
          method: 'DELETE',
          headers: { 'x-graph-node-key': 'workspace-alpha' },
        }),
        env,
      )
      expect(deleteRootMcp.status).toBe(405)
      expect(deleteRootMcp.headers.get('Allow')).toBe('POST, GET')

      const modernMeta = {
        'io.modelcontextprotocol/protocolVersion': '2026-07-28',
        'io.modelcontextprotocol/clientCapabilities': {},
      }
      const rootMcpHealth = await routeSingleNodeRequest(
        new Request('https://worker.local/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'MCP-Protocol-Version': '2026-07-28',
            'Mcp-Method': 'tools/call',
            'Mcp-Name': 'healthCheck',
            'x-graph-node-key': 'workspace-alpha',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'cf-hc',
            method: 'tools/call',
            params: { _meta: modernMeta, name: 'healthCheck', arguments: {} },
          }),
        }),
        env,
      )
      expect(rootMcpHealth.status).toBe(200)
      expect(await rootMcpHealth.json()).toMatchObject({
        result: {
          isError: false,
          structuredContent: {
            success: true,
            data: { healthCheck: { status: 'OK' } },
          },
        },
      })

      const getTableMcp = await routeSingleNodeRequest(
        new Request(`https://worker.local/sub/${tableId}/mcp`, {
          method: 'GET',
          headers: { 'x-graph-node-key': 'workspace-alpha' },
        }),
        env,
      )
      expect(getTableMcp.status).toBe(200)
      expect(await getTableMcp.json()).toMatchObject({
        protocolVersion: '2026-07-28',
        tableId,
      })

      const tableProjToolName = `get-openapi-projection-${tableId}`
      const tableMcpCall = await routeSingleNodeRequest(
        new Request(`https://worker.local/sub/${tableId}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'MCP-Protocol-Version': '2026-07-28',
            'Mcp-Method': 'tools/call',
            'Mcp-Name': tableProjToolName,
            'x-graph-node-key': 'workspace-alpha',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'cf-sub-proj',
            method: 'tools/call',
            params: {
              _meta: modernMeta,
              name: tableProjToolName,
              arguments: {},
            },
          }),
        }),
        env,
      )
      expect(tableMcpCall.status).toBe(200)
      expect(await tableMcpCall.json()).toMatchObject({
        result: {
          isError: false,
          structuredContent: {
            validation: { valid: true },
          },
        },
      })

      // Authenticated Cloudflare DO node enforces AccessControl + internalBridgeToken cleanly
      const bridgeToken = 'cloudflare-do-internal-bridge-token-123456'
      const accessControl = AccessControl.fromEnvironment({
        NODE_ENV: 'production',
        BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN: bridgeToken,
        BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({
          readerTok: { id: 'cf-reader', role: 'reader', tableIds: ['*'] },
        }),
      })
      const authedNode = createCloudflareDurableObjectNode(storage, {
        nodeKey: 'workspace-auth',
        accessControl,
        internalBridgeToken: bridgeToken,
      })
      try {
        const anonHealth = await authedNode.fetch(
          new Request('https://worker.local/health'),
        )
        expect(anonHealth.status).toBe(200)

        const unauthMcp = await authedNode.fetch(
          new Request('https://worker.local/mcp', { method: 'GET' }),
        )
        expect(unauthMcp.status).toBe(401)

        const readerWriteDenied = await authedNode.fetch(
          new Request('https://worker.local/mcp', {
            method: 'POST',
            headers: {
              Authorization: 'Bearer readerTok',
              'Content-Type': 'application/json',
              'MCP-Protocol-Version': '2026-07-28',
              'Mcp-Method': 'tools/call',
              'Mcp-Name': 'createTable',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 'cf-denied',
              method: 'tools/call',
              params: {
                _meta: modernMeta,
                name: 'createTable',
                arguments: { identifier: 'blocked' },
              },
            }),
          }),
        )
        expect(readerWriteDenied.status).toBe(403)

        const readerHealth = await authedNode.fetch(
          new Request('https://worker.local/mcp', {
            method: 'POST',
            headers: {
              Authorization: 'Bearer readerTok',
              'Content-Type': 'application/json',
              'MCP-Protocol-Version': '2026-07-28',
              'Mcp-Method': 'tools/call',
              'Mcp-Name': 'healthCheck',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 'cf-ok',
              method: 'tools/call',
              params: { _meta: modernMeta, name: 'healthCheck', arguments: {} },
            }),
          }),
        )
        expect(readerHealth.status).toBe(200)
        expect(await readerHealth.json()).toMatchObject({
          result: {
            isError: false,
            structuredContent: { success: true },
          },
        })
      } finally {
        const initializedAuthed = await authedNode.getNode()
        await initializedAuthed.dispose()
      }

      // Snapshot port round-trip on both InMemory and R2 adapters
      const payloadBytes = new TextEncoder().encode('{"nodes":3}')
      const memStorage = new InMemorySnapshotStorage()
      await memStorage.putSnapshot('snapshots/workspace-alpha/v1.json', payloadBytes, {
        version: '1',
      })
      expect(await memStorage.listSnapshots('snapshots/')).toEqual([
        'snapshots/workspace-alpha/v1.json',
      ])
      const memObj = await memStorage.getSnapshot(
        'snapshots/workspace-alpha/v1.json',
      )
      expect(new TextDecoder().decode(memObj?.data)).toBe('{"nodes":3}')
      await memStorage.deleteSnapshot('snapshots/workspace-alpha/v1.json')
      expect(await memStorage.listSnapshots('snapshots/')).toEqual([])

      const r2Storage = doNode.snapshotStorage ?? new R2BucketSnapshotStorage(mockR2Bucket)
      await r2Storage.putSnapshot('snapshots/workspace-alpha/latest.json', payloadBytes, {
        driver: 'cloudflare-do-sqlite',
      })
      expect(await r2Storage.listSnapshots('snapshots/')).toEqual([
        'snapshots/workspace-alpha/latest.json',
      ])
      const r2Obj = await r2Storage.getSnapshot(
        'snapshots/workspace-alpha/latest.json',
      )
      expect(new TextDecoder().decode(r2Obj?.data)).toBe('{"nodes":3}')
      await r2Storage.deleteSnapshot('snapshots/workspace-alpha/latest.json')
      expect(await r2Storage.listSnapshots('snapshots/')).toEqual([])

      expect(storage.maxObservedBindings).toBeLessThanOrEqual(
        CLOUDFLARE_DO_MAX_BIND_PARAMS,
      )
    } finally {
      const node = await doNode.getNode()
      await node.dispose()
      doNode.database.close()
      storage.close()
    }
  })
})

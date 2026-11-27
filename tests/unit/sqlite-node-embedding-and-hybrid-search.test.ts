import { Database } from '../../src/infrastructure/database/sqlite/SqliteAdapter.js'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { AccessControl, authorizeExternalRequest } from '@/application/security/AccessControl.js'
import { McpToolRegistry } from '@/application/services/McpToolRegistry.js'
import { TableSchemaProjectionService } from '@/application/services/TableSchemaProjectionService.js'
import type { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import type { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import type { HybridSearchNodesUseCase } from '@/application/use-cases/nodes/HybridSearchNodes.js'
import type { CreateRelationUseCase } from '@/application/use-cases/relations/CreateRelation.js'
import type { CreateRelationTypeUseCase } from '@/application/use-cases/relations/CreateRelationType.js'
import type { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import { AttributeType } from '@/domain/entities/AttributeType.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { INodeEmbeddingRepository } from '@/domain/repositories/INodeEmbeddingRepository.js'
import { createTestContainer } from '@/infrastructure/container/ContainerBootstrap.js'
import type { DIContainer } from '@/infrastructure/container/DIContainer.js'
import { GraphQLTokens } from '@/infrastructure/container/tokens/GraphQLTokens.js'
import { RepositoryTokens } from '@/infrastructure/container/tokens/RepositoryTokens.js'
import { UseCaseTokens } from '@/infrastructure/container/tokens/UseCaseTokens.js'
import {
  applyDatabaseMigrations,
  createDatabaseMigrations,
} from '@/infrastructure/database/sqlite/DatabaseMigrationRunner.js'
import { SqliteNodeEmbeddingRepository } from '@/infrastructure/database/sqlite/SqliteNodeEmbeddingRepository.js'
import type { NodeMutations } from '@/presentation/graphql/mutations/NodeMutations.js'
import type { NodeQueries } from '@/presentation/graphql/queries/NodeQueries.js'

const BASE_SCHEMA_SQL = readFileSync(
  resolve(import.meta.dirname, '../../scripts/database/schema.sql'),
  'utf8',
)

function initializeDiskDatabase(dbPath: string): Database {
  const db = new Database(dbPath)
  applyDatabaseMigrations(db, createDatabaseMigrations(BASE_SCHEMA_SQL))
  return db
}

describe('Persistent Float32 Node Embeddings & 4-Signal Hybrid Search', () => {
  let tempDir: string
  let container: DIContainer | null = null
  const openDatabases: Database[] = []

  beforeEach(() => {
    TableSchemaProjectionService.clearCache()
    tempDir = mkdtempSync(join(tmpdir(), 'hybrid-search-test-'))
    container = null
  })

  afterEach(async () => {
    for (const db of openDatabases.splice(0)) {
      db.close()
    }
    TableSchemaProjectionService.clearCache()
    if (container) {
      await container.dispose()
      container = null
    }
    rmSync(tempDir, { recursive: true, force: true })
  })

  test('persists Float32Array BLOBs across cold repository restarts, isolates dimensions, and filters by model', async () => {
    const dbPath = join(tempDir, 'embeddings.sqlite')
    const db1 = initializeDiskDatabase(dbPath)
    openDatabases.push(db1)

    db1.exec(`
      INSERT INTO tables (id, identifier, description) VALUES (1, 'docs', 'Documents');
      INSERT INTO nodes (id, table_id, content, title) VALUES
        (10, 1, 'graph kernel', 'Kernel'),
        (11, 1, 'vector engine', 'Vector'),
        (12, 1, 'other dim', 'Dim2');
    `)

    const repo1 = new SqliteNodeEmbeddingRepository(db1)
    const saved = await repo1.upsert({
      nodeId: '10',
      vector: [1, 0, 0, 0],
      model: 'bge-small',
    })
    expect(saved.dimension).toBe(4)
    expect(saved.model).toBe('bge-small')
    expect(saved.norm).toBeCloseTo(1, 5)

    await repo1.upsert({
      nodeId: '11',
      vector: [0.8, 0.6, 0, 0],
      model: 'text-embedding-3',
    })
    // Different dimension in same table must be safely skipped rather than crashing similarity scan
    await repo1.upsert({
      nodeId: '12',
      vector: [1, 0],
      model: 'bge-small',
    })

    db1.close()
    openDatabases.pop()

    // Reopen fresh SQLite connection + cold SqliteNodeEmbeddingRepository instance
    const db2 = new Database(dbPath)
    openDatabases.push(db2)
    const repo2 = new SqliteNodeEmbeddingRepository(db2)

    const reloaded = await repo2.findByNodeId('10')
    expect(reloaded).not.toBeNull()
    expect(reloaded?.vector).toEqual([1, 0, 0, 0])
    expect(reloaded?.model).toBe('bge-small')
    expect(await repo2.countByTableId('1')).toBe(3)

    const allModelsSearch = await repo2.searchSimilar({
      tableId: '1',
      queryVector: [1, 0, 0, 0],
      limit: 5,
    })
    expect(allModelsSearch.hits.map((hit) => hit.nodeId)).toEqual(['10', '11'])
    expect(allModelsSearch.hits[0]?.score).toBeCloseTo(1.0, 5)
    expect(allModelsSearch.hits[1]?.score).toBeCloseTo(0.8, 5)

    const filteredByModel = await repo2.searchSimilar({
      tableId: '1',
      queryVector: [1, 0, 0, 0],
      model: 'text-embedding-3',
      limit: 5,
    })
    expect(filteredByModel.hits.map((hit) => hit.nodeId)).toEqual(['11'])
  })

  test('invalidates warm Float32 cache via SQLite revision triggers when nodes or tables are deleted directly', async () => {
    const dbPath = join(tempDir, 'cascade.sqlite')
    const db = initializeDiskDatabase(dbPath)
    openDatabases.push(db)

    db.exec(`
      INSERT INTO tables (id, identifier, description) VALUES (1, 'alpha', 'Alpha');
      INSERT INTO nodes (id, table_id, content, title) VALUES
        (101, 1, 'first node', 'First'),
        (102, 1, 'second node', 'Second');
    `)

    const repo = new SqliteNodeEmbeddingRepository(db)
    await repo.upsert({ nodeId: '101', vector: [1, 0, 0] })
    await repo.upsert({ nodeId: '102', vector: [0.9, 0.1, 0] })

    // Prime the warm in-memory Float32 cache
    const warmHits = await repo.searchSimilar({
      tableId: '1',
      queryVector: [1, 0, 0],
      limit: 5,
    })
    expect(warmHits.hits.map((hit) => hit.nodeId)).toEqual(['101', '102'])

    // Delete node 101 directly in SQLite (even bypassing repository deleteByNodeId)
    db.run('DELETE FROM nodes WHERE id = 101')

    const afterNodeDelete = await repo.searchSimilar({
      tableId: '1',
      queryVector: [1, 0, 0],
      limit: 5,
    })
    expect(afterNodeDelete.hits.map((hit) => hit.nodeId)).toEqual(['102'])
    expect(await repo.findByNodeId('101')).toBeNull()

    // Delete table 1 directly in SQLite
    db.run('DELETE FROM tables WHERE id = 1')

    const afterTableDelete = await repo.searchSimilar({
      tableId: '1',
      queryVector: [1, 0, 0],
      limit: 5,
    })
    expect(afterTableDelete.hits).toEqual([])
    expect(await repo.countByTableId('1')).toBe(0)
  })

  test('combines N-hop graph traversal, typed numeric/string attribute filters, FTS5 BM25, and Float32 cosine similarity via RRF across UseCase and GraphQL', async () => {
    container = await createTestContainer()

    const createTable = (await container.resolve(
      UseCaseTokens.CREATE_TABLE_USE_CASE,
    )) as CreateTableUseCase
    const createAttribute = (await container.resolve(
      UseCaseTokens.CREATE_ATTRIBUTE_USE_CASE,
    )) as CreateAttributeUseCase
    const createNode = (await container.resolve(
      UseCaseTokens.CREATE_NODE_USE_CASE,
    )) as CreateNodeUseCase
    const createRelationType = (await container.resolve(
      UseCaseTokens.CREATE_RELATION_TYPE_USE_CASE,
    )) as CreateRelationTypeUseCase
    const createRelation = (await container.resolve(
      UseCaseTokens.CREATE_RELATION_USE_CASE,
    )) as CreateRelationUseCase
    const attributeTypeRepo = (await container.resolve(
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
    )) as IAttributeTypeRepository
    const embeddingRepo = (await container.resolve(
      RepositoryTokens.NODE_EMBEDDING_REPOSITORY,
    )) as INodeEmbeddingRepository
    const hybridSearchUseCase = (await container.resolve(
      UseCaseTokens.HYBRID_SEARCH_NODES_USE_CASE,
    )) as HybridSearchNodesUseCase
    const nodeQueries = (await container.resolve(
      GraphQLTokens.NODE_QUERIES,
    )) as NodeQueries
    const nodeMutations = (await container.resolve(
      GraphQLTokens.NODE_MUTATIONS,
    )) as NodeMutations

    await attributeTypeRepo.save(
      AttributeType.create('metric_score', 'number', undefined, 'Numeric quality score'),
    )
    await attributeTypeRepo.save(
      AttributeType.create('doc_status', 'string', undefined, 'Lifecycle status'),
    )
    const scoreType = await attributeTypeRepo.findByIdentifier('metric_score')
    const statusType = await attributeTypeRepo.findByIdentifier('doc_status')
    if (!scoreType || !statusType) {
      throw new Error('Expected saved attribute types to be resolvable')
    }

    const { table } = await createTable.execute({
      identifier: 'knowledge_graph',
      description: 'Hybrid graph search test table',
    })

    await createAttribute.execute({
      tableId: table.id,
      identifier: 'score',
      name: 'Score',
      attributeTypeId: scoreType.getId(),
    })
    await createAttribute.execute({
      tableId: table.id,
      identifier: 'status',
      name: 'Status',
      attributeTypeId: statusType.getId(),
    })
    const { relationType } = await createRelationType.execute({
      identifier: 'depends_on',
      description: 'Dependency edge',
    })

    const anchor = (
      await createNode.execute({
        tableId: table.id,
        content: 'anchor architecture root',
        title: 'Anchor',
        attributes: { score: 99, status: 'active' },
      })
    ).node

    // Candidate A: 1-hop, passes typed filter (score 95 > 80, active), matches BOTH FTS ("distributed consensus") AND vector
    const dualOneHop = (
      await createNode.execute({
        tableId: table.id,
        content: 'distributed consensus raft protocol engine',
        title: 'Raft Consensus',
        attributes: { score: 95, status: 'active' },
      })
    ).node

    // Candidate B: 2-hop, passes typed filter (score 88 > 80, active), strong vector match only
    const vectorTwoHop = (
      await createNode.execute({
        tableId: table.id,
        content: 'quorum replication state machine',
        title: 'Quorum State',
        attributes: { score: 88, status: 'active' },
      })
    ).node

    // Candidate C: 1-hop, FAILS typed numeric filter (score 60 <= 80) despite matching FTS and vector
    const lowScoreFilteredOut = (
      await createNode.execute({
        tableId: table.id,
        content: 'distributed consensus draft notes',
        title: 'Low Score Draft',
        attributes: { score: 60, status: 'active' },
      })
    ).node

    // Candidate D: 3-hop (outside maxDepth = 2), passes typed filter and matches FTS + vector
    const threeHopExcluded = (
      await createNode.execute({
        tableId: table.id,
        content: 'distributed consensus distant subsystem',
        title: 'Distant Consensus',
        attributes: { score: 98, status: 'active' },
      })
    ).node

    // Candidate E: Unconnected node in same table, passes typed filter and matches FTS + vector
    const unconnectedExcluded = (
      await createNode.execute({
        tableId: table.id,
        content: 'distributed consensus isolated island',
        title: 'Isolated Consensus',
        attributes: { score: 97, status: 'active' },
      })
    ).node

    // Wire graph topology:
    // anchor -> dualOneHop -> vectorTwoHop -> threeHopExcluded
    // anchor -> lowScoreFilteredOut
    await createRelation.execute({
      tableId: table.id,
      sourceNodeId: anchor.id,
      targetNodeId: dualOneHop.id,
      relationTypeId: relationType.id,
    })
    await createRelation.execute({
      tableId: table.id,
      sourceNodeId: dualOneHop.id,
      targetNodeId: vectorTwoHop.id,
      relationTypeId: relationType.id,
    })
    await createRelation.execute({
      tableId: table.id,
      sourceNodeId: vectorTwoHop.id,
      targetNodeId: threeHopExcluded.id,
      relationTypeId: relationType.id,
    })
    await createRelation.execute({
      tableId: table.id,
      sourceNodeId: anchor.id,
      targetNodeId: lowScoreFilteredOut.id,
      relationTypeId: relationType.id,
    })

    // Store embeddings via GraphQL mutation & repository
    const mutationRes = await nodeMutations.setNodeEmbedding(null, {
      input: {
        nodeId: dualOneHop.id,
        tableId: table.id,
        vector: [0.95, 0.31, 0, 0],
        model: 'bge-m3',
      },
    })
    expect(mutationRes.success).toBe(true)
    expect(mutationRes.embedding?.dimension).toBe(4)

    await embeddingRepo.upsert({
      nodeId: vectorTwoHop.id,
      vector: [1, 0, 0, 0],
      model: 'bge-m3',
    })
    await embeddingRepo.upsert({
      nodeId: lowScoreFilteredOut.id,
      vector: [1, 0, 0, 0],
      model: 'bge-m3',
    })
    await embeddingRepo.upsert({
      nodeId: threeHopExcluded.id,
      vector: [1, 0, 0, 0],
      model: 'bge-m3',
    })
    await embeddingRepo.upsert({
      nodeId: unconnectedExcluded.id,
      vector: [1, 0, 0, 0],
      model: 'bge-m3',
    })

    const hybridOutput = await hybridSearchUseCase.execute({
      tableId: table.id,
      textQuery: 'distributed consensus',
      vector: [1, 0, 0, 0],
      model: 'bge-m3',
      filterQuery: 'score:>80 AND status:active',
      graph: {
        anchorNodeIds: [anchor.id],
        maxDepth: 2,
        direction: 'OUTGOING',
        relationTypes: ['depends_on'],
        includeAnchors: false,
      },
      limit: 10,
    })

    expect(hybridOutput.total).toBe(2)
    expect(hybridOutput.results.map((hit) => hit.node.id)).toEqual([
      dualOneHop.id,
      vectorTwoHop.id,
    ])

    const topHit = hybridOutput.results[0]
    const secondHit = hybridOutput.results[1]
    expect(topHit?.hopDistance).toBe(1)
    expect(topHit?.ftsRank).toBe(1)
    expect(topHit?.ftsScore).not.toBeNull()
    expect(topHit?.vectorScore).toBeGreaterThan(0.9)
    expect(secondHit?.hopDistance).toBe(2)
    expect(secondHit?.ftsRank).toBeNull()
    expect(secondHit?.vectorRank).toBe(1)
    expect(topHit?.combinedScore).toBeGreaterThan(secondHit?.combinedScore ?? 0)
    expect(hybridOutput.metrics.graphCandidates).toBe(3)
    expect(hybridOutput.metrics.eligibleCandidates).toBe(2)

    // Verify GraphQL query parity & removal mutation
    const gqlEmbedding = await nodeQueries.nodeEmbedding(null, { nodeId: dualOneHop.id })
    expect(gqlEmbedding?.nodeId).toBe(dualOneHop.id)

    const gqlHybrid = await nodeQueries.hybridSearchNodes(null, {
      input: {
        tableId: table.id,
        textQuery: 'distributed consensus',
        vector: [1, 0, 0, 0],
        filterQuery: 'score:>80',
        graph: {
          anchorNodeIds: [anchor.id],
          maxDepth: 2,
          direction: 'OUTGOING',
        },
      },
    })
    expect(gqlHybrid.results.map((hit) => hit.node.id)).toEqual([
      dualOneHop.id,
      vectorTwoHop.id,
    ])

    const removed = await nodeMutations.removeNodeEmbedding(null, { nodeId: dualOneHop.id })
    expect(removed.success).toBe(true)
    expect(removed.deleted).toBe(true)
    expect(await nodeQueries.nodeEmbedding(null, { nodeId: dualOneHop.id })).toBeNull()
  })

  test('enforces closed-by-default table-scoped AccessControl across REST, GraphQL, and Root MCP for embeddings and hybrid search', async () => {
    const control = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({
        readerAlpha: { id: 'reader-alpha', role: 'reader', tableIds: ['alpha'] },
        writerAlpha: { id: 'writer-alpha', role: 'writer', tableIds: ['alpha'] },
      }),
    })

    const registry = new McpToolRegistry()
    await registry.initialize()

    const nodeOwnership: Record<string, string> = {
      'node-alpha-1': 'alpha',
      'node-beta-1': 'beta',
    }
    const resourceResolver = {
      resolveNodeTableId: async (nodeId: string) => nodeOwnership[nodeId],
    }

    // 1. REST POST /api/nodes/hybrid-search is a read operation scoped to tableId + graph.anchorNodeIds
    const allowedReaderHybridRest = await authorizeExternalRequest(
      control,
      new Request('http://localhost/api/nodes/hybrid-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer readerAlpha',
        },
        body: JSON.stringify({
          tableId: 'alpha',
          textQuery: 'raft',
          graph: { anchorNodeIds: ['node-alpha-1'], maxDepth: 2 },
        }),
      }),
      (name, args) => registry.resolveAccess(name, args),
      resourceResolver,
    )
    expect(allowedReaderHybridRest.allowed).toBe(true)

    // Cross-table anchorNodeIds in hybrid search must be rejected with 404 not_found
    const crossTableAnchorRest = await authorizeExternalRequest(
      control,
      new Request('http://localhost/api/nodes/hybrid-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer readerAlpha',
        },
        body: JSON.stringify({
          tableId: 'alpha',
          graph: { anchorNodeIds: ['node-beta-1'], maxDepth: 2 },
        }),
      }),
      (name, args) => registry.resolveAccess(name, args),
      resourceResolver,
    )
    expect(crossTableAnchorRest).toEqual({
      allowed: false,
      status: 404,
      code: 'not_found',
    })

    // 2. REST PUT /api/nodes/:nodeId/embedding requires writer role on the node's owning table
    const deniedReaderSetEmbeddingRest = await authorizeExternalRequest(
      control,
      new Request('http://localhost/api/nodes/node-alpha-1/embedding', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer readerAlpha',
        },
        body: JSON.stringify({ vector: [1, 0, 0] }),
      }),
      (name, args) => registry.resolveAccess(name, args),
      resourceResolver,
    )
    expect(deniedReaderSetEmbeddingRest).toEqual({
      allowed: false,
      status: 403,
      code: 'forbidden',
    })

    const allowedWriterSetEmbeddingRest = await authorizeExternalRequest(
      control,
      new Request('http://localhost/api/nodes/node-alpha-1/embedding', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer writerAlpha',
        },
        body: JSON.stringify({ vector: [1, 0, 0] }),
      }),
      (name, args) => registry.resolveAccess(name, args),
      resourceResolver,
    )
    expect(allowedWriterSetEmbeddingRest.allowed).toBe(true)

    // 3. Root MCP tools/call authorization for set-node-embedding & hybrid-search-nodes
    const allowedWriterMcpSet = await authorizeExternalRequest(
      control,
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer writerAlpha',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'set-node-embedding',
            arguments: { nodeId: 'node-alpha-1', vector: [0.5, 0.5] },
          },
        }),
      }),
      (name, args) => registry.resolveAccess(name, args),
      resourceResolver,
    )
    expect(allowedWriterMcpSet.allowed).toBe(true)

    const crossTableMcpSet = await authorizeExternalRequest(
      control,
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer writerAlpha',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'set-node-embedding',
            arguments: { nodeId: 'node-beta-1', vector: [0.5, 0.5] },
          },
        }),
      }),
      (name, args) => registry.resolveAccess(name, args),
      resourceResolver,
    )
    expect(crossTableMcpSet).toEqual({
      allowed: false,
      status: 404,
      code: 'not_found',
    })

    // Missing nodeId on table-scoped MCP tool fails closed (404 not_found) for non-global principal
    const missingNodeIdMcpGet = await authorizeExternalRequest(
      control,
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer readerAlpha',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'get-node-embedding',
            arguments: {},
          },
        }),
      }),
      (name, args) => registry.resolveAccess(name, args),
      resourceResolver,
    )
    expect(missingNodeIdMcpGet).toEqual({
      allowed: false,
      status: 404,
      code: 'not_found',
    })
  })
})

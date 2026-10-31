import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { ILogger } from '@/application/ports/ILogger.js'
import { TableSchemaProjectionService } from '@/application/services/TableSchemaProjectionService.js'
import type { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import type { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import type { HybridSearchNodesUseCase } from '@/application/use-cases/nodes/HybridSearchNodes.js'
import { loadTableAttributeTypeInfo } from '@/application/use-cases/nodes/SearchNodes.js'
import type { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import type { NodeParent } from '@/core/types/GraphQLTypes.js'
import { AttributeType } from '@/domain/entities/AttributeType.js'
import { Node } from '@/domain/entities/Node.js'
import { NodeAttribute } from '@/domain/entities/NodeAttribute.js'
import { NodeRelation } from '@/domain/entities/NodeRelation.js'
import { RelationType } from '@/domain/entities/RelationType.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeEmbeddingRepository } from '@/domain/repositories/INodeEmbeddingRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { INodeSearchRepository } from '@/domain/repositories/INodeSearchRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { JsonlBackupService } from '@/domain/services/JsonlBackupService.js'
import { BoundedTopKCollector } from '@/domain/services/vector/ExactVectorIndex.js'
import { RelationDirection } from '@/domain/value-objects/RelationQuery.js'
import { createTestContainer } from '@/infrastructure/container/ContainerBootstrap.js'
import type { DIContainer } from '@/infrastructure/container/DIContainer.js'
import { CommonTokens } from '@/infrastructure/container/tokens/CommonTokens.js'
import { GraphQLTokens } from '@/infrastructure/container/tokens/GraphQLTokens.js'
import { RepositoryTokens } from '@/infrastructure/container/tokens/RepositoryTokens.js'
import { UseCaseTokens } from '@/infrastructure/container/tokens/UseCaseTokens.js'
import {
  applyDatabaseMigrations,
  createDatabaseMigrations,
} from '@/infrastructure/database/sqlite/DatabaseMigrationRunner.js'
import { SqliteAttributeRepository } from '@/infrastructure/database/sqlite/SqliteAttributeRepository.js'
import { SqliteGraphRepository } from '@/infrastructure/database/sqlite/SqliteGraphRepository.js'
import { SqliteNodeEmbeddingRepository } from '@/infrastructure/database/sqlite/SqliteNodeEmbeddingRepository.js'
import { NodeFieldResolvers } from '@/presentation/graphql/field-resolvers/NodeFieldResolvers.js'
import type { NodeMutations } from '@/presentation/graphql/mutations/NodeMutations.js'

const BASE_SCHEMA_SQL = readFileSync(
  resolve(import.meta.dir, '../../scripts/database/schema.sql'),
  'utf8',
)

function initializeDiskDatabase(dbPath: string): Database {
  const db = new Database(dbPath)
  applyDatabaseMigrations(db, createDatabaseMigrations(BASE_SCHEMA_SQL))
  return db
}

describe('P0-P2 Engine Optimizations Regression Suite', () => {
  let tempDir: string
  const openContainers: DIContainer[] = []
  const openDatabases: Database[] = []

  beforeEach(() => {
    TableSchemaProjectionService.clearCache()
    tempDir = mkdtempSync(join(tmpdir(), 'bun-graph-opt-'))
  })

  afterEach(async () => {
    for (const db of openDatabases.splice(0)) {
      db.close()
    }
    TableSchemaProjectionService.clearCache()
    for (const container of openContainers.splice(0)) {
      await container.dispose()
    }
    rmSync(tempDir, { recursive: true, force: true })
  })

  test('P0-1 & P1-2: restores SQLite rowid/covering index plans on node_embeddings and compacts Float32 slab buckets across upsertMany/delete', async () => {
    const db = initializeDiskDatabase(join(tempDir, 'p0-1.sqlite'))
    openDatabases.push(db)

    db.exec(`
      INSERT INTO tables (id, identifier, description) VALUES (1, 'vectors', 'Vector Table');
      INSERT INTO nodes (id, table_id, content, title) VALUES
        (1, 1, 'alpha', 'Alpha'),
        (2, 1, 'beta', 'Beta'),
        (3, 1, 'gamma', 'Gamma'),
        (4, 1, 'delta', 'Delta');
    `)

    const pkPlan = db
      .query<{ detail: string }, [string]>(
        'EXPLAIN QUERY PLAN SELECT node_id, table_id FROM node_embeddings WHERE node_id = ?',
      )
      .all('1')
      .map((row) => row.detail)
      .join(' | ')
    expect(pkPlan).toContain('USING INTEGER PRIMARY KEY')
    expect(pkPlan).not.toContain('SCAN node_embeddings')

    const tablePlan = db
      .query<{ detail: string }, [string]>(
        'EXPLAIN QUERY PLAN SELECT node_id, dimension, model, vector_blob, norm FROM node_embeddings WHERE table_id = ?',
      )
      .all('1')
      .map((row) => row.detail)
      .join(' | ')
    expect(tablePlan).toContain('idx_node_embeddings_table_dim')
    expect(tablePlan).not.toContain('SCAN node_embeddings')

    const repository = new SqliteNodeEmbeddingRepository(db)
    const batchRecords = await repository.upsertMany([
      { nodeId: '1', vector: [1, 0, 0, 0], model: 'm1' },
      { nodeId: '2', vector: [0.8, 0.6, 0, 0], model: 'm1' },
      { nodeId: '3', vector: [0, 1, 0, 0], model: 'm1' },
      { nodeId: '4', vector: [0.6, 0.8, 0, 0], model: 'm1' },
    ])
    expect(batchRecords).toHaveLength(4)

    // Warm slab cache, then delete middle slot ('2') and move '3' to another model bucket
    const initialSearch = await repository.searchSimilar({
      tableId: '1',
      queryVector: [1, 0, 0, 0],
      limit: 2,
      model: 'm1',
    })
    expect(initialSearch.hits.map((hit) => hit.nodeId)).toEqual(['1', '2'])

    expect(await repository.deleteByNodeId('2')).toBe(true)
    await repository.upsert({
      nodeId: '3',
      vector: [1, 0, 0, 0],
      model: 'm2',
    })

    const compactedSearch = await repository.searchSimilar({
      tableId: '1',
      queryVector: [1, 0, 0, 0],
      limit: 3,
      model: 'm1',
    })
    expect(compactedSearch.hits.map((hit) => hit.nodeId)).toEqual(['1', '4'])
    expect(compactedSearch.metrics.tableVectors).toBe(3)

    // BoundedTopKCollector deterministic tie-break check
    const collector = new BoundedTopKCollector<string>(2)
    collector.offer('node-c', 0.9, 'c')
    collector.offer('node-a', 0.9, 'a')
    collector.offer('node-b', 0.9, 'b')
    expect(collector.toSortedArray().map((entry) => entry.id)).toEqual([
      'node-a',
      'node-b',
    ])
  })

  test('P0-2: pins node_relations as outer driving loop for multi-frontier getDependencyChain traversals', async () => {
    const db = initializeDiskDatabase(join(tempDir, 'p0-2.sqlite'))
    openDatabases.push(db)

    db.exec(`
      INSERT INTO tables (id, identifier, description) VALUES (1, 'deps', 'Dependencies');
      INSERT INTO relation_types (id, identifier, description) VALUES (100, 'depends_on', 'Depends On');
      INSERT INTO nodes (id, table_id, content, title) VALUES
        (1, 1, 'root', 'Root'),
        (2, 1, 'branch-a', 'Branch A'),
        (3, 1, 'branch-b', 'Branch B'),
        (4, 1, 'shared-leaf', 'Shared Leaf');
      INSERT INTO node_relations (table_id, source_node_id, source_external_id, target_node_id, target_external_id, relation_type_id)
      VALUES
        (1, 1, 'internal', 2, 'internal', 100),
        (1, 1, 'internal', 3, 'internal', 100),
        (1, 2, 'internal', 4, 'internal', 100),
        (1, 3, 'internal', 4, 'internal', 100);
    `)

    const multiFrontierPlan = db
      .query<{ detail: string }, [string, string, number, string, string]>(
        `EXPLAIN QUERY PLAN
         SELECT DISTINCT CAST(nr.target_node_id AS TEXT) AS next_node_id
         FROM node_relations nr
         CROSS JOIN nodes source_node ON source_node.id = nr.source_node_id
         CROSS JOIN nodes target_node ON target_node.id = nr.target_node_id
         WHERE source_node.table_id = ?
           AND target_node.table_id = ?
           AND nr.relation_type_id IN (?)
           AND nr.source_node_id IN (?, ?)`,
      )
      .all('1', '1', 100, '2', '3')
      .map((row) => row.detail)

    expect(multiFrontierPlan[0]).toContain('SEARCH nr USING')
    expect(multiFrontierPlan.join(' | ')).not.toContain('SCAN ')

    const graphRepo = new SqliteGraphRepository(db)
    const outgoing = await graphRepo.getDependencyChain(
      '1',
      '1',
      RelationDirection.OUTGOING,
      ['depends_on'],
    )
    expect(outgoing.map((item) => item.nodeId)).toEqual(['2', '3', '4'])
    expect(outgoing.find((item) => item.nodeId === '4')?.level).toBe(2)

    const both = await graphRepo.getDependencyChain(
      '1',
      '2',
      RelationDirection.BOTH,
      ['depends_on'],
    )
    expect(both.map((item) => item.nodeId).sort()).toEqual(['1', '3', '4'])
  })

  test('P1-1: skips full-table filterNodeIds on unfiltered HybridSearchNodes and loads >10 attribute types in 1 JOIN', async () => {
    const db = initializeDiskDatabase(join(tempDir, 'p1-1.sqlite'))
    openDatabases.push(db)

    db.exec(`
      INSERT INTO tables (id, identifier, description) VALUES (1, 'articles', 'Articles');
      INSERT INTO attribute_types (id, identifier, json_type) VALUES (101, 'custom_text', 'string'), (102, 'custom_num', 'number');
    `)
    for (let idx = 1; idx <= 14; idx++) {
      db.query(
        'INSERT INTO attributes (id, table_id, identifier, name, attribute_type_id) VALUES (?, 1, ?, ?, ?)',
      ).run(idx, `attr_${idx}`, `Attr ${idx}`, idx % 2 === 0 ? 102 : 101)
    }

    const attrRepo = new SqliteAttributeRepository(db)
    const summaries = await attrRepo.findAttributeTypeInfoByTableId('1')
    expect(summaries).toHaveLength(14)
    expect(
      summaries.find((info) => info.identifier === 'attr_14')?.jsonType,
    ).toBe('number')
    const resolvedInfos = await loadTableAttributeTypeInfo(attrRepo, '1')
    expect(resolvedInfos).toHaveLength(14)
    expect(
      resolvedInfos.find((info) => info.identifier === 'attr_14')?.dataType,
    ).toBe('number')

    const container = await createTestContainer()
    openContainers.push(container)

    const createTable = (await container.resolve(
      UseCaseTokens.CREATE_TABLE_USE_CASE,
    )) as CreateTableUseCase
    const createNode = (await container.resolve(
      UseCaseTokens.CREATE_NODE_USE_CASE,
    )) as CreateNodeUseCase
    const embeddingRepo = (await container.resolve(
      RepositoryTokens.NODE_EMBEDDING_REPOSITORY,
    )) as INodeEmbeddingRepository
    const searchRepo = (await container.resolve(
      RepositoryTokens.NODE_SEARCH_REPOSITORY,
    )) as INodeSearchRepository
    const hybridSearch = (await container.resolve(
      UseCaseTokens.HYBRID_SEARCH_NODES_USE_CASE,
    )) as HybridSearchNodesUseCase

    const { table } = await createTable.execute({
      identifier: 'unfiltered-hybrid',
      description: 'Unfiltered hybrid test',
    })
    const n1 = await createNode.execute({
      tableId: table.id,
      content: 'sqlite covering index optimization',
      title: 'SQLite Index',
    })
    const n2 = await createNode.execute({
      tableId: table.id,
      content: 'contiguous float32 vector slab',
      title: 'Vector Slab',
    })
    await embeddingRepo.upsertMany?.([
      { nodeId: n1.node.id, vector: [0.9, 0.1, 0, 0], model: 'test' },
      { nodeId: n2.node.id, vector: [0.1, 0.9, 0, 0], model: 'test' },
    ])

    let filterNodeIdsCalls = 0
    const originalFilterNodeIds = searchRepo.filterNodeIds.bind(searchRepo)
    searchRepo.filterNodeIds = async (...args) => {
      filterNodeIdsCalls += 1
      return originalFilterNodeIds(...args)
    }

    const result = await hybridSearch.execute({
      tableId: table.id,
      query: 'sqlite',
      vector: [1, 0, 0, 0],
      model: 'test',
      limit: 5,
    })

    expect(filterNodeIdsCalls).toBe(0)
    expect(result.metrics.eligibleCandidates).toBe(2)
    expect(result.total).toBe(2)
    expect(result.results[0]?.node.id).toBe(n1.node.id)
  })

  test('P1-3: atomically rolls back batchCreateNodesTransactional on mid-batch duplicate or schema failure and batches batchSetNodeAttributes', async () => {
    const container = await createTestContainer()
    openContainers.push(container)

    const attrTypeRepo = (await container.resolve(
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
    )) as IAttributeTypeRepository
    let numberType = await attrTypeRepo.findByIdentifier('integer')
    if (!numberType) {
      await attrTypeRepo.save(
        AttributeType.create('integer', 'integer', undefined, 'Integer type'),
      )
      numberType = await attrTypeRepo.findByIdentifier('integer')
    }
    if (!numberType) throw new Error('Failed to create integer attribute type')

    const createTable = (await container.resolve(
      UseCaseTokens.CREATE_TABLE_USE_CASE,
    )) as CreateTableUseCase
    const createAttribute = (await container.resolve(
      UseCaseTokens.CREATE_ATTRIBUTE_USE_CASE,
    )) as CreateAttributeUseCase
    const nodeMutations = (await container.resolve(
      GraphQLTokens.NODE_MUTATIONS,
    )) as NodeMutations
    const nodeRepository = (await container.resolve(
      RepositoryTokens.NODE_REPOSITORY,
    )) as INodeRepository

    const { table } = await createTable.execute({
      identifier: 'atomic-batch-table',
      description: 'Atomic batch test',
    })
    const { attribute } = await createAttribute.execute({
      tableId: table.id,
      identifier: 'priority',
      name: 'Priority',
      attributeTypeId: numberType.getId(),
      isRequired: false,
    })

    // Mid-batch duplicate content: node #3 duplicates node #1 -> 0 nodes persisted!
    const dupRollback = await nodeMutations.batchCreateNodesTransactional(null, {
      nodes: [
        { tableId: table.id, content: 'atomic-1' },
        { tableId: table.id, content: 'atomic-2' },
        { tableId: table.id, content: 'atomic-1' },
      ],
    })
    expect(dupRollback).toEqual({
      success: false,
      totalCreated: 0,
      totalFailed: 3,
      rollbackOccurred: true,
    })
    const afterDup = await nodeRepository.findByTableId(table.id, {
      limit: 50,
      offset: 0,
    })
    expect((afterDup.data ?? afterDup.nodes ?? []).length).toBe(0)

    // Mid-batch schema violation on node #2 -> 0 nodes persisted!
    const schemaRollback = await nodeMutations.batchCreateNodesTransactional(
      null,
      {
        nodes: [
          {
            tableId: table.id,
            content: 'valid-first',
            attributes: [{ attributeId: attribute.id, value: '10' }],
          },
          {
            tableId: table.id,
            content: 'invalid-second',
            attributes: [{ attributeId: attribute.id, value: 'not-an-int' }],
          },
        ],
      },
    )
    expect(schemaRollback.success).toBe(false)
    expect(schemaRollback.rollbackOccurred).toBe(true)
    expect(schemaRollback.totalCreated).toBe(0)
    const afterSchemaFail = await nodeRepository.findByTableId(table.id, {
      limit: 50,
      offset: 0,
    })
    expect((afterSchemaFail.data ?? afterSchemaFail.nodes ?? []).length).toBe(0)

    // Valid atomic batch creation succeeds in 1 transaction
    const committed = await nodeMutations.batchCreateNodesTransactional(null, {
      nodes: [
        { tableId: table.id, content: 'committed-1' },
        { tableId: table.id, content: 'committed-2' },
        { tableId: table.id, content: 'committed-3' },
      ],
    })
    expect(committed).toEqual({
      success: true,
      totalCreated: 3,
      totalFailed: 0,
      rollbackOccurred: false,
    })

    const createdPage = await nodeRepository.findByTableId(table.id, {
      limit: 50,
      offset: 0,
    })
    const createdNodes = createdPage.data ?? createdPage.nodes ?? []
    expect(createdNodes).toHaveLength(3)

    // batchSetNodeAttributes preserves exact index ordering with valid + invalid entries
    const n0 = createdNodes[0]
    const n1 = createdNodes[1]
    const n2 = createdNodes[2]
    if (!n0 || !n1 || !n2) throw new Error('Expected 3 created nodes')

    const batchAttrResult = await nodeMutations.batchSetNodeAttributes(null, {
      attributeUpdates: [
        { nodeId: n0.getId(), attributeId: attribute.id, value: '1' },
        { nodeId: n1.getId(), attributeId: attribute.id, value: 'bad-int' },
        { nodeId: n2.getId(), attributeId: attribute.id, value: '3' },
      ],
    })
    expect(batchAttrResult.success).toBe(false)
    expect(batchAttrResult.totalSet).toBe(2)
    expect(batchAttrResult.totalFailed).toBe(1)
    expect(batchAttrResult.results[0]?.value).toBe('1')
    expect(batchAttrResult.results[1]?.value).toBeNull()
    expect(batchAttrResult.results[1]?.errors).toHaveLength(1)
    expect(batchAttrResult.results[2]?.value).toBe('3')

    const batchEmbeddingResult = await nodeMutations.batchSetNodeEmbeddings(
      null,
      {
        inputs: [
          { nodeId: n0.getId(), vector: [1, 0, 0, 0], model: 'batch-m1' },
          { nodeId: n1.getId(), vector: [0, 1, 0, 0], model: 'batch-m1' },
          { nodeId: n2.getId(), vector: [0, 0, 1, 0], model: 'batch-m1' },
        ],
      },
    )
    expect(batchEmbeddingResult.success).toBe(true)
    expect(batchEmbeddingResult.totalSet).toBe(3)
    expect(batchEmbeddingResult.totalFailed).toBe(0)
    expect(batchEmbeddingResult.embeddings).toHaveLength(3)
  })

  test('P2-1: microbatches NodeFieldResolvers attributes and relations across concurrent parents and suppresses info payload dumps', async () => {
    let findByNodeIdsCalls = 0
    let findByNodeIdCalls = 0
    let outgoingBatchCalls = 0
    let incomingBatchCalls = 0
    let infoLogCalls = 0

    const timestamp = new Date('2026-01-01T00:00:00.000Z')
    const nodes = ['1', '2', '3', '4'].map((id) =>
      Node.fromDatabase(id, 't1', `node-${id}`, id, null, null, timestamp, timestamp),
    )
    const nodesById = new Map(nodes.map((n) => [n.getId(), n]))

    const nodeRepository = {
      findById: async (id: string) => nodesById.get(id) ?? null,
      findByIds: async (ids: string[]) =>
        ids.flatMap((id) => {
          const found = nodesById.get(id)
          return found ? [found] : []
        }),
    } as unknown as INodeRepository

    const nodeAttributeRepository = {
      findByNodeId: async () => {
        findByNodeIdCalls += 1
        return []
      },
      findByNodeIds: async (nodeIds: string[]) => {
        findByNodeIdsCalls += 1
        return nodeIds.map((nodeId, idx) =>
          NodeAttribute.fromDatabase(
            `attr-${idx}`,
            nodeId,
            'a1',
            `val-${nodeId}`,
            timestamp,
            timestamp,
          ),
        )
      },
    } as unknown as INodeAttributeRepository

    const edge12 = NodeRelation.fromDatabase(
      'r1',
      't1',
      '1',
      'internal',
      '2',
      'internal',
      'rt1',
      null,
      1,
      timestamp,
      timestamp,
    )
    const edge31 = NodeRelation.fromDatabase(
      'r2',
      't1',
      '3',
      'internal',
      '1',
      'internal',
      'rt1',
      null,
      1,
      timestamp,
      timestamp,
    )

    const nodeRelationRepository = {
      findAdjacentByNodeIds: async (
        nodeIds: readonly string[],
        direction: 'OUTGOING' | 'INCOMING' | 'BOTH',
      ) => {
        if (direction === 'OUTGOING') outgoingBatchCalls += 1
        if (direction === 'INCOMING') incomingBatchCalls += 1
        const map = new Map<string, NodeRelation[]>(
          nodeIds.map((id) => [id, []]),
        )
        for (const rel of [edge12, edge31]) {
          const src = String(rel.getSourceNodeId())
          const dst = String(rel.getTargetNodeId())
          if ((direction === 'OUTGOING' || direction === 'BOTH') && map.has(src)) {
            map.get(src)?.push(rel)
          }
          if ((direction === 'INCOMING' || direction === 'BOTH') && map.has(dst)) {
            map.get(dst)?.push(rel)
          }
        }
        return map
      },
    } as unknown as INodeRelationRepository

    const loggerWithSpy: ILogger = {
      info: () => {
        infoLogCalls += 1
      },
      warn: () => {},
      error: () => {},
      debug: () => {},
    }

    const resolvers = new NodeFieldResolvers(
      nodeRepository,
      {} as ITableRepository,
      nodeAttributeRepository,
      nodeRelationRepository,
      {} as IRelationTypeRepository,
      loggerWithSpy,
    )

    const context = {
      requestId: 'req-batch-test',
      startTime: new Date(),
      requestCache: new Map<string, Promise<unknown>>(),
    }

    const parents: NodeParent[] = nodes.map((n) => ({
      id: n.getId(),
      tableId: 't1',
      content: n.getContent(),
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
    }))

    const [attrLists, attrCounts, outLists, relCounts] = await Promise.all([
      Promise.all(parents.map((p) => resolvers.attributes(p, undefined, context))),
      Promise.all(
        parents.map((p) => resolvers.attributeCount(p, undefined, context)),
      ),
      Promise.all(
        parents.map((p) => resolvers.outgoingRelations(p, undefined, context)),
      ),
      Promise.all(
        parents.map((p) => resolvers.relationCount(p, undefined, context)),
      ),
    ])

    expect(findByNodeIdCalls).toBe(0)
    expect(findByNodeIdsCalls).toBe(1)
    expect(outgoingBatchCalls).toBe(1)
    expect(incomingBatchCalls).toBe(1)
    expect(attrLists.map((list) => list?.length)).toEqual([1, 1, 1, 1])
    expect(attrCounts).toEqual([1, 1, 1, 1])
    expect(outLists[0]).toHaveLength(1)
    expect(relCounts).toEqual([2, 1, 1, 0])

    const connected = await resolvers.connectedNodes(
      parents[0] as NodeParent,
      { depth: 1, direction: 'BOTH' },
      context,
    )
    expect(connected.map((n) => n.getId()).sort()).toEqual(['2', '3'])
    expect(infoLogCalls).toBe(0)
  })

  test('P2-2: exports and imports persistent node embeddings via opt-in embeddings.jsonl without changing default manifest output', async () => {
    const sourceContainer = await createTestContainer()
    openContainers.push(sourceContainer)

    const srcCreateTable = (await sourceContainer.resolve(
      UseCaseTokens.CREATE_TABLE_USE_CASE,
    )) as CreateTableUseCase
    const srcCreateNode = (await sourceContainer.resolve(
      UseCaseTokens.CREATE_NODE_USE_CASE,
    )) as CreateNodeUseCase
    const srcEmbeddingRepo = (await sourceContainer.resolve(
      RepositoryTokens.NODE_EMBEDDING_REPOSITORY,
    )) as INodeEmbeddingRepository
    const srcBackup = (await sourceContainer.resolve(
      CommonTokens.JSONL_BACKUP_SERVICE,
    )) as JsonlBackupService

    const { table: srcTable } = await srcCreateTable.execute({
      identifier: 'knowledge-vec',
      description: 'Vector backup table',
    })
    const createdA = await srcCreateNode.execute({
      tableId: srcTable.id,
      content: 'doc-alpha',
      title: 'Alpha',
    })
    const createdB = await srcCreateNode.execute({
      tableId: srcTable.id,
      content: 'doc-beta',
      title: 'Beta',
    })
    await srcEmbeddingRepo.upsertMany?.([
      {
        nodeId: createdA.node.id,
        vector: [1, 0, 0, 0],
        model: 'bge-small',
      },
      {
        nodeId: createdB.node.id,
        vector: [0, 1, 0, 0],
        model: 'bge-small',
      },
    ])

    // Default export omits embeddings.jsonl and hasEmbeddings
    const defaultDir = join(tempDir, 'backup-default')
    const defaultExport = await srcBackup.export({ outputDir: defaultDir })
    expect(defaultExport.success).toBe(true)
    expect(existsSync(join(defaultDir, 'embeddings.jsonl'))).toBe(false)
    const defaultManifest = JSON.parse(
      readFileSync(join(defaultDir, 'manifest.json'), 'utf8'),
    ) as Record<string, unknown>
    expect('hasEmbeddings' in defaultManifest).toBe(false)

    // Opt-in includeEmbeddings exports embeddings.jsonl
    const vecDir = join(tempDir, 'backup-with-embeddings')
    const vecExport = await srcBackup.export({
      outputDir: vecDir,
      includeEmbeddings: true,
    })
    expect(vecExport.success).toBe(true)
    expect(vecExport.stats.embeddingsExported).toBe(2)
    expect(existsSync(join(vecDir, 'embeddings.jsonl'))).toBe(true)

    // Restore into a brand-new container whose node IDs are shifted by pre-existing rows
    TableSchemaProjectionService.clearCache()
    const destContainer = await createTestContainer()
    openContainers.push(destContainer)

    const dstCreateTable = (await destContainer.resolve(
      UseCaseTokens.CREATE_TABLE_USE_CASE,
    )) as CreateTableUseCase
    const dstCreateNode = (await destContainer.resolve(
      UseCaseTokens.CREATE_NODE_USE_CASE,
    )) as CreateNodeUseCase
    const dstEmbeddingRepo = (await destContainer.resolve(
      RepositoryTokens.NODE_EMBEDDING_REPOSITORY,
    )) as INodeEmbeddingRepository
    const dstBackup = (await destContainer.resolve(
      CommonTokens.JSONL_BACKUP_SERVICE,
    )) as JsonlBackupService

    const { table: fillerTable } = await dstCreateTable.execute({
      identifier: 'filler',
      description: 'Shifts auto-increment node IDs',
    })
    await dstCreateNode.execute({
      tableId: fillerTable.id,
      content: 'filler-1',
    })
    await dstCreateNode.execute({
      tableId: fillerTable.id,
      content: 'filler-2',
    })
    const { table: dstTable } = await dstCreateTable.execute({
      identifier: 'knowledge-vec',
      description: 'Destination vector backup table',
    })

    const imported = await dstBackup.import({
      inputDir: vecDir,
      conflictResolution: 'overwrite',
    })
    expect(imported.success).toBe(true)
    expect(imported.stats.nodesImported).toBe(2)
    expect(imported.stats.embeddingsImported).toBe(2)
    expect(await dstEmbeddingRepo.countByTableId(dstTable.id)).toBe(2)

    const similar = await dstEmbeddingRepo.searchSimilar({
      tableId: dstTable.id,
      queryVector: [1, 0, 0, 0],
      limit: 2,
      model: 'bge-small',
    })
    expect(similar.hits).toHaveLength(2)
    expect(similar.hits[0]?.score).toBeCloseTo(1, 5)
  })

  test('P2-3: performs full disaster-recovery JSONL restore of schema, typed attributes, relations, and embeddings into an empty shifted DB', async () => {
    const sourceContainer = await createTestContainer()
    openContainers.push(sourceContainer)

    const srcCreateTable = (await sourceContainer.resolve(
      UseCaseTokens.CREATE_TABLE_USE_CASE,
    )) as CreateTableUseCase
    const srcCreateAttr = (await sourceContainer.resolve(
      UseCaseTokens.CREATE_ATTRIBUTE_USE_CASE,
    )) as CreateAttributeUseCase
    const srcCreateNode = (await sourceContainer.resolve(
      UseCaseTokens.CREATE_NODE_USE_CASE,
    )) as CreateNodeUseCase
    const srcAttrTypeRepo = (await sourceContainer.resolve(
      RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY,
    )) as IAttributeTypeRepository
    const srcRelationTypeRepo = (await sourceContainer.resolve(
      RepositoryTokens.RELATION_TYPE_REPOSITORY,
    )) as IRelationTypeRepository
    const srcRelationRepo = (await sourceContainer.resolve(
      RepositoryTokens.NODE_RELATION_REPOSITORY,
    )) as INodeRelationRepository
    const srcEmbeddingRepo = (await sourceContainer.resolve(
      RepositoryTokens.NODE_EMBEDDING_REPOSITORY,
    )) as INodeEmbeddingRepository
    const srcBackup = (await sourceContainer.resolve(
      CommonTokens.JSONL_BACKUP_SERVICE,
    )) as JsonlBackupService

    let integerType = await srcAttrTypeRepo.findByIdentifier('integer')
    if (!integerType) {
      await srcAttrTypeRepo.save(
        AttributeType.create('integer', 'integer', undefined, 'Integer type'),
      )
      integerType = await srcAttrTypeRepo.findByIdentifier('integer')
    }
    if (!integerType) throw new Error('Expected integer attribute type')

    const { table: srcTable } = await srcCreateTable.execute({
      identifier: 'dr-knowledge',
      description: 'Disaster recovery graph table',
    })
    await srcCreateAttr.execute({
      tableId: srcTable.id,
      identifier: 'rank',
      name: 'Rank',
      attributeTypeId: integerType.getId(),
      isRequired: false,
    })

    const paper1 = await srcCreateNode.execute({
      tableId: srcTable.id,
      content: 'paper-1',
      title: 'Paper One',
      attributes: { rank: 1 },
    })
    const paper2 = await srcCreateNode.execute({
      tableId: srcTable.id,
      content: 'paper-2',
      title: 'Paper Two',
      attributes: { rank: 2 },
    })

    await srcRelationTypeRepo.save(
      RelationType.create('cites', 'Paper citation edge', 'academic'),
    )
    const citesType = await srcRelationTypeRepo.findByIdentifier('cites')
    if (!citesType) throw new Error('Expected cites relation type')

    await srcRelationRepo.save(
      NodeRelation.create(
        srcTable.id,
        paper1.node.id,
        'internal',
        paper2.node.id,
        'internal',
        citesType.getId(),
        { section: 'intro' },
        4,
      ),
    )

    await srcEmbeddingRepo.upsertMany?.([
      { nodeId: paper1.node.id, vector: [1, 0, 0, 0], model: 'dr-embed' },
      { nodeId: paper2.node.id, vector: [0, 1, 0, 0], model: 'dr-embed' },
    ])

    const drDir = join(tempDir, 'backup-dr-full')
    const exported = await srcBackup.export({
      outputDir: drDir,
      tableIdentifiers: ['dr-knowledge'],
      includeSchema: true,
      includeRelations: true,
      includeEmbeddings: true,
    })
    expect(exported.success).toBe(true)
    expect(exported.stats.tablesExported).toBe(1)
    expect(exported.stats.nodesExported).toBe(2)
    expect(exported.stats.relationsExported).toBe(1)
    expect(exported.stats.embeddingsExported).toBe(2)

    // Fresh destination container with pre-existing filler rows and WITHOUT dr-knowledge pre-created
    TableSchemaProjectionService.clearCache()
    const destContainer = await createTestContainer()
    openContainers.push(destContainer)

    const dstCreateTable = (await destContainer.resolve(
      UseCaseTokens.CREATE_TABLE_USE_CASE,
    )) as CreateTableUseCase
    const dstCreateNode = (await destContainer.resolve(
      UseCaseTokens.CREATE_NODE_USE_CASE,
    )) as CreateNodeUseCase
    const dstTableRepo = (await destContainer.resolve(
      RepositoryTokens.TABLE_REPOSITORY,
    )) as ITableRepository
    const dstNodeRepo = (await destContainer.resolve(
      RepositoryTokens.NODE_REPOSITORY,
    )) as INodeRepository
    const dstNodeAttrRepo = (await destContainer.resolve(
      RepositoryTokens.NODE_ATTRIBUTE_REPOSITORY,
    )) as INodeAttributeRepository
    const dstRelationRepo = (await destContainer.resolve(
      RepositoryTokens.NODE_RELATION_REPOSITORY,
    )) as INodeRelationRepository
    const dstEmbeddingRepo = (await destContainer.resolve(
      RepositoryTokens.NODE_EMBEDDING_REPOSITORY,
    )) as INodeEmbeddingRepository
    const dstBackup = (await destContainer.resolve(
      CommonTokens.JSONL_BACKUP_SERVICE,
    )) as JsonlBackupService

    const { table: filler } = await dstCreateTable.execute({
      identifier: 'preexisting-filler',
      description: 'Shifts destination table and node IDs',
    })
    await dstCreateNode.execute({ tableId: filler.id, content: 'shift-1' })
    await dstCreateNode.execute({ tableId: filler.id, content: 'shift-2' })
    await dstCreateNode.execute({ tableId: filler.id, content: 'shift-3' })

    const restored = await dstBackup.import({
      inputDir: drDir,
      conflictResolution: 'overwrite',
    })
    expect(restored.success).toBe(true)
    expect(restored.errors).toEqual([])
    expect(restored.stats.tablesImported).toBe(1)
    expect(restored.stats.nodesImported).toBe(2)
    expect(restored.stats.relationsImported).toBe(1)
    expect(restored.stats.embeddingsImported).toBe(2)

    const restoredTable = await dstTableRepo.findByIdentifier('dr-knowledge')
    expect(restoredTable).not.toBeNull()
    if (!restoredTable) throw new Error('Expected restored dr-knowledge table')

    const dstPaper1 = await dstNodeRepo.findByTableIdAndContent(
      restoredTable.id,
      'paper-1',
    )
    const dstPaper2 = await dstNodeRepo.findByTableIdAndContent(
      restoredTable.id,
      'paper-2',
    )
    expect(dstPaper1).not.toBeNull()
    expect(dstPaper2).not.toBeNull()
    if (!dstPaper1 || !dstPaper2) throw new Error('Expected restored nodes')
    expect(dstPaper1.getId()).not.toBe(paper1.node.id)

    const dstPaper1Attrs = await dstNodeAttrRepo.findByNodeId(dstPaper1.getId())
    expect(dstPaper1Attrs).toHaveLength(1)
    expect(dstPaper1Attrs[0]?.getValue()).toBe('1')

    const outgoing = await dstRelationRepo.findBySourceNodeId(dstPaper1.getId())
    expect(outgoing).toHaveLength(1)
    expect(String(outgoing[0]?.getTargetNodeId())).toBe(String(dstPaper2.getId()))
    expect(outgoing[0]?.getStrength()).toBe(4)

    const similar = await dstEmbeddingRepo.searchSimilar({
      tableId: restoredTable.id,
      queryVector: [1, 0, 0, 0],
      limit: 2,
      model: 'dr-embed',
    })
    expect(similar.hits[0]?.nodeId).toBe(dstPaper1.getId())
    expect(similar.hits[0]?.score).toBeCloseTo(1, 5)
  })
})

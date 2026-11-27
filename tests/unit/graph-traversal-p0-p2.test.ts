import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { graphql, type GraphQLSchema } from 'graphql'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { ILogger } from '@/application/ports/ILogger.js'
import { AccessControl, authorizeExternalRequest } from '@/application/security/AccessControl.js'
import type { HybridSearchNodesUseCase } from '@/application/use-cases/nodes/HybridSearchNodes.js'
import type { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import type { SearchRelatedNodesUseCase } from '@/application/use-cases/relations/SearchRelatedNodes.js'
import type { GetTableDocsUseCase } from '@/application/use-cases/tables/GetTableDocs.js'
import type { INodeEmbeddingRepository } from '@/domain/repositories/INodeEmbeddingRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { createTestContainer } from '@/infrastructure/container/ContainerBootstrap.js'
import type { DIContainer } from '@/infrastructure/container/DIContainer.js'
import { DatabaseTokens, RepositoryTokens, UseCaseTokens } from '@/infrastructure/container/tokens/index.js'
import {
  applyDatabaseMigrations,
  createDatabaseMigrations,
} from '@/infrastructure/database/sqlite/DatabaseMigrationRunner.js'
import type { Database } from '@/infrastructure/database/sqlite/SqliteAdapter.js'
import { GraphQLSchemaBuilder } from '@/presentation/graphql/GraphQLSchemaBuilder.js'
import { AttributeApiController } from '@/presentation/http/controllers/AttributeApiController.js'
import { GraphApiController } from '@/presentation/http/controllers/GraphApiController.js'
import { GraphDbApiController } from '@/presentation/http/controllers/GraphDbApiController.js'
import { McpToolController } from '@/presentation/http/controllers/McpToolController.js'
import { createBunApiRouter, type BunApiRouter } from '@/presentation/http/routes/BunApiRouter.js'

const SCHEMA_SQL = readFileSync(resolve(import.meta.dirname, '../../scripts/database/schema.sql'), 'utf8')

const silentLogger: ILogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
}

interface TestHarness {
  container: DIContainer
  schema: GraphQLSchema
  router: BunApiRouter
  nodeRepo: INodeRepository
  tableRepo: ITableRepository
  tableId: string
  otherTableId: string
  depTypeId: string
  refTypeId: string
  nodes: Record<string, string>
  otherNodeId: string
}

async function execGql<T = Record<string, unknown>>(
  schema: GraphQLSchema,
  source: string,
  variableValues: Record<string, unknown> = {},
): Promise<{ data?: T; errors?: readonly { message: string }[] }> {
  const result = await graphql({
    schema,
    source,
    variableValues,
    contextValue: {
      requestId: 'test-req',
      startTime: new Date(),
      requestCache: new Map(),
    },
  })
  return result as { data?: T; errors?: readonly { message: string }[] }
}

describe('P0-P2 Graph Traversal, REST Routes, AccessControl & Analytics Suite', () => {
  let harness: TestHarness

  beforeEach(async () => {
    const container = await createTestContainer()
    const db = (await container.resolve(DatabaseTokens.DATABASE_CONNECTION)) as Database
    applyDatabaseMigrations(db, createDatabaseMigrations(SCHEMA_SQL))

    const schema = await new GraphQLSchemaBuilder(container).build()
    const [
      tableRepo,
      nodeRepo,
      relationRepo,
      relationTypeRepo,
      getTableDocs,
      searchNodes,
      searchRelatedNodes,
      nodeEmbeddingRepo,
      hybridSearchNodes,
    ] = await Promise.all([
      container.resolve<ITableRepository>(RepositoryTokens.TABLE_REPOSITORY),
      container.resolve<INodeRepository>(RepositoryTokens.NODE_REPOSITORY),
      container.resolve<INodeRelationRepository>(RepositoryTokens.NODE_RELATION_REPOSITORY),
      container.resolve<IRelationTypeRepository>(RepositoryTokens.RELATION_TYPE_REPOSITORY),
      container.resolve<GetTableDocsUseCase>(UseCaseTokens.GET_TABLE_DOCS_USE_CASE),
      container.resolve<SearchNodesUseCase>(UseCaseTokens.SEARCH_NODES_USE_CASE),
      container.resolve<SearchRelatedNodesUseCase>(UseCaseTokens.SEARCH_RELATED_NODES_USE_CASE),
      container.resolve<INodeEmbeddingRepository>(RepositoryTokens.NODE_EMBEDDING_REPOSITORY),
      container.resolve<HybridSearchNodesUseCase>(UseCaseTokens.HYBRID_SEARCH_NODES_USE_CASE),
    ])

    const graphController = new GraphApiController(
      silentLogger,
      getTableDocs,
      searchNodes,
      searchRelatedNodes,
      tableRepo,
      relationRepo,
      4000,
      undefined,
      fetch,
      undefined,
      undefined,
      nodeEmbeddingRepo,
      hybridSearchNodes,
      nodeRepo,
      relationTypeRepo,
    )

    const router = createBunApiRouter({
      logger: silentLogger,
      graphDbController: new GraphDbApiController(silentLogger),
      attributeController: new AttributeApiController(
        undefined as never,
        undefined as never,
        undefined as never,
        silentLogger,
      ),
      graphController,
      mcpToolController: new McpToolController(silentLogger),
    })

    const t1 = await execGql<{ createTable: { table: { id: string } } }>(
      schema,
      `mutation { createTable(input: { identifier: "graph_alpha", name: "Graph Alpha" }) { table { id } } }`,
    )
    const t2 = await execGql<{ createTable: { table: { id: string } } }>(
      schema,
      `mutation { createTable(input: { identifier: "graph_beta", name: "Graph Beta" }) { table { id } } }`,
    )
    const tableId = t1.data?.createTable.table.id ?? ''
    const otherTableId = t2.data?.createTable.table.id ?? ''

    const rtDep = await execGql<{ createRelationType: { relationType: { id: string } } }>(
      schema,
      `mutation { createRelationType(input: { identifier: "topo_dep", name: "Topo Dep" }) { relationType { id } } }`,
    )
    const rtRef = await execGql<{ createRelationType: { relationType: { id: string } } }>(
      schema,
      `mutation { createRelationType(input: { identifier: "topo_ref", name: "Topo Ref" }) { relationType { id } } }`,
    )
    const depTypeId = rtDep.data?.createRelationType.relationType.id ?? ''
    const refTypeId = rtRef.data?.createRelationType.relationType.id ?? ''

    const names = [
      'L0',
      'L1',
      'L2',
      'L3',
      'L4',
      'C0',
      'C1',
      'C2',
      'D0',
      'D1',
      'D2',
      'D3',
      'D4',
      'D5',
      'I0',
      'I1',
      'S_in',
      'S_center',
      'S_out',
    ]
    const nodes: Record<string, string> = {}
    for (const content of names) {
      const created = await execGql<{ createNode: { node: { id: string } } }>(
        schema,
        `mutation($t: ID!, $c: String!) { createNode(input: { tableId: $t, content: $c }) { node { id } } }`,
        { t: tableId, c: content },
      )
      nodes[content] = created.data?.createNode.node.id ?? ''
    }

    const otherCreated = await execGql<{ createNode: { node: { id: string } } }>(
      schema,
      `mutation($t: ID!) { createNode(input: { tableId: $t, content: "BetaOnly" }) { node { id } } }`,
      { t: otherTableId },
    )
    const otherNodeId = otherCreated.data?.createNode.node.id ?? ''

    const edges: Array<[string, string, string, number, number]> = [
      ['L0', 'L1', depTypeId, 2, 3],
      ['L1', 'L2', depTypeId, 2, 3],
      ['L2', 'L3', depTypeId, 2, 3],
      ['L3', 'L4', depTypeId, 2, 3],
      ['C0', 'C1', depTypeId, 3, 4],
      ['C1', 'C2', depTypeId, 3, 4],
      ['C2', 'C0', depTypeId, 3, 4],
      // Weak 2-hop D0->D1->D3 vs strong 3-hop D0->D2->D4->D3
      ['D0', 'D1', depTypeId, 0, 0],
      ['D1', 'D3', depTypeId, 0, 0],
      ['D0', 'D2', depTypeId, 4, 4],
      ['D2', 'D4', depTypeId, 4, 4],
      ['D4', 'D3', depTypeId, 4, 4],
      ['D0', 'D5', refTypeId, 4, 4],
      // Disconnected island
      ['I0', 'I1', depTypeId, 1, 1],
      // Mixed star
      ['S_in', 'S_center', depTypeId, 2, 3],
      ['S_center', 'S_out', refTypeId, 2, 3],
    ]

    for (const [s, t, rt, strength, confidence] of edges) {
      await execGql(
        schema,
        `mutation($t: ID!, $s: ID!, $tgt: ID!, $rt: ID!, $str: Float!, $conf: Float!) {
          createRelation(input: { tableId: $t, sourceNodeId: $s, targetNodeId: $tgt, relationTypeId: $rt, strength: $str, confidence: $conf }) {
            success
          }
        }`,
        { t: tableId, s: nodes[s], tgt: nodes[t], rt, str: strength, conf: confidence },
      )
    }

    // Add an unresolved external relation for resolveExternalReferences coverage
    db.run(
      `INSERT INTO node_relations (table_id, source_node_id, source_external_id, target_node_id, target_external_id, relation_type_id, properties, strength, confidence)
       VALUES (?, ?, 'internal', NULL, 'github:issue-99', ?, NULL, 3, 4)`,
      [tableId, nodes.L0, refTypeId],
    )

    harness = {
      container,
      schema,
      router,
      nodeRepo,
      tableRepo,
      tableId,
      otherTableId,
      depTypeId,
      refTypeId,
      nodes,
      otherNodeId,
    }
  })

  afterEach(async () => {
    await harness.container.dispose()
  })

  test('P0: unifies getConnectedNodes, getDependencyChain, and findPathsBetweenNodes with full hydration and both ID & identifier filters', async () => {
    const idToName = Object.fromEntries(Object.entries(harness.nodes).map(([k, v]) => [v, k]))

    // getConnectedNodes: depth 0 returns empty, non-existent type returns empty, depth 2 hydrates content & relations
    const connZero = await execGql<{ getConnectedNodes: { totalCount: number; nodes: Array<{ id: string }> } }>(
      harness.schema,
      `query($id: ID!) { getConnectedNodes(nodeId: $id, depth: 0, direction: OUTGOING) { totalCount nodes { id content } } }`,
      { id: harness.nodes.L0 },
    )
    expect(connZero.errors).toBeUndefined()
    expect(connZero.data?.getConnectedNodes.totalCount).toBe(0)
    expect(connZero.data?.getConnectedNodes.nodes).toEqual([])

    const connTwo = await execGql<{
      getConnectedNodes: {
        totalCount: number
        nodes: Array<{ id: string; content: string; distance: number }>
        relations: Array<{ id: string; relationshipType: string }>
      }
    }>(
      harness.schema,
      `query($id: ID!, $rt: [ID!]) {
        getConnectedNodes(nodeId: $id, depth: 2, direction: OUTGOING, relationTypeIds: $rt) {
          totalCount
          nodes { id content distance }
          relations { id relationshipType }
        }
      }`,
      { id: harness.nodes.D0, rt: ['topo_dep'] },
    )
    expect(connTwo.errors).toBeUndefined()
    expect(connTwo.data?.getConnectedNodes.nodes.map((n) => n.content).sort()).toEqual(['D1', 'D2', 'D3', 'D4'])
    expect(connTwo.data?.getConnectedNodes.relations.length).toBeGreaterThanOrEqual(4)
    expect(connTwo.data?.getConnectedNodes.relations.every((r) => r.relationshipType === 'topo_dep')).toBe(true)

    // getDependencyChain: honors BOTH direction, maxDepth, full Node.content hydration, and numeric ID or identifier
    const depBoth = await execGql<{
      getDependencyChain: {
        totalCount: number
        nodes: Array<{ id: string; content: string }>
        relations: Array<{ id: string; relationshipType: string }>
      }
    }>(
      harness.schema,
      `query($id: ID!) {
        getDependencyChain(input: { nodeId: $id, direction: BOTH, maxDepth: 1 }) {
          totalCount
          nodes { id content }
          relations { id relationshipType }
        }
      }`,
      { id: harness.nodes.S_center },
    )
    expect(depBoth.errors).toBeUndefined()
    expect(depBoth.data?.getDependencyChain.nodes.map((n) => n.content).sort()).toEqual(['S_in', 'S_out'])

    const depMaxDepth2 = await execGql<{
      getDependencyChain: { nodes: Array<{ content: string }> }
    }>(
      harness.schema,
      `query($id: ID!, $rt: [ID!]) {
        getDependencyChain(input: { nodeId: $id, direction: OUTGOING, maxDepth: 2, relationTypeIds: $rt }) {
          nodes { content }
        }
      }`,
      { id: harness.nodes.L0, rt: [harness.depTypeId] },
    )
    expect(depMaxDepth2.errors).toBeUndefined()
    expect(depMaxDepth2.data?.getDependencyChain.nodes.map((n) => n.content)).toEqual(['L1', 'L2'])

    // findPathsBetweenNodes: numeric ID works, content & relations hydrate cleanly
    const paths = await execGql<{
      findPathsBetweenNodes: Array<{
        length: number
        totalWeight: number
        nodes: Array<{ id: string; content: string }>
        relations: Array<{ id: string; relationshipType: string }>
      }>
    }>(
      harness.schema,
      `query($s: ID!, $t: ID!, $rt: [ID!]) {
        findPathsBetweenNodes(input: { sourceNodeId: $s, targetNodeId: $t, maxDepth: 4, relationTypeIds: $rt }) {
          length
          totalWeight
          nodes { id content }
          relations { id relationshipType }
        }
      }`,
      { s: harness.nodes.D0, t: harness.nodes.D3, rt: [harness.depTypeId] },
    )
    expect(paths.errors).toBeUndefined()
    expect(paths.data?.findPathsBetweenNodes).toHaveLength(2)
    expect(paths.data?.findPathsBetweenNodes[0]?.nodes.map((n) => idToName[n.id])).toEqual(['D0', 'D1', 'D3'])
    expect(paths.data?.findPathsBetweenNodes[0]?.relations.map((r) => r.relationshipType)).toEqual([
      'topo_dep',
      'topo_dep',
    ])
    expect(paths.data?.findPathsBetweenNodes[1]?.nodes.map((n) => n.content)).toEqual(['D0', 'D2', 'D4', 'D3'])
    expect(paths.data?.findPathsBetweenNodes[1]?.totalWeight).toBe(12)
  })

  test('P1: scopes searchRelatedNodes to reachable nodes, mounts REST graph routes with AccessControl, and enforces 0..4 strength/confidence', async () => {
    const related = await execGql<{
      searchRelatedNodes: {
        totalCount: number
        nodes: Array<{ content: string }>
        relations: Array<{ id: string; relationshipType: string }>
      }
    }>(
      harness.schema,
      `query($id: ID!) {
        searchRelatedNodes(filter: { sourceNodeId: $id, direction: OUTGOING, maxDepth: 2 }) {
          totalCount
          nodes { content }
          relations { id relationshipType }
        }
      }`,
      { id: harness.nodes.L0 },
    )
    expect(related.errors).toBeUndefined()
    expect(related.data?.searchRelatedNodes.totalCount).toBe(2)
    expect(related.data?.searchRelatedNodes.nodes.map((n) => n.content).sort()).toEqual(['L1', 'L2'])

    // REST connected + shortest-path routes via BunApiRouter
    const connRes = await harness.router(
      new Request(`http://localhost/api/nodes/${harness.nodes.L0}/connected?depth=2&direction=OUTGOING`),
    )
    expect(connRes.status).toBe(200)
    const connBody = (await connRes.json()) as { data: { totalCount: number; connectedNodes: Array<{ content: string }> } }
    expect(connBody.data.totalCount).toBe(2)
    expect(connBody.data.connectedNodes.map((n) => n.content)).toEqual(['L1', 'L2'])

    const spRes = await harness.router(
      new Request('http://localhost/api/nodes/shortest-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromNodeId: harness.nodes.L4,
          toNodeId: harness.nodes.L0,
          direction: 'BOTH',
          maxDepth: 5,
        }),
      }),
    )
    expect(spRes.status).toBe(200)
    const spBody = (await spRes.json()) as { data: { found: boolean; distance: number; path: string[] } }
    expect(spBody.data.found).toBe(true)
    expect(spBody.data.distance).toBe(4)
    expect(spBody.data.path).toEqual([harness.nodes.L4, harness.nodes.L3, harness.nodes.L2, harness.nodes.L1, harness.nodes.L0])

    // AccessControl allows scoped reader on graph_alpha REST shortest-path & denies foreign beta node with 404
    const accessControl = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({
        'alpha-reader': { id: 'reader-1', role: 'reader', tableIds: ['graph_alpha'] },
      }),
    })
    const resourceResolver = {
      resolveNodeTableId: async (nodeId: string) => (await harness.nodeRepo.findById(nodeId))?.getTableId(),
      resolveTableIdentity: async (ref: string) => {
        const table = (await harness.tableRepo.findById(ref)) ?? (await harness.tableRepo.findByIdentifier(ref))
        return table ? { id: String(table.id), identifier: table.identifier } : undefined
      },
    }

    const allowedRest = await authorizeExternalRequest(
      accessControl,
      new Request('http://localhost/api/nodes/shortest-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer alpha-reader' },
        body: JSON.stringify({ fromNodeId: harness.nodes.L0, toNodeId: harness.nodes.L2 }),
      }),
      undefined,
      resourceResolver,
    )
    expect(allowedRest.allowed).toBe(true)

    const deniedCrossTable = await authorizeExternalRequest(
      accessControl,
      new Request('http://localhost/api/nodes/shortest-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer alpha-reader' },
        body: JSON.stringify({ fromNodeId: harness.nodes.L0, toNodeId: harness.otherNodeId }),
      }),
      undefined,
      resourceResolver,
    )
    expect(deniedCrossTable).toEqual({ allowed: false, status: 404, code: 'not_found' })

    // Strength > 4 now fails cleanly with VALIDATION_ERROR instead of DB CHECK error
    const invalidStrength = await execGql<{
      createRelation: { success: boolean; errors: Array<{ code: string; message: string }> }
    }>(
      harness.schema,
      `mutation($t: ID!, $s: ID!, $tgt: ID!, $rt: ID!) {
        createRelation(input: { tableId: $t, sourceNodeId: $s, targetNodeId: $tgt, relationTypeId: $rt, strength: 10 }) {
          success
          errors { code message }
        }
      }`,
      { t: harness.tableId, s: harness.nodes.L0, tgt: harness.nodes.L4, rt: harness.refTypeId },
    )
    expect(invalidStrength.data?.createRelation.success).toBe(false)
    expect(invalidStrength.data?.createRelation.errors[0]?.code).toBe('VALIDATION_ERROR')
    expect(invalidStrength.data?.createRelation.errors[0]?.message).toContain('0 and 4')
  })

  test('P2: executes findOptimalPath (Dijkstra/Yen), all enhanced relation analytics queries, SCC, and PageRank', async () => {
    // findOptimalPath picks strong 3-hop path under WEIGHTED_SHORTEST and 2-hop under SHORTEST
    const weighted = await execGql<{
      findOptimalPath: {
        totalDistance: number
        averageStrength: number
        averageConfidence: number
        pathQuality: string
        path: Array<{ node: { content: string } }>
        alternativePaths: Array<{ totalDistance: number; path: Array<{ node: { content: string } }> }>
      }
    }>(
      harness.schema,
      `query($s: ID!, $t: ID!) {
        findOptimalPath(input: { sourceNodeId: $s, targetNodeId: $t, algorithm: WEIGHTED_SHORTEST }) {
          totalDistance
          averageStrength
          averageConfidence
          pathQuality
          path { node { content } }
          alternativePaths { totalDistance path { node { content } } }
        }
      }`,
      { s: harness.nodes.D0, t: harness.nodes.D3 },
    )
    expect(weighted.errors).toBeUndefined()
    expect(weighted.data?.findOptimalPath.path.map((p) => p.node.content)).toEqual(['D0', 'D2', 'D4', 'D3'])
    expect(weighted.data?.findOptimalPath.pathQuality).toBe('EXCELLENT')
    expect(weighted.data?.findOptimalPath.alternativePaths[0]?.path.map((p) => p.node.content)).toEqual([
      'D0',
      'D1',
      'D3',
    ])

    const allAnalytics = await execGql<{
      relationAnalytics: {
        totalRelations: number
        internalRelations: number
        externalRelations: number
        strengthDistribution: { veryStrong: number }
        networkMetrics: { mostConnectedNodes: Array<{ node: { content: string }; connectionCount: number }> }
      }
      getNodeConnectivity: {
        centralNode: { content: string }
        influenceScore: number
        relationshipSummary: { totalConnections: number; incomingRelations: number; outgoingRelations: number }
        connectedNodes: Array<{ node: { content: string }; distance: number }>
      }
      analyzeRelationshipStrength: {
        overallStats: { averageStrength: number }
        strengthByType: Array<{ relationType: { identifier: string } }>
        strongRelations: Array<{ strengthScore: number }>
      }
      resolveExternalReferences: {
        resolutionStats: { totalReferences: number; unresolved: number }
        unresolvedReferences: Array<{ externalId: string }>
      }
      discoverRelationPatterns: Array<{ patternId: string; description: string }>
      getHighConfidenceRelations: Array<{ confidenceScore: number; validationStatus: string }>
      stronglyConnectedComponents: {
        totalComponents: number
        largestComponentSize: number
        components: Array<{ size: number; nodes: Array<{ content: string }> }>
      }
      pageRank: {
        converged: boolean
        entries: Array<{ rank: number; score: number; node: { content: string } }>
      }
    }>(
      harness.schema,
      `query($t: ID!, $node: ID!) {
        relationAnalytics(filter: { tableIds: [$t] }) {
          totalRelations
          internalRelations
          externalRelations
          strengthDistribution { veryStrong }
          networkMetrics { mostConnectedNodes { node { content } connectionCount } }
        }
        getNodeConnectivity(nodeId: $node, maxDepth: 2, minStrength: 1, minConfidence: 1) {
          centralNode { content }
          influenceScore
          relationshipSummary { totalConnections incomingRelations outgoingRelations }
          connectedNodes { node { content } distance }
        }
        analyzeRelationshipStrength(filter: { tableIds: [$t], minOccurrences: 2 }) {
          overallStats { averageStrength }
          strengthByType { relationType { identifier } }
          strongRelations { strengthScore }
        }
        resolveExternalReferences(input: { repositories: ["github"] }) {
          resolutionStats { totalReferences unresolved }
          unresolvedReferences { externalId }
        }
        discoverRelationPatterns(input: { tableIds: [$t], patternTypes: [CYCLE, CHAIN], minOccurrences: 2, confidenceThreshold: 0.5 }) {
          patternId
          description
        }
        getHighConfidenceRelations(minConfidence: 4, tableIds: [$t]) {
          confidenceScore
          validationStatus
        }
        stronglyConnectedComponents(tableId: $t) {
          totalComponents
          largestComponentSize
          components { size nodes { content } }
        }
        pageRank(tableId: $t, limit: 10) {
          converged
          entries { rank score node { content } }
        }
      }`,
      { t: harness.tableId, node: harness.nodes.S_center },
    )
    expect(allAnalytics.errors).toBeUndefined()
    expect(allAnalytics.data?.relationAnalytics.totalRelations).toBe(17)
    expect(allAnalytics.data?.relationAnalytics.internalRelations).toBe(16)
    expect(allAnalytics.data?.relationAnalytics.externalRelations).toBe(1)
    expect(allAnalytics.data?.getNodeConnectivity.centralNode.content).toBe('S_center')
    expect(allAnalytics.data?.getNodeConnectivity.relationshipSummary.totalConnections).toBe(2)
    expect(allAnalytics.data?.getNodeConnectivity.influenceScore).toBeGreaterThan(0)
    expect(allAnalytics.data?.analyzeRelationshipStrength.overallStats.averageStrength).toBeGreaterThan(0)
    expect(allAnalytics.data?.resolveExternalReferences.resolutionStats.totalReferences).toBe(1)
    expect(allAnalytics.data?.resolveExternalReferences.unresolvedReferences[0]?.externalId).toBe('github:issue-99')
    expect(allAnalytics.data?.discoverRelationPatterns.some((p) => p.patternId.startsWith('cycle:'))).toBe(true)
    expect(allAnalytics.data?.getHighConfidenceRelations.every((r) => r.validationStatus === 'VERIFIED')).toBe(true)
    expect(allAnalytics.data?.stronglyConnectedComponents.largestComponentSize).toBe(3)
    expect(allAnalytics.data?.pageRank.converged).toBe(true)
    expect(allAnalytics.data?.pageRank.entries.length).toBeGreaterThan(0)
  })
})

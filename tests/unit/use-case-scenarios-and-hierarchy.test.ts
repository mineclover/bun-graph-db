import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { graphql, type GraphQLSchema } from 'graphql'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { AccessControl, authorizeExternalRequest } from '@/application/security/AccessControl.js'
import { createTestContainer } from '@/infrastructure/container/ContainerBootstrap.js'
import type { DIContainer } from '@/infrastructure/container/DIContainer.js'
import { DatabaseTokens, GraphQLTokens } from '@/infrastructure/container/tokens/index.js'
import {
  applyDatabaseMigrations,
  createDatabaseMigrations,
} from '@/infrastructure/database/sqlite/DatabaseMigrationRunner.js'
import type { Database } from '@/infrastructure/database/sqlite/SqliteAdapter.js'
import { GraphQLSchemaBuilder } from '@/presentation/graphql/GraphQLSchemaBuilder.js'
import type { TemplateMutations } from '@/presentation/graphql/mutations/TemplateMutations.js'

const SCHEMA_SQL = readFileSync(resolve(import.meta.dirname, '../../scripts/database/schema.sql'), 'utf8')

interface GqlResponse<T = Record<string, unknown>> {
  data?: T
  errors?: readonly { message: string }[]
}

async function execGql<T = Record<string, unknown>>(
  schema: GraphQLSchema,
  source: string,
  variableValues: Record<string, unknown> = {},
): Promise<GqlResponse<T>> {
  const result = await graphql({
    schema,
    source,
    variableValues,
    contextValue: {
      requestId: 'scenario-test',
      startTime: new Date(),
      requestCache: new Map(),
    },
  })
  return result as GqlResponse<T>
}

function l2Normalize(vector: number[]): number[] {
  const norm = Math.hypot(...vector) || 1
  return vector.map((v) => v / norm)
}

async function setupContainerAndSchema() {
  const container = await createTestContainer()
  const db = (await container.resolve(DatabaseTokens.DATABASE_CONNECTION)) as Database
  applyDatabaseMigrations(db, createDatabaseMigrations(SCHEMA_SQL))
  const schema = await new GraphQLSchemaBuilder(container).build()
  const templateMutations = (await container.resolve(GraphQLTokens.TEMPLATE_MUTATIONS)) as TemplateMutations
  templateMutations.setSchema(schema)
  return { container, db, schema }
}

describe('Real-World Scenarios & First-Class Hierarchy Suite (P3)', () => {
  let container: DIContainer
  let schema: GraphQLSchema
  const tempDirs: string[] = []

  beforeEach(async () => {
    const setup = await setupContainerAndSchema()
    container = setup.container
    schema = setup.schema
  })

  afterEach(async () => {
    await container.dispose()
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('Scenario 1: Hierarchy Tree & DAG lifecycle (roots, leaves, ancestors, descendants, subtree, LCA, safe move, cycle/multi-parent validation)', async () => {
    const tableRes = await execGql<{ createTable: { table: { id: string } } }>(
      schema,
      `mutation { createTable(input: { identifier: "org_tree", name: "Org Tree" }) { table { id } } }`,
    )
    const tableId = tableRes.data?.createTable.table.id ?? ''
    expect(tableId).toBeTruthy()

    const names = ['Company', 'Engineering', 'Product', 'Backend', 'Frontend', 'AuthService', 'Orphan']
    const ids: Record<string, string> = {}
    for (const content of names) {
      const created = await execGql<{ createNode: { node: { id: string } } }>(
        schema,
        `mutation($input: CreateNodeInput!) { createNode(input: $input) { node { id } } }`,
        { input: { tableId, content } },
      )
      expect(created.errors).toBeUndefined()
      ids[content] = created.data?.createNode.node.id ?? ''
    }

    const edges: Array<[string, string]> = [
      ['Company', 'Engineering'],
      ['Company', 'Product'],
      ['Engineering', 'Backend'],
      ['Engineering', 'Frontend'],
      ['Backend', 'AuthService'],
    ]
    for (const [parent, child] of edges) {
      const rel = await execGql<{ createRelation: { success: boolean } }>(
        schema,
        `mutation($input: CreateRelationInput!) { createRelation(input: $input) { success } }`,
        {
          input: {
            tableId,
            sourceNodeId: ids[parent],
            targetNodeId: ids[child],
            relationshipType: 'parentOf',
          },
        },
      )
      expect(rel.data?.createRelation.success).toBe(true)
    }

    // Roots & leaves with/without isolated nodes
    const rootsLeavesRes = await execGql<{
      rootsOnly: Array<{ id: string; content: string }>
      rootsWithIsolated: Array<{ id: string; content: string }>
      leavesOnly: Array<{ id: string; content: string }>
      leavesWithIsolated: Array<{ id: string; content: string }>
    }>(
      schema,
      `query($tableId: ID!) {
        rootsOnly: getHierarchyRoots(tableId: $tableId) { id content }
        rootsWithIsolated: getHierarchyRoots(tableId: $tableId, includeIsolated: true) { id content }
        leavesOnly: getHierarchyLeaves(tableId: $tableId) { id content }
        leavesWithIsolated: getHierarchyLeaves(tableId: $tableId, includeIsolated: true) { id content }
      }`,
      { tableId },
    )
    expect(rootsLeavesRes.errors).toBeUndefined()
    expect(rootsLeavesRes.data?.rootsOnly.map((n) => n.content)).toEqual(['Company'])
    expect(rootsLeavesRes.data?.rootsWithIsolated.map((n) => n.content).sort()).toEqual([
      'Company',
      'Orphan',
    ])
    expect(rootsLeavesRes.data?.leavesOnly.map((n) => n.content).sort()).toEqual([
      'AuthService',
      'Frontend',
      'Product',
    ])
    expect(rootsLeavesRes.data?.leavesWithIsolated.map((n) => n.content).sort()).toEqual([
      'AuthService',
      'Frontend',
      'Orphan',
      'Product',
    ])

    // Ancestors breadcrumb + root check
    const ancRes = await execGql<{
      authAnc: {
        isRoot: boolean
        depth: number
        hasCycle: boolean
        pathIds: string[]
        rootNode: { content: string } | null
        ancestors: Array<{ depth: number; node: { content: string } }>
      }
      rootAnc: { isRoot: boolean; depth: number; ancestors: Array<{ node: { id: string } }> }
    }>(
      schema,
      `query($authId: ID!, $rootId: ID!) {
        authAnc: getAncestors(nodeId: $authId) {
          isRoot
          depth
          hasCycle
          pathIds
          rootNode { content }
          ancestors { depth node { content } }
        }
        rootAnc: getAncestors(nodeId: $rootId) {
          isRoot
          depth
          ancestors { node { id } }
        }
      }`,
      { authId: ids.AuthService, rootId: ids.Company },
    )
    expect(ancRes.errors).toBeUndefined()
    expect(ancRes.data?.authAnc.isRoot).toBe(false)
    expect(ancRes.data?.authAnc.depth).toBe(3)
    expect(ancRes.data?.authAnc.hasCycle).toBe(false)
    expect(ancRes.data?.authAnc.rootNode?.content).toBe('Company')
    expect(ancRes.data?.authAnc.ancestors.map((a) => `${a.node.content}:${a.depth}`)).toEqual([
      'Company:3',
      'Engineering:2',
      'Backend:1',
    ])
    expect(ancRes.data?.authAnc.pathIds).toEqual([
      ids.Company,
      ids.Engineering,
      ids.Backend,
      ids.AuthService,
    ])
    expect(ancRes.data?.rootAnc.isRoot).toBe(true)
    expect(ancRes.data?.rootAnc.depth).toBe(0)
    expect(ancRes.data?.rootAnc.ancestors).toEqual([])

    // Descendants & Subtree
    const downRes = await execGql<{
      getDescendants: {
        totalCount: number
        maxDepthReached: number
        leafCount: number
        entries: Array<{ depth: number; isLeaf: boolean; node: { content: string } }>
      }
      getSubtree: {
        totalNodes: number
        leafCount: number
        edges: Array<{ fromNodeId: string; toNodeId: string }>
        entries: Array<{ depth: number; parentId: string | null; node: { content: string } }>
      }
    }>(
      schema,
      `query($engId: ID!) {
        getDescendants(nodeId: $engId) {
          totalCount
          maxDepthReached
          leafCount
          entries { depth isLeaf node { content } }
        }
        getSubtree(rootNodeId: $engId) {
          totalNodes
          leafCount
          edges { fromNodeId toNodeId }
          entries { depth parentId node { content } }
        }
      }`,
      { engId: ids.Engineering },
    )
    expect(downRes.errors).toBeUndefined()
    expect(downRes.data?.getDescendants.totalCount).toBe(3)
    expect(downRes.data?.getDescendants.maxDepthReached).toBe(2)
    expect(downRes.data?.getDescendants.leafCount).toBe(2)
    expect(downRes.data?.getDescendants.entries.map((e) => e.node.content).sort()).toEqual([
      'AuthService',
      'Backend',
      'Frontend',
    ])
    expect(downRes.data?.getSubtree.totalNodes).toBe(4)
    expect(downRes.data?.getSubtree.edges).toHaveLength(3)

    // Lowest Common Ancestor (sibling branch, cross branch, disconnected)
    const lcaRes = await execGql<{
      lcaEng: {
        found: boolean
        distanceFromA: number | null
        distanceFromB: number | null
        pathFromA: string[]
        pathFromB: string[]
        ancestor: { content: string } | null
      }
      lcaCompany: { found: boolean; ancestor: { content: string } | null }
      lcaDisconnected: { found: boolean; ancestor: { id: string } | null }
    }>(
      schema,
      `query($authId: ID!, $feId: ID!, $prodId: ID!, $orphanId: ID!) {
        lcaEng: getLowestCommonAncestor(nodeIdA: $authId, nodeIdB: $feId) {
          found
          distanceFromA
          distanceFromB
          pathFromA
          pathFromB
          ancestor { content }
        }
        lcaCompany: getLowestCommonAncestor(nodeIdA: $authId, nodeIdB: $prodId) {
          found
          ancestor { content }
        }
        lcaDisconnected: getLowestCommonAncestor(nodeIdA: $authId, nodeIdB: $orphanId) {
          found
          ancestor { id }
        }
      }`,
      {
        authId: ids.AuthService,
        feId: ids.Frontend,
        prodId: ids.Product,
        orphanId: ids.Orphan,
      },
    )
    expect(lcaRes.errors).toBeUndefined()
    expect(lcaRes.data?.lcaEng.found).toBe(true)
    expect(lcaRes.data?.lcaEng.ancestor?.content).toBe('Engineering')
    expect(lcaRes.data?.lcaEng.distanceFromA).toBe(2)
    expect(lcaRes.data?.lcaEng.distanceFromB).toBe(1)
    expect(lcaRes.data?.lcaEng.pathFromA).toEqual([ids.AuthService, ids.Backend, ids.Engineering])
    expect(lcaRes.data?.lcaEng.pathFromB).toEqual([ids.Frontend, ids.Engineering])
    expect(lcaRes.data?.lcaCompany.ancestor?.content).toBe('Company')
    expect(lcaRes.data?.lcaDisconnected.found).toBe(false)
    expect(lcaRes.data?.lcaDisconnected.ancestor).toBeNull()

    // validateHierarchy initially TREE valid
    const valTreeBefore = await execGql<{
      validateHierarchy: {
        valid: boolean
        totalNodes: number
        totalEdges: number
        rootCount: number
        leafCount: number
        isolatedCount: number
        maxDepth: number
        cycleNodeIds: string[]
        multiParentNodeIds: string[]
      }
    }>(
      schema,
      `query($tableId: ID!) {
        validateHierarchy(tableId: $tableId, mode: TREE) {
          valid totalNodes totalEdges rootCount leafCount isolatedCount maxDepth cycleNodeIds multiParentNodeIds
        }
      }`,
      { tableId },
    )
    expect(valTreeBefore.data?.validateHierarchy).toEqual({
      valid: true,
      totalNodes: 7,
      totalEdges: 5,
      rootCount: 1,
      leafCount: 3,
      isolatedCount: 1,
      maxDepth: 3,
      cycleNodeIds: [],
      multiParentNodeIds: [],
    })

    // moveHierarchyNode: self-move & descendant cycle guards + valid move to Product + promote to root
    const selfMove = await execGql<{ moveHierarchyNode: { success: boolean; errors: Array<{ code: string }> } }>(
      schema,
      `mutation($nodeId: ID!) {
        moveHierarchyNode(input: { nodeId: $nodeId, newParentId: $nodeId }) { success errors { code } }
      }`,
      { nodeId: ids.AuthService },
    )
    expect(selfMove.data?.moveHierarchyNode.success).toBe(false)
    expect(selfMove.data?.moveHierarchyNode.errors[0]?.code).toBe('VALIDATION_ERROR')

    const cycleMove = await execGql<{ moveHierarchyNode: { success: boolean; errors: Array<{ code: string }> } }>(
      schema,
      `mutation($nodeId: ID!, $newParentId: ID!) {
        moveHierarchyNode(input: { nodeId: $nodeId, newParentId: $newParentId }) { success errors { code } }
      }`,
      { nodeId: ids.Company, newParentId: ids.AuthService },
    )
    expect(cycleMove.data?.moveHierarchyNode.success).toBe(false)
    expect(cycleMove.data?.moveHierarchyNode.errors[0]?.code).toBe('VALIDATION_ERROR')

    const validMove = await execGql<{
      moveHierarchyNode: {
        success: boolean
        previousParentIds: string[]
        newParentId: string | null
        ancestors: Array<{ node: { content: string } }>
      }
    }>(
      schema,
      `mutation($nodeId: ID!, $newParentId: ID!) {
        moveHierarchyNode(input: { nodeId: $nodeId, newParentId: $newParentId }) {
          success
          previousParentIds
          newParentId
          ancestors { node { content } }
        }
      }`,
      { nodeId: ids.AuthService, newParentId: ids.Product },
    )
    expect(validMove.data?.moveHierarchyNode.success).toBe(true)
    expect(validMove.data?.moveHierarchyNode.previousParentIds).toEqual([ids.Backend])
    expect(validMove.data?.moveHierarchyNode.newParentId).toBe(ids.Product)
    expect(validMove.data?.moveHierarchyNode.ancestors.map((a) => a.node.content)).toEqual(['Company', 'Product'])

    // Detach AuthService to top-level root
    const detachMove = await execGql<{
      moveHierarchyNode: { success: boolean; previousParentIds: string[]; newParentId: string | null }
    }>(
      schema,
      `mutation($nodeId: ID!) {
        moveHierarchyNode(input: { nodeId: $nodeId, newParentId: null }) {
          success previousParentIds newParentId
        }
      }`,
      { nodeId: ids.AuthService },
    )
    expect(detachMove.data?.moveHierarchyNode.success).toBe(true)
    expect(detachMove.data?.moveHierarchyNode.previousParentIds).toEqual([ids.Product])
    expect(detachMove.data?.moveHierarchyNode.newParentId).toBeNull()

    // Re-attach AuthService under BOTH Backend and Frontend -> DAG valid, TREE invalid
    for (const parent of ['Backend', 'Frontend']) {
      await execGql(
        schema,
        `mutation($input: CreateRelationInput!) { createRelation(input: $input) { success } }`,
        {
          input: {
            tableId,
            sourceNodeId: ids[parent],
            targetNodeId: ids.AuthService,
            relationshipType: 'parentOf',
          },
        },
      )
    }

    const dagVsTree = await execGql<{
      asTree: { valid: boolean; multiParentNodeIds: string[]; cycleNodeIds: string[] }
      asDag: { valid: boolean; multiParentNodeIds: string[]; cycleNodeIds: string[] }
    }>(
      schema,
      `query($tableId: ID!) {
        asTree: validateHierarchy(tableId: $tableId, mode: TREE) { valid multiParentNodeIds cycleNodeIds }
        asDag: validateHierarchy(tableId: $tableId, mode: DAG) { valid multiParentNodeIds cycleNodeIds }
      }`,
      { tableId },
    )
    expect(dagVsTree.data?.asTree.valid).toBe(false)
    expect(dagVsTree.data?.asTree.multiParentNodeIds).toEqual([ids.AuthService])
    expect(dagVsTree.data?.asDag.valid).toBe(true)
    expect(dagVsTree.data?.asDag.cycleNodeIds).toEqual([])

    // Inject cycle AuthService -> Company -> both TREE and DAG report invalid with cycleNodeIds
    await execGql(
      schema,
      `mutation($input: CreateRelationInput!) { createRelation(input: $input) { success } }`,
      {
        input: {
          tableId,
          sourceNodeId: ids.AuthService,
          targetNodeId: ids.Company,
          relationshipType: 'parentOf',
        },
      },
    )
    const cyclicVal = await execGql<{
      validateHierarchy: { valid: boolean; cycleNodeIds: string[] }
    }>(
      schema,
      `query($tableId: ID!) { validateHierarchy(tableId: $tableId, mode: DAG) { valid cycleNodeIds } }`,
      { tableId },
    )
    expect(cyclicVal.data?.validateHierarchy.valid).toBe(false)
    expect(cyclicVal.data?.validateHierarchy.cycleNodeIds).toContain(ids.Company)
    expect(cyclicVal.data?.validateHierarchy.cycleNodeIds).toContain(ids.AuthService)
  })

  test('Scenario 2: Subtree-scoped Hybrid Search (parentOf anchor + FTS5 lexical + Float32 vector)', async () => {
    const tableRes = await execGql<{ createTable: { table: { id: string } } }>(
      schema,
      `mutation { createTable(input: { identifier: "kb_tree", name: "KB Tree" }) { table { id } } }`,
    )
    const tableId = tableRes.data?.createTable.table.id ?? ''

    const specs = [
      { key: 'Root', content: 'Knowledge Root' },
      { key: 'Eng', content: 'Engineering Division' },
      { key: 'Sales', content: 'Sales Division' },
      { key: 'EngDoc', content: 'OAuth Token Refresh Spec', vector: l2Normalize([1, 0, 0]) },
      { key: 'SalesDoc', content: 'Enterprise Token Pricing Sheet', vector: l2Normalize([1, 0, 0]) },
    ]
    const ids: Record<string, string> = {}
    for (const item of specs) {
      const res = await execGql<{ createNode: { node: { id: string } } }>(
        schema,
        `mutation($input: CreateNodeInput!) { createNode(input: $input) { node { id } } }`,
        { input: { tableId, content: item.content } },
      )
      ids[item.key] = res.data?.createNode.node.id ?? ''
      if (item.vector) {
        await execGql(
          schema,
          `mutation($input: SetNodeEmbeddingInput!) { setNodeEmbedding(input: $input) { success } }`,
          { input: { nodeId: ids[item.key], tableId, vector: item.vector, model: 'test-v1' } },
        )
      }
    }

    for (const [parent, child] of [
      ['Root', 'Eng'],
      ['Root', 'Sales'],
      ['Eng', 'EngDoc'],
      ['Sales', 'SalesDoc'],
    ]) {
      await execGql(
        schema,
        `mutation($input: CreateRelationInput!) { createRelation(input: $input) { success } }`,
        {
          input: {
            tableId,
            sourceNodeId: ids[parent],
            targetNodeId: ids[child],
            relationshipType: 'parentOf',
          },
        },
      )
    }

    const hybrid = await execGql<{
      hybridSearchNodes: {
        results: Array<{ hopDistance: number | null; node: { content: string } }>
        metrics: { graphCandidates: number }
      }
    }>(
      schema,
      `query($tableId: ID!, $engId: ID!, $queryVector: [Float!]) {
        hybridSearchNodes(input: {
          tableId: $tableId
          textQuery: "Token"
          vector: $queryVector
          graph: { anchorNodeIds: [$engId], direction: "OUTGOING", maxDepth: 4, relationTypes: ["parentOf"] }
          limit: 10
        }) {
          results { hopDistance node { content } }
          metrics { graphCandidates }
        }
      }`,
      { tableId, engId: ids.Eng, queryVector: l2Normalize([1, 0, 0]) },
    )
    expect(hybrid.errors).toBeUndefined()
    // SalesDoc is excluded even though it matches both lexical "Token" and identical vector [1,0,0]!
    expect(hybrid.data?.hybridSearchNodes.results.map((r) => r.node.content)).toEqual([
      'OAuth Token Refresh Spec',
    ])
    expect(hybrid.data?.hybridSearchNodes.results[0]?.hopDistance).toBe(1)
  })

  test('Scenario 3: Spec-Lineage weighted path recomputation via updateRelation + relationTypeByIdentifier + SCC/PageRank', async () => {
    const rtLookup = await execGql<{ relationTypeByIdentifier: { id: string; identifier: string } | null }>(
      schema,
      `query { relationTypeByIdentifier(identifier: "dependsOn") { id identifier } }`,
    )
    expect(rtLookup.errors).toBeUndefined()
    expect(rtLookup.data?.relationTypeByIdentifier?.identifier).toBe('dependsOn')
    const dependsOnId = rtLookup.data?.relationTypeByIdentifier?.id ?? ''

    const tableRes = await execGql<{ createTable: { table: { id: string } } }>(
      schema,
      `mutation { createTable(input: { identifier: "spec_lineage", name: "Spec Lineage" }) { table { id } } }`,
    )
    const tableId = tableRes.data?.createTable.table.id ?? ''

    const ids: Record<string, string> = {}
    for (const key of ['A', 'B', 'C', 'D', 'E']) {
      const created = await execGql<{ createNode: { node: { id: string } } }>(
        schema,
        `mutation($input: CreateNodeInput!) { createNode(input: $input) { node { id } } }`,
        { input: { tableId, content: key } },
      )
      ids[key] = created.data?.createNode.node.id ?? ''
    }

    const createRel = async (src: string, dst: string, strength: number, confidence: number) => {
      const res = await execGql<{ createRelation: { success: boolean; relation: { id: string } } }>(
        schema,
        `mutation($input: CreateRelationInput!) { createRelation(input: $input) { success relation { id } } }`,
        {
          input: {
            tableId,
            sourceNodeId: ids[src],
            targetNodeId: ids[dst],
            relationTypeId: dependsOnId,
            strength,
            confidence,
          },
        },
      )
      expect(res.data?.createRelation.success).toBe(true)
      return res.data?.createRelation.relation.id ?? ''
    }

    // Initially A -> B -> D (strong) beats A -> C -> E -> D (weak)
    const rAB = await createRel('A', 'B', 4, 4)
    const rBD = await createRel('B', 'D', 4, 4)
    const rAC = await createRel('A', 'C', 1, 1)
    const rCE = await createRel('C', 'E', 1, 1)
    const rED = await createRel('E', 'D', 1, 1)
    expect(new Set([rAB, rBD, rAC, rCE, rED]).size).toBe(5)

    const optQuery = `query($src: ID!, $dst: ID!) {
      findOptimalPath(input: {
        sourceNodeId: $src
        targetNodeId: $dst
        algorithm: WEIGHTED_SHORTEST
        weightingStrategy: STRENGTH_CONFIDENCE
      }) {
        path { node { content } }
        totalDistance
      }
    }`

    const beforeOpt = await execGql<{ findOptimalPath: { path: Array<{ node: { content: string } }> } }>(
      schema,
      optQuery,
      { src: ids.A, dst: ids.D },
    )
    expect(beforeOpt.data?.findOptimalPath.path.map((p) => p.node.content)).toEqual(['A', 'B', 'D'])

    // Validation check: updateRelation rejects strength > 4 or negative confidence
    const badUpdate = await execGql<{ updateRelation: { success: boolean; errors: Array<{ code: string }> } }>(
      schema,
      `mutation($id: ID!) { updateRelation(id: $id, input: { strength: 5, confidence: 2 }) { success errors { code } } }`,
      { id: rAB },
    )
    expect(badUpdate.data?.updateRelation.success).toBe(false)
    expect(badUpdate.data?.updateRelation.errors[0]?.code).toBe('VALIDATION_ERROR')

    // Demote B branch to strength=1, confidence=0 and promote C->E->D to 4/4
    for (const relId of [rAB, rBD]) {
      const upd = await execGql<{ updateRelation: { success: boolean; relation: { strength: number; confidence: number } } }>(
        schema,
        `mutation($id: ID!) {
          updateRelation(id: $id, input: { strength: 1, confidence: 0, properties: { degraded: true } }) {
            success relation { strength confidence }
          }
        }`,
        { id: relId },
      )
      expect(upd.data?.updateRelation.success).toBe(true)
      expect(upd.data?.updateRelation.relation.confidence).toBe(0)
    }
    for (const relId of [rAC, rCE, rED]) {
      const upd = await execGql<{ updateRelation: { success: boolean } }>(
        schema,
        `mutation($id: ID!) {
          updateRelation(id: $id, input: { strength: 4, confidence: 4 }) { success }
        }`,
        { id: relId },
      )
      expect(upd.data?.updateRelation.success).toBe(true)
    }

    const afterOpt = await execGql<{ findOptimalPath: { path: Array<{ node: { content: string } }> } }>(
      schema,
      optQuery,
      { src: ids.A, dst: ids.D },
    )
    expect(afterOpt.data?.findOptimalPath.path.map((p) => p.node.content)).toEqual(['A', 'C', 'E', 'D'])

    // PageRank + SCC check on the graph (sink D receives incoming rank)
    const graphMetrics = await execGql<{
      stronglyConnectedComponents: { totalComponents: number; largestComponentSize: number }
      pageRank: { converged: boolean; entries: Array<{ rank: number; node: { content: string } }> }
    }>(
      schema,
      `query($tableId: ID!) {
        stronglyConnectedComponents(tableId: $tableId) { totalComponents largestComponentSize }
        pageRank(tableId: $tableId, limit: 5) { converged entries { rank node { content } } }
      }`,
      { tableId },
    )
    expect(graphMetrics.errors).toBeUndefined()
    expect(graphMetrics.data?.stronglyConnectedComponents.totalComponents).toBe(5)
    expect(graphMetrics.data?.stronglyConnectedComponents.largestComponentSize).toBe(1)
    expect(graphMetrics.data?.pageRank.converged).toBe(true)
    expect(graphMetrics.data?.pageRank.entries[0]?.node.content).toBe('D')
  })

  test('Scenario 4: Typed EAV Catalog + bulkSetNodeAttributes + atomic SchemaGate rollback', async () => {
    const typesRes = await execGql<{
      attributeTypes: { attributeTypes: Array<{ id: string; identifier: string }> }
    }>(schema, `query { attributeTypes(pagination: { limit: 50 }) { attributeTypes { id identifier } } }`)
    const typeIdByIdent = new Map(
      (typesRes.data?.attributeTypes.attributeTypes ?? []).map((t) => [t.identifier, t.id]),
    )

    const tableRes = await execGql<{ createTable: { table: { id: string } } }>(
      schema,
      `mutation { createTable(input: { identifier: "catalog_eav", name: "Catalog EAV" }) { table { id } } }`,
    )
    const tableId = tableRes.data?.createTable.table.id ?? ''

    const attrIds: Record<string, string> = {}
    for (const def of [
      { identifier: 'sku', name: 'SKU', type: 'string' },
      { identifier: 'price', name: 'Price', type: 'number' },
      { identifier: 'in_stock', name: 'In Stock', type: 'boolean' },
    ]) {
      const res = await execGql<{ createAttribute: { attribute: { id: string } } }>(
        schema,
        `mutation($input: CreateAttributeInput!) { createAttribute(input: $input) { attribute { id } } }`,
        {
          input: {
            tableId,
            identifier: def.identifier,
            name: def.name,
            attributeTypeId: typeIdByIdent.get(def.type),
          },
        },
      )
      attrIds[def.identifier] = res.data?.createAttribute.attribute.id ?? ''
    }

    const nodeRes = await execGql<{ createNode: { node: { id: string } } }>(
      schema,
      `mutation($input: CreateNodeInput!) { createNode(input: $input) { node { id } } }`,
      { input: { tableId, content: 'Mechanical Keyboard' } },
    )
    const nodeId = nodeRes.data?.createNode.node.id ?? ''

    const bulkOk = await execGql<{
      bulkSetNodeAttributes: { success: boolean; errors: Array<{ message: string }> }
    }>(
      schema,
      `mutation($nodeId: ID!, $attributes: [NodeAttributeInput!]!) {
        bulkSetNodeAttributes(nodeId: $nodeId, attributes: $attributes) {
          success errors { message }
        }
      }`,
      {
        nodeId,
        attributes: [
          { attributeId: attrIds.sku, value: 'KB-001' },
          { attributeId: attrIds.price, value: '149.5' },
          { attributeId: attrIds.in_stock, value: 'true' },
        ],
      },
    )
    expect(bulkOk.errors).toBeUndefined()
    expect(bulkOk.data?.bulkSetNodeAttributes.success).toBe(true)

    // Invalid batch must reject BEFORE writing any attribute in the batch!
    const bulkInvalid = await execGql<{
      bulkSetNodeAttributes: { success: boolean; errors: Array<{ code: string }> }
    }>(
      schema,
      `mutation($nodeId: ID!, $attributes: [NodeAttributeInput!]!) {
        bulkSetNodeAttributes(nodeId: $nodeId, attributes: $attributes) {
          success errors { code }
        }
      }`,
      {
        nodeId,
        attributes: [
          { attributeId: attrIds.sku, value: 'KB-SHOULD-NOT-APPLY' },
          { attributeId: attrIds.price, value: 'not-a-number' },
        ],
      },
    )
    expect(bulkInvalid.data?.bulkSetNodeAttributes.success).toBe(false)
    expect(bulkInvalid.data?.bulkSetNodeAttributes.errors.length).toBeGreaterThan(0)

    const checkNode = await execGql<{
      node: { attributes: Array<{ value: string; attribute: { identifier: string } }> }
    }>(
      schema,
      `query($id: ID!) { node(id: $id) { attributes { value attribute { identifier } } } }`,
      { id: nodeId },
    )
    const attrMap = Object.fromEntries(
      checkNode.data?.node.attributes.map((a) => [a.attribute.identifier, a.value]) ?? [],
    )
    expect(attrMap.sku).toBe('KB-001')
    expect(attrMap.price).toBe('149.5')
    expect(attrMap.in_stock).toBe('true')
  })

  test('Scenario 5: QueryTemplate execution + JSONL backup/restore fidelity for hierarchies & relations', async () => {
    const tableRes = await execGql<{ createTable: { table: { id: string } } }>(
      schema,
      `mutation { createTable(input: { identifier: "portable_hier", name: "Portable Hier" }) { table { id } } }`,
    )
    const tableId = tableRes.data?.createTable.table.id ?? ''

    const rootNode = await execGql<{ createNode: { node: { id: string } } }>(
      schema,
      `mutation($tableId: ID!) { createNode(input: { tableId: $tableId, content: "Domain Root" }) { node { id } } }`,
      { tableId },
    )
    const childNode = await execGql<{ createNode: { node: { id: string } } }>(
      schema,
      `mutation($tableId: ID!) { createNode(input: { tableId: $tableId, content: "Submodule Auth" }) { node { id } } }`,
      { tableId },
    )
    const rootId = rootNode.data?.createNode.node.id ?? ''
    const childId = childNode.data?.createNode.node.id ?? ''

    await execGql(
      schema,
      `mutation($input: CreateRelationInput!) { createRelation(input: $input) { success } }`,
      {
        input: {
          tableId,
          sourceNodeId: rootId,
          targetNodeId: childId,
          relationshipType: 'parentOf',
          strength: 4,
          confidence: 4,
        },
      },
    )

    const tplCreate = await execGql<{ createTemplate: { success: boolean } }>(
      schema,
      `mutation($input: CreateQueryTemplateInput!) { createTemplate(input: $input) { success } }`,
      {
        input: {
          identifier: 'get_subtree_tpl',
          name: 'Get Subtree Template',
          query: `query GetSubtreeTpl($rootNodeId: ID!) {
            getSubtree(rootNodeId: $rootNodeId) {
              totalNodes
              entries { depth node { content } }
            }
          }`,
        },
      },
    )
    expect(tplCreate.data?.createTemplate.success).toBe(true)

    const tplExec = await execGql<{
      executeTemplateWithGraphQL: {
        success: boolean
        data: {
          data: {
            getSubtree: { totalNodes: number; entries: Array<{ depth: number; node: { content: string } }> }
          }
          metadata: { templateName: string }
        }
      }
    }>(
      schema,
      `mutation($rootNodeId: ID!) {
        executeTemplateWithGraphQL(templateIdentifier: "get_subtree_tpl", variables: { rootNodeId: $rootNodeId }) {
          success
          errors { message }
          data
        }
      }`,
      { rootNodeId: rootId },
    )
    expect(tplExec.errors).toBeUndefined()
    expect(tplExec.data?.executeTemplateWithGraphQL.success).toBe(true)
    expect(tplExec.data?.executeTemplateWithGraphQL.data.data.getSubtree.totalNodes).toBe(2)

    // Backup to temp JSONL dir via GraphQL & restore into fresh database container
    const backupDir = mkdtempSync(join(tmpdir(), 'bun-graph-db-jsonl-'))
    tempDirs.push(backupDir)

    const exported = await execGql<{
      exportJsonl: { success: boolean; stats: { relationsExported: number } }
    }>(
      schema,
      `mutation($dir: String!) {
        exportJsonl(input: { outputDir: $dir, includeRelations: true, includeSchema: true }) {
          success
          stats { relationsExported }
        }
      }`,
      { dir: backupDir },
    )
    expect(exported.errors).toBeUndefined()
    expect(exported.data?.exportJsonl.success).toBe(true)
    expect(exported.data?.exportJsonl.stats.relationsExported).toBeGreaterThanOrEqual(1)

    const fresh = await setupContainerAndSchema()
    try {
      const imported = await execGql<{
        importJsonl: { success: boolean }
      }>(
        fresh.schema,
        `mutation($dir: String!) {
          importJsonl(input: { inputDir: $dir, conflictResolution: OVERWRITE, validateSchema: true }) {
            success
          }
        }`,
        { dir: backupDir },
      )
      expect(imported.errors).toBeUndefined()
      expect(imported.data?.importJsonl.success).toBe(true)

      const freshTables = await execGql<{ tableByIdentifier: { id: string } | null }>(
        fresh.schema,
        `query { tableByIdentifier(identifier: "portable_hier") { id } }`,
      )
      const freshTableId = freshTables.data?.tableByIdentifier?.id ?? ''
      expect(freshTableId).toBeTruthy()

      const freshRoots = await execGql<{ getHierarchyRoots: Array<{ id: string; content: string }> }>(
        fresh.schema,
        `query($tableId: ID!) { getHierarchyRoots(tableId: $tableId) { id content } }`,
        { tableId: freshTableId },
      )
      expect(freshRoots.data?.getHierarchyRoots.map((n) => n.content)).toEqual(['Domain Root'])

      const restoredRootId = freshRoots.data?.getHierarchyRoots[0]?.id ?? ''
      const freshSubtree = await execGql<{
        getSubtree: { totalNodes: number; entries: Array<{ node: { content: string } }> }
      }>(
        fresh.schema,
        `query($rootId: ID!) { getSubtree(rootNodeId: $rootId) { totalNodes entries { node { content } } } }`,
        { rootId: restoredRootId },
      )
      expect(freshSubtree.data?.getSubtree.totalNodes).toBe(2)
      expect(freshSubtree.data?.getSubtree.entries.map((e) => e.node.content)).toEqual([
        'Domain Root',
        'Submodule Auth',
      ])
    } finally {
      await fresh.container.dispose()
    }
  })

  test('Scenario 6: AccessControl isolation across hierarchy queries and mutations', async () => {
    const control = AccessControl.fromEnvironment({
      NODE_ENV: 'production',
      BUN_GRAPH_DB_ACCESS_TOKENS: JSON.stringify({
        readerAlpha: { id: 'reader-a', role: 'reader', tableIds: ['1'] },
        writerAlpha: { id: 'writer-a', role: 'writer', tableIds: ['1'] },
      }),
    })
    const scopeResolver = {
      resolveNodeTableId: async (nodeId: string) =>
        nodeId === '10' || nodeId === '11' ? '1' : nodeId === '20' ? '2' : undefined,
      resolveTableIdentity: async (ref: string) =>
        ref === '1' ? { id: '1', identifier: 'alpha' } : ref === '2' ? { id: '2', identifier: 'beta' } : undefined,
    }

    const subtreeAllowed = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer readerAlpha' },
        body: JSON.stringify({
          query: 'query { getSubtree(rootNodeId: "10") { totalNodes } }',
        }),
      }),
      undefined,
      scopeResolver,
    )
    expect(subtreeAllowed.allowed).toBe(true)

    const readerMoveForbidden = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer readerAlpha' },
        body: JSON.stringify({
          query: 'mutation { moveHierarchyNode(input: { nodeId: "11", newParentId: "10" }) { success } }',
        }),
      }),
      undefined,
      scopeResolver,
    )
    expect(readerMoveForbidden).toEqual({ allowed: false, status: 403, code: 'forbidden' })

    const readerBulkAttrForbidden = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer readerAlpha' },
        body: JSON.stringify({
          query: 'mutation { bulkSetNodeAttributes(nodeId: "10", attributes: [{ attributeId: "1", value: "v" }]) { success } }',
        }),
      }),
      undefined,
      scopeResolver,
    )
    expect(readerBulkAttrForbidden).toEqual({ allowed: false, status: 403, code: 'forbidden' })

    const crossTableMoveDenied = await authorizeExternalRequest(
      control,
      new Request('http://localhost/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer writerAlpha' },
        body: JSON.stringify({
          query: 'mutation { moveHierarchyNode(input: { nodeId: "11", newParentId: "20" }) { success } }',
        }),
      }),
      undefined,
      scopeResolver,
    )
    expect(crossTableMoveDenied).toEqual({ allowed: false, status: 404, code: 'not_found' })
  })
})

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from 'vitest'
import type { PortableGraphNode } from '@/infrastructure/container/PortableBootstrap.js'

const GOLDEN_DIR = dirname(fileURLToPath(import.meta.url))

export interface GoldenAttributeDef {
  key: string
  identifier: string
  name: string
  typeIdentifier: string
  isRequired: boolean
}

export interface GoldenNodeDef {
  key: string
  title: string
  content: string
  attributes: Record<string, string>
  embedding?: number[]
  model?: string
}

export interface GoldenRelationDef {
  source: string
  target: string
  relationType: string
  strength: number
  confidence: number
}

export interface GoldenDocDef {
  category: 'usage' | 'guide' | 'example' | 'spec' | 'general'
  content: string
  version: number
  activate: boolean
}

export interface GoldenTableDef {
  key: string
  identifier: string
  description: string
  attributes: GoldenAttributeDef[]
  nodes: GoldenNodeDef[]
  relations: GoldenRelationDef[]
  docs: GoldenDocDef[]
}

export interface GoldenTemplateDef {
  identifier: string
  name: string
  description: string
  tags: string[]
  query: string
}

export interface GoldenDataset {
  schemaVersion: string
  description: string
  tables: GoldenTableDef[]
  templates: GoldenTemplateDef[]
}

export interface GoldenExpected {
  schemaVersion: string
  counts: Record<
    string,
    {
      nodes: number
      attributes: number
      relations: number
      docsTotal?: number
      activeDocs?: number
    }
  >
  search: {
    ftsDijkstra: string[]
    priorityGt85Desc: string[]
    categoryGraphCount: number
  }
  traversal: {
    orgConnectedDepth2FromEng: string[]
    orgShortestPathCeoToStorage: string[]
    docsDependencyChainFromBfsOut: string[]
    docsOptimalPathBfsToMcpSpec: string[]
  }
  analytics: {
    docsSccTotalComponents: number
    docsSccLargestSize: number
    docsSccNonTrivialCount: number
    docsSccCycleMembers: string[]
    islandConnections: number
  }
  hierarchy: {
    orgRoots: string[]
    orgLeaves: string[]
    storageAncestors: string[]
    platformSubtreeNodes: string[]
    lcaStorageAndAi: string
    lcaStorageAndDesign: string
    orgTreeValidation: {
      valid: boolean
      totalNodes: number
      totalEdges: number
      rootCount: number
      leafCount: number
      isolatedCount: number
      maxDepth: number
    }
    serviceDagMultiParentKey: string
  }
  hybrid: {
    graphVectorTopKey: string
    anchoredSubtreeTopKeys: string[]
  }
  docs: {
    activeUsageContent: string
    activeSpecContent: string
  }
}

export interface GoldenIdMap {
  tables: Record<string, string>
  attributes: Record<string, Record<string, string>>
  nodes: Record<string, Record<string, string>>
  keyByNodeId: Record<string, string>
}

export function loadGoldenDataset(): GoldenDataset {
  return JSON.parse(
    readFileSync(resolve(GOLDEN_DIR, 'golden-dataset.json'), 'utf8'),
  ) as GoldenDataset
}

export function loadGoldenExpected(): GoldenExpected {
  return JSON.parse(
    readFileSync(resolve(GOLDEN_DIR, 'golden-expected.json'), 'utf8'),
  ) as GoldenExpected
}

export async function runGoldenGraphQL<TData = Record<string, unknown>>(
  node: PortableGraphNode,
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
  const result = await node.executeGraphQL(query, variables)
  if (result.errors && result.errors.length > 0) {
    throw new Error(
      `Golden GraphQL execution failed: ${result.errors.map((e) => e.message).join('; ')}`,
    )
  }
  if (!result.data) {
    throw new Error('Golden GraphQL execution returned no data')
  }
  return result.data as TData
}

function requireKey(map: Record<string, string>, key: string, label: string): string {
  const value = map[key]
  if (!value) {
    throw new Error(`Missing golden ${label} entry for '${key}'`)
  }
  return value
}

export async function seedGoldenDataset(
  node: PortableGraphNode,
  dataset: GoldenDataset = loadGoldenDataset(),
): Promise<GoldenIdMap> {
  const typesData = await runGoldenGraphQL<{
    attributeTypes: { attributeTypes: Array<{ id: string; identifier: string }> }
  }>(
    node,
    `query { attributeTypes(pagination: { limit: 100 }) { attributeTypes { id identifier } } }`,
  )
  const attrTypeIds = new Map(
    typesData.attributeTypes.attributeTypes.map((item) => [item.identifier, item.id]),
  )

  const idMap: GoldenIdMap = {
    tables: {},
    attributes: {},
    nodes: {},
    keyByNodeId: {},
  }

  for (const tableDef of dataset.tables) {
    const tableRes = await runGoldenGraphQL<{
      createTable: { success: boolean; table: { id: string } | null }
    }>(
      node,
      `mutation($input: CreateTableInput!) {
        createTable(input: $input) {
          success
          table { id }
        }
      }`,
      {
        input: {
          identifier: tableDef.identifier,
          description: tableDef.description,
        },
      },
    )
    const tableId = tableRes.createTable.table?.id
    if (!tableRes.createTable.success || !tableId) {
      throw new Error(`Failed to create golden table ${tableDef.identifier}`)
    }
    idMap.tables[tableDef.key] = tableId
    idMap.attributes[tableDef.key] = {}
    idMap.nodes[tableDef.key] = {}

    for (const attrDef of tableDef.attributes) {
      const attributeTypeId = attrTypeIds.get(attrDef.typeIdentifier)
      if (!attributeTypeId) {
        throw new Error(`Missing attributeTypeId for ${attrDef.typeIdentifier}`)
      }
      const attrRes = await runGoldenGraphQL<{
        createAttribute: { success: boolean; attribute: { id: string } | null }
      }>(
        node,
        `mutation($input: CreateAttributeInput!) {
          createAttribute(input: $input) {
            success
            attribute { id }
          }
        }`,
        {
          input: {
            tableId,
            identifier: attrDef.identifier,
            name: attrDef.name,
            attributeTypeId,
            isRequired: attrDef.isRequired,
          },
        },
      )
      const attributeId = attrRes.createAttribute.attribute?.id
      if (!attrRes.createAttribute.success || !attributeId) {
        throw new Error(`Failed to create golden attribute ${attrDef.identifier}`)
      }
      const tableAttrs = idMap.attributes[tableDef.key]
      if (tableAttrs) {
        tableAttrs[attrDef.key] = attributeId
      }
    }

    const tableAttrs = idMap.attributes[tableDef.key] ?? {}
    for (const nodeDef of tableDef.nodes) {
      const attributePatches = Object.entries(nodeDef.attributes).map(
        ([attrKey, value]) => ({
          attributeId: requireKey(tableAttrs, attrKey, `${tableDef.key}.attr`),
          value,
        }),
      )
      const nodeRes = await runGoldenGraphQL<{
        createNode: {
          success: boolean
          node: { id: string } | null
          errors?: Array<{ message: string; code?: string }>
        }
      }>(
        node,
        `mutation($input: CreateNodeInput!) {
          createNode(input: $input) {
            success
            node { id }
            errors { message code }
          }
        }`,
        {
          input: {
            tableId,
            title: nodeDef.title,
            content: nodeDef.content,
            attributes: attributePatches,
          },
        },
      )
      const nodeId = nodeRes.createNode.node?.id
      if (!nodeRes.createNode.success || !nodeId) {
        throw new Error(
          `Failed to create golden node ${nodeDef.key}: ${JSON.stringify(nodeRes.createNode.errors ?? [])}`,
        )
      }
      const tableNodes = idMap.nodes[tableDef.key]
      if (tableNodes) {
        tableNodes[nodeDef.key] = nodeId
      }
      idMap.keyByNodeId[nodeId] = nodeDef.key

      if (nodeDef.embedding) {
        const embedRes = await runGoldenGraphQL<{
          setNodeEmbedding: {
            success: boolean
            embedding: { nodeId: string } | null
            errors: Array<{ message: string; code?: string }>
          }
        }>(
          node,
          `mutation($input: SetNodeEmbeddingInput!) {
            setNodeEmbedding(input: $input) {
              success
              embedding { nodeId }
              errors { message code }
            }
          }`,
          {
            input: {
              nodeId,
              tableId,
              vector: nodeDef.embedding,
              model: nodeDef.model ?? 'golden-8d',
            },
          },
        )
        if (!embedRes.setNodeEmbedding.success) {
          throw new Error(
            `Failed to set golden embedding for ${nodeDef.key}: ${JSON.stringify(embedRes.setNodeEmbedding.errors)}`,
          )
        }
      }
    }

    const tableNodes = idMap.nodes[tableDef.key] ?? {}
    for (const relDef of tableDef.relations) {
      const relRes = await runGoldenGraphQL<{
        createRelation: { success: boolean }
      }>(
        node,
        `mutation($input: CreateRelationInput!) {
          createRelation(input: $input) {
            success
          }
        }`,
        {
          input: {
            tableId,
            sourceNodeId: requireKey(tableNodes, relDef.source, `${tableDef.key}.node`),
            targetNodeId: requireKey(tableNodes, relDef.target, `${tableDef.key}.node`),
            relationshipType: relDef.relationType,
            strength: relDef.strength,
            confidence: relDef.confidence,
          },
        },
      )
      if (!relRes.createRelation.success) {
        throw new Error(
          `Failed to create golden relation ${relDef.source} -> ${relDef.target}`,
        )
      }
    }

    for (const docDef of tableDef.docs) {
      const docRes = await runGoldenGraphQL<{
        createDoc: { success: boolean; doc: { id: string } | null }
      }>(
        node,
        `mutation($input: CreateDocInput!) {
          createDoc(input: $input) {
            success
            doc { id }
          }
        }`,
        {
          input: {
            tableId,
            category: docDef.category,
            content: docDef.content,
            version: docDef.version,
          },
        },
      )
      const docId = docRes.createDoc.doc?.id
      if (!docRes.createDoc.success || !docId) {
        throw new Error(`Failed to create golden doc for ${tableDef.key}`)
      }
      if (docDef.activate) {
        await runGoldenGraphQL<{ activateDoc: { success: boolean } }>(
          node,
          `mutation($id: ID!) { activateDoc(id: $id) { success } }`,
          { id: docId },
        )
      }
    }
  }

  for (const tplDef of dataset.templates) {
    const tplRes = await runGoldenGraphQL<{
      createTemplate: { success: boolean }
    }>(
      node,
      `mutation($input: CreateQueryTemplateInput!) {
        createTemplate(input: $input) {
          success
        }
      }`,
      {
        input: {
          identifier: tplDef.identifier,
          name: tplDef.name,
          description: tplDef.description,
          tags: tplDef.tags,
          query: tplDef.query,
        },
      },
    )
    if (!tplRes.createTemplate.success) {
      throw new Error(`Failed to create golden template ${tplDef.identifier}`)
    }
  }

  return idMap
}

export async function collectGoldenIdMapFromExistingNode(
  node: PortableGraphNode,
  dataset: GoldenDataset = loadGoldenDataset(),
): Promise<GoldenIdMap> {
  const idMap: GoldenIdMap = {
    tables: {},
    attributes: {},
    nodes: {},
    keyByNodeId: {},
  }

  for (const tableDef of dataset.tables) {
    const tableRes = await runGoldenGraphQL<{
      tableByIdentifier: {
        id: string
        attributes: Array<{ id: string; identifier: string }>
        tableNodes: Array<{ id: string; content: string }>
      } | null
    }>(
      node,
      `query($identifier: String!) {
        tableByIdentifier(identifier: $identifier) {
          id
          attributes { id identifier }
          tableNodes { id content }
        }
      }`,
      { identifier: tableDef.identifier },
    )
    const table = tableRes.tableByIdentifier
    if (!table) {
      throw new Error(`Golden table '${tableDef.identifier}' missing in database`)
    }
    idMap.tables[tableDef.key] = table.id
    const attrs: Record<string, string> = {}
    for (const attrDef of tableDef.attributes) {
      const matched = table.attributes.find((a) => a.identifier === attrDef.identifier)
      if (!matched) {
        throw new Error(
          `Golden attribute '${attrDef.identifier}' missing on '${tableDef.identifier}'`,
        )
      }
      attrs[attrDef.key] = matched.id
    }
    idMap.attributes[tableDef.key] = attrs

    const nodesMap: Record<string, string> = {}
    for (const nodeDef of tableDef.nodes) {
      const matched = table.tableNodes.find(
        (item) => item.content === nodeDef.content,
      )
      if (!matched) {
        throw new Error(
          `Golden node '${nodeDef.key}' ('${nodeDef.content}') missing on '${tableDef.identifier}'`,
        )
      }
      nodesMap[nodeDef.key] = matched.id
      idMap.keyByNodeId[matched.id] = nodeDef.key
    }
    idMap.nodes[tableDef.key] = nodesMap
  }

  return idMap
}

export async function verifyGoldenDatasetOnNode(
  node: PortableGraphNode,
  ids: GoldenIdMap,
  expected: GoldenExpected = loadGoldenExpected(),
  options: { includeDocs?: boolean } = {},
): Promise<void> {
  const includeDocs = options.includeDocs !== false
  const orgTableId = requireKey(ids.tables, 'org_hierarchy', 'table')
  const docsTableId = requireKey(ids.tables, 'knowledge_docs', 'table')
  const dagTableId = requireKey(ids.tables, 'service_dag', 'table')

  const orgNodes = ids.nodes.org_hierarchy ?? {}
  const docsNodes = ids.nodes.knowledge_docs ?? {}
  const dagNodes = ids.nodes.service_dag ?? {}

  const ceoId = requireKey(orgNodes, 'ceo', 'org_hierarchy node')
  const engId = requireKey(orgNodes, 'eng', 'org_hierarchy node')
  const platformId = requireKey(orgNodes, 'platform', 'org_hierarchy node')
  const aiId = requireKey(orgNodes, 'ai', 'org_hierarchy node')
  const storageId = requireKey(orgNodes, 'storage', 'org_hierarchy node')
  const designId = requireKey(orgNodes, 'design', 'org_hierarchy node')

  const docBfsId = requireKey(docsNodes, 'doc_bfs', 'knowledge_docs node')
  const docDijkstraId = requireKey(docsNodes, 'doc_dijkstra', 'knowledge_docs node')
  const docEdgeId = requireKey(docsNodes, 'doc_edge_do', 'knowledge_docs node')
  const docMcpId = requireKey(docsNodes, 'doc_mcp_spec', 'knowledge_docs node')
  const docIslandId = requireKey(docsNodes, 'doc_island', 'knowledge_docs node')
  const dbCoreId = requireKey(dagNodes, 'db_core', 'service_dag node')

  const toKeys = (nodeIds: string[]): string[] =>
    nodeIds.map((id) => ids.keyByNodeId[id] ?? id)

  // 1. Search (FTS5 + EAV value_num numeric filter pushdown + legacy searchQuery sorting)
  const searchCheck = await runGoldenGraphQL<{
    fts: { nodes: Array<{ id: string }> }
    numeric: { nodes: Array<{ id: string }> }
    legacyNumeric: { nodes: Array<{ id: string }> }
    catGraph: { totalCount: number }
  }>(
    node,
    `query($docsTableId: ID!) {
      fts: searchNodes(filter: { tableId: $docsTableId, search: "dijkstra" }) {
        nodes { id }
      }
      numeric: searchNodes(
        filter: {
          tableId: $docsTableId
          attributeFilters: [{ identifier: "priority", operator: GREATER_THAN, value: "85" }]
        }
        sort: [{ field: "priority", direction: DESC }]
      ) {
        nodes { id }
      }
      legacyNumeric: searchNodes(
        tableId: $docsTableId
        searchQuery: {
          conditions: [{ logicalOperator: "AND", filters: [{ field: "priority", operator: "greater_than", value: 85 }] }]
          sortBy: [{ field: "priority", direction: "DESC" }]
        }
      ) {
        nodes { id }
      }
      catGraph: searchNodes(
        filter: {
          tableId: $docsTableId
          attributeFilters: [{ identifier: "category", operator: EQUALS, value: "graph" }]
        }
      ) {
        totalCount
      }
    }`,
    { docsTableId },
  )
  expect(toKeys(searchCheck.fts.nodes.map((n) => n.id))).toEqual(
    expected.search.ftsDijkstra,
  )
  expect(toKeys(searchCheck.numeric.nodes.map((n) => n.id))).toEqual(
    expected.search.priorityGt85Desc,
  )
  expect(toKeys(searchCheck.legacyNumeric.nodes.map((n) => n.id))).toEqual(
    expected.search.priorityGt85Desc,
  )
  expect(searchCheck.catGraph.totalCount).toBe(expected.search.categoryGraphCount)

  // 2. Traversal, Weighted Shortest Path, SCC, PageRank, Connectivity
  const graphCheck = await runGoldenGraphQL<{
    engNode: { connectedNodes: Array<{ id: string }> } | null
    ceoNode: { shortestPath: Array<{ id: string }> } | null
    depChain: { nodes: Array<{ id: string }> }
    optPath: { path: Array<{ node: { id: string } }> }
    scc: {
      totalComponents: number
      largestComponentSize: number
      components: Array<{ id: number; size: number; nodeIds: string[] }>
    }
    pr: { converged: boolean; entries: Array<{ rank: number; score: number; node: { id: string } }> }
    islandConn: { relationshipSummary: { totalConnections: number } }
  }>(
    node,
    `query(
      $engId: ID!,
      $ceoId: ID!,
      $storageId: ID!,
      $docBfsId: ID!,
      $docMcpId: ID!,
      $docsTableId: ID!,
      $docIslandId: ID!
    ) {
      engNode: node(id: $engId) {
        connectedNodes(depth: 2, direction: "OUTGOING", relationTypes: ["parentOf"]) {
          id
        }
      }
      ceoNode: node(id: $ceoId) {
        shortestPath(targetNodeId: $storageId, maxDepth: 5) {
          id
        }
      }
      depChain: getDependencyChain(input: { nodeId: $docBfsId, direction: OUTGOING, maxDepth: 4, relationTypeIds: ["dependsOn"] }) {
        nodes { id }
      }
      optPath: findOptimalPath(input: {
        sourceNodeId: $docBfsId
        targetNodeId: $docMcpId
        algorithm: WEIGHTED_SHORTEST
        weightingStrategy: STRENGTH_CONFIDENCE
      }) {
        path { node { id } }
      }
      scc: stronglyConnectedComponents(tableId: $docsTableId) {
        totalComponents
        largestComponentSize
        components { id size nodeIds }
      }
      pr: pageRank(tableId: $docsTableId, limit: 8) {
        converged
        entries { rank score node { id } }
      }
      islandConn: getNodeConnectivity(nodeId: $docIslandId) {
        relationshipSummary { totalConnections }
      }
    }`,
    {
      engId,
      ceoId,
      storageId,
      docBfsId,
      docMcpId,
      docsTableId,
      docIslandId,
    },
  )

  expect(
    toKeys(graphCheck.engNode?.connectedNodes.map((n) => n.id) ?? []).sort(),
  ).toEqual(expected.traversal.orgConnectedDepth2FromEng)
  expect(toKeys(graphCheck.ceoNode?.shortestPath.map((n) => n.id) ?? [])).toEqual(
    expected.traversal.orgShortestPathCeoToStorage,
  )
  expect(toKeys(graphCheck.depChain.nodes.map((n) => n.id)).sort()).toEqual(
    expected.traversal.docsDependencyChainFromBfsOut,
  )
  expect(toKeys(graphCheck.optPath.path.map((p) => p.node.id))).toEqual(
    expected.traversal.docsOptimalPathBfsToMcpSpec,
  )
  expect(graphCheck.scc.totalComponents).toBe(
    expected.analytics.docsSccTotalComponents,
  )
  expect(graphCheck.scc.largestComponentSize).toBe(
    expected.analytics.docsSccLargestSize,
  )
  const nonTrivialComps = graphCheck.scc.components.filter((c) => c.size > 1)
  expect(nonTrivialComps.length).toBe(
    expected.analytics.docsSccNonTrivialCount,
  )
  const nonTrivialComp = nonTrivialComps[0]
  expect(toKeys(nonTrivialComp?.nodeIds ?? []).sort()).toEqual(
    expected.analytics.docsSccCycleMembers,
  )
  expect(graphCheck.pr.converged).toBe(true)
  expect(
    graphCheck.pr.entries.every(
      (e) => e.rank >= 1 && Number.isFinite(e.score) && e.score > 0,
    ),
  ).toBe(true)
  expect(graphCheck.islandConn.relationshipSummary.totalConnections).toBe(
    expected.analytics.islandConnections,
  )

  // 3. Hierarchy (Tree roots/leaves, ancestors, subtree, LCA, DAG vs TREE)
  const hierarchyCheck = await runGoldenGraphQL<{
    roots: Array<{ id: string }>
    leaves: Array<{ id: string }>
    anc: { isRoot: boolean; depth: number; pathIds: string[]; rootNode: { id: string } | null }
    subtree: { entries: Array<{ node: { id: string } }> }
    lcaEng: { found: boolean; ancestor: { id: string } | null }
    lcaCeo: { found: boolean; ancestor: { id: string } | null }
    orgValid: {
      valid: boolean
      totalNodes: number
      totalEdges: number
      rootCount: number
      leafCount: number
      isolatedCount: number
      maxDepth: number
    }
    dagAsDag: { valid: boolean; multiParentNodeIds: string[] }
    dagAsTree: { valid: boolean; cycleNodeIds: string[]; multiParentNodeIds: string[] }
  }>(
    node,
    `query($orgTableId: ID!, $dagTableId: ID!, $storageId: ID!, $platformId: ID!, $aiId: ID!, $designId: ID!) {
      roots: getHierarchyRoots(tableId: $orgTableId) { id }
      leaves: getHierarchyLeaves(tableId: $orgTableId) { id }
      anc: getAncestors(nodeId: $storageId) {
        isRoot
        depth
        pathIds
        rootNode { id }
      }
      subtree: getSubtree(rootNodeId: $platformId) {
        entries { node { id } }
      }
      lcaEng: getLowestCommonAncestor(nodeIdA: $storageId, nodeIdB: $aiId) {
        found
        ancestor { id }
      }
      lcaCeo: getLowestCommonAncestor(nodeIdA: $storageId, nodeIdB: $designId) {
        found
        ancestor { id }
      }
      orgValid: validateHierarchy(tableId: $orgTableId, mode: TREE) {
        valid totalNodes totalEdges rootCount leafCount isolatedCount maxDepth
      }
      dagAsDag: validateHierarchy(tableId: $dagTableId, mode: DAG) {
        valid multiParentNodeIds
      }
      dagAsTree: validateHierarchy(tableId: $dagTableId, mode: TREE) {
        valid cycleNodeIds multiParentNodeIds
      }
    }`,
    { orgTableId, dagTableId, storageId, platformId, aiId, designId },
  )

  expect(toKeys(hierarchyCheck.roots.map((n) => n.id))).toEqual(
    expected.hierarchy.orgRoots,
  )
  expect(toKeys(hierarchyCheck.leaves.map((n) => n.id)).sort()).toEqual(
    expected.hierarchy.orgLeaves,
  )
  expect(hierarchyCheck.anc.isRoot).toBe(false)
  expect(hierarchyCheck.anc.depth).toBe(3)
  expect(toKeys(hierarchyCheck.anc.pathIds)).toEqual([
    ...expected.hierarchy.storageAncestors,
    'storage',
  ])
  expect(ids.keyByNodeId[hierarchyCheck.anc.rootNode?.id ?? '']).toBe('ceo')
  expect(toKeys(hierarchyCheck.subtree.entries.map((e) => e.node.id)).sort()).toEqual(
    expected.hierarchy.platformSubtreeNodes,
  )
  expect(ids.keyByNodeId[hierarchyCheck.lcaEng.ancestor?.id ?? '']).toBe(
    expected.hierarchy.lcaStorageAndAi,
  )
  expect(ids.keyByNodeId[hierarchyCheck.lcaCeo.ancestor?.id ?? '']).toBe(
    expected.hierarchy.lcaStorageAndDesign,
  )
  expect(hierarchyCheck.orgValid).toEqual(expected.hierarchy.orgTreeValidation)
  expect(hierarchyCheck.dagAsDag.valid).toBe(true)
  expect(hierarchyCheck.dagAsTree.valid).toBe(false)
  expect(toKeys(hierarchyCheck.dagAsTree.multiParentNodeIds)).toEqual([
    expected.hierarchy.serviceDagMultiParentKey,
  ])

  // 4. 4-Signal Hybrid Search (lexical+vector + graph-anchored)
  const hybridCheck = await runGoldenGraphQL<{
    globalHybrid: { results: Array<{ node: { id: string } }> }
    anchoredHybrid: { results: Array<{ node: { id: string }; hopDistance: number | null }> }
  }>(
    node,
    `query($docsTableId: ID!, $docBfsId: ID!) {
      globalHybrid: hybridSearchNodes(input: {
        tableId: $docsTableId
        textQuery: "bidirectional traversal"
        vector: [1, 0, 0, 0, 0, 0, 0, 0]
        limit: 3
      }) {
        results { node { id } }
      }
      anchoredHybrid: hybridSearchNodes(input: {
        tableId: $docsTableId
        vector: [0.6, 0.4, 0.5, 0, 0, 0, 0, 0]
        graph: {
          anchorNodeIds: [$docBfsId]
          direction: "OUTGOING"
          maxDepth: 1
          includeAnchors: false
        }
        limit: 5
      }) {
        results { node { id } hopDistance }
      }
    }`,
    { docsTableId, docBfsId },
  )
  expect(
    ids.keyByNodeId[hybridCheck.globalHybrid.results[0]?.node.id ?? ''],
  ).toBe(expected.hybrid.graphVectorTopKey)
  expect(
    toKeys(hybridCheck.anchoredHybrid.results.map((r) => r.node.id)).sort(),
  ).toEqual(expected.hybrid.anchoredSubtreeTopKeys)

  // 5. Docs, Attribute Analytics, Custom Sort, OpenAPI Projection & REST Parity
  const docsCheck = await runGoldenGraphQL<{
    activeDocs: { docs: Array<{ category: string; content: string; isActive: boolean }> }
    attrAnalytics: { totalNodes: number; attributeStats: Array<{ identifier: string }> }
    completeness: { completeNodes: number; completenessRate: number }
    sortFns: Array<{ id: string }>
    projection: Record<string, unknown> | null
  }>(
    node,
    `query($docsTableId: ID!) {
      activeDocs: getDocs(tableId: $docsTableId, filter: { isActive: true }) {
        docs { category content isActive }
      }
      attrAnalytics: nodeAttributeAnalytics(tableId: $docsTableId) {
        totalNodes
        attributeStats { identifier }
      }
      completeness: attributeCompleteness(tableId: $docsTableId) {
        completeNodes
        completenessRate
      }
      sortFns: customSortFunctions { id }
      projection: tableOpenApiProjection(tableId: $docsTableId)
    }`,
    { docsTableId },
  )
  if (includeDocs) {
    expect(docsCheck.activeDocs.docs).toHaveLength(
      expected.counts.knowledge_docs?.activeDocs ?? 2,
    )
    expect(
      docsCheck.activeDocs.docs.find((d) => d.category === 'usage')?.content,
    ).toBe(expected.docs.activeUsageContent)
    expect(
      docsCheck.activeDocs.docs.find((d) => d.category === 'spec')?.content,
    ).toBe(expected.docs.activeSpecContent)
  }
  expect(docsCheck.attrAnalytics.totalNodes).toBe(8)
  expect(docsCheck.completeness.completenessRate).toBe(100)
  expect(docsCheck.sortFns.length).toBeGreaterThanOrEqual(4)
  expect(docsCheck.projection).toBeTruthy()
  expect(typeof docsCheck.projection).toBe('object')

  // 6. REST parity across newly aligned routes
  const [tableDocsResp, nodeRelResp, attrListResp, auditResp, shortestRestResp] =
    await Promise.all([
      node.fetch(new Request(`http://localhost/api/tables/${docsTableId}/docs`)),
      node.fetch(
        new Request(
          `http://localhost/api/nodes/${docDijkstraId}/relations?direction=BOTH`,
        ),
      ),
      node.fetch(
        new Request(`http://localhost/api/attributes/tables/${docsTableId}`),
      ),
      node.fetch(
        new Request(`http://localhost/api/tables/${docsTableId}/schema/audit`),
      ),
      node.fetch(
        new Request('http://localhost/api/nodes/shortest-path', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromNodeId: ceoId,
            toNodeId: storageId,
            maxDepth: 5,
          }),
        }),
      ),
    ])

  expect(tableDocsResp.status).toBe(200)
  expect(nodeRelResp.status).toBe(200)
  expect(attrListResp.status).toBe(200)
  expect(auditResp.status).toBe(200)
  expect(shortestRestResp.status).toBe(200)

  const auditJson = (await auditResp.json()) as {
    success: boolean
    data: {
      valid: boolean
      totalNodes: number
      conformantNodes: number
      nonConformantNodes: number
      violationCount: number
    }
  }
  expect(auditJson.success).toBe(true)
  expect(auditJson.data.valid).toBe(true)
  expect(auditJson.data.totalNodes).toBe(8)
  expect(auditJson.data.conformantNodes).toBe(8)
  expect(auditJson.data.nonConformantNodes).toBe(0)
  expect(auditJson.data.violationCount).toBe(0)

  const shortestRestJson = (await shortestRestResp.json()) as {
    success: boolean
    data: { path: string[]; distance: number }
  }
  expect(shortestRestJson.success).toBe(true)
  expect(shortestRestJson.data.distance).toBe(3)
  expect(toKeys(shortestRestJson.data.path)).toEqual(
    expected.traversal.orgShortestPathCeoToStorage,
  )

  // Quick check to keep dbCoreId & docEdgeId referenced in non-trivial DAG assertions
  expect(dbCoreId).toBeTruthy()
  expect(docEdgeId).toBeTruthy()
}

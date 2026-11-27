import { type NodeDto, fromEntity as nodeFromEntity } from '@/application/dtos/NodeDto.js'
import { type NodeRelationDto, nodeRelationFromEntity } from '@/application/dtos/RelationDto.js'
import { resolveRelationTypeRefs } from '@/application/services/GraphTraversalService.js'
import type { NodeId, RelationTypeId } from '@/core/types/CommonTypes.js'
import type { Node } from '@/domain/entities/Node.js'
import { NodeRelation } from '@/domain/entities/NodeRelation.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { stronglyConnectedComponents } from '@/domain/services/graph/StronglyConnectedComponents.js'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'

const MAX_SCAN_NODES = 10_000
const MAX_SCAN_RELATIONS = 25_000
const DEFAULT_HIERARCHY_RELATION_TYPE = 'parentOf'

export type HierarchyMode = 'TREE' | 'DAG'

export interface HierarchyEntryDto {
  node: NodeDto
  parentId: string | null
  depth: number
  pathIds: string[]
  childIds: string[]
  childCount: number
  isLeaf: boolean
}

export interface AncestorChainResultDto {
  node: NodeDto
  ancestors: HierarchyEntryDto[]
  pathIds: string[]
  rootNode: NodeDto | null
  depth: number
  isRoot: boolean
  hasCycle: boolean
}

export interface DescendantsResultDto {
  rootNode: NodeDto
  entries: HierarchyEntryDto[]
  totalCount: number
  maxDepthReached: number
  leafCount: number
  hasCycle: boolean
}

export interface SubtreeResultDto {
  rootNode: NodeDto
  entries: HierarchyEntryDto[]
  edges: NodeRelationDto[]
  totalNodes: number
  maxDepthReached: number
  leafCount: number
  hasCycle: boolean
}

export interface LowestCommonAncestorResultDto {
  found: boolean
  ancestor: NodeDto | null
  distanceFromA: number | null
  distanceFromB: number | null
  pathFromA: string[]
  pathFromB: string[]
}

export interface HierarchyValidationResultDto {
  tableId: string
  relationTypeIdentifier: string
  mode: HierarchyMode
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

export interface MoveHierarchyNodeResultDto {
  success: boolean
  node: NodeDto
  previousParentIds: string[]
  newParentId: string | null
  relation: NodeRelationDto | null
  ancestors: HierarchyEntryDto[]
  errors: Array<{ message: string; code: string }>
}

/**
 * Provides first-class Tree / DAG hierarchy queries and safe re-parenting over
 * node relations (`source_node_id --[relationType]--> target_node_id`).
 */
export class GraphHierarchyService {
  constructor(
    private readonly nodeRepository: INodeRepository,
    private readonly nodeRelationRepository: INodeRelationRepository,
    private readonly relationTypeRepository: IRelationTypeRepository,
    private readonly tableRepository?: ITableRepository,
  ) {}

  async getAncestors(
    nodeId: string,
    relationTypeRef = DEFAULT_HIERARCHY_RELATION_TYPE,
    maxDepth = 32,
  ): Promise<AncestorChainResultDto> {
    const startNode = await this.nodeRepository.findById(nodeId)
    if (!startNode) {
      throw new NotFoundException(`Node with ID '${nodeId}' not found`)
    }

    const cappedDepth = clampInt(maxDepth, 0, 64)
    const startDto = nodeFromEntity(startNode)
    const resolvedRt = await this.resolveHierarchyType(relationTypeRef)
    if (!resolvedRt || resolvedRt.ids.length === 0 || cappedDepth === 0) {
      return {
        node: startDto,
        ancestors: [],
        pathIds: [nodeId],
        rootNode: startDto,
        depth: 0,
        isRoot: true,
        hasCycle: false,
      }
    }

    const depthById = new Map<string, number>([[nodeId, 0]])
    const primaryChildById = new Map<string, string>()
    const incomingParentIds = new Map<string, string[]>()
    const upwardSubgraphOutgoing = new Map<string, string[]>()
    let frontier = [nodeId]
    let currentDepth = 0

    while (frontier.length > 0 && currentDepth < cappedDepth) {
      const incomingAdj = await this.loadAdjacent(frontier, 'INCOMING', resolvedRt.ids)
      const nextFrontier: string[] = []
      const nextDepth = currentDepth + 1

      for (const currentId of frontier) {
        const parents = incomingAdj.get(currentId) ?? []
        for (const rel of parents) {
          const parentId = rel.getSourceNodeId()
          if (!parentId || rel.getSourceExternalId() !== 'internal') continue
          addUniqueEdge(incomingParentIds, currentId, parentId)
          addUniqueEdge(upwardSubgraphOutgoing, parentId, currentId)
          if (!depthById.has(parentId)) {
            depthById.set(parentId, nextDepth)
            primaryChildById.set(parentId, currentId)
            nextFrontier.push(parentId)
          }
        }
      }

      frontier = nextFrontier
      currentDepth = nextDepth
    }

    const ancestorIds = [...depthById.keys()].filter((id) => id !== nodeId)
    if (ancestorIds.length === 0) {
      return {
        node: startDto,
        ancestors: [],
        pathIds: [nodeId],
        rootNode: startDto,
        depth: 0,
        isRoot: true,
        hasCycle: false,
      }
    }

    const discoveredIds = [...depthById.keys()]
    const hasCycle = detectCycleInSubgraph(discoveredIds, upwardSubgraphOutgoing)
    const outgoingAdj = await this.loadAdjacent(discoveredIds, 'OUTGOING', resolvedRt.ids)
    const loadedNodes = await this.loadNodesMap(ancestorIds)
    loadedNodes.set(nodeId, startNode)

    // Choose the furthest ancestor on the primary path as root for breadcrumb ordering.
    const primaryChainFromNodeToRoot: string[] = []
    let cursor: string | undefined = nodeId
    const seenPath = new Set<string>()
    while (cursor && !seenPath.has(cursor)) {
      seenPath.add(cursor)
      primaryChainFromNodeToRoot.push(cursor)
      const parents: string[] = incomingParentIds.get(cursor) ?? []
      cursor = parents[0]
    }
    const primaryPathIds = [...primaryChainFromNodeToRoot].reverse()
    const rootId = primaryPathIds[0] ?? nodeId
    const rootEntity = loadedNodes.get(rootId)
    const rootNodeDto = rootEntity ? nodeFromEntity(rootEntity) : null

    // Order ancestors from farthest (top/root) down to closest (direct parent).
    const sortedAncestorIds = [...ancestorIds].sort((a, b) => {
      const da = depthById.get(a) ?? 0
      const db = depthById.get(b) ?? 0
      if (db !== da) return db - da
      return a.localeCompare(b)
    })

    const ancestors: HierarchyEntryDto[] = []
    for (const ancestorId of sortedAncestorIds) {
      const entity = loadedNodes.get(ancestorId)
      if (!entity) continue
      const parents = incomingParentIds.get(ancestorId) ?? []
      const childIds = extractChildIds(outgoingAdj.get(ancestorId) ?? [])
      ancestors.push({
        node: nodeFromEntity(entity),
        parentId: parents[0] ?? null,
        depth: depthById.get(ancestorId) ?? 0,
        pathIds: buildRootToNodePath(ancestorId, incomingParentIds),
        childIds,
        childCount: childIds.length,
        isLeaf: childIds.length === 0,
      })
    }

    const maxDepthValue = Math.max(...ancestorIds.map((id) => depthById.get(id) ?? 0), 0)

    return {
      node: startDto,
      ancestors,
      pathIds: primaryPathIds,
      rootNode: rootNodeDto,
      depth: maxDepthValue,
      isRoot: false,
      hasCycle,
    }
  }

  async getDescendants(
    nodeId: string,
    relationTypeRef = DEFAULT_HIERARCHY_RELATION_TYPE,
    maxDepth = 10,
  ): Promise<DescendantsResultDto> {
    const result = await this.traverseDownward(nodeId, relationTypeRef, maxDepth, false)
    return {
      rootNode: result.rootNode,
      entries: result.entries,
      totalCount: result.entries.length,
      maxDepthReached: result.maxDepthReached,
      leafCount: result.leafCount,
      hasCycle: result.hasCycle,
    }
  }

  async getSubtree(
    rootNodeId: string,
    relationTypeRef = DEFAULT_HIERARCHY_RELATION_TYPE,
    maxDepth = 6,
  ): Promise<SubtreeResultDto> {
    const result = await this.traverseDownward(rootNodeId, relationTypeRef, maxDepth, true)
    return {
      rootNode: result.rootNode,
      entries: result.entries,
      edges: result.edges.map((edge) => nodeRelationFromEntity(edge)),
      totalNodes: result.entries.length,
      maxDepthReached: result.maxDepthReached,
      leafCount: result.leafCount,
      hasCycle: result.hasCycle,
    }
  }

  async getHierarchyRoots(
    tableId: string,
    relationTypeRef = DEFAULT_HIERARCHY_RELATION_TYPE,
    includeIsolated = false,
  ): Promise<NodeDto[]> {
    const graph = await this.loadTableHierarchyGraph(tableId, relationTypeRef)
    const roots: NodeDto[] = []
    for (const node of graph.nodes) {
      const id = String(node.getId())
      const inDeg = (graph.incoming.get(id) ?? []).length
      const outDeg = (graph.outgoing.get(id) ?? []).length
      if (inDeg === 0 && (includeIsolated || outDeg > 0)) {
        roots.push(nodeFromEntity(node))
      }
    }
    return roots
  }

  async getHierarchyLeaves(
    tableId: string,
    relationTypeRef = DEFAULT_HIERARCHY_RELATION_TYPE,
    includeIsolated = false,
  ): Promise<NodeDto[]> {
    const graph = await this.loadTableHierarchyGraph(tableId, relationTypeRef)
    const leaves: NodeDto[] = []
    for (const node of graph.nodes) {
      const id = String(node.getId())
      const inDeg = (graph.incoming.get(id) ?? []).length
      const outDeg = (graph.outgoing.get(id) ?? []).length
      if (outDeg === 0 && (includeIsolated || inDeg > 0)) {
        leaves.push(nodeFromEntity(node))
      }
    }
    return leaves
  }

  async getLowestCommonAncestor(
    nodeIdA: string,
    nodeIdB: string,
    relationTypeRef = DEFAULT_HIERARCHY_RELATION_TYPE,
    maxDepth = 32,
  ): Promise<LowestCommonAncestorResultDto> {
    const [nodeA, nodeB] = await Promise.all([
      this.nodeRepository.findById(nodeIdA),
      this.nodeRepository.findById(nodeIdB),
    ])
    if (!nodeA) {
      throw new NotFoundException(`Node with ID '${nodeIdA}' not found`)
    }
    if (!nodeB) {
      throw new NotFoundException(`Node with ID '${nodeIdB}' not found`)
    }

    if (nodeIdA === nodeIdB) {
      return {
        found: true,
        ancestor: nodeFromEntity(nodeA),
        distanceFromA: 0,
        distanceFromB: 0,
        pathFromA: [nodeIdA],
        pathFromB: [nodeIdB],
      }
    }

    const resolvedRt = await this.resolveHierarchyType(relationTypeRef)
    if (!resolvedRt || resolvedRt.ids.length === 0) {
      return {
        found: false,
        ancestor: null,
        distanceFromA: null,
        distanceFromB: null,
        pathFromA: [],
        pathFromB: [],
      }
    }

    const cappedDepth = clampInt(maxDepth, 0, 64)
    const [ancA, ancB] = await Promise.all([
      this.collectUpwardDistanceMap(nodeIdA, resolvedRt.ids, cappedDepth),
      this.collectUpwardDistanceMap(nodeIdB, resolvedRt.ids, cappedDepth),
    ])

    let bestId: string | null = null
    let bestScore = Number.POSITIVE_INFINITY
    let bestMaxDist = Number.POSITIVE_INFINITY

    for (const [candidateId, distA] of ancA.dist) {
      const distB = ancB.dist.get(candidateId)
      if (distB === undefined) continue
      const sumDist = distA + distB
      const maxDist = Math.max(distA, distB)
      if (
        sumDist < bestScore ||
        (sumDist === bestScore && maxDist < bestMaxDist) ||
        (sumDist === bestScore && maxDist === bestMaxDist && bestId !== null && candidateId < bestId)
      ) {
        bestId = candidateId
        bestScore = sumDist
        bestMaxDist = maxDist
      }
    }

    if (!bestId) {
      return {
        found: false,
        ancestor: null,
        distanceFromA: null,
        distanceFromB: null,
        pathFromA: [],
        pathFromB: [],
      }
    }

    const ancestorEntity =
      bestId === nodeIdA ? nodeA : bestId === nodeIdB ? nodeB : await this.nodeRepository.findById(bestId)
    if (!ancestorEntity) {
      return {
        found: false,
        ancestor: null,
        distanceFromA: null,
        distanceFromB: null,
        pathFromA: [],
        pathFromB: [],
      }
    }

    return {
      found: true,
      ancestor: nodeFromEntity(ancestorEntity),
      distanceFromA: ancA.dist.get(bestId) ?? 0,
      distanceFromB: ancB.dist.get(bestId) ?? 0,
      pathFromA: reconstructUpwardPath(nodeIdA, bestId, ancA.nextHop),
      pathFromB: reconstructUpwardPath(nodeIdB, bestId, ancB.nextHop),
    }
  }

  async validateHierarchy(
    tableId: string,
    relationTypeRef = DEFAULT_HIERARCHY_RELATION_TYPE,
    mode: HierarchyMode = 'TREE',
  ): Promise<HierarchyValidationResultDto> {
    if (this.tableRepository) {
      const table = await this.tableRepository.findById(tableId)
      if (!table) {
        throw new NotFoundException(`Table with ID '${tableId}' not found`)
      }
    }

    const graph = await this.loadTableHierarchyGraph(tableId, relationTypeRef)
    const sccs = stronglyConnectedComponents(graph.nodeIds, graph.outgoing)
    const cycleSet = new Set<string>()
    for (const scc of sccs) {
      if (scc.nodeIds.length > 1) {
        for (const id of scc.nodeIds) cycleSet.add(id)
      } else if (scc.nodeIds.length === 1) {
        const only = scc.nodeIds[0]
        if (only && (graph.outgoing.get(only) ?? []).includes(only)) {
          cycleSet.add(only)
        }
      }
    }

    const multiParentNodeIds: string[] = []
    let rootCount = 0
    let leafCount = 0
    let isolatedCount = 0
    const rootIds: string[] = []

    for (const id of graph.nodeIds) {
      const parents = graph.incoming.get(id) ?? []
      const children = graph.outgoing.get(id) ?? []
      if (parents.length > 1) {
        multiParentNodeIds.push(id)
      }
      if (parents.length === 0 && children.length === 0) {
        isolatedCount += 1
      } else {
        if (parents.length === 0 && children.length > 0) {
          rootCount += 1
          rootIds.push(id)
        }
        if (children.length === 0 && parents.length > 0) {
          leafCount += 1
        }
      }
    }

    const maxDepth = computeMaxHierarchyDepth(graph.nodeIds, rootIds, graph.outgoing)
    const cycleNodeIds = [...cycleSet].sort()
    multiParentNodeIds.sort()

    const valid = cycleNodeIds.length === 0 && (mode === 'DAG' || multiParentNodeIds.length === 0)

    return {
      tableId,
      relationTypeIdentifier: graph.relationTypeIdentifier,
      mode,
      valid,
      totalNodes: graph.nodeIds.length,
      totalEdges: graph.edges.length,
      rootCount,
      leafCount,
      isolatedCount,
      maxDepth,
      cycleNodeIds,
      multiParentNodeIds,
    }
  }

  async moveHierarchyNode(
    nodeId: string,
    newParentId: string | null,
    relationTypeRef = DEFAULT_HIERARCHY_RELATION_TYPE,
  ): Promise<MoveHierarchyNodeResultDto> {
    const node = await this.nodeRepository.findById(nodeId)
    if (!node) {
      throw new NotFoundException(`Node with ID '${nodeId}' not found`)
    }

    const resolvedRt = await this.resolveHierarchyType(relationTypeRef)
    const primaryRtId = resolvedRt?.ids[0]
    if (!primaryRtId) {
      throw new NotFoundException(`Hierarchy relation type '${relationTypeRef}' not found`)
    }

    if (newParentId !== null) {
      if (newParentId === nodeId) {
        throw new ValidationException('Cannot move a node under itself')
      }

      const newParent = await this.nodeRepository.findById(newParentId)
      if (!newParent) {
        throw new NotFoundException(`Target parent node '${newParentId}' not found`)
      }

      if (String(newParent.getTableId()) !== String(node.getTableId())) {
        throw new ValidationException('Target parent node must belong to the same table')
      }

      // Check whether newParentId is currently inside nodeId's descendant subtree
      const descendants = await this.traverseDownward(nodeId, relationTypeRef, 64, false)
      if (descendants.entries.some((entry) => entry.node.id === newParentId)) {
        throw new ValidationException('Moving a node under one of its descendants would create a cycle')
      }
    }

    const existingIncoming = await this.nodeRelationRepository.findByTargetNodeIdAndRelationType(
      nodeId as NodeId,
      primaryRtId as RelationTypeId,
    )
    const previousParentIds = [
      ...new Set(
        existingIncoming
          .map((rel) => rel.getSourceNodeId())
          .filter((id): id is NodeId => typeof id === 'string' && id.length > 0),
      ),
    ]

    let preservedRelation: NodeRelation | null = null
    for (const rel of existingIncoming) {
      if (newParentId !== null && rel.getSourceNodeId() === newParentId && !preservedRelation) {
        preservedRelation = rel
        continue
      }
      const relId = rel.getId()
      if (relId) {
        await this.nodeRelationRepository.delete(relId)
      }
    }

    let finalRelation = preservedRelation
    if (newParentId !== null && !finalRelation) {
      const created = NodeRelation.create(
        node.getTableId(),
        newParentId as NodeId,
        'internal',
        nodeId as NodeId,
        'internal',
        primaryRtId as RelationTypeId,
        null,
        3,
        3,
      )
      await this.nodeRelationRepository.save(created)
      const reloaded = await this.nodeRelationRepository.findByTargetNodeIdAndRelationType(
        nodeId as NodeId,
        primaryRtId as RelationTypeId,
      )
      finalRelation = reloaded.find((rel) => rel.getSourceNodeId() === newParentId) ?? created
    }

    const ancestorResult = await this.getAncestors(nodeId, relationTypeRef, 32)
    return {
      success: true,
      node: nodeFromEntity(node),
      previousParentIds,
      newParentId,
      relation: finalRelation ? nodeRelationFromEntity(finalRelation) : null,
      ancestors: ancestorResult.ancestors,
      errors: [],
    }
  }

  private async resolveHierarchyType(ref: string) {
    const trimmed = ref.trim() || DEFAULT_HIERARCHY_RELATION_TYPE
    return await resolveRelationTypeRefs(this.relationTypeRepository, [trimmed])
  }

  private async traverseDownward(
    rootNodeId: string,
    relationTypeRef: string,
    maxDepth: number,
    includeRoot: boolean,
  ): Promise<{
    rootNode: NodeDto
    entries: HierarchyEntryDto[]
    edges: NodeRelation[]
    maxDepthReached: number
    leafCount: number
    hasCycle: boolean
  }> {
    const rootNode = await this.nodeRepository.findById(rootNodeId)
    if (!rootNode) {
      throw new NotFoundException(`Node with ID '${rootNodeId}' not found`)
    }

    const rootDto = nodeFromEntity(rootNode)
    const cappedDepth = clampInt(maxDepth, 0, 32)
    const resolvedRt = await this.resolveHierarchyType(relationTypeRef)

    if (!resolvedRt || resolvedRt.ids.length === 0 || cappedDepth === 0) {
      const rootOutgoing =
        resolvedRt && resolvedRt.ids.length > 0
          ? extractChildIds((await this.loadAdjacent([rootNodeId], 'OUTGOING', resolvedRt.ids)).get(rootNodeId) ?? [])
          : []
      const rootEntry: HierarchyEntryDto = {
        node: rootDto,
        parentId: null,
        depth: 0,
        pathIds: [rootNodeId],
        childIds: rootOutgoing,
        childCount: rootOutgoing.length,
        isLeaf: rootOutgoing.length === 0,
      }
      return {
        rootNode: rootDto,
        entries: includeRoot ? [rootEntry] : [],
        edges: [],
        maxDepthReached: 0,
        leafCount: includeRoot && rootEntry.isLeaf ? 1 : 0,
        hasCycle: false,
      }
    }

    const depthById = new Map<string, number>([[rootNodeId, 0]])
    const parentById = new Map<string, string | null>([[rootNodeId, null]])
    const pathById = new Map<string, string[]>([[rootNodeId, [rootNodeId]]])
    const childIdsByParent = new Map<string, string[]>()
    const subgraphOutgoing = new Map<string, string[]>()
    const collectedEdges = new Map<string, NodeRelation>()

    let frontier = [rootNodeId]
    let currentDepth = 0

    while (frontier.length > 0 && currentDepth < cappedDepth) {
      const outgoingAdj = await this.loadAdjacent(frontier, 'OUTGOING', resolvedRt.ids)
      const nextFrontier: string[] = []
      const nextDepth = currentDepth + 1

      for (const parentId of frontier) {
        const rels = outgoingAdj.get(parentId) ?? []
        for (const rel of rels) {
          const childId = rel.getTargetNodeId()
          if (!childId || rel.getTargetExternalId() !== 'internal') continue
          addUniqueEdge(childIdsByParent, parentId, childId)
          addUniqueEdge(subgraphOutgoing, parentId, childId)
          const edgeKey = rel.getId() || `${parentId}->${childId}:${rel.getRelationTypeId()}`
          if (!collectedEdges.has(edgeKey)) {
            collectedEdges.set(edgeKey, rel)
          }
          if (!depthById.has(childId)) {
            depthById.set(childId, nextDepth)
            parentById.set(childId, parentId)
            const parentPath = pathById.get(parentId) ?? [rootNodeId]
            pathById.set(childId, [...parentPath, childId])
            nextFrontier.push(childId)
          }
        }
      }

      frontier = nextFrontier
      currentDepth = nextDepth
    }

    // Load outgoing children for frontier nodes at cappedDepth so `isLeaf` & `childIds` are accurate.
    if (frontier.length > 0) {
      const frontierOutgoing = await this.loadAdjacent(frontier, 'OUTGOING', resolvedRt.ids)
      for (const nodeId of frontier) {
        const childIds = extractChildIds(frontierOutgoing.get(nodeId) ?? [])
        for (const childId of childIds) {
          addUniqueEdge(childIdsByParent, nodeId, childId)
        }
      }
    }

    const discoveredIds = [...depthById.keys()]
    const targetIds = includeRoot ? discoveredIds : discoveredIds.filter((id) => id !== rootNodeId)
    const nodesMap = await this.loadNodesMap(targetIds)
    nodesMap.set(rootNodeId, rootNode)

    const entries: HierarchyEntryDto[] = []
    let maxDepthReached = 0
    let leafCount = 0

    for (const id of targetIds) {
      const entity = nodesMap.get(id)
      if (!entity) continue
      const depth = depthById.get(id) ?? 0
      if (depth > maxDepthReached) maxDepthReached = depth
      const childIds = childIdsByParent.get(id) ?? []
      const isLeaf = childIds.length === 0
      if (isLeaf) leafCount += 1
      entries.push({
        node: nodeFromEntity(entity),
        parentId: parentById.get(id) ?? null,
        depth,
        pathIds: pathById.get(id) ?? [rootNodeId],
        childIds,
        childCount: childIds.length,
        isLeaf,
      })
    }

    const hasCycle = detectCycleInSubgraph(discoveredIds, subgraphOutgoing)

    return {
      rootNode: rootDto,
      entries,
      edges: [...collectedEdges.values()],
      maxDepthReached,
      leafCount,
      hasCycle,
    }
  }

  private async collectUpwardDistanceMap(
    startNodeId: string,
    relationTypeIds: readonly string[],
    maxDepth: number,
  ): Promise<{ dist: Map<string, number>; nextHop: Map<string, string> }> {
    const dist = new Map<string, number>([[startNodeId, 0]])
    // Maps ancestor -> child along shortest path back toward startNodeId
    const childTowardStart = new Map<string, string>()
    let frontier = [startNodeId]
    let currentDepth = 0

    while (frontier.length > 0 && currentDepth < maxDepth) {
      const incomingAdj = await this.loadAdjacent(frontier, 'INCOMING', relationTypeIds)
      const nextFrontier: string[] = []
      const nextDepth = currentDepth + 1

      for (const nodeId of frontier) {
        for (const rel of incomingAdj.get(nodeId) ?? []) {
          const parentId = rel.getSourceNodeId()
          if (!parentId || rel.getSourceExternalId() !== 'internal') continue
          if (!dist.has(parentId)) {
            dist.set(parentId, nextDepth)
            childTowardStart.set(parentId, nodeId)
            nextFrontier.push(parentId)
          }
        }
      }

      frontier = nextFrontier
      currentDepth = nextDepth
    }

    return { dist, nextHop: childTowardStart }
  }

  private async loadTableHierarchyGraph(tableId: string, relationTypeRef: string) {
    const resolvedRt = await this.resolveHierarchyType(relationTypeRef)
    const nodes: Node[] = []
    let offset = 0
    while (offset < MAX_SCAN_NODES) {
      const page = await this.nodeRepository.findByTableId(tableId, { limit: 1000, offset })
      const items = page.nodes ?? page.data ?? []
      if (items.length === 0) break
      nodes.push(...items)
      if (!page.hasNextPage && !page.hasMore) break
      offset += items.length
    }

    const nodeIdSet = new Set(nodes.map((node) => String(node.getId())))
    const nodeIds = [...nodeIdSet]
    const outgoing = new Map<string, string[]>(nodeIds.map((id) => [id, []]))
    const incoming = new Map<string, string[]>(nodeIds.map((id) => [id, []]))
    const edges: NodeRelation[] = []

    if (resolvedRt && resolvedRt.ids.length > 0 && nodes.length > 0) {
      const allowedRtIds = new Set(resolvedRt.ids)
      let relOffset = 0
      while (relOffset < MAX_SCAN_RELATIONS) {
        const relPage = await this.nodeRelationRepository.findByTableId(tableId, { limit: 1000, offset: relOffset })
        const rels = relPage.nodes ?? relPage.data ?? []
        if (rels.length === 0) break
        for (const rel of rels) {
          if (!allowedRtIds.has(rel.getRelationTypeId())) continue
          const src = rel.getSourceNodeId()
          const dst = rel.getTargetNodeId()
          if (
            !src ||
            !dst ||
            rel.getSourceExternalId() !== 'internal' ||
            rel.getTargetExternalId() !== 'internal'
          ) {
            continue
          }
          if (!nodeIdSet.has(src) || !nodeIdSet.has(dst)) continue
          edges.push(rel)
          addUniqueEdge(outgoing, src, dst)
          addUniqueEdge(incoming, dst, src)
        }
        if (!relPage.hasNextPage && !relPage.hasMore) break
        relOffset += rels.length
      }
    }

    return {
      relationTypeIdentifier: resolvedRt?.identifiers[0] ?? (relationTypeRef.trim() || DEFAULT_HIERARCHY_RELATION_TYPE),
      nodes,
      nodeIds,
      edges,
      outgoing,
      incoming,
    }
  }

  private async loadAdjacent(
    nodeIds: readonly string[],
    direction: 'OUTGOING' | 'INCOMING',
    relationTypeIds: readonly string[],
  ): Promise<ReadonlyMap<string, NodeRelation[]>> {
    if (nodeIds.length === 0 || relationTypeIds.length === 0) {
      return new Map()
    }

    if (this.nodeRelationRepository.findAdjacentByNodeIds) {
      return await this.nodeRelationRepository.findAdjacentByNodeIds(nodeIds, direction, relationTypeIds)
    }

    const result = new Map<string, NodeRelation[]>()
    const allowedRt = new Set(relationTypeIds)
    await Promise.all(
      nodeIds.map(async (id) => {
        const raw =
          direction === 'OUTGOING'
            ? await this.nodeRelationRepository.findBySourceNodeId(id)
            : await this.nodeRelationRepository.findByTargetNodeId(id)
        result.set(
          id,
          raw.filter((rel) => allowedRt.has(rel.getRelationTypeId())),
        )
      }),
    )
    return result
  }

  private async loadNodesMap(nodeIds: readonly string[]): Promise<Map<string, Node>> {
    const unique = [...new Set(nodeIds.filter(Boolean))]
    if (unique.length === 0) return new Map()
    const loaded = await this.nodeRepository.findByIds(unique as NodeId[])
    return new Map(loaded.map((node) => [String(node.getId()), node]))
  }
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.trunc(value)))
}

function addUniqueEdge(map: Map<string, string[]>, key: string, target: string): void {
  let list = map.get(key)
  if (!list) {
    list = []
    map.set(key, list)
  }
  if (!list.includes(target)) {
    list.push(target)
  }
}

function extractChildIds(relations: readonly NodeRelation[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const rel of relations) {
    const target = rel.getTargetNodeId()
    if (!target || rel.getTargetExternalId() !== 'internal' || seen.has(target)) continue
    seen.add(target)
    result.push(target)
  }
  return result
}

function buildRootToNodePath(nodeId: string, incomingParents: ReadonlyMap<string, string[]>): string[] {
  const chain = [nodeId]
  const visited = new Set([nodeId])
  let cursor = nodeId
  while (true) {
    const parents = incomingParents.get(cursor)
    const next = parents?.[0]
    if (!next || visited.has(next)) break
    visited.add(next)
    chain.push(next)
    cursor = next
  }
  return chain.reverse()
}

function reconstructUpwardPath(
  startNodeId: string,
  ancestorId: string,
  childTowardStart: ReadonlyMap<string, string>,
): string[] {
  if (startNodeId === ancestorId) return [startNodeId]
  const fromAncestorToStart: string[] = [ancestorId]
  const seen = new Set([ancestorId])
  let cursor = ancestorId
  while (cursor !== startNodeId) {
    const next = childTowardStart.get(cursor)
    if (!next || seen.has(next)) break
    seen.add(next)
    fromAncestorToStart.push(next)
    cursor = next
  }
  return fromAncestorToStart.reverse()
}

function detectCycleInSubgraph(nodeIds: readonly string[], outgoing: ReadonlyMap<string, string[]>): boolean {
  if (nodeIds.length === 0) return false
  const sccs = stronglyConnectedComponents(nodeIds, outgoing)
  for (const scc of sccs) {
    if (scc.nodeIds.length > 1) return true
    if (scc.nodeIds.length === 1) {
      const only = scc.nodeIds[0]
      if (only && (outgoing.get(only) ?? []).includes(only)) return true
    }
  }
  return false
}

function computeMaxHierarchyDepth(
  allNodeIds: readonly string[],
  rootIds: readonly string[],
  outgoing: ReadonlyMap<string, string[]>,
): number {
  const starts = rootIds.length > 0 ? rootIds : allNodeIds.filter((id) => (outgoing.get(id) ?? []).length > 0)
  let maxDepth = 0
  for (const start of starts.slice(0, 200)) {
    const dist = new Map<string, number>([[start, 0]])
    const queue = [start]
    let head = 0
    while (head < queue.length) {
      const curr = queue[head++]
      if (!curr) continue
      const d = dist.get(curr) ?? 0
      if (d > maxDepth) maxDepth = d
      for (const next of outgoing.get(curr) ?? []) {
        if (!dist.has(next)) {
          dist.set(next, d + 1)
          queue.push(next)
        }
      }
    }
  }
  return maxDepth
}

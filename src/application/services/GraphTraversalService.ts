import type { Node } from '@/domain/entities/Node.js'
import type { NodeRelation } from '@/domain/entities/NodeRelation.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type {
  GraphTraversalDirection as RepositoryGraphTraversalDirection,
  NodeRelationAdjacency,
} from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import {
  BidirectionalBreadthFirstSearch,
  BreadthFirstSearch,
  type GraphNeighbor,
} from '@/domain/services/graph/BreadthFirstSearch.js'

const GRAPH_NODE_BATCH_SIZE = 500
const GRAPH_ADJACENCY_BATCH_SIZE = 64

export const DEFAULT_MAX_TRAVERSAL_DEPTH = 32
export const DEFAULT_MAX_VISITED_NODES = 50_000

export type TraversalDirection = 'OUTGOING' | 'INCOMING' | 'BOTH'

export interface TraversalSafetyBounds {
  maxTraversalDepth?: number
  maxVisitedNodes?: number
}

export interface ShortestPathResult {
  nodes: Node[]
  relations: NodeRelation[]
  distance: number
}

export interface ConnectedNodeEntry {
  node: Node
  distance: number
}

export interface ConnectedNodesDetailedResult {
  nodes: ConnectedNodeEntry[]
  relations: NodeRelation[]
  metrics: GraphTraversalMetrics
}

export interface ResolvedRelationTypeRefs {
  ids: string[]
  identifiers: string[]
}

/**
 * Resolves mixed relation type IDs or string identifiers against the repository.
 * Returns `undefined` when no filter was requested; returns empty arrays if non-empty
 * filters matched no known relation types so callers short-circuit cleanly.
 */
export async function resolveRelationTypeRefs(
  relationTypeRepository: Pick<IRelationTypeRepository, 'findById' | 'findByIdentifier'>,
  refs?: readonly string[],
): Promise<ResolvedRelationTypeRefs | undefined> {
  if (!refs || refs.length === 0) return undefined

  const uniqueRefs = [...new Set(refs.map((ref) => ref.trim()).filter(Boolean))]
  if (uniqueRefs.length === 0) return { ids: [], identifiers: [] }

  const resolved = await Promise.all(
    uniqueRefs.map(async (ref) => {
      const byId = await relationTypeRepository.findById(ref)
      if (byId) return byId
      return await relationTypeRepository.findByIdentifier(ref)
    }),
  )

  const ids = new Set<string>()
  const identifiers = new Set<string>()
  for (const relationType of resolved) {
    if (!relationType) continue
    ids.add(relationType.getId())
    identifiers.add(relationType.getIdentifier())
  }

  return {
    ids: [...ids],
    identifiers: [...identifiers],
  }
}

export interface GraphTraversalMetrics {
  nodeBatchCount: number
  nodeIdsRequested: number
  nodeIdsLoaded: number
  adjacencyBatchCount: number
  bulkAdjacencyBatchCount: number
  perNodeAdjacencyCalls: number
  relationsLoaded: number
  maxFrontier: number
  elapsedMs: number
}

/** Repository loading policy for graph traversal; independent of GraphQL/HTTP. */
export class GraphTraversalService {
  private readonly maxTraversalDepth: number
  private readonly maxVisitedNodes: number

  constructor(
    private readonly nodeRepository: Pick<INodeRepository, 'findByIds' | 'findExistingIds'>,
    private readonly relationRepository: Pick<
      INodeRelationRepository,
      | 'findBySourceNodeId'
      | 'findByTargetNodeId'
      | 'findAdjacentByNodeIds'
      | 'findAdjacentEdgeTargetsByNodeIds'
    >,
    safetyBounds: TraversalSafetyBounds = {},
  ) {
    this.maxTraversalDepth = safetyBounds.maxTraversalDepth ?? DEFAULT_MAX_TRAVERSAL_DEPTH
    this.maxVisitedNodes = safetyBounds.maxVisitedNodes ?? DEFAULT_MAX_VISITED_NODES
  }

  /** Includes the source at depth zero; the transport decides whether to show it. */
  async connectedNodes(
    sourceId: string,
    maxDepth: number,
    direction: TraversalDirection,
    relationTypeIds?: readonly string[],
  ): Promise<Node[]> {
    return (await this.connectedNodesWithMetrics(sourceId, maxDepth, direction, relationTypeIds)).nodes
  }

  async connectedNodesWithMetrics(
    sourceId: string,
    maxDepth: number,
    direction: TraversalDirection,
    relationTypeIds?: readonly string[],
  ): Promise<{ nodes: Node[]; metrics: GraphTraversalMetrics }> {
    const startedAt = performance.now()
    const metrics: GraphTraversalMetrics = {
      nodeBatchCount: 0,
      nodeIdsRequested: 0,
      nodeIdsLoaded: 0,
      adjacencyBatchCount: 0,
      bulkAdjacencyBatchCount: 0,
      perNodeAdjacencyCalls: 0,
      relationsLoaded: 0,
      maxFrontier: 0,
      elapsedMs: 0,
    }
    if (maxDepth < 0) {
      metrics.elapsedMs = performance.now() - startedAt
      return { nodes: [], metrics }
    }

    const boundedDepth = Math.min(maxDepth, this.maxTraversalDepth)
    const search = new BreadthFirstSearch<NodeRelation>(sourceId)
    const relationTypes = relationTypeIds === undefined ? undefined : new Set(relationTypeIds)
    const result: Node[] = []

    while (search.frontier.length > 0) {
      metrics.maxFrontier = Math.max(metrics.maxFrontier, search.frontier.length)
      const nodes = await this.loadNodes(search.frontier, metrics)
      const nodesById = new Map(nodes.map((node) => [node.getId(), node]))
      const existingFrontier = search.frontier.filter((id) => nodesById.has(id))
      for (const id of existingFrontier) {
        const node = nodesById.get(id)
        if (node !== undefined) result.push(node)
      }
      if (
        search.depth >= boundedDepth ||
        existingFrontier.length === 0 ||
        search.visitedCount >= this.maxVisitedNodes
      ) {
        break
      }
      if (relationTypes !== undefined && relationTypes.size === 0) break

      search.advance(await this.loadAdjacency(existingFrontier, direction, relationTypes, metrics))
    }

    metrics.elapsedMs = performance.now() - startedAt
    return { nodes: result, metrics }
  }

  /**
   * Level-order BFS returning discovered nodes (excluding `sourceId`) with their exact
   * hop distances and deduplicated traversed relations. Explicit `maxDepth <= 0` returns empty.
   */
  async connectedNodesWithDetails(
    sourceId: string,
    maxDepth: number,
    direction: TraversalDirection,
    relationTypeIds?: readonly string[],
  ): Promise<ConnectedNodesDetailedResult> {
    const startedAt = performance.now()
    const metrics: GraphTraversalMetrics = {
      nodeBatchCount: 0,
      nodeIdsRequested: 0,
      nodeIdsLoaded: 0,
      adjacencyBatchCount: 0,
      bulkAdjacencyBatchCount: 0,
      perNodeAdjacencyCalls: 0,
      relationsLoaded: 0,
      maxFrontier: 0,
      elapsedMs: 0,
    }
    if (maxDepth <= 0) {
      metrics.elapsedMs = performance.now() - startedAt
      return { nodes: [], relations: [], metrics }
    }

    const boundedDepth = Math.min(maxDepth, this.maxTraversalDepth)
    const search = new BreadthFirstSearch<NodeRelation>(sourceId)
    const relationTypes = relationTypeIds === undefined ? undefined : new Set(relationTypeIds)
    const discoveredOrder: Array<{ id: string; distance: number }> = []
    const relationMap = new Map<string, NodeRelation>()
    const existingNodeIds = new Set<string>()

    while (search.frontier.length > 0) {
      metrics.maxFrontier = Math.max(metrics.maxFrontier, search.frontier.length)
      let existingFrontier: string[]
      if (typeof this.nodeRepository.findExistingIds === 'function') {
        const present = await this.nodeRepository.findExistingIds(search.frontier)
        existingFrontier = search.frontier.filter((id) => present.has(id))
      } else {
        const nodes = await this.loadNodes(search.frontier, metrics)
        const loadedIds = new Set(nodes.map((node) => node.getId()))
        existingFrontier = search.frontier.filter((id) => loadedIds.has(id))
      }

      for (const id of existingFrontier) {
        existingNodeIds.add(id)
        if (search.depth > 0) {
          discoveredOrder.push({ id, distance: search.depth })
        }
      }

      if (
        search.depth >= boundedDepth ||
        existingFrontier.length === 0 ||
        search.visitedCount >= this.maxVisitedNodes
      ) {
        break
      }
      if (relationTypes !== undefined && relationTypes.size === 0) break

      const adjacency = await this.loadAdjacency(existingFrontier, direction, relationTypes, metrics)
      for (const fromId of existingFrontier) {
        for (const neighbor of adjacency.get(fromId) ?? []) {
          const edge = neighbor.edge
          const edgeKey =
            edge.getId() || `${edge.getSourceNodeId() ?? ''}-${edge.getTargetNodeId() ?? ''}-${edge.getRelationTypeId()}`
          if (!relationMap.has(edgeKey)) {
            relationMap.set(edgeKey, edge)
          }
        }
      }
      search.advance(adjacency)
    }

    const loadedNodes =
      discoveredOrder.length > 0 ? await this.loadNodes(discoveredOrder.map((entry) => entry.id), metrics) : []
    const nodesById = new Map(loadedNodes.map((node) => [node.getId(), node]))

    const nodes: ConnectedNodeEntry[] = []
    for (const entry of discoveredOrder) {
      if (!existingNodeIds.has(entry.id)) continue
      const node = nodesById.get(entry.id)
      if (node !== undefined) {
        nodes.push({ node, distance: entry.distance })
      }
    }

    metrics.elapsedMs = performance.now() - startedAt
    return {
      nodes,
      relations: Array.from(relationMap.values()),
      metrics,
    }
  }

  /**
   * Computes minimum hop distances from one or more anchor nodes up to
   * `maxDepth` (0 for anchor nodes, 1..maxDepth for reachable neighbors).
   * Used by N-hop graph + FTS + vector hybrid search.
   */
  async connectedNodeDistances(
    anchorNodeIds: readonly string[],
    maxDepth: number,
    direction: TraversalDirection = 'BOTH',
    relationTypeIds?: readonly string[],
  ): Promise<Map<string, number>> {
    const distances = new Map<string, number>()
    if (maxDepth < 0 || anchorNodeIds.length === 0) return distances

    const uniqueAnchors = [...new Set(anchorNodeIds.filter(Boolean))]
    let frontier: string[]
    if (typeof this.nodeRepository.findExistingIds === 'function') {
      const existingAnchorIds = await this.nodeRepository.findExistingIds(uniqueAnchors)
      frontier = uniqueAnchors.filter((id) => existingAnchorIds.has(id))
    } else {
      const existingAnchors = await this.loadNodes(uniqueAnchors)
      frontier = existingAnchors.map((node) => node.getId())
    }
    for (const id of frontier) {
      distances.set(id, 0)
    }

    const boundedDepth = Math.min(maxDepth, this.maxTraversalDepth)
    const relationTypes = relationTypeIds === undefined ? undefined : new Set(relationTypeIds)
    if (boundedDepth === 0 || (relationTypes !== undefined && relationTypes.size === 0)) {
      return distances
    }

    const useEdgeTargetLoader =
      typeof this.relationRepository.findAdjacentEdgeTargetsByNodeIds === 'function'
    const relationTypeList = relationTypes ? [...relationTypes] : undefined

    for (let depth = 1; depth <= boundedDepth && frontier.length > 0; depth++) {
      if (distances.size >= this.maxVisitedNodes) break
      const candidateNextIds: string[] = []
      if (useEdgeTargetLoader && this.relationRepository.findAdjacentEdgeTargetsByNodeIds) {
        for (let index = 0; index < frontier.length; index += GRAPH_ADJACENCY_BATCH_SIZE) {
          const batch = frontier.slice(index, index + GRAPH_ADJACENCY_BATCH_SIZE)
          const loaded = await this.relationRepository.findAdjacentEdgeTargetsByNodeIds(
            batch,
            direction as RepositoryGraphTraversalDirection,
            relationTypeList,
          )
          for (const fromId of batch) {
            for (const targetId of loaded.get(fromId) ?? []) {
              if (!distances.has(targetId)) {
                distances.set(targetId, depth)
                candidateNextIds.push(targetId)
                if (distances.size >= this.maxVisitedNodes) break
              }
            }
            if (distances.size >= this.maxVisitedNodes) break
          }
          if (distances.size >= this.maxVisitedNodes) break
        }
      } else {
        const adjacency = await this.loadAdjacency(frontier, direction, relationTypes)
        for (const fromId of frontier) {
          for (const neighbor of adjacency.get(fromId) ?? []) {
            if (!distances.has(neighbor.nodeId)) {
              distances.set(neighbor.nodeId, depth)
              candidateNextIds.push(neighbor.nodeId)
              if (distances.size >= this.maxVisitedNodes) break
            }
          }
          if (distances.size >= this.maxVisitedNodes) break
        }
      }

      if (candidateNextIds.length === 0) break
      const validIds =
        typeof this.nodeRepository.findExistingIds === 'function'
          ? await this.nodeRepository.findExistingIds(candidateNextIds)
          : new Set((await this.loadNodes(candidateNextIds)).map((node) => node.getId()))
      for (const candidateId of candidateNextIds) {
        if (!validIds.has(candidateId)) {
          distances.delete(candidateId)
        }
      }
      frontier = candidateNextIds.filter((id) => validIds.has(id))
    }

    return distances
  }

  /**
   * One minimum-hop path via Bidirectional BFS; relation strength is not a cost.
   * Zero-hop source===target check runs before depth termination so negative
   * maxDepth on an identical source/target still materializes the 0-hop candidate.
   */
  async findShortestPath(
    sourceId: string,
    targetId: string,
    maxDepth: number,
    direction: TraversalDirection = 'BOTH',
    relationTypeIds?: readonly string[],
  ): Promise<ShortestPathResult | null> {
    if (sourceId === targetId) {
      const nodes = await this.loadNodes([sourceId])
      const nodesById = new Map(nodes.map((node) => [node.getId(), node]))
      const found = nodesById.get(sourceId)
      return {
        nodes: found ? [found] : [],
        relations: [],
        distance: 0,
      }
    }

    if (maxDepth <= 0) return null
    const relationTypes = relationTypeIds === undefined ? undefined : new Set(relationTypeIds)
    if (relationTypes !== undefined && relationTypes.size === 0) return null

    const boundedDepth = Math.min(maxDepth, this.maxTraversalDepth)
    const backwardDirection = reverseTraversalDirection(direction)
    const search = new BidirectionalBreadthFirstSearch<NodeRelation>(sourceId, targetId)

    while (!search.hasMeeting && search.totalDepth < boundedDepth) {
      if (search.visitedCount >= this.maxVisitedNodes) break
      const side = search.nextSide()
      if (side === null) break

      if (side === 'forward') {
        const adjacency = await this.loadAdjacency(search.forwardFrontier, direction, relationTypes)
        search.advanceForward(adjacency)
      } else {
        const reverseAdjacency = await this.loadAdjacency(
          search.backwardFrontier,
          backwardDirection,
          relationTypes,
        )
        search.advanceBackward(reverseAdjacency)
      }
    }

    const path = search.shortestPath()
    if (path === null || path.distance > boundedDepth) return null

    const nodes = await this.loadNodes(path.nodeIds)
    const nodesById = new Map(nodes.map((node) => [node.getId(), node]))
    return {
      nodes: path.nodeIds.flatMap((id) => {
        const node = nodesById.get(id)
        return node === undefined ? [] : [node]
      }),
      relations: path.edges,
      distance: path.distance,
    }
  }

  private async loadNodes(nodeIds: readonly string[], metrics?: GraphTraversalMetrics): Promise<Node[]> {
    const uniqueNodeIds = [...new Set(nodeIds)]
    const batches: string[][] = []
    for (let index = 0; index < uniqueNodeIds.length; index += GRAPH_NODE_BATCH_SIZE) {
      batches.push(uniqueNodeIds.slice(index, index + GRAPH_NODE_BATCH_SIZE))
    }
    if (metrics !== undefined) {
      metrics.nodeBatchCount += batches.length
      metrics.nodeIdsRequested += uniqueNodeIds.length
    }
    const loaded = (await Promise.all(batches.map((batch) => this.nodeRepository.findByIds(batch)))).flat()
    if (metrics !== undefined) metrics.nodeIdsLoaded += loaded.length
    return loaded
  }

  private async loadAdjacency(
    nodeIds: readonly string[],
    direction: TraversalDirection,
    relationTypes?: ReadonlySet<string>,
    metrics?: GraphTraversalMetrics,
  ): Promise<Map<string, GraphNeighbor<NodeRelation>[]>> {
    const uniqueNodeIds = [...new Set(nodeIds)]
    const adjacency = new Map(uniqueNodeIds.map((id) => [id, [] as GraphNeighbor<NodeRelation>[]]))
    if (relationTypes !== undefined && relationTypes.size === 0) {
      return adjacency
    }
    const relationTypeList = relationTypes ? [...relationTypes] : undefined

    for (let index = 0; index < uniqueNodeIds.length; index += GRAPH_ADJACENCY_BATCH_SIZE) {
      const batch = uniqueNodeIds.slice(index, index + GRAPH_ADJACENCY_BATCH_SIZE)
      if (metrics !== undefined) metrics.adjacencyBatchCount += 1

      const bulkLoader = this.relationRepository.findAdjacentByNodeIds
      if (bulkLoader !== undefined) {
        if (metrics !== undefined) metrics.bulkAdjacencyBatchCount += 1
        const loaded = await bulkLoader.call(
          this.relationRepository,
          batch,
          direction as RepositoryGraphTraversalDirection,
          relationTypeList,
        )
        if (metrics !== undefined) {
          metrics.relationsLoaded += [...loaded.values()].reduce(
            (count, relations) => count + relations.length,
            0,
          )
        }
        this.appendAdjacency(adjacency, batch, loaded, relationTypes)
        continue
      }

      const queries: Array<Promise<{ nodeId: string; relations: NodeRelation[] }>> = []
      for (const nodeId of batch) {
        if (direction === 'OUTGOING' || direction === 'BOTH') {
          queries.push(
            this.relationRepository
              .findBySourceNodeId(nodeId)
              .then((relations) => ({ nodeId, relations })),
          )
        }
        if (direction === 'INCOMING' || direction === 'BOTH') {
          queries.push(
            this.relationRepository
              .findByTargetNodeId(nodeId)
              .then((relations) => ({ nodeId, relations })),
          )
        }
      }
      if (metrics !== undefined) metrics.perNodeAdjacencyCalls += queries.length

      for (const loaded of await Promise.all(queries)) {
        if (metrics !== undefined) metrics.relationsLoaded += loaded.relations.length
        for (const relation of loaded.relations) {
          if (relationTypes !== undefined && !relationTypes.has(relation.getRelationTypeId())) continue
          const nodeId = relation.getRelatedNodeId(loaded.nodeId)
          if (nodeId !== null) adjacency.get(loaded.nodeId)?.push({ nodeId, edge: relation })
        }
      }
    }

    return adjacency
  }

  private appendAdjacency(
    adjacency: Map<string, GraphNeighbor<NodeRelation>[]>,
    nodeIds: readonly string[],
    loaded: NodeRelationAdjacency,
    relationTypes?: ReadonlySet<string>,
  ): void {
    for (const nodeId of nodeIds) {
      for (const relation of loaded.get(nodeId) ?? []) {
        if (relationTypes !== undefined && !relationTypes.has(relation.getRelationTypeId())) continue
        const relatedNodeId = relation.getRelatedNodeId(nodeId)
        if (relatedNodeId !== null) adjacency.get(nodeId)?.push({ nodeId: relatedNodeId, edge: relation })
      }
    }
  }
}

function reverseTraversalDirection(direction: TraversalDirection): TraversalDirection {
  if (direction === 'OUTGOING') return 'INCOMING'
  if (direction === 'INCOMING') return 'OUTGOING'
  return 'BOTH'
}

import type { Node } from '@/domain/entities/Node.js'
import type { NodeRelation } from '@/domain/entities/NodeRelation.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type {
  GraphTraversalDirection as RepositoryGraphTraversalDirection,
  NodeRelationAdjacency,
} from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import { BreadthFirstSearch, type GraphNeighbor } from '@/domain/services/graph/BreadthFirstSearch.js'

const GRAPH_NODE_BATCH_SIZE = 500
const GRAPH_ADJACENCY_BATCH_SIZE = 64

export type TraversalDirection = 'OUTGOING' | 'INCOMING' | 'BOTH'

export interface ShortestPathResult {
  nodes: Node[]
  relations: NodeRelation[]
  distance: number
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
  constructor(
    private readonly nodeRepository: Pick<INodeRepository, 'findByIds'>,
    private readonly relationRepository: Pick<
      INodeRelationRepository,
      'findBySourceNodeId' | 'findByTargetNodeId' | 'findAdjacentByNodeIds'
    >,
  ) {}

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
      if (search.depth >= maxDepth || existingFrontier.length === 0) break

      search.advance(await this.loadAdjacency(existingFrontier, direction, relationTypes, metrics))
    }

    metrics.elapsedMs = performance.now() - startedAt
    return { nodes: result, metrics }
  }

  /** One minimum-hop path, in both directions; relation strength is not a cost. */
  async findShortestPath(sourceId: string, targetId: string, maxDepth: number): Promise<ShortestPathResult | null> {
    const search = new BreadthFirstSearch<NodeRelation>(sourceId)

    while (search.frontier.length > 0) {
      const path = search.pathTo(targetId)
      if (path !== null) {
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
      if (search.depth >= maxDepth) break
      search.advance(await this.loadAdjacency(search.frontier, 'BOTH'))
    }

    return null
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

    for (let index = 0; index < uniqueNodeIds.length; index += GRAPH_ADJACENCY_BATCH_SIZE) {
      const batch = uniqueNodeIds.slice(index, index + GRAPH_ADJACENCY_BATCH_SIZE)
      if (metrics !== undefined) metrics.adjacencyBatchCount += 1

      const bulkLoader = this.relationRepository.findAdjacentByNodeIds
      if (bulkLoader !== undefined) {
        if (metrics !== undefined) metrics.bulkAdjacencyBatchCount += 1
        const loaded = await bulkLoader.call(this.relationRepository, batch, direction as RepositoryGraphTraversalDirection)
        if (metrics !== undefined) metrics.relationsLoaded += [...loaded.values()].reduce((count, relations) => count + relations.length, 0)
        this.appendAdjacency(adjacency, batch, loaded, relationTypes)
        continue
      }

      const queries: Array<Promise<{ nodeId: string; relations: NodeRelation[] }>> = []
      for (const nodeId of batch) {
        if (direction === 'OUTGOING' || direction === 'BOTH') {
          queries.push(this.relationRepository.findBySourceNodeId(nodeId).then((relations) => ({ nodeId, relations })))
        }
        if (direction === 'INCOMING' || direction === 'BOTH') {
          queries.push(this.relationRepository.findByTargetNodeId(nodeId).then((relations) => ({ nodeId, relations })))
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

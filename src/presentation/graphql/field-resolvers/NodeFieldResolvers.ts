import type { ILogger } from '@/application/ports/ILogger.js'
import type { GraphQLContext, NodeParent } from '@/core/types/GraphQLTypes.js'
import type { Node } from '@/domain/entities/Node.js'
import type { NodeRelation } from '@/domain/entities/NodeRelation.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

const GRAPH_NODE_BATCH_SIZE = 500
const GRAPH_ADJACENCY_BATCH_SIZE = 64

interface ConnectedNodeResult {
  node: Node
  depth: number
  path: string[]
}

interface ShortestPathQueueEntry {
  nodeId: string
  path: string[]
  relations: NodeRelation[]
  depth: number
}

type TraversalDirection = 'OUTGOING' | 'INCOMING' | 'BOTH'

interface TraversalFrontierEntry {
  nodeId: string
  depth: number
  path: string[]
}

interface ShortestPathResult {
  nodes: Node[]
  relations: NodeRelation[]
  distance: number
}

export class NodeFieldResolvers extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly nodeRepository: INodeRepository,
    private readonly tableRepository: ITableRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly nodeRelationRepository: INodeRelationRepository,
    private readonly relationTypeRepository: IRelationTypeRepository,
    logger: ILogger,
  ) {
    super()
    this.logger = logger
  }

  async table(parent: NodeParent, _args?: Record<string, never>, context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => await this.withRequestCache(context, 'tableById', parent.tableId, () => this.tableRepository.findById(parent.tableId)),
      'table',
      'Node',
      { nodeId: parent.id, tableId: parent.tableId },
    )
  }

  async attributes(parent: NodeParent, _args?: Record<string, never>, _context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => {
        return await this.nodeAttributeRepository.findByNodeId(parent.id)
      },
      'attributes',
      'Node',
      { nodeId: parent.id },
    )
  }

  async attributeCount(parent: NodeParent, _args?: Record<string, never>, _context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => {
        return await this.nodeAttributeRepository.countByNodeId(parent.id)
      },
      'attributeCount',
      'Node',
      { nodeId: parent.id },
    )
  }

  async outgoingRelations(parent: NodeParent, _args?: Record<string, never>, _context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => {
        return await this.nodeRelationRepository.findBySourceNodeId(parent.id)
      },
      'outgoingRelations',
      'Node',
      { nodeId: parent.id },
    )
  }

  async incomingRelations(parent: NodeParent, _args?: Record<string, never>, _context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => {
        return await this.nodeRelationRepository.findByTargetNodeId(parent.id)
      },
      'incomingRelations',
      'Node',
      { nodeId: parent.id },
    )
  }

  async relationCount(parent: NodeParent, _args?: Record<string, never>, _context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => {
        const outgoingCount = await this.nodeRelationRepository.countBySourceNodeId(parent.id)
        const incomingCount = await this.nodeRelationRepository.countByTargetNodeId(parent.id)
        return outgoingCount + incomingCount
      },
      'relationCount',
      'Node',
      { nodeId: parent.id },
    )
  }

  // 그래프 탐색용 Field Resolvers
  async connectedNodes(
    parent: NodeParent,
    args?: {
      depth?: number
      direction?: 'OUTGOING' | 'INCOMING' | 'BOTH'
      relationTypes?: string[]
    },
    context?: GraphQLContext,
  ) {
    this.logger.info('connectedNodes field resolver called', {
      parentId: parent.id,
      args,
    })

    try {
      const depth = args?.depth || 1
      const direction = args?.direction || 'BOTH'
      const relationTypes = args?.relationTypes
      const resolvedRelationTypes = relationTypes
        ? (
            await Promise.all(
              relationTypes.map((relationTypeIdentifier) =>
                this.withRequestCache(context, 'relationTypeByIdentifier', relationTypeIdentifier, () =>
                  this.relationTypeRepository.findByIdentifier(relationTypeIdentifier),
                ),
              ),
            )
          )
            .filter((relationType): relationType is NonNullable<typeof relationType> => relationType !== null)
            .map((relationType) => relationType.getId())
        : undefined

      const result = await this._traverseGraph(parent.id, depth, direction, resolvedRelationTypes)

      // Extract just the nodes from the result objects since GraphQL expects [TableNode!]!
      // Filter out the starting node itself and only return connected nodes
      const connectedNodes = result
        .filter((item) => item.node && item.node.getId() !== parent.id)
        .map((item) => item.node)
        .filter((node) => node !== null)

      this.logger.info('connectedNodes field resolver result', {
        parentId: parent.id,
        resultLength: result.length,
        connectedNodesLength: connectedNodes.length,
        connectedNodes: connectedNodes.map((n) => ({ id: n.getId(), content: n.getContent() })),
      })

      return connectedNodes
    } catch (error) {
      this.logger.error('Error in connectedNodes field resolver', {
        error,
        nodeId: parent.id,
        args,
      })
      // Always return empty array for GraphQL non-nullable field
      this.logger.info('Returning empty array due to error')
      return []
    }
  }

  async shortestPath(parent: NodeParent, args: { targetNodeId: string; maxDepth?: number }, _context?: GraphQLContext) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('targetNodeId', 'Target Node ID'),
        BaseResolver.validationRules.nonEmpty('targetNodeId', 'Target Node ID'),
      ],
      'shortestPath',
    )

    return this.handleFieldResolution(
      async () => {
        const { targetNodeId, maxDepth = 6 } = args
        const path = await this._findShortestPath(parent.id, targetNodeId, maxDepth)

        // Return just the nodes array since GraphQL expects [TableNode!]!
        return path ? path.nodes : []
      },
      'shortestPath',
      'Node',
      { sourceNodeId: parent.id, targetNodeId: args.targetNodeId },
    )
  }

  async neighborsByRelationType(
    parent: NodeParent,
    args: { relationTypes: string[]; direction?: 'OUTGOING' | 'INCOMING' | 'BOTH' },
    context?: GraphQLContext,
  ) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('relationTypes', 'Relation Types'),
        BaseResolver.validationRules.nonEmpty('relationTypes', 'Relation Types'),
      ],
      'neighborsByRelationType',
    )

    const direction = args.direction || 'BOTH'

    return this.handleFieldResolution(
      async () => {
        const neighborIds: string[] = []

        // For each relation type, find neighbors
        for (const relationTypeIdentifier of args.relationTypes) {
          // Get relation type by identifier
          const relationType = await this.withRequestCache(
            context,
            'relationTypeByIdentifier',
            relationTypeIdentifier,
            () => this.relationTypeRepository.findByIdentifier(relationTypeIdentifier),
          )
          if (!relationType) continue

          const relationTypeId = relationType.getId()

          // Get outgoing relations
          if (direction === 'OUTGOING' || direction === 'BOTH') {
            const outgoing = await this.nodeRelationRepository.findBySourceNodeIdAndRelationType(
              parent.id,
              relationTypeId,
            )
            neighborIds.push(...outgoing.map((rel) => rel.getTargetNodeId()).filter((id): id is string => id !== null))
          }

          // Get incoming relations
          if (direction === 'INCOMING' || direction === 'BOTH') {
            const incoming = await this.nodeRelationRepository.findByTargetNodeIdAndRelationType(
              parent.id,
              relationTypeId,
            )
            neighborIds.push(...incoming.map((rel) => rel.getSourceNodeId()).filter((id): id is string => id !== null))
          }
        }

        // Get unique neighbor IDs and fetch nodes
        const uniqueNeighborIds = [...new Set(neighborIds)]
        const neighbors = await Promise.all(
          uniqueNeighborIds.map((id) => this.withRequestCache(context, 'nodeById', id, () => this.nodeRepository.findById(id))),
        )

        return neighbors.filter((node) => node !== null)
      },
      'neighborsByRelationType',
      'Node',
      { nodeId: parent.id, relationTypes: args.relationTypes, direction },
    )
  }

  // 그래프 탐색 헬퍼 메서드들
  private async _traverseGraph(
    nodeId: string,
    maxDepth: number,
    direction: TraversalDirection,
    relationTypes: string[] | undefined,
  ): Promise<ConnectedNodeResult[]> {
    if (maxDepth < 0) return []

    const visited = new Set<string>([nodeId])
    const relationTypeSet = relationTypes === undefined ? undefined : new Set(relationTypes)
    const result: ConnectedNodeResult[] = []
    let frontier: TraversalFrontierEntry[] = [{ nodeId, depth: 0, path: [nodeId] }]

    while (frontier.length > 0) {
      const nodes = await this._loadNodesByIds(frontier.map((entry) => entry.nodeId))
      const nodesById = new Map(nodes.map((node) => [node.getId(), node]))
      const existingFrontier = frontier.filter((entry) => nodesById.has(entry.nodeId))

      for (const entry of existingFrontier) {
        const node = nodesById.get(entry.nodeId)
        if (node !== undefined) {
          result.push({ node, depth: entry.depth, path: entry.path })
        }
      }

      const currentDepth = frontier[0]?.depth ?? maxDepth
      if (currentDepth >= maxDepth || existingFrontier.length === 0) break

      const adjacency = await this._loadLevelAdjacency(
        existingFrontier.map((entry) => entry.nodeId),
        direction,
      )
      const nextFrontier: TraversalFrontierEntry[] = []

      for (const entry of existingFrontier) {
        for (const relation of adjacency.get(entry.nodeId) ?? []) {
          if (relationTypeSet !== undefined && !relationTypeSet.has(relation.getRelationTypeId())) continue
          const nextNodeId = relation.getRelatedNodeId(entry.nodeId)
          if (nextNodeId === null || visited.has(nextNodeId)) continue

          visited.add(nextNodeId)
          nextFrontier.push({
            nodeId: nextNodeId,
            depth: entry.depth + 1,
            path: [...entry.path, nextNodeId],
          })
        }
      }

      frontier = nextFrontier
    }

    return result
  }

  private async _findShortestPath(
    sourceId: string,
    targetId: string,
    maxDepth: number,
  ): Promise<ShortestPathResult | null> {
    let frontier: ShortestPathQueueEntry[] = [
      { nodeId: sourceId, path: [sourceId], relations: [], depth: 0 },
    ]
    const visited = new Set<string>([sourceId])

    while (frontier.length > 0) {
      const match = frontier.find((entry) => entry.nodeId === targetId)
      if (match !== undefined) {
        const nodes = await this._loadNodesByIds(match.path)
        const nodesById = new Map(nodes.map((node) => [node.getId(), node]))
        return {
          nodes: match.path.flatMap((id) => {
            const node = nodesById.get(id)
            return node === undefined ? [] : [node]
          }),
          relations: match.relations,
          distance: match.depth,
        }
      }

      const currentDepth = frontier[0]?.depth ?? maxDepth
      if (currentDepth >= maxDepth) break

      const adjacency = await this._loadLevelAdjacency(
        frontier.map((entry) => entry.nodeId),
        'BOTH',
      )
      const nextFrontier: ShortestPathQueueEntry[] = []

      for (const current of frontier) {
        for (const relation of adjacency.get(current.nodeId) ?? []) {
          const nextNodeId = relation.getRelatedNodeId(current.nodeId)
          if (nextNodeId !== null && !visited.has(nextNodeId) && !current.path.includes(nextNodeId)) {
            visited.add(nextNodeId)
            nextFrontier.push({
              nodeId: nextNodeId,
              path: [...current.path, nextNodeId],
              relations: [...current.relations, relation],
              depth: current.depth + 1,
            })
          }
        }
      }

      frontier = nextFrontier
    }

    return null // 경로 없음
  }

  private async _loadNodesByIds(nodeIds: readonly string[]): Promise<Node[]> {
    const uniqueNodeIds = [...new Set(nodeIds)]
    const batches: string[][] = []
    for (let index = 0; index < uniqueNodeIds.length; index += GRAPH_NODE_BATCH_SIZE) {
      batches.push(uniqueNodeIds.slice(index, index + GRAPH_NODE_BATCH_SIZE))
    }
    return (await Promise.all(batches.map((batch) => this.nodeRepository.findByIds(batch)))).flat()
  }

  private async _loadLevelAdjacency(
    nodeIds: readonly string[],
    direction: TraversalDirection,
  ): Promise<Map<string, NodeRelation[]>> {
    const uniqueNodeIds = [...new Set(nodeIds)]
    const adjacency = new Map(uniqueNodeIds.map((id) => [id, [] as NodeRelation[]]))

    for (let index = 0; index < uniqueNodeIds.length; index += GRAPH_ADJACENCY_BATCH_SIZE) {
      const nodeBatch = uniqueNodeIds.slice(index, index + GRAPH_ADJACENCY_BATCH_SIZE)
      const queries: Array<Promise<{ nodeId: string; relations: NodeRelation[] }>> = []

      for (const currentNodeId of nodeBatch) {
        if (direction === 'OUTGOING' || direction === 'BOTH') {
          queries.push(this.nodeRelationRepository.findBySourceNodeId(currentNodeId).then((relations) => ({
            nodeId: currentNodeId,
            relations,
          })))
        }
        if (direction === 'INCOMING' || direction === 'BOTH') {
          queries.push(this.nodeRelationRepository.findByTargetNodeId(currentNodeId).then((relations) => ({
            nodeId: currentNodeId,
            relations,
          })))
        }
      }

      for (const batch of await Promise.all(queries)) {
        adjacency.get(batch.nodeId)?.push(...batch.relations)
      }
    }

    return adjacency
  }
}

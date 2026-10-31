import type { ILogger } from '@/application/ports/ILogger.js'
import { GraphTraversalService } from '@/application/services/GraphTraversalService.js'
import type { NodeId, RelationTypeId } from '@/core/types/CommonTypes.js'
import type { GraphQLContext, NodeParent } from '@/core/types/GraphQLTypes.js'
import type { Node } from '@/domain/entities/Node.js'
import type { NodeAttribute } from '@/domain/entities/NodeAttribute.js'
import type { NodeRelation } from '@/domain/entities/NodeRelation.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

export class NodeFieldResolvers extends BaseResolver {
  protected logger: ILogger
  private readonly graphTraversal: GraphTraversalService

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
    this.graphTraversal = new GraphTraversalService(nodeRepository, nodeRelationRepository)
  }

  async table(parent: NodeParent, _args?: Record<string, never>, context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () =>
        await this.withRequestCache(context, 'tableById', parent.tableId, () =>
          this.tableRepository.findById(parent.tableId),
        ),
      'table',
      'Node',
      { nodeId: parent.id, tableId: parent.tableId },
    )
  }

  async attributes(parent: NodeParent, _args?: Record<string, never>, context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => await this.loadAttributesForNode(parent.id, context),
      'attributes',
      'Node',
      { nodeId: parent.id },
    )
  }

  async attributeCount(parent: NodeParent, _args?: Record<string, never>, context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => {
        if (typeof this.nodeAttributeRepository.findByNodeIds === 'function') {
          const attributes = await this.loadAttributesForNode(parent.id, context)
          return attributes.length
        }
        return await this.nodeAttributeRepository.countByNodeId(parent.id)
      },
      'attributeCount',
      'Node',
      { nodeId: parent.id },
    )
  }

  async outgoingRelations(parent: NodeParent, _args?: Record<string, never>, context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => await this.loadAdjacentRelationsForNode(parent.id, 'OUTGOING', context),
      'outgoingRelations',
      'Node',
      { nodeId: parent.id },
    )
  }

  async incomingRelations(parent: NodeParent, _args?: Record<string, never>, context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => await this.loadAdjacentRelationsForNode(parent.id, 'INCOMING', context),
      'incomingRelations',
      'Node',
      { nodeId: parent.id },
    )
  }

  async relationCount(parent: NodeParent, _args?: Record<string, never>, context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => {
        if (typeof this.nodeRelationRepository.findAdjacentByNodeIds === 'function') {
          const [outgoing, incoming] = await Promise.all([
            this.loadAdjacentRelationsForNode(parent.id, 'OUTGOING', context),
            this.loadAdjacentRelationsForNode(parent.id, 'INCOMING', context),
          ])
          return outgoing.length + incoming.length
        }
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
    this.logger.debug('connectedNodes field resolver called', {
      parentId: parent.id,
      args,
    })

    try {
      const depth = args?.depth ?? 1
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

      const traversal = await this.graphTraversal.connectedNodesWithMetrics(
        parent.id,
        depth,
        direction,
        resolvedRelationTypes,
      )
      const result = traversal.nodes

      // GraphQL exposes connected nodes without the starting node.
      const connectedNodes = result.filter((node) => node.getId() !== parent.id)

      this.logger.debug('connectedNodes field resolver result', {
        parentId: parent.id,
        resultLength: result.length,
        connectedNodesLength: connectedNodes.length,
        traversal: traversal.metrics,
      })

      return connectedNodes
    } catch (error) {
      this.logger.error('Error in connectedNodes field resolver', {
        error,
        nodeId: parent.id,
        args,
      })
      // Always return empty array for GraphQL non-nullable field
      this.logger.debug('Returning empty array due to error')
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
        const path = await this.graphTraversal.findShortestPath(parent.id, targetNodeId, maxDepth)

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
        const resolvedTypes = await Promise.all(
          args.relationTypes.map((relationTypeIdentifier) =>
            this.withRequestCache(
              context,
              'relationTypeByIdentifier',
              relationTypeIdentifier,
              () => this.relationTypeRepository.findByIdentifier(relationTypeIdentifier),
            ),
          ),
        )
        const relationTypeIds = resolvedTypes
          .filter((rt): rt is NonNullable<typeof rt> => rt !== null)
          .map((rt) => rt.getId() as RelationTypeId)
        if (relationTypeIds.length === 0) {
          return []
        }

        const neighborIds: string[] = []
        if (typeof this.nodeRelationRepository.findAdjacentByNodeIds === 'function') {
          const adjacency = await this.nodeRelationRepository.findAdjacentByNodeIds(
            [parent.id as NodeId],
            direction,
            relationTypeIds,
          )
          const matchingRelations = adjacency.get(parent.id as NodeId) ?? []
          for (const rel of matchingRelations) {
            if (
              (direction === 'OUTGOING' || direction === 'BOTH') &&
              String(rel.getSourceNodeId()) === String(parent.id)
            ) {
              const targetId = rel.getTargetNodeId()
              if (targetId !== null) neighborIds.push(String(targetId))
            }
            if (
              (direction === 'INCOMING' || direction === 'BOTH') &&
              String(rel.getTargetNodeId()) === String(parent.id)
            ) {
              const sourceId = rel.getSourceNodeId()
              if (sourceId !== null) neighborIds.push(String(sourceId))
            }
          }
        } else {
          for (const relationTypeId of relationTypeIds) {
            if (direction === 'OUTGOING' || direction === 'BOTH') {
              const outgoing = await this.nodeRelationRepository.findBySourceNodeIdAndRelationType(
                parent.id,
                relationTypeId,
              )
              neighborIds.push(
                ...outgoing
                  .map((rel) => rel.getTargetNodeId())
                  .filter((id): id is string => id !== null),
              )
            }
            if (direction === 'INCOMING' || direction === 'BOTH') {
              const incoming = await this.nodeRelationRepository.findByTargetNodeIdAndRelationType(
                parent.id,
                relationTypeId,
              )
              neighborIds.push(
                ...incoming
                  .map((rel) => rel.getSourceNodeId())
                  .filter((id): id is string => id !== null),
              )
            }
          }
        }

        const uniqueNeighborIds = [...new Set(neighborIds)]
        const neighbors = await Promise.all(
          uniqueNeighborIds.map((id) => this.loadNodeById(id, context)),
        )

        return neighbors.filter((node): node is Node => node !== null)
      },
      'neighborsByRelationType',
      'Node',
      { nodeId: parent.id, relationTypes: args.relationTypes, direction },
    )
  }

  private async loadAttributesForNode(
    nodeId: string,
    context?: GraphQLContext,
  ): Promise<NodeAttribute[]> {
    if (typeof this.nodeAttributeRepository.findByNodeIds !== 'function') {
      return this.nodeAttributeRepository.findByNodeId(nodeId)
    }

    return this.withRequestBatchLoader<NodeAttribute[]>(
      context,
      'nodeAttributesByNodeId',
      String(nodeId),
      async (keys) => {
        const grouped = new Map<string, NodeAttribute[]>(
          keys.map((key) => [key, []]),
        )
        const chunkSize = 500
        for (let index = 0; index < keys.length; index += chunkSize) {
          const chunk = keys.slice(index, index + chunkSize) as NodeId[]
          const rows = await this.nodeAttributeRepository.findByNodeIds(chunk)
          for (const row of rows) {
            const ownerId = String(row.getNodeId())
            const bucket = grouped.get(ownerId)
            if (bucket) {
              bucket.push(row)
            } else {
              grouped.set(ownerId, [row])
            }
          }
        }
        return grouped
      },
      [],
    )
  }

  private async loadAdjacentRelationsForNode(
    nodeId: string,
    direction: 'OUTGOING' | 'INCOMING',
    context?: GraphQLContext,
  ): Promise<NodeRelation[]> {
    if (typeof this.nodeRelationRepository.findAdjacentByNodeIds !== 'function') {
      return direction === 'OUTGOING'
        ? this.nodeRelationRepository.findBySourceNodeId(nodeId)
        : this.nodeRelationRepository.findByTargetNodeId(nodeId)
    }

    const bulkLoader = this.nodeRelationRepository.findAdjacentByNodeIds.bind(
      this.nodeRelationRepository,
    )
    const namespace =
      direction === 'OUTGOING'
        ? 'outgoingRelationsByNodeId'
        : 'incomingRelationsByNodeId'

    return this.withRequestBatchLoader<NodeRelation[]>(
      context,
      namespace,
      String(nodeId),
      async (keys) => {
        const grouped = new Map<string, NodeRelation[]>(
          keys.map((key) => [key, []]),
        )
        const chunkSize = 400
        for (let index = 0; index < keys.length; index += chunkSize) {
          const chunk = keys.slice(index, index + chunkSize) as NodeId[]
          const adjacency = await bulkLoader(chunk, direction)
          for (const [adjNodeId, relations] of adjacency) {
            grouped.set(String(adjNodeId), relations)
          }
        }
        return grouped
      },
      [],
    )
  }

  private async loadNodeById(
    nodeId: string,
    context?: GraphQLContext,
  ): Promise<Node | null> {
    if (typeof this.nodeRepository.findByIds !== 'function') {
      return this.withRequestCache(context, 'nodeById', nodeId, () =>
        this.nodeRepository.findById(nodeId),
      )
    }

    const findByIds = this.nodeRepository.findByIds.bind(this.nodeRepository)
    return this.withRequestBatchLoader<Node | null>(
      context,
      'nodeByIdBatch',
      String(nodeId),
      async (keys) => {
        const byId = new Map<string, Node | null>(
          keys.map((key) => [key, null]),
        )
        const chunkSize = 500
        for (let index = 0; index < keys.length; index += chunkSize) {
          const chunk = keys.slice(index, index + chunkSize) as NodeId[]
          const nodes = await findByIds(chunk)
          for (const node of nodes) {
            byId.set(String(node.getId()), node)
          }
        }
        return byId
      },
      null,
    )
  }
}

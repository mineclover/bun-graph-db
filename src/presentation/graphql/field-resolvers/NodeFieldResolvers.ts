import { GraphTraversalService } from '@/application/services/GraphTraversalService.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { GraphQLContext, NodeParent } from '@/core/types/GraphQLTypes.js'
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

      const traversal = await this.graphTraversal.connectedNodesWithMetrics(parent.id, depth, direction, resolvedRelationTypes)
      const result = traversal.nodes

      // GraphQL exposes connected nodes without the starting node.
      const connectedNodes = result.filter((node) => node.getId() !== parent.id)

      this.logger.info('connectedNodes field resolver result', {
        parentId: parent.id,
        resultLength: result.length,
        connectedNodesLength: connectedNodes.length,
        traversal: traversal.metrics,
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

}

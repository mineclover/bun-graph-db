import type { ILogger } from '@/application/ports/ILogger.js'
import type { SearchRelatedNodesUseCase } from '@/application/use-cases/relations/SearchRelatedNodes.js'
import type {
  GraphQLContext,
  GraphQLParent,
  NodeRelationArgs,
  NodeRelationsArgs,
  RelationTypeArgs,
  SearchRelatedNodesArgs,
} from '@/core/types/GraphQLTypes.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { NodeRelation } from '@/domain/entities/NodeRelation.js'
import { RelationDepth, RelationDirection } from '@/domain/value-objects/RelationQuery.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

export class RelationQueries extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly nodeRelationRepository: INodeRelationRepository,
    private readonly relationTypeRepository: IRelationTypeRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly searchRelatedNodesUseCase: SearchRelatedNodesUseCase | null,
    logger: ILogger,
  ) {
    super()
    this.logger = logger
  }

  async relationType(_: GraphQLParent, args: RelationTypeArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('id', 'Relation Type ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Relation Type ID'),
      ],
      'relationType',
    )

    return this.handleQuery(
      async () => {
        return await this.relationTypeRepository.findById(args.id)
      },
      'findRelationTypeById',
      { id: args.id },
    )
  }

  async relationTypes(_: GraphQLParent, _args?: Record<string, never>, _context?: GraphQLContext) {
    return this.handleQuery(async () => {
      const result = await this.relationTypeRepository.findAll({ limit: 100, offset: 0 })
      return result.nodes || []
    }, 'findAllRelationTypes')
  }

  async nodeRelation(_: GraphQLParent, args: NodeRelationArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('id', 'Node Relation ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Node Relation ID'),
      ],
      'nodeRelation',
    )

    return this.handleQuery(
      async () => {
        return await this.nodeRelationRepository.findById(args.id)
      },
      'findNodeRelationById',
      { id: args.id },
    )
  }

  async nodeRelations(_: GraphQLParent, args: NodeRelationsArgs, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        // Note: The repository only accepts PaginationOptions, filter/sort are not supported here
        // Repository-level filtering may be implemented for performance optimization in future
        const result = await this.nodeRelationRepository.findAll(args.pagination || { limit: 10, offset: 0 })

        return {
          nodes: result.nodes,
          totalCount: result.totalCount,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
        }
      },
      'findAllNodeRelations',
      { args },
    )
  }

  async searchRelatedNodes(_: GraphQLParent, args: SearchRelatedNodesArgs, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        // Temporary fallback when SearchRelatedNodesUseCase is not available
        // Full search functionality disabled pending resolution of circular dependency
        if (!this.searchRelatedNodesUseCase) {
          this.logger.warn('SearchRelatedNodesUseCase not available, using basic relation listing')
          const result = await this.nodeRelationRepository.findAll(args.pagination || { limit: 10, offset: 0 })

          return {
            nodes: [],
            relations: result.nodes,
            totalCount: result.totalCount,
            hasNextPage: result.hasNextPage,
            hasPreviousPage: result.hasPreviousPage,
          }
        }

        // Transform GraphQL args to use case input format
        // Note: Type mismatch between GraphQL args and use case - using any to bypass
        const filter = args.filter as
          | {
              sourceNodeId?: string
              relationTypeId?: string
              direction?: 'incoming' | 'outgoing' | 'both'
            }
          | undefined

        const sourceNodeId = filter?.sourceNodeId || ''
        const sourceNode = sourceNodeId ? await this.nodeRepository.findById(sourceNodeId) : null
        const tableId = sourceNode?.getTableId() || ''

        if (!tableId) {
          return {
            nodes: [],
            relations: [],
            totalCount: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          }
        }

        const result = await this.searchRelatedNodesUseCase.execute({
          tableId,
          sourceNodeIds: [sourceNodeId], // Convert singular to array
          relationFilters: filter?.relationTypeId
            ? [
                {
                  relationTypes: [filter.relationTypeId],
                  direction:
                    filter.direction === 'incoming'
                      ? RelationDirection.INCOMING
                      : filter.direction === 'outgoing'
                        ? RelationDirection.OUTGOING
                        : RelationDirection.BOTH,
                  depth: RelationDepth.DIRECT,
                },
              ]
            : undefined,
          limit: args.pagination?.limit,
          offset: args.pagination?.offset,
        })

        return {
          nodes: result.nodes,
          relations: result.relations,
          totalCount: result.totalCount,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
        }
      },
      'searchRelatedNodes',
      { args },
    )
  }

  async getConnectedNodes(
    _: GraphQLParent,
    args: {
      input?: { nodeId: string; depth?: number; direction?: string; relationTypeIds?: string[] }
      nodeId?: string
      depth?: number
      direction?: string
      relationTypeIds?: string[]
    },
    _context?: GraphQLContext,
  ) {
    const normalized = {
      nodeId: args.input?.nodeId || args.nodeId || '',
      depth: args.input?.depth ?? args.depth ?? 1,
      direction: (args.input?.direction || args.direction || 'BOTH').toUpperCase(),
      relationTypeIds: args.input?.relationTypeIds || args.relationTypeIds || [],
    }

    this.validateArgs(
      normalized as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('nodeId', 'Node ID'),
        BaseResolver.validationRules.nonEmpty('nodeId', 'Node ID'),
      ],
      'getConnectedNodes',
    )

    return this.handleQuery(
      async () => {
        const maxDepth = Math.max(1, normalized.depth || 1)
        const visited = new Set<string>([normalized.nodeId])
        const discoveredNodeIds = new Set<string>()
        const distanceByNodeId = new Map<string, number>()
        const relationMap = new Map<string, NodeRelation>()
        const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: normalized.nodeId, depth: 0 }]

        while (queue.length > 0) {
          const current = queue.shift()
          if (!current) {
            continue
          }
          if (current.depth >= maxDepth) {
            continue
          }

          const relations: NodeRelation[] = []

          if (normalized.direction === 'OUTGOING' || normalized.direction === 'BOTH') {
            relations.push(...(await this.nodeRelationRepository.findBySourceNodeId(current.nodeId)))
          }
          if (normalized.direction === 'INCOMING' || normalized.direction === 'BOTH') {
            relations.push(...(await this.nodeRelationRepository.findByTargetNodeId(current.nodeId)))
          }

          for (const relation of relations) {
            if (
              normalized.relationTypeIds.length > 0 &&
              !normalized.relationTypeIds.includes(relation.getRelationTypeId())
            ) {
              continue
            }

            const relationId =
              relation.getId?.() || `${relation.getSourceNodeId()}-${relation.getTargetNodeId()}-${relation.getRelationTypeId()}`
            relationMap.set(relationId, relation)

            const neighborId =
              relation.getSourceNodeId() === current.nodeId ? relation.getTargetNodeId() : relation.getSourceNodeId()

            if (!neighborId || neighborId === normalized.nodeId) {
              continue
            }

            discoveredNodeIds.add(neighborId)
            const nextDepth = current.depth + 1
            const existingDistance = distanceByNodeId.get(neighborId)
            if (existingDistance === undefined || nextDepth < existingDistance) {
              distanceByNodeId.set(neighborId, nextDepth)
            }

            if (!visited.has(neighborId)) {
              visited.add(neighborId)
              queue.push({ nodeId: neighborId, depth: nextDepth })
            }
          }
        }

        const rawNodes = (
          await Promise.all(Array.from(discoveredNodeIds).map((nodeId) => this.nodeRepository.findById(nodeId)))
        ).filter((node): node is NonNullable<typeof node> => node !== null)

        const nodes = rawNodes.map((node) => ({
          id: node.getId(),
          tableId: node.getTableId(),
          content: node.getContent(),
          title: node.getTitle(),
          description: node.getDescription(),
          metadata: node.getParsedMetadata(),
          createdAt: node.getCreatedAt().toISOString(),
          updatedAt: node.getUpdatedAt().toISOString(),
          distance: distanceByNodeId.get(node.getId()) ?? 1,
        }))

        return {
          nodes,
          relations: Array.from(relationMap.values()),
          totalCount: nodes.length,
          totalConnections: nodes.length,
          hasNextPage: false,
          hasPreviousPage: false,
        }
      },
      'getConnectedNodes',
      normalized,
    )
  }

  async getDependencyChain(
    _: GraphQLParent,
    args: {
      input: { nodeId: string; direction?: string; maxDepth?: number; relationTypeIds?: string[] }
    },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args.input as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('nodeId', 'Node ID'),
        BaseResolver.validationRules.nonEmpty('nodeId', 'Node ID'),
      ],
      'getDependencyChain',
    )

    return this.handleQuery(
      async () => {
        const maxDepth = args.input.maxDepth || 5
        const direction = args.input.direction || 'OUTGOING'

        // Implementation for dependency chain analysis
        const visitedNodes = new Set<string>()
        const dependencyNodes: Array<{ id: string }> = []

        const exploreDependencies = async (currentNodeId: string, currentDepth: number) => {
          if (currentDepth >= maxDepth || visitedNodes.has(currentNodeId)) {
            return
          }

          visitedNodes.add(currentNodeId)

          // Find relations based on direction
          const relations =
            direction === 'OUTGOING'
              ? await this.nodeRelationRepository.findBySourceNodeId(currentNodeId)
              : await this.nodeRelationRepository.findByTargetNodeId(currentNodeId)

          for (const relation of relations) {
            // Filter by relation types if specified
            if (
              args.input.relationTypeIds?.length &&
              !args.input.relationTypeIds.includes(relation.getRelationTypeId())
            ) {
              continue
            }

            const nextNodeId = direction === 'OUTGOING' ? relation.getTargetNodeId() : relation.getSourceNodeId()

            if (nextNodeId && !visitedNodes.has(nextNodeId)) {
              dependencyNodes.push({ id: nextNodeId })
              await exploreDependencies(nextNodeId, currentDepth + 1)
            }
          }
        }

        await exploreDependencies(args.input.nodeId, 0)

        return {
          nodes: dependencyNodes,
          totalCount: dependencyNodes.length,
        }
      },
      'getDependencyChain',
      { input: args.input },
    )
  }

  async findPathsBetweenNodes(
    _: GraphQLParent,
    args: {
      input: {
        sourceNodeId: string
        targetNodeId: string
        maxDepth?: number
        relationTypeIds?: string[]
      }
    },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args.input as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('sourceNodeId', 'Source Node ID'),
        BaseResolver.validationRules.required('targetNodeId', 'Target Node ID'),
        BaseResolver.validationRules.nonEmpty('sourceNodeId', 'Source Node ID'),
        BaseResolver.validationRules.nonEmpty('targetNodeId', 'Target Node ID'),
      ],
      'findPathsBetweenNodes',
    )

    return this.handleQuery(
      async () => {
        const maxDepth = args.input.maxDepth || 3
        const sourceNodeId = args.input.sourceNodeId
        const targetNodeId = args.input.targetNodeId

        // BFS algorithm to find all paths between two nodes
        const paths: Array<{
          nodes: Array<{ id: string }>
          relations: Array<{ id: string }>
          length: number
          totalWeight?: number
        }> = []

        interface PathState {
          currentNodeId: string
          visitedNodes: string[]
          usedRelations: string[]
          totalWeight: number
        }

        const queue: PathState[] = [
          {
            currentNodeId: sourceNodeId,
            visitedNodes: [sourceNodeId],
            usedRelations: [],
            totalWeight: 0,
          },
        ]

        while (queue.length > 0) {
          const state = queue.shift()
          if (!state) {
            continue
          }

          if (state.visitedNodes.length > maxDepth + 1) {
            continue
          }

          if (state.currentNodeId === targetNodeId && state.visitedNodes.length > 1) {
            // Found a path
            paths.push({
              nodes: state.visitedNodes.map((id) => ({ id })),
              relations: state.usedRelations.map((id) => ({ id })),
              length: state.visitedNodes.length - 1,
              totalWeight: state.totalWeight,
            })
            continue
          }

          // Find outgoing relations from current node
          const relations = await this.nodeRelationRepository.findBySourceNodeId(state.currentNodeId)

          for (const relation of relations) {
            const nextNodeId = relation.getTargetNodeId()

            // Skip if nextNodeId is null
            if (!nextNodeId) {
              continue
            }

            // Avoid cycles
            if (state.visitedNodes.includes(nextNodeId)) {
              continue
            }

            // Filter by relation types if specified
            if (
              args.input.relationTypeIds?.length &&
              !args.input.relationTypeIds.includes(relation.getRelationTypeId())
            ) {
              continue
            }

            queue.push({
              currentNodeId: nextNodeId,
              visitedNodes: [...state.visitedNodes, nextNodeId],
              usedRelations: [...state.usedRelations, relation.getId()],
              totalWeight: state.totalWeight + 1, // Simple weight calculation
            })
          }
        }

        // Sort paths by length (shortest first)
        return paths.sort((a, b) => a.length - b.length)
      },
      'findPathsBetweenNodes',
      { input: args.input },
    )
  }
}

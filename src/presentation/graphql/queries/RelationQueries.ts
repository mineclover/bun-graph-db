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
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

export class RelationQueries extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly nodeRelationRepository: INodeRelationRepository,
    private readonly relationTypeRepository: IRelationTypeRepository,
    private readonly searchRelatedNodesUseCase: SearchRelatedNodesUseCase | null,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  async relationType(_: GraphQLParent, args: RelationTypeArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as any,
      [
        BaseResolver.validationRules.required('id', 'Relation Type ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Relation Type ID'),
      ],
      'relationType'
    )

    return this.handleQuery(
      async () => {
        return await this.relationTypeRepository.findById(args.id)
      },
      'findRelationTypeById',
      { id: args.id }
    )
  }

  async relationTypes(_: GraphQLParent, _args?: any, _context?: GraphQLContext) {
    return this.handleQuery(async () => {
      const result = await this.relationTypeRepository.findAll({ limit: 100, offset: 0 })
      return result.items
    }, 'findAllRelationTypes')
  }

  async nodeRelation(_: GraphQLParent, args: NodeRelationArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as any,
      [
        BaseResolver.validationRules.required('id', 'Node Relation ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Node Relation ID'),
      ],
      'nodeRelation'
    )

    return this.handleQuery(
      async () => {
        return await this.nodeRelationRepository.findById(args.id)
      },
      'findNodeRelationById',
      { id: args.id }
    )
  }

  async nodeRelations(_: GraphQLParent, args: NodeRelationsArgs, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        // Note: The repository only accepts PaginationOptions, filter/sort are not supported here
        // TODO: Consider implementing filtering at the repository level if needed
        const result = await this.nodeRelationRepository.findAll(
          args.pagination || { limit: 10, offset: 0 }
        )

        return {
          nodes: result.items,
          totalCount: result.total,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
        }
      },
      'findAllNodeRelations',
      { args }
    )
  }

  async searchRelatedNodes(
    _: GraphQLParent,
    args: SearchRelatedNodesArgs,
    _context?: GraphQLContext
  ) {
    return this.handleQuery(
      async () => {
        // Temporary fallback when SearchRelatedNodesUseCase is not available
        // TODO: Restore proper search functionality after circular dependency is resolved
        if (!this.searchRelatedNodesUseCase) {
          this.logger.warn('SearchRelatedNodesUseCase not available, using basic relation listing')
          const result = await this.nodeRelationRepository.findAll(
            args.pagination || { limit: 10, offset: 0 }
          )

          return {
            nodes: [],
            relations: result.items,
            totalCount: result.total,
            hasNextPage: result.hasNextPage,
            hasPreviousPage: result.hasPreviousPage,
          }
        }

        // Transform GraphQL args to use case input format
        // Note: Type mismatch between GraphQL args and use case - using any to bypass
        const result = await this.searchRelatedNodesUseCase.execute({
          sourceNodeIds: [(args.filter as any)?.sourceNodeId || ''], // Convert singular to array
          relationTypeId: (args.filter as any)?.relationTypeId,
          direction: (args.filter as any)?.direction,
          limit: args.pagination?.limit,
          offset: args.pagination?.offset,
        } as any)

        return {
          nodes: result.nodes,
          relations: result.relations,
          totalCount: result.total,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
        }
      },
      'searchRelatedNodes',
      { args }
    )
  }

  async getDependencyChain(
    _: GraphQLParent,
    args: { input: { nodeId: string; direction?: string; maxDepth?: number; relationTypeIds?: string[] } },
    _context?: GraphQLContext
  ) {
    this.validateArgs(
      args.input as any,
      [
        BaseResolver.validationRules.required('nodeId', 'Node ID'),
        BaseResolver.validationRules.nonEmpty('nodeId', 'Node ID'),
      ],
      'getDependencyChain'
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
          const relations = direction === 'OUTGOING'
            ? await this.nodeRelationRepository.findBySourceNodeId(currentNodeId as any)
            : await this.nodeRelationRepository.findByTargetNodeId(currentNodeId as any)

          for (const relation of relations) {
            // Filter by relation types if specified
            if (args.input.relationTypeIds?.length &&
                !args.input.relationTypeIds.includes(relation.getRelationTypeId())) {
              continue
            }

            const nextNodeId = direction === 'OUTGOING'
              ? relation.getTargetNodeId()
              : relation.getSourceNodeId()

            if (!visitedNodes.has(nextNodeId)) {
              dependencyNodes.push({ id: nextNodeId })
              await exploreDependencies(nextNodeId, currentDepth + 1)
            }
          }
        }

        await exploreDependencies(args.input.nodeId, 0)

        return {
          nodes: dependencyNodes,
          totalCount: dependencyNodes.length
        }
      },
      'getDependencyChain',
      { input: args.input }
    )
  }

  async findPathsBetweenNodes(
    _: GraphQLParent,
    args: { input: { sourceNodeId: string; targetNodeId: string; maxDepth?: number; relationTypeIds?: string[] } },
    _context?: GraphQLContext
  ) {
    this.validateArgs(
      args.input as any,
      [
        BaseResolver.validationRules.required('sourceNodeId', 'Source Node ID'),
        BaseResolver.validationRules.required('targetNodeId', 'Target Node ID'),
        BaseResolver.validationRules.nonEmpty('sourceNodeId', 'Source Node ID'),
        BaseResolver.validationRules.nonEmpty('targetNodeId', 'Target Node ID'),
      ],
      'findPathsBetweenNodes'
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

        const queue: PathState[] = [{
          currentNodeId: sourceNodeId,
          visitedNodes: [sourceNodeId],
          usedRelations: [],
          totalWeight: 0
        }]

        while (queue.length > 0) {
          const state = queue.shift()!

          if (state.visitedNodes.length > maxDepth + 1) {
            continue
          }

          if (state.currentNodeId === targetNodeId && state.visitedNodes.length > 1) {
            // Found a path
            paths.push({
              nodes: state.visitedNodes.map(id => ({ id })),
              relations: state.usedRelations.map(id => ({ id })),
              length: state.visitedNodes.length - 1,
              totalWeight: state.totalWeight
            })
            continue
          }

          // Find outgoing relations from current node
          const relations = await this.nodeRelationRepository.findBySourceNodeId(
            state.currentNodeId as any
          )

          for (const relation of relations) {
            const nextNodeId = relation.getTargetNodeId()

            // Avoid cycles
            if (state.visitedNodes.includes(nextNodeId)) {
              continue
            }

            // Filter by relation types if specified
            if (args.input.relationTypeIds?.length &&
                !args.input.relationTypeIds.includes(relation.getRelationTypeId())) {
              continue
            }

            queue.push({
              currentNodeId: nextNodeId,
              visitedNodes: [...state.visitedNodes, nextNodeId],
              usedRelations: [...state.usedRelations, relation.getId()],
              totalWeight: state.totalWeight + 1 // Simple weight calculation
            })
          }
        }

        // Sort paths by length (shortest first)
        return paths.sort((a, b) => a.length - b.length)
      },
      'findPathsBetweenNodes',
      { input: args.input }
    )
  }
}

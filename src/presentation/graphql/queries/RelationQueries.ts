import type { ILogger } from '@/application/ports/ILogger.js'
import type { SearchRelatedNodesUseCase } from '@/application/use-cases/relations/SearchRelatedNodes.js'
import type {
  GetDependencyChainArgs,
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
    private readonly searchRelatedNodesUseCase: SearchRelatedNodesUseCase,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  async relationType(_: GraphQLParent, args: RelationTypeArgs, context?: GraphQLContext) {
    this.validateArgs(
      args,
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

  async relationTypes(_: GraphQLParent, args?: any, context?: GraphQLContext) {
    return this.handleQuery(async () => {
      const result = await this.relationTypeRepository.findAll({
        pagination: { limit: 100, offset: 0 },
      })
      return result.items
    }, 'findAllRelationTypes')
  }

  async nodeRelation(_: GraphQLParent, args: NodeRelationArgs, context?: GraphQLContext) {
    this.validateArgs(
      args,
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

  async nodeRelations(_: GraphQLParent, args: NodeRelationsArgs, context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        const result = await this.nodeRelationRepository.findAll({
          filter: args.filter,
          pagination: args.pagination || { limit: 10, offset: 0 },
          sort: args.sort,
        })

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
    context?: GraphQLContext
  ) {
    return this.handleQuery(
      async () => {
        const result = await this.searchRelatedNodesUseCase.execute({
          filter: args.filter,
          pagination: args.pagination || { limit: 10, offset: 0 },
        })

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
    args: GetDependencyChainArgs,
    context?: GraphQLContext
  ) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('nodeId', 'Node ID'),
        BaseResolver.validationRules.nonEmpty('nodeId', 'Node ID'),
      ],
      'getDependencyChain'
    )

    return this.handleQuery(
      async () => {
        // This would need to be implemented in a use case or repository method
        // For now, return empty result
        return {
          nodes: [],
          relations: [],
          totalCount: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        }
      },
      'getDependencyChain',
      { args }
    )
  }
}

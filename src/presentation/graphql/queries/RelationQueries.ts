import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { SearchRelatedNodesUseCase } from '@/application/use-cases/relations/SearchRelatedNodes.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { 
  GraphQLParent,
  NodeRelationArgs,
  NodeRelationsArgs,
  RelationTypeArgs,
  SearchRelatedNodesArgs,
  FindPathsBetweenNodesArgs,
  GetDependencyChainArgs
} from '@/presentation/graphql/types/GraphQLTypes.js'

export class RelationQueries {
  constructor(
    private readonly nodeRelationRepository: INodeRelationRepository,
    private readonly relationTypeRepository: IRelationTypeRepository,
    private readonly searchRelatedNodesUseCase: SearchRelatedNodesUseCase,
    private readonly logger: ILogger
  ) {}

  async relationType(_: GraphQLParent, args: RelationTypeArgs) {
    try {
      this.logger.info('Fetching relation type', { id: args.id })
      return await this.relationTypeRepository.findById(args.id)
    } catch (error) {
      this.logger.error('Error fetching relation type', { error, id: args.id })
      throw error
    }
  }

  async relationTypes(_: GraphQLParent) {
    try {
      this.logger.info('Fetching relation types')
      return await this.relationTypeRepository.findAll({ pagination: { limit: 100, offset: 0 } })
    } catch (error) {
      this.logger.error('Error fetching relation types', { error })
      throw error
    }
  }

  async nodeRelation(_: GraphQLParent, args: NodeRelationArgs) {
    try {
      this.logger.info('Fetching node relation', { id: args.id })
      return await this.nodeRelationRepository.findById(args.id)
    } catch (error) {
      this.logger.error('Error fetching node relation', { error, id: args.id })
      throw error
    }
  }

  async nodeRelations(_: GraphQLParent, args: NodeRelationsArgs) {
    try {
      this.logger.info('Fetching node relations', { args })
      
      const result = await this.nodeRelationRepository.findAll({
        filter: args.filter,
        pagination: args.pagination || { limit: 10, offset: 0 },
        sort: args.sort
      })

      return {
        nodes: result.items,
        totalCount: result.total,
        hasNextPage: result.hasNextPage,
        hasPreviousPage: result.hasPreviousPage
      }
    } catch (error) {
      this.logger.error('Error fetching node relations', { error, args })
      throw error
    }
  }

  async searchRelatedNodes(_: GraphQLParent, args: SearchRelatedNodesArgs) {
    try {
      this.logger.info('Searching related nodes', { args })
      
      const result = await this.searchRelatedNodesUseCase.execute({
        filter: args.filter,
        pagination: args.pagination || { limit: 10, offset: 0 }
      })

      return {
        nodes: result.nodes,
        relations: result.relations,
        totalCount: result.total,
        hasNextPage: result.hasNextPage,
        hasPreviousPage: result.hasPreviousPage
      }
    } catch (error) {
      this.logger.error('Error searching related nodes', { error, args })
      throw error
    }
  }

  async findPathsBetweenNodes(_: GraphQLParent, args: FindPathsBetweenNodesArgs) {
    try {
      this.logger.info('Finding paths between nodes', { args })
      
      // This would need to be implemented in a use case or repository method
      // For now, return empty array
      return []
    } catch (error) {
      this.logger.error('Error finding paths between nodes', { error, args })
      throw error
    }
  }

  async getDependencyChain(_: GraphQLParent, args: GetDependencyChainArgs) {
    try {
      this.logger.info('Getting dependency chain', { args })
      
      // This would need to be implemented in a use case or repository method
      // For now, return empty result
      return {
        nodes: [],
        relations: [],
        totalCount: 0,
        hasNextPage: false,
        hasPreviousPage: false
      }
    } catch (error) {
      this.logger.error('Error getting dependency chain', { error, args })
      throw error
    }
  }
}
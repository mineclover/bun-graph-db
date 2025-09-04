import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { 
  GraphQLParent,
  NodeArgs,
  NodeByContentArgs,
  NodesArgs,
  SearchNodesArgs
} from '@/core/types/GraphQLTypes.js'

export class NodeQueries {
  constructor(
    private readonly nodeRepository: INodeRepository,
    private readonly searchNodesUseCase: SearchNodesUseCase,
    private readonly logger: ILogger
  ) {}

  async node(_: GraphQLParent, args: NodeArgs) {
    try {
      this.logger.info('Fetching node', { id: args.id })
      return await this.nodeRepository.findById(args.id)
    } catch (error) {
      this.logger.error('Error fetching node', { error, id: args.id })
      throw error
    }
  }

  async nodeByContent(_: GraphQLParent, args: NodeByContentArgs) {
    try {
      this.logger.info('Fetching node by content', { content: args.content, tableId: args.tableId })
      return await this.nodeRepository.findByContent(args.content, args.tableId)
    } catch (error) {
      this.logger.error('Error fetching node by content', { error, content: args.content, tableId: args.tableId })
      throw error
    }
  }

  async nodes(_: GraphQLParent, args: NodesArgs) {
    try {
      this.logger.info('Fetching nodes', { args })
      
      const result = await this.nodeRepository.findAll({
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
      this.logger.error('Error fetching nodes', { error, args })
      throw error
    }
  }

  async searchNodes(_: GraphQLParent, args: SearchNodesArgs) {
    try {
      this.logger.info('Searching nodes', { args })
      
      const result = await this.searchNodesUseCase.execute({
        filter: args.filter,
        pagination: args.pagination || { limit: 10, offset: 0 },
        sort: args.sort
      })

      return {
        nodes: result.nodes,
        totalCount: result.total,
        hasNextPage: result.hasNextPage,
        hasPreviousPage: result.hasPreviousPage
      }
    } catch (error) {
      this.logger.error('Error searching nodes', { error, args })
      throw error
    }
  }
}
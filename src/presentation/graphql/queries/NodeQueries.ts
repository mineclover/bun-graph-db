import type { ILogger } from '@/application/ports/ILogger.js'
import type { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import type {
  GraphQLContext,
  GraphQLParent,
  NodeArgs,
  NodeByContentArgs,
  NodesArgs,
  SearchNodesArgs,
} from '@/core/types/GraphQLTypes.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

export class NodeQueries extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly nodeRepository: INodeRepository,
    private readonly searchNodesUseCase: SearchNodesUseCase,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  async node(_: GraphQLParent, args: NodeArgs, context?: GraphQLContext) {
    this.validateArgs(args, [
      BaseResolver.validationRules.required('id', 'Node ID'),
      BaseResolver.validationRules.nonEmpty('id', 'Node ID')
    ], 'node')

    return this.handleQuery(async () => {
      const node = await this.nodeRepository.findById(args.id)
      return node
    }, 'findNodeById', { id: args.id })
  }

  async nodeByContent(_: GraphQLParent, args: NodeByContentArgs, context?: GraphQLContext) {
    this.validateArgs(args, [
      BaseResolver.validationRules.required('content', 'Content'),
      BaseResolver.validationRules.required('tableId', 'Table ID'),
      BaseResolver.validationRules.nonEmpty('content', 'Content')
    ], 'nodeByContent')

    return this.handleQuery(async () => {
      return await this.nodeRepository.findByTableIdAndContent(args.tableId, args.content)
    }, 'findNodeByContent', { content: args.content, tableId: args.tableId })
  }

  async nodes(_: GraphQLParent, args: NodesArgs) {
    try {
      this.logger.info('Fetching nodes', { args })

      const result = await this.nodeRepository.findAll({
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
        sort: args.sort,
      })

      return {
        nodes: result.nodes,
        totalCount: result.total,
        hasNextPage: result.hasNextPage,
        hasPreviousPage: result.hasPreviousPage,
      }
    } catch (error) {
      this.logger.error('Error searching nodes', { error, args })
      throw error
    }
  }
}

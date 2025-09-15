import type { ILogger } from '@/application/ports/ILogger.js'
import type {
  GraphQLContext,
  GraphQLParent,
  TableArgs,
  TableByIdentifierArgs,
  TablesArgs,
} from '@/core/types/GraphQLTypes.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { BaseResolver } from '../base/BaseResolver.js'

export class TableQueries extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly tableRepository: ITableRepository,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  async table(_: GraphQLParent, args: TableArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as any,
      [
        BaseResolver.validationRules.required('id', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Table ID'),
      ],
      'table'
    )

    return this.handleQuery(
      async () => {
        return await this.tableRepository.findById(args.id)
      },
      'findTableById',
      { id: args.id }
    )
  }

  async tableByIdentifier(
    _: GraphQLParent,
    args: TableByIdentifierArgs,
    _context?: GraphQLContext
  ) {
    this.validateArgs(
      args as any,
      [
        BaseResolver.validationRules.required('identifier', 'Table identifier'),
        BaseResolver.validationRules.nonEmpty('identifier', 'Table identifier'),
      ],
      'tableByIdentifier'
    )

    return this.handleQuery(
      async () => {
        return await this.tableRepository.findByIdentifier(args.identifier)
      },
      'findTableByIdentifier',
      { identifier: args.identifier }
    )
  }

  async tables(_: GraphQLParent, args: TablesArgs, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        const result = await this.tableRepository.findAll(
          args.pagination || { limit: 10, offset: 0 }
        )

        return {
          nodes: result.data || [],
          totalCount: result.total || 0,
          hasNextPage: result.hasMore || false,
          hasPreviousPage: (args.pagination?.offset || 0) > 0,
        }
      },
      'findTables',
      { filter: args.filter, pagination: args.pagination, sort: args.sort }
    )
  }
}

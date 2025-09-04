import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { 
  GraphQLParent,
  TableArgs,
  TableByIdentifierArgs,
  TablesArgs
} from '@/core/types/GraphQLTypes.js'

export class TableQueries {
  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly createTableUseCase: CreateTableUseCase,
    private readonly logger: ILogger
  ) {}

  async table(_: GraphQLParent, args: TableArgs) {
    try {
      this.logger.info('Fetching table', { id: args.id })
      return await this.tableRepository.findById(args.id)
    } catch (error) {
      this.logger.error('Error fetching table', { error, id: args.id })
      throw error
    }
  }

  async tableByIdentifier(_: GraphQLParent, args: TableByIdentifierArgs) {
    try {
      this.logger.info('Fetching table by identifier', { identifier: args.identifier })
      return await this.tableRepository.findByIdentifier(args.identifier)
    } catch (error) {
      this.logger.error('Error fetching table by identifier', { error, identifier: args.identifier })
      throw error
    }
  }

  async tables(_: GraphQLParent, args: TablesArgs) {
    try {
      this.logger.info('Fetching tables', { args })
      
      const result = await this.tableRepository.findAll({
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
      this.logger.error('Error fetching tables', { error, args })
      throw error
    }
  }
}
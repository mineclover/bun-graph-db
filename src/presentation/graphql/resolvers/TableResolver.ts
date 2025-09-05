import { TableDto } from '@/application/dtos/TableDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import type { TableId } from '@/core/types/CommonTypes.js'
import type {
  CreateTableInput,
  GraphQLContext,
  TablesFilter,
  TablesPagination,
  UpdateTableInput,
} from '@/core/types/GraphQLTypes.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'

export class TableResolver extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly createTableUseCase: CreateTableUseCase,
    private readonly tableRepository: ITableRepository,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  // Query resolvers
  async table(args: { id: string }, context?: GraphQLContext): Promise<TableDto | null> {
    this.validateArgs(args, [
      BaseResolver.validationRules.required('id', 'Table ID'),
      BaseResolver.validationRules.nonEmpty('id', 'Table ID')
    ], 'table')

    return this.handleQuery(async () => {
      const table = await this.tableRepository.findById(args.id as TableId)
      return table ? TableDto.fromEntity(table) : null
    }, 'findTableById', { id: args.id })
  }

  async tableByIdentifier(args: { identifier: string }, context?: GraphQLContext): Promise<TableDto | null> {
    this.validateArgs(args, [
      BaseResolver.validationRules.required('identifier', 'Table Identifier'),
      BaseResolver.validationRules.nonEmpty('identifier', 'Table Identifier')
    ], 'tableByIdentifier')

    return this.handleQuery(async () => {
      const table = await this.tableRepository.findByIdentifier(args.identifier)
      return table ? TableDto.fromEntity(table) : null
    }, 'findTableByIdentifier', { identifier: args.identifier })
  }

  async tables(args: { filter?: TablesFilter; pagination?: TablesPagination }): Promise<{
    nodes: TableDto[]
    totalCount: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }> {
    try {
      const { pagination = { limit: 10, offset: 0 } } = args

      // TODO: Implement filtering in repository
      const result = await this.tableRepository.findAll({
        limit: pagination.limit,
        offset: pagination.offset,
      })

      return {
        nodes: result.data.map((table) => TableDto.fromEntity(table)),
        totalCount: result.total,
        hasNextPage: result.hasMore,
        hasPreviousPage: (pagination.offset || 0) > 0,
      }
    } catch (error) {
      this.logger.error('Failed to find tables', { args, error })
      throw error
    }
  }

  // Mutation resolvers
  async createTable(args: { input: CreateTableInput }, context?: GraphQLContext): Promise<{
    success: boolean
    data?: TableDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    this.validateArgs(args.input, [
      BaseResolver.validationRules.required('identifier', 'Table Identifier'),
      BaseResolver.validationRules.nonEmpty('identifier', 'Table Identifier')
    ], 'createTable')

    const result = await this.handleMutation(async () => {
      const useCaseResult = await this.createTableUseCase.execute(args.input)
      return useCaseResult.table
    }, 'createTable', { input: args.input })

    return {
      success: result.success,
      data: result.data,
      errors: result.errors
    }
  }

  async updateTable(args: { id: string; input: UpdateTableInput }): Promise<{
    table: TableDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    try {
      const table = await this.tableRepository.findById(args.id as TableId)
      if (!table) {
        throw new NotFoundException(`Table with id ${args.id} not found`)
      }

      // Update table entity
      if (args.input.description !== undefined) {
        table.updateDescription(args.input.description)
      }

      // Save updated table
      await this.tableRepository.save(table)

      return {
        table: TableDto.fromEntity(table),
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to update table', { id: args.id, input: args.input, error })

      if (error instanceof NotFoundException || error instanceof ValidationException) {
        return {
          table: null,
          errors: [
            {
              message: error.message,
              code: error.code,
            },
          ],
        }
      }

      return {
        table: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  async deleteTable(args: { id: string }): Promise<{
    success: boolean
    errors: Array<{ message: string; code: string }>
  }> {
    try {
      const table = await this.tableRepository.findById(args.id as TableId)
      if (!table) {
        throw new NotFoundException(`Table with id ${args.id} not found`)
      }

      // Check if table can be deleted (business rule)
      if (!table.canBeDeleted()) {
        throw new ValidationException('Cannot delete table with existing nodes')
      }

      await this.tableRepository.delete(args.id as TableId)

      return {
        success: true,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to delete table', { id: args.id, error })

      return {
        success: false,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: error instanceof NotFoundException ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  // Field resolvers
  async nodeCount(table: TableDto, context?: GraphQLContext): Promise<number> {
    return this.handleFieldResolution(async () => {
      // TODO: Implement node count query
      return 0
    }, 'nodeCount', 'Table', { tableId: table.id }) || 0
  }

  async attributeCount(table: TableDto, context?: GraphQLContext): Promise<number> {
    return this.handleFieldResolution(async () => {
      // TODO: Implement attribute count query  
      return 0
    }, 'attributeCount', 'Table', { tableId: table.id }) || 0
  }

  // TODO: Implement relationship resolvers (attributes, nodes)
}

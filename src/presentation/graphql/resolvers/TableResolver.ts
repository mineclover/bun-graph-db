import type { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { 
  CreateTableInput, 
  UpdateTableInput,
  TablesFilter,
  TablesPagination 
} from '@/core/types/GraphQLTypes.js'
import { ValidationException, NotFoundException } from '@/shared/exceptions/DomainException.js'
import { TableDto } from '@/application/dtos/TableDto.js'
import type { TableId } from '@/core/types/CommonTypes.js'

export class TableResolver {
  constructor(
    private readonly createTableUseCase: CreateTableUseCase,
    private readonly tableRepository: ITableRepository,
    private readonly logger: ILogger
  ) {}

  // Query resolvers
  async table(args: { id: string }): Promise<TableDto | null> {
    try {
      const table = await this.tableRepository.findById(args.id as TableId)
      return table ? TableDto.fromEntity(table) : null
    } catch (error) {
      this.logger.error('Failed to find table by id', { id: args.id, error })
      throw error
    }
  }

  async tableByIdentifier(args: { identifier: string }): Promise<TableDto | null> {
    try {
      const table = await this.tableRepository.findByIdentifier(args.identifier)
      return table ? TableDto.fromEntity(table) : null
    } catch (error) {
      this.logger.error('Failed to find table by identifier', { identifier: args.identifier, error })
      throw error
    }
  }

  async tables(args: { 
    filter?: TablesFilter
    pagination?: TablesPagination 
  }): Promise<{
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
        offset: pagination.offset
      })
      
      return {
        nodes: result.data.map(table => TableDto.fromEntity(table)),
        totalCount: result.total,
        hasNextPage: result.hasMore,
        hasPreviousPage: (pagination.offset || 0) > 0
      }
    } catch (error) {
      this.logger.error('Failed to find tables', { args, error })
      throw error
    }
  }

  // Mutation resolvers
  async createTable(args: { input: CreateTableInput }): Promise<{
    table: TableDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    try {
      const result = await this.createTableUseCase.execute(args.input)
      return {
        table: result.table,
        errors: []
      }
    } catch (error) {
      this.logger.error('Failed to create table', { input: args.input, error })
      
      if (error instanceof ValidationException) {
        return {
          table: null,
          errors: [{ 
            message: error.message, 
            code: error.code,
            field: 'identifier'
          }]
        }
      }
      
      return {
        table: null,
        errors: [{ 
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'INTERNAL_ERROR'
        }]
      }
    }
  }

  async updateTable(args: { 
    id: string
    input: UpdateTableInput 
  }): Promise<{
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
        errors: []
      }
    } catch (error) {
      this.logger.error('Failed to update table', { id: args.id, input: args.input, error })
      
      if (error instanceof NotFoundException || error instanceof ValidationException) {
        return {
          table: null,
          errors: [{ 
            message: error.message, 
            code: error.code 
          }]
        }
      }
      
      return {
        table: null,
        errors: [{ 
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'INTERNAL_ERROR'
        }]
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
        errors: []
      }
    } catch (error) {
      this.logger.error('Failed to delete table', { id: args.id, error })
      
      return {
        success: false,
        errors: [{ 
          message: error instanceof Error ? error.message : 'Unknown error',
          code: error instanceof NotFoundException ? 'NOT_FOUND' : 'INTERNAL_ERROR'
        }]
      }
    }
  }

  // Field resolvers
  async nodeCount(table: TableDto): Promise<number> {
    // TODO: Implement node count query
    return 0
  }

  async attributeCount(table: TableDto): Promise<number> {
    // TODO: Implement attribute count query  
    return 0
  }

  // TODO: Implement relationship resolvers (attributes, nodes)
}
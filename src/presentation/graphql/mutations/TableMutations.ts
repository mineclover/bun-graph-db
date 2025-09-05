import type { ILogger } from '@/application/ports/ILogger.js'
import type { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import type { DeleteTableUseCase } from '@/application/use-cases/tables/DeleteTable.js'
import type {
  CreateTableArgs,
  DeleteTableArgs,
  GraphQLParent,
  UpdateTableArgs,
} from '@/core/types/GraphQLTypes.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'

export class TableMutations {
  constructor(
    private readonly createTableUseCase: CreateTableUseCase,
    private readonly deleteTableUseCase: DeleteTableUseCase,
    private readonly tableRepository: ITableRepository,
    private readonly logger: ILogger
  ) {}

  async createTable(_: GraphQLParent, args: CreateTableArgs) {
    try {
      this.logger.info('Creating table', { input: args.input })

      const result = await this.createTableUseCase.execute({
        identifier: args.input.identifier,
        description: args.input.description,
      })

      return {
        success: !!result,
        table: result,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Error creating table', { error, input: args.input })
      return {
        success: false,
        table: null,
        errors: [{ message: error.message, code: 'CREATE_TABLE_ERROR' }],
      }
    }
  }

  async updateTable(_: GraphQLParent, args: UpdateTableArgs) {
    try {
      this.logger.info('Updating table', { id: args.id, input: args.input })

      const existingTable = await this.tableRepository.findById(args.id)
      if (!existingTable) {
        return {
          success: false,
          table: null,
          errors: [{ message: 'Table not found', code: 'TABLE_NOT_FOUND' }],
        }
      }

      const updatedTable = await this.tableRepository.update(args.id, {
        description: args.input.description,
      })

      return {
        success: !!updatedTable,
        table: updatedTable,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Error updating table', { error, id: args.id, input: args.input })
      return {
        success: false,
        table: null,
        errors: [{ message: error.message, code: 'UPDATE_TABLE_ERROR' }],
      }
    }
  }

  async deleteTable(_: GraphQLParent, args: DeleteTableArgs) {
    try {
      this.logger.info('Deleting table with safety checks', {
        id: args.id,
        force: args.force,
        cascadeDelete: args.cascadeDelete,
      })

      const dependencies = await this.deleteTableUseCase.execute({
        id: args.id,
        force: args.force,
        cascadeDelete: args.cascadeDelete,
      })

      this.logger.info('Table deletion completed successfully', {
        id: args.id,
        hadDependencies: dependencies.hasData,
        nodeCount: dependencies.nodeCount,
        attributeCount: dependencies.attributeCount,
        relationCount: dependencies.relationCount,
      })

      return {
        success: true,
        errors: [],
        deletedDependencies: {
          nodeCount: dependencies.nodeCount,
          attributeCount: dependencies.attributeCount,
          relationCount: dependencies.relationCount,
        },
      }
    } catch (error) {
      this.logger.error('Error deleting table', { error, id: args.id })

      // Enhanced error reporting for safety violations
      const errorCode = error.message.includes('Cannot delete table')
        ? 'TABLE_HAS_DEPENDENCIES'
        : error.message.includes('not found')
          ? 'TABLE_NOT_FOUND'
          : 'DELETE_TABLE_ERROR'

      return {
        success: false,
        errors: [{ message: error.message, code: errorCode }],
      }
    }
  }
}

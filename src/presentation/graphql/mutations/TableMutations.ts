import type { ILogger } from '@/application/ports/ILogger.js'
import type { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import type { DeleteTableUseCase } from '@/application/use-cases/tables/DeleteTable.js'
import type {
  CreateTableArgs,
  DeleteTableArgs,
  GraphQLContext,
  GraphQLParent,
  UpdateTableArgs,
} from '@/core/types/GraphQLTypes.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { BaseResolver } from '../base/BaseResolver.js'

export class TableMutations extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly createTableUseCase: CreateTableUseCase,
    private readonly deleteTableUseCase: DeleteTableUseCase,
    private readonly tableRepository: ITableRepository,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  async createTable(_: GraphQLParent, args: CreateTableArgs, context?: GraphQLContext) {
    this.validateArgs(args, [
      BaseResolver.validationRules.required('input', 'Create table input'),
      BaseResolver.validationRules.required('input.identifier', 'Table identifier'),
      BaseResolver.validationRules.nonEmpty('input.identifier', 'Table identifier')
    ], 'createTable')

    return this.handleMutation(async () => {
      const result = await this.createTableUseCase.execute({
        identifier: args.input.identifier,
        description: args.input.description,
      })

      return {
        success: !!result,
        data: result,
        errors: [],
      }
    }, 'createTable', { input: args.input })
  }

  async updateTable(_: GraphQLParent, args: UpdateTableArgs, context?: GraphQLContext) {
    this.validateArgs(args, [
      BaseResolver.validationRules.required('id', 'Table ID'),
      BaseResolver.validationRules.required('input', 'Update table input'),
      BaseResolver.validationRules.nonEmpty('id', 'Table ID')
    ], 'updateTable')

    return this.handleMutation(async () => {
      const existingTable = await this.tableRepository.findById(args.id)
      if (!existingTable) {
        return {
          success: false,
          data: null,
          errors: [{ message: 'Table not found', code: 'TABLE_NOT_FOUND' }],
        }
      }

      const updatedTable = await this.tableRepository.update(args.id, {
        description: args.input.description,
      })

      return {
        success: !!updatedTable,
        data: updatedTable,
        errors: [],
      }
    }, 'updateTable', { id: args.id, input: args.input })
  }

  async deleteTable(_: GraphQLParent, args: DeleteTableArgs, context?: GraphQLContext) {
    this.validateArgs(args, [
      BaseResolver.validationRules.required('id', 'Table ID'),
      BaseResolver.validationRules.nonEmpty('id', 'Table ID')
    ], 'deleteTable')

    return this.handleMutation(async () => {
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
    }, 'deleteTable', { id: args.id, force: args.force, cascadeDelete: args.cascadeDelete }, {
      successMessage: `Table deleted successfully with ${args.cascadeDelete ? 'cascade' : 'safety checks'}`,
      errorHandler: (error) => {
        const errorCode = error.message.includes('Cannot delete table')
          ? 'TABLE_HAS_DEPENDENCIES'
          : error.message.includes('not found')
            ? 'TABLE_NOT_FOUND'
            : 'DELETE_TABLE_ERROR'
        return { message: error.message, code: errorCode }
      }
    })
  }
}

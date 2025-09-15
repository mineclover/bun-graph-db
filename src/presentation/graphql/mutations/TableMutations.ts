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

  async createTable(_: GraphQLParent, args: CreateTableArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('input', 'Create table input'),
        BaseResolver.validationRules.required('input.identifier', 'Table identifier'),
        BaseResolver.validationRules.nonEmpty('input.identifier', 'Table identifier'),
      ],
      'createTable'
    )

    try {
      this.logger.info('Executing mutation: createTable', { input: args.input })

      const result = await this.createTableUseCase.execute({
        identifier: args.input.identifier,
        description: args.input.description,
      })

      this.logger.info('Mutation completed: createTable', { input: args.input })

      return {
        success: !!result,
        table: result.table,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: createTable', { error, input: args.input })

      const errorCode =
        (error as any).code ||
        ((error as Error).message?.includes('already exists')
          ? 'CREATE_TABLE_ERROR'
          : 'INTERNAL_ERROR')
      const errorMessage = (error as Error).message || 'Unknown error occurred'

      return {
        success: false,
        table: null,
        errors: [{ message: errorMessage, code: errorCode }],
      }
    }
  }

  async updateTable(_: GraphQLParent, args: UpdateTableArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Table ID'),
        BaseResolver.validationRules.required('input', 'Update table input'),
        BaseResolver.validationRules.nonEmpty('id', 'Table ID'),
      ],
      'updateTable'
    )

    try {
      this.logger.info('Executing mutation: updateTable', { id: args.id, input: args.input })

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

      this.logger.info('Mutation completed: updateTable', { id: args.id, input: args.input })

      return {
        success: !!updatedTable,
        table: updatedTable,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: updateTable', { error, id: args.id, input: args.input })

      return {
        success: false,
        table: null,
        errors: [this.mapToGraphQLError(error, 'updateTable')],
      }
    }
  }

  async deleteTable(_: GraphQLParent, args: DeleteTableArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Table ID'),
      ],
      'deleteTable'
    )

    try {
      this.logger.info('Executing mutation: deleteTable', {
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
      this.logger.error('Mutation failed: deleteTable', {
        error,
        id: args.id,
        force: args.force,
        cascadeDelete: args.cascadeDelete,
      })

      const errorMessage = (error as Error).message || 'Unknown error occurred'
      const errorCode = errorMessage.includes('Cannot delete table')
        ? 'TABLE_HAS_DEPENDENCIES'
        : errorMessage.includes('not found')
          ? 'TABLE_NOT_FOUND'
          : 'DELETE_TABLE_ERROR'

      return {
        success: false,
        errors: [{ message: errorMessage, code: errorCode }],
      }
    }
  }
}

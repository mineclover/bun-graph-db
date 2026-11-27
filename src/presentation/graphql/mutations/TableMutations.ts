import { TableSchemaLifecycleAspect } from '@/application/aspects/TableSchemaLifecycleAspect.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { TableDto } from '@/application/dtos/TableDto.js'
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
import type { BestEffortTabularSyncHook } from '@/application/services/BestEffortTabularSyncHook.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'
import { BaseResolver } from '../base/BaseResolver.js'

export class TableMutations extends BaseResolver {
  protected logger: ILogger
  private readonly lifecycle: TableSchemaLifecycleAspect

  constructor(
    private readonly createTableUseCase: CreateTableUseCase,
    private readonly deleteTableUseCase: DeleteTableUseCase,
    private readonly tableRepository: ITableRepository,
    logger: ILogger,
    private readonly tabularSyncHook?: BestEffortTabularSyncHook,
    schemaLifecycle?: TableSchemaLifecycleAspect,
  ) {
    super()
    this.logger = logger
    this.lifecycle =
      schemaLifecycle ??
      new TableSchemaLifecycleAspect({
        logger: this.logger,
        tabularSyncHook: this.tabularSyncHook,
      })
  }

  private getErrorCode(error: unknown, fallback: string): string {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
    ) {
      return error.code
    }

    return fallback
  }

  async createTable(
    _: GraphQLParent,
    args: CreateTableArgs,
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('input', 'Create table input'),
        BaseResolver.validationRules.required(
          'input.identifier',
          'Table identifier',
        ),
        BaseResolver.validationRules.nonEmpty(
          'input.identifier',
          'Table identifier',
        ),
      ],
      'createTable',
    )

    try {
      this.logger.info('Executing mutation: createTable', {
        input: args.input,
      })

      const result = await this.createTableUseCase.execute({
        identifier: args.input.identifier,
        description: args.input.description,
      })

      this.tabularSyncHook?.notifyByIdentifier(result.table.identifier)

      this.logger.info('Mutation completed: createTable', {
        input: args.input,
      })

      return {
        success: !!result,
        table: result.table,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: createTable', {
        input: args.input,
        ...toErrorMeta(error),
      })

      const errorCode = this.getErrorCode(
        error,
        (error as Error).message?.includes('already exists')
          ? 'CREATE_TABLE_ERROR'
          : 'INTERNAL_ERROR',
      )
      const errorMessage = (error as Error).message || 'Unknown error occurred'

      return {
        success: false,
        table: null,
        errors: [{ message: errorMessage, code: errorCode }],
      }
    }
  }

  async updateTable(
    _: GraphQLParent,
    args: UpdateTableArgs,
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('id', 'Table ID'),
        BaseResolver.validationRules.required('input', 'Update table input'),
        BaseResolver.validationRules.nonEmpty('id', 'Table ID'),
      ],
      'updateTable',
    )

    try {
      this.logger.info('Executing mutation: updateTable', {
        id: args.id,
        input: args.input,
      })

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

      this.tabularSyncHook?.notifyByIdentifier(existingTable.identifier)

      this.logger.info('Mutation completed: updateTable', {
        id: args.id,
        input: args.input,
      })

      return {
        success: !!updatedTable,
        table: updatedTable,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: updateTable', {
        id: args.id,
        input: args.input,
        ...toErrorMeta(error),
      })

      return {
        success: false,
        table: null,
        errors: [this.mapToGraphQLError(error, 'updateTable')],
      }
    }
  }

  async deleteTable(
    _: GraphQLParent,
    args: DeleteTableArgs,
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('id', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Table ID'),
      ],
      'deleteTable',
    )

    try {
      this.logger.info('Executing mutation: deleteTable', {
        id: args.id,
        force: args.force,
        cascadeDelete: args.cascadeDelete,
      })

      const existingTable = await this.tableRepository.findById(args.id)
      if (!existingTable) {
        throw new Error('Table not found')
      }

      const dependencies = await this.deleteTableUseCase.execute({
        id: args.id,
        force: args.force,
        cascadeDelete: args.cascadeDelete,
      })

      this.lifecycle.onTableDeleted(args.id, existingTable.identifier, 'deleteTable')

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
        id: args.id,
        force: args.force,
        cascadeDelete: args.cascadeDelete,
        ...toErrorMeta(error),
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

  async batchCreateTables(
    _: GraphQLParent,
    args: {
      tables: Array<{
        identifier: string
        description?: string
        name?: string
      }>
    },
  ) {
    const results: Array<{
      table: (TableDto & { name: string }) | null
      errors: string[]
    }> = []
    let totalCreated = 0
    let totalFailed = 0

    for (const tableInput of args.tables || []) {
      try {
        const result = await this.createTableUseCase.execute({
          identifier: tableInput.identifier,
          description: tableInput.description,
        })
        this.tabularSyncHook?.notifyByIdentifier(result.table.identifier)
        totalCreated++
        results.push({
          table: {
            ...result.table,
            name: tableInput.name || result.table.identifier,
          },
          errors: [],
        })
      } catch (error) {
        totalFailed++
        results.push({
          table: null,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        })
      }
    }

    return {
      success: totalFailed === 0,
      results,
      totalCreated,
      totalFailed,
    }
  }

  async batchDeleteTables(_: GraphQLParent, args: { tableIds: string[] }) {
    let deletedCount = 0
    let failedCount = 0
    const errors: string[] = []

    for (const tableId of args.tableIds || []) {
      try {
        const existingTable = await this.tableRepository.findById(tableId)
        await this.deleteTableUseCase.execute({
          id: tableId,
          force: true,
        })
        if (existingTable) {
          this.lifecycle.onTableDeleted(
            tableId,
            existingTable.identifier,
            'batchDeleteTables',
          )
        }
        deletedCount++
      } catch (error) {
        failedCount++
        errors.push(error instanceof Error ? error.message : 'Unknown error')
      }
    }

    return {
      success: failedCount === 0,
      deletedCount,
      failedCount,
      errors,
    }
  }
}

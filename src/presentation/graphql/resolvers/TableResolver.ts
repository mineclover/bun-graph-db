import { type AttributeDto, fromEntities as attributeFromEntities } from '@/application/dtos/AttributeDto.js'
import {
  type AttributeTypeDto,
  fromEntities as attributeTypeFromEntities,
} from '@/application/dtos/AttributeTypeDto.js'
import { type NodeDto, fromEntities as nodeFromEntities } from '@/application/dtos/NodeDto.js'
import { type TableDto, fromEntity as tableFromEntity } from '@/application/dtos/TableDto.js'
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
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'

export class TableResolver extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly createTableUseCase: CreateTableUseCase,
    private readonly tableRepository: ITableRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    logger: ILogger,
  ) {
    super()
    this.logger = logger
  }

  // Query resolvers
  async table(args: { id: string }, _context?: GraphQLContext): Promise<TableDto | null> {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Table ID'),
      ],
      'table',
    )

    return this.handleQuery(
      async () => {
        const table = await this.tableRepository.findById(args.id as TableId)
        return table ? tableFromEntity(table) : null
      },
      'findTableById',
      { id: args.id },
    )
  }

  async tableByIdentifier(args: { identifier: string }, _context?: GraphQLContext): Promise<TableDto | null> {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('identifier', 'Table Identifier'),
        BaseResolver.validationRules.nonEmpty('identifier', 'Table Identifier'),
      ],
      'tableByIdentifier',
    )

    return this.handleQuery(
      async () => {
        const table = await this.tableRepository.findByIdentifier(args.identifier)
        return table ? tableFromEntity(table) : null
      },
      'findTableByIdentifier',
      { identifier: args.identifier },
    )
  }

  async tables(args: {
    filter?: TablesFilter
    pagination?: TablesPagination
    sort?: Array<{ field: string; direction: 'ASC' | 'DESC' }>
  }): Promise<{
    nodes: TableDto[]
    totalCount: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }> {
    try {
      const { pagination = { limit: 10, offset: 0 }, filter, sort } = args

      // Implement filtering with repository search
      const searchOptions = {
        limit: pagination.limit || 10,
        offset: pagination.offset || 0,
        search: filter?.search || undefined,
        createdAfter: filter?.createdAfter || undefined,
        createdBefore: filter?.createdBefore || undefined,
        sortBy: sort?.[0]?.field || 'createdAt',
        sortDirection: (sort?.[0]?.direction || 'DESC') as 'ASC' | 'DESC',
      }

      const result = await this.tableRepository.findAll(searchOptions)

      return {
        nodes: (result.data || []).map((table) => tableFromEntity(table)),
        totalCount: result.total || 0,
        hasNextPage: result.hasMore || false,
        hasPreviousPage: (pagination.offset || 0) > 0,
      }
    } catch (error) {
      this.logger.error('Failed to find tables', { args, ...toErrorMeta(error) })
      throw error
    }
  }

  async searchTables(args: { filter?: TablesFilter }): Promise<{
    nodes: TableDto[]
    totalCount: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }> {
    // searchTables is a simplified interface for MCP compatibility
    // It delegates to the full tables method with default pagination
    return this.tables({
      filter: args.filter,
      pagination: { limit: 50, offset: 0 }, // Default pagination for search
      sort: [{ field: 'createdAt', direction: 'DESC' }],
    })
  }

  async tableDocumentation(args: {
    tableId?: string
    identifier?: string
    includeRelationships?: boolean
    includeSampleNodes?: boolean
    includeUsageStats?: boolean
    sampleLimit?: number
  }): Promise<any> {
    // Validate that either tableId or identifier is provided
    if (!args.tableId && !args.identifier) {
      throw new ValidationException('Either tableId or identifier must be provided')
    }

    return this.handleQuery(
      async () => {
        // Find the table first
        let table: any
        if (args.tableId) {
          table = await this.tableRepository.findById(args.tableId as TableId)
        } else if (args.identifier) {
          table = await this.tableRepository.findByIdentifier(args.identifier)
        }

        if (!table) {
          throw new NotFoundException('Table not found')
        }

        // For now, return a basic structure - this will be expanded
        return {
          table: tableFromEntity(table),
          schema: {
            totalAttributes: 0,
            attributes: [],
          },
          sampleNodes: args.includeSampleNodes !== false ? [] : null,
          relationships:
            args.includeRelationships !== false
              ? {
                  incomingRelations: [],
                  outgoingRelations: [],
                  relatedTables: [],
                }
              : null,
          usageStats:
            args.includeUsageStats === true
              ? {
                  totalNodes: 0,
                  recentlyCreatedNodes: 0,
                  frequentlyAccessedAttributes: [],
                  averageAttributeUsage: 0.0,
                }
              : null,
          usageExamples: [
            {
              category: 'basic',
              title: 'Create a new node',
              description: `Add a new node to the ${table.identifier} table`,
              exampleMutation: `mutation {
  createNode(input: {
    tableId: "${table.id}"
    content: "Your content here"
  }) {
    success
    node { id content }
    errors { message }
  }
}`,
            },
          ],
        }
      },
      'tableDocumentation',
      { tableId: args.tableId, identifier: args.identifier },
    )
  }

  // Mutation resolvers
  async createTable(
    args: { input: CreateTableInput },
    _context?: GraphQLContext,
  ): Promise<{
    success: boolean
    data?: TableDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    this.validateArgs(
      args.input,
      [
        BaseResolver.validationRules.required('identifier', 'Table Identifier'),
        BaseResolver.validationRules.nonEmpty('identifier', 'Table Identifier'),
      ],
      'createTable',
    )

    const result = await this.handleMutation(
      async () => {
        const cleanedInput = {
          identifier: args.input.identifier,
          description: args.input.description ?? undefined,
        }
        const useCaseResult = await this.createTableUseCase.execute(cleanedInput)
        return useCaseResult.table
      },
      'createTable',
      { input: args.input },
    )

    return {
      success: result.success,
      data: result.data,
      errors: result.errors,
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
      const savedTableResult = await this.tableRepository.save(table)
      if (!savedTableResult) {
        throw new Error('Table save returned void unexpectedly')
      }
      const savedTable = savedTableResult

      return {
        table: tableFromEntity(savedTable),
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to update table', {
        id: args.id,
        input: args.input,
        ...toErrorMeta(error),
      })

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
      this.logger.error('Failed to delete table', { id: args.id, ...toErrorMeta(error) })

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
  async nodeCount(table: TableDto, _context?: GraphQLContext): Promise<number> {
    const result = await this.handleFieldResolution(
      async () => {
        return await this.nodeRepository.countByTableId(table.id)
      },
      'nodeCount',
      'Table',
      { tableId: table.id },
    )
    return result ?? 0
  }

  async attributeCount(table: TableDto, _context?: GraphQLContext): Promise<number> {
    const result = await this.handleFieldResolution(
      async () => {
        return await this.attributeRepository.countByTableId(table.id)
      },
      'attributeCount',
      'Table',
      { tableId: table.id },
    )
    return result ?? 0
  }

  // Relationship field resolvers
  async attributes(table: TableDto, _context?: GraphQLContext): Promise<AttributeDto[]> {
    const result = await this.handleFieldResolution(
      async () => {
        const attributesResult = await this.attributeRepository.findByTableId(table.id)
        return attributeFromEntities(attributesResult.data || [])
      },
      'attributes',
      'Table',
      { tableId: table.id },
    )
    return result ?? []
  }

  async attributeTypes(table: TableDto, _context?: GraphQLContext): Promise<AttributeTypeDto[]> {
    const result = await this.handleFieldResolution(
      async () => {
        // Get all attribute types - table-specific attribute types would need a different approach
        // For now, return all available attribute types
        const attributeTypesResult = await this.attributeTypeRepository.findAll({ limit: 100 })
        return attributeTypeFromEntities(attributeTypesResult.data || [])
      },
      'attributeTypes',
      'Table',
      { tableId: table.id },
    )
    return result ?? []
  }

  async tableNodes(table: TableDto, _context?: GraphQLContext): Promise<NodeDto[]> {
    const result = await this.handleFieldResolution(
      async () => {
        const nodesResult = await this.nodeRepository.findByTableId(table.id, { limit: 100 })
        return nodeFromEntities(nodesResult.data || [])
      },
      'tableNodes',
      'Table',
      { tableId: table.id },
    )
    return result ?? []
  }
}

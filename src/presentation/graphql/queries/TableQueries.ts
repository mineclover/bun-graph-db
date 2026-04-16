import type { ILogger } from '@/application/ports/ILogger.js'
import { TableSchemaProjectionService } from '@/application/services/TableSchemaProjectionService.js'
import type { GetTableDocsUseCase } from '@/application/use-cases/tables/GetTableDocs.js'
import { GraphQLError } from 'graphql'
import type {
  GraphQLContext,
  GraphQLParent,
  TableArgs,
  TableByIdentifierArgs,
  TablesArgs,
} from '@/core/types/GraphQLTypes.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { DIContainer } from '@/infrastructure/container/DIContainer.js'
import { RepositoryTokens, UseCaseTokens } from '@/infrastructure/container/tokens/index.js'
import {
  toTableSchemaOpenApiOperationContractProjectionResult,
  toTableSchemaOpenApiProjectionResult,
} from '@/core/schema/TableSchemaOpenApiProjection.js'
import { BaseResolver } from '../base/BaseResolver.js'

export class TableQueries extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly container: DIContainer,
    logger: ILogger,
  ) {
    super()
    this.logger = logger
  }

  async table(_: GraphQLParent, args: TableArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('id', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Table ID'),
      ],
      'table',
    )

    return this.handleQuery(
      async () => {
        return await this.tableRepository.findById(args.id)
      },
      'findTableById',
      { id: args.id },
    )
  }

  async tableByIdentifier(_: GraphQLParent, args: TableByIdentifierArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('identifier', 'Table identifier'),
        BaseResolver.validationRules.nonEmpty('identifier', 'Table identifier'),
      ],
      'tableByIdentifier',
    )

    return this.handleQuery(
      async () => {
        return await this.tableRepository.findByIdentifier(args.identifier)
      },
      'findTableByIdentifier',
      { identifier: args.identifier },
    )
  }

  async tables(_: GraphQLParent, args: TablesArgs, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        const result = await this.tableRepository.findAll(args.pagination || { limit: 10, offset: 0 })

        return {
          nodes: result.data || [],
          totalCount: result.total || 0,
          hasNextPage: result.hasMore || false,
          hasPreviousPage: (args.pagination?.offset || 0) > 0,
        }
      },
      'findTables',
      { filter: args.filter, pagination: args.pagination, sort: args.sort },
    )
  }

  async searchTables(_: GraphQLParent, args: { filter?: TablesArgs['filter'] }, _context?: GraphQLContext) {
    // searchTables is a simplified interface for MCP compatibility
    // It delegates to the tables method with default pagination
    return this.tables(
      _,
      {
        filter: args.filter,
        pagination: { limit: 50, offset: 0 },
        sort: { field: 'createdAt', direction: 'DESC' },
      },
      _context,
    )
  }

  async tableDocumentation(
    _: GraphQLParent,
    args: {
      tableId?: string
      identifier?: string
      includeDocs?: boolean
      includeRelationships?: boolean
      includeRelatedTemplates?: boolean
      includeUsageStats?: boolean
      includeAiMetadata?: boolean
    },
    _context?: GraphQLContext,
  ) {
    // Validate that either tableId or identifier is provided
    if (!args.tableId && !args.identifier) {
      throw new Error('Either tableId or identifier must be provided')
    }

    return this.handleQuery(
      async () => {
        // Resolve the use case from container to avoid circular dependency
        const getTableDocsUseCase = (await this.container.resolve(UseCaseTokens.GET_TABLE_DOCS_USE_CASE)) as GetTableDocsUseCase

        const result = await getTableDocsUseCase.execute({
          tableId: args.tableId,
          identifier: args.identifier,
          includeDocs: args.includeDocs,
          includeRelatedTemplates: args.includeRelatedTemplates,
          includeUsageStats: args.includeUsageStats,
          includeAiMetadata: args.includeAiMetadata,
        })

        return result.tableDocs
      },
      'tableDocumentation',
      { tableId: args.tableId, identifier: args.identifier },
    )
  }

  async tableOpenApiProjection(
    _: GraphQLParent,
    args: {
      tableId?: string
      identifier?: string
      profile?: string
    },
    _context?: GraphQLContext,
  ) {
    if (!args.tableId && !args.identifier) {
      throw new Error('Either tableId or identifier must be provided')
    }
    const profile = normalizeProjectionProfile(args.profile)
    if (!profile) {
      throw new GraphQLError('profile must be component-bundle or operation-contract', {
        extensions: { code: 'INVALID_PROJECTION_PROFILE' },
      })
    }

    return this.handleQuery(
      async () => {
        const projectionService = await this.createProjectionService()
        const request = args.tableId
          ? { tableId: args.tableId } as const
          : args.identifier
            ? { identifier: args.identifier } as const
            : undefined
        if (!request) throw new Error('Either tableId or identifier must be provided')

        const projection = await projectionService.project(request)

        return profile === 'operation-contract'
          ? toTableSchemaOpenApiOperationContractProjectionResult(projection)
          : toTableSchemaOpenApiProjectionResult(projection)
      },
      'tableOpenApiProjection',
      { tableId: args.tableId, identifier: args.identifier, profile },
    )
  }

  private async createProjectionService(): Promise<TableSchemaProjectionService> {
    const attributeRepository = await this.container.resolve(RepositoryTokens.ATTRIBUTE_REPOSITORY)
    const attributeTypeRepository = await this.container.resolve(RepositoryTokens.ATTRIBUTE_TYPE_REPOSITORY)
    return new TableSchemaProjectionService(
      this.tableRepository,
      attributeRepository as ConstructorParameters<typeof TableSchemaProjectionService>[1],
      attributeTypeRepository as ConstructorParameters<typeof TableSchemaProjectionService>[2],
      this.logger,
    )
  }
}

function normalizeProjectionProfile(value: unknown): 'component-bundle' | 'operation-contract' | undefined {
  const profile = value === undefined ? 'component-bundle' : value
  if (profile === 'component-bundle' || profile === 'operation-contract') return profile
  return undefined
}

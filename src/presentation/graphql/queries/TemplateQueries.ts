import type { GraphQLSchema } from 'graphql'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { GraphQLContext, GraphQLParent } from '@/core/types/GraphQLTypes.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

export class TemplateQueries extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    logger: ILogger,
    private readonly schema?: GraphQLSchema
  ) {
    super()
    this.logger = logger
  }

  async getTemplate(_: GraphQLParent, args: { id: string }, context?: GraphQLContext) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Template ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Template ID'),
      ],
      'getTemplate'
    )

    return this.handleQuery(
      async () => {
        return await this.queryTemplateRepository.findById(args.id)
      },
      'findTemplateById',
      { id: args.id }
    )
  }

  async getTemplateByIdentifier(
    _: GraphQLParent,
    args: { identifier: string },
    context?: GraphQLContext
  ) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('identifier', 'Template Identifier'),
        BaseResolver.validationRules.nonEmpty('identifier', 'Template Identifier'),
      ],
      'getTemplateByIdentifier'
    )

    return this.handleQuery(
      async () => {
        return await this.queryTemplateRepository.findByIdentifier(args.identifier)
      },
      'findTemplateByIdentifier',
      { identifier: args.identifier }
    )
  }

  async searchTemplates(
    _: GraphQLParent,
    args: {
      filter?: {
        search?: string
        isActive?: boolean
        createdBy?: string
        createdAfter?: string
        createdBefore?: string
        tags?: string[]
        tagMatchMode?: 'ANY' | 'ALL'
        applicableToTable?: string
        includeUniversal?: boolean
        templateType?: string
      }
      pagination?: {
        limit?: number
        offset?: number
      }
      sort?: Array<{
        field: string
        direction: 'ASC' | 'DESC'
      }>
    },
    context?: GraphQLContext
  ) {
    return this.handleQuery(
      async () => {
        // Extract pagination parameters
        const limit = args.pagination?.limit || 10
        const offset = args.pagination?.offset || 0
        
        // Extract filter parameters
        const filter = args.filter || {}
        
        // Extract sort parameters (use first sort or default)
        const sort = args.sort?.[0]
        
        const result = await this.queryTemplateRepository.search({
          tags: filter.tags,
          tagMatchMode: filter.tagMatchMode,
          applicableToTable: filter.applicableToTable,
          includeUniversal: filter.includeUniversal,
          templateType: filter.templateType,
          isActive: filter.isActive,
          orderBy: sort?.field,
          orderDirection: sort?.direction,
          limit,
          offset,
        })

        return {
          nodes: result.items,
          totalCount: result.total,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
        }
      },
      'searchTemplates',
      { args }
    )
  }

  async getPopularTemplates(_: GraphQLParent, args: { limit?: number }, context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        const result = await this.queryTemplateRepository.findPopular(args.limit || 10)
        return result
      },
      'findPopularTemplates',
      { limit: args.limit }
    )
  }


  setSchema(schema: GraphQLSchema) {
    ;(this as any).schema = schema
  }
}

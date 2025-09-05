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
      tags?: string[]
      tagMatchMode?: 'ANY' | 'ALL'
      applicableToTable?: string
      includeUniversal?: boolean
      templateType?: string
      isActive?: boolean
      orderBy?: string
      orderDirection?: 'ASC' | 'DESC'
      limit?: number
      offset?: number
    },
    context?: GraphQLContext
  ) {
    return this.handleQuery(
      async () => {
        const result = await this.queryTemplateRepository.search({
          tags: args.tags,
          tagMatchMode: args.tagMatchMode,
          applicableToTable: args.applicableToTable,
          includeUniversal: args.includeUniversal,
          templateType: args.templateType,
          isActive: args.isActive,
          orderBy: args.orderBy,
          orderDirection: args.orderDirection,
          limit: args.limit || 10,
          offset: args.offset || 0,
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

  async executeTemplate(
    _: GraphQLParent,
    args: {
      templateIdentifier: string
      variables?: Record<string, unknown>
      trackUsage?: boolean
    },
    context?: GraphQLContext
  ) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('templateIdentifier', 'Template Identifier'),
        BaseResolver.validationRules.nonEmpty('templateIdentifier', 'Template Identifier'),
      ],
      'executeTemplate'
    )

    return this.handleQuery(
      async () => {
        // Simple implementation without use case to avoid circular dependency
        const template = await this.queryTemplateRepository.findByIdentifier(
          args.templateIdentifier
        )
        if (!template) {
          throw new Error(`Template with identifier ${args.templateIdentifier} not found`)
        }

        // For now, return a simple result structure
        // TODO: Implement proper query template execution logic later
        return {
          queryText: template.getQueryText(),
          processedVariables: args.variables || {},
          metadata: {
            templateId: template.getId(),
            templateName: template.getName(),
            executedAt: new Date().toISOString(),
          },
        }
      },
      'executeTemplate',
      { templateIdentifier: args.templateIdentifier }
    )
  }

  setSchema(schema: GraphQLSchema) {
    ;(this as any).schema = schema
  }
}

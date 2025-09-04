import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import type { ExecuteQueryTemplateUseCase } from '@/application/use-cases/query-templates/ExecuteQueryTemplate.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { GraphQLSchema } from 'graphql'
import type { GraphQLParent, GraphQLContext } from '@/core/types/GraphQLTypes.js'

export class TemplateQueries {
  constructor(
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    private readonly executeQueryTemplateUseCase: ExecuteQueryTemplateUseCase,
    private readonly logger: ILogger,
    private readonly schema?: GraphQLSchema
  ) {}

  async getTemplate(_: GraphQLParent, args: { id: string }) {
    try {
      this.logger.info('Fetching template', { id: args.id })
      return await this.queryTemplateRepository.findById(args.id)
    } catch (error) {
      this.logger.error('Error fetching template', { error, id: args.id })
      throw error
    }
  }

  async getTemplateByIdentifier(_: GraphQLParent, args: { identifier: string }) {
    try {
      this.logger.info('Fetching template by identifier', { identifier: args.identifier })
      return await this.queryTemplateRepository.findByIdentifier(args.identifier)
    } catch (error) {
      this.logger.error('Error fetching template by identifier', { error, identifier: args.identifier })
      throw error
    }
  }

  async searchTemplates(_: GraphQLParent, args: { 
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
  }) {
    try {
      this.logger.info('Searching templates', { args })
      
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
        offset: args.offset || 0
      })

      return {
        nodes: result.items,
        totalCount: result.total,
        hasNextPage: result.hasNextPage,
        hasPreviousPage: result.hasPreviousPage
      }
    } catch (error) {
      this.logger.error('Error searching templates', { error, args })
      throw error
    }
  }

  async getPopularTemplates(_: GraphQLParent, args: { limit?: number }) {
    try {
      this.logger.info('Fetching popular templates', { limit: args.limit })
      
      const result = await this.queryTemplateRepository.findPopular(args.limit || 10)
      return result
    } catch (error) {
      this.logger.error('Error fetching popular templates', { error, args })
      throw error
    }
  }

  async executeTemplate(_: GraphQLParent, args: { 
    templateIdentifier: string
    variables?: Record<string, unknown>
    trackUsage?: boolean
  }, context: GraphQLContext) {
    try {
      this.logger.info('Executing template', { templateIdentifier: args.templateIdentifier })

      const result = await this.executeQueryTemplateUseCase.execute({
        templateIdentifier: args.templateIdentifier,
        variables: args.variables,
        trackUsage: args.trackUsage
      })

      return {
        queryText: result.queryText,
        processedVariables: result.processedVariables,
        metadata: result.metadata
      }
    } catch (error) {
      this.logger.error('Error executing template', { error, args })
      throw error
    }
  }

  setSchema(schema: GraphQLSchema) {
    ;(this as any).schema = schema
  }
}
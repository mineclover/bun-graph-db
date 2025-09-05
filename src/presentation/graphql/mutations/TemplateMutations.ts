import type { GraphQLSchema } from 'graphql'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { ExecuteQueryTemplateUseCase } from '@/application/use-cases/query-templates/ExecuteQueryTemplate.js'
import type { GraphQLContext, GraphQLParent } from '@/core/types/GraphQLTypes.js'
import { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

export class TemplateMutations extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    private readonly executeQueryTemplateUseCase: ExecuteQueryTemplateUseCase,
    logger: ILogger,
    private readonly schema?: GraphQLSchema
  ) {
    super()
    this.logger = logger
  }

  async createTemplate(_: GraphQLParent, args: { input: any }, context?: GraphQLContext) {
    this.validateArgs(args, [
      BaseResolver.validationRules.required('input', 'Create template input'),
      BaseResolver.validationRules.required('input.identifier', 'Template identifier'),
      BaseResolver.validationRules.required('input.name', 'Template name'),
      BaseResolver.validationRules.required('input.queryText', 'Query text'),
      BaseResolver.validationRules.nonEmpty('input.identifier', 'Template identifier'),
      BaseResolver.validationRules.nonEmpty('input.name', 'Template name'),
      BaseResolver.validationRules.nonEmpty('input.queryText', 'Query text')
    ], 'createTemplate')

    return this.handleMutation(async () => {
      const template = QueryTemplate.create(
        args.input.identifier,
        args.input.name,
        args.input.queryText,
        args.input.tags || ['general'],
        {
          description: args.input.description,
          variablesSchema: args.input.variablesSchema,
          defaultVariables: args.input.defaultVariables,
          applicableTables: args.input.applicableTables,
          templateType: args.input.templateType,
          complexityScore: args.input.complexityScore,
          version: args.input.version,
        }
      )

      const result = await this.queryTemplateRepository.create(template)

      return result
    }, 'createTemplate', { input: args.input })
  }

  async updateTemplate(_: GraphQLParent, args: { id: string; input: any }, context?: GraphQLContext) {
    this.validateArgs(args, [
      BaseResolver.validationRules.required('id', 'Template ID'),
      BaseResolver.validationRules.required('input', 'Update template input'),
      BaseResolver.validationRules.nonEmpty('id', 'Template ID')
    ], 'updateTemplate')

    return this.handleMutation(async () => {
      const existingTemplate = await this.queryTemplateRepository.findById(args.id)
      if (!existingTemplate) {
        throw new Error('Template not found')
      }

      const updatedTemplate = await this.queryTemplateRepository.update(args.id, {
        name: args.input.name,
        description: args.input.description,
        queryText: args.input.queryText,
        variablesSchema: args.input.variablesSchema,
        defaultVariables: args.input.defaultVariables,
        applicableTables: args.input.applicableTables,
        templateType: args.input.templateType,
        complexityScore: args.input.complexityScore,
        version: args.input.version,
        isActive: args.input.isActive,
        tags: args.input.tags,
      })

      return updatedTemplate
    }, 'updateTemplate', { id: args.id, input: args.input })
  }

  async deleteTemplate(_: GraphQLParent, args: { id: string }, context?: GraphQLContext) {
    this.validateArgs(args, [
      BaseResolver.validationRules.required('id', 'Template ID'),
      BaseResolver.validationRules.nonEmpty('id', 'Template ID')
    ], 'deleteTemplate')

    return this.handleMutation(async () => {
      const existingTemplate = await this.queryTemplateRepository.findById(args.id)
      if (!existingTemplate) {
        return {
          success: false,
          errors: [{ message: 'Template not found', code: 'TEMPLATE_NOT_FOUND' }],
        }
      }

      await this.queryTemplateRepository.delete(args.id)

      return true
    }, 'deleteTemplate', { id: args.id })
  }

  async activateTemplate(_: GraphQLParent, args: { id: string }, context?: GraphQLContext) {
    this.validateArgs(args, [
      BaseResolver.validationRules.required('id', 'Template ID'),
      BaseResolver.validationRules.nonEmpty('id', 'Template ID')
    ], 'activateTemplate')

    return this.handleMutation(async () => {
      const result = await this.queryTemplateRepository.updateStatus(args.id, true)
      return result
    }, 'activateTemplate', { id: args.id })
  }

  async deactivateTemplate(_: GraphQLParent, args: { id: string }, context?: GraphQLContext) {
    this.validateArgs(args, [
      BaseResolver.validationRules.required('id', 'Template ID'),
      BaseResolver.validationRules.nonEmpty('id', 'Template ID')
    ], 'deactivateTemplate')

    return this.handleMutation(async () => {
      const result = await this.queryTemplateRepository.updateStatus(args.id, false)
      return result
    }, 'deactivateTemplate', { id: args.id })
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
    this.validateArgs(args, [
      BaseResolver.validationRules.required('templateIdentifier', 'Template Identifier'),
      BaseResolver.validationRules.nonEmpty('templateIdentifier', 'Template Identifier')
    ], 'executeTemplate')

    return this.handleQuery(async () => {
      const result = await this.executeQueryTemplateUseCase.execute({
        templateIdentifier: args.templateIdentifier,
        variables: args.variables,
        trackUsage: args.trackUsage,
      })

      return {
        queryText: result.queryText,
        processedVariables: result.processedVariables,
        metadata: result.metadata,
      }
    }, 'executeTemplate', { templateIdentifier: args.templateIdentifier })
  }

  setSchema(schema: GraphQLSchema) {
    ;(this as any).schema = schema
  }
}

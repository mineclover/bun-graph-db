import type { ExecutionResult, GraphQLSchema } from 'graphql'
import { execute, parse } from 'graphql'
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
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('input', 'Create template input'),
        BaseResolver.validationRules.required('input.identifier', 'Template identifier'),
        BaseResolver.validationRules.required('input.name', 'Template name'),
        BaseResolver.validationRules.required('input.query', 'Query text'),
        BaseResolver.validationRules.nonEmpty('input.identifier', 'Template identifier'),
        BaseResolver.validationRules.nonEmpty('input.name', 'Template name'),
        BaseResolver.validationRules.nonEmpty('input.query', 'Query text'),
      ],
      'createTemplate'
    )

    try {
      this.logger.info('Executing mutation: createTemplate', { input: args.input })
      
      const template = QueryTemplate.create(
        args.input.identifier,
        args.input.name,
        args.input.query,
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

      this.logger.info('Template created successfully', { templateId: result.id, identifier: result.identifier })
      
      return {
        success: true,
        template: result,
        errors: []
      }
    } catch (error) {
      this.logger.error('Failed to create template', { error, input: args.input })
      
      return {
        success: false,
        template: null,
        errors: [{
          message: error instanceof Error ? error.message : 'Failed to create template',
          code: 'TEMPLATE_CREATION_ERROR'
        }]
      }
    }
  }

  async updateTemplate(
    _: GraphQLParent,
    args: { id: string; input: any },
    context?: GraphQLContext
  ) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Template ID'),
        BaseResolver.validationRules.required('input', 'Update template input'),
        BaseResolver.validationRules.nonEmpty('id', 'Template ID'),
      ],
      'updateTemplate'
    )

    return this.handleMutation(
      async () => {
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
      },
      'updateTemplate',
      { id: args.id, input: args.input }
    )
  }

  async deleteTemplate(_: GraphQLParent, args: { id: string }, context?: GraphQLContext) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Template ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Template ID'),
      ],
      'deleteTemplate'
    )

    return this.handleMutation(
      async () => {
        const existingTemplate = await this.queryTemplateRepository.findById(args.id)
        if (!existingTemplate) {
          return {
            success: false,
            errors: [{ message: 'Template not found', code: 'TEMPLATE_NOT_FOUND' }],
          }
        }

        await this.queryTemplateRepository.delete(args.id)

        return true
      },
      'deleteTemplate',
      { id: args.id }
    )
  }

  async activateTemplate(_: GraphQLParent, args: { id: string }, context?: GraphQLContext) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Template ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Template ID'),
      ],
      'activateTemplate'
    )

    return this.handleMutation(
      async () => {
        const result = await this.queryTemplateRepository.updateStatus(args.id, true)
        return result
      },
      'activateTemplate',
      { id: args.id }
    )
  }

  async deactivateTemplate(_: GraphQLParent, args: { id: string }, context?: GraphQLContext) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Template ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Template ID'),
      ],
      'deactivateTemplate'
    )

    return this.handleMutation(
      async () => {
        const result = await this.queryTemplateRepository.updateStatus(args.id, false)
        return result
      },
      'deactivateTemplate',
      { id: args.id }
    )
  }

  async executeTemplate(
    _: GraphQLParent,
    args: {
      input: {
        templateIdentifier: string
        variables?: Record<string, unknown>
        trackUsage?: boolean
      }
    },
    context?: GraphQLContext
  ) {
    this.validateArgs(
      args.input,
      [
        BaseResolver.validationRules.required('templateIdentifier', 'Template Identifier'),
        BaseResolver.validationRules.nonEmpty('templateIdentifier', 'Template Identifier'),
      ],
      'executeTemplate'
    )

    return this.handleMutation(
      async () => {
        const result = await this.executeQueryTemplateUseCase.execute({
          templateIdentifier: args.input.templateIdentifier,
          variables: args.input.variables,
          trackUsage: args.input.trackUsage,
        })

        return {
          queryText: result.queryText,
          processedVariables: result.processedVariables,
          metadata: result.metadata,
        }
      },
      'executeTemplate',
      { templateIdentifier: args.input.templateIdentifier }
    )
  }

  async executeTemplateWithGraphQL(
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
      'executeTemplateWithGraphQL'
    )

    const startTime = Date.now()

    return this.handleMutation(
      async () => {
        // 1. 템플릿 준비 및 변수 처리
        const templateResult = await this.executeQueryTemplateUseCase.execute({
          templateIdentifier: args.templateIdentifier,
          variables: args.variables,
          trackUsage: args.trackUsage,
        })

        // 2. GraphQL 스키마 확인
        if (!this.schema) {
          return {
            success: false,
            errors: [
              {
                message: 'GraphQL schema not available',
                code: 'SCHEMA_NOT_AVAILABLE',
              },
            ],
            metadata: {
              ...templateResult.metadata,
              executionTime: Date.now() - startTime,
            },
          }
        }

        // 3. GraphQL 쿼리 파싱
        let document
        try {
          document = parse(templateResult.queryText)
        } catch (parseError) {
          this.logger.error('GraphQL query parse error', {
            error: parseError,
            queryText: templateResult.queryText,
          })

          return {
            success: false,
            errors: [
              {
                message: `Invalid GraphQL query: ${parseError instanceof Error ? parseError.message : 'Parse error'}`,
                code: 'GRAPHQL_PARSE_ERROR',
              },
            ],
            metadata: {
              ...templateResult.metadata,
              executionTime: Date.now() - startTime,
            },
          }
        }

        // 4. GraphQL 실행
        const executionResult: ExecutionResult = await execute({
          schema: this.schema,
          document,
          variableValues: templateResult.processedVariables,
          contextValue: context || {},
        })

        // 5. 결과 처리
        const executionTime = Date.now() - startTime

        if (executionResult.errors && executionResult.errors.length > 0) {
          this.logger.warn('GraphQL execution errors', {
            identifier: args.templateIdentifier,
            errors: executionResult.errors.map((err) => err.message),
          })

          return {
            success: false,
            data: executionResult.data,
            errors: executionResult.errors.map((error) => ({
              message: error.message,
              locations: error.locations,
              path: error.path,
              code: 'GRAPHQL_EXECUTION_ERROR',
            })),
            metadata: {
              ...templateResult.metadata,
              executionTime,
            },
          }
        }

        this.logger.info('Template executed successfully with GraphQL', {
          identifier: args.templateIdentifier,
          executionTime,
          hasData: !!executionResult.data,
        })

        return {
          success: true,
          data: executionResult.data,
          metadata: {
            ...templateResult.metadata,
            executionTime,
          },
        }
      },
      'executeTemplateWithGraphQL',
      { templateIdentifier: args.templateIdentifier }
    )
  }

  setSchema(schema: GraphQLSchema) {
    ;(this as any).schema = schema
  }
}

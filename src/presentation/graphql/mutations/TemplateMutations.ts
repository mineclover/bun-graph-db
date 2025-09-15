import type { ExecutionResult, GraphQLSchema } from 'graphql'
import { execute, parse } from 'graphql'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { ExecuteQueryTemplateUseCase } from '@/application/use-cases/query-templates/ExecuteQueryTemplate.js'
import { ExportTemplateUseCase } from '@/application/use-cases/templates/ExportTemplateUseCase.js'
import { ImportTemplateUseCase } from '@/application/use-cases/templates/ImportTemplateUseCase.js'
import type { GraphQLContext, GraphQLParent } from '@/core/types/GraphQLTypes.js'
import { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

export class TemplateMutations extends BaseResolver {
  protected logger: ILogger
  private exportTemplateUseCase: ExportTemplateUseCase
  private importTemplateUseCase: ImportTemplateUseCase

  constructor(
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    private readonly executeQueryTemplateUseCase: ExecuteQueryTemplateUseCase,
    logger: ILogger,
    private readonly schema?: GraphQLSchema
  ) {
    super()
    this.logger = logger
    this.exportTemplateUseCase = new ExportTemplateUseCase(queryTemplateRepository, logger)
    this.importTemplateUseCase = new ImportTemplateUseCase(queryTemplateRepository, logger)
  }

  async createTemplate(_: GraphQLParent, args: { input: any }, _context?: GraphQLContext) {
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

      this.logger.info('Template created successfully', {
        templateId: result.getId(),
        identifier: result.getIdentifier(),
      })

      return {
        success: true,
        template: result,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to create template', { error, input: args.input })

      return {
        success: false,
        template: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Failed to create template',
            code: 'TEMPLATE_CREATION_ERROR',
          },
        ],
      }
    }
  }

  async updateTemplate(
    _: GraphQLParent,
    args: { id: string; input: any },
    _context?: GraphQLContext
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

    try {
      this.logger.info('Executing mutation: updateTemplate', { id: args.id, input: args.input })

      const existingTemplate = await this.queryTemplateRepository.findById(args.id)
      if (!existingTemplate) {
        return {
          success: false,
          template: null,
          errors: [{ message: 'Template not found', code: 'TEMPLATE_NOT_FOUND' }],
        }
      }

      // Build update object with only available fields from GraphQL input
      // Note: The repository expects fields to match QueryTemplate entity structure
      const updateData: Record<string, unknown> = {}

      if (args.input.name !== undefined) {
        updateData.name = args.input.name
      }
      if (args.input.description !== undefined) {
        updateData.description = args.input.description
      }
      if (args.input.query !== undefined) {
        updateData.queryText = args.input.query // Map 'query' field to 'queryText'
      }
      if (args.input.variables !== undefined) {
        updateData.defaultVariables = args.input.variables // Map 'variables' to 'defaultVariables'
      }

      const updatedTemplate = await this.queryTemplateRepository.update(args.id, updateData)

      this.logger.info('Template updated successfully', {
        templateId: updatedTemplate.getId(),
        identifier: updatedTemplate.getIdentifier(),
      })

      return {
        success: true,
        template: updatedTemplate,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to update template', { id: args.id, error })

      return {
        success: false,
        template: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Failed to update template',
            code: 'TEMPLATE_UPDATE_ERROR',
          },
        ],
      }
    }
  }

  async deleteTemplate(_: GraphQLParent, args: { id: string }, _context?: GraphQLContext) {
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

  async activateTemplate(_: GraphQLParent, args: { id: string }, _context?: GraphQLContext) {
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

  async deactivateTemplate(_: GraphQLParent, args: { id: string }, _context?: GraphQLContext) {
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

  async exportTemplate(_: GraphQLParent, args: any, _context?: GraphQLContext) {
    this.logger.info('Executing mutation: exportTemplate', {
      templateId: args.templateId,
      templateIdentifier: args.templateIdentifier,
    })

    try {
      // 인수 검증 - ID 또는 식별자 중 하나는 필수

      // ID 또는 식별자 중 하나는 필수
      if (!args.templateId && !args.templateIdentifier) {
        throw new Error('Either templateId or templateIdentifier is required')
      }

      const exportResult = await this.exportTemplateUseCase.execute({
        templateId: args.templateId,
        templateIdentifier: args.templateIdentifier,
        options: {
          includeStatistics: args.includeStatistics,
          includeMetadata: true,
          prettyPrint: true,
        },
      })

      this.logger.info('Export result from use case', {
        success: exportResult.success,
        hasExportData: !!exportResult.exportData,
        filename: exportResult.filename,
        errors: exportResult.errors,
      })

      if (!exportResult.success) {
        return {
          success: false,
          exportData: null,
          filename: null,
          errors: exportResult.errors.map((error) => ({ message: error })),
        }
      }

      const jsonData = JSON.stringify(exportResult.exportData, null, 2)
      this.logger.info('Processed export data', {
        jsonDataLength: jsonData.length,
        filename: exportResult.filename,
      })

      const result = {
        success: true,
        exportData: jsonData,
        filename: exportResult.filename,
        errors: [],
      }

      this.logger.info('Mutation completed: exportTemplate', { filename: exportResult.filename })
      return result
    } catch (error) {
      this.logger.error('Mutation failed: exportTemplate', { error })
      return {
        success: false,
        exportData: null,
        filename: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown export error',
            code: 'EXPORT_ERROR',
          },
        ],
      }
    }
  }

  async importTemplate(_: GraphQLParent, args: any, _context?: GraphQLContext) {
    this.logger.info('Executing mutation: importTemplate', { hasJsonData: !!args.jsonData })

    try {
      // 인수 검증
      if (!args.jsonData) {
        throw new Error('JSON data is required')
      }

      const importResult = await this.importTemplateUseCase.execute({
        jsonString: args.jsonData,
        options: {
          overwriteExisting: args.overwriteExisting,
          generateNewIdentifier: args.generateNewIdentifier,
          newIdentifierPrefix: args.newIdentifierPrefix,
        },
      })

      const result = {
        success: importResult.success,
        template: importResult.template
          ? {
              id: importResult.template.id,
              identifier: importResult.template.identifier,
              name: importResult.template.name,
            }
          : null,
        errors: importResult.errors.map((error) => ({ message: error, code: 'IMPORT_ERROR' })),
        warnings: importResult.warnings,
      }

      this.logger.info('Mutation completed: importTemplate', { success: importResult.success })
      return result
    } catch (error) {
      this.logger.error('Mutation failed: importTemplate', { error })
      return {
        success: false,
        template: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown import error',
            code: 'IMPORT_ERROR',
          },
        ],
        warnings: [],
      }
    }
  }

  async updateTemplateQuery(
    _: any,
    args: {
      templateId?: string
      templateIdentifier?: string
      newQuery: string
      updateVariables?: Record<string, unknown>
    }
  ): Promise<{
    success: boolean
    template?: any
    errors: Array<{ message: string }>
    previousQuery?: string
  }> {
    this.logger.info('Executing mutation: updateTemplateQuery', {
      templateId: args.templateId,
      templateIdentifier: args.templateIdentifier,
    })

    try {
      // Find template by ID or identifier
      let template = null

      if (args.templateId) {
        template = await this.queryTemplateRepository.findById(args.templateId)
      } else if (args.templateIdentifier) {
        template = await this.queryTemplateRepository.findByIdentifier(args.templateIdentifier)
      }

      if (!template) {
        return {
          success: false,
          errors: [{ message: 'Template not found' }],
        }
      }

      // Store previous query for rollback if needed
      const previousQuery = template.getQueryText()

      // Update the query
      const updateData: any = {
        queryText: args.newQuery,
      }

      if (args.updateVariables) {
        updateData.defaultVariables = args.updateVariables
      }

      const templateId = template.getId()
      if (!templateId) {
        throw new Error('Template ID is required for update')
      }

      const updatedTemplate = await this.queryTemplateRepository.update(templateId, updateData)

      this.logger.info('Template query updated successfully', {
        templateId: updatedTemplate.getId(),
        identifier: updatedTemplate.getIdentifier(),
      })

      return {
        success: true,
        template: updatedTemplate,
        errors: [],
        previousQuery,
      }
    } catch (error) {
      this.logger.error('Mutation failed: updateTemplateQuery', { error })
      return {
        success: false,
        errors: [{ message: error instanceof Error ? error.message : 'Unknown error' }],
      }
    }
  }

  setSchema(schema: GraphQLSchema) {
    ;(this as any).schema = schema
  }
}

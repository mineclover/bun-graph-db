import type { DocumentNode, ExecutionResult, GraphQLSchema } from 'graphql'
import { execute, parse } from 'graphql'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { ExecuteQueryTemplateUseCase } from './ExecuteQueryTemplate.js'

export interface ExecuteTemplateWithGraphQLInput {
  templateIdentifier: string
  variables?: Record<string, unknown>
  trackUsage?: boolean
  context?: Record<string, unknown>
}

export interface ExecuteTemplateWithGraphQLOutput {
  success: boolean
  data?: ExecutionResult['data']
  errors?: Array<{
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: Array<string | number>
    extensions?: Record<string, unknown>
  }>
  metadata: {
    templateId: string
    templateName: string
    complexityScore: number
    estimatedTokens?: number
    version: string
    executionTime: number
  }
}

export class ExecuteTemplateWithGraphQLUseCase {
  constructor(
    private readonly executeQueryTemplateUseCase: ExecuteQueryTemplateUseCase,
    private readonly schema: GraphQLSchema,
    private readonly logger: ILogger,
  ) {}

  async execute(input: ExecuteTemplateWithGraphQLInput): Promise<ExecuteTemplateWithGraphQLOutput> {
    const startTime = Date.now()

    this.logger.info('Executing template with GraphQL', {
      identifier: input.templateIdentifier,
      hasVariables: !!input.variables,
    })

    try {
      // 1. 템플릿 준비 및 변수 처리
      const templateResult = await this.executeQueryTemplateUseCase.execute({
        templateIdentifier: input.templateIdentifier,
        variables: input.variables,
        trackUsage: input.trackUsage,
      })

      // 2. GraphQL 쿼리 파싱
      let document: DocumentNode
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
              extensions: { code: 'GRAPHQL_PARSE_ERROR' },
            },
          ],
          metadata: {
            ...templateResult.metadata,
            executionTime: Date.now() - startTime,
          },
        }
      }

      // 3. GraphQL 실행
      const executionResult: ExecutionResult = await execute({
        schema: this.schema,
        document,
        variableValues: templateResult.processedVariables,
        contextValue: input.context || {},
      })

      // 4. 결과 처리
      const executionTime = Date.now() - startTime

      if (executionResult.errors && executionResult.errors.length > 0) {
        this.logger.warn('GraphQL execution errors', {
          identifier: input.templateIdentifier,
          errors: executionResult.errors.map((err) => err.message),
        })

        return {
          success: false,
          data: executionResult.data,
          errors: executionResult.errors.map((error) => ({
            message: error.message,
            locations: error.locations ? [...error.locations] : undefined,
            path: error.path ? [...error.path] : undefined,
            extensions: error.extensions,
          })),
          metadata: {
            ...templateResult.metadata,
            executionTime,
          },
        }
      }

      this.logger.info('Template executed successfully', {
        identifier: input.templateIdentifier,
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
    } catch (error) {
      const executionTime = Date.now() - startTime

      this.logger.error('Template execution failed', {
        identifier: input.templateIdentifier,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      })

      return {
        success: false,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Template execution failed',
            extensions: { code: 'TEMPLATE_EXECUTION_ERROR' },
          },
        ],
        metadata: {
          templateId: 'unknown',
          templateName: 'unknown',
          complexityScore: 0,
          version: 'unknown',
          executionTime,
        },
      }
    }
  }
}

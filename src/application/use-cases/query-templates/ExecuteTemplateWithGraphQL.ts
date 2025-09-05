import type { ExecutionResult, GraphQLSchema } from 'graphql'
import { execute, parse } from 'graphql'
import type { ILogger } from '@/application/ports/ILogger.js'
import { ValidationException } from '@/shared/exceptions/DomainException.js'
import type { ExecuteQueryTemplateUseCase } from './ExecuteQueryTemplate.js'

export interface ExecuteTemplateWithGraphQLInput {
  templateIdentifier: string
  variables?: Record<string, unknown>
  trackUsage?: boolean
  context?: any
}

export interface ExecuteTemplateWithGraphQLOutput {
  success: boolean
  data?: any
  errors?: Array<{
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: Array<string | number>
    extensions?: any
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
    private readonly logger: ILogger
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

  /**
   * 템플릿의 쿼리 유형을 확인하여 적절한 실행 방법을 결정
   */
  private getOperationType(queryText: string): 'query' | 'mutation' | 'subscription' | 'unknown' {
    const trimmed = queryText.trim().toLowerCase()

    if (trimmed.startsWith('query')) return 'query'
    if (trimmed.startsWith('mutation')) return 'mutation'
    if (trimmed.startsWith('subscription')) return 'subscription'
    if (trimmed.startsWith('{')) return 'query' // Shorthand query syntax

    return 'unknown'
  }

  /**
   * 쿼리 복잡도 분석 (간단한 구현)
   */
  private analyzeQueryComplexity(queryText: string): number {
    const lines = queryText.split('\n').length
    const nestedBraces = (queryText.match(/\{/g) || []).length
    const fields = (queryText.match(/\w+\s*\{/g) || []).length

    return Math.min(10, Math.ceil((lines + nestedBraces + fields) / 10))
  }
}

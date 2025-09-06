import type { GraphQLSchema } from 'graphql'
import { execute, parse } from 'graphql'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { ExecuteQueryTemplateUseCase } from './ExecuteQueryTemplate.js'

export interface ExecuteTemplateStreamInput {
  templateIdentifier: string
  variables?: Record<string, unknown>
  trackUsage?: boolean
  context?: any
}

export interface TemplateExecutionStreamEvent {
  status: 'STARTING' | 'IN_PROGRESS' | 'COMPLETED' | 'ERROR'
  data?: any
  progress?: number
  metadata: {
    templateId: string
    templateName: string
    complexityScore: number
    estimatedTokens?: number
    version: string
    executionTime: number
  }
  timestamp: Date
  error?: string
}

export class ExecuteTemplateWithSubscriptionUseCase {
  constructor(
    private readonly executeQueryTemplateUseCase: ExecuteQueryTemplateUseCase,
    private readonly schema: GraphQLSchema,
    private readonly logger: ILogger
  ) {}

  async *execute(input: ExecuteTemplateStreamInput): AsyncIterableIterator<TemplateExecutionStreamEvent> {
    const startTime = Date.now()

    this.logger.info('Starting template stream execution', {
      identifier: input.templateIdentifier,
      hasVariables: !!input.variables,
    })

    // 시작 이벤트 발생
    yield {
      status: 'STARTING',
      metadata: {
        templateId: 'unknown',
        templateName: 'unknown',
        complexityScore: 0,
        version: 'unknown',
        executionTime: 0,
      },
      timestamp: new Date(),
      progress: 0,
    }

    try {
      // 1. 템플릿 준비 및 변수 처리
      const templateResult = await this.executeQueryTemplateUseCase.execute({
        templateIdentifier: input.templateIdentifier,
        variables: input.variables,
        trackUsage: input.trackUsage,
      })

      // 진행 상황 업데이트
      yield {
        status: 'IN_PROGRESS',
        metadata: {
          ...templateResult.metadata,
          executionTime: Date.now() - startTime,
        },
        timestamp: new Date(),
        progress: 0.3,
      }

      // 2. GraphQL 쿼리 파싱
      let document
      try {
        document = parse(templateResult.queryText)
      } catch (parseError) {
        this.logger.error('GraphQL query parse error', {
          error: parseError,
          queryText: templateResult.queryText,
        })

        yield {
          status: 'ERROR',
          error: `Invalid GraphQL query: ${parseError instanceof Error ? parseError.message : 'Parse error'}`,
          metadata: {
            ...templateResult.metadata,
            executionTime: Date.now() - startTime,
          },
          timestamp: new Date(),
        }
        return
      }

      // 진행 상황 업데이트
      yield {
        status: 'IN_PROGRESS',
        metadata: {
          ...templateResult.metadata,
          executionTime: Date.now() - startTime,
        },
        timestamp: new Date(),
        progress: 0.6,
      }

      // 3. GraphQL 실행
      const executionResult = await execute({
        schema: this.schema,
        document,
        variableValues: templateResult.processedVariables,
        contextValue: input.context || {},
      })

      const executionTime = Date.now() - startTime

      // 4. 결과 처리 및 최종 이벤트
      if (executionResult.errors && executionResult.errors.length > 0) {
        this.logger.warn('GraphQL execution errors', {
          identifier: input.templateIdentifier,
          errors: executionResult.errors.map((err) => err.message),
        })

        yield {
          status: 'ERROR',
          data: executionResult.data,
          error: executionResult.errors.map((err) => err.message).join('; '),
          metadata: {
            ...templateResult.metadata,
            executionTime,
          },
          timestamp: new Date(),
        }
      } else {
        this.logger.info('Template stream executed successfully', {
          identifier: input.templateIdentifier,
          executionTime,
          hasData: !!executionResult.data,
        })

        yield {
          status: 'COMPLETED',
          data: executionResult.data,
          metadata: {
            ...templateResult.metadata,
            executionTime,
          },
          timestamp: new Date(),
          progress: 1.0,
        }
      }
    } catch (error) {
      const executionTime = Date.now() - startTime

      this.logger.error('Template stream execution failed', {
        identifier: input.templateIdentifier,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      })

      yield {
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Template execution failed',
        metadata: {
          templateId: 'unknown',
          templateName: 'unknown',
          complexityScore: 0,
          version: 'unknown',
          executionTime,
        },
        timestamp: new Date(),
      }
    }
  }

  /**
   * Subscription을 위한 특별한 스트리밍 실행 방식
   * 대용량 결과나 장기 실행 쿼리의 경우 청크 단위로 스트리밍
   */
  async *executeWithChunking(
    input: ExecuteTemplateStreamInput,
    chunkSize = 100
  ): AsyncIterableIterator<TemplateExecutionStreamEvent> {
    const generator = this.execute(input)

    for await (const event of generator) {
      // 대용량 데이터의 경우 청크로 분할하여 전송
      if (event.status === 'COMPLETED' && event.data && Array.isArray(event.data)) {
        const chunks = this.chunkArray(event.data, chunkSize)
        
        for (let i = 0; i < chunks.length; i++) {
          const isLastChunk = i === chunks.length - 1
          
          yield {
            ...event,
            status: isLastChunk ? 'COMPLETED' : 'IN_PROGRESS',
            data: chunks[i],
            progress: isLastChunk ? 1.0 : (i + 1) / chunks.length,
            timestamp: new Date(),
          }

          // 청크 간 작은 지연으로 백프레셔 방지
          if (!isLastChunk) {
            await this.delay(10)
          }
        }
      } else {
        yield event
      }
    }
  }

  /**
   * 배열을 청크 단위로 분할
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * 지연 함수
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
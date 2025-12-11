import type { ILogger } from '@/application/ports/ILogger.js'
import type { ExecuteTemplateWithGraphQLUseCase } from './ExecuteTemplateWithGraphQL.js'

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
    version: string
    executionTime: number
  }
  timestamp?: Date
  error?: string
}

export class ExecuteTemplateWithSubscriptionUseCase {
  constructor(
    private readonly executeTemplateWithGraphQLUseCase: ExecuteTemplateWithGraphQLUseCase,
    private readonly logger: ILogger,
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
      progress: 0.0,
    }

    try {
      // 진행 상황: 템플릿 실행 시작
      yield {
        status: 'IN_PROGRESS',
        metadata: {
          templateId: 'unknown',
          templateName: 'unknown',
          complexityScore: 0,
          version: 'unknown',
          executionTime: Date.now() - startTime,
        },
        timestamp: new Date(),
        progress: 0.3,
      }

      // ExecuteTemplateWithGraphQLUseCase를 활용하여 실행
      const templateResult = await this.executeTemplateWithGraphQLUseCase.execute({
        templateIdentifier: input.templateIdentifier,
        variables: input.variables || {},
        trackUsage: input.trackUsage || true,
        context: input.context,
      })

      const executionTime = Date.now() - startTime

      if (!templateResult.success) {
        this.logger.error('Template stream execution failed', {
          identifier: input.templateIdentifier,
          error: templateResult.errors?.[0]?.message || 'Unknown error',
          executionTime,
        })

        yield {
          status: 'ERROR',
          error: templateResult.errors?.[0]?.message || 'Template execution failed',
          metadata: {
            templateId: templateResult.metadata?.templateId || 'unknown',
            templateName: templateResult.metadata?.templateName || 'unknown',
            complexityScore: templateResult.metadata?.complexityScore || 0,
            version: templateResult.metadata?.version || 'unknown',
            executionTime,
          },
          timestamp: new Date(),
        }
        return
      }

      // 진행 상황: 거의 완료
      yield {
        status: 'IN_PROGRESS',
        metadata: {
          ...templateResult.metadata,
          executionTime,
        },
        timestamp: new Date(),
        progress: 0.8,
      }

      this.logger.info('Template stream executed successfully', {
        identifier: input.templateIdentifier,
        executionTime,
        hasData: !!templateResult.data,
      })

      // 데이터 청킹 처리
      const processedData = this.processDataInChunks(templateResult.data)

      // 성공 완료 이벤트
      yield {
        status: 'COMPLETED',
        data: processedData,
        metadata: {
          ...templateResult.metadata,
          executionTime,
        },
        timestamp: new Date(),
        progress: 1.0,
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
        error: error instanceof Error ? error.message : 'Unknown execution error',
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

  // 데이터를 청크 단위로 처리하는 헬퍼 메서드
  private processDataInChunks(data: any, chunkSize = 1000): any {
    if (!data || typeof data !== 'object') {
      return data
    }

    // 배열 데이터를 청크로 나누기
    if (Array.isArray(data)) {
      const chunks = []
      for (let i = 0; i < data.length; i += chunkSize) {
        chunks.push(data.slice(i, i + chunkSize))
      }
      return { chunks, totalItems: data.length }
    }

    // 객체 데이터는 그대로 반환 (추후 확장 가능)
    return data
  }
}

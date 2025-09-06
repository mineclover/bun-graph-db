import type { GraphQLSchema } from 'graphql'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { 
  ExecuteTemplateWithSubscriptionUseCase,
  ExecuteTemplateStreamInput,
  TemplateExecutionStreamEvent 
} from '@/application/use-cases/query-templates/ExecuteTemplateWithSubscriptionUseCase.js'
import { ValidationException } from '@/shared/exceptions/DomainException.js'

export interface SubscriptionContext {
  connectionParams?: Record<string, unknown>
  extra?: Record<string, unknown>
}

export interface ExecuteTemplateStreamArgs {
  templateIdentifier: string
  variables?: Record<string, unknown>
  trackUsage?: boolean
}

export class TemplateSubscriptionResolver {
  constructor(
    private readonly executeTemplateWithSubscriptionUseCase: ExecuteTemplateWithSubscriptionUseCase,
    private readonly logger: ILogger
  ) {}

  /**
   * GraphQL Subscription: executeTemplateStream
   * 템플릿을 실행하고 결과를 실시간으로 스트리밍
   */
  async executeTemplateStream(
    args: ExecuteTemplateStreamArgs,
    context: SubscriptionContext
  ): Promise<AsyncIterableIterator<TemplateExecutionStreamEvent>> {
    this.logger.info('Template stream subscription started', {
      templateIdentifier: args.templateIdentifier,
      hasVariables: !!args.variables,
      trackUsage: args.trackUsage,
    })

    // 입력 검증
    if (!args.templateIdentifier || args.templateIdentifier.trim().length === 0) {
      throw new ValidationException('Template identifier is required')
    }

    // UseCase 입력 준비
    const input: ExecuteTemplateStreamInput = {
      templateIdentifier: args.templateIdentifier.trim(),
      variables: args.variables || {},
      trackUsage: args.trackUsage !== false, // 기본값: true
      context: this.buildExecutionContext(context),
    }

    try {
      // 스트리밍 실행
      return this.executeTemplateWithSubscriptionUseCase.execute(input)
    } catch (error) {
      this.logger.error('Template stream subscription failed to start', {
        templateIdentifier: args.templateIdentifier,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      
      // 에러를 비동기 이터레이터로 래핑하여 반환
      return this.createErrorStream(
        error instanceof Error ? error.message : 'Unknown error occurred',
        args.templateIdentifier
      )
    }
  }

  /**
   * 대용량 데이터 처리를 위한 청킹 스트림
   */
  async executeTemplateStreamWithChunking(
    args: ExecuteTemplateStreamArgs & { chunkSize?: number },
    context: SubscriptionContext
  ): Promise<AsyncIterableIterator<TemplateExecutionStreamEvent>> {
    this.logger.info('Template chunked stream subscription started', {
      templateIdentifier: args.templateIdentifier,
      chunkSize: args.chunkSize || 100,
    })

    const input: ExecuteTemplateStreamInput = {
      templateIdentifier: args.templateIdentifier.trim(),
      variables: args.variables || {},
      trackUsage: args.trackUsage !== false,
      context: this.buildExecutionContext(context),
    }

    try {
      return this.executeTemplateWithSubscriptionUseCase.executeWithChunking(
        input,
        args.chunkSize || 100
      )
    } catch (error) {
      this.logger.error('Template chunked stream subscription failed to start', {
        templateIdentifier: args.templateIdentifier,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return this.createErrorStream(
        error instanceof Error ? error.message : 'Unknown error occurred',
        args.templateIdentifier
      )
    }
  }

  /**
   * 실행 컨텍스트 빌드
   */
  private buildExecutionContext(context: SubscriptionContext): Record<string, unknown> {
    return {
      // Subscription 특화 컨텍스트 정보
      subscriptionContext: true,
      connectionParams: context.connectionParams || {},
      timestamp: new Date(),
      // 추가 컨텍스트 정보
      ...context.extra,
    }
  }

  /**
   * 에러 스트림 생성
   * 구독 시작 시 에러가 발생한 경우 에러 이벤트를 스트리밍
   */
  private async *createErrorStream(
    errorMessage: string,
    templateIdentifier: string
  ): AsyncIterableIterator<TemplateExecutionStreamEvent> {
    yield {
      status: 'ERROR',
      error: errorMessage,
      metadata: {
        templateId: 'unknown',
        templateName: templateIdentifier,
        complexityScore: 0,
        version: 'unknown',
        executionTime: 0,
      },
      timestamp: new Date(),
    }
  }
}

/**
 * GraphQL Subscription 리졸버 맵
 */
export const templateSubscriptionResolvers = {
  Subscription: {
    executeTemplateStream: {
      // GraphQL Subscription 리졸버 함수
      subscribe: async (
        _: unknown,
        args: ExecuteTemplateStreamArgs,
        context: SubscriptionContext
      ) => {
        // DI 컨테이너에서 리졸버 인스턴스 가져오기
        // 실제 구현에서는 DI 컨테이너를 통해 주입받아야 함
        const resolver = context.extra?.templateSubscriptionResolver as TemplateSubscriptionResolver
        
        if (!resolver) {
          throw new Error('TemplateSubscriptionResolver not found in context')
        }

        return resolver.executeTemplateStream(args, context)
      },
    },
  },
}
import type { ILogger } from '@/application/ports/ILogger.js'
import type { GraphQLContext } from '@/core/types/GraphQLTypes.js'
import type {
  GraphQLError,
  PerformanceMetrics,
  ResolverContext,
  StandardMutationResult,
  StandardQueryResult,
} from '@/presentation/graphql/types/StandardTypes.js'
import { DomainException, ValidationException } from '@/shared/exceptions/DomainException.js'

export abstract class BaseResolver {
  protected abstract logger: ILogger
  private performanceMetrics: PerformanceMetrics[] = []

  /**
   * Handle GraphQL Query operations with standardized error handling and logging
   */
  protected async handleQuery<T>(
    operation: () => Promise<T>,
    context: string,
    operationDetails?: Record<string, unknown>
  ): Promise<T> {
    const startTime = Date.now()
    let success = true
    let errorCode: string | undefined

    try {
      this.logger.info(`Executing query: ${context}`, operationDetails)

      const result = await operation()

      const duration = Date.now() - startTime
      this.logger.info(`Query completed: ${context}`, {
        duration: `${duration}ms`,
        ...operationDetails,
      })

      // Record performance metrics
      this.recordPerformanceMetric({
        operationType: 'query',
        operationName: context,
        duration,
        success: true,
      })

      return result
    } catch (error) {
      success = false
      errorCode = this.extractErrorCode(error)

      this.logger.error(`Query failed: ${context}`, {
        error,
        ...operationDetails,
      })

      // Record performance metrics for failed operations
      const duration = Date.now() - startTime
      this.recordPerformanceMetric({
        operationType: 'query',
        operationName: context,
        duration,
        success: false,
        errorCode,
      })

      // Re-throw for GraphQL to handle (queries typically throw errors)
      throw this.mapToGraphQLError(error, context)
    }
  }

  /**
   * Handle GraphQL Mutation operations with standardized response structure
   */
  protected async handleMutation<T>(
    operation: () => Promise<T>,
    context: string,
    operationDetails?: Record<string, unknown>
  ): Promise<StandardMutationResult<T>> {
    try {
      this.logger.info(`Executing mutation: ${context}`, operationDetails)
      const startTime = Date.now()

      const result = await operation()

      const duration = Date.now() - startTime
      this.logger.info(`Mutation completed: ${context}`, {
        duration: `${duration}ms`,
        ...operationDetails,
      })

      return {
        success: true,
        data: result,
        errors: [],
      }
    } catch (error) {
      this.logger.error(`Mutation failed: ${context}`, {
        error,
        ...operationDetails,
      })

      return {
        success: false,
        data: null,
        errors: [this.mapToGraphQLError(error, context)],
      }
    }
  }

  /**
   * Handle GraphQL Field Resolution with performance tracking
   */
  protected async handleFieldResolution<T>(
    operation: () => Promise<T>,
    fieldName: string,
    parentType: string,
    operationDetails?: Record<string, unknown>
  ): Promise<T | null> {
    try {
      const context = `${parentType}.${fieldName}`
      this.logger.debug(`Resolving field: ${context}`, operationDetails)

      const result = await operation()

      this.logger.debug(`Field resolved: ${context}`, operationDetails)
      return result
    } catch (error) {
      const context = `${parentType}.${fieldName}`
      this.logger.error(`Field resolution failed: ${context}`, {
        error,
        ...operationDetails,
      })

      // Field resolvers typically return null on error rather than throwing
      return null
    }
  }

  /**
   * Validate GraphQL arguments with detailed error reporting
   */
  protected validateArgs<T>(
    args: T,
    validationRules: Array<(args: T) => void>,
    context: string
  ): void {
    for (const rule of validationRules) {
      try {
        rule(args)
      } catch (error) {
        this.logger.warn(`Argument validation failed: ${context}`, { error, args })
        throw new ValidationException(
          `Invalid arguments for ${context}: ${error instanceof Error ? error.message : 'Unknown validation error'}`,
          { code: 'INVALID_ARGUMENTS', context, args }
        )
      }
    }
  }

  /**
   * Extract and validate GraphQL context
   */
  protected extractContext(context?: GraphQLContext): GraphQLContext {
    if (!context) {
      return {
        requestId: this.generateRequestId(),
        startTime: new Date(),
      }
    }
    return context
  }

  /**
   * Map domain/application exceptions to GraphQL errors
   */
  protected mapToGraphQLError(error: unknown, context: string): GraphQLError {
    if (error instanceof DomainException) {
      return {
        message: error.message,
        code: error.code,
        extensions: {
          type: 'DOMAIN_ERROR',
          context,
          details: error.context,
        },
      }
    }

    if (error instanceof ValidationException) {
      return {
        message: error.message,
        code: error.code,
        extensions: {
          type: 'APPLICATION_ERROR',
          context,
          details: error.context,
        },
      }
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        code: 'INTERNAL_ERROR',
        extensions: {
          type: 'SYSTEM_ERROR',
          context,
          originalError: error.name,
        },
      }
    }

    return {
      message: 'An unknown error occurred',
      code: 'UNKNOWN_ERROR',
      extensions: {
        type: 'UNKNOWN_ERROR',
        context,
      },
    }
  }

  /**
   * Generate unique request ID for tracing
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Record performance metrics
   */
  private recordPerformanceMetric(metric: PerformanceMetrics): void {
    this.performanceMetrics.push(metric)

    // Log slow operations (>1000ms)
    if (metric.duration > 1000) {
      this.logger.warn(`Slow ${metric.operationType} operation detected`, {
        operation: metric.operationName,
        duration: `${metric.duration}ms`,
        success: metric.success,
        errorCode: metric.errorCode,
      })
    }

    // Keep only last 100 metrics to prevent memory leaks
    if (this.performanceMetrics.length > 100) {
      this.performanceMetrics.shift()
    }
  }

  /**
   * Extract error code from exception
   */
  private extractErrorCode(error: unknown): string {
    if (error instanceof DomainException || error instanceof ValidationException) {
      return error.code
    }
    if (error instanceof Error) {
      return error.name
    }
    return 'UNKNOWN_ERROR'
  }

  /**
   * Get performance metrics for monitoring
   */
  protected getPerformanceMetrics(): PerformanceMetrics[] {
    return [...this.performanceMetrics]
  }

  /**
   * Clear performance metrics
   */
  protected clearPerformanceMetrics(): void {
    this.performanceMetrics = []
  }

  /**
   * Get average response time for specific operation
   */
  protected getAverageResponseTime(operationName: string): number {
    const metrics = this.performanceMetrics.filter((m) => m.operationName === operationName)
    if (metrics.length === 0) return 0

    const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0)
    return totalDuration / metrics.length
  }

  /**
   * Helper method to get nested object values
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * Common validation rules for reuse across resolvers
   */
  protected static validationRules = {
    required:
      <T>(field: string, fieldName: string) =>
      (args: T): void => {
        // Handle nested field access like 'input.identifier'
        const value = BaseResolver.getNestedValue(args, field)
        if (!value) {
          console.log(`Validation failed for field: ${field}`, { args, value })
          throw new Error(`${fieldName} is required`)
        }
      },

    nonEmpty:
      <T>(field: string, fieldName: string) =>
      (args: T): void => {
        const value = BaseResolver.getNestedValue(args, field)
        if (typeof value === 'string' && value.trim().length === 0) {
          throw new Error(`${fieldName} cannot be empty`)
        }
      },

    minLength:
      <T>(field: keyof T, minLength: number, fieldName: string) =>
      (args: T): void => {
        const value = args[field]
        if (typeof value === 'string' && value.length < minLength) {
          throw new Error(`${fieldName} must be at least ${minLength} characters`)
        }
      },

    maxLength:
      <T>(field: keyof T, maxLength: number, fieldName: string) =>
      (args: T): void => {
        const value = args[field]
        if (typeof value === 'string' && value.length > maxLength) {
          throw new Error(`${fieldName} cannot exceed ${maxLength} characters`)
        }
      },

    positiveNumber:
      <T>(field: keyof T, fieldName: string) =>
      (args: T): void => {
        const value = args[field]
        if (typeof value === 'number' && value <= 0) {
          throw new Error(`${fieldName} must be a positive number`)
        }
      },

    validEnum:
      <T>(field: keyof T, validValues: readonly string[], fieldName: string) =>
      (args: T): void => {
        const value = args[field]
        if (typeof value === 'string' && !validValues.includes(value)) {
          throw new Error(`${fieldName} must be one of: ${validValues.join(', ')}`)
        }
      },
  }
}

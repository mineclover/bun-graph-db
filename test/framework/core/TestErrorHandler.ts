import type { ITestErrorHandler } from '../interfaces/ITestFramework.js'

/**
 * Test Error Handler
 * 테스트에서의 안전한 에러 처리와 null safety 보장
 */
export class TestErrorHandler implements ITestErrorHandler {
  assertNonNull<T>(value: T | null | undefined, message?: string): asserts value is T {
    if (value === null || value === undefined) {
      const errorMessage = message || `Expected non-null value, but got ${value}`
      throw new AssertionError(errorMessage)
    }
  }

  safeUnwrap<T>(result: unknown): T {
    if (this.isGraphQLResponse(result)) {
      if (result.errors && result.errors.length > 0) {
        throw new GraphQLError(`GraphQL Error: ${result.errors[0].message}`)
      }
      
      if (!result.data) {
        throw new GraphQLError('GraphQL response missing data')
      }
      
      return result.data as T
    }

    if (this.isErrorResult(result)) {
      throw new TestError(`API Error: ${result.error}`)
    }

    if (result === null || result === undefined) {
      throw new TestError('Received null or undefined result')
    }

    return result as T
  }

  async expectError(
    fn: () => Promise<any>, 
    expectedErrorType?: string
  ): Promise<void> {
    try {
      await fn()
      throw new AssertionError('Expected function to throw, but it succeeded')
    } catch (error) {
      if (expectedErrorType) {
        if (error instanceof Error && error.constructor.name !== expectedErrorType) {
          throw new AssertionError(
            `Expected error type '${expectedErrorType}', but got '${error.constructor.name}'`
          )
        }
      }
      // Error was expected, test passes
    }
  }

  /**
   * Type-safe field extraction from GraphQL responses
   */
  extractField<T>(response: any, fieldPath: string): T {
    const fields = fieldPath.split('.')
    let current = response

    for (const field of fields) {
      if (!current || typeof current !== 'object') {
        throw new TestError(`Cannot access field '${field}' on ${typeof current}`)
      }
      
      if (!(field in current)) {
        throw new TestError(`Field '${field}' not found in response`)
      }
      
      current = current[field]
    }

    this.assertNonNull(current, `Field '${fieldPath}' is null or undefined`)
    return current as T
  }

  /**
   * Validate that a value matches expected type structure
   */
  validateType<T>(value: unknown, validator: (v: any) => v is T): T {
    if (!validator(value)) {
      throw new TestError(`Value does not match expected type structure`)
    }
    return value
  }

  private isGraphQLResponse(result: unknown): result is { data?: any; errors?: any[] } {
    return (
      typeof result === 'object' && 
      result !== null && 
      ('data' in result || 'errors' in result)
    )
  }

  private isErrorResult(result: unknown): result is { error: string } {
    return (
      typeof result === 'object' && 
      result !== null && 
      'error' in result
    )
  }
}

/**
 * Custom Error Classes
 */
export class AssertionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AssertionError'
  }
}

export class GraphQLError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GraphQLError'
  }
}

export class TestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TestError'
  }
}

/**
 * Type Guards for common test scenarios
 */
export class TypeGuards {
  static isString(value: unknown): value is string {
    return typeof value === 'string'
  }

  static isNumber(value: unknown): value is number {
    return typeof value === 'number' && !Number.isNaN(value)
  }

  static isArray<T>(value: unknown, itemGuard?: (item: unknown) => item is T): value is T[] {
    if (!Array.isArray(value)) return false
    if (itemGuard) {
      return value.every(itemGuard)
    }
    return true
  }

  static hasRequiredFields<T extends Record<string, any>>(
    value: unknown, 
    fields: (keyof T)[]
  ): value is T {
    if (typeof value !== 'object' || value === null) return false
    
    return fields.every(field => field in value)
  }
}
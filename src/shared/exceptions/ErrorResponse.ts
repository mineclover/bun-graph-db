import type { ErrorCode } from './DomainException.js'

/**
 * Standard error response structure
 * Used across GraphQL, REST, and MCP interfaces
 */
export interface ErrorResponse {
  /** Error code from ErrorCode enum */
  code: ErrorCode

  /** Human-readable error message */
  message: string

  /** Field that caused the error (for validation errors) */
  field?: string

  /** HTTP status code */
  statusCode: number

  /** Additional context for debugging */
  context?: Record<string, unknown>

  /** Timestamp when error occurred */
  timestamp: string

  /** Request ID for tracing */
  requestId?: string
}

/**
 * Factory function to create standardized error responses
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  options?: {
    field?: string
    statusCode?: number
    context?: Record<string, unknown>
    requestId?: string
  }
): ErrorResponse {
  return {
    code,
    message,
    field: options?.field,
    statusCode: options?.statusCode ?? 500,
    context: options?.context,
    timestamp: new Date().toISOString(),
    requestId: options?.requestId,
  }
}

/**
 * Convert BaseException to ErrorResponse
 */
export function exceptionToErrorResponse(error: Error, requestId?: string): ErrorResponse {
  // Check if it's a BaseException with code property
  if ('code' in error && 'statusCode' in error) {
    return createErrorResponse((error as any).code, error.message, {
      statusCode: (error as any).statusCode,
      context: (error as any).context,
      requestId,
    })
  }

  // Generic error
  return createErrorResponse(
    'INTERNAL_ERROR' as ErrorCode,
    error.message || 'An unexpected error occurred',
    {
      statusCode: 500,
      requestId,
    }
  )
}

/**
 * Format error for GraphQL response
 */
export function formatGraphQLError(error: ErrorResponse): {
  message: string
  code: string
  field?: string
} {
  return {
    message: error.message,
    code: error.code,
    field: error.field,
  }
}

/**
 * Format multiple errors for GraphQL response
 */
export function formatGraphQLErrors(errors: ErrorResponse[]): Array<{
  message: string
  code: string
  field?: string
}> {
  return errors.map(formatGraphQLError)
}

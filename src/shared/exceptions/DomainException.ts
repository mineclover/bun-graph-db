// Base exception class for all domain-related errors

/**
 * Standard error codes used across the application
 * Maps to HTTP status codes and provides consistent error identification
 */
export enum ErrorCode {
  /** Generic domain error (400) */
  DOMAIN_ERROR = 'DOMAIN_ERROR',

  /** Input validation error (422) */
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  /** Resource not found (404) */
  NOT_FOUND = 'NOT_FOUND',

  /** Resource conflict or duplicate (409) */
  CONFLICT = 'CONFLICT',

  /** Database operation error (500) */
  DATABASE_ERROR = 'DATABASE_ERROR',

  /** External service error (503) */
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',

  /** Unauthorized access (401) */
  UNAUTHORIZED = 'UNAUTHORIZED',

  /** Forbidden access (403) */
  FORBIDDEN = 'FORBIDDEN',

  /** Internal server error (500) */
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export abstract class BaseException extends Error {
  abstract readonly code: ErrorCode
  abstract readonly statusCode: number

  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class DomainException extends BaseException {
  readonly code = ErrorCode.DOMAIN_ERROR
  readonly statusCode = 400
}

export class ValidationException extends BaseException {
  readonly code = ErrorCode.VALIDATION_ERROR
  readonly statusCode = 422
}

export class NotFoundException extends BaseException {
  readonly code = ErrorCode.NOT_FOUND
  readonly statusCode = 404
}

export class ConflictException extends BaseException {
  readonly code = ErrorCode.CONFLICT
  readonly statusCode = 409
}

export class DatabaseException extends BaseException {
  readonly code = ErrorCode.DATABASE_ERROR
  readonly statusCode = 500
}

export class ExternalServiceException extends BaseException {
  readonly code = ErrorCode.EXTERNAL_SERVICE_ERROR
  readonly statusCode = 503
}

export class UnauthorizedException extends BaseException {
  readonly code = ErrorCode.UNAUTHORIZED
  readonly statusCode = 401
}

export class ForbiddenException extends BaseException {
  readonly code = ErrorCode.FORBIDDEN
  readonly statusCode = 403
}

export class InternalErrorException extends BaseException {
  readonly code = ErrorCode.INTERNAL_ERROR
  readonly statusCode = 500
}

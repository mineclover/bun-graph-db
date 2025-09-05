// Base exception class for all domain-related errors

export abstract class BaseException extends Error {
  abstract readonly code: string
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
  readonly code = 'DOMAIN_ERROR'
  readonly statusCode = 400
}

export class ValidationException extends BaseException {
  readonly code = 'VALIDATION_ERROR'
  readonly statusCode = 422
}

export class NotFoundException extends BaseException {
  readonly code = 'NOT_FOUND'
  readonly statusCode = 404
}

export class ConflictException extends BaseException {
  readonly code = 'CONFLICT'
  readonly statusCode = 409
}

export class DatabaseException extends BaseException {
  readonly code = 'DATABASE_ERROR'
  readonly statusCode = 500
}

export class ExternalServiceException extends BaseException {
  readonly code = 'EXTERNAL_SERVICE_ERROR'
  readonly statusCode = 503
}

import type { Response } from 'express'
import type { ILogger } from '@/application/ports/ILogger.js'
import { BaseException } from '@/shared/exceptions/DomainException.js'
import { toErrorMeta } from './errorHelpers.js'

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  errors?: Array<{ message: string; code?: string; field?: string }>
}

// Function-based response helpers for HTTP responses
// More functional approach without the need for class instantiation

export function sendSuccess<T>(res: Response, data: T): void {
  res.json({
    success: true,
    data,
  } satisfies ApiResponse<T>)
}

export function sendError(
  res: Response,
  logger: ILogger,
  statusCode: number,
  message: string,
  logContext?: string,
): void {
  if (logContext) {
    logger.error(logContext, { error: message })
  }

  res.status(statusCode).json({
    success: false,
    error: message,
  } satisfies ApiResponse)
}

export function sendHandleError(res: Response, logger: ILogger, error: unknown, operation: string): void {
  logger.error(`${operation} error:`, toErrorMeta(error))

  const message = error instanceof Error ? error.message : `${operation} failed`
  const statusCode = error instanceof BaseException ? error.statusCode : 500
  const code = error instanceof BaseException ? error.code : undefined

  res.status(statusCode).json({
    success: false,
    error: message,
    errors: code ? [{ message, code }] : undefined,
  } satisfies ApiResponse)
}

export function sendValidationError(res: Response, message: string, field?: string): void {
  res.status(400).json({
    success: false,
    error: message,
    errors: field ? [{ message, field }] : undefined,
  } satisfies ApiResponse)
}

export function sendNotFound(res: Response, resource: string): void {
  const message = `${resource} not found`
  res.status(404).json({
    success: false,
    error: message,
  } satisfies ApiResponse)
}

// Legacy class-based approach for backward compatibility (deprecated)
export class ResponseHelper {
  constructor(private readonly logger: ILogger) {}

  success<T>(res: Response, data: T): void {
    sendSuccess(res, data)
  }

  error(res: Response, statusCode: number, message: string, logContext?: string): void {
    sendError(res, this.logger, statusCode, message, logContext)
  }

  handleError(res: Response, error: unknown, operation: string): void {
    sendHandleError(res, this.logger, error, operation)
  }

  validationError(res: Response, message: string, field?: string): void {
    sendValidationError(res, message, field)
  }

  notFound(res: Response, resource: string): void {
    sendNotFound(res, resource)
  }
}

export function createResponseHelper(logger: ILogger): ResponseHelper {
  return new ResponseHelper(logger)
}

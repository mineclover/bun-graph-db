import type { ILogger } from '@/application/ports/ILogger.js'
import { isRestReadOnlyOperation } from '@/core/contracts/RestRouteContract.js'
import { createBunControllerContext, type HttpControllerHandler } from '../adapters/BunControllerAdapter.js'
import { sendHandleError } from '../utils/responseHelpers.js'

export interface HttpExecutionTelemetry {
  method: string
  path: string
  status: number
  durationMs: number
  isMutation: boolean
}

export interface HttpExecutionHooks {
  onMutationSuccess?: (telemetry: HttpExecutionTelemetry) => void | Promise<void>
  onRequestCompleted?: (telemetry: HttpExecutionTelemetry) => void | Promise<void>
}

/**
 * Around-advice execution pipeline for REST controller handlers:
 * adapts the Web Request/Response contract, guarantees unified Domain/BaseException
 * error mapping on unexpected throws, and emits post-execution mutation telemetry.
 */
export async function executeHttpController(
  request: Request,
  handler: HttpControllerHandler,
  params: Record<string, string>,
  logger: ILogger,
  hooks?: HttpExecutionHooks,
): Promise<Response> {
  const startedAt = Date.now()
  const pathname = new URL(request.url).pathname
  const context = await createBunControllerContext(request, params)

  try {
    await handler(context.request, context.response)
  } catch (error) {
    sendHandleError(context.response, logger, error, `${request.method} ${pathname}`)
  }

  const response = context.toResponse()
  const isMutation = !isRestReadOnlyOperation(request.method, pathname)
  const telemetry: HttpExecutionTelemetry = {
    method: request.method,
    path: pathname,
    status: response.status,
    durationMs: Math.max(0, Date.now() - startedAt),
    isMutation,
  }

  if (isMutation && response.status >= 200 && response.status < 300 && hooks?.onMutationSuccess) {
    try {
      await hooks.onMutationSuccess(telemetry)
    } catch (error) {
      logger.warn('HTTP post-mutation hook failed', {
        path: pathname,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (hooks?.onRequestCompleted) {
    try {
      await hooks.onRequestCompleted(telemetry)
    } catch (error) {
      logger.warn('HTTP telemetry hook failed', {
        path: pathname,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return response
}

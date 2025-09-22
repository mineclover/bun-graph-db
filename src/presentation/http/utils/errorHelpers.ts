// Error handling utilities for HTTP controllers

export function toErrorMeta(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  }

  if (typeof error === 'object' && error !== null) {
    return error as Record<string, unknown>
  }

  return {
    error: String(error)
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Unknown error occurred'
}
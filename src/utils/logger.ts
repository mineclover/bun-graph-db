export const logger = {
  info: (message: string, data?: unknown) => {
    console.log(
      `[INFO] ${new Date().toISOString()} - ${message}`,
      data ? JSON.stringify(data, null, 2) : ''
    )
  },

  error: (message: string, error?: unknown) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error)
  },

  warn: (message: string, data?: unknown) => {
    console.warn(
      `[WARN] ${new Date().toISOString()} - ${message}`,
      data ? JSON.stringify(data, null, 2) : ''
    )
  },

  debug: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(
        `[DEBUG] ${new Date().toISOString()} - ${message}`,
        data ? JSON.stringify(data, null, 2) : ''
      )
    }
  },
}

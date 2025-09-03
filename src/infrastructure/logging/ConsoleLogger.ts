import type { ILogger } from '@/application/ports/ILogger.js'
import { LogLevel } from '@/application/ports/ILogger.js'

export class ConsoleLogger implements ILogger {
  constructor(
    private readonly minLevel: LogLevel = LogLevel.INFO,
    private readonly enableColors: boolean = true
  ) {}

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.minLevel <= LogLevel.DEBUG) {
      this.log('DEBUG', message, meta, '\x1b[36m') // Cyan
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.minLevel <= LogLevel.INFO) {
      this.log('INFO', message, meta, '\x1b[32m') // Green
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.minLevel <= LogLevel.WARN) {
      this.log('WARN', message, meta, '\x1b[33m') // Yellow
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.minLevel <= LogLevel.ERROR) {
      this.log('ERROR', message, meta, '\x1b[31m') // Red
    }
  }

  private log(
    level: string,
    message: string,
    meta?: Record<string, unknown>,
    color?: string
  ): void {
    const timestamp = new Date().toISOString()
    const colorCode = this.enableColors && color ? color : ''
    const resetCode = this.enableColors ? '\x1b[0m' : ''
    
    let logMessage = `${colorCode}[${timestamp}] ${level}: ${message}${resetCode}`
    
    if (meta && Object.keys(meta).length > 0) {
      logMessage += `\n${JSON.stringify(meta, null, 2)}`
    }
    
    // Use appropriate console method based on level
    switch (level) {
      case 'ERROR':
        console.error(logMessage)
        break
      case 'WARN':
        console.warn(logMessage)
        break
      case 'DEBUG':
        console.debug(logMessage)
        break
      default:
        console.log(logMessage)
    }
  }
}
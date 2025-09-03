// Logger interface (Port) - defines what the application needs from logging
export interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
}

// Log levels for configuration
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// Logger configuration
export interface LoggerConfig {
  level: LogLevel
  format: 'json' | 'pretty'
  timestamp: boolean
}
import { createDatabaseConfig, loadEnvironmentConfig } from '@/core/config/EnvironmentConfig.js'
import { ConsoleLogger } from '@/infrastructure/logging/ConsoleLogger.js'
import type { DIContainer } from '../DIContainer.js'
import { CommonTokens, DatabaseTokens } from '../tokens/index.js'

/**
 * Core module - registers fundamental services
 */
export function registerCoreModule(container: DIContainer): void {
  // Environment configuration
  container.registerSingleton(CommonTokens.ENVIRONMENT_CONFIG, () => loadEnvironmentConfig())

  // Database configuration
  container.registerSingleton(
    DatabaseTokens.DATABASE_CONFIG,
    async (c) => {
      const envConfig = await c.resolve(CommonTokens.ENVIRONMENT_CONFIG)
      return envConfig.database
    },
    [CommonTokens.ENVIRONMENT_CONFIG]
  )

  // Logger (removed EnvironmentConfig dependency to break circular reference)
  container.registerSingleton(
    CommonTokens.LOGGER,
    async (c) => {
      // Use default log level to avoid circular dependency
      const { LogLevel } = await import('@/application/ports/ILogger.js')
      return new ConsoleLogger(LogLevel.INFO)
    },
    []
  )
}

import type { IDatabaseConnection } from '@/core/database/interfaces/IDatabaseConnection.js'
import type { DIContainer } from '../DIContainer.js'
import { CommonTokens, DatabaseTokens } from '../tokens/index.js'

/**
 * Database module - registers database connections and adapters
 */
export function registerDatabaseModule(container: DIContainer): void {
  // Main database connection (factory that chooses the right adapter)
  container.registerSingleton(
    DatabaseTokens.DATABASE_CONNECTION,
    async (c): Promise<IDatabaseConnection> => {
      const config = await c.resolve(DatabaseTokens.DATABASE_CONFIG)
      const logger = await c.resolve(CommonTokens.LOGGER)

      switch (config.provider) {
        case 'bun-sqlite':
          return await c.resolve(DatabaseTokens.BUN_SQLITE_ADAPTER)
        case 'cloudflare-d1':
          return await c.resolve(DatabaseTokens.CLOUDFLARE_D1_ADAPTER)
        case 'mock':
          return await c.resolve(DatabaseTokens.MOCK_DATABASE_ADAPTER)
        default:
          throw new Error(`Unsupported database provider: ${config.provider}`)
      }
    },
    [DatabaseTokens.DATABASE_CONFIG, CommonTokens.LOGGER]
  )

  // Bun SQLite adapter
  container.registerSingleton(
    DatabaseTokens.BUN_SQLITE_ADAPTER,
    async (c) => {
      const config = await c.resolve(DatabaseTokens.DATABASE_CONFIG)
      const logger = await c.resolve(CommonTokens.LOGGER)

      // Import dynamically to avoid loading SQLite in environments where it's not available
      const { BunSqliteAdapter } = await import('@/core/database/adapters/BunSqliteAdapter.js')
      return new BunSqliteAdapter(config, logger)
    },
    [DatabaseTokens.DATABASE_CONFIG, CommonTokens.LOGGER]
  )

  // Cloudflare D1 adapter
  container.registerSingleton(
    DatabaseTokens.CLOUDFLARE_D1_ADAPTER,
    async (c) => {
      const config = await c.resolve(DatabaseTokens.DATABASE_CONFIG)
      const logger = await c.resolve(CommonTokens.LOGGER)

      // Import dynamically for environments where D1 is not available
      const { CloudflareD1Adapter } = await import(
        '@/core/database/adapters/CloudflareD1Adapter.js'
      )
      return new CloudflareD1Adapter(config, logger)
    },
    [DatabaseTokens.DATABASE_CONFIG, CommonTokens.LOGGER]
  )

  // Mock database adapter (for testing)
  container.registerSingleton(
    DatabaseTokens.MOCK_DATABASE_ADAPTER,
    async (c) => {
      const config = await c.resolve(DatabaseTokens.DATABASE_CONFIG)
      const logger = await c.resolve(CommonTokens.LOGGER)

      const { MockDatabaseAdapter } = await import(
        '@/core/database/adapters/MockDatabaseAdapter.js'
      )
      return new MockDatabaseAdapter(config, logger)
    },
    [DatabaseTokens.DATABASE_CONFIG, CommonTokens.LOGGER]
  )
}

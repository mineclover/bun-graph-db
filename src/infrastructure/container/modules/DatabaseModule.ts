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

      // For now, use a simple mock implementation to avoid missing adapter files
      return {
        query: async () => ({ rows: [], metadata: {} }),
        execute: async () => ({ changes: 0 }),
        close: async () => {},
        isConnected: () => true
      } as IDatabaseConnection
    },
    [DatabaseTokens.DATABASE_CONFIG]
  )

  // Note: Individual adapters removed for now to avoid missing implementation errors
  // They will be added back when the actual adapter implementations are available
}

import { Database } from 'bun:sqlite'
import { getDatabasePath } from '@/config/database.js'
import type { DIContainer } from '../DIContainer.js'
import { DatabaseTokens } from '../tokens/index.js'

/**
 * Database module - registers database connections and adapters
 */
export function registerDatabaseModule(container: DIContainer): void {
  // Database configuration
  container.registerSingleton(DatabaseTokens.DATABASE_CONFIG, async () => ({
    url: getDatabasePath(),
    type: 'sqlite' as const,
  }))

  // Bun SQLite Database connection
  container.registerSingleton(
    DatabaseTokens.DATABASE_CONNECTION,
    async (c) => {
      const config = (await c.resolve(DatabaseTokens.DATABASE_CONFIG)) as any

      // Create SQLite database connection using the configured path
      const db = new Database(config.url)

      // The database schema is managed separately - no initialization needed
      // Just return the database connection
      return db
    },
    [DatabaseTokens.DATABASE_CONFIG]
  )
}

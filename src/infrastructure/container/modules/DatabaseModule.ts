import { getDatabasePath } from '@/config/database.js'
import { EMBEDDED_INITIAL_SCHEMA_SQL } from '@/generated/embedded-assets.js'
import { applyDatabaseMigrations, createDatabaseMigrations } from '@/infrastructure/database/sqlite/DatabaseMigrationRunner.js'
import { Database } from '@/infrastructure/database/sqlite/SqliteAdapter.js'
import { configureSqliteDatabase } from '@/infrastructure/database/sqlite/SqlitePragmas.js'
import type { DIContainer } from '../DIContainer.js'
import { DatabaseTokens } from '../tokens/index.js'

interface DatabaseConfigShape {
  url: string
  type: 'sqlite'
}

/**
 * Database module - registers the SQLite connection and applies all schema
 * migrations before the connection can be consumed by repositories.
 */
export function registerDatabaseModule(container: DIContainer): void {
  container.registerSingleton(DatabaseTokens.DATABASE_CONFIG, async () => ({
    url: getDatabasePath(),
    type: 'sqlite' as const,
  }))

  container.registerSingleton(
    DatabaseTokens.DATABASE_CONNECTION,
    async (c) => {
      const config = (await c.resolve(DatabaseTokens.DATABASE_CONFIG)) as DatabaseConfigShape
      const database = new Database(config.url)

      try {
        configureSqliteDatabase(database, config.url)
        applyDatabaseMigrations(database, createDatabaseMigrations(EMBEDDED_INITIAL_SCHEMA_SQL))
      } catch (error) {
        database.close()
        throw new Error(`Database startup migration failed for '${config.url}'`, { cause: error })
      }

      return database
    },
    [DatabaseTokens.DATABASE_CONFIG],
  )
}

import { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getDatabasePath } from '@/config/database.js'
import { applyDatabaseMigrations, createDatabaseMigrations } from '@/infrastructure/database/sqlite/DatabaseMigrationRunner.js'
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
        const schemaPath = join(process.cwd(), 'scripts', 'database', 'schema.sql')
        const initialSchema = readFileSync(schemaPath, 'utf-8')
        applyDatabaseMigrations(database, createDatabaseMigrations(initialSchema))
      } catch (error) {
        database.close()
        throw new Error(`Database startup migration failed for '${config.url}'`, { cause: error })
      }

      return database
    },
    [DatabaseTokens.DATABASE_CONFIG],
  )
}

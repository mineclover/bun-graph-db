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

      // Initialize schema if tables don't exist
      try {
        const { readFileSync } = await import('fs')
        const { join } = await import('path')
        
        // Enable foreign keys
        db.exec('PRAGMA foreign_keys = ON')
        
        // Check if tables exist
        const tableExists = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='tables'").get()
        
        if (!tableExists) {
          console.log('Initializing database schema...')
          const schemaPath = join(process.cwd(), 'scripts', 'database', 'schema.sql')
          const schema = readFileSync(schemaPath, 'utf-8')
          
          db.transaction(() => {
            db.exec(schema)
          })()
          console.log('Database schema initialized successfully')
        }
      } catch (error) {
        console.error('Failed to initialize database schema:', error)
      }

      return db
    },
    [DatabaseTokens.DATABASE_CONFIG]
  )
}

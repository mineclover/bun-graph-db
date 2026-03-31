import { Database } from 'bun:sqlite'
import { getDatabasePath } from '@/config/database.js'
import type { DIContainer } from '../DIContainer.js'
import { DatabaseTokens } from '../tokens/index.js'

interface DatabaseConfigShape {
  url: string
  type: 'sqlite'
}

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
      const config = (await c.resolve(DatabaseTokens.DATABASE_CONFIG)) as DatabaseConfigShape

      // Create SQLite database connection using the configured path
      const db = new Database(config.url)

      // Initialize schema if tables don't exist
      try {
        const { readFileSync } = await import('node:fs')
        const { join } = await import('node:path')

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

        const nodeColumns = db.query<{ name: string }, []>('PRAGMA table_info(nodes)').all()
        if (!nodeColumns.some((column) => column.name === 'metadata')) {
          db.exec('ALTER TABLE nodes ADD COLUMN metadata TEXT')
        }

        db.exec(`
          CREATE TABLE IF NOT EXISTS tabular_sync_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            config_key TEXT NOT NULL UNIQUE,
            config_json TEXT NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `)

        db.exec(`
          CREATE TABLE IF NOT EXISTS tabular_sync_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_identifier TEXT NOT NULL,
            mode TEXT NOT NULL,
            status TEXT NOT NULL,
            error_message TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `)
      } catch (error) {
        console.error('Failed to initialize database schema:', error)
      }

      return db
    },
    [DatabaseTokens.DATABASE_CONFIG],
  )
}

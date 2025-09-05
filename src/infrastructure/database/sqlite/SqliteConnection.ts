import { Database } from 'bun:sqlite'
import { readFileSync } from 'fs'
import { join } from 'path'
import { getDatabasePath } from '@/config/database.js'
import { DatabaseException } from '@/shared/exceptions/DomainException.js'

export class SqliteConnection {
  private static instance: SqliteConnection
  private db: Database | null = null

  private constructor() {}

  static getInstance(): SqliteConnection {
    if (!SqliteConnection.instance) {
      SqliteConnection.instance = new SqliteConnection()
    }
    return SqliteConnection.instance
  }

  getDatabase(): Database {
    if (!this.db) {
      this.connect()
    }
    return this.db!
  }

  private connect(): void {
    try {
      const dbPath = getDatabasePath()
      this.db = new Database(dbPath)

      // Enable foreign keys
      this.db.exec('PRAGMA foreign_keys = ON')

      // Set reasonable timeout
      this.db.exec('PRAGMA busy_timeout = 30000')

      // Initialize schema
      this.initializeSchema()
    } catch (error) {
      throw new DatabaseException(`Failed to connect to database: ${error}`)
    }
  }

  private initializeSchema(): void {
    try {
      // Read and execute schema file
      const schemaPath = join(process.cwd(), 'core', 'schema.sql')
      const schema = readFileSync(schemaPath, 'utf-8')

      // Execute schema in a transaction for safety
      this.db!.transaction(() => {
        this.db!.exec(schema)
      })()

      console.log('Database schema initialized successfully')
    } catch (error) {
      console.error('Failed to initialize database schema:', error)
      throw new DatabaseException(`Failed to initialize database schema: ${error}`)
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  // Health check
  isHealthy(): boolean {
    try {
      if (!this.db) return false

      const result = this.db.query('SELECT 1 as health').get()
      return result !== null
    } catch {
      return false
    }
  }

  // Transaction support
  transaction<T>(fn: () => T): T {
    if (!this.db) {
      throw new DatabaseException('Database not connected')
    }

    return this.db.transaction(fn)()
  }
}

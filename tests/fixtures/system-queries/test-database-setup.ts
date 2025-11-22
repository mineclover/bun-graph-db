/**
 * TestDatabase class for system query testing
 * Provides isolated database setup for testing environments
 */

import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export interface TestDatabaseOptions {
  name: string
  inMemory: boolean
  tempDir: string
}

export class TestDatabase {
  private db: Database | null = null
  private options: TestDatabaseOptions
  public path: string

  constructor(options: TestDatabaseOptions) {
    this.options = options

    if (options.inMemory) {
      this.path = ':memory:'
    } else {
      // Ensure temp directory exists
      if (!existsSync(options.tempDir)) {
        mkdirSync(options.tempDir, { recursive: true })
      }
      this.path = join(options.tempDir, `${options.name}.sqlite`)
    }
  }

  async setup(): Promise<void> {
    try {
      this.db = new Database(this.path)

      // Enable foreign keys and other SQLite optimizations
      this.db.exec('PRAGMA foreign_keys = ON')
      this.db.exec('PRAGMA journal_mode = WAL')
      this.db.exec('PRAGMA synchronous = NORMAL')

      console.log(`✅ Test database setup complete: ${this.path}`)
    } catch (error) {
      console.error(`❌ Failed to setup test database: ${error}`)
      throw error
    }
  }

  getConnection(): Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call setup() first.')
    }
    return this.db
  }

  async teardown(): Promise<void> {
    try {
      if (this.db) {
        this.db.close()
        this.db = null
      }

      // If it's a file-based database, optionally clean up the file
      if (!this.options.inMemory && this.path !== ':memory:') {
        try {
          const fs = await import('node:fs/promises')
          if (existsSync(this.path)) {
            await fs.unlink(this.path)
            console.log(`🧹 Cleaned up test database file: ${this.path}`)
          }
        } catch (cleanupError) {
          console.warn(`⚠️ Could not clean up database file ${this.path}:`, cleanupError)
        }
      }
    } catch (error) {
      console.error(`❌ Error during database teardown: ${error}`)
      throw error
    }
  }

  isConnected(): boolean {
    return this.db !== null
  }

  execute(sql: string): void {
    if (!this.db) {
      throw new Error('Database not initialized. Call setup() first.')
    }
    this.db.exec(sql)
  }

  query(sql: string, params?: any[]): any[] {
    if (!this.db) {
      throw new Error('Database not initialized. Call setup() first.')
    }

    const stmt = this.db.prepare(sql)
    if (params) {
      return stmt.all(...params)
    }
    return stmt.all()
  }
}

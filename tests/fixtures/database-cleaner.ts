/**
 * Database Cleaner for Comprehensive Tests
 * Simple helper to clear database tables between test runs
 */

import type { Database } from '../../src/infrastructure/database/sqlite/SqliteAdapter.js'
import type { DIContainer } from '../../src/infrastructure/container/DIContainer'
import { DatabaseTokens } from '../../src/infrastructure/container/tokens/DatabaseTokens'

export class DatabaseCleaner {
  constructor(private container: DIContainer) {}

  /**
   * Clear all data from database tables
   */
  async clearAllData(): Promise<void> {
    const database = await this.container.resolve<Database>(DatabaseTokens.DATABASE_CONNECTION)

    // Clear tables in dependency order (referencing tables first)
    const tablesToClear = ['node_attributes', 'node_relations', 'nodes', 'attributes', 'tables', 'templates', 'docs']

    // Use transaction to ensure atomicity
    database.transaction(() => {
      for (const table of tablesToClear) {
        try {
          database.exec(`DELETE FROM ${table}`)
        } catch (error) {
          // Table might not exist in test database, ignore
          console.debug(`Could not clear table ${table}: ${error}`)
        }
      }
    })()
  }
}

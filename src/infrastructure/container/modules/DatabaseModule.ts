import { Database } from 'bun:sqlite'
import type { DIContainer } from '../DIContainer.js'
import { DatabaseTokens } from '../tokens/index.js'

/**
 * Database module - registers database connections and adapters
 */
export function registerDatabaseModule(container: DIContainer): void {
  // Database configuration
  container.registerSingleton(
    DatabaseTokens.DATABASE_CONFIG,
    async () => ({
      url: ':memory:', // Use in-memory database for testing
      type: 'sqlite' as const
    })
  )

  // Bun SQLite Database connection
  container.registerSingleton(
    DatabaseTokens.DATABASE_CONNECTION,
    async (c) => {
      const config = await c.resolve(DatabaseTokens.DATABASE_CONFIG)
      
      // Create an in-memory SQLite database for testing
      const db = new Database(':memory:')
      
      // Initialize the database schema
      db.exec(`
        CREATE TABLE IF NOT EXISTS tables (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          identifier TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS nodes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_id INTEGER NOT NULL,
          content TEXT NOT NULL,
          title TEXT,
          description TEXT,
          attributes TEXT, -- JSON
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (table_id) REFERENCES tables (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS relations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_id INTEGER NOT NULL,
          source_node_id INTEGER NOT NULL,
          target_node_id INTEGER NOT NULL,
          relation_type_id INTEGER NOT NULL,
          properties TEXT, -- JSON
          strength REAL DEFAULT 1.0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (table_id) REFERENCES tables (id) ON DELETE CASCADE,
          FOREIGN KEY (source_node_id) REFERENCES nodes (id) ON DELETE CASCADE,
          FOREIGN KEY (target_node_id) REFERENCES nodes (id) ON DELETE CASCADE
        );

        -- Insert sample test data
        INSERT OR IGNORE INTO tables (id, identifier, description, created_at, updated_at) VALUES 
          (1, 'test-table', 'Test table for BaseResolver verification', datetime('now'), datetime('now')),
          (2, 'sample-data', 'Sample data table', datetime('now'), datetime('now'));

        INSERT OR IGNORE INTO nodes (id, table_id, content, title, description, attributes, created_at, updated_at) VALUES
          (1, 1, 'Test Node 1', 'First Test Node', 'A test node for verification', '{}', datetime('now'), datetime('now')),
          (2, 1, 'Test Node 2', 'Second Test Node', 'Another test node', '{}', datetime('now'), datetime('now')),
          (3, 2, 'Sample Node', 'Sample Node Title', 'Sample node description', '{}', datetime('now'), datetime('now'));
      `)
      
      return db
    },
    [DatabaseTokens.DATABASE_CONFIG]
  )
}

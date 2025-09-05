/**
 * Database service tokens for dependency injection
 */

export const DatabaseTokens = {
  // Core database interfaces
  DATABASE_CONNECTION: Symbol.for('DatabaseConnection'),
  QUERY_EXECUTOR: Symbol.for('QueryExecutor'),
  TRANSACTION_MANAGER: Symbol.for('TransactionManager'),

  // Database configuration
  DATABASE_CONFIG: Symbol.for('DatabaseConfig'),

  // Connection adapters
  BUN_SQLITE_ADAPTER: Symbol.for('BunSqliteAdapter'),
  CLOUDFLARE_D1_ADAPTER: Symbol.for('CloudflareD1Adapter'),
  MOCK_DATABASE_ADAPTER: Symbol.for('MockDatabaseAdapter'),
} as const

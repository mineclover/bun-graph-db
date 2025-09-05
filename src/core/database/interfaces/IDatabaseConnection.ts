/**
 * Database Connection Interface
 * Provides abstraction for different database providers (Bun SQLite, Cloudflare D1, etc.)
 */
export interface IDatabaseConnection {
  /**
   * Execute a query and return results
   */
  query<T = any>(sql: string, params?: any[]): Promise<T[]>

  /**
   * Execute a query and return first result
   */
  queryFirst<T = any>(sql: string, params?: any[]): Promise<T | null>

  /**
   * Execute a query without returning results (INSERT, UPDATE, DELETE)
   */
  execute(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid?: number }>

  /**
   * Execute multiple statements in a transaction
   */
  transaction<T>(fn: (tx: ITransactionManager) => Promise<T>): Promise<T>

  /**
   * Health check for the connection
   */
  isHealthy(): Promise<boolean>

  /**
   * Close the connection
   */
  close(): Promise<void>

  /**
   * Get connection metadata
   */
  getConnectionInfo(): {
    provider: 'bun-sqlite' | 'cloudflare-d1' | 'other'
    version?: string
    capabilities: string[]
  }
}

export interface ITransactionManager {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>
  queryFirst<T = any>(sql: string, params?: any[]): Promise<T | null>
  execute(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid?: number }>
}

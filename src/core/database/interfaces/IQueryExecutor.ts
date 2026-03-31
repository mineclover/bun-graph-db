/**
 * Query Executor Interface
 * High-level abstraction for executing domain-specific queries
 */
export interface IQueryExecutor {
  /**
   * Execute a prepared statement with type safety
   */
  executePrepared<T = unknown>(queryName: string, params: Record<string, unknown>): Promise<T[]>

  /**
   * Execute a single query with parameters
   */
  executeQuery<T = unknown>(sql: string, params?: unknown[], options?: QueryOptions): Promise<QueryResult<T>>

  /**
   * Execute batch operations efficiently
   */
  executeBatch<T = unknown>(operations: BatchOperation[]): Promise<BatchResult<T>>

  /**
   * Execute with performance monitoring
   */
  executeWithMetrics<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResultWithMetrics<T>>
}

export interface QueryOptions {
  timeout?: number
  maxRetries?: number
  cached?: boolean
  priority?: 'low' | 'normal' | 'high'
}

export interface QueryResult<T> {
  data: T[]
  rowsAffected: number
  executionTimeMs: number
  fromCache?: boolean
}

export interface QueryResultWithMetrics<T> extends QueryResult<T> {
  metrics: {
    planningTimeMs: number
    executionTimeMs: number
    totalTimeMs: number
    rowsScanned: number
    indexesUsed: string[]
  }
}

export interface BatchOperation {
  sql: string
  params?: unknown[]
  expectsResult?: boolean
}

export interface BatchResult<T> {
  results: (QueryResult<T> | { error: string })[]
  totalExecutionTimeMs: number
  successCount: number
  errorCount: number
}

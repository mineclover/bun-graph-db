/**
 * Query Executor Interface
 * High-level abstraction for executing domain-specific queries
 */
export interface IQueryExecutor {
  /**
   * Execute a prepared statement with type safety
   */
  executePrepared<T = any>(
    queryName: string,
    params: Record<string, any>
  ): Promise<T[]>
  
  /**
   * Execute a single query with parameters
   */
  executeQuery<T = any>(
    sql: string, 
    params?: any[],
    options?: QueryOptions
  ): Promise<QueryResult<T>>
  
  /**
   * Execute batch operations efficiently
   */
  executeBatch<T = any>(
    operations: BatchOperation[]
  ): Promise<BatchResult<T>>
  
  /**
   * Execute with performance monitoring
   */
  executeWithMetrics<T = any>(
    sql: string,
    params?: any[]
  ): Promise<QueryResultWithMetrics<T>>
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
  params?: any[]
  expectsResult?: boolean
}

export interface BatchResult<T> {
  results: (QueryResult<T> | { error: string })[]
  totalExecutionTimeMs: number
  successCount: number
  errorCount: number
}
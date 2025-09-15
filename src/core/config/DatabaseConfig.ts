/**
 * Database configuration
 */

export interface DatabaseConfig {
  provider: 'bun-sqlite' | 'cloudflare-d1' | 'mock'
  connectionString?: string
  options: {
    enableWAL?: boolean
    queryTimeout?: number
    connectionPoolSize?: number
    enableQueryLogging?: boolean
    enableMetrics?: boolean
  }
}

export const createDatabaseConfig = (env: Record<string, string | undefined>): DatabaseConfig => {
  return {
    provider: (env.DB_PROVIDER as DatabaseConfig['provider']) || 'bun-sqlite',
    connectionString: env.DATABASE_URL || 'data/bun-graph-db.sqlite',
    options: {
      enableWAL: env.DB_ENABLE_WAL === 'true',
      queryTimeout: parseInt(env.DB_QUERY_TIMEOUT || '30000', 10),
      connectionPoolSize: parseInt(env.DB_POOL_SIZE || '10', 10),
      enableQueryLogging: env.DB_ENABLE_QUERY_LOGGING === 'true',
      enableMetrics: env.DB_ENABLE_METRICS !== 'false',
    },
  }
}

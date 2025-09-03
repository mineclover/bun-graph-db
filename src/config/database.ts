import type { DatabaseConfig } from '@/shared/types/common.js'

export const databaseConfig: DatabaseConfig = {
  path: process.env.DATABASE_PATH || './data/bun-graph-db.sqlite',
  poolSize: Number.parseInt(process.env.DATABASE_POOL_SIZE || '5'),
  timeout: Number.parseInt(process.env.DATABASE_TIMEOUT || '30000')
}

export const getDatabasePath = (): string => {
  const path = databaseConfig.path
  
  // Ensure directory exists
  const dir = path.substring(0, path.lastIndexOf('/'))
  if (dir) {
    try {
      require('fs').mkdirSync(dir, { recursive: true })
    } catch (error) {
      // Directory might already exist, that's okay
    }
  }
  
  return path
}
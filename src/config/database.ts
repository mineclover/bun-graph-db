import type { DatabaseConfig } from '@/core/types/CommonTypes.js'

export const databaseConfig: DatabaseConfig = {
  path: process.env.DATABASE_PATH || './data/bun-graph-db.sqlite',
  poolSize: Number.parseInt(process.env.DATABASE_POOL_SIZE || '5', 10),
  timeout: Number.parseInt(process.env.DATABASE_TIMEOUT || '30000', 10),
}

export const getDatabasePath = (): string => {
  const path = databaseConfig.path

  // Ensure directory exists
  const dir = path.substring(0, path.lastIndexOf('/'))
  if (dir) {
    try {
      const fs = require('node:fs')
      fs.mkdirSync(dir, { recursive: true })
      console.log(`Database directory ensured: ${dir}`)
    } catch (error) {
      console.warn(`Could not create directory ${dir}:`, error)
    }
  }

  console.log(`Database path: ${path}`)
  return path
}

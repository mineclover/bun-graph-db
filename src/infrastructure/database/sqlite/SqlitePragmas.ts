import type { Database } from 'bun:sqlite'

export interface SqliteRuntimeOptions {
  enableWal: boolean
  busyTimeoutMs: number
  synchronous: 'FULL' | 'NORMAL' | 'OFF'
  cacheSizeKiB: number
}

export function readSqliteRuntimeOptions(
  env: Record<string, string | undefined> = process.env,
): SqliteRuntimeOptions {
  return {
    enableWal: env.DB_ENABLE_WAL !== 'false',
    busyTimeoutMs: positiveInteger(env.DATABASE_TIMEOUT ?? env.DB_QUERY_TIMEOUT, 30_000),
    synchronous: parseSynchronous(env.DB_SYNCHRONOUS),
    cacheSizeKiB: positiveInteger(env.DB_CACHE_SIZE_KIB, 32 * 1024),
  }
}

/** Apply the same operational SQLite policy to every production connection path. */
export function configureSqliteDatabase(
  database: Database,
  databasePath: string,
  options: SqliteRuntimeOptions = readSqliteRuntimeOptions(),
): void {
  database.exec('PRAGMA foreign_keys = ON')
  database.exec(`PRAGMA busy_timeout = ${options.busyTimeoutMs}`)
  database.exec(`PRAGMA synchronous = ${options.synchronous}`)
  database.exec(`PRAGMA cache_size = -${options.cacheSizeKiB}`)

  if (databasePath !== ':memory:' && !databasePath.startsWith('file::memory:')) {
    database.exec(`PRAGMA journal_mode = ${options.enableWal ? 'WAL' : 'DELETE'}`)
    if (options.enableWal) database.exec('PRAGMA wal_autocheckpoint = 1000')
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parseSynchronous(value: string | undefined): SqliteRuntimeOptions['synchronous'] {
  const normalized = value?.toUpperCase()
  if (normalized === 'FULL' || normalized === 'OFF') return normalized
  return 'NORMAL'
}

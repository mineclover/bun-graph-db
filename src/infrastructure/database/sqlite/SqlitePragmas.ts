import type { ISqliteDatabase } from './SqlitePort.js'

export interface SqliteRuntimeOptions {
  enableWal: boolean
  busyTimeoutMs: number
  synchronous: 'FULL' | 'NORMAL' | 'OFF'
  cacheSizeKiB: number
  tempStore?: 'MEMORY' | 'FILE' | 'DEFAULT'
  mmapSizeBytes?: number
}

const DEFAULT_MMAP_SIZE_BYTES = 64 * 1024 * 1024

export function readSqliteRuntimeOptions(
  env: Record<string, string | undefined> = process.env,
): Required<SqliteRuntimeOptions> {
  return {
    enableWal: env.DB_ENABLE_WAL !== 'false',
    busyTimeoutMs: positiveInteger(env.DATABASE_TIMEOUT ?? env.DB_QUERY_TIMEOUT, 30_000),
    synchronous: parseSynchronous(env.DB_SYNCHRONOUS),
    cacheSizeKiB: positiveInteger(env.DB_CACHE_SIZE_KIB, 32 * 1024),
    tempStore: parseTempStore(env.DB_TEMP_STORE),
    mmapSizeBytes: nonNegativeInteger(env.DB_MMAP_SIZE_BYTES, DEFAULT_MMAP_SIZE_BYTES),
  }
}

/** Apply the same operational SQLite policy to every production connection path. */
export function configureSqliteDatabase(
  database: ISqliteDatabase,
  databasePath: string,
  options: SqliteRuntimeOptions = readSqliteRuntimeOptions(),
): void {
  database.exec('PRAGMA foreign_keys = ON')

  if (database.supportsFilePragmas === false || database.driver === 'cloudflare-do-sqlite') {
    return
  }

  const tempStore = options.tempStore ?? 'MEMORY'
  const mmapSizeBytes = options.mmapSizeBytes ?? DEFAULT_MMAP_SIZE_BYTES

  database.exec(`PRAGMA busy_timeout = ${options.busyTimeoutMs}`)
  database.exec(`PRAGMA synchronous = ${options.synchronous}`)
  database.exec(`PRAGMA cache_size = -${options.cacheSizeKiB}`)
  database.exec(`PRAGMA temp_store = ${tempStore}`)

  if (databasePath !== ':memory:' && !databasePath.startsWith('file::memory:')) {
    database.exec(`PRAGMA journal_mode = ${options.enableWal ? 'WAL' : 'DELETE'}`)
    if (options.enableWal) database.exec('PRAGMA wal_autocheckpoint = 1000')
    database.exec(`PRAGMA mmap_size = ${mmapSizeBytes}`)
  }
}

function parseTempStore(raw: string | undefined): NonNullable<SqliteRuntimeOptions['tempStore']> {
  const normalized = raw?.trim().toUpperCase()
  if (normalized === 'FILE' || normalized === 'DEFAULT' || normalized === 'MEMORY') {
    return normalized
  }
  return 'MEMORY'
}

function nonNegativeInteger(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback
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

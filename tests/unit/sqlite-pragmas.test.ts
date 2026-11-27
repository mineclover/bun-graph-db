import { afterEach, describe, expect, test } from 'vitest'
import { Database } from '../../src/infrastructure/database/sqlite/SqliteAdapter.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  configureSqliteDatabase,
  readSqliteRuntimeOptions,
} from '../../src/infrastructure/database/sqlite/SqlitePragmas'

const databases: Database[] = []
const directories: string[] = []

afterEach(() => {
  for (const database of databases.splice(0)) database.close()
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('SQLite runtime pragmas', () => {
  test('validates environment values and keeps operational defaults explicit', () => {
    expect(readSqliteRuntimeOptions({})).toEqual({
      enableWal: true,
      busyTimeoutMs: 30_000,
      synchronous: 'NORMAL',
      cacheSizeKiB: 32 * 1024,
      tempStore: 'MEMORY',
      mmapSizeBytes: 64 * 1024 * 1024,
    })
    expect(readSqliteRuntimeOptions({
      DB_ENABLE_WAL: 'false',
      DATABASE_TIMEOUT: '-1',
      DB_SYNCHRONOUS: 'full',
      DB_CACHE_SIZE_KIB: '4096',
      DB_TEMP_STORE: 'file',
      DB_MMAP_SIZE_BYTES: '16777216',
    })).toEqual({
      enableWal: false,
      busyTimeoutMs: 30_000,
      synchronous: 'FULL',
      cacheSizeKiB: 4096,
      tempStore: 'FILE',
      mmapSizeBytes: 16_777_216,
    })
  })

  test('enables WAL for file databases and applies connection-local safety settings', () => {
    const directory = mkdtempSync(join(tmpdir(), 'bun-graph-sqlite-'))
    directories.push(directory)
    const databasePath = join(directory, 'runtime.sqlite')
    const database = new Database(databasePath)
    databases.push(database)

    configureSqliteDatabase(database, databasePath, {
      enableWal: true,
      busyTimeoutMs: 4321,
      synchronous: 'NORMAL',
      cacheSizeKiB: 2048,
      tempStore: 'MEMORY',
      mmapSizeBytes: 16_777_216,
    })

    expect(database.query<{ journal_mode: string }, []>('PRAGMA journal_mode').get()?.journal_mode).toBe('wal')
    expect(database.query<{ timeout: number }, []>('PRAGMA busy_timeout').get()?.timeout).toBe(4321)
    expect(database.query<{ synchronous: number }, []>('PRAGMA synchronous').get()?.synchronous).toBe(1)
    expect(database.query<{ cache_size: number }, []>('PRAGMA cache_size').get()?.cache_size).toBe(-2048)
    expect(database.query<{ foreign_keys: number }, []>('PRAGMA foreign_keys').get()?.foreign_keys).toBe(1)
    expect(database.query<{ temp_store: number }, []>('PRAGMA temp_store').get()?.temp_store).toBe(2)
    expect(database.query<{ mmap_size: number }, []>('PRAGMA mmap_size').get()?.mmap_size).toBe(16_777_216)
  })

  test('actively leaves persistent WAL mode when it is disabled', () => {
    const directory = mkdtempSync(join(tmpdir(), 'bun-graph-sqlite-'))
    directories.push(directory)
    const databasePath = join(directory, 'runtime.sqlite')
    const initial = new Database(databasePath)
    configureSqliteDatabase(initial, databasePath, {
      enableWal: true,
      busyTimeoutMs: 1000,
      synchronous: 'NORMAL',
      cacheSizeKiB: 1024,
    })
    initial.close()

    const reopened = new Database(databasePath)
    databases.push(reopened)
    configureSqliteDatabase(reopened, databasePath, {
      enableWal: false,
      busyTimeoutMs: 1000,
      synchronous: 'NORMAL',
      cacheSizeKiB: 1024,
    })

    expect(reopened.query<{ journal_mode: string }, []>('PRAGMA journal_mode').get()?.journal_mode).toBe('delete')
  })
})

import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite'
import {
  DEFAULT_MAX_BIND_PARAMS,
  type ISqliteDatabase,
  type SqliteDriverKind,
  type SqlitePrimitive,
  type SqliteRunResult,
  type Statement,
  normalizeSqlArgs,
} from './SqlitePort.js'

export {
  CLOUDFLARE_DO_HARD_PARAM_LIMIT,
  CLOUDFLARE_DO_MAX_BIND_PARAMS,
  DEFAULT_MAX_BIND_PARAMS,
  chunkValues,
  getMaxBindParams,
  translateNamedParamsToPositional,
} from './SqlitePort.js'
export type {
  ISqliteDatabase,
  SQLQueryBindings,
  SqliteBindPrimitive,
  SqliteDriverKind,
  SqlitePrimitive,
  SqliteRunResult,
  Statement,
} from './SqlitePort.js'

export interface SqliteOpenOptions {
  readonly?: boolean
  readOnly?: boolean
  create?: boolean
  strict?: boolean
}

const DEFAULT_STATEMENT_CACHE_CAPACITY = 256

function wrapStatement<
  TRow = unknown,
  TParams extends readonly unknown[] = readonly unknown[],
>(rawStmt: StatementSync, onFinalize?: () => void): Statement<TRow, TParams> {
  return {
    all(...params: TParams): TRow[] {
      const { named, positional } = normalizeSqlArgs(params)
      const rows = named
        ? rawStmt.all(named as Record<string, SQLInputValue>)
        : rawStmt.all(...(positional as SQLInputValue[]))
      return rows as TRow[]
    },
    get(...params: TParams): TRow | null {
      const { named, positional } = normalizeSqlArgs(params)
      const row = named
        ? rawStmt.get(named as Record<string, SQLInputValue>)
        : rawStmt.get(...(positional as SQLInputValue[]))
      return row === undefined ? null : (row as TRow)
    },
    run(...params: TParams): SqliteRunResult {
      const { named, positional } = normalizeSqlArgs(params)
      const result = named
        ? rawStmt.run(named as Record<string, SQLInputValue>)
        : rawStmt.run(...(positional as SQLInputValue[]))
      return {
        changes: Number(result.changes),
        lastInsertRowid: result.lastInsertRowid,
      }
    },
    iterate(...params: TParams): IterableIterator<TRow> {
      const { named, positional } = normalizeSqlArgs(params)
      return (
        named
          ? rawStmt.iterate(named as Record<string, SQLInputValue>)
          : rawStmt.iterate(...(positional as SQLInputValue[]))
      ) as IterableIterator<TRow>
    },
    finalize(): void {
      onFinalize?.()
    },
  }
}

/**
 * Node 26 built-in `node:sqlite` wrapper preserving the `bun:sqlite` surface
 * used across bun-graph-db:
 * - `get()` normalizes `undefined` to `null`
 * - `query()` uses a bounded LRU statement cache
 * - `transaction()` uses `BEGIN IMMEDIATE` + nested `SAVEPOINT`
 * - `close()` is idempotent and runs `PRAGMA optimize` on writable connections
 */
export class Database implements ISqliteDatabase {
  readonly filename: string
  readonly driver: SqliteDriverKind = 'node-sqlite'
  readonly maxBindParams = DEFAULT_MAX_BIND_PARAMS
  readonly supportsFilePragmas = true
  private readonly raw: DatabaseSync
  private readonly readOnly: boolean
  private readonly statementCache = new Map<string, Statement<unknown, readonly unknown[]>>()
  private readonly maxStatementCacheSize: number
  private txDepth = 0
  private savepointSeq = 0
  private closed = false

  constructor(
    filename = ':memory:',
    options: SqliteOpenOptions = {},
    maxStatementCacheSize = DEFAULT_STATEMENT_CACHE_CAPACITY,
  ) {
    this.filename = filename
    this.readOnly = Boolean(options.readonly ?? options.readOnly)
    this.maxStatementCacheSize = Math.max(16, maxStatementCacheSize)
    this.raw = new DatabaseSync(filename, {
      readOnly: this.readOnly,
    })
  }

  query<TRow = unknown, TParams extends readonly unknown[] = readonly unknown[]>(
    sql: string,
  ): Statement<TRow, TParams> {
    const cached = this.statementCache.get(sql)
    if (cached) {
      this.statementCache.delete(sql)
      this.statementCache.set(sql, cached)
      return cached as Statement<TRow, TParams>
    }

    const rawStmt = this.raw.prepare(sql)
    const wrapped = wrapStatement<unknown, readonly unknown[]>(rawStmt, () => {
      if (this.statementCache.get(sql) === wrapped) {
        this.statementCache.delete(sql)
      }
    })

    if (this.statementCache.size >= this.maxStatementCacheSize) {
      const oldestKey = this.statementCache.keys().next().value
      if (oldestKey !== undefined) {
        this.statementCache.delete(oldestKey)
      }
    }
    this.statementCache.set(sql, wrapped)
    return wrapped as Statement<TRow, TParams>
  }

  prepare<TRow = unknown, TParams extends readonly unknown[] = readonly unknown[]>(
    sql: string,
  ): Statement<TRow, TParams> {
    return wrapStatement<TRow, TParams>(this.raw.prepare(sql))
  }

  run(
    sql: string,
    params?: readonly unknown[] | Record<string, SqlitePrimitive>,
  ): SqliteRunResult {
    const stmt = this.query(sql)
    if (params === undefined) {
      return stmt.run()
    }
    if (Array.isArray(params)) {
      return stmt.run(...params)
    }
    return stmt.run(params)
  }

  exec(sql: string): void {
    this.raw.exec(sql)
  }

  transaction<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult,
  ): (...args: TArgs) => TResult {
    return (...args: TArgs): TResult => {
      const isOuter = this.txDepth === 0
      const savepointName = isOuter ? '' : `sp_${++this.savepointSeq}`
      this.txDepth += 1

      if (isOuter) {
        this.raw.exec('BEGIN IMMEDIATE')
      } else {
        this.raw.exec(`SAVEPOINT ${savepointName}`)
      }

      try {
        const result = fn(...args)
        if (isOuter) {
          this.raw.exec('COMMIT')
        } else {
          this.raw.exec(`RELEASE SAVEPOINT ${savepointName}`)
        }
        return result
      } catch (error) {
        if (isOuter) {
          try {
            this.raw.exec('ROLLBACK')
          } catch {
            // Ignore rollback failure if SQLite already aborted the transaction.
          }
        } else {
          try {
            this.raw.exec(
              `ROLLBACK TO SAVEPOINT ${savepointName}; RELEASE SAVEPOINT ${savepointName}`,
            )
          } catch {
            // Ignore savepoint rollback failure if outer transaction aborted.
          }
        }
        throw error
      } finally {
        this.txDepth -= 1
      }
    }
  }

  close(_throwOnError?: boolean): void {
    if (this.closed) return
    this.closed = true
    this.statementCache.clear()
    if (!this.readOnly) {
      try {
        this.raw.exec('PRAGMA optimize')
      } catch {
        // Best-effort planner statistics refresh on shutdown.
      }
    }
    this.raw.close()
  }
}

export function getSqliteVersion(database?: ISqliteDatabase): string {
  if (database) {
    const row = database.query<{ v: string }, []>('SELECT sqlite_version() AS v').get()
    return row?.v ?? 'unknown'
  }
  const probe = new DatabaseSync(':memory:')
  try {
    const row = probe.prepare('SELECT sqlite_version() AS v').get() as { v?: string } | undefined
    return row?.v ?? 'unknown'
  } finally {
    probe.close()
  }
}

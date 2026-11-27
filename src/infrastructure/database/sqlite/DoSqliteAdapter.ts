import {
  CLOUDFLARE_DO_HARD_PARAM_LIMIT,
  CLOUDFLARE_DO_MAX_BIND_PARAMS,
  type ISqliteDatabase,
  type SqliteBindPrimitive,
  type SqliteDriverKind,
  type SqlitePrimitive,
  type SqliteRunResult,
  type Statement,
  normalizeSqlArgs,
  translateNamedParamsToPositional,
} from './SqlitePort.js'

/**
 * Minimal structural contract matching Cloudflare Durable Object `SqlStorageCursor`.
 */
export interface DoSqlStorageCursor<TRow = Record<string, unknown>>
  extends Iterable<TRow> {
  toArray(): TRow[]
  one(): TRow
  readonly rowsRead: number
  readonly rowsWritten: number
}

/**
 * Minimal structural contract matching Cloudflare Durable Object `ctx.storage.sql`.
 */
export interface DoSqlStorage {
  exec<TRow = Record<string, unknown>>(
    query: string,
    ...bindings: unknown[]
  ): DoSqlStorageCursor<TRow>
}

/**
 * Minimal structural contract matching Cloudflare Durable Object `ctx.storage`.
 */
export interface DoStorageLike {
  sql: DoSqlStorage
  transactionSync?<T>(callback: () => T): T
}

function resolveExecution(
  sql: string,
  params: readonly unknown[],
): { sql: string; bindings: SqliteBindPrimitive[] } {
  const { named, positional } = normalizeSqlArgs(params)
  const resolved = named
    ? translateNamedParamsToPositional(sql, named)
    : { sql, params: positional }

  if (resolved.params.length > CLOUDFLARE_DO_HARD_PARAM_LIMIT) {
    throw new Error(
      `Cloudflare Durable Object SQLite allows at most ${CLOUDFLARE_DO_HARD_PARAM_LIMIT} bound parameters per query (received ${resolved.params.length})`,
    )
  }

  return { sql: resolved.sql, bindings: resolved.params }
}

/**
 * Zero-dependency `ISqliteDatabase` adapter over Cloudflare Durable Object
 * synchronous SQLite storage (`ctx.storage.sql` / `ctx.storage.transactionSync`).
 */
export class DoSqliteDatabase implements ISqliteDatabase {
  readonly filename = ':cloudflare-do:'
  readonly driver: SqliteDriverKind = 'cloudflare-do-sqlite'
  readonly maxBindParams = CLOUDFLARE_DO_MAX_BIND_PARAMS
  readonly supportsFilePragmas = false
  private txDepth = 0
  private savepointSeq = 0
  private closed = false

  constructor(private readonly storage: DoStorageLike) {}

  query<TRow = unknown, TParams extends readonly unknown[] = readonly unknown[]>(
    sql: string,
  ): Statement<TRow, TParams> {
    return this.prepare<TRow, TParams>(sql)
  }

  prepare<TRow = unknown, TParams extends readonly unknown[] = readonly unknown[]>(
    sql: string,
  ): Statement<TRow, TParams> {
    const storage = this.storage

    return {
      all(...params: TParams): TRow[] {
        const { sql: positionalSql, bindings } = resolveExecution(sql, params)
        return storage.sql.exec<TRow>(positionalSql, ...bindings).toArray()
      },
      get(...params: TParams): TRow | null {
        const { sql: positionalSql, bindings } = resolveExecution(sql, params)
        const rows = storage.sql.exec<TRow>(positionalSql, ...bindings).toArray()
        return rows.length > 0 ? (rows[0] as TRow) : null
      },
      run(...params: TParams): SqliteRunResult {
        const { sql: positionalSql, bindings } = resolveExecution(sql, params)
        const cursor = storage.sql.exec(positionalSql, ...bindings)
        cursor.toArray()
        let lastInsertRowid: number | bigint = 0
        if (/^\s*insert\b/i.test(positionalSql)) {
          const row = storage.sql
            .exec<{ id: number | bigint }>('SELECT last_insert_rowid() AS id')
            .toArray()[0]
          lastInsertRowid = row?.id ?? 0
        }
        return {
          changes: Number(cursor.rowsWritten),
          lastInsertRowid,
        }
      },
      iterate(...params: TParams): IterableIterator<TRow> {
        const { sql: positionalSql, bindings } = resolveExecution(sql, params)
        const rows = storage.sql.exec<TRow>(positionalSql, ...bindings).toArray()
        return rows[Symbol.iterator]()
      },
      finalize(): void {
        // Statement lifecycle is managed per execution in DO SQLite.
      },
    }
  }

  run(
    sql: string,
    params?: readonly unknown[] | Record<string, SqlitePrimitive>,
  ): SqliteRunResult {
    const stmt = this.prepare(sql)
    if (params === undefined) {
      return stmt.run()
    }
    if (Array.isArray(params)) {
      return stmt.run(...params)
    }
    return stmt.run(params)
  }

  exec(sql: string): void {
    this.storage.sql.exec(sql)
  }

  transaction<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult,
  ): (...args: TArgs) => TResult {
    return (...args: TArgs): TResult => {
      if (this.txDepth === 0) {
        this.txDepth += 1
        try {
          if (typeof this.storage.transactionSync === 'function') {
            return this.storage.transactionSync(() => fn(...args))
          }
          this.storage.sql.exec('BEGIN IMMEDIATE')
          try {
            const result = fn(...args)
            this.storage.sql.exec('COMMIT')
            return result
          } catch (error) {
            try {
              this.storage.sql.exec('ROLLBACK')
            } catch {
              // Ignore rollback failure when transaction already aborted.
            }
            throw error
          }
        } finally {
          this.txDepth -= 1
        }
      }

      const savepointName = `sp_${++this.savepointSeq}`
      this.txDepth += 1
      this.storage.sql.exec(`SAVEPOINT ${savepointName}`)
      try {
        const result = fn(...args)
        this.storage.sql.exec(`RELEASE SAVEPOINT ${savepointName}`)
        return result
      } catch (error) {
        try {
          this.storage.sql.exec(
            `ROLLBACK TO SAVEPOINT ${savepointName}; RELEASE SAVEPOINT ${savepointName}`,
          )
        } catch {
          // Ignore savepoint rollback failure if outer transaction aborted.
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
    try {
      this.storage.sql.exec('PRAGMA optimize')
    } catch {
      // Best-effort planner statistics refresh.
    }
  }
}

import type {
  ISnapshotStoragePort,
  SnapshotMetadata,
  SnapshotObject,
} from '@/domain/ports/ISnapshotStoragePort.js'
import { decodeBase64, encodeBase64 } from '@/shared/utils/portableHash.js'
import {
  DEFAULT_MAX_BIND_PARAMS,
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
 * Minimal structural contract matching `sql.js` prepared statement (`stmt`).
 */
export interface SqlJsStatementLike {
  bind(values?: readonly SqliteBindPrimitive[] | Record<string, SqliteBindPrimitive>): boolean
  step(): boolean
  getAsObject(params?: readonly SqliteBindPrimitive[] | Record<string, SqliteBindPrimitive>): Record<string, unknown>
  free(): boolean
}

/**
 * Minimal structural contract matching a `sql.js` in-browser WASM database (`new SQL.Database()`).
 */
export interface SqlJsDatabaseLike {
  prepare(sql: string, params?: readonly SqliteBindPrimitive[]): SqlJsStatementLike
  exec(sql: string): unknown
  getRowsModified(): number
  export?(): Uint8Array
  close?(): void
}

/**
 * Minimal structural contract matching `@sqlite.org/sqlite-wasm` OO1 `db` (in-memory or OPFS).
 */
export interface SqliteWasmOo1DatabaseLike {
  exec(options: {
    sql: string
    bind?: readonly SqliteBindPrimitive[] | Record<string, SqliteBindPrimitive>
    rowMode?: 'object' | 'array'
    returnValue?: 'resultRows' | 'this'
  }): unknown
  changes?(total?: boolean, sixtyFour?: boolean): number | bigint
  export?(): Uint8Array
  close?(): void
}

type WebSqliteEngineKind = 'sql.js' | 'sqlite-wasm-oo1'

function detectEngineKind(
  driver: SqlJsDatabaseLike | SqliteWasmOo1DatabaseLike,
): WebSqliteEngineKind {
  if (
    typeof (driver as SqlJsDatabaseLike).prepare === 'function' &&
    typeof (driver as SqlJsDatabaseLike).getRowsModified === 'function'
  ) {
    return 'sql.js'
  }
  if (typeof (driver as SqliteWasmOo1DatabaseLike).exec === 'function') {
    return 'sqlite-wasm-oo1'
  }
  throw new Error(
    'Unsupported web SQLite driver: expected a sql.js Database or @sqlite.org/sqlite-wasm OO1 database',
  )
}

function isISqliteDatabase(value: unknown): value is ISqliteDatabase {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ISqliteDatabase).query === 'function' &&
    typeof (value as ISqliteDatabase).prepare === 'function' &&
    typeof (value as ISqliteDatabase).run === 'function' &&
    typeof (value as ISqliteDatabase).exec === 'function' &&
    typeof (value as ISqliteDatabase).transaction === 'function'
  )
}

function resolveExecution(
  sql: string,
  params: readonly unknown[],
): { sql: string; bindings: SqliteBindPrimitive[] } {
  const { named, positional } = normalizeSqlArgs(params)
  if (named) {
    const translated = translateNamedParamsToPositional(sql, named)
    return { sql: translated.sql, bindings: translated.params }
  }
  return { sql, bindings: positional }
}

/**
 * Browser/Web WASM `ISqliteDatabase` adapter supporting both `sql.js` (IndexedDB/Memory)
 * and `@sqlite.org/sqlite-wasm` OO1 (Memory/OPFS) without Node built-ins.
 */
export class WebSqliteDatabase implements ISqliteDatabase {
  readonly filename: string
  readonly driver: SqliteDriverKind = 'web-sqlite'
  readonly maxBindParams = DEFAULT_MAX_BIND_PARAMS
  readonly supportsFilePragmas = false
  private readonly engineKind: WebSqliteEngineKind
  private txDepth = 0
  private savepointSeq = 0
  private closed = false

  constructor(
    private readonly backend: SqlJsDatabaseLike | SqliteWasmOo1DatabaseLike,
    options: { filename?: string } = {},
  ) {
    this.engineKind = detectEngineKind(backend)
    this.filename = options.filename ?? ':web-sqlite:'
  }

  query<TRow = unknown, TParams extends readonly unknown[] = readonly unknown[]>(
    sql: string,
  ): Statement<TRow, TParams> {
    return this.prepare<TRow, TParams>(sql)
  }

  prepare<TRow = unknown, TParams extends readonly unknown[] = readonly unknown[]>(
    sql: string,
  ): Statement<TRow, TParams> {
    const adapter = this
    return {
      all(...params: TParams): TRow[] {
        return adapter.executeRows<TRow>(sql, params)
      },
      get(...params: TParams): TRow | null {
        const rows = adapter.executeRows<TRow>(sql, params)
        return rows.length > 0 ? (rows[0] as TRow) : null
      },
      run(...params: TParams): SqliteRunResult {
        return adapter.executeRun(sql, params)
      },
      iterate(...params: TParams): IterableIterator<TRow> {
        return adapter.executeRows<TRow>(sql, params)[Symbol.iterator]()
      },
      finalize(): void {
        // Per-statement cleanup is handled inside executeRows / executeRun.
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
    this.assertOpen()
    if (this.engineKind === 'sql.js') {
      ;(this.backend as SqlJsDatabaseLike).exec(sql)
      return
    }
    ;(this.backend as SqliteWasmOo1DatabaseLike).exec({ sql })
  }

  transaction<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult,
  ): (...args: TArgs) => TResult {
    return (...args: TArgs): TResult => {
      this.assertOpen()
      if (this.txDepth === 0) {
        this.txDepth += 1
        this.exec('BEGIN IMMEDIATE')
        try {
          const result = fn(...args)
          this.exec('COMMIT')
          return result
        } catch (error) {
          try {
            this.exec('ROLLBACK')
          } catch {
            // Preserve original error
          }
          throw error
        } finally {
          this.txDepth -= 1
        }
      }

      this.savepointSeq += 1
      const spName = `sp_web_${this.savepointSeq}`
      this.txDepth += 1
      this.exec(`SAVEPOINT ${spName}`)
      try {
        const result = fn(...args)
        this.exec(`RELEASE SAVEPOINT ${spName}`)
        return result
      } catch (error) {
        try {
          this.exec(`ROLLBACK TO SAVEPOINT ${spName}`)
          this.exec(`RELEASE SAVEPOINT ${spName}`)
        } catch {
          // Preserve original error
        }
        throw error
      } finally {
        this.txDepth -= 1
      }
    }
  }

  exportBytes(): Uint8Array | null {
    this.assertOpen()
    if (typeof this.backend.export === 'function') {
      return this.backend.export()
    }
    return null
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.backend.close?.()
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error('WebSqliteDatabase has been closed')
    }
  }

  private executeRows<TRow>(sql: string, params: readonly unknown[]): TRow[] {
    this.assertOpen()
    const { sql: positionalSql, bindings } = resolveExecution(sql, params)
    if (this.engineKind === 'sql.js') {
      const stmt = (this.backend as SqlJsDatabaseLike).prepare(positionalSql, bindings)
      const rows: TRow[] = []
      try {
        while (stmt.step()) {
          rows.push(stmt.getAsObject() as TRow)
        }
      } finally {
        stmt.free()
      }
      return rows
    }

    const result = (this.backend as SqliteWasmOo1DatabaseLike).exec({
      sql: positionalSql,
      bind: bindings.length > 0 ? bindings : undefined,
      rowMode: 'object',
      returnValue: 'resultRows',
    })
    return Array.isArray(result) ? (result as TRow[]) : []
  }

  private executeRun(sql: string, params: readonly unknown[]): SqliteRunResult {
    this.assertOpen()
    const { sql: positionalSql, bindings } = resolveExecution(sql, params)
    const expectsReturning = /\breturning\b/i.test(positionalSql)
    let changes = 0

    if (this.engineKind === 'sql.js') {
      const db = this.backend as SqlJsDatabaseLike
      const stmt = db.prepare(positionalSql, bindings)
      try {
        while (stmt.step()) {
          // Drain all rows if RETURNING or INSERT/UPDATE
          if (!expectsReturning) break
        }
      } finally {
        stmt.free()
      }
      changes = Number(db.getRowsModified())
    } else {
      const db = this.backend as SqliteWasmOo1DatabaseLike
      db.exec({
        sql: positionalSql,
        bind: bindings.length > 0 ? bindings : undefined,
        rowMode: expectsReturning ? 'object' : undefined,
        returnValue: expectsReturning ? 'resultRows' : 'this',
      })
      changes = db.changes ? Number(db.changes(false)) : 0
    }

    let lastInsertRowid: number | bigint = 0
    if (/^\s*insert\b/i.test(positionalSql)) {
      const rows = this.executeRows<{ id: number | bigint }>(
        'SELECT last_insert_rowid() AS id',
        [],
      )
      lastInsertRowid = rows[0]?.id ?? 0
    }
    return { changes, lastInsertRowid }
  }
}

export function wrapWebSqliteDatabase(
  driver: ISqliteDatabase | SqlJsDatabaseLike | SqliteWasmOo1DatabaseLike,
  options: { filename?: string } = {},
): ISqliteDatabase {
  return isISqliteDatabase(driver) ? driver : new WebSqliteDatabase(driver, options)
}

/**
 * Sync or async key-value browser storage contract (compatible with `localStorage`,
 * IndexedDB wrappers, or OPFS key-value bridges).
 */
export interface WebKeyValueStorageLike {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
  keys?(): string[] | Promise<string[]>
}

interface StoredSnapshotEnvelope {
  dataBase64: string
  metadata: SnapshotMetadata
}

export class WebKeyValueSnapshotStorage implements ISnapshotStoragePort {
  private readonly keyIndex = new Set<string>()
  private readonly prefix: string

  constructor(
    private readonly kv: WebKeyValueStorageLike,
    options: { keyPrefix?: string } = {},
  ) {
    this.prefix = options.keyPrefix ?? 'bun-graph-db:snapshot:'
  }

  private fullKey(key: string): string {
    return `${this.prefix}${key}`
  }

  async putSnapshot(
    key: string,
    data: Uint8Array,
    customMetadata?: Record<string, string>,
  ): Promise<SnapshotMetadata> {
    const metadata: SnapshotMetadata = {
      size: data.byteLength,
      uploadedAt: new Date().toISOString(),
      ...(customMetadata ? { customMetadata: { ...customMetadata } } : {}),
    }
    const envelope: StoredSnapshotEnvelope = {
      dataBase64: encodeBase64(data),
      metadata,
    }
    await this.kv.setItem(this.fullKey(key), JSON.stringify(envelope))
    this.keyIndex.add(key)
    return {
      ...metadata,
      ...(metadata.customMetadata
        ? { customMetadata: { ...metadata.customMetadata } }
        : {}),
    }
  }

  async getSnapshot(key: string): Promise<SnapshotObject | null> {
    const raw = await this.kv.getItem(this.fullKey(key))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSnapshotEnvelope
    this.keyIndex.add(key)
    return {
      data: decodeBase64(parsed.dataBase64),
      metadata: parsed.metadata,
    }
  }

  async deleteSnapshot(key: string): Promise<void> {
    await this.kv.removeItem(this.fullKey(key))
    this.keyIndex.delete(key)
  }

  async listSnapshots(prefix?: string): Promise<string[]> {
    const keys = this.kv.keys
      ? (await this.kv.keys())
          .filter((k) => k.startsWith(this.prefix))
          .map((k) => k.slice(this.prefix.length))
      : [...this.keyIndex]
    const filtered = prefix ? keys.filter((k) => k.startsWith(prefix)) : keys
    return [...new Set(filtered)].sort((a, b) => a.localeCompare(b))
  }
}

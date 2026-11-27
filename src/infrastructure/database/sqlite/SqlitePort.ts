export type SqliteDriverKind =
  | 'node-sqlite'
  | 'cloudflare-do-sqlite'
  | 'web-sqlite'
  | 'custom'

export const DEFAULT_MAX_BIND_PARAMS = 500
export const CLOUDFLARE_DO_MAX_BIND_PARAMS = 90
export const CLOUDFLARE_DO_HARD_PARAM_LIMIT = 100

export type SqliteBindPrimitive = string | number | bigint | ArrayBufferView | null
export type SqlitePrimitive = SqliteBindPrimitive | boolean | undefined
export type SQLQueryBindings = SqlitePrimitive | Record<string, SqlitePrimitive>

export interface SqliteRunResult {
  changes: number
  lastInsertRowid: number | bigint
}

export interface Statement<
  TRow = unknown,
  TParams extends readonly unknown[] = readonly unknown[],
> {
  all(...params: TParams): TRow[]
  get(...params: TParams): TRow | null
  run(...params: TParams): SqliteRunResult
  iterate(...params: TParams): IterableIterator<TRow>
  finalize(): void
}

/**
 * Portable synchronous SQLite database port shared by Node 26 `node:sqlite`
 * (`Database`) and Cloudflare Durable Object SQLite (`DoSqliteDatabase`).
 */
export interface ISqliteDatabase {
  readonly filename?: string
  readonly driver?: SqliteDriverKind
  readonly maxBindParams?: number
  readonly supportsFilePragmas?: boolean
  query<TRow = unknown, TParams extends readonly unknown[] = readonly unknown[]>(
    sql: string,
  ): Statement<TRow, TParams>
  prepare<TRow = unknown, TParams extends readonly unknown[] = readonly unknown[]>(
    sql: string,
  ): Statement<TRow, TParams>
  run(
    sql: string,
    params?: readonly unknown[] | Record<string, SqlitePrimitive>,
  ): SqliteRunResult
  exec(sql: string): void
  transaction<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult,
  ): (...args: TArgs) => TResult
  close?(throwOnError?: boolean): void
}

export function getMaxBindParams(
  db: Pick<ISqliteDatabase, 'maxBindParams' | 'driver'>,
  reserve = 0,
): number {
  const configured =
    db.maxBindParams ??
    (db.driver === 'cloudflare-do-sqlite'
      ? CLOUDFLARE_DO_MAX_BIND_PARAMS
      : DEFAULT_MAX_BIND_PARAMS)
  return Math.max(1, configured - Math.max(0, reserve))
}

export function chunkValues<T>(values: readonly T[], chunkSize: number): T[][] {
  if (values.length === 0) return []
  const safeSize = Math.max(1, Math.floor(chunkSize))
  if (values.length <= safeSize) {
    return [values.slice()]
  }
  const chunks: T[][] = []
  for (let i = 0; i < values.length; i += safeSize) {
    chunks.push(values.slice(i, i + safeSize))
  }
  return chunks
}

export function isNamedParamRecord(
  value: unknown,
): value is Record<string, SqlitePrimitive> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !ArrayBuffer.isView(value) &&
    !(value instanceof ArrayBuffer)
  )
}

export function normalizeSqlValue(value: unknown): SqliteBindPrimitive {
  if (value === undefined || value === null) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    ArrayBuffer.isView(value)
  ) {
    return value
  }
  return String(value)
}

export function normalizeSqlArgs(params: readonly unknown[]): {
  named: Record<string, SqliteBindPrimitive> | null
  positional: SqliteBindPrimitive[]
} {
  if (params.length === 1 && isNamedParamRecord(params[0])) {
    const named: Record<string, SqliteBindPrimitive> = {}
    for (const [key, val] of Object.entries(params[0])) {
      named[key] = normalizeSqlValue(val)
    }
    return { named, positional: [] }
  }

  const positional = new Array<SqliteBindPrimitive>(params.length)
  for (let i = 0; i < params.length; i += 1) {
    positional[i] = normalizeSqlValue(params[i])
  }
  return { named: null, positional }
}

function isIdentStart(code: number): boolean {
  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    code === 95
  )
}

function isIdentContinue(code: number): boolean {
  return isIdentStart(code) || (code >= 48 && code <= 57)
}

/**
 * Translate SQLite named parameters (`$name`, `:name`, `@name`) outside string literals,
 * quoted identifiers, and comments into positional `?` placeholders.
 */
export function translateNamedParamsToPositional(
  sql: string,
  namedParams: Record<string, SqlitePrimitive>,
): { sql: string; params: SqliteBindPrimitive[] } {
  const params: SqliteBindPrimitive[] = []
  let result = ''
  let i = 0

  while (i < sql.length) {
    const ch = sql[i]

    // Single-quoted string literal
    if (ch === "'") {
      const start = i
      i += 1
      while (i < sql.length) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            i += 2
            continue
          }
          i += 1
          break
        }
        i += 1
      }
      result += sql.slice(start, i)
      continue
    }

    // Double-quoted identifier
    if (ch === '"') {
      const start = i
      i += 1
      while (i < sql.length) {
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') {
            i += 2
            continue
          }
          i += 1
          break
        }
        i += 1
      }
      result += sql.slice(start, i)
      continue
    }

    // Line comment
    if (ch === '-' && sql[i + 1] === '-') {
      const start = i
      const newlineIndex = sql.indexOf('\n', i + 2)
      i = newlineIndex === -1 ? sql.length : newlineIndex + 1
      result += sql.slice(start, i)
      continue
    }

    // Block comment
    if (ch === '/' && sql[i + 1] === '*') {
      const start = i
      const closeIndex = sql.indexOf('*/', i + 2)
      i = closeIndex === -1 ? sql.length : closeIndex + 2
      result += sql.slice(start, i)
      continue
    }

    // Named parameter placeholder
    if ((ch === '$' || ch === ':' || ch === '@') && i + 1 < sql.length) {
      const nextCode = sql.charCodeAt(i + 1)
      if (isIdentStart(nextCode)) {
        let end = i + 2
        while (end < sql.length && isIdentContinue(sql.charCodeAt(end))) {
          end += 1
        }
        const fullToken = sql.slice(i, end)
        const bareName = sql.slice(i + 1, end)
        let rawValue: SqlitePrimitive
        if (Object.hasOwn(namedParams, fullToken)) {
          rawValue = namedParams[fullToken]
        } else if (Object.hasOwn(namedParams, bareName)) {
          rawValue = namedParams[bareName]
        } else {
          throw new Error(`Missing named SQL parameter: ${fullToken}`)
        }
        params.push(normalizeSqlValue(rawValue))
        result += '?'
        i = end
        continue
      }
    }

    result += ch
    i += 1
  }

  return { sql: result, params }
}

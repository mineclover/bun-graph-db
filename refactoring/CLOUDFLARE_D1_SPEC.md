# Cloudflare D1 호환성 상세 설계

> **이 문서는 [REFACTOR_SPECIFICATION.md](./REFACTOR_SPECIFICATION.md)의 Cloudflare D1 호환성 부분을 상세히 다룹니다.**

## 🎯 호환성 목표

현재 Bun SQLite 기반 시스템을 Cloudflare D1과 호환되도록 설계하여 Cloudflare Workers 환경에서 배포 가능한 구조 구현

## 📋 Cloudflare D1 특성 분석

### D1 vs Bun SQLite 비교

| 특성 | Bun SQLite | Cloudflare D1 | 구현 고려사항 |
|------|------------|---------------|---------------|
| **API 방식** | 동기식 API | 비동기 API | 모든 쿼리를 Promise 기반으로 |
| **트랜잭션** | `db.transaction()` | `db.batch()` | Batch API로 트랜잭션 구현 |
| **쿼리 크기** | ~1MB | ~100KB | 큰 쿼리 분할 필요 |
| **파라미터 수** | 999개 | 100개 | 파라미터 수 제한 고려 |
| **동시 연결** | WAL 모드 지원 | 자동 관리 | 연결 관리 불필요 |
| **준비된 문장** | `prepare()` + `run()` | `prepare()` + `run()` | API 유사하지만 비동기 |
| **결과 형식** | 직접 반환 | `{success, results, meta}` | 결과 래핑 해제 필요 |
| **에러 처리** | Exception | `success: false` | 에러 처리 방식 다름 |

### D1 API 예시
```typescript
// D1 Database API 구조
interface D1Database {
  prepare(sql: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>
  dump(): Promise<ArrayBuffer>
  exec(sql: string): Promise<D1ExecResult>
}

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement
  first<T = any>(colName?: string): Promise<T | null>
  run(): Promise<D1Result>
  all<T = any>(): Promise<D1Result<T[]>>
  raw<T = any[]>(): Promise<T[]>
}

interface D1Result<T = any> {
  results?: T
  success: boolean
  error?: string
  meta: {
    duration: number
    size_after: number
    rows_read: number
    rows_written: number
    last_row_id: number
  }
}
```

## 🏗️ D1 Adapter 구현 설계

### 1. CloudflareD1Adapter 구현

```typescript
export class CloudflareD1Adapter implements IDatabaseConnection {
  private db: D1Database
  private config: D1AdapterConfig

  constructor(database: D1Database, config: D1AdapterConfig = {}) {
    this.db = database
    this.config = {
      maxRetries: 3,
      retryDelayMs: 1000,
      queryTimeout: 10000,
      enableQuerySplitting: true,
      maxQuerySize: 90 * 1024, // 90KB (D1 100KB 제한보다 작게)
      maxParamCount: 90,        // 100개 제한보다 작게
      ...config
    }
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    // 1. 파라미터 수 체크
    if (params && params.length > this.config.maxParamCount!) {
      throw new DatabaseException(`Too many parameters: ${params.length}. Max: ${this.config.maxParamCount}`)
    }

    // 2. 쿼리 크기 체크
    const querySize = Buffer.byteLength(sql, 'utf8')
    if (querySize > this.config.maxQuerySize!) {
      throw new DatabaseException(`Query too large: ${querySize} bytes. Max: ${this.config.maxQuerySize}`)
    }

    try {
      const result = await this.executeWithRetry(async () => {
        const stmt = this.db.prepare(sql)
        if (params && params.length > 0) {
          stmt.bind(...params)
        }
        return await stmt.all()
      })

      if (!result.success) {
        throw new DatabaseException(`D1 Query failed: ${result.error}`)
      }

      return (result.results || []) as T[]
    } catch (error) {
      throw this.handleError(error, { sql, params })
    }
  }

  async queryFirst<T = any>(sql: string, params?: any[]): Promise<T | null> {
    try {
      const result = await this.executeWithRetry(async () => {
        const stmt = this.db.prepare(sql)
        if (params && params.length > 0) {
          stmt.bind(...params)
        }
        return await stmt.first()
      })

      return result as T | null
    } catch (error) {
      throw this.handleError(error, { sql, params })
    }
  }

  async execute(sql: string, params?: any[]): Promise<ExecuteResult> {
    try {
      const result = await this.executeWithRetry(async () => {
        const stmt = this.db.prepare(sql)
        if (params && params.length > 0) {
          stmt.bind(...params)
        }
        return await stmt.run()
      })

      if (!result.success) {
        throw new DatabaseException(`D1 Execute failed: ${result.error}`)
      }

      return {
        changes: result.meta.rows_written,
        lastInsertRowid: result.meta.last_row_id,
        meta: {
          duration: result.meta.duration,
          rowsRead: result.meta.rows_read,
          rowsWritten: result.meta.rows_written,
          sizeAfter: result.meta.size_after
        }
      }
    } catch (error) {
      throw this.handleError(error, { sql, params })
    }
  }

  async transaction<T>(fn: (tx: ITransactionManager) => Promise<T>): Promise<T> {
    const txManager = new D1TransactionManager(this)
    
    try {
      // 트랜잭션 함수 실행하여 operations 수집
      const result = await fn(txManager)
      
      // Batch로 실제 실행
      await txManager.commit()
      
      return result
    } catch (error) {
      await txManager.rollback()
      throw error
    }
  }

  // 재시도 로직
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= this.config.maxRetries!; attempt++) {
      try {
        return await Promise.race([
          operation(),
          this.createTimeoutPromise()
        ])
      } catch (error) {
        lastError = error as Error
        
        // 재시도 가능한 에러인지 확인
        if (!this.isRetryableError(error) || attempt === this.config.maxRetries) {
          throw error
        }

        // 백오프 지연
        await this.delay(this.config.retryDelayMs! * Math.pow(2, attempt))
      }
    }

    throw lastError
  }

  private createTimeoutPromise<T>(): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new DatabaseException('Query timeout'))
      }, this.config.queryTimeout!)
    })
  }

  private isRetryableError(error: any): boolean {
    // D1 특정 재시도 가능한 에러 판단
    if (typeof error === 'string') {
      return error.includes('timeout') || 
             error.includes('rate limit') ||
             error.includes('temporary')
    }
    return false
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      provider: 'cloudflare-d1',
      version: '1.0.0',
      capabilities: [
        'transactions',        // batch 기반
        'prepared-statements'
      ],
      limits: {
        maxQuerySize: this.config.maxQuerySize,
        maxParamCount: this.config.maxParamCount,
        maxTransactionSize: 25, // D1 batch 크기 제한
        queryTimeout: this.config.queryTimeout
      }
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health')
      return result.length > 0
    } catch {
      return false
    }
  }

  async close(): Promise<void> {
    // D1은 연결 관리가 자동이므로 별도 작업 없음
  }

  private handleError(error: any, context: any): DatabaseException {
    const errorMsg = typeof error === 'string' ? error : error.message
    return new DatabaseException(`D1 operation failed: ${errorMsg}`, error, context)
  }
}

interface D1AdapterConfig {
  maxRetries?: number
  retryDelayMs?: number
  queryTimeout?: number
  enableQuerySplitting?: boolean
  maxQuerySize?: number
  maxParamCount?: number
}
```

### 2. D1 Transaction Manager

```typescript
export class D1TransactionManager implements ITransactionManager {
  private operations: D1Operation[] = []
  private adapter: CloudflareD1Adapter
  private isActive = true
  private committed = false
  private rolledBack = false

  constructor(adapter: CloudflareD1Adapter) {
    this.adapter = adapter
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.isActive) {
      throw new DatabaseException('Transaction is not active')
    }

    // 트랜잭션 내에서는 operation을 수집만 함
    const operation: D1Operation = {
      type: 'query',
      sql,
      params: params || [],
      expectsResult: true
    }
    
    this.operations.push(operation)
    
    // 실제 결과는 commit 시점에서 반환 (임시로 빈 배열)
    // 실제 구현에서는 더 정교한 처리 필요
    return [] as T[]
  }

  async queryFirst<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const results = await this.query<T>(sql, params)
    return results.length > 0 ? results[0] : null
  }

  async execute(sql: string, params?: any[]): Promise<ExecuteResult> {
    if (!this.isActive) {
      throw new DatabaseException('Transaction is not active')
    }

    const operation: D1Operation = {
      type: 'execute',
      sql,
      params: params || [],
      expectsResult: false
    }
    
    this.operations.push(operation)
    
    // 실제 결과는 commit 시점에서 반환
    return {
      changes: 0,
      lastInsertRowid: 0
    }
  }

  async commit(): Promise<void> {
    if (!this.isActive || this.committed || this.rolledBack) {
      return
    }

    try {
      // D1 batch 크기 제한 확인
      if (this.operations.length > 25) {
        throw new DatabaseException(`Too many operations in transaction: ${this.operations.length}. Max: 25`)
      }

      // D1PreparedStatement 배열 생성
      const statements: D1PreparedStatement[] = this.operations.map(op => {
        const stmt = (this.adapter as any).db.prepare(op.sql)
        if (op.params.length > 0) {
          stmt.bind(...op.params)
        }
        return stmt
      })

      // Batch 실행
      const results = await (this.adapter as any).db.batch(statements)
      
      // 결과 검증
      for (let i = 0; i < results.length; i++) {
        if (!results[i].success) {
          throw new DatabaseException(`Operation ${i} failed: ${results[i].error}`)
        }
      }

      this.committed = true
      this.isActive = false
      
    } catch (error) {
      this.rolledBack = true
      this.isActive = false
      throw error
    }
  }

  async rollback(): Promise<void> {
    if (this.committed) {
      throw new DatabaseException('Cannot rollback committed transaction')
    }

    this.rolledBack = true
    this.isActive = false
    this.operations = []
  }

  isActive(): boolean {
    return this.isActive && !this.committed && !this.rolledBack
  }
}

interface D1Operation {
  type: 'query' | 'execute'
  sql: string
  params: any[]
  expectsResult: boolean
}
```

### 3. 쿼리 분할 및 최적화

```typescript
export class D1QueryOptimizer {
  private static readonly MAX_QUERY_SIZE = 90 * 1024 // 90KB
  private static readonly MAX_PARAM_COUNT = 90

  static optimizeQuery(sql: string, params?: any[]): OptimizedQuery[] {
    // 1. 쿼리 크기 체크
    const querySize = Buffer.byteLength(sql, 'utf8')
    if (querySize <= this.MAX_QUERY_SIZE && (!params || params.length <= this.MAX_PARAM_COUNT)) {
      return [{ sql, params: params || [] }]
    }

    // 2. 큰 쿼리 분할 (INSERT 배치 등)
    if (this.isInsertQuery(sql) && params && params.length > this.MAX_PARAM_COUNT) {
      return this.splitInsertQuery(sql, params)
    }

    // 3. 복잡한 쿼리 단순화
    if (querySize > this.MAX_QUERY_SIZE) {
      return this.simplifyQuery(sql, params)
    }

    throw new DatabaseException('Query too complex to optimize for D1')
  }

  private static isInsertQuery(sql: string): boolean {
    return sql.trim().toLowerCase().startsWith('insert')
  }

  private static splitInsertQuery(sql: string, params: any[]): OptimizedQuery[] {
    // INSERT INTO table VALUES (?,?), (?,?), ... 형태의 쿼리 분할
    const queries: OptimizedQuery[] = []
    const baseSQL = sql.split('VALUES')[0] + 'VALUES'
    
    // 파라미터를 청크로 분할
    const chunkSize = this.MAX_PARAM_COUNT
    for (let i = 0; i < params.length; i += chunkSize) {
      const chunk = params.slice(i, i + chunkSize)
      const placeholders = chunk.map(() => '(?)').join(', ')
      
      queries.push({
        sql: `${baseSQL} ${placeholders}`,
        params: chunk
      })
    }
    
    return queries
  }

  private static simplifyQuery(sql: string, params?: any[]): OptimizedQuery[] {
    // 복잡한 쿼리를 여러 개의 간단한 쿼리로 분할
    // 예: JOIN이 많은 쿼리를 여러 개의 SELECT로 분할
    // 구현은 SQL 파싱이 필요하므로 기본 구조만 제시
    
    throw new DatabaseException('Complex query simplification not implemented')
  }
}

interface OptimizedQuery {
  sql: string
  params: any[]
}
```

## 🌥️ Cloudflare Workers 배포 설정

### 1. wrangler.toml 설정

```toml
name = "bun-graph-db"
main = "index.js"
compatibility_date = "2024-09-01"
compatibility_flags = ["nodejs_compat"]

# D1 Database 설정
[[d1_databases]]
binding = "DB"
database_name = "bun-graph-db"
database_id = "your-database-id"
migrations_dir = "migrations"

# Environment Variables
[env.production.vars]
DATABASE_PROVIDER = "cloudflare-d1"
DATABASE_TIMEOUT = "10000"
LOG_LEVEL = "info"

[env.development.vars]
DATABASE_PROVIDER = "bun-sqlite"
DATABASE_PATH = "./data/bun-graph-db.sqlite"
LOG_LEVEL = "debug"
```

### 2. 마이그레이션 스크립트

```sql
-- migrations/0001_initial_schema.sql
-- D1용 초기 스키마 (기존 core/schema.sql 기반)

-- D1에서 지원하지 않는 기능들 제거 또는 대체
-- 예: PRAGMA 문들, 복잡한 트리거들

CREATE TABLE IF NOT EXISTS tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ... 기타 테이블 정의 (D1 호환성 고려)

-- 기본 데이터 삽입 (배치로 분할)
INSERT OR IGNORE INTO attribute_types (identifier, json_type, description) VALUES 
  ('string', 'string', 'Basic string type'),
  ('boolean', 'boolean', 'Boolean true/false'),
  ('integer', 'integer', 'Integer number');

-- 두 번째 배치  
INSERT OR IGNORE INTO attribute_types (identifier, json_type, description) VALUES 
  ('number', 'number', 'Decimal number'),
  ('date', 'string', 'Date in YYYY-MM-DD format'),
  ('datetime', 'string', 'ISO 8601 datetime');

-- ... 기타 배치들
```

### 3. 환경별 설정

```typescript
// src/config/environment.ts
export interface EnvironmentConfig {
  databaseProvider: DatabaseProvider
  databaseConfig: DatabaseConfig
  logLevel: LogLevel
  corsEnabled: boolean
  graphiqlEnabled: boolean
}

export function getEnvironmentConfig(): EnvironmentConfig {
  const isCloudflareWorkers = typeof globalThis.DB !== 'undefined'
  const isDevelopment = process.env.NODE_ENV === 'development'

  if (isCloudflareWorkers) {
    return {
      databaseProvider: 'cloudflare-d1',
      databaseConfig: {
        d1Database: globalThis.DB,
        options: {
          maxRetries: 3,
          queryTimeout: 10000
        }
      },
      logLevel: LogLevel.INFO,
      corsEnabled: true,
      graphiqlEnabled: false // production에서는 비활성화
    }
  }

  return {
    databaseProvider: 'bun-sqlite',
    databaseConfig: {
      path: process.env.DATABASE_PATH || './data/bun-graph-db.sqlite',
      options: {
        enableWAL: true,
        timeout: 30000
      }
    },
    logLevel: isDevelopment ? LogLevel.DEBUG : LogLevel.INFO,
    corsEnabled: true,
    graphiqlEnabled: isDevelopment
  }
}
```

## 🚀 배포 전략

### 1. 점진적 배포

#### Phase 1: 로컬 D1 개발
```bash
# 로컬 D1 데이터베이스 생성
wrangler d1 create bun-graph-db

# 마이그레이션 실행
wrangler d1 migrations apply bun-graph-db --local

# 로컬 Workers 환경에서 테스트
wrangler dev --local
```

#### Phase 2: 원격 D1 배포
```bash
# 원격 D1 데이터베이스에 마이그레이션 적용
wrangler d1 migrations apply bun-graph-db

# Workers에 배포
wrangler deploy
```

### 2. 호환성 테스트

```typescript
// tests/compatibility/d1-compatibility.test.ts
describe('D1 Compatibility Tests', () => {
  let adapter: CloudflareD1Adapter
  
  beforeAll(async () => {
    // 로컬 D1 인스턴스 생성
    adapter = new CloudflareD1Adapter(mockD1Database)
  })

  test('should handle query size limits', async () => {
    const largeQuery = 'SELECT * FROM nodes WHERE content IN (' + 
      Array(200).fill('?').join(',') + ')'
    const params = Array(200).fill('test')
    
    await expect(adapter.query(largeQuery, params))
      .rejects.toThrow('Too many parameters')
  })

  test('should handle transaction batch limits', async () => {
    const operations = Array(30).fill(null).map(() => ({
      sql: 'INSERT INTO test_table (value) VALUES (?)',
      params: ['test']
    }))

    await expect(adapter.transaction(async (tx) => {
      for (const op of operations) {
        await tx.execute(op.sql, op.params)
      }
    })).rejects.toThrow('Too many operations')
  })

  test('should retry on temporary errors', async () => {
    // Mock D1 API to simulate temporary failure
    const mockDB = createMockD1WithFailure(1) // 1번 실패 후 성공
    const testAdapter = new CloudflareD1Adapter(mockDB)
    
    const result = await testAdapter.query('SELECT 1')
    expect(result).toEqual([{ 1: 1 }])
  })
})
```

## 📊 성능 최적화

### 1. 연결 풀링 (불필요)
D1은 자체적으로 연결을 관리하므로 별도 풀링 불필요

### 2. 쿼리 캐싱
```typescript
export class D1QueryCache {
  private cache = new Map<string, CachedResult>()
  private maxSize = 100
  private ttl = 5 * 60 * 1000 // 5분

  set(key: string, result: any): void {
    if (this.cache.size >= this.maxSize) {
      this.evictOldest()
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now()
    })
  }

  get(key: string): any | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }

    return cached.result
  }

  private evictOldest(): void {
    const oldest = Array.from(this.cache.entries())
      .sort(([,a], [,b]) => a.timestamp - b.timestamp)[0]
    
    if (oldest) {
      this.cache.delete(oldest[0])
    }
  }
}

interface CachedResult {
  result: any
  timestamp: number
}
```

### 3. 배치 최적화
```typescript
export class D1BatchOptimizer {
  static optimizeBatch(operations: D1Operation[]): D1Operation[][] {
    const batches: D1Operation[][] = []
    const BATCH_SIZE = 25

    // 읽기/쓰기 분리
    const reads = operations.filter(op => op.type === 'query')
    const writes = operations.filter(op => op.type === 'execute')

    // 쓰기 작업을 배치로 분할
    for (let i = 0; i < writes.length; i += BATCH_SIZE) {
      batches.push(writes.slice(i, i + BATCH_SIZE))
    }

    // 읽기 작업은 병렬 실행 가능하므로 별도 처리
    if (reads.length > 0) {
      batches.push(reads)
    }

    return batches
  }
}
```

## ⚠️ 주의사항 및 제한사항

### 1. D1 특정 제한사항
- **쿼리 크기**: 100KB 제한
- **파라미터 수**: 100개 제한  
- **배치 크기**: 25개 statement 제한
- **동시 연결**: Workers 당 자동 관리
- **트랜잭션**: 실제 ACID가 아닌 배치 처리
- **일부 SQLite 기능 미지원**: FTS, 일부 함수들

### 2. 성능 고려사항
- **네트워크 지연**: 모든 쿼리가 네트워크를 통해 실행
- **Cold Start**: Workers cold start 시 초기화 지연
- **배치 처리 우선**: 가능한 한 배치로 처리하여 네트워크 호출 최소화

### 3. 개발/배포 고려사항
- **로컬 개발**: `wrangler dev --local`로 로컬 D1 사용
- **스키마 마이그레이션**: Wrangler CLI 통해서만 가능
- **디버깅**: Workers 환경에서 제한적인 디버깅 도구

## 🎯 기대 효과

1. **서버리스 배포**: Cloudflare Workers에서 완전한 서버리스 실행
2. **글로벌 배포**: Edge network를 통한 낮은 지연시간
3. **자동 스케일링**: 트래픽에 따른 자동 확장/축소
4. **비용 효율성**: 사용량 기반 과금
5. **높은 가용성**: Cloudflare 인프라의 안정성
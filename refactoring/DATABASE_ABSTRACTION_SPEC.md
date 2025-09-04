# Database Abstraction Layer 상세 설계

> **이 문서는 [REFACTOR_SPECIFICATION.md](./REFACTOR_SPECIFICATION.md)의 Database Abstraction 부분을 상세히 다룹니다.**

## 🎯 추상화 목표

현재 Bun SQLite에 강결합된 데이터베이스 계층을 추상화하여 Cloudflare D1으로 쉽게 전환할 수 있는 구조 설계

## 📋 현재 상태 분석

### 문제점
```typescript
// 현재: SqliteConnection이 Bun SQLite에 강결합
export class SqliteConnection {
  private db: Database | null = null // Bun SQLite Database 타입
  
  getDatabase(): Database { // Bun 전용 타입 반환
    // Bun SQLite 전용 로직
  }
}

// Repository에서 직접 Database 객체 사용
export class SqliteNodeRepository {
  constructor(private db: Database) {} // Bun 전용
  
  async create(node: Node): Promise<Node> {
    const stmt = this.db.prepare("...") // Bun 전용 API
    return stmt.run(params)
  }
}
```

## 🏗️ 새로운 추상화 설계

### 1. Core Interfaces

#### IDatabaseConnection
```typescript
export interface IDatabaseConnection {
  // 기본 쿼리 실행
  query<T = any>(sql: string, params?: any[]): Promise<T[]>
  queryFirst<T = any>(sql: string, params?: any[]): Promise<T | null>
  execute(sql: string, params?: any[]): Promise<ExecuteResult>
  
  // 트랜잭션
  transaction<T>(fn: (tx: ITransactionManager) => Promise<T>): Promise<T>
  
  // 연결 관리
  isHealthy(): Promise<boolean>
  close(): Promise<void>
  
  // 메타데이터
  getConnectionInfo(): ConnectionInfo
}

export interface ExecuteResult {
  changes: number
  lastInsertRowid?: number | bigint
  meta?: Record<string, any>
}

export interface ConnectionInfo {
  provider: DatabaseProvider
  version?: string
  capabilities: DatabaseCapability[]
  limits?: DatabaseLimits
}

export type DatabaseProvider = 'bun-sqlite' | 'cloudflare-d1' | 'postgres' | 'mysql'

export type DatabaseCapability = 
  | 'transactions' 
  | 'prepared-statements'
  | 'concurrent-reads'
  | 'wal-mode'
  | 'foreign-keys'
  | 'json-functions'
  | 'full-text-search'

export interface DatabaseLimits {
  maxQuerySize?: number
  maxParamCount?: number
  maxTransactionSize?: number
  queryTimeout?: number
}
```

#### ITransactionManager
```typescript
export interface ITransactionManager {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>
  queryFirst<T = any>(sql: string, params?: any[]): Promise<T | null>
  execute(sql: string, params?: any[]): Promise<ExecuteResult>
  
  // 트랜잭션 상태
  isActive(): boolean
  
  // 수동 제어 (일부 Provider에서 지원)
  commit?(): Promise<void>
  rollback?(): Promise<void>
}
```

### 2. Provider별 구현체

#### BunSqliteAdapter
```typescript
export class BunSqliteAdapter implements IDatabaseConnection {
  private db: Database
  
  constructor(dbPath: string, options?: BunSqliteOptions) {
    this.db = new Database(dbPath, options)
    this.initialize()
  }
  
  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    const stmt = this.db.prepare(sql)
    return stmt.all(...(params || [])) as T[]
  }
  
  async queryFirst<T>(sql: string, params?: any[]): Promise<T | null> {
    const stmt = this.db.prepare(sql)
    const result = stmt.get(...(params || []))
    return result ? (result as T) : null
  }
  
  async execute(sql: string, params?: any[]): Promise<ExecuteResult> {
    const stmt = this.db.prepare(sql)
    const result = stmt.run(...(params || []))
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid
    }
  }
  
  async transaction<T>(fn: (tx: ITransactionManager) => Promise<T>): Promise<T> {
    return this.db.transaction(async () => {
      const tx = new BunTransactionManager(this)
      return await fn(tx)
    })()
  }
  
  getConnectionInfo(): ConnectionInfo {
    return {
      provider: 'bun-sqlite',
      version: '1.0.0', // Bun SQLite 버전
      capabilities: [
        'transactions',
        'prepared-statements', 
        'concurrent-reads',
        'wal-mode',
        'foreign-keys',
        'json-functions',
        'full-text-search'
      ],
      limits: {
        maxQuerySize: 1024 * 1024, // 1MB
        maxParamCount: 999,
        queryTimeout: 30000 // 30초
      }
    }
  }
}
```

#### CloudflareD1Adapter
```typescript
export class CloudflareD1Adapter implements IDatabaseConnection {
  private db: D1Database
  
  constructor(database: D1Database, options?: D1Options) {
    this.db = database
  }
  
  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    const result = await this.db.prepare(sql).bind(...(params || [])).all()
    if (!result.success) {
      throw new DatabaseException(`D1 Query failed: ${result.error}`)
    }
    return result.results as T[]
  }
  
  async queryFirst<T>(sql: string, params?: any[]): Promise<T | null> {
    const result = await this.db.prepare(sql).bind(...(params || [])).first()
    return result as T | null
  }
  
  async execute(sql: string, params?: any[]): Promise<ExecuteResult> {
    const result = await this.db.prepare(sql).bind(...(params || [])).run()
    if (!result.success) {
      throw new DatabaseException(`D1 Execute failed: ${result.error}`)
    }
    return {
      changes: result.changes,
      lastInsertRowid: result.meta.last_row_id,
      meta: result.meta
    }
  }
  
  async transaction<T>(fn: (tx: ITransactionManager) => Promise<T>): Promise<T> {
    // D1의 batch API 사용
    const operations: D1PreparedStatement[] = []
    const tx = new D1TransactionManager(this.db, operations)
    
    await fn(tx)
    
    const results = await this.db.batch(operations)
    // 결과 처리 로직...
    return results as T
  }
  
  getConnectionInfo(): ConnectionInfo {
    return {
      provider: 'cloudflare-d1',
      version: '1.0.0',
      capabilities: [
        'transactions', // batch 기반
        'prepared-statements'
        // D1은 일부 기능 제한적
      ],
      limits: {
        maxQuerySize: 100 * 1024, // 100KB (D1 제한)
        maxParamCount: 100,       // D1 제한
        maxTransactionSize: 25,   // batch 크기 제한
        queryTimeout: 10000       // 10초
      }
    }
  }
}
```

### 3. Factory Pattern

#### DatabaseProviderFactory
```typescript
export class DatabaseProviderFactory {
  private static connections = new Map<string, IDatabaseConnection>()
  
  static create(
    provider: DatabaseProvider,
    config: DatabaseConfig
  ): IDatabaseConnection {
    const key = `${provider}:${JSON.stringify(config)}`
    
    if (this.connections.has(key)) {
      return this.connections.get(key)!
    }
    
    let connection: IDatabaseConnection
    
    switch (provider) {
      case 'bun-sqlite':
        connection = new BunSqliteAdapter(
          config.path || './data/database.sqlite',
          config.options
        )
        break
        
      case 'cloudflare-d1':
        if (!config.d1Database) {
          throw new Error('D1Database instance required for Cloudflare D1')
        }
        connection = new CloudflareD1Adapter(
          config.d1Database,
          config.options
        )
        break
        
      default:
        throw new Error(`Unsupported database provider: ${provider}`)
    }
    
    this.connections.set(key, connection)
    return connection
  }
  
  static async createFromEnvironment(): Promise<IDatabaseConnection> {
    const provider = process.env.DATABASE_PROVIDER as DatabaseProvider || 'bun-sqlite'
    
    const config: DatabaseConfig = {
      path: process.env.DATABASE_PATH || './data/bun-graph-db.sqlite',
      d1Database: globalThis.DB, // Cloudflare Worker 환경에서 자동 주입
      options: {
        enableWAL: process.env.NODE_ENV === 'production',
        timeout: parseInt(process.env.DATABASE_TIMEOUT || '30000')
      }
    }
    
    return this.create(provider, config)
  }
}

export interface DatabaseConfig {
  path?: string
  d1Database?: D1Database
  options?: Record<string, any>
}
```

### 4. Repository 수정 전략

#### Before (현재)
```typescript
export class SqliteNodeRepository implements INodeRepository {
  constructor(private db: Database) {} // Bun 전용
  
  async create(node: Node): Promise<Node> {
    const stmt = this.db.prepare(`
      INSERT INTO nodes (table_id, content, title, description) 
      VALUES (?, ?, ?, ?)
    `)
    const result = stmt.run(node.tableId, node.content, node.title, node.description)
    // ...
  }
}
```

#### After (추상화 적용)
```typescript
export class DatabaseNodeRepository implements INodeRepository {
  constructor(private connection: IDatabaseConnection) {} // 추상화된 인터페이스
  
  async create(node: Node): Promise<Node> {
    const result = await this.connection.execute(`
      INSERT INTO nodes (table_id, content, title, description) 
      VALUES (?, ?, ?, ?)
    `, [node.tableId, node.content, node.title, node.description])
    
    // Provider에 관계없이 동일한 로직
    const created = await this.connection.queryFirst<NodeRow>(`
      SELECT * FROM nodes WHERE id = ?
    `, [result.lastInsertRowid])
    
    return this.mapToEntity(created!)
  }
}
```

## 🔄 Migration 전략

### Phase 1: Interface 정의
1. `IDatabaseConnection` 및 관련 타입들 정의
2. `BunSqliteAdapter` 구현 (기존 로직 포팅)
3. Factory 패턴 구현

### Phase 2: Repository 수정
1. Repository들이 `IDatabaseConnection` 사용하도록 수정
2. SQL 쿼리를 Provider별로 최적화할 수 있는 구조 추가
3. 기존 테스트 케이스들 모두 통과하는지 검증

### Phase 3: Cloudflare D1 지원
1. `CloudflareD1Adapter` 구현
2. D1 특화 최적화 (batch operations, 쿼리 크기 제한 등)
3. 환경 변수 기반 Provider 전환 테스트

### Phase 4: 성능 최적화
1. Connection pooling (필요시)
2. Prepared statement caching
3. Provider별 성능 최적화

## 📊 Provider별 특성 비교

| 기능 | Bun SQLite | Cloudflare D1 | 비고 |
|------|------------|---------------|------|
| 트랜잭션 | Native transaction | Batch API | D1은 batch 기반 |
| 동시성 | WAL mode 지원 | 자동 관리 | D1이 더 단순 |
| 쿼리 크기 | ~1MB | ~100KB | D1 제한 더 엄격 |
| 파라미터 개수 | 999개 | 100개 | D1 제한 더 엄격 |
| JSON 함수 | 완전 지원 | 부분 지원 | 기능 차이 존재 |
| Full-text Search | FTS5 지원 | 미지원 | 기능 차이 |

## ⚠️ 주의사항

1. **쿼리 호환성**: SQLite 방언 차이로 일부 쿼리 수정 필요
2. **성능 특성**: D1은 네트워크 기반이므로 배치 처리 최적화 필요  
3. **제한사항**: D1의 쿼리 크기, 파라미터 개수 제한 고려
4. **트랜잭션**: D1의 batch API는 진정한 트랜잭션과 다름
5. **에러 처리**: Provider별 에러 타입과 메시지가 다름

## 🎯 예상 이점

1. **유연성**: 배포 환경에 따라 다른 DB 사용 가능
2. **테스트성**: Mock adapter로 단위 테스트 용이
3. **성능**: Provider별 최적화 가능  
4. **확장성**: 새로운 DB Provider 쉽게 추가
5. **마이그레이션**: 점진적 전환 가능
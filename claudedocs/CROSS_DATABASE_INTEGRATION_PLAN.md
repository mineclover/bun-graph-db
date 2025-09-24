# 크로스 데이터베이스 연동 기능 구현 계획서

**작성일**: 2025-09-25
**대상 기능**: 데이터베이스 간 데이터 연동 및 고유 식별자 시스템
**현재 상태**: 30% 구현 (identifier 기반 기초 인프라)

## 🎯 목표

기존 `Table.identifier` 기반 고유성을 확장하여 **여러 데이터베이스 인스턴스 간 데이터 연동**이 가능한 시스템 구축

## 📋 현재 상황 분석

### ✅ 기존 구현 현황
```typescript
// 현재 Table.ts에 구현된 identifier 시스템
class Table {
  private readonly _identifier: string  // 테이블별 고유 식별자

  static create(identifier: string) {
    // 고유성 검증: ^[a-zA-Z][a-zA-Z0-9_-]*$
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(identifier)) {
      throw new DomainException('Table identifier must be unique')
    }
  }
}

// Node.ts에서 테이블 연결
class Node {
  constructor(private readonly tableId: TableId) {
    // 테이블과 노드 간 연결 관계
  }
}
```

### 🔄 활용 가능한 기존 인프라
1. **Table.identifier**: 이미 구현된 고유 식별자 시스템
2. **도메인 엔티티 구조**: 확장 가능한 객체지향 설계
3. **GraphQL 스키마**: 동적 확장을 지원하는 API 구조
4. **Repository 패턴**: 데이터 액세스 추상화 완료

## 🏗️ 구현 계획

### Phase 1: 데이터베이스 인스턴스 식별자 시스템
**목표**: 각 데이터베이스 인스턴스에 고유한 식별자 부여

#### 1.1 DatabaseInstance 엔티티 생성
```typescript
// src/domain/entities/DatabaseInstance.ts
export class DatabaseInstance {
  constructor(
    private readonly _id: DatabaseInstanceId,
    private readonly _identifier: string,      // 예: "production", "staging", "user_local"
    private readonly _connectionString: string,
    private readonly _description: string | null,
    private readonly _isActive: boolean
  ) {}

  static create(
    identifier: string,
    connectionString: string,
    description?: string
  ): DatabaseInstance {
    // 식별자 고유성 검증
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(identifier)) {
      throw new DomainException('DatabaseInstance identifier format invalid')
    }
    return new DatabaseInstance(/* ... */)
  }
}
```

#### 1.2 확장된 테이블 식별자 시스템
```typescript
// src/domain/entities/Table.ts 확장
export class Table {
  constructor(
    private readonly _id: TableId,
    private readonly _identifier: string,
    private readonly _databaseInstanceId: DatabaseInstanceId | null,  // 신규 추가
    // ... 기존 필드들
  ) {}

  // 글로벌 고유 식별자 생성
  getGlobalIdentifier(): string {
    return this._databaseInstanceId
      ? `${this._databaseInstanceId}:${this._identifier}`
      : this._identifier  // 로컬 DB의 경우 기존 방식 유지
  }
}
```

### Phase 2: 크로스 DB 연결 관리자
**목표**: 여러 데이터베이스 간 연결 및 쿼리 라우팅

#### 2.1 CrossDatabaseManager 서비스
```typescript
// src/application/services/CrossDatabaseManager.ts
export class CrossDatabaseManager {
  constructor(
    private readonly localRepository: ITableRepository,
    private readonly connections: Map<DatabaseInstanceId, ITableRepository>
  ) {}

  async findTable(globalIdentifier: string): Promise<Table | null> {
    const [instanceId, tableIdentifier] = this.parseGlobalIdentifier(globalIdentifier)

    if (!instanceId) {
      // 로컬 데이터베이스 검색
      return await this.localRepository.findByIdentifier(tableIdentifier)
    }

    // 외부 데이터베이스 검색
    const remoteRepository = this.connections.get(instanceId)
    return await remoteRepository?.findByIdentifier(tableIdentifier) || null
  }

  async syncTable(
    sourceGlobalId: string,
    targetGlobalId: string
  ): Promise<SyncResult> {
    // 데이터베이스 간 테이블 동기화 로직
  }
}
```

#### 2.2 GraphQL 확장
```graphql
# src/presentation/graphql/schema/types/database.graphql
type DatabaseInstance {
  id: ID!
  identifier: String!
  description: String
  isActive: Boolean!
  connectionStatus: ConnectionStatus!
}

type Table {
  id: ID!
  identifier: String!
  databaseInstance: DatabaseInstance  # 신규 추가
  globalIdentifier: String!           # 신규 추가
  # ... 기존 필드들
}

extend type Query {
  # 글로벌 테이블 검색
  tableByGlobalId(globalIdentifier: String!): Table

  # 데이터베이스 인스턴스 관리
  databaseInstances: [DatabaseInstance!]!
}

extend type Mutation {
  # 데이터베이스 간 동기화
  syncTable(
    source: String!
    target: String!
  ): SyncResult!
}
```

### Phase 3: 데이터 동기화 시스템
**목표**: 데이터베이스 간 안전한 데이터 복사 및 동기화

#### 3.1 동기화 전략
```typescript
export interface SyncStrategy {
  readonly type: 'full' | 'incremental' | 'selective'
  readonly conflictResolution: 'source_wins' | 'target_wins' | 'manual'
}

export class TableSyncService {
  async syncTables(
    sourceGlobalId: string,
    targetGlobalId: string,
    strategy: SyncStrategy
  ): Promise<SyncResult> {
    // 1. 소스 테이블 스키마 분석
    // 2. 타겟 테이블 호환성 검증
    // 3. 데이터 변환 및 복사
    // 4. 충돌 해결
    // 5. 동기화 결과 반환
  }
}
```

### Phase 4: MCP 도구 확장
**목표**: 크로스 DB 기능을 MCP 인터페이스로 제공

#### 4.1 신규 MCP 도구들
```javascript
// 크로스 DB 전용 MCP 도구 추가
const crossDbTools = [
  'connectDatabase',        // 외부 DB 연결
  'syncTableAcrossDbs',    // DB 간 테이블 동기화
  'findTableGlobally',     // 글로벌 테이블 검색
  'manageDatabaseInstances' // DB 인스턴스 관리
]
```

## 📅 구현 일정

### Week 1-2: Phase 1 (기초 인프라)
- [ ] `DatabaseInstance` 엔티티 구현
- [ ] `Table` 엔티티 확장 (`databaseInstanceId` 필드 추가)
- [ ] 데이터베이스 마이그레이션 스크립트
- [ ] 기본 GraphQL 스키마 확장

### Week 3-4: Phase 2 (연결 관리)
- [ ] `CrossDatabaseManager` 서비스 구현
- [ ] 멀티 데이터베이스 연결 풀 관리
- [ ] GraphQL 리졸버 확장
- [ ] 기본 연동 테스트

### Week 5-6: Phase 3 (동기화 시스템)
- [ ] `TableSyncService` 구현
- [ ] 데이터 변환 및 충돌 해결 로직
- [ ] 동기화 상태 추적 시스템
- [ ] 완전성 및 안정성 테스트

### Week 7: Phase 4 (MCP 확장)
- [ ] 신규 MCP 도구 구현
- [ ] MCP-REST-GraphQL 프록시 확장
- [ ] 통합 테스트 및 문서화

## 🔧 기술 구현 세부사항

### 데이터베이스 스키마 변경
```sql
-- 새로운 테이블 추가
CREATE TABLE database_instances (
    id TEXT PRIMARY KEY,
    identifier TEXT UNIQUE NOT NULL,
    connection_string TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 기존 tables 테이블 확장
ALTER TABLE tables ADD COLUMN database_instance_id TEXT REFERENCES database_instances(id);
CREATE INDEX idx_tables_db_instance ON tables(database_instance_id);
```

### 설정 파일 확장
```yaml
# config/database.yml
databases:
  local:
    type: sqlite
    path: ./data/local.db

  production:
    identifier: "prod"
    type: sqlite  # 또는 postgresql, mysql 등
    connection: "path/to/prod.db"

  staging:
    identifier: "staging"
    type: sqlite
    connection: "path/to/staging.db"

sync_settings:
  default_strategy: "incremental"
  conflict_resolution: "source_wins"
  max_concurrent_syncs: 3
```

## 🎯 예상 사용 시나리오

### 시나리오 1: 개발/운영 환경 데이터 동기화
```graphql
# 1. 운영 DB의 사용자 테이블을 개발 환경으로 복사
mutation {
  syncTable(
    source: "production:users"
    target: "development:users"
  ) {
    success
    syncedRecords
    conflicts { id reason resolution }
  }
}

# 2. 글로벌 테이블 검색
query {
  tableByGlobalId(globalIdentifier: "production:users") {
    id
    identifier
    databaseInstance { identifier }
    nodeCount
    attributes { identifier name }
  }
}
```

### 시나리오 2: 다중 환경 템플릿 실행
```graphql
# 특정 DB 인스턴스를 대상으로 한 템플릿 실행
mutation {
  executeTemplateWithGraphQL(
    templateIdentifier: "create-user-template"
    variables: {
      name: "홍길동"
      databaseInstance: "staging"  # 대상 DB 지정
    }
  ) {
    success
    data
  }
}
```

## 📈 성능 및 보안 고려사항

### 성능 최적화
- **연결 풀링**: 데이터베이스 연결 재사용
- **캐싱 전략**: 자주 조회되는 원격 데이터 로컬 캐시
- **비동기 동기화**: 대용량 데이터 처리를 위한 백그라운드 작업

### 보안 강화
- **연결 암호화**: 데이터베이스 간 통신 암호화
- **접근 권한 관리**: 데이터베이스별 접근 권한 세분화
- **감사 로그**: 크로스 DB 작업 모든 기록

## 🧪 테스트 전략

### 단위 테스트
- `DatabaseInstance` 엔티티 검증
- `CrossDatabaseManager` 로직 테스트
- 동기화 알고리즘 정확성 검증

### 통합 테스트
- 실제 다중 DB 환경 연동 테스트
- 대용량 데이터 동기화 성능 테스트
- 네트워크 장애 시 복원력 테스트

### E2E 테스트
- GraphQL을 통한 크로스 DB 쿼리
- MCP 도구를 통한 원격 DB 작업
- 실제 시나리오 기반 워크플로우 테스트

## 🎯 결론

이 계획은 기존의 **`Table.identifier` 시스템을 활용**하여 크로스 데이터베이스 연동을 구현하는 **점진적 확장 방식**입니다.

**핵심 장점**:
1. **기존 코드 호환성**: 현재 구현에 최소한의 변경
2. **단계적 구현**: 각 Phase별 독립적 검증 가능
3. **확장성**: 미래 요구사항 대응을 위한 유연한 구조

이 구현을 통해 시스템은 **진정한 다중 데이터베이스 그래프 관리 플랫폼**으로 진화할 것입니다.
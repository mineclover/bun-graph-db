# Architecture Refactoring Design Document

## 🎯 목표

1. **GraphQL 관심사 분리**: Query, Mutation, Subscription을 명확히 분리
2. **Database Abstraction**: Bun SQLite ↔ Cloudflare D1 간 쉬운 전환
3. **의존성 주입 개선**: Service Locator → 실제 DI 패턴

## 🏗️ 새로운 아키텍처 구조

```
src/
├── core/                                    # 핵심 추상화 계층
│   ├── database/                           
│   │   ├── interfaces/                     # Database 추상화
│   │   │   ├── IDatabaseConnection.ts      # 연결 인터페이스
│   │   │   ├── IQueryExecutor.ts          # 쿼리 실행 인터페이스  
│   │   │   └── ITransactionManager.ts     # 트랜잭션 관리
│   │   ├── adapters/                      # Provider별 구현체
│   │   │   ├── BunSqliteAdapter.ts        # Bun SQLite 구현
│   │   │   └── CloudflareD1Adapter.ts     # Cloudflare D1 구현
│   │   └── DatabaseProviderFactory.ts     # Factory 패턴
│   ├── types/                             # 공통 타입 정의
│   │   ├── DatabaseTypes.ts
│   │   └── GraphQLTypes.ts
│   └── config/                            # 설정 관리
│       ├── DatabaseConfig.ts
│       └── GraphQLConfig.ts
│
├── domain/                                 # 기존 도메인 레이어 (변경 없음)
│   ├── entities/
│   ├── repositories/
│   └── value-objects/
│
├── application/                            # 기존 애플리케이션 레이어 (변경 없음)
│   ├── use-cases/
│   ├── dtos/
│   └── ports/
│
├── infrastructure/                         # Infrastructure 계층
│   ├── database/                          
│   │   ├── repositories/                  # Repository 구현체 (기존)
│   │   └── connections/                   # Connection 구현체들
│   │       ├── BunSqliteConnection.ts
│   │       └── CloudflareD1Connection.ts
│   ├── container/                         # DI Container 개선
│   │   ├── DIContainer.ts                 # 새로운 DI 컨테이너
│   │   ├── ServiceRegistry.ts             # 서비스 등록 관리
│   │   └── DatabaseModule.ts              # Database 모듈
│   └── logging/
│
├── presentation/                           # Presentation 계층 재구조화
│   ├── graphql/                           
│   │   ├── queries/                       # Query 전용 Resolvers
│   │   │   ├── TableQueries.ts
│   │   │   ├── NodeQueries.ts
│   │   │   ├── RelationQueries.ts
│   │   │   ├── AnalyticsQueries.ts
│   │   │   └── index.ts
│   │   ├── mutations/                     # Mutation 전용 Resolvers
│   │   │   ├── TableMutations.ts
│   │   │   ├── NodeMutations.ts
│   │   │   ├── RelationMutations.ts
│   │   │   └── index.ts
│   │   ├── subscriptions/                 # Subscription Resolvers
│   │   │   ├── RealtimeSubscriptions.ts
│   │   │   └── index.ts
│   │   ├── schema/                        # GraphQL 스키마 파일들
│   │   │   ├── root.graphql              # Root Query/Mutation/Subscription
│   │   │   ├── types/                    # 타입 정의들
│   │   │   │   ├── table.graphql
│   │   │   │   ├── node.graphql
│   │   │   │   ├── relation.graphql
│   │   │   │   └── common.graphql
│   │   │   ├── queries/                  # Query 스키마들
│   │   │   │   ├── table-queries.graphql
│   │   │   │   ├── node-queries.graphql
│   │   │   │   └── relation-queries.graphql  
│   │   │   ├── mutations/                # Mutation 스키마들
│   │   │   │   ├── table-mutations.graphql
│   │   │   │   ├── node-mutations.graphql
│   │   │   │   └── relation-mutations.graphql
│   │   │   └── subscriptions/            # Subscription 스키마들
│   │   │       └── realtime.graphql
│   │   ├── field-resolvers/              # Field Resolver들
│   │   │   ├── TableFieldResolvers.ts
│   │   │   ├── NodeFieldResolvers.ts
│   │   │   └── RelationFieldResolvers.ts
│   │   └── GraphQLSchemaBuilder.ts       # 스키마 빌더 (새로운 구조)
│   └── types/                            # GraphQL 타입 정의
│
└── index.ts                               # 진입점
```

## 🔄 주요 변경사항

### 1. Database Abstraction Layer

#### 현재 문제점
- `SqliteConnection`이 Bun SQLite에 강결합
- Repository가 직접 Database 객체를 의존

#### 해결 방안
```typescript
// core/database/interfaces/IDatabaseConnection.ts
export interface IDatabaseConnection {
  query<T>(sql: string, params?: any[]): Promise<T[]>
  execute(sql: string, params?: any[]): Promise<ExecuteResult>  
  transaction<T>(fn: (tx: ITransactionManager) => Promise<T>): Promise<T>
  isHealthy(): Promise<boolean>
  getConnectionInfo(): ConnectionInfo
}

// 사용 예시
const connection: IDatabaseConnection = DatabaseProviderFactory.create(
  process.env.DATABASE_PROVIDER // 'bun-sqlite' | 'cloudflare-d1'
)
```

#### Provider 별 구현체
```typescript
// BunSqliteAdapter: 기존 Bun SQLite 로직
// CloudflareD1Adapter: Cloudflare D1 API 호출 로직
```

### 2. GraphQL 관심사 분리

#### 현재 문제점
- `schema-builder.ts`에 모든 resolver가 집중됨
- Query/Mutation/Subscription 구분 없이 하나의 거대한 객체

#### 해결 방안

**Query Resolvers** (읽기 전용)
```typescript
// presentation/graphql/queries/NodeQueries.ts
export class NodeQueries {
  constructor(
    private searchNodesUseCase: SearchNodesUseCase,
    private nodeRepository: INodeRepository
  ) {}

  async node(args: NodeArgs): Promise<Node> { /* */ }
  async nodes(args: NodesArgs): Promise<NodeConnection> { /* */ }
  async searchNodes(args: SearchNodesArgs): Promise<SearchResult> { /* */ }
}
```

**Mutation Resolvers** (쓰기 작업)
```typescript  
// presentation/graphql/mutations/NodeMutations.ts
export class NodeMutations {
  constructor(
    private createNodeUseCase: CreateNodeUseCase,
    private updateNodeUseCase: UpdateNodeUseCase
  ) {}

  async createNode(args: CreateNodeArgs): Promise<Node> { /* */ }
  async updateNode(args: UpdateNodeArgs): Promise<Node> { /* */ }
  async deleteNode(args: DeleteNodeArgs): Promise<boolean> { /* */ }
}
```

**Subscription Resolvers** (실시간 업데이트)
```typescript
// presentation/graphql/subscriptions/RealtimeSubscriptions.ts  
export class RealtimeSubscriptions {
  async nodeCreated(): Promise<AsyncIterator<Node>> { /* */ }
  async nodeUpdated(): Promise<AsyncIterator<Node>> { /* */ }
}
```

### 3. 의존성 주입 개선

#### 현재 문제점
- Service Locator 패턴 (안티패턴)
- 전역 상태 공유로 인한 tight coupling

#### 해결 방안
```typescript
// infrastructure/container/DIContainer.ts
export class DIContainer {
  private services = new Map<string, ServiceDefinition>()
  
  register<T>(identifier: string, factory: () => T): void
  resolve<T>(identifier: string): T
  createScope(): DIContainer // Scoped 인스턴스
}

// infrastructure/container/DatabaseModule.ts
export class DatabaseModule {
  static register(container: DIContainer): void {
    container.register('IDatabaseConnection', () => 
      DatabaseProviderFactory.create(config.databaseProvider)
    )
    // Repository 등록들...
  }
}
```

## 📋 Migration Plan

### Phase 1: Database Abstraction
1. `IDatabaseConnection` 인터페이스 정의
2. `BunSqliteAdapter` 구현 (기존 로직 이전)
3. Repository들을 인터페이스 기반으로 수정

### Phase 2: GraphQL 구조 분리
1. Query/Mutation/Subscription Resolver 클래스 분리
2. GraphQL 스키마 파일들 도메인별로 분리
3. `GraphQLSchemaBuilder` 새로운 구조로 재작성

### Phase 3: DI Container 교체
1. 새로운 `DIContainer` 구현
2. Service Module 패턴 적용
3. 기존 `DependencyContainer` 교체

### Phase 4: Cloudflare D1 지원
1. `CloudflareD1Adapter` 구현
2. 환경 변수 기반 Provider 전환
3. D1 특화 최적화

## 🎯 기대 효과

1. **유지보수성**: 관심사별로 명확히 분리된 코드
2. **확장성**: 새로운 Database Provider 쉽게 추가
3. **테스트성**: Mock 객체 주입으로 단위 테스트 용이
4. **성능**: Provider별 최적화 가능
5. **배포 유연성**: 환경별 다른 Database 사용 가능

## ⚠️ 주의사항

1. **Breaking Changes**: 기존 코드 대부분 수정 필요
2. **Migration Period**: 단계적 이전 필요 (약 2-3주)
3. **Testing**: 각 Phase별 충분한 테스트 필요
4. **Documentation**: 새로운 구조에 대한 문서화 필요
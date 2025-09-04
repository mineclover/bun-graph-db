# 새로운 폴더 구조 설계

## 🎯 구조 설계 목표

현재의 평면적이고 역할이 혼재된 구조를 **계층별**, **관심사별**로 명확히 분리

## 📁 전체 폴더 구조

```
src/
├── core/                           # 🔥 핵심 비즈니스 추상화 계층
│   ├── database/                   
│   │   ├── interfaces/             # Database 추상화 인터페이스들
│   │   │   ├── IDatabaseConnection.ts
│   │   │   ├── IQueryExecutor.ts
│   │   │   └── ITransactionManager.ts
│   │   ├── adapters/               # Provider별 구현체들
│   │   │   ├── BunSqliteAdapter.ts
│   │   │   ├── CloudflareD1Adapter.ts
│   │   │   └── MockDatabaseAdapter.ts (테스트용)
│   │   ├── types/                  # Database 관련 타입 정의
│   │   │   ├── DatabaseTypes.ts
│   │   │   ├── QueryTypes.ts
│   │   │   └── TransactionTypes.ts
│   │   └── DatabaseProviderFactory.ts
│   ├── types/                      # 공통 타입 정의
│   │   ├── CommonTypes.ts
│   │   ├── GraphQLTypes.ts
│   │   └── index.ts
│   └── config/                     # 설정 관리
│       ├── DatabaseConfig.ts
│       ├── GraphQLConfig.ts
│       └── EnvironmentConfig.ts
│
├── domain/                         # 🏛️ 도메인 계층 (기존 유지)
│   ├── entities/                   # 도메인 엔티티들
│   │   ├── Node.ts
│   │   ├── Table.ts
│   │   ├── Attribute.ts
│   │   ├── NodeRelation.ts
│   │   ├── RelationType.ts
│   │   ├── QueryTemplate.ts
│   │   └── AttributeType.ts
│   ├── repositories/               # Repository 인터페이스들
│   │   ├── ITableRepository.ts
│   │   ├── INodeRepository.ts
│   │   ├── IAttributeRepository.ts
│   │   ├── IAttributeTypeRepository.ts
│   │   ├── INodeAttributeRepository.ts
│   │   ├── INodeRelationRepository.ts
│   │   ├── IRelationTypeRepository.ts
│   │   └── IQueryTemplateRepository.ts
│   └── value-objects/              # 값 객체들
│       ├── RelationQuery.ts
│       └── SearchFilter.ts
│
├── application/                    # 🎮 애플리케이션 계층 (기존 유지)
│   ├── use-cases/                  # Use Case들
│   │   ├── tables/
│   │   │   └── CreateTable.ts
│   │   ├── nodes/
│   │   │   ├── CreateNode.ts
│   │   │   └── SearchNodes.ts
│   │   ├── relations/
│   │   │   ├── CreateRelation.ts
│   │   │   ├── CreateRelationType.ts
│   │   │   └── SearchRelatedNodes.ts
│   │   ├── attributes/
│   │   │   └── CreateAttribute.ts
│   │   ├── attribute-types/
│   │   │   └── CreateAttributeType.ts
│   │   ├── analytics/
│   │   │   └── NodeAnalyticsUseCase.ts
│   │   ├── search/
│   │   │   └── AdvancedSearchUseCase.ts
│   │   ├── export/
│   │   │   └── SchemaExportUseCase.ts
│   │   ├── import/
│   │   │   └── SchemaImportUseCase.ts
│   │   └── query-templates/
│   │       └── ExecuteQueryTemplate.ts
│   ├── dtos/                       # 데이터 전송 객체들
│   │   ├── NodeDto.ts
│   │   ├── TableDto.ts
│   │   ├── AttributeDto.ts
│   │   ├── AttributeTypeDto.ts
│   │   └── RelationDto.ts
│   ├── services/                   # 애플리케이션 서비스들
│   │   └── SearchQueryParser.ts
│   └── ports/                      # 포트 인터페이스들
│       └── ILogger.ts
│
├── infrastructure/                 # 🔧 인프라 계층 (대폭 개선)
│   ├── database/                   
│   │   ├── repositories/           # Repository 구현체들
│   │   │   ├── SqliteTableRepository.ts
│   │   │   ├── SqliteNodeRepository.ts
│   │   │   ├── SqliteAttributeRepository.ts
│   │   │   ├── SqliteAttributeTypeRepository.ts
│   │   │   ├── SqliteNodeAttributeRepository.ts
│   │   │   ├── SqliteNodeRelationRepository.ts
│   │   │   ├── SqliteRelationTypeRepository.ts
│   │   │   ├── SqliteNodeSearchRepository.ts
│   │   │   ├── SqliteGraphRepository.ts
│   │   │   └── SQLiteQueryTemplateRepository.ts
│   │   └── connections/            # 새로운 Connection 구현체들
│   │       ├── BunSqliteConnection.ts
│   │       ├── CloudflareD1Connection.ts
│   │       └── MockConnection.ts
│   ├── container/                  # 🆕 DI Container 시스템
│   │   ├── DIContainer.ts          # DI Container 구현체
│   │   ├── ServiceRegistry.ts      # 서비스 등록 관리자
│   │   ├── ContainerBootstrap.ts   # Container 조립기
│   │   ├── tokens/                 # Type-safe service tokens
│   │   │   ├── DatabaseTokens.ts
│   │   │   ├── RepositoryTokens.ts
│   │   │   ├── UseCaseTokens.ts
│   │   │   ├── GraphQLTokens.ts
│   │   │   ├── CommonTokens.ts
│   │   │   └── index.ts
│   │   └── modules/                # Module별 서비스 등록
│   │       ├── CoreModule.ts
│   │       ├── DatabaseModule.ts
│   │       ├── RepositoryModule.ts
│   │       ├── UseCaseModule.ts
│   │       ├── GraphQLModule.ts
│   │       └── index.ts
│   └── logging/                    # 로깅 인프라 (기존)
│       └── ConsoleLogger.ts
│
├── presentation/                   # 🎨 프레젠테이션 계층 (대폭 재구조화)
│   ├── graphql/                    
│   │   ├── queries/                # 🆕 Query 전용 Resolvers
│   │   │   ├── TableQueries.ts
│   │   │   ├── NodeQueries.ts
│   │   │   ├── RelationQueries.ts
│   │   │   ├── AttributeQueries.ts
│   │   │   ├── AnalyticsQueries.ts
│   │   │   ├── TemplateQueries.ts
│   │   │   └── index.ts
│   │   ├── mutations/              # 🆕 Mutation 전용 Resolvers
│   │   │   ├── TableMutations.ts
│   │   │   ├── NodeMutations.ts
│   │   │   ├── RelationMutations.ts
│   │   │   ├── AttributeMutations.ts
│   │   │   ├── TemplateMutations.ts
│   │   │   └── index.ts
│   │   ├── subscriptions/          # 🆕 Subscription Resolvers
│   │   │   ├── RealtimeSubscriptions.ts
│   │   │   └── index.ts
│   │   ├── schema/                 # 🆕 GraphQL 스키마 파일들 (분리)
│   │   │   ├── root.graphql        # 최상위 스키마
│   │   │   ├── types/              # 타입 정의들
│   │   │   │   ├── common.graphql
│   │   │   │   ├── table.graphql
│   │   │   │   ├── node.graphql
│   │   │   │   ├── attribute.graphql
│   │   │   │   ├── relation.graphql
│   │   │   │   ├── analytics.graphql
│   │   │   │   └── query-template.graphql
│   │   │   ├── queries/            # Query 스키마들
│   │   │   │   ├── table-queries.graphql
│   │   │   │   ├── node-queries.graphql
│   │   │   │   ├── relation-queries.graphql
│   │   │   │   ├── attribute-queries.graphql
│   │   │   │   ├── analytics-queries.graphql
│   │   │   │   └── template-queries.graphql
│   │   │   ├── mutations/          # Mutation 스키마들
│   │   │   │   ├── table-mutations.graphql
│   │   │   │   ├── node-mutations.graphql
│   │   │   │   ├── relation-mutations.graphql
│   │   │   │   ├── attribute-mutations.graphql
│   │   │   │   └── template-mutations.graphql
│   │   │   └── subscriptions/      # Subscription 스키마들
│   │   │       └── realtime.graphql
│   │   ├── field-resolvers/        # 🆕 Field Resolver들 (분리)
│   │   │   ├── TableFieldResolvers.ts
│   │   │   ├── NodeFieldResolvers.ts
│   │   │   ├── AttributeFieldResolvers.ts
│   │   │   ├── RelationFieldResolvers.ts
│   │   │   └── index.ts
│   │   ├── types/                  # GraphQL 타입 정의들
│   │   │   ├── GraphQLContext.ts
│   │   │   ├── ResolverTypes.ts
│   │   │   ├── InputTypes.ts
│   │   │   └── index.ts
│   │   └── GraphQLSchemaBuilder.ts # 🆕 새로운 스키마 빌더
│   └── dto/                        # 프레젠테이션 DTO들
│       └── QueryTemplateDto.ts
│
└── index.ts                        # 🚀 애플리케이션 진입점 (DI 기반)
```

## 📂 각 폴더의 역할과 포함 내용

### Core Layer (`src/core/`)
**역할**: 프로젝트의 핵심 추상화와 비즈니스 규칙 정의
**포함 내용**:
- Database 추상화 인터페이스들
- Provider별 어댑터 구현체들  
- 공통 타입 정의
- 환경 설정 관리
- 외부 의존성 없는 순수한 비즈니스 로직

### Domain Layer (`src/domain/`) 
**역할**: 도메인 모델과 비즈니스 규칙 (기존 유지)
**포함 내용**:
- 엔티티 클래스들
- Repository 인터페이스들
- 값 객체들
- 도메인 서비스들
- 비즈니스 규칙과 제약사항

### Application Layer (`src/application/`)
**역할**: 애플리케이션 로직과 Use Case 구현 (기존 유지)
**포함 내용**:
- Use Case 구현체들
- 애플리케이션 서비스들
- DTO 클래스들
- 포트 인터페이스들
- 비즈니스 워크플로우

### Infrastructure Layer (`src/infrastructure/`)
**역할**: 외부 시스템과의 연동 및 기술적 구현
**포함 내용**:
- Repository 구현체들
- Database Connection 구현체들
- **새로운 DI Container 시스템**
- 로깅, 캐싱 등 기술적 관심사
- 외부 API 연동

### Presentation Layer (`src/presentation/`)
**역할**: 외부와의 인터페이스 (대폭 재구조화)
**포함 내용**:
- **도메인별 분리된 GraphQL Resolvers**
- **분산된 GraphQL 스키마 파일들**
- Field Resolver들
- GraphQL 타입 정의들
- 새로운 Schema Builder

## 🔄 기존 구조 대비 주요 변경점

### ✅ 개선된 부분

1. **관심사 분리**: 
   - 기존: 단일 `schema-builder.ts` (366줄)
   - 개선: 도메인별 Query/Mutation/Field Resolver 클래스

2. **계층 분리**:
   - 기존: 평면적 구조
   - 개선: Core → Domain → Application → Infrastructure → Presentation

3. **DI 시스템**:
   - 기존: Service Locator 안티패턴
   - 개선: 타입 안전한 DI Container와 Module 시스템

4. **Database 추상화**:
   - 기존: Bun SQLite 강결합
   - 개선: Provider 독립적 추상화 계층

### 📁 새롭게 추가된 폴더들

- `src/core/` - 핵심 추상화 계층
- `src/infrastructure/container/` - DI 시스템
- `src/presentation/graphql/queries/` - Query Resolvers
- `src/presentation/graphql/mutations/` - Mutation Resolvers  
- `src/presentation/graphql/subscriptions/` - Subscription Resolvers
- `src/presentation/graphql/field-resolvers/` - Field Resolvers
- `src/presentation/graphql/schema/` - 분산된 GraphQL 스키마들

### 📂 역할이 명확해진 폴더들

- `src/infrastructure/database/connections/` - Connection 구현체들만
- `src/infrastructure/database/repositories/` - Repository 구현체들만
- `src/presentation/graphql/types/` - GraphQL 타입 정의만

## 🎯 기대 효과

### 👨‍💻 개발자 경험
- **빠른 파일 탐색**: 역할별 명확한 위치
- **병렬 개발**: 도메인별 독립적 작업 가능
- **쉬운 테스팅**: 계층별 격리된 테스트

### 🔧 유지보수성
- **단일 책임**: 각 파일이 명확한 하나의 역할
- **낮은 결합도**: 인터페이스 기반 의존성
- **높은 응집도**: 관련 기능들의 논리적 그룹화

### 📈 확장성
- **새 도메인 추가**: 최소한의 변경으로 확장 가능
- **새 Provider 추가**: 어댑터 패턴으로 쉬운 확장
- **새 기능 추가**: DI를 통한 유연한 기능 추가
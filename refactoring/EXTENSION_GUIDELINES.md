# Extension Guidelines for Bun Graph DB

> **이 문서는 Bun Graph DB 프로젝트의 확장 개발을 위한 종합적인 가이드라인을 제공합니다.**

## 📋 목차
1. [현재 아키텍처 개요](#현재-아키텍처-개요)
2. [새로운 기능 추가 가이드](#새로운-기능-추가-가이드)
3. [코딩 규칙](#코딩-규칙)
4. [테스트 작성 가이드](#테스트-작성-가이드)
5. [성능 고려사항](#성능-고려사항)
6. [보안 고려사항](#보안-고려사항)
7. [확장 계획](#확장-계획)

## 현재 아키텍처 개요

프로젝트는 Clean Architecture 원칙을 따르며 5개의 계층으로 구성되어 있습니다:

### 1. Core Layer (`src/core/`)
- **목적**: 시스템의 핵심 추상화 및 공통 인터페이스
- **주요 구성요소**:
  - `IDatabaseConnection`: 데이터베이스 추상화 인터페이스
  - `DatabaseConfig`: 데이터베이스 설정
  - `TransactionManager`: 트랜잭션 관리

### 2. Domain Layer (`src/domain/`)
- **목적**: 비즈니스 규칙 및 엔터프라이즈 로직
- **주요 구성요소**:
  - `QueryTemplate`: 쿼리 템플릿 도메인 엔티티
  - `IQueryTemplateRepository`: 리포지토리 인터페이스
  - Domain Services 및 이벤트

### 3. Application Layer (`src/application/`)
- **목적**: 애플리케이션 비즈니스 규칙 구현
- **주요 구성요소**:
  - `ExecuteQueryTemplateUseCase`: 쿼리 템플릿 실행 유스케이스
  - `ILogger`: 로깅 포트 인터페이스
  - 애플리케이션 서비스

### 4. Infrastructure Layer (`src/infrastructure/`)
- **목적**: 외부 시스템과의 인터페이스
- **주요 구성요소**:
  - `SqliteQueryTemplateRepository`: SQLite 구현체
  - `DIContainer`: 의존성 주입 컨테이너
  - Container modules 및 tokens
  - Configuration 관리

### 5. Presentation Layer (`src/presentation/`)
- **목적**: 외부와의 인터페이스 및 데이터 변환
- **주요 구성요소**:
  - GraphQL 스키마 파일들 (도메인별 분리)
  - Queries, Mutations, Field Resolvers (도메인별 분리)
  - DTO 매핑 클래스

## 새로운 기능 추가 가이드

### 1. 새로운 도메인 엔티티 추가

새로운 엔티티를 추가할 때는 다음 단계를 따르세요:

#### 1.1 도메인 엔티티 생성 (`src/domain/entities/`)
```typescript
export class NewEntity {
  constructor(
    private readonly id: string,
    private readonly name: string,
    // ... 불변성을 위해 readonly 사용
    private readonly createdAt: Date,
    private readonly updatedAt: Date
  ) {
    // 생성자에서 유효성 검증
    this.validateName(name)
  }

  static create(name: string, options?: CreateOptions): NewEntity {
    // 팩토리 메서드로 새 엔티티 생성
    const now = new Date()
    return new NewEntity(
      null, // ID는 저장시 생성
      name,
      now,
      now
    )
  }

  static fromDatabase(
    id: string,
    name: string,
    createdAt: string,
    updatedAt: string
  ): NewEntity {
    // DB 데이터를 도메인 엔티티로 변환
    return new NewEntity(
      id,
      name,
      new Date(createdAt),
      new Date(updatedAt)
    )
  }

  private validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new DomainException('Name cannot be empty', 'VALIDATION_ERROR')
    }
  }

  // Getter 메서드들
  getId(): string | null { return this.id }
  getName(): string { return this.name }
  getCreatedAt(): Date { return this.createdAt }
  getUpdatedAt(): Date { return this.updatedAt }

  // 비즈니스 메서드들 (새 인스턴스 반환 - 불변성 유지)
  updateName(newName: string): NewEntity {
    return new NewEntity(
      this.id,
      newName,
      this.createdAt,
      new Date()
    )
  }

  toDatabase(): object {
    // 도메인 엔티티를 DB 저장 형태로 변환
    return {
      id: this.id,
      name: this.name,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString()
    }
  }
}
```

#### 1.2 리포지토리 인터페이스 정의 (`src/domain/repositories/`)
```typescript
export interface INewEntityRepository {
  findById(id: string): Promise<NewEntity | null>
  findByName(name: string): Promise<NewEntity | null>
  create(entity: NewEntity): Promise<NewEntity>
  update(id: string, updates: Partial<NewEntity>): Promise<NewEntity>
  delete(id: string): Promise<boolean>
  search(criteria: SearchCriteria): Promise<{
    items: NewEntity[]
    total: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }>
}
```

#### 1.3 유즈케이스 구현 (`src/application/use-cases/new-entity/`)
```typescript
import type { INewEntityRepository } from '@/domain/repositories/INewEntityRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'

export interface CreateNewEntityInput {
  name: string
  description?: string
}

export interface CreateNewEntityOutput {
  id: string
  name: string
  description?: string
  createdAt: string
}

export class CreateNewEntityUseCase {
  constructor(
    private readonly repository: INewEntityRepository,
    private readonly logger: ILogger
  ) {}

  async execute(input: CreateNewEntityInput): Promise<CreateNewEntityOutput> {
    this.logger.info('Creating new entity', { name: input.name })

    // 1. 입력 유효성 검증
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationException('Name is required')
    }

    // 2. 중복 체크
    const existing = await this.repository.findByName(input.name)
    if (existing) {
      throw new ValidationException('Entity with this name already exists')
    }

    // 3. 엔티티 생성
    const entity = NewEntity.create(input.name, {
      description: input.description
    })

    // 4. 저장
    const savedEntity = await this.repository.create(entity)

    // 5. 결과 반환
    return {
      id: savedEntity.getId()!,
      name: savedEntity.getName(),
      description: savedEntity.getDescription(),
      createdAt: savedEntity.getCreatedAt().toISOString()
    }
  }
}
```

#### 1.4 인프라스트럭처 구현 (`src/infrastructure/database/sqlite/`)
```typescript
import type { IDatabaseConnection } from '@/core/database/interfaces/IDatabaseConnection.js'
import { NewEntity } from '@/domain/entities/NewEntity.js'
import type { INewEntityRepository } from '@/domain/repositories/INewEntityRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { DomainException } from '@/shared/exceptions/DomainException.js'

export class SqliteNewEntityRepository implements INewEntityRepository {
  constructor(
    private readonly connection: IDatabaseConnection,
    private readonly logger: ILogger
  ) {}

  async findById(id: string): Promise<NewEntity | null> {
    try {
      const query = `SELECT * FROM new_entities WHERE id = ?`
      const row = await this.connection.queryFirst(query, [id])

      if (!row) return null

      return NewEntity.fromDatabase(
        String(row.id),
        row.name,
        row.created_at,
        row.updated_at
      )
    } catch (error) {
      this.logger.error('Failed to find entity by id', { id, error })
      throw new DomainException('Failed to find entity', 'DATABASE_ERROR')
    }
  }

  async create(entity: NewEntity): Promise<NewEntity> {
    try {
      const data = entity.toDatabase()
      
      const query = `
        INSERT INTO new_entities (name, created_at, updated_at)
        VALUES (?, ?, ?)
      `
      const result = await this.connection.execute(query, [
        data.name,
        data.created_at,
        data.updated_at
      ])
      
      return NewEntity.fromDatabase(
        String(result.lastInsertRowid),
        data.name,
        data.created_at,
        data.updated_at
      )
    } catch (error) {
      this.logger.error('Failed to create entity', { entity, error })
      throw new DomainException('Failed to create entity', 'DATABASE_ERROR')
    }
  }
}
```

#### 1.5 GraphQL 스키마 정의 (`src/presentation/graphql/schema/`)

**새로운 스키마 파일 생성**: `new-entity.graphql`
```graphql
type NewEntity {
  id: ID!
  name: String!
  description: String
  createdAt: DateTime!
  updatedAt: DateTime!
}

input CreateNewEntityInput {
  name: String!
  description: String
}

input UpdateNewEntityInput {
  name: String
  description: String
}

extend type Query {
  newEntity(id: ID!): NewEntity
  searchNewEntities(
    name: String
    limit: Int = 10
    offset: Int = 0
  ): [NewEntity!]!
}

extend type Mutation {
  createNewEntity(input: CreateNewEntityInput!): NewEntity!
  updateNewEntity(id: ID!, input: UpdateNewEntityInput!): NewEntity!
  deleteNewEntity(id: ID!): Boolean!
}
```

#### 1.6 리졸버 구현 (`src/presentation/graphql/queries/`, `mutations/`)

**Queries**: `src/presentation/graphql/queries/NewEntityQueries.ts`
```typescript
import type { INewEntityRepository } from '@/domain/repositories/INewEntityRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { GraphQLParent, GraphQLContext } from '@/presentation/graphql/types/GraphQLTypes.js'

export class NewEntityQueries {
  constructor(
    private readonly repository: INewEntityRepository,
    private readonly logger: ILogger
  ) {}

  async newEntity(_: GraphQLParent, args: { id: string }) {
    try {
      this.logger.info('Fetching new entity', { id: args.id })
      return await this.repository.findById(args.id)
    } catch (error) {
      this.logger.error('Error fetching new entity', { error, id: args.id })
      throw error
    }
  }

  async searchNewEntities(_: GraphQLParent, args: {
    name?: string
    limit?: number
    offset?: number
  }) {
    try {
      this.logger.info('Searching new entities', { args })
      
      const result = await this.repository.search({
        name: args.name,
        limit: args.limit || 10,
        offset: args.offset || 0
      })

      return result.items
    } catch (error) {
      this.logger.error('Error searching new entities', { error, args })
      throw error
    }
  }
}
```

**Mutations**: `src/presentation/graphql/mutations/NewEntityMutations.ts`
```typescript
import type { INewEntityRepository } from '@/domain/repositories/INewEntityRepository.js'
import { CreateNewEntityUseCase } from '@/application/use-cases/new-entity/CreateNewEntityUseCase.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { GraphQLParent } from '@/presentation/graphql/types/GraphQLTypes.js'
import { GraphQLError } from 'graphql'

export class NewEntityMutations {
  constructor(
    private readonly repository: INewEntityRepository,
    private readonly createUseCase: CreateNewEntityUseCase,
    private readonly logger: ILogger
  ) {}

  async createNewEntity(_: GraphQLParent, args: { input: any }) {
    try {
      this.logger.info('Creating new entity', { input: args.input })
      
      return await this.createUseCase.execute({
        name: args.input.name,
        description: args.input.description
      })
    } catch (error) {
      this.logger.error('Error creating new entity', { error, input: args.input })
      throw new GraphQLError('Failed to create entity', {
        extensions: { code: 'CREATE_FAILED' }
      })
    }
  }
}
```

#### 1.7 DI 컨테이너 설정

**토큰 정의**: `src/infrastructure/container/tokens/RepositoryTokens.ts`에 추가
```typescript
export const NEW_ENTITY_REPOSITORY = Symbol('NewEntityRepository')
export type NewEntityRepositoryToken = typeof NEW_ENTITY_REPOSITORY
```

**유즈케이스 토큰**: `src/infrastructure/container/tokens/UseCaseTokens.ts`에 추가
```typescript
export const CREATE_NEW_ENTITY_USE_CASE = Symbol('CreateNewEntityUseCase')
export type CreateNewEntityUseCaseToken = typeof CREATE_NEW_ENTITY_USE_CASE
```

**모듈 등록**: `src/infrastructure/container/modules/RepositoryModule.ts`에 추가
```typescript
container.registerSingleton(
  NEW_ENTITY_REPOSITORY,
  async (container) => new SqliteNewEntityRepository(
    await container.resolve(DATABASE_CONNECTION),
    await container.resolve(LOGGER)
  ),
  [DATABASE_CONNECTION, LOGGER]
)
```

## 🏗️ 아키텍처 확장 전략

### 레이어 추가 방향
```
┌─ Presentation Layer ─────────────────────────────────────┐
│  GraphQL API (기존)  │  JSON Schema API (신규)          │
│  ├─ Resolvers        │  ├─ Schema Validators            │
│  └─ Schema Builder   │  └─ Import/Export Controllers    │
└─────────────────────────────────────────────────────────┘
┌─ External Integration Layer (신규) ──────────────────────┐
│  MCP Server Gateway  │  File System Adapter            │
│  ├─ Query Executor   │  ├─ File Reader/Writer          │
│  ├─ Result Processor │  ├─ Format Converters           │
│  └─ Response Handler │  └─ Path Managers               │
└─────────────────────────────────────────────────────────┘
┌─ Application Layer (기존 + 확장) ────────────────────────┐
│  Use Cases (기존)    │  Schema Use Cases (신규)         │
│  └─ Business Logic   │  ├─ Schema Import/Export        │
│                      │  ├─ Data Transformation         │
│                      │  └─ Validation & Mapping        │
└─────────────────────────────────────────────────────────┘
┌─ Domain Layer (기존) ────────────────────────────────────┐
│  Entities & Value Objects  │  Domain Services           │
└─────────────────────────────────────────────────────────┘
┌─ Infrastructure Layer (기존 + 확장) ────────────────────┐
│  Database (기존)     │  File System (신규)             │
│  ├─ SQLite/D1        │  ├─ Local File System           │
│  └─ Repository Impl  │  ├─ Network File System         │
│                      │  └─ Cloud Storage               │
└─────────────────────────────────────────────────────────┘
```

## 📋 Phase별 확장 계획

### Phase 1: JSON Schema Import/Export 기반 구축
**목표**: JSON Schema 기반 데이터 교환 레이어 구축

#### 1.1 Schema Definition Layer
**목적**: JSON Schema 기반 그래프 데이터베이스 스키마 정의 및 검증

**주요 구성요소**:
- **GraphDbSchema**: 전체 스키마 구조 정의 (버전, 메타데이터, 테이블, 관계, 속성)
- **SchemaMetadata**: 스키마 메타정보 (이름, 생성일, 호환성 정보)
- **Validation Layer**: 스키마 무결성 검증 및 버전 호환성 체크

#### 1.2 Import/Export Use Cases
**ImportSchemaUseCase**:
- JSON Schema 객체 수신 및 검증
- 도메인 엔티티로 변환
- 데이터베이스 지속성 처리
- 충돌 해결 및 병합 정책

**ExportSchemaUseCase**:
- 기존 스키마 데이터 수집
- JSON Schema 포맷으로 변환
- 선택적 필터링 (테이블별, 타입별)
- 출력 검증 및 최적화

#### 1.3 JSON Schema Controller
**HTTP REST API 레이어**:
- 스키마 가져오기/내보내기 엔드포인트
- 스키마 검증 API
- 배치 작업 상태 추적
- 에러 처리 및 응답 포맷팅

### Phase 2: MCP Server Integration Layer
**목표**: MCP 서버가 GraphQL을 실행하고 결과를 파일로 처리하는 시스템

#### 2.1 MCP Gateway Architecture
**MCP GraphQL Gateway 역할**:
- GraphQL 쿼리 수신 및 실행 위임
- 배치 쿼리 처리 및 병렬 실행 관리
- 스트리밍 결과 처리
- 메타데이터 및 컨텍스트 관리

**지원 기능**:
- **Query Execution**: 단일/배치/스트리밍 쿼리 실행
- **Output Format**: JSON, CSV, GraphML, Cypher, 사용자 정의 포맷
- **Output Destination**: 파일, 스트림, 메모리, 네트워크
- **Error Handling**: 쿼리 실행 오류 및 복구 정책

#### 2.2 File System Integration  
**File System Adapter 계층**:
- **다중 파일시스템 지원**: 로컬, 클라우드, 네트워크 스토리지
- **결과 파일 생성**: GraphQL 결과를 다양한 포맷으로 저장
- **스키마 파일 읽기**: JSON Schema 파일 파싱 및 검증
- **워크스페이스 관리**: 프로젝트별 파일 구조 관리

**주요 구현체**:
- **LocalFileSystemAdapter**: 로컬 파일 시스템 처리
- **CloudStorageAdapter**: AWS S3, Google Cloud Storage 연동
- **NetworkFileAdapter**: FTP, SFTP, NFS 지원

#### 2.3 Result Processing Pipeline
**Result Processor 기능**:
- **포맷 변환**: GraphQL 결과를 다양한 포맷으로 변환
- **데이터 검증**: 출력 데이터 무결성 확인
- **최적화**: 대용량 데이터 처리 최적화
- **메타데이터 생성**: 결과 파일 메타정보 생성

**지원 포맷**:
- **JsonProcessor**: JSON 포맷 처리 및 스키마 검증
- **CsvProcessor**: CSV 포맷 변환 및 헤더 관리
- **GraphMLProcessor**: 그래프 시각화용 GraphML 생성
- **CypherProcessor**: Neo4j Cypher 쿼리 생성

### Phase 3: Integration & Orchestration Layer
**목표**: 통합된 워크플로우와 고급 기능

#### 3.1 Workflow Orchestrator
**Workflow Orchestrator 역할**:
- **복합 작업 플로우 관리**: 다단계 작업 순서 및 의존성 관리
- **에러 처리**: 각 단계별 실패 시 복구 전략 실행
- **재시도 정책**: 네트워크 오류, 임시 장애 등 자동 재시도
- **상태 추적**: 실행 중인 워크플로우 상태 모니터링

**지원 워크플로우**:
- **Schema Import Workflow**: JSON 스키마 검증 → 변환 → 저장 → 검증
- **Data Export Workflow**: 데이터 수집 → 포맷 변환 → 파일 생성 → 검증
- **MCP Query Workflow**: 쿼리 실행 → 결과 처리 → 파일 저장 → 알림

**워크플로우 정의 구성요소**:
- **단계별 작업**: 각 단계의 타입, 설정, 의존성 정의
- **에러 핸들링**: 단계별 실패 시 처리 방법
- **출력 매핑**: 단계 간 데이터 전달 방식

#### 3.2 Event-Driven Architecture
**Event Bus 시스템**:
- **비동기 이벤트 처리**: 도메인 이벤트 발행 및 구독
- **느슨한 결합**: 컴포넌트 간 직접 의존성 제거
- **확장성**: 새로운 이벤트 핸들러 동적 추가
- **감사 추적**: 모든 이벤트 로깅 및 추적

**주요 도메인 이벤트**:
- **SchemaImportedEvent**: 스키마 가져오기 완료 이벤트
- **QueryExecutedEvent**: GraphQL 쿼리 실행 완료 이벤트  
- **FileGeneratedEvent**: 결과 파일 생성 완료 이벤트
- **WorkflowCompletedEvent**: 워크플로우 완료 이벤트

**이벤트 처리 패턴**:
- **Saga Pattern**: 장기 실행 트랜잭션 관리
- **Event Sourcing**: 이벤트 기반 상태 관리
- **CQRS**: 명령과 조회 분리

## 🔧 구현 가이드라인

### 1. 인터페이스 설계 원칙
- **단일 책임**: 각 어댑터는 하나의 외부 시스템과만 통신
- **의존성 역전**: 인프라스트럭처가 도메인에 의존
- **확장 가능**: 새로운 포맷과 프로토콜 쉽게 추가

### 2. 에러 처리 전략

**계층별 에러 처리**:
- **SchemaImportError**: JSON 스키마 가져오기 실패 (검증 오류, 변환 실패)
- **McpExecutionError**: MCP 쿼리 실행 실패 (쿼리 오류, 시간 초과)
- **FileSystemError**: 파일 시스템 작업 실패 (권한 문제, 디스크 공간 부족)
- **WorkflowError**: 워크플로우 실행 실패 (단계별 실패, 의존성 오류)

**에러 복구 전략**:
- **자동 재시도**: 일시적 네트워크 오류, 파일 잠금 등
- **부분 롤백**: 다단계 작업 중 실패 시 이전 상태로 복구
- **알림 및 로깅**: 관리자 알림, 상세 로그 기록
- **우아한 성능 저하**: 일부 기능 비활성화로 서비스 유지

### 3. 설정 관리

**Extension Config 구조**:
- **MCP Config**: MCP 서버 연결 설정, 타임아웃, 동시 쿼리 수 제한
- **FileSystem Config**: 기본 경로, 임시 디렉터리, 파일 크기 제한
- **Schema Config**: 스키마 검증 규칙, 호환성 정책
- **Workflow Config**: 기본 워크플로우, 재시도 정책, 알림 설정

**동적 설정 관리**:
- **환경별 설정**: Development, Staging, Production 환경별 구성
- **실시간 설정 변경**: 서비스 재시작 없이 설정 변경
- **설정 검증**: 설정값 유효성 검사 및 기본값 제공

## 📁 확장된 폴더 구조

```
src/
├── core/                           # 핵심 추상화
│   ├── schema/                     # 스키마 정의
│   │   ├── SchemaDefinition.ts
│   │   ├── SchemaValidator.ts
│   │   └── SchemaTransformer.ts
│   └── contracts/                  # 확장 인터페이스
│       ├── IFileSystemAdapter.ts
│       ├── IMcpGateway.ts
│       └── IResultProcessor.ts
├── application/
│   ├── use-cases/
│   │   └── schema/                 # 스키마 관련 유스케이스
│   │       ├── ImportSchemaUseCase.ts
│   │       ├── ExportSchemaUseCase.ts
│   │       └── ValidateSchemaUseCase.ts
│   └── orchestration/              # 워크플로우 오케스트레이션
│       ├── WorkflowOrchestrator.ts
│       └── WorkflowDefinitions.ts
├── presentation/
│   ├── graphql/ (기존)
│   └── http/                       # REST API for schema operations
│       ├── SchemaController.ts
│       ├── McpController.ts
│       └── FileController.ts
├── external/                       # 외부 시스템 통합
│   ├── mcp/                        # MCP 서버 통합
│   │   ├── McpGraphqlGateway.ts
│   │   ├── McpQueryExecutor.ts
│   │   ├── ResultProcessor.ts
│   │   └── FormatProcessors/
│   │       ├── JsonProcessor.ts
│   │       ├── CsvProcessor.ts
│   │       ├── GraphMLProcessor.ts
│   │       └── CypherProcessor.ts
│   └── filesystem/                 # 파일 시스템 통합
│       ├── FileSystemAdapter.ts
│       ├── LocalFileSystemAdapter.ts
│       ├── CloudStorageAdapter.ts
│       └── NetworkFileAdapter.ts
└── infrastructure/
    ├── events/                     # 이벤트 시스템
    │   ├── EventBus.ts
    │   ├── EventHandlers.ts
    │   └── DomainEvents.ts
    ├── config/                     # 확장 설정
    │   ├── ExtensionConfig.ts
    │   └── ConfigValidator.ts
    └── monitoring/                 # 확장 모니터링
        ├── MetricsCollector.ts
        └── HealthCheckers.ts
```

## 🔄 통합 시나리오

### 시나리오 1: Schema Import via JSON
**MCP Server에서 JSON Schema를 통해 데이터 가져오기**

**워크플로우 단계**:
1. **스키마 검증**: JSON Schema 파일 구조 및 무결성 검증
2. **스키마 가져오기**: 검증된 스키마를 데이터베이스에 적용
3. **가져오기 검증**: 적용 결과 확인 및 데이터 일관성 검사
4. **결과 확인**: 가져오기 결과를 JSON 포맷으로 내보내기

**적용 사례**: 외부 시스템에서 그래프 데이터베이스 스키마 마이그레이션, 백업 데이터 복원

### 시나리오 2: GraphQL Query Execution via MCP
**MCP Server에서 GraphQL 쿼리 실행 후 파일로 저장**

**실행 과정**:
1. **쿼리 수신**: MCP 서버가 GraphQL 쿼리와 변수 수신
2. **쿼리 실행**: 내부 GraphQL 엔진을 통해 쿼리 처리
3. **결과 변환**: 실행 결과를 지정된 포맷으로 변환
4. **파일 저장**: 변환된 결과를 파일 시스템에 저장

**활용 예시**: 네트워크 분석 결과 자동 보고서 생성, 정기적인 데이터 내보내기

### 시나리오 3: Batch Processing Pipeline
**대량 데이터 처리 파이프라인**

**처리 단계**:
1. **병렬 가져오기**: 여러 데이터 소스를 동시에 처리 (동시 실행 수 제한)
2. **배치 쿼리 실행**: 여러 분석 쿼리를 순차적으로 실행
3. **결과 집계**: 개별 쿼리 결과를 통합하여 종합 보고서 생성
4. **출력 생성**: 로컬 및 클라우드 저장소에 결과 파일 생성

**사용 사례**: 일간/주간 분석 보고서 자동 생성, 다중 데이터 소스 통합 분석

## 🚀 확장 시 고려사항

### 성능 최적화
- **스트리밍 처리**: 대용량 데이터 처리 시 메모리 효율성
- **병렬 처리**: MCP 쿼리와 파일 I/O 동시 실행
- **캐싱 전략**: 스키마 검증과 변환 결과 캐싱

### 보안 고려사항
- **파일 경로 검증**: Path traversal 공격 방지
- **쿼리 검증**: SQL injection 및 GraphQL injection 방지
- **권한 관리**: MCP 서버별 접근 권한 제어

### 확장성 고려사항
- **플러그인 아키텍처**: 새로운 포맷 프로세서 동적 로딩
- **설정 기반 확장**: 코드 변경 없이 새로운 통합 추가
- **이벤트 기반 통합**: 느슨한 결합을 통한 확장성

## 📚 다음 단계

1. **Phase 1 구현**: JSON Schema Import/Export 기본 기능
2. **Phase 2 구현**: MCP Gateway 및 File System Integration
3. **Phase 3 구현**: Workflow Orchestration 및 고급 기능
4. **성능 테스트**: 대용량 데이터 처리 검증
5. **보안 검증**: 보안 취약점 분석 및 대응
6. **문서화**: API 문서 및 사용 가이드 작성

이 확장 가이드라인을 따라 단계별로 구현하면 GraphQL 중심 아키텍처를 JSON Schema와 MCP 서버 통합이 가능한 유연한 시스템으로 확장할 수 있습니다.
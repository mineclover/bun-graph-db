# Layer Management & Extension Guide

## 🗄️ Core Data Layer Management

### 📍 Location
- `core/schema.sql` - SQLite 스키마 정의
- `src/infrastructure/database/sqlite/` - Repository 구현

### 🎯 Management Principles

#### Schema Evolution
```sql
-- ✅ Good: 새 컬럼 추가 (backward compatible)
ALTER TABLE tables ADD COLUMN metadata TEXT;

-- ❌ Bad: 기존 컬럼 삭제 (breaking change)
ALTER TABLE tables DROP COLUMN description;
```

#### Repository Pattern
```typescript
// ✅ Good: 인터페이스 우선 정의
interface ITableRepository {
  findById(id: string): Promise<Table | null>
  create(table: CreateTableInput): Promise<Table>
  update(id: string, table: UpdateTableInput): Promise<Table>
  delete(id: string): Promise<boolean>
}

// ✅ Good: SQLite 구현
class SqliteTableRepository implements ITableRepository {
  // 구현...
}
```

### 🚀 Extension Guidelines

#### 1. 새 테이블 추가
```bash
# 1. 스키마 파일 수정
vim core/schema.sql

# 2. 인터페이스 정의
touch src/domain/repositories/INewEntityRepository.ts

# 3. SQLite 구현
touch src/infrastructure/database/sqlite/SqliteNewEntityRepository.ts

# 4. 컨테이너 등록
vim src/infrastructure/container/modules/RepositoryModule.ts
```

#### 2. 테이블 관계 설정
```sql
-- Foreign Key 관계 정의
CREATE TABLE child_table (
  id INTEGER PRIMARY KEY,
  parent_id INTEGER NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES parent_table(id) ON DELETE CASCADE
);

-- Index 생성 (성능 최적화)
CREATE INDEX idx_child_parent ON child_table(parent_id);
```

### ⚠️ 제약사항
- SQLite 한계 고려 (ALTER TABLE 제한)
- Foreign Key 활성화 필수 (`PRAGMA foreign_keys = ON`)
- 트랜잭션 내에서 스키마 변경 지양

---

## 📊 Data Management Layer

### 📍 Location
- `src/application/use-cases/export/`
- `src/application/use-cases/import/`
- `src/domain/services/`

### 🎯 Management Principles

#### Export/Import Workflow
```typescript
// ✅ Good: 일관된 Export 인터페이스
interface IExportService {
  exportTable(tableId: string, options: ExportOptions): Promise<ExportResult>
  exportAll(options: ExportOptions): Promise<ExportResult>
  validateExport(data: ExportData): Promise<ValidationResult>
}

// ✅ Good: 안전한 Import 프로세스
class TableImportService {
  async import(data: ImportData): Promise<ImportResult> {
    // 1. 검증
    const validation = await this.validate(data)
    if (!validation.isValid) throw new ValidationException()

    // 2. 트랜잭션 내에서 import
    return await this.db.transaction(async () => {
      return await this.performImport(data)
    })
  }
}
```

### 🚀 Extension Guidelines

#### 1. 새 Export 형식 추가
```typescript
// 1. Format 인터페이스 확장
interface ExportFormat {
  type: 'json' | 'csv' | 'xml' | 'yaml' // 새 형식 추가
  options?: Record<string, any>
}

// 2. Formatter 구현
class YamlExportFormatter implements IExportFormatter {
  format(data: ExportData): string {
    return yaml.dump(data)
  }
}

// 3. Factory에 등록
class ExportFormatterFactory {
  create(format: ExportFormat): IExportFormatter {
    switch (format.type) {
      case 'yaml': return new YamlExportFormatter()
      // ...
    }
  }
}
```

#### 2. 데이터 검증 규칙 추가
```typescript
// ✅ Good: 체인 패턴 사용
class ImportValidationChain {
  private validators: IValidator[] = []

  addValidator(validator: IValidator): this {
    this.validators.push(validator)
    return this
  }

  async validate(data: ImportData): Promise<ValidationResult> {
    for (const validator of this.validators) {
      const result = await validator.validate(data)
      if (!result.isValid) return result
    }
    return { isValid: true }
  }
}
```

### ⚠️ 제약사항
- 대용량 데이터 처리 시 메모리 제한 고려
- Import/Export 중 데이터 일관성 보장
- 백업 및 롤백 전략 필수

---

## 🔧 Template Query System

### 📍 Location
- `src/application/use-cases/query-templates/`
- `src/domain/entities/QueryTemplate.ts`
- `src/infrastructure/database/sqlite/SqliteQueryTemplateRepository.ts`

### 🎯 Management Principles

#### Template Structure
```typescript
// ✅ Good: 완전한 템플릿 정의
interface QueryTemplate {
  id: string
  identifier: string
  name: string
  description: string
  query: string
  operationType: 'QUERY' | 'MUTATION' | 'SUBSCRIPTION'
  variablesSchema: JSONSchema7 | null  // 필수!
  defaultVariables: Record<string, any> | null  // 필수!
  tags: string[]
  isActive: boolean
  version: string
  complexityScore: number
}
```

#### Variable Schema Example
```json
{
  "type": "object",
  "properties": {
    "filter": {
      "type": "object",
      "properties": {
        "isActive": {"type": "boolean"},
        "tags": {
          "type": "array",
          "items": {"type": "string"}
        }
      }
    },
    "pagination": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "offset": {
          "type": "integer",
          "minimum": 0
        }
      }
    }
  }
}
```

### 🚀 Extension Guidelines

#### 1. 새 템플릿 타입 추가
```typescript
// 1. 타입 확장
type TemplateType = 'query' | 'mutation' | 'subscription' | 'fragment'

// 2. 검증 로직 확장
class TemplateValidator {
  validateByType(template: QueryTemplate): ValidationResult {
    switch (template.operationType) {
      case 'FRAGMENT':
        return this.validateFragment(template)
      // ...
    }
  }
}
```

#### 2. 템플릿 실행 엔진 확장
```typescript
// ✅ Good: Strategy 패턴 사용
interface ITemplateExecutor {
  execute(template: QueryTemplate, variables?: Record<string, any>): Promise<any>
}

class GraphQLTemplateExecutor implements ITemplateExecutor {
  async execute(template: QueryTemplate, variables = {}): Promise<any> {
    // 1. 변수 검증
    const validationResult = this.validateVariables(template, variables)
    if (!validationResult.isValid) throw new ValidationException()

    // 2. 쿼리 실행
    return await this.graphql.execute(template.query, variables)
  }
}
```

### ⚠️ 제약사항
- GraphQL 쿼리 복잡도 제한 (DoS 방지)
- Template 캐싱 전략 필요
- 무한 루프 방지 (재귀 템플릿)

---

## 🌐 Presentation Layer

### 📍 Location
- `src/presentation/graphql/`
- `src/presentation/http/`

### 🎯 Management Principles

#### GraphQL Schema Organization
```graphql
# ✅ Good: 모듈별 스키마 분리
# src/presentation/graphql/schema/types/Table.graphql
type Table {
  id: ID!
  identifier: String!
  description: String
  nodes: [Node!]!
  createdAt: DateTime!
}

# src/presentation/graphql/schema/queries/table-queries.graphql
extend type Query {
  table(id: ID!): Table
  tables(filter: TableFilter, pagination: PaginationInput): TablesConnection!
}
```

#### Resolver Pattern
```typescript
// ✅ Good: 책임 분리
class TableQueries {
  constructor(
    private tableService: ITableService,
    private logger: ILogger
  ) {}

  @Query()
  async table(@Args('id') id: string): Promise<Table | null> {
    this.logger.info('Executing query: table', { id })
    return await this.tableService.findById(id)
  }
}
```

### 🚀 Extension Guidelines

#### 1. 새 GraphQL 타입 추가
```typescript
// 1. GraphQL 스키마 정의
// src/presentation/graphql/schema/types/NewType.graphql

// 2. TypeScript 타입 정의
// src/presentation/graphql/types/NewType.ts

// 3. Resolver 구현
// src/presentation/graphql/resolvers/NewTypeResolver.ts

// 4. 스키마 등록
// src/presentation/graphql/schema/index.ts
```

#### 2. API 보안 강화
```typescript
// ✅ Good: 미들웨어 체인
class GraphQLMiddleware {
  @Middleware()
  async rateLimiting(context: GraphQLContext, next: () => Promise<any>) {
    const limit = await this.rateLimiter.check(context.user.id)
    if (!limit.allowed) throw new RateLimitException()
    return next()
  }

  @Middleware()
  async queryComplexity(context: GraphQLContext, next: () => Promise<any>) {
    const complexity = calculateComplexity(context.query)
    if (complexity > MAX_COMPLEXITY) throw new ComplexityException()
    return next()
  }
}
```

### ⚠️ 제약사항
- Query depth 제한 (N+1 문제 방지)
- Field-level 권한 검사
- Response 크기 제한

---

## 🔄 Cross-Layer Coordination

### 의존성 흐름
```
Presentation Layer
      ↓
Application Layer (Use Cases)
      ↓
Domain Layer (Entities, Services)
      ↓
Infrastructure Layer (Repositories, Database)
```

### 이벤트 기반 통신
```typescript
// ✅ Good: 도메인 이벤트 사용
class TableCreatedEvent implements IDomainEvent {
  constructor(public readonly table: Table) {}
}

class TableService {
  async createTable(input: CreateTableInput): Promise<Table> {
    const table = await this.repository.create(input)

    // 이벤트 발행
    await this.eventBus.publish(new TableCreatedEvent(table))

    return table
  }
}
```

### 에러 처리 전략
```typescript
// ✅ Good: 계층별 에러 변환
class GraphQLErrorHandler {
  handle(error: Error): GraphQLError {
    if (error instanceof DomainException) {
      return new GraphQLError(error.message, { code: error.code })
    }

    if (error instanceof DatabaseException) {
      return new GraphQLError('Internal server error', { code: 'INTERNAL_ERROR' })
    }

    return new GraphQLError('Unknown error')
  }
}
```

---

이 가이드는 각 레이어의 확장과 관리를 위한 구체적인 지침을 제공하며, 시스템의 일관성과 확장성을 보장합니다.
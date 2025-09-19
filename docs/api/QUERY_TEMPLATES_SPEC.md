# Query Templates Specification

## 개요
Query Templates는 GraphQL 쿼리/뮤테이션을 재사용 가능한 템플릿으로 관리하는 시스템입니다.  
검색 가능한 자산으로 쿼리를 저장하고, 일관된 결과를 보장하며, 성능을 최적화합니다.

## 데이터베이스 스키마

### templates 테이블
```sql
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL UNIQUE,      -- 고유 식별자
  name TEXT NOT NULL,                   -- 템플릿 이름
  description TEXT,                      -- 설명
  query_text TEXT NOT NULL,              -- GraphQL 쿼리/뮤테이션 텍스트
  variables_schema TEXT,                 -- 변수 스키마 (JSON Schema)
  default_variables TEXT,                -- 기본 변수값 (JSON)
  applicable_tables TEXT,                -- 적용 가능 테이블 (JSON 배열)
  template_type TEXT DEFAULT 'query',    -- 'query', 'mutation', 'subscription'
  complexity_score INTEGER DEFAULT 1,    -- 복잡도 점수 (1-10)
  usage_count INTEGER DEFAULT 0,         -- 사용 횟수
  version TEXT DEFAULT '1.0.0',          -- 버전
  is_active BOOLEAN DEFAULT TRUE,        -- 활성화 여부
  tags TEXT,                             -- 검색용 태그 (JSON 배열)
  created_at TEXT,
  updated_at TEXT
);
```

## 핵심 기능

### 1. 템플릿 관리

#### 템플릿 생성
```typescript
interface CreateTemplateInput {
  identifier: string
  name: string
  description?: string
  queryText: string
  variablesSchema?: JsonSchema
  defaultVariables?: Record<string, any>
  applicableTables?: string[] | null  // null = 범용
  templateType?: 'query' | 'mutation' | 'subscription'
  tags: string[]
}
```

#### 템플릿 검색
```typescript
interface SearchTemplatesInput {
  // 태그 기반 검색 (PRIMARY)
  tags?: string[]           // 태그 필터링
  tagMatchMode?: 'any' | 'all'  // any: OR 조건, all: AND 조건
  
  // 테이블 필터링
  applicableToTable?: string  // 특정 테이블에 사용 가능한 템플릿
  includeUniversal?: boolean   // 범용 템플릿 포함 여부 (default: true)
  
  // 타입 필터링  
  templateType?: 'query' | 'mutation' | 'subscription'
  
  // 상태 필터링
  isActive?: boolean
  
  // 정렬
  orderBy?: 'usage_count' | 'created_at' | 'updated_at'
  orderDirection?: 'asc' | 'desc'
}
```

### 2. 템플릿 실행

#### 템플릿 실행 플로우
```typescript
interface ExecuteTemplateInput {
  templateId?: string      // ID로 실행
  identifier?: string      // 또는 identifier로 실행
  variables?: Record<string, any>
  trackUsage?: boolean     // 사용 통계 업데이트 (default: true)
}

interface ExecuteTemplateOutput {
  queryText: string
  processedVariables: Record<string, any>
  metadata: {
    templateId: string
    templateName: string
    version: string
    complexityScore: number
  }
}
```

#### 실행 단계
1. **템플릿 조회**: ID 또는 identifier로 템플릿 로드
2. **활성화 확인**: `is_active = true` 확인
3. **변수 처리**: 기본값과 사용자 입력 병합
4. **변수 검증**: JSON Schema 기반 유효성 검사
5. **사용 통계 업데이트**: `usage_count` 증가
6. **쿼리 반환**: 처리된 쿼리 텍스트와 메타데이터

### 3. 태그 기반 검색 시스템

#### 태그 구조
```json
{
  "tags": [
    "basic",          // 기본 쿼리
    "nodes",          // 노드 관련
    "attributes",     // 속성 포함
    "performance",    // 성능 최적화
    "detailed",       // 상세 정보
    "minimal"         // 최소 정보
  ]
}
```

#### 태그 검색 예시
```graphql
# 노드 관련 기본 쿼리 검색
query SearchTemplates {
  searchTemplates(
    tags: ["nodes", "basic"]
    tagMatchMode: "all"
  ) {
    identifier
    name
    tags
  }
}
```

### 4. 테이블별 템플릿 필터링

#### applicable_tables 구조
- `null`: 범용 템플릿 (모든 테이블에 사용 가능)
- `["table1", "table2"]`: 특정 테이블들에만 사용 가능

#### 검색 예시
```graphql
# 특정 테이블에 사용 가능한 템플릿 검색
query GetTableTemplates {
  searchTemplates(
    applicableToTable: "users"
    includeUniversal: true
  ) {
    identifier
    name
    applicableTables
  }
}
```

## GraphQL API

### Queries
```graphql
type Query {
  # 템플릿 검색
  searchTemplates(input: SearchTemplatesInput!): [Template!]!
  
  # 단일 템플릿 조회
  getTemplate(id: ID!): Template
  getTemplateByIdentifier(identifier: String!): Template
  
  # 인기 템플릿 조회
  getPopularTemplates(limit: Int = 10): [Template!]!
}
```

### Mutations
```graphql
type Mutation {
  # 템플릿 관리
  createTemplate(input: CreateTemplateInput!): Template!
  updateTemplate(id: ID!, input: UpdateTemplateInput!): Template!
  deleteTemplate(id: ID!): Boolean!
  
  # 템플릿 실행
  executeTemplate(input: ExecuteTemplateInput!): ExecuteTemplateResult!
  
  # 템플릿 상태 관리
  activateTemplate(id: ID!): Template!
  deactivateTemplate(id: ID!): Template!
}
```

### Types
```graphql
type Template {
  id: ID!
  identifier: String!
  name: String!
  description: String
  queryText: String!
  variablesSchema: JSON
  defaultVariables: JSON
  applicableTables: [String!]
  templateType: TemplateType!
  complexityScore: Int!
  usageCount: Int!
  version: String!
  isActive: Boolean!
  tags: [String!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum TemplateType {
  QUERY
  MUTATION
  SUBSCRIPTION
}
```

## 사용 사례

### 1. 자주 사용하는 쿼리 저장
```typescript
// MinimalTableWithNodes 템플릿
const template = {
  identifier: 'minimal-table-with-nodes',
  name: 'Minimal Table with Nodes',
  tags: ['basic', 'nodes', 'minimal', 'efficient'],
  queryText: `
    query MinimalTableWithNodes($tableId: ID!) {
      table(id: $tableId) {
        identifier
        description
      }
      nodes(tableId: $tableId) {
        nodes {
          id
          content
          attributes {
            value
            attribute { identifier }
          }
        }
        totalCount
      }
    }
  `,
  variablesSchema: {
    type: 'object',
    properties: {
      tableId: { type: 'string', description: 'Table ID' }
    },
    required: ['tableId']
  }
}
```

### 2. 태그로 템플릿 검색
```typescript
// 효율적이고 최소한의 정보만 제공하는 템플릿 검색
const minimalTemplates = await searchTemplates({
  tags: ['minimal', 'efficient'],
  tagMatchMode: 'any',
  orderBy: 'usage_count',
  orderDirection: 'desc'
})
```

### 3. 테이블별 템플릿 필터링
```typescript
// 'users' 테이블에서 사용 가능한 모든 템플릿 조회
const userTemplates = await searchTemplates({
  applicableToTable: 'users',
  includeUniversal: true,
  isActive: true
})
```

## 구현 체크리스트

- [ ] Domain Entity: `QueryTemplate`
- [ ] Repository Interface: `IQueryTemplateRepository`
- [ ] Repository Implementation: `SQLiteQueryTemplateRepository`
- [ ] Use Cases:
  - [ ] `CreateQueryTemplate`
  - [ ] `SearchQueryTemplates`
  - [ ] `ExecuteQueryTemplate`
  - [ ] `UpdateQueryTemplate`
  - [ ] `DeleteQueryTemplate`
- [ ] GraphQL Schema: `query-template.graphql`
- [ ] GraphQL Resolver: `QueryTemplateResolver`
- [ ] DTO: `QueryTemplateDto`
- [ ] Validation: Schema validation for variables
- [ ] Tests: Unit and integration tests

## 성능 고려사항

1. **태그 인덱싱**: `idx_templates_tags`로 빠른 태그 검색
2. **applicable_tables 인덱싱**: `idx_templates_applicable`로 테이블별 필터링 최적화
3. **사용 통계**: `idx_templates_usage`로 인기 템플릿 빠른 조회
4. **캐싱**: 자주 사용되는 템플릿은 메모리 캐싱 고려
5. **변수 검증**: JSON Schema 검증을 위한 별도 검증기 사용

## 보안 고려사항

1. **쿼리 검증**: 악의적인 쿼리 방지를 위한 검증
2. **변수 삽입**: SQL 인젝션 방지를 위한 파라미터화
3. **복잡도 제한**: complexity_score 기반 실행 제한
4. **버전 관리**: 템플릿 변경 이력 추적

## 향후 확장 가능성

1. **템플릿 공유**: 사용자 간 템플릿 공유
2. **템플릿 버전 히스토리**: 변경 이력 관리
3. **템플릿 그룹화**: 관련 템플릿 묶음 관리
4. **성능 메트릭**: 실행 시간, 리소스 사용량 추적
5. **AI 기반 템플릿 추천**: 사용 패턴 분석 기반 추천
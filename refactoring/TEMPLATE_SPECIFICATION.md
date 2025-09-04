# Template-based Query System Specification

GraphQL 쿼리/뮤테이션의 템플릿 기반 관리 및 실행 시스템의 완전한 기능 명세서.

## 📋 목차

1. [시스템 개요](#시스템-개요)
2. [데이터베이스 스키마](#데이터베이스-스키마)
3. [핵심 기능](#핵심-기능)
4. [GraphQL API](#graphql-api)
5. [태그 시스템](#태그-시스템)
6. [실행 플로우](#실행-플로우)
7. [검색 및 필터링](#검색-및-필터링)
8. [변수 처리](#변수-처리)
9. [사용 사례](#사용-사례)
10. [구현 체크리스트](#구현-체크리스트)

## 시스템 개요

### 목적
Query Templates 시스템은 GraphQL 쿼리/뮤테이션을 재사용 가능한 템플릿으로 관리하여:
- 검색 가능한 자산으로 쿼리 저장
- 일관된 결과 보장
- 성능 최적화
- 사용 통계 추적

### 주요 이점
- ✅ **일관성**: 표준화된 노드 생성 패턴
- ✅ **재사용성**: 다양한 변수로 템플릿 반복 사용
- ✅ **발견성**: 태그 기반 검색
- ✅ **검증**: JSON Schema 기반 변수 유효성 검사
- ✅ **분석**: 사용 통계 및 인기도 추적

### 아키텍처 레이어
```
GraphQL Layer → Application Layer → Domain Layer → Infrastructure Layer
     ↓              ↓                  ↓              ↓
 Resolvers    Template Execution   QueryTemplate   SQLite Repository
 Input/Output    Variable Processing   Entity        JSON Queries
 Type Defs       Usage Tracking      Business Rules   Indexes
```

## 데이터베이스 스키마

### templates 테이블
```sql
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL UNIQUE,      -- 고유 식별자
  name TEXT NOT NULL,                   -- 템플릿 이름
  description TEXT,                     -- 설명
  
  -- GraphQL Query Information
  query_text TEXT NOT NULL,             -- GraphQL 쿼리/뮤테이션 텍스트
  variables_schema TEXT,                -- 변수 스키마 (JSON Schema)
  default_variables TEXT,               -- 기본 변수값 (JSON)
  
  -- Applicability (JSON array of table identifiers)
  applicable_tables TEXT,               -- 적용 가능 테이블 (JSON 배열) | null = 범용
  
  -- Metadata
  template_type TEXT DEFAULT 'query',   -- 'query', 'mutation', 'subscription'
  complexity_score INTEGER DEFAULT 1,   -- 복잡도 점수 (1-10)
  
  -- Usage Statistics
  usage_count INTEGER DEFAULT 0,        -- 사용 횟수
  
  -- Version Management
  version TEXT DEFAULT '1.0.0',         -- 버전
  is_active BOOLEAN DEFAULT TRUE,       -- 활성화 여부
  
  -- Search Tags (JSON array)
  tags TEXT,                           -- 검색용 태그 (JSON 배열)
  
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 성능 인덱스
```sql
-- Core indexes for efficient queries
CREATE INDEX idx_templates_identifier ON templates(identifier);
CREATE INDEX idx_templates_type ON templates(template_type);
CREATE INDEX idx_templates_active ON templates(is_active);
CREATE INDEX idx_templates_usage ON templates(usage_count DESC);
CREATE INDEX idx_templates_applicable ON templates(applicable_tables);
CREATE INDEX idx_templates_tags ON templates(tags);
```

## 핵심 기능

### 1. 템플릿 관리

#### 템플릿 생성
```typescript
interface CreateTemplateInput {
  identifier: string                     // 고유 식별자
  name: string                          // 사람이 읽기 쉬운 이름
  description?: string                  // 템플릿 설명
  queryText: string                     // GraphQL 쿼리/뮤테이션 텍스트
  variablesSchema?: JsonSchema          // JSON Schema for variables
  defaultVariables?: Record<string, any> // 기본 변수 값
  applicableTables?: string[] | null    // null = 범용, [...] = 특정 테이블
  templateType?: 'query' | 'mutation' | 'subscription'
  complexityScore?: number              // 1-10 복잡도 평가
  tags: string[]                        // 검색 가능한 태그
}
```

#### 템플릿 수정
```typescript
interface UpdateTemplateInput {
  name?: string
  description?: string
  queryText?: string
  variablesSchema?: JsonSchema
  defaultVariables?: Record<string, any>
  applicableTables?: string[] | null
  complexityScore?: number
  tags?: string[]
  version?: string
}
```

#### 템플릿 상태 관리
- `activateTemplate(id: ID!)`: 템플릿 활성화
- `deactivateTemplate(id: ID!)`: 템플릿 비활성화
- `deleteTemplate(id: ID!)`: 템플릿 삭제

### 2. 템플릿 검색

#### 검색 조건
```typescript
interface SearchTemplatesInput {
  // 태그 기반 검색 (PRIMARY)
  tags?: string[]                    // 태그 필터링
  tagMatchMode?: 'any' | 'all'      // any: OR 조건, all: AND 조건
  
  // 테이블 필터링
  applicableToTable?: string        // 특정 테이블에 사용 가능한 템플릿
  includeUniversal?: boolean        // 범용 템플릿 포함 여부 (default: true)
  
  // 타입 필터링  
  templateType?: 'query' | 'mutation' | 'subscription'
  
  // 상태 필터링
  isActive?: boolean               // 활성 템플릿만 (default: true)
  
  // 복잡도 필터링
  maxComplexity?: number           // 최대 복잡도 점수
  
  // 정렬 및 페이징
  orderBy?: 'usage_count' | 'created_at' | 'updated_at' | 'complexity_score'
  orderDirection?: 'asc' | 'desc'
  limit?: number
  offset?: number
}
```

#### JSON 쿼리 지원
SQLite JSON 함수를 활용한 고급 검색:

```sql
-- 태그 검색 (ANY mode)
SELECT * FROM templates 
WHERE json_extract(tags, '$') LIKE '%"node-creation"%'

-- 태그 검색 (ALL mode) 
SELECT * FROM templates 
WHERE json_extract(tags, '$') LIKE '%"tag1"%' 
  AND json_extract(tags, '$') LIKE '%"tag2"%'

-- 테이블별 검색
SELECT * FROM templates 
WHERE applicable_tables IS NULL 
   OR json_extract(applicable_tables, '$') LIKE '%"products"%'
```

### 3. 템플릿 실행

#### 실행 입력
```typescript
interface ExecuteTemplateInput {
  templateId?: string                   // ID로 실행
  templateIdentifier?: string           // 또는 identifier로 실행
  variables?: Record<string, any>       // 실행 변수
  trackUsage?: boolean                  // 사용 통계 업데이트 (default: true)
  validateVariables?: boolean           // 변수 검증 활성화 (default: false)
}
```

#### 실행 결과
```typescript
interface ExecuteTemplateResult {
  success: boolean
  data?: any                           // GraphQL 실행 결과
  errors?: GraphQLError[]              // GraphQL 오류
  executionTime: number                // 실행 시간 (ms)
  metadata: {
    templateId: string
    templateName: string
    templateType: string
    version: string
    complexityScore: number
    processedVariables: Record<string, any>
  }
}
```

#### 실행 단계
1. **템플릿 조회**: ID 또는 identifier로 템플릿 로드
2. **활성화 확인**: `is_active = true` 확인
3. **변수 처리**: 기본값과 사용자 입력 병합
4. **변수 검증**: JSON Schema 기반 유효성 검사 (선택적)
5. **GraphQL 실행**: 처리된 쿼리 실행
6. **사용 통계 업데이트**: `usage_count` 증가 (선택적)
7. **결과 반환**: 실행 결과와 메타데이터

## GraphQL API

### Query Operations
```graphql
type Query {
  # 템플릿 검색
  searchTemplates(input: SearchTemplatesInput!): [QueryTemplate!]!
  
  # 단일 템플릿 조회
  queryTemplate(id: ID!): QueryTemplate
  queryTemplateByIdentifier(identifier: String!): QueryTemplate
  
  # 인기 템플릿 조회
  popularQueryTemplates(limit: Int = 10): [QueryTemplate!]!
  
  # 템플릿 실행
  executeQueryTemplate(input: ExecuteTemplateInput!): ExecuteTemplateResult!
}
```

### Mutation Operations
```graphql
type Mutation {
  # 템플릿 관리
  createQueryTemplate(input: CreateQueryTemplateInput!): QueryTemplate!
  updateQueryTemplate(id: ID!, input: UpdateQueryTemplateInput!): QueryTemplate!
  deleteQueryTemplate(id: ID!): Boolean!
  
  # 템플릿 상태 관리
  activateQueryTemplate(id: ID!): QueryTemplate!
  deactivateQueryTemplate(id: ID!): QueryTemplate!
}
```

### Type Definitions
```graphql
type QueryTemplate {
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

type ExecuteTemplateResult {
  success: Boolean!
  data: JSON
  errors: [String!]
  executionTime: Int!
  metadata: TemplateExecutionMetadata!
}

type TemplateExecutionMetadata {
  templateId: String!
  templateName: String!
  templateType: TemplateType!
  version: String!
  complexityScore: Int!
  processedVariables: JSON!
}
```

## 태그 시스템

### 태그 구조 전략

#### 계층적 태그 체계
```javascript
const tagStrategy = {
  // 도메인 태그
  domain: ['ecommerce', 'user-management', 'content', 'analytics'],
  
  // 작업 태그  
  operation: ['node-creation', 'node-update', 'relationship', 'search'],
  
  // 엔티티 태그
  entity: ['products', 'users', 'orders', 'articles', 'tables'],
  
  // 복잡도 태그
  complexity: ['basic', 'simple', 'moderate', 'complex', 'advanced'],
  
  // 성능 태그
  performance: ['minimal', 'detailed', 'efficient', 'comprehensive'],
  
  // 기능 태그
  feature: ['validation', 'bulk-operations', 'async', 'attributes']
}
```

#### 권장 태그 조합 예시
```javascript
// 좋은 태그 조합
const wellTaggedTemplate = {
  tags: [
    'ecommerce',        // domain
    'node-creation',    // operation  
    'products',         // entity
    'complex',          // complexity
    'validation',       // feature
    'detailed'          // performance
  ]
}
```

### 태그 검색 패턴

#### ANY 모드 (OR 조건)
```graphql
query FindAnyTag {
  searchTemplates(input: {
    tags: ["nodes", "minimal", "efficient"]
    tagMatchMode: ANY
    orderBy: USAGE_COUNT
    orderDirection: DESC
  }) {
    identifier
    name
    tags
    usageCount
  }
}
```

#### ALL 모드 (AND 조건)
```graphql
query FindAllTags {
  searchTemplates(input: {
    tags: ["ecommerce", "products", "complex"]
    tagMatchMode: ALL
    isActive: true
  }) {
    identifier
    name
    tags
    complexityScore
  }
}
```

## 실행 플로우

### 변수 처리 파이프라인
```typescript
const processVariables = (
  defaultVars: Record<string, unknown>,
  runtimeVars: Record<string, unknown>,
  schema: JsonSchema,
  validate: boolean
): Record<string, unknown> => {
  // 1. 기본값으로 시작
  let processedVars = { ...defaultVars }
  
  // 2. 런타임 값으로 오버라이드
  processedVars = { ...processedVars, ...runtimeVars }
  
  // 3. 검증 (선택적)
  if (validate && schema) {
    validateVariables(processedVars, schema)
  }
  
  return processedVars
}
```

### 실행 워크플로우
1. **템플릿 선택**: ID 또는 identifier로 템플릿 지정
2. **활성화 검증**: 템플릿이 활성 상태인지 확인
3. **변수 병합**: 기본값 + 사용자 입력 변수
4. **변수 검증**: JSON Schema 검증 (선택적)
5. **GraphQL 실행**: 실제 쿼리/뮤테이션 실행
6. **결과 처리**: 성공/실패 결과 포맷팅
7. **통계 업데이트**: 사용 횟수 자동 증가 (선택적)
8. **응답 반환**: 결과와 메타데이터 반환

## 검색 및 필터링

### 테이블별 필터링

#### applicable_tables 구조
- `null`: 범용 템플릿 (모든 테이블에 사용 가능)
- `["table1", "table2"]`: 특정 테이블들에만 사용 가능

#### 테이블별 검색 예시
```graphql
query GetTableSpecificTemplates {
  searchTemplates(input: {
    applicableToTable: "users"
    includeUniversal: true
    templateType: QUERY
    isActive: true
  }) {
    identifier
    name
    applicableTables
    tags
  }
}
```

### 복잡도 기반 필터링
```graphql
query GetSimpleTemplates {
  searchTemplates(input: {
    maxComplexity: 3
    orderBy: COMPLEXITY_SCORE
    orderDirection: ASC
  }) {
    identifier
    name
    complexityScore
    tags
  }
}
```

### 인기도 기반 조회
```graphql
query GetPopularTemplates {
  popularQueryTemplates(limit: 5) {
    identifier
    name
    usageCount
    tags
    complexityScore
  }
}
```

## 변수 처리

### JSON Schema 검증

#### 포괄적인 스키마 예시
```json
{
  "type": "object",
  "properties": {
    "tableId": {
      "type": "string",
      "description": "Target table ID"
    },
    "productName": {
      "type": "string",
      "minLength": 3,
      "maxLength": 200,
      "description": "Product name"
    },
    "sku": {
      "type": "string",
      "pattern": "^[A-Z0-9-]+$",
      "description": "Stock Keeping Unit"
    },
    "price": {
      "type": "number",
      "minimum": 0,
      "description": "Product price"
    },
    "stockQuantity": {
      "type": "integer",
      "minimum": 0,
      "description": "Available stock"
    },
    "category": {
      "type": "string",
      "enum": ["Electronics", "Clothing", "Books", "Home"],
      "description": "Product category"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "brand": { "type": "string" },
        "model": { "type": "string" },
        "color": { "type": "string" }
      }
    }
  },
  "required": ["tableId", "productName", "sku", "price"],
  "additionalProperties": false
}
```

### 기본값 처리
```typescript
interface TemplateVariableDefaults {
  stockQuantity: 0
  category: "General"
  metadata: {}
  tags: []
  isActive: true
}
```

## 사용 사례

### 1. 기본 노드 쿼리 템플릿
```typescript
const minimalNodesTemplate = {
  identifier: 'minimal-table-with-nodes',
  name: 'Minimal Table with Nodes',
  description: 'Basic table and node information query',
  tags: ['basic', 'nodes', 'minimal', 'efficient'],
  templateType: 'query',
  complexityScore: 2,
  queryText: `
    query MinimalTableWithNodes($tableId: ID!) {
      table(id: $tableId) {
        identifier
        description
      }
      nodes(tableId: $tableId) {
        data {
          id
          content
          attributes {
            value
            attribute { identifier }
          }
        }
        pagination {
          total
          hasMore
        }
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

### 2. 복합 관계 쿼리 템플릿
```typescript
const nodesWithRelationsTemplate = {
  identifier: 'nodes-with-relations',
  name: 'Nodes with Relations',
  description: 'Comprehensive node and relationship query',
  tags: ['nodes', 'relations', 'detailed', 'complex'],
  templateType: 'query',
  complexityScore: 7,
  queryText: `
    query NodesWithRelations(
      $tableId: ID!
      $includeIncoming: Boolean = false
      $limit: Int = 10
    ) {
      nodes(tableId: $tableId, limit: $limit) {
        data {
          id
          content
          attributes {
            value
            attribute { identifier }
          }
          outgoingRelations {
            targetNode {
              id
              content
            }
            relationType { identifier }
            properties
            strength
          }
          incomingRelations @include(if: $includeIncoming) {
            sourceNode {
              id
              content
            }
            relationType { identifier }
            properties
            strength
          }
        }
        pagination {
          total
          hasMore
        }
      }
    }
  `,
  variablesSchema: {
    type: 'object',
    properties: {
      tableId: { type: 'string' },
      includeIncoming: { type: 'boolean', default: false },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 }
    },
    required: ['tableId']
  },
  defaultVariables: {
    includeIncoming: false,
    limit: 10
  }
}
```

### 3. 노드 생성 뮤테이션 템플릿
```typescript
const createProductNodeTemplate = {
  identifier: 'create-ecommerce-product',
  name: 'Create E-commerce Product',
  description: 'Complete product creation with full metadata',
  tags: ['ecommerce', 'products', 'node-creation', 'mutation', 'complex'],
  templateType: 'mutation',
  complexityScore: 5,
  applicableTables: ['products', 'inventory', 'catalog'],
  queryText: `
    mutation CreateEcommerceProduct(
      $tableId: ID!
      $productName: String!
      $sku: String!
      $price: Float!
      $stockQuantity: Int!
      $category: String!
      $description: String!
      $attributes: [NodeAttributeInput!]
    ) {
      createNode(input: {
        tableId: $tableId
        content: $productName
        title: $productName
        description: $description
        attributes: $attributes
      }) {
        id
        content
        title
        description
        attributes {
          value
          attribute {
            identifier
            name
          }
        }
        table {
          identifier
          nodeCount
        }
        createdAt
        updatedAt
      }
    }
  `,
  variablesSchema: {
    type: 'object',
    properties: {
      tableId: { type: 'string' },
      productName: { type: 'string', minLength: 3, maxLength: 200 },
      sku: { type: 'string', pattern: '^[A-Z0-9-]+$' },
      price: { type: 'number', minimum: 0 },
      stockQuantity: { type: 'integer', minimum: 0 },
      category: { type: 'string' },
      description: { type: 'string', minLength: 10 },
      attributes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            attributeId: { type: 'string' },
            value: { type: 'string' }
          }
        }
      }
    },
    required: ['tableId', 'productName', 'sku', 'price', 'stockQuantity', 'category', 'description']
  },
  defaultVariables: {
    stockQuantity: 0,
    category: 'General',
    attributes: []
  }
}
```

## 구현 체크리스트

### Domain Layer
- [ ] **QueryTemplate Entity**: 비즈니스 로직과 검증 규칙
- [ ] **Variable Schema Validation**: JSON Schema 검증 로직
- [ ] **Template Lifecycle Management**: 생성, 수정, 삭제, 활성화

### Repository Layer
- [ ] **IQueryTemplateRepository Interface**: 저장소 계약
- [ ] **SQLiteQueryTemplateRepository**: SQLite 구현체
- [ ] **JSON Query Support**: 태그 및 테이블 검색 최적화
- [ ] **Performance Indexes**: 검색 성능 최적화

### Application Layer
- [ ] **Use Cases**:
  - [ ] `CreateQueryTemplateUseCase`
  - [ ] `SearchQueryTemplatesUseCase`
  - [ ] `ExecuteQueryTemplateUseCase`
  - [ ] `UpdateQueryTemplateUseCase`
  - [ ] `DeleteQueryTemplateUseCase`
  - [ ] `GetPopularTemplatesUseCase`

### Presentation Layer
- [ ] **GraphQL Schema**: `query-template.graphql` 타입 정의
- [ ] **QueryTemplateResolver**: GraphQL 리졸버
- [ ] **Input/Output DTOs**: 데이터 전송 객체
- [ ] **Error Handling**: 템플릿별 오류 처리

### Infrastructure
- [ ] **Database Migrations**: 테이블 및 인덱스 생성
- [ ] **JSON Schema Validator**: 변수 검증 라이브러리 연동
- [ ] **Query Execution Engine**: GraphQL 쿼리 실행 연동
- [ ] **Usage Analytics**: 사용 통계 수집

### Testing
- [ ] **Unit Tests**: 각 레이어별 단위 테스트
- [ ] **Integration Tests**: 전체 워크플로우 테스트
- [ ] **Template Examples**: 샘플 템플릿 모음
- [ ] **Performance Tests**: 검색 및 실행 성능 테스트

### Documentation
- [ ] **API Documentation**: GraphQL 스키마 문서
- [ ] **Usage Examples**: 실행 예시 모음
- [ ] **Best Practices**: 템플릿 작성 가이드
- [ ] **Error Handling Guide**: 오류 처리 가이드

## 성능 고려사항

1. **태그 인덱싱**: `idx_templates_tags`로 빠른 태그 검색
2. **테이블 인덱싱**: `idx_templates_applicable`로 테이블별 필터링 최적화
3. **사용 통계**: `idx_templates_usage`로 인기 템플릿 빠른 조회
4. **메모리 캐싱**: 자주 사용되는 템플릿 캐싱
5. **변수 검증**: JSON Schema 검증기 성능 최적화

## 보안 고려사항

1. **쿼리 검증**: 악의적인 쿼리 방지
2. **변수 검증**: SQL 인젝션 방지를 위한 파라미터화
3. **복잡도 제한**: complexity_score 기반 실행 제한
4. **권한 관리**: 템플릿 생성/수정 권한 제어
5. **감사 로그**: 템플릿 실행 및 수정 기록

## 향후 확장성

1. **템플릿 공유**: 사용자 간 템플릿 공유 기능
2. **버전 히스토리**: 템플릿 변경 이력 관리
3. **템플릿 그룹화**: 관련 템플릿 묶음 관리
4. **성능 메트릭**: 실행 시간, 리소스 사용량 추적
5. **AI 추천**: 사용 패턴 분석 기반 템플릿 추천
6. **Import/Export**: 템플릿 백업 및 복원 기능
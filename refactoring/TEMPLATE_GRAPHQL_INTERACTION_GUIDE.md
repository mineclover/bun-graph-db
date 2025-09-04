# Template System과 GraphQL 상호작용 및 테이블 특화 템플릿 생성 가이드

템플릿 시스템과 GraphQL API의 상호작용 메커니즘 및 테이블별 특화 템플릿 생성 과정을 설명합니다.

## 📋 목차

1. [시스템 상호작용 개요](#시스템-상호작용-개요)
2. [GraphQL 연산별 템플릿 매핑](#graphql-연산별-템플릿-매핑)
3. [테이블 특화 템플릿 생성 과정](#테이블-특화-템플릿-생성-과정)
4. [실제 구현 예시](#실제-구현-예시)
5. [고급 템플릿 패턴](#고급-템플릿-패턴)

## 시스템 상호작용 개요

### 🔄 템플릿 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Template System                          │
├─────────────────┬─────────────────┬─────────────────────────┤
│ Template Store  │ Execution Engine│ Variable Processor      │
│ - Query Cache   │ - GraphQL Exec │ - Schema Validation     │
│ - Schema Rules  │ - Result Format │ - Default Injection     │
│ - Usage Stats   │ - Error Handle  │ - Type Conversion       │
└─────────────────┴─────────────────┴─────────────────────────┤
│                    GraphQL Layer                            │
├─────────────────────────────────────────────────────────────┤
│ Query Resolvers │ Mutation Resolvers │ Subscription Resolvers│
│ - Node queries  │ - CRUD operations  │ - Real-time updates   │
│ - Table queries │ - Bulk operations  │ - Change notifications│
│ - Relation ops  │ - Template mgmt    │ - Usage analytics     │
└─────────────────────────────────────────────────────────────┤
│                    Domain Layer                             │
├─────────────────────────────────────────────────────────────┤
│ Table Entities  │ Node Entities     │ Template Entities     │
│ - Schema info   │ - Content data    │ - Query text          │
│ - Attributes    │ - Relations       │ - Variables           │
│ - Validation    │ - Metadata        │ - Usage tracking      │
└─────────────────────────────────────────────────────────────┘
```

### 🚀 실행 흐름

1. **템플릿 검색**: 사용자가 특정 조건으로 템플릿 검색
2. **템플릿 선택**: 적합한 템플릿 식별 및 선택
3. **변수 준비**: 템플릿 변수 스키마에 따라 실제 값 준비
4. **GraphQL 실행**: 템플릿의 GraphQL 쿼리를 변수와 함께 실행
5. **결과 처리**: 실행 결과 포매팅 및 사용 통계 업데이트

## GraphQL 연산별 템플릿 매핑

### 📊 Query Templates (조회 템플릿)

#### 1. Node 조회 템플릿
```typescript
// 기본 노드 조회 템플릿
{
  identifier: 'basic-nodes-query',
  templateType: 'QUERY',
  applicableTables: null, // 범용 템플릿
  queryText: `
    query GetNodes($tableId: ID!, $limit: Int = 10) {
      nodes(tableId: $tableId, limit: $limit) {
        data {
          id
          content
          title
          description
          attributes {
            value
            attribute { identifier name }
          }
          table {
            identifier
            description
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
      tableId: { type: 'string', description: '테이블 ID' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 }
    },
    required: ['tableId']
  }
}
```

#### 2. 관계 포함 조회 템플릿
```typescript
{
  identifier: 'nodes-with-relations',
  templateType: 'QUERY',
  applicableTables: ['software-architecture', 'project-management'], // 특화 템플릿
  queryText: `
    query GetNodesWithRelations($tableId: ID!, $includeIncoming: Boolean = false) {
      nodes(tableId: $tableId) {
        data {
          id
          content
          title
          outgoingRelations {
            id
            targetNode { id content }
            relationType { identifier name }
            properties
            strength
          }
          incomingRelations @include(if: $includeIncoming) {
            id
            sourceNode { id content }
            relationType { identifier name }
            properties
            strength
          }
        }
      }
    }
  `
}
```

### 🔨 Mutation Templates (변경 템플릿)

#### 1. Node 생성 템플릿
```typescript
{
  identifier: 'create-node-with-validation',
  templateType: 'MUTATION',
  applicableTables: ['users', 'products'], // 특정 테이블용
  queryText: `
    mutation CreateNode($input: CreateNodeInput!) {
      createNode(input: $input) {
        id
        content
        title
        description
        attributes {
          value
          attribute {
            identifier
            name
            attributeType {
              dataType
              isRequired
            }
          }
        }
        table {
          identifier
        }
        createdAt
        updatedAt
      }
    }
  `,
  variablesSchema: {
    type: 'object',
    properties: {
      input: {
        type: 'object',
        properties: {
          tableId: { type: 'string' },
          content: { type: 'string', minLength: 1, maxLength: 200 },
          title: { type: 'string', maxLength: 100 },
          description: { type: 'string', maxLength: 500 },
          attributes: {
            type: 'object',
            additionalProperties: true
          }
        },
        required: ['tableId', 'content']
      }
    },
    required: ['input']
  }
}
```

### 🔔 Subscription Templates (실시간 템플릿)

#### 1. 노드 변경 구독 템플릿
```typescript
{
  identifier: 'node-changes-subscription',
  templateType: 'SUBSCRIPTION',
  applicableTables: ['real-time-data'], // 실시간 데이터용
  queryText: `
    subscription NodeChanges($tableId: ID!, $changeTypes: [ChangeType!]) {
      nodeChanges(tableId: $tableId, changeTypes: $changeTypes) {
        changeType
        node {
          id
          content
          title
          updatedAt
        }
        previousValues
        changedFields
      }
    }
  `,
  variablesSchema: {
    type: 'object',
    properties: {
      tableId: { type: 'string' },
      changeTypes: {
        type: 'array',
        items: { enum: ['CREATED', 'UPDATED', 'DELETED'] },
        default: ['CREATED', 'UPDATED']
      }
    },
    required: ['tableId']
  }
}
```

## 테이블 특화 템플릿 생성 과정

### 🎯 1단계: 테이블 분석 및 스키마 이해

#### 테이블 정보 수집
```graphql
# 테이블 메타데이터 조회
query AnalyzeTable($tableId: ID!) {
  table(id: $tableId) {
    id
    identifier
    description
    metadata
    attributes {
      data {
        id
        identifier
        name
        description
        attributeType {
          identifier
          dataType
          allowedValues
          constraints
        }
        isRequired
        defaultValue
      }
    }
    nodeCount
    relationCount
  }
}
```

#### 테이블별 특성 파악
```typescript
interface TableCharacteristics {
  // 기본 정보
  identifier: string
  description: string
  nodeCount: number
  
  // 속성 분석
  requiredAttributes: string[]
  optionalAttributes: string[]
  attributeTypes: Record<string, string>
  
  // 관계 패턴
  commonRelationTypes: string[]
  relationDensity: number
  
  // 사용 패턴
  accessPatterns: string[]
  searchPatterns: string[]
}
```

### 🏗️ 2단계: 템플릿 설계 및 생성

#### A. 범용 템플릿 vs 특화 템플릿 결정

```typescript
// 범용 템플릿 (applicableTables: null)
const universalTemplate = {
  identifier: 'basic-node-query',
  applicableTables: null,
  // 모든 테이블에서 사용 가능
}

// 특화 템플릿 (applicableTables: ['table1', 'table2'])
const specializedTemplate = {
  identifier: 'ecommerce-product-query',
  applicableTables: ['products', 'inventory', 'catalog'],
  // 특정 테이블에서만 사용 가능
}
```

#### B. 테이블별 템플릿 생성 전략

```typescript
interface TableTemplateStrategy {
  // 1. 기본 CRUD 템플릿
  basic: {
    create: string    // 기본 생성 템플릿
    read: string      // 기본 조회 템플릿  
    update: string    // 기본 수정 템플릿
    delete: string    // 기본 삭제 템플릿
  }
  
  // 2. 도메인 특화 템플릿
  specialized: {
    search: string[]      // 검색 특화 템플릿
    analytics: string[]   // 분석 특화 템플릿
    reporting: string[]   // 리포팅 특화 템플릿
  }
  
  // 3. 관계 기반 템플릿
  relational: {
    withRelations: string     // 관계 포함 조회
    relationAnalysis: string  // 관계 분석
    graphTraversal: string    // 그래프 탐색
  }
}
```

### 🔧 3단계: 변수 스키마 설계

#### 테이블별 변수 스키마 최적화
```typescript
// 사용자 테이블 특화 스키마
const userTableSchema = {
  type: 'object',
  properties: {
    tableId: { type: 'string', const: 'users' }, // 고정값
    email: { 
      type: 'string', 
      format: 'email',
      description: '사용자 이메일' 
    },
    age: { 
      type: 'integer', 
      minimum: 13, 
      maximum: 120,
      description: '사용자 나이' 
    },
    preferences: {
      type: 'object',
      properties: {
        theme: { enum: ['light', 'dark'], default: 'light' },
        language: { enum: ['ko', 'en'], default: 'ko' }
      }
    }
  },
  required: ['tableId', 'email']
}

// 제품 테이블 특화 스키마
const productTableSchema = {
  type: 'object',
  properties: {
    tableId: { type: 'string', const: 'products' },
    sku: { 
      type: 'string', 
      pattern: '^[A-Z0-9-]+$',
      description: '제품 SKU' 
    },
    price: { 
      type: 'number', 
      minimum: 0,
      multipleOf: 0.01,
      description: '제품 가격' 
    },
    category: {
      type: 'string',
      enum: ['electronics', 'clothing', 'books', 'home'],
      description: '제품 카테고리'
    }
  },
  required: ['tableId', 'sku', 'price']
}
```

### 📝 4단계: 템플릿 생성 및 등록

#### 완전한 테이블 특화 템플릿 생성
```graphql
mutation CreateSpecializedTemplate {
  createQueryTemplate(input: {
    identifier: "create-ecommerce-product"
    name: "E-commerce Product Creation"
    description: "Complete product creation with validation and categorization"
    templateType: MUTATION
    applicableTables: ["products", "inventory", "catalog"]
    complexityScore: 4
    tags: ["ecommerce", "products", "create", "validation"]
    
    queryText: """
      mutation CreateEcommerceProduct(
        $tableId: ID!
        $sku: String!
        $name: String!
        $price: Float!
        $category: String!
        $description: String
        $stockQuantity: Int = 0
        $images: [String!] = []
        $tags: [String!] = []
      ) {
        createNode(input: {
          tableId: $tableId
          content: $name
          title: $name + " (" + $sku + ")"
          description: $description
          attributes: {
            sku: $sku
            price: $price
            category: $category
            stockQuantity: $stockQuantity
            images: $images
            tags: $tags
            status: "active"
          }
        }) {
          id
          content
          title
          attributes {
            value
            attribute {
              identifier
              name
              attributeType {
                dataType
                constraints
              }
            }
          }
          table {
            identifier
            nodeCount
          }
          createdAt
        }
      }
    """
    
    variablesSchema: {
      type: "object"
      properties: {
        tableId: {
          type: "string"
          const: "products"
          description: "Product table identifier"
        }
        sku: {
          type: "string"
          pattern: "^[A-Z0-9-]+$"
          minLength: 3
          maxLength: 20
          description: "Stock Keeping Unit"
        }
        name: {
          type: "string"
          minLength: 2
          maxLength: 200
          description: "Product name"
        }
        price: {
          type: "number"
          minimum: 0
          multipleOf: 0.01
          description: "Product price in USD"
        }
        category: {
          type: "string"
          enum: ["electronics", "clothing", "books", "home", "sports"]
          description: "Product category"
        }
        description: {
          type: "string"
          maxLength: 1000
          description: "Product description"
        }
        stockQuantity: {
          type: "integer"
          minimum: 0
          default: 0
          description: "Available stock quantity"
        }
        images: {
          type: "array"
          items: { type: "string", format: "uri" }
          maxItems: 10
          description: "Product image URLs"
        }
        tags: {
          type: "array"
          items: { type: "string" }
          maxItems: 20
          description: "Product tags"
        }
      }
      required: ["tableId", "sku", "name", "price", "category"]
    }
    
    defaultVariables: {
      stockQuantity: 0
      images: []
      tags: []
    }
  }) {
    id
    identifier
    name
    applicableTables
    complexityScore
  }
}
```

## 실제 구현 예시

### 🛠️ 테이블 특화 템플릿 생성 자동화

#### 1. 테이블 스키마 기반 자동 생성
```typescript
async function generateTableSpecificTemplates(tableId: string): Promise<QueryTemplate[]> {
  // 1. 테이블 정보 수집
  const tableInfo = await analyzeTable(tableId)
  
  // 2. 기본 템플릿 생성
  const basicTemplates = generateBasicCRUDTemplates(tableInfo)
  
  // 3. 도메인 특화 템플릿 생성
  const specializedTemplates = generateSpecializedTemplates(tableInfo)
  
  // 4. 관계 기반 템플릿 생성
  const relationalTemplates = generateRelationalTemplates(tableInfo)
  
  return [
    ...basicTemplates,
    ...specializedTemplates,
    ...relationalTemplates
  ]
}

// 테이블 정보 분석
async function analyzeTable(tableId: string): Promise<TableInfo> {
  const result = await executeGraphQL(`
    query AnalyzeTable($id: ID!) {
      table(id: $id) {
        identifier
        description
        metadata
        attributes {
          data {
            identifier
            name
            attributeType {
              identifier
              dataType
              allowedValues
              constraints
            }
            isRequired
            defaultValue
          }
        }
        statistics {
          nodeCount
          relationCount
          attributeCount
        }
      }
    }
  `, { id: tableId })
  
  return processTableInfo(result.data.table)
}
```

#### 2. 도메인별 템플릿 패턴 매핑
```typescript
const DOMAIN_TEMPLATE_PATTERNS = {
  // 사용자 관리 도메인
  'users': {
    create: 'create-user-with-validation',
    search: ['search-users-by-email', 'search-users-by-role'],
    analytics: ['user-engagement-metrics', 'user-growth-analysis']
  },
  
  // E-commerce 도메인
  'products': {
    create: 'create-product-with-inventory',
    search: ['search-products-by-category', 'search-products-by-price-range'],
    analytics: ['product-sales-analysis', 'inventory-turnover']
  },
  
  // 프로젝트 관리 도메인
  'tasks': {
    create: 'create-task-with-dependencies',
    search: ['search-tasks-by-status', 'search-tasks-by-assignee'],
    analytics: ['project-progress-tracking', 'team-productivity']
  }
}

// 도메인 감지 및 템플릿 추천
function detectDomainAndRecommendTemplates(tableIdentifier: string): string[] {
  const domain = detectDomain(tableIdentifier)
  return DOMAIN_TEMPLATE_PATTERNS[domain] || []
}
```

### 🎯 템플릿 실행 최적화

#### 1. 테이블별 실행 컨텍스트 최적화
```typescript
interface TableExecutionContext {
  tableId: string
  tableIdentifier: string
  schemaVersion: string
  optimizations: {
    indexHints: string[]
    caching: boolean
    batchSize: number
  }
  validationRules: ValidationRule[]
}

// 실행 컨텍스트 기반 최적화
async function executeTemplateWithOptimization(
  templateId: string, 
  variables: Record<string, any>,
  context: TableExecutionContext
): Promise<ExecuteTemplateResult> {
  
  // 1. 테이블별 최적화 적용
  const optimizedQuery = applyTableOptimizations(template.queryText, context)
  
  // 2. 변수 검증 (테이블 스키마 기반)
  await validateVariablesAgainstTableSchema(variables, context)
  
  // 3. 캐시된 결과 확인
  const cachedResult = await checkCache(templateId, variables, context)
  if (cachedResult) return cachedResult
  
  // 4. GraphQL 실행
  const result = await executeGraphQL(optimizedQuery, variables, context)
  
  // 5. 결과 캐싱 및 통계 업데이트
  await updateCacheAndStats(templateId, result, context)
  
  return result
}
```

## 고급 템플릿 패턴

### 🔗 관계 기반 템플릿

#### 1. 그래프 탐색 템플릿
```typescript
{
  identifier: 'graph-traversal-bfs',
  templateType: 'QUERY',
  applicableTables: ['software-architecture'], // 아키텍처 분석용
  queryText: `
    query GraphTraversalBFS($startNodeId: ID!, $maxDepth: Int = 3, $relationTypes: [String!]) {
      graphTraversal(
        startNodeId: $startNodeId
        algorithm: BFS
        maxDepth: $maxDepth
        relationTypes: $relationTypes
      ) {
        path {
          depth
          node {
            id
            content
            table { identifier }
          }
          relation {
            relationType { identifier }
            strength
            properties
          }
        }
        metrics {
          nodesVisited
          pathsFound
          maxDepth
          executionTime
        }
      }
    }
  `,
  complexityScore: 8 // 높은 복잡도
}
```

#### 2. 의존성 분석 템플릿
```typescript
{
  identifier: 'dependency-analysis',
  templateType: 'QUERY',
  applicableTables: ['software-components', 'project-tasks'],
  queryText: `
    query DependencyAnalysis($nodeId: ID!, $analysisType: DependencyAnalysisType!) {
      dependencyAnalysis(nodeId: $nodeId, type: $analysisType) {
        dependencies {
          direct {
            node { id content }
            relationship { strength priority }
          }
          transitive {
            path { id content }
            depth
            totalStrength
          }
        }
        dependents {
          direct { node { id content } }
          transitive { path { id content } }
        }
        circularDependencies {
          cycle { id content }
          severity
        }
        metrics {
          fanIn
          fanOut
          complexity
          stability
        }
      }
    }
  `
}
```

### 📊 분석 특화 템플릿

#### 1. 데이터 집계 템플릿
```typescript
{
  identifier: 'table-analytics-dashboard',
  templateType: 'QUERY',
  applicableTables: null, // 범용
  queryText: `
    query TableAnalyticsDashboard($tableId: ID!, $dateRange: DateRange, $groupBy: [String!]) {
      tableAnalytics(tableId: $tableId, dateRange: $dateRange) {
        summary {
          totalNodes
          growthRate
          lastUpdated
        }
        
        aggregations(groupBy: $groupBy) {
          groupValue
          count
          percentage
          trend
        }
        
        topAttributes {
          attributeId
          uniqueValues
          completeness
          distribution {
            value
            count
            percentage
          }
        }
        
        relationshipMetrics {
          totalRelations
          avgConnectionsPerNode
          topRelationTypes {
            type
            count
            avgStrength
          }
        }
      }
    }
  `
}
```

### 🚀 성능 최적화 템플릿

#### 1. 배치 처리 템플릿
```typescript
{
  identifier: 'bulk-node-operations',
  templateType: 'MUTATION',
  applicableTables: null,
  queryText: `
    mutation BulkNodeOperations($operations: [BulkNodeOperation!]!) {
      bulkNodeOperations(operations: $operations) {
        results {
          operation
          nodeId
          success
          error
          executionTime
        }
        summary {
          totalOperations
          successCount
          failureCount
          totalExecutionTime
          averageExecutionTime
        }
        performance {
          cacheHits
          cacheHitRate
          indexUsage
          queryOptimizations
        }
      }
    }
  `,
  complexityScore: 6
}
```

## 🎯 결론

템플릿 시스템과 GraphQL의 통합을 통해:

1. **재사용성**: 테이블별 특화된 쿼리 템플릿으로 일관된 데이터 액세스
2. **타입 안전성**: JSON Schema 기반 변수 검증으로 런타임 오류 방지
3. **성능 최적화**: 테이블별 최적화와 캐싱을 통한 빠른 응답
4. **확장성**: 새로운 테이블과 도메인에 맞는 템플릿 자동 생성
5. **분석 능력**: 복잡한 그래프 분석과 데이터 집계 지원

이러한 구조를 통해 bun-graph-db는 AI 친화적이면서도 강력한 데이터 플랫폼으로 동작할 수 있습니다. 🚀
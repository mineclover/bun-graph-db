# 📖 GraphQL Queries Reference

Query는 읽기 전용 연산으로, 데이터를 조회하고 검색합니다. 캐싱이 적용되며 멱등성이 보장됩니다.

## 🔍 시스템 정보

### `health` - 시스템 상태 확인

**설명**: API 서버와 데이터베이스의 현재 상태를 조회합니다.

**타입**: `HealthStatus!`

**파라미터**: 없음

#### 예제

```graphql
query HealthCheck {
  health {
    status        # "healthy" | "degraded" | "unhealthy"
    timestamp     # ISO 8601 형식 시간
    database      # 데이터베이스 연결 상태 (boolean)
    version       # API 버전 문자열
  }
}
```

**응답 예시**:
```json
{
  "data": {
    "health": {
      "status": "healthy",
      "timestamp": "2025-09-06T12:00:00.000Z",
      "database": true,
      "version": "1.0.0"
    }
  }
}
```

---

## 🗂️ 테이블 관리

### `tables` - 모든 테이블 조회

**설명**: 시스템의 모든 테이블을 페이지네이션과 함께 조회합니다.

**타입**: `[Table!]!`

**파라미터**: 
- `pagination` (선택) - 페이지네이션 설정
- `sort` (선택) - 정렬 조건

#### 예제

```graphql
query GetAllTables {
  tables {
    id
    identifier
    name
    description
    createdAt
    updatedAt
    nodeCount
    relationCount
  }
}
```

**페이지네이션 포함**:
```graphql
query GetTablesPaginated($page: Int!, $limit: Int!) {
  tables(
    pagination: {
      offset: $page
      limit: $limit
    }
    sort: [
      { field: "createdAt", direction: DESC }
    ]
  ) {
    id
    name
    nodeCount
    createdAt
  }
}
```

**Variables**:
```json
{
  "page": 0,
  "limit": 10
}
```

### `table` - 단일 테이블 조회

**설명**: ID로 특정 테이블의 상세 정보를 조회합니다.

**타입**: `Table`

**파라미터**: 
- `id: ID!` - 테이블 ID

#### 예제

```graphql
query GetTable($tableId: ID!) {
  table(id: $tableId) {
    id
    identifier
    name
    description
    createdAt
    updatedAt
    
    # 통계 정보
    nodeCount
    relationCount
    attributeTypes {
      id
      name
      dataType
    }
    
    # 최근 노드들
    nodes(limit: 5) {
      id
      content
      createdAt
    }
  }
}
```

**Variables**:
```json
{
  "tableId": "table_123"
}
```

---

## 🔗 노드 관리

### `nodes` - 노드 검색

**설명**: 다양한 필터와 검색 조건으로 노드를 조회합니다.

**타입**: `NodesConnection!`

**파라미터**:
- `filter` (선택) - 검색 필터
- `pagination` (선택) - 페이지네이션
- `sort` (선택) - 정렬 조건

#### 예제

**기본 노드 조회**:
```graphql
query GetNodes($tableId: ID!) {
  nodes(
    filter: {
      tableId: $tableId
    }
    pagination: {
      limit: 20
    }
  ) {
    totalCount
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    nodes {
      id
      content
      createdAt
      
      # 속성 조회
      attributes {
        id
        name
        value
        type {
          name
          dataType
        }
      }
      
      # 관계 조회
      relations {
        id
        strength
        confidence
        targetNode {
          id
          content
        }
        type {
          name
          description
        }
      }
    }
  }
}
```

**텍스트 검색**:
```graphql
query SearchNodes($query: String!, $tableId: ID!) {
  nodes(
    filter: {
      content: $query
      tableId: $tableId
    }
    sort: [
      { field: "relevanceScore", direction: DESC }
      { field: "createdAt", direction: DESC }
    ]
  ) {
    nodes {
      id
      content
      # 검색 점수 (있는 경우)
      relevanceScore
      
      # 매칭된 속성들
      attributes(filter: { value: $query }) {
        name
        value
      }
    }
  }
}
```

**Variables**:
```json
{
  "query": "사용자",
  "tableId": "table_users"
}
```

### `node` - 단일 노드 조회

**설명**: ID로 특정 노드의 상세 정보를 조회합니다.

**타입**: `TableNode`

**파라미터**: 
- `id: ID!` - 노드 ID

#### 예제

```graphql
query GetNodeDetail($nodeId: ID!) {
  node(id: $nodeId) {
    id
    content
    createdAt
    updatedAt
    
    # 테이블 정보
    table {
      id
      name
      identifier
    }
    
    # 모든 속성
    attributes {
      id
      name
      value
      type {
        name
        dataType
        validation
      }
    }
    
    # 나가는 관계들
    outgoingRelations {
      id
      strength
      confidence
      description
      targetNode {
        id
        content
      }
      type {
        name
        description
      }
    }
    
    # 들어오는 관계들  
    incomingRelations {
      id
      strength
      confidence
      sourceNode {
        id
        content
      }
      type {
        name
        description
      }
    }
  }
}
```

---

## 🕸️ 관계 탐색

### `searchRelatedNodes` - 관련 노드 검색

**설명**: 특정 노드와 관련된 노드들을 다양한 조건으로 검색합니다.

**타입**: `RelatedNodesConnection!`

**파라미터**:
- `nodeId: ID!` - 기준 노드 ID
- `filter` (선택) - 관계 필터
- `depth` (선택) - 탐색 깊이 (기본값: 1)

#### 예제

**1차 관계 노드 조회**:
```graphql
query GetRelatedNodes($nodeId: ID!) {
  searchRelatedNodes(nodeId: $nodeId) {
    nodes {
      id
      content
      
      # 관계 정보
      relationToSource {
        strength
        confidence
        type {
          name
        }
      }
      
      # 거리 정보
      distance
      relationshipPath {
        id
        type {
          name
        }
      }
    }
  }
}
```

**다중 단계 관계 탐색**:
```graphql
query GetRelatedNodesMultiLevel(
  $nodeId: ID!, 
  $depth: Int!,
  $minStrength: Float!
) {
  searchRelatedNodes(
    nodeId: $nodeId
    depth: $depth
    filter: {
      minStrength: $minStrength
      relationTypes: ["CONNECTED_TO", "SIMILAR_TO"]
    }
  ) {
    totalCount
    nodes {
      id
      content
      distance
      
      # 경로상의 관계들
      relationshipPath {
        id
        strength
        confidence
        type {
          name
        }
        sourceNode {
          id
          content
        }
        targetNode {
          id  
          content
        }
      }
    }
  }
}
```

**Variables**:
```json
{
  "nodeId": "node_123",
  "depth": 3,
  "minStrength": 0.7
}
```

---

## 🏷️ 속성 관리

### `attributeTypes` - 속성 타입 조회

**설명**: 테이블의 속성 타입들을 조회합니다.

**타입**: `[AttributeType!]!`

**파라미터**:
- `tableId` (선택) - 특정 테이블의 속성 타입만 조회

#### 예제

```graphql
query GetAttributeTypes($tableId: ID) {
  attributeTypes(tableId: $tableId) {
    id
    name
    description
    dataType      # STRING, NUMBER, BOOLEAN, DATE, JSON
    isRequired
    defaultValue
    validation    # 검증 규칙 (JSON)
    
    # 사용 통계
    usageCount
    
    # 테이블 정보
    table {
      id
      name
    }
  }
}
```

### `attributes` - 속성 검색

**설명**: 다양한 조건으로 속성을 검색합니다.

**타입**: `AttributesConnection!`

**파라미터**:
- `filter` (선택) - 속성 필터
- `pagination` (선택) - 페이지네이션

#### 예제

```graphql
query SearchAttributes(
  $nodeId: ID,
  $attributeName: String,
  $value: String
) {
  attributes(
    filter: {
      nodeId: $nodeId
      name: $attributeName
      value: $value
    }
  ) {
    attributes {
      id
      name
      value
      
      # 속성 타입 정보
      type {
        name
        dataType
        validation
      }
      
      # 소유 노드
      node {
        id
        content
        table {
          name
        }
      }
    }
  }
}
```

---

## 📋 템플릿 관리

### `getTemplate` - 단일 템플릿 조회

**설명**: ID로 특정 쿼리 템플릿을 조회합니다.

**타입**: `QueryTemplate`

**파라미터**: 
- `id: ID!` - 템플릿 ID

#### 예제

```graphql
query GetTemplate($templateId: ID!) {
  getTemplate(id: $templateId) {
    id
    identifier
    name
    description
    queryText
    version
    isActive
    
    # 메타데이터
    complexityScore
    estimatedTokens
    category
    tags
    
    # 변수 정보
    defaultVariables  # JSON
    variableSchema    # 변수 스키마 정의
    
    # 통계
    usageCount
    lastUsed
    createdAt
    updatedAt
  }
}
```

### `getTemplateByIdentifier` - 식별자로 템플릿 조회

**설명**: 사람이 읽기 쉬운 식별자로 템플릿을 조회합니다.

**타입**: `QueryTemplate`

**파라미터**: 
- `identifier: String!` - 템플릿 식별자

#### 예제

```graphql
query GetTemplateByIdentifier($identifier: String!) {
  getTemplateByIdentifier(identifier: $identifier) {
    id
    identifier
    name
    queryText
    defaultVariables
    isActive
  }
}
```

**Variables**:
```json
{
  "identifier": "user-analytics-dashboard"
}
```

### `searchTemplates` - 템플릿 검색

**설명**: 다양한 조건으로 쿼리 템플릿을 검색합니다.

**타입**: `QueryTemplatesConnection!`

**파라미터**:
- `filter` (선택) - 검색 필터
- `pagination` (선택) - 페이지네이션
- `sort` (선택) - 정렬 조건

#### 예제

```graphql
query SearchTemplates(
  $query: String,
  $category: String,
  $isActive: Boolean
) {
  searchTemplates(
    filter: {
      search: $query
      category: $category
      isActive: $isActive
    }
    sort: [
      { field: "usageCount", direction: DESC }
      { field: "lastUsed", direction: DESC }
    ]
    pagination: {
      limit: 20
    }
  ) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    templates {
      id
      identifier
      name
      description
      category
      complexityScore
      usageCount
      lastUsed
      isActive
    }
  }
}
```

**Variables**:
```json
{
  "query": "사용자 분석",
  "category": "analytics", 
  "isActive": true
}
```

### `getPopularTemplates` - 인기 템플릿 조회

**설명**: 사용 빈도가 높은 템플릿들을 조회합니다.

**타입**: `[QueryTemplate!]!`

**파라미터**:
- `limit: Int` (기본값: 10) - 결과 수 제한

#### 예제

```graphql
query GetPopularTemplates($limit: Int = 10) {
  getPopularTemplates(limit: $limit) {
    id
    identifier
    name
    description
    usageCount
    lastUsed
    complexityScore
    category
  }
}
```

### `executeTemplate` - 템플릿 실행 (Query)

**설명**: 쿼리 템플릿을 실행합니다. 캐싱이 적용됩니다.

**타입**: `ExecuteQueryTemplatePayload!`

**파라미터**:
- `input: ExecuteQueryTemplateInput!` - 실행 설정

#### 예제

```graphql
query ExecuteTemplate(
  $templateId: String!,
  $variables: JSON
) {
  executeTemplate(
    input: {
      templateIdentifier: $templateId
      variables: $variables
      trackUsage: true
    }
  ) {
    success
    data          # 실행 결과 데이터 (JSON)
    errors {
      message
      code
      field
    }
    
    # 메타데이터
    metadata {
      templateId
      templateName
      executionTime
      complexityScore
      usedVariables   # 실제 사용된 변수들
    }
  }
}
```

**Variables**:
```json
{
  "templateId": "user-list-with-relations",
  "variables": {
    "tableId": "users_table",
    "limit": 50,
    "includeRelations": true
  }
}
```

---

## 📊 분석 및 통계

### 시스템 메트릭

**임시 쿼리** (향후 추가 예정):
```graphql
query GetSystemAnalytics {
  analytics {
    tables {
      count
      avgNodesPerTable
      avgRelationsPerTable
    }
    nodes {
      totalCount
      avgAttributesPerNode
      avgRelationsPerNode
    }
    relations {
      totalCount
      avgStrength
      avgConfidence
    }
    performance {
      avgQueryTime
      cacheHitRate
      activeConnections
    }
  }
}
```

---

## 🚀 성능 최적화 팁

### 1. **필요한 필드만 요청**
```graphql
# ✅ 좋은 예
query GetBasicNodeInfo {
  nodes {
    id
    content
  }
}

# ❌ 피해야 할 예  
query GetAllNodeInfo {
  nodes {
    id
    content
    attributes { ... }
    relations { ... }
    # 불필요한 중첩 데이터
  }
}
```

### 2. **페이지네이션 활용**
```graphql
query GetNodesPaginated($cursor: String, $limit: Int = 20) {
  nodes(
    first: $limit
    after: $cursor
  ) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      id
      content
    }
  }
}
```

### 3. **적절한 관계 깊이 설정**
```graphql
# 깊이 제한으로 성능 최적화
query GetRelatedNodesOptimized($nodeId: ID!) {
  searchRelatedNodes(
    nodeId: $nodeId
    depth: 2        # 깊이 제한
    filter: {
      minStrength: 0.5  # 강도 필터링
    }
  ) {
    nodes {
      id
      content
      distance
    }
  }
}
```

---

**다음**: [Mutation 연산 문서](./mutations.md) →  
**이전**: [API 개요](../README.md) ←
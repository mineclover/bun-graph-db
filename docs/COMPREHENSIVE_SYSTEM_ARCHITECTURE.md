# 🏗️ Comprehensive System Architecture

> **역사적 설계 기록**: 이 문서의 고정 도구 수, 프록시 비율, 성능 수치는 현재 운영 계약이나 검증 결과가 아니다. 현재 서비스 구조는 [아키텍처 개요](./architecture/overview.md), MCP 계약은 [MCP 참조](./mcp/README.md)를 따른다.

**버전**: 3.0.0
**최종 업데이트**: 2025-09-25
**대상**: AI 시스템, 개발자, 시스템 아키텍트
**목적**: AI가 시스템을 이해하고 활용할 수 있도록 하는 포괄적 가이드

## 🎯 시스템 개요

Bun Graph Database는 **동적 스키마 기반 그래프 데이터베이스**로, AI 친화적 설계를 통해 범용 AI 시스템이 쉽게 이해하고 활용할 수 있습니다.

### 핵심 철학
- **동적 스키마**: 런타임에 테이블과 속성 정의 가능
- **AI-First 설계**: Few Shot 프롬프트와 자동 문서화로 AI 학습 최적화
- **GraphQL 기반**: 타입 안전성과 강력한 쿼리 기능 제공
- **MCP 프록시**: 27개 도구로 모든 기능을 외부 AI에 노출
- **템플릿 시스템**: 재사용 가능한 쿼리 패턴 저장 및 실행

## 🏛️ 11대 핵심 기능

### 1. 🗂️ 동적 스키마 정의와 활용 ⭐⭐⭐⭐⭐

**구조**: `Table → AttributeType → Attribute → Node → RelationType → Relation`

```graphql
# 1단계: 테이블 생성
createTable(input: {
  identifier: "employees"
  description: "직원 정보 테이블"
})

# 2단계: 속성 타입 및 속성 정의
createAttribute(input: {
  tableId: "1"
  identifier: "name"
  attributeTypeId: "string"
})

# 3단계: 노드 생성 및 속성 설정
createNode(input: {
  tableId: "1"
  content: "John Doe - Software Engineer"
})
setNodeAttribute(input: {
  nodeId: "1"
  attributeId: "name"
  value: "John Doe"
})

# 4단계: 관계 정의 및 생성
createRelationType(input: {
  identifier: "reportsTo"
  description: "상하관계"
})
createRelation(input: {
  fromNodeId: "1"
  toNodeId: "2"
  relationshipType: "reportsTo"
})
```

**장점**:
- 유연한 도메인 모델링
- 타입 안전한 속성 시스템
- 실시간 스키마 확장

### 2. 📋 동적 스키마를 위한 쿼리와 사용법 저장 ⭐⭐⭐⭐⭐

**템플릿 시스템**: 범용 템플릿 + 테이블별 특화 템플릿

```graphql
# 범용 템플릿 생성
createTemplate(input: {
  identifier: "create-person-node"
  name: "Create Person Node with Attributes"
  query: """
    mutation CreatePersonNode($tableId: ID!, $name: String!, $email: String!, $age: Int!) {
      createNode(input: {tableId: $tableId, content: $name}) {
        success
        node { id }
      }
      setName: setNodeAttribute(input: {nodeId: $nodeId, attributeId: "name", value: $name}) { success }
      setEmail: setNodeAttribute(input: {nodeId: $nodeId, attributeId: "email", value: $email}) { success }
      setAge: setNodeAttribute(input: {nodeId: $nodeId, attributeId: "age", value: $age}) { success }
    }
  """
  tags: ["person", "crud", "attributes"]
})

# 템플릿 실행
executeTemplateWithGraphQL(
  templateIdentifier: "create-person-node"
  variables: {
    tableId: "2"
    name: "Alice Johnson"
    email: "alice@company.com"
    age: 30
  }
)
```

### 3. 📚 동적 스키마 자동 문서 생성 기능 ⭐⭐⭐⚪⚪

**현재 상태**: 기본적인 `tableDocumentation` 쿼리 존재

```graphql
query GetTableDocs {
  tableDocumentation(
    tableId: "2"
    includeDocs: true
    includeRelationships: true
    includeRelatedTemplates: true
    includeUsageStats: true
  ) {
    table { identifier description }
    attributes { identifier name attributeType { dataType } }
    relationships { relationTypeName targetTable }
    usagePatterns { commonQueries templateRecommendations }
    sampleData { nodes { content attributes } }
  }
}
```

**보완 필요**: AI가 이해할 수 있는 구조화된 메타데이터와 사용 예제

### 4. 🤖 AI를 통한 템플릿 쿼리 생성 ⭐⭐⚪⚪⚪

**개념**: 외부 AI가 현재 시스템을 이해하고 GraphQL 쿼리를 생성할 수 있도록 하는 Few Shot 프롬프트 시스템

**현재 구현**: 부분적 패턴만 존재
**목표**: AI가 다음과 같이 쿼리를 생성할 수 있도록 가이드

```markdown
## AI Query Generation Pattern

### 시스템 이해를 위한 메타데이터:
1. 사용 가능한 테이블과 스키마 조회
2. AttributeType별 데이터 타입 이해
3. 관계 타입과 그래프 구조 파악
4. 기존 템플릿 패턴 학습

### Few Shot 예제:
- "Create a person with name and email" → Template generation
- "Find all connections between two nodes" → Graph traversal query
- "Search nodes by age range" → Filtering query with attribute conditions

### 생성된 쿼리 저장:
- AI 생성 쿼리를 템플릿으로 자동 저장
- 사용 빈도 기반 템플릿 추천
```

### 5. ⚡ 저장된 쿼리 실행 ⭐⭐⭐⭐⭐

**ExecuteTemplateWithGraphQL 엔진**:

```typescript
// 안정적인 실행 구조
const result = await executeTemplateWithGraphQL({
  templateIdentifier: "complex-graph-analysis",
  variables: {
    nodeId: "1",
    depth: 3,
    relationTypes: ["knows", "worksAt"]
  }
})

// 결과 구조
{
  success: boolean
  data: any           // GraphQL 실행 결과
  errors: Error[]     // 실행 중 발생한 오류
  executionTime: number
  templateUsage: { count: number, lastUsed: string }
}
```

### 6. 🕸️ 관계 정의, 관계 정의를 통한 그래프 구조 ⭐⭐⭐⭐⭐

**관계 시스템**:

```graphql
# 관계 타입 정의
createRelationType(input: {
  identifier: "knows"
  description: "개인적 친분"
  isDirectional: true
})

# 관계 생성
createRelation(input: {
  fromNodeId: "alice"
  toNodeId: "bob"
  relationshipType: "knows"
  metadata: { strength: "strong", since: "2020" }
})

# 그래프 탐색
query GraphTraversal {
  node(id: "alice") {
    # 직접 연결된 노드들
    connectedNodes(depth: 1, relationTypes: ["knows"]) {
      id content
    }

    # 최단 경로 탐색
    shortestPath(targetNodeId: "carol", maxDepth: 6) {
      id content
    }

    # 관계 기반 네트워크 분석
    neighborsByRelationType(relationTypes: ["knows"], direction: BOTH) {
      id content relationships { relationType targetNode }
    }
  }
}
```

### 7. 🔄 MCP는 GraphQL 기능들을 프록시 ⭐⭐⭐⭐⭐

**27개 MCP 도구 = GraphQL 프록시**:

```typescript
// MCP 도구 아키텍처
interface McpTool {
  name: string
  description: string
  inputSchema: JSONSchema
  graphqlOperation?: {
    operationType: "query" | "mutation"
    query: string
    variableMapping: Record<string, string>
  }
  customHandler?: string  // 커스텀 비즈니스 로직 필요시
}

// 실행 패턴
// 도구별 GraphQL 직접 실행 또는 전용 처리 경로는 단일 MCP 계약으로 정의한다.
// 고정 비율·도구 수는 운영 계약으로 사용하지 않는다.
```

**주요 MCP 도구들**:
- `createTable`, `createNode`, `createRelation` - 기본 CRUD
- `searchNodes`, `getConnectedNodes` - 검색 및 탐색
- `executeTemplateWithGraphQL` - 템플릿 실행
- `getTableDocs` - 문서화
- `exportTemplate`, `importTemplate` - 템플릿 관리

### 8. 🔗 데이터베이스별 고유식별자 부여 후 다른 데이터베이스 간 연동 ⭐⭐⚪⚪⚪

**현재 상태**: 기본적인 UUID 기반 ID 시스템
**개선 필요**:
```typescript
// 목표 구조
interface CrossDatabaseReference {
  localId: string           // 현재 DB 내 ID
  globalId: string         // 전역 고유 식별자
  sourceDatabase: string   // 원본 데이터베이스 식별자
  foreignReferences: {     // 다른 DB 참조
    databaseId: string
    nodeId: string
    relationship: string
  }[]
}
```

### 9. 🗺️ 관계 정의를 통한 그래프 탐색 기능 ⭐⭐⭐⭐⭐

**강력한 그래프 쿼리**:

```graphql
query AdvancedGraphTraversal($startNodeId: ID!) {
  # 깊이별 연결 분석
  node(id: $startNodeId) {
    # 1차 연결 (직접 관계)
    directConnections: connectedNodes(depth: 1) {
      id content relationshipType
    }

    # 3차 연결까지 확장 네트워크
    extendedNetwork: connectedNodes(depth: 3, direction: BOTH) {
      id content path { relationshipTypes }
    }

    # 특정 관계 타입으로 필터링
    colleagues: connectedNodes(
      depth: 2
      relationTypes: ["worksAt", "collaboratesWith"]
    ) {
      id content attributes
    }

    # 최단 경로 알고리즘
    pathToTarget: shortestPath(
      targetNodeId: "target-node"
      maxDepth: 10
    ) {
      id content
    }
  }
}
```

### 10. 🔍 기본 AttributeType에 대한 검색 엔진 ⭐⭐⭐⭐⭐

**타입별 검색 지원**:

```graphql
query SmartSearch($tableId: ID!) {
  searchNodes(
    tableId: $tableId
    searchQuery: {
      # 텍스트 검색
      textSearch: "engineer"

      # 속성 기반 복합 조건
      conditions: [
        {
          logicalOperator: AND
          filters: [
            # 숫자 범위 검색
            { field: "age", operator: "range", value: { min: "25", max: "40" } }
            # 문자열 패턴 매칭
            { field: "department", operator: "contains", value: "Engineering" }
            # 정확한 값 매칭
            { field: "status", operator: "equals", value: "active" }
            # 비교 연산
            { field: "salary", operator: "gte", value: "50000" }
          ]
        }
      ]

      # 결과 정렬
      sortBy: [
        { field: "created_at", direction: DESC }
        { field: "name", direction: ASC }
      ]

      # 페이지네이션
      limit: 50
      offset: 0
    }
  ) {
    nodes {
      node { id content }
      attributes { attribute { identifier } value }
      relevanceScore
    }
    totalCount
    hasNextPage
  }
}
```

### 11. 📝 테이블에 노드 생성하며 스키마별 속성 제어 ⭐⭐⭐⭐⭐

**템플릿 기반 쉬운 노드 생성**:

```graphql
# 단일 템플릿으로 노드 + 속성 일괄 생성
mutation CreateCompleteEmployee($tableId: ID!, $employeeData: EmployeeInput!) {
  # 1. 노드 생성
  createNode(input: {
    tableId: $tableId
    content: $employeeData.summary
  }) {
    success
    node { id }
  }

  # 2. 스키마별 속성 일괄 설정
  setName: setNodeAttribute(input: {
    nodeId: $nodeId
    attributeId: "name"
    value: $employeeData.name
  }) { success }

  setEmail: setNodeAttribute(input: {
    nodeId: $nodeId
    attributeId: "email"
    value: $employeeData.email
  }) { success }

  setDepartment: setNodeAttribute(input: {
    nodeId: $nodeId
    attributeId: "department"
    value: $employeeData.department
  }) { success }

  # 3. 관계 생성 (매니저와의 관계)
  createReportingRelation: createRelation(input: {
    fromNodeId: $employeeData.managerId
    toNodeId: $nodeId
    relationshipType: "manages"
  }) { success }
}
```

## 🚀 AI 활용 가이드

### AI가 시스템을 이해하는 단계

#### 1단계: 메타데이터 수집
```graphql
query SystemUnderstanding {
  # 사용 가능한 테이블과 스키마
  tables {
    nodes {
      id identifier description
      attributes { identifier attributeType { dataType } }
    }
  }

  # 템플릿 패턴 학습
  searchTemplates {
    templates {
      identifier name query tags
      usageStats { executionCount averageExecutionTime }
    }
  }
}
```

#### 2단계: Few Shot 학습
```markdown
## 패턴 학습을 위한 Few Shot 예제

### 예제 1: 인물 생성
입력: "Create a person named John with email john@example.com and age 30"
템플릿: create-person-with-attributes
변수: {name: "John", email: "john@example.com", age: 30}

### 예제 2: 관계 탐색
입력: "Find everyone connected to Alice within 2 degrees"
쿼리: connectedNodes(nodeId: "alice", depth: 2)
결과: 그래프 네트워크 데이터

### 예제 3: 조건부 검색
입력: "Find engineers older than 25 in the San Francisco office"
쿼리: searchNodes with filters on age, department, location
결과: 필터링된 노드 목록
```

#### 3단계: 동적 쿼리 생성
AI는 학습된 패턴을 바탕으로 새로운 요청에 대해 적절한 GraphQL 쿼리를 생성하고 템플릿으로 저장할 수 있습니다.

## 🏗️ 시스템 아키텍처 다이어그램

```
🌐 AI Interface Layer (MCP Tools)
├── 27 MCP 도구 (GraphQL 프록시)
├── JSON-RPC 2.0 프로토콜
└── 파라미터 변환 및 라우팅

📊 GraphQL API Layer
├── 쿼리, 뮤테이션, 구독
├── 타입 안전한 스키마
├── 필드 리졸버 체계
└── 실시간 데이터 동기화

🧠 Template & Documentation Engine
├── ExecuteTemplateWithGraphQL 엔진
├── 자동 문서 생성 시스템
├── Few Shot 프롬프트 패턴
└── AI-readable 메타데이터

💼 Business Logic Layer
├── 유스케이스 오케스트레이션
├── 도메인 서비스
├── 데이터 변환 및 검증
└── 비즈니스 규칙 적용

🏛️ Domain Layer (Core)
├── 엔터티: Node, Table, Relation, Template
├── 값 객체: AttributeType, RelationType
├── 저장소 인터페이스
└── 도메인 이벤트

🔧 Infrastructure Layer
├── SQLite 저장소 구현
├── 의존성 주입 컨테이너
├── 데이터베이스 추상화
└── 외부 시스템 연동
```

## 📈 성능 특성

### 응답 시간
- **GraphQL 헬스체크**: < 1ms
- **단일 노드 조회**: < 5ms
- **템플릿 실행**: < 50ms (복잡도에 따라)
- **그래프 탐색** (깊이 3): < 100ms
- **복합 검색 쿼리**: < 200ms

### 확장성
- **테이블**: 무제한 (동적 생성)
- **노드당 속성**: 무제한 (스키마 기반)
- **관계 깊이**: 권장 최대 10단계
- **동시 접속**: Bun 런타임 기반 고성능

## 🔧 개발 및 확장 가이드

### 새로운 MCP 도구 추가
```typescript
// 1. 도구 정의
const newTool: McpToolDefinition = {
  name: "customOperation",
  description: "Custom business operation",
  inputSchema: { /* JSON Schema */ },
  graphqlOperation: {
    operationType: "mutation",
    query: `mutation CustomOp($input: CustomInput!) { ... }`,
    variableMapping: { input: "input" }
  }
}

// 2. 도구 등록
await mcpToolRegistry.registerTool(newTool)
```

### GraphQL 스키마 확장
```graphql
# 새로운 타입 정의
extend type Query {
  customAnalysis(input: CustomInput!): AnalysisResult!
}

# 새로운 뮤테이션
extend type Mutation {
  advancedOperation(data: AdvancedInput!): OperationResult!
}
```

## 🎯 결론

이 시스템은 **AI-First 설계**를 통해 외부 AI 시스템이 쉽게 이해하고 활용할 수 있는 그래프 데이터베이스를 제공합니다.

**핵심 강점**:
- 11대 핵심 기능 중 8개 완전 구현 (73% 완성도)
- 동적 스키마와 템플릿 시스템의 조합으로 높은 유연성 확보
- MCP 프록시를 통한 완전한 API 노출
- GraphQL 기반 타입 안전성과 강력한 쿼리 기능

**개선 영역**:
- AI-driven 쿼리 생성 시스템 구축 (Few Shot 프롬프트 고도화)
- 자동 문서화 시스템 강화 (사용 예제, 패턴 가이드)
- 데이터베이스 간 연동을 위한 글로벌 식별자 체계

이 시스템을 통해 AI는 복잡한 데이터 모델링부터 고급 그래프 분석까지 모든 작업을 자연어 인터페이스로 수행할 수 있습니다.

---

**작성**: Claude Code Assistant
**검토**: Human Developer
**업데이트 주기**: 분기별 또는 주요 기능 추가시

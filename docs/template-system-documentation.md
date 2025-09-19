# GraphQL Template System Documentation

## 개요

Bun Graph DB는 재사용 가능한 GraphQL 쿼리 템플릿 시스템을 제공합니다. 이 시스템을 통해 복잡한 GraphQL 쿼리를 템플릿으로 저장하고, 변수를 사용하여 동적으로 실행할 수 있습니다.

## 주요 기능

### 1. 템플릿 관리 (Template Management)

#### 템플릿 생성
```graphql
mutation {
  createTemplate(input: {
    identifier: "create-todo"
    name: "CreateTodo"
    description: "새로운 할일을 생성하는 템플릿"
    query: "mutation CreateTodo($title: String!) { ... }"
    operationType: "mutation"
    variables: { title: "할일 제목" }
    variablesSchema: { title: { type: "String", required: true } }
    tags: ["todo", "create", "crud"]
  }) {
    success
    template { id identifier name }
    errors { message }
  }
}
```

#### 템플릿 수정
```graphql
mutation {
  updateTemplate(id: "template-id", input: {
    name: "Updated Todo Template"
    description: "수정된 할일 템플릿"
    isActive: true
  }) {
    success
    template { id name description }
    errors { message }
  }
}
```

#### 템플릿 삭제
```graphql
mutation {
  deleteTemplate(id: "template-id") {
    success
    deletedId
    errors { message }
  }
}
```

### 2. 템플릿 조회 (Template Queries)

#### 단일 템플릿 조회
```graphql
query {
  getTemplate(id: "template-id") {
    id
    identifier
    name
    description
    query
    operationType
    variables
    variablesSchema
    tags
    isActive
  }
}
```

#### 식별자로 템플릿 조회
```graphql
query {
  getTemplateByIdentifier(identifier: "create-todo") {
    id
    name
    description
    query
    variables
  }
}
```

#### 템플릿 검색
```graphql
query {
  searchTemplates(
    filter: {
      operationType: "mutation"
      tags: ["todo"]
      isActive: true
    }
    pagination: { limit: 10, offset: 0 }
    sort: [{ field: "name", direction: "ASC" }]
  ) {
    nodes {
      id
      identifier
      name
      description
      tags
    }
    totalCount
    hasNextPage
  }
}
```

#### 인기 템플릿 조회
```graphql
query {
  getPopularTemplates(limit: 5) {
    id
    identifier
    name
    description
    usageCount
    lastUsedAt
  }
}
```

### 3. 템플릿 실행 (Template Execution)

#### 기본 템플릿 실행
```graphql
mutation {
  executeTemplate(input: {
    templateId: "template-id"
    variables: {
      title: "새로운 할일"
      description: "템플릿으로 생성된 할일"
      priority: "HIGH"
    }
    trackUsage: true
  }) {
    success
    data
    errors { message }
    executionTime
    usageTracked
  }
}
```

#### GraphQL로 템플릿 실행
```graphql
mutation {
  executeTemplateWithGraphQL(
    templateIdentifier: "create-todo"
    variables: {
      title: "GraphQL 템플릿 테스트"
      status: "TODO"
      priority: "MEDIUM"
    }
    trackUsage: true
  ) {
    success
    result
    executionMetadata {
      executionTime
      templateUsed
      variablesUsed
    }
    errors { message code }
  }
}
```

### 4. 템플릿 상태 관리

#### 템플릿 활성화
```graphql
mutation {
  activateTemplate(id: "template-id") {
    id
    identifier
    isActive
    activatedAt
  }
}
```

#### 템플릿 비활성화
```graphql
mutation {
  deactivateTemplate(id: "template-id") {
    id
    identifier
    isActive
    deactivatedAt
  }
}
```

### 5. 템플릿 쿼리 업데이트

```graphql
mutation {
  updateTemplateQuery(
    templateId: "template-id"
    newQuery: "mutation UpdatedCreateTodo($title: String!, $priority: String = \"LOW\") { ... }"
    updateVariables: {
      title: "업데이트된 제목"
      priority: "LOW"
    }
  ) {
    success
    template {
      id
      query
      variables
      updatedAt
    }
    errors { message }
  }
}
```

### 6. 템플릿 가져오기/내보내기

#### 템플릿 내보내기
```graphql
mutation {
  exportTemplate(
    templateId: "template-id"
    includeStatistics: true
  ) {
    success
    exportData
    metadata {
      exportedAt
      version
      includesStatistics
    }
    errors { message }
  }
}
```

#### 템플릿 가져오기
```graphql
mutation {
  importTemplate(
    jsonData: "{ \"identifier\": \"imported-template\", ... }"
    overwriteExisting: false
    generateNewIdentifier: true
    newIdentifierPrefix: "imported-"
  ) {
    success
    template {
      id
      identifier
      name
      importedAt
    }
    warnings { message }
    errors { message }
  }
}
```

### 7. 테이블 종속성 쿼리

#### 테이블별 템플릿 조회
```graphql
query {
  templatesByTable(input: {
    tableId: "58"
    includeInactive: false
  }) {
    id
    identifier
    name
    description
    tableDependencies
  }
}
```

#### 테이블 종속성이 있는 템플릿
```graphql
query {
  templatesWithTableDependencies {
    id
    identifier
    name
    tableDependencies
    affectedTables
  }
}
```

#### 테이블 종속성 분석
```graphql
query {
  tableDependencyTemplates {
    table {
      id
      identifier
      name
    }
    templates {
      id
      identifier
      name
      dependencyType
    }
    dependencyCount
  }
}
```

## 템플릿 구조

### 기본 템플릿 스키마
```json
{
  "identifier": "create-todo",
  "name": "CreateTodo",
  "description": "새로운 할일을 생성하는 템플릿",
  "query": "mutation CreateTodo($title: String!) { ... }",
  "operationType": "mutation",
  "queryName": "CreateTodo",
  "tags": ["todo", "create", "crud"],
  "complexityScore": 6,
  "isActive": true,
  "variables": {
    "title": "할일 제목",
    "description": "할일 설명"
  },
  "variablesSchema": {
    "title": {
      "type": "String",
      "required": true,
      "description": "할일 제목"
    },
    "description": {
      "type": "String",
      "required": false,
      "description": "할일 상세 설명"
    }
  },
  "version": "1.0.0"
}
```

### 변수 스키마 타입
- `String`: 문자열 값
- `Int`: 정수 값
- `Float`: 부동소수점 값
- `Boolean`: 불린 값
- `ID`: 식별자 값
- `JSON`: JSON 객체

### 변수 스키마 속성
- `type`: 변수 타입
- `required`: 필수 여부 (true/false)
- `default`: 기본값
- `description`: 변수 설명
- `enum`: 허용된 값들의 배열

## 사용 예시

### 1. TODO 관리 템플릿

#### 할일 생성
```json
{
  "identifier": "create-todo",
  "name": "CreateTodo",
  "query": "mutation CreateTodo($title: String!, $description: String) { createNode(tableId: \"58\", content: $title, attributes: [{name: \"title\", value: $title}, {name: \"description\", value: $description}]) { success node { id } } }",
  "variables": {
    "title": "새로운 할일",
    "description": "할일 설명"
  }
}
```

#### 할일 조회
```json
{
  "identifier": "get-todo",
  "name": "GetTodo",
  "query": "query GetTodo($todoId: ID!) { node(id: $todoId) { id content attributes { name value } } }",
  "variables": {
    "todoId": "node-id"
  }
}
```

### 2. 시스템 모니터링 템플릿

```json
{
  "identifier": "system-monitoring-dashboard",
  "name": "SystemMonitoringDashboard",
  "query": "query SystemDashboard { healthCheck { status timestamp database } systemStats { memory { percentage } process { cpu } } }",
  "variables": {}
}
```

### 3. 고급 검색 템플릿

```json
{
  "identifier": "search-nodes-advanced",
  "name": "SearchNodesAdvanced",
  "query": "query SearchNodes($tableId: ID!, $searchText: String, $limit: Int = 10) { searchNodes(tableId: $tableId, searchText: $searchText, pagination: {limit: $limit}) { nodes { id content } totalCount } }",
  "variables": {
    "tableId": "58",
    "searchText": "검색어",
    "limit": 10
  }
}
```

## 성능 고려사항

1. **복잡도 점수**: 템플릿의 복잡도를 점수로 관리하여 성능 최적화
2. **캐싱**: 자주 사용되는 템플릿 결과 캐싱
3. **변수 검증**: 실행 전 변수 타입 및 필수값 검증
4. **사용량 추적**: 템플릿 사용 통계 수집 및 최적화

## 보안 고려사항

1. **쿼리 검증**: 악성 쿼리 패턴 차단
2. **변수 새니타이징**: 입력 변수 검증 및 새니타이징
3. **권한 확인**: 템플릿 실행 권한 검증
4. **리소스 제한**: 쿼리 실행 시간 및 리소스 사용량 제한

## 모범 사례

1. **명확한 이름**: 템플릿 식별자와 이름을 명확하게 작성
2. **태그 활용**: 관련 태그를 통한 템플릿 분류
3. **변수 문서화**: 모든 변수에 대한 명확한 설명 제공
4. **버전 관리**: 템플릿 변경 시 적절한 버전 관리
5. **테스트**: 템플릿 생성 후 다양한 변수로 테스트 수행
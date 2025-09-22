# executeTemplateWithGraphQL 사용 패턴 가이드

## 개요

`executeTemplateWithGraphQL`는 저장된 GraphQL 템플릿을 실행하여 실제 GraphQL 쿼리/뮤테이션을 수행하고 결과를 반환하는 강력한 기능입니다.

## 기본 사용법

### 1. 템플릿 목록 조회

먼저 사용 가능한 템플릿을 조회합니다.

```graphql
query SearchAllTemplates($limit: Int, $offset: Int) {
  searchTemplates(limit: $limit, offset: $offset) {
    nodes {
      identifier
      name
      description
      operationType
      complexityScore
      isActive
    }
    totalCount
  }
}
```

### 2. 기본 템플릿 실행 구조

```graphql
mutation ExecuteTemplate {
  executeTemplateWithGraphQL(
    templateIdentifier: "template-id",
    variables: { /* 템플릿에 필요한 변수들 */ }
  ) {
    success
    data        # 실제 GraphQL 실행 결과
    errors {
      message
      code
    }
    metadata {
      templateId
      templateName
      executionTime
    }
  }
}
```

## 실행 패턴별 예제

### 패턴 1: 변수 없는 단순 쿼리

```graphql
mutation ExecuteHealthCheck {
  executeTemplateWithGraphQL(templateIdentifier: "test-health-check") {
    success
    data
    errors { message }
  }
}
```

**응답 예시:**
```json
{
  "success": true,
  "data": {
    "health": {
      "status": "OK",
      "timestamp": "2025-01-06T10:00:00Z"
    }
  }
}
```

### 패턴 2: 페이징이 있는 리스트 쿼리

```graphql
mutation ExecuteListTables {
  executeTemplateWithGraphQL(
    templateIdentifier: "test-list-tables",
    variables: {
      pagination: { limit: 5, offset: 0 }
    }
  ) {
    success
    data
    errors { message }
    metadata { executionTime }
  }
}
```

**응답 예시:**
```json
{
  "success": true,
  "data": {
    "data": {
      "tables": {
        "nodes": [
          { "id": "1", "identifier": "users" },
          { "id": "2", "identifier": "products" }
        ],
        "totalCount": 25,
        "hasNextPage": true
      }
    }
  }
}
```

### 패턴 3: 검색 필터가 있는 쿼리

```graphql
mutation ExecuteSearchNodes {
  executeTemplateWithGraphQL(
    templateIdentifier: "test-search-nodes",
    variables: {
      searchFilters: { tableId: "1" },
      pagination: { limit: 10, offset: 0 }
    }
  ) {
    success
    data
    errors { message }
  }
}
```

### 패턴 4: 생성 뮤테이션

```graphql
mutation ExecuteCreateTable {
  executeTemplateWithGraphQL(
    templateIdentifier: "test-create-table",
    variables: {
      input: {
        identifier: "new_table",
        description: "새로운 테이블"
      }
    }
  ) {
    success
    data
    errors { message }
  }
}
```

**응답 예시:**
```json
{
  "success": true,
  "data": {
    "data": {
      "createTable": {
        "success": true,
        "table": {
          "id": "26",
          "identifier": "new_table",
          "description": "새로운 테이블"
        }
      }
    }
  }
}
```

## cURL 사용법

### 1. JSON 파일 생성

```bash
# template-query.json
{
  "query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"test-list-tables\", variables: {pagination: {limit: 5, offset: 0}}) { success data errors { message } } }"
}
```

### 2. cURL 실행

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d @template-query.json \
  http://localhost:4000/graphql
```

## JavaScript/TypeScript 사용법

### 기본 함수

```javascript
async function executeTemplate(templateIdentifier, variables = {}) {
  const response = await fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation ExecuteTemplate($templateId: String!, $variables: JSON) {
          executeTemplateWithGraphQL(
            templateIdentifier: $templateId, 
            variables: $variables
          ) {
            success
            data
            errors { message code }
            metadata { templateName executionTime }
          }
        }
      `,
      variables: { templateId: templateIdentifier, variables }
    })
  });
  
  return await response.json();
}
```

### 사용 예시

```javascript
// 1. 템플릿 목록 조회
const templates = await executeTemplate('search-all-templates', {
  limit: 20, offset: 0
});

// 2. 테이블 목록 조회
const tables = await executeTemplate('test-list-tables', {
  pagination: { limit: 10, offset: 0 }
});

// 3. 노드 검색
const nodes = await executeTemplate('test-search-nodes', {
  searchFilters: { tableId: "1" },
  pagination: { limit: 5, offset: 0 }
});

// 4. 테이블 생성
const newTable = await executeTemplate('test-create-table', {
  input: {
    identifier: `table_${Date.now()}`,
    description: "API로 생성된 테이블"
  }
});
```

## 오류 처리 패턴

### 1. 템플릿 없음 오류

```graphql
mutation {
  executeTemplateWithGraphQL(templateIdentifier: "non-existent") {
    success
    errors { message code }
  }
}
```

**응답:**
```json
{
  "success": false,
  "errors": [
    {
      "message": "Query template not found: non-existent",
      "code": "TEMPLATE_NOT_FOUND"
    }
  ]
}
```

### 2. 변수 검증 오류

잘못된 변수 타입이나 필수 변수 누락 시:

```json
{
  "success": false,
  "errors": [
    {
      "message": "Variable validation failed",
      "code": "VALIDATION_ERROR"
    }
  ]
}
```

### 3. GraphQL 실행 오류

템플릿의 GraphQL 쿼리 자체에 문제가 있을 때:

```json
{
  "success": false,
  "errors": [
    {
      "message": "Cannot query field 'nonExistentField'",
      "code": "GRAPHQL_EXECUTION_ERROR"
    }
  ]
}
```

## 성능 최적화 팁

### 1. 적절한 페이징 사용
```javascript
// ✅ 좋은 예: 적절한 limit 사용
{ pagination: { limit: 20, offset: 0 } }

// ❌ 나쁜 예: 너무 큰 limit
{ pagination: { limit: 1000, offset: 0 } }
```

### 2. 필요한 필드만 요청
```graphql
# ✅ 좋은 예: 필요한 필드만
query { 
  tables { nodes { id identifier } } 
}

# ❌ 나쁜 예: 모든 필드 요청
query { 
  tables { nodes { id identifier description createdAt updatedAt ... } } 
}
```

### 3. 메타데이터 활용
```javascript
const result = await executeTemplate('test-list-tables');
console.log(`실행 시간: ${result.data.executeTemplateWithGraphQL.metadata.executionTime}ms`);
```

## 템플릿 개발 워크플로우

### 1. 템플릿 생성
```json
{
  "identifier": "my-custom-template",
  "name": "내 커스텀 템플릿",
  "query": "query MyQuery { ... }",
  "variables": { ... },
  "variablesSchema": { ... }
}
```

### 2. 템플릿 테스트
```bash
# 직접 실행으로 테스트
curl -X POST -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"my-custom-template\") { success data errors { message } } }"}' \
  http://localhost:4000/graphql
```

### 3. 프로덕션 배포
템플릿이 정상 동작 확인 후 본격 사용

## 주의사항

1. **템플릿 식별자**: 정확한 `templateIdentifier` 사용 필요
2. **변수 구조**: 템플릿의 `variablesSchema`에 맞는 변수 구조 사용
3. **오류 처리**: `success` 필드를 확인하고 `errors` 배열 처리
4. **성능**: 복잡한 쿼리는 `metadata.executionTime` 모니터링
5. **보안**: 사용자 입력 변수는 적절한 검증 후 사용

## 추가 자료

- **스크립트 실행**: `bun examples/template-execution-guide.js`
- **템플릿 파일**: `exported-templates/templates/`
- **GraphQL 스키마**: `http://localhost:4000/graphql` (GraphiQL)
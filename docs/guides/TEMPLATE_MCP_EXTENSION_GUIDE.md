# 템플릿 기반 MCP 인터페이스 확장 가이드

**코드 수정 없이 MCP 도구를 동적으로 확장하는 방법**

**Version**: 1.0.0
**Last Updated**: 2025-11-26

---

## 개요

이 가이드는 **템플릿을 생성하여 MCP 도구를 동적으로 확장**하는 방법을 설명합니다.
코드를 수정하지 않고도 새로운 테이블과 템플릿을 만들어 Claude AI가 사용할 수 있는 도구를 추가할 수 있습니다.

### 핵심 원리

```
┌─────────────────────────────────────────────────────────────┐
│  1. 테이블 생성                                              │
│     └─ GraphQL: createTable(identifier: "my_tasks")         │
│                                                              │
│  2. 속성 정의                                                │
│     └─ GraphQL: createAttribute(identifier: "status", ...)  │
│                                                              │
│  3. 템플릿 생성 (태그: table:my_tasks)                       │
│     └─ GraphQL: createQueryTemplate(...)                    │
│                                                              │
│  4. MCP 서버 등록                                            │
│     └─ claude mcp add --transport http my-tasks \           │
│        http://localhost:4141/sub/my_tasks/mcp               │
│                                                              │
│  5. 자동 도구 노출                                           │
│     └─ 템플릿이 MCP 도구로 자동 변환됨                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 빠른 시작 예제

### 목표: 워크플로우 태스크 관리 시스템 구축

**최종 결과**: Claude에게 "pending 상태의 태스크 보여줘"라고 말하면 자동으로 검색됨

#### Step 1: 테이블 생성

```bash
curl -X POST http://localhost:4141/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { createTable(input: { identifier: \"workflow_tasks\", description: \"워크플로우 태스크 관리\" }) { success table { id identifier } } }"
  }'
```

**응답:**
```json
{
  "data": {
    "createTable": {
      "success": true,
      "table": { "id": "1", "identifier": "workflow_tasks" }
    }
  }
}
```

#### Step 2: 속성 정의

```bash
# status 속성 추가
curl -X POST http://localhost:4141/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { createAttribute(input: { tableId: \"1\", identifier: \"status\", name: \"상태\", attributeTypeId: \"1\" }) { success } }"
  }'

# purpose 속성 추가
curl -X POST http://localhost:4141/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { createAttribute(input: { tableId: \"1\", identifier: \"purpose\", name: \"목적\", attributeTypeId: \"1\" }) { success } }"
  }'
```

#### Step 3: 템플릿 생성

```bash
# 상태별 검색 템플릿
curl -X POST http://localhost:4141/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { createQueryTemplate(input: { identifier: \"search-by-status\", name: \"SearchByStatus\", description: \"상태별 태스크 검색. status 변수에 pending, in_progress, completed 등을 전달합니다.\", query: \"query SearchByStatus($status: String!) { searchNodes(filter: { tableId: \\\"1\\\", attributeFilters: [{ identifier: \\\"status\\\", value: $status }] }) { nodes { id content attributes { attribute { identifier } value } } totalCount } }\", tags: [\"table:workflow_tasks\"] }) { success template { id identifier } } }"
  }'
```

#### Step 4: MCP 서버 등록

```bash
# Claude Code에 테이블별 MCP 서버 추가
claude mcp add --transport http workflow-tasks http://localhost:4141/sub/workflow_tasks/mcp
```

#### Step 5: 도구 확인

```bash
# MCP 도구 목록 조회
curl -X POST http://localhost:4141/sub/workflow_tasks/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
```

**생성된 도구 예시:**
- `search-by-status` - 상태별 태스크 검색
- `get-table-workflow_tasks-attributes` - 속성 목록 조회
- `create-table-workflow_tasks-template` - 템플릿 생성
- ...

---

## 템플릿 설계 패턴

### 1. CRUD 템플릿 세트

완전한 데이터 관리를 위한 기본 템플릿 구성:

#### Create (생성)

```graphql
mutation CreateTask($content: String!, $status: String!, $purpose: String) {
  createNodeWithAttributes(input: {
    tableId: "1"
    content: $content
    attributesByIdentifier: [
      { identifier: "status", value: $status }
      { identifier: "purpose", value: $purpose }
    ]
  }) {
    success
    node { id content }
    errors { message }
  }
}
```

**템플릿 메타데이터:**
```json
{
  "identifier": "create-task",
  "name": "CreateTask",
  "description": "새 태스크 생성. content(필수), status(필수), purpose(선택) 전달",
  "tags": ["table:workflow_tasks", "crud", "create"]
}
```

#### Read (조회)

```graphql
# 단일 조회
query GetTask($nodeId: ID!) {
  node(id: $nodeId) {
    id
    content
    attributes { attribute { identifier } value }
    createdAt
    updatedAt
  }
}

# 목록 조회
query ListTasks($limit: Int = 50) {
  searchNodes(
    filter: { tableId: "1" }
    pagination: { limit: $limit }
  ) {
    nodes {
      id
      content
      attributes { attribute { identifier } value }
    }
    totalCount
  }
}
```

#### Update (수정)

```graphql
mutation UpdateTaskStatus($nodeId: ID!, $status: String!) {
  setNodeAttributesByIdentifier(input: {
    nodeId: $nodeId
    attributes: [{ identifier: "status", value: $status }]
  }) {
    success
    node { id content attributes { attribute { identifier } value } }
    errors { message }
  }
}
```

#### Delete (삭제)

```graphql
mutation DeleteTask($nodeId: ID!) {
  deleteNode(id: $nodeId) {
    success
    errors { message }
  }
}
```

### 2. 검색 템플릿 패턴

#### 속성 기반 검색 (identifier 사용)

```graphql
query SearchByStatus($status: String!) {
  searchNodes(
    filter: {
      tableId: "1"
      attributeFilters: [{ identifier: "status", value: $status }]
    }
  ) {
    nodes { id content }
    totalCount
  }
}
```

**장점:**
- 변수 바인딩 가능 (`$status`)
- 속성 이름(identifier)으로 직접 필터링
- attributeId(숫자) 불필요

#### 다중 조건 검색

```graphql
query SearchByMultipleConditions($status: String!, $priority: String!) {
  searchNodes(
    filter: {
      tableId: "1"
      attributeFilters: [
        { identifier: "status", value: $status }
        { identifier: "priority", value: $priority }
      ]
    }
  ) {
    nodes { id content }
    totalCount
  }
}
```

#### 쿼리 문자열 검색 (고급)

```graphql
query AdvancedSearch($query: String!) {
  searchNodes(
    filter: {
      tableId: "1"
      query: $query  # 예: "status:pending AND priority:high"
    }
  ) {
    nodes { id content }
    totalCount
  }
}
```

### 3. 집계/분석 템플릿

```graphql
query TaskStatistics {
  pending: searchNodes(filter: { tableId: "1", attributeFilters: [{ identifier: "status", value: "pending" }] }) { totalCount }
  inProgress: searchNodes(filter: { tableId: "1", attributeFilters: [{ identifier: "status", value: "in_progress" }] }) { totalCount }
  completed: searchNodes(filter: { tableId: "1", attributeFilters: [{ identifier: "status", value: "completed" }] }) { totalCount }
}
```

---

## MCP 도구 설명(Description) 작성

### MCP tools/list 노출 구조

템플릿이 MCP 도구로 변환될 때, 다음 필드가 사용됩니다:

```
┌─────────────────────────────────────────────────────────────┐
│  Template                    →    MCP Tool                  │
├─────────────────────────────────────────────────────────────┤
│  identifier                  →    name                      │
│  description                 →    description               │
│  parameters / inputSchema    →    inputSchema               │
└─────────────────────────────────────────────────────────────┘
```

**실제 MCP tools/list 응답 예시:**
```json
{
  "name": "search-tasks-by-status",
  "description": "상태별 태스크 검색. status 변수에 pending, in_progress, completed 등을 전달합니다. (Table: workflow_tasks)",
  "inputSchema": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

### Description 작성 가이드

**중요**: `description` 필드가 Claude AI에게 도구의 용도를 설명하는 핵심 정보입니다.

#### 좋은 Description 작성 규칙

1. **첫 문장에 핵심 기능 명시**
   ```
   ✅ "상태별 태스크 검색. status 변수에 pending, in_progress, completed 등을 전달합니다."
   ❌ "태스크를 검색하는 템플릿입니다."
   ```

2. **필수 변수와 허용값 명시**
   ```
   ✅ "새 태스크 생성. content(필수), status(필수: pending/in_progress/completed), purpose(선택) 전달"
   ❌ "태스크를 생성합니다."
   ```

3. **반환 결과 설명 (선택)**
   ```
   ✅ "모든 태스크 목록 조회. 상태, 목적, 프로젝트 경로 포함. 최신순 정렬."
   ```

4. **한글/영어 혼용 가능**
   ```
   ✅ "ID로 특정 태스크 조회. nodeId 변수 필수."
   ✅ "Get task by ID. Requires nodeId variable."
   ```

#### Description 템플릿

```yaml
CRUD 작업:
  create: "{엔티티} 생성. {필수변수}(필수), {선택변수}(선택) 전달"
  read:   "{조건}으로 {엔티티} 조회. {변수} 필수"
  update: "{엔티티}의 {속성} 변경. {변수들} 전달"
  delete: "{엔티티} 삭제. {ID변수} 필수"

검색 작업:
  filter: "{조건}별 {엔티티} 검색. {변수}에 {허용값들}을 전달"
  list:   "모든 {엔티티} 목록 조회. {포함정보} 포함"
```

### 템플릿 생성 시 Description 설정

#### GraphQL로 직접 생성

```graphql
mutation CreateTemplate {
  createQueryTemplate(input: {
    identifier: "search-by-priority"
    name: "SearchByPriority"
    description: "우선순위별 태스크 검색. priority 변수에 low, medium, high 중 하나를 전달합니다."
    query: "query SearchByPriority($priority: String!) { ... }"
    tags: ["table:workflow_tasks"]
  }) {
    success
    template { id identifier description }
  }
}
```

#### MCP 도구로 생성 (create-table-{tableId}-template)

```json
{
  "identifier": "search-by-priority",
  "name": "SearchByPriority",
  "description": "우선순위별 태스크 검색. priority 변수에 low, medium, high 중 하나를 전달합니다.",
  "query": "query SearchByPriority($priority: String!) { ... }",
  "additionalTags": ["search", "priority"]
}
```

#### Claude에게 요청

```
"workflow_tasks 테이블에 우선순위별 검색 템플릿을 만들어줘.
 description에 'priority 변수에 low/medium/high를 전달'이라고 명시해줘"
```

### inputSchema 작성 (고급)

MCP는 **JSON Schema Draft-07**을 사용합니다. 템플릿에 `inputSchema`를 직접 정의하면 MCP 도구의 파라미터 검증에 사용됩니다.

#### MCP inputSchema 필수 규칙

```json
{
  "type": "object",           // 필수: 반드시 "object"
  "properties": {             // 파라미터 정의
    "status": {
      "type": "string",
      "description": "태스크 상태 (pending/in_progress/completed)"
    },
    "limit": {
      "type": "number",
      "description": "최대 결과 수",
      "default": 50
    }
  },
  "required": ["status"]      // 필수 파라미터 목록
}
```

#### 지원되는 타입

| type | 설명 | 예시 |
|------|------|------|
| `string` | 문자열 | `"pending"` |
| `number` | 숫자 (정수/실수) | `50`, `3.14` |
| `integer` | 정수만 | `10` |
| `boolean` | 참/거짓 | `true` |
| `array` | 배열 | `["a", "b"]` |
| `object` | 객체 | `{"key": "value"}` |

#### 속성별 옵션

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "사용자 이름",
      "minLength": 1,
      "maxLength": 100
    },
    "age": {
      "type": "integer",
      "description": "나이",
      "minimum": 0,
      "maximum": 150
    },
    "status": {
      "type": "string",
      "description": "상태",
      "enum": ["pending", "in_progress", "completed"]
    },
    "tags": {
      "type": "array",
      "description": "태그 목록",
      "items": { "type": "string" }
    }
  },
  "required": ["name", "status"]
}
```

#### 템플릿에 inputSchema 적용

```graphql
mutation CreateTemplateWithSchema {
  createQueryTemplate(input: {
    identifier: "search-with-validation"
    name: "SearchWithValidation"
    description: "검증된 파라미터로 검색"
    query: "query Search($status: String!, $limit: Int) { ... }"
    tags: ["table:workflow_tasks"]
    inputSchema: {
      type: "object"
      properties: {
        status: {
          type: "string"
          description: "태스크 상태"
          enum: ["pending", "in_progress", "completed"]
        }
        limit: {
          type: "integer"
          description: "최대 결과 수"
          default: 50
          minimum: 1
          maximum: 1000
        }
      }
      required: ["status"]
    }
  }) {
    success
  }
}
```

#### 현재 검증 수준

시스템은 `SchemaMapper.validateJsonSchema()`로 기본 검증을 수행합니다:

| 검증 항목 | 상태 |
|----------|------|
| `type` 필드 존재 | ✅ |
| `type` 값 유효성 | ✅ |
| `properties` 구조 | ✅ |
| `required` 배열 | ✅ |
| 중첩 스키마 재귀 검증 | ✅ |

**참고**: inputSchema가 없거나 유효하지 않으면 빈 스키마 `{ type: "object", properties: {}, required: [] }`가 사용됩니다.

#### inputSchema 검증 API

템플릿 생성 전에 inputSchema가 MCP 호환인지 검증할 수 있습니다:

```graphql
query ValidateMySchema {
  validateInputSchema(input: {
    schema: {
      type: "object"
      properties: {
        status: {
          type: "string"
          description: "태스크 상태"
          enum: ["pending", "in_progress", "completed"]
        }
        limit: {
          type: "number"
          minimum: 1
          maximum: 1000
        }
      }
      required: ["status"]
    }
  }) {
    success
    validation {
      valid
      errors { path message expected }
      warnings { path message }
      formattedResult
    }
  }
}
```

**성공 응답 예시:**
```json
{
  "success": true,
  "validation": {
    "valid": true,
    "errors": [],
    "warnings": [],
    "formattedResult": "✅ Schema is valid for MCP"
  }
}
```

**실패 응답 예시:**
```json
{
  "success": false,
  "validation": {
    "valid": false,
    "errors": [
      {
        "path": "$.type",
        "message": "MCP inputSchema must have type \"object\" at root level",
        "expected": "object"
      }
    ],
    "warnings": [
      {
        "path": "$.properties.count.description",
        "message": "Property should have a description for better AI understanding"
      }
    ],
    "formattedResult": "❌ Schema validation failed\n\nErrors:\n  • $.type: ..."
  }
}
```

**검증 항목:**

| 검증 유형 | 설명 | 심각도 |
|----------|------|--------|
| Root type: object | MCP는 최상위 type이 "object"여야 함 | Error |
| Valid property types | string, number, integer, boolean, array, object, null | Error |
| minimum ≤ maximum | 숫자 범위 유효성 | Error |
| minLength ≤ maxLength | 문자열 길이 범위 유효성 | Error |
| Valid regex pattern | 정규식 유효성 | Error |
| required fields exist | required 필드가 properties에 존재 | Warning |
| Property description | AI 이해를 위한 설명 권장 | Warning |

#### MCP 스펙 참조

- [MCP Specification 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [JSON Schema Draft-07](http://json-schema.org/draft-07/schema#)

---

### Description 수정

기존 템플릿의 description을 수정하려면:

```graphql
mutation UpdateTemplateDescription {
  updateTemplate(
    identifier: "search-by-status"
    input: {
      description: "상태별 태스크 검색. status 변수에 pending, in_progress, completed, cancelled 중 하나를 전달합니다. 결과는 생성일 역순 정렬."
    }
  ) {
    success
    template { id description }
  }
}
```

또는 MCP 도구 사용:
```
update-table-workflow_tasks-template
  templateId: "13"
  description: "새로운 설명..."
```

---

## 템플릿 태그 시스템

### 자동 MCP 노출 규칙

템플릿이 테이블별 MCP에 노출되려면 `table:{tableIdentifier}` 태그가 필요합니다.

```
템플릿 태그: ["table:workflow_tasks", "crud"]
     ↓
MCP 엔드포인트: /sub/workflow_tasks/mcp
     ↓
도구로 자동 노출
```

### 태그 네이밍 컨벤션

| 태그 패턴 | 용도 | 예시 |
|----------|------|------|
| `table:{identifier}` | 테이블별 MCP 노출 | `table:workflow_tasks` |
| `crud` | CRUD 작업 표시 | `crud` |
| `search` | 검색 관련 | `search` |
| `report` | 리포팅/분석 | `report` |
| `admin` | 관리 작업 | `admin` |

### 예시: 완전한 태그 세트

```json
{
  "identifier": "search-tasks-by-status",
  "tags": [
    "table:workflow_tasks",  // MCP 노출 필수
    "search",                // 검색 유형
    "status-filter"          // 세부 분류
  ]
}
```

---

## MCP 서버 등록 방법

### Claude Code CLI (권장)

```bash
# 테이블 identifier로 등록 (권장)
claude mcp add --transport http workflow-tasks http://localhost:4141/sub/workflow_tasks/mcp

# 테이블 ID로 등록
claude mcp add --transport http workflow-tasks http://localhost:4141/sub/1/mcp

# 등록 확인
claude mcp list

# 상세 정보
claude mcp get workflow-tasks
```

### mcpCommand 자동 생성

테이블 조회 시 `mcpCommand` 필드로 등록 명령어를 자동 생성할 수 있습니다:

```graphql
query {
  tableByIdentifier(identifier: "workflow_tasks") {
    id
    identifier
    mcpCommand  # 자동 생성된 claude mcp add 명령어
  }
}
```

**응답:**
```json
{
  "data": {
    "tableByIdentifier": {
      "id": "1",
      "identifier": "workflow_tasks",
      "mcpCommand": "claude mcp add --transport http workflow-tasks http://localhost:4141/sub/workflow_tasks/mcp"
    }
  }
}
```

### Claude Desktop 설정

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "workflow-tasks": {
      "type": "http",
      "url": "http://localhost:4141/sub/workflow_tasks/mcp",
      "description": "워크플로우 태스크 관리"
    }
  }
}
```

---

## 템플릿 관리

### 템플릿 생성 (전역 MCP)

```bash
# graph-root MCP 도구 사용
claude mcp add --transport http graph-root http://localhost:4141/mcp
```

**Claude에게 요청:**
```
"workflow_tasks 테이블에 우선순위별 검색 템플릿을 만들어줘"
```

### 템플릿 수정

```graphql
mutation UpdateTemplate {
  updateTemplate(
    identifier: "search-by-status"
    input: {
      description: "상태별 태스크 검색 (pending/in_progress/completed)"
      query: "..."
    }
  ) {
    success
    template { id identifier }
  }
}
```

### 템플릿 삭제

```graphql
mutation DeleteTemplate {
  deleteTemplate(identifier: "old-template") {
    success
  }
}
```

---

## 실전 워크플로우

### 새 도메인 추가 시나리오

**요구사항**: 고객 피드백 관리 시스템 구축

#### 1단계: 도메인 분석 및 테이블 설계

```yaml
테이블: customer_feedback
속성:
  - customer_name (문자열)
  - feedback_type (문자열: bug/feature/question)
  - status (문자열: new/in_review/resolved)
  - priority (문자열: low/medium/high)
```

#### 2단계: 테이블 및 속성 생성

```bash
# 테이블 생성
curl -X POST http://localhost:4141/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { createTable(input: { identifier: \"customer_feedback\", description: \"고객 피드백 관리\" }) { success table { id } } }"
  }'

# 속성 생성 (tableId 사용)
# customer_name, feedback_type, status, priority 속성 추가
```

#### 3단계: 필수 템플릿 생성

```yaml
템플릿 목록:
  - create-feedback: 피드백 생성
  - list-feedback: 전체 목록
  - search-by-type: 유형별 검색
  - search-by-status: 상태별 검색
  - update-status: 상태 변경
  - get-statistics: 통계 조회
```

#### 4단계: MCP 등록 및 테스트

```bash
# MCP 서버 등록
claude mcp add --transport http customer-feedback http://localhost:4141/sub/customer_feedback/mcp

# Claude에서 테스트
"새로운 버그 피드백을 등록해줘. 고객명: 홍길동, 우선순위: high"
"new 상태의 모든 피드백을 보여줘"
"피드백 ID 5의 상태를 resolved로 변경해줘"
```

---

## 템플릿 변수 바인딩 가이드

### 지원되는 변수 타입

| GraphQL 타입 | 설명 | 예시 |
|-------------|------|------|
| `String!` | 필수 문자열 | `$status: String!` |
| `String` | 선택 문자열 | `$note: String` |
| `Int` | 정수 | `$limit: Int = 50` |
| `ID!` | 필수 ID | `$nodeId: ID!` |
| `Boolean` | 참/거짓 | `$includeArchived: Boolean = false` |

### 변수 기본값 설정

```graphql
query ListTasks(
  $limit: Int = 50,           # 기본값 50
  $status: String = "pending" # 기본값 pending
) {
  searchNodes(
    filter: {
      tableId: "1"
      attributeFilters: [{ identifier: "status", value: $status }]
    }
    pagination: { limit: $limit }
  ) {
    nodes { id content }
  }
}
```

### attributeFilters에서 변수 사용

**권장 패턴:**
```graphql
query Search($status: String!) {
  searchNodes(
    filter: {
      tableId: "1"
      attributeFilters: [{ identifier: "status", value: $status }]
    }
  ) { ... }
}
```

**주의**: `attributeFilters` 배열 자체를 변수로 전달하는 것은 지원되지 않습니다.

---

## 문제 해결

### 템플릿이 MCP에 노출되지 않음

**원인**: `table:{identifier}` 태그 누락

**해결**:
```graphql
mutation {
  updateTemplate(
    identifier: "my-template"
    input: { tags: ["table:workflow_tasks"] }
  ) { success }
}
```

### 변수 바인딩 오류

**증상**: `Variable "$status" is not defined`

**원인**: 쿼리 정의에 변수 선언 누락

**해결**:
```graphql
# Before (오류)
query { searchNodes(filter: { attributeFilters: [{ value: $status }] }) { ... } }

# After (정상)
query Search($status: String!) { searchNodes(...) { ... } }
```

### identifier vs attributeId 혼동

**권장**: 항상 `identifier` 사용

```graphql
# 권장 (identifier 사용)
attributeFilters: [{ identifier: "status", value: "pending" }]

# 비권장 (attributeId 사용)
attributeFilters: [{ attributeId: "5", value: "pending" }]
```

---

## 베스트 프랙티스

### 1. 명확한 템플릿 네이밍

```yaml
좋은 예:
  - search-tasks-by-status
  - create-customer-feedback
  - update-order-status

나쁜 예:
  - query1
  - myTemplate
  - test
```

### 2. 상세한 description 작성

```json
{
  "identifier": "search-by-status",
  "description": "상태별 태스크 검색. status 변수에 pending, in_progress, completed 중 하나를 전달합니다. 결과는 최신순으로 정렬됩니다."
}
```

### 3. 일관된 태그 사용

```yaml
CRUD 템플릿:
  - ["table:workflow_tasks", "crud", "create"]
  - ["table:workflow_tasks", "crud", "read"]
  - ["table:workflow_tasks", "crud", "update"]
  - ["table:workflow_tasks", "crud", "delete"]

검색 템플릿:
  - ["table:workflow_tasks", "search", "by-status"]
  - ["table:workflow_tasks", "search", "by-priority"]
```

### 4. 에러 처리 포함

```graphql
mutation CreateTask(...) {
  createNodeWithAttributes(input: { ... }) {
    success
    node { id }
    errors { message field }  # 에러 정보 포함
  }
}
```

---

## 다음 단계

- **[MCP 설정 가이드](./MCP_SETUP_GUIDE.md)** - MCP 기본 설정
- **[템플릿 시스템 가이드](../templates/template-system-guide.md)** - 고급 템플릿 기능
- **[API 레퍼런스](../api/doc-api-reference.md)** - 전체 GraphQL 스키마

---

**문서 버전**: 1.0.0
**최종 업데이트**: 2025-11-26

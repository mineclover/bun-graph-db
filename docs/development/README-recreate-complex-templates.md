# Template Recreation Script

## 개요

`recreate-complex-templates.ts`는 GraphQL 스키마 변경으로 인해 재생성이 필요한 복잡한 템플릿들을 자동으로 업데이트하는 스크립트입니다.

## 기능

### 주요 기능
- 기존 템플릿 자동 백업
- 새로운 GraphQL 스키마 구조에 맞춘 쿼리 재생성
- 변수 스키마 및 기본값 자동 업데이트
- 사용 통계 보존
- GraphQL 쿼리 유효성 검증
- 상세한 작업 보고서 생성

### 대상 템플릿
- **Template 815** (`create-todo`): Todo 생성 템플릿
- **Template 816** (`update-todo`): Todo 업데이트 템플릿

## 스키마 변경 사항

### 변경 전 (구버전)
```graphql
# create-todo (815)
mutation CreateTodo($title: String!, $description: String, ...) {
  createNode(
    tableId: "58"
    content: $title
    attributes: [
      { name: "title", value: $title }
      # ...
    ]
  ) { ... }
}

# update-todo (816)
mutation UpdateTodo($todoId: ID!, $title: String, ...) {
  updateNode(
    id: $todoId
    content: $title
    attributes: [
      { name: "title", value: $title }
      # ...
    ]
  ) { ... }
}
```

### 변경 후 (신버전)
```graphql
# create-todo (815)
mutation CreateTodo($input: CreateNodeInput!) {
  createNode(input: $input) {
    success
    node {
      id
      content
      createdAt
      updatedAt
      attributes {
        id
        value
        attribute { id name type }
      }
    }
    errors { message field }
  }
}

# update-todo (816)
mutation UpdateTodo($id: ID!, $input: UpdateNodeInput!) {
  updateNode(id: $id, input: $input) {
    success
    node {
      id
      content
      createdAt
      updatedAt
      attributes {
        id
        value
        attribute { id name type }
      }
    }
    errors { message field }
  }
}
```

## 사용법

```bash
# 스크립트 실행
bun run scripts/recreate-complex-templates.ts

# 또는
./scripts/recreate-complex-templates.ts
```

## 실행 과정

1. **백업 생성** - 기존 템플릿을 `./backups/template-backup.json`에 백업
2. **구조 생성** - 새로운 GraphQL 스키마에 맞는 쿼리 구조 생성
3. **검증** - 새로운 쿼리의 구문 및 구조 유효성 검증
4. **업데이트** - 데이터베이스의 템플릿 정보 업데이트
5. **확인** - 업데이트 결과 검증
6. **보고서** - 작업 결과를 `./reports/template-recreation-report.json`에 저장

## 변경된 데이터 구조

### 변수 스키마 예시 (create-todo)
```json
{
  "type": "object",
  "properties": {
    "input": {
      "type": "object",
      "properties": {
        "content": {
          "type": "string",
          "description": "Todo title/content"
        },
        "tableId": {
          "type": "string",
          "description": "Table ID for todos (default: 58)",
          "default": "58"
        },
        "attributes": {
          "type": "array",
          "description": "Todo attributes",
          "items": {
            "type": "object",
            "properties": {
              "attributeId": { "type": "string" },
              "value": { "type": "string" }
            },
            "required": ["attributeId", "value"]
          }
        }
      },
      "required": ["content", "tableId"]
    }
  },
  "required": ["input"]
}
```

### 기본 변수 값 예시 (create-todo)
```json
{
  "input": {
    "content": "New Todo Item",
    "tableId": "58",
    "attributes": [
      { "attributeId": "title_attr_id", "value": "New Todo Item" },
      { "attributeId": "description_attr_id", "value": "Todo description" },
      { "attributeId": "status_attr_id", "value": "TODO" },
      { "attributeId": "priority_attr_id", "value": "MEDIUM" },
      { "attributeId": "category_attr_id", "value": "PERSONAL" }
    ]
  }
}
```

## 보존되는 정보

- 템플릿 ID 및 식별자
- 사용 통계 (`usage_count`, `last_used_at`, `avg_execution_time_ms`)
- 태그 및 메타데이터
- 적용 가능한 테이블 정보

## 안전 기능

- **자동 백업**: 모든 기존 데이터를 변경 전에 백업
- **롤백 지원**: 실패 시 자동으로 백업에서 복원
- **검증**: 업데이트 전 쿼리 구조 및 구문 검증
- **버전 관리**: 템플릿 버전을 자동으로 증가 (1.0.0 → 1.1.0)

## 생성되는 파일

- `./backups/template-backup.json` - 원본 템플릿 백업
- `./reports/template-recreation-report.json` - 작업 결과 보고서

## 결과 확인

```bash
# 업데이트된 템플릿 확인
sqlite3 ./data/bun-graph-db.sqlite "
  SELECT id, name, version, updated_at
  FROM templates
  WHERE id IN (815, 816);
"

# 새로운 쿼리 구조 확인
sqlite3 ./data/bun-graph-db.sqlite "
  SELECT id, query_text
  FROM templates
  WHERE id = 815;
"
```

## 주의사항

- 스크립트 실행 전 데이터베이스 백업 권장
- GraphQL 서버가 실행 중이지 않아도 스크립트는 정상 동작
- 템플릿 ID 815, 816이 존재하지 않으면 오류 발생
- 백업 및 보고서 디렉토리가 자동 생성됨

## 문제 해결

### 스크립트 실행 실패 시
1. 백업 파일에서 자동 복원됨
2. `./backups/template-backup.json`에서 수동 복원 가능

### 권한 오류 시
```bash
chmod +x scripts/recreate-complex-templates.ts
```

### 데이터베이스 연결 오류 시
- 데이터베이스 파일 경로 확인: `./data/bun-graph-db.sqlite`
- 파일 권한 및 존재 여부 확인
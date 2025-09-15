# Todo Templates 완전 가이드

할일 관리 시스템을 위한 종합적인 GraphQL 템플릿 모음입니다.

## 📋 템플릿 개요

총 **12개의 활성 템플릿**으로 구성되어 있습니다:
- **CRUD 템플릿**: 6개 (기본 할일 관리)
- **Bulk 작업 템플릿**: 6개 (대량 처리 및 분석)

## 🏗️ 도메인 구조

### Todo 테이블 (ID: 58)
- **식별자**: `todos`
- **설명**: 할일 관리를 위한 테이블
- **노드 수**: 동적

### 속성 구조 (8개)
| ID | 이름 | 타입 | 설명 |
|----|------|------|------|
| 8 | title | text | 할일 제목 |
| 9 | description | text | 할일 상세 설명 |
| 10 | status | todo_status | 할일 상태 |
| 11 | priority | todo_priority | 할일 우선순위 |
| 12 | category | todo_category | 할일 카테고리 |
| 13 | due_date | date | 마감일 |
| 14 | created_at | datetime | 생성일 |
| 15 | completed_at | datetime | 완료일 |

### 커스텀 속성 타입
- **todo_status**: `TODO`, `IN_PROGRESS`, `DONE`, `CANCELLED`
- **todo_priority**: `LOW`, `MEDIUM`, `HIGH`, `URGENT`
- **todo_category**: `WORK`, `PERSONAL`, `SHOPPING`, `HEALTH`, `LEARNING`, `OTHER`

---

## 📝 CRUD 템플릿 (6개)

### 1. create-todo
**목적**: 새로운 할일 생성
**타입**: Mutation
**우선순위**: High

**변수**:
```json
{
  "title": "할일 제목",
  "description": "할일 설명",
  "status": "TODO",
  "priority": "MEDIUM",
  "category": "PERSONAL",
  "dueDate": "2024-12-31"
}
```

**사용 예시**:
```graphql
mutation {
  executeTemplate(
    identifier: "create-todo"
    variables: {
      title: "프로젝트 문서 작성"
      description: "API 문서화 작업"
      status: "TODO"
      priority: "HIGH"
      category: "WORK"
      dueDate: "2024-12-25"
    }
  ) {
    success
    result
  }
}
```

### 2. get-todo
**목적**: 특정 할일 조회
**타입**: Query
**우선순위**: High

**변수**:
```json
{
  "todoId": "할일_ID"
}
```

**사용 예시**:
```graphql
query {
  executeTemplate(
    identifier: "get-todo"
    variables: { todoId: "123" }
  ) {
    success
    result
  }
}
```

### 3. update-todo
**목적**: 할일 정보 업데이트
**타입**: Mutation
**우선순위**: High

**변수**:
```json
{
  "todoId": "할일_ID",
  "title": "수정된 제목",
  "description": "수정된 설명",
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "category": "WORK",
  "dueDate": "2024-12-31",
  "completedAt": "2024-12-20T10:00:00Z"
}
```

### 4. delete-todo
**목적**: 할일 삭제
**타입**: Mutation
**우선순위**: Medium

**변수**:
```json
{
  "todoId": "할일_ID"
}
```

### 5. list-todos
**목적**: 할일 목록 조회 (필터링, 페이징 지원)
**타입**: Query
**우선순위**: High

**변수**:
```json
{
  "limit": 20,
  "offset": 0,
  "status": "TODO"
}
```

**기능**:
- 페이징 지원 (limit/offset)
- 상태별 필터링
- 총 개수 및 다음 페이지 여부 제공

### 6. search-todos
**목적**: 할일 검색 (텍스트 + 속성 필터)
**타입**: Query
**우선순위**: Medium

**변수**:
```json
{
  "searchTerm": "검색어",
  "category": "WORK",
  "priority": "HIGH",
  "status": "TODO"
}
```

**기능**:
- 전문 검색 (제목, 설명)
- 다중 속성 필터링
- 관련성 점수 제공

---

## 📦 Bulk 작업 템플릿 (6개)

### 1. bulk-import-todos
**목적**: JSON 형태 할일 대량 가져오기
**타입**: Mutation
**우선순위**: High

**변수**:
```json
{
  "todos": [
    {
      "content": "할일 제목",
      "attributes": [
        { "name": "title", "value": "할일 제목" },
        { "name": "description", "value": "할일 설명" },
        { "name": "status", "value": "TODO" },
        { "name": "priority", "value": "MEDIUM" },
        { "name": "category", "value": "WORK" }
      ]
    }
  ]
}
```

**응답 정보**:
- 생성된 개수 (`createdCount`)
- 총 처리 개수 (`totalCount`)
- 에러 정보 (`errors`)
- 생성된 노드 정보 (`nodes`)

### 2. export-todos
**목적**: 할일 목록 내보내기 (필터링, 메타데이터 포함)
**타입**: Query
**우선순위**: High

**변수**:
```json
{
  "status": "DONE",
  "category": "WORK",
  "priority": "HIGH",
  "includeCompleted": true
}
```

**응답 구조**:
```json
{
  "data": [/* 할일 데이터 */],
  "metadata": {
    "exportedAt": "2024-12-20T10:00:00Z",
    "totalCount": 150,
    "filters": {/* 적용된 필터 */}
  },
  "summary": {
    "byStatus": [/* 상태별 통계 */],
    "byCategory": [/* 카테고리별 통계 */],
    "byPriority": [/* 우선순위별 통계 */]
  }
}
```

### 3. bulk-update-todo-status
**목적**: 여러 할일의 상태를 한번에 업데이트
**타입**: Mutation
**우선순위**: Medium

**변수**:
```json
{
  "todoIds": ["id1", "id2", "id3"],
  "newStatus": "DONE",
  "completedAt": "2024-12-20T10:00:00Z"
}
```

### 4. bulk-complete-todos
**목적**: 여러 할일을 한번에 완료 처리
**타입**: Mutation
**우선순위**: Medium

**변수**:
```json
{
  "todoIds": ["id1", "id2", "id3"]
}
```

**기능**:
- 상태를 `DONE`으로 변경
- 완료 시간 자동 설정
- 완료 요약 정보 제공

### 5. archive-completed-todos
**목적**: 완료된 할일들을 아카이브
**타입**: Mutation
**우선순위**: Low

**변수**:
```json
{
  "olderThanDays": 30
}
```

**기능**:
- 지정된 일수보다 오래된 완료 할일 아카이브
- 백업 생성 옵션
- 아카이브 위치 정보 제공

### 6. todo-statistics
**목적**: 할일 통계 및 분석 정보
**타입**: Query
**우선순위**: Medium

**변수**:
```json
{
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "includeArchived": false
}
```

**제공 통계**:
- **상태별 분석**: TODO, IN_PROGRESS, DONE, CANCELLED 개수
- **우선순위별 분석**: LOW, MEDIUM, HIGH, URGENT 개수
- **카테고리별 분석**: WORK, PERSONAL 등 개수
- **시간 분석**: 지연된 할일, 오늘 마감, 향후 할일
- **생산성 분석**: 일/주/월별 완료율, 완료 추세

---

## 🚀 사용 시나리오

### 시나리오 1: 기본 할일 관리
```graphql
# 1. 할일 생성
mutation { executeTemplate(identifier: "create-todo", variables: {...}) }

# 2. 할일 목록 조회
query { executeTemplate(identifier: "list-todos", variables: {...}) }

# 3. 할일 업데이트
mutation { executeTemplate(identifier: "update-todo", variables: {...}) }

# 4. 할일 완료
mutation { executeTemplate(identifier: "update-todo", variables: {status: "DONE"}) }
```

### 시나리오 2: 대량 데이터 처리
```graphql
# 1. 할일 대량 가져오기
mutation { executeTemplate(identifier: "bulk-import-todos", variables: {...}) }

# 2. 상태 일괄 업데이트
mutation { executeTemplate(identifier: "bulk-update-todo-status", variables: {...}) }

# 3. 데이터 내보내기
query { executeTemplate(identifier: "export-todos", variables: {...}) }
```

### 시나리오 3: 분석 및 보고
```graphql
# 1. 통계 조회
query { executeTemplate(identifier: "todo-statistics", variables: {...}) }

# 2. 특정 조건 검색
query { executeTemplate(identifier: "search-todos", variables: {...}) }

# 3. 데이터 내보내기 (보고서용)
query { executeTemplate(identifier: "export-todos", variables: {...}) }
```

---

## 🔧 템플릿 실행 방법

### 직접 실행
```bash
# 템플릿 목록 확인
bun scripts/todo-templates.ts status

# 대량 작업 템플릿 확인
bun scripts/todo-bulk-operations.ts status

# 워크플로우 테스트
bun scripts/todo-workflow-test.ts summary
```

### GraphQL 실행
```graphql
mutation ExecuteTemplate {
  executeTemplate(
    identifier: "템플릿_식별자"
    variables: { /* 변수 객체 */ }
  ) {
    success
    result
    errors {
      message
    }
  }
}
```

---

## 📊 성능 및 모니터링

### 복잡도 점수
각 템플릿은 쿼리 복잡도에 따라 1-10점으로 평가됩니다:
- **단순 CRUD**: 2-4점
- **검색/필터링**: 4-6점
- **대량 작업**: 6-8점
- **통계/분석**: 8-10점

### 모니터링 권장사항
- 대량 작업 시 진행률 모니터링
- 통계 쿼리의 실행 시간 추적
- 메모리 사용량 모니터링 (대량 export 시)

---

## 🛡️ 보안 및 검증

### 데이터 검증
- 필수 필드 검증 (`title` 필수)
- 속성 값 제약 조건 확인
- 날짜 형식 검증

### 권한 관리
- 템플릿별 실행 권한 확인
- 대량 작업에 대한 특별 권한 필요
- 아카이브 작업 시 관리자 권한 필요

---

## 🔄 업데이트 및 확장

### 템플릿 수정
새로운 요구사항에 따라 템플릿을 확장할 수 있습니다:
- 새로운 속성 추가
- 필터 조건 확장
- 통계 항목 추가

### 버전 관리
- 템플릿 변경 시 버전 정보 업데이트
- 하위 호환성 유지
- 변경 이력 문서화

이 가이드를 통해 Todo 템플릿 시스템을 효율적으로 활용하여 강력한 할일 관리 솔루션을 구축할 수 있습니다.
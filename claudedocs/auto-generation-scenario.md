# 자동 템플릿 생성 시나리오 테스트

## 목표
테이블과 속성 생성 시 자동으로 GraphQL 템플릿이 생성되는지 검증

## 시나리오 단계

### 1단계: 시스템 초기화
- 개발 서버 시작
- 시스템 상태 확인
- 기존 테스트 데이터 정리

### 2단계: 새 테이블 생성
- 테이블 생성: `auto-test-table`
- 설명: "자동 생성 테스트용 테이블"

**예상 결과**: 5개의 자동 생성 템플릿이 생성되어야 함
- `auto-create-auto-test-table-node` (create)
- `auto-search-auto-test-table-nodes` (search)
- `auto-validate-auto-test-table-schema` (validation)
- `auto-workflow-auto-test-table` (workflow)
- 모든 템플릿에 `auto-generated` 태그 포함

### 3단계: 속성 추가
- 속성 1: `name` (string, required)
- 속성 2: `age` (number, optional)
- 속성 3: `email` (string, optional)

**예상 결과**: 각 속성마다 setter 템플릿 생성
- `auto-set-auto-test-table-name`
- `auto-set-auto-test-table-age`
- `auto-set-auto-test-table-email`
- 모든 템플릿에 `auto-generated` 태그 포함

### 4단계: 템플릿 검증
- 생성된 템플릿 목록 조회
- `auto-generated` 태그로 필터링
- 템플릿 내용 및 구조 확인

### 5단계: 기능 테스트
- 생성된 템플릿 실행 테스트
- 노드 생성 템플릿으로 데이터 생성
- 검색 템플릿으로 데이터 조회

## 검증 기준

### ✅ 성공 조건
1. 테이블 생성 시 5개 기본 템플릿 자동 생성
2. 속성 추가 시 각각에 대한 setter 템플릿 자동 생성
3. 모든 자동 생성 템플릿에 `auto-generated` 태그 포함
4. 생성된 템플릿이 올바른 GraphQL 구문으로 구성
5. 템플릿 실행 시 정상 작동

### ❌ 실패 조건
- 템플릿이 자동 생성되지 않음
- `auto-generated` 태그가 누락됨
- 템플릿 구문 오류
- 템플릿 실행 실패

## GraphQL 명령어

### 테이블 생성
```graphql
mutation CreateTable {
  createTable(input: {
    identifier: "auto-test-table"
    description: "자동 생성 테스트용 테이블"
  }) {
    table {
      id
      identifier
      description
    }
  }
}
```

### 속성 타입 조회 (필요시)
```graphql
query GetAttributeTypes {
  attributeTypes {
    nodes {
      id
      identifier
      jsonType
    }
  }
}
```

### 속성 생성
```graphql
mutation CreateAttribute($tableId: ID!, $attributeTypeId: ID!) {
  createAttribute(input: {
    tableId: $tableId
    identifier: "name"
    name: "이름"
    attributeTypeId: $attributeTypeId
    isRequired: true
  }) {
    attribute {
      id
      identifier
      name
    }
  }
}
```

### 템플릿 조회
```graphql
query SearchTemplates {
  searchTemplates(
    filter: {
      tags: ["auto-generated"]
    }
  ) {
    templates {
      identifier
      name
      tags
      query
    }
  }
}
```

## 실행 날짜
$(date)

## 참고 사항
- 개발 서버는 http://localhost:4141/graphql 에서 실행
- GraphQL Playground 사용 가능
- 모든 변경사항은 SQLite 데이터베이스에 영구 저장
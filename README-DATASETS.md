# Dataset-Based Testing Environment

이 문서는 재사용 가능한 테스트 환경 구성 시스템에 대해 설명합니다. 이 시스템을 통해 JSON 기반의 스키마, 데이터, 템플릿을 정의하고 쉽게 로드할 수 있습니다.

## 📁 디렉토리 구조

```
datasets/
├── schema/
│   └── base-schema.json          # 테이블 및 속성 정의
├── data/
│   └── sample-data.json          # 샘플 데이터
└── templates/
    └── comprehensive-templates.json # GraphQL 템플릿 컬렉션

scripts/
├── setup-test-environment.ts    # 환경 구성 스크립트
└── test-templates.ts            # 템플릿 테스트 스크립트
```

## 🚀 빠른 시작

### 1. 서버 시작
```bash
bun index.ts
```

### 2. 테스트 환경 구성
```bash
bun run scripts/setup-test-environment.ts
```

### 3. 템플릿 테스트 실행
```bash
# 전체 테스트
bun run scripts/test-templates.ts

# 특정 템플릿 테스트
bun run scripts/test-templates.ts health-check
```

## 📋 스키마 정의

`datasets/schema/base-schema.json`에서 테이블 구조를 정의합니다:

```json
{
  "version": "1.0",
  "tables": [
    {
      "identifier": "products",
      "name": "Products",
      "description": "Product catalog management",
      "attributes": [
        {
          "identifier": "name",
          "name": "Product Name",
          "dataType": "STRING",
          "isRequired": true
        }
      ]
    }
  ],
  "relationTypes": [
    {
      "identifier": "user-orders",
      "sourceTable": "users", 
      "targetTable": "orders"
    }
  ]
}
```

## 📦 샘플 데이터

`datasets/data/sample-data.json`에서 테스트 데이터를 정의합니다:

```json
{
  "nodes": {
    "products": [
      {
        "content": "MacBook Pro 16-inch M2",
        "attributes": {
          "name": "MacBook Pro 16-inch M2",
          "price": 2499.00,
          "category": "Laptops"
        }
      }
    ]
  },
  "relations": [
    {
      "sourceTable": "users",
      "sourceContent": "john_doe",
      "targetTable": "orders",
      "targetContent": "ORD-2025-001",
      "relationType": "user-orders"
    }
  ]
}
```

## 📑 템플릿 컬렉션

`datasets/templates/comprehensive-templates.json`에서 재사용 가능한 GraphQL 템플릿을 정의합니다:

```json
{
  "templates": [
    {
      "identifier": "health-check",
      "name": "System Health Check",
      "templateType": "QUERY",
      "tags": ["system", "health"],
      "queryText": "query HealthCheck { health { status timestamp } }",
      "variablesSchema": null,
      "complexityScore": 1
    },
    {
      "identifier": "create-node",
      "name": "Create Node",
      "templateType": "MUTATION", 
      "queryText": "mutation CreateNode($input: CreateNodeInput!) { createNode(input: $input) { id content } }",
      "variablesSchema": {
        "type": "object",
        "properties": {
          "input": {
            "type": "object",
            "properties": {
              "tableId": { "type": "string" },
              "content": { "type": "string" }
            },
            "required": ["tableId", "content"]
          }
        }
      }
    }
  ]
}
```

## 🎯 템플릿 시스템 특징

### 1. 변수 검증
템플릿은 JSON Schema를 사용한 변수 검증을 지원합니다:
- 필수 필드 검증
- 데이터 타입 검증
- 기본값 제공

### 2. 사용량 추적
각 템플릿의 실행 횟수가 자동으로 추적됩니다:
- 성공한 실행만 카운트
- 실행 실패 시 카운트하지 않음

### 3. 태그 기반 검색
템플릿을 태그로 분류하고 검색할 수 있습니다:
```bash
# 시스템 관련 템플릿 검색
searchTemplates(input: { tags: ["system"] })
```

### 4. 복잡도 점수
템플릿의 복잡도를 1-10점으로 평가하여 성능 최적화에 활용합니다.

## 🔧 사용 예제

### 기본 헬스체크
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation ExecuteTemplate($input: ExecuteTemplateInput!) { executeTemplate(input: $input) }",
    "variables": {
      "input": {
        "templateIdentifier": "health-check"
      }
    }
  }'
```

### 변수를 사용한 템플릿 실행
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation ExecuteTemplate($input: ExecuteTemplateInput!) { executeTemplate(input: $input) }",
    "variables": {
      "input": {
        "templateIdentifier": "create-table",
        "variables": {
          "input": {
            "identifier": "my-table",
            "name": "My Table",
            "description": "Created via template"
          }
        }
      }
    }
  }'
```

## 📊 모니터링

### 템플릿 사용량 확인
```graphql
query GetPopularTemplates {
  getPopularTemplates(limit: 10) {
    identifier
    name
    usageCount
    tags
  }
}
```

### 시스템 상태 확인
```graphql
query HealthCheck {
  health {
    status
    timestamp
    database
    version
  }
}
```

## 🧪 테스트 시나리오

테스트 스크립트는 다음 시나리오를 자동으로 실행합니다:

1. **변수 검증 테스트**: 필수 변수 누락 시 에러 발생 확인
2. **복합 워크플로우 테스트**: 테이블 생성 → 속성 추가 → 사용량 추적 확인
3. **기본 시나리오 테스트**: 각 템플릿 타입별 실행 테스트

## 🎨 확장 방법

### 새로운 테이블 타입 추가
1. `base-schema.json`에 테이블 정의 추가
2. `sample-data.json`에 샘플 데이터 추가
3. `comprehensive-templates.json`에 관련 템플릿 추가

### 새로운 템플릿 추가
1. 템플릿 JSON에 새 항목 추가
2. 필요한 경우 변수 스키마 정의
3. 복잡도 점수와 태그 설정

### 커스텀 데이터셋 생성
기존 구조를 복사하여 프로젝트별 데이터셋 생성 가능:
```bash
cp -r datasets datasets-custom
# JSON 파일들 수정
bun run scripts/setup-test-environment.ts
```

## 📈 성능 최적화

- 템플릿은 복잡도 점수에 따라 실행 전략 최적화
- 자주 사용되는 템플릿은 캐싱
- 배치 실행을 통한 성능 향상

이 시스템을 통해 GraphQL API의 모든 기능을 템플릿 기반으로 테스트하고 재사용할 수 있습니다.
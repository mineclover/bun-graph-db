# Attribute Domain - Curl-Driven Development Templates

**CURL_DRIVEN_DEVELOPMENT.md 방법론 적용**: 테이블 식별자/ID 기반 Attribute 조회 쿼리 템플릿 개발

## 🔄 CDD 개발 사이클 적용

### Template 1: 테이블 ID로 Attribute 조회

#### 1. Design (설계)
```javascript
const templateSpec = {
  name: "Get Table Attributes by ID",
  purpose: "테이블 ID를 변수로 받아 해당 테이블의 모든 속성 조회",
  inputs: ["tableId"],
  outputs: ["table info", "attributes", "attributeTypes"]
};
```

#### 2. Implement (템플릿 생성)
```graphql
# 템플릿 생성 - get-table-attributes-by-id
mutation CreateTableAttributeTemplate {
  createTemplate(input: {
    identifier: "get-table-attributes-by-id"
    name: "Get Table Attributes by ID"
    description: "테이블 ID를 기반으로 해당 테이블의 모든 속성 조회 (관계형 데이터 포함)"
    query: """
      query GetTableAttributesById($tableId: ID!) {
        table(id: $tableId) {
          id
          identifier
          name
          description
          attributeCount
          attributes {
            id
            identifier
            name
            description
            createdAt
            attributeType {
              id
              identifier
              name
              dataType
              constraints
              defaultValue
            }
          }
        }
      }
    """
    variables: {"tableId": "1"}
    tags: ["attribute", "table", "production"]
    operationType: "query"
    version: "1.0.0"
  }) {
    success
    template {
      id
      identifier
      name
    }
    errors {
      message
    }
  }
}
```

#### 3. Test (curl 검증)
```bash
# 템플릿 생성
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { createTemplate(input: { identifier: \"get-table-attributes-by-id\", name: \"Get Table Attributes by ID\", description: \"테이블 ID를 기반으로 해당 테이블의 모든 속성 조회\", query: \"query GetTableAttributesById($tableId: ID!) { table(id: $tableId) { id identifier name attributeCount attributes { id identifier name attributeType { dataType name } } } }\", variables: {\"tableId\": \"1\"}, tags: [\"attribute\", \"table\"], operationType: \"query\" }) { success template { id identifier } errors { message } } }"}'

# 템플릿 실행 테스트
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"get-table-attributes-by-id\", variables: {\"tableId\": \"1\"}) { success data errors { message } } }"}'
```

#### 4. Verify (결과 분석)
성공 시:
```json
{
  "data": {
    "executeTemplateWithGraphQL": {
      "success": true,
      "data": {
        "table": {
          "id": "1",
          "identifier": "users",
          "name": "Users Table",
          "attributeCount": 5,
          "attributes": [...]
        }
      }
    }
  }
}
```

---

### Template 2: 테이블 식별자로 Attribute 조회

#### 1. Design (설계)
```javascript
const templateSpec = {
  name: "Get Table Attributes by Identifier", 
  purpose: "테이블 식별자(문자열)를 변수로 받아 해당 테이블의 속성들 조회",
  inputs: ["tableIdentifier"],
  outputs: ["table info", "attributes with types", "metadata"]
};
```

#### 2. Implement (템플릿 생성)
```graphql
# 템플릿 생성 - get-table-attributes-by-identifier
mutation CreateTableAttributeByIdentifierTemplate {
  createTemplate(input: {
    identifier: "get-table-attributes-by-identifier"
    name: "Get Table Attributes by Identifier"
    description: "테이블 식별자를 기반으로 해당 테이블의 모든 속성 조회"
    query: """
      query GetTableAttributesByIdentifier($tableIdentifier: String!) {
        tables(filter: { identifier: $tableIdentifier }) {
          nodes {
            id
            identifier
            name
            description
            nodeCount
            attributeCount
            attributes {
              id
              identifier
              name
              description
              createdAt
              attributeType {
                id
                identifier
                name
                dataType
                constraints
                defaultValue
              }
            }
          }
        }
      }
    """
    variables: {"tableIdentifier": "users"}
    tags: ["attribute", "table", "identifier-based"]
    operationType: "query"
    version: "1.0.0"
  }) {
    success
    template {
      id
      identifier
    }
    errors {
      message
    }
  }
}
```

#### 3. Test (curl 검증)
```bash
# 템플릿 생성
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { createTemplate(input: { identifier: \"get-table-attributes-by-identifier\", name: \"Get Table Attributes by Identifier\", description: \"테이블 식별자를 기반으로 해당 테이블의 모든 속성 조회\", query: \"query GetTableAttributesByIdentifier($tableIdentifier: String!) { tables(filter: { identifier: $tableIdentifier }) { nodes { id identifier name attributeCount attributes { id identifier name attributeType { dataType name constraints } } } } }\", variables: {\"tableIdentifier\": \"users\"}, tags: [\"attribute\", \"identifier\"], operationType: \"query\" }) { success template { id identifier } errors { message } } }"}'

# 다양한 테이블로 테스트
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"get-table-attributes-by-identifier\", variables: {\"tableIdentifier\": \"products\"}) { success data } }"}'

curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"get-table-attributes-by-identifier\", variables: {\"tableIdentifier\": \"orders\"}) { success data } }"}'
```

---

### Template 3: 고급 속성 검색 (테이블 + 필터링)

#### 1. Design (설계)
```javascript
const templateSpec = {
  name: "Advanced Attribute Search",
  purpose: "테이블 식별자와 추가 필터링 옵션으로 속성 검색",
  inputs: ["tableIdentifier", "dataType", "search", "limit"],
  outputs: ["filtered attributes", "pagination info"]
};
```

#### 2. Implement (템플릿 생성)
```graphql
# 템플릿 생성 - search-attributes-with-table-filter
mutation CreateAdvancedAttributeSearchTemplate {
  createTemplate(input: {
    identifier: "search-attributes-with-table-filter"
    name: "Advanced Attribute Search with Table Filter"
    description: "테이블별 속성 검색 with 고급 필터링 (데이터타입, 텍스트 검색, 페이지네이션)"
    query: """
      query SearchAttributesWithTableFilter(
        $tableIdentifier: String!
        $dataType: String
        $search: String
        $limit: Int = 20
        $offset: Int = 0
      ) {
        # 테이블 정보 먼저 조회
        targetTable: tables(filter: { identifier: $tableIdentifier }) {
          nodes {
            id
            identifier
            name
            attributeCount
          }
        }
        
        # 해당 테이블의 속성들 조회 (테이블 ID 사용)
        attributes(
          filter: {
            search: $search
          }
          pagination: { limit: $limit, offset: $offset }
          sort: [{ field: "name", direction: "ASC" }]
        ) {
          nodes {
            id
            identifier
            name
            description
            attributeType {
              id
              name
              dataType
              constraints
            }
            table {
              id
              identifier
              name
            }
          }
          totalCount
          hasNextPage
        }
      }
    """
    variables: {
      "tableIdentifier": "users"
      "dataType": "String" 
      "search": ""
      "limit": 10
      "offset": 0
    }
    tags: ["attribute", "search", "advanced", "filtering"]
    operationType: "query"
    version: "1.0.0"
  }) {
    success
    template {
      id
      identifier
    }
    errors {
      message
    }
  }
}
```

#### 3. Test (curl 검증)
```bash
# 템플릿 생성
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { createTemplate(input: { identifier: \"search-attributes-with-table-filter\", name: \"Advanced Attribute Search\", description: \"테이블별 속성 검색 with 고급 필터링\", query: \"query SearchAttributesWithTableFilter($tableIdentifier: String!, $dataType: String, $search: String, $limit: Int = 20) { targetTable: tables(filter: { identifier: $tableIdentifier }) { nodes { id identifier name } } attributes(filter: { search: $search }, pagination: { limit: $limit }) { nodes { id name attributeType { dataType } table { identifier } } totalCount } }\", variables: {\"tableIdentifier\": \"users\", \"search\": \"\", \"limit\": 10}, tags: [\"attribute\", \"search\"], operationType: \"query\" }) { success template { id } errors { message } } }"}'

# 다양한 필터로 테스트
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"search-attributes-with-table-filter\", variables: {\"tableIdentifier\": \"users\", \"search\": \"email\", \"limit\": 5}) { success data } }"}'

curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"search-attributes-with-table-filter\", variables: {\"tableIdentifier\": \"products\", \"search\": \"name\", \"limit\": 10}) { success data } }"}'
```

---

### Template 4: 테이블 스키마 분석

#### 1. Design (설계)
```javascript
const templateSpec = {
  name: "Table Schema Analysis",
  purpose: "테이블의 전체 스키마 구조 분석 (속성 타입, 제약조건, 통계)",
  inputs: ["tableIdentifier"],
  outputs: ["schema info", "attribute statistics", "type distribution"]
};
```

#### 2. Implement (템플릿 생성)
```graphql
# 템플릿 생성 - analyze-table-schema-attributes
mutation CreateTableSchemaAnalysisTemplate {
  createTemplate(input: {
    identifier: "analyze-table-schema-attributes"
    name: "Table Schema Attribute Analysis"
    description: "테이블의 전체 스키마 구조 분석 (속성 타입, 제약조건, 통계 포함)"
    query: """
      query AnalyzeTableSchemaAttributes($tableIdentifier: String!) {
        # 테이블 기본 정보
        table: tables(filter: { identifier: $tableIdentifier }) {
          nodes {
            id
            identifier
            name
            description
            nodeCount
            attributeCount
            createdAt
            
            # 모든 속성 정보
            attributes {
              id
              identifier
              name
              description
              createdAt
              attributeType {
                id
                identifier
                name
                dataType
                constraints
                defaultValue
                createdAt
              }
            }
          }
        }
        
        # 전체 속성 타입 통계 (비교용)
        allAttributeTypes: attributeTypes(pagination: { limit: 100 }) {
          nodes {
            dataType
            name
          }
          totalCount
        }
      }
    """
    variables: {"tableIdentifier": "users"}
    tags: ["attribute", "schema", "analysis", "statistics"]
    operationType: "query"
    version: "1.0.0"
  }) {
    success
    template {
      id
      identifier
    }
    errors {
      message
    }
  }
}
```

#### 3. Test (curl 검증)
```bash
# 템플릿 생성
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { createTemplate(input: { identifier: \"analyze-table-schema-attributes\", name: \"Table Schema Analysis\", description: \"테이블 스키마 구조 분석\", query: \"query AnalyzeTableSchemaAttributes($tableIdentifier: String!) { table: tables(filter: { identifier: $tableIdentifier }) { nodes { id identifier name attributeCount attributes { id name attributeType { dataType constraints } } } } }\", variables: {\"tableIdentifier\": \"users\"}, tags: [\"schema\", \"analysis\"], operationType: \"query\" }) { success template { id } errors { message } } }"}'

# 다양한 테이블 분석
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"analyze-table-schema-attributes\", variables: {\"tableIdentifier\": \"users\"}) { success data } }"}'

curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"analyze-table-schema-attributes\", variables: {\"tableIdentifier\": \"products\"}) { success data } }"}'
```

---

## 🎯 CDD 검증 체크리스트

각 템플릿에 대해 다음을 확인:

### ✅ 즉시 검증 (< 30초)
- [ ] curl로 템플릿 생성 성공
- [ ] curl로 템플릿 실행 성공
- [ ] 예상된 데이터 구조 반환

### ✅ 실제 사용성 검증
- [ ] 다양한 테이블 식별자로 테스트
- [ ] 존재하지 않는 테이블 처리
- [ ] 에러 케이스 확인

### ✅ 문서화 자동화
- [ ] 성공한 curl 명령어들 저장
- [ ] 실행 가능한 예제 문서화
- [ ] 변수 스키마 검증

## 🚀 실행 가능한 curl 명령어 모음

### 헬스체크
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { __schema { queryType { name } } }"}'
```

### 기존 템플릿 확인
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { searchTemplates(filter: { tags: [\"attribute\"] }) { nodes { identifier name } } }"}'
```

### 테이블 목록 확인
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { tables(pagination: { limit: 10 }) { nodes { id identifier name } } }"}'
```

---

## 📝 템플릿 수정 및 개선 프로세스

1. **에러 발견**: curl 실행 결과 분석
2. **쿼리 수정**: GraphQL 쿼리 직접 수정
3. **템플릿 업데이트**: updateTemplateQuery 사용
4. **재검증**: curl로 즉시 테스트
5. **문서 업데이트**: 성공한 명령어 기록

이 과정을 통해 **실제로 작동하는 템플릿**만 문서화됩니다.
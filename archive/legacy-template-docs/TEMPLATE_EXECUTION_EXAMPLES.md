# Template Execution Examples

## 🚀 executeTemplateWithGraphQL Usage Guide

**Important**: executeTemplateWithGraphQL is only available in mutations, not queries, due to usage tracking side effects.

## 템플릿 실행 리졸버 사용 예시

### 1. executeTemplateWithGraphQL 기본 사용법

#### ✅ Correct Usage (Mutation)
```graphql
mutation ExecuteTemplateByIdentifier {
  executeTemplateWithGraphQL(
    templateIdentifier: "minimal-table-with-nodes"
    variables: {
      tableId: "1"
    }
  ) {
    success
    data
    errors { message }
  }
}
```

#### ❌ Incorrect Usage (Query - Not Available)
```graphql
# This will NOT work - executeTemplateWithGraphQL is mutation-only
query ExecuteTemplate {
  executeTemplateWithGraphQL(templateIdentifier: "template-id") # Error!
}
```

#### 실제 사용 패턴 (JSON Request)
```json
{
  "query": "mutation ExecuteTemplate { executeTemplateWithGraphQL(templateIdentifier: \"search-templates-advanced\") { success data errors { message } } }"
}
```

### 2. 변수 오버라이드

템플릿의 기본 변수값을 사용자 입력으로 오버라이드:

```graphql
mutation ExecuteWithCustomVariables {
  executeTemplateWithGraphQL(
    templateIdentifier: "search-templates-advanced"
    variables: {
      filter: { isActive: true }
      pagination: { limit: 5, offset: 0 }
      sort: [{ field: "name", direction: "ASC" }]
    }
  ) {
    success
    data
    errors { message }
  }
}
```

#### JSON Request Format
```json
{
  "query": "mutation ExecuteCustomSearch { executeTemplateWithGraphQL(templateIdentifier: \"search-templates-advanced\", variables: { pagination: { limit: 5, offset: 0 }, sort: [{ field: \"name\", direction: \"ASC\" }] }) { success data errors { message } } }"
}
```

### 3. 태그 기반 템플릿 검색 후 실행

#### Step 1: 태그로 템플릿 검색
```graphql
query FindTemplatesByTags {
  searchTemplates(input: {
    tags: ["nodes", "minimal", "efficient"]
    tagMatchMode: ANY
    isActive: true
    orderBy: USAGE_COUNT
    orderDirection: DESC
    limit: 5
  }) {
    id
    identifier
    name
    description
    tags
    usageCount
    variablesSchema
  }
}
```

#### Step 2: 선택한 템플릿 실행 (executeTemplateWithGraphQL)
```graphql
mutation ExecuteSelectedTemplate {
  executeTemplateWithGraphQL(
    templateIdentifier: "minimal-table-with-nodes"
    variables: {
      tableId: "3"
    }
  ) {
    success
    data
    errors { message }
  }
}
```

### 4. 테이블별 템플릿 필터링 후 실행

특정 테이블에 사용 가능한 템플릿만 조회:

```graphql
query GetTableSpecificTemplates {
  searchTemplates(input: {
    applicableToTable: "users"
    includeUniversal: true
    templateType: QUERY
    isActive: true
  }) {
    id
    identifier
    name
    applicableTables
    tags
  }
}
```

### 5. 복잡한 쿼리 템플릿 실행

#### 관계 포함 쿼리 템플릿
```graphql
# 템플릿 정의 (사전 저장)
mutation CreateRelationTemplate {
  createTemplate(input: {
    identifier: "nodes-with-relations"
    name: "Nodes with Relations"
    description: "노드와 관계 정보를 함께 조회"
    queryText: """
      query NodesWithRelations($tableId: ID!, $includeIncoming: Boolean = false) {
        nodes(tableId: $tableId) {
          nodes {
            id
            content
            attributes {
              value
              attribute { identifier }
            }
            outgoingRelations {
              targetNode {
                id
                content
              }
              relationType { identifier }
            }
            incomingRelations @include(if: $includeIncoming) {
              sourceNode {
                id
                content
              }
              relationType { identifier }
            }
          }
          totalCount
        }
      }
    """
    variablesSchema: {
      type: "object"
      properties: {
        tableId: {
          type: "string"
          description: "Table ID"
        }
        includeIncoming: {
          type: "boolean"
          description: "Include incoming relations"
          default: false
        }
      }
      required: ["tableId"]
    }
    defaultVariables: {
      includeIncoming: false
    }
    tags: ["nodes", "relations", "detailed"]
    templateType: QUERY
    complexityScore: 7
  }) {
    id
    identifier
  }
}
```

#### 실행 (executeTemplateWithGraphQL)
```graphql
mutation ExecuteRelationTemplate {
  executeTemplateWithGraphQL(
    templateIdentifier: "nodes-with-relations"
    variables: {
      tableId: "1",
      includeIncoming: true
    }
  ) {
    success
    data
    errors { message }
  }
}
```

### 6. 뮤테이션 템플릿 실행

```graphql
# 뮤테이션 템플릿 정의
mutation CreateNodeTemplate {
  createTemplate(input: {
    identifier: "create-node-with-attributes"
    name: "Create Node with Attributes"
    templateType: MUTATION
    queryText: """
      mutation CreateNode($tableId: ID!, $content: String!, $attributes: [AttributeInput!]) {
        createNode(input: {
          tableId: $tableId
          content: $content
          attributes: $attributes
        }) {
          id
          content
          attributes {
            value
            attribute { identifier }
          }
        }
      }
    """
    variablesSchema: {
      type: "object"
      properties: {
        tableId: { type: "string" }
        content: { type: "string" }
        attributes: {
          type: "array"
          items: {
            type: "object"
            properties: {
              attributeId: { type: "string" }
              value: { type: "string" }
            }
          }
        }
      }
      required: ["tableId", "content"]
    }
    tags: ["create", "node", "mutation"]
  }) {
    id
  }
}
```

#### 뮤테이션 실행 (executeTemplateWithGraphQL)
```graphql
mutation ExecuteCreateNode {
  executeTemplateWithGraphQL(
    templateIdentifier: "create-node-with-attributes"
    variables: {
      tableId: "1"
      content: "New Node Content"
      attributes: [
        { attributeId: "1", value: "value1" }
        { attributeId: "2", value: "value2" }
      ]
    }
  ) {
    success
    data
    errors { message }
  }
}
```

### 7. 인기 템플릿 조회 및 실행

```graphql
query GetAndExecutePopular {
  # 인기 템플릿 조회
  popularTemplates: getPopularTemplates(limit: 3) {
    id
    identifier
    name
    usageCount
    tags
  }
  
  # 가장 인기있는 템플릿 실행 (별도 mutation 필요)
}
}
```

### 8. 에러 처리

#### 템플릿을 찾을 수 없는 경우 (executeTemplateWithGraphQL)
```graphql
mutation ExecuteNonExistentTemplate {
  executeTemplateWithGraphQL(
    templateIdentifier: "non-existent-template"
    variables: {}
  ) {
    success
    data
    errors { message }
  }
}
# Result: { "success": false, "errors": [{ "message": "Template not found" }] }
```

#### 필수 변수 누락
```graphql
mutation ExecuteMissingVariables {
  executeTemplateWithGraphQL(
    templateIdentifier: "search-templates-advanced"
    variables: { invalidParam: "value" }
  ) {
    success
    data
    errors { message }
  }
}
# Result: { "success": false, "errors": [{ "message": "Invalid variables" }] }
```

#### 비활성 템플릿 실행 시도
```graphql
mutation ExecuteInactiveTemplate {
  executeTemplateWithGraphQL(
    templateIdentifier: "inactive-template"
    variables: {}
  ) {
    success
    data
    errors { message }
  }
}
# Result: { "success": false, "errors": [{ "message": "Template is inactive" }] }
```

## 🔄 executeTemplateWithGraphQL 실행 플로우

1. **Mutation 사용**: executeTemplateWithGraphQL은 mutation에서만 사용 가능
2. **템플릿 선택**: templateIdentifier로 템플릿 지정
3. **변수 제공**: 템플릿에 필요한 변수 전달 (JSON 형태)
4. **자동 검증**: 변수 스키마 자동 검증
5. **실행**: 실제 GraphQL 쿼리/뮤테이션 실행
6. **결과 반환**: { success, data, errors } 형태로 결과 반환
7. **사용량 추적**: 사용 횟수 자동 증가 및 실행 시간 기록

### 실제 사용 예시
```bash
# cURL로 테스트
curl -X POST -H "Content-Type: application/json" \
  -d @test-search-template-custom.json \
  http://localhost:4000/graphql
```

## 장점

1. **재사용성**: 자주 사용하는 쿼리를 템플릿으로 저장
2. **일관성**: 표준화된 쿼리로 일관된 결과 보장
3. **성능**: 복잡도 기반 최적화 및 캐싱 가능
4. **보안**: 변수 검증으로 악의적인 입력 방지
5. **추적**: 사용 통계로 인기 쿼리 파악
6. **유연성**: 변수로 동적 쿼리 생성
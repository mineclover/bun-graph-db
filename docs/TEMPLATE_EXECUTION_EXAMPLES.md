# Template Execution Examples

## 템플릿 실행 리졸버 사용 예시

### 1. 기본 템플릿 실행

#### 템플릿 ID로 실행
```graphql
query ExecuteByTemplateId {
  executeTemplate(input: {
    templateId: "1"
    variables: {
      tableId: "users_table"
    }
  })
}
```

#### 템플릿 Identifier로 실행
```graphql
query ExecuteByIdentifier {
  executeTemplate(input: {
    templateIdentifier: "minimal-table-with-nodes"
    variables: {
      tableId: "1"
    }
  })
}
```

### 2. 변수 오버라이드

템플릿의 기본 변수값을 사용자 입력으로 오버라이드:

```graphql
query ExecuteWithCustomVariables {
  executeTemplate(input: {
    templateIdentifier: "detailed-table-with-nodes"
    variables: {
      tableId: "2",
      limit: 50,
      includeRelations: true
    }
    trackUsage: true
    validateVariables: true
  })
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

#### Step 2: 선택한 템플릿 실행
```graphql
query ExecuteSelectedTemplate {
  executeTemplate(input: {
    templateIdentifier: "minimal-table-with-nodes"
    variables: {
      tableId: "3"
    }
  })
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

#### 실행
```graphql
query ExecuteRelationTemplate {
  executeTemplate(input: {
    templateIdentifier: "nodes-with-relations"
    variables: {
      tableId: "1",
      includeIncoming: true
    }
  })
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

#### 뮤테이션 실행
```graphql
mutation ExecuteCreateNode {
  executeTemplate(input: {
    templateIdentifier: "create-node-with-attributes"
    variables: {
      tableId: "1"
      content: "New Node Content"
      attributes: [
        { attributeId: "1", value: "value1" }
        { attributeId: "2", value: "value2" }
      ]
    }
  })
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
  
  # 가장 인기있는 템플릿 실행
  result: executeTemplate(input: {
    templateIdentifier: "minimal-table-with-nodes"
    variables: { tableId: "1" }
  })
}
```

### 8. 에러 처리

#### 템플릿을 찾을 수 없는 경우
```graphql
query ExecuteNonExistentTemplate {
  executeTemplate(input: {
    templateIdentifier: "non-existent-template"
    variables: {}
  })
}
# Error: TEMPLATE_NOT_FOUND
```

#### 필수 변수 누락
```graphql
query ExecuteMissingVariables {
  executeTemplate(input: {
    templateIdentifier: "minimal-table-with-nodes"
    variables: {}  # tableId 누락
    validateVariables: true
  })
}
# Error: INVALID_VARIABLES - Missing required variable: tableId
```

#### 비활성 템플릿 실행 시도
```graphql
query ExecuteInactiveTemplate {
  executeTemplate(input: {
    templateId: "999"  # inactive template
    variables: { tableId: "1" }
  })
}
# Error: TEMPLATE_INACTIVE
```

## 실행 플로우 요약

1. **템플릿 선택**: ID 또는 identifier로 템플릿 지정
2. **변수 제공**: 템플릿에 필요한 변수 전달
3. **검증**: 변수 스키마 검증 (옵션)
4. **실행**: 실제 GraphQL 쿼리/뮤테이션 실행
5. **결과 반환**: 실행 결과를 JSON으로 반환
6. **통계 업데이트**: 사용 횟수 자동 증가 (옵션)

## 장점

1. **재사용성**: 자주 사용하는 쿼리를 템플릿으로 저장
2. **일관성**: 표준화된 쿼리로 일관된 결과 보장
3. **성능**: 복잡도 기반 최적화 및 캐싱 가능
4. **보안**: 변수 검증으로 악의적인 입력 방지
5. **추적**: 사용 통계로 인기 쿼리 파악
6. **유연성**: 변수로 동적 쿼리 생성
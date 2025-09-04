# GraphQL Query Samples

이 문서는 Bun Graph DB의 유용한 GraphQL 쿼리 샘플들을 모아놓은 문서입니다.

## Table & Nodes Queries

### MinimalTableWithNodes
테이블의 기본 정보와 노드들의 핵심 데이터만 조회하는 효율적인 쿼리입니다.

```graphql
query MinimalTableWithNodes($tableId: ID!) {
  table(id: $tableId) {
    identifier
    description
  }
  
  nodes(tableId: $tableId) {
    nodes {
      id
      content
      attributes {
        value
        attribute {
          identifier
        }
      }
    }
    totalCount
  }
}
```

**Variables:**
```json
{
  "tableId": "1"
}
```

**사용 사례:**
- 테이블의 노드 목록을 빠르게 조회할 때
- 네트워크 트래픽을 최소화하고 싶을 때
- 모바일 환경이나 대역폭이 제한된 환경에서

**예시 응답:**
```json
{
  "data": {
    "table": {
      "identifier": "test-management",
      "description": "다중 구현체 테스트 추적 및 의존성 관리"
    },
    "nodes": {
      "totalCount": 2,
      "nodes": [
        {
          "id": "2",
          "content": "API 인증 시스템 테스트",
          "attributes": [
            {
              "value": "integration",
              "attribute": { "identifier": "test_type" }
            }
          ]
        }
      ]
    }
  }
}
```

## 다른 유용한 쿼리들

### BasicNodeWithAttributes
단일 노드의 속성 정보를 조회합니다.

```graphql
query BasicNodeWithAttributes($nodeId: ID!) {
  node(id: $nodeId) {
    id
    content
    title
    attributes {
      id
      value
      attribute {
        identifier
        description
      }
    }
  }
}
```

### TablesOverview
모든 테이블의 요약 정보를 조회합니다.

```graphql
query TablesOverview {
  tables {
    nodes {
      id
      identifier
      description
      nodeCount
      attributeCount
    }
    totalCount
  }
}
```

---

> **참고:** 이 문서의 쿼리들은 실제 프로덕션 환경에서 테스트되었습니다.  
> 새로운 유용한 쿼리 패턴을 발견하면 이 문서에 추가해주세요.
# 📊 Bun Graph Database - GraphQL API Reference

**버전**: 1.0.0  
**엔드포인트**: `http://localhost:4000/graphql`  
**GraphQL Playground**: `http://localhost:4000/playground`  

## 🚀 빠른 시작

### 개발 서버 시작
```bash
# 기본 개발 서버 (포트 4000)
bun run dev

# 특정 포트로 실행
GRAPHQL_PORT=4001 bun run dev
```

### 첫 번째 쿼리 실행
```graphql
# 서버 상태 확인
query HealthCheck {
  health {
    status
    timestamp
    database
    version
  }
}
```

## 📖 API 개요

Bun Graph Database는 **GraphQL-우선** 그래프 데이터베이스로, 노드와 관계를 통해 복잡한 데이터 구조를 모델링하고 쿼리할 수 있습니다.

### 🔗 핵심 개념

#### **Table (테이블)**
데이터 컬렉션의 논리적 그룹. 관계형 데이터베이스의 테이블과 유사하지만 그래프 구조를 지원합니다.

#### **Node (노드)** 
그래프의 개체(Entity). 속성(Attributes)을 가지며 다른 노드와 관계를 맺을 수 있습니다.

#### **Relation (관계)**
노드 간의 연결. 방향성과 강도(strength), 신뢰도(confidence)를 가집니다.

#### **Attribute (속성)**
노드의 특성을 나타내는 키-값 쌍. 타입이 정의되어 구조적 데이터를 지원합니다.

#### **Query Template (쿼리 템플릿)**
재사용 가능한 매개변수화된 GraphQL 쿼리. AI 친화적 쿼리 시스템입니다.

## 🎯 GraphQL 연산 유형

### 📖 Query (조회)
읽기 전용 연산. 데이터를 조회하고 검색합니다.

```graphql
query GetUser($userId: ID!) {
  node(id: $userId) {
    id
    content
    attributes {
      name
      value
    }
  }
}
```

### ✏️ Mutation (변경)
데이터를 생성, 수정, 삭제하는 연산입니다.

```graphql
mutation CreateUser($input: CreateNodeInput!) {
  createNode(input: $input) {
    success
    node {
      id
      content
    }
  }
}
```

### 🔔 Subscription (구독) - **NEW!**
실시간 데이터 스트림을 구독합니다.

```graphql
subscription WatchTemplateExecution {
  executeTemplateStream(
    templateIdentifier: "user-analytics"
  ) {
    status
    data
    progress
    timestamp
  }
}
```

## 📚 문서 구조

| 문서 | 설명 | 대상 |
|------|------|------|
| **[Queries](./schema/queries.md)** | 모든 Query 연산 레퍼런스 | 프론트엔드 개발자 |
| **[Mutations](./schema/mutations.md)** | 모든 Mutation 연산 레퍼런스 | 풀스택 개발자 |
| **[Subscriptions](./schema/subscriptions.md)** | 모든 Subscription 연산 레퍼런스 | 실시간 개발자 |
| **[Types](./schema/types.md)** | GraphQL 타입 시스템 완전 가이드 | 모든 개발자 |
| **[Examples](./examples/)** | 실제 사용 시나리오별 예제 | 신규 개발자 |
| **[Playground](./playground/)** | 테스트 가능한 쿼리 컬렉션 | QA/테스터 |

## ⚡ 특별한 기능들

### 🎯 **통합 템플릿 실행 시스템**
Query, Mutation, Subscription 모든 진입점에서 동일한 템플릿을 실행할 수 있습니다.

```graphql
# Query로 실행 (캐싱됨)
query { executeTemplate(input: {templateIdentifier: "analytics"}) }

# Mutation으로 실행 (통계 추적)
mutation { executeTemplate(input: {templateIdentifier: "analytics"}) }

# Subscription으로 실행 (실시간 스트리밍) - NEW!
subscription { executeTemplateStream(templateIdentifier: "analytics") }
```

### 🔍 **스마트 검색 시스템**
복잡한 그래프 탐색과 관계 기반 검색을 지원합니다.

```graphql
query SmartSearch($query: String!, $tableId: ID!) {
  searchNodes(
    filter: {
      content: $query
      tableId: $tableId
    }
    pagination: { limit: 10 }
  ) {
    nodes {
      id
      content
      relations {
        targetNode {
          content
        }
      }
    }
  }
}
```

### 📊 **실시간 분석**
그래프 메트릭과 분석을 실시간으로 제공합니다.

```graphql
subscription LiveAnalytics($tableId: ID!) {
  systemHealthChanged {
    nodeCount
    relationCount
    averageConnectivity
    performanceMetrics {
      queryResponseTime
      throughput
    }
  }
}
```

## 🛠️ 개발 도구

### **GraphQL Playground** 
브라우저 기반 GraphQL IDE
- 자동완성 및 구문 강조
- 스키마 탐색 및 문서화 뷰  
- 쿼리 실행 및 결과 시각화

### **Schema Introspection**
런타임에 스키마 정보를 조회할 수 있습니다.

```graphql
query IntrospectSchema {
  __schema {
    queryType {
      fields {
        name
        description
      }
    }
  }
}
```

## 🔧 고급 사용법

### **배치 요청**
여러 쿼리를 한 번에 실행:

```json
[
  {"query": "query { health { status } }"},
  {"query": "query { tables { id name } }"}
]
```

### **캐싱 전략**
- **Query**: 자동 캐싱 (TTL 기반)
- **Mutation**: 관련 캐시 무효화
- **Subscription**: 실시간 데이터 (캐싱 안함)

### **에러 처리**
GraphQL 표준 에러 형식:

```json
{
  "errors": [{
    "message": "Node not found",
    "locations": [{"line": 2, "column": 3}],
    "path": ["node"],
    "extensions": {
      "code": "NOT_FOUND",
      "exception": {"stacktrace": ["..."]}
    }
  }]
}
```

## 🚦 API 상태 및 모니터링

### 헬스체크
```graphql
query HealthCheck {
  health {
    status        # "healthy" | "degraded" | "unhealthy"
    timestamp     # 현재 시간
    database      # 데이터베이스 연결 상태
    version       # API 버전
  }
}
```

### 성능 메트릭
- **평균 응답 시간**: <200ms 목표
- **처리량**: 초당 요청 수 모니터링  
- **동시 접속**: WebSocket 연결 수 추적
- **에러율**: 1% 미만 유지

## 📞 지원 및 피드백

- **🐛 버그 리포트**: GitHub Issues
- **💡 기능 제안**: Discussion 탭
- **📖 추가 문서**: [기술 문서 위키]
- **⚡ 실시간 지원**: 개발자 Slack 채널

---

**다음**: [Query 연산 시작하기](./schema/queries.md) →
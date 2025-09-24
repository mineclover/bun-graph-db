# 🤖 AI-Friendly Prompt Guide for Bun Graph Database

**버전**: 1.0.0
**최종 업데이트**: 2025-09-25
**대상**: AI 시스템 개발자, 범용 AI 모델
**목적**: AI가 Bun Graph Database를 이해하고 효율적으로 쿼리를 생성할 수 있도록 하는 가이드

## 🎯 개요

이 가이드는 AI 시스템이 Bun Graph Database와 상호작용할 때 사용할 수 있는 Few Shot 프롬프트 패턴을 제공합니다. AI는 이 패턴들을 학습하여 자연스럽게 GraphQL 쿼리를 생성하고 템플릿을 만들 수 있습니다.

## 📋 시스템 이해를 위한 메타데이터 수집

### 1단계: 시스템 구조 파악

```graphql
# AI가 먼저 실행해야 할 기본 탐색 쿼리
query SystemDiscovery {
  # 1. 사용 가능한 테이블들 조회
  tables {
    nodes {
      id
      identifier
      description
      attributeCount
      tableNodeCount
      attributes {
        id
        identifier
        name
        attributeType {
          identifier
          dataType
          format
        }
      }
    }
  }

  # 2. 기존 템플릿 패턴 학습
  searchTemplates {
    templates {
      identifier
      name
      query
      tags
      usageStats {
        executionCount
        averageExecutionTime
      }
    }
  }

  # 3. 관계 타입들 이해
  relationTypes {
    nodes {
      id
      identifier
      description
      isDirectional
    }
  }
}
```

### 2단계: 샘플 데이터 파악

```graphql
# 각 테이블별 샘플 데이터 조회
query TableSampleData($tableId: ID!) {
  table(id: $tableId) {
    identifier
    description

    # 샘플 노드들 (최대 5개)
    tableNodes {
      id
      content
      attributes {
        attribute { identifier }
        value
      }
    }

    # 관계 패턴 파악
    sampleRelations: relations(limit: 10) {
      id
      relationType { identifier }
      sourceNode { id content }
      targetNode { id content }
    }
  }
}
```

## 🎯 Few Shot 프롬프트 패턴

### 패턴 1: 기본 CRUD 작업

#### 예제 1-1: 새 테이블 생성
```
사용자 요청: "Create a new table for storing book information"

AI 생성 쿼리:
mutation CreateBookTable {
  createTable(input: {
    identifier: "books"
    description: "Table for storing book information including title, author, ISBN, and publication details"
  }) {
    success
    table {
      id
      identifier
      description
    }
    errors {
      message
    }
  }
}

후속 작업: 속성 타입 정의 (title, author, isbn, publishedDate, genre)
```

#### 예제 1-2: 노드 생성과 속성 설정
```
사용자 요청: "Add a new book 'The Great Gatsby' by F. Scott Fitzgerald, published in 1925"

AI 생성 템플릿:
mutation CreateBookWithAttributes($tableId: ID!, $title: String!, $author: String!, $publishedYear: Int!) {
  # 1단계: 노드 생성
  createNode(input: {
    tableId: $tableId
    content: $title
  }) {
    success
    node { id }
  }

  # 2단계: 속성들 설정
  setTitle: setNodeAttribute(input: {
    nodeId: $nodeId
    attributeId: "title"
    value: $title
  }) { success }

  setAuthor: setNodeAttribute(input: {
    nodeId: $nodeId
    attributeId: "author"
    value: $author
  }) { success }

  setPublishedYear: setNodeAttribute(input: {
    nodeId: $nodeId
    attributeId: "publishedYear"
    value: $publishedYear
  }) { success }
}

실행 변수:
{
  "tableId": "books-table-id",
  "title": "The Great Gatsby",
  "author": "F. Scott Fitzgerald",
  "publishedYear": 1925
}
```

### 패턴 2: 검색 및 필터링

#### 예제 2-1: 단순 텍스트 검색
```
사용자 요청: "Find all books by Hemingway"

AI 생성 쿼리:
query FindBooksByAuthor($tableId: ID!) {
  searchNodes(
    tableId: $tableId
    searchQuery: {
      textSearch: "Hemingway"
      conditions: [{
        logicalOperator: AND
        filters: [{
          field: "author"
          operator: "contains"
          value: "Hemingway"
        }]
      }]
      limit: 50
    }
  ) {
    nodes {
      node {
        id
        content
      }
      attributes {
        attribute { identifier }
        value
      }
    }
    totalCount
  }
}
```

#### 예제 2-2: 복합 조건 검색
```
사용자 요청: "Find fiction books published between 1950 and 2000 with more than 300 pages"

AI 생성 쿼리:
query ComplexBookSearch($tableId: ID!) {
  searchNodes(
    tableId: $tableId
    searchQuery: {
      conditions: [{
        logicalOperator: AND
        filters: [
          {
            field: "genre"
            operator: "equals"
            value: "fiction"
          },
          {
            field: "publishedYear"
            operator: "range"
            value: { min: "1950", max: "2000" }
          },
          {
            field: "pageCount"
            operator: "gt"
            value: "300"
          }
        ]
      }]
      sortBy: [
        { field: "publishedYear", direction: DESC }
      ]
      limit: 25
    }
  ) {
    nodes {
      node { id content }
      attributes {
        attribute { identifier }
        value
      }
      relevanceScore
    }
    totalCount
    hasNextPage
  }
}
```

### 패턴 3: 관계 및 그래프 탐색

#### 예제 3-1: 관계 생성
```
사용자 요청: "Mark that Alice likes the book 'Pride and Prejudice'"

AI 생성 쿼리:
mutation CreateBookLikingRelation($userId: ID!, $bookId: ID!) {
  # 관계 타입이 없다면 먼저 생성
  createRelationType(input: {
    identifier: "likes"
    description: "User likes a book"
    isDirectional: true
  }) {
    success
    relationType { id }
  }

  # 관계 생성
  createRelation(input: {
    fromNodeId: $userId
    toNodeId: $bookId
    relationshipType: "likes"
    metadata: {
      rating: 5,
      dateAdded: "2025-09-25"
    }
  }) {
    success
    relation {
      id
      relationType { identifier }
    }
  }
}
```

#### 예제 3-2: 그래프 탐색
```
사용자 요청: "Find all books that Alice's friends also liked"

AI 생성 쿼리:
query FindFriendsBooks($aliceId: ID!) {
  node(id: $aliceId) {
    # Alice의 친구들 찾기
    friends: connectedNodes(
      depth: 1
      relationTypes: ["friends"]
      direction: BOTH
    ) {
      id
      content

      # 각 친구가 좋아하는 책들
      likedBooks: connectedNodes(
        depth: 1
        relationTypes: ["likes"]
        direction: OUTGOING
      ) {
        id
        content
        attributes {
          attribute { identifier }
          value
        }
      }
    }

    # Alice가 좋아하는 책들 (중복 제거용)
    alicesBooks: connectedNodes(
      depth: 1
      relationTypes: ["likes"]
      direction: OUTGOING
    ) {
      id
    }
  }
}
```

### 패턴 4: 데이터 분석 및 통계

#### 예제 4-1: 집계 쿼리
```
사용자 요청: "Show me statistics about books in the database"

AI 생성 쿼리:
query BookStatistics($tableId: ID!) {
  table(id: $tableId) {
    identifier
    tableNodeCount

    # 장르별 통계
    genreStats: searchNodes(
      searchQuery: {
        groupBy: "genre"
        aggregations: ["count", "avg_pages"]
        limit: 100
      }
    ) {
      aggregations {
        field
        value
        count
      }
    }

    # 연도별 출간 통계
    yearlyStats: searchNodes(
      searchQuery: {
        conditions: [{
          filters: [{
            field: "publishedYear"
            operator: "range"
            value: { min: "1900", max: "2025" }
          }]
        }]
        sortBy: [{ field: "publishedYear", direction: ASC }]
        limit: 1000
      }
    ) {
      nodes {
        attributes {
          attribute { identifier }
          value
        }
      }
    }
  }
}
```

#### 예제 4-2: 네트워크 분석
```
사용자 요청: "Find the most connected users (those who liked the most books)"

AI 생성 쿼리:
query MostActiveReaders($usersTableId: ID!) {
  searchNodes(tableId: $usersTableId) {
    nodes {
      node {
        id
        content

        # 각 사용자별 좋아하는 책 수 계산
        likedBooks: connectedNodes(
          relationTypes: ["likes"]
          direction: OUTGOING
        ) {
          id
        }

        # 네트워크 크기 (친구 수)
        friendsCount: connectedNodes(
          relationTypes: ["friends"]
          direction: BOTH
        ) {
          id
        }
      }
      attributes {
        attribute { identifier }
        value
      }
    }
  }
}
```

## 🛠️ 템플릿 생성 패턴

### AI가 템플릿을 생성할 때의 가이드라인

#### 1. 템플릿 명명 규칙
```
패턴: {action}-{entity}-{context}
예시:
- create-book-with-author
- find-users-by-preference
- analyze-network-connections
- update-node-attributes-bulk
```

#### 2. 변수 정의 패턴
```graphql
# 좋은 변수 정의 예시
mutation CreateEntityTemplate(
  $tableId: ID!                    # 필수: 대상 테이블
  $content: String!               # 필수: 노드 내용
  $attributes: [AttributeInput!]  # 선택: 속성 배열
  $relations: [RelationInput!]    # 선택: 관계 배열
) {
  # 구현부...
}
```

#### 3. 오류 처리 패턴
```graphql
# 모든 뮤테이션은 오류 처리를 포함해야 함
mutation SafeOperation($input: Input!) {
  operation(input: $input) {
    success
    data {
      # 성공시 반환 데이터
    }
    errors {
      message
      field
      code
    }
  }
}
```

## 📚 AI 학습을 위한 체크리스트

AI가 쿼리를 생성하기 전에 확인해야 할 사항들:

### ✅ 기본 확인사항
1. **테이블 존재 확인**: 대상 테이블이 존재하는가?
2. **속성 스키마 확인**: 필요한 속성들이 정의되어 있는가?
3. **관계 타입 확인**: 사용할 관계 타입이 존재하는가?
4. **데이터 타입 매칭**: 입력 값의 타입이 스키마와 일치하는가?

### ✅ 쿼리 최적화
1. **적절한 제한**: `limit`을 설정하여 과도한 데이터 로드 방지
2. **필드 선택**: 필요한 필드만 요청하여 성능 최적화
3. **깊이 제한**: 그래프 탐색시 `depth` 매개변수로 깊이 제한
4. **인덱스 활용**: 검색 조건이 인덱싱된 필드를 사용하는가?

### ✅ 오류 방지
1. **변수 검증**: 모든 필수 변수가 제공되었는가?
2. **권한 확인**: 해당 작업에 필요한 권한이 있는가?
3. **순환 참조**: 관계 생성시 순환 참조가 발생하지 않는가?
4. **데이터 무결성**: 외래키 제약조건이 만족되는가?

## 🔄 반복 학습 패턴

### 단계 1: 기본 패턴 학습
- CRUD 작업 (Create, Read, Update, Delete)
- 단순 검색 쿼리
- 기본 관계 생성

### 단계 2: 중급 패턴 학습
- 복합 조건 검색
- 그래프 탐색 (1-2 깊이)
- 집계 및 그룹핑

### 단계 3: 고급 패턴 학습
- 복잡한 네트워크 분석
- 다중 테이블 조인
- 성능 최적화된 쿼리
- 배치 작업

### 단계 4: 전문가 패턴 학습
- 동적 쿼리 생성
- 실시간 데이터 처리
- 복잡한 비즈니스 로직
- 시스템 관리 작업

## 🎯 실제 적용 예시

### 시나리오: 도서관 관리 시스템
```
사용자: "Create a library management system with books, authors, and users"

AI 단계별 접근:

1. 시스템 탐색
   - 기존 테이블 확인
   - 스키마 분석

2. 테이블 설계
   - books 테이블 생성
   - authors 테이블 생성
   - users 테이블 생성

3. 관계 정의
   - author → writes → book
   - user → borrows → book
   - user → likes → book

4. 샘플 데이터 생성
   - 각 테이블에 샘플 레코드 추가
   - 관계 생성

5. 쿼리 템플릿 생성
   - 책 대출 프로세스
   - 추천 시스템 쿼리
   - 통계 리포트 생성
```

이 가이드를 통해 AI는 Bun Graph Database의 모든 기능을 효율적으로 활용할 수 있으며, 사용자의 자연어 요청을 구조화된 GraphQL 쿼리로 변환할 수 있습니다.

---

**작성**: Claude Code Assistant
**검증**: Human Developer
**업데이트**: 시스템 기능 추가시 자동 갱신
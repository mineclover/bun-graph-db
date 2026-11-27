# 🎯 시작하기 - 5분 만에 배우는 그래프 데이터 저장소

**관계형 데이터 저장소**로 연결된 정보를 쉽게 저장하고 탐색할 수 있습니다.

> 💡 **용어가 궁금하신가요?** [용어집(GLOSSARY.md)](GLOSSARY.md)에서 모든 용어를 자세히 설명합니다.

> ✅ **2026-11-27 검증 스냅샷**: Node.js `>=26.0.0`(`node:sqlite`) + pnpm `12.21.0` 환경에서 서버 기동, 헬스체크(`/health`, `/api/health`), `createTable`, `createNode`, `searchNodes`, 계층 구조(`getSubtree`/`moveHierarchyNode`), MCP `2026-07-28`/`2025-11-25` LTS, Cloudflare DO SQLite Phase 1(`PortableBootstrap`), JSONL 백업·복원, 4-신호 하이브리드 검색, `pnpm run check:static` 및 `pnpm run test`까지 검증되었습니다. 초기 평가 이력은 [docs/development/SYSTEM_EVALUATION_2026-03-30.md](docs/development/SYSTEM_EVALUATION_2026-03-30.md)를, 운영 절차는 [docs/guides/OPERATIONS_GUIDE.md](docs/guides/OPERATIONS_GUIDE.md)를 참고하세요.

---

## 📚 핵심 개념 (3가지만 알면 됩니다)

### 1. 테이블 = 데이터 종류
**무엇인가요?** 엑셀 시트처럼 데이터를 구분하는 틀입니다.

**예시**:
- `사람` 테이블: 친구, 가족, 동료 정보
- `프로젝트` 테이블: 할 일, 작업 목록
- `노트` 테이블: 메모, 지식 정리

**만들기**:
```graphql
# "노트" 테이블 만들기
mutation {
  createTable(input: {
    identifier: "notes"
    description: "내 개인 노트"
  }) {
    success
    table { id identifier }
  }
}
```

### 2. 노드 = 실제 데이터
**무엇인가요?** 테이블 안의 실제 데이터 항목입니다.

**예시**:
- `사람` 테이블 안의 "홍길동", "김철수"
- `프로젝트` 테이블 안의 "웹사이트 개발", "블로그 작성"
- `노트` 테이블 안의 "그래프 이해하기", "시스템 설계"

**만들기**:
```graphql
# 노트 하나 만들기
mutation {
  createNode(input: {
    tableId: "1"
    content: "관계를 쉽게 표현할 수 있는 데이터 구조입니다"
  }) {
    success
    node { id content }
  }
}
```

### 3. 관계 = 연결
**무엇인가요?** 노드와 노드를 연결하는 선입니다.

**예시**:
- "홍길동" → 알고 있는 → "김철수"
- "블로그 작성" → 의존 → "웹사이트 개발"
- "시스템 설계" → 참조 → "그래프 이해하기"

**만들기**:
```graphql
# 관계 유형 먼저 정의
mutation {
  createRelationType(input: {
    identifier: "references"
    name: "참조"
  }) { success relationType { id } }
}

# 노트 간 연결 만들기
mutation {
  createRelation(input: {
    tableId: "1"
    sourceNodeId: "1"
    targetNodeId: "2"
    relationTypeId: "1"
  }) { success }
}
```

---

## 🚀 5분 실습: 개인 지식 그래프 만들기

### 1단계: 서버 시작 (30초)
```bash
# 설치 (처음 한 번만, 요구 런타임: Node.js >= 26.0.0, pnpm 12.21.0)
pnpm install
node --import tsx scripts/init-database.ts

# 서버 시작
pnpm run dev
```

브라우저에서 `http://localhost:4141/graphql` 열기 ✅

### 2단계: 테이블 만들기 (1분)
```graphql
# "학습노트" 테이블 생성
mutation {
  createTable(input: {
    identifier: "learning_notes"
    description: "내가 배운 것들"
  }) {
    success
    table { id identifier }
  }
}
```

결과: `{ "id": "1" }` ✅

### 3단계: 노트 추가 (2분)
```graphql
# 첫 번째 노트
mutation {
  createNode(input: {
    tableId: "1"
    content: "쿼리 언어로 필요한 데이터만 요청 가능"
  }) {
    success
    node { id content }
  }
}

# 두 번째 노트
mutation {
  createNode(input: {
    tableId: "1"
    content: "빠른 자바스크립트 실행 환경"
  }) {
    success
    node { id content }
  }
}

# 세 번째 노트
mutation {
  createNode(input: {
    tableId: "1"
    content: "관계 중심 데이터 저장소"
  }) {
    success
    node { id content }
  }
}
```

### 4단계: 노트 검색 (1분)
```graphql
# "쿼리" 포함된 노트 찾기
query {
  searchNodes(filter: {
    tableId: "1"
    search: "쿼리"
  }) {
    nodes { id content }
    totalCount
  }
}
```

결과: 첫 번째 노트 발견! ✅

### 5단계: 노트 간 연결 (30초)
```graphql
# 관계 유형 만들기
mutation {
  createRelationType(input: {
    identifier: "related_to"
    name: "관련있음"
  }) { success relationType { id } }
}

# 첫 번째 노트와 세 번째 노트 연결
mutation {
  createRelation(input: {
    tableId: "1"
    sourceNodeId: "1"
    targetNodeId: "3"
    relationTypeId: "1"
  }) { success }
}
```

### 6단계: 연결된 노트 찾기 (30초)
```graphql
# 첫 번째 노트와 연결된 모든 노트 보기
query {
  node(id: "1") {
    content
    outgoingRelations {
      targetNode { id content }
    }
  }
}
```

결과: 세 번째 노트 발견! ✅

---

## 💡 실제 사용 예시

### 예시 1: 개인 위키
```
테이블: 문서, 태그
노드: "파이썬 기초", "웹 개발", "프로그래밍" 태그
관계: 문서 → has_tag → 태그
```

### 예시 2: 프로젝트 관리
```
테이블: 프로젝트, 작업, 사람
노드: "웹사이트 개발" 프로젝트, "디자인" 작업, "김철수"
관계: 작업 → assigned_to → 사람, 작업 → belongs_to → 프로젝트
```

### 예시 3: 레시피 북
```
테이블: 레시피, 재료
노드: "토마토 파스타", "토마토", "파스타 면"
관계: 레시피 → uses → 재료
```

---

## 🎨 주요 기능

### 1. 강력한 검색
```graphql
# 텍스트 검색 (tableId 필수)
searchNodes(filter: { tableId: "1", search: "관계" })

# 여러 조건 검색
searchNodes(filter: {
  tableId: "1"
  search: "데이터"
})
```

### 2. 그래프 탐색
```graphql
# 연결된 모든 노드 찾기 (2단계까지)
node(id: "1") {
  connectedNodes(depth: 2, direction: "BOTH") {
    id content
  }
}

# 특정 관계만 따라가기
node(id: "1") {
  neighborsByRelationType(
    relationTypes: ["references"]
    direction: "OUTGOING"
  ) {
    id content
  }
}
```

### 3. 재사용 가능한 쿼리 (템플릿)
```graphql
# 템플릿 만들기
mutation {
  createTemplate(input: {
    identifier: "search_by_keyword"
    name: "키워드로 검색"
    query: "query Search($tableId: ID!, $keyword: String!) { searchNodes(filter: { tableId: $tableId, search: $keyword }) { nodes { id content } totalCount } }"
  }) { success template { id } }
}

# 템플릿 실행
mutation {
  executeTemplateWithGraphQL(
    templateIdentifier: "search_by_keyword"
    variables: { tableId: "1", keyword: "관계" }
  ) { success data }
}
```

---

## 🤖 AI 통합 (Claude)

### Claude에 연결하기
```bash
# 전역 도구 (모든 테이블)
claude mcp add --transport http graph-global http://localhost:4141/mcp

# 특정 테이블만
claude mcp add --transport http notes http://localhost:4141/sub/1/mcp
```

**Claude가 할 수 있는 일**:
- 노트 검색 및 생성
- 관계 추가
- 데이터 분석
- 자동 정리

---

## 📖 자주 묻는 질문

### Q: SQL과 뭐가 다른가요?
**A**: 관계를 쉽게 탐색할 수 있습니다.
- SQL: JOIN 복잡, 깊은 관계 어려움
- 그래프 저장소: 연결된 데이터 바로 찾기

### Q: NoSQL과 뭐가 다른가요?
**A**: 구조화된 관계를 유지합니다.
- NoSQL: 관계 관리 어려움
- 그래프 저장소: 관계가 핵심 기능

### Q: 얼마나 빠른가요?
**A**: 모든 작업 **<25ms** (테스트 완료)
- 단순 조회: <10ms
- 그래프 탐색: <15ms
- 검색: <20ms

### Q: 어디에 쓰나요?
**A**: 관계가 중요한 모든 곳
- ✅ 개인 지식 관리
- ✅ 프로젝트 추적
- ✅ 소셜 네트워크
- ✅ 추천 시스템
- ✅ 의존성 관리

---

## 🎓 다음 단계

### 더 배우기
1. **[용어집](GLOSSARY.md)** - 모든 용어 상세 설명
2. **[인터페이스 레퍼런스](docs/api/doc-api-reference.md)** - 모든 작업
3. **[템플릿 가이드](docs/templates/template-system-guide.md)** - 재사용 쿼리
4. **[AI 통합 가이드](docs/guides/MCP_SETUP_GUIDE.md)** - Claude 연동
5. **[시스템 구조](docs/architecture/ARCHITECTURE_OVERVIEW.md)** - 전체 설계

### 실전 예제 & 핵심 기준
- **[실전 활용 정의 및 6대 시나리오](docs/guides/USE_CASES_AND_CAPABILITIES.md)** - 지식 그래프·계층 구조·스펙 계보·스키마 카탈로그·표 동기화·백업
- **[Web Embedded · EmbeddingGemma-2 · IA · AI Memory](docs/guides/EMBEDDED_WEB_AND_AI_MEMORY.md)** - 브라우저 WASM 임베딩·정보구조화·에이전트 장기 메모리
- **[핵심 기능 골든 테스트 데이터셋](docs/development/GOLDEN_DATASET.md)** - `pnpm run test:golden` 기반 10대 기능군 교차 런타임 검증 기준
- **[Cloudflare 단일 노드 아키텍처](docs/architecture/cloudflare-single-node.md)** - Durable Object SQLite Phase 1 검토
- **[MCP 프로토콜 참조](docs/mcp/README.md)** - `2026-07-28` / `2025-11-25` LTS 연동 규격
- **[개발 가이드](docs/development/DEVELOPMENT_ENVIRONMENT_GUIDE.md)** - 개발 환경

---

## 💬 요약

**3가지 개념**:
1. 테이블 = 데이터 종류
2. 노드 = 실제 항목
3. 관계 = 연결

**3줄 시작**:
```bash
pnpm install && node --import tsx scripts/init-database.ts
pnpm run dev
# http://localhost:4141/graphql 열기
```

**5분 실습**:
테이블 만들기 → 노드 추가 → 검색 → 연결 → 탐색

**개인 프로젝트에 바로 사용 가능합니다!** ✅

---

**라이선스**: MIT
**문서 업데이트**: 2026-11-27

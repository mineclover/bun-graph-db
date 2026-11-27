# 🎮 GraphQL Playground - 테스트 쿼리 컬렉션

이 디렉토리는 GraphQL API를 실제로 테스트해볼 수 있는 **바로 실행 가능한 쿼리 컬렉션**입니다.

## 🚀 빠른 시작

### 1. 개발 서버 시작
```bash
pnpm run dev
# 또는 특정 포트
pnpm run dev --port 4200
```

### 2. GraphQL Playground 접속
브라우저에서 [http://localhost:4141/graphql](http://localhost:4141/graphql) 접속

### 3. 쿼리 복사 & 붙여넣기
이 디렉토리의 `.graphql` 파일들을 복사하여 Playground에서 바로 실행하세요.

---

## 📂 디렉토리 구조

```
playground/
├── README.md                    # 이 파일
├── queries/                     # Query 테스트 컬렉션
│   ├── 01-basic-health.graphql      # ⭐ 시작: 서버 상태 확인
│   ├── 02-table-management.graphql  # 테이블 CRUD 기본
│   ├── 03-node-operations.graphql   # 노드 생성/조회/검색
│   ├── 04-relation-discovery.graphql # 관계 탐색 및 그래프 쿼리
│   ├── 05-template-queries.graphql  # 템플릿 관리 및 실행
│   └── 06-advanced-analytics.graphql # 고급 분석 쿼리
├── mutations/                   # Mutation 테스트 컬렉션  
│   ├── 01-create-data.graphql       # 데이터 생성 (테이블/노드/관계)
│   ├── 02-update-operations.graphql # 데이터 업데이트
│   ├── 03-template-management.graphql # 템플릿 생성/수정
│   └── 04-bulk-operations.graphql   # 대량 데이터 처리
└── subscriptions/               # Subscription 테스트 컬렉션
    ├── 01-template-streaming.graphql    # ⭐ NEW: 템플릿 실시간 실행
    ├── 02-data-change-events.graphql   # 데이터 변경 이벤트 구독
    ├── 03-system-monitoring.graphql    # 시스템 모니터링 구독
    └── 04-real-time-analytics.graphql  # 실시간 분석 구독
```

## ⭐ 추천 시작 순서

### 🥇 **1단계: 기본 동작 확인**
1. [`queries/01-basic-health.graphql`](./queries/01-basic-health.graphql) - 서버 상태 확인
2. [`queries/02-table-management.graphql`](./queries/02-table-management.graphql) - 기본 테이블 조회

### 🥈 **2단계: 데이터 생성**  
3. [`mutations/01-create-data.graphql`](./mutations/01-create-data.graphql) - 테스트 데이터 생성

### 🥉 **3단계: 고급 기능**
4. [`subscriptions/01-template-streaming.graphql`](./subscriptions/01-template-streaming.graphql) - **NEW!** 실시간 템플릿 실행
5. [`queries/04-relation-discovery.graphql`](./queries/04-relation-discovery.graphql) - 그래프 탐색

---

## 🎯 특별한 기능들

### 🆕 **통합 템플릿 실행 시스템** 
동일한 템플릿을 3가지 방식으로 실행 가능:

```graphql
# 1. Query로 실행 (캐싱됨)
query { executeTemplate(input: {templateIdentifier: "analytics"}) }

# 2. Mutation으로 실행 (통계 추적)  
mutation { executeTemplate(input: {templateIdentifier: "analytics"}) }

# 3. Subscription으로 실행 (실시간 스트리밍) ⭐ NEW!
subscription { executeTemplateStream(templateIdentifier: "analytics") }
```

### 🔍 **스마트 그래프 탐색**
복잡한 관계 네트워크를 직관적으로 탐색:

```graphql
query SmartGraphExploration($nodeId: ID!, $depth: Int!) {
  searchRelatedNodes(nodeId: $nodeId, depth: $depth) {
    nodes {
      id
      content  
      distance        # 시작점으로부터의 거리
      relationshipPath {
        strength
        confidence
        type { name }
      }
    }
  }
}
```

### 📊 **실시간 분석 대시보드**
실시간으로 그래프 메트릭을 모니터링:

```graphql
subscription LiveDashboard {
  systemHealthChanged {
    graphStats {
      totalNodes
      totalRelations
      avgNodesPerTable
    }
    performance {
      avgResponseTime
      requestsPerSecond
    }
  }
}
```

---

## 🛠️ 개발자 도구

### **Variables 섹션 활용**
Playground 하단의 Variables 섹션에서 매개변수를 JSON으로 정의:

```json
{
  "tableId": "users_table",
  "limit": 10,
  "searchQuery": "활성 사용자"
}
```

### **Query 히스토리**
Playground는 실행한 쿼리 히스토리를 자동 저장합니다.

### **스키마 탐색**  
우측 "Docs" 탭에서 전체 GraphQL 스키마를 브라우징할 수 있습니다.

### **자동완성**
`Ctrl+Space`로 필드명과 인자 자동완성을 활용하세요.

---

## 📚 카테고리별 사용 가이드

### 🔍 **Query (조회) 사용법**
- 읽기 전용 연산
- 캐싱 적용 (동일 쿼리는 빠른 응답)
- 복잡한 중첩 쿼리 가능
- 페이지네이션 지원

### ✏️ **Mutation (변경) 사용법**  
- 데이터 생성/수정/삭제
- 트랜잭션 처리
- 검증 및 에러 처리
- 연관 데이터 자동 업데이트

### 🔔 **Subscription (구독) 사용법**
- 실시간 데이터 스트림
- WebSocket 연결 필요
- 자동 재연결 지원
- 이벤트 기반 알림

---

## 🧪 테스트 시나리오

### **시나리오 1: 신규 프로젝트 셋업**
1. 건강 상태 확인 → 테이블 생성 → 초기 데이터 입력 → 관계 설정

### **시나리오 2: 데이터 분석**
1. 노드 검색 → 관계 탐색 → 템플릿 생성 → 분석 실행

### **시나리오 3: 실시간 모니터링**
1. 데이터 변경 구독 → 성능 모니터링 → 알림 설정

### **시나리오 4: 템플릿 시스템 활용**  
1. 템플릿 생성 → Query 실행 → Mutation 실행 → **Subscription 스트리밍** ⭐

---

## 🔧 문제해결

### **Q: Playground가 로딩되지 않아요**
A: 개발 서버가 실행 중인지 확인하고, 올바른 포트로 접속했는지 확인하세요.

### **Q: Subscription이 작동하지 않아요**  
A: WebSocket 연결이 필요합니다. 네트워크 환경을 확인해주세요.

### **Q: 쿼리 실행 시 권한 오류가 발생해요**
A: 현재 버전은 인증이 필요하지 않습니다. 네트워크 설정을 확인해주세요.

### **Q: 예제 쿼리가 작동하지 않아요**
A: 
1. 서버 버전 확인: `query { health { version } }`
2. 스키마 동기화 확인: Docs 탭에서 최신 스키마 확인
3. 데이터 존재 확인: 테스트 데이터 생성 후 재시도

---

## 🚀 다음 단계

1. **[Basic Health Check](./queries/01-basic-health.graphql)**부터 시작하세요
2. 각 `.graphql` 파일의 주석을 읽고 단계별로 따라해보세요  
3. Variables를 수정하여 다양한 시나리오를 테스트해보세요
4. **[Template Streaming](./subscriptions/01-template-streaming.graphql)**으로 최신 기능을 경험해보세요

**Happy GraphQL-ing! 🎉**
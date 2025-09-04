# GraphQL API 우선순위 개발 로드맵

이 문서는 `GRAPHQL_API_CHECKLIST.md`를 기반으로 핵심 기능부터 순차적으로 개발하기 위한 우선순위 로드맵을 제공합니다.

## 📋 현재 구현 상태

### ✅ 이미 구현된 GraphQL 구조
```
src/presentation/graphql/
├── queries/
│   ├── TableQueries.ts        ✅ 구현됨
│   ├── NodeQueries.ts         ✅ 구현됨  
│   ├── AttributeQueries.ts    ✅ 구현됨
│   ├── RelationQueries.ts     ✅ 구현됨
│   ├── TemplateQueries.ts     ✅ 구현됨
│   └── AnalyticsQueries.ts    ✅ 구현됨
├── mutations/
│   ├── TableMutations.ts      ✅ 구현됨
│   ├── NodeMutations.ts       ✅ 구현됨
│   ├── AttributeMutations.ts  ✅ 구현됨
│   ├── RelationMutations.ts   ✅ 구현됨
│   └── TemplateMutations.ts   ✅ 구현됨
└── schemas/
    ├── table.graphql          ✅ 스키마 정의됨
    ├── node.graphql           ✅ 스키마 정의됨
    ├── attribute.graphql      ✅ 스키마 정의됨
    ├── relation.graphql       ✅ 스키마 정의됨
    ├── query-template.graphql ✅ 스키마 정의됨
    ├── analytics.graphql      ✅ 스키마 정의됨
    └── advanced-search.graphql ✅ 스키마 정의됨
```

## 🎯 Phase 1: 핵심 CRUD 검증 및 안정화 (1-2주)

### Priority 1A: 기본 노드 관리 (필수 기능)
```typescript
const Phase1A_Critical = {
  // 📍 즉시 검증 및 수정 필요
  queries: [
    "node",              // ✅ 구현됨 → 🧪 테스트 필요
    "nodes",             // ✅ 구현됨 → 🧪 테스트 필요
    "nodeByContent",     // ✅ 구현됨 → 🧪 테스트 필요
  ],
  mutations: [
    "createNode",        // ✅ 구현됨 → 🧪 테스트 필요
    "updateNode",        // ✅ 구현됨 → 🧪 테스트 필요
    "deleteNode",        // ✅ 구현됨 → 🧪 테스트 필요
  ],
  
  // 🎯 이번 주 목표
  tasks: [
    "NodeQueries.ts 모든 메서드 단위 테스트 작성",
    "NodeMutations.ts 모든 메서드 단위 테스트 작성", 
    "GraphiQL에서 수동 테스트 및 버그 수정",
    "node.graphql 스키마 검증",
    "GRAPHQL_API_CHECKLIST.md 노드 관련 항목 ✅ 업데이트"
  ]
}
```

### Priority 1B: 기본 테이블 관리 (메타데이터 관리)
```typescript
const Phase1B_Foundation = {
  queries: [
    "table",             // ✅ 구현됨 → 🧪 테스트 필요
    "tables",            // ✅ 구현됨 → 🧪 테스트 필요  
    "tableByIdentifier", // ✅ 구현됨 → 🧪 테스트 필요
  ],
  mutations: [
    "createTable",       // ✅ 구현됨 → 🧪 테스트 필요
    "updateTable",       // ✅ 구현됨 → 🧪 테스트 필요
    "deleteTable",       // ✅ 구현됨 → ⚠️ 위험 기능 - 안전장치 확인 필요
  ],
  
  // 🎯 이번 주 목표  
  tasks: [
    "TableQueries.ts 전체 테스트 스위트 작성",
    "TableMutations.ts 테스트 + deleteTable 안전장치 구현",
    "테이블 생성/삭제 시나리오 E2E 테스트",
    "table.graphql 스키마 완전성 검증"
  ]
}
```

### Priority 1C: 템플릿 시스템 핵심 (AI 친화적 기능)
```typescript
const Phase1C_Templates = {
  // 🔥 가장 중요한 차별화 기능
  queries: [
    "getTemplate",           // ✅ 구현됨 → 🧪 테스트 필요
    "searchTemplates",       // ✅ 구현됨 → 🧪 테스트 필요
    "executeTemplate",       // ✅ 구현됨 → ⚡ 핵심 기능 - 집중 테스트 필요
  ],
  mutations: [
    "createTemplate",        // ✅ 구현됨 → 🧪 테스트 필요
    "executeTemplate",       // ✅ 구현됨 → ⚡ 핵심 기능 - 집중 테스트 필요
    "activateTemplate",      // ✅ 구현됨 → 🧪 테스트 필요
  ],
  
  // 🎯 이번 주 목표
  tasks: [
    "executeTemplate 기능 완전 검증 (Query/Mutation 모두)",
    "JSON Schema 변수 검증 로직 테스트",
    "템플릿 실행 에러 핸들링 강화",
    "TEMPLATE_GRAPHQL_INTERACTION_GUIDE.md 예제 검증",
    "실제 사용 케이스 기반 템플릿 샘플 생성"
  ]
}
```

## 🔗 Phase 2: 관계 및 속성 시스템 완성 (2-3주)

### Priority 2A: 관계 관리 (그래프 DB 핵심)
```typescript
const Phase2A_Relations = {
  queries: [
    "nodeRelations",         // ✅ 구현됨 → 🧪 테스트 필요
    "searchRelatedNodes",    // ✅ 구현됨 → 🧪 테스트 필요
    "relationType",          // ✅ 구현됨 → 🧪 테스트 필요
    "relationTypes",         // ✅ 구현됨 → 🧪 테스트 필요
  ],
  mutations: [
    "createRelation",        // ✅ 구현됨 → 🧪 테스트 필요
    "deleteRelation",        // ✅ 구현됨 → 🧪 테스트 필요
    "createRelationType",    // ✅ 구현됨 → 🧪 테스트 필요
  ],
  
  // 🎯 다음 주 목표
  tasks: [
    "RelationQueries.ts 전체 기능 테스트",
    "관계 생성/삭제 시 데이터 정합성 검증",
    "순환 참조 방지 로직 구현",
    "relation.graphql 스키마 최적화",
    "노드-관계 복합 시나리오 E2E 테스트"
  ]
}
```

### Priority 2B: 속성 스키마 관리 (동적 스키마)
```typescript
const Phase2B_Attributes = {
  queries: [
    "attributes",            // ✅ 구현됨 → 🧪 테스트 필요
    "attributeTypes",        // ✅ 구현됨 → 🧪 테스트 필요
    "attributeTypeByIdentifier", // ✅ 구현됨 → 🧪 테스트 필요
  ],
  mutations: [
    "createAttribute",       // ✅ 구현됨 → 🧪 테스트 필요
    "createAttributeType",   // ✅ 구현됨 → 🧪 테스트 필요
    "setNodeAttribute",      // ✅ 구현됨 → 🧪 테스트 필요
  ],
  
  // 🎯 2-3주차 목표
  tasks: [
    "AttributeQueries.ts 동적 스키마 조회 테스트",
    "JSON Schema 기반 속성 타입 검증",
    "속성 값 타입 안전성 확보",
    "attribute.graphql 스키마 검증",
    "동적 폼 생성 시나리오 테스트"
  ]
}
```

## 🔍 Phase 3: 고급 검색 및 분석 기능 (3-4주)

### Priority 3A: 검색 시스템 (사용자 경험 핵심)
```typescript
const Phase3A_Search = {
  queries: [
    "searchNodes",           // ✅ 구현됨 → 📈 성능 최적화 필요
    "advancedSearch",        // ✅ 구현됨 → ⚠️ SQL Injection 보안 검토 필요
  ],
  
  // 🎯 3주차 목표
  tasks: [
    "advancedSearch SQL 쿼리 생성 로직 보안 검토",
    "검색 성능 최적화 (인덱스, 캐싱)", 
    "복합 필터 조건 정확성 테스트",
    "페이지네이션 대용량 데이터 테스트",
    "검색 결과 관련성 점수 알고리즘 검증"
  ]
}
```

### Priority 3B: 분석 및 집계 (AI 분석 지원)
```typescript
const Phase3B_Analytics = {
  queries: [
    "analyzeNodes",          // ✅ 구현됨 → 🤖 AI 알고리즘 구현 필요
    "aggregateData",         // ✅ 구현됨 → 📊 실제 집계 로직 구현 필요  
    "getDependencyChain",    // ✅ 구현됨 → 🧪 테스트 필요
  ],
  
  // 🎯 3-4주차 목표
  tasks: [
    "analyzeNodes 실제 그래프 분석 알고리즘 구현",
    "aggregateData Mock 데이터를 실제 SQL 집계로 전환",
    "중심성, 클러스터링 분석 성능 최적화",  
    "analytics.graphql 스키마 완성",
    "분석 결과 시각화 데이터 포맷 표준화"
  ]
}
```

## 🚧 Phase 4: 모니터링 및 시스템 기능 (4-5주)

### Priority 4A: 필수 시스템 기능
```typescript
const Phase4A_System = {
  queries: [
    "health",               // ✅ 구현됨 → ✅ 완료
    "exportTable",          // ✅ 구현됨 → 🧪 테스트 필요
    "exportAllTables",      // ✅ 구현됨 → 🧪 테스트 필요
  ],
  mutations: [
    "importSchema",         // ✅ 구현됨 → 🧪 테스트 필요
    "clearCache",           // ✅ 구현됨 → 🧪 테스트 필요
    "optimizeDatabase",     // ✅ 구현됨 → 🧪 테스트 필요
  ]
}
```

### Priority 4B: 정리 및 제거 대상
```typescript
const Phase4B_Cleanup = {
  // 🗑️ 제거 예정 기능들
  toRemove: [
    "findPathsBetweenNodes",     // ❌ 목적 불명확, 중복 기능
    "previewNodeCreation",       // ❌ 불필요한 복잡성
    "getAlertRules",            // ❌ 외부 시스템으로 대체
    "createAlertRule",          // ❌ 외부 시스템으로 대체
    "updateAlertRule",          // ❌ 외부 시스템으로 대체
    "deleteAlertRule",          // ❌ 외부 시스템으로 대체
  ],
  
  // 🚧 Mock 데이터를 실제 구현으로 전환 예정
  toImplement: [
    "getSystemHealth",          // 🚧 Mock → Real system metrics
    "getPerformanceMetrics",    // 🚧 Mock → Real performance data
    "getMonitoringMetrics",     // 🚧 Mock → Real monitoring
    "getTestSuiteStatus",       // 🚧 Mock → Real test integration
  ]
}
```

## 📊 개발 진행 추적 방법

### 체크리스트 기반 진행 관리
```typescript
interface ProgressTracking {
  // 주간 체크리스트
  weekly: {
    "Phase 1A 완료율": "6개 기능 중 _/6 완료",
    "테스트 커버리지": "목표 80% 이상", 
    "문서 동기화": "GRAPHQL_API_CHECKLIST.md 업데이트",
    "성능 벤치마크": "응답시간 < 500ms 유지"
  },
  
  // 기능별 완료 기준
  completionCriteria: {
    "✅ 구현 완료": "코드 작성 + 단위 테스트",
    "🧪 테스트 완료": "단위 + 통합 + E2E 테스트",
    "📚 문서 완료": "API 문서 + 예제 + 가이드 업데이트",
    "🚀 배포 완료": "성능 검증 + 보안 검토 완료"
  }
}
```

### 자동화된 품질 게이트
```typescript
// scripts/phase-validator.ts (새로 생성 예정)
interface PhaseValidator {
  "Phase 1 완료 조건": [
    "모든 노드/테이블/템플릿 CRUD 기능 테스트 통과",
    "GraphiQL 수동 테스트 시나리오 100% 성공",
    "성능 벤치마크 기준치 달성",
    "GRAPHQL_API_CHECKLIST.md Phase1 항목 ✅ 완료"
  ],
  
  "Phase 2 완료 조건": [
    "모든 관계/속성 기능 테스트 통과",
    "데이터 정합성 검증 테스트 통과",
    "복합 시나리오 E2E 테스트 통과"
  ]
}
```

## 🎯 실행 가이드

### 이번 주 즉시 시작 작업
```bash
# 1. Phase 1A 노드 관리 테스트 작성
bun run test:node-queries
bun run test:node-mutations

# 2. GraphiQL 수동 테스트
bun run dev
# → http://localhost:4000/graphql에서 노드 CRUD 테스트

# 3. 체크리스트 업데이트
# GRAPHQL_API_CHECKLIST.md에서 완료된 기능 ✅ 표시

# 4. 템플릿 시스템 핵심 검증
bun run test:templates
bun run scripts/template-execution-test.ts
```

### 다음 단계 준비
```typescript
// 다음 주 시작 전 준비사항
const NextWeekPrep = {
  "환경 설정": [
    "테스트 데이터베이스 최신화",
    "GraphQL 스키마 검증 스크립트 실행",
    "성능 측정 도구 설정"
  ],
  
  "문서 동기화": [
    "GRAPHQL_API_CHECKLIST.md 현재 상태 반영",
    "TEMPLATE_GRAPHQL_INTERACTION_GUIDE.md 예제 검증",
    "우선순위 변경사항 로드맵 반영"
  ]
}
```

이 로드맵을 통해 체계적이고 우선순위가 명확한 GraphQL API 개발을 진행할 수 있습니다. 각 Phase별로 완료 기준을 충족한 후 다음 단계로 넘어가는 것이 중요합니다! 🚀
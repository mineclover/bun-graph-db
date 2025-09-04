# GraphQL API 기능 체크리스트

> **이 문서는 현재 구현된 GraphQL API의 모든 기능을 정리한 체크리스트입니다.**

## 📋 문서 목적

- **현재 상태 파악**: 구현된 GraphQL 기능들의 전체 현황
- **리팩토링 가이드**: 관심사 분리 시 각 Resolver의 담당 기능 확인
- **API 문서화**: 각 기능의 시그니처와 용도 명시
- **개발 참조**: 새 기능 개발 시 기존 패턴 참고

---

## 🔍 Query (조회 기능)

### 검색 및 분석

- [ ] `advancedSearch` - 고급 검색 및 필터링
  - **시그니처**: `(input: AdvancedSearchInput!) → AdvancedSearchResult!`
  - **용도**: 복합 필터링, 관계 검색, 집계, 정렬을 지원하는 종합 검색 기능
  - **구현**: AdvancedSearchUseCase를 통해 동적 SQL 쿼리 생성 및 실행
  - **기능**: 11가지 연산자 지원, 관계 필터링, 집계, 페이지네이션, 관련성 점수 계산
  - **⚠️ 주의**: Raw SQL 쿼리 생성 방식으로 구현, SQL injection 방지 처리 완료
  - **⚠️ 제한사항**: 복잡한 nested 관계 쿼리와 고급 전문 검색 기능 미완성

- [ ] `searchNodes` - 노드 검색
  - **시그니처**: `(tableId: ID!, filter?: NodeFilter, first?: Int) → NodeConnection!`
  - **용도**: 특정 테이블 내 노드 검색 및 페이지네이션

- [ ] `searchRelatedNodes` - 관련 노드 검색
  - **시그니처**: `(nodeId: ID!, relationTypes?: [String], depth?: Int = 1) → [NodeRelation!]!`
  - **용도**: 특정 노드와 연결된 관련 노드들 탐색

- [ ] `searchTemplates` - 템플릿 검색
  - **시그니처**: `(input: TemplateSearchInput!) → TemplateConnection!`
  - **용도**: 쿼리 템플릿 검색 및 필터링

### 데이터 집계 및 분석

- [ ] `aggregateData` - 노드 속성별 데이터 집계
  - **시그니처**: `(input: AggregationInput!) → [AggregationResult!]!`
  - **용도**: 테이블의 노드 데이터를 특정 필드로 집계 (status, success_rate, execution_time 등)
  - **구현**: 실제 노드 데이터 조회 후 필드별 그룹핑 및 통계값 계산
  - **반환값**: `{field, aggregationType, value, groupedBy: [{key, value, count}]}`
  - **⚠️ 주의**: 현재는 하드코딩된 시뮬레이션 데이터 반환, 실제 분석 로직과 SQL 스키마 미구현

- [ ] `analyzeNodes` - 그래프 네트워크 구조 분석
  - **시그니처**: `(input: NodeAnalyticsInput!) → NodeAnalyticsResult!`  
  - **용도**: 노드-관계 그래프의 네트워크 구조, 중심성, 밀도, 성장 패턴 종합 분석
  - **구현**: NodeAnalyticsUseCase를 통해 중심성(centrality), 클러스터링, PageRank 계산
  - **반환값**: `{tableAnalytics, nodeMetrics[], qualityScores[], recommendations[]}`
  - **⚠️ 주의**: 최대 10,000개 노드/관계 처리, 필터링 및 시간 범위 지원
  - **⚠️ 미완성**: 그래프 분석 알고리즘과 메트릭 계산을 위한 SQL 스키마 및 인덱스 미구현

- [ ] ~~`findPathsBetweenNodes`~~ - **🗑️ 제거 대상**
  - **시그니처**: `(tableId: ID!, startNodeIds: [ID!]!, endNodeIds: [ID!]!, maxDepth?: Int) → [NodePath!]!`
  - **용도**: 노드 간 연결 경로 탐색
  - **❌ 문제점**: 목적 불분명, 현재 구현이 단순한 dependency 조회로만 작동 (TODO 주석 존재)
  - **🔄 대안**: `searchRelatedNodes`와 `getDependencyChain`으로 충분히 대체 가능

- [ ] `getDependencyChain` - 종속성 체인 조회
  - **시그니처**: `(nodeId: ID!, direction: DependencyDirection = OUTGOING) → DependencyChain!`
  - **용도**: 노드의 종속성 관계 체인 추적

### 노드 관리

- [ ] `node` - 단일 노드 조회
  - **시그니처**: `(id: ID!) → Node`
  - **용도**: ID로 특정 노드 상세 정보 조회

- [ ] `nodes` - 노드 목록 조회
  - **시그니처**: `(tableId: ID!, first?: Int, after?: String) → NodeConnection!`
  - **용도**: 테이블별 노드 목록 조회 및 페이지네이션

- [ ] `nodeByContent` - 컨텐츠로 노드 조회
  - **시그니처**: `(tableId: ID!, content: String!) → Node`
  - **용도**: 컨텐츠 값으로 노드 검색

- [ ] ~~`previewNodeCreation`~~ - **🗑️ 제거 대상**
  - **시그니처**: `(input: PreviewNodeInput!) → NodeCreationPreview!`
  - **용도**: 노드 생성 전 미리보기 및 검증
  - **❌ 문제점**: 목적과 필요성 불분명, 구현체 없음 (GraphQL 스키마만 존재)
  - **🔄 대안**: 클라이언트 사이드 검증 또는 `createNode` 시 바로 검증하는 것으로 충분

### 관계 관리

- [ ] `nodeRelation` - 단일 노드 관계 조회
  - **시그니처**: `(id: ID!) → NodeRelation`
  - **용도**: 특정 관계 상세 정보 조회

- [ ] `nodeRelations` - 노드 관계 목록 조회
  - **시그니처**: `(nodeId?: ID, tableId?: ID, first?: Int) → NodeRelationConnection!`
  - **용도**: 노드 또는 테이블별 관계 목록 조회

- [ ] `relationType` - 관계 타입 조회
  - **시그니처**: `(id: ID!) → RelationType`
  - **용도**: 특정 관계 타입 정보 조회

- [ ] `relationTypes` - 관계 타입 목록 조회
  - **시그니처**: `() → [RelationType!]!`
  - **용도**: 시스템에 정의된 모든 관계 타입 조회

### 속성 스키마 관리 (메타데이터)

- [ ] `attribute` - 테이블 속성 정의 조회  
  - **시그니처**: `(id: ID!) → Attribute`
  - **용도**: 특정 속성의 스키마 정의 조회 (타입, 필수여부, 검증규칙 등)
  - **🎯 실사용**: 폼 생성, 검증 로직 구성 시 메타데이터 조회

- [ ] `attributes` - 테이블별 속성 정의 목록
  - **시그니처**: `(tableId: ID!) → [Attribute!]!`
  - **용도**: 테이블이 가진 모든 속성 스키마 조회
  - **🎯 실사용**: 테이블 스키마 조회, 동적 폼 생성용
  - **⚠️ 주의**: 실제 노드 데이터가 아닌 속성 정의(메타데이터)만 반환

- [ ] `attributeType` - 속성 데이터 타입 조회
  - **시그니처**: `(id: ID!) → AttributeType`  
  - **용도**: 속성 데이터 타입 정보 (JSON 스키마, 검증규칙, 기본값)

- [ ] `attributeTypes` - 전체 속성 타입 목록
  - **시그니처**: `() → [AttributeType!]!`
  - **용도**: 사용 가능한 모든 속성 타입 조회 (속성 생성 시 선택용)

- [ ] `attributeTypeByIdentifier` - 식별자로 속성 타입 조회
  - **시그니거**: `(identifier: String!) → AttributeType`
  - **용도**: 타입 식별자 기반 속성 타입 검색

### 테이블 관리

- [ ] `table` - 단일 테이블 조회
  - **시그니처**: `(id: ID!) → Table`
  - **용도**: 특정 테이블 상세 정보 조회

- [ ] `tables` - 테이블 목록 조회
  - **시그니처**: `(first?: Int, after?: String, filter?: TableFilter) → TableConnection!`
  - **용도**: 테이블 목록 조회 및 페이지네이션

- [ ] `tableByIdentifier` - 식별자로 테이블 조회
  - **시그니처**: `(identifier: String!) → Table`
  - **용도**: 식별자 문자열로 테이블 검색

### 템플릿 관리

- [ ] `executeTemplate` - 템플릿 실행 (Query)
  - **시그니처**: `(input: ExecuteTemplateInput!) → TemplateExecutionResult!`
  - **용도**: 읽기 전용 템플릿 실행 및 결과 반환

- [ ] `getTemplate` - 템플릿 조회
  - **시그니처**: `(id: ID!) → QueryTemplate`
  - **용도**: 특정 템플릿 상세 정보 조회

- [ ] `getTemplateByIdentifier` - 식별자로 템플릿 조회
  - **시그니처**: `(identifier: String!) → QueryTemplate`
  - **용도**: 식별자로 템플릿 검색

- [ ] `getPopularTemplates` - 인기 템플릿 조회
  - **시그니처**: `(limit?: Int = 10) → [QueryTemplate!]!`
  - **용도**: 사용량 기준 인기 템플릿 조회

### 내보내기

- [ ] `exportAllTables` - 모든 테이블 내보내기
  - **시그니처**: `() → ExportResult!`
  - **용도**: 전체 스키마 및 데이터 내보내기

- [ ] `exportTable` - 단일 테이블 내보내기
  - **시그니처**: `(tableId: ID!, format?: ExportFormat = JSON) → ExportResult!`
  - **용도**: 특정 테이블의 스키마 및 데이터 내보내기

### 모니터링 및 메트릭 - **🚧 모두 구현 예정** (Mock 데이터만 제공)

- [ ] ~~`getAlertRules`~~ - **🗑️ 제거 대상**
  - **시그니처**: `() → [AlertRule!]!`
  - **용도**: 시스템 알림 규칙 목록 조회
  - **❌ 문제점**: 비즈니스 요구사항에 없는 불필요한 기능, Mock 데이터만 존재
  - **🔄 대안**: 외부 모니터링 시스템(Prometheus, Grafana 등) 사용 권장

- [ ] `getMonitoringMetrics` - 모니터링 메트릭 조회
  - **시그니처**: `(input: MetricsInput!) → MonitoringMetrics!`
  - **용도**: 시스템 모니터링 지표 조회
  - **🚧 구현 상태**: Mock 메트릭 데이터, 실제 수집 시스템 미구현

- [ ] `getPerformanceMetrics` - 성능 메트릭 조회
  - **시그니처**: `(input: PerformanceMetricsInput!) → PerformanceMetrics!`
  - **용도**: 쿼리 응답 시간, 캐시 적중률, 인덱스 효율성 등 성능 지표 조회
  - **🚧 구현 상태**: 하드코딩된 Mock 데이터 반환, 실제 성능 모니터링 미구현

- [ ] `getSearchPerformanceMetrics` - 검색 성능 메트릭 조회
  - **시그니처**: `(input: SearchMetricsInput!) → SearchPerformanceMetrics!`
  - **용도**: 검색 기능별 성능 지표 조회
  - **🚧 구현 상태**: 구현체 없음, 스키마만 존재

### 시스템 상태 - **🚧 부분 구현 예정** (Mock 데이터 위주)

- [ ] `health` - 헬스 체크
  - **시그니처**: `() → HealthStatus!`
  - **용도**: 시스템 기본 상태 확인
  - **✅ 구현 완료**: 실제 상태 체크 동작

- [ ] `getSystemHealth` - 시스템 건강 상태 조회
  - **시그니처**: `(tableId: ID!) → SystemHealth!`
  - **용도**: 데이터베이스 크기, 메모리 사용량, 연결 상태 등 상세 진단
  - **🚧 구현 상태**: Mock 건강도 데이터, 실제 시스템 메트릭 미연결

- [ ] `getSystemStatus` - 시스템 상태 조회
  - **시그니처**: `() → SystemStatus!`
  - **용도**: 시스템 구성 요소별 상태 조회
  - **🚧 구현 상태**: Mock 상태 정보, 실제 시스템 모니터링 미구현

- [ ] `getTestSuiteStatus` - 테스트 스위트 상태 조회
  - **시그니처**: `(input: TestSuiteInput!) → [TestSuiteStatus!]!`
  - **용도**: 자동화 테스트 결과 및 상태 조회
  - **🚧 구현 상태**: Mock 테스트 결과 데이터, 실제 테스트 시스템 미연결

---

## ✏️ Mutation (변경 기능)

### 노드 작업

- [ ] `createNode` - 노드 생성
  - **시그니처**: `(input: CreateNodeInput!) → CreateNodePayload!`
  - **용도**: 새 노드 생성 및 초기 속성 설정
  - **주의**: 테이블 write 권한 필요

- [ ] `updateNode` - 노드 수정
  - **시그니처**: `(id: ID!, input: UpdateNodeInput!) → UpdateNodePayload!`
  - **용도**: 기존 노드의 컨텐츠 및 메타데이터 수정

- [ ] `deleteNode` - 노드 삭제
  - **시그니처**: `(id: ID!) → DeleteNodePayload!`
  - **용도**: 노드 및 관련 데이터 완전 삭제
  - **주의**: 연관된 관계도 함께 삭제됨

- [ ] `setNodeAttribute` - 노드 속성 설정
  - **시그니처**: `(nodeId: ID!, attributeId: ID!, value: String!) → SetNodeAttributePayload!`
  - **용도**: 노드에 특정 속성 값 설정 또는 수정

- [ ] `removeNodeAttribute` - 노드 속성 제거
  - **시그니처**: `(nodeId: ID!, attributeId: ID!) → RemoveNodeAttributePayload!`
  - **용도**: 노드에서 특정 속성 제거

### 관계 작업

- [ ] `createRelation` - 관계 생성
  - **시그니처**: `(input: CreateRelationInput!) → CreateRelationPayload!`
  - **용도**: 두 노드 간 새로운 관계 생성

- [ ] `deleteRelation` - 관계 삭제
  - **시그니처**: `(id: ID!) → DeleteRelationPayload!`
  - **용도**: 특정 관계 제거

- [ ] `createRelationType` - 관계 타입 생성
  - **시그니처**: `(input: CreateRelationTypeInput!) → CreateRelationTypePayload!`
  - **용도**: 새로운 관계 타입 정의 생성

### 속성 작업

- [ ] `createAttribute` - 속성 생성
  - **시그니처**: `(input: CreateAttributeInput!) → CreateAttributePayload!`
  - **용도**: 테이블에 새 속성 정의 추가

- [ ] `updateAttribute` - 속성 수정
  - **시그니처**: `(id: ID!, input: UpdateAttributeInput!) → UpdateAttributePayload!`
  - **용도**: 기존 속성 정의 수정

- [ ] `deleteAttribute` - 속성 삭제
  - **시그니처**: `(id: ID!) → DeleteAttributePayload!`
  - **용도**: 속성 정의 제거
  - **주의**: 연관된 노드 속성 값들도 함께 삭제

- [ ] `createAttributeType` - 속성 타입 생성
  - **시그니처**: `(input: CreateAttributeTypeInput!) → CreateAttributeTypePayload!`
  - **용도**: 새로운 속성 타입 정의 생성

- [ ] `updateAttributeType` - 속성 타입 수정
  - **시그니처**: `(id: ID!, input: UpdateAttributeTypeInput!) → UpdateAttributeTypePayload!`
  - **용도**: 기존 속성 타입 정의 수정

- [ ] `deleteAttributeType` - 속성 타입 삭제
  - **시그니처**: `(id: ID!) → DeleteAttributeTypePayload!`
  - **용도**: 속성 타입 정의 제거
  - **주의**: 사용 중인 속성이 있으면 삭제 불가

### 테이블 작업

- [ ] `createTable` - 테이블 생성
  - **시그니처**: `(input: CreateTableInput!) → CreateTablePayload!`
  - **용도**: 새로운 데이터 테이블 생성

- [ ] `updateTable` - 테이블 수정
  - **시그니처**: `(id: ID!, input: UpdateTableInput!) → UpdateTablePayload!`
  - **용도**: 테이블 메타데이터 수정

- [ ] `deleteTable` - 테이블 삭제
  - **시그니처**: `(id: ID!) → DeleteTablePayload!`
  - **용도**: 테이블 및 모든 연관 데이터 삭제
  - **주의**: 복구 불가능한 완전 삭제

### 템플릿 작업

- [ ] `createTemplate` - 템플릿 생성
  - **시그니처**: `(input: CreateTemplateInput!) → CreateTemplatePayload!`
  - **용도**: 새로운 쿼리 템플릿 생성

- [ ] `updateTemplate` - 템플릿 수정
  - **시그니처**: `(id: ID!, input: UpdateTemplateInput!) → UpdateTemplatePayload!`
  - **용도**: 기존 템플릿 내용 또는 메타데이터 수정

- [ ] `deleteTemplate` - 템플릿 삭제
  - **시그니처**: `(id: ID!) → DeleteTemplatePayload!`
  - **용도**: 템플릿 제거

- [ ] `executeTemplate` - 템플릿 실행 (Mutation)
  - **시그니처**: `(input: ExecuteTemplateInput!) → TemplateExecutionResult!`
  - **용도**: 데이터 변경이 포함된 템플릿 실행

- [ ] `activateTemplate` - 템플릿 활성화
  - **시그니처**: `(id: ID!) → ActivateTemplatePayload!`
  - **용도**: 비활성 템플릿을 활성 상태로 전환

- [ ] `deactivateTemplate` - 템플릿 비활성화
  - **시그니처**: `(id: ID!) → DeactivateTemplatePayload!`
  - **용도**: 활성 템플릿을 비활성 상태로 전환

### ~~알림 규칙~~ - **🗑️ 전체 제거 대상**

- [ ] ~~`createAlertRule`~~ - **🗑️ 제거 대상**
  - **시그니처**: `(input: CreateAlertRuleInput!) → CreateAlertRulePayload!`
  - **용도**: 새로운 시스템 알림 규칙 생성
  - **❌ 문제점**: 비즈니스 요구사항에 없는 불필요한 기능, 외부 시스템으로 대체 가능

- [ ] ~~`updateAlertRule`~~ - **🗑️ 제거 대상**
  - **시그니처**: `(id: ID!, input: UpdateAlertRuleInput!) → UpdateAlertRulePayload!`
  - **용도**: 기존 알림 규칙 수정
  - **❌ 문제점**: 비즈니스 요구사항에 없는 불필요한 기능, 외부 시스템으로 대체 가능

- [ ] ~~`deleteAlertRule`~~ - **🗑️ 제거 대상**
  - **시그니처**: `(id: ID!) → DeleteAlertRulePayload!`
  - **용도**: 알림 규칙 제거
  - **❌ 문제점**: 비즈니스 요구사항에 없는 불필요한 기능, 외부 시스템으로 대체 가능

### 시스템 작업

- [ ] `importSchema` - 스키마 가져오기
  - **시그니처**: `(input: ImportSchemaInput!) → ImportSchemaPayload!`
  - **용도**: 외부 스키마 파일 가져오기 및 적용
  - **주의**: 기존 데이터와 충돌 가능성

- [ ] `clearCache` - 캐시 지우기
  - **시그니처**: `(input: ClearCacheInput!) → ClearCachePayload!`
  - **용도**: 시스템 캐시 선택적 또는 전체 삭제

- [ ] `optimizeDatabase` - 데이터베이스 최적화
  - **시그니처**: `(input: OptimizeDatabaseInput!) → OptimizeDatabasePayload!`
  - **용도**: 데이터베이스 성능 최적화 실행

- [ ] `_empty` - 빈 뮤테이션
  - **시그니처**: `() → String`
  - **용도**: GraphQL 스키마 요구사항을 위한 플레이스홀더
  - **주의**: 실제 기능 없음

---

## 📡 Subscription (실시간 이벤트)

### 노드 이벤트

- [ ] `nodeCreated` - 노드 생성 이벤트
  - **시그니처**: `(tableId?: ID) → Node!`
  - **용도**: 새 노드 생성 시 실시간 알림

- [ ] `nodeUpdated` - 노드 업데이트 이벤트
  - **시그니처**: `(nodeId?: ID, tableId?: ID) → Node!`
  - **용도**: 노드 수정 시 실시간 알림

- [ ] `nodeDeleted` - 노드 삭제 이벤트
  - **시그니처**: `(tableId?: ID) → NodeDeletedEvent!`
  - **용도**: 노드 삭제 시 실시간 알림

### 테이블 이벤트

- [ ] `tableCreated` - 테이블 생성 이벤트
  - **시그니처**: `() → Table!`
  - **용도**: 새 테이블 생성 시 실시간 알림

- [ ] `tableUpdated` - 테이블 업데이트 이벤트
  - **시그니처**: `(tableId?: ID) → Table!`
  - **용도**: 테이블 메타데이터 변경 시 실시간 알림

- [ ] `tableDeleted` - 테이블 삭제 이벤트
  - **시그니처**: `() → TableDeletedEvent!`
  - **용도**: 테이블 삭제 시 실시간 알림

---

## 📊 리팩토링 가이드

### Query Resolver 분리 기준

**TableQueries**: `table`, `tables`, `tableByIdentifier`, `exportTable`, `exportAllTables`
**NodeQueries**: `node`, `nodes`, `nodeByContent`, `searchNodes`
  - *Node 하위 필드*: `node.attributes`, `node.attributeCount`
**RelationQueries**: `nodeRelation`, `nodeRelations`, `relationType`, `relationTypes`, `searchRelatedNodes`, `getDependencyChain`
**AttributeConfigQueries**: `attribute`, `attributes`, `attributeType`, `attributeTypes`, `attributeTypeByIdentifier`
  - *주 용도*: 테이블별 속성 스키마 관리 (메타데이터 조회)
**AnalyticsQueries**: `analyzeNodes`, `aggregateData`, `getPerformanceMetrics`, `getMonitoringMetrics`, `getSearchPerformanceMetrics`
**TemplateQueries**: `getTemplate`, `getTemplateByIdentifier`, `getPopularTemplates`, `searchTemplates`, `executeTemplate` (Query용)
**SystemQueries**: `health`, `getSystemHealth`, `getSystemStatus`, `getTestSuiteStatus`
**SearchQueries**: `advancedSearch`

### Mutation Resolver 분리 기준

**TableMutations**: `createTable`, `updateTable`, `deleteTable`
**NodeMutations**: `createNode`, `updateNode`, `deleteNode`, `setNodeAttribute`, `removeNodeAttribute`
**RelationMutations**: `createRelation`, `deleteRelation`, `createRelationType`
**AttributeMutations**: `createAttribute`, `updateAttribute`, `deleteAttribute`, `createAttributeType`, `updateAttributeType`, `deleteAttributeType`
**TemplateMutations**: `createTemplate`, `updateTemplate`, `deleteTemplate`, `activateTemplate`, `deactivateTemplate`, `executeTemplate` (Mutation용)
**SystemMutations**: `importSchema`, `clearCache`, `optimizeDatabase`, `_empty`

### Subscription Resolver 분리 기준

**NodeSubscriptions**: `nodeCreated`, `nodeUpdated`, `nodeDeleted`
**TableSubscriptions**: `tableCreated`, `tableUpdated`, `tableDeleted`

---

## 📝 다음 단계

이 체크리스트를 활용하여:

1. **현재 구현 상태 확인**: 각 기능의 구현 완료 여부 체크
2. **Resolver 분리 계획**: 위 가이드에 따라 클래스별 담당 기능 배분
3. **테스트 케이스 작성**: 각 기능별 테스트 시나리오 준비
4. **문서화 완성**: 각 기능의 상세 스펙 및 예제 작성

리팩토링 후에도 모든 기능이 정상 동작하는지 이 체크리스트를 통해 검증할 수 있습니다.
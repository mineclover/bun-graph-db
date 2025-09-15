# Template System Guide
## Comprehensive Template Management and User Scenarios

이 문서는 bun-graph-db의 템플릿 시스템을 종합적으로 설명하고, 사용자 시나리오별 템플릿 매칭 가이드를 제공합니다.

---

## 📋 목차

- [시스템 개요](#시스템-개요)
- [템플릿 분류 체계](#템플릿-분류-체계)
- [사용자 시나리오별 가이드](#사용자-시나리오별-가이드)
- [새로 생성된 템플릿](#새로-생성된-템플릿)
- [템플릿 관리 도구](#템플릿-관리-도구)
- [성능 및 최적화](#성능-및-최적화)

---

## 🎯 시스템 개요

### 현재 템플릿 현황 (2025-09-15 기준)

**총 템플릿 수**: 72개 (65개 기존 + 7개 신규 생성)

**커버리지 분석 결과**:
- ✅ **Well Covered (≥80%)**: 기본 CRUD 작업, 테이블 관리, 기본 쿼리
- ⚠️ **Partially Covered (50-79%)**: 성능 모니터링, 데이터 검증
- ❌ **Poorly Covered (<50%)**: 대량 데이터 처리, 고급 분석, 실시간 기능

### 템플릿 우선순위 체계

```yaml
Critical Templates (핵심 기능):
  - health-check: 시스템 상태 확인
  - create/get/list operations: 기본 CRUD
  - template management: 템플릿 자체 관리

High Priority (자주 사용):
  - bulk-data-import: 대량 데이터 가져오기 ⭐ NEW
  - real-time-monitoring: 실시간 모니터링 ⭐ NEW
  - search-templates-advanced: 고급 템플릿 검색
  - list-tables-with-pagination: 페이지네이션 테이블 목록

Medium Priority (정기 사용):
  - data-validation: 데이터 무결성 검증 👍 NEW
  - advanced-analytics: 고급 그래프 분석 👍 NEW
  - query-optimization: 쿼리 성능 최적화 👍 NEW
  - data-export: 데이터 내보내기 👍 NEW
  - user-management: 사용자 권한 관리 👍 NEW

Low Priority (가끔 사용):
  - backup-restore: 백업 및 복원 (미구현)
  - schema-evolution: 스키마 진화 (미구현)
  - collaborative-editing: 협업 편집 (미구현)
```

---

## 📚 템플릿 분류 체계

### 1. CRUD Operations (생성/읽기/수정/삭제)
**카테고리 우선순위**: 6/10

#### 핵심 템플릿
- **create-table**: 새 테이블 생성
- **test-create-node**: 노드 생성 테스트
- **create-attribute-with-type**: 타입별 속성 생성
- **create-template-basic**: 기본 템플릿 생성 ⭐ 높은 우선순위
- **delete-template-by-id**: 템플릿 삭제

#### 사용 예시
```graphql
# 새 테이블 생성
mutation CreateTable($input: CreateTableInput!) {
  createTable(input: $input) {
    success
    table { id identifier description }
    errors { message }
  }
}

# 노드 생성
mutation CreateNode($input: CreateNodeInput!) {
  createNode(input: $input) {
    success
    node { id title content }
    errors { message }
  }
}
```

### 2. Query Operations (조회 및 검색)
**카테고리 우선순위**: 9/10

#### 핵심 템플릿
- **search-templates-advanced**: 고급 템플릿 검색 ⭐ 높은 우선순위
- **list-tables-with-pagination**: 페이지네이션 테이블 목록 ⭐ 높은 우선순위
- **test-search-nodes**: 노드 검색 테스트
- **list-all-attribute-types**: 속성 타입 목록
- **list-nodes-by-table**: 테이블별 노드 목록

#### 고급 검색 기능
```graphql
# 고급 템플릿 검색
query SearchTemplates($filter: TemplateSearchFilter!, $pagination: PaginationInput) {
  searchTemplates(filter: $filter, pagination: $pagination) {
    templates {
      identifier name description tags
      operationType complexityScore usageCount
    }
    totalCount
    pagination { hasNextPage hasPreviousPage }
  }
}
```

### 3. Table Operations (테이블 관리)
**카테고리 우선순위**: 8/10

#### 핵심 템플릿
- **get-table-schema**: 테이블 스키마 조회 ⭐ 높은 우선순위
- **get-table-detailed-statistics**: 상세 테이블 통계
- **get-table-attributes-by-id**: ID별 테이블 속성
- **test-get-table**: 테이블 기본 조회

#### 스키마 분석 예시
```graphql
# 종합 테이블 스키마 조회
query GetTableSchema($tableId: ID!) {
  getTable(id: $tableId) {
    id identifier description
    attributes {
      name type description
      constraints validationRules
    }
    relationships { type targetTable strength }
    sampleNodes { id title content }
    statistics { nodeCount relationCount avgConnectivity }
  }
}
```

### 4. Template Management (템플릿 관리)
**카테고리 우선순위**: 10/10 (최고 우선순위)

#### 핵심 템플릿
- **execute-template-with-variables**: 변수로 템플릿 실행 ⭐ 높은 우선순위
- **execute-template-with-graphql**: GraphQL 템플릿 실행
- **template-create-new-template**: 새 템플릿 생성

#### 동적 실행 예시
```graphql
# 템플릿 동적 실행
mutation ExecuteTemplate($identifier: String!, $variables: JSON) {
  executeTemplateWithGraphQL(identifier: $identifier, variables: $variables) {
    success
    result
    executionTime
    errors { message }
  }
}
```

### 5. Node Operations (노드 관리)
**카테고리 우선순위**: 7/10

#### 핵심 템플릿
- **test-get-node**: 노드 기본 조회

---

## 🎯 사용자 시나리오별 가이드

### 1. 대량 데이터 마이그레이션 시나리오
**시나리오**: CSV/JSON 파일에서 수천 개의 노드를 한번에 생성

#### 🆕 새 템플릿: `bulk-data-import`
**우선순위**: ⭐ High | **노력**: Large | **상태**: 완료

```graphql
mutation BulkImport($input: BulkImportInput!) {
  bulkImport(input: $input) {
    success
    processedCount
    totalCount
    errors { line message severity }
    progress { percentage estimatedTimeRemaining }
    summary { created updated skipped failed }
  }
}
```

**사용법**:
```javascript
const variables = {
  input: {
    format: 'JSON',
    data: [
      { title: 'Node 1', content: 'Content 1', tableId: 'table-1' },
      { title: 'Node 2', content: 'Content 2', tableId: 'table-1' }
    ],
    options: {
      skipErrors: true,
      batchSize: 100
    }
  }
}
```

#### 관련 템플릿
- **create-template-basic**: 커스텀 가져오기 템플릿 생성
- **data-validation**: 가져온 데이터 검증

### 2. 실시간 시스템 모니터링 시나리오
**시나리오**: 시스템 성능과 데이터베이스 상태를 실시간으로 모니터링

#### 🆕 새 템플릿: `real-time-monitoring`
**우선순위**: ⭐ High | **노력**: Large | **상태**: 완료

```graphql
subscription SystemMonitoring($metrics: [MetricType!]) {
  systemMetrics(metrics: $metrics) {
    timestamp
    server {
      cpu { usage loadAverage cores }
      memory { used total percentage available }
      disk { used total percentage }
    }
    database {
      connections { active idle total }
      performance { queriesPerSecond avgQueryTime slowQueries }
      storage { size tables indexes }
    }
    alerts { level message timestamp component }
  }
}
```

**사용법**:
```javascript
const variables = {
  metrics: ['CPU', 'MEMORY', 'DATABASE', 'PERFORMANCE']
}
```

#### 관련 템플릿
- **simple-health-check**: 기본 상태 확인
- **get-system-statistics**: 시스템 통계

### 3. 데이터 품질 관리 시나리오
**시나리오**: 데이터 무결성 검증 및 품질 관리

#### 🆕 새 템플릿: `data-validation`
**우선순위**: 👍 Medium | **노력**: Medium | **상태**: 완료

```graphql
query ValidateDataIntegrity($options: ValidationOptions) {
  validateDataIntegrity(options: $options) {
    isValid
    summary { totalChecks passedChecks failedChecks warningCount }
    issues {
      type severity message
      affectedNodes { id table title }
      recommendation fixable
    }
    checks {
      orphanNodes { count samples }
      duplicateData { count duplicateGroups }
      schemaViolations { count violations }
      brokenRelations { count samples }
    }
  }
}
```

#### 관련 템플릿
- **schema-introspection**: 스키마 분석
- **get-table-schema**: 테이블 스키마 검증

### 4. 고급 데이터 분석 시나리오
**시나리오**: 그래프 중심성 분석, 클러스터링, 경로 최적화

#### 🆕 새 템플릿: `advanced-analytics`
**우선순위**: 👍 Medium | **노력**: Large | **상태**: 완료

```graphql
query GraphAnalytics($analysisType: AnalysisType!, $parameters: AnalysisParameters) {
  graphAnalytics(type: $analysisType, parameters: $parameters) {
    type executionTime
    results {
      ... on CentralityAnalysis {
        algorithm
        nodes { id title score rank }
        statistics { min max average median }
      }
      ... on ClusteringAnalysis {
        algorithm
        clusters { id size density nodes centroids }
        modularity silhouetteScore
      }
      ... on PathAnalysis {
        algorithm
        paths { source target length weight nodes }
        statistics { shortestPath longestPath averageLength }
      }
    }
    insights { keyFindings recommendations visualizationData }
  }
}
```

**분석 타입**:
- `CENTRALITY`: 중심성 분석 (Betweenness, Closeness, PageRank)
- `CLUSTERING`: 클러스터링 (Community Detection, K-means)
- `PATH_ANALYSIS`: 경로 분석 (Shortest Path, All Paths)

### 5. 데이터 내보내기 시나리오
**시나리오**: 다양한 형식으로 데이터 내보내기

#### 🆕 새 템플릿: `data-export`
**우선순위**: 👍 Medium | **노력**: Medium | **상태**: 완료

```graphql
mutation ExportData($format: ExportFormat!, $options: ExportOptions!) {
  exportData(format: $format, options: $options) {
    success exportId format downloadUrl fileSize recordCount
    progress { percentage stage estimatedCompletion }
    metadata {
      exportedAt
      schema { tables relations attributes }
      statistics { nodeCount relationCount tableCount }
    }
    errors { message severity affectedRecords }
  }
}
```

**지원 형식**:
- `JSON`: 구조화된 JSON 형식
- `CSV`: 테이블형 CSV 형식
- `GRAPHML`: 그래프 분석 도구용 GraphML
- `CYPHER`: Neo4j Cypher 스크립트

### 6. 성능 최적화 시나리오
**시나리오**: 느린 쿼리 최적화 및 성능 튜닝

#### 🆕 새 템플릿: `query-optimization`
**우선순위**: 👍 Medium | **노력**: Large | **상태**: 완료

```graphql
query OptimizeQueries($options: OptimizationOptions) {
  queryOptimization(options: $options) {
    analysis {
      slowQueries {
        query avgExecutionTime executionCount lastExecuted
        optimization { currentPlan suggestedPlan expectedImprovement }
      }
      indexRecommendations {
        table columns type estimatedImprovement
        creationCost maintenanceCost
      }
      performanceBottlenecks {
        type description severity impact solution
      }
    }
    recommendations {
      immediate { action description expectedGain effort }
      longTerm { action description expectedGain effort }
    }
    metrics {
      currentPerformance { avgQueryTime queriesPerSecond cacheHitRate }
      projectedPerformance { avgQueryTime queriesPerSecond cacheHitRate }
    }
  }
}
```

### 7. 템플릿 생명주기 관리 시나리오
**시나리오**: 템플릿의 생성부터 삭제까지 전체 생명주기 관리 및 버전 관리

#### 🆕 새 템플릿: `template-lifecycle-management`
**우선순위**: 👍 Medium | **노력**: Medium | **상태**: 완료

```graphql
query TemplateLifecycleManagement($templateId: ID, $operation: LifecycleOperation!) {
  templateLifecycle(templateId: $templateId, operation: $operation) {
    template {
      id identifier name version status
      createdAt updatedAt lastUsedAt usageCount
    }
    lifecycle {
      currentStage possibleTransitions
      history { stage timestamp performedBy reason }
    }
    dependencies {
      dependsOn { id identifier name relationship }
      dependentTemplates { id identifier name relationship }
    }
    analytics {
      usageStats {
        totalExecutions successRate avgExecutionTime
        lastWeekUsage popularVariables
      }
      performance { complexity executionTrend errorPatterns }
    }
    recommendations { optimization archiving deprecation migration }
  }
}
```

**생명주기 단계**:
- `ACTIVE`: 활성 사용 중
- `DEPRECATED`: 사용 중단 예정
- `ARCHIVED`: 보관된 상태
- `DELETED`: 삭제됨

---

## 🛠️ 템플릿 관리 도구

### 1. 템플릿 분석기 (`scripts/graphql-template-analyzer.ts`)

```bash
# 전체 템플릿 분석
bun scripts/graphql-template-analyzer.ts

# 성능 테스트 포함
bun scripts/graphql-template-analyzer.ts --test-execution
```

**분석 결과**:
- 📊 65개 템플릿 중 42개 (65%) 실행 성공
- ⚡ 평균 실행 시간: <2ms
- 🎯 재사용성 점수: 평균 4.2/10

### 2. 갭 분석기 (`docs/template-user-scenarios.md`)

```bash
# 사용자 시나리오 갭 분석
bun docs/template-user-scenarios.md
```

**갭 분석 결과**:
- ❌ 10개 시나리오 중 10개 (100%) 커버리지 부족
- 💡 7개 우선순위 템플릿 생성 완료
- 📝 3개 저우선순위 템플릿 미구현

### 3. 신규 템플릿 생성기 (`scripts/create-missing-templates.ts`)

```bash
# 모든 우선순위 템플릿 생성
bun scripts/create-missing-templates.ts all

# 높은 우선순위만 생성
bun scripts/create-missing-templates.ts high

# 사용 가능한 템플릿 목록
bun scripts/create-missing-templates.ts list
```

### 4. 코어 템플릿 관리자 (`scripts/core-template-manager.ts`)

```bash
# 코어 템플릿 초기화
bun scripts/core-template-manager.ts init

# 코어 템플릿 등록
bun scripts/core-template-manager.ts register template-id

# 관리 보고서 생성
bun scripts/core-template-manager.ts report
```

### 5. 템플릿 등록 관리자 (`scripts/template-registration.ts`)

```bash
# 새 템플릿 등록
bun scripts/template-registration.ts register "template-id" "Template Name" "query { ... }"

# 배치 등록
bun scripts/template-registration.ts batch

# 템플릿 삭제
bun scripts/template-registration.ts delete template-id
```

---

## 📈 성능 및 최적화

### 현재 성능 지표

```yaml
템플릿 실행 성능:
  평균 응답 시간: <2ms
  성공률: 65% (42/65 템플릿)
  최고 성능: <1ms (simple queries)
  최저 성능: ~50ms (complex analytics)

템플릿 관리 성능:
  검색 속도: <10ms
  생성 속도: <100ms
  배치 처리: 100% 성공률
```

### 최적화 권장사항

#### 1. 쿼리 최적화
```yaml
즉시 개선 가능:
  - 인덱스 추가: table_id, identifier 컬럼
  - 쿼리 캐싱: 자주 사용되는 템플릿
  - 배치 크기 조정: 대량 처리 시 100-500개

장기 개선:
  - GraphQL 쿼리 플래닝 최적화
  - 데이터베이스 샤딩 고려
  - 템플릿 pre-compilation
```

#### 2. 시스템 모니터링
```yaml
모니터링 지표:
  - 템플릿 실행 시간
  - 메모리 사용량
  - 동시 실행 수
  - 오류율

알림 설정:
  - 평균 응답 시간 > 10ms
  - 오류율 > 5%
  - 메모리 사용량 > 80%
```

### 확장성 고려사항

#### 1. 수평 확장
- GraphQL 서버 로드 밸런싱
- 읽기 전용 복제본 활용
- 템플릿 캐시 분산

#### 2. 수직 확장
- 데이터베이스 인덱스 최적화
- 메모리 기반 캐싱 증대
- SSD 스토리지 활용

---

## 🔮 향후 개발 계획

### Phase 1: 기본 기능 완성 (완료)
- ✅ 핵심 CRUD 템플릿
- ✅ 기본 검색 및 조회
- ✅ 템플릿 관리 시스템

### Phase 2: 고급 기능 (진행 중)
- ✅ 대량 데이터 처리
- ✅ 실시간 모니터링
- ✅ 데이터 품질 관리
- ✅ 고급 분석 기능

### Phase 3: 엔터프라이즈 기능 (계획)
- 📝 백업 및 복원 시스템
- 📝 스키마 진화 관리
- 📝 협업 편집 기능
- 📝 고급 보안 및 감사

### Phase 4: AI/ML 통합 (미래)
- 🔮 자동 템플릿 최적화
- 🔮 이상 탐지 및 예측
- 🔮 자연어 쿼리 변환
- 🔮 지능형 데이터 추천

---

## 📞 지원 및 문의

### 문제 해결
- **템플릿 실행 오류**: `scripts/graphql-template-analyzer.ts` 실행으로 진단
- **성능 이슈**: `real-time-monitoring` 템플릿으로 모니터링
- **데이터 품질**: `data-validation` 템플릿으로 검증

### 개발자 리소스
- **GraphQL 스키마**: `src/presentation/graphql/schema/`
- **템플릿 정의**: `demo/templates/`
- **설정 파일**: `config/core-templates.json`
- **테스트**: `tests/template-indexing/`

---

*이 문서는 템플릿 시스템의 발전에 따라 지속적으로 업데이트됩니다.*

**마지막 업데이트**: 2025-09-15
**문서 버전**: 1.0.0
**템플릿 시스템 버전**: 72 templates (7 new)
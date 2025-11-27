# GraphQL API Documentation

bun-graph-db GraphQL API의 쿼리, 뮤테이션, 구독에 대한 종합 가이드

## 📚 문서 구조

### [🔍 Queries Index](./queries-index.md)
- **시스템 상태 조회**: 헬스체크, 시스템 메트릭
- **테이블 관리**: 테이블 조회, 분석, 관계 탐색
- **노드 관리**: 노드 검색, 관계 분석, 경로 탐색
- **속성 관리**: 속성 조회, 필터링
- **템플릿 관리**: 템플릿 검색, 테이블 의존성 관리
- **데이터 품질**: 데이터 검증, 성능 분석
- **검색 및 탐색**: 스마트 검색, 라이프사이클 관리

### [🛠️ Mutations Index](./mutations-index.md)
- **테이블 관리**: 테이블 생성, 수정
- **노드 관리**: 노드 CRUD, 대량 작업
- **속성 관리**: 속성 생성, 정의
- **관계 관리**: 관계 타입 및 연결 생성
- **템플릿 관리**: 템플릿 CRUD
- **데이터 관리**: 대량 가져오기/내보내기, 마이그레이션
- **시스템 관리**: 유지보수 작업

### [📡 Subscriptions Index](./subscriptions-index.md)
- **실시간 모니터링**: 시스템 메트릭, 성능 추적
- **데이터 변경 추적**: 노드 변경, 템플릿 실행 스트림
- **시스템 헬스**: 헬스 상태 실시간 모니터링

### [📤 JSON Export API](./JSON_EXPORT_API.md)
- **Flat JSON Export**: 간단한 배열 형태 내보내기
- **HFI Protocol Export**: 그래프 시각화 호환 형식
- **Patch Types**: 형식별 수정 타입 정의
- **Format Mapping**: 커스텀 출력 형식 변환

### [🔄 Format Mapping Guide](./FORMAT_MAPPING_GUIDE.md)
- **NodeLevelMapping**: 노드 단위 간소화 매핑 문법
- **JSONPath 주소 체계**: 필드 매핑 주소 시스템
- **Transform 함수**: 데이터 변환 (uppercase, date, json 등)
- **가이드 생성**: 매핑 문서 자동 생성 기능

### [⚡ Performance Monitor API](./PERFORMANCE_MONITOR_API.md)
- **Operation Timing**: 작업 시간 측정
- **Aggregated Metrics**: 통계 및 백분위수 (P50, P95, P99)
- **Slow Operation Detection**: 느린 작업 감지

## 🚀 빠른 시작

### GraphQL Playground 접속
```
http://localhost:4000/graphql
```

### 기본 헬스체크
```graphql
query HealthCheck {
  health {
    status
    timestamp
    database
    version
  }
}
```

### 테이블 목록 조회
```graphql
query GetTables {
  tables {
    nodes {
      id
      identifier
      description
      nodeCount
    }
    totalCount
  }
}
```

## 🎯 주요 기능별 가이드

### 1. 시스템 모니터링
```graphql
# 기본 상태 확인
query SystemHealth {
  health { status timestamp }
}

# 상세 메트릭 조회
query DetailedMetrics {
  systemMetrics {
    cpu { usage cores }
    memory { used total percentage }
    database {
      connections { active idle }
      performance { queriesPerSecond avgQueryTime }
    }
  }
}

# 실시간 모니터링 구독
subscription RealTimeMonitoring {
  systemMonitoring {
    timestamp
    cpu { usage }
    memory { percentage }
  }
}
```

### 2. 데이터 탐색
```graphql
# 테이블 검색
query SearchTables($filter: TablesFilter) {
  tables(filter: $filter) {
    nodes { id identifier description }
  }
}

# 노드 관계 탐색
query RelatedNodes($filter: SearchRelatedNodesFilter!) {
  searchRelatedNodes(filter: $filter) {
    id title relationshipType distance
  }
}

# 경로 탐색
query FindPaths($input: FindPathsInput!) {
  findPathsBetweenNodes(input: $input) {
    paths {
      nodes { id title }
      totalDistance
    }
  }
}
```

### 3. 템플릿 관리
```graphql
# 템플릿 검색
query SearchTemplates($filter: QueryTemplatesFilter) {
  searchTemplates(filter: $filter) {
    templates { id identifier name tags }
  }
}

# 테이블별 템플릿 조회 (새로운 기능)
query TemplatesByTable($tableName: String!) {
  templatesByTable(input: { tableName: $tableName }) {
    id identifier applicableTables
  }
}

# 템플릿 생성
mutation CreateTemplate($input: CreateQueryTemplateInput!) {
  createTemplate(input: $input) {
    success
    template { id identifier }
    errors { message }
  }
}
```

### 4. 데이터 작업
```graphql
# 노드 생성
mutation CreateNode($input: CreateNodeInput!) {
  createNode(input: $input) {
    success
    node { id title content }
    errors { message }
  }
}

# 대량 노드 생성
mutation BulkCreateNodes($input: BulkCreateNodesInput!) {
  bulkCreateNodes(input: $input) {
    success
    totalCreated
    totalFailed
    errors { index message }
  }
}

# 데이터 품질 검증
query ValidateDataQuality($scope: DataValidationScope!) {
  validateDataQuality(scope: $scope) {
    overallScore
    results { checkType status score }
  }
}
```

## 🔧 고급 기능

### 템플릿 테이블 의존성 (신규 기능)
```graphql
# 테이블 의존성이 있는 템플릿 조회
query TemplatesWithDependencies {
  templatesWithTableDependencies {
    id identifier applicableTables
  }
}

# 테이블별 템플릿 그룹화
query TableDependencyGroups {
  tableDependencyTemplates {
    tableName
    totalCount
    templates { id identifier }
  }
}
```

### 성능 분석
```graphql
# 쿼리 성능 분석
query AnalyzePerformance($timeRange: String!) {
  analyzeQueryPerformance(timeRange: $timeRange) {
    summary { totalQueries avgExecutionTime }
    slowQueries {
      query avgExecutionTime
      optimization { suggestions }
    }
  }
}
```

### 실시간 업데이트
```graphql
# 노드 변경 구독
subscription NodeChanges($nodeId: ID!) {
  nodeChanges(nodeId: $nodeId) {
    eventType
    node { id title updatedAt }
    timestamp
  }
}
```

## 📊 데이터 모델 이해

### 핵심 엔티티
- **Table**: 데이터 테이블 메타데이터
- **Node**: 실제 데이터 엔티티
- **Attribute**: 테이블/노드 속성 정의
- **QueryTemplate**: 재사용 가능한 쿼리 템플릿
- **Relation**: 엔티티 간 관계

### 관계 구조
```
Table 1:N Node
Table 1:N Attribute
Node M:N Node (via Relations)
QueryTemplate M:N Table (via applicableTables)
```

## ⚡ 최적화 가이드

### 쿼리 최적화
- 필요한 필드만 선택하여 over-fetching 방지
- 페이지네이션 활용으로 대량 데이터 효율적 처리
- 인덱스 활용을 위한 적절한 필터링

### 뮤테이션 최적화
- 대량 작업 시 배치 뮤테이션 활용
- 트랜잭션 경계 고려한 작업 단위 설정
- 오류 처리 및 롤백 계획 수립

### 구독 최적화
- 필요한 이벤트만 구독하여 네트워크 부하 최소화
- 클라이언트 연결 수 모니터링
- 적절한 구독 해제로 리소스 관리

## 🔒 보안 및 권한

### 인증 및 인가
- GraphQL 스키마 수준 권한 검증
- 민감한 데이터 접근 제어
- 구독 권한 관리

### 데이터 보호
- 입력 검증 및 sanitization
- SQL injection 방지
- 데이터 무결성 보장

## 🐛 디버깅 및 모니터링

### 로깅
- GraphQL 쿼리 실행 로그
- 성능 메트릭 수집
- 오류 추적 및 알림

### 개발 도구
- GraphQL Playground/GraphiQL
- 스키마 introspection
- 쿼리 분석 도구

---

## 📞 지원 및 문의

- **API 문서**: 각 인덱스 파일 참조
- **스키마 확인**: `http://localhost:4000/schema`
- **실시간 테스트**: `http://localhost:4000/graphql`

*최종 업데이트: 2025-11-27*
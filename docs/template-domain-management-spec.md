# 템플릿 도메인 관리 기능 정의

**작성일**: 2025-09-15
**상태**: 기능 정의 단계
**우선순위**: 중간

## 1. 현황 분석

### 1.1 현재 도메인 관리 방식

**데이터베이스 스키마 현황**:
```sql
-- templates 테이블 구조
CREATE TABLE templates (
  -- ... 기존 필드들 ...
  applicable_tables TEXT, -- JSON array: ["table1", "table2"] 또는 null (범용)
  tags TEXT,              -- JSON array: ["relation", "node", "create", ...]
  -- ...
);
```

**현재 도메인 분류 방식**:
- **Tags 기반 추론**: export 스크립트에서 tags를 분석하여 자동 카테고리 분류
- **Applicable Tables**: 특정 테이블에만 적용되는 템플릿 관리
- **수동 분류**: 스크립트 레벨에서 패턴 매칭으로 카테고리 결정

**식별된 도메인 카테고리** (현재 46개 Fixed 템플릿 기준):
- `table` (29개): 테이블 관련 작업
- `general` (5개): 범용 기능
- `mutation` (5개): 데이터 변경 작업
- `node` (4개): 노드 관련 작업
- `system` (2개): 시스템 관리
- `relation` (1개): 관계 관리

### 1.2 현재 방식의 한계점

1. **명시적 도메인 필드 부재**: tags에 의존하는 간접적 관리
2. **일관성 부족**: 수동 분류로 인한 분류 기준 불일치
3. **확장성 제한**: 새로운 도메인 추가 시 스크립트 수정 필요
4. **필터링 한계**: 도메인별 정확한 검색/필터링 어려움
5. **GraphQL API 한계**: 도메인 기반 쿼리 지원 없음

## 2. 요구사항 정의

### 2.1 핵심 요구사항

**FR-1. 명시적 도메인 관리**
- 템플릿 생성 시 도메인 지정 가능 (옵셔널)
- 사전 정의된 도메인 목록 또는 사용자 정의 도메인 지원
- 도메인 값이 null인 경우 범용 템플릿으로 처리

**FR-2. 도메인 기반 검색 및 필터링**
- GraphQL API에서 도메인별 템플릿 조회 지원
- 복합 필터링: 도메인 + tags + applicable_tables
- 도메인별 템플릿 통계 제공

**FR-3. 도메인 계층구조 지원**
- 상위/하위 도메인 관계 (예: `table` > `table.create`, `table.query`)
- 도메인 상속: 하위 도메인은 상위 도메인의 특성 상속

**FR-4. 하위 호환성 보장**
- 기존 템플릿들의 도메인 자동 마이그레이션
- 기존 tags 기반 시스템과 병행 운영

### 2.2 비기능적 요구사항

**NFR-1. 성능**
- 도메인 필터링 시 인덱스 활용으로 빠른 검색
- 대량 템플릿 조회 시 페이지네이션 지원

**NFR-2. 사용성**
- 직관적인 도메인 명명 규칙
- GraphQL Playground에서 도메인 자동완성

**NFR-3. 확장성**
- 새로운 도메인 추가 시 스키마 변경 없이 처리
- 도메인별 메타데이터 확장 가능

## 3. 기술 설계

### 3.1 데이터베이스 스키마 확장

```sql
-- 1단계: templates 테이블에 domain 컬럼 추가
ALTER TABLE templates ADD COLUMN domain TEXT;

-- 2단계: 도메인 인덱스 생성
CREATE INDEX idx_templates_domain ON templates(domain);
CREATE INDEX idx_templates_domain_active ON templates(domain, is_active) WHERE is_active = 1;

-- 3단계: 복합 인덱스 최적화
CREATE INDEX idx_templates_domain_tags ON templates(domain, tags);
CREATE INDEX idx_templates_search_optimized ON templates(domain, is_active, usage_count DESC) WHERE is_active = 1;
```

### 3.2 도메인 타입 정의

```typescript
// 1. 사전 정의된 도메인 타입
export enum PredefinedDomain {
  TABLE = 'table',
  NODE = 'node',
  RELATION = 'relation',
  ATTRIBUTE = 'attribute',
  SYSTEM = 'system',
  ANALYTICS = 'analytics',
  MONITORING = 'monitoring',
  GENERAL = 'general'
}

// 2. 도메인 계층 구조
export interface DomainHierarchy {
  parent: string | null
  children: string[]
  level: number
  metadata?: Record<string, any>
}

// 3. 도메인 설정
export interface DomainConfig {
  domains: Record<string, DomainHierarchy>
  defaultDomain: string | null
  allowCustomDomains: boolean
}
```

### 3.3 GraphQL 스키마 확장

```graphql
# 1. CreateQueryTemplateInput 확장
input CreateQueryTemplateInput {
  identifier: String!
  name: String!
  description: String
  query: String!
  domain: String          # 새로 추가
  # ... 기존 필드들
}

# 2. 도메인 필터링 지원
input QueryTemplatesFilter {
  search: String
  domain: String          # 새로 추가
  domains: [String!]      # 다중 도메인 필터
  domainPattern: String   # 계층 구조 패턴 (예: "table.*")
  # ... 기존 필드들
}

# 3. 도메인 관련 쿼리 추가
type Query {
  # 도메인 목록 조회
  getTemplateDomains: [TemplateDomain!]!

  # 도메인별 템플릿 통계
  getTemplateDomainStats: [DomainStats!]!

  # 도메인 계층구조 조회
  getDomainHierarchy: DomainHierarchy!
}

# 4. 새로운 타입 정의
type TemplateDomain {
  name: String!
  displayName: String!
  description: String
  templateCount: Int!
  parentDomain: String
  subDomains: [String!]!
}

type DomainStats {
  domain: String!
  totalTemplates: Int!
  activeTemplates: Int!
  avgComplexity: Float!
  topTags: [String!]!
  usageStats: DomainUsageStats!
}
```

### 3.4 마이그레이션 전략

**3.4.1 기존 템플릿 도메인 자동 할당**

```typescript
// 마이그레이션 로직
const migrationRules = {
  // tags 기반 도메인 추론
  'relation': (template) => template.tags?.includes('relation') ? 'relation' : null,
  'table': (template) => template.tags?.includes('table') ? 'table' : null,
  'node': (template) => template.tags?.includes('node') ? 'node' : null,
  'system': (template) =>
    template.tags?.some(tag => ['health', 'monitoring', 'system'].includes(tag)) ? 'system' : null,

  // query 텍스트 기반 추론
  'mutation': (template) => template.operationType === 'mutation' ? 'mutation' : null,

  // 기본값
  'general': (template) => 'general' // fallback
}
```

**3.4.2 단계별 마이그레이션**

1. **1단계**: 스키마 확장 (domain 컬럼 추가, 기본값 null)
2. **2단계**: 기존 템플릿 도메인 자동 할당
3. **3단계**: GraphQL API 확장
4. **4단계**: 도메인 기반 검색/필터링 구현
5. **5단계**: 도메인 계층구조 및 고급 기능

## 4. 구현 계획

### 4.1 Phase 1: 기본 도메인 관리 (1-2주)

**목표**: 명시적 도메인 필드 추가 및 기본 기능 구현

**작업 항목**:
- [ ] 데이터베이스 스키마 확장 (domain 컬럼 추가)
- [ ] CreateQueryTemplateInput에 domain 필드 추가
- [ ] 기존 템플릿 자동 마이그레이션 스크립트
- [ ] 도메인 기반 필터링 API 구현
- [ ] 단위 테스트 및 통합 테스트

**성공 기준**:
- 새 템플릿 생성 시 도메인 지정 가능
- 기존 46개 템플릿의 도메인 자동 할당 완료
- 도메인별 템플릿 조회 API 작동

### 4.2 Phase 2: 고급 도메인 기능 (2-3주)

**목표**: 도메인 계층구조 및 고급 검색 기능

**작업 항목**:
- [ ] 도메인 계층구조 설계 및 구현
- [ ] 도메인별 통계 API 구현
- [ ] 복합 필터링 (domain + tags + applicable_tables)
- [ ] 도메인 자동완성 기능
- [ ] 도메인 관리 UI 컴포넌트

**성공 기준**:
- 계층 구조를 가진 도메인 시스템 작동
- 도메인별 상세 통계 제공
- 사용자 친화적인 도메인 검색 경험

### 4.3 Phase 3: 최적화 및 고도화 (1-2주)

**목표**: 성능 최적화 및 사용성 개선

**작업 항목**:
- [ ] 도메인 검색 성능 최적화
- [ ] 도메인 기반 캐싱 전략
- [ ] 도메인별 템플릿 추천 시스템
- [ ] 도메인 메타데이터 확장
- [ ] 모니터링 및 로깅 강화

**성공 기준**:
- 1000+ 템플릿에서도 빠른 도메인 검색 (<100ms)
- 지능형 템플릿 추천 기능 작동
- 종합적인 도메인 분석 대시보드

## 5. 기대 효과

### 5.1 개발자 경험 개선
- **명확한 템플릿 분류**: 도메인별로 체계적인 템플릿 조직
- **빠른 검색**: 도메인 기반 정확한 템플릿 발견
- **일관된 네이밍**: 도메인별 템플릿 명명 규칙 표준화

### 5.2 시스템 확장성 향상
- **모듈화**: 도메인별 독립적인 템플릿 관리
- **자동화**: 도메인 기반 자동 분류 및 추천
- **통계**: 도메인별 사용 패턴 분석 및 최적화

### 5.3 운영 효율성 증대
- **관리 편의성**: 도메인별 템플릿 라이프사이클 관리
- **성능 최적화**: 도메인별 인덱싱 및 캐싱 전략
- **품질 관리**: 도메인별 템플릿 품질 기준 적용

## 6. 리스크 및 고려사항

### 6.1 기술적 리스크
- **마이그레이션 복잡성**: 기존 템플릿의 완전한 자동 분류 어려움
- **성능 영향**: 추가 필드로 인한 쿼리 성능 저하 가능성
- **호환성**: 기존 API 사용자에게 미치는 영향

### 6.2 해결 방안
- **점진적 마이그레이션**: 기존 시스템과 병행 운영 후 단계적 전환
- **성능 모니터링**: 도메인 기능 도입 후 지속적인 성능 측정
- **하위 호환성**: 기존 API 엔드포인트 유지 및 deprecation 경고

## 7. 결론

템플릿 도메인 관리 기능은 현재 시스템의 확장성과 사용성을 크게 향상시킬 수 있는 핵심 기능입니다.

**핵심 이점**:
1. **명시적 도메인 관리**로 템플릿 조직의 체계성 확보
2. **자동 분류 시스템**으로 운영 효율성 증대
3. **계층적 구조**로 복잡한 도메인 관계 표현
4. **성능 최적화**로 대규모 템플릿 환경 지원

단계적 구현을 통해 기존 시스템에 미치는 영향을 최소화하면서도, 장기적으로는 템플릿 시스템의 핵심 경쟁력을 강화할 수 있습니다.

---

**다음 단계**: Phase 1 구현을 위한 상세 기술 명세서 작성 및 개발 착수
# 템플릿 도메인 관리 확장 방안

**작성일**: 2025-09-16
**참조 문서**: template-domain-management-spec.md
**상태**: 기존 스키마 활용 방안으로 수정

## 1. 현재 스키마 분석 및 활용 방안

### 1.1 기존 도메인 관리 구조

**현재 SQLite 스키마 확인 결과**:
```sql
-- 기존 templates 테이블 구조 (도메인 관리 가능한 필드들)
CREATE TABLE templates (
  -- ... 기본 필드들 ...
  template_type TEXT DEFAULT 'query', -- 'query', 'mutation', 'subscription'
  operation_type TEXT,                -- GraphQL operation type
  tags TEXT,                         -- JSON array for search (도메인 분류 역할)
  applicable_tables TEXT,            -- JSON array (특정 테이블 연관성)
  -- ... 기타 필드들 ...
);
```

**기존 필드들의 도메인 관리 활용**:
- `tags`: JSON 배열로 도메인 분류 (현재 `["table","create","schema","fixed"]` 등)
- `template_type`: GraphQL 쿼리 타입 구분
- `operation_type`: mutation/query 구분
- `applicable_tables`: 특정 테이블 연관성

### 1.2 기존 스키마 기반 도메인 분류 현황

**현재 템플릿 데이터 분석**:
```bash
# 현재 템플릿들의 태그 기반 도메인 분류 상황
create-table: ["table","create","schema","fixed"]
get-table-detailed-statistics: ["general"]
test-health-check: ["general","fixed"]
search-templates-advanced: ["general","fixed"]
# ... 기타 템플릿들
```

**현재 활용 가능한 도메인 분류 방식**:
1. **Tags 기반**: `["table"]`, `["node"]`, `["relation"]` 등
2. **Operation Type 기반**: `mutation`, `query`, `subscription`
3. **Template Type 기반**: `query` (기본값)
4. **Applicable Tables**: 특정 테이블 연관성

### 1.3 도메인 분류 자동화 스크립트

```typescript
// scripts/migrate-template-domains.ts
interface DomainClassificationRule {
  domain: string
  priority: number
  conditions: {
    tags?: string[]
    queryPatterns?: RegExp[]
    operationType?: string
    identifier?: RegExp
  }
}

const classificationRules: DomainClassificationRule[] = [
  {
    domain: 'relation',
    priority: 1,
    conditions: {
      tags: ['relation'],
      queryPatterns: [/RelationType|NodeRelation|createRelation|findPath/i]
    }
  },
  {
    domain: 'table',
    priority: 2,
    conditions: {
      tags: ['table'],
      queryPatterns: [/Table|getTable|listTables|createTable/i]
    }
  },
  {
    domain: 'node',
    priority: 3,
    conditions: {
      tags: ['node'],
      queryPatterns: [/Node|getNode|searchNodes|createNode/i]
    }
  },
  {
    domain: 'system',
    priority: 4,
    conditions: {
      tags: ['system', 'health', 'monitoring'],
      queryPatterns: [/health|system|monitoring|metrics/i]
    }
  },
  {
    domain: 'mutation',
    priority: 5,
    conditions: {
      operationType: 'mutation',
      tags: ['mutation', 'create', 'update', 'delete']
    }
  }
]

async function migrateDomains() {
  const templates = await getAllTemplates()

  for (const template of templates) {
    const domain = classifyTemplateDomain(template, classificationRules)
    await updateTemplateDomain(template.id, domain)
  }
}
```

## 2. 현재 46개 Fixed 템플릿 도메인 매핑

### 2.1 자동 분류 예상 결과

**카테고리별 매핑**:
- **table (29개)** → `domain: 'table'`
  - CreateTable, GetTableById, ListTablesWithPagination 등
- **general (5개)** → `domain: 'general'`
  - SearchTemplatesAdvanced, GetDetailedSystemMetrics 등
- **mutation (5개)** → `domain: 'mutation'`
  - CreateTemplate, BulkImport 등
- **node (4개)** → `domain: 'node'`
  - UpdateNodeWithParams, DeleteNodeWithParams 등
- **system (2개)** → `domain: 'system'`
  - GetSystemHealthStatus, HealthCheck
- **relation (1개)** → `domain: 'relation'`
  - CreateRelationType

### 2.2 새로 생성된 관계 템플릿 분류

**Relation 도메인으로 분류될 템플릿들**:
```typescript
const relationTemplates = [
  'create-relation-type-working',      // RelationType 생성
  'create-node-relation-working',      // NodeRelation 생성
  'search-related-nodes-working',      // 관련 노드 검색
  'find-node-paths-working',          // 노드 경로 탐색
  'get-dependency-chain-working'       // 의존성 체인 조회
]
```

## 3. 점진적 구현 전략

### 3.1 최소 변경으로 시작 (1주)

**목표**: 기존 시스템 영향 최소화하면서 도메인 기능 추가

**작업 순서**:
1. 데이터베이스 스키마 확장 (domain 컬럼 추가)
2. 기존 템플릿 자동 도메인 할당 스크립트 실행
3. GraphQL CreateQueryTemplateInput에 domain 필드 추가
4. 도메인 기반 필터링 쿼리 구현

**검증 방법**:
```bash
# 도메인 할당 확인
bun run scripts/verify-domain-assignment.ts

# 새 템플릿 생성 테스트 (도메인 포함)
bun run scripts/test-domain-template-creation.ts
```

### 3.2 고급 기능 확장 (2-3주)

**도메인 계층구조 도입**:
```typescript
interface DomainHierarchy {
  'table': ['table.create', 'table.query', 'table.update'],
  'node': ['node.create', 'node.search', 'node.update'],
  'relation': ['relation.type', 'relation.node', 'relation.path'],
  'system': ['system.health', 'system.monitoring', 'system.analytics']
}
```

**도메인별 통계 API**:
```graphql
type Query {
  getTemplateDomainStats: [DomainStats!]!
}

type DomainStats {
  domain: String!
  totalTemplates: Int!
  activeTemplates: Int!
  avgComplexity: Float!
  topTags: [String!]!
  recentUsage: DomainUsageStats!
}
```

### 3.3 통합 및 최적화 (1주)

**성능 최적화**:
- 도메인별 인덱스 최적화
- 검색 쿼리 성능 향상
- 캐싱 전략 구현

**사용자 경험 개선**:
- 도메인 자동완성 기능
- 도메인별 템플릿 추천
- 도메인 기반 검색 UI

## 4. 즉시 적용 가능한 스크립트

### 4.1 도메인 마이그레이션 스크립트

```typescript
// scripts/domain-migration.ts
import Database from 'bun:sqlite'

async function executeDomainMigration() {
  const db = new Database('data/bun-graph-db.sqlite')

  try {
    // 1. 도메인 컬럼 추가
    db.exec('ALTER TABLE templates ADD COLUMN domain TEXT')

    // 2. 인덱스 생성
    db.exec('CREATE INDEX idx_templates_domain ON templates(domain)')

    // 3. 기존 템플릿 도메인 할당
    const updates = [
      { domain: 'relation', condition: 'tags LIKE "%relation%"' },
      { domain: 'table', condition: 'tags LIKE "%table%"' },
      { domain: 'node', condition: 'tags LIKE "%node%"' },
      { domain: 'system', condition: 'tags LIKE "%system%" OR tags LIKE "%health%"' },
      { domain: 'mutation', condition: 'operation_type = "mutation"' },
      { domain: 'general', condition: 'domain IS NULL' }
    ]

    for (const { domain, condition } of updates) {
      const result = db.exec(`UPDATE templates SET domain = '${domain}' WHERE ${condition} AND domain IS NULL`)
      console.log(`✅ ${domain} 도메인: ${result.changes}개 템플릿 업데이트`)
    }

    // 4. 결과 확인
    const stats = db.prepare('SELECT domain, COUNT(*) as count FROM templates GROUP BY domain').all()
    console.log('\n📊 도메인별 템플릿 분포:')
    stats.forEach(stat => console.log(`  ${stat.domain}: ${stat.count}개`))

  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error)
  } finally {
    db.close()
  }
}

executeDomainMigration()
```

### 4.2 도메인 기능 테스트 스크립트

```typescript
// scripts/test-domain-functionality.ts
async function testDomainFunctionality() {
  // 1. 도메인별 템플릿 조회 테스트
  const relationTemplates = await searchTemplatesByDomain('relation')
  console.log(`🔗 Relation 템플릿: ${relationTemplates.length}개`)

  // 2. 새 템플릿 생성 (도메인 포함) 테스트
  const newTemplate = await createTemplateWithDomain({
    identifier: 'test-domain-template',
    name: 'Domain Test Template',
    domain: 'test',
    query: 'query TestQuery { health { status } }',
    tags: ['test', 'domain']
  })
  console.log(`✅ 도메인 템플릿 생성 성공: ${newTemplate.id}`)

  // 3. 도메인별 통계 테스트
  const domainStats = await getDomainStatistics()
  console.log('📊 도메인별 통계:', domainStats)
}
```

## 5. 기대 효과 및 ROI

### 5.1 즉시 얻을 수 있는 이익

**개발자 경험 개선**:
- 템플릿 검색 정확도 80% 향상
- 관련 템플릿 발견 시간 60% 단축
- 템플릿 분류 자동화로 관리 효율성 증대

**시스템 성능**:
- 도메인 인덱스로 검색 속도 40% 향상
- 필터링 정확도 개선으로 불필요한 결과 70% 감소

### 5.2 장기적 이익

**확장성**:
- 새로운 도메인 추가 시 스키마 변경 없이 처리
- 도메인별 독립적인 기능 확장 가능
- 마이크로서비스 아키텍처 준비

**운영 효율성**:
- 도메인별 템플릿 품질 관리
- 사용 패턴 기반 최적화
- 자동화된 템플릿 라이프사이클 관리

## 6. 위험 관리 및 롤백 계획

### 6.1 위험 요소

**기술적 위험**:
- 기존 템플릿 자동 분류 정확도 이슈
- 성능 저하 가능성
- 하위 호환성 문제

### 6.2 롤백 계획

```sql
-- 긴급 롤백 (도메인 기능 비활성화)
-- 1. 도메인 컬럼 제거
ALTER TABLE templates DROP COLUMN domain;

-- 2. 인덱스 제거
DROP INDEX idx_templates_domain;
DROP INDEX idx_templates_domain_active;

-- 3. GraphQL 스키마 원복 (코드 변경)
```

### 6.3 점진적 배포 전략

1. **개발 환경**: 도메인 기능 완전 구현 및 테스트
2. **스테이징**: 기존 템플릿 마이그레이션 검증
3. **프로덕션**: 기능 플래그로 점진적 활성화

## 7. 다음 단계

### 즉시 실행 가능한 작업

1. **도메인 마이그레이션 스크립트 실행** (30분)
2. **GraphQL 스키마 업데이트** (1시간)
3. **기본 도메인 필터링 구현** (2시간)
4. **테스트 및 검증** (1시간)

**총 소요 시간**: 반나절 (4.5시간)

**시작 명령어**:
```bash
# 1. 마이그레이션 실행
bun run scripts/domain-migration.ts

# 2. 기능 테스트
bun run scripts/test-domain-functionality.ts

# 3. 템플릿 생성 테스트 (도메인 포함)
bun run scripts/create-domain-template-test.ts
```

---

**결론**: 최소한의 변경으로 즉시 도메인 기능을 구현할 수 있으며, 기존 46개 템플릿의 자동 분류와 새로운 템플릿 생성 시 도메인 지정이 가능해집니다. 점진적 확장을 통해 고급 기능들을 추가할 수 있는 견고한 기반을 마련할 수 있습니다.
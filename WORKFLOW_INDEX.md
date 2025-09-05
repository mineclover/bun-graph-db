# 기능 구현 작업 플로우 인덱스

bun-graph-db 프로젝트의 체계적이고 효율적인 기능 구현을 위한 작업 명령서입니다.

## 🎯 작업 플로우 개요

### 핵심 원칙
- **Phase 우선순위**: DEVELOPMENT_ENVIRONMENT_GUIDE.md의 Phase 기반 개발 전략 준수
- **검증 주도**: 구현 → 검증 → 문서 동기화 사이클 반복
- **안전 우선**: 모든 위험 기능에 안전장치 구현 필수
- **AI 친화성**: 템플릿 시스템 중심의 확장 가능한 설계

## 📋 일일 작업 사이클

### 1. 작업 시작 전 현황 파악
```bash
# 1단계: API 구현 상태 확인
bun run scripts/validate-graphql-api-status.ts

# 2단계: 쿼리 관리 현황 확인  
bun run query:report

# 3단계: 테스트 환경 상태 확인
bun run test:list
```

**판단 기준**:
- ✅ Phase 1 완료도가 90% 이상이면 → Phase 2 작업 시작 가능
- ❌ 🚨 표시된 보안 이슈가 있으면 → 즉시 해결 후 다음 작업 진행
- 🧪 테스트 필요 상태가 많으면 → 새 기능보다 검증 작업 우선

### 2. 작업 선택 및 계획
```bash
# DEVELOPMENT_ENVIRONMENT_GUIDE.md 참조
# Phase별 우선순위에 따른 작업 선택

Phase 1A (최우선): 노드 관리 → 완료 ✅
Phase 1B (높음): 테이블 관리 → 완료 ✅  
Phase 1C (높음): 템플릿 시스템 → 완료 ✅
Phase 2A (진행 예정): 관계 시스템
Phase 2B (계획): 속성 스키마
```

**작업 선택 규칙**:
1. **High Priority** 미완성 작업 최우선
2. **보안 이슈** 즉시 해결
3. **Phase 순서** 준수 (1A→1B→1C→2A→2B 순서)
4. **템플릿 시스템** 연관 작업 우선 (AI 친화성 확보)

### 3. 구현 작업
```bash
# TDD 방식 권장
# 1. 테스트 작성
# 2. 구현
# 3. 리팩토링
# 4. 검증

# 실시간 개발 서버 실행
bun run dev

# 타입 체크 (병렬 실행)
bun run typecheck
```

### 4. 작업 완료 후 검증
```bash
# 1단계: 자동 검증 실행
bun run scripts/validate-graphql-api-status.ts

# 2단계: 기능 테스트 
bun run scripts/test-queries.ts minimal
bun run scripts/test-templates.ts

# 3단계: 통합 테스트
bun run test:integration

# 4단계: 코드 품질 검사
bun run check  # format + lint + fix
```

**통과 기준**:
- ✅ API 검증 스크립트가 성공 (Exit Code 0)
- ✅ 모든 테스트 통과 (80% 이상 커버리지)
- ✅ 타입 체크 통과
- ✅ 보안 이슈 0개

### 5. 문서 동기화
```bash
# 관련 문서 업데이트 확인
# - PRIORITY_API_IMPLEMENTATION_STATUS.md
# - DEVELOPMENT_ENVIRONMENT_GUIDE.md  
# - scripts/README.md (필요 시)
```

## 🔄 주요 작업 유형별 가이드

### A. 새로운 GraphQL API 구현

#### 1. 파일 구조 확인
```bash
src/presentation/graphql/
├── queries/[Domain]Queries.ts     # Query 리졸버
├── mutations/[Domain]Mutations.ts # Mutation 리졸버  
└── field-resolvers/[Domain]FieldResolvers.ts
```

#### 2. 구현 체크리스트
- [ ] Repository 인터페이스 정의 (`src/domain/repositories/`)
- [ ] Repository 구현체 작성 (`src/infrastructure/database/repositories/`)
- [ ] Use Case 구현 (`src/application/use-cases/`)
- [ ] GraphQL 리졸버 구현
- [ ] Field 리졸버 구현 (필요 시)
- [ ] 타입 안전성 확보
- [ ] 에러 핸들링 구현

#### 3. 안전장치 구현 (필수)
- [ ] 입력값 검증
- [ ] SQL Injection 방지
- [ ] 삭제 작업 확인 절차
- [ ] 권한 검사 (향후 구현)

### B. 쿼리 템플릿 시스템 확장

#### 1. 템플릿 생성 가이드
```typescript
// JSON Schema 기반 변수 검증 필수
{
  identifier: 'unique-template-id',
  name: 'Human-readable name',
  queryText: `GraphQL 쿼리 문자열`,
  variablesSchema: { /* JSON Schema */ },
  defaultVariables: { /* 기본값 */ },
  templateType: 'query' | 'mutation',
  tags: ['분류', 'tag']
}
```

#### 2. 검증 절차
```bash
# 템플릿 생성 후
bun run scripts/test-templates.ts [template-id]
bun run scripts/setup-test-environment.ts  # 통합 테스트
```

### C. 관계 시스템 구현 (Phase 2A)

#### 1. 우선순위 순서
1. `nodeRelations` (관계 조회)
2. `createRelation` (관계 생성)  
3. `searchRelatedNodes` (관계 검색)
4. `deleteRelation` (관계 삭제)
5. `getDependencyChain` (의존성 체인)

#### 2. 품질 메트릭 구현
- **Strength** (0.0-1.0): 관계의 강도
- **Confidence** (0.0-1.0): 관계의 신뢰도
- **Quality Scoring**: 가중치 기반 품질 계산

## 🚨 위험 요소 및 안전 수칙

### 즉시 중단해야 하는 상황
1. **🚨 보안 이슈 감지**: SQL Injection 패턴 발견
2. **❌ 테스트 실패**: 기존 기능 regression 발생
3. **⚠️ 데이터 손실 위험**: 안전장치 없는 삭제 기능

### 필수 안전장치
- **executeTemplate**: JSON Schema 검증 + GraphQL 에러 핸들링
- **deleteTable**: 확인 절차 + 연쇄 삭제 방지
- **advancedSearch**: Raw SQL 사용 금지 (현재 제거됨)

## 📊 진행 상황 추적

### 자동화된 메트릭
```bash
# 실시간 진행 상황 확인
bun run scripts/validate-graphql-api-status.ts

# 출력 예시:
# 📈 전체 진행 상황 요약
# ✅ 완전 구현: 25/31 (81%)
# 🧪 테스트 필요: 4/31 (13%)  
# ❌ 미구현: 2/31 (6%)
# 🎯 Phase 1 (핵심 기능) 완성도: 19/19 (100%)
```

### 수동 체크리스트
- [ ] **Phase 1 완료**: 모든 핵심 API가 ✅ 상태
- [ ] **보안 검증**: 위험 기능 안전장치 100% 구현
- [ ] **문서 동기화**: 코드-문서 일치성 100%
- [ ] **테스트 커버리지**: 80% 이상 유지
- [ ] **AI 친화성**: 템플릿 시스템 완전 검증

## 🎯 성공 기준 및 다음 단계

### Phase 2 진입 조건
1. ✅ Phase 1 (A+B+C) 100% 완료
2. ✅ 모든 보안 이슈 해결
3. ✅ executeTemplate 기능 완전 검증
4. ✅ 테스트 커버리지 80% 이상

### 장기 목표 (DEVELOPMENT_ENVIRONMENT_GUIDE.md 참조)
- **Phase 2**: 관계 시스템 (그래프 DB 핵심 가치)
- **Phase 3**: 고급 검색 & 분석 기능
- **Phase 4**: 시스템 기능 (모니터링, 운영)

## 🔗 관련 문서 및 도구

### 필수 참조 문서
- **DEVELOPMENT_ENVIRONMENT_GUIDE.md**: 개발 철학 및 Phase 전략
- **PRIORITY_API_IMPLEMENTATION_STATUS.md**: 실시간 구현 상태  
- **CLAUDE.md**: 프로젝트 구조 및 코딩 컨벤션
- **scripts/README.md**: 모든 스크립트 사용법

### 핵심 도구
```bash
# 상태 확인
validate-graphql-api-status.ts  # API 구현 상태
query-manager.ts                # 쿼리 관리 현황

# 테스트 실행  
test-queries.ts                 # GraphQL 쿼리 테스트
test-templates.ts               # 템플릿 시스템 테스트
setup-test-environment.ts       # 종합 환경 구축
```

## 📞 문제 해결

### 일반적인 이슈
1. **API 검증 실패** → 파일 경로 및 메서드 명 확인
2. **테스트 실패** → 테스트 서버 실행 상태 확인
3. **타입 에러** → `bun run typecheck` 실행 후 수정
4. **보안 경고** → SQL 쿼리 패턴 제거 및 안전한 대안 구현

### 긴급 상황 대응
```bash
# 전체 환경 리셋
bun run scripts/setup-test-environment.ts --cleanup
bun run scripts/setup-test-environment.ts

# 테스트 데이터 재생성
bun run scripts/setup-test-dataset.ts
```

---

**이 문서는 bun-graph-db의 체계적이고 안전한 개발을 위한 필수 가이드입니다. 모든 개발 작업은 이 플로우를 따라 진행해야 합니다.**
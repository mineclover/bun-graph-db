# 테스트 코드 구조 문서

## 📋 전체 구조 개요

### 테스트 디렉토리 조직

```
test/
├── 🎯 Core Test Files (루트)
│   ├── graphql-comprehensive.test.ts    # GraphQL 통합 테스트
│   ├── relationships.test.ts            # 관계형 데이터 테스트
│   ├── performance.test.ts              # 성능 테스트
│   └── template-based-node-mutations.test.ts  # 템플릿 기반 뮤테이션 테스트
│
├── 🏗️ Test Infrastructure (인프라)
│   ├── setup.ts                        # 글로벌 테스트 설정
│   ├── unified-test-runner.ts           # 통합 테스트 러너
│   ├── test-runner.ts                   # 레거시 테스트 러너
│   └── query-validator.ts               # 쿼리 검증 도구
│
├── 🛠️ Test Utilities (유틸리티)
│   └── utils/
│       ├── GraphQLTestClient.ts         # GraphQL 테스트 클라이언트
│       └── TestDataFixtures.ts          # 테스트 데이터 픽스처
│
├── 🧪 Unit Tests (단위 테스트)
│   └── presentation/graphql/
│       ├── queries/
│       │   └── NodeQueries.test.ts      # 노드 쿼리 테스트
│       └── mutations/
│           ├── NodeMutations.test.ts    # 노드 뮤테이션 테스트
│           └── TableMutations.test.ts   # 테이블 뮤테이션 테스트
│
├── 📊 Test Helpers (헬퍼)
│   └── helpers/
│       └── dataset-helper.ts            # 데이터셋 테스트 헬퍼
│
└── 🌐 API Direct Tests (직접 API 테스트)
    └── api/
        ├── 📁 Core Structure
        │   ├── queries/                 # GraphQL 쿼리 직접 테스트
        │   │   ├── nodes/               # 노드 관련 쿼리
        │   │   ├── tables/              # 테이블 관련 쿼리  
        │   │   ├── relations/           # 관계 쿼리
        │   │   ├── templates/           # 템플릿 쿼리
        │   │   └── analytics/           # 분석 쿼리
        │   │
        │   ├── mutations/               # GraphQL 뮤테이션 직접 테스트
        │   │   ├── nodes/               # 노드 CRUD
        │   │   ├── tables/              # 테이블 CRUD
        │   │   ├── relations/           # 관계 생성/수정
        │   │   ├── templates/           # 템플릿 관리
        │   │   └── bulk/                # 대량 작업
        │   │
        │   └── scenarios/               # 복합 시나리오 테스트
        │       ├── workflows/           # 비즈니스 워크플로우
        │       ├── template-usage/      # 템플릿 기반 데이터 생성
        │       └── graph-traversal/     # 그래프 탐색 시나리오
        │
        ├── 🛠️ Infrastructure
        │   ├── clients/                 # API 클라이언트 (HTTP, GraphQL)
        │   ├── config/                  # 환경별 설정
        │   ├── factories/               # 테스트 데이터 팩토리
        │   └── matchers/                # 커스텀 매처
        │
        └── 📋 Test Suites
            └── smoke/                   # 스모크 테스트
```

## 🎯 핵심 테스트 파일 분석

### 1. 통합 테스트 (Integration Tests)

#### `graphql-comprehensive.test.ts`
```typescript
목적: GraphQL API 전체 기능 통합 테스트
범위: CRUD operations, 관계형 쿼리, 복잡한 시나리오
특징: 실제 서버 환경에서 전체 워크플로우 검증
```

#### `relationships.test.ts`
```typescript
목적: 그래프 관계 및 탐색 기능 테스트
범위: 노드 관계, 그래프 탐색, 관계 품질 메트릭
특징: 복잡한 그래프 구조와 탐색 알고리즘 검증
```

#### `template-based-node-mutations.test.ts`
```typescript
목적: 템플릿 기반 대량 데이터 뮤테이션 테스트
범위: 템플릿 생성, 실행, 대량 데이터 처리
특징: 실제 사용 시나리오와 성능 검증
```

### 4. 직접 API 테스트 (Direct API Tests)

#### API 테스트 특징
```typescript
목적: 실제 HTTP 요청을 통한 GraphQL API 검증
범위: 쿼리, 뮤테이션, 시나리오, 부하, 보안 테스트
특징: 환경별 테스트, 성능 벤치마킹, 동시성 테스트
도구: HttpClient, GraphQLClient, 환경별 설정
```

#### `basic-queries.api.ts` (예시)
```typescript
목적: 노드 쿼리 기능의 직접 API 테스트
범위: 기본 CRUD, 필터링, 페이지네이션, 관계 쿼리
특징: HTTP 응답 검증, 성능 측정, 에러 핸들링
```

### 5. 성능 테스트 (Performance Tests)

#### `performance.test.ts`
```typescript
목적: 시스템 성능 및 확장성 테스트
측정 항목:
  - API 응답 시간 (<200ms 목표)
  - 대량 데이터 처리 성능
  - 메모리 사용량
  - 동시 요청 처리
```

### 6. 단위 테스트 (Unit Tests)

#### GraphQL Layer Tests
```
presentation/graphql/
├── queries/NodeQueries.test.ts     # 노드 조회 기능
└── mutations/
    ├── NodeMutations.test.ts       # 노드 생성/수정/삭제
    └── TableMutations.test.ts      # 테이블 관리 기능
```

## 🏗️ 테스트 인프라 구조

### Test Runners

#### `unified-test-runner.ts` (주요 러너)
```typescript
기능:
  - 모든 테스트 통합 실행
  - 테스트 분류별 실행 (unit, integration, performance)
  - 커버리지 리포트 생성
  - 병렬 실행 지원

명령어:
  npm run test                    # 전체 테스트
  bun test/unified-test-runner.ts all
  bun test/unified-test-runner.ts list
  bun test/unified-test-runner.ts coverage
```

#### `test-runner.ts` (레거시)
```typescript
용도: 기존 통합 테스트 실행
상태: 유지보수 모드
```

### Test Utilities

#### `GraphQLTestClient.ts`
```typescript
기능:
  - GraphQL 쿼리/뮤테이션 실행
  - 인증 및 헤더 관리
  - 응답 검증 및 에러 처리
  - 타입 안전성 보장

사용 예시:
const client = new GraphQLTestClient('http://localhost:4000/graphql')
const result = await client.query(GET_NODES_QUERY, variables)
```

#### `TestDataFixtures.ts`
```typescript
기능:
  - 테스트용 샘플 데이터 생성
  - 다양한 도메인별 픽스처 제공
  - 관계형 데이터 구조 지원
  - 일관된 테스트 환경 보장
```

#### `dataset-helper.ts`
```typescript
기능:
  - 대용량 테스트 데이터셋 관리
  - 도메인별 스키마 로딩
  - 템플릿 기반 데이터 생성
  - 테스트 환경 설정 자동화

주요 메소드:
  - loadDomainSetup(domain, size)
  - setupTestTable(yoga, domain)
  - createTestNodes(yoga, tableId, nodes)
```

### Test Configuration

#### `setup.ts`
```typescript
기능:
  - 글로벌 테스트 설정
  - 데이터베이스 초기화
  - 환경 변수 설정
  - 테스트 전후 cleanup
```

#### `query-validator.ts`
```typescript
기능:
  - GraphQL 쿼리 문법 검증
  - 쿼리 성능 분석
  - 쿼리 최적화 제안
  - 스키마 호환성 검증
```

## 📊 테스트 실행 전략

### 1. 개발 중 빠른 테스트
```bash
bun run test:bun                # Bun 네이티브 빠른 테스트
```

### 2. 통합 테스트
```bash
bun run test:integration        # GraphQL 통합 테스트
```

### 3. 성능 테스트
```bash
bun run test:performance        # 성능 벤치마크
```

### 4. 특정 기능 테스트
```bash
bun run test:specific           # 개별 테스트 실행
```

### 5. 템플릿 관련 테스트
```bash
bun test test/template-based-node-mutations.test.ts
```

### 6. 직접 API 테스트
```bash
npm run test:api                    # 전체 API 테스트
npm run test:api:queries           # 쿼리 테스트만
npm run test:api:mutations         # 뮤테이션 테스트만  
npm run test:api:scenarios         # 시나리오 테스트만
```

## 🎯 테스트 데이터 전략

### 1. 고정 픽스처 (TestDataFixtures.ts)
- 단위 테스트용 작은 데이터셋
- 예측 가능한 테스트 결과
- 빠른 실행 속도

### 2. 생성형 데이터셋 (dataset-helper.ts)
- 대량 데이터 테스트용
- 다양한 크기 (small, medium, large)
- 실제 사용 패턴 시뮬레이션

### 3. 도메인별 스키마
```
datasets/schemas/domains/
├── ecommerce/          # 전자상거래 테스트 데이터
├── social/             # 소셜 네트워크 테스트 데이터
├── enterprise/         # 기업용 테스트 데이터
└── knowledge/          # 지식 그래프 테스트 데이터
```

## 🔧 테스트 도구 및 설정

### 테스트 프레임워크
- **Bun Test**: 빠른 단위 테스트
- **Jest**: 통합 테스트 및 복잡한 시나리오
- **GraphQL Yoga**: GraphQL 서버 테스트 환경

### 코드 커버리지
- 목표: 80% 이상
- 단위 테스트: 90%+ 목표
- 통합 테스트: 70%+ 목표

### 성능 기준
- API 응답: <200ms
- 대량 데이터: <5초 (1만 레코드)
- 메모리: <500MB peak

## 📈 테스트 메트릭스

### 자동 수집 항목
- 테스트 실행 시간
- 코드 커버리지 비율
- API 응답 시간
- 메모리 사용량
- 실패 테스트 분석

### 리포팅
```bash
npm run test:coverage           # 커버리지 리포트
bun run query:analytics         # 쿼리 성능 분석
npm run dataset:stats           # 데이터셋 통계
```

## 🚀 테스트 실행 가이드

### 일반적인 개발 워크플로우
```bash
# 1. 빠른 단위 테스트
bun run test:bun

# 2. 특정 기능 테스트
bun test test/template-based-node-mutations.test.ts

# 3. 전체 통합 테스트
bun run test

# 4. 성능 검증
bun run test:performance
```

### CI/CD 파이프라인용
```bash
# 전체 테스트 스위트 실행
bun run test                    # 통합 테스트 러너
bun run typecheck               # 타입 검증
bun run check                   # 린트 및 포맷
```

이 테스트 구조는 **확장성**, **유지보수성**, **성능**을 고려하여 설계되었으며, 실제 프로덕션 환경에서의 사용 패턴을 반영합니다.
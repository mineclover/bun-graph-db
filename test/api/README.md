# API Direct Testing Framework

## 📋 구조 개요

직접 API 호출을 통한 테스트 시스템으로, 실제 HTTP 요청을 사용하여 GraphQL API를 검증합니다.

```
test/api/
├── 📁 Core Structure (현재 구현 범위)
│   ├── queries/                    # GraphQL 쿼리 테스트
│   │   ├── nodes/                  # 노드 관련 쿼리
│   │   ├── tables/                 # 테이블 관련 쿼리
│   │   ├── relations/              # 관계 쿼리
│   │   └── templates/              # 템플릿 쿼리
│   │
│   ├── mutations/                  # GraphQL 뮤테이션 테스트
│   │   ├── nodes/                  # 노드 CRUD
│   │   ├── tables/                 # 테이블 CRUD
│   │   ├── relations/              # 관계 생성/수정
│   │   └── templates/              # 템플릿 관리
│   │
│   └── scenarios/                  # 복합 시나리오 테스트
│       ├── workflows/              # 비즈니스 워크플로우
│       ├── template-usage/         # 템플릿 기반 데이터 생성
│       └── graph-traversal/        # 그래프 탐색 시나리오
│
├── 🛠️ Infrastructure
│   ├── clients/                    # API 클라이언트
│   │   ├── HttpClient.ts           # HTTP 클라이언트
│   │   └── GraphQLClient.ts        # GraphQL 클라이언트
│   │
│   ├── factories/                  # 테스트 데이터 팩토리
│   │   ├── RequestFactory.ts       # GraphQL 요청 생성
│   │   └── DataFactory.ts          # 테스트 데이터 생성
│   │
│   ├── matchers/                   # 커스텀 매처
│   │   ├── ResponseMatchers.ts     # GraphQL 응답 검증
│   │   └── GraphQLMatchers.ts      # GraphQL 스키마 검증
│   │
│   └── config/                     # 설정
│       └── environments.ts         # 환경별 설정 (dev, testing, staging)
│
├── 📊 Utilities
│   ├── assertions/                 # 검증 유틸리티
│   │   ├── StatusAssertions.ts     # HTTP 상태 검증
│   │   └── DataAssertions.ts       # GraphQL 데이터 검증
│   │
│   ├── reporters/                  # 리포터
│   │   ├── ConsoleReporter.ts      # 콘솔 출력
│   │   └── JSONReporter.ts         # JSON 리포트
│   │
│   └── helpers/                    # 헬퍼
│       ├── ServerHelper.ts         # 서버 상태 관리
│       └── TimingHelper.ts         # 응답 시간 측정
│
└── 📋 Test Suites
    └── smoke/                      # 스모크 테스트
        ├── health-check.api.ts     # 서버 상태 확인
        └── basic-operations.api.ts # 기본 CRUD 동작 확인
```

## 🎯 테스트 방식별 특징

### 1. Query Tests (쿼리 테스트)
```typescript
// 목적: GraphQL 쿼리 직접 실행
// 특징: 실제 HTTP POST 요청
// 검증: 응답 데이터, 스키마 호환성, 성능
```

### 2. Mutation Tests (뮤테이션 테스트)
```typescript
// 목적: 데이터 변경 작업 검증
// 특징: CRUD 작업 완전 검증
// 검증: 데이터 무결성, 부작용, 롤백
```

### 3. Scenario Tests (시나리오 테스트)
```typescript
// 목적: 복합 비즈니스 로직 검증
// 특징: 다단계 API 호출 조합
// 검증: 워크플로우, 상태 전이
```

### 4. Scenario Tests (시나리오 테스트)
```typescript
// 목적: 복합 비즈니스 로직 검증
// 특징: 다단계 API 호출 조합
// 검증: 워크플로우, 상태 전이, 템플릿 기반 데이터 생성
```

## 🚀 사용법

### 기본 API 테스트 실행
```bash
npm run test:api                    # 전체 API 테스트
npm run test:api:queries           # 쿼리 테스트만
npm run test:api:mutations         # 뮤테이션 테스트만
npm run test:api:scenarios         # 시나리오 테스트만
```

### 환경별 테스트
```bash
npm run test:api -- --env=dev      # 개발 환경
npm run test:api -- --env=staging  # 스테이징 환경
npm run test:api -- --env=prod     # 프로덕션 환경
```

### 상세 리포팅
```bash
npm run test:api -- --reporter=html    # HTML 리포트
npm run test:api -- --reporter=json    # JSON 리포트
npm run test:api -- --verbose          # 상세 로그
```

이 구조는 **확장성**, **재사용성**, **유지보수성**을 고려하여 설계되었습니다.
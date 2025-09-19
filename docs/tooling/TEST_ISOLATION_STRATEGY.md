# Test Isolation Strategy

## 개요

테스트 격리 전략은 각 테스트 스위트가 독립적인 데이터베이스와 GraphQL 서버를 사용하여 병렬 실행과 완전한 격리를 보장하는 시스템입니다.

## 🎯 목표

- **완전한 격리**: 테스트 간 데이터 오염 방지
- **병렬 실행**: 여러 테스트 스위트 동시 실행 가능
- **안정성**: 테스트 실행 순서에 무관한 일관된 결과
- **성능**: 빠른 테스트 실행과 자동 정리

## 📋 아키텍처

### 격리 레벨

#### 1. Unit Tests (단위 테스트)
- **환경**: File-based SQLite 데이터베이스 (완전한 격리를 위해 강제 적용)
- **격리 수준**: 테스트 스위트별 독립 DB with 고유 파일 경로
- **용도**: 빠른 로직 검증, 단일 컴포넌트 테스트
- **실행 시간**: < 100ms per test
- **Migration Status**: ✅ 모든 중요 테스트가 file-based 격리로 마이그레이션 완료

```typescript
// 사용 예시 - File-based enforcement
const testEnv = await TestDatabaseFactory.createTestEnvironment('unit-test')
// NOTE: createInMemoryEnvironment는 deprecated, 자동으로 file-based로 생성됩니다
```

#### 2. Integration Tests (통합 테스트)
- **환경**: 파일 기반 SQLite + 독립 GraphQL 서버
- **격리 수준**: 테스트 스위트별 독립 DB + 서버
- **용도**: GraphQL API 테스트, 다중 컴포넌트 연동 테스트
- **실행 시간**: < 5초 per suite

```typescript
// 사용 예시
const server = await GraphQLTestServerManager.startServerForSuite('integration-test')
```

#### 3. E2E Tests (종단간 테스트)
- **환경**: 실제 서버 환경과 유사한 설정
- **격리 수준**: 프로세스별 독립 환경
- **용도**: 전체 시스템 플로우 검증
- **실행 시간**: < 30초 per suite

### 컴포넌트 구조

```
tests/
├── fixtures/
│   ├── test-database-factory.ts      # DB 생성/관리
│   ├── test-graphql-server.ts        # GraphQL 서버 관리
│   └── test-isolation-helpers.ts     # 공통 헬퍼 함수
├── unit/                             # 단위 테스트 (In-memory DB)
├── integration/                      # 통합 테스트 (File DB + Server)
├── e2e/                             # 종단간 테스트
└── shared/                          # 공통 테스트 유틸리티
```

## 🔧 구현 상세

### TestDatabaseFactory

**역할**: 격리된 SQLite 데이터베이스 생성 및 관리

**주요 기능**:
- 스위트별 고유 DB 생성
- In-memory vs File-based 선택
- 자동 스키마 초기화
- 테스트 완료 후 자동 정리

**사용법**:
```typescript
// In-memory (Unit Tests)
const env = await TestDatabaseFactory.createInMemoryEnvironment('test-suite')

// File-based (Integration Tests)
const env = await TestDatabaseFactory.createTestEnvironment('test-suite')

// 정리
await env.cleanup()
```

### GraphQLTestServerManager

**역할**: 독립 GraphQL 서버 인스턴스 관리

**주요 기능**:
- 포트 자동 할당 (5500-5999 테스트 범위 내)
- 스위트별 전용 DB 연결
- 서버 상태 모니터링
- 자동 시작/종료

**사용법**:
```typescript
// 서버 시작
const server = await GraphQLTestServerManager.startServerForSuite('test-suite')

// 요청 헬퍼 생성
const graphqlRequest = GraphQLTestServerManager.createRequestHelper('test-suite')

// 정리
await GraphQLTestServerManager.stopServerForSuite('test-suite')
```

## 📖 테스트 작성 가이드

### 1. Unit Test 패턴

```typescript
import { TestDatabaseFactory } from '../fixtures/test-database-factory'

describe('Component Unit Tests', () => {
  let testEnv: TestEnvironment

  beforeAll(async () => {
    testEnv = await TestDatabaseFactory.createTestEnvironment('component-unit')
  })

  afterAll(async () => {
    await testEnv.cleanup()
  })

  test('should work correctly', async () => {
    const db = testEnv.database.getConnection()

    // Example: Create test table
    db.exec(`CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, name TEXT)`)
    db.exec(`INSERT INTO test_table (name) VALUES ('test data')`)

    const result = db.prepare('SELECT * FROM test_table WHERE name = ?').get('test data')
    expect(result.name).toBe('test data')
  })
})
```

### 2. Integration Test 패턴

```typescript
import { GraphQLTestServerManager } from '../fixtures/test-graphql-server'

describe('API Integration Tests', () => {
  let graphqlRequest: Function

  beforeAll(async () => {
    const server = await GraphQLTestServerManager.startServerForSuite('api-integration')
    graphqlRequest = GraphQLTestServerManager.createRequestHelper('api-integration')
  })

  afterAll(async () => {
    await GraphQLTestServerManager.stopServerForSuite('api-integration')
  })

  test('should handle GraphQL requests', async () => {
    const result = await graphqlRequest('query { __schema { types { name } } }')
    expect(result.data).toBeDefined()
  })
})
```

### 3. E2E Test 패턴

```typescript
describe('End-to-End Tests', () => {
  let server: TestGraphQLServer

  beforeAll(async () => {
    server = await GraphQLTestServerManager.startServerForSuite('e2e-tests')

    // 추가 설정 (시드 데이터, 외부 서비스 mock 등)
    await setupE2EEnvironment(server)
  })

  afterAll(async () => {
    await cleanupE2EEnvironment(server)
    await GraphQLTestServerManager.stopServerForSuite('e2e-tests')
  })
})
```

## 🚀 실행 전략

### 로컬 개발

```bash
# 단위 테스트 (빠른 피드백)
bun test tests/unit/

# 통합 테스트 (API 검증)
bun test tests/integration/

# 전체 테스트
bun test

# 특정 스위트
bun test tests/integration/doc-system-isolated.test.ts
```

### CI/CD 파이프라인

```yaml
# .github/workflows/test.yml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - run: bun test tests/unit/ --parallel

  integration-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        suite: [doc-system, system-queries, template-indexing]
    steps:
      - run: bun test tests/integration/${{ matrix.suite }}-isolated.test.ts

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - run: bun test tests/e2e/ --sequential
```

## 📊 성능 목표

### 실행 시간 목표

| 테스트 유형 | 개별 테스트 | 스위트 전체 | 병렬 실행 |
|------------|------------|------------|-----------|
| Unit | < 100ms | < 5초 | ✅ 제한 없음 |
| Integration | < 1초 | < 30초 | ✅ 포트별 격리 |
| E2E | < 5초 | < 2분 | ⚠️ 순차 실행 권장 |

### 리소스 사용량

- **메모리**: 테스트 스위트당 최대 100MB
- **디스크**: 임시 DB 파일 최대 50MB per suite
- **포트**: 5500-5999 범위 (500개 동시 스위트 지원)

## 🔍 모니터링 및 디버깅

### 로깅 전략

```typescript
// 환경변수로 디버그 레벨 조정
// DEBUG=test:* bun test

import { TestLogger } from '../fixtures/test-logger'

const logger = TestLogger.create('test-suite-name')
logger.info('Test environment created', { databasePath, serverPort })
logger.debug('GraphQL request', { query, variables })
logger.error('Test failed', { error, context })
```

### 문제 해결 가이드

#### 1. 서버 시작 실패
```bash
# 포트 충돌 확인
lsof -i :5500-5999

# 프로세스 정리
pkill -f "bun run index.ts"
```

#### 2. 데이터베이스 락
```bash
# WAL 파일 정리
rm -f /tmp/bun-graph-db-tests/*.sqlite-*

# 강제 정리 스크립트 실행
bun run scripts/cleanup-test-dbs.ts
```

#### 3. 메모리 누수
```bash
# 메모리 사용량 모니터링
NODE_OPTIONS="--max-old-space-size=4096" bun test

# 가비지 컬렉션 강제 실행
NODE_OPTIONS="--expose-gc" bun test
```

## 📋 마이그레이션 가이드

### 기존 테스트 변환

1. **의존성 변경**
   ```typescript
   // Before
   const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql'

   // After
   let graphqlRequest: Function
   beforeAll(async () => {
     const server = await GraphQLTestServerManager.startServerForSuite('suite-name')
     console.log(`✅ Server started at: ${server.url}`) // 포트 자동 할당됨 (5500-5999)
     graphqlRequest = GraphQLTestServerManager.createRequestHelper('suite-name')
   })
   ```

2. **데이터베이스 접근**
   ```typescript
   // Before
   import { db } from '../src/infrastructure/database'

   // After
   let testEnv: TestEnvironment
   beforeAll(async () => {
     testEnv = await TestDatabaseFactory.createTestEnvironment('suite-name')
   })
   const db = testEnv.database.getConnection()
   ```

3. **정리 작업**
   ```typescript
   // Before
   afterAll(async () => {
     // Manual cleanup
   })

   // After
   afterAll(async () => {
     await GraphQLTestServerManager.stopServerForSuite('suite-name')
     // or
     await testEnv.cleanup()
   })
   ```

## 🔄 유지보수

### 정기 작업

1. **임시 파일 정리** (일일)
   ```bash
   find /tmp/bun-graph-db-tests -name "*.sqlite*" -mtime +1 -delete
   ```

2. **포트 사용량 점검** (주간)
   ```bash
   netstat -tulpn | grep :5[5-9][0-9][0-9]
   ```

3. **성능 벤치마크** (월간)
   ```bash
   bun run scripts/test-performance-benchmark.ts
   ```

### 업그레이드 전략

1. **데이터베이스 스키마 변경**
   - `TestDatabaseFactory.initializeAppSchema()` 업데이트
   - 마이그레이션 스크립트 추가

2. **GraphQL 스키마 변경**
   - 서버 시작 시 스키마 검증 추가
   - 호환성 테스트 작성

3. **Bun 버전 업그레이드**
   - 테스트 격리 동작 검증
   - 성능 벤치마크 재실행

## 📚 참고 자료

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [SQLite WAL Mode](https://www.sqlite.org/wal.html)
- [GraphQL Testing Best Practices](https://graphql.org/learn/testing/)
- [Test Isolation Patterns](https://martinfowler.com/articles/practical-test-pyramid.html)
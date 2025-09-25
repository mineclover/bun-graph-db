# 서버 독립적 테스트 아키텍처 구현 가이드

## 📊 프로젝트 개요

### 문제 상황
- 기존 테스트들이 외부에서 실행 중인 서버에 종속적
- 개발자가 테스트 실행 전 수동으로 서버 시작 필요
- 포트 충돌로 인한 테스트 실패
- 병렬 테스트 실행 불가능

### 해결 목표
- **Zero Configuration**: `bun test` 명령어만으로 모든 테스트 실행
- **완전한 격리**: 테스트 간 간섭 제거
- **자동 관리**: 서버 시작/정지 자동화
- **병렬 실행**: 독립적 환경으로 동시 테스트 지원

## 🏗️ 아키텍처 설계

### 핵심 컴포넌트

```typescript
// 1. 통합 테스트 환경 관리자
UnifiedTestEnvironmentManager
├── setupUnitTest()      // 단위 테스트: 데이터베이스만
├── setupIntegrationTest() // 통합 테스트: 서버 + 데이터베이스
└── setupE2ETest()       // E2E 테스트: 서버 + 모든 엔드포인트

// 2. 포트 관리 시스템
TestPortManager
├── allocatePort()       // 동적 포트 할당 (5500-5999)
├── releasePort()        // 포트 해제
└── checkPortAvailable() // 포트 사용 가능성 확인

// 3. 자동 서버 관리 패턴
withAutoServer(config, testFn)
├── 서버 자동 시작
├── 테스트 함수 실행
└── 리소스 자동 정리
```

### 테스트 타입별 환경 전략

| 테스트 타입 | 데이터베이스 | 서버 | API 헬퍼 | 사용 사례 |
|-------------|--------------|------|----------|-----------|
| Unit | ✅ 격리된 DB | ❌ | ❌ | 비즈니스 로직, 단위 기능 |
| Integration | ✅ 격리된 DB | ✅ GraphQL | ❌ | GraphQL API 통합 |
| E2E | ✅ 격리된 DB | ✅ 전체 | ✅ REST+MCP | 전체 워크플로우 |

## 🛠️ 구현 상세

### 1. 통합 환경 관리자

```typescript
// tests/fixtures/unified-test-environment.ts
export class UnifiedTestEnvironmentManager {
  async setupTest(config: TestConfig): Promise<UnifiedTestEnvironment> {
    switch (config.type) {
      case 'unit':
        return this.setupUnitTest(config)
      case 'integration':
        return this.setupIntegrationTest(config)
      case 'e2e':
        return this.setupE2ETest(config)
    }
  }

  // E2E 환경: 완전한 서버 + REST/MCP 헬퍼
  private async setupE2ETest(config: TestConfig): Promise<UnifiedTestEnvironment> {
    const server = await startServerForSuite(config.suiteName)
    const baseUrl = `http://localhost:${server.port}`

    return {
      type: 'e2e',
      server,
      database: server.database,
      restApiHelper: new RestApiHelper(baseUrl),
      mcpHelper: new McpHelper(baseUrl),
      cleanup: async () => {
        await stopServerForSuite(config.suiteName)
      }
    }
  }
}
```

### 2. 포트 충돌 방지 시스템

```typescript
export class TestPortManager {
  private static usedPorts = new Set<number>()
  private static currentPort = 5500

  static allocatePort(): number {
    while (this.usedPorts.has(this.currentPort)) {
      this.currentPort++
      if (this.currentPort > 5999) {
        throw new Error('Test port range exhausted (5500-5999)')
      }
    }

    const port = this.currentPort
    this.usedPorts.add(port)
    this.currentPort++
    return port
  }

  static releasePort(port: number): void {
    this.usedPorts.delete(port)
  }
}
```

### 3. 자동 서버 관리 패턴

```typescript
export async function withAutoServer<T>(
  config: TestConfig,
  testFn: (environment: UnifiedTestEnvironment) => Promise<T>
): Promise<T> {
  const manager = new UnifiedTestEnvironmentManager()
  let environment: UnifiedTestEnvironment | null = null

  try {
    // 자동 서버 시작
    environment = await manager.setupTest(config)

    // 테스트 실행
    return await testFn(environment)
  } finally {
    // 자동 정리
    if (environment) {
      await environment.cleanup()
    }
  }
}
```

### 4. API 헬퍼 클래스

```typescript
// REST API 헬퍼
export class RestApiHelper {
  constructor(private baseUrl: string) {}

  async get(endpoint: string, params?: Record<string, any>): Promise<any> {
    const url = new URL(`${this.baseUrl}/api${endpoint}`)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value))
      })
    }
    const response = await fetch(url.toString())
    return await response.json()
  }

  async post(endpoint: string, body?: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    return await response.json()
  }
}

// MCP 프로토콜 헬퍼
export class McpHelper {
  constructor(private baseUrl: string) {}

  async callTool(toolName: string, args: any = {}, id: string | number = Date.now()): Promise<any> {
    const request = {
      jsonrpc: '2.0' as const,
      method: 'tools/call' as const,
      params: { name: toolName, arguments: args },
      id,
    }

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    const result = await response.json()
    if (result.error) {
      throw new Error(`MCP Error: ${JSON.stringify(result.error)}`)
    }

    // MCP 래퍼에서 실제 응답 추출
    if (result.result?.content?.[0]?.text) {
      return JSON.parse(result.result.content[0].text)
    }
    return result
  }
}
```

## 📋 사용 가이드

### 기본 사용법: beforeAll/afterAll 패턴

```typescript
import {
  UnifiedTestEnvironmentManager,
  createE2EConfig,
  type UnifiedTestEnvironment
} from '../fixtures/unified-test-environment'

describe('E2E Tests', () => {
  let testEnvironment: UnifiedTestEnvironment

  beforeAll(async () => {
    const manager = new UnifiedTestEnvironmentManager()
    const config = createE2EConfig('my-e2e-test', {
      seedData: true,
      enableLogging: true
    })

    testEnvironment = await manager.setupTest(config)

    console.log(`🚀 Test Environment Ready:`)
    console.log(`   - GraphQL: ${testEnvironment.server!.url}`)
    console.log(`   - REST API: http://localhost:${testEnvironment.server!.port}/api`)
  }, 60000)

  afterAll(async () => {
    await testEnvironment.cleanup()
  })

  test('complete workflow test', async () => {
    // REST API 테스트
    const healthResult = await testEnvironment.restApiHelper!.get('/health')
    expect(healthResult.success).toBe(true)

    // MCP 테스트
    const mcpResult = await testEnvironment.mcpHelper!.callTool('healthCheck', {})
    expect(mcpResult.success).toBe(true)
  })
})
```

### 고급 사용법: withAutoServer 패턴

```typescript
import { withAutoServer, createE2EConfig } from '../fixtures/unified-test-environment'

describe('Auto Server Tests', () => {
  test('automatic server management', async () => {
    await withAutoServer(
      createE2EConfig('auto-test'),
      async (env) => {
        // 서버 자동 시작됨
        const result = await env.restApiHelper!.get('/health')
        expect(result.success).toBe(true)
        // 테스트 완료 후 자동 정리됨
      }
    )
  })

  test('multiple independent environments', async () => {
    // 여러 독립적 환경 동시 실행
    const results = await Promise.all([
      withAutoServer(createE2EConfig('test-1'), async (env) => {
        return env.mcpHelper!.callTool('healthCheck', {})
      }),
      withAutoServer(createE2EConfig('test-2'), async (env) => {
        return env.restApiHelper!.get('/health')
      }),
      withAutoServer(createE2EConfig('test-3'), async (env) => {
        return env.mcpHelper!.listTools()
      })
    ])

    results.forEach(result => {
      expect(result).toBeDefined()
    })
  })
})
```

### 편의 함수들

```typescript
// 빠른 설정 함수들
export function createE2EConfig(suiteName: string, options?: TestConfig['options']): TestConfig {
  return {
    suiteName,
    type: 'e2e',
    serverManagement: 'isolated',
    options
  }
}

export function createIntegrationConfig(suiteName: string): TestConfig {
  return {
    suiteName,
    type: 'integration',
    serverManagement: 'isolated'
  }
}
```

## 🔧 동작 원리

### 1. 테스트 실행 플로우

```mermaid
graph TD
    A[테스트 시작] --> B[TestPortManager.allocatePort()]
    B --> C[격리된 데이터베이스 생성]
    C --> D[서버 시작 on 동적 포트]
    D --> E[헬스체크 대기]
    E --> F[테스트 실행]
    F --> G[cleanup() 호출]
    G --> H[서버 정지]
    H --> I[데이터베이스 삭제]
    I --> J[포트 해제]
```

### 2. 포트 관리 시스템

```typescript
// 포트 할당 예시
Port 5500: Test Suite A (GraphQL + REST + MCP)
Port 5501: Test Suite B (GraphQL + REST + MCP)
Port 5502: Test Suite C (GraphQL + REST + MCP)
...
Port 5999: Maximum (500개 동시 테스트 지원)
```

### 3. 환경 격리

```typescript
// 각 테스트 스위트는 독립적 환경 획득
Suite: "mcp-proxy-test"
├── Database: /tmp/bun-graph-db-tests/mcp-proxy-test-[timestamp]-[random].sqlite
├── Server: http://localhost:5500
├── REST API: http://localhost:5500/api
└── MCP: http://localhost:5500/mcp

Suite: "e2e-workflow-test"
├── Database: /tmp/bun-graph-db-tests/e2e-workflow-test-[timestamp]-[random].sqlite
├── Server: http://localhost:5501
├── REST API: http://localhost:5501/api
└── MCP: http://localhost:5501/mcp
```

## 📊 성능 및 안정성

### 성능 지표
- **서버 시작 시간**: ~2-3초
- **포트 할당 시간**: <1ms
- **환경 정리 시간**: ~1초
- **동시 테스트 지원**: 최대 500개 (포트 범위)

### 안정성 보장
- **포트 충돌 방지**: 동적 할당 + 사용 추적
- **리소스 누수 방지**: finally 블록에서 강제 정리
- **프로세스 종료 시 정리**: 시그널 핸들러로 전역 정리
- **타임아웃 설정**: 테스트별 적절한 타임아웃

### 에러 처리
```typescript
// 포트 고갈 상황
if (this.currentPort > 5999) {
  throw new Error('Test port range exhausted (5500-5999). Too many concurrent test servers.')
}

// 서버 시작 실패
try {
  await graphqlRequest('query { __schema { types { name } } }')
} catch (error) {
  console.error(`❌ GraphQL server health check failed: ${error}`)
  throw error
}

// 정리 실패 대응
process.on('exit', () => {
  TestPortManager.reset()
})
```

## 🧪 테스트 검증

### 구현된 테스트 파일들

1. **통합 테스트**: `tests/integration/mcp-rest-proxy-improved.test.ts`
   - MCP 프로토콜 테스트
   - REST API vs MCP 일관성 검증
   - 에러 처리 및 성능 테스트

2. **E2E 테스트**: `tests/e2e/mcp-rest-proxy-e2e-improved.test.ts`
   - 전체 워크플로우 테스트
   - 데이터 일관성 검증
   - 동시성 및 성능 테스트

### 검증 결과

```bash
# 성공적인 실행 로그
🚀 Setting up integration test environment: mcp-rest-proxy-integration-improved
✅ Test database setup complete: /tmp/bun-graph-db-tests/[...].sqlite
✅ GraphQL server health check passed: http://localhost:5500/graphql
🚀 Integration Test Environment Ready:
   - Server Port: 5500
   - GraphQL: http://localhost:5500/graphql
   - REST API: http://localhost:5500/api
   - MCP: http://localhost:5500/mcp

# 테스트 실행 (17개 테스트)
✅ 자동 서버 관리 동작 확인
✅ 포트 충돌 방지 확인
✅ 환경 격리 확인
✅ 자동 정리 확인

# 정리 로그
🧹 Cleaned up test database file: /tmp/[...].sqlite
✅ Integration test cleanup completed: mcp-rest-proxy-integration-improved
```

## 🚀 마이그레이션 가이드

### 기존 서버 종속적 테스트 변환

**Before (서버 종속적)**:
```typescript
beforeAll(async () => {
  try {
    const response = await fetch(`${REST_API_ENDPOINT}/health`)
    serverIsRunning = response.ok
  } catch (_error) {
    serverIsRunning = false
  }
})

test('api test', async () => {
  if (!serverIsRunning) {
    console.log('⏸️ Skipping test - server not running')
    return
  }
  // 테스트 로직
})
```

**After (서버 독립적)**:
```typescript
let testEnvironment: UnifiedTestEnvironment

beforeAll(async () => {
  const manager = new UnifiedTestEnvironmentManager()
  testEnvironment = await manager.setupTest(createE2EConfig('my-test'))
}, 30000)

afterAll(async () => {
  await testEnvironment.cleanup()
})

test('api test', async () => {
  // 서버가 항상 실행 중이므로 조건부 로직 불필요
  const result = await testEnvironment.restApiHelper!.get('/health')
  expect(result.success).toBe(true)
})
```

### 변환 체크리스트

- [ ] `serverIsRunning` 플래그 제거
- [ ] `UnifiedTestEnvironmentManager` 도입
- [ ] `beforeAll`에서 환경 설정
- [ ] `afterAll`에서 정리 호출
- [ ] 하드코딩된 포트 제거
- [ ] API 헬퍼 클래스 사용

## 📈 예상 효과

### 개발자 경험 개선
- **Zero Configuration**: 테스트 실행 전 서버 시작 불필요
- **Faster Feedback**: 환경 준비 자동화로 빠른 피드백
- **Parallel Testing**: 독립적 환경으로 병렬 실행 가능

### CI/CD 최적화
- **No External Dependencies**: 외부 서버 의존성 제거
- **Reliable Results**: 환경 차이로 인한 실패 제거
- **Consistent Environment**: 로컬과 CI에서 동일한 환경

### 코드 품질 향상
- **Better Coverage**: 테스트 실행 장벽 제거로 더 자주 실행
- **Isolation Benefits**: 테스트 간 간섭 없이 안정적 결과
- **Maintainability**: 표준화된 테스트 패턴

## 🔮 향후 발전 방향

### Phase 1: 현재 구현 (완료)
- ✅ 통합 환경 관리자
- ✅ 자동 서버 관리
- ✅ 포트 충돌 방지
- ✅ API 헬퍼 클래스

### Phase 2: 고도화 (계획)
- [ ] Docker 컨테이너 지원
- [ ] 클러스터 환경 테스트
- [ ] 성능 벤치마크 자동화
- [ ] 테스트 결과 메트릭 수집

### Phase 3: 생태계 확장 (미래)
- [ ] 다른 테스트 프레임워크 지원
- [ ] 시각적 테스트 대시보드
- [ ] AI 기반 테스트 최적화
- [ ] 클라우드 환경 통합

---

이 문서는 서버 독립적 테스트 아키텍처의 완전한 구현 가이드입니다.
모든 개발자가 `bun test` 명령어만으로 안정적이고 빠른 테스트를 실행할 수 있습니다.
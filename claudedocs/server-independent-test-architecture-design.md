# 서버 독립적 테스트 아키텍처 설계

## 📊 현황 분석

### 서버 종속적 테스트 현황
- **E2E 테스트**: `mcp-rest-proxy-e2e.test.ts` - `serverIsRunning` 플래그로 외부 서버 의존
- **MCP 프록시 통합**: `mcp-rest-proxy.test.ts` - 고정 포트(4260) 외부 서버 의존
- **일부 통합 테스트**: 수동 서버 시작/정지 필요

### 이미 해결된 테스트들
- **격리된 테스트**: `*-isolated.test.ts` - 자체 데이터베이스 환경
- **종합 테스트**: `*-comprehensive.test.ts` - `setupIntegrationTest()` 사용
- **시스템 쿼리 통합**: 전용 GraphQL 서버 자동 관리

## 🎯 통합 해결방안

### 1. 표준화된 테스트 환경 관리

```typescript
// tests/fixtures/unified-test-environment.ts
export interface UnifiedTestEnvironment {
  type: 'unit' | 'integration' | 'e2e'
  serverManagement: 'none' | 'isolated' | 'shared'
  cleanup: () => Promise<void>
}

export class TestEnvironmentManager {
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

  private async setupE2ETest(config: TestConfig): Promise<UnifiedTestEnvironment> {
    // 기존 setupIntegrationTest 패턴을 E2E에도 적용
    const server = await startServerForSuite(config.suiteName)
    const restApiHelper = createRestApiHelper(server.port)
    const mcpHelper = createMcpHelper(server.port)

    return {
      type: 'e2e',
      serverManagement: 'isolated',
      server,
      restApiHelper,
      mcpHelper,
      cleanup: async () => {
        await stopServerForSuite(config.suiteName)
      }
    }
  }
}
```

### 2. MCP 프록시 테스트 개선

```typescript
// tests/fixtures/mcp-test-helpers.ts
export class McpProxyTestEnvironment {
  constructor(private port: number) {}

  async callMcpTool(toolName: string, args: any = {}): Promise<any> {
    const request = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: toolName, arguments: args },
      id: Date.now(),
    }

    const response = await fetch(`http://localhost:${this.port}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  }

  async directRestCall(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const response = await fetch(`http://localhost:${this.port}/api${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })

    return await response.json()
  }
}
```

### 3. 자동 서버 시작/정지 패턴

```typescript
// tests/fixtures/auto-server-management.ts
export async function withAutoServer<T>(
  suiteName: string,
  testFn: (environment: TestEnvironment) => Promise<T>
): Promise<T> {
  let environment: TestEnvironment | null = null

  try {
    // 자동 서버 시작
    environment = await setupE2ETestEnvironment(suiteName)

    // 서버 준비 대기 (헬스체크)
    await waitForServerReady(environment.server.url, 10000)

    // 테스트 실행
    return await testFn(environment)

  } finally {
    // 자동 정리
    if (environment) {
      await environment.cleanup()
    }
  }
}

// 사용 예시:
describe('MCP Proxy E2E Tests', () => {
  test('complete workflow', async () => {
    await withAutoServer('mcp-e2e-workflow', async (env) => {
      const mcpHelper = new McpProxyTestEnvironment(env.server.port)

      // MCP 도구 호출
      const result = await mcpHelper.callMcpTool('healthCheck', {})
      expect(result.success).toBe(true)

      // REST API와 비교
      const directResult = await mcpHelper.directRestCall('/health')
      expect(result.data).toEqual(directResult.data)
    })
  })
})
```

### 4. 포트 충돌 방지 시스템

```typescript
// tests/fixtures/port-manager.ts
export class TestPortManager {
  private static usedPorts = new Set<number>()
  private static currentPort = 5500

  static allocatePort(): number {
    while (this.usedPorts.has(this.currentPort)) {
      this.currentPort++
      if (this.currentPort > 5999) {
        throw new Error('Test port range exhausted')
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

  static async checkPortAvailable(port: number): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${port}/health`)
      return !response.ok // 포트가 사용 중이면 false
    } catch {
      return true // 포트가 사용 가능하면 true
    }
  }
}
```

### 5. 테스트별 적용 전략

#### E2E 테스트 전환
```typescript
// 기존 방식 (서버 종속적)
beforeAll(async () => {
  try {
    const response = await fetch(`${REST_API_ENDPOINT}/health`)
    serverIsRunning = response.ok
  } catch (_error) {
    serverIsRunning = false
  }
})

// 개선된 방식 (서버 독립적)
let testEnvironment: TestEnvironment

beforeAll(async () => {
  testEnvironment = await setupE2ETestEnvironment('mcp-proxy-e2e')
}, 30000)

afterAll(async () => {
  await testEnvironment.cleanup()
})
```

#### MCP 프록시 테스트 전환
```typescript
// 기존 방식 (고정 포트 의존)
const TEST_PORT = 4260
const MCP_ENDPOINT = `http://localhost:${TEST_PORT}/mcp`

// 개선된 방식 (동적 포트 할당)
let mcpEnvironment: McpProxyTestEnvironment

beforeAll(async () => {
  const server = await startServerForSuite('mcp-proxy-integration')
  mcpEnvironment = new McpProxyTestEnvironment(server.port)
})
```

## 🚀 구현 계획

### Phase 1: 핵심 인프라 구축
1. `UnifiedTestEnvironment` 클래스 구현
2. `TestPortManager` 포트 관리 시스템
3. `withAutoServer` 패턴 구현

### Phase 2: E2E 테스트 전환
1. `mcp-rest-proxy-e2e.test.ts` 전환
2. `McpProxyTestEnvironment` 헬퍼 구현
3. 자동 서버 관리 적용

### Phase 3: MCP 프록시 테스트 전환
1. `mcp-rest-proxy.test.ts` 전환
2. 동적 포트 할당 적용
3. REST API vs MCP 비교 테스트 자동화

### Phase 4: 테스트 스위트 통합
1. 모든 테스트에 통일된 환경 관리 적용
2. 병렬 테스트 실행 지원
3. 성능 최적화 및 안정성 검증

## 📈 기대 효과

### 개발자 경험 개선
- **Zero Configuration**: 테스트 실행 전 서버 수동 시작 불필요
- **Parallel Testing**: 각 테스트 스위트가 독립적 포트 사용
- **Consistent Environment**: 모든 테스트가 동일한 방식으로 환경 관리

### 테스트 안정성 향상
- **Isolation**: 테스트 간 간섭 제거
- **Reproducibility**: 동일한 환경에서 일관된 결과
- **Error Handling**: 서버 시작 실패시 명확한 오류 메시지

### CI/CD 최적화
- **No External Dependencies**: 외부 서버 의존성 제거
- **Faster Execution**: 병렬 실행으로 테스트 시간 단축
- **Reliable Results**: 환경 차이로 인한 테스트 실패 제거

## 🔧 마이그레이션 가이드

### 기존 테스트 전환 방법
1. `serverIsRunning` 체크를 `withAutoServer` 패턴으로 변경
2. 하드코딩된 포트를 동적 할당으로 변경
3. `beforeAll/afterAll`에서 자동 환경 관리 적용

### 호환성 유지
- 기존 격리된 테스트들은 그대로 유지
- `setupIntegrationTest` 패턴 확장 적용
- 점진적 마이그레이션 지원

이 설계를 통해 모든 테스트가 서버 종속성 없이 독립적으로 실행될 수 있으며, 개발자는 테스트 실행 전 별도의 서버 시작 작업 없이 `bun test` 명령어만으로 전체 테스트를 실행할 수 있습니다.
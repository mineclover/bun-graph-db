/**
 * Unified Test Environment Manager
 * 모든 테스트 타입에 대한 통합 환경 관리
 */

import { createTestEnvironment, type TestEnvironment } from './test-database-factory'
import {
  startServerForSuite,
  stopServerForSuite,
  type TestGraphQLServer,
  createRequestHelper,
} from './test-graphql-server'

export interface TestConfig {
  suiteName: string
  type: 'unit' | 'integration' | 'e2e'
  serverManagement: 'none' | 'isolated' | 'shared'
  ports?: {
    graphql?: number
    rest?: number
    mcp?: number
  }
  options?: {
    seedData?: boolean
    mockExternalServices?: boolean
    enableLogging?: boolean
  }
}

export interface UnifiedTestEnvironment {
  type: 'unit' | 'integration' | 'e2e'
  suiteName: string
  database?: TestEnvironment
  server?: TestGraphQLServer
  graphqlRequest?: (query: string, variables?: Record<string, any>) => Promise<any>
  restApiHelper?: RestApiHelper
  mcpHelper?: McpHelper
  cleanup: () => Promise<void>
}

/**
 * REST API Helper for direct API calls
 */
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

  async put(endpoint: string, body?: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })

    return await response.json()
  }

  async delete(endpoint: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
      method: 'DELETE',
    })

    return await response.json()
  }
}

/**
 * MCP Helper for MCP protocol calls
 */
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

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()

    if (result.error) {
      throw new Error(`MCP Error: ${JSON.stringify(result.error)}`)
    }

    // Extract actual response from MCP wrapper
    if (result.result?.content?.[0]?.text) {
      return JSON.parse(result.result.content[0].text)
    }

    return result
  }

  async listTools(): Promise<any> {
    const request = {
      jsonrpc: '2.0' as const,
      method: 'tools/list' as const,
      params: {},
      id: 'tools-list',
    }

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    return await response.json()
  }

  async initialize(): Promise<any> {
    const request = {
      jsonrpc: '2.0' as const,
      method: 'initialize' as const,
      params: {},
      id: 'initialize',
    }

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    return await response.json()
  }
}

/**
 * Test Port Manager - 포트 충돌 방지
 */
export class TestPortManager {
  private static usedPorts = new Set<number>()
  private static currentPort = 5500

  static allocatePort(): number {
    while (this.usedPorts.has(this.currentPort)) {
      this.currentPort++
      if (this.currentPort > 5999) {
        throw new Error('Test port range exhausted (5500-5999). Too many concurrent test servers.')
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
      const response = await fetch(`http://localhost:${port}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(1000), // 1초 타임아웃
      })
      return !response.ok // 포트가 사용 중이면 false
    } catch {
      return true // 포트가 사용 가능하면 true
    }
  }

  static reset(): void {
    this.usedPorts.clear()
    this.currentPort = 5500
  }
}

/**
 * Unified Test Environment Manager
 */
export class UnifiedTestEnvironmentManager {
  /**
   * Setup test environment based on configuration
   */
  async setupTest(config: TestConfig): Promise<UnifiedTestEnvironment> {
    console.log(`🚀 Setting up ${config.type} test environment: ${config.suiteName}`)

    switch (config.type) {
      case 'unit':
        return this.setupUnitTest(config)
      case 'integration':
        return this.setupIntegrationTest(config)
      case 'e2e':
        return this.setupE2ETest(config)
    }
  }

  private async setupUnitTest(config: TestConfig): Promise<UnifiedTestEnvironment> {
    const database = await createTestEnvironment(config.suiteName)

    return {
      type: 'unit',
      suiteName: config.suiteName,
      database,
      cleanup: async () => {
        await database.cleanup()
        console.log(`✅ Unit test cleanup completed: ${config.suiteName}`)
      },
    }
  }

  private async setupIntegrationTest(config: TestConfig): Promise<UnifiedTestEnvironment> {
    const server = await startServerForSuite(config.suiteName)
    const graphqlRequest = createRequestHelper(config.suiteName)

    // GraphQL 헬스체크
    try {
      await graphqlRequest('query { __schema { types { name } } }')
      console.log(`✅ GraphQL server health check passed: ${server.url}`)
    } catch (error) {
      console.error(`❌ GraphQL server health check failed: ${error}`)
      throw error
    }

    return {
      type: 'integration',
      suiteName: config.suiteName,
      database: server.database,
      server,
      graphqlRequest,
      cleanup: async () => {
        await stopServerForSuite(config.suiteName)
        console.log(`✅ Integration test cleanup completed: ${config.suiteName}`)
      },
    }
  }

  private async setupE2ETest(config: TestConfig): Promise<UnifiedTestEnvironment> {
    const server = await startServerForSuite(config.suiteName)
    const graphqlRequest = createRequestHelper(config.suiteName)

    const baseUrl = `http://localhost:${server.port}`
    const restApiHelper = new RestApiHelper(baseUrl)
    const mcpHelper = new McpHelper(baseUrl)

    // 모든 엔드포인트 헬스체크
    try {
      // GraphQL 헬스체크
      await graphqlRequest('query { __schema { types { name } } }')
      console.log(`✅ GraphQL endpoint ready: ${server.url}`)

      // REST API 헬스체크
      await restApiHelper.get('/health')
      console.log(`✅ REST API endpoint ready: ${baseUrl}/api`)

      // MCP 헬스체크
      await mcpHelper.initialize()
      console.log(`✅ MCP endpoint ready: ${baseUrl}/mcp`)

    } catch (error) {
      console.error(`❌ E2E server health check failed: ${error}`)
      throw error
    }

    // 옵션 처리
    if (config.options?.seedData) {
      await this.seedTestData(server.database!)
      console.log(`📊 Seed data loaded for: ${config.suiteName}`)
    }

    return {
      type: 'e2e',
      suiteName: config.suiteName,
      database: server.database,
      server,
      graphqlRequest,
      restApiHelper,
      mcpHelper,
      cleanup: async () => {
        await stopServerForSuite(config.suiteName)
        console.log(`✅ E2E test cleanup completed: ${config.suiteName}`)
      },
    }
  }

  private async seedTestData(database: TestEnvironment): Promise<void> {
    const db = database.database.getConnection()

    // E2E 테스트용 시드 데이터
    db.transaction(() => {
      // 테스트 테이블 생성
      db.exec(`
        INSERT OR IGNORE INTO tables (id, identifier, description, created_at, updated_at)
        VALUES
        (100, 'e2e-test-table', 'E2E Test Table', datetime('now'), datetime('now')),
        (101, 'e2e-users', 'E2E Users Table', datetime('now'), datetime('now')),
        (102, 'e2e-projects', 'E2E Projects Table', datetime('now'), datetime('now'))
      `)

      // 테스트 노드 생성
      db.exec(`
        INSERT OR IGNORE INTO table_nodes (id, table_id, content, created_at, updated_at)
        VALUES
        (200, 100, 'E2E Test Node 1', datetime('now'), datetime('now')),
        (201, 100, 'E2E Test Node 2', datetime('now'), datetime('now')),
        (202, 101, 'E2E User Node', datetime('now'), datetime('now'))
      `)

      // 테스트 템플릿 생성
      db.exec(`
        INSERT OR IGNORE INTO templates (identifier, name, query_text, operation_type, created_at, updated_at)
        VALUES
        ('e2e-health-check', 'E2E Health Check', 'query { healthCheck { status } }', 'query', datetime('now'), datetime('now')),
        ('e2e-create-node', 'E2E Create Node', 'mutation($input: CreateNodeInput!) { createNode(input: $input) { success } }', 'mutation', datetime('now'), datetime('now'))
      `)
    })()
  }
}

/**
 * 자동 서버 관리 패턴
 */
export async function withAutoServer<T>(
  config: TestConfig,
  testFn: (environment: UnifiedTestEnvironment) => Promise<T>
): Promise<T> {
  const manager = new UnifiedTestEnvironmentManager()
  let environment: UnifiedTestEnvironment | null = null

  try {
    environment = await manager.setupTest(config)
    return await testFn(environment)
  } finally {
    if (environment) {
      await environment.cleanup()
    }
  }
}

/**
 * 편의 함수들
 */
export function createTestConfig(overrides: Partial<TestConfig>): TestConfig {
  return {
    suiteName: `test-${Date.now()}`,
    type: 'integration',
    serverManagement: 'isolated',
    ...overrides,
  }
}

export function createE2EConfig(suiteName: string, options?: TestConfig['options']): TestConfig {
  return {
    suiteName,
    type: 'e2e',
    serverManagement: 'isolated',
    options,
  }
}

export function createIntegrationConfig(suiteName: string): TestConfig {
  return {
    suiteName,
    type: 'integration',
    serverManagement: 'isolated',
  }
}

// 전역 정리 핸들러
process.on('exit', () => {
  TestPortManager.reset()
})

process.on('SIGINT', async () => {
  TestPortManager.reset()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  TestPortManager.reset()
  process.exit(0)
})
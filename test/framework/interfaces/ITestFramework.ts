/**
 * Core Test Framework Interface
 * 통합 테스트 프레임워크의 핵심 인터페이스 정의
 */

export interface ITestFactory<T> {
  create(overrides?: Partial<T>): T
  createValid(): T
  createInvalid(): T
}

export interface ITestMockManager {
  createTypedMock<T>(implementation?: Partial<T>): jest.Mocked<T>
  resetAllMocks(): void
  verifyMockCalls(mockName: string, expectedCalls: number): void
}

export interface ITestErrorHandler {
  assertNonNull<T>(value: T | null | undefined, message?: string): asserts value is T
  safeUnwrap<T>(result: unknown): T
  expectError(fn: () => Promise<any>, expectedErrorType?: string): Promise<void>
}

export interface ITestDataBuilder<T> {
  build(): T
  with<K extends keyof T>(field: K, value: T[K]): ITestDataBuilder<T>
  withDefaults(): ITestDataBuilder<T>
}

export interface ITestValidator {
  validateGraphQLResponse(response: any, expectedFields: string[]): boolean
  validateEntityStructure<T>(entity: T, requiredFields: (keyof T)[]): boolean
  validateTypeSafety(value: unknown, expectedType: string): boolean
}

export interface ITestCleanup {
  addCleanupTask(task: () => Promise<void>): void
  executeCleanup(): Promise<void>
  reset(): void
}

export interface ITestContext {
  readonly testId: string
  readonly createdResources: Map<string, string[]>
  readonly mockManager: ITestMockManager
  readonly errorHandler: ITestErrorHandler
  readonly cleanup: ITestCleanup
}

export interface ITestRunner {
  initialize(): Promise<void>
  runTests(pattern?: string): Promise<TestResult[]>
  cleanup(): Promise<void>
}

export interface TestResult {
  name: string
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  error?: string
  metadata?: Record<string, any>
}

export interface TestSuiteConfig {
  name: string
  timeout: number
  retries: number
  parallel: boolean
  beforeEach?: () => Promise<void>
  afterEach?: () => Promise<void>
}
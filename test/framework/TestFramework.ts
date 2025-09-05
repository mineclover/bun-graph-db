import { TestMockManager } from './core/TestMockManager.js'
import { TestErrorHandler } from './core/TestErrorHandler.js'
import { GraphQLTypeMapper, GraphQLTypeGuards } from './core/GraphQLTypeMapper.js'
import type { 
  ITestContext, 
  ITestCleanup, 
  ITestValidator 
} from './interfaces/ITestFramework.js'

/**
 * Unified Test Framework
 * 모든 테스트에서 사용할 수 있는 통합 프레임워크
 */

export class TestCleanup implements ITestCleanup {
  private cleanupTasks: (() => Promise<void>)[] = []

  addCleanupTask(task: () => Promise<void>): void {
    this.cleanupTasks.push(task)
  }

  async executeCleanup(): Promise<void> {
    for (const task of this.cleanupTasks) {
      try {
        await task()
      } catch (error) {
        console.error('Cleanup task failed:', error)
      }
    }
  }

  reset(): void {
    this.cleanupTasks = []
  }
}

export class TestValidator implements ITestValidator {
  validateGraphQLResponse(response: any, expectedFields: string[]): boolean {
    for (const field of expectedFields) {
      if (!(field in response)) {
        throw new Error(`Expected field '${field}' not found in GraphQL response`)
      }
    }
    return true
  }

  validateEntityStructure<T>(entity: T, requiredFields: (keyof T)[]): boolean {
    for (const field of requiredFields) {
      if (!(field in entity) || entity[field] === undefined) {
        throw new Error(`Required field '${String(field)}' is missing or undefined`)
      }
    }
    return true
  }

  validateTypeSafety(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case 'NodeDto':
        return GraphQLTypeGuards.isNodeDto(value)
      case 'TableDto':
        return GraphQLTypeGuards.isTableDto(value)
      default:
        throw new Error(`Unknown type for validation: ${expectedType}`)
    }
  }
}

export class TestContext implements ITestContext {
  readonly testId: string
  readonly createdResources: Map<string, string[]> = new Map()
  readonly mockManager: TestMockManager
  readonly errorHandler: TestErrorHandler
  readonly cleanup: TestCleanup

  constructor(testId?: string) {
    this.testId = testId || `test_${Date.now()}`
    this.mockManager = new TestMockManager()
    this.errorHandler = new TestErrorHandler()
    this.cleanup = new TestCleanup()
  }

  addResource(type: string, id: string): void {
    const existing = this.createdResources.get(type) || []
    existing.push(id)
    this.createdResources.set(type, existing)
  }

  getResources(type: string): string[] {
    return this.createdResources.get(type) || []
  }

  async cleanupResources(): Promise<void> {
    await this.cleanup.executeCleanup()
    this.createdResources.clear()
  }
}

/**
 * Main Test Framework Class
 */
export class TestFramework {
  private static instance: TestFramework
  private contexts: Map<string, TestContext> = new Map()

  static getInstance(): TestFramework {
    if (!TestFramework.instance) {
      TestFramework.instance = new TestFramework()
    }
    return TestFramework.instance
  }

  createContext(testId?: string): TestContext {
    const context = new TestContext(testId)
    this.contexts.set(context.testId, context)
    return context
  }

  getContext(testId: string): TestContext | undefined {
    return this.contexts.get(testId)
  }

  async cleanupContext(testId: string): Promise<void> {
    const context = this.contexts.get(testId)
    if (context) {
      await context.cleanupResources()
      this.contexts.delete(testId)
    }
  }

  async cleanupAll(): Promise<void> {
    for (const [testId] of this.contexts) {
      await this.cleanupContext(testId)
    }
  }

  // Factory methods for common test utilities
  static createMockManager(): TestMockManager {
    return new TestMockManager()
  }

  static createErrorHandler(): TestErrorHandler {
    return new TestErrorHandler()
  }

  static createValidator(): TestValidator {
    return new TestValidator()
  }

  // Type mapper utilities
  static get TypeMapper() {
    return GraphQLTypeMapper
  }

  static get TypeGuards() {
    return GraphQLTypeGuards
  }

  // Mock manager access
  static get TestMockManager() {
    return TestMockManager
  }
}

// Export convenience functions
export function createTestContext(testId?: string): TestContext {
  return TestFramework.getInstance().createContext(testId)
}

export function getTestContext(testId: string): TestContext | undefined {
  return TestFramework.getInstance().getContext(testId)
}

export async function cleanupTest(testId: string): Promise<void> {
  return TestFramework.getInstance().cleanupContext(testId)
}

export async function cleanupAllTests(): Promise<void> {
  return TestFramework.getInstance().cleanupAll()
}

// Re-export all core components
export { TestMockManager } from './core/TestMockManager.js'
export { TestErrorHandler, AssertionError, GraphQLError, TestError } from './core/TestErrorHandler.js'
export { GraphQLTypeMapper, GraphQLTypeGuards } from './core/GraphQLTypeMapper.js'
export type * from './interfaces/ITestFramework.js'
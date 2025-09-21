/**
 * Test Isolation Helpers
 * Common utilities for isolated testing
 */

import { TestDatabaseFactory, type TestEnvironment } from './test-database-factory'
import { GraphQLTestServerManager, type TestGraphQLServer } from './test-graphql-server'

export interface IsolatedTestContext {
  type: 'unit' | 'integration' | 'e2e'
  suiteName: string
  database?: TestEnvironment
  server?: TestGraphQLServer
  graphqlRequest?: (query: string, variables?: Record<string, any>) => Promise<any>
  cleanup: () => Promise<void>
}

export class TestIsolationHelpers {
  private static contexts: Map<string, IsolatedTestContext> = new Map()

  /**
   * Setup unit test environment (file-based database for isolation)
   */
  static async setupUnitTest(suiteName: string): Promise<IsolatedTestContext> {
    console.log(`🧪 Setting up unit test environment: ${suiteName}`)

    const database = await TestDatabaseFactory.createTestEnvironment(suiteName)

    const context: IsolatedTestContext = {
      type: 'unit',
      suiteName,
      database,
      cleanup: async () => {
        await database.cleanup()
        TestIsolationHelpers.contexts.delete(suiteName)
        console.log(`✅ Unit test cleanup completed: ${suiteName}`)
      },
    }

    TestIsolationHelpers.contexts.set(suiteName, context)
    console.log(`✅ Unit test environment ready: ${suiteName}`)
    return context
  }

  /**
   * Setup integration test environment (database + GraphQL server)
   */
  static async setupIntegrationTest(suiteName: string): Promise<IsolatedTestContext> {
    console.log(`🚀 Setting up integration test environment: ${suiteName}`)

    const server = await GraphQLTestServerManager.startServerForSuite(suiteName)
    const graphqlRequest = GraphQLTestServerManager.createRequestHelper(suiteName)

    // Verify server is ready with a health check
    try {
      await graphqlRequest('query { __schema { types { name } } }')
      console.log(`✅ GraphQL server health check passed: ${server.url}`)
    } catch (error) {
      console.error(`❌ GraphQL server health check failed: ${error}`)
      throw error
    }

    const context: IsolatedTestContext = {
      type: 'integration',
      suiteName,
      database: server.database,
      server,
      graphqlRequest,
      cleanup: async () => {
        await GraphQLTestServerManager.stopServerForSuite(suiteName)
        TestIsolationHelpers.contexts.delete(suiteName)
        console.log(`✅ Integration test cleanup completed: ${suiteName}`)
      },
    }

    TestIsolationHelpers.contexts.set(suiteName, context)
    console.log(`✅ Integration test environment ready: ${suiteName} (${server.url})`)
    return context
  }

  /**
   * Setup E2E test environment with additional configuration
   */
  static async setupE2ETest(
    suiteName: string,
    options?: {
      seedData?: boolean
      mockExternalServices?: boolean
      enableLogging?: boolean
    }
  ): Promise<IsolatedTestContext> {
    console.log(`🌐 Setting up E2E test environment: ${suiteName}`)

    const server = await GraphQLTestServerManager.startServerForSuite(suiteName)
    const graphqlRequest = GraphQLTestServerManager.createRequestHelper(suiteName)

    // Apply E2E specific configuration
    if (options?.seedData) {
      await TestIsolationHelpers.seedTestData(server.database)
      console.log(`📊 Seed data loaded for: ${suiteName}`)
    }

    if (options?.mockExternalServices) {
      await TestIsolationHelpers.setupMockServices(suiteName)
      console.log(`🎭 Mock services configured for: ${suiteName}`)
    }

    const context: IsolatedTestContext = {
      type: 'e2e',
      suiteName,
      database: server.database,
      server,
      graphqlRequest,
      cleanup: async () => {
        if (options?.mockExternalServices) {
          await TestIsolationHelpers.cleanupMockServices(suiteName)
        }
        await GraphQLTestServerManager.stopServerForSuite(suiteName)
        TestIsolationHelpers.contexts.delete(suiteName)
        console.log(`✅ E2E test cleanup completed: ${suiteName}`)
      },
    }

    TestIsolationHelpers.contexts.set(suiteName, context)
    console.log(`✅ E2E test environment ready: ${suiteName}`)
    return context
  }

  /**
   * Get existing test context
   */
  static getContext(suiteName: string): IsolatedTestContext | null {
    return TestIsolationHelpers.contexts.get(suiteName) || null
  }

  /**
   * Cleanup specific test context
   */
  static async cleanup(suiteName: string): Promise<void> {
    const context = TestIsolationHelpers.contexts.get(suiteName)
    if (context) {
      await context.cleanup()
    }
  }

  /**
   * Cleanup all test contexts
   */
  static async cleanupAll(): Promise<void> {
    console.log('🧹 Cleaning up all test environments...')
    const cleanupPromises = Array.from(TestIsolationHelpers.contexts.values()).map((context) =>
      context.cleanup()
    )
    await Promise.all(cleanupPromises)
    console.log('✅ All test environments cleaned up')
  }

  /**
   * Seed test data for E2E tests
   */
  private static async seedTestData(database: TestEnvironment): Promise<void> {
    const db = database.database.getConnection()

    // Seed common test data
    db.transaction(() => {
      // Insert test todos
      db.exec(`
        INSERT OR IGNORE INTO todos (id, title, completed)
        VALUES
        (1, 'Test Todo 1', 0),
        (2, 'Test Todo 2', 1),
        (3, 'Test Todo 3', 0)
      `)

      // Insert test documentation
      db.exec(`
        INSERT OR IGNORE INTO docs (table_id, category, version, content, is_active)
        VALUES
        (58, 'USAGE', 1, 'Test usage documentation', 1),
        (58, 'GUIDE', 1, 'Test guide documentation', 1),
        (58, 'EXAMPLE', 1, 'Test example documentation', 1)
      `)

      // Insert test templates
      db.exec(`
        INSERT OR IGNORE INTO templates (identifier, query_text, operation_type)
        VALUES
        ('test-query', 'query TestQuery { todos { id title } }', 'query'),
        ('test-mutation', 'mutation TestMutation($input: TodoInput!) { createTodo(input: $input) { id } }', 'mutation')
      `)
    })()
  }

  /**
   * Setup mock external services for E2E tests
   */
  private static async setupMockServices(suiteName: string): Promise<void> {
    // Implementation would depend on specific external services
    // For now, just log that mocks are being set up
    console.log(`Setting up mock services for: ${suiteName}`)
  }

  /**
   * Cleanup mock external services
   */
  private static async cleanupMockServices(suiteName: string): Promise<void> {
    console.log(`Cleaning up mock services for: ${suiteName}`)
  }

  /**
   * Create performance measurement helper
   */
  static createPerformanceHelper(suiteName: string) {
    const measurements: Record<string, number[]> = {}

    return {
      measure: <T>(operationName: string, fn: () => Promise<T> | T): Promise<T> => {
        const start = performance.now()

        const result = fn()

        if (result instanceof Promise) {
          return result.finally(() => {
            const duration = performance.now() - start
            if (!measurements[operationName]) measurements[operationName] = []
            measurements[operationName].push(duration)
          })
        } else {
          const duration = performance.now() - start
          if (!measurements[operationName]) measurements[operationName] = []
          measurements[operationName].push(duration)
          return Promise.resolve(result)
        }
      },

      getStats: () => {
        const stats: Record<string, { avg: number; min: number; max: number; count: number }> = {}

        for (const [operation, times] of Object.entries(measurements)) {
          stats[operation] = {
            avg: times.reduce((a, b) => a + b, 0) / times.length,
            min: Math.min(...times),
            max: Math.max(...times),
            count: times.length,
          }
        }

        return stats
      },

      reportStats: () => {
        const stats = TestIsolationHelpers.getStats()
        console.log(`📊 Performance stats for ${suiteName}:`)

        for (const [operation, stat] of Object.entries(stats)) {
          console.log(
            `  ${operation}: avg=${stat.avg.toFixed(2)}ms, min=${stat.min.toFixed(2)}ms, max=${stat.max.toFixed(2)}ms (${stat.count} calls)`
          )
        }
      },
    }
  }

  /**
   * Create assertion helpers for common test patterns
   */
  static createAssertionHelpers() {
    return {
      assertGraphQLResponse: (result: any) => {
        if (result.errors) {
          console.error('GraphQL Errors:', result.errors)
          throw new Error(`GraphQL query failed: ${result.errors[0]?.message || 'Unknown error'}`)
        }

        if (!result.data) {
          throw new Error('GraphQL response missing data field')
        }

        return result.data
      },

      assertDatabaseRecord: (db: any, table: string, conditions: Record<string, any>) => {
        const whereClause = Object.keys(conditions)
          .map((key) => `${key} = ?`)
          .join(' AND ')

        const values = Object.values(conditions)
        const record = db.prepare(`SELECT * FROM ${table} WHERE ${whereClause}`).get(...values)

        if (!record) {
          throw new Error(
            `No record found in ${table} with conditions: ${JSON.stringify(conditions)}`
          )
        }

        return record
      },

      assertPerformance: (actualMs: number, maxMs: number, operation: string) => {
        if (actualMs > maxMs) {
          throw new Error(
            `Performance assertion failed: ${operation} took ${actualMs}ms, expected < ${maxMs}ms`
          )
        }
      },
    }
  }
}

// Global cleanup handlers
process.on('exit', () => {
  TestIsolationHelpers.cleanupAll()
})

process.on('SIGINT', async () => {
  await TestIsolationHelpers.cleanupAll()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await TestIsolationHelpers.cleanupAll()
  process.exit(0)
})

export default TestIsolationHelpers

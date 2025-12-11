/**
 * Test Isolation Helpers
 * Common utilities for isolated testing
 */

import { createTestEnvironment, type TestEnvironment } from './test-database-factory'
import {
  createRequestHelper,
  startServerForSuite,
  stopServerForSuite,
  type TestGraphQLServer,
} from './test-graphql-server'

export interface IsolatedTestContext {
  type: 'unit' | 'integration' | 'e2e'
  suiteName: string
  database?: TestEnvironment
  server?: TestGraphQLServer
  graphqlRequest?: (query: string, variables?: Record<string, any>) => Promise<any>
  cleanup: () => Promise<void>
}

// Module-level state for test isolation contexts
const isolationContexts: Map<string, IsolatedTestContext> = new Map()

/**
 * Setup unit test environment (file-based database for isolation)
 */
export async function setupUnitTest(suiteName: string): Promise<IsolatedTestContext> {
  console.log(`🧪 Setting up unit test environment: ${suiteName}`)

  const database = await createTestEnvironment(suiteName)

  const context: IsolatedTestContext = {
    type: 'unit',
    suiteName,
    database,
    cleanup: async () => {
      await database.cleanup()
      isolationContexts.delete(suiteName)
      console.log(`✅ Unit test cleanup completed: ${suiteName}`)
    },
  }

  isolationContexts.set(suiteName, context)
  console.log(`✅ Unit test environment ready: ${suiteName}`)
  return context
}

/**
 * Setup integration test environment (database + GraphQL server)
 */
export async function setupIntegrationTest(suiteName: string): Promise<IsolatedTestContext> {
  console.log(`🚀 Setting up integration test environment: ${suiteName}`)

  const server = await startServerForSuite(suiteName)
  const graphqlRequest = createRequestHelper(suiteName)

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
      await stopServerForSuite(suiteName)
      isolationContexts.delete(suiteName)
      console.log(`✅ Integration test cleanup completed: ${suiteName}`)
    },
  }

  isolationContexts.set(suiteName, context)
  console.log(`✅ Integration test environment ready: ${suiteName} (${server.url})`)
  return context
}

/**
 * Setup E2E test environment with additional configuration
 */
export async function setupE2ETest(
  suiteName: string,
  options?: {
    seedData?: boolean
    mockExternalServices?: boolean
    enableLogging?: boolean
  },
): Promise<IsolatedTestContext> {
  console.log(`🌐 Setting up E2E test environment: ${suiteName}`)

  const server = await startServerForSuite(suiteName)
  const graphqlRequest = createRequestHelper(suiteName)

  // Apply E2E specific configuration
  if (options?.seedData) {
    await seedTestData(server.database)
    console.log(`📊 Seed data loaded for: ${suiteName}`)
  }

  if (options?.mockExternalServices) {
    await setupMockServices(suiteName)
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
        await cleanupMockServices(suiteName)
      }
      await stopServerForSuite(suiteName)
      isolationContexts.delete(suiteName)
      console.log(`✅ E2E test cleanup completed: ${suiteName}`)
    },
  }

  isolationContexts.set(suiteName, context)
  console.log(`✅ E2E test environment ready: ${suiteName}`)
  return context
}

/**
 * Get existing test context
 */
export function getContext(suiteName: string): IsolatedTestContext | null {
  return isolationContexts.get(suiteName) || null
}

/**
 * Cleanup specific test context
 */
export async function cleanup(suiteName: string): Promise<void> {
  const context = isolationContexts.get(suiteName)
  if (context) {
    await context.cleanup()
  }
}

/**
 * Cleanup all test contexts
 */
export async function cleanupAll(): Promise<void> {
  console.log('🧹 Cleaning up all test environments...')
  const cleanupPromises = Array.from(isolationContexts.values()).map((context) => context.cleanup())
  await Promise.all(cleanupPromises)
  console.log('✅ All test environments cleaned up')
}

/**
 * Seed test data for E2E tests
 */
async function seedTestData(database: TestEnvironment): Promise<void> {
  const db = database.database.getConnection()

  // Seed common test data
  db.transaction(() => {
    // Insert test tables with specific IDs that E2E tests expect
    db.exec(`
      INSERT OR IGNORE INTO tables (id, identifier, description, created_at, updated_at)
      VALUES
      (58, 'todos', 'Test todos table for E2E', datetime('now'), datetime('now')),
      (59, 'users', 'Test users table for E2E', datetime('now'), datetime('now')),
      (60, 'projects', 'Test projects table for E2E', datetime('now'), datetime('now'))
    `)

    // Insert test todos
    db.exec(`
      INSERT OR IGNORE INTO todos (id, title, completed)
      VALUES
      (1, 'Test Todo 1', 0),
      (2, 'Test Todo 2', 1),
      (3, 'Test Todo 3', 0)
    `)

    // Insert test documentation (using table 61 to avoid conflicts with E2E tests that use tables 58-60)
    db.exec(`
      INSERT OR IGNORE INTO tables (id, identifier, description, created_at, updated_at)
      VALUES
      (61, 'seeded-table', 'Test table for seeded docs', datetime('now'), datetime('now'))
    `)

    db.exec(`
      INSERT OR IGNORE INTO docs (table_id, category, version, content, is_active, created_at, updated_at)
      VALUES
      (61, 'usage', 1, 'Test usage documentation', 1, datetime('now'), datetime('now'))
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
async function setupMockServices(suiteName: string): Promise<void> {
  // Implementation would depend on specific external services
  // For now, just log that mocks are being set up
  console.log(`Setting up mock services for: ${suiteName}`)
}

/**
 * Cleanup mock external services
 */
async function cleanupMockServices(suiteName: string): Promise<void> {
  console.log(`Cleaning up mock services for: ${suiteName}`)
}

/**
 * Create performance measurement helper
 */
export function createPerformanceHelper(suiteName: string) {
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
      console.log(`📊 Performance stats for ${suiteName}:`)

      for (const [operation, times] of Object.entries(measurements)) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length
        const min = Math.min(...times)
        const max = Math.max(...times)
        console.log(
          `  ${operation}: avg=${avg.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms (${times.length} calls)`,
        )
      }
    },
  }
}

/**
 * Create assertion helpers for common test patterns
 */
export function createAssertionHelpers() {
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
        throw new Error(`No record found in ${table} with conditions: ${JSON.stringify(conditions)}`)
      }

      return record
    },

    assertPerformance: (actualMs: number, maxMs: number, operation: string) => {
      if (actualMs > maxMs) {
        throw new Error(`Performance assertion failed: ${operation} took ${actualMs}ms, expected < ${maxMs}ms`)
      }
    },
  }
}

// Global cleanup handlers
process.on('exit', () => {
  cleanupAll()
})

process.on('SIGINT', async () => {
  await cleanupAll()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await cleanupAll()
  process.exit(0)
})

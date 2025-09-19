/**
 * Template Creation Test - Isolated Unit Version
 * Fast unit tests with isolated in-memory database
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { type IsolatedTestContext, TestIsolationHelpers } from '../fixtures/test-isolation-helpers'

const SUITE_NAME = 'template-creation-isolated'
let testContext: IsolatedTestContext

// Mock template service for unit testing
class MockTemplateService {
  private db: any

  constructor(database: any) {
    this.db = database
  }

  async createTemplate(identifier: string, queryText: string, operationType: string) {
    // Create templates table if not exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT NOT NULL UNIQUE,
        query_text TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Insert template
    const stmt = this.db.prepare(`
      INSERT INTO templates (identifier, query_text, operation_type)
      VALUES (?, ?, ?)
    `)

    const result = stmt.run(identifier, queryText, operationType)

    return {
      id: result.lastInsertRowid,
      identifier,
      queryText,
      operationType,
      createdAt: new Date().toISOString(),
    }
  }

  async getTemplate(identifier: string) {
    const stmt = this.db.prepare('SELECT * FROM templates WHERE identifier = ?')
    return stmt.get(identifier)
  }

  async validateGraphQL(queryText: string) {
    // Simple validation - check for basic GraphQL syntax
    if (!queryText.trim()) {
      throw new Error('Query text cannot be empty')
    }

    if (!queryText.includes('{') || !queryText.includes('}')) {
      throw new Error('Invalid GraphQL syntax')
    }

    // Check for operation type
    const operationType = queryText.trim().startsWith('mutation')
      ? 'mutation'
      : queryText.trim().startsWith('subscription')
        ? 'subscription'
        : 'query'

    return { isValid: true, operationType }
  }
}

let templateService: MockTemplateService

describe('Template Creation - Isolated Unit Tests', () => {
  beforeAll(async () => {
    console.log('🚀 Setting up unit test environment for template creation...')
    testContext = await TestIsolationHelpers.setupUnitTest(SUITE_NAME)
    templateService = new MockTemplateService(testContext.database!.database.getConnection())
    console.log('✅ Unit test environment ready')
  })

  afterAll(async () => {
    console.log('🧹 Cleaning up unit test environment...')
    await testContext.cleanup()
    console.log('✅ Cleanup completed')
  })

  describe('Template Creation', () => {
    test('should create simple query template', async () => {
      const identifier = 'simple-query'
      const queryText = 'query SimpleQuery { todos { id title } }'
      const operationType = 'query'

      const template = await templateService.createTemplate(identifier, queryText, operationType)

      expect(template).toBeDefined()
      expect(template.identifier).toBe(identifier)
      expect(template.queryText).toBe(queryText)
      expect(template.operationType).toBe(operationType)
      expect(template.id).toBeGreaterThan(0)
    })

    test('should create mutation template', async () => {
      const identifier = 'create-todo'
      const queryText =
        'mutation CreateTodo($input: TodoInput!) { createTodo(input: $input) { id title } }'
      const operationType = 'mutation'

      const template = await templateService.createTemplate(identifier, queryText, operationType)

      expect(template).toBeDefined()
      expect(template.identifier).toBe(identifier)
      expect(template.operationType).toBe(operationType)
    })

    test('should create subscription template', async () => {
      const identifier = 'todo-updates'
      const queryText = 'subscription TodoUpdates { todoUpdated { id title completed } }'
      const operationType = 'subscription'

      const template = await templateService.createTemplate(identifier, queryText, operationType)

      expect(template).toBeDefined()
      expect(template.identifier).toBe(identifier)
      expect(template.operationType).toBe(operationType)
    })

    test('should prevent duplicate identifiers', async () => {
      const identifier = 'duplicate-test'
      const queryText = 'query DuplicateTest { todos { id } }'

      // First creation should succeed
      await templateService.createTemplate(identifier, queryText, 'query')

      // Second creation should fail
      await expect(templateService.createTemplate(identifier, queryText, 'query')).rejects.toThrow()
    })
  })

  describe('Template Validation', () => {
    test('should validate correct GraphQL query', async () => {
      const queryText = 'query ValidQuery { todos { id title completed } }'

      const result = await templateService.validateGraphQL(queryText)

      expect(result.isValid).toBe(true)
      expect(result.operationType).toBe('query')
    })

    test('should validate correct GraphQL mutation', async () => {
      const queryText =
        'mutation ValidMutation($input: TodoInput!) { createTodo(input: $input) { id } }'

      const result = await templateService.validateGraphQL(queryText)

      expect(result.isValid).toBe(true)
      expect(result.operationType).toBe('mutation')
    })

    test('should validate correct GraphQL subscription', async () => {
      const queryText = 'subscription ValidSubscription { todoUpdated { id } }'

      const result = await templateService.validateGraphQL(queryText)

      expect(result.isValid).toBe(true)
      expect(result.operationType).toBe('subscription')
    })

    test('should reject empty query text', async () => {
      await expect(templateService.validateGraphQL('')).rejects.toThrow()
    })

    test('should reject invalid GraphQL syntax', async () => {
      await expect(templateService.validateGraphQL('invalid graphql syntax')).rejects.toThrow()
    })
  })

  describe('Template Retrieval', () => {
    test('should retrieve existing template', async () => {
      const identifier = 'retrieval-test'
      const queryText = 'query RetrievalTest { todos { id } }'

      // Create template
      await templateService.createTemplate(identifier, queryText, 'query')

      // Retrieve template
      const retrieved = await templateService.getTemplate(identifier)

      expect(retrieved).toBeDefined()
      expect(retrieved.identifier).toBe(identifier)
      expect(retrieved.query_text).toBe(queryText)
      expect(retrieved.operation_type).toBe('query')
    })

    test('should return null for non-existent template', async () => {
      const retrieved = await templateService.getTemplate('non-existent')

      expect(retrieved).toBeNull()
    })
  })

  describe('Database Integration', () => {
    test('should persist templates in isolated database', async () => {
      const db = testContext.database!.database.getConnection()

      // Create template via service
      await templateService.createTemplate(
        'persistence-test',
        'query Test { todos { id } }',
        'query'
      )

      // Verify direct database access
      const result = db.prepare('SELECT COUNT(*) as count FROM templates').get()
      expect(result.count).toBeGreaterThan(0)

      // Verify specific template
      const template = db
        .prepare('SELECT * FROM templates WHERE identifier = ?')
        .get('persistence-test')
      expect(template).toBeDefined()
      expect(template.identifier).toBe('persistence-test')
    })

    test('should handle database transactions', async () => {
      const db = testContext.database!.database.getConnection()

      const result = db.transaction(() => {
        // Create multiple templates in transaction
        templateService.createTemplate('tx-test-1', 'query TxTest1 { todos { id } }', 'query')
        templateService.createTemplate('tx-test-2', 'query TxTest2 { todos { title } }', 'query')

        return db
          .prepare('SELECT COUNT(*) as count FROM templates WHERE identifier LIKE ?')
          .get('tx-test-%')
      })()

      expect(result.count).toBe(2)
    })
  })

  describe('Performance', () => {
    test('should create templates quickly', async () => {
      const startTime = performance.now()

      // Create multiple templates
      const promises = Array.from({ length: 10 }, (_, i) =>
        templateService.createTemplate(
          `perf-test-${i}`,
          `query PerfTest${i} { todos { id } }`,
          'query'
        )
      )

      await Promise.all(promises)

      const duration = performance.now() - startTime
      expect(duration).toBeLessThan(100) // Should complete in < 100ms
    })

    test('should validate templates quickly', async () => {
      const startTime = performance.now()

      // Validate multiple queries
      const promises = Array.from({ length: 20 }, (_, i) =>
        templateService.validateGraphQL(`query FastValidation${i} { todos { id title } }`)
      )

      await Promise.all(promises)

      const duration = performance.now() - startTime
      expect(duration).toBeLessThan(50) // Should complete in < 50ms
    })
  })
})

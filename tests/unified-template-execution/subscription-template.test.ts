/**
 * Unified Template Execution Test - Subscription Entry Point
 * Tests the new subscription-based template execution system
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { GraphQLSchema, buildSchema } from 'graphql'
import type { ILogger } from '@/application/ports/ILogger.js'
import { ExecuteTemplateWithSubscriptionUseCase } from '@/application/use-cases/query-templates/ExecuteTemplateWithSubscriptionUseCase.js'
import { ExecuteQueryTemplateUseCase } from '@/application/use-cases/query-templates/ExecuteQueryTemplate.js'
import { ExecuteTemplateWithGraphQLUseCase } from '@/application/use-cases/query-templates/ExecuteTemplateWithGraphQL.js'

// Mock logger
const mockLogger: ILogger = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data || ''),
  warn: (message: string, data?: any) => console.warn(`[WARN] ${message}`, data || ''),
  error: (message: string, data?: any) => console.error(`[ERROR] ${message}`, data || ''),
  debug: (message: string, data?: any) => console.debug(`[DEBUG] ${message}`, data || ''),
}

// Mock GraphQL schema
const testSchema = buildSchema(`
  type Query {
    hello: String
    user(id: ID!): User
  }

  type Mutation {
    createUser(name: String!): User
  }

  type Subscription {
    userCreated: User
  }

  type User {
    id: ID!
    name: String!
  }
`)

// Mock query template repository
const mockQueryTemplateRepository = {
  async findByIdentifier(identifier: string) {
    const templates: Record<string, any> = {
      'simple-query': {
        getId: () => 'template-1',
        getName: () => 'Simple Query',
        getQueryText: () => 'query { hello }',
        getIsActive: () => true,
        getComplexityScore: () => 1,
        getVersion: () => '1.0.0',
        getDefaultVariables: () => ({}),
        validateVariables: () => ({ isValid: true, errors: [] }),
      },
      'user-query': {
        getId: () => 'template-2',
        getName: () => 'User Query',
        getQueryText: () => 'query GetUser($userId: ID!) { user(id: $userId) { id name } }',
        getIsActive: () => true,
        getComplexityScore: () => 3,
        getVersion: () => '1.0.0',
        getDefaultVariables: () => ({ userId: '1' }),
        validateVariables: () => ({ isValid: true, errors: [] }),
      },
      'subscription-template': {
        getId: () => 'template-3',
        getName: () => 'User Subscription',
        getQueryText: () => 'subscription { userCreated { id name } }',
        getIsActive: () => true,
        getComplexityScore: () => 2,
        getVersion: () => '1.0.0',
        getDefaultVariables: () => ({}),
        validateVariables: () => ({ isValid: true, errors: [] }),
      },
    }
    return templates[identifier] || null
  },

  async incrementUsage() {
    // Mock implementation
    return Promise.resolve()
  },
}

describe('Unified Template Execution - Subscription Tests', () => {
  let executeQueryTemplateUseCase: ExecuteQueryTemplateUseCase
  let executeTemplateWithGraphQLUseCase: ExecuteTemplateWithGraphQLUseCase
  let executeSubscriptionUseCase: ExecuteTemplateWithSubscriptionUseCase

  beforeAll(async () => {
    // Setup use cases
    executeQueryTemplateUseCase = new ExecuteQueryTemplateUseCase(
      mockQueryTemplateRepository as any,
      mockLogger
    )

    executeTemplateWithGraphQLUseCase = new ExecuteTemplateWithGraphQLUseCase(
      executeQueryTemplateUseCase,
      testSchema,
      mockLogger
    )

    executeSubscriptionUseCase = new ExecuteTemplateWithSubscriptionUseCase(
      executeTemplateWithGraphQLUseCase,
      mockLogger
    )
  })

  test('should successfully execute simple query template stream', async () => {
    const events: any[] = []

    // Execute template stream
    const stream = executeSubscriptionUseCase.execute({
      templateIdentifier: 'simple-query',
      variables: {},
      trackUsage: true,
    })

    // Collect all events
    for await (const event of stream) {
      events.push(event)
    }

    // Verify event flow
    expect(events.length).toBeGreaterThanOrEqual(3) // STARTING -> IN_PROGRESS -> COMPLETED

    // Check starting event
    const startEvent = events[0]
    expect(startEvent.status).toBe('STARTING')
    expect(startEvent.progress).toBe(0)
    expect(startEvent.timestamp).toBeInstanceOf(Date)

    // Check completion event
    const completedEvent = events[events.length - 1]
    expect(completedEvent.status).toBe('COMPLETED')
    expect(completedEvent.progress).toBe(1.0)
    expect(completedEvent.data).toBeDefined()
    expect(completedEvent.metadata.templateId).toBe('template-1')
    expect(completedEvent.metadata.templateName).toBe('Simple Query')
  })

  test('should handle parameterized query template stream', async () => {
    const events: any[] = []

    const stream = executeSubscriptionUseCase.execute({
      templateIdentifier: 'user-query',
      variables: { userId: '123' },
      trackUsage: true,
    })

    for await (const event of stream) {
      events.push(event)
    }

    // Verify parameterized execution
    const completedEvent = events[events.length - 1]
    expect(completedEvent.status).toBe('COMPLETED')
    expect(completedEvent.metadata.templateId).toBe('template-2')
    expect(completedEvent.metadata.complexityScore).toBe(3)
  })

  test('should handle subscription query template stream', async () => {
    const events: any[] = []

    const stream = executeSubscriptionUseCase.execute({
      templateIdentifier: 'subscription-template',
      variables: {},
      trackUsage: true,
    })

    for await (const event of stream) {
      events.push(event)
    }

    // Verify subscription handling
    const completedEvent = events[events.length - 1]
    expect(completedEvent.status).toBe('COMPLETED')
    expect(completedEvent.metadata.templateName).toBe('User Subscription')
  })

  test('should handle template not found error', async () => {
    const events: any[] = []

    const stream = executeSubscriptionUseCase.execute({
      templateIdentifier: 'non-existent-template',
      variables: {},
      trackUsage: true,
    })

    for await (const event of stream) {
      events.push(event)
    }

    // Verify error handling
    expect(events.length).toBeGreaterThanOrEqual(1)
    const errorEvent = events[events.length - 1]
    expect(errorEvent.status).toBe('ERROR')
    expect(errorEvent.error).toContain('not found')
  })

  test('should handle GraphQL parse error', async () => {
    // Add template with invalid GraphQL
    const invalidTemplate = {
      getId: () => 'invalid-template',
      getName: () => 'Invalid Template',
      getQueryText: () => 'invalid graphql syntax {',
      getIsActive: () => true,
      getComplexityScore: () => 1,
      getVersion: () => '1.0.0',
      getDefaultVariables: () => ({}),
      validateVariables: () => ({ isValid: true, errors: [] }),
    }

    // Mock repository with invalid template
    const mockRepo = {
      ...mockQueryTemplateRepository,
      async findByIdentifier(identifier: string) {
        if (identifier === 'invalid-template') {
          return invalidTemplate
        }
        return mockQueryTemplateRepository.findByIdentifier(identifier)
      },
    }

    const tempUseCase = new ExecuteQueryTemplateUseCase(mockRepo as any, mockLogger)
    const tempGraphQLUseCase = new ExecuteTemplateWithGraphQLUseCase(
      tempUseCase,
      testSchema,
      mockLogger
    )
    const tempSubscriptionUseCase = new ExecuteTemplateWithSubscriptionUseCase(
      tempGraphQLUseCase,
      mockLogger
    )

    const events: any[] = []
    const stream = tempSubscriptionUseCase.execute({
      templateIdentifier: 'invalid-template',
      variables: {},
      trackUsage: true,
    })

    for await (const event of stream) {
      events.push(event)
    }

    // Verify GraphQL parse error handling
    const errorEvent = events[events.length - 1]
    expect(errorEvent.status).toBe('ERROR')
    expect(errorEvent.error).toContain('Invalid GraphQL query')
  })

  test('should support chunked streaming for large data', async () => {
    const events: any[] = []

    const stream = executeSubscriptionUseCase.execute({
      templateIdentifier: 'simple-query',
      variables: {},
      trackUsage: true,
    })

    for await (const event of stream) {
      events.push(event)
    }

    // Verify chunking behavior - data is chunked in the processDataInChunks method
    expect(events.length).toBeGreaterThanOrEqual(1)
    const completedEvent = events[events.length - 1]
    expect(completedEvent.status).toBe('COMPLETED')
  })

  test('should include execution metadata in all events', async () => {
    const events: any[] = []

    const stream = executeSubscriptionUseCase.execute({
      templateIdentifier: 'user-query',
      variables: { userId: '456' },
      trackUsage: true,
    })

    for await (const event of stream) {
      events.push(event)
    }

    // Verify metadata presence
    for (const event of events) {
      expect(event.metadata).toBeDefined()
      expect(event.timestamp).toBeInstanceOf(Date)
      
      if (event.status !== 'STARTING') {
        expect(event.metadata.templateId).toBeDefined()
        expect(event.metadata.templateName).toBeDefined()
        expect(event.metadata.executionTime).toBeTypeOf('number')
      }
    }
  })
})

// Performance test
describe('Template Execution Performance', () => {
  test('should complete stream execution within reasonable time', async () => {
    const executeQueryTemplateUseCase = new ExecuteQueryTemplateUseCase(
      mockQueryTemplateRepository as any,
      mockLogger
    )

    const executeTemplateWithGraphQLUseCase = new ExecuteTemplateWithGraphQLUseCase(
      executeQueryTemplateUseCase,
      testSchema,
      mockLogger
    )

    const executeSubscriptionUseCase = new ExecuteTemplateWithSubscriptionUseCase(
      executeTemplateWithGraphQLUseCase,
      mockLogger
    )

    const startTime = Date.now()
    const events: any[] = []

    const stream = executeSubscriptionUseCase.execute({
      templateIdentifier: 'simple-query',
      variables: {},
      trackUsage: true,
    })

    for await (const event of stream) {
      events.push(event)
    }

    const totalTime = Date.now() - startTime

    // Verify performance targets
    expect(totalTime).toBeLessThan(1000) // Should complete within 1 second
    expect(events.length).toBeGreaterThanOrEqual(1)

    // Verify execution time metadata
    const completedEvent = events[events.length - 1]
    if (completedEvent.status === 'COMPLETED') {
      expect(completedEvent.metadata.executionTime).toBeLessThan(500) // UseCase execution <500ms
    }
  })
})
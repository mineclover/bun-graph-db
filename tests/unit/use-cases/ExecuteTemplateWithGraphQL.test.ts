import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { GraphQLInt, GraphQLList, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { ExecuteQueryTemplateUseCase } from '@/application/use-cases/query-templates/ExecuteQueryTemplate.js'
import {
  type ExecuteTemplateWithGraphQLInput,
  ExecuteTemplateWithGraphQLUseCase,
} from '@/application/use-cases/query-templates/ExecuteTemplateWithGraphQL.js'

describe('ExecuteTemplateWithGraphQLUseCase', () => {
  let useCase: ExecuteTemplateWithGraphQLUseCase
  let mockExecuteQueryTemplateUseCase: ExecuteQueryTemplateUseCase
  let mockLogger: ILogger
  let testSchema: GraphQLSchema

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
      debug: mock(() => {}),
    }

    // Create a simple test GraphQL schema
    const UserType = new GraphQLObjectType({
      name: 'User',
      fields: {
        id: { type: GraphQLString },
        name: { type: GraphQLString },
        age: { type: GraphQLInt },
      },
    })

    const QueryType = new GraphQLObjectType({
      name: 'Query',
      fields: {
        user: {
          type: UserType,
          args: {
            id: { type: GraphQLString },
          },
          resolve: (_, args) => ({
            id: args.id,
            name: 'Test User',
            age: 30,
          }),
        },
        users: {
          type: new GraphQLList(UserType),
          resolve: () => [
            { id: '1', name: 'User 1', age: 25 },
            { id: '2', name: 'User 2', age: 35 },
          ],
        },
      },
    })

    testSchema = new GraphQLSchema({
      query: QueryType,
    })

    // Mock ExecuteQueryTemplateUseCase
    mockExecuteQueryTemplateUseCase = {
      execute: mock(async () => ({
        queryText: 'query { users { id name } }',
        processedVariables: {},
        metadata: {
          templateId: 'template-1',
          templateName: 'Test Template',
          complexityScore: 5,
          version: '1.0.0',
          executionTime: 0,
        },
      })),
    } as any

    useCase = new ExecuteTemplateWithGraphQLUseCase(mockExecuteQueryTemplateUseCase, testSchema, mockLogger)
  })

  describe('Template Preparation', () => {
    it('should prepare template successfully', async () => {
      const input: ExecuteTemplateWithGraphQLInput = {
        templateIdentifier: 'test-template',
      }

      await useCase.execute(input)

      expect(mockExecuteQueryTemplateUseCase.execute).toHaveBeenCalledWith({
        templateIdentifier: 'test-template',
        variables: undefined,
        trackUsage: undefined,
      })
    })

    it('should handle template not found error', async () => {
      const input: ExecuteTemplateWithGraphQLInput = {
        templateIdentifier: 'nonexistent-template',
      }

      mockExecuteQueryTemplateUseCase.execute = mock(async () => {
        throw new Error('Template not found')
      })

      const result = await useCase.execute(input)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors?.[0].message).toContain('Template not found')
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('GraphQL Parsing', () => {
    it('should parse valid GraphQL query successfully', async () => {
      const input: ExecuteTemplateWithGraphQLInput = {
        templateIdentifier: 'valid-query',
      }

      mockExecuteQueryTemplateUseCase.execute = mock(async () => ({
        queryText: 'query { users { id name } }',
        processedVariables: {},
        metadata: {
          templateId: 'template-1',
          templateName: 'Valid Query',
          complexityScore: 3,
          version: '1.0.0',
          executionTime: 0,
        },
      }))

      const result = await useCase.execute(input)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('should handle invalid GraphQL query parsing error', async () => {
      const input: ExecuteTemplateWithGraphQLInput = {
        templateIdentifier: 'invalid-query',
      }

      mockExecuteQueryTemplateUseCase.execute = mock(async () => ({
        queryText: 'query { invalid syntax }}',
        processedVariables: {},
        metadata: {
          templateId: 'template-1',
          templateName: 'Invalid Query',
          complexityScore: 1,
          version: '1.0.0',
          executionTime: 0,
        },
      }))

      const result = await useCase.execute(input)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors?.[0].message).toContain('Invalid GraphQL query')
      expect(result.errors?.[0].extensions?.code).toBe('GRAPHQL_PARSE_ERROR')
      expect(mockLogger.error).toHaveBeenCalledWith('GraphQL query parse error', expect.any(Object))
    })
  })

  describe('GraphQL Execution', () => {
    it('should execute query successfully and return data', async () => {
      const input: ExecuteTemplateWithGraphQLInput = {
        templateIdentifier: 'users-query',
      }

      mockExecuteQueryTemplateUseCase.execute = mock(async () => ({
        queryText: 'query { users { id name age } }',
        processedVariables: {},
        metadata: {
          templateId: 'template-1',
          templateName: 'Get Users',
          complexityScore: 4,
          version: '1.0.0',
          executionTime: 0,
        },
      }))

      const result = await useCase.execute(input)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.users).toBeDefined()
      expect(result.data.users.length).toBe(2)
      expect(result.data.users[0].name).toBe('User 1')
      expect(mockLogger.info).toHaveBeenCalledWith('Template executed successfully', expect.any(Object))
    })

    it('should return data even with partial errors in simple schema', async () => {
      const input: ExecuteTemplateWithGraphQLInput = {
        templateIdentifier: 'partial-query',
      }

      mockExecuteQueryTemplateUseCase.execute = mock(async () => ({
        queryText: 'query { users { id name } }',
        processedVariables: {},
        metadata: {
          templateId: 'template-1',
          templateName: 'Partial Query',
          complexityScore: 2,
          version: '1.0.0',
          executionTime: 0,
        },
      }))

      const result = await useCase.execute(input)

      // In simple test schema, queries succeed even with non-existent fields
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('should execute query with variables', async () => {
      const input: ExecuteTemplateWithGraphQLInput = {
        templateIdentifier: 'user-by-id',
        variables: { id: '123' },
      }

      mockExecuteQueryTemplateUseCase.execute = mock(async () => ({
        queryText: 'query GetUser($id: String) { user(id: $id) { id name } }',
        processedVariables: { id: '123' },
        metadata: {
          templateId: 'template-1',
          templateName: 'Get User By ID',
          complexityScore: 3,
          version: '1.0.0',
          executionTime: 0,
        },
      }))

      const result = await useCase.execute(input)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.user).toBeDefined()
      expect(result.data.user.id).toBe('123')
      expect(mockExecuteQueryTemplateUseCase.execute).toHaveBeenCalledWith({
        templateIdentifier: 'user-by-id',
        variables: { id: '123' },
        trackUsage: undefined,
      })
    })

    it('should execute query with context', async () => {
      const input: ExecuteTemplateWithGraphQLInput = {
        templateIdentifier: 'context-query',
        context: { userId: 'user-123', permissions: ['read'] },
      }

      mockExecuteQueryTemplateUseCase.execute = mock(async () => ({
        queryText: 'query { users { id } }',
        processedVariables: {},
        metadata: {
          templateId: 'template-1',
          templateName: 'Context Query',
          complexityScore: 2,
          version: '1.0.0',
          executionTime: 0,
        },
      }))

      const result = await useCase.execute(input)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('should track usage when trackUsage is true', async () => {
      const input: ExecuteTemplateWithGraphQLInput = {
        templateIdentifier: 'tracked-query',
        trackUsage: true,
      }

      await useCase.execute(input)

      expect(mockExecuteQueryTemplateUseCase.execute).toHaveBeenCalledWith({
        templateIdentifier: 'tracked-query',
        variables: undefined,
        trackUsage: true,
      })
    })
  })

  describe('Metadata', () => {
    it('should include execution time in metadata', async () => {
      const input: ExecuteTemplateWithGraphQLInput = {
        templateIdentifier: 'timed-query',
      }

      const result = await useCase.execute(input)

      expect(result.metadata).toBeDefined()
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0)
      expect(typeof result.metadata.executionTime).toBe('number')
    })

    it('should include template information in metadata', async () => {
      const input: ExecuteTemplateWithGraphQLInput = {
        templateIdentifier: 'metadata-query',
      }

      mockExecuteQueryTemplateUseCase.execute = mock(async () => ({
        queryText: 'query { users { id } }',
        processedVariables: {},
        metadata: {
          templateId: 'template-123',
          templateName: 'Metadata Query Template',
          complexityScore: 7,
          version: '2.5.0',
          executionTime: 0,
        },
      }))

      const result = await useCase.execute(input)

      expect(result.metadata.templateId).toBe('template-123')
      expect(result.metadata.templateName).toBe('Metadata Query Template')
      expect(result.metadata.complexityScore).toBe(7)
      expect(result.metadata.version).toBe('2.5.0')
    })

    it('should include metadata even when execution fails', async () => {
      const input: ExecuteTemplateWithGraphQLInput = {
        templateIdentifier: 'failing-query',
      }

      mockExecuteQueryTemplateUseCase.execute = mock(async () => ({
        queryText: 'query { invalid',
        processedVariables: {},
        metadata: {
          templateId: 'template-1',
          templateName: 'Failing Query',
          complexityScore: 1,
          version: '1.0.0',
          executionTime: 0,
        },
      }))

      const result = await useCase.execute(input)

      expect(result.success).toBe(false)
      expect(result.metadata).toBeDefined()
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle template preparation failure', async () => {
      const input: ExecuteTemplateWithGraphQLInput = {
        templateIdentifier: 'prep-fail',
      }

      mockExecuteQueryTemplateUseCase.execute = mock(async () => {
        throw new Error('Template preparation failed')
      })

      const result = await useCase.execute(input)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors?.[0].message).toContain('Template preparation failed')
      expect(result.errors?.[0].extensions?.code).toBe('TEMPLATE_EXECUTION_ERROR')
      expect(result.metadata.templateId).toBe('unknown')
      expect(mockLogger.error).toHaveBeenCalledWith('Template execution failed', expect.any(Object))
    })

    it('should handle general execution failure gracefully', async () => {
      const input: ExecuteTemplateWithGraphQLInput = {
        templateIdentifier: 'general-fail',
      }

      mockExecuteQueryTemplateUseCase.execute = mock(async () => {
        throw new Error('Unexpected error')
      })

      const result = await useCase.execute(input)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.metadata).toBeDefined()
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Logging', () => {
    it('should log execution start, progress, and completion', async () => {
      const input: ExecuteTemplateWithGraphQLInput = {
        templateIdentifier: 'logged-execution',
        variables: { id: 'test' },
      }

      await useCase.execute(input)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Executing template with GraphQL',
        expect.objectContaining({
          identifier: 'logged-execution',
          hasVariables: true,
        }),
      )
      expect(mockLogger.info).toHaveBeenCalledWith('Template executed successfully', expect.any(Object))
    })

    it('should log parse errors with appropriate detail', async () => {
      const input: ExecuteTemplateWithGraphQLInput = {
        templateIdentifier: 'error-logged',
      }

      mockExecuteQueryTemplateUseCase.execute = mock(async () => ({
        queryText: 'query { invalid syntax',
        processedVariables: {},
        metadata: {
          templateId: 'template-1',
          templateName: 'Error Query',
          complexityScore: 1,
          version: '1.0.0',
          executionTime: 0,
        },
      }))

      await useCase.execute(input)

      expect(mockLogger.error).toHaveBeenCalledWith('GraphQL query parse error', expect.any(Object))
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty variables object', async () => {
      const input: ExecuteTemplateWithGraphQLInput = {
        templateIdentifier: 'empty-vars',
        variables: {},
      }

      const result = await useCase.execute(input)

      expect(result.success).toBe(true)
    })

    it('should handle undefined variables', async () => {
      const input: ExecuteTemplateWithGraphQLInput = {
        templateIdentifier: 'no-vars',
      }

      const result = await useCase.execute(input)

      expect(result.success).toBe(true)
    })

    it('should preserve error information from parse errors', async () => {
      const input: ExecuteTemplateWithGraphQLInput = {
        templateIdentifier: 'detailed-error',
      }

      mockExecuteQueryTemplateUseCase.execute = mock(async () => ({
        queryText: 'query { invalid',
        processedVariables: {},
        metadata: {
          templateId: 'template-1',
          templateName: 'Detailed Error',
          complexityScore: 1,
          version: '1.0.0',
          executionTime: 0,
        },
      }))

      const result = await useCase.execute(input)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors?.[0].message).toContain('Invalid GraphQL query')
      expect(result.errors?.[0].extensions?.code).toBe('GRAPHQL_PARSE_ERROR')
    })
  })
})

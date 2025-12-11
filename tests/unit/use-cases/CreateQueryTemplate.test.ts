import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { ILogger } from '@/application/ports/ILogger.js'
import {
  CreateQueryTemplate,
  type CreateQueryTemplateRequest,
} from '@/application/use-cases/query-templates/CreateQueryTemplate.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import { DomainException } from '@/shared/exceptions/DomainException.js'

describe('CreateQueryTemplate', () => {
  let useCase: CreateQueryTemplate
  let mockQueryTemplateRepository: IQueryTemplateRepository
  let mockLogger: ILogger

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
      debug: mock(() => {}),
    }

    // Mock repository
    mockQueryTemplateRepository = {
      create: mock(async (template) => template),
      findById: mock(async () => null),
      findByIdentifier: mock(async () => null),
      findAll: mock(async () => []),
      update: mock(async () => {}),
      delete: mock(async () => {}),
      search: mock(async () => ({ templates: [], total: 0 })),
      activate: mock(async () => {}),
      deactivate: mock(async () => {}),
      incrementUsageCount: mock(async () => {}),
      updateExecutionStats: mock(async () => {}),
    } as any

    useCase = new CreateQueryTemplate(mockQueryTemplateRepository, mockLogger)
  })

  describe('Input Validation', () => {
    it('should throw DomainException when identifier is empty', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: '',
        name: 'Test Template',
        queryText: 'query { test }',
        tags: ['test'],
      }

      await expect(useCase.execute(request)).rejects.toThrow(DomainException)
      await expect(useCase.execute(request)).rejects.toThrow('Query template identifier cannot be empty')
    })

    it('should throw DomainException when identifier contains uppercase letters', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'TestTemplate',
        name: 'Test Template',
        queryText: 'query { test }',
        tags: ['test'],
      }

      await expect(useCase.execute(request)).rejects.toThrow(DomainException)
      await expect(useCase.execute(request)).rejects.toThrow(
        'Query template identifier must contain only lowercase letters',
      )
    })

    it('should throw DomainException when identifier contains invalid characters', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'test@template',
        name: 'Test Template',
        queryText: 'query { test }',
        tags: ['test'],
      }

      await expect(useCase.execute(request)).rejects.toThrow(DomainException)
      await expect(useCase.execute(request)).rejects.toThrow(
        'Query template identifier must contain only lowercase letters',
      )
    })

    it('should throw error when queryText is empty or invalid GraphQL', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'test-template',
        name: 'Test Template',
        queryText: '',
        tags: ['test'],
      }

      // Empty queryText will fail GraphQL parsing before entity validation
      await expect(useCase.execute(request)).rejects.toThrow()
    })

    it('should use auto-calculated complexity when provided score is invalid', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'test-template',
        name: 'Test Template',
        queryText: 'query { test }',
        tags: ['test'],
        complexityScore: 0,
      }

      // When complexityScore is 0 or invalid, auto-calculation is used instead of throwing
      const result = await useCase.execute(request)
      expect(result.getComplexityScore()).toBeGreaterThanOrEqual(1)
      expect(result.getComplexityScore()).toBeLessThanOrEqual(10)
    })

    it('should throw DomainException when complexityScore is greater than 10', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'test-template',
        name: 'Test Template',
        queryText: 'query { test }',
        tags: ['test'],
        complexityScore: 11,
      }

      await expect(useCase.execute(request)).rejects.toThrow(DomainException)
      await expect(useCase.execute(request)).rejects.toThrow('Complexity score must be between 1 and 10')
    })
  })

  describe('Successful Template Creation', () => {
    it('should create query template with required fields only', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'simple-query',
        name: 'Simple Query',
        queryText: 'query GetUsers { users { id name } }',
        tags: ['users', 'simple'],
      }

      const result = await useCase.execute(request)

      expect(result).toBeDefined()
      expect(result.getIdentifier()).toBe('simple-query')
      expect(result.getQueryText()).toBe('query GetUsers { users { id name } }')
      expect(result.getTags()).toEqual(['users', 'simple'])
      expect(mockQueryTemplateRepository.create).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creating query template',
        expect.objectContaining({
          identifier: 'simple-query',
          name: 'Simple Query',
        }),
      )
    })

    it('should create query template with description', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'users-query',
        name: 'Get Users',
        queryText: 'query { users { id } }',
        tags: ['users'],
        description: 'Fetches all users from the system',
      }

      const result = await useCase.execute(request)

      expect(result).toBeDefined()
      expect(result.getDescription()).toBe('Fetches all users from the system')
      expect(mockQueryTemplateRepository.create).toHaveBeenCalled()
    })

    it('should create query template with inputSchema', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'user-by-id',
        name: 'Get User By ID',
        queryText: 'query GetUser($id: ID!) { user(id: $id) { id name } }',
        tags: ['users', 'single'],
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'User ID' },
          },
          required: ['id'],
        },
      }

      const result = await useCase.execute(request)

      expect(result).toBeDefined()
      expect(result.getInputSchema()).toBeDefined()
      expect(result.getInputSchema()?.properties.id.type).toBe('string')
      expect(mockQueryTemplateRepository.create).toHaveBeenCalled()
    })

    it('should create query template with defaultVariables', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'users-paginated',
        name: 'Get Users Paginated',
        queryText: 'query GetUsers($limit: Int, $offset: Int) { users(limit: $limit, offset: $offset) { id } }',
        tags: ['users', 'pagination'],
        defaultVariables: {
          limit: 10,
          offset: 0,
        },
      }

      const result = await useCase.execute(request)

      expect(result).toBeDefined()
      expect(result.getDefaultVariables()).toEqual({ limit: 10, offset: 0 })
      expect(mockQueryTemplateRepository.create).toHaveBeenCalled()
    })

    it('should create query template with applicableTables', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'table-specific',
        name: 'Table Specific Query',
        queryText: 'query { nodes { id } }',
        tags: ['nodes'],
        applicableTables: ['users', 'products'],
      }

      const result = await useCase.execute(request)

      expect(result).toBeDefined()
      expect(result.getApplicableTables()).toEqual(['users', 'products'])
      expect(mockQueryTemplateRepository.create).toHaveBeenCalled()
    })

    it('should create mutation template with templateType', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'create-user',
        name: 'Create User',
        queryText: 'mutation CreateUser($name: String!) { createUser(name: $name) { id } }',
        tags: ['users', 'create'],
        templateType: 'mutation',
      }

      const result = await useCase.execute(request)

      expect(result).toBeDefined()
      expect(result.getOperationType()).toBe('mutation')
      expect(mockQueryTemplateRepository.create).toHaveBeenCalled()
    })

    it('should create query template with custom complexityScore', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'complex-query',
        name: 'Complex Query',
        queryText: 'query { users { posts { comments { author { id } } } } }',
        tags: ['complex'],
        complexityScore: 8,
      }

      const result = await useCase.execute(request)

      expect(result).toBeDefined()
      expect(result.getComplexityScore()).toBe(8)
      expect(mockQueryTemplateRepository.create).toHaveBeenCalled()
    })

    it('should create query template with version', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'versioned-query',
        name: 'Versioned Query',
        queryText: 'query { users { id } }',
        tags: ['users'],
        version: '2.1.0',
      }

      const result = await useCase.execute(request)

      expect(result).toBeDefined()
      expect(result.getVersion()).toBe('2.1.0')
      expect(mockQueryTemplateRepository.create).toHaveBeenCalled()
    })

    it('should create query template with all optional fields', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'complete-template',
        name: 'Complete Template',
        queryText: 'query GetUser($id: ID!) { user(id: $id) { id name email } }',
        tags: ['users', 'complete'],
        description: 'A complete template with all optional fields',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'User identifier' },
          },
          required: ['id'],
        },
        defaultVariables: { id: 'default-id' },
        applicableTables: ['users'],
        templateType: 'query',
        complexityScore: 5,
        version: '1.5.0',
      }

      const result = await useCase.execute(request)

      expect(result).toBeDefined()
      expect(result.getIdentifier()).toBe('complete-template')
      expect(result.getDescription()).toBe('A complete template with all optional fields')
      expect(result.getInputSchema()).toBeDefined()
      expect(result.getDefaultVariables()).toEqual({ id: 'default-id' })
      expect(result.getApplicableTables()).toEqual(['users'])
      expect(result.getComplexityScore()).toBe(5)
      expect(result.getVersion()).toBe('1.5.0')
      expect(mockQueryTemplateRepository.create).toHaveBeenCalled()
    })
  })

  describe('GraphQL Parsing', () => {
    it('should correctly parse query operation type', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'query-operation',
        name: 'Query Operation',
        queryText: 'query GetAllUsers { users { id name } }',
        tags: ['query'],
      }

      const result = await useCase.execute(request)

      expect(result.getOperationType()).toBe('query')
    })

    it('should correctly parse mutation operation type', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'mutation-operation',
        name: 'Mutation Operation',
        queryText: 'mutation CreateUser($name: String!) { createUser(name: $name) { id } }',
        tags: ['mutation'],
      }

      const result = await useCase.execute(request)

      expect(result.getOperationType()).toBe('mutation')
    })

    it('should correctly parse subscription operation type', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'subscription-operation',
        name: 'Subscription Operation',
        queryText: 'subscription OnUserCreated { userCreated { id name } }',
        tags: ['subscription'],
      }

      const result = await useCase.execute(request)

      expect(result.getOperationType()).toBe('subscription')
    })

    it('should extract query name from GraphQL', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'named-query',
        name: 'Should Be Overridden',
        queryText: 'query GetUsersWithPosts { users { id posts { title } } }',
        tags: ['users'],
      }

      const result = await useCase.execute(request)

      // The name should be extracted from the query operation name
      expect(result.getName()).toBe('GetUsersWithPosts')
    })
  })

  describe('Error Handling', () => {
    it('should log errors and rethrow when repository save fails', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'failing-template',
        name: 'Failing Template',
        queryText: 'query { test }',
        tags: ['test'],
      }

      const saveError = new Error('Database connection failed')

      mockQueryTemplateRepository.create = mock(async () => {
        throw saveError
      })

      await expect(useCase.execute(request)).rejects.toThrow('Database connection failed')
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create query template',
        expect.objectContaining({
          error: 'Database connection failed',
        }),
      )
    })
  })

  describe('Logging', () => {
    it('should log template creation start and success', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'logged-template',
        name: 'Logged Template',
        queryText: 'query { users { id } }',
        tags: ['logging'],
      }

      const _result = await useCase.execute(request)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creating query template',
        expect.objectContaining({
          identifier: 'logged-template',
          name: 'Logged Template',
        }),
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Query template created successfully',
        expect.objectContaining({
          identifier: 'logged-template',
        }),
      )
    })
  })

  describe('Edge Cases', () => {
    it('should accept empty tags array', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'no-tags',
        name: 'No Tags',
        queryText: 'query { test }',
        tags: [],
      }

      const result = await useCase.execute(request)

      expect(result).toBeDefined()
      expect(result.getTags()).toEqual([])
    })

    it('should handle identifier with hyphens and underscores', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'template-with_mixed-separators_123',
        name: 'Mixed Separators',
        queryText: 'query { test }',
        tags: ['test'],
      }

      const result = await useCase.execute(request)

      expect(result).toBeDefined()
      expect(result.getIdentifier()).toBe('template-with_mixed-separators_123')
    })

    it('should handle complex GraphQL query with nested fields', async () => {
      const request: CreateQueryTemplateRequest = {
        identifier: 'deeply-nested',
        name: 'Deeply Nested Query',
        queryText: `
          query GetComplexData($userId: ID!) {
            user(id: $userId) {
              id
              name
              posts {
                id
                title
                comments {
                  id
                  text
                  author {
                    id
                    name
                  }
                }
              }
            }
          }
        `,
        tags: ['complex', 'nested'],
      }

      const result = await useCase.execute(request)

      expect(result).toBeDefined()
      expect(result.getOperationType()).toBe('query')
      expect(result.getComplexityScore()).toBeGreaterThan(1)
    })
  })
})

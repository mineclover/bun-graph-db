import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { ILogger } from '@/application/ports/ILogger.js'
import {
  UpdateQueryTemplate,
  type UpdateQueryTemplateRequest,
} from '@/application/use-cases/query-templates/UpdateQueryTemplate.js'
import { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import { ValidationException } from '@/shared/exceptions/DomainException.js'

// Helper function to create test QueryTemplate
function createTestTemplate(
  id: string = 'template-1',
  identifier: string = 'test-template',
  name: string = 'Test Template',
  queryText: string = 'query { test }',
  tags: string[] = ['test'],
): QueryTemplate {
  return QueryTemplate.fromDatabase(
    id,
    identifier,
    name,
    null, // description
    queryText,
    null, // queryName
    null, // operationType
    null, // inputSchema
    null, // defaultVariables
    null, // applicableTables
    'query', // templateType
    5, // complexityScore
    0, // usageCount
    null, // lastUsedAt
    null, // avgExecutionTimeMs
    '1.0.0', // version
    true, // isActive
    JSON.stringify(tags), // tags stored as JSON string
    new Date().toISOString(),
    new Date().toISOString(),
  )
}

describe('UpdateQueryTemplate', () => {
  let useCase: UpdateQueryTemplate
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
      update: mock(async () => createTestTemplate()),
      delete: mock(async () => {}),
      search: mock(async () => ({ templates: [], total: 0 })),
      activate: mock(async () => {}),
      deactivate: mock(async () => {}),
      incrementUsageCount: mock(async () => {}),
      updateExecutionStats: mock(async () => {}),
    } as any

    useCase = new UpdateQueryTemplate(mockQueryTemplateRepository, mockLogger)
  })

  describe('Input Validation', () => {
    it('should throw ValidationException when ID is empty', async () => {
      const request: UpdateQueryTemplateRequest = {
        id: '',
        name: 'Updated Name',
      }

      await expect(useCase.execute(request)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(request)).rejects.toThrow('Template ID is required for update')
    })

    it('should throw ValidationException when ID is whitespace', async () => {
      const request: UpdateQueryTemplateRequest = {
        id: '   ',
        name: 'Updated Name',
      }

      await expect(useCase.execute(request)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(request)).rejects.toThrow('Template ID is required for update')
    })

    it('should throw ValidationException when name is empty string', async () => {
      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        name: '',
      }

      await expect(useCase.execute(request)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(request)).rejects.toThrow('Template name cannot be empty')
    })

    it('should throw ValidationException when queryText is empty string', async () => {
      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        queryText: '',
      }

      await expect(useCase.execute(request)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(request)).rejects.toThrow('Query text cannot be empty')
    })

    it('should throw ValidationException when templateType is invalid', async () => {
      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        templateType: 'invalid' as any,
      }

      await expect(useCase.execute(request)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(request)).rejects.toThrow('Template type must be query, mutation, or subscription')
    })

    it('should throw ValidationException when complexityScore is less than 1', async () => {
      const existingTemplate = createTestTemplate()
      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)

      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        complexityScore: 0,
      }

      await expect(useCase.execute(request)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(request)).rejects.toThrow('Complexity score must be between 1 and 10')
    })

    it('should throw ValidationException when complexityScore is greater than 10', async () => {
      const existingTemplate = createTestTemplate()
      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)

      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        complexityScore: 11,
      }

      await expect(useCase.execute(request)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(request)).rejects.toThrow('Complexity score must be between 1 and 10')
    })

    it('should throw ValidationException when tags array is empty', async () => {
      const existingTemplate = createTestTemplate()
      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)

      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        tags: [],
      }

      await expect(useCase.execute(request)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(request)).rejects.toThrow('At least one tag is required')
    })

    it('should throw ValidationException when tags contain empty strings', async () => {
      const existingTemplate = createTestTemplate()
      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)

      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        tags: ['valid', '', 'another'],
      }

      await expect(useCase.execute(request)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(request)).rejects.toThrow('Tags cannot be empty')
    })
  })

  describe('Resource Validation', () => {
    it('should return error response when template does not exist', async () => {
      mockQueryTemplateRepository.findById = mock(async () => null)

      const request: UpdateQueryTemplateRequest = {
        id: 'nonexistent-template',
        name: 'Updated Name',
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(false)
      expect(result.template).toBeNull()
      expect(result.errors.length).toBe(1)
      expect(result.errors[0].message).toBe("Template with ID 'nonexistent-template' not found")
      expect(result.errors[0].code).toBe('TEMPLATE_NOT_FOUND')
    })
  })

  describe('Successful Updates', () => {
    it('should update name only', async () => {
      const existingTemplate = createTestTemplate('template-1', 'test-template', 'Original Name')
      const updatedTemplate = createTestTemplate('template-1', 'test-template', 'Updated Name')

      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)
      mockQueryTemplateRepository.update = mock(async () => updatedTemplate)

      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        name: 'Updated Name',
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(result.template).toBeDefined()
      expect(result.errors.length).toBe(0)
      expect(mockQueryTemplateRepository.update).toHaveBeenCalledWith(
        'template-1',
        expect.objectContaining({
          name: 'Updated Name',
        }),
      )
    })

    it('should update description only', async () => {
      const existingTemplate = createTestTemplate()

      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)

      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        description: 'New description',
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(mockQueryTemplateRepository.update).toHaveBeenCalledWith(
        'template-1',
        expect.objectContaining({
          description: 'New description',
        }),
      )
    })

    it('should update queryText only', async () => {
      const existingTemplate = createTestTemplate()

      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)

      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        queryText: 'query { newQuery }',
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(mockQueryTemplateRepository.update).toHaveBeenCalledWith(
        'template-1',
        expect.objectContaining({
          queryText: 'query { newQuery }',
        }),
      )
    })

    it('should update inputSchema only', async () => {
      const existingTemplate = createTestTemplate()

      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)

      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(mockQueryTemplateRepository.update).toHaveBeenCalledWith(
        'template-1',
        expect.objectContaining({
          inputSchema: expect.any(Object),
        }),
      )
    })

    it('should update defaultVariables only', async () => {
      const existingTemplate = createTestTemplate()

      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)

      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        defaultVariables: { limit: 10, offset: 0 },
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(mockQueryTemplateRepository.update).toHaveBeenCalledWith(
        'template-1',
        expect.objectContaining({
          defaultVariables: { limit: 10, offset: 0 },
        }),
      )
    })

    it('should update applicableTables only', async () => {
      const existingTemplate = createTestTemplate()

      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)

      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        applicableTables: ['users', 'products'],
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(mockQueryTemplateRepository.update).toHaveBeenCalledWith(
        'template-1',
        expect.objectContaining({
          applicableTables: ['users', 'products'],
        }),
      )
    })

    it('should update templateType only', async () => {
      const existingTemplate = createTestTemplate()

      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)

      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        templateType: 'mutation',
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(mockQueryTemplateRepository.update).toHaveBeenCalledWith(
        'template-1',
        expect.objectContaining({
          templateType: 'mutation',
        }),
      )
    })

    it('should update complexityScore only', async () => {
      const existingTemplate = createTestTemplate()

      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)

      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        complexityScore: 8,
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(mockQueryTemplateRepository.update).toHaveBeenCalledWith(
        'template-1',
        expect.objectContaining({
          complexityScore: 8,
        }),
      )
    })

    it('should update version only', async () => {
      const existingTemplate = createTestTemplate()

      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)

      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        version: '2.0.0',
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(mockQueryTemplateRepository.update).toHaveBeenCalledWith(
        'template-1',
        expect.objectContaining({
          version: '2.0.0',
        }),
      )
    })

    it('should update isActive only', async () => {
      const existingTemplate = createTestTemplate()

      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)

      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        isActive: false,
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(mockQueryTemplateRepository.update).toHaveBeenCalledWith(
        'template-1',
        expect.objectContaining({
          isActive: false,
        }),
      )
    })

    it('should update tags only', async () => {
      const existingTemplate = createTestTemplate()

      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)

      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        tags: ['updated', 'new-tags'],
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(mockQueryTemplateRepository.update).toHaveBeenCalledWith(
        'template-1',
        expect.objectContaining({
          tags: ['updated', 'new-tags'],
        }),
      )
    })

    it('should update multiple fields together', async () => {
      const existingTemplate = createTestTemplate()

      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)

      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        name: 'Multi-Update Template',
        description: 'Updated with multiple fields',
        complexityScore: 7,
        tags: ['multi', 'update'],
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(mockQueryTemplateRepository.update).toHaveBeenCalledWith(
        'template-1',
        expect.objectContaining({
          name: 'Multi-Update Template',
          description: 'Updated with multiple fields',
          complexityScore: 7,
          tags: ['multi', 'update'],
        }),
      )
    })
  })

  describe('Validation Logic', () => {
    it('should return error when default variables do not match schema', async () => {
      const existingTemplate = createTestTemplate()
      existingTemplate.validateVariables = mock(() => false)

      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)

      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        defaultVariables: { name: 'test' }, // Doesn't match required 'id'
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(false)
      expect(result.template).toBeNull()
      expect(result.errors.length).toBe(1)
      expect(result.errors[0].message).toBe('Default variables do not match the updated schema')
      expect(result.errors[0].code).toBe('INVALID_DEFAULT_VARIABLES')
    })
  })

  describe('Error Handling', () => {
    it('should return error response when update fails', async () => {
      const existingTemplate = createTestTemplate()

      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)
      mockQueryTemplateRepository.update = mock(async () => null)

      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        name: 'Updated Name',
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(false)
      expect(result.template).toBeNull()
      expect(result.errors.length).toBe(1)
      expect(result.errors[0].message).toBe('Failed to update template')
      expect(result.errors[0].code).toBe('UPDATE_FAILED')
    })

    it('should log errors and throw ValidationException on repository failure', async () => {
      const existingTemplate = createTestTemplate()

      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)
      mockQueryTemplateRepository.update = mock(async () => {
        throw new Error('Database connection failed')
      })

      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
        name: 'Updated Name',
      }

      await expect(useCase.execute(request)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(request)).rejects.toThrow('Failed to update query template')
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to update query template', expect.any(Object))
    })
  })

  describe('Logging', () => {
    it('should log update start and success', async () => {
      const existingTemplate = createTestTemplate('template-123', 'test-identifier')
      const updatedTemplate = createTestTemplate('template-123', 'test-identifier', 'Updated Name')

      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)
      mockQueryTemplateRepository.update = mock(async () => updatedTemplate)

      const request: UpdateQueryTemplateRequest = {
        id: 'template-123',
        name: 'Updated Name',
      }

      await useCase.execute(request)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Updating query template',
        expect.objectContaining({
          id: 'template-123',
        }),
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Query template updated successfully',
        expect.objectContaining({
          id: 'template-123',
          identifier: 'test-identifier',
        }),
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle update with no fields changed', async () => {
      const existingTemplate = createTestTemplate()

      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)

      const request: UpdateQueryTemplateRequest = {
        id: 'template-1',
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(mockQueryTemplateRepository.update).toHaveBeenCalledWith('template-1', {})
    })

    it('should handle sequential updates', async () => {
      const existingTemplate = createTestTemplate()

      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)

      // First update
      const request1: UpdateQueryTemplateRequest = {
        id: 'template-1',
        name: 'First Update',
      }
      const result1 = await useCase.execute(request1)
      expect(result1.success).toBe(true)

      // Second update
      const request2: UpdateQueryTemplateRequest = {
        id: 'template-1',
        description: 'Second Update',
      }
      const result2 = await useCase.execute(request2)
      expect(result2.success).toBe(true)

      // Third update
      const request3: UpdateQueryTemplateRequest = {
        id: 'template-1',
        tags: ['third', 'update'],
      }
      const result3 = await useCase.execute(request3)
      expect(result3.success).toBe(true)

      expect(mockQueryTemplateRepository.update).toHaveBeenCalledTimes(3)
    })

    it('should handle valid complexity scores at boundaries', async () => {
      const existingTemplate = createTestTemplate()

      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)

      // Minimum valid score
      const request1: UpdateQueryTemplateRequest = {
        id: 'template-1',
        complexityScore: 1,
      }
      const result1 = await useCase.execute(request1)
      expect(result1.success).toBe(true)

      // Maximum valid score
      const request2: UpdateQueryTemplateRequest = {
        id: 'template-1',
        complexityScore: 10,
      }
      const result2 = await useCase.execute(request2)
      expect(result2.success).toBe(true)
    })

    it('should handle all valid template types', async () => {
      const existingTemplate = createTestTemplate()

      mockQueryTemplateRepository.findById = mock(async () => existingTemplate)

      // Query type
      const request1: UpdateQueryTemplateRequest = {
        id: 'template-1',
        templateType: 'query',
      }
      const result1 = await useCase.execute(request1)
      expect(result1.success).toBe(true)

      // Mutation type
      const request2: UpdateQueryTemplateRequest = {
        id: 'template-1',
        templateType: 'mutation',
      }
      const result2 = await useCase.execute(request2)
      expect(result2.success).toBe(true)

      // Subscription type
      const request3: UpdateQueryTemplateRequest = {
        id: 'template-1',
        templateType: 'subscription',
      }
      const result3 = await useCase.execute(request3)
      expect(result3.success).toBe(true)
    })
  })
})

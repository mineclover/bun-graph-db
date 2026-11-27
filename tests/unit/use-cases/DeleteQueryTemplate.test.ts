import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ILogger } from '@/application/ports/ILogger.js'
import {
  DeleteQueryTemplate,
  type DeleteQueryTemplateRequest,
} from '@/application/use-cases/query-templates/DeleteQueryTemplate.js'
import { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import { ValidationException } from '@/shared/exceptions/DomainException.js'

// Helper function to create test QueryTemplate
function createTestTemplate(
  id: string = 'template-1',
  identifier: string = 'test-template',
  usageCount: number = 0,
  isActive: boolean = true,
): QueryTemplate {
  return QueryTemplate.fromDatabase(
    id,
    identifier,
    'Test Template',
    null, // description
    'query { test }',
    null, // queryName
    null, // operationType
    null, // inputSchema
    null, // defaultVariables
    null, // applicableTables
    'query', // templateType
    5, // complexityScore
    usageCount,
    null, // lastUsedAt
    null, // avgExecutionTimeMs
    '1.0.0', // version
    isActive,
    JSON.stringify(['test']), // tags
    new Date().toISOString(),
    new Date().toISOString(),
  )
}

describe('DeleteQueryTemplate', () => {
  let useCase: DeleteQueryTemplate
  let mockQueryTemplateRepository: IQueryTemplateRepository
  let mockLogger: ILogger

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      info: vi.fn(() => {}),
      warn: vi.fn(() => {}),
      error: vi.fn(() => {}),
      debug: vi.fn(() => {}),
    }

    // Mock repository
    const repositoryMock = {
      create: vi.fn(async (template) => template),
      findById: vi.fn(async () => null),
      findByIdentifier: vi.fn(async () => null),
      findAll: vi.fn(async () => ({ data: [], total: 0, hasMore: false })),
      update: vi.fn(async () => createTestTemplate()),
      deleteById: vi.fn(async () => true),
      search: vi.fn(async () => ({ items: [], total: 0, hasNextPage: false, hasPreviousPage: false })),
      searchByQueryName: vi.fn(async () => []),
      searchByOperationType: vi.fn(async () => []),
      findByApplicableTable: vi.fn(async () => []),
      findTemplatesWithTableDependencies: vi.fn(async () => []),
      incrementUsage: vi.fn(async () => {}),
      updateExecutionStats: vi.fn(async () => {}),
      updateStatus: vi.fn(async () => {}),
      findPopular: vi.fn(async () => []),
    } satisfies IQueryTemplateRepository

    mockQueryTemplateRepository = repositoryMock

    useCase = new DeleteQueryTemplate(mockQueryTemplateRepository, mockLogger)
  })

  describe('Input Validation', () => {
    it('should throw ValidationException when ID is empty', async () => {
      const request: DeleteQueryTemplateRequest = {
        id: '',
      }

      await expect(useCase.execute(request)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(request)).rejects.toThrow('Template ID is required for deletion')
    })

    it('should throw ValidationException when ID is whitespace', async () => {
      const request: DeleteQueryTemplateRequest = {
        id: '   ',
      }

      await expect(useCase.execute(request)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(request)).rejects.toThrow('Template ID is required for deletion')
    })
  })

  describe('Resource Validation', () => {
    it('should return error response when template does not exist', async () => {
      mockQueryTemplateRepository.findById = vi.fn(async () => null)

      const request: DeleteQueryTemplateRequest = {
        id: 'nonexistent-template',
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0].message).toBe("Template with ID 'nonexistent-template' not found")
      expect(result.errors[0].code).toBe('TEMPLATE_NOT_FOUND')
    })
  })

  describe('Usage Count Validation', () => {
    it('should return error when template has usage count > 0 without force flag', async () => {
      const templateWithUsage = createTestTemplate('template-1', 'used-template', 5, true)
      mockQueryTemplateRepository.findById = vi.fn(async () => templateWithUsage)

      const request: DeleteQueryTemplateRequest = {
        id: 'template-1',
        force: false,
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0].message).toContain('has been used 5 times')
      expect(result.errors[0].message).toContain('Use force=true to delete anyway')
      expect(result.errors[0].code).toBe('TEMPLATE_IN_USE')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Attempting to delete template with usage history',
        expect.any(Object),
      )
    })

    it('should allow deletion when template has usage count > 0 with force flag', async () => {
      const templateWithUsage = createTestTemplate('template-1', 'used-template', 10, true)
      mockQueryTemplateRepository.findById = vi.fn(async () => templateWithUsage)

      const request: DeleteQueryTemplateRequest = {
        id: 'template-1',
        force: true,
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(result.errors.length).toBe(0)
      expect(mockQueryTemplateRepository.deleteById).toHaveBeenCalledWith('template-1')
    })

    it('should allow deletion when template has usage count = 0', async () => {
      const unusedTemplate = createTestTemplate('template-1', 'unused-template', 0, true)
      mockQueryTemplateRepository.findById = vi.fn(async () => unusedTemplate)

      const request: DeleteQueryTemplateRequest = {
        id: 'template-1',
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(result.errors.length).toBe(0)
      expect(mockQueryTemplateRepository.deleteById).toHaveBeenCalledWith('template-1')
    })
  })

  describe('Active Template Handling', () => {
    it('should deactivate active template before deletion', async () => {
      const activeTemplate = createTestTemplate('template-1', 'active-template', 0, true)
      mockQueryTemplateRepository.findById = vi.fn(async () => activeTemplate)

      const request: DeleteQueryTemplateRequest = {
        id: 'template-1',
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(mockQueryTemplateRepository.updateStatus).toHaveBeenCalledWith('template-1', false)
      expect(mockLogger.info).toHaveBeenCalledWith('Template deactivated before deletion', expect.any(Object))
      expect(mockQueryTemplateRepository.deleteById).toHaveBeenCalledWith('template-1')
    })

    it('should not deactivate inactive template', async () => {
      const inactiveTemplate = createTestTemplate('template-1', 'inactive-template', 0, false)
      mockQueryTemplateRepository.findById = vi.fn(async () => inactiveTemplate)

      const request: DeleteQueryTemplateRequest = {
        id: 'template-1',
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(mockQueryTemplateRepository.updateStatus).not.toHaveBeenCalled()
      expect(mockQueryTemplateRepository.deleteById).toHaveBeenCalledWith('template-1')
    })

    it('should warn when deleting active template without force', async () => {
      const activeTemplate = createTestTemplate('template-1', 'active-template', 0, true)
      mockQueryTemplateRepository.findById = vi.fn(async () => activeTemplate)

      const request: DeleteQueryTemplateRequest = {
        id: 'template-1',
        force: false,
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Deleting active template',
        expect.objectContaining({
          id: 'template-1',
          identifier: 'active-template',
        }),
      )
    })

    it('should allow deletion of active template with force flag', async () => {
      const activeTemplateWithUsage = createTestTemplate('template-1', 'active-used-template', 5, true)
      mockQueryTemplateRepository.findById = vi.fn(async () => activeTemplateWithUsage)

      const request: DeleteQueryTemplateRequest = {
        id: 'template-1',
        force: true,
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(mockQueryTemplateRepository.updateStatus).toHaveBeenCalledWith('template-1', false)
      expect(mockQueryTemplateRepository.deleteById).toHaveBeenCalledWith('template-1')
    })
  })

  describe('Successful Deletions', () => {
    it('should delete unused template successfully', async () => {
      const unusedTemplate = createTestTemplate('template-1', 'unused-template', 0, false)
      mockQueryTemplateRepository.findById = vi.fn(async () => unusedTemplate)

      const request: DeleteQueryTemplateRequest = {
        id: 'template-1',
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(result.errors.length).toBe(0)
      expect(mockQueryTemplateRepository.deleteById).toHaveBeenCalledWith('template-1')
      expect(mockLogger.info).toHaveBeenCalledWith('Query template deleted successfully', expect.any(Object))
    })

    it('should delete used template with force flag', async () => {
      const usedTemplate = createTestTemplate('template-1', 'used-template', 50, false)
      mockQueryTemplateRepository.findById = vi.fn(async () => usedTemplate)

      const request: DeleteQueryTemplateRequest = {
        id: 'template-1',
        force: true,
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(result.errors.length).toBe(0)
      expect(mockQueryTemplateRepository.deleteById).toHaveBeenCalledWith('template-1')
    })

    it('should delete active template', async () => {
      const activeTemplate = createTestTemplate('template-1', 'active-template', 0, true)
      mockQueryTemplateRepository.findById = vi.fn(async () => activeTemplate)

      const request: DeleteQueryTemplateRequest = {
        id: 'template-1',
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(result.errors.length).toBe(0)
      expect(mockQueryTemplateRepository.updateStatus).toHaveBeenCalledWith('template-1', false)
      expect(mockQueryTemplateRepository.deleteById).toHaveBeenCalledWith('template-1')
    })

    it('should delete inactive template', async () => {
      const inactiveTemplate = createTestTemplate('template-1', 'inactive-template', 0, false)
      mockQueryTemplateRepository.findById = vi.fn(async () => inactiveTemplate)

      const request: DeleteQueryTemplateRequest = {
        id: 'template-1',
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(result.errors.length).toBe(0)
      expect(mockQueryTemplateRepository.deleteById).toHaveBeenCalledWith('template-1')
    })
  })

  describe('Error Handling', () => {
    it('should return error response when delete operation fails', async () => {
      const template = createTestTemplate('template-1', 'test-template', 0, false)
      mockQueryTemplateRepository.findById = vi.fn(async () => template)
      mockQueryTemplateRepository.deleteById = vi.fn(async () => false)

      const request: DeleteQueryTemplateRequest = {
        id: 'template-1',
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0].message).toBe('Failed to delete template')
      expect(result.errors[0].code).toBe('DELETE_FAILED')
    })

    it('should throw ValidationException when repository throws error', async () => {
      const template = createTestTemplate('template-1', 'test-template', 0, false)
      mockQueryTemplateRepository.findById = vi.fn(async () => template)
      mockQueryTemplateRepository.deleteById = vi.fn(async () => {
        throw new Error('Database connection failed')
      })

      const request: DeleteQueryTemplateRequest = {
        id: 'template-1',
      }

      await expect(useCase.execute(request)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(request)).rejects.toThrow('Failed to delete query template')
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to delete query template', expect.any(Object))
    })

    it('should handle updateStatus failure', async () => {
      const activeTemplate = createTestTemplate('template-1', 'active-template', 0, true)
      mockQueryTemplateRepository.findById = vi.fn(async () => activeTemplate)
      mockQueryTemplateRepository.updateStatus = vi.fn(async () => {
        throw new Error('Update status failed')
      })

      const request: DeleteQueryTemplateRequest = {
        id: 'template-1',
      }

      await expect(useCase.execute(request)).rejects.toThrow(ValidationException)
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('Logging', () => {
    it('should log deletion start and success', async () => {
      const template = createTestTemplate('template-123', 'test-identifier', 5, false)
      mockQueryTemplateRepository.findById = vi.fn(async () => template)

      const request: DeleteQueryTemplateRequest = {
        id: 'template-123',
        force: true,
      }

      await useCase.execute(request)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Deleting query template',
        expect.objectContaining({
          id: 'template-123',
          force: true,
        }),
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Query template deleted successfully',
        expect.objectContaining({
          id: 'template-123',
          identifier: 'test-identifier',
          usageCount: 5,
        }),
      )
    })

    it('should log warning for active template deletion', async () => {
      const activeTemplate = createTestTemplate('template-1', 'active-template', 0, true)
      mockQueryTemplateRepository.findById = vi.fn(async () => activeTemplate)

      const request: DeleteQueryTemplateRequest = {
        id: 'template-1',
      }

      await useCase.execute(request)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Deleting active template',
        expect.objectContaining({
          id: 'template-1',
          identifier: 'active-template',
        }),
      )
    })

    it('should log warning for template with usage history', async () => {
      const usedTemplate = createTestTemplate('template-1', 'used-template', 10, false)
      mockQueryTemplateRepository.findById = vi.fn(async () => usedTemplate)

      const request: DeleteQueryTemplateRequest = {
        id: 'template-1',
        force: false,
      }

      await useCase.execute(request)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Attempting to delete template with usage history',
        expect.objectContaining({
          id: 'template-1',
          usageCount: 10,
        }),
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle template with high usage count', async () => {
      const highUsageTemplate = createTestTemplate('template-1', 'popular-template', 1000, false)
      mockQueryTemplateRepository.findById = vi.fn(async () => highUsageTemplate)

      const request: DeleteQueryTemplateRequest = {
        id: 'template-1',
        force: false,
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('has been used 1000 times')
    })

    it('should handle sequential deletions', async () => {
      const template1 = createTestTemplate('template-1', 'template-1', 0, false)
      const template2 = createTestTemplate('template-2', 'template-2', 0, false)
      const template3 = createTestTemplate('template-3', 'template-3', 0, false)

      // First deletion
      mockQueryTemplateRepository.findById = vi.fn(async () => template1)
      const result1 = await useCase.execute({ id: 'template-1' })
      expect(result1.success).toBe(true)

      // Second deletion
      mockQueryTemplateRepository.findById = vi.fn(async () => template2)
      const result2 = await useCase.execute({ id: 'template-2' })
      expect(result2.success).toBe(true)

      // Third deletion
      mockQueryTemplateRepository.findById = vi.fn(async () => template3)
      const result3 = await useCase.execute({ id: 'template-3' })
      expect(result3.success).toBe(true)

      expect(mockQueryTemplateRepository.deleteById).toHaveBeenCalledTimes(3)
    })

    it('should handle force flag explicitly set to false', async () => {
      const usedTemplate = createTestTemplate('template-1', 'used-template', 1, false)
      mockQueryTemplateRepository.findById = vi.fn(async () => usedTemplate)

      const request: DeleteQueryTemplateRequest = {
        id: 'template-1',
        force: false,
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(false)
      expect(result.errors[0].code).toBe('TEMPLATE_IN_USE')
    })

    it('should handle force flag explicitly set to true', async () => {
      const usedTemplate = createTestTemplate('template-1', 'used-template', 100, true)
      mockQueryTemplateRepository.findById = vi.fn(async () => usedTemplate)

      const request: DeleteQueryTemplateRequest = {
        id: 'template-1',
        force: true,
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should handle deletion without force flag (undefined)', async () => {
      const unusedTemplate = createTestTemplate('template-1', 'unused-template', 0, false)
      mockQueryTemplateRepository.findById = vi.fn(async () => unusedTemplate)

      const request: DeleteQueryTemplateRequest = {
        id: 'template-1',
        // force is undefined
      }

      const result = await useCase.execute(request)

      expect(result.success).toBe(true)
      expect(result.errors.length).toBe(0)
    })
  })
})

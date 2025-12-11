import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { ILogger } from '@/application/ports/ILogger.js'
import { DeleteDocUseCase } from '@/application/use-cases/docs/DeleteDoc.js'
import { Doc, DocCategory } from '@/domain/entities/Doc.js'
import type { IDocRepository } from '@/domain/repositories/IDocRepository.js'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'

// Helper function to create test Doc
function createTestDoc(
  id: string,
  tableId: string,
  category: DocCategory,
  content: string,
  version: number = 1,
  isActive: boolean = true,
): Doc {
  return Doc.fromDatabase(id, tableId, category as string, version, content, isActive, new Date(), new Date())
}

describe('DeleteDocUseCase', () => {
  let useCase: DeleteDocUseCase
  let mockDocRepository: IDocRepository
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
    mockDocRepository = {
      save: mock(async (doc) => doc),
      findById: mock(async () => null),
      findByTableId: mock(async () => []),
      findByTableAndCategory: mock(async () => []),
      exists: mock(async () => false),
      delete: mock(async () => {}),
      activate: mock(async () => {}),
      deactivate: mock(async () => {}),
      deactivateOthersInCategory: mock(async () => {}),
      findAll: mock(async () => ({ data: [], metadata: {} })),
      count: mock(async () => 0),
    } as any

    useCase = new DeleteDocUseCase(mockDocRepository, mockLogger)
  })

  describe('Input Validation', () => {
    it('should throw ValidationException when doc ID is empty', async () => {
      await expect(useCase.execute('' as any)).rejects.toThrow(ValidationException)
      await expect(useCase.execute('' as any)).rejects.toThrow('Doc ID is required')
    })

    it('should throw ValidationException when doc ID is whitespace', async () => {
      await expect(useCase.execute('   ' as any)).rejects.toThrow(ValidationException)
      await expect(useCase.execute('   ' as any)).rejects.toThrow('Doc ID is required')
    })
  })

  describe('Resource Validation', () => {
    it('should throw NotFoundException when doc does not exist', async () => {
      mockDocRepository.findById = mock(async () => null)

      await expect(useCase.execute('nonexistent-doc' as any)).rejects.toThrow(NotFoundException)
      await expect(useCase.execute('nonexistent-doc' as any)).rejects.toThrow("Doc with id 'nonexistent-doc' not found")
    })
  })

  describe('Business Rules', () => {
    it('should throw ValidationException when doc cannot be deleted', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Content')

      // Mock canBeDeleted to return false
      existingDoc.canBeDeleted = mock(() => false)

      mockDocRepository.findById = mock(async () => existingDoc)

      await expect(useCase.execute('doc-1' as any)).rejects.toThrow(ValidationException)
      await expect(useCase.execute('doc-1' as any)).rejects.toThrow('Doc cannot be deleted')
    })

    it('should allow deletion when doc can be deleted', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Content')

      mockDocRepository.findById = mock(async () => existingDoc)

      const result = await useCase.execute('doc-1' as any)

      expect(result.success).toBe(true)
      expect(mockDocRepository.delete).toHaveBeenCalledWith('doc-1')
    })
  })

  describe('Successful Deletion', () => {
    it('should delete doc with USAGE category', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Usage doc')

      mockDocRepository.findById = mock(async () => existingDoc)

      const result = await useCase.execute('doc-1' as any)

      expect(result.success).toBe(true)
      expect(mockDocRepository.delete).toHaveBeenCalledWith('doc-1')
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Doc deleted successfully',
        expect.objectContaining({
          id: 'doc-1',
          tableId: 'table-1',
          category: 'usage',
        }),
      )
    })

    it('should delete doc with GUIDE category', async () => {
      const existingDoc = createTestDoc('doc-2', 'table-2', DocCategory.GUIDE, 'Guide doc')

      mockDocRepository.findById = mock(async () => existingDoc)

      const result = await useCase.execute('doc-2' as any)

      expect(result.success).toBe(true)
      expect(mockDocRepository.delete).toHaveBeenCalledWith('doc-2')
    })

    it('should delete doc with EXAMPLE category', async () => {
      const existingDoc = createTestDoc('doc-3', 'table-3', DocCategory.EXAMPLE, 'Example doc')

      mockDocRepository.findById = mock(async () => existingDoc)

      const result = await useCase.execute('doc-3' as any)

      expect(result.success).toBe(true)
      expect(mockDocRepository.delete).toHaveBeenCalledWith('doc-3')
    })

    it('should delete doc with SPEC category', async () => {
      const existingDoc = createTestDoc('doc-4', 'table-4', DocCategory.SPEC, 'Spec doc')

      mockDocRepository.findById = mock(async () => existingDoc)

      const result = await useCase.execute('doc-4' as any)

      expect(result.success).toBe(true)
      expect(mockDocRepository.delete).toHaveBeenCalledWith('doc-4')
    })

    it('should delete doc with GENERAL category', async () => {
      const existingDoc = createTestDoc('doc-5', 'table-5', DocCategory.GENERAL, 'General doc')

      mockDocRepository.findById = mock(async () => existingDoc)

      const result = await useCase.execute('doc-5' as any)

      expect(result.success).toBe(true)
      expect(mockDocRepository.delete).toHaveBeenCalledWith('doc-5')
    })

    it('should delete inactive doc', async () => {
      const existingDoc = createTestDoc('doc-6', 'table-1', DocCategory.USAGE, 'Inactive doc', 1, false)

      mockDocRepository.findById = mock(async () => existingDoc)

      const result = await useCase.execute('doc-6' as any)

      expect(result.success).toBe(true)
      expect(mockDocRepository.delete).toHaveBeenCalledWith('doc-6')
    })

    it('should delete doc with specific version', async () => {
      const existingDoc = createTestDoc('doc-7', 'table-1', DocCategory.USAGE, 'Version 3 doc', 3, true)

      mockDocRepository.findById = mock(async () => existingDoc)

      const result = await useCase.execute('doc-7' as any)

      expect(result.success).toBe(true)
      expect(mockDocRepository.delete).toHaveBeenCalledWith('doc-7')
    })
  })

  describe('Error Handling', () => {
    it('should log errors and rethrow when delete fails', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Content')

      mockDocRepository.findById = mock(async () => existingDoc)

      const deleteError = new Error('Database connection failed')

      mockDocRepository.delete = mock(async () => {
        throw deleteError
      })

      await expect(useCase.execute('doc-1' as any)).rejects.toThrow('Database connection failed')
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to delete doc', expect.any(Object))
    })

    it('should handle repository errors gracefully', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Content')

      mockDocRepository.findById = mock(async () => existingDoc)

      const repositoryError = new Error('Repository operation failed')

      mockDocRepository.delete = mock(async () => {
        throw repositoryError
      })

      await expect(useCase.execute('doc-1' as any)).rejects.toThrow('Repository operation failed')
    })
  })

  describe('Logging', () => {
    it('should log deletion start and success', async () => {
      const existingDoc = createTestDoc('doc-123', 'table-1', DocCategory.USAGE, 'Test content')

      mockDocRepository.findById = mock(async () => existingDoc)

      await useCase.execute('doc-123' as any)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Deleting doc',
        expect.objectContaining({
          id: 'doc-123',
        }),
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Doc deleted successfully',
        expect.objectContaining({
          id: 'doc-123',
          tableId: 'table-1',
          category: 'usage',
        }),
      )
    })

    it('should log errors with context', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Content')

      mockDocRepository.findById = mock(async () => existingDoc)

      const error = new Error('Test error')

      mockDocRepository.delete = mock(async () => {
        throw error
      })

      try {
        await useCase.execute('doc-1' as any)
      } catch (_e) {
        // Expected error
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to delete doc',
        expect.objectContaining({
          id: 'doc-1',
        }),
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle deletion of doc with long content', async () => {
      const longContent = 'A'.repeat(100000)
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.GUIDE, longContent)

      mockDocRepository.findById = mock(async () => existingDoc)

      const result = await useCase.execute('doc-1' as any)

      expect(result.success).toBe(true)
      expect(mockDocRepository.delete).toHaveBeenCalledWith('doc-1')
    })

    it('should handle deletion of doc with special characters', async () => {
      const specialContent = 'Content with <>&"\'`\n\t special chars'
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.EXAMPLE, specialContent)

      mockDocRepository.findById = mock(async () => existingDoc)

      const result = await useCase.execute('doc-1' as any)

      expect(result.success).toBe(true)
      expect(mockDocRepository.delete).toHaveBeenCalledWith('doc-1')
    })

    it('should handle multiple sequential deletions', async () => {
      const doc1 = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Content 1')
      const doc2 = createTestDoc('doc-2', 'table-1', DocCategory.GUIDE, 'Content 2')
      const doc3 = createTestDoc('doc-3', 'table-1', DocCategory.EXAMPLE, 'Content 3')

      // First deletion
      mockDocRepository.findById = mock(async () => doc1)
      const result1 = await useCase.execute('doc-1' as any)
      expect(result1.success).toBe(true)

      // Second deletion
      mockDocRepository.findById = mock(async () => doc2)
      const result2 = await useCase.execute('doc-2' as any)
      expect(result2.success).toBe(true)

      // Third deletion
      mockDocRepository.findById = mock(async () => doc3)
      const result3 = await useCase.execute('doc-3' as any)
      expect(result3.success).toBe(true)

      expect(mockDocRepository.delete).toHaveBeenCalledTimes(3)
    })
  })
})

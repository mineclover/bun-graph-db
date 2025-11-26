import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { ILogger } from '@/application/ports/ILogger.js'
import { ActivateDocUseCase } from '@/application/use-cases/docs/ActivateDoc.js'
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
  isActive: boolean = false
): Doc {
  return Doc.fromDatabase(
    id,
    tableId,
    category as string,
    version,
    content,
    isActive,
    new Date(),
    new Date()
  )
}

describe('ActivateDocUseCase', () => {
  let useCase: ActivateDocUseCase
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

    useCase = new ActivateDocUseCase(mockDocRepository, mockLogger)
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
      await expect(useCase.execute('nonexistent-doc' as any)).rejects.toThrow(
        "Doc with id 'nonexistent-doc' not found"
      )
    })
  })

  describe('Activation Logic', () => {
    it('should activate an inactive doc successfully', async () => {
      const inactiveDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Content', 1, false)

      mockDocRepository.findById = mock(async () => inactiveDoc)

      const result = await useCase.execute('doc-1' as any)

      expect(result.doc).toBeDefined()
      expect(result.doc.isActive).toBe(true)
      expect(mockDocRepository.deactivateOthersInCategory).toHaveBeenCalledWith(
        'table-1',
        DocCategory.USAGE,
        'doc-1'
      )
      expect(mockDocRepository.save).toHaveBeenCalled()
    })

    it('should activate an already active doc (idempotent)', async () => {
      const activeDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Content', 1, true)

      mockDocRepository.findById = mock(async () => activeDoc)

      const result = await useCase.execute('doc-1' as any)

      expect(result.doc).toBeDefined()
      expect(result.doc.isActive).toBe(true)
      expect(mockDocRepository.deactivateOthersInCategory).toHaveBeenCalledWith(
        'table-1',
        DocCategory.USAGE,
        'doc-1'
      )
      expect(mockDocRepository.save).toHaveBeenCalled()
    })

    it('should deactivate others in category before activating', async () => {
      const doc = createTestDoc('doc-1', 'table-1', DocCategory.GUIDE, 'Content', 1, false)

      mockDocRepository.findById = mock(async () => doc)

      await useCase.execute('doc-1' as any)

      expect(mockDocRepository.deactivateOthersInCategory).toHaveBeenCalledWith(
        'table-1',
        DocCategory.GUIDE,
        'doc-1'
      )
      expect(mockDocRepository.save).toHaveBeenCalled()
    })
  })

  describe('Category Handling', () => {
    it('should activate USAGE category doc', async () => {
      const doc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Usage content', 1, false)

      mockDocRepository.findById = mock(async () => doc)

      const result = await useCase.execute('doc-1' as any)

      expect(result.doc).toBeDefined()
      expect(result.doc.category).toBe('usage')
      expect(result.doc.isActive).toBe(true)
      expect(mockDocRepository.deactivateOthersInCategory).toHaveBeenCalledWith(
        'table-1',
        DocCategory.USAGE,
        'doc-1'
      )
    })

    it('should activate GUIDE category doc', async () => {
      const doc = createTestDoc('doc-2', 'table-2', DocCategory.GUIDE, 'Guide content', 1, false)

      mockDocRepository.findById = mock(async () => doc)

      const result = await useCase.execute('doc-2' as any)

      expect(result.doc).toBeDefined()
      expect(result.doc.category).toBe('guide')
      expect(result.doc.isActive).toBe(true)
      expect(mockDocRepository.deactivateOthersInCategory).toHaveBeenCalledWith(
        'table-2',
        DocCategory.GUIDE,
        'doc-2'
      )
    })

    it('should activate EXAMPLE category doc', async () => {
      const doc = createTestDoc(
        'doc-3',
        'table-3',
        DocCategory.EXAMPLE,
        'Example content',
        1,
        false
      )

      mockDocRepository.findById = mock(async () => doc)

      const result = await useCase.execute('doc-3' as any)

      expect(result.doc).toBeDefined()
      expect(result.doc.category).toBe('example')
      expect(result.doc.isActive).toBe(true)
      expect(mockDocRepository.deactivateOthersInCategory).toHaveBeenCalledWith(
        'table-3',
        DocCategory.EXAMPLE,
        'doc-3'
      )
    })

    it('should activate SPEC category doc', async () => {
      const doc = createTestDoc('doc-4', 'table-4', DocCategory.SPEC, 'Spec content', 1, false)

      mockDocRepository.findById = mock(async () => doc)

      const result = await useCase.execute('doc-4' as any)

      expect(result.doc).toBeDefined()
      expect(result.doc.category).toBe('spec')
      expect(result.doc.isActive).toBe(true)
      expect(mockDocRepository.deactivateOthersInCategory).toHaveBeenCalledWith(
        'table-4',
        DocCategory.SPEC,
        'doc-4'
      )
    })

    it('should activate GENERAL category doc', async () => {
      const doc = createTestDoc(
        'doc-5',
        'table-5',
        DocCategory.GENERAL,
        'General content',
        1,
        false
      )

      mockDocRepository.findById = mock(async () => doc)

      const result = await useCase.execute('doc-5' as any)

      expect(result.doc).toBeDefined()
      expect(result.doc.category).toBe('general')
      expect(result.doc.isActive).toBe(true)
      expect(mockDocRepository.deactivateOthersInCategory).toHaveBeenCalledWith(
        'table-5',
        DocCategory.GENERAL,
        'doc-5'
      )
    })
  })

  describe('Version Handling', () => {
    it('should activate doc with version 1', async () => {
      const doc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Content', 1, false)

      mockDocRepository.findById = mock(async () => doc)

      const result = await useCase.execute('doc-1' as any)

      expect(result.doc).toBeDefined()
      expect(result.doc.version).toBe(1)
      expect(result.doc.isActive).toBe(true)
    })

    it('should activate doc with version 2', async () => {
      const doc = createTestDoc('doc-2', 'table-1', DocCategory.USAGE, 'Content v2', 2, false)

      mockDocRepository.findById = mock(async () => doc)

      const result = await useCase.execute('doc-2' as any)

      expect(result.doc).toBeDefined()
      expect(result.doc.version).toBe(2)
      expect(result.doc.isActive).toBe(true)
    })

    it('should activate doc with version 5', async () => {
      const doc = createTestDoc('doc-3', 'table-1', DocCategory.USAGE, 'Content v5', 5, false)

      mockDocRepository.findById = mock(async () => doc)

      const result = await useCase.execute('doc-3' as any)

      expect(result.doc).toBeDefined()
      expect(result.doc.version).toBe(5)
      expect(result.doc.isActive).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should log errors and rethrow when save fails', async () => {
      const doc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Content', 1, false)

      mockDocRepository.findById = mock(async () => doc)

      const saveError = new Error('Database connection failed')

      mockDocRepository.save = mock(async () => {
        throw saveError
      })

      await expect(useCase.execute('doc-1' as any)).rejects.toThrow('Database connection failed')
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to activate doc', expect.any(Object))
    })

    it('should handle deactivation failure', async () => {
      const doc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Content', 1, false)

      mockDocRepository.findById = mock(async () => doc)

      const deactivationError = new Error('Deactivation failed')

      mockDocRepository.deactivateOthersInCategory = mock(async () => {
        throw deactivationError
      })

      await expect(useCase.execute('doc-1' as any)).rejects.toThrow('Deactivation failed')
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to activate doc', expect.any(Object))
    })
  })

  describe('Logging', () => {
    it('should log activation start and success', async () => {
      const doc = createTestDoc('doc-123', 'table-456', DocCategory.GUIDE, 'Test content', 2, false)

      mockDocRepository.findById = mock(async () => doc)

      await useCase.execute('doc-123' as any)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Activating doc',
        expect.objectContaining({
          id: 'doc-123',
        })
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Doc activated successfully',
        expect.objectContaining({
          id: 'doc-123',
          tableId: 'table-456',
          category: 'guide',
          version: 2,
        })
      )
    })

    it('should log errors with context', async () => {
      const doc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Content', 1, false)

      mockDocRepository.findById = mock(async () => doc)

      const error = new Error('Test error')

      mockDocRepository.save = mock(async () => {
        throw error
      })

      try {
        await useCase.execute('doc-1' as any)
      } catch (e) {
        // Expected error
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to activate doc',
        expect.objectContaining({
          id: 'doc-1',
        })
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle sequential activations of different docs', async () => {
      const doc1 = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Content 1', 1, false)
      const doc2 = createTestDoc('doc-2', 'table-1', DocCategory.USAGE, 'Content 2', 2, false)
      const doc3 = createTestDoc('doc-3', 'table-1', DocCategory.USAGE, 'Content 3', 3, false)

      // First activation
      mockDocRepository.findById = mock(async () => doc1)
      const result1 = await useCase.execute('doc-1' as any)
      expect(result1.doc.isActive).toBe(true)

      // Second activation (should deactivate doc-1)
      mockDocRepository.findById = mock(async () => doc2)
      const result2 = await useCase.execute('doc-2' as any)
      expect(result2.doc.isActive).toBe(true)

      // Third activation (should deactivate doc-2)
      mockDocRepository.findById = mock(async () => doc3)
      const result3 = await useCase.execute('doc-3' as any)
      expect(result3.doc.isActive).toBe(true)

      expect(mockDocRepository.deactivateOthersInCategory).toHaveBeenCalledTimes(3)
      expect(mockDocRepository.save).toHaveBeenCalledTimes(3)
    })

    it('should handle activation across different tables', async () => {
      const doc1 = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Content 1', 1, false)
      const doc2 = createTestDoc('doc-2', 'table-2', DocCategory.USAGE, 'Content 2', 1, false)

      // Activate doc in table-1
      mockDocRepository.findById = mock(async () => doc1)
      await useCase.execute('doc-1' as any)
      expect(mockDocRepository.deactivateOthersInCategory).toHaveBeenCalledWith(
        'table-1',
        DocCategory.USAGE,
        'doc-1'
      )

      // Activate doc in table-2 (should not affect table-1)
      mockDocRepository.findById = mock(async () => doc2)
      await useCase.execute('doc-2' as any)
      expect(mockDocRepository.deactivateOthersInCategory).toHaveBeenCalledWith(
        'table-2',
        DocCategory.USAGE,
        'doc-2'
      )
    })

    it('should handle activation with long content', async () => {
      const longContent = 'A'.repeat(100000)
      const doc = createTestDoc('doc-1', 'table-1', DocCategory.GUIDE, longContent, 1, false)

      mockDocRepository.findById = mock(async () => doc)

      const result = await useCase.execute('doc-1' as any)

      expect(result.doc).toBeDefined()
      expect(result.doc.isActive).toBe(true)
      expect(result.doc.content.length).toBe(100000)
    })
  })
})

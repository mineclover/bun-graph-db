import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { ILogger } from '@/application/ports/ILogger.js'
import { type UpdateDocInput, UpdateDocUseCase } from '@/application/use-cases/docs/UpdateDoc.js'
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

describe('UpdateDocUseCase', () => {
  let useCase: UpdateDocUseCase
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

    useCase = new UpdateDocUseCase(mockDocRepository, mockLogger)
  })

  describe('Input Validation', () => {
    it('should throw ValidationException when doc ID is empty', async () => {
      const input: UpdateDocInput = {
        content: 'Updated content',
      }

      await expect(useCase.execute('' as any, input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute('' as any, input)).rejects.toThrow('Doc ID is required')
    })

    it('should throw ValidationException when doc ID is whitespace', async () => {
      const input: UpdateDocInput = {
        content: 'Updated content',
      }

      await expect(useCase.execute('   ' as any, input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute('   ' as any, input)).rejects.toThrow('Doc ID is required')
    })
  })

  describe('Resource Validation', () => {
    it('should throw NotFoundException when doc does not exist', async () => {
      const input: UpdateDocInput = {
        content: 'Updated content',
      }

      mockDocRepository.findById = mock(async () => null)

      await expect(useCase.execute('nonexistent-doc' as any, input)).rejects.toThrow(NotFoundException)
      await expect(useCase.execute('nonexistent-doc' as any, input)).rejects.toThrow(
        "Doc with id 'nonexistent-doc' not found",
      )
    })
  })

  describe('Content Updates', () => {
    it('should update doc content successfully', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Original content')

      mockDocRepository.findById = mock(async () => existingDoc)

      const input: UpdateDocInput = {
        content: 'Updated content',
      }

      const result = await useCase.execute('doc-1' as any, input)

      expect(result.doc).toBeDefined()
      expect(result.doc.content).toBe('Updated content')
      expect(mockDocRepository.save).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith('Doc updated successfully', expect.any(Object))
    })

    it('should handle empty content update', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Original content')

      mockDocRepository.findById = mock(async () => existingDoc)

      const input: UpdateDocInput = {
        content: '',
      }

      // Empty content should fail validation in Doc entity's updateContent method
      await expect(useCase.execute('doc-1' as any, input)).rejects.toThrow()
    })

    it('should handle whitespace-only content update', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Original content')

      mockDocRepository.findById = mock(async () => existingDoc)

      const input: UpdateDocInput = {
        content: '   ',
      }

      // Whitespace-only content should fail validation in Doc entity
      await expect(useCase.execute('doc-1' as any, input)).rejects.toThrow()
    })
  })

  describe('Activation/Deactivation', () => {
    it('should activate doc successfully', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Content', 1, false)

      mockDocRepository.findById = mock(async () => existingDoc)

      const input: UpdateDocInput = {
        isActive: true,
      }

      const result = await useCase.execute('doc-1' as any, input)

      expect(result.doc).toBeDefined()
      expect(result.doc.isActive).toBe(true)
      expect(mockDocRepository.deactivateOthersInCategory).toHaveBeenCalledWith('table-1', DocCategory.USAGE, 'doc-1')
      expect(mockDocRepository.save).toHaveBeenCalled()
    })

    it('should deactivate doc successfully', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Content', 1, true)

      mockDocRepository.findById = mock(async () => existingDoc)

      const input: UpdateDocInput = {
        isActive: false,
      }

      const result = await useCase.execute('doc-1' as any, input)

      expect(result.doc).toBeDefined()
      expect(result.doc.isActive).toBe(false)
      expect(mockDocRepository.deactivateOthersInCategory).not.toHaveBeenCalled()
      expect(mockDocRepository.save).toHaveBeenCalled()
    })

    it('should not call deactivateOthersInCategory when deactivating', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.GUIDE, 'Content', 1, true)

      mockDocRepository.findById = mock(async () => existingDoc)

      const input: UpdateDocInput = {
        isActive: false,
      }

      await useCase.execute('doc-1' as any, input)

      expect(mockDocRepository.deactivateOthersInCategory).not.toHaveBeenCalled()
    })
  })

  describe('Combined Updates', () => {
    it('should update both content and activation status', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.SPEC, 'Original content', 1, false)

      mockDocRepository.findById = mock(async () => existingDoc)

      const input: UpdateDocInput = {
        content: 'New content',
        isActive: true,
      }

      const result = await useCase.execute('doc-1' as any, input)

      expect(result.doc).toBeDefined()
      expect(result.doc.content).toBe('New content')
      expect(result.doc.isActive).toBe(true)
      expect(mockDocRepository.deactivateOthersInCategory).toHaveBeenCalled()
      expect(mockDocRepository.save).toHaveBeenCalled()
    })

    it('should update content and deactivate', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.EXAMPLE, 'Original content', 1, true)

      mockDocRepository.findById = mock(async () => existingDoc)

      const input: UpdateDocInput = {
        content: 'Updated content',
        isActive: false,
      }

      const result = await useCase.execute('doc-1' as any, input)

      expect(result.doc).toBeDefined()
      expect(result.doc.content).toBe('Updated content')
      expect(result.doc.isActive).toBe(false)
      expect(mockDocRepository.save).toHaveBeenCalled()
    })
  })

  describe('No-op Updates', () => {
    it('should handle update with no changes', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.GENERAL, 'Content', 1, true)

      mockDocRepository.findById = mock(async () => existingDoc)

      const input: UpdateDocInput = {}

      const result = await useCase.execute('doc-1' as any, input)

      expect(result.doc).toBeDefined()
      expect(mockDocRepository.save).toHaveBeenCalled()
    })

    it('should handle undefined content', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Original content', 1, true)

      mockDocRepository.findById = mock(async () => existingDoc)

      const input: UpdateDocInput = {
        content: undefined,
        isActive: true,
      }

      const result = await useCase.execute('doc-1' as any, input)

      expect(result.doc).toBeDefined()
      expect(result.doc.content).toBe('Original content')
      expect(mockDocRepository.save).toHaveBeenCalled()
    })

    it('should handle undefined isActive', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Original content', 1, true)

      mockDocRepository.findById = mock(async () => existingDoc)

      const input: UpdateDocInput = {
        content: 'New content',
        isActive: undefined,
      }

      const result = await useCase.execute('doc-1' as any, input)

      expect(result.doc).toBeDefined()
      expect(result.doc.content).toBe('New content')
      expect(result.doc.isActive).toBe(true)
      expect(mockDocRepository.save).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should log errors and rethrow when save fails', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Content')

      mockDocRepository.findById = mock(async () => existingDoc)

      const input: UpdateDocInput = {
        content: 'Updated content',
      }

      const saveError = new Error('Database connection failed')

      mockDocRepository.save = mock(async () => {
        throw saveError
      })

      await expect(useCase.execute('doc-1' as any, input)).rejects.toThrow('Database connection failed')
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to update doc', expect.any(Object))
    })
  })

  describe('Logging', () => {
    it('should log update start and success', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Original content')

      mockDocRepository.findById = mock(async () => existingDoc)

      const input: UpdateDocInput = {
        content: 'Updated content',
      }

      await useCase.execute('doc-1' as any, input)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Updating doc',
        expect.objectContaining({
          id: 'doc-1',
          input: input,
        }),
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Doc updated successfully',
        expect.objectContaining({
          id: 'doc-1',
          tableId: 'table-1',
          category: 'usage',
        }),
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long content', async () => {
      const longContent = 'A'.repeat(10000)
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.GUIDE, 'Original')

      mockDocRepository.findById = mock(async () => existingDoc)

      const input: UpdateDocInput = {
        content: longContent,
      }

      const result = await useCase.execute('doc-1' as any, input)

      expect(result.doc).toBeDefined()
      expect(result.doc.content.length).toBe(10000)
    })

    it('should handle special characters in content', async () => {
      const specialContent = 'Content with special chars: <>&"\'`\n\t'
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.EXAMPLE, 'Original')

      mockDocRepository.findById = mock(async () => existingDoc)

      const input: UpdateDocInput = {
        content: specialContent,
      }

      const result = await useCase.execute('doc-1' as any, input)

      expect(result.doc).toBeDefined()
      expect(result.doc.content).toContain('<>&"\'`')
    })

    it('should handle markdown content', async () => {
      const markdownContent = `# Title\n\n## Subtitle\n\n- Item 1\n- Item 2\n\n\`\`\`javascript\nconst x = 1;\n\`\`\``
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.GUIDE, 'Original')

      mockDocRepository.findById = mock(async () => existingDoc)

      const input: UpdateDocInput = {
        content: markdownContent,
      }

      const result = await useCase.execute('doc-1' as any, input)

      expect(result.doc).toBeDefined()
      expect(result.doc.content).toContain('# Title')
      expect(result.doc.content).toContain('```javascript')
    })

    it('should handle multiple category types', async () => {
      const categories = [
        DocCategory.USAGE,
        DocCategory.GUIDE,
        DocCategory.EXAMPLE,
        DocCategory.SPEC,
        DocCategory.GENERAL,
      ]

      for (const category of categories) {
        const existingDoc = createTestDoc(`doc-${category}`, 'table-1', category, 'Original content')

        mockDocRepository.findById = mock(async () => existingDoc)

        const input: UpdateDocInput = {
          content: `Updated ${category} content`,
        }

        const result = await useCase.execute(`doc-${category}` as any, input)

        expect(result.doc).toBeDefined()
        expect(result.doc.content).toBe(`Updated ${category} content`)
      }
    })
  })
})

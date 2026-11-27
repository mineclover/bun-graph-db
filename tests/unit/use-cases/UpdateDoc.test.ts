import { beforeEach, describe, expect, it, vi } from 'vitest'
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
      info: vi.fn(() => {}),
      warn: vi.fn(() => {}),
      error: vi.fn(() => {}),
      debug: vi.fn(() => {}),
    }

    // Mock repository
    const repositoryMock = {
      save: vi.fn(async () => {}),
      findById: vi.fn(async () => null),
      findByTableAndCategory: vi.fn(async () => []),
      findActiveByTableAndCategory: vi.fn(async () => null),
      findVersionsByTableAndCategory: vi.fn(async () => []),
      searchDocs: vi.fn(async () => ({ data: [], total: 0, hasMore: false })),
      getLatestVersion: vi.fn(async () => 1),
      exists: vi.fn(async () => false),
      delete: vi.fn(async () => {}),
      deactivateOthersInCategory: vi.fn(async () => {}),
      findAll: vi.fn(async () => ({ data: [], total: 0, hasMore: false })),
      count: vi.fn(async () => 0),
      countByCategory: vi.fn(async () => 0),
      searchByContent: vi.fn(async () => ({ data: [], total: 0, hasMore: false })),
      saveMany: vi.fn(async () => {}),
      findByIds: vi.fn(async () => []),
      findByTableIds: vi.fn(async () => []),
    } satisfies IDocRepository

    mockDocRepository = repositoryMock

    useCase = new UpdateDocUseCase(mockDocRepository, mockLogger)
  })

  describe('Input Validation', () => {
    it('should throw ValidationException when doc ID is empty', async () => {
      const input: UpdateDocInput = {
        content: 'Updated content',
      }

      await expect(useCase.execute('', input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute('', input)).rejects.toThrow('Doc ID is required')
    })

    it('should throw ValidationException when doc ID is whitespace', async () => {
      const input: UpdateDocInput = {
        content: 'Updated content',
      }

      await expect(useCase.execute('   ', input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute('   ', input)).rejects.toThrow('Doc ID is required')
    })
  })

  describe('Resource Validation', () => {
    it('should throw NotFoundException when doc does not exist', async () => {
      const input: UpdateDocInput = {
        content: 'Updated content',
      }

      mockDocRepository.findById = vi.fn(async () => null)

      await expect(useCase.execute('nonexistent-doc', input)).rejects.toThrow(NotFoundException)
      await expect(useCase.execute('nonexistent-doc', input)).rejects.toThrow(
        "Doc with id 'nonexistent-doc' not found",
      )
    })
  })

  describe('Content Updates', () => {
    it('should update doc content successfully', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Original content')

      mockDocRepository.findById = vi.fn(async () => existingDoc)

      const input: UpdateDocInput = {
        content: 'Updated content',
      }

      const result = await useCase.execute('doc-1', input)

      expect(result.doc).toBeDefined()
      expect(result.doc.content).toBe('Updated content')
      expect(mockDocRepository.save).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith('Doc updated successfully', expect.any(Object))
    })

    it('should handle empty content update', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Original content')

      mockDocRepository.findById = vi.fn(async () => existingDoc)

      const input: UpdateDocInput = {
        content: '',
      }

      // Empty content should fail validation in Doc entity's updateContent method
      await expect(useCase.execute('doc-1', input)).rejects.toThrow()
    })

    it('should handle whitespace-only content update', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Original content')

      mockDocRepository.findById = vi.fn(async () => existingDoc)

      const input: UpdateDocInput = {
        content: '   ',
      }

      // Whitespace-only content should fail validation in Doc entity
      await expect(useCase.execute('doc-1', input)).rejects.toThrow()
    })
  })

  describe('Activation/Deactivation', () => {
    it('should activate doc successfully', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Content', 1, false)

      mockDocRepository.findById = vi.fn(async () => existingDoc)

      const input: UpdateDocInput = {
        isActive: true,
      }

      const result = await useCase.execute('doc-1', input)

      expect(result.doc).toBeDefined()
      expect(result.doc.isActive).toBe(true)
      expect(mockDocRepository.deactivateOthersInCategory).toHaveBeenCalledWith('table-1', DocCategory.USAGE, 'doc-1')
      expect(mockDocRepository.save).toHaveBeenCalled()
    })

    it('should deactivate doc successfully', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Content', 1, true)

      mockDocRepository.findById = vi.fn(async () => existingDoc)

      const input: UpdateDocInput = {
        isActive: false,
      }

      const result = await useCase.execute('doc-1', input)

      expect(result.doc).toBeDefined()
      expect(result.doc.isActive).toBe(false)
      expect(mockDocRepository.deactivateOthersInCategory).not.toHaveBeenCalled()
      expect(mockDocRepository.save).toHaveBeenCalled()
    })

    it('should not call deactivateOthersInCategory when deactivating', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.GUIDE, 'Content', 1, true)

      mockDocRepository.findById = vi.fn(async () => existingDoc)

      const input: UpdateDocInput = {
        isActive: false,
      }

      await useCase.execute('doc-1', input)

      expect(mockDocRepository.deactivateOthersInCategory).not.toHaveBeenCalled()
    })
  })

  describe('Combined Updates', () => {
    it('should update both content and activation status', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.SPEC, 'Original content', 1, false)

      mockDocRepository.findById = vi.fn(async () => existingDoc)

      const input: UpdateDocInput = {
        content: 'New content',
        isActive: true,
      }

      const result = await useCase.execute('doc-1', input)

      expect(result.doc).toBeDefined()
      expect(result.doc.content).toBe('New content')
      expect(result.doc.isActive).toBe(true)
      expect(mockDocRepository.deactivateOthersInCategory).toHaveBeenCalled()
      expect(mockDocRepository.save).toHaveBeenCalled()
    })

    it('should update content and deactivate', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.EXAMPLE, 'Original content', 1, true)

      mockDocRepository.findById = vi.fn(async () => existingDoc)

      const input: UpdateDocInput = {
        content: 'Updated content',
        isActive: false,
      }

      const result = await useCase.execute('doc-1', input)

      expect(result.doc).toBeDefined()
      expect(result.doc.content).toBe('Updated content')
      expect(result.doc.isActive).toBe(false)
      expect(mockDocRepository.save).toHaveBeenCalled()
    })
  })

  describe('No-op Updates', () => {
    it('should handle update with no changes', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.GENERAL, 'Content', 1, true)

      mockDocRepository.findById = vi.fn(async () => existingDoc)

      const input: UpdateDocInput = {}

      const result = await useCase.execute('doc-1', input)

      expect(result.doc).toBeDefined()
      expect(mockDocRepository.save).toHaveBeenCalled()
    })

    it('should handle undefined content', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Original content', 1, true)

      mockDocRepository.findById = vi.fn(async () => existingDoc)

      const input: UpdateDocInput = {
        content: undefined,
        isActive: true,
      }

      const result = await useCase.execute('doc-1', input)

      expect(result.doc).toBeDefined()
      expect(result.doc.content).toBe('Original content')
      expect(mockDocRepository.save).toHaveBeenCalled()
    })

    it('should handle undefined isActive', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Original content', 1, true)

      mockDocRepository.findById = vi.fn(async () => existingDoc)

      const input: UpdateDocInput = {
        content: 'New content',
        isActive: undefined,
      }

      const result = await useCase.execute('doc-1', input)

      expect(result.doc).toBeDefined()
      expect(result.doc.content).toBe('New content')
      expect(result.doc.isActive).toBe(true)
      expect(mockDocRepository.save).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should log errors and rethrow when save fails', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Content')

      mockDocRepository.findById = vi.fn(async () => existingDoc)

      const input: UpdateDocInput = {
        content: 'Updated content',
      }

      const saveError = new Error('Database connection failed')

      mockDocRepository.save = vi.fn(async () => {
        throw saveError
      })

      await expect(useCase.execute('doc-1', input)).rejects.toThrow('Database connection failed')
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to update doc', expect.any(Object))
    })
  })

  describe('Logging', () => {
    it('should log update start and success', async () => {
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Original content')

      mockDocRepository.findById = vi.fn(async () => existingDoc)

      const input: UpdateDocInput = {
        content: 'Updated content',
      }

      await useCase.execute('doc-1', input)

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

      mockDocRepository.findById = vi.fn(async () => existingDoc)

      const input: UpdateDocInput = {
        content: longContent,
      }

      const result = await useCase.execute('doc-1', input)

      expect(result.doc).toBeDefined()
      expect(result.doc.content.length).toBe(10000)
    })

    it('should handle special characters in content', async () => {
      const specialContent = 'Content with special chars: <>&"\'`\n\t'
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.EXAMPLE, 'Original')

      mockDocRepository.findById = vi.fn(async () => existingDoc)

      const input: UpdateDocInput = {
        content: specialContent,
      }

      const result = await useCase.execute('doc-1', input)

      expect(result.doc).toBeDefined()
      expect(result.doc.content).toContain('<>&"\'`')
    })

    it('should handle markdown content', async () => {
      const markdownContent = `# Title\n\n## Subtitle\n\n- Item 1\n- Item 2\n\n\`\`\`javascript\nconst x = 1;\n\`\`\``
      const existingDoc = createTestDoc('doc-1', 'table-1', DocCategory.GUIDE, 'Original')

      mockDocRepository.findById = vi.fn(async () => existingDoc)

      const input: UpdateDocInput = {
        content: markdownContent,
      }

      const result = await useCase.execute('doc-1', input)

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

        mockDocRepository.findById = vi.fn(async () => existingDoc)

        const input: UpdateDocInput = {
          content: `Updated ${category} content`,
        }

        const result = await useCase.execute(`doc-${category}`, input)

        expect(result.doc).toBeDefined()
        expect(result.doc.content).toBe(`Updated ${category} content`)
      }
    })
  })
})

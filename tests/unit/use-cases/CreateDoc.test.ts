import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { CreateDocUseCase, type CreateDocInput } from '@/application/use-cases/docs/CreateDoc.js'
import type { IDocRepository } from '@/domain/repositories/IDocRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { Doc, DocCategory } from '@/domain/entities/Doc.js'
import { ValidationException, NotFoundException, ConflictException } from '@/shared/exceptions/DomainException.js'
import { createTestTable } from './test-helpers.js'

// Helper function to create test Doc
function createTestDoc(
  id: string,
  tableId: string,
  category: DocCategory,
  content: string,
  version: number = 1,
  isActive: boolean = true
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

describe('CreateDocUseCase', () => {
  let useCase: CreateDocUseCase
  let mockDocRepository: IDocRepository
  let mockTableRepository: ITableRepository
  let mockLogger: ILogger

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
      debug: mock(() => {}),
    }

    // Mock repositories
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

    mockTableRepository = {
      save: mock(async (table) => table),
      findById: mock(async () => createTestTable('table-1', 'test-table')),
      findByIdentifier: mock(async () => null),
      findAll: mock(async () => ({ data: [], metadata: {} })),
      delete: mock(async () => {}),
      exists: mock(async () => false),
      count: mock(async () => 0),
      saveMany: mock(async () => {}),
      findByIds: mock(async () => []),
      update: mock(async () => createTestTable()),
    } as any

    useCase = new CreateDocUseCase(
      mockDocRepository,
      mockTableRepository,
      mockLogger
    )
  })

  describe('Input Validation', () => {
    it('should throw ValidationException when tableId is empty', async () => {
      const input: CreateDocInput = {
        tableId: '' as any,
        category: DocCategory.USAGE,
        content: 'Test content',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Table ID is required')
    })

    it('should throw ValidationException when category is missing', async () => {
      const input: CreateDocInput = {
        tableId: 'table-1' as any,
        category: undefined as any,
        content: 'Test content',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Doc category is required')
    })

    it('should throw ValidationException when content is empty', async () => {
      const input: CreateDocInput = {
        tableId: 'table-1' as any,
        category: DocCategory.USAGE,
        content: '',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Doc content is required')
    })

    it('should throw ValidationException when content is whitespace', async () => {
      const input: CreateDocInput = {
        tableId: 'table-1' as any,
        category: DocCategory.USAGE,
        content: '   ',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Doc content is required')
    })
  })

  describe('Resource Validation', () => {
    it('should throw NotFoundException when table does not exist', async () => {
      const input: CreateDocInput = {
        tableId: 'nonexistent-table' as any,
        category: DocCategory.USAGE,
        content: 'Test content',
      }

      mockTableRepository.findById = mock(async () => null)

      await expect(useCase.execute(input)).rejects.toThrow(NotFoundException)
      await expect(useCase.execute(input)).rejects.toThrow("Table with id 'nonexistent-table' not found")
    })
  })

  describe('Version Management', () => {
    it('should create doc with default version 1', async () => {
      const input: CreateDocInput = {
        tableId: 'table-1' as any,
        category: DocCategory.USAGE,
        content: 'Usage documentation',
      }

      const createdDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Usage documentation', 1)

      mockDocRepository.findByTableAndCategory = mock(async () => [createdDoc])

      const result = await useCase.execute(input)

      expect(result.doc).toBeDefined()
      expect(result.doc.version).toBe(1)
      expect(mockDocRepository.save).toHaveBeenCalled()
    })

    it('should create doc with custom version', async () => {
      const input: CreateDocInput = {
        tableId: 'table-1' as any,
        category: DocCategory.GUIDE,
        content: 'Guide documentation',
        version: 2,
      }

      const createdDoc = createTestDoc('doc-1', 'table-1', DocCategory.GUIDE, 'Guide documentation', 2)

      mockDocRepository.findByTableAndCategory = mock(async () => [createdDoc])

      const result = await useCase.execute(input)

      expect(result.doc).toBeDefined()
      expect(result.doc.version).toBe(2)
      expect(mockDocRepository.save).toHaveBeenCalled()
    })

    it('should throw ConflictException when doc with same version already exists', async () => {
      const input: CreateDocInput = {
        tableId: 'table-1' as any,
        category: DocCategory.EXAMPLE,
        content: 'Example documentation',
        version: 1,
      }

      mockDocRepository.exists = mock(async () => true)

      const promise = useCase.execute(input)
      await expect(promise).rejects.toThrow(ConflictException)
      await expect(promise).rejects.toThrow("Doc with category 'example' and version 1 already exists for table 'table-1'")
    })
  })

  describe('Deactivation Logic', () => {
    it('should deactivate other docs in same category when creating new doc', async () => {
      const input: CreateDocInput = {
        tableId: 'table-1' as any,
        category: DocCategory.SPEC,
        content: 'Specification documentation',
      }

      const createdDoc = createTestDoc('doc-1', 'table-1', DocCategory.SPEC, 'Specification documentation', 1)

      mockDocRepository.findByTableAndCategory = mock(async () => [createdDoc])

      await useCase.execute(input)

      expect(mockDocRepository.deactivateOthersInCategory).toHaveBeenCalledWith('table-1', DocCategory.SPEC)
      expect(mockDocRepository.save).toHaveBeenCalled()
    })
  })

  describe('Successful Doc Creation', () => {
    it('should create doc with USAGE category', async () => {
      const input: CreateDocInput = {
        tableId: 'table-1' as any,
        category: DocCategory.USAGE,
        content: 'How to use this table',
      }

      const createdDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'How to use this table')

      mockDocRepository.findByTableAndCategory = mock(async () => [createdDoc])

      const result = await useCase.execute(input)

      expect(result.doc).toBeDefined()
      expect(result.doc.category).toBe('usage')
      expect(result.doc.content).toBe('How to use this table')
      expect(mockLogger.info).toHaveBeenCalledWith('Creating new doc', expect.any(Object))
    })

    it('should create doc with GUIDE category', async () => {
      const input: CreateDocInput = {
        tableId: 'table-1' as any,
        category: DocCategory.GUIDE,
        content: 'Step-by-step guide',
      }

      const createdDoc = createTestDoc('doc-1', 'table-1', DocCategory.GUIDE, 'Step-by-step guide')

      mockDocRepository.findByTableAndCategory = mock(async () => [createdDoc])

      const result = await useCase.execute(input)

      expect(result.doc).toBeDefined()
      expect(result.doc.category).toBe('guide')
    })

    it('should create doc with EXAMPLE category', async () => {
      const input: CreateDocInput = {
        tableId: 'table-1' as any,
        category: DocCategory.EXAMPLE,
        content: 'Code examples',
      }

      const createdDoc = createTestDoc('doc-1', 'table-1', DocCategory.EXAMPLE, 'Code examples')

      mockDocRepository.findByTableAndCategory = mock(async () => [createdDoc])

      const result = await useCase.execute(input)

      expect(result.doc).toBeDefined()
      expect(result.doc.category).toBe('example')
    })

    it('should create doc with SPEC category', async () => {
      const input: CreateDocInput = {
        tableId: 'table-1' as any,
        category: DocCategory.SPEC,
        content: 'Technical specification',
      }

      const createdDoc = createTestDoc('doc-1', 'table-1', DocCategory.SPEC, 'Technical specification')

      mockDocRepository.findByTableAndCategory = mock(async () => [createdDoc])

      const result = await useCase.execute(input)

      expect(result.doc).toBeDefined()
      expect(result.doc.category).toBe('spec')
    })

    it('should create doc with GENERAL category', async () => {
      const input: CreateDocInput = {
        tableId: 'table-1' as any,
        category: DocCategory.GENERAL,
        content: 'General information',
      }

      const createdDoc = createTestDoc('doc-1', 'table-1', DocCategory.GENERAL, 'General information')

      mockDocRepository.findByTableAndCategory = mock(async () => [createdDoc])

      const result = await useCase.execute(input)

      expect(result.doc).toBeDefined()
      expect(result.doc.category).toBe('general')
    })

    it('should handle category mapping from GraphQL enum values', async () => {
      const input: CreateDocInput = {
        tableId: 'table-1' as any,
        category: 'USAGE' as any, // GraphQL enum value (uppercase)
        content: 'Mapped category content',
      }

      const createdDoc = createTestDoc('doc-1', 'table-1', DocCategory.USAGE, 'Mapped category content')

      mockDocRepository.findByTableAndCategory = mock(async () => [createdDoc])

      const result = await useCase.execute(input)

      expect(result.doc).toBeDefined()
      expect(result.doc.category).toBe('usage') // Domain enum value (lowercase)
    })
  })

  describe('Error Handling', () => {
    it('should log errors and rethrow when save fails', async () => {
      const input: CreateDocInput = {
        tableId: 'table-1' as any,
        category: DocCategory.USAGE,
        content: 'Test content',
      }

      const saveError = new Error('Database connection failed')

      mockDocRepository.save = mock(async () => {
        throw saveError
      })

      await expect(useCase.execute(input)).rejects.toThrow('Database connection failed')
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create doc', expect.any(Object))
    })

    it('should throw error when saved doc cannot be retrieved', async () => {
      const input: CreateDocInput = {
        tableId: 'table-1' as any,
        category: DocCategory.USAGE,
        content: 'Test content',
      }

      mockDocRepository.findByTableAndCategory = mock(async () => []) // Empty array - no docs found

      await expect(useCase.execute(input)).rejects.toThrow('Failed to retrieve saved doc')
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create doc', expect.any(Object))
    })
  })

  describe('Logging', () => {
    it('should log doc creation start and success', async () => {
      const input: CreateDocInput = {
        tableId: 'table-1' as any,
        category: DocCategory.USAGE,
        content: 'Logged content',
      }

      const createdDoc = createTestDoc('doc-123', 'table-1', DocCategory.USAGE, 'Logged content')

      mockDocRepository.findByTableAndCategory = mock(async () => [createdDoc])

      await useCase.execute(input)

      expect(mockLogger.info).toHaveBeenCalledWith('Creating new doc', expect.objectContaining({
        tableId: 'table-1',
        category: DocCategory.USAGE,
      }))
      expect(mockLogger.info).toHaveBeenCalledWith('Doc created successfully', expect.objectContaining({
        id: 'doc-123',
        tableId: 'table-1',
        category: 'usage',
        version: 1,
      }))
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long content', async () => {
      const longContent = 'A'.repeat(10000)
      const input: CreateDocInput = {
        tableId: 'table-1' as any,
        category: DocCategory.GUIDE,
        content: longContent,
      }

      const createdDoc = createTestDoc('doc-1', 'table-1', DocCategory.GUIDE, longContent)

      mockDocRepository.findByTableAndCategory = mock(async () => [createdDoc])

      const result = await useCase.execute(input)

      expect(result.doc).toBeDefined()
      expect(result.doc.content.length).toBe(10000)
    })

    it('should handle special characters in content', async () => {
      const specialContent = 'Content with special chars: <>&"\'`\n\t'
      const input: CreateDocInput = {
        tableId: 'table-1' as any,
        category: DocCategory.EXAMPLE,
        content: specialContent,
      }

      const createdDoc = createTestDoc('doc-1', 'table-1', DocCategory.EXAMPLE, specialContent)

      mockDocRepository.findByTableAndCategory = mock(async () => [createdDoc])

      const result = await useCase.execute(input)

      expect(result.doc).toBeDefined()
      expect(result.doc.content).toContain('<>&"\'`')
    })

    it('should handle markdown content', async () => {
      const markdownContent = `# Title\n\n## Subtitle\n\n- Item 1\n- Item 2\n\n\`\`\`javascript\nconst x = 1;\n\`\`\``
      const input: CreateDocInput = {
        tableId: 'table-1' as any,
        category: DocCategory.GUIDE,
        content: markdownContent,
      }

      const createdDoc = createTestDoc('doc-1', 'table-1', DocCategory.GUIDE, markdownContent)

      mockDocRepository.findByTableAndCategory = mock(async () => [createdDoc])

      const result = await useCase.execute(input)

      expect(result.doc).toBeDefined()
      expect(result.doc.content).toContain('# Title')
      expect(result.doc.content).toContain('```javascript')
    })
  })
})

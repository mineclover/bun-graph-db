import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CreateAttributeInput } from '@/application/dtos/AttributeDto.js'
import { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import type { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { ConflictException, NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'
import {
  createMockLogger,
  createPaginatedResult,
  createTestAttribute,
  createTestAttributeType,
  createTestTable,
  type MockedMethods,
} from './test-helpers.js'

type AttributeRepositoryMock = MockedMethods<IAttributeRepository>
type AttributeTypeRepositoryMock = MockedMethods<IAttributeTypeRepository>
type TableRepositoryMock = MockedMethods<ITableRepository>
type QueryTemplateRepositoryMock = MockedMethods<IQueryTemplateRepository>

function createQueryTemplateSearchResult(): Awaited<ReturnType<IQueryTemplateRepository['search']>> {
  return {
    items: [],
    total: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  }
}

function createAttributeRepositoryMock(): AttributeRepositoryMock {
  return {
    save: vi.fn(async (_attribute) => {}),
    findById: vi.fn(async (_id: string) => null),
    findByIdentifier: vi.fn(async (_identifier: string) => null),
    findAll: vi.fn(async (_options) => createPaginatedResult<ReturnType<typeof createTestAttribute>>()),
    delete: vi.fn(async (_id: string) => {}),
    count: vi.fn(async () => 0),
    exists: vi.fn(async (_identifier: string) => false),
    saveMany: vi.fn(async (_attributes) => {}),
    findByIds: vi.fn(async (_ids: string[]) => []),
    update: vi.fn(async (_id: string, _updates) => createTestAttribute()),
    deleteMany: vi.fn(async (_ids: string[]) => {}),
    findByParentId: vi.fn(async (_parentId: string, _options) => createPaginatedResult<ReturnType<typeof createTestAttribute>>()),
    countByParentId: vi.fn(async (_parentId: string) => 0),
    deleteByParentId: vi.fn(async (_parentId: string) => {}),
    findByTableId: vi.fn(async (_tableId: string, _options) => createPaginatedResult<ReturnType<typeof createTestAttribute>>()),
    countByTableId: vi.fn(async (_tableId: string) => 0),
    deleteByTableId: vi.fn(async (_tableId: string) => {}),
    findByTableIdAndIdentifier: vi.fn(async (_tableId: string, _identifier: string) => null),
    findByAttributeTypeId: vi.fn(async (_attributeTypeId: string, _options) =>
      createPaginatedResult<ReturnType<typeof createTestAttribute>>(),
    ),
    findRequiredByTableId: vi.fn(async (_tableId: string) => []),
    getAttributeTypeForAttribute: vi.fn(async (_attributeId: string) => null),
    existsByTableIdAndIdentifier: vi.fn(async (_tableId: string, _identifier: string) => false),
  } satisfies AttributeRepositoryMock
}

function createAttributeTypeRepositoryMock(): AttributeTypeRepositoryMock {
  return {
    save: vi.fn(async (_attributeType) => {}),
    findById: vi.fn(async (_id: string) => null),
    findByIdentifier: vi.fn(async (_identifier: string) => null),
    findAll: vi.fn(async (_options) => createPaginatedResult<ReturnType<typeof createTestAttributeType>>()),
    findByJsonType: vi.fn(async (_jsonType: string, _options) => createPaginatedResult<ReturnType<typeof createTestAttributeType>>()),
    delete: vi.fn(async (_id: string) => {}),
    exists: vi.fn(async (_identifier: string) => false),
    count: vi.fn(async () => 0),
    saveMany: vi.fn(async (_attributeTypes) => {}),
    findByIds: vi.fn(async (_ids: string[]) => []),
    update: vi.fn(async (_id: string, _updates) => createTestAttributeType()),
  } satisfies AttributeTypeRepositoryMock
}

function createTableRepositoryMock(): TableRepositoryMock {
  return {
    save: vi.fn(async (table) => table),
    findById: vi.fn(async (_id: string) => null),
    findByIdentifier: vi.fn(async (_identifier: string) => null),
    update: vi.fn(async (_id: string, _updates) => createTestTable()),
    delete: vi.fn(async (_id: string) => {}),
    findAll: vi.fn(async (_options) => createPaginatedResult<ReturnType<typeof createTestTable>>()),
    count: vi.fn(async () => 0),
    exists: vi.fn(async (_identifier: string) => false),
    saveMany: vi.fn(async (_tables) => {}),
    findByIds: vi.fn(async (_ids: string[]) => []),
    deleteMany: vi.fn(async (_ids: string[]) => {}),
  } satisfies TableRepositoryMock
}

function createQueryTemplateRepositoryMock(): QueryTemplateRepositoryMock {
  return {
    findById: vi.fn(async (_id: string) => null),
    findByIdentifier: vi.fn(async (_identifier: string) => null),
    search: vi.fn(async (_criteria) => createQueryTemplateSearchResult()),
    searchByQueryName: vi.fn(async (_queryName: string) => []),
    searchByOperationType: vi.fn(async (_operationType: string) => []),
    findByApplicableTable: vi.fn(async (_tableName: string, _includeUniversal?: boolean) => []),
    findTemplatesWithTableDependencies: vi.fn(async () => []),
    create: vi.fn(async (template) => template),
    update: vi.fn(async (_id: string, _updates) => {
      throw new Error('update should not be called in this test suite')
    }),
    deleteById: vi.fn(async (_id: string) => true),
    incrementUsage: vi.fn(async (_id: string) => {}),
    updateExecutionStats: vi.fn(async (_id: string, _executionTimeMs: number) => {}),
    findPopular: vi.fn(async (_limit?: number) => []),
    updateStatus: vi.fn(async (_id: string, _isActive: boolean) => {
      throw new Error('updateStatus should not be called in this test suite')
    }),
  } satisfies QueryTemplateRepositoryMock
}

describe('CreateAttributeUseCase', () => {
  let useCase: CreateAttributeUseCase
  let mockAttributeRepository: AttributeRepositoryMock
  let mockAttributeTypeRepository: AttributeTypeRepositoryMock
  let mockTableRepository: TableRepositoryMock
  let mockQueryTemplateRepository: QueryTemplateRepositoryMock
  let mockLogger: ReturnType<typeof createMockLogger>

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockAttributeRepository = createAttributeRepositoryMock()
    mockAttributeTypeRepository = createAttributeTypeRepositoryMock()
    mockTableRepository = createTableRepositoryMock()
    mockQueryTemplateRepository = createQueryTemplateRepositoryMock()

    useCase = new CreateAttributeUseCase(
      mockAttributeRepository,
      mockAttributeTypeRepository,
      mockTableRepository,
      mockQueryTemplateRepository,
      mockLogger,
    )
  })

  describe('Input Validation', () => {
    it('should throw ValidationException when tableId is empty', async () => {
      const input: CreateAttributeInput = {
        tableId: '',
        identifier: 'test-attr',
        attributeTypeId: 'attr-type-1',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Table ID is required')
    })

    it('should throw ValidationException when identifier is empty', async () => {
      const input: CreateAttributeInput = {
        tableId: 'table-1',
        identifier: '',
        attributeTypeId: 'attr-type-1',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Attribute identifier is required')
    })

    it('should throw ValidationException when attributeTypeId is empty', async () => {
      const input: CreateAttributeInput = {
        tableId: 'table-1',
        identifier: 'test-attr',
        attributeTypeId: '',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Attribute type ID is required')
    })
  })

  describe('Table and AttributeType Validation', () => {
    it('should throw NotFoundException when table does not exist', async () => {
      const input: CreateAttributeInput = {
        tableId: 'non-existent-table',
        identifier: 'test-attr',
        attributeTypeId: 'attr-type-1',
      }

      mockTableRepository.findById = vi.fn(async () => null)

      await expect(useCase.execute(input)).rejects.toThrow(NotFoundException)
      await expect(useCase.execute(input)).rejects.toThrow("Table with id 'non-existent-table' not found")
    })

    it('should throw NotFoundException when attribute type does not exist', async () => {
      const input: CreateAttributeInput = {
        tableId: 'table-1',
        identifier: 'test-attr',
        attributeTypeId: 'non-existent-type',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = vi.fn(async () => table)
      mockAttributeTypeRepository.findById = vi.fn(async () => null)

      await expect(useCase.execute(input)).rejects.toThrow(NotFoundException)
      await expect(useCase.execute(input)).rejects.toThrow("Attribute type with id 'non-existent-type' not found")
    })
  })

  describe('Duplicate Attribute Validation', () => {
    it('should throw ConflictException when attribute already exists for table', async () => {
      const input: CreateAttributeInput = {
        tableId: 'table-1',
        identifier: 'existing_attr',
        attributeTypeId: 'attr-type-1',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')
      const attributeType = createTestAttributeType('attr-type-1', 'string', 'string')
      const existingAttribute = createTestAttribute(
        'attr-1',
        'table-1',
        'existing_attr',
        'Existing Attribute',
        'attr-type-1',
      )

      mockTableRepository.findById = vi.fn(async () => table)
      mockAttributeTypeRepository.findById = vi.fn(async () => attributeType)
      mockAttributeRepository.findByTableIdAndIdentifier = vi.fn().mockResolvedValueOnce(existingAttribute)

      const promise = useCase.execute(input)
      await expect(promise).rejects.toThrow(ConflictException)
      await expect(promise).rejects.toThrow(
        "Attribute with identifier 'existing_attr' already exists for table 'test-table'",
      )
    })
  })

  describe('Successful Attribute Creation', () => {
    it('should create an attribute successfully with basic information', async () => {
      const input: CreateAttributeInput = {
        tableId: 'table-1',
        identifier: 'test_attr',
        name: 'Test Attribute',
        attributeTypeId: 'attr-type-1',
        description: 'Test Description',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')
      const attributeType = createTestAttributeType('attr-type-1', 'string', 'string')
      const createdAttribute = createTestAttribute('attr-1', 'table-1', 'test_attr', 'Test Attribute', 'attr-type-1')

      mockTableRepository.findById = vi.fn(async () => table)
      mockAttributeTypeRepository.findById = vi.fn(async () => attributeType)
      mockAttributeRepository.findByTableIdAndIdentifier = vi.fn()
        .mockResolvedValueOnce(null) // First call for duplicate check
        .mockResolvedValueOnce(createdAttribute) // Second call after save

      const result = await useCase.execute(input)

      expect(result.attribute).toBeDefined()
      expect(result.attribute.identifier).toBe('test_attr')
      expect(result.attribute.name).toBe('Test Attribute')
      expect(mockAttributeRepository.save).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creating new attribute',
        expect.objectContaining({
          identifier: input.identifier,
          tableId: input.tableId,
        }),
      )
    })

    it('should create an attribute with isRequired flag', async () => {
      const input: CreateAttributeInput = {
        tableId: 'table-1',
        identifier: 'required_attr',
        name: 'Required Attribute',
        attributeTypeId: 'attr-type-1',
        isRequired: true,
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')
      const attributeType = createTestAttributeType('attr-type-1', 'string', 'string')
      const createdAttribute = createTestAttribute(
        'attr-1',
        'table-1',
        'required_attr',
        'Required Attribute',
        'attr-type-1',
      )

      mockTableRepository.findById = vi.fn(async () => table)
      mockAttributeTypeRepository.findById = vi.fn(async () => attributeType)
      mockAttributeRepository.findByTableIdAndIdentifier = vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdAttribute)

      const result = await useCase.execute(input)

      expect(result.attribute).toBeDefined()
      expect(result.attribute.identifier).toBe('required_attr')
      expect(mockAttributeRepository.save).toHaveBeenCalled()
    })

    it('should create an attribute with metadata', async () => {
      const input: CreateAttributeInput = {
        tableId: 'table-1',
        identifier: 'meta_attr',
        name: 'Metadata Attribute',
        attributeTypeId: 'attr-type-1',
        metadata: { key: 'value', nested: { prop: 'data' } },
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')
      const attributeType = createTestAttributeType('attr-type-1', 'string', 'string')
      const createdAttribute = createTestAttribute(
        'attr-1',
        'table-1',
        'meta_attr',
        'Metadata Attribute',
        'attr-type-1',
      )

      mockTableRepository.findById = vi.fn(async () => table)
      mockAttributeTypeRepository.findById = vi.fn(async () => attributeType)
      mockAttributeRepository.findByTableIdAndIdentifier = vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdAttribute)

      const result = await useCase.execute(input)

      expect(result.attribute).toBeDefined()
      expect(result.attribute.identifier).toBe('meta_attr')
      expect(mockAttributeRepository.save).toHaveBeenCalled()
    })

    it('should mark generated table templates stale after attribute creation', async () => {
      const input: CreateAttributeInput = {
        tableId: 'table-1',
        identifier: 'schema_attr',
        name: 'Schema Attribute',
        attributeTypeId: 'attr-type-1',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')
      const attributeType = createTestAttributeType('attr-type-1', 'string', 'string')
      const createdAttribute = createTestAttribute(
        'attr-1',
        'table-1',
        'schema_attr',
        'Schema Attribute',
        'attr-type-1',
      )

      mockTableRepository.findById = vi.fn(async () => table)
      mockAttributeTypeRepository.findById = vi.fn(async () => attributeType)
      mockAttributeRepository.findByTableIdAndIdentifier = vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdAttribute)
      const staleTemplate = {
        getId: () => 'template-1',
        getTags: () => ['table:table-1', 'auto-generated', 'create'],
      } as unknown as QueryTemplate
      mockQueryTemplateRepository.search = vi.fn(async () => ({
        items: [staleTemplate],
        total: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      }))
      mockQueryTemplateRepository.update = vi.fn(async (_id, _updates) => ({
        getTags: () => _updates.tags ?? [],
      }) as unknown as QueryTemplate)

      await useCase.execute(input)

      expect(mockQueryTemplateRepository.update).toHaveBeenCalledWith(
        'template-1',
        expect.objectContaining({
          tags: expect.arrayContaining(['schema-stale']),
        }),
      )
      const [, updates] = mockQueryTemplateRepository.update.mock.calls[0]
      expect(updates.tags?.some((tag) => tag.startsWith('schema-stale-at:'))).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should log errors and rethrow when save fails', async () => {
      const input: CreateAttributeInput = {
        tableId: 'table-1',
        identifier: 'test_attr',
        attributeTypeId: 'attr-type-1',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')
      const attributeType = createTestAttributeType('attr-type-1', 'string', 'string')
      const saveError = new Error('Database connection failed')

      mockTableRepository.findById = vi.fn(async () => table)
      mockAttributeTypeRepository.findById = vi.fn(async () => attributeType)
      mockAttributeRepository.findByTableIdAndIdentifier = vi.fn(async () => null)
      mockAttributeRepository.save = vi.fn(async () => {
        throw saveError
      })

      await expect(useCase.execute(input)).rejects.toThrow('Database connection failed')
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create attribute',
        expect.objectContaining({
          identifier: input.identifier,
          tableId: input.tableId,
          error: 'Database connection failed',
        }),
      )
    })

    it('should throw error when saved attribute cannot be retrieved', async () => {
      const input: CreateAttributeInput = {
        tableId: 'table-1',
        identifier: 'test_attr',
        attributeTypeId: 'attr-type-1',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')
      const attributeType = createTestAttributeType('attr-type-1', 'string', 'string')

      mockTableRepository.findById = vi.fn(async () => table)
      mockAttributeTypeRepository.findById = vi.fn(async () => attributeType)
      mockAttributeRepository.findByTableIdAndIdentifier = vi.fn()
        .mockResolvedValueOnce(null) // First call for duplicate check
        .mockResolvedValueOnce(null) // Second call after save fails to retrieve

      await expect(useCase.execute(input)).rejects.toThrow('Failed to retrieve saved attribute')
    })
  })
})

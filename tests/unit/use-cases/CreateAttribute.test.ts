import { beforeEach, describe, expect, it, mock } from 'bun:test'
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
    save: mock(async (_attribute) => {}),
    findById: mock(async (_id: string) => null),
    findByIdentifier: mock(async (_identifier: string) => null),
    findAll: mock(async (_options) => createPaginatedResult<ReturnType<typeof createTestAttribute>>()),
    delete: mock(async (_id: string) => {}),
    count: mock(async () => 0),
    exists: mock(async (_identifier: string) => false),
    saveMany: mock(async (_attributes) => {}),
    findByIds: mock(async (_ids: string[]) => []),
    update: mock(async (_id: string, _updates) => createTestAttribute()),
    deleteMany: mock(async (_ids: string[]) => {}),
    findByParentId: mock(async (_parentId: string, _options) => createPaginatedResult<ReturnType<typeof createTestAttribute>>()),
    countByParentId: mock(async (_parentId: string) => 0),
    deleteByParentId: mock(async (_parentId: string) => {}),
    findByTableId: mock(async (_tableId: string, _options) => createPaginatedResult<ReturnType<typeof createTestAttribute>>()),
    countByTableId: mock(async (_tableId: string) => 0),
    deleteByTableId: mock(async (_tableId: string) => {}),
    findByTableIdAndIdentifier: mock(async (_tableId: string, _identifier: string) => null),
    findByAttributeTypeId: mock(async (_attributeTypeId: string, _options) =>
      createPaginatedResult<ReturnType<typeof createTestAttribute>>(),
    ),
    findRequiredByTableId: mock(async (_tableId: string) => []),
    getAttributeTypeForAttribute: mock(async (_attributeId: string) => null),
    existsByTableIdAndIdentifier: mock(async (_tableId: string, _identifier: string) => false),
  } satisfies AttributeRepositoryMock
}

function createAttributeTypeRepositoryMock(): AttributeTypeRepositoryMock {
  return {
    save: mock(async (_attributeType) => {}),
    findById: mock(async (_id: string) => null),
    findByIdentifier: mock(async (_identifier: string) => null),
    findAll: mock(async (_options) => createPaginatedResult<ReturnType<typeof createTestAttributeType>>()),
    findByJsonType: mock(async (_jsonType: string, _options) => createPaginatedResult<ReturnType<typeof createTestAttributeType>>()),
    delete: mock(async (_id: string) => {}),
    exists: mock(async (_identifier: string) => false),
    count: mock(async () => 0),
    saveMany: mock(async (_attributeTypes) => {}),
    findByIds: mock(async (_ids: string[]) => []),
    update: mock(async (_id: string, _updates) => createTestAttributeType()),
  } satisfies AttributeTypeRepositoryMock
}

function createTableRepositoryMock(): TableRepositoryMock {
  return {
    save: mock(async (table) => table),
    findById: mock(async (_id: string) => null),
    findByIdentifier: mock(async (_identifier: string) => null),
    update: mock(async (_id: string, _updates) => createTestTable()),
    delete: mock(async (_id: string) => {}),
    findAll: mock(async (_options) => createPaginatedResult<ReturnType<typeof createTestTable>>()),
    count: mock(async () => 0),
    exists: mock(async (_identifier: string) => false),
    saveMany: mock(async (_tables) => {}),
    findByIds: mock(async (_ids: string[]) => []),
    deleteMany: mock(async (_ids: string[]) => {}),
  } satisfies TableRepositoryMock
}

function createQueryTemplateRepositoryMock(): QueryTemplateRepositoryMock {
  return {
    findById: mock(async (_id: string) => null),
    findByIdentifier: mock(async (_identifier: string) => null),
    search: mock(async (_criteria) => createQueryTemplateSearchResult()),
    searchByQueryName: mock(async (_queryName: string) => []),
    searchByOperationType: mock(async (_operationType: string) => []),
    findByApplicableTable: mock(async (_tableName: string, _includeUniversal?: boolean) => []),
    findTemplatesWithTableDependencies: mock(async () => []),
    create: mock(async (template) => template),
    update: mock(async (_id: string, _updates) => {
      throw new Error('update should not be called in this test suite')
    }),
    deleteById: mock(async (_id: string) => true),
    incrementUsage: mock(async (_id: string) => {}),
    updateExecutionStats: mock(async (_id: string, _executionTimeMs: number) => {}),
    findPopular: mock(async (_limit?: number) => []),
    updateStatus: mock(async (_id: string, _isActive: boolean) => {
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

      mockTableRepository.findById = mock(async () => null)

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

      mockTableRepository.findById = mock(async () => table)
      mockAttributeTypeRepository.findById = mock(async () => null)

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

      mockTableRepository.findById = mock(async () => table)
      mockAttributeTypeRepository.findById = mock(async () => attributeType)
      mockAttributeRepository.findByTableIdAndIdentifier = mock().mockResolvedValueOnce(existingAttribute)

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

      mockTableRepository.findById = mock(async () => table)
      mockAttributeTypeRepository.findById = mock(async () => attributeType)
      mockAttributeRepository.findByTableIdAndIdentifier = mock()
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

      mockTableRepository.findById = mock(async () => table)
      mockAttributeTypeRepository.findById = mock(async () => attributeType)
      mockAttributeRepository.findByTableIdAndIdentifier = mock()
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

      mockTableRepository.findById = mock(async () => table)
      mockAttributeTypeRepository.findById = mock(async () => attributeType)
      mockAttributeRepository.findByTableIdAndIdentifier = mock()
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

      mockTableRepository.findById = mock(async () => table)
      mockAttributeTypeRepository.findById = mock(async () => attributeType)
      mockAttributeRepository.findByTableIdAndIdentifier = mock()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdAttribute)
      const staleTemplate = {
        getId: () => 'template-1',
        getTags: () => ['table:table-1', 'auto-generated', 'create'],
      } as unknown as QueryTemplate
      mockQueryTemplateRepository.search = mock(async () => ({
        items: [staleTemplate],
        total: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      }))
      mockQueryTemplateRepository.update = mock(async (_id, _updates) => ({
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

      mockTableRepository.findById = mock(async () => table)
      mockAttributeTypeRepository.findById = mock(async () => attributeType)
      mockAttributeRepository.findByTableIdAndIdentifier = mock(async () => null)
      mockAttributeRepository.save = mock(async () => {
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

      mockTableRepository.findById = mock(async () => table)
      mockAttributeTypeRepository.findById = mock(async () => attributeType)
      mockAttributeRepository.findByTableIdAndIdentifier = mock()
        .mockResolvedValueOnce(null) // First call for duplicate check
        .mockResolvedValueOnce(null) // Second call after save fails to retrieve

      await expect(useCase.execute(input)).rejects.toThrow('Failed to retrieve saved attribute')
    })
  })
})

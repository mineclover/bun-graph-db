import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { CreateAttributeInput } from '@/application/dtos/AttributeDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { CreateAttributeUseCase } from '@/application/use-cases/attributes/CreateAttribute.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { ConflictException, NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'
import { createTestAttribute, createTestAttributeType, createTestTable } from './test-helpers.js'

describe('CreateAttributeUseCase', () => {
  let useCase: CreateAttributeUseCase
  let mockAttributeRepository: IAttributeRepository
  let mockAttributeTypeRepository: IAttributeTypeRepository
  let mockTableRepository: ITableRepository
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

    // Mock repositories
    mockAttributeRepository = {
      // IFullRepository methods
      save: mock(async () => {}),
      findById: mock(async () => null),
      findByIdentifier: mock(async () => null),
      findAll: mock(async () => ({ data: [], metadata: {} })),
      delete: mock(async () => {}),
      count: mock(async () => 0),
      exists: mock(async () => false),
      saveMany: mock(async () => {}),
      findByIds: mock(async () => []),
      update: mock(async (attr) => attr),
      deleteMany: mock(async () => {}),
      // ITableScopedRepository methods
      findByParentId: mock(async () => ({ data: [], metadata: {} })),
      countByParentId: mock(async () => 0),
      deleteByParentId: mock(async () => {}),
      // Attribute-specific methods
      findByTableId: mock(async () => ({ data: [], metadata: {} })),
      countByTableId: mock(async () => 0),
      deleteByTableId: mock(async () => {}),
      findByTableIdAndIdentifier: mock(async () => null),
      findByAttributeTypeId: mock(async () => ({ data: [], metadata: {} })),
      findRequiredByTableId: mock(async () => []),
      getAttributeTypeForAttribute: mock(async () => null),
      existsByTableIdAndIdentifier: mock(async () => false),
    } as any

    mockAttributeTypeRepository = {
      save: mock(async (type) => type),
      findById: mock(async () => null),
      findByIdentifier: mock(async () => null),
      findAll: mock(async () => ({ data: [], metadata: {} })),
      findByJsonType: mock(async () => ({ data: [], metadata: {} })),
      delete: mock(async () => {}),
      exists: mock(async () => false),
      count: mock(async () => 0),
      saveMany: mock(async () => {}),
      findByIds: mock(async () => []),
      update: mock(async (_id, _updates) => ({}) as any),
    } as any

    mockTableRepository = {
      save: mock(async (table) => table),
      findById: mock(async () => null),
      findByIdentifier: mock(async () => null),
      update: mock(async (table) => table),
      delete: mock(async () => {}),
      findAll: mock(async () => ({ data: [], metadata: {} })),
      count: mock(async () => 0),
      exists: mock(async () => false),
      saveMany: mock(async () => {}),
      findByIds: mock(async () => []),
      deleteMany: mock(async () => {}),
    } as any

    mockQueryTemplateRepository = {
      findById: mock(async () => null),
      findByIdentifier: mock(async () => null),
      search: mock(async () => ({
        items: [],
        total: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      })),
      searchByQueryName: mock(async () => []),
      searchByOperationType: mock(async () => []),
      findByApplicableTable: mock(async () => []),
      findTemplatesWithTableDependencies: mock(async () => []),
      create: mock(async (template) => template),
      update: mock(async (_id, _updates) => ({}) as any),
      deleteById: mock(async () => true),
      incrementUsage: mock(async () => {}),
      updateExecutionStats: mock(async () => {}),
      findPopular: mock(async () => []),
      updateStatus: mock(async () => ({}) as any),
    } as any

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

      mockTableRepository.findById = mock(async () => table as any)
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

      mockTableRepository.findById = mock(async () => table as any)
      mockAttributeTypeRepository.findById = mock(async () => attributeType as any)
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

      mockTableRepository.findById = mock(async () => table as any)
      mockAttributeTypeRepository.findById = mock(async () => attributeType as any)
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

      mockTableRepository.findById = mock(async () => table as any)
      mockAttributeTypeRepository.findById = mock(async () => attributeType as any)
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

      mockTableRepository.findById = mock(async () => table as any)
      mockAttributeTypeRepository.findById = mock(async () => attributeType as any)
      mockAttributeRepository.findByTableIdAndIdentifier = mock()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdAttribute)

      const result = await useCase.execute(input)

      expect(result.attribute).toBeDefined()
      expect(result.attribute.identifier).toBe('meta_attr')
      expect(mockAttributeRepository.save).toHaveBeenCalled()
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

      mockTableRepository.findById = mock(async () => table as any)
      mockAttributeTypeRepository.findById = mock(async () => attributeType as any)
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

      mockTableRepository.findById = mock(async () => table as any)
      mockAttributeTypeRepository.findById = mock(async () => attributeType as any)
      mockAttributeRepository.findByTableIdAndIdentifier = mock()
        .mockResolvedValueOnce(null) // First call for duplicate check
        .mockResolvedValueOnce(null) // Second call after save fails to retrieve

      await expect(useCase.execute(input)).rejects.toThrow('Failed to retrieve saved attribute')
    })
  })
})

import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { CreateTableInput } from '@/application/dtos/TableDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import { Table } from '@/domain/entities/Table.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { ConflictException, ValidationException } from '@/shared/exceptions/DomainException.js'

describe('CreateTableUseCase', () => {
  let useCase: CreateTableUseCase
  let mockTableRepository: ITableRepository
  let mockQueryTemplateRepository: IQueryTemplateRepository
  let mockAttributeRepository: IAttributeRepository
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
    mockTableRepository = {
      save: mock(async (table: Table) => {
        // Return a properly constructed table using fromDatabase
        return Table.fromDatabase(
          'table-1',
          table.identifier,
          table.description || null,
          new Date(),
          new Date()
        ) as any
      }),
      findById: mock(async () => null),
      findByIdentifier: mock(async () => null),
      update: mock(async (table: Table) => table),
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
      create: mock(async (template: any) => template),
      update: mock(async (id: string, updates: any) => ({}) as any),
      deleteById: mock(async () => true),
      incrementUsage: mock(async () => {}),
      updateExecutionStats: mock(async () => {}),
      findPopular: mock(async () => []),
      updateStatus: mock(async () => ({}) as any),
    } as any

    mockAttributeRepository = {
      // IFullRepository methods
      save: mock(async (attr: any) => attr),
      findById: mock(async () => null),
      findByIdentifier: mock(async () => null),
      findAll: mock(async () => ({ data: [], metadata: {} })),
      delete: mock(async () => {}),
      count: mock(async () => 0),
      exists: mock(async () => false),
      saveMany: mock(async () => {}),
      findByIds: mock(async () => []),
      update: mock(async (attr: any) => attr),
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

    useCase = new CreateTableUseCase(
      mockTableRepository,
      mockQueryTemplateRepository,
      mockAttributeRepository,
      mockLogger
    )
  })

  describe('Input Validation', () => {
    it('should throw ValidationException when identifier is empty', async () => {
      const input: CreateTableInput = {
        identifier: '',
        description: 'Test Description',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Table identifier is required')
    })

    it('should throw ValidationException when identifier is only whitespace', async () => {
      const input: CreateTableInput = {
        identifier: '   ',
        description: 'Test Description',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Table identifier is required')
    })

    it('should throw ValidationException when identifier is null', async () => {
      const input: CreateTableInput = {
        identifier: null as any,
        description: 'Test Description',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Table identifier is required')
    })

    it('should throw ValidationException when identifier is undefined', async () => {
      const input: CreateTableInput = {
        identifier: undefined as any,
        description: 'Test Description',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Table identifier is required')
    })
  })

  describe('Duplicate Identifier Validation', () => {
    it('should throw ConflictException when table with same identifier exists', async () => {
      const input: CreateTableInput = {
        identifier: 'existing-table',
        description: 'Test Description',
      }

      const existingTable = Table.fromDatabase(
        'table-1',
        'existing-table',
        'Existing Table',
        new Date(),
        new Date()
      )

      mockTableRepository.findByIdentifier = mock(async () => existingTable as any)

      await expect(useCase.execute(input)).rejects.toThrow(ConflictException)
      await expect(useCase.execute(input)).rejects.toThrow(
        "Table with identifier 'existing-table' already exists"
      )
      expect(mockTableRepository.findByIdentifier).toHaveBeenCalledWith('existing-table')
    })

    it('should not throw when table identifier is unique', async () => {
      const input: CreateTableInput = {
        identifier: 'new-table',
        description: 'Test Description',
      }

      mockTableRepository.findByIdentifier = mock(async () => null)

      const result = await useCase.execute(input)

      expect(result.table).toBeDefined()
      expect(result.table.identifier).toBe('new-table')
    })
  })

  describe('Successful Table Creation', () => {
    it('should create a table successfully with identifier and description', async () => {
      const input: CreateTableInput = {
        identifier: 'test-table',
        description: 'Test Table Description',
      }

      mockTableRepository.findByIdentifier = mock(async () => null)

      const result = await useCase.execute(input)

      expect(result.table).toBeDefined()
      expect(result.table.identifier).toBe('test-table')
      expect(result.table.description).toBe('Test Table Description')
      expect(mockTableRepository.save).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith('Creating new table', {
        identifier: 'test-table',
      })
    })

    it('should create a table without description', async () => {
      const input: CreateTableInput = {
        identifier: 'test-table',
      }

      mockTableRepository.findByIdentifier = mock(async () => null)

      const result = await useCase.execute(input)

      expect(result.table).toBeDefined()
      expect(result.table.identifier).toBe('test-table')
      expect(mockTableRepository.save).toHaveBeenCalled()
    })

    it('should log successful table creation', async () => {
      const input: CreateTableInput = {
        identifier: 'test-table',
        description: 'Test Description',
      }

      mockTableRepository.findByIdentifier = mock(async () => null)

      await useCase.execute(input)

      expect(mockLogger.info).toHaveBeenCalledWith('Creating new table', {
        identifier: 'test-table',
      })
      expect(mockLogger.info).toHaveBeenCalledWith('Table created successfully', {
        id: 'table-1',
        identifier: 'test-table',
      })
    })
  })

  describe('Auto-generated Templates', () => {
    it('should create auto-generated templates after table creation', async () => {
      const input: CreateTableInput = {
        identifier: 'test-table',
        description: 'Test Description',
      }

      mockTableRepository.findByIdentifier = mock(async () => null)

      const result = await useCase.execute(input)

      expect(result.table).toBeDefined()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Auto-generated templates created successfully',
        {
          tableId: 'table-1',
          identifier: 'test-table',
        }
      )
    })

    it('should not fail table creation when template generation fails', async () => {
      const input: CreateTableInput = {
        identifier: 'test-table',
        description: 'Test Description',
      }

      mockTableRepository.findByIdentifier = mock(async () => null)
      mockQueryTemplateRepository.create = mock(async () => {
        throw new Error('Template generation failed')
      })

      const result = await useCase.execute(input)

      expect(result.table).toBeDefined()
      expect(result.table.identifier).toBe('test-table')
      // Template generation errors are logged as warnings for individual templates
      // The test should verify that warnings were logged
      expect(mockLogger.warn).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should log errors and rethrow when save fails', async () => {
      const input: CreateTableInput = {
        identifier: 'test-table',
        description: 'Test Description',
      }

      const saveError = new Error('Database connection failed')

      mockTableRepository.findByIdentifier = mock(async () => null)
      mockTableRepository.save = mock(async () => {
        throw saveError
      })

      await expect(useCase.execute(input)).rejects.toThrow('Database connection failed')
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create table', {
        identifier: 'test-table',
        error: 'Database connection failed',
      })
    })

    it('should handle non-Error exceptions', async () => {
      const input: CreateTableInput = {
        identifier: 'test-table',
        description: 'Test Description',
      }

      mockTableRepository.findByIdentifier = mock(async () => null)
      mockTableRepository.save = mock(async () => {
        throw 'String error'
      })

      await expect(useCase.execute(input)).rejects.toBe('String error')
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create table', {
        identifier: 'test-table',
        error: 'String error',
      })
    })
  })

  describe('Repository Interactions', () => {
    it('should check for existing table before creation', async () => {
      const input: CreateTableInput = {
        identifier: 'test-table',
        description: 'Test Description',
      }

      mockTableRepository.findByIdentifier = mock(async () => null)

      await useCase.execute(input)

      expect(mockTableRepository.findByIdentifier).toHaveBeenCalledWith('test-table')
      expect(mockTableRepository.findByIdentifier).toHaveBeenCalledTimes(1)
    })

    it('should save table to repository', async () => {
      const input: CreateTableInput = {
        identifier: 'test-table',
        description: 'Test Description',
      }

      mockTableRepository.findByIdentifier = mock(async () => null)

      await useCase.execute(input)

      expect(mockTableRepository.save).toHaveBeenCalledTimes(1)
      expect(mockTableRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'test-table',
          description: 'Test Description',
        })
      )
    })
  })

  describe('Edge Cases', () => {
    it('should reject identifiers with special characters (dots)', async () => {
      const input: CreateTableInput = {
        identifier: 'test-table_with-special.chars',
        description: 'Test Description',
      }

      mockTableRepository.findByIdentifier = mock(async () => null)

      // Table entity validation should reject dots in identifier
      await expect(useCase.execute(input)).rejects.toThrow()
    })

    it('should handle very long descriptions', async () => {
      const longDescription = 'A'.repeat(10000)
      const input: CreateTableInput = {
        identifier: 'test-table',
        description: longDescription,
      }

      mockTableRepository.findByIdentifier = mock(async () => null)

      const result = await useCase.execute(input)

      expect(result.table).toBeDefined()
      expect(result.table.description).toBe(longDescription)
    })

    it('should handle empty description', async () => {
      const input: CreateTableInput = {
        identifier: 'test-table',
        description: '',
      }

      mockTableRepository.findByIdentifier = mock(async () => null)

      const result = await useCase.execute(input)

      expect(result.table).toBeDefined()
      expect(result.table.identifier).toBe('test-table')
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CreateTableInput } from '@/application/dtos/TableDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import type { Attribute } from '@/domain/entities/Attribute.js'
import type { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import { Table } from '@/domain/entities/Table.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IQueryTemplateRepository } from '@/domain/repositories/IQueryTemplateRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { ConflictException, ValidationException } from '@/shared/exceptions/DomainException.js'

function emptyPage<T>() {
  return {
    data: [] as T[],
    nodes: [] as T[],
    totalCount: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  }
}

describe('CreateTableUseCase', () => {
  let useCase: CreateTableUseCase
  let mockTableRepository: ITableRepository
  let mockQueryTemplateRepository: IQueryTemplateRepository
  let mockAttributeRepository: IAttributeRepository
  let mockLogger: ILogger

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      info: vi.fn(() => {}),
      warn: vi.fn(() => {}),
      error: vi.fn(() => {}),
      debug: vi.fn(() => {}),
    }

    // Mock repositories
    mockTableRepository = {
      save: vi.fn(async (table: Table) => {
        // Return a properly constructed table using fromDatabase
        return Table.fromDatabase('table-1', table.identifier, table.description || null, new Date(), new Date())
      }),
      findById: vi.fn(async () => null),
      findByIdentifier: vi.fn(async () => null),
      update: vi.fn(async (table: Table) => table),
      delete: vi.fn(async () => {}),
      findAll: vi.fn(async () => emptyPage<Table>()),
      count: vi.fn(async () => 0),
      exists: vi.fn(async () => false),
      saveMany: vi.fn(async () => {}),
      findByIds: vi.fn(async () => []),
      deleteMany: vi.fn(async () => {}),
    }

    mockQueryTemplateRepository = {
      findById: vi.fn(async () => null),
      findByIdentifier: vi.fn(async () => null),
      search: vi.fn(async () => ({
        items: [],
        total: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      })),
      searchByQueryName: vi.fn(async () => []),
      searchByOperationType: vi.fn(async () => []),
      findByApplicableTable: vi.fn(async () => []),
      findTemplatesWithTableDependencies: vi.fn(async () => []),
      create: vi.fn(async (template: QueryTemplate) => template),
      update: vi.fn(async () => {
        throw new Error('Not implemented in test')
      }),
      deleteById: vi.fn(async () => true),
      incrementUsage: vi.fn(async () => {}),
      updateExecutionStats: vi.fn(async () => {}),
      findPopular: vi.fn(async () => []),
      updateStatus: vi.fn(async () => {
        throw new Error('Not implemented in test')
      }),
    }

    mockAttributeRepository = {
      // IFullRepository methods
      save: vi.fn(async (attr: Attribute) => attr),
      findById: vi.fn(async () => null),
      findByIdentifier: vi.fn(async () => null),
      findAll: vi.fn(async () => emptyPage<Attribute>()),
      delete: vi.fn(async () => {}),
      count: vi.fn(async () => 0),
      exists: vi.fn(async () => false),
      saveMany: vi.fn(async () => {}),
      findByIds: vi.fn(async () => []),
      update: vi.fn(async () => {
        throw new Error('Not implemented in test')
      }),
      deleteMany: vi.fn(async () => {}),
      // ITableScopedRepository methods
      findByParentId: vi.fn(async () => emptyPage<Attribute>()),
      countByParentId: vi.fn(async () => 0),
      deleteByParentId: vi.fn(async () => {}),
      // Attribute-specific methods
      findByTableId: vi.fn(async () => emptyPage<Attribute>()),
      countByTableId: vi.fn(async () => 0),
      deleteByTableId: vi.fn(async () => {}),
      findByTableIdAndIdentifier: vi.fn(async () => null),
      findByAttributeTypeId: vi.fn(async () => emptyPage<Attribute>()),
      findRequiredByTableId: vi.fn(async () => []),
      getAttributeTypeForAttribute: vi.fn(async () => null),
      existsByTableIdAndIdentifier: vi.fn(async () => false),
    }

    useCase = new CreateTableUseCase(
      mockTableRepository,
      mockQueryTemplateRepository,
      mockAttributeRepository,
      mockLogger,
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
        identifier: null,
        description: 'Test Description',
      } as unknown as CreateTableInput

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Table identifier is required')
    })

    it('should throw ValidationException when identifier is undefined', async () => {
      const input: CreateTableInput = {
        identifier: undefined,
        description: 'Test Description',
      } as unknown as CreateTableInput

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

      const existingTable = Table.fromDatabase('table-1', 'existing-table', 'Existing Table', new Date(), new Date())

      mockTableRepository.findByIdentifier = vi.fn(async () => existingTable)

      await expect(useCase.execute(input)).rejects.toThrow(ConflictException)
      await expect(useCase.execute(input)).rejects.toThrow("Table with identifier 'existing-table' already exists")
      expect(mockTableRepository.findByIdentifier).toHaveBeenCalledWith('existing-table')
    })

    it('should not throw when table identifier is unique', async () => {
      const input: CreateTableInput = {
        identifier: 'new-table',
        description: 'Test Description',
      }

      mockTableRepository.findByIdentifier = vi.fn(async () => null)

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

      mockTableRepository.findByIdentifier = vi.fn(async () => null)

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

      mockTableRepository.findByIdentifier = vi.fn(async () => null)

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

      mockTableRepository.findByIdentifier = vi.fn(async () => null)

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

      mockTableRepository.findByIdentifier = vi.fn(async () => null)

      const result = await useCase.execute(input)

      expect(result.table).toBeDefined()
      expect(mockLogger.info).toHaveBeenCalledWith('Auto-generated templates created successfully', {
        tableId: 'table-1',
        identifier: 'test-table',
      })
    })

    it('should not fail table creation when template generation fails', async () => {
      const input: CreateTableInput = {
        identifier: 'test-table',
        description: 'Test Description',
      }

      mockTableRepository.findByIdentifier = vi.fn(async () => null)
      mockQueryTemplateRepository.create = vi.fn(async () => {
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

      mockTableRepository.findByIdentifier = vi.fn(async () => null)
      mockTableRepository.save = vi.fn(async () => {
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

      mockTableRepository.findByIdentifier = vi.fn(async () => null)
      mockTableRepository.save = vi.fn(async () => {
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

      mockTableRepository.findByIdentifier = vi.fn(async () => null)

      await useCase.execute(input)

      expect(mockTableRepository.findByIdentifier).toHaveBeenCalledWith('test-table')
      expect(mockTableRepository.findByIdentifier).toHaveBeenCalledTimes(1)
    })

    it('should save table to repository', async () => {
      const input: CreateTableInput = {
        identifier: 'test-table',
        description: 'Test Description',
      }

      mockTableRepository.findByIdentifier = vi.fn(async () => null)

      await useCase.execute(input)

      expect(mockTableRepository.save).toHaveBeenCalledTimes(1)
      expect(mockTableRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'test-table',
          description: 'Test Description',
        }),
      )
    })
  })

  describe('Edge Cases', () => {
    it('should reject identifiers with special characters (dots)', async () => {
      const input: CreateTableInput = {
        identifier: 'test-table_with-special.chars',
        description: 'Test Description',
      }

      mockTableRepository.findByIdentifier = vi.fn(async () => null)

      // Table entity validation should reject dots in identifier
      await expect(useCase.execute(input)).rejects.toThrow()
    })

    it('should handle very long descriptions', async () => {
      const longDescription = 'A'.repeat(10000)
      const input: CreateTableInput = {
        identifier: 'test-table',
        description: longDescription,
      }

      mockTableRepository.findByIdentifier = vi.fn(async () => null)

      const result = await useCase.execute(input)

      expect(result.table).toBeDefined()
      expect(result.table.description).toBe(longDescription)
    })

    it('should handle empty description', async () => {
      const input: CreateTableInput = {
        identifier: 'test-table',
        description: '',
      }

      mockTableRepository.findByIdentifier = vi.fn(async () => null)

      const result = await useCase.execute(input)

      expect(result.table).toBeDefined()
      expect(result.table.identifier).toBe('test-table')
    })
  })
})

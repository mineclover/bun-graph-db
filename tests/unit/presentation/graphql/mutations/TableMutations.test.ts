import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { TableMutations } from '@/presentation/graphql/mutations/TableMutations.js'
import type { CreateTableUseCase } from '@/application/use-cases/tables/CreateTable.js'
import type { DeleteTableUseCase, TableDependencyInfo } from '@/application/use-cases/tables/DeleteTable.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { Table } from '@/domain/entities/Table.js'

describe('TableMutations', () => {
  let tableMutations: TableMutations
  let mockCreateTableUseCase: CreateTableUseCase
  let mockDeleteTableUseCase: DeleteTableUseCase
  let mockTableRepository: ITableRepository
  let mockLogger: ILogger

  const mockTable: Partial<Table> = {
    getId: () => 'table-1',
    getIdentifier: () => 'test_table',
    getDescription: () => 'Test table description',
    getCreatedAt: () => new Date('2024-01-01'),
    getUpdatedAt: () => new Date('2024-01-01')
  }

  const mockDependencies: TableDependencyInfo = {
    nodeCount: 0,
    attributeCount: 0,
    relationCount: 0,
    hasData: false
  }

  beforeEach(() => {
    mockCreateTableUseCase = {
      execute: mock(() => Promise.resolve(mockTable as Table))
    } as any

    mockDeleteTableUseCase = {
      execute: mock(() => Promise.resolve(mockDependencies))
    } as any

    mockTableRepository = {
      findById: mock(() => Promise.resolve(mockTable as Table)),
      update: mock(() => Promise.resolve(mockTable as Table))
    } as any

    mockLogger = {
      info: mock(() => {}),
      error: mock(() => {}),
      warn: mock(() => {}),
      debug: mock(() => {})
    } as any

    tableMutations = new TableMutations(
      mockCreateTableUseCase,
      mockDeleteTableUseCase,
      mockTableRepository,
      mockLogger
    )
  })

  describe('createTable mutation', () => {
    it('should create table successfully', async () => {
      const createInput = {
        identifier: 'new_table',
        description: 'New table description'
      }

      const result = await tableMutations.createTable({}, { input: createInput })

      expect(result).toEqual({
        success: true,
        table: mockTable,
        errors: []
      })

      expect(mockCreateTableUseCase.execute).toHaveBeenCalledWith({
        identifier: 'new_table',
        description: 'New table description'
      })
      expect(mockLogger.info).toHaveBeenCalledWith('Creating table', { input: createInput })
    })

    it('should handle creation errors', async () => {
      const createError = new Error('Table identifier already exists')
      mockCreateTableUseCase.execute = mock(() => Promise.reject(createError))

      const result = await tableMutations.createTable({}, { 
        input: { identifier: 'duplicate_table' }
      })

      expect(result).toEqual({
        success: false,
        table: null,
        errors: [{ message: 'Table identifier already exists', code: 'CREATE_TABLE_ERROR' }]
      })

      expect(mockLogger.error).toHaveBeenCalledWith('Error creating table', {
        error: createError,
        input: { identifier: 'duplicate_table' }
      })
    })
  })

  describe('updateTable mutation', () => {
    it('should update table successfully', async () => {
      const updateInput = { description: 'Updated description' }

      const result = await tableMutations.updateTable({}, { 
        id: 'table-1', 
        input: updateInput 
      })

      expect(result).toEqual({
        success: true,
        table: mockTable,
        errors: []
      })

      expect(mockTableRepository.findById).toHaveBeenCalledWith('table-1')
      expect(mockTableRepository.update).toHaveBeenCalledWith('table-1', updateInput)
      expect(mockLogger.info).toHaveBeenCalledWith('Updating table', { 
        id: 'table-1', 
        input: updateInput 
      })
    })

    it('should handle table not found', async () => {
      mockTableRepository.findById = mock(() => Promise.resolve(null))

      const result = await tableMutations.updateTable({}, { 
        id: 'nonexistent', 
        input: { description: 'Updated' }
      })

      expect(result).toEqual({
        success: false,
        table: null,
        errors: [{ message: 'Table not found', code: 'TABLE_NOT_FOUND' }]
      })

      expect(mockTableRepository.update).not.toHaveBeenCalled()
    })
  })

  describe('deleteTable mutation', () => {
    it('should delete empty table successfully', async () => {
      const result = await tableMutations.deleteTable({}, { 
        id: 'table-1',
        force: false,
        cascadeDelete: false
      })

      expect(result).toEqual({
        success: true,
        errors: [],
        deletedDependencies: {
          nodeCount: 0,
          attributeCount: 0,
          relationCount: 0
        }
      })

      expect(mockDeleteTableUseCase.execute).toHaveBeenCalledWith({
        id: 'table-1',
        force: false,
        cascadeDelete: false
      })
      expect(mockLogger.info).toHaveBeenCalledWith('Deleting table with safety checks', {
        id: 'table-1',
        force: false,
        cascadeDelete: false
      })
    })

    it('should handle table with dependencies without force flag', async () => {
      const dependencyError = new Error('Cannot delete table \'test_table\'. Found 5 nodes, 3 attributes, and 2 relations. Use \'force: true\' to override or \'cascadeDelete: true\' to delete all related data.')
      mockDeleteTableUseCase.execute = mock(() => Promise.reject(dependencyError))

      const result = await tableMutations.deleteTable({}, { 
        id: 'table-1',
        force: false
      })

      expect(result).toEqual({
        success: false,
        errors: [{ 
          message: 'Cannot delete table \'test_table\'. Found 5 nodes, 3 attributes, and 2 relations. Use \'force: true\' to override or \'cascadeDelete: true\' to delete all related data.',
          code: 'TABLE_HAS_DEPENDENCIES' 
        }]
      })

      expect(mockLogger.error).toHaveBeenCalledWith('Error deleting table', {
        error: dependencyError,
        id: 'table-1'
      })
    })

    it('should delete table with force flag', async () => {
      const dependenciesWithData: TableDependencyInfo = {
        nodeCount: 5,
        attributeCount: 3,
        relationCount: 2,
        hasData: true
      }
      mockDeleteTableUseCase.execute = mock(() => Promise.resolve(dependenciesWithData))

      const result = await tableMutations.deleteTable({}, { 
        id: 'table-1',
        force: true
      })

      expect(result).toEqual({
        success: true,
        errors: [],
        deletedDependencies: {
          nodeCount: 5,
          attributeCount: 3,
          relationCount: 2
        }
      })

      expect(mockDeleteTableUseCase.execute).toHaveBeenCalledWith({
        id: 'table-1',
        force: true,
        cascadeDelete: undefined
      })
    })

    it('should handle table not found error', async () => {
      const notFoundError = new Error('Table with ID table-1 not found')
      mockDeleteTableUseCase.execute = mock(() => Promise.reject(notFoundError))

      const result = await tableMutations.deleteTable({}, { id: 'nonexistent' })

      expect(result).toEqual({
        success: false,
        errors: [{ message: 'Table with ID table-1 not found', code: 'TABLE_NOT_FOUND' }]
      })
    })

    it('should handle general deletion errors', async () => {
      const generalError = new Error('Database connection failed')
      mockDeleteTableUseCase.execute = mock(() => Promise.reject(generalError))

      const result = await tableMutations.deleteTable({}, { id: 'table-1' })

      expect(result).toEqual({
        success: false,
        errors: [{ message: 'Database connection failed', code: 'DELETE_TABLE_ERROR' }]
      })
    })

    it('should log successful deletion details', async () => {
      const dependenciesWithData: TableDependencyInfo = {
        nodeCount: 2,
        attributeCount: 1,
        relationCount: 0,
        hasData: true
      }
      mockDeleteTableUseCase.execute = mock(() => Promise.resolve(dependenciesWithData))

      await tableMutations.deleteTable({}, { id: 'table-1', force: true })

      expect(mockLogger.info).toHaveBeenCalledWith('Table deletion completed successfully', {
        id: 'table-1',
        hadDependencies: true,
        nodeCount: 2,
        attributeCount: 1,
        relationCount: 0
      })
    })
  })
})
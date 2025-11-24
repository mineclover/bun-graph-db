import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { DeleteTableUseCase, type DeleteTableInput, type TableDependencyInfo } from '@/application/use-cases/tables/DeleteTable.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { createTestTable } from './test-helpers.js'

describe('DeleteTableUseCase', () => {
  let useCase: DeleteTableUseCase
  let mockTableRepository: ITableRepository
  let mockNodeRepository: INodeRepository
  let mockAttributeRepository: IAttributeRepository
  let mockRelationRepository: INodeRelationRepository
  let mockLogger: ILogger

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
      debug: mock(() => {}),
    }

    // Mock repositories with count methods
    mockTableRepository = {
      save: mock(async (table) => table),
      findById: mock(async () => null),
      findByIdentifier: mock(async () => null),
      update: mock(async (table) => table),
      delete: mock(async () => {}),
      findAll: mock(async () => ({ data: [], metadata: {} })),
      exists: mock(async () => false),
      saveMany: mock(async () => {}),
      findByIds: mock(async () => []),
    } as any

    mockNodeRepository = {
      save: mock(async (node) => node),
      findById: mock(async () => null),
      findByTableIdAndContent: mock(async () => null),
      findByTableId: mock(async () => ({ data: [], metadata: {} })),
      update: mock(async (node) => node),
      delete: mock(async () => {}),
      findAll: mock(async () => ({ data: [], metadata: {} })),
      countByTableId: mock(async () => 0),
      deleteByTableId: mock(async () => {}),
    } as any

    mockAttributeRepository = {
      save: mock(async () => {}),
      findById: mock(async () => null),
      findByTableIdAndIdentifier: mock(async () => null),
      findByTableId: mock(async () => ({ data: [], metadata: {} })),
      update: mock(async (attr) => attr),
      delete: mock(async () => {}),
      findAll: mock(async () => ({ data: [], metadata: {} })),
      exists: mock(async () => false),
      countByTableId: mock(async () => 0),
      deleteByTableId: mock(async () => {}),
    } as any

    mockRelationRepository = {
      save: mock(async (rel) => rel),
      findById: mock(async () => null),
      findByExternalIds: mock(async () => null),
      findBySourceNodeIdAndRelationType: mock(async () => []),
      findByTargetNodeIdAndRelationType: mock(async () => []),
      exists: mock(async () => false),
      update: mock(async (rel) => rel),
      delete: mock(async () => {}),
      findAll: mock(async () => ({ data: [], metadata: {} })),
      count: mock(async () => 0),
      deleteByTableId: mock(async () => {}),
    } as any

    useCase = new DeleteTableUseCase(
      mockTableRepository,
      mockNodeRepository,
      mockAttributeRepository,
      mockRelationRepository,
      mockLogger
    )
  })

  describe('Table Existence Validation', () => {
    it('should throw error when table does not exist', async () => {
      const input: DeleteTableInput = {
        id: 'non-existent-table' as any,
      }

      mockTableRepository.findById = mock(async () => null)

      await expect(useCase.execute(input)).rejects.toThrow('Table with ID non-existent-table not found')
    })
  })

  describe('Dependency Checking', () => {
    it('should check table dependencies correctly', async () => {
      const tableId = 'table-1' as any

      mockNodeRepository.countByTableId = mock(async () => 5)
      mockAttributeRepository.countByTableId = mock(async () => 3)
      mockRelationRepository.count = mock(async () => 10)

      const result = await useCase.checkTableDependencies(tableId)

      expect(result.nodeCount).toBe(5)
      expect(result.attributeCount).toBe(3)
      expect(result.relationCount).toBe(10)
      expect(result.hasData).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith('Checking table dependencies', { tableId })
    })

    it('should report no data when all counts are zero', async () => {
      const tableId = 'table-1' as any

      mockNodeRepository.countByTableId = mock(async () => 0)
      mockAttributeRepository.countByTableId = mock(async () => 0)
      mockRelationRepository.count = mock(async () => 0)

      const result = await useCase.checkTableDependencies(tableId)

      expect(result.nodeCount).toBe(0)
      expect(result.attributeCount).toBe(0)
      expect(result.relationCount).toBe(0)
      expect(result.hasData).toBe(false)
    })
  })

  describe('Deletion Protection', () => {
    it('should block deletion when table has data and force is false', async () => {
      const input: DeleteTableInput = {
        id: 'table-1' as any,
        force: false,
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = mock(async () => table as any)
      mockNodeRepository.countByTableId = mock(async () => 5)
      mockAttributeRepository.countByTableId = mock(async () => 3)
      mockRelationRepository.count = mock(async () => 2)

      const promise = useCase.execute(input)
      await expect(promise).rejects.toThrow('Cannot delete table')
      await expect(promise).rejects.toThrow('Found 5 nodes, 3 attributes, and 2 relations')
    })

    it('should allow deletion when table has no data', async () => {
      const input: DeleteTableInput = {
        id: 'table-1' as any,
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = mock(async () => table as any)
      mockNodeRepository.countByTableId = mock(async () => 0)
      mockAttributeRepository.countByTableId = mock(async () => 0)
      mockRelationRepository.count = mock(async () => 0)

      const result = await useCase.execute(input)

      expect(result.hasData).toBe(false)
      expect(mockTableRepository.delete).toHaveBeenCalledWith('table-1')
      expect(mockLogger.info).toHaveBeenCalledWith('Table deletion completed successfully', expect.objectContaining({
        tableId: 'table-1',
        tableName: 'test-table',
      }))
    })
  })

  describe('Force Deletion', () => {
    it('should delete table with data when force is true', async () => {
      const input: DeleteTableInput = {
        id: 'table-1' as any,
        force: true,
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = mock(async () => table as any)
      mockNodeRepository.countByTableId = mock(async () => 5)
      mockAttributeRepository.countByTableId = mock(async () => 3)
      mockRelationRepository.count = mock(async () => 2)

      const result = await useCase.execute(input)

      expect(result.hasData).toBe(true)
      expect(result.nodeCount).toBe(5)
      expect(mockTableRepository.delete).toHaveBeenCalledWith('table-1')
    })
  })

  describe('Cascade Deletion', () => {
    it('should perform cascade deletion when cascadeDelete is true', async () => {
      const input: DeleteTableInput = {
        id: 'table-1' as any,
        cascadeDelete: true,
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = mock(async () => table as any)
      mockNodeRepository.countByTableId = mock(async () => 5)
      mockAttributeRepository.countByTableId = mock(async () => 3)
      mockRelationRepository.count = mock(async () => 2)

      const result = await useCase.execute(input)

      expect(result.hasData).toBe(true)
      // Verify cascade deletion order: relations -> nodes -> attributes
      expect(mockRelationRepository.deleteByTableId).toHaveBeenCalledWith('table-1')
      expect(mockNodeRepository.deleteByTableId).toHaveBeenCalledWith('table-1')
      expect(mockAttributeRepository.deleteByTableId).toHaveBeenCalledWith('table-1')
      expect(mockTableRepository.delete).toHaveBeenCalledWith('table-1')
    })

    it('should skip cascade steps when no data exists', async () => {
      const input: DeleteTableInput = {
        id: 'table-1' as any,
        cascadeDelete: true,
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = mock(async () => table as any)
      mockNodeRepository.countByTableId = mock(async () => 0)
      mockAttributeRepository.countByTableId = mock(async () => 0)
      mockRelationRepository.count = mock(async () => 0)

      await useCase.execute(input)

      // Should not call cascade methods when no data
      expect(mockRelationRepository.deleteByTableId).not.toHaveBeenCalled()
      expect(mockNodeRepository.deleteByTableId).not.toHaveBeenCalled()
      expect(mockAttributeRepository.deleteByTableId).not.toHaveBeenCalled()
      expect(mockTableRepository.delete).toHaveBeenCalledWith('table-1')
    })

    it('should delete only nodes when only nodes exist', async () => {
      const input: DeleteTableInput = {
        id: 'table-1' as any,
        cascadeDelete: true,
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = mock(async () => table as any)
      mockNodeRepository.countByTableId = mock(async () => 5)
      mockAttributeRepository.countByTableId = mock(async () => 0)
      mockRelationRepository.count = mock(async () => 0)

      await useCase.execute(input)

      expect(mockNodeRepository.deleteByTableId).toHaveBeenCalledWith('table-1')
      expect(mockRelationRepository.deleteByTableId).not.toHaveBeenCalled()
      expect(mockAttributeRepository.deleteByTableId).not.toHaveBeenCalled()
    })
  })

  describe('Logging', () => {
    it('should log deletion process steps', async () => {
      const input: DeleteTableInput = {
        id: 'table-1' as any,
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = mock(async () => table as any)
      mockNodeRepository.countByTableId = mock(async () => 0)
      mockAttributeRepository.countByTableId = mock(async () => 0)
      mockRelationRepository.count = mock(async () => 0)

      await useCase.execute(input)

      expect(mockLogger.info).toHaveBeenCalledWith('Starting table deletion process', expect.objectContaining({
        tableId: 'table-1',
        force: false,
        cascadeDelete: false,
      }))
      expect(mockLogger.info).toHaveBeenCalledWith('Table deletion completed successfully', expect.any(Object))
    })

    it('should log warning when deletion is blocked', async () => {
      const input: DeleteTableInput = {
        id: 'table-1' as any,
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = mock(async () => table as any)
      mockNodeRepository.countByTableId = mock(async () => 5)
      mockAttributeRepository.countByTableId = mock(async () => 0)
      mockRelationRepository.count = mock(async () => 0)

      await expect(useCase.execute(input)).rejects.toThrow()

      expect(mockLogger.warn).toHaveBeenCalledWith('Table deletion blocked due to existing data', expect.any(Object))
    })
  })
})

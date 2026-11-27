import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ILogger } from '@/application/ports/ILogger.js'
import { type DeleteTableInput, DeleteTableUseCase } from '@/application/use-cases/tables/DeleteTable.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
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
      info: vi.fn(() => {}),
      warn: vi.fn(() => {}),
      error: vi.fn(() => {}),
      debug: vi.fn(() => {}),
    }

    // Mock repositories with count methods
    mockTableRepository = {
      save: vi.fn(async (table) => table),
      findById: vi.fn(async () => null),
      findByIdentifier: vi.fn(async () => null),
      update: vi.fn(async (table) => table),
      delete: vi.fn(async () => {}),
      findAll: vi.fn(async () => ({ data: [], metadata: {} })),
      exists: vi.fn(async () => false),
      saveMany: vi.fn(async () => {}),
      findByIds: vi.fn(async () => []),
    } as unknown as ITableRepository

    mockNodeRepository = {
      save: vi.fn(async (node) => node),
      findById: vi.fn(async () => null),
      findByTableIdAndContent: vi.fn(async () => null),
      findByTableId: vi.fn(async () => ({ data: [], metadata: {} })),
      update: vi.fn(async (node) => node),
      delete: vi.fn(async () => {}),
      findAll: vi.fn(async () => ({ data: [], metadata: {} })),
      countByTableId: vi.fn(async () => 0),
      deleteByTableId: vi.fn(async () => {}),
    } as unknown as INodeRepository

    mockAttributeRepository = {
      save: vi.fn(async () => {}),
      findById: vi.fn(async () => null),
      findByTableIdAndIdentifier: vi.fn(async () => null),
      findByTableId: vi.fn(async () => ({ data: [], metadata: {} })),
      update: vi.fn(async (attr) => attr),
      delete: vi.fn(async () => {}),
      findAll: vi.fn(async () => ({ data: [], metadata: {} })),
      exists: vi.fn(async () => false),
      countByTableId: vi.fn(async () => 0),
      deleteByTableId: vi.fn(async () => {}),
    } as unknown as IAttributeRepository

    mockRelationRepository = {
      save: vi.fn(async (rel) => rel),
      findById: vi.fn(async () => null),
      findByExternalIds: vi.fn(async () => null),
      findBySourceNodeIdAndRelationType: vi.fn(async () => []),
      findByTargetNodeIdAndRelationType: vi.fn(async () => []),
      exists: vi.fn(async () => false),
      update: vi.fn(async (rel) => rel),
      delete: vi.fn(async () => {}),
      findAll: vi.fn(async () => ({ data: [], metadata: {} })),
      count: vi.fn(async () => 0),
      deleteByTableId: vi.fn(async () => {}),
    } as unknown as INodeRelationRepository

    useCase = new DeleteTableUseCase(
      mockTableRepository,
      mockNodeRepository,
      mockAttributeRepository,
      mockRelationRepository,
      mockLogger,
    )
  })

  describe('Table Existence Validation', () => {
    it('should throw error when table does not exist', async () => {
      const input: DeleteTableInput = {
        id: 'non-existent-table',
      }

      mockTableRepository.findById = vi.fn(async () => null)

      await expect(useCase.execute(input)).rejects.toThrow('Table with ID non-existent-table not found')
    })
  })

  describe('Dependency Checking', () => {
    it('should check table dependencies correctly', async () => {
      const tableId = 'table-1'

      mockNodeRepository.countByTableId = vi.fn(async () => 5)
      mockAttributeRepository.countByTableId = vi.fn(async () => 3)
      mockRelationRepository.count = vi.fn(async () => 10)

      const result = await useCase.checkTableDependencies(tableId)

      expect(result.nodeCount).toBe(5)
      expect(result.attributeCount).toBe(3)
      expect(result.relationCount).toBe(10)
      expect(result.hasData).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith('Checking table dependencies', { tableId })
    })

    it('should report no data when all counts are zero', async () => {
      const tableId = 'table-1'

      mockNodeRepository.countByTableId = vi.fn(async () => 0)
      mockAttributeRepository.countByTableId = vi.fn(async () => 0)
      mockRelationRepository.count = vi.fn(async () => 0)

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
        id: 'table-1',
        force: false,
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = vi.fn(async () => table)
      mockNodeRepository.countByTableId = vi.fn(async () => 5)
      mockAttributeRepository.countByTableId = vi.fn(async () => 3)
      mockRelationRepository.count = vi.fn(async () => 2)

      const promise = useCase.execute(input)
      await expect(promise).rejects.toThrow('Cannot delete table')
      await expect(promise).rejects.toThrow('Found 5 nodes, 3 attributes, and 2 relations')
    })

    it('should allow deletion when table has no data', async () => {
      const input: DeleteTableInput = {
        id: 'table-1',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = vi.fn(async () => table)
      mockNodeRepository.countByTableId = vi.fn(async () => 0)
      mockAttributeRepository.countByTableId = vi.fn(async () => 0)
      mockRelationRepository.count = vi.fn(async () => 0)

      const result = await useCase.execute(input)

      expect(result.hasData).toBe(false)
      expect(mockTableRepository.delete).toHaveBeenCalledWith('table-1')
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Table deletion completed successfully',
        expect.objectContaining({
          tableId: 'table-1',
          tableName: 'test-table',
        }),
      )
    })
  })

  describe('Force Deletion', () => {
    it('should delete table with data when force is true', async () => {
      const input: DeleteTableInput = {
        id: 'table-1',
        force: true,
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = vi.fn(async () => table)
      mockNodeRepository.countByTableId = vi.fn(async () => 5)
      mockAttributeRepository.countByTableId = vi.fn(async () => 3)
      mockRelationRepository.count = vi.fn(async () => 2)

      const result = await useCase.execute(input)

      expect(result.hasData).toBe(true)
      expect(result.nodeCount).toBe(5)
      expect(mockTableRepository.delete).toHaveBeenCalledWith('table-1')
    })
  })

  describe('Cascade Deletion', () => {
    it('should perform cascade deletion when cascadeDelete is true', async () => {
      const input: DeleteTableInput = {
        id: 'table-1',
        cascadeDelete: true,
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = vi.fn(async () => table)
      mockNodeRepository.countByTableId = vi.fn(async () => 5)
      mockAttributeRepository.countByTableId = vi.fn(async () => 3)
      mockRelationRepository.count = vi.fn(async () => 2)

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
        id: 'table-1',
        cascadeDelete: true,
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = vi.fn(async () => table)
      mockNodeRepository.countByTableId = vi.fn(async () => 0)
      mockAttributeRepository.countByTableId = vi.fn(async () => 0)
      mockRelationRepository.count = vi.fn(async () => 0)

      await useCase.execute(input)

      // Should not call cascade methods when no data
      expect(mockRelationRepository.deleteByTableId).not.toHaveBeenCalled()
      expect(mockNodeRepository.deleteByTableId).not.toHaveBeenCalled()
      expect(mockAttributeRepository.deleteByTableId).not.toHaveBeenCalled()
      expect(mockTableRepository.delete).toHaveBeenCalledWith('table-1')
    })

    it('should delete only nodes when only nodes exist', async () => {
      const input: DeleteTableInput = {
        id: 'table-1',
        cascadeDelete: true,
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = vi.fn(async () => table)
      mockNodeRepository.countByTableId = vi.fn(async () => 5)
      mockAttributeRepository.countByTableId = vi.fn(async () => 0)
      mockRelationRepository.count = vi.fn(async () => 0)

      await useCase.execute(input)

      expect(mockNodeRepository.deleteByTableId).toHaveBeenCalledWith('table-1')
      expect(mockRelationRepository.deleteByTableId).not.toHaveBeenCalled()
      expect(mockAttributeRepository.deleteByTableId).not.toHaveBeenCalled()
    })
  })

  describe('Logging', () => {
    it('should log deletion process steps', async () => {
      const input: DeleteTableInput = {
        id: 'table-1',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = vi.fn(async () => table)
      mockNodeRepository.countByTableId = vi.fn(async () => 0)
      mockAttributeRepository.countByTableId = vi.fn(async () => 0)
      mockRelationRepository.count = vi.fn(async () => 0)

      await useCase.execute(input)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting table deletion process',
        expect.objectContaining({
          tableId: 'table-1',
          force: false,
          cascadeDelete: false,
        }),
      )
      expect(mockLogger.info).toHaveBeenCalledWith('Table deletion completed successfully', expect.any(Object))
    })

    it('should log warning when deletion is blocked', async () => {
      const input: DeleteTableInput = {
        id: 'table-1',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = vi.fn(async () => table)
      mockNodeRepository.countByTableId = vi.fn(async () => 5)
      mockAttributeRepository.countByTableId = vi.fn(async () => 0)
      mockRelationRepository.count = vi.fn(async () => 0)

      await expect(useCase.execute(input)).rejects.toThrow()

      expect(mockLogger.warn).toHaveBeenCalledWith('Table deletion blocked due to existing data', expect.any(Object))
    })
  })
})

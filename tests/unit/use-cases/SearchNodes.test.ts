import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { ILogger } from '@/application/ports/ILogger.js'
import {
  type INodeSearchRepository,
  type SearchNodesInput,
  SearchNodesUseCase,
} from '@/application/use-cases/nodes/SearchNodes.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'
import {
  createTestAttribute,
  createTestAttributeType,
  createTestNode,
  createTestTable,
} from './test-helpers.js'

describe('SearchNodesUseCase', () => {
  let useCase: SearchNodesUseCase
  let mockNodeRepository: INodeRepository
  let mockNodeSearchRepository: INodeSearchRepository
  let mockAttributeRepository: IAttributeRepository
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
    mockNodeRepository = {
      save: mock(async (node) => node),
      findById: mock(async () => null),
      findByTableIdAndContent: mock(async () => null),
      findByTableId: mock(async () => ({ data: [], metadata: {} })),
      update: mock(async (node) => node),
      delete: mock(async () => {}),
      findAll: mock(async () => ({ data: [], metadata: {} })),
    } as any

    mockNodeSearchRepository = {
      searchNodes: mock(async () => ({
        data: [],
        total: 0,
        hasMore: false,
        hasNextPage: false,
        hasPreviousPage: false,
      })),
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
      getAttributeTypeForAttribute: mock(async () => null),
    } as any

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

    useCase = new SearchNodesUseCase(
      mockNodeRepository,
      mockNodeSearchRepository,
      mockAttributeRepository,
      mockTableRepository,
      mockLogger
    )
  })

  describe('Input Validation', () => {
    it('should throw ValidationException when tableId is empty', async () => {
      const input: SearchNodesInput = {
        tableId: '',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Table ID is required')
    })

    it('should throw ValidationException when limit is less than 1', async () => {
      const input: SearchNodesInput = {
        tableId: 'table-1',
        limit: 0,
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Limit must be between 1 and 1000')
    })

    it('should throw ValidationException when limit is greater than 1000', async () => {
      const input: SearchNodesInput = {
        tableId: 'table-1',
        limit: 1001,
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Limit must be between 1 and 1000')
    })

    it('should throw ValidationException when offset is negative', async () => {
      const input: SearchNodesInput = {
        tableId: 'table-1',
        offset: -1,
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Offset must be non-negative')
    })
  })

  describe('Table Validation', () => {
    it('should throw NotFoundException when table does not exist', async () => {
      const input: SearchNodesInput = {
        tableId: 'non-existent-table',
      }

      mockTableRepository.findById = mock(async () => null)

      await expect(useCase.execute(input)).rejects.toThrow(NotFoundException)
      await expect(useCase.execute(input)).rejects.toThrow(
        "Table with id 'non-existent-table' not found"
      )
    })
  })

  describe('Empty Query Search', () => {
    it('should search with default pagination when no query is provided', async () => {
      const input: SearchNodesInput = {
        tableId: 'table-1',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')
      const node1 = createTestNode('node-1', 'table-1', 'Test Node 1')
      const node2 = createTestNode('node-2', 'table-1', 'Test Node 2')

      mockTableRepository.findById = mock(async () => table as any)
      mockAttributeRepository.findByTableId = mock(async () => ({ data: [], metadata: {} }))
      mockNodeSearchRepository.searchNodes = mock(async () => ({
        data: [
          { node: node1, attributes: {} },
          { node: node2, attributes: {} },
        ],
        total: 2,
        hasMore: false,
        hasNextPage: false,
        hasPreviousPage: false,
      }))

      const result = await useCase.execute(input)

      expect(result.nodes).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.totalCount).toBe(2)
      expect(result.hasMore).toBe(false)
      expect(result.query.originalQuery).toBe('')
      expect(mockNodeSearchRepository.searchNodes).toHaveBeenCalled()
    })
  })

  describe('Query Parsing and Search', () => {
    it('should parse and execute a simple text search query', async () => {
      const input: SearchNodesInput = {
        tableId: 'table-1',
        query: 'test search',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')
      const node = createTestNode('node-1', 'table-1', 'Test Node')

      mockTableRepository.findById = mock(async () => table as any)
      mockAttributeRepository.findByTableId = mock(async () => ({ data: [], metadata: {} }))
      mockNodeSearchRepository.searchNodes = mock(async () => ({
        data: [{ node, attributes: {} }],
        total: 1,
        hasMore: false,
        hasNextPage: false,
        hasPreviousPage: false,
      }))

      const result = await useCase.execute(input)

      expect(result.nodes).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.query.originalQuery).toBe('test search')
      expect(mockLogger.info).toHaveBeenCalledWith('Node search completed', expect.any(Object))
    })

    it('should handle search with attributes and filtering', async () => {
      const input: SearchNodesInput = {
        tableId: 'table-1',
        query: 'age > 25',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')
      const attribute = createTestAttribute('attr-1', 'table-1', 'age', 'Age', 'attr-type-1')
      const attributeType = createTestAttributeType('attr-type-1', 'number', 'number')

      mockTableRepository.findById = mock(async () => table as any)
      mockAttributeRepository.findByTableId = mock(async () => ({
        data: [attribute],
        metadata: {},
      }))
      mockAttributeRepository.getAttributeTypeForAttribute = mock(async () => attributeType as any)
      mockNodeSearchRepository.searchNodes = mock(async () => ({
        data: [],
        total: 0,
        hasMore: false,
        hasNextPage: false,
        hasPreviousPage: false,
      }))

      const result = await useCase.execute(input)

      expect(result.query.originalQuery).toBe('age > 25')
      expect(mockAttributeRepository.getAttributeTypeForAttribute).toHaveBeenCalled()
    })
  })

  describe('Pagination', () => {
    it('should apply custom limit and offset parameters', async () => {
      const input: SearchNodesInput = {
        tableId: 'table-1',
        limit: 50,
        offset: 100,
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = mock(async () => table as any)
      mockAttributeRepository.findByTableId = mock(async () => ({ data: [], metadata: {} }))
      mockNodeSearchRepository.searchNodes = mock(async (tableId, searchQuery) => {
        // Verify pagination parameters are passed correctly
        expect(searchQuery.limit).toBe(50)
        expect(searchQuery.offset).toBe(100)
        return {
          data: [],
          total: 200,
          hasMore: true,
          hasNextPage: true,
          hasPreviousPage: true,
        }
      })

      const result = await useCase.execute(input)

      expect(result.total).toBe(200)
      expect(result.hasMore).toBe(true)
      expect(result.hasNextPage).toBe(true)
      expect(result.hasPreviousPage).toBe(true)
    })

    it('should apply sort parameters', async () => {
      const input: SearchNodesInput = {
        tableId: 'table-1',
        sortBy: [
          { field: 'created_at', direction: 'desc' },
          { field: 'title', direction: 'asc' },
        ],
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = mock(async () => table as any)
      mockAttributeRepository.findByTableId = mock(async () => ({ data: [], metadata: {} }))
      mockNodeSearchRepository.searchNodes = mock(async (tableId, searchQuery) => {
        // Verify sort parameters are passed correctly
        expect(searchQuery.sortBy).toEqual([
          { field: 'created_at', direction: 'desc' },
          { field: 'title', direction: 'asc' },
        ])
        return {
          data: [],
          total: 0,
          hasMore: false,
          hasNextPage: false,
          hasPreviousPage: false,
        }
      })

      await useCase.execute(input)

      expect(mockNodeSearchRepository.searchNodes).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should log errors and rethrow when search fails', async () => {
      const input: SearchNodesInput = {
        tableId: 'table-1',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')
      const searchError = new Error('Database connection failed')

      mockTableRepository.findById = mock(async () => table as any)
      mockAttributeRepository.findByTableId = mock(async () => ({ data: [], metadata: {} }))
      mockNodeSearchRepository.searchNodes = mock(async () => {
        throw searchError
      })

      await expect(useCase.execute(input)).rejects.toThrow('Database connection failed')
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to search nodes',
        expect.objectContaining({
          input,
          error: 'Database connection failed',
        })
      )
    })
  })
})

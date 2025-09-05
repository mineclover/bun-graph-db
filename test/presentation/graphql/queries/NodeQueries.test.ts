import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { 
  createTestContext, 
  TestFramework, 
  type NodeDto, 
  type TableDto, 
  type PaginatedResult,
  type StandardMutationResult
} from '../../framework/TestFramework.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import type { Node } from '@/domain/entities/Node.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import { NodeQueries } from '@/presentation/graphql/queries/NodeQueries.js'
import { 
  createTestContext, 
  TestFramework
} from '../../../framework/TestFramework.js'
import type { NodeDto, PaginatedResult } from '../../../framework/core/GraphQLTypeMapper.js'

describe('NodeQueries', () => {
  let nodeQueries: NodeQueries
  let mockNodeRepository: jest.Mocked<INodeRepository>
  let mockSearchNodesUseCase: jest.Mocked<SearchNodesUseCase>
  let mockLogger: jest.Mocked<ILogger>
  const testContext = createTestContext('node-queries-test')

  // Use framework's mock Node factory
  const mockNode = TestFramework.TestMockManager.createMockNode({
    id: 'node-1',
    content: 'Test Node Content',
    tableId: 'table-1'
  })

  beforeEach(() => {
    // Use type-safe mock creation
    mockNodeRepository = testContext.mockManager.createNodeRepositoryMock({
      findById: () => Promise.resolve(mockNode),
      findByTableIdAndContent: () => Promise.resolve(mockNode),
      findAll: () => Promise.resolve({
        items: [mockNode],
        total: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        nodes: [mockNode],
        totalCount: 1
      }),
      searchByContent: () => Promise.resolve(TestFramework.TypeMapper.createPaginatedResult([mockNode], 1, false, false))
    })

    mockSearchNodesUseCase = testContext.mockManager.createTypedMock<SearchNodesUseCase>({
      execute: () => Promise.resolve({
        nodes: [mockNode],
        total: 1,
        hasNextPage: false,
        hasPreviousPage: false
      })
    })

    mockLogger = testContext.mockManager.createLoggerMock()

    nodeQueries = new NodeQueries(mockNodeRepository, mockSearchNodesUseCase, mockLogger)
  })

  describe('node query', () => {
    it('should fetch node by ID successfully', async () => {
      const result = await nodeQueries.node({}, { id: 'node-1' })

      expect(result).toBe(mockNode)
      expect(mockNodeRepository.findById).toHaveBeenCalledWith('node-1')
      expect(mockLogger.info).toHaveBeenCalledTimes(2)
      expect(mockLogger.info).toHaveBeenNthCalledWith(1, 'Executing query: findNodeById', { id: 'node-1' })
      expect(mockLogger.info).toHaveBeenNthCalledWith(2, 'Query completed: findNodeById', expect.objectContaining({
        duration: expect.stringMatching(/^\d+ms$/),
        id: 'node-1'
      }))
    })

    it('should handle node not found', async () => {
      mockNodeRepository.findById = mock(() => Promise.resolve(null))

      const result = await nodeQueries.node({}, { id: 'nonexistent' })

      expect(result).toBeNull()
      expect(mockLogger.info).toHaveBeenCalledTimes(2)
      expect(mockLogger.info).toHaveBeenNthCalledWith(1, 'Executing query: findNodeById', { id: 'nonexistent' })
      expect(mockLogger.info).toHaveBeenNthCalledWith(2, 'Query completed: findNodeById', expect.objectContaining({
        duration: expect.stringMatching(/^\d+ms$/),
        id: 'nonexistent'
      }))
    })

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed')
      mockNodeRepository.findById = mock(() => Promise.reject(dbError))

      await expect(nodeQueries.node({}, { id: 'node-1' })).rejects.toThrow(
        'Database connection failed'
      )
      expect(mockLogger.info).toHaveBeenCalledWith('Executing query: findNodeById', { id: 'node-1' })
      expect(mockLogger.error).toHaveBeenCalledWith('Query failed: findNodeById', {
        error: dbError,
        id: 'node-1',
      })
    })
  })

  describe('nodeByContent query', () => {
    it('should fetch node by content successfully', async () => {
      const result = await nodeQueries.nodeByContent(
        {},
        {
          content: 'Test Content',
          tableId: 'table-1',
        }
      )

      expect(result).toBe(mockNode)
      expect(mockNodeRepository.findByTableIdAndContent).toHaveBeenCalledWith(
        'table-1',
        'Test Content'
      )
      expect(mockLogger.info).toHaveBeenCalledTimes(2)
      expect(mockLogger.info).toHaveBeenNthCalledWith(1, 'Executing query: findNodeByContent', {
        content: 'Test Content',
        tableId: 'table-1',
      })
      expect(mockLogger.info).toHaveBeenNthCalledWith(2, 'Query completed: findNodeByContent', expect.objectContaining({
        duration: expect.stringMatching(/^\d+ms$/),
        content: 'Test Content',
        tableId: 'table-1'
      }))
    })

    it('should handle content not found', async () => {
      mockNodeRepository.findByTableIdAndContent = mock(() => Promise.resolve(null))

      const result = await nodeQueries.nodeByContent(
        {},
        {
          content: 'Nonexistent Content',
          tableId: 'table-1',
        }
      )

      expect(result).toBeNull()
      expect(mockLogger.info).toHaveBeenCalledTimes(2)
      expect(mockLogger.info).toHaveBeenNthCalledWith(1, 'Executing query: findNodeByContent', {
        content: 'Nonexistent Content',
        tableId: 'table-1',
      })
      expect(mockLogger.info).toHaveBeenNthCalledWith(2, 'Query completed: findNodeByContent', expect.objectContaining({
        duration: expect.stringMatching(/^\d+ms$/),
        content: 'Nonexistent Content',
        tableId: 'table-1'
      }))
    })

    it('should handle errors in content search', async () => {
      const searchError = new Error('Content search failed')
      mockNodeRepository.findByTableIdAndContent = mock(() => Promise.reject(searchError))

      await expect(
        nodeQueries.nodeByContent(
          {},
          {
            content: 'Test Content',
            tableId: 'table-1',
          }
        )
      ).rejects.toThrow('Content search failed')

      expect(mockLogger.info).toHaveBeenCalledWith('Executing query: findNodeByContent', {
        content: 'Test Content',
        tableId: 'table-1',
      })
      expect(mockLogger.error).toHaveBeenCalledWith('Query failed: findNodeByContent', {
        error: searchError,
        content: 'Test Content',
        tableId: 'table-1',
      })
    })
  })

  describe('nodes query', () => {
    it('should fetch nodes with pagination successfully', async () => {
      const args = {
        filter: { search: 'test' },
        pagination: { limit: 10, offset: 0 },
        sort: { field: 'createdAt', direction: 'DESC' as const },
      }

      const result = await nodeQueries.nodes({}, args)

      expect(result).toEqual({
        nodes: [mockNode] as NodeDto[],
        totalCount: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      })

      expect(mockNodeRepository.findAll).toHaveBeenCalledWith({
        filter: { search: 'test' },
        pagination: { limit: 10, offset: 0 },
        sort: { field: 'createdAt', direction: 'DESC' },
      })
      expect(mockLogger.info).toHaveBeenCalledTimes(2)
      expect(mockLogger.info).toHaveBeenNthCalledWith(1, 'Executing query: findAllNodes', { args })
      expect(mockLogger.info).toHaveBeenNthCalledWith(2, 'Query completed: findAllNodes', expect.objectContaining({
        duration: expect.stringMatching(/^\d+ms$/),
        args
      }))
    })

    it('should use default pagination when none provided', async () => {
      const result = await nodeQueries.nodes({}, {})

      expect(mockNodeRepository.findAll).toHaveBeenCalledWith({
        filter: undefined,
        pagination: { limit: 10, offset: 0 },
        sort: undefined,
      })
    })

    it('should handle repository errors during nodes fetch', async () => {
      const repoError = new Error('Repository query failed')
      mockNodeRepository.findAll = mock(() => Promise.reject(repoError))

      await expect(nodeQueries.nodes({}, {})).rejects.toThrow('Repository query failed')
      expect(mockLogger.info).toHaveBeenCalledWith('Executing query: findAllNodes', { args: {} })
      expect(mockLogger.error).toHaveBeenCalledWith('Query failed: findAllNodes', {
        error: repoError,
        args: {},
      })
    })
  })

  describe('searchNodes query', () => {
    it('should execute node search successfully', async () => {
      const searchArgs = {
        filter: { search: 'complex query' },
        pagination: { limit: 20, offset: 5 },
      }

      const result = await nodeQueries.searchNodes({}, searchArgs)

      expect(result).toEqual({
        nodes: [mockNode] as NodeDto[],
        totalCount: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      })

      expect(mockSearchNodesUseCase.execute).toHaveBeenCalledWith({
        filter: { search: 'complex query' },
        pagination: { limit: 20, offset: 5 },
        sort: undefined,
      })
      expect(mockLogger.info).toHaveBeenCalledTimes(2)
      expect(mockLogger.info).toHaveBeenNthCalledWith(1, 'Executing query: searchNodes', { args: searchArgs })
      expect(mockLogger.info).toHaveBeenNthCalledWith(2, 'Query completed: searchNodes', expect.objectContaining({
        duration: expect.stringMatching(/^\d+ms$/),
        args: searchArgs
      }))
    })

    it('should use default pagination for search when none provided', async () => {
      await nodeQueries.searchNodes({}, {})

      expect(mockSearchNodesUseCase.execute).toHaveBeenCalledWith({
        filter: undefined,
        pagination: { limit: 10, offset: 0 },
        sort: undefined,
      })
    })

    it('should handle search use case errors', async () => {
      const searchError = new Error('Search service unavailable')
      mockSearchNodesUseCase.execute = mock(() => Promise.reject(searchError))

      await expect(nodeQueries.searchNodes({}, { filter: { search: 'test' } })).rejects.toThrow(
        'Search service unavailable'
      )
      expect(mockLogger.info).toHaveBeenCalledWith('Executing query: searchNodes', {
        args: { filter: { search: 'test' } },
      })
      expect(mockLogger.error).toHaveBeenCalledWith('Query failed: searchNodes', {
        error: searchError,
        args: { filter: { search: 'test' } },
      })
    })
  })
})

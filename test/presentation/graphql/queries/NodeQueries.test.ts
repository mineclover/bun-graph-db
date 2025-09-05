import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import type { Node } from '@/domain/entities/Node.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import { NodeQueries } from '@/presentation/graphql/queries/NodeQueries.js'

describe('NodeQueries', () => {
  let nodeQueries: NodeQueries
  let mockNodeRepository: INodeRepository
  let mockSearchNodesUseCase: SearchNodesUseCase
  let mockLogger: ILogger

  const mockNode: Partial<Node> = {
    getId: () => 'node-1',
    getContent: () => 'Test Node Content',
    getTableId: () => 'table-1',
    getCreatedAt: () => new Date('2024-01-01'),
    getUpdatedAt: () => new Date('2024-01-01'),
  }

  beforeEach(() => {
    mockNodeRepository = {
      findById: mock(() => Promise.resolve(mockNode as Node)),
      searchByContent: mock(() => Promise.resolve({ items: [mockNode as Node], total: 1, hasNextPage: false, hasPreviousPage: false })),
      findAll: mock(() =>
        Promise.resolve({
          items: [mockNode as Node],
          total: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        })
      ),
    } as any

    mockSearchNodesUseCase = {
      execute: mock(() =>
        Promise.resolve({
          nodes: [mockNode as Node],
          total: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        })
      ),
    } as any

    mockLogger = {
      info: mock(() => {}),
      error: mock(() => {}),
      warn: mock(() => {}),
      debug: mock(() => {}),
    } as any

    nodeQueries = new NodeQueries(mockNodeRepository, mockSearchNodesUseCase, mockLogger)
  })

  describe('node query', () => {
    it('should fetch node by ID successfully', async () => {
      const result = await nodeQueries.node({}, { id: 'node-1' })

      expect(result).toBe(mockNode)
      expect(mockNodeRepository.findById).toHaveBeenCalledWith('node-1')
      expect(mockLogger.info).toHaveBeenCalledWith('Fetching node', { id: 'node-1' })
    })

    it('should handle node not found', async () => {
      mockNodeRepository.findById = mock(() => Promise.resolve(null))

      const result = await nodeQueries.node({}, { id: 'nonexistent' })

      expect(result).toBeNull()
      expect(mockLogger.info).toHaveBeenCalledWith('Fetching node', { id: 'nonexistent' })
    })

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed')
      mockNodeRepository.findById = mock(() => Promise.reject(dbError))

      await expect(nodeQueries.node({}, { id: 'node-1' })).rejects.toThrow(
        'Database connection failed'
      )
      expect(mockLogger.error).toHaveBeenCalledWith('Error fetching node', {
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
      expect(mockNodeRepository.searchByContent).toHaveBeenCalledWith('table-1', 'Test Content', undefined)
      expect(mockLogger.info).toHaveBeenCalledWith('Fetching node by content', {
        content: 'Test Content',
        tableId: 'table-1',
      })
    })

    it('should handle content not found', async () => {
      mockNodeRepository.searchByContent = mock(() => Promise.resolve({ items: [], total: 0, hasNextPage: false, hasPreviousPage: false }))

      const result = await nodeQueries.nodeByContent(
        {},
        {
          content: 'Nonexistent Content',
          tableId: 'table-1',
        }
      )

      expect(result).toBeNull()
    })

    it('should handle errors in content search', async () => {
      const searchError = new Error('Content search failed')
      mockNodeRepository.searchByContent = mock(() => Promise.reject(searchError))

      await expect(
        nodeQueries.nodeByContent(
          {},
          {
            content: 'Test Content',
            tableId: 'table-1',
          }
        )
      ).rejects.toThrow('Content search failed')

      expect(mockLogger.error).toHaveBeenCalledWith('Error fetching node by content', {
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
      expect(mockLogger.info).toHaveBeenCalledWith('Fetching nodes', { args })
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
      expect(mockLogger.error).toHaveBeenCalledWith('Error fetching nodes', {
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
      expect(mockLogger.info).toHaveBeenCalledWith('Searching nodes', { args: searchArgs })
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
      expect(mockLogger.error).toHaveBeenCalledWith('Error searching nodes', {
        error: searchError,
        args: { filter: { search: 'test' } },
      })
    })
  })
})

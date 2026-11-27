import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ILogger } from '@/application/ports/ILogger.js'
import {
  type IGraphRepository,
  type SearchRelatedNodesInput,
  SearchRelatedNodesUseCase,
} from '@/application/use-cases/relations/SearchRelatedNodes.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { RelationDirection } from '@/domain/value-objects/RelationQuery.js'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'
import { createTestNode, createTestTable } from './test-helpers.js'

describe('SearchRelatedNodesUseCase', () => {
  let useCase: SearchRelatedNodesUseCase
  let mockNodeRepository: INodeRepository
  let mockRelationRepository: INodeRelationRepository
  let mockGraphRepository: IGraphRepository
  let mockTableRepository: ITableRepository
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
    mockNodeRepository = {
      save: vi.fn(async (node) => node),
      findById: vi.fn(async () => null),
      findByTableId: vi.fn(async () => ({ data: [], metadata: {} })),
      findByTableIdAndContent: vi.fn(async () => null),
      delete: vi.fn(async () => {}),
      deleteByTableId: vi.fn(async () => {}),
      countByTableId: vi.fn(async () => 0),
      findAll: vi.fn(async () => ({ data: [], metadata: {} })),
      exists: vi.fn(async () => false),
      count: vi.fn(async () => 0),
      saveMany: vi.fn(async () => {}),
      findByIds: vi.fn(async () => []),
      update: vi.fn(async () => createTestNode()),
    } as unknown as INodeRepository

    mockRelationRepository = {
      save: vi.fn(async (relation) => relation),
      findById: vi.fn(async () => null),
      findByExternalIds: vi.fn(async () => null),
      findBySourceNodeIdAndRelationType: vi.fn(async () => []),
      findByTargetNodeIdAndRelationType: vi.fn(async () => []),
      exists: vi.fn(async () => false),
      update: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
      findAll: vi.fn(async () => ({ data: [], metadata: {} })),
      deleteByTableId: vi.fn(async () => {}),
      count: vi.fn(async () => 0),
      saveMany: vi.fn(async () => {}),
      findByIds: vi.fn(async () => []),
      deleteMany: vi.fn(async () => {}),
    } as unknown as INodeRelationRepository

    mockGraphRepository = {
      searchRelatedNodes: vi.fn(async () => ({
        data: [],
        total: 0,
        hasMore: false,
        hasNextPage: false,
        hasPreviousPage: false,
      })),
      findPathsBetweenNodes: vi.fn(async () => []),
      getDependencyChain: vi.fn(async () => []),
    }

    mockTableRepository = {
      save: vi.fn(async (table) => table),
      findById: vi.fn(async () => createTestTable('table-1', 'test-table')),
      findByIdentifier: vi.fn(async () => null),
      findAll: vi.fn(async () => ({ data: [], metadata: {} })),
      delete: vi.fn(async () => {}),
      exists: vi.fn(async () => false),
      count: vi.fn(async () => 0),
      saveMany: vi.fn(async () => {}),
      findByIds: vi.fn(async () => []),
      update: vi.fn(async () => createTestTable()),
    } as unknown as ITableRepository

    useCase = new SearchRelatedNodesUseCase(
      mockNodeRepository,
      mockRelationRepository,
      mockGraphRepository,
      mockTableRepository,
      mockLogger,
    )
  })

  describe('execute() - Input Validation', () => {
    it('should throw ValidationException when tableId is empty', async () => {
      const input: SearchRelatedNodesInput = {
        tableId: '',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Table ID is required')
    })

    it('should throw ValidationException when limit is less than 1', async () => {
      const input: SearchRelatedNodesInput = {
        tableId: 'table-1',
        limit: 0,
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Limit must be between 1 and 1000')
    })

    it('should throw ValidationException when limit is greater than 1000', async () => {
      const input: SearchRelatedNodesInput = {
        tableId: 'table-1',
        limit: 1001,
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Limit must be between 1 and 1000')
    })

    it('should throw ValidationException when offset is negative', async () => {
      const input: SearchRelatedNodesInput = {
        tableId: 'table-1',
        offset: -1,
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Offset must be non-negative')
    })

    it('should throw ValidationException when pathQuery maxDepth is less than 1', async () => {
      const input: SearchRelatedNodesInput = {
        tableId: 'table-1',
        pathQueries: [
          {
            startNodeIds: ['node-1'],
            endNodeIds: ['node-2'],
            maxDepth: 0,
          },
        ],
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Path query max depth must be at least 1')
    })
  })

  describe('execute() - Resource Validation', () => {
    it('should throw NotFoundException when table does not exist', async () => {
      const input: SearchRelatedNodesInput = {
        tableId: 'nonexistent-table',
      }

      mockTableRepository.findById = vi.fn(async () => null)

      await expect(useCase.execute(input)).rejects.toThrow(NotFoundException)
      await expect(useCase.execute(input)).rejects.toThrow("Table with id 'nonexistent-table' not found")
    })
  })

  describe('execute() - Successful Search', () => {
    it('should execute basic search without filters', async () => {
      const input: SearchRelatedNodesInput = {
        tableId: 'table-1',
      }

      const node = createTestNode('node-1', 'table-1', 'Test Node')

      mockGraphRepository.searchRelatedNodes = vi.fn(async () => ({
        data: [{ node, attributes: {} }],
        total: 1,
        hasMore: false,
        hasNextPage: false,
        hasPreviousPage: false,
      }))

      const result = await useCase.execute(input)

      expect(result.nodes).toBeDefined()
      expect(result.nodes.length).toBe(1)
      expect(result.total).toBe(1)
      expect(result.hasMore).toBe(false)
      expect(mockGraphRepository.searchRelatedNodes).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith('Searching related nodes', expect.any(Object))
    })

    it('should execute search with node filters', async () => {
      const input: SearchRelatedNodesInput = {
        tableId: 'table-1',
        nodeFilters: { type: 'user', status: 'active' },
      }

      const node = createTestNode('node-1', 'table-1', 'Filtered Node')

      mockGraphRepository.searchRelatedNodes = vi.fn(async (_tableId, graphQuery) => {
        expect(graphQuery.nodeFilters).toEqual({ type: 'user', status: 'active' })
        return {
          data: [{ node, attributes: {} }],
          total: 1,
          hasMore: false,
          hasNextPage: false,
          hasPreviousPage: false,
        }
      })

      const result = await useCase.execute(input)

      expect(result.nodes.length).toBe(1)
      expect(mockGraphRepository.searchRelatedNodes).toHaveBeenCalled()
    })

    it('should execute search with relation filters', async () => {
      const input: SearchRelatedNodesInput = {
        tableId: 'table-1',
        relationFilters: [
          {
            relationTypeIds: ['rel-type-1'],
            direction: RelationDirection.OUTGOING,
            minStrength: 50,
          },
        ],
      }

      mockGraphRepository.searchRelatedNodes = vi.fn(async (_tableId, graphQuery) => {
        expect(graphQuery.relationFilters).toBeDefined()
        expect(graphQuery.relationFilters?.[0].relationTypeIds).toEqual(['rel-type-1'])
        return {
          data: [],
          total: 0,
          hasMore: false,
          hasNextPage: false,
          hasPreviousPage: false,
        }
      })

      const result = await useCase.execute(input)

      expect(result.nodes).toBeDefined()
      expect(mockGraphRepository.searchRelatedNodes).toHaveBeenCalled()
    })

    it('should execute search with custom limit and offset', async () => {
      const input: SearchRelatedNodesInput = {
        tableId: 'table-1',
        limit: 50,
        offset: 100,
      }

      mockGraphRepository.searchRelatedNodes = vi.fn(async (_tableId, graphQuery) => {
        expect(graphQuery.limit).toBe(50)
        expect(graphQuery.offset).toBe(100)
        return {
          data: [],
          total: 150,
          hasMore: false,
          hasNextPage: false,
          hasPreviousPage: true,
        }
      })

      const result = await useCase.execute(input)

      expect(result.total).toBe(150)
      expect(result.hasPreviousPage).toBe(true)
      expect(mockGraphRepository.searchRelatedNodes).toHaveBeenCalled()
    })

    it('should execute search with source node IDs', async () => {
      const input: SearchRelatedNodesInput = {
        tableId: 'table-1',
        sourceNodeIds: ['node-1', 'node-2'],
      }

      const result = await useCase.execute(input)

      expect(result.nodes).toBeDefined()
      expect(mockGraphRepository.searchRelatedNodes).toHaveBeenCalled()
    })

    it('should return relations data along with nodes', async () => {
      const input: SearchRelatedNodesInput = {
        tableId: 'table-1',
      }

      const node = createTestNode('node-1', 'table-1', 'Test Node')

      mockGraphRepository.searchRelatedNodes = vi.fn(async () => ({
        data: [
          {
            node,
            attributes: {},
            sourceNodeId: 'node-1',
            targetNodeId: 'node-2',
            relationTypeId: 'rel-type-1',
            properties: { weight: 10 },
            strength: 4,
          },
        ],
        total: 1,
        hasMore: false,
        hasNextPage: false,
        hasPreviousPage: false,
      }))

      const result = await useCase.execute(input)

      expect(result.relations).toBeDefined()
      expect(result.relations.length).toBe(1)
      expect(result.relations[0].sourceNodeId).toBe('node-1')
      expect(result.relations[0].targetNodeId).toBe('node-2')
      expect(result.relations[0].relationTypeId).toBe('rel-type-1')
      expect(result.relations[0].properties).toEqual({ weight: 10 })
      expect(result.relations[0].strength).toBe(4)
    })
  })

  describe('execute() - Path Finding', () => {
    it('should find paths between nodes when pathQueries are provided', async () => {
      const input: SearchRelatedNodesInput = {
        tableId: 'table-1',
        pathQueries: [
          {
            startNodeIds: ['node-1'],
            endNodeIds: ['node-3'],
            maxDepth: 3,
          },
        ],
      }

      mockGraphRepository.searchRelatedNodes = vi.fn(async () => ({
        data: [],
        total: 0,
        hasMore: false,
        hasNextPage: false,
        hasPreviousPage: false,
      }))

      mockGraphRepository.findPathsBetweenNodes = vi.fn(async () => [
        {
          startNodeId: 'node-1',
          endNodeId: 'node-3',
          path: ['node-1', 'node-2', 'node-3'],
          length: 3,
        },
      ])

      const result = await useCase.execute(input)

      expect(result.paths).toBeDefined()
      expect(result.paths?.length).toBe(1)
      expect(result.paths?.[0].startNodeId).toBe('node-1')
      expect(result.paths?.[0].endNodeId).toBe('node-3')
      expect(result.paths?.[0].path).toEqual(['node-1', 'node-2', 'node-3'])
      expect(result.paths?.[0].length).toBe(3)
      expect(mockGraphRepository.findPathsBetweenNodes).toHaveBeenCalledWith(
        'table-1',
        ['node-1'],
        ['node-3'],
        3,
        undefined,
      )
    })

    it('should find paths with relationTypes filter', async () => {
      const input: SearchRelatedNodesInput = {
        tableId: 'table-1',
        pathQueries: [
          {
            startNodeIds: ['node-1'],
            endNodeIds: ['node-3'],
            maxDepth: 5,
            relationTypes: ['depends-on', 'requires'],
          },
        ],
      }

      mockGraphRepository.findPathsBetweenNodes = vi.fn(
        async (_tableId, _startIds, _endIds, _maxDepth, relationTypes) => {
          expect(relationTypes).toEqual(['depends-on', 'requires'])
          return []
        },
      )

      await useCase.execute(input)

      expect(mockGraphRepository.findPathsBetweenNodes).toHaveBeenCalled()
    })
  })

  describe('execute() - Error Handling', () => {
    it('should log errors and rethrow when graph search fails', async () => {
      const input: SearchRelatedNodesInput = {
        tableId: 'table-1',
      }

      const searchError = new Error('Graph database connection failed')

      mockGraphRepository.searchRelatedNodes = vi.fn(async () => {
        throw searchError
      })

      await expect(useCase.execute(input)).rejects.toThrow('Graph database connection failed')
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to search related nodes',
        expect.objectContaining({
          error: 'Graph database connection failed',
        }),
      )
    })
  })

  describe('getDependencies() - Input Validation', () => {
    it('should throw ValidationException when tableId is empty', async () => {
      await expect(useCase.getDependencies('', 'node-1')).rejects.toThrow(ValidationException)
      await expect(useCase.getDependencies('', 'node-1')).rejects.toThrow('Table ID is required')
    })

    it('should throw ValidationException when nodeId is empty', async () => {
      await expect(useCase.getDependencies('table-1', '')).rejects.toThrow(ValidationException)
      await expect(useCase.getDependencies('table-1', '')).rejects.toThrow('Node ID is required')
    })

    it('should throw NotFoundException when table does not exist', async () => {
      mockTableRepository.findById = vi.fn(async () => null)

      await expect(useCase.getDependencies('nonexistent-table', 'node-1')).rejects.toThrow(NotFoundException)
      await expect(useCase.getDependencies('nonexistent-table', 'node-1')).rejects.toThrow(
        "Table with id 'nonexistent-table' not found",
      )
    })
  })

  describe('getDependencies() - Successful Retrieval', () => {
    it('should get incoming dependencies', async () => {
      mockGraphRepository.getDependencyChain = vi.fn(async (_tableId, _nodeId, direction) => {
        expect(direction).toBe(RelationDirection.INCOMING)
        return [
          { nodeId: 'node-1', level: 0, relationPath: [] },
          { nodeId: 'node-2', level: 1, relationPath: ['depends-on'] },
        ]
      })

      const result = await useCase.getDependencies('table-1', 'node-1', RelationDirection.INCOMING)

      expect(result).toBeDefined()
      expect(result.length).toBe(2)
      expect(result[0].nodeId).toBe('node-1')
      expect(result[1].nodeId).toBe('node-2')
      expect(mockGraphRepository.getDependencyChain).toHaveBeenCalled()
    })

    it('should get outgoing dependencies', async () => {
      mockGraphRepository.getDependencyChain = vi.fn(async (_tableId, _nodeId, direction) => {
        expect(direction).toBe(RelationDirection.OUTGOING)
        return [
          { nodeId: 'node-1', level: 0, relationPath: [] },
          { nodeId: 'node-3', level: 1, relationPath: ['requires'] },
        ]
      })

      const result = await useCase.getDependencies('table-1', 'node-1', RelationDirection.OUTGOING)

      expect(result).toBeDefined()
      expect(result.length).toBe(2)
      expect(mockGraphRepository.getDependencyChain).toHaveBeenCalled()
    })

    it('should get dependencies with relationTypes filter', async () => {
      mockGraphRepository.getDependencyChain = vi.fn(async (_tableId, _nodeId, _direction, relationTypes) => {
        expect(relationTypes).toEqual(['depends-on', 'requires'])
        return []
      })

      await useCase.getDependencies('table-1', 'node-1', RelationDirection.INCOMING, ['depends-on', 'requires'])

      expect(mockGraphRepository.getDependencyChain).toHaveBeenCalledWith(
        'table-1',
        'node-1',
        RelationDirection.INCOMING,
        ['depends-on', 'requires'],
      )
    })
  })

  describe('getDependencies() - Error Handling', () => {
    it('should log errors and rethrow when dependency retrieval fails', async () => {
      const depError = new Error('Dependency chain query failed')

      mockGraphRepository.getDependencyChain = vi.fn(async () => {
        throw depError
      })

      await expect(useCase.getDependencies('table-1', 'node-1')).rejects.toThrow('Dependency chain query failed')
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get dependencies',
        expect.objectContaining({
          error: 'Dependency chain query failed',
        }),
      )
    })
  })
})

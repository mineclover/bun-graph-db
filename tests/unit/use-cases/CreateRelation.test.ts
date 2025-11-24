import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { CreateRelationUseCase, type CreateRelationInput } from '@/application/use-cases/relations/CreateRelation.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { NodeRelation } from '@/domain/entities/NodeRelation.js'
import { ValidationException, NotFoundException, ConflictException } from '@/shared/exceptions/DomainException.js'
import { createTestTable, createTestNode, createTestRelationType, createTestNodeRelation } from './test-helpers.js'

describe('CreateRelationUseCase', () => {
  let useCase: CreateRelationUseCase
  let mockNodeRelationRepository: INodeRelationRepository
  let mockRelationTypeRepository: IRelationTypeRepository
  let mockNodeRepository: INodeRepository
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
    mockNodeRelationRepository = {
      save: mock(async (relation: NodeRelation) => relation),
      findById: mock(async () => null),
      findByExternalIds: mock(async () => null),
      findBySourceNodeIdAndRelationType: mock(async () => []),
      findByTargetNodeIdAndRelationType: mock(async () => []),
      exists: mock(async () => false),
      update: mock(async (relation: NodeRelation) => relation),
      delete: mock(async () => {}),
      findAll: mock(async () => ({ data: [], metadata: {} })),
    } as any

    mockRelationTypeRepository = {
      save: mock(async (relationType: RelationType) => relationType),
      findById: mock(async () => null),
      findByIdentifier: mock(async () => null),
      update: mock(async (relationType: RelationType) => relationType),
      delete: mock(async () => {}),
      findAll: mock(async () => ({ data: [], metadata: {} })),
    } as any

    mockNodeRepository = {
      save: mock(async (node: Node) => node),
      findById: mock(async () => null),
      findByTableIdAndContent: mock(async () => null),
      findByTableId: mock(async () => ({ data: [], metadata: {} })),
      update: mock(async (node: Node) => node),
      delete: mock(async () => {}),
      findAll: mock(async () => ({ data: [], metadata: {} })),
    } as any

    mockTableRepository = {
      save: mock(async (table: Table) => table),
      findById: mock(async () => null),
      findByIdentifier: mock(async () => null),
      update: mock(async (table: Table) => table),
      delete: mock(async () => {}),
      findAll: mock(async () => ({ data: [], metadata: {} })),
    } as any

    useCase = new CreateRelationUseCase(
      mockNodeRelationRepository,
      mockRelationTypeRepository,
      mockNodeRepository,
      mockTableRepository,
      mockLogger
    )
  })

  describe('Input Validation', () => {
    it('should throw ValidationException when tableId is empty', async () => {
      const input: CreateRelationInput = {
        tableId: '',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        relationTypeId: 'rel-type-1',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Table ID is required')
    })

    it('should throw ValidationException when relationTypeId is empty', async () => {
      const input: CreateRelationInput = {
        tableId: 'table-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        relationTypeId: '',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Relation type ID is required')
    })

    it('should throw ValidationException when both sourceNodeId and sourceExternalId are missing', async () => {
      const input: CreateRelationInput = {
        tableId: 'table-1',
        sourceNodeId: null,
        sourceExternalId: undefined,
        targetNodeId: 'node-2',
        relationTypeId: 'rel-type-1',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Either source node ID or source external ID is required')
    })

    it('should throw ValidationException when both targetNodeId and targetExternalId are missing', async () => {
      const input: CreateRelationInput = {
        tableId: 'table-1',
        sourceNodeId: 'node-1',
        targetNodeId: null,
        targetExternalId: undefined,
        relationTypeId: 'rel-type-1',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Either target node ID or target external ID is required')
    })

    it('should throw ValidationException when strength is not an integer', async () => {
      const input: CreateRelationInput = {
        tableId: 'table-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        relationTypeId: 'rel-type-1',
        strength: 50.5,
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Strength must be an integer between 0 and 100')
    })

    it('should throw ValidationException when strength is negative', async () => {
      const input: CreateRelationInput = {
        tableId: 'table-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        relationTypeId: 'rel-type-1',
        strength: -1,
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Strength must be an integer between 0 and 100')
    })

    it('should throw ValidationException when strength is greater than 100', async () => {
      const input: CreateRelationInput = {
        tableId: 'table-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        relationTypeId: 'rel-type-1',
        strength: 101,
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Strength must be an integer between 0 and 100')
    })
  })

  describe('Table and RelationType Validation', () => {
    it('should throw NotFoundException when table does not exist', async () => {
      const input: CreateRelationInput = {
        tableId: 'non-existent-table',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        relationTypeId: 'rel-type-1',
      }

      mockTableRepository.findById = mock(async () => null)

      await expect(useCase.execute(input)).rejects.toThrow(NotFoundException)
      await expect(useCase.execute(input)).rejects.toThrow('Table with id \'non-existent-table\' not found')
    })

    it('should throw NotFoundException when relation type does not exist', async () => {
      const input: CreateRelationInput = {
        tableId: 'table-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        relationTypeId: 'non-existent-rel-type',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = mock(async () => table as any)
      mockRelationTypeRepository.findById = mock(async () => null)

      await expect(useCase.execute(input)).rejects.toThrow(NotFoundException)
      await expect(useCase.execute(input)).rejects.toThrow('RelationType with id \'non-existent-rel-type\' not found')
    })
  })

  describe('Node Resolution', () => {
    it('should throw NotFoundException when source node does not exist', async () => {
      const input: CreateRelationInput = {
        tableId: 'table-1',
        sourceNodeId: 'non-existent-node',
        targetNodeId: 'node-2',
        relationTypeId: 'rel-type-1',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      const relationType = createTestRelationType('rel-type-1', 'depends-on', 'Depends On')

      mockTableRepository.findById = mock(async () => table as any)
      mockRelationTypeRepository.findById = mock(async () => relationType as any)
      mockNodeRepository.findById = mock(async () => null)

      await expect(useCase.execute(input)).rejects.toThrow(NotFoundException)
      await expect(useCase.execute(input)).rejects.toThrow('Source node with id \'non-existent-node\' not found')
    })

    it('should throw NotFoundException when target node does not exist', async () => {
      const input: CreateRelationInput = {
        tableId: 'table-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'non-existent-node',
        relationTypeId: 'rel-type-1',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      const relationType = createTestRelationType('rel-type-1', 'depends-on', 'Depends On')

      const sourceNode = createTestNode('node-1', 'table-1', 'Source Node')

      mockTableRepository.findById = mock(async () => table as any)
      mockRelationTypeRepository.findById = mock(async () => relationType as any)
      mockNodeRepository.findById = mock()
        .mockResolvedValueOnce(sourceNode)
        .mockResolvedValueOnce(null)

      const promise = useCase.execute(input)
      await expect(promise).rejects.toThrow(NotFoundException)
      await expect(promise).rejects.toThrow('Target node with id \'non-existent-node\' not found')
    })

    it('should throw ValidationException when source and target are the same internal node', async () => {
      const input: CreateRelationInput = {
        tableId: 'table-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-1',
        relationTypeId: 'rel-type-1',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      const relationType = createTestRelationType('rel-type-1', 'depends-on', 'Depends On')

      const node = createTestNode('node-1', 'table-1', 'Test Node')

      mockTableRepository.findById = mock(async () => table as any)
      mockRelationTypeRepository.findById = mock(async () => relationType as any)
      mockNodeRepository.findById = mock(async () => node)

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Source and target cannot be the same')
    })

    it('should throw ValidationException when source and target are the same external ID', async () => {
      const input: CreateRelationInput = {
        tableId: 'table-1',
        sourceExternalId: 'external-node',
        targetExternalId: 'external-node',
        relationTypeId: 'rel-type-1',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      const relationType = createTestRelationType('rel-type-1', 'depends-on', 'Depends On')

      mockTableRepository.findById = mock(async () => table as any)
      mockRelationTypeRepository.findById = mock(async () => relationType as any)
      mockNodeRepository.findByTableIdAndContent = mock(async () => null)

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Source and target cannot be the same')
    })
  })

  describe('Duplicate Relation Validation', () => {
    it('should throw ConflictException when internal-to-internal relation already exists', async () => {
      const input: CreateRelationInput = {
        tableId: 'table-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        relationTypeId: 'rel-type-1',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      const relationType = createTestRelationType('rel-type-1', 'depends-on', 'Depends On')

      const sourceNode = createTestNode('node-1', 'table-1', 'Source Node')

      const targetNode = createTestNode('node-2', 'table-1', 'Target Node')

      const existingRelation = createTestNodeRelation(
        'relation-existing',
        'table-1',
        'node-1',
        'internal',
        'node-2',
        'internal',
        'rel-type-1'
      )

      mockTableRepository.findById = mock(async () => table as any)
      mockRelationTypeRepository.findById = mock(async () => relationType as any)
      mockNodeRepository.findById = mock()
        .mockResolvedValueOnce(sourceNode)
        .mockResolvedValueOnce(targetNode)
      mockNodeRelationRepository.findBySourceNodeIdAndRelationType = mock(async () => [existingRelation])

      const promise = useCase.execute(input)
      await expect(promise).rejects.toThrow(ConflictException)
      await expect(promise).rejects.toThrow('Relation of type \'depends-on\' already exists between \'node:node-1\' and \'node:node-2\'')
    })

    it('should throw ConflictException when external relation already exists', async () => {
      const input: CreateRelationInput = {
        tableId: 'table-1',
        sourceExternalId: 'external-source',
        targetExternalId: 'external-target',
        relationTypeId: 'rel-type-1',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      const relationType = createTestRelationType('rel-type-1', 'depends-on', 'Depends On')

      mockTableRepository.findById = mock(async () => table as any)
      mockRelationTypeRepository.findById = mock(async () => relationType as any)
      mockNodeRepository.findByTableIdAndContent = mock(async () => null)
      mockNodeRelationRepository.exists = mock(async () => true)

      await expect(useCase.execute(input)).rejects.toThrow(ConflictException)
      await expect(useCase.execute(input)).rejects.toThrow('Relation of type \'depends-on\' already exists between \'external-source\' and \'external-target\'')
    })
  })

  describe('Successful Relation Creation', () => {
    it('should create a relation with internal nodes', async () => {
      const input: CreateRelationInput = {
        tableId: 'table-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        relationTypeId: 'rel-type-1',
        strength: 80,
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      const relationType = createTestRelationType('rel-type-1', 'depends-on', 'Depends On')

      const sourceNode = createTestNode('node-1', 'table-1', 'Source Node')

      const targetNode = createTestNode('node-2', 'table-1', 'Target Node')

      mockTableRepository.findById = mock(async () => table as any)
      mockRelationTypeRepository.findById = mock(async () => relationType as any)
      mockNodeRepository.findById = mock()
        .mockResolvedValueOnce(sourceNode)
        .mockResolvedValueOnce(targetNode)
      mockNodeRelationRepository.findBySourceNodeIdAndRelationType = mock(async () => [])
      mockNodeRelationRepository.findByExternalIds = mock(async () =>
        createTestNodeRelation('relation-1', 'table-1', 'node-1', 'internal', 'node-2', 'internal', 'rel-type-1', null, 80)
      )

      const result = await useCase.execute(input)

      expect(result.relation).toBeDefined()
      expect(result.relation.id).toBe('relation-1')
      expect(result.relation.sourceNodeId).toBe('node-1')
      expect(result.relation.targetNodeId).toBe('node-2')
      expect(result.relation.strength).toBe(80)
      expect(mockNodeRelationRepository.save).toHaveBeenCalled()
    })

    it('should create a relation with external IDs', async () => {
      const input: CreateRelationInput = {
        tableId: 'table-1',
        sourceExternalId: 'external-source',
        targetExternalId: 'external-target',
        relationTypeId: 'rel-type-1',
        properties: { key: 'value' },
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      const relationType = createTestRelationType('rel-type-1', 'depends-on', 'Depends On')

      mockTableRepository.findById = mock(async () => table as any)
      mockRelationTypeRepository.findById = mock(async () => relationType as any)
      mockNodeRepository.findByTableIdAndContent = mock(async () => null)
      mockNodeRelationRepository.exists = mock(async () => false)
      mockNodeRelationRepository.findByExternalIds = mock(async () =>
        createTestNodeRelation(
          'relation-1',
          'table-1',
          null,
          'external-source',
          null,
          'external-target',
          'rel-type-1',
          { key: 'value' }
        )
      )

      const result = await useCase.execute(input)

      expect(result.relation).toBeDefined()
      expect(result.relation.id).toBe('relation-1')
      expect(result.relation.sourceExternalId).toBe('external-source')
      expect(result.relation.targetExternalId).toBe('external-target')
      expect(result.relation.properties).toEqual({ key: 'value' })
    })

    it('should convert external ID to internal when node exists', async () => {
      const input: CreateRelationInput = {
        tableId: 'table-1',
        sourceExternalId: 'Source Node Content',
        targetExternalId: 'Target Node Content',
        relationTypeId: 'rel-type-1',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      const relationType = createTestRelationType('rel-type-1', 'depends-on', 'Depends On')

      const sourceNode = createTestNode('node-1', 'table-1', 'Source Node Content')

      const targetNode = createTestNode('node-2', 'table-1', 'Target Node Content')

      mockTableRepository.findById = mock(async () => table as any)
      mockRelationTypeRepository.findById = mock(async () => relationType as any)
      mockNodeRepository.findByTableIdAndContent = mock()
        .mockResolvedValueOnce(sourceNode)
        .mockResolvedValueOnce(targetNode)
      mockNodeRelationRepository.findBySourceNodeIdAndRelationType = mock(async () => [])
      mockNodeRelationRepository.findByExternalIds = mock(async () =>
        createTestNodeRelation('relation-1', 'table-1', 'node-1', 'internal', 'node-2', 'internal', 'rel-type-1')
      )

      const result = await useCase.execute(input)

      expect(result.relation).toBeDefined()
      expect(result.relation.sourceNodeId).toBe('node-1')
      expect(result.relation.targetNodeId).toBe('node-2')
      expect(result.relation.sourceExternalId).toBe('internal')
      expect(result.relation.targetExternalId).toBe('internal')
    })
  })

  describe('Error Handling', () => {
    it('should log errors and rethrow when save fails', async () => {
      const input: CreateRelationInput = {
        tableId: 'table-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        relationTypeId: 'rel-type-1',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      const relationType = createTestRelationType('rel-type-1', 'depends-on', 'Depends On')

      const sourceNode = createTestNode('node-1', 'table-1', 'Source Node')

      const targetNode = createTestNode('node-2', 'table-1', 'Target Node')

      const saveError = new Error('Database connection failed')

      mockTableRepository.findById = mock(async () => table as any)
      mockRelationTypeRepository.findById = mock(async () => relationType as any)
      mockNodeRepository.findById = mock()
        .mockResolvedValueOnce(sourceNode)
        .mockResolvedValueOnce(targetNode)
      mockNodeRelationRepository.findBySourceNodeIdAndRelationType = mock(async () => [])
      mockNodeRelationRepository.save = mock(async () => {
        throw saveError
      })

      await expect(useCase.execute(input)).rejects.toThrow('Database connection failed')
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create node relation', expect.objectContaining({
        input,
        error: 'Database connection failed',
      }))
    })

    it('should throw error when saved relation cannot be retrieved', async () => {
      const input: CreateRelationInput = {
        tableId: 'table-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        relationTypeId: 'rel-type-1',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      const relationType = createTestRelationType('rel-type-1', 'depends-on', 'Depends On')

      const sourceNode = createTestNode('node-1', 'table-1', 'Source Node')

      const targetNode = createTestNode('node-2', 'table-1', 'Target Node')

      mockTableRepository.findById = mock(async () => table as any)
      mockRelationTypeRepository.findById = mock(async () => relationType as any)
      mockNodeRepository.findById = mock()
        .mockResolvedValueOnce(sourceNode)
        .mockResolvedValueOnce(targetNode)
      mockNodeRelationRepository.findBySourceNodeIdAndRelationType = mock(async () => [])
      mockNodeRelationRepository.findByExternalIds = mock(async () => null)

      await expect(useCase.execute(input)).rejects.toThrow('Failed to retrieve saved node relation')
    })
  })

  describe('Logging', () => {
    it('should log relation creation start and success', async () => {
      const input: CreateRelationInput = {
        tableId: 'table-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        relationTypeId: 'rel-type-1',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      const relationType = createTestRelationType('rel-type-1', 'depends-on', 'Depends On')

      const sourceNode = createTestNode('node-1', 'table-1', 'Source Node')

      const targetNode = createTestNode('node-2', 'table-1', 'Target Node')

      mockTableRepository.findById = mock(async () => table as any)
      mockRelationTypeRepository.findById = mock(async () => relationType as any)
      mockNodeRepository.findById = mock()
        .mockResolvedValueOnce(sourceNode)
        .mockResolvedValueOnce(targetNode)
      mockNodeRelationRepository.findBySourceNodeIdAndRelationType = mock(async () => [])
      mockNodeRelationRepository.findByExternalIds = mock(async () =>
        createTestNodeRelation('relation-1', 'table-1', 'node-1', 'internal', 'node-2', 'internal', 'rel-type-1')
      )

      await useCase.execute(input)

      expect(mockLogger.info).toHaveBeenCalledWith('Creating new node relation', expect.objectContaining({
        tableId: 'table-1',
        sourceNodeId: 'node-1',
        targetNodeId: 'node-2',
        relationTypeId: 'rel-type-1',
      }))
      expect(mockLogger.info).toHaveBeenCalledWith('Node relation created successfully', expect.objectContaining({
        id: 'relation-1',
      }))
    })
  })
})

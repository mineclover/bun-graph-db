import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { CreateNodeInput } from '@/application/dtos/NodeDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import type { Node } from '@/domain/entities/Node.js'
import type { NodeAttribute } from '@/domain/entities/NodeAttribute.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '@/shared/exceptions/DomainException.js'
import { createTestAttribute, createTestNode, createTestTable } from './test-helpers.js'

describe('CreateNodeUseCase', () => {
  let useCase: CreateNodeUseCase
  let mockNodeRepository: INodeRepository
  let mockNodeAttributeRepository: INodeAttributeRepository
  let mockTableRepository: ITableRepository
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
    mockNodeRepository = {
      save: mock(async (node: Node) => node),
      findById: mock(async () => null),
      findByTableIdAndContent: mock(async () => null),
      findByTableId: mock(async () => ({ data: [], metadata: {} })),
      update: mock(async (node: Node) => node),
      delete: mock(async () => {}),
      findAll: mock(async () => ({ data: [], metadata: {} })),
    } as any

    mockNodeAttributeRepository = {
      save: mock(async (attr: NodeAttribute) => attr),
      findByNodeId: mock(async () => []),
      findById: mock(async () => null),
      update: mock(async (attr: NodeAttribute) => attr),
      delete: mock(async () => {}),
    } as any

    mockTableRepository = {
      findById: mock(async () => null),
      findByIdentifier: mock(async () => null),
      save: mock(async (table: Table) => table),
      update: mock(async (table: Table) => table),
      delete: mock(async () => {}),
      findAll: mock(async () => ({ data: [], metadata: {} })),
    } as any

    mockAttributeRepository = {
      findById: mock(async () => null),
      findByTableId: mock(async () => ({ data: [], metadata: {} })),
      save: mock(async (attr: Attribute) => attr),
      update: mock(async (attr: Attribute) => attr),
      delete: mock(async () => {}),
      findAll: mock(async () => ({ data: [], metadata: {} })),
    } as any

    useCase = new CreateNodeUseCase(
      mockNodeRepository,
      mockNodeAttributeRepository,
      mockTableRepository,
      mockAttributeRepository,
      mockLogger
    )
  })

  describe('Input Validation', () => {
    it('should throw ValidationException when tableId is empty', async () => {
      const input: CreateNodeInput = {
        tableId: '',
        content: 'Test Content',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Table ID is required')
    })

    it('should throw ValidationException when tableId is only whitespace', async () => {
      const input: CreateNodeInput = {
        tableId: '   ',
        content: 'Test Content',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Table ID is required')
    })

    it('should throw ValidationException when content is empty', async () => {
      const input: CreateNodeInput = {
        tableId: 'table-1',
        content: '',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Node content is required')
    })

    it('should throw ValidationException when content is only whitespace', async () => {
      const input: CreateNodeInput = {
        tableId: 'table-1',
        content: '   ',
      }

      await expect(useCase.execute(input)).rejects.toThrow(ValidationException)
      await expect(useCase.execute(input)).rejects.toThrow('Node content is required')
    })
  })

  describe('Table Validation', () => {
    it('should throw NotFoundException when table does not exist', async () => {
      const input: CreateNodeInput = {
        tableId: 'non-existent-table',
        content: 'Test Content',
      }

      mockTableRepository.findById = mock(async () => null)

      await expect(useCase.execute(input)).rejects.toThrow(NotFoundException)
      await expect(useCase.execute(input)).rejects.toThrow(
        "Table with id 'non-existent-table' not found"
      )
      expect(mockTableRepository.findById).toHaveBeenCalledWith('non-existent-table')
    })
  })

  describe('Duplicate Content Validation', () => {
    it('should throw ConflictException when node with same content already exists', async () => {
      const input: CreateNodeInput = {
        tableId: 'table-1',
        content: 'Duplicate Content',
      }

      const existingTable = createTestTable('table-1', 'test-table', 'Test Table')
      const existingNode = createTestNode('node-1', 'table-1', 'Duplicate Content')

      mockTableRepository.findById = mock(async () => existingTable as any)
      mockNodeRepository.findByTableIdAndContent = mock(async () => existingNode)

      await expect(useCase.execute(input)).rejects.toThrow(ConflictException)
      await expect(useCase.execute(input)).rejects.toThrow(
        "Node with content 'Duplicate Content' already exists in table 'test-table'"
      )
    })
  })

  describe('Successful Node Creation', () => {
    it('should create a node successfully with basic information', async () => {
      const input: CreateNodeInput = {
        tableId: 'table-1',
        content: 'Test Content',
        title: 'Test Title',
        description: 'Test Description',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')
      const createdNode = createTestNode(
        'node-1',
        'table-1',
        'Test Content',
        'Test Title',
        'Test Description'
      )

      mockTableRepository.findById = mock(async () => table as any)
      mockNodeRepository.findByTableIdAndContent = mock()
        .mockResolvedValueOnce(null) // First call for duplicate check
        .mockResolvedValueOnce(createdNode) // Second call after save

      const result = await useCase.execute(input)

      expect(result.node).toBeDefined()
      expect(result.node.content).toBe('Test Content')
      expect(result.node.title).toBe('Test Title')
      expect(result.node.description).toBe('Test Description')
      expect(mockNodeRepository.save).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith('Creating new node', {
        tableId: input.tableId,
        content: input.content,
      })
    })

    it('should create a node with attributes', async () => {
      const input: CreateNodeInput = {
        tableId: 'table-1',
        content: 'Test Content',
        attributes: {
          test_attr: 'test-value',
          number_attr: 42,
        },
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')
      const createdNode = createTestNode('node-1', 'table-1', 'Test Content')
      const testAttribute = createTestAttribute(
        'attr-1',
        'table-1',
        'test_attr',
        'Test Attribute',
        '1'
      )
      const numberAttribute = createTestAttribute(
        'attr-2',
        'table-1',
        'number_attr',
        'Number Attribute',
        '1'
      )

      mockTableRepository.findById = mock(async () => table as any)
      mockNodeRepository.findByTableIdAndContent = mock()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdNode)
      mockAttributeRepository.findByTableId = mock(async () => ({
        data: [testAttribute, numberAttribute],
        metadata: {},
      }))

      const result = await useCase.execute(input)

      expect(result.node).toBeDefined()
      expect(result.node.content).toBe('Test Content')
      expect(mockNodeAttributeRepository.save).toHaveBeenCalledTimes(2)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Node created successfully',
        expect.objectContaining({
          id: 'node-1',
          content: 'Test Content',
          attributeCount: 2,
        })
      )
    })

    it('should skip attributes that do not exist', async () => {
      const input: CreateNodeInput = {
        tableId: 'table-1',
        content: 'Test Content',
        attributes: {
          'non-existent-attr': 'value',
        },
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')
      const createdNode = createTestNode('node-1', 'table-1', 'Test Content')

      mockTableRepository.findById = mock(async () => table as any)
      mockNodeRepository.findByTableIdAndContent = mock()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdNode)
      mockAttributeRepository.findByTableId = mock(async () => ({
        data: [],
        metadata: {},
      }))

      const result = await useCase.execute(input)

      expect(result.node).toBeDefined()
      expect(mockNodeAttributeRepository.save).not.toHaveBeenCalled()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Attribute 'non-existent-attr' not found for table, skipping"
      )
    })
  })

  describe('Error Handling', () => {
    it('should log errors and rethrow when save fails', async () => {
      const input: CreateNodeInput = {
        tableId: 'table-1',
        content: 'Test Content',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')
      const saveError = new Error('Database connection failed')

      mockTableRepository.findById = mock(async () => table as any)
      mockNodeRepository.findByTableIdAndContent = mock(async () => null)
      mockNodeRepository.save = mock(async () => {
        throw saveError
      })

      await expect(useCase.execute(input)).rejects.toThrow('Database connection failed')
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create node',
        expect.objectContaining({
          content: input.content,
          tableId: input.tableId,
          error: 'Database connection failed',
        })
      )
    })

    it('should throw error when saved node cannot be retrieved', async () => {
      const input: CreateNodeInput = {
        tableId: 'table-1',
        content: 'Test Content',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = mock(async () => table as any)
      mockNodeRepository.findByTableIdAndContent = mock()
        .mockResolvedValueOnce(null) // First call for duplicate check
        .mockResolvedValueOnce(null) // Second call after save fails to retrieve

      await expect(useCase.execute(input)).rejects.toThrow('Failed to retrieve saved node')
    })
  })

  describe('Logging', () => {
    it('should log node creation start and success', async () => {
      const input: CreateNodeInput = {
        tableId: 'table-1',
        content: 'Test Content',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')
      const createdNode = createTestNode('node-1', 'table-1', 'Test Content')

      mockTableRepository.findById = mock(async () => table as any)
      mockNodeRepository.findByTableIdAndContent = mock()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createdNode)

      await useCase.execute(input)

      expect(mockLogger.info).toHaveBeenCalledWith('Creating new node', {
        tableId: 'table-1',
        content: 'Test Content',
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Node created successfully',
        expect.objectContaining({
          id: 'node-1',
          content: 'Test Content',
        })
      )
    })
  })
})

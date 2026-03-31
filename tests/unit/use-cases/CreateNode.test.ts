import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { CreateNodeInput } from '@/application/dtos/NodeDto.js'
import { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import type { Attribute } from '@/domain/entities/Attribute.js'
import type { Node } from '@/domain/entities/Node.js'
import type { NodeAttribute } from '@/domain/entities/NodeAttribute.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { Table } from '@/domain/entities/Table.js'
import { ConflictException, NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'
import type { SafeJsonValue } from '@/shared/utils/safeJson.js'
import {
  createMockLogger,
  createPaginatedResult,
  createTestAttribute,
  createTestNode,
  createTestTable,
  type MockedMethods,
} from './test-helpers.js'

type NodeRepositoryMock = MockedMethods<INodeRepository>
type NodeAttributeRepositoryMock = MockedMethods<INodeAttributeRepository>
type TableRepositoryMock = MockedMethods<ITableRepository>
type AttributeRepositoryMock = MockedMethods<IAttributeRepository>

function createNodeRepositoryMock(): NodeRepositoryMock {
  return {
    save: mock(async (_node: Node) => {}),
    findById: mock(async (_id: string) => null),
    findByTableIdAndContent: mock(async (_tableId: string, _content: string) => null),
    findByTableId: mock(async (_tableId: string) => createPaginatedResult<Node>()),
    findAll: mock(async (_options: unknown) => createPaginatedResult<Node>()),
    delete: mock(async (_id: string) => {}),
    deleteByTableId: mock(async (_tableId: string) => {}),
    exists: mock(async (_tableId: string, _content: string) => false),
    count: mock(async () => 0),
    countByTableId: mock(async (_tableId: string) => 0),
    saveMany: mock(async (_nodes: Node[]) => {}),
    findByIds: mock(async (_ids: string[]) => []),
    searchByContent: mock(async (_tableId: string, _searchTerm: string, _options?: unknown) => createPaginatedResult<Node>()),
    executeRawQuery: mock(async (_query: string, _params?: unknown[]) => []),
    update: mock(
      async (
        _id: string,
        _updates: { content?: string; title?: string | null; description?: string | null; metadata?: SafeJsonValue },
      ) => createTestNode(),
    ),
  } satisfies NodeRepositoryMock
}

function createNodeAttributeRepositoryMock(): NodeAttributeRepositoryMock {
  return {
    save: mock(async (_nodeAttribute: NodeAttribute) => {}),
    findById: mock(async (_id: string) => null),
    findByNodeIdAndAttributeId: mock(async (_nodeId: string, _attributeId: string) => null),
    findByNodeId: mock(async (_nodeId: string) => []),
    findByAttributeId: mock(async (_attributeId: string) => createPaginatedResult<NodeAttribute>()),
    update: mock(async (_nodeAttribute: NodeAttribute) => {}),
    delete: mock(async (_id: string) => {}),
    deleteByNodeId: mock(async (_nodeId: string) => {}),
    deleteByAttributeId: mock(async (_attributeId: string) => {}),
    exists: mock(async (_nodeId: string, _attributeId: string) => false),
    countByNodeId: mock(async (_nodeId: string) => 0),
    saveMany: mock(async (_nodeAttributes: NodeAttribute[]) => {}),
    updateMany: mock(async (_nodeAttributes: NodeAttribute[]) => {}),
    setNodeAttribute: mock(async (_nodeId: string, _attributeId: string, _value: SafeJsonValue) =>
      NodeAttribute.create('node-1', 'attr-1', 'value'),
    ),
  } satisfies NodeAttributeRepositoryMock
}

function createTableRepositoryMock(): TableRepositoryMock {
  return {
    save: mock(async (table: Table) => table),
    findById: mock(async (_id: string) => null),
    findByIdentifier: mock(async (_identifier: string) => null),
    findAll: mock(async (_options: unknown) => createPaginatedResult<Table>()),
    delete: mock(async (_id: string) => {}),
    count: mock(async () => 0),
    exists: mock(async (_identifier: string) => false),
    saveMany: mock(async (_tables: Table[]) => {}),
    findByIds: mock(async (_ids: string[]) => []),
    deleteMany: mock(async (_ids: string[]) => {}),
    update: mock(async (table: Table) => table),
  } satisfies TableRepositoryMock
}

function createAttributeRepositoryMock(): AttributeRepositoryMock {
  return {
    save: mock(async (attribute: Attribute) => attribute),
    findById: mock(async (_id: string) => null),
    findAll: mock(async (_options: unknown) => createPaginatedResult<Attribute>()),
    delete: mock(async (_id: string) => {}),
    count: mock(async () => 0),
    findByIdentifier: mock(async (_identifier: string) => null),
    exists: mock(async (_identifier: string) => false),
    saveMany: mock(async (_attributes: Attribute[]) => {}),
    findByIds: mock(async (_ids: string[]) => []),
    deleteMany: mock(async (_ids: string[]) => {}),
    update: mock(async (attribute: Attribute) => attribute),
    findByParentId: mock(async (_parentId: string) => createPaginatedResult<Attribute>()),
    countByParentId: mock(async (_parentId: string) => 0),
    deleteByParentId: mock(async (_parentId: string) => {}),
    findByTableIdAndIdentifier: mock(async (_tableId: string, _identifier: string) => null),
    findByAttributeTypeId: mock(async (_attributeTypeId: string) => createPaginatedResult<Attribute>()),
    findRequiredByTableId: mock(async (_tableId: string) => []),
    getAttributeTypeForAttribute: mock(async (_attributeId: string) => null),
    existsByTableIdAndIdentifier: mock(async (_tableId: string, _identifier: string) => false),
    findByTableId: mock(async (_tableId: string) => createPaginatedResult<Attribute>()),
    countByTableId: mock(async (_tableId: string) => 0),
    deleteByTableId: mock(async (_tableId: string) => {}),
  } satisfies AttributeRepositoryMock
}

describe('CreateNodeUseCase', () => {
  let useCase: CreateNodeUseCase
  let mockNodeRepository: NodeRepositoryMock
  let mockNodeAttributeRepository: NodeAttributeRepositoryMock
  let mockTableRepository: TableRepositoryMock
  let mockAttributeRepository: AttributeRepositoryMock
  let mockLogger: ReturnType<typeof createMockLogger>

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockNodeRepository = createNodeRepositoryMock()
    mockNodeAttributeRepository = createNodeAttributeRepositoryMock()
    mockTableRepository = createTableRepositoryMock()
    mockAttributeRepository = createAttributeRepositoryMock()

    useCase = new CreateNodeUseCase(
      mockNodeRepository,
      mockNodeAttributeRepository,
      mockTableRepository,
      mockAttributeRepository,
      mockLogger,
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
      await expect(useCase.execute(input)).rejects.toThrow("Table with id 'non-existent-table' not found")
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

      mockTableRepository.findById = mock(async () => existingTable)
      mockNodeRepository.findByTableIdAndContent = mock(async () => existingNode)

      await expect(useCase.execute(input)).rejects.toThrow(ConflictException)
      await expect(useCase.execute(input)).rejects.toThrow(
        "Node with content 'Duplicate Content' already exists in table 'test-table'",
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
      const createdNode = createTestNode('node-1', 'table-1', 'Test Content', 'Test Title', 'Test Description')

      mockTableRepository.findById = mock(async () => table)
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
      const testAttribute = createTestAttribute('attr-1', 'table-1', 'test_attr', 'Test Attribute', '1')
      const numberAttribute = createTestAttribute('attr-2', 'table-1', 'number_attr', 'Number Attribute', '1')

      mockTableRepository.findById = mock(async () => table)
      mockNodeRepository.findByTableIdAndContent = mock().mockResolvedValueOnce(null).mockResolvedValueOnce(createdNode)
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
        }),
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

      mockTableRepository.findById = mock(async () => table)
      mockNodeRepository.findByTableIdAndContent = mock().mockResolvedValueOnce(null).mockResolvedValueOnce(createdNode)
      mockAttributeRepository.findByTableId = mock(async () => ({
        data: [],
        metadata: {},
      }))

      const result = await useCase.execute(input)

      expect(result.node).toBeDefined()
      expect(mockNodeAttributeRepository.save).not.toHaveBeenCalled()
      expect(mockLogger.warn).toHaveBeenCalledWith("Attribute 'non-existent-attr' not found for table, skipping")
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

      mockTableRepository.findById = mock(async () => table)
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
        }),
      )
    })

    it('should throw error when saved node cannot be retrieved', async () => {
      const input: CreateNodeInput = {
        tableId: 'table-1',
        content: 'Test Content',
      }

      const table = createTestTable('table-1', 'test-table', 'Test Table')

      mockTableRepository.findById = mock(async () => table)
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

      mockTableRepository.findById = mock(async () => table)
      mockNodeRepository.findByTableIdAndContent = mock().mockResolvedValueOnce(null).mockResolvedValueOnce(createdNode)

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
        }),
      )
    })
  })
})

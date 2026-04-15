import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { UpdateNodeInput } from '@/application/dtos/NodeDto.js'
import type { TableSchemaProjectionProvider } from '@/application/use-cases/nodes/CreateNode.js'
import { UpdateNodeUseCase } from '@/application/use-cases/nodes/UpdateNode.js'
import { projectTableSchema } from '@/core/schema/TableSchemaProjection.js'
import { Attribute } from '@/domain/entities/Attribute.js'
import type { Node } from '@/domain/entities/Node.js'
import { NodeAttribute } from '@/domain/entities/NodeAttribute.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { Table } from '@/domain/entities/Table.js'
import { ValidationException } from '@/shared/exceptions/DomainException.js'
import type { SafeJsonValue } from '@/shared/utils/safeJson.js'
import {
  createMockLogger,
  createPaginatedResult,
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
    findById: mock(async (_id: string) => createTestNode('node-1', 'table-1', 'Existing content')),
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
        updates: { content?: string; title?: string | null; description?: string | null; metadata?: SafeJsonValue },
      ) => createTestNode('node-1', 'table-1', updates.content ?? 'Existing content', updates.title ?? undefined),
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
    setNodeAttribute: mock(async (nodeId: string, attributeId: string, value: SafeJsonValue) =>
      NodeAttribute.create(nodeId, attributeId, String(value)),
    ),
  } satisfies NodeAttributeRepositoryMock
}

function createTableRepositoryMock(): TableRepositoryMock {
  return {
    save: mock(async (table: Table) => table),
    findById: mock(async (_id: string) => createTestTable('table-1', 'test-table', 'Test Table')),
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
    findByTableId: mock(async (_tableId: string) => createPaginatedResult(createProjectionAttributes())),
    countByTableId: mock(async (_tableId: string) => 0),
    deleteByTableId: mock(async (_tableId: string) => {}),
  } satisfies AttributeRepositoryMock
}

function createProjectionAttributes(): Attribute[] {
  return [
    Attribute.fromDatabase('attr-status', 'table-1', 'status', 'Status', 'type-status', null, true, null, new Date(), new Date()),
    Attribute.fromDatabase('attr-effort', 'table-1', 'effort', 'Effort', 'type-effort', null, false, null, new Date(), new Date()),
  ]
}

function createTaskProjectionProvider(): TableSchemaProjectionProvider {
  const projection = projectTableSchema({
    table: {
      id: 'table-1',
      identifier: 'test-table',
      description: 'Test Table',
    },
    attributeTypes: [
      {
        id: 'type-status',
        identifier: 'status',
        jsonType: 'string',
        validationSchema: JSON.stringify({ enum: ['todo', 'doing', 'done'] }),
      },
      {
        id: 'type-effort',
        identifier: 'effort',
        jsonType: 'integer',
        validationSchema: JSON.stringify({ minimum: 1, maximum: 5 }),
      },
    ],
    attributes: [
      {
        id: 'attr-status',
        tableId: 'table-1',
        identifier: 'status',
        attributeTypeId: 'type-status',
        isRequired: true,
      },
      {
        id: 'attr-effort',
        tableId: 'table-1',
        identifier: 'effort',
        attributeTypeId: 'type-effort',
        isRequired: false,
      },
    ],
  })

  return {
    project: mock(async () => projection),
  }
}

async function expectProjectionValidationError(
  action: Promise<unknown>,
  expected: { code: string; field: string },
): Promise<void> {
  try {
    await action
    throw new Error('Expected projection validation to fail')
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationException)
    const context = (error as ValidationException).context
    const validationErrors = context?.validationErrors

    expect(Array.isArray(validationErrors)).toBe(true)
    expect(validationErrors).toEqual(expect.arrayContaining([
      expect.objectContaining(expected),
    ]))
  }
}

describe('UpdateNodeUseCase', () => {
  let useCase: UpdateNodeUseCase
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

    useCase = new UpdateNodeUseCase(
      mockNodeRepository,
      mockNodeAttributeRepository,
      mockTableRepository,
      mockAttributeRepository,
      mockLogger,
      createTaskProjectionProvider(),
    )
  })

  it('updates one projected attribute without requiring other required attributes', async () => {
    const input: UpdateNodeInput = {
      attributes: {
        effort: 3,
      },
    }

    const result = await useCase.execute('node-1', input)

    expect(result.node.id).toBe('node-1')
    expect(mockNodeRepository.update).not.toHaveBeenCalled()
    expect(mockNodeAttributeRepository.setNodeAttribute).toHaveBeenCalledWith('node-1', 'attr-effort', '3')
  })

  it('rejects unknown updated attributes with structured validation errors', async () => {
    await expectProjectionValidationError(
      useCase.execute('node-1', {
        attributes: {
          status: 'todo',
          unknown_attr: true,
        },
      }),
      { code: 'additional-property', field: 'attributes.unknown_attr' },
    )

    expect(mockNodeAttributeRepository.setNodeAttribute).not.toHaveBeenCalled()
  })

  it('rejects enum violations with structured validation errors', async () => {
    await expectProjectionValidationError(
      useCase.execute('node-1', {
        attributes: {
          status: 'blocked',
        },
      }),
      { code: 'enum', field: 'attributes.status' },
    )

    expect(mockNodeAttributeRepository.setNodeAttribute).not.toHaveBeenCalled()
  })

  it('rejects numeric constraint violations with structured validation errors', async () => {
    await expectProjectionValidationError(
      useCase.execute('node-1', {
        attributes: {
          effort: 9,
        },
      }),
      { code: 'maximum', field: 'attributes.effort' },
    )

    expect(mockNodeAttributeRepository.setNodeAttribute).not.toHaveBeenCalled()
  })

  it('rejects update input with a conflicting table context', async () => {
    await expectProjectionValidationError(
      useCase.execute('node-1', {
        tableId: 'table-2',
        attributes: {
          effort: 3,
        },
      }),
      { code: 'table-mismatch', field: 'tableId' },
    )

    expect(mockNodeAttributeRepository.setNodeAttribute).not.toHaveBeenCalled()
  })
})

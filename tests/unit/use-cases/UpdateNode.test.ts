import { beforeEach, describe, expect, it, vi } from 'vitest'
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
    save: vi.fn(async (_node: Node) => {}),
    findById: vi.fn(async (_id: string) => createTestNode('node-1', 'table-1', 'Existing content')),
    findByTableIdAndContent: vi.fn(async (_tableId: string, _content: string) => null),
    findByTableId: vi.fn(async (_tableId: string) => createPaginatedResult<Node>()),
    findAll: vi.fn(async (_options: unknown) => createPaginatedResult<Node>()),
    delete: vi.fn(async (_id: string) => {}),
    deleteByTableId: vi.fn(async (_tableId: string) => {}),
    exists: vi.fn(async (_tableId: string, _content: string) => false),
    count: vi.fn(async () => 0),
    countByTableId: vi.fn(async (_tableId: string) => 0),
    saveMany: vi.fn(async (_nodes: Node[]) => {}),
    findByIds: vi.fn(async (_ids: string[]) => []),
    searchByContent: vi.fn(async (_tableId: string, _searchTerm: string, _options?: unknown) => createPaginatedResult<Node>()),
    executeRawQuery: vi.fn(async (_query: string, _params?: unknown[]) => []),
    update: vi.fn(
      async (
        _id: string,
        updates: { content?: string; title?: string | null; description?: string | null; metadata?: SafeJsonValue },
      ) => createTestNode('node-1', 'table-1', updates.content ?? 'Existing content', updates.title ?? undefined),
    ),
  } satisfies NodeRepositoryMock
}

function createNodeAttributeRepositoryMock(): NodeAttributeRepositoryMock {
  return {
    save: vi.fn(async (_nodeAttribute: NodeAttribute) => {}),
    findById: vi.fn(async (_id: string) => null),
    findByNodeIdAndAttributeId: vi.fn(async (_nodeId: string, _attributeId: string) => null),
    findByNodeId: vi.fn(async (_nodeId: string) => []),
    findByAttributeId: vi.fn(async (_attributeId: string) => createPaginatedResult<NodeAttribute>()),
    update: vi.fn(async (_nodeAttribute: NodeAttribute) => {}),
    delete: vi.fn(async (_id: string) => {}),
    deleteByNodeId: vi.fn(async (_nodeId: string) => {}),
    deleteByAttributeId: vi.fn(async (_attributeId: string) => {}),
    exists: vi.fn(async (_nodeId: string, _attributeId: string) => false),
    countByNodeId: vi.fn(async (_nodeId: string) => 0),
    saveMany: vi.fn(async (_nodeAttributes: NodeAttribute[]) => {}),
    updateMany: vi.fn(async (_nodeAttributes: NodeAttribute[]) => {}),
    setNodeAttribute: vi.fn(async (nodeId: string, attributeId: string, value: SafeJsonValue) =>
      NodeAttribute.create(nodeId, attributeId, String(value)),
    ),
  } satisfies NodeAttributeRepositoryMock
}

function createTableRepositoryMock(): TableRepositoryMock {
  return {
    save: vi.fn(async (table: Table) => table),
    findById: vi.fn(async (_id: string) => createTestTable('table-1', 'test-table', 'Test Table')),
    findByIdentifier: vi.fn(async (_identifier: string) => null),
    findAll: vi.fn(async (_options: unknown) => createPaginatedResult<Table>()),
    delete: vi.fn(async (_id: string) => {}),
    count: vi.fn(async () => 0),
    exists: vi.fn(async (_identifier: string) => false),
    saveMany: vi.fn(async (_tables: Table[]) => {}),
    findByIds: vi.fn(async (_ids: string[]) => []),
    deleteMany: vi.fn(async (_ids: string[]) => {}),
    update: vi.fn(async (table: Table) => table),
  } satisfies TableRepositoryMock
}

function createAttributeRepositoryMock(): AttributeRepositoryMock {
  return {
    save: vi.fn(async (attribute: Attribute) => attribute),
    findById: vi.fn(async (_id: string) => null),
    findAll: vi.fn(async (_options: unknown) => createPaginatedResult<Attribute>()),
    delete: vi.fn(async (_id: string) => {}),
    count: vi.fn(async () => 0),
    findByIdentifier: vi.fn(async (_identifier: string) => null),
    exists: vi.fn(async (_identifier: string) => false),
    saveMany: vi.fn(async (_attributes: Attribute[]) => {}),
    findByIds: vi.fn(async (_ids: string[]) => []),
    deleteMany: vi.fn(async (_ids: string[]) => {}),
    update: vi.fn(async (attribute: Attribute) => attribute),
    findByParentId: vi.fn(async (_parentId: string) => createPaginatedResult<Attribute>()),
    countByParentId: vi.fn(async (_parentId: string) => 0),
    deleteByParentId: vi.fn(async (_parentId: string) => {}),
    findByTableIdAndIdentifier: vi.fn(async (_tableId: string, _identifier: string) => null),
    findByAttributeTypeId: vi.fn(async (_attributeTypeId: string) => createPaginatedResult<Attribute>()),
    findRequiredByTableId: vi.fn(async (_tableId: string) => []),
    getAttributeTypeForAttribute: vi.fn(async (_attributeId: string) => null),
    existsByTableIdAndIdentifier: vi.fn(async (_tableId: string, _identifier: string) => false),
    findByTableId: vi.fn(async (_tableId: string) => createPaginatedResult(createProjectionAttributes())),
    countByTableId: vi.fn(async (_tableId: string) => 0),
    deleteByTableId: vi.fn(async (_tableId: string) => {}),
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
    project: vi.fn(async () => projection),
  }
}

function createBrokenProjectionProvider(): TableSchemaProjectionProvider {
  const projection = projectTableSchema({
    table: {
      id: 'table-1',
      identifier: 'test-table',
      description: 'Test Table',
    },
    attributeTypes: [],
    attributes: [
      {
        id: 'attr-missing',
        tableId: 'table-1',
        identifier: 'missing_type',
        attributeTypeId: 'missing-type',
        isRequired: true,
      },
    ],
  })

  return {
    project: vi.fn(async () => projection),
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

  it('rejects unusable projections before updating node attributes', async () => {
    useCase = new UpdateNodeUseCase(
      mockNodeRepository,
      mockNodeAttributeRepository,
      mockTableRepository,
      mockAttributeRepository,
      mockLogger,
      createBrokenProjectionProvider(),
    )

    await expectProjectionValidationError(
      useCase.execute('node-1', {
        attributes: {
          effort: 3,
        },
      }),
      { code: 'attribute-type-not-found', field: 'projection.diagnostics' },
    )

    expect(mockNodeRepository.update).not.toHaveBeenCalled()
    expect(mockNodeAttributeRepository.setNodeAttribute).not.toHaveBeenCalled()
  })

  it('rejects unsafe projected attribute object keys', async () => {
    await expectProjectionValidationError(
      useCase.execute('node-1', {
        attributes: {
          status: JSON.parse('{"constructor":{"prototype":{"polluted":true}}}'),
        },
      }),
      { code: 'unsafe-json-key', field: 'attributes.status' },
    )

    expect(mockNodeRepository.update).not.toHaveBeenCalled()
    expect(mockNodeAttributeRepository.setNodeAttribute).not.toHaveBeenCalled()
  })
})

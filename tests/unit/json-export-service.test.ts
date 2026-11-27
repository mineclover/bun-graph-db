/**
 * JsonExportService Unit Tests
 *
 * Tests for JSON export functionality in Flat and HFI Protocol formats
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { NodeId, TableId } from '@/core/types/CommonTypes.js'
import type { Attribute } from '@/domain/entities/Attribute.js'
import type { Node } from '@/domain/entities/Node.js'
import type { NodeAttribute } from '@/domain/entities/NodeAttribute.js'
import type { NodeRelation } from '@/domain/entities/NodeRelation.js'
import type { RelationType } from '@/domain/entities/RelationType.js'
import type { Table } from '@/domain/entities/Table.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { JsonExportService } from '@/domain/services/JsonExportService.js'

// Mock entities
const mockTable = {
  id: 'table-1' as TableId,
  identifier: 'test-table',
  description: 'Test table description',
} as Table

const mockNode = {
  getId: () => 'node-1' as NodeId,
  getTitle: () => 'Test Node',
  getContent: () => 'Node content',
  getDescription: () => 'Node description',
} as unknown as Node

const mockAttribute = {
  getId: () => 'attr-1',
  getIdentifier: () => 'test-attribute',
  getIsRequired: () => false,
} as unknown as Attribute

const mockNodeAttribute = {
  getAttributeId: () => 'attr-1',
  getValue: () => 'attribute value',
} as unknown as NodeAttribute

const mockRelationType = {
  getId: () => 'rel-type-1',
  getIdentifier: () => 'relates-to',
  getDescription: () => 'Relation description',
  getCategory: () => 'default',
} as unknown as RelationType

const mockNodeRelation = {
  getSourceNodeId: () => 'node-1' as NodeId,
  getTargetNodeId: () => 'node-2' as NodeId,
  getRelationTypeId: () => 'rel-type-1',
  getProperties: () => null,
} as unknown as NodeRelation

// Mock repositories
const createMockTableRepository = (): ITableRepository => ({
  findById: vi.fn(async () => mockTable),
  findByIdentifier: vi.fn(async () => mockTable),
  findAll: vi.fn(async () => ({ nodes: [mockTable], total: 1, hasNextPage: false })),
  create: vi.fn(async () => mockTable),
  update: vi.fn(async () => mockTable),
  delete: vi.fn(async () => undefined),
  search: vi.fn(async () => ({ nodes: [mockTable], total: 1, hasNextPage: false })),
  exists: vi.fn(async () => true),
  count: vi.fn(async () => 1),
})

const createMockNodeRepository = (): INodeRepository => ({
  findById: vi.fn(async () => mockNode),
  findByTableId: vi.fn(async () => ({ nodes: [mockNode], total: 1, hasNextPage: false })),
  findByContent: vi.fn(async () => [mockNode]),
  create: vi.fn(async () => mockNode),
  update: vi.fn(async () => mockNode),
  delete: vi.fn(async () => undefined),
  search: vi.fn(async () => ({ nodes: [mockNode], total: 1, hasNextPage: false })),
  count: vi.fn(async () => 1),
  countByTableId: vi.fn(async () => 1),
  exists: vi.fn(async () => true),
})

const createMockAttributeRepository = (): IAttributeRepository => ({
  findById: vi.fn(async () => mockAttribute),
  findByIdentifier: vi.fn(async () => mockAttribute),
  findByTableId: vi.fn(async () => ({ nodes: [mockAttribute], total: 1, hasNextPage: false })),
  create: vi.fn(async () => mockAttribute),
  update: vi.fn(async () => mockAttribute),
  delete: vi.fn(async () => undefined),
  exists: vi.fn(async () => true),
  count: vi.fn(async () => 1),
})

const createMockNodeAttributeRepository = (): INodeAttributeRepository => ({
  findByNodeId: vi.fn(async () => [mockNodeAttribute]),
  findByAttributeId: vi.fn(async () => [mockNodeAttribute]),
  findByNodeAndAttribute: vi.fn(async () => mockNodeAttribute),
  create: vi.fn(async () => mockNodeAttribute),
  update: vi.fn(async () => mockNodeAttribute),
  delete: vi.fn(async () => undefined),
  deleteByNodeId: vi.fn(async () => undefined),
  exists: vi.fn(async () => true),
})

const createMockNodeRelationRepository = (): INodeRelationRepository => ({
  findById: vi.fn(async () => mockNodeRelation),
  findByTableId: vi.fn(async () => ({ nodes: [mockNodeRelation], total: 1, hasNextPage: false })),
  findBySourceNodeId: vi.fn(async () => [mockNodeRelation]),
  findByTargetNodeId: vi.fn(async () => []),
  findByRelationTypeId: vi.fn(async () => [mockNodeRelation]),
  create: vi.fn(async () => mockNodeRelation),
  update: vi.fn(async () => mockNodeRelation),
  delete: vi.fn(async () => undefined),
  deleteByNodeId: vi.fn(async () => undefined),
  exists: vi.fn(async () => true),
  count: vi.fn(async () => 1),
})

const createMockRelationTypeRepository = (): IRelationTypeRepository => ({
  findById: vi.fn(async () => mockRelationType),
  findByIdentifier: vi.fn(async () => mockRelationType),
  findAll: vi.fn(async () => ({ nodes: [mockRelationType], total: 1, hasNextPage: false })),
  create: vi.fn(async () => mockRelationType),
  update: vi.fn(async () => mockRelationType),
  delete: vi.fn(async () => undefined),
  exists: vi.fn(async () => true),
  count: vi.fn(async () => 1),
})

describe('JsonExportService', () => {
  let service: JsonExportService
  let mockTableRepo: ITableRepository
  let mockNodeRepo: INodeRepository
  let mockAttrRepo: IAttributeRepository
  let mockNodeAttrRepo: INodeAttributeRepository
  let mockRelationRepo: INodeRelationRepository
  let mockRelationTypeRepo: IRelationTypeRepository

  beforeEach(() => {
    mockTableRepo = createMockTableRepository()
    mockNodeRepo = createMockNodeRepository()
    mockAttrRepo = createMockAttributeRepository()
    mockNodeAttrRepo = createMockNodeAttributeRepository()
    mockRelationRepo = createMockNodeRelationRepository()
    mockRelationTypeRepo = createMockRelationTypeRepository()

    service = new JsonExportService(
      mockTableRepo,
      mockNodeRepo,
      mockAttrRepo,
      mockNodeAttrRepo,
      mockRelationRepo,
      mockRelationTypeRepo,
    )
  })

  describe('exportTable - Flat format', () => {
    test('should export table in flat format successfully', async () => {
      const result = await service.exportTable('table-1' as TableId, { format: 'flat' })

      expect(result.success).toBe(true)
      expect(result.format).toBe('flat')
      expect(result.nodeCount).toBe(1)
      expect(result.errors).toEqual([])
      expect(result.json).toBeDefined()
    })

    test('should include table metadata in flat export', async () => {
      const result = await service.exportTable('table-1' as TableId, { format: 'flat' })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      const data = result.data as any
      expect(data.version).toBe('1.0.0')
      expect(data.exportedAt).toBeDefined()
      expect(data.table.id).toBe('table-1')
      expect(data.table.identifier).toBe('test-table')
    })

    test('should include flattened attributes in flat export', async () => {
      const result = await service.exportTable('table-1' as TableId, { format: 'flat' })

      expect(result.success).toBe(true)
      const data = result.data as any
      expect(data.nodes).toHaveLength(1)
      expect(data.nodes[0].id).toBe('node-1')
      expect(data.nodes[0].title).toBe('Test Node')
      expect(data.nodes[0]['test-attribute']).toBe('attribute value')
    })

    test('should pretty print JSON when prettyPrint is true', async () => {
      const result = await service.exportTable('table-1' as TableId, {
        format: 'flat',
        prettyPrint: true,
      })

      expect(result.success).toBe(true)
      expect(result.json).toContain('\n')
    })

    test('should not pretty print when prettyPrint is false', async () => {
      const result = await service.exportTable('table-1' as TableId, {
        format: 'flat',
        prettyPrint: false,
      })

      expect(result.success).toBe(true)
      expect(result.json).not.toContain('\n  ')
    })
  })

  describe('exportTable - HFI format', () => {
    test('should export table in HFI format successfully', async () => {
      const result = await service.exportTable('table-1' as TableId, { format: 'hfi' })

      expect(result.success).toBe(true)
      expect(result.format).toBe('hfi')
      expect(result.nodeCount).toBe(1)
      expect(result.errors).toEqual([])
    })

    test('should include HFI protocol header', async () => {
      const result = await service.exportTable('table-1' as TableId, { format: 'hfi' })

      expect(result.success).toBe(true)
      const data = result.data as any
      expect(data.protocol).toBe('HFI/1.1')
      expect(data.context).toBe('test-table')
    })

    test('should convert nodes to FlowNodes', async () => {
      const result = await service.exportTable('table-1' as TableId, { format: 'hfi' })

      expect(result.success).toBe(true)
      const data = result.data as any
      expect(data.nodes).toHaveLength(1)
      expect(data.nodes[0].id).toBe('node-1')
      expect(data.nodes[0].type).toBe('query') // Has relations, so query type
      expect(data.nodes[0].title).toBe('Test Node')
      expect(data.nodes[0].payload).toBeDefined()
    })

    test('should include branches for nodes with relations', async () => {
      const result = await service.exportTable('table-1' as TableId, {
        format: 'hfi',
        includeRelations: true,
      })

      expect(result.success).toBe(true)
      const data = result.data as any
      expect(data.nodes[0].branches).toBeDefined()
      expect(data.nodes[0].branches).toHaveLength(1)
      expect(data.nodes[0].branches[0].case).toBe('relates-to')
    })

    test('should include edges metadata', async () => {
      const result = await service.exportTable('table-1' as TableId, { format: 'hfi' })

      expect(result.success).toBe(true)
      const data = result.data as any
      expect(data.edges).toBeDefined()
      expect(Array.isArray(data.edges)).toBe(true)
    })

    test('should include metadata with source table info', async () => {
      const result = await service.exportTable('table-1' as TableId, { format: 'hfi' })

      expect(result.success).toBe(true)
      const data = result.data as any
      expect(data.metadata).toBeDefined()
      expect(data.metadata.createdAt).toBeDefined()
      expect(data.metadata.sourceTable.id).toBe('table-1')
      expect(data.metadata.sourceTable.identifier).toBe('test-table')
    })
  })

  describe('error handling', () => {
    test('should return error when table not found', async () => {
      mockTableRepo.findById = vi.fn(async () => null)

      const result = await service.exportTable('non-existent' as TableId, { format: 'flat' })

      expect(result.success).toBe(false)
      expect(result.errors).toContain("Table with ID 'non-existent' not found")
    })

    test('should handle repository errors gracefully', async () => {
      mockTableRepo.findById = vi.fn(async () => {
        throw new Error('Database error')
      })

      const result = await service.exportTable('table-1' as TableId, { format: 'flat' })

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Database error')
    })
  })

  describe('filtering options', () => {
    test('should filter by nodeIds when specified', async () => {
      const result = await service.exportTable('table-1' as TableId, {
        format: 'flat',
        nodeIds: ['node-1'],
      })

      expect(result.success).toBe(true)
      expect(result.nodeCount).toBe(1)
    })

    test('should return empty nodes when nodeIds filter matches nothing', async () => {
      const result = await service.exportTable('table-1' as TableId, {
        format: 'flat',
        nodeIds: ['non-existent-node'],
      })

      expect(result.success).toBe(true)
      expect(result.nodeCount).toBe(0)
    })
  })

  describe('edge cases - empty table export', () => {
    test('should export empty table in flat format', async () => {
      mockNodeRepo.findByTableId = vi.fn(async () => ({ nodes: [], total: 0, hasNextPage: false }))

      const result = await service.exportTable('table-1' as TableId, { format: 'flat' })

      expect(result.success).toBe(true)
      expect(result.nodeCount).toBe(0)
      const data = result.data as any
      expect(data.nodes).toHaveLength(0)
    })

    test('should export empty table in HFI format', async () => {
      mockNodeRepo.findByTableId = vi.fn(async () => ({ nodes: [], total: 0, hasNextPage: false }))
      mockRelationRepo.findByTableId = vi.fn(async () => ({
        nodes: [],
        total: 0,
        hasNextPage: false,
      }))

      const result = await service.exportTable('table-1' as TableId, { format: 'hfi' })

      expect(result.success).toBe(true)
      expect(result.nodeCount).toBe(0)
      const data = result.data as any
      expect(data.nodes).toHaveLength(0)
      expect(data.edges).toHaveLength(0)
    })
  })

  describe('edge cases - mixed node types', () => {
    test('should correctly identify EffectNode (no relations) vs QueryNode (with relations)', async () => {
      const nodeWithoutRelations = {
        getId: () => 'node-2' as NodeId,
        getTitle: () => 'Effect Node',
        getContent: () => 'Node without relations',
        getDescription: () => 'Effect description',
      } as unknown as Node

      mockNodeRepo.findByTableId = vi.fn(async () => ({
        nodes: [mockNode, nodeWithoutRelations],
        total: 2,
        hasNextPage: false,
      }))
      mockNodeAttrRepo.findByNodeId = vi.fn(async (nodeId: NodeId) => {
        if (nodeId === 'node-1') return [mockNodeAttribute]
        return []
      })

      const result = await service.exportTable('table-1' as TableId, { format: 'hfi' })

      expect(result.success).toBe(true)
      expect(result.nodeCount).toBe(2)
      const data = result.data as any

      const queryNode = data.nodes.find((n: any) => n.id === 'node-1')
      const effectNode = data.nodes.find((n: any) => n.id === 'node-2')

      expect(queryNode.type).toBe('query')
      expect(queryNode.branches).toBeDefined()
      expect(effectNode.type).toBe('effect')
      expect(effectNode.branches).toBeUndefined()
    })
  })

  describe('edge cases - state connections', () => {
    test('should include state connections when includeStateConnections is true', async () => {
      const stateConnectionRelation = {
        getSourceNodeId: () => 'node-1' as NodeId,
        getTargetNodeId: () => 'node-2' as NodeId,
        getRelationTypeId: () => 'rel-type-1',
        getProperties: () => ({
          isStateConnection: true,
          fromField: 'output',
          toField: 'input',
        }),
      } as unknown as NodeRelation

      mockRelationRepo.findByTableId = vi.fn(async () => ({
        nodes: [stateConnectionRelation],
        total: 1,
        hasNextPage: false,
      }))

      const result = await service.exportTable('table-1' as TableId, {
        format: 'hfi',
        includeStateConnections: true,
      })

      expect(result.success).toBe(true)
      const data = result.data as any
      expect(data.stateConnections).toBeDefined()
      expect(data.stateConnections).toHaveLength(1)
      expect(data.stateConnections[0].from).toBe('node-1')
      expect(data.stateConnections[0].to).toBe('node-2')
      expect(data.stateConnections[0].fromField).toBe('output')
      expect(data.stateConnections[0].toField).toBe('input')
    })

    test('should not include state connections when includeStateConnections is false', async () => {
      const result = await service.exportTable('table-1' as TableId, {
        format: 'hfi',
        includeStateConnections: false,
      })

      expect(result.success).toBe(true)
      const data = result.data as any
      expect(data.stateConnections).toBeUndefined()
    })
  })

  describe('edge cases - multiple relation types', () => {
    test('should group branches by relation type', async () => {
      const relationType2 = {
        getId: () => 'rel-type-2',
        getIdentifier: () => 'follows',
        getDescription: () => 'Follows relation',
        getCategory: () => 'social',
      } as unknown as RelationType

      const relation2 = {
        getSourceNodeId: () => 'node-1' as NodeId,
        getTargetNodeId: () => 'node-3' as NodeId,
        getRelationTypeId: () => 'rel-type-2',
        getProperties: () => null,
      } as unknown as NodeRelation

      mockRelationRepo.findByTableId = vi.fn(async () => ({
        nodes: [mockNodeRelation, relation2],
        total: 2,
        hasNextPage: false,
      }))
      mockRelationTypeRepo.findAll = vi.fn(async () => ({
        nodes: [mockRelationType, relationType2],
        total: 2,
        hasNextPage: false,
      }))

      const result = await service.exportTable('table-1' as TableId, { format: 'hfi' })

      expect(result.success).toBe(true)
      const data = result.data as any
      const queryNode = data.nodes.find((n: any) => n.id === 'node-1')

      expect(queryNode.branches).toHaveLength(2)
      const relatesTo = queryNode.branches.find((b: any) => b.case === 'relates-to')
      const follows = queryNode.branches.find((b: any) => b.case === 'follows')

      expect(relatesTo).toBeDefined()
      expect(relatesTo.next).toBe('node-2')
      expect(follows).toBeDefined()
      expect(follows.next).toBe('node-3')
    })

    test('should combine multiple targets for same relation type', async () => {
      const relation2 = {
        getSourceNodeId: () => 'node-1' as NodeId,
        getTargetNodeId: () => 'node-3' as NodeId,
        getRelationTypeId: () => 'rel-type-1',
        getProperties: () => null,
      } as unknown as NodeRelation

      mockRelationRepo.findByTableId = vi.fn(async () => ({
        nodes: [mockNodeRelation, relation2],
        total: 2,
        hasNextPage: false,
      }))

      const result = await service.exportTable('table-1' as TableId, { format: 'hfi' })

      expect(result.success).toBe(true)
      const data = result.data as any
      const queryNode = data.nodes.find((n: any) => n.id === 'node-1')

      expect(queryNode.branches).toHaveLength(1)
      expect(queryNode.branches[0].case).toBe('relates-to')
      expect(Array.isArray(queryNode.branches[0].next)).toBe(true)
      expect(queryNode.branches[0].next).toContain('node-2')
      expect(queryNode.branches[0].next).toContain('node-3')
    })
  })

  describe('edge cases - payload type inference', () => {
    test('should correctly infer payload types from attribute values', async () => {
      const stringAttr = {
        getAttributeId: () => 'attr-string',
        getValue: () => 'text value',
      } as unknown as NodeAttribute

      const numberAttr = {
        getAttributeId: () => 'attr-number',
        getValue: () => 42,
      } as unknown as NodeAttribute

      const booleanAttr = {
        getAttributeId: () => 'attr-boolean',
        getValue: () => true,
      } as unknown as NodeAttribute

      const arrayAttr = {
        getAttributeId: () => 'attr-array',
        getValue: () => [1, 2, 3],
      } as unknown as NodeAttribute

      const objectAttr = {
        getAttributeId: () => 'attr-object',
        getValue: () => ({ key: 'value' }),
      } as unknown as NodeAttribute

      const attributes = [
        {
          getId: () => 'attr-string',
          getIdentifier: () => 'stringField',
          getIsRequired: () => false,
        },
        {
          getId: () => 'attr-number',
          getIdentifier: () => 'numberField',
          getIsRequired: () => true,
        },
        {
          getId: () => 'attr-boolean',
          getIdentifier: () => 'booleanField',
          getIsRequired: () => false,
        },
        {
          getId: () => 'attr-array',
          getIdentifier: () => 'arrayField',
          getIsRequired: () => false,
        },
        {
          getId: () => 'attr-object',
          getIdentifier: () => 'objectField',
          getIsRequired: () => false,
        },
      ] as unknown as Attribute[]

      mockAttrRepo.findByTableId = vi.fn(async () => ({
        nodes: attributes,
        total: 5,
        hasNextPage: false,
      }))
      mockNodeAttrRepo.findByNodeId = vi.fn(async () => [stringAttr, numberAttr, booleanAttr, arrayAttr, objectAttr])
      mockRelationRepo.findByTableId = vi.fn(async () => ({
        nodes: [],
        total: 0,
        hasNextPage: false,
      }))

      const result = await service.exportTable('table-1' as TableId, { format: 'hfi' })

      expect(result.success).toBe(true)
      const data = result.data as any
      const node = data.nodes[0]

      const stringPayload = node.payload.find((p: any) => p.key === 'stringField')
      const numberPayload = node.payload.find((p: any) => p.key === 'numberField')
      const booleanPayload = node.payload.find((p: any) => p.key === 'booleanField')
      const arrayPayload = node.payload.find((p: any) => p.key === 'arrayField')
      const objectPayload = node.payload.find((p: any) => p.key === 'objectField')

      expect(stringPayload.type).toBe('string')
      expect(numberPayload.type).toBe('number')
      expect(numberPayload.required).toBe(true)
      expect(booleanPayload.type).toBe('boolean')
      expect(arrayPayload.type).toBe('array')
      expect(objectPayload.type).toBe('object')
    })
  })

  describe('edge cases - tags and options', () => {
    test('should include tags in HFI export when provided', async () => {
      mockRelationRepo.findByTableId = vi.fn(async () => ({
        nodes: [],
        total: 0,
        hasNextPage: false,
      }))

      const result = await service.exportTable('table-1' as TableId, {
        format: 'hfi',
        tags: ['important', 'workflow'],
      })

      expect(result.success).toBe(true)
      const data = result.data as any
      expect(data.nodes[0].tags).toEqual(['important', 'workflow'])
    })

    test('should exclude relations when includeRelations is false', async () => {
      const result = await service.exportTable('table-1' as TableId, {
        format: 'hfi',
        includeRelations: false,
      })

      expect(result.success).toBe(true)
      const data = result.data as any
      expect(data.nodes[0].type).toBe('effect')
      expect(data.nodes[0].branches).toBeUndefined()
    })
  })

  describe('edge cases - backward compatibility with data property', () => {
    test('should handle repositories returning data instead of nodes', async () => {
      // Simulate old-style repository response
      mockNodeRepo.findByTableId = vi.fn(
        async () =>
          ({
            data: [mockNode],
            total: 1,
            hasNextPage: false,
          }) as any,
      )
      mockAttrRepo.findByTableId = vi.fn(
        async () =>
          ({
            data: [mockAttribute],
            total: 1,
            hasNextPage: false,
          }) as any,
      )

      const result = await service.exportTable('table-1' as TableId, { format: 'flat' })

      expect(result.success).toBe(true)
      expect(result.nodeCount).toBe(1)
    })
  })
})

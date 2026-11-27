/**
 * JSON Export Types Unit Tests
 *
 * Tests for type guards and patch types validation
 */

import { describe, expect, test } from 'vitest'
import {
  type FlatJsonExport,
  type FlatJsonPatchRequest,
  type FlatNodePatch,
  HFI_PROTOCOL_VERSION,
  type HFIBranchPatch,
  type HFINodePatch,
  type HFIProtocolExport,
  type HFIProtocolPatchRequest,
  type HFIRelationPatch,
  type HFIStateConnectionPatch,
  isEffectNode,
  isFlatJsonExport,
  isFlatJsonPatchRequest,
  isHFIProtocol,
  isHFIProtocolPatchRequest,
  isQueryNode,
  type JsonPatchRequest,
  type JsonPatchResult,
  type PatchOperationResult,
  type PayloadFieldPatch,
} from '@/core/types/JsonExport.js'

describe('JSON Export Type Guards', () => {
  describe('isHFIProtocol', () => {
    test('should return true for valid HFI protocol export', () => {
      const hfiExport: HFIProtocolExport = {
        protocol: HFI_PROTOCOL_VERSION,
        context: 'test-table',
        nodes: [],
        edges: [],
      }
      expect(isHFIProtocol(hfiExport)).toBe(true)
    })

    test('should return false for non-HFI objects', () => {
      expect(isHFIProtocol(null)).toBe(false)
      expect(isHFIProtocol(undefined)).toBe(false)
      expect(isHFIProtocol({})).toBe(false)
      expect(isHFIProtocol({ protocol: 'wrong' })).toBe(false)
    })
  })

  describe('isFlatJsonExport', () => {
    test('should return true for valid Flat JSON export', () => {
      const flatExport: FlatJsonExport = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        table: { id: '1', identifier: 'test' },
        nodes: [],
      }
      expect(isFlatJsonExport(flatExport)).toBe(true)
    })

    test('should return false for HFI protocol (has protocol field)', () => {
      const hfiExport = {
        protocol: HFI_PROTOCOL_VERSION,
        version: '1.0.0',
        nodes: [],
      }
      expect(isFlatJsonExport(hfiExport)).toBe(false)
    })

    test('should return false for invalid objects', () => {
      expect(isFlatJsonExport(null)).toBe(false)
      expect(isFlatJsonExport(undefined)).toBe(false)
      expect(isFlatJsonExport({})).toBe(false)
      expect(isFlatJsonExport({ version: '1.0.0' })).toBe(false)
    })
  })

  describe('isQueryNode / isEffectNode', () => {
    test('should identify query nodes', () => {
      const queryNode = {
        id: '1',
        type: 'query' as const,
        target: 'test',
        title: 'Query Node',
        branches: [],
        payload: [],
      }
      expect(isQueryNode(queryNode)).toBe(true)
      expect(isEffectNode(queryNode)).toBe(false)
    })

    test('should identify effect nodes', () => {
      const effectNode = {
        id: '1',
        type: 'effect' as const,
        target: 'test',
        title: 'Effect Node',
        payload: [],
      }
      expect(isEffectNode(effectNode)).toBe(true)
      expect(isQueryNode(effectNode)).toBe(false)
    })
  })
})

describe('Patch Request Type Guards', () => {
  describe('isFlatJsonPatchRequest', () => {
    test('should return true for flat format patch request', () => {
      const request: FlatJsonPatchRequest = {
        format: 'flat',
        tableId: 'table-1',
        patches: [],
      }
      expect(isFlatJsonPatchRequest(request)).toBe(true)
    })

    test('should return false for HFI format patch request', () => {
      const request: HFIProtocolPatchRequest = {
        format: 'hfi',
        context: 'test-context',
      }
      expect(isFlatJsonPatchRequest(request)).toBe(false)
    })
  })

  describe('isHFIProtocolPatchRequest', () => {
    test('should return true for HFI format patch request', () => {
      const request: HFIProtocolPatchRequest = {
        format: 'hfi',
        context: 'test-context',
      }
      expect(isHFIProtocolPatchRequest(request)).toBe(true)
    })

    test('should return false for flat format patch request', () => {
      const request: FlatJsonPatchRequest = {
        format: 'flat',
        tableId: 'table-1',
        patches: [],
      }
      expect(isHFIProtocolPatchRequest(request)).toBe(false)
    })
  })
})

describe('Flat JSON Patch Types', () => {
  test('FlatNodePatch should have required id field', () => {
    const patch: FlatNodePatch = {
      id: 'node-1',
      title: 'Updated Title',
    }
    expect(patch.id).toBe('node-1')
    expect(patch.title).toBe('Updated Title')
    expect(patch.content).toBeUndefined()
    expect(patch.attributes).toBeUndefined()
  })

  test('FlatNodePatch can update all fields', () => {
    const patch: FlatNodePatch = {
      id: 'node-1',
      title: 'New Title',
      content: 'New Content',
      attributes: {
        age: 30,
        name: 'John',
        active: true,
      },
    }
    expect(patch.attributes?.age).toBe(30)
    expect(patch.attributes?.name).toBe('John')
    expect(patch.attributes?.active).toBe(true)
  })

  test('FlatJsonPatchRequest batch structure', () => {
    const request: FlatJsonPatchRequest = {
      format: 'flat',
      tableId: 'table-123',
      patches: [
        { id: 'node-1', title: 'Updated 1' },
        { id: 'node-2', content: 'Updated content' },
        { id: 'node-3', attributes: { status: 'active' } },
      ],
    }
    expect(request.format).toBe('flat')
    expect(request.tableId).toBe('table-123')
    expect(request.patches).toHaveLength(3)
  })
})

describe('HFI Protocol Patch Types', () => {
  describe('HFINodePatch', () => {
    test('should support basic node updates', () => {
      const patch: HFINodePatch = {
        id: 'node-1',
        title: 'Updated Flow Node',
        description: 'New description',
        tags: ['important', 'updated'],
      }
      expect(patch.id).toBe('node-1')
      expect(patch.title).toBe('Updated Flow Node')
      expect(patch.tags).toContain('important')
    })

    test('should support position update', () => {
      const patch: HFINodePatch = {
        id: 'node-1',
        position: { x: 100, y: 200 },
      }
      expect(patch.position?.x).toBe(100)
      expect(patch.position?.y).toBe(200)
    })

    test('should support style update', () => {
      const patch: HFINodePatch = {
        id: 'node-1',
        style: {
          backgroundColor: '#ffffff',
          borderColor: '#000000',
          borderWidth: 2,
        },
      }
      expect(patch.style?.backgroundColor).toBe('#ffffff')
      expect(patch.style?.borderWidth).toBe(2)
    })
  })

  describe('PayloadFieldPatch', () => {
    test('should support value update', () => {
      const patch: PayloadFieldPatch = {
        key: 'email',
        value: 'new@example.com',
      }
      expect(patch.key).toBe('email')
      expect(patch.value).toBe('new@example.com')
    })

    test('should support required flag update', () => {
      const patch: PayloadFieldPatch = {
        key: 'phone',
        required: true,
      }
      expect(patch.required).toBe(true)
    })

    test('should support complex value types', () => {
      const arrayPatch: PayloadFieldPatch = {
        key: 'tags',
        value: ['a', 'b', 'c'],
      }
      expect(Array.isArray(arrayPatch.value)).toBe(true)

      const objectPatch: PayloadFieldPatch = {
        key: 'metadata',
        value: { nested: { data: true } },
      }
      expect(typeof objectPatch.value).toBe('object')
    })
  })

  describe('HFIBranchPatch', () => {
    test('should support branch label update', () => {
      const patch: HFIBranchPatch = {
        nodeId: 'query-node-1',
        case: 'success',
        label: 'Operation Successful',
        description: 'When the operation completes successfully',
      }
      expect(patch.nodeId).toBe('query-node-1')
      expect(patch.case).toBe('success')
      expect(patch.label).toBe('Operation Successful')
    })

    test('should support next target update (single)', () => {
      const patch: HFIBranchPatch = {
        nodeId: 'query-node-1',
        case: 'success',
        next: 'next-node-1',
      }
      expect(patch.next).toBe('next-node-1')
    })

    test('should support next target update (multiple)', () => {
      const patch: HFIBranchPatch = {
        nodeId: 'query-node-1',
        case: 'success',
        next: ['next-node-1', 'next-node-2'],
      }
      expect(Array.isArray(patch.next)).toBe(true)
      expect(patch.next).toContain('next-node-1')
    })

    test('should support color update', () => {
      const patch: HFIBranchPatch = {
        nodeId: 'query-node-1',
        case: 'error',
        color: '#ff0000',
      }
      expect(patch.color).toBe('#ff0000')
    })
  })

  describe('HFIRelationPatch', () => {
    test('should support adding relation', () => {
      const patch: HFIRelationPatch = {
        add: {
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
          relationTypeIdentifier: 'depends-on',
        },
      }
      expect(patch.add?.sourceNodeId).toBe('node-1')
      expect(patch.add?.targetNodeId).toBe('node-2')
      expect(patch.add?.relationTypeIdentifier).toBe('depends-on')
    })

    test('should support removing relation', () => {
      const patch: HFIRelationPatch = {
        remove: {
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
          relationTypeIdentifier: 'depends-on',
        },
      }
      expect(patch.remove?.sourceNodeId).toBe('node-1')
      expect(patch.remove?.targetNodeId).toBe('node-2')
    })

    test('should support removing relation without type (removes all)', () => {
      const patch: HFIRelationPatch = {
        remove: {
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
        },
      }
      expect(patch.remove?.relationTypeIdentifier).toBeUndefined()
    })
  })

  describe('HFIStateConnectionPatch', () => {
    test('should support adding state connection', () => {
      const patch: HFIStateConnectionPatch = {
        add: {
          from: 'node-1',
          fromField: 'output',
          to: 'node-2',
          toField: 'input',
        },
      }
      expect(patch.add?.from).toBe('node-1')
      expect(patch.add?.fromField).toBe('output')
      expect(patch.add?.to).toBe('node-2')
      expect(patch.add?.toField).toBe('input')
    })

    test('should support removing state connection', () => {
      const patch: HFIStateConnectionPatch = {
        remove: {
          from: 'node-1',
          to: 'node-2',
        },
      }
      expect(patch.remove?.from).toBe('node-1')
      expect(patch.remove?.to).toBe('node-2')
    })
  })

  describe('HFIProtocolPatchRequest', () => {
    test('should support comprehensive patch request', () => {
      const request: HFIProtocolPatchRequest = {
        format: 'hfi',
        context: 'workflow-1',
        nodes: [
          { id: 'node-1', title: 'Updated Node' },
          { id: 'node-2', payload: [{ key: 'status', value: 'active' }] },
        ],
        branches: [{ nodeId: 'query-1', case: 'success', label: 'Success Path' }],
        relations: [
          {
            add: { sourceNodeId: 'node-1', targetNodeId: 'node-3', relationTypeIdentifier: 'next' },
          },
        ],
        stateConnections: [{ add: { from: 'node-1', fromField: 'output', to: 'node-2', toField: 'input' } }],
      }

      expect(request.format).toBe('hfi')
      expect(request.context).toBe('workflow-1')
      expect(request.nodes).toHaveLength(2)
      expect(request.branches).toHaveLength(1)
      expect(request.relations).toHaveLength(1)
      expect(request.stateConnections).toHaveLength(1)
    })

    test('should support minimal patch request', () => {
      const request: HFIProtocolPatchRequest = {
        format: 'hfi',
        context: 'workflow-1',
      }
      expect(request.nodes).toBeUndefined()
      expect(request.branches).toBeUndefined()
    })
  })
})

describe('Patch Result Types', () => {
  describe('PatchOperationResult', () => {
    test('should represent successful operation', () => {
      const result: PatchOperationResult = {
        success: true,
        targetId: 'node-1',
        operation: 'update',
      }
      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    test('should represent failed operation with error', () => {
      const result: PatchOperationResult = {
        success: false,
        targetId: 'node-1',
        operation: 'update',
        error: 'Node not found',
      }
      expect(result.success).toBe(false)
      expect(result.error).toBe('Node not found')
    })

    test('should support all operation types', () => {
      const updateOp: PatchOperationResult = { success: true, targetId: '1', operation: 'update' }
      const addOp: PatchOperationResult = { success: true, targetId: '2', operation: 'add' }
      const removeOp: PatchOperationResult = { success: true, targetId: '3', operation: 'remove' }

      expect(updateOp.operation).toBe('update')
      expect(addOp.operation).toBe('add')
      expect(removeOp.operation).toBe('remove')
    })
  })

  describe('JsonPatchResult', () => {
    test('should represent successful batch result', () => {
      const result: JsonPatchResult = {
        success: true,
        format: 'flat',
        totalOperations: 3,
        successCount: 3,
        failureCount: 0,
        results: [
          { success: true, targetId: 'node-1', operation: 'update' },
          { success: true, targetId: 'node-2', operation: 'update' },
          { success: true, targetId: 'node-3', operation: 'update' },
        ],
        errors: [],
        warnings: [],
      }
      expect(result.success).toBe(true)
      expect(result.totalOperations).toBe(3)
      expect(result.successCount).toBe(3)
      expect(result.failureCount).toBe(0)
    })

    test('should represent partial failure result', () => {
      const result: JsonPatchResult = {
        success: false,
        format: 'hfi',
        totalOperations: 3,
        successCount: 2,
        failureCount: 1,
        results: [
          { success: true, targetId: 'node-1', operation: 'update' },
          { success: false, targetId: 'node-2', operation: 'update', error: 'Node not found' },
          { success: true, targetId: 'node-3', operation: 'add' },
        ],
        errors: ['Failed to update node-2: Node not found'],
        warnings: [],
      }
      expect(result.success).toBe(false)
      expect(result.failureCount).toBe(1)
      expect(result.errors).toHaveLength(1)
    })

    test('should support warnings', () => {
      const result: JsonPatchResult = {
        success: true,
        format: 'flat',
        totalOperations: 1,
        successCount: 1,
        failureCount: 0,
        results: [{ success: true, targetId: 'node-1', operation: 'update' }],
        errors: [],
        warnings: ['Node had stale data, using server version'],
      }
      expect(result.warnings).toHaveLength(1)
    })
  })
})

describe('JsonPatchRequest Union Type', () => {
  test('should work with type narrowing', () => {
    const flatRequest: JsonPatchRequest = {
      format: 'flat',
      tableId: 'table-1',
      patches: [{ id: 'node-1', title: 'Test' }],
    }

    const hfiRequest: JsonPatchRequest = {
      format: 'hfi',
      context: 'workflow-1',
      nodes: [{ id: 'node-1', title: 'Test' }],
    }

    // Type narrowing with type guards
    if (isFlatJsonPatchRequest(flatRequest)) {
      expect(flatRequest.tableId).toBe('table-1')
      expect(flatRequest.patches).toHaveLength(1)
    }

    if (isHFIProtocolPatchRequest(hfiRequest)) {
      expect(hfiRequest.context).toBe('workflow-1')
      expect(hfiRequest.nodes).toHaveLength(1)
    }
  })

  test('should correctly discriminate between formats', () => {
    const requests: JsonPatchRequest[] = [
      { format: 'flat', tableId: 't1', patches: [] },
      { format: 'hfi', context: 'c1' },
      { format: 'flat', tableId: 't2', patches: [{ id: '1' }] },
    ]

    const flatCount = requests.filter(isFlatJsonPatchRequest).length
    const hfiCount = requests.filter(isHFIProtocolPatchRequest).length

    expect(flatCount).toBe(2)
    expect(hfiCount).toBe(1)
  })
})

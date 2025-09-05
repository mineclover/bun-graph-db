import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import type { Node } from '@/domain/entities/Node.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import { NodeMutations } from '@/presentation/graphql/mutations/NodeMutations.js'

describe('NodeMutations', () => {
  let nodeMutations: NodeMutations
  let mockCreateNodeUseCase: CreateNodeUseCase
  let mockNodeRepository: INodeRepository
  let mockNodeAttributeRepository: INodeAttributeRepository
  let mockLogger: ILogger

  const mockNode: Partial<Node> = {
    getId: () => 'node-1',
    getContent: () => 'Test Node Content',
    getTableId: () => 'table-1',
    getCreatedAt: () => new Date('2024-01-01'),
    getUpdatedAt: () => new Date('2024-01-01'),
  }

  beforeEach(() => {
    mockCreateNodeUseCase = {
      execute: mock(() => Promise.resolve(mockNode as Node)),
    } as any

    mockNodeRepository = {
      findById: mock(() => Promise.resolve(mockNode as Node)),
      update: mock(() => Promise.resolve(mockNode as Node)),
      delete: mock(() => Promise.resolve()),
    } as any

    mockNodeAttributeRepository = {
      save: mock(() => Promise.resolve()),
    } as any

    mockLogger = {
      info: mock(() => {}),
      error: mock(() => {}),
      warn: mock(() => {}),
      debug: mock(() => {}),
    } as any

    nodeMutations = new NodeMutations(
      mockCreateNodeUseCase,
      mockNodeRepository,
      mockNodeAttributeRepository,
      mockLogger
    )
  })

  describe('createNode mutation', () => {
    it('should create node successfully', async () => {
      const createInput = {
        content: 'New Node Content',
        tableId: 'table-1',
        attributes: [{ attributeId: 'attr-1', value: 'value1' }],
      }

      const result = await nodeMutations.createNode({}, { input: createInput })

      expect(result).toEqual({
        success: true,
        node: mockNode as Node,
        errors: [],
      })

      expect(mockCreateNodeUseCase.execute).toHaveBeenCalledWith({
        content: 'New Node Content',
        tableId: 'table-1',
        attributes: [{ attributeId: 'attr-1', value: 'value1' }],
      })
      expect(mockLogger.info).toHaveBeenCalledWith('Creating node', { input: createInput })
    })

    it('should handle creation errors', async () => {
      const createError = new Error('Table not found')
      mockCreateNodeUseCase.execute = mock(() => Promise.reject(createError))

      const result = await nodeMutations.createNode(
        {},
        {
          input: { content: 'Test', tableId: 'nonexistent' },
        }
      )

      expect(result).toEqual({
        success: false,
        node: null,
        errors: [{ message: 'Table not found', code: 'CREATE_NODE_ERROR' }],
      })

      expect(mockLogger.error).toHaveBeenCalledWith('Error creating node', {
        error: createError,
        input: { content: 'Test', tableId: 'nonexistent' },
      })
    })

    it('should handle null result from use case', async () => {
      mockCreateNodeUseCase.execute = mock(() => Promise.resolve({ node: mockNode as Node }))

      const result = await nodeMutations.createNode(
        {},
        {
          input: { content: 'Test', tableId: 'table-1' },
        }
      )

      expect(result).toEqual({
        success: false,
        node: null,
        errors: [],
      })
    })
  })

  describe('updateNode mutation', () => {
    it('should update node successfully', async () => {
      const updateInput = { content: 'Updated Content' }

      const result = await nodeMutations.updateNode(
        {},
        {
          id: 'node-1',
          input: updateInput,
        }
      )

      expect(result).toEqual({
        success: true,
        node: mockNode as Node,
        errors: [],
      })

      expect(mockNodeRepository.findById).toHaveBeenCalledWith('node-1')
      expect(mockNodeRepository.save).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith('Updating node', {
        id: 'node-1',
        input: updateInput,
      })
    })

    it('should handle node not found', async () => {
      mockNodeRepository.findById = mock(() => Promise.resolve(null))

      const result = await nodeMutations.updateNode(
        {},
        {
          id: 'nonexistent',
          input: { content: 'Updated' },
        }
      )

      expect(result).toEqual({
        success: false,
        node: null,
        errors: [{ message: 'Node not found', code: 'NODE_NOT_FOUND' }],
      })

      expect(mockNodeRepository.save).not.toHaveBeenCalled()
    })

    it('should handle update errors', async () => {
      const updateError = new Error('Update failed')
      mockNodeRepository.save = mock(() => Promise.reject(updateError))

      const result = await nodeMutations.updateNode(
        {},
        {
          id: 'node-1',
          input: { content: 'Updated' },
        }
      )

      expect(result).toEqual({
        success: false,
        node: null,
        errors: [{ message: 'Update failed', code: 'UPDATE_NODE_ERROR' }],
      })

      expect(mockLogger.error).toHaveBeenCalledWith('Error updating node', {
        error: updateError,
        id: 'node-1',
        input: { content: 'Updated' },
      })
    })
  })

  describe('deleteNode mutation', () => {
    it('should delete node successfully', async () => {
      const result = await nodeMutations.deleteNode({}, { id: 'node-1' })

      expect(result).toEqual({
        success: true,
        errors: [],
      })

      expect(mockNodeRepository.findById).toHaveBeenCalledWith('node-1')
      expect(mockNodeRepository.delete).toHaveBeenCalledWith('node-1')
      expect(mockLogger.info).toHaveBeenCalledWith('Deleting node', { id: 'node-1' })
    })

    it('should handle node not found for deletion', async () => {
      mockNodeRepository.findById = mock(() => Promise.resolve(null))

      const result = await nodeMutations.deleteNode({}, { id: 'nonexistent' })

      expect(result).toEqual({
        success: false,
        errors: [{ message: 'Node not found', code: 'NODE_NOT_FOUND' }],
      })

      expect(mockNodeRepository.delete).not.toHaveBeenCalled()
    })

    it('should handle deletion errors', async () => {
      const deleteError = new Error('Foreign key constraint')
      mockNodeRepository.delete = mock(() => Promise.reject(deleteError))

      const result = await nodeMutations.deleteNode({}, { id: 'node-1' })

      expect(result).toEqual({
        success: false,
        errors: [{ message: 'Foreign key constraint', code: 'DELETE_NODE_ERROR' }],
      })

      expect(mockLogger.error).toHaveBeenCalledWith('Error deleting node', {
        error: deleteError,
        id: 'node-1',
      })
    })
  })

  describe('setNodeAttribute mutation', () => {
    it('should set node attribute successfully', async () => {
      mockNodeAttributeRepository.save = mock(() => Promise.resolve())

      const result = await nodeMutations.setNodeAttribute(
        {},
        {
          input: {
            nodeId: 'node-1',
            attributeId: 'attr-1',
            value: 'test value',
          },
        }
      )

      expect(result).toEqual({
        success: true,
        nodeAttribute: {
          nodeId: 'node-1',
          attributeId: 'attr-1',
          value: 'test value',
        },
        errors: [],
      })

      expect(mockNodeAttributeRepository.save).toHaveBeenCalled(
        'node-1',
        'attr-1',
        'test value'
      )
      expect(mockLogger.info).toHaveBeenCalledWith('Setting node attribute', {
        input: {
          nodeId: 'node-1',
          attributeId: 'attr-1',
          value: 'test value',
        },
      })
    })

    it('should handle attribute setting errors', async () => {
      const attributeError = new Error('Invalid attribute type')
      mockNodeAttributeRepository.save = mock(() => Promise.reject(attributeError))

      const result = await nodeMutations.setNodeAttribute(
        {},
        {
          input: {
            nodeId: 'node-1',
            attributeId: 'attr-1',
            value: 'invalid',
          },
        }
      )

      expect(result).toEqual({
        success: false,
        nodeAttribute: null,
        errors: [{ message: 'Invalid attribute type', code: 'SET_NODE_ATTRIBUTE_ERROR' }],
      })

      expect(mockLogger.error).toHaveBeenCalledWith('Error setting node attribute', {
        error: attributeError,
        input: {
          nodeId: 'node-1',
          attributeId: 'attr-1',
          value: 'invalid',
        },
      })
    })
  })
})

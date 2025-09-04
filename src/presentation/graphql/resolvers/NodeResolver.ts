import type { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import type { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { ValidationException, NotFoundException, ConflictException } from '@/shared/exceptions/DomainException.js'
import { NodeDto, NodeAttributeDto } from '@/application/dtos/NodeDto.js'
import { TableDto } from '@/application/dtos/TableDto.js'
import { AttributeDto } from '@/application/dtos/AttributeDto.js'
import type { NodeId, TableId, AttributeId } from '@/core/types/CommonTypes.js'
import { NodeAttribute } from '@/domain/entities/NodeAttribute.js'

// Input types matching GraphQL schema
interface CreateNodeInput {
  tableId: string
  content: string
  title?: string
  description?: string
  attributes?: Array<{ attributeId: string; value: unknown }>
}

interface UpdateNodeInput {
  content?: string
  title?: string
  description?: string
}

interface SearchNodesInput {
  tableId: string
  query?: string
  limit?: number
  offset?: number
  sortBy?: Array<{
    field: string
    direction: 'asc' | 'desc'
  }>
}

export class NodeResolver {
  constructor(
    private readonly createNodeUseCase: CreateNodeUseCase,
    private readonly searchNodesUseCase: SearchNodesUseCase,
    private readonly nodeRepository: INodeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly tableRepository: ITableRepository,
    private readonly logger: ILogger
  ) {}

  // Query resolvers
  async node(args: { id: string }): Promise<NodeDto | null> {
    try {
      const node = await this.nodeRepository.findById(args.id as NodeId)
      if (!node) return null

      // Get node attributes
      const nodeAttributes = await this.nodeAttributeRepository.findByNodeId(args.id as NodeId)
      const attributeValues: Record<string, unknown> = {}

      for (const nodeAttr of nodeAttributes) {
        const attribute = await this.attributeRepository.findById(nodeAttr.getAttributeId())
        if (attribute) {
          attributeValues[attribute.getIdentifier()] = nodeAttr.getParsedValue()
        }
      }

      return NodeDto.fromEntity(node, attributeValues)
    } catch (error) {
      this.logger.error('Failed to find node by id', { id: args.id, error })
      throw error
    }
  }

  async nodeByContent(args: { tableId: string; content: string }): Promise<NodeDto | null> {
    try {
      const node = await this.nodeRepository.findByTableIdAndContent(
        args.tableId as TableId,
        args.content
      )
      if (!node) return null

      // Get node attributes
      const nodeAttributes = await this.nodeAttributeRepository.findByNodeId(node.getId())
      const attributeValues: Record<string, unknown> = {}

      for (const nodeAttr of nodeAttributes) {
        const attribute = await this.attributeRepository.findById(nodeAttr.getAttributeId())
        if (attribute) {
          attributeValues[attribute.getIdentifier()] = nodeAttr.getParsedValue()
        }
      }

      return NodeDto.fromEntity(node, attributeValues)
    } catch (error) {
      this.logger.error('Failed to find node by content', { 
        tableId: args.tableId, 
        content: args.content, 
        error 
      })
      throw error
    }
  }

  async nodes(args: { 
    tableId: string
    pagination?: { limit?: number; offset?: number }
  }): Promise<{
    nodes: NodeDto[]
    totalCount: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }> {
    try {
      const { pagination = { limit: 10, offset: 0 } } = args
      
      const result = await this.nodeRepository.findByTableId(
        args.tableId as TableId,
        {
          limit: pagination.limit,
          offset: pagination.offset
        }
      )
      
      // Get attributes for each node
      const nodesWithAttributes = await Promise.all(
        result.data.map(async (node) => {
          const nodeAttributes = await this.nodeAttributeRepository.findByNodeId(node.getId())
          const attributeValues: Record<string, unknown> = {}

          for (const nodeAttr of nodeAttributes) {
            const attribute = await this.attributeRepository.findById(nodeAttr.getAttributeId())
            if (attribute) {
              attributeValues[attribute.getIdentifier()] = nodeAttr.getParsedValue()
            }
          }

          return NodeDto.fromEntity(node, attributeValues)
        })
      )
      
      return {
        nodes: nodesWithAttributes,
        totalCount: result.total,
        hasNextPage: result.hasMore,
        hasPreviousPage: (pagination.offset || 0) > 0
      }
    } catch (error) {
      this.logger.error('Failed to find nodes', { args, error })
      throw error
    }
  }

  async searchNodes(args: { input: SearchNodesInput }): Promise<{
    nodes: NodeDto[]
    totalCount: number
    hasNextPage: boolean
    hasPreviousPage: boolean
    query: {
      originalQuery: string
      parsedConditions: Record<string, unknown>
    }
  }> {
    try {
      const result = await this.searchNodesUseCase.execute({
        tableId: args.input.tableId,
        query: args.input.query,
        limit: args.input.limit,
        offset: args.input.offset,
        sortBy: args.input.sortBy
      })

      return {
        nodes: result.nodes,
        totalCount: result.total,
        hasNextPage: result.hasMore,
        hasPreviousPage: (args.input.offset || 0) > 0,
        query: {
          originalQuery: result.query.originalQuery,
          parsedConditions: result.query.parsed
        }
      }
    } catch (error) {
      this.logger.error('Failed to search nodes', { input: args.input, error })
      throw error
    }
  }

  // Mutation resolvers
  async createNode(args: { input: CreateNodeInput }): Promise<{
    node: NodeDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    try {
      // Convert GraphQL input to use case input
      const attributes: Record<string, unknown> = {}
      if (args.input.attributes) {
        for (const attr of args.input.attributes) {
          // Find attribute to get its identifier
          const attribute = await this.attributeRepository.findById(attr.attributeId as AttributeId)
          if (attribute) {
            attributes[attribute.getIdentifier()] = attr.value
          }
        }
      }

      const result = await this.createNodeUseCase.execute({
        tableId: args.input.tableId,
        content: args.input.content,
        title: args.input.title,
        description: args.input.description,
        attributes
      })

      return {
        node: result.node,
        errors: []
      }
    } catch (error) {
      this.logger.error('Failed to create node', { input: args.input, error })
      
      if (error instanceof ValidationException) {
        return {
          node: null,
          errors: [{ 
            message: error.message, 
            code: error.code,
            field: 'content'
          }]
        }
      }

      if (error instanceof NotFoundException) {
        return {
          node: null,
          errors: [{ 
            message: error.message, 
            code: error.code
          }]
        }
      }

      if (error instanceof ConflictException) {
        return {
          node: null,
          errors: [{ 
            message: error.message, 
            code: error.code,
            field: 'content'
          }]
        }
      }
      
      return {
        node: null,
        errors: [{ 
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'INTERNAL_ERROR'
        }]
      }
    }
  }

  async updateNode(args: { 
    id: string
    input: UpdateNodeInput 
  }): Promise<{
    node: NodeDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    try {
      const node = await this.nodeRepository.findById(args.id as NodeId)
      if (!node) {
        throw new NotFoundException(`Node with id ${args.id} not found`)
      }

      // Update node fields
      let updatedNode = node
      if (args.input.content !== undefined) {
        updatedNode = updatedNode.updateContent(args.input.content)
      }
      if (args.input.title !== undefined) {
        updatedNode = updatedNode.updateTitle(args.input.title)
      }
      if (args.input.description !== undefined) {
        updatedNode = updatedNode.updateDescription(args.input.description)
      }

      // Save updated node
      await this.nodeRepository.save(updatedNode)

      // Get attributes
      const nodeAttributes = await this.nodeAttributeRepository.findByNodeId(args.id as NodeId)
      const attributeValues: Record<string, unknown> = {}

      for (const nodeAttr of nodeAttributes) {
        const attribute = await this.attributeRepository.findById(nodeAttr.getAttributeId())
        if (attribute) {
          attributeValues[attribute.getIdentifier()] = nodeAttr.getParsedValue()
        }
      }

      return {
        node: NodeDto.fromEntity(updatedNode, attributeValues),
        errors: []
      }
    } catch (error) {
      this.logger.error('Failed to update node', { id: args.id, input: args.input, error })
      
      return {
        node: null,
        errors: [{ 
          message: error instanceof Error ? error.message : 'Unknown error',
          code: error instanceof NotFoundException ? 'NOT_FOUND' : 'INTERNAL_ERROR'
        }]
      }
    }
  }

  async deleteNode(args: { id: string }): Promise<{
    success: boolean
    errors: Array<{ message: string; code: string }>
  }> {
    try {
      const node = await this.nodeRepository.findById(args.id as NodeId)
      if (!node) {
        throw new NotFoundException(`Node with id ${args.id} not found`)
      }

      // Delete node attributes first
      await this.nodeAttributeRepository.deleteByNodeId(args.id as NodeId)

      // Delete the node
      await this.nodeRepository.delete(args.id as NodeId)

      return {
        success: true,
        errors: []
      }
    } catch (error) {
      this.logger.error('Failed to delete node', { id: args.id, error })
      
      return {
        success: false,
        errors: [{ 
          message: error instanceof Error ? error.message : 'Unknown error',
          code: error instanceof NotFoundException ? 'NOT_FOUND' : 'INTERNAL_ERROR'
        }]
      }
    }
  }

  async setNodeAttribute(args: { 
    nodeId: string
    attributeId: string
    value: unknown 
  }): Promise<{
    node: NodeDto | null
    errors: Array<{ message: string; code: string }>
  }> {
    try {
      // Verify node exists
      const node = await this.nodeRepository.findById(args.nodeId as NodeId)
      if (!node) {
        throw new NotFoundException(`Node with id ${args.nodeId} not found`)
      }

      // Verify attribute exists
      const attribute = await this.attributeRepository.findById(args.attributeId as AttributeId)
      if (!attribute) {
        throw new NotFoundException(`Attribute with id ${args.attributeId} not found`)
      }

      // Check if node attribute already exists
      const existingNodeAttribute = await this.nodeAttributeRepository.findByNodeIdAndAttributeId(
        args.nodeId as NodeId,
        args.attributeId as AttributeId
      )

      const valueString = typeof args.value === 'string' ? args.value : JSON.stringify(args.value)

      if (existingNodeAttribute) {
        // Update existing
        const updatedNodeAttribute = existingNodeAttribute.updateValue(valueString)
        await this.nodeAttributeRepository.update(updatedNodeAttribute)
      } else {
        // Create new
        const nodeAttribute = NodeAttribute.create(
          args.nodeId as NodeId,
          args.attributeId as AttributeId,
          valueString
        )
        await this.nodeAttributeRepository.save(nodeAttribute)
      }

      // Return updated node with all attributes
      const nodeAttributes = await this.nodeAttributeRepository.findByNodeId(args.nodeId as NodeId)
      const attributeValues: Record<string, unknown> = {}

      for (const nodeAttr of nodeAttributes) {
        const attr = await this.attributeRepository.findById(nodeAttr.getAttributeId())
        if (attr) {
          attributeValues[attr.getIdentifier()] = nodeAttr.getParsedValue()
        }
      }

      return {
        node: NodeDto.fromEntity(node, attributeValues),
        errors: []
      }
    } catch (error) {
      this.logger.error('Failed to set node attribute', { 
        nodeId: args.nodeId,
        attributeId: args.attributeId,
        error 
      })
      
      return {
        node: null,
        errors: [{ 
          message: error instanceof Error ? error.message : 'Unknown error',
          code: error instanceof NotFoundException ? 'NOT_FOUND' : 'INTERNAL_ERROR'
        }]
      }
    }
  }

  // Field resolvers
  async table_field(node: NodeDto): Promise<TableDto | null> {
    try {
      const table = await this.tableRepository.findById(node.tableId as TableId)
      return table ? TableDto.fromEntity(table) : null
    } catch (error) {
      this.logger.error('Failed to resolve table field', { nodeId: node.id, error })
      return null
    }
  }

  async attributeCount_field(node: NodeDto): Promise<number> {
    try {
      const nodeAttributes = await this.nodeAttributeRepository.findByNodeId(node.id as NodeId)
      return nodeAttributes.length
    } catch (error) {
      this.logger.error('Failed to resolve attribute count', { nodeId: node.id, error })
      return 0
    }
  }

  async attributes_field(node: NodeDto): Promise<NodeAttributeDto[]> {
    try {
      const nodeAttributes = await this.nodeAttributeRepository.findByNodeId(node.id as NodeId)
      return NodeAttributeDto.fromEntities(nodeAttributes)
    } catch (error) {
      this.logger.error('Failed to resolve node attributes', { nodeId: node.id, error })
      return []
    }
  }
}
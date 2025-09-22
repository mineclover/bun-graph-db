import {
  type NodeAttributeDto,
  type NodeDto,
  nodeAttributeFromEntities,
  fromEntity as nodeFromEntity,
} from '@/application/dtos/NodeDto.js'
import { type TableDto, fromEntity as tableFromEntity } from '@/application/dtos/TableDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import type { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import type { AttributeId, NodeId, TableId } from '@/core/types/CommonTypes.js'
import type { GraphQLContext } from '@/core/types/GraphQLTypes.js'
import { NodeAttribute } from '@/domain/entities/NodeAttribute.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'
import { NotFoundException } from '@/shared/exceptions/DomainException.js'

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

export class NodeResolver extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly createNodeUseCase: CreateNodeUseCase,
    private readonly searchNodesUseCase: SearchNodesUseCase,
    private readonly nodeRepository: INodeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly tableRepository: ITableRepository,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  // Query resolvers
  async node(args: { id: string }, _context?: GraphQLContext): Promise<NodeDto | null> {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Node ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Node ID'),
      ],
      'node'
    )

    return this.handleQuery(
      async () => {
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

        return nodeFromEntity(node, attributeValues)
      },
      'findNodeById',
      { id: args.id }
    )
  }

  async nodeByContent(
    args: { tableId: string; content: string },
    _context?: GraphQLContext
  ): Promise<NodeDto | null> {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.required('content', 'Content'),
        BaseResolver.validationRules.nonEmpty('content', 'Content'),
      ],
      'nodeByContent'
    )

    return this.handleQuery(
      async () => {
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

        return nodeFromEntity(node, attributeValues)
      },
      'findNodeByContent',
      { tableId: args.tableId, content: args.content }
    )
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

      const result = await this.nodeRepository.findByTableId(args.tableId as TableId, {
        limit: pagination.limit,
        offset: pagination.offset,
      })

      // Check if result.data exists
      if (!result.data) {
        this.logger.warn('No data returned from nodeRepository.findByTableId', {
          tableId: args.tableId,
        })
        return {
          nodes: [],
          totalCount: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        }
      }

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

          return nodeFromEntity(node, attributeValues)
        })
      )

      return {
        nodes: nodesWithAttributes,
        totalCount: result.total ?? 0,
        hasNextPage: result.hasMore ?? false,
        hasPreviousPage: (pagination.offset || 0) > 0,
      }
    } catch (error) {
      this.logger.error('Failed to find nodes', { args, ...toErrorMeta(error) })
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
        sortBy: args.input.sortBy,
      })

      return {
        nodes: result.nodes,
        totalCount: result.total,
        hasNextPage: result.hasMore,
        hasPreviousPage: (args.input.offset ?? 0) > 0,
        query: {
          originalQuery: result.query.originalQuery,
          parsedConditions: (result.query.parsed as unknown as Record<string, unknown>) || {},
        },
      }
    } catch (error) {
      this.logger.error('Failed to search nodes', { input: args.input, ...toErrorMeta(error) })
      throw error
    }
  }

  // Mutation resolvers
  async createNode(
    args: { input: CreateNodeInput },
    _context?: GraphQLContext
  ): Promise<{
    success: boolean
    data?: NodeDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    this.validateArgs(
      args.input as any,
      [
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.required('content', 'Content'),
        BaseResolver.validationRules.nonEmpty('content', 'Content'),
      ],
      'createNode'
    )

    const result = await this.handleMutation(
      async () => {
        // Convert GraphQL input to use case input
        const attributes: Record<string, unknown> = {}
        if (args.input.attributes) {
          for (const attr of args.input.attributes) {
            // Find attribute to get its identifier
            const attribute = await this.attributeRepository.findById(
              attr.attributeId as AttributeId
            )
            if (attribute) {
              attributes[attribute.getIdentifier()] = attr.value
            }
          }
        }

        const useCaseResult = await this.createNodeUseCase.execute({
          tableId: args.input.tableId,
          content: args.input.content,
          title: args.input.title,
          description: args.input.description,
          attributes,
        })

        return useCaseResult.node
      },
      'createNode',
      { input: args.input }
    )

    return {
      success: result.success,
      data: result.data,
      errors: result.errors,
    }
  }

  async updateNode(args: { id: string; input: UpdateNodeInput }): Promise<{
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
        node: nodeFromEntity(updatedNode, attributeValues),
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to update node', { id: args.id, input: args.input, ...toErrorMeta(error) })

      return {
        node: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: error instanceof NotFoundException ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  async deleteNode(
    args: { id: string },
    _context?: GraphQLContext
  ): Promise<{
    success: boolean
    data?: boolean
    errors: Array<{ message: string; code: string }>
  }> {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Node ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Node ID'),
      ],
      'deleteNode'
    )

    const result = await this.handleMutation(
      async () => {
        const node = await this.nodeRepository.findById(args.id as NodeId)
        if (!node) {
          throw new NotFoundException(`Node with id ${args.id} not found`)
        }

        // Delete node attributes first
        await this.nodeAttributeRepository.deleteByNodeId(args.id as NodeId)

        // Delete the node
        await this.nodeRepository.delete(args.id as NodeId)

        return true
      },
      'deleteNode',
      { id: args.id }
    )

    return {
      success: result.success,
      data: result.success && result.data ? result.data : undefined,
      errors: result.errors,
    }
  }

  async setNodeAttribute(args: { nodeId: string; attributeId: string; value: unknown }): Promise<{
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
        node: nodeFromEntity(node, attributeValues),
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to set node attribute', {
        nodeId: args.nodeId,
        attributeId: args.attributeId,
        ...toErrorMeta(error),
      })

      return {
        node: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: error instanceof NotFoundException ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  // Field resolvers
  async table_field(node: NodeDto, _context?: GraphQLContext): Promise<TableDto | null> {
    return this.handleFieldResolution(
      async () => {
        const table = await this.tableRepository.findById(node.tableId as TableId)
        return table ? tableFromEntity(table) : null
      },
      'table',
      'Node',
      { nodeId: node.id }
    )
  }

  async attributeCount_field(node: NodeDto, _context?: GraphQLContext): Promise<number> {
    const result = await this.handleFieldResolution(
      async () => {
        const nodeAttributes = await this.nodeAttributeRepository.findByNodeId(node.id as NodeId)
        return nodeAttributes.length
      },
      'attributeCount',
      'Node',
      { nodeId: node.id }
    )
    return result ?? 0
  }

  async attributes_field(node: NodeDto, _context?: GraphQLContext): Promise<NodeAttributeDto[]> {
    const result = await this.handleFieldResolution(
      async () => {
        const nodeAttributes = await this.nodeAttributeRepository.findByNodeId(node.id as NodeId)
        return nodeAttributeFromEntities(nodeAttributes)
      },
      'attributes',
      'Node',
      { nodeId: node.id }
    )
    return result ?? []
  }
}

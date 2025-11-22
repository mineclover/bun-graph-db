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
import type { Attribute } from '@/domain/entities/Attribute.js'
import { NodeAttribute } from '@/domain/entities/NodeAttribute.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
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

interface CreatePersonNodeInput {
  content: string
  name: string
  age: string
  testName?: string
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
    private readonly tableRepository: ITableRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly nodeRelationRepository: INodeRelationRepository,
    private readonly attributeRepository: IAttributeRepository,
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

  async createPersonNode(
    args: { input: CreatePersonNodeInput },
    _context?: GraphQLContext
  ): Promise<{
    success: boolean
    node?: NodeDto | null
    attributes: NodeAttributeDto[]
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    this.validateArgs(
      args.input as any,
      [
        BaseResolver.validationRules.required('content', 'Content'),
        BaseResolver.validationRules.required('name', 'Name'),
        BaseResolver.validationRules.required('age', 'Age'),
        BaseResolver.validationRules.nonEmpty('content', 'Content'),
        BaseResolver.validationRules.nonEmpty('name', 'Name'),
        BaseResolver.validationRules.nonEmpty('age', 'Age'),
      ],
      'createPersonNode'
    )

    const result = await this.handleMutation(
      async () => {
        // Step 1: Create the node
        const nodeResult = await this.createNodeUseCase.execute({
          tableId: '267', // Table 267 is hardcoded for person nodes
          content: args.input.content,
          title: undefined,
          description: undefined,
          attributes: {},
        })

        if (!nodeResult.node) {
          throw new Error('Failed to create node')
        }

        const createdNode = nodeResult.node
        const nodeAttributeDtos: NodeAttributeDto[] = []

        // Step 2: Set attributes based on input
        const attributesToSet = []

        // Always set name and age
        attributesToSet.push({ identifier: 'name', value: args.input.name })
        attributesToSet.push({ identifier: 'age', value: args.input.age })

        // Optionally set testName if provided
        if (args.input.testName) {
          attributesToSet.push({ identifier: 'test_name', value: args.input.testName })
        }

        // Set each attribute
        for (const attrToSet of attributesToSet) {
          try {
            // Find attribute by identifier
            const attributes = await this.attributeRepository.findByTableId('267' as TableId)
            const attribute = attributes.nodes.find((attr: Attribute) => attr.getIdentifier() === attrToSet.identifier)

            if (attribute) {
              // Create node attribute
              const nodeAttribute = NodeAttribute.create(
                createdNode.id as NodeId,
                attribute.getId(),
                attrToSet.value
              )
              await this.nodeAttributeRepository.save(nodeAttribute)

              // Convert to DTO for response
              const nodeAttrDto = nodeAttributeFromEntities([nodeAttribute])[0]
              if (nodeAttrDto) {
                nodeAttributeDtos.push(nodeAttrDto)
              }
            } else {
              this.logger.warn(`Attribute '${attrToSet.identifier}' not found in table 267`)
            }
          } catch (error) {
            this.logger.error(`Failed to set attribute '${attrToSet.identifier}'`, {
              nodeId: createdNode.id,
              error: toErrorMeta(error)
            })
          }
        }

        return { node: createdNode, attributes: nodeAttributeDtos }
      },
      'createPersonNode',
      { input: args.input }
    )

    return {
      success: result.success,
      node: result.data?.node,
      attributes: result.data?.attributes || [],
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
      this.logger.error('Failed to update node', {
        id: args.id,
        input: args.input,
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

  // Relation field resolvers
  async outgoingRelations_field(node: NodeDto, _context?: GraphQLContext): Promise<any[]> {
    const result = await this.handleFieldResolution(
      async () => {
        return await this.nodeRelationRepository.findBySourceNodeId(node.id as NodeId)
      },
      'outgoingRelations',
      'Node',
      { nodeId: node.id }
    )
    return result ?? []
  }

  async incomingRelations_field(node: NodeDto, _context?: GraphQLContext): Promise<any[]> {
    const result = await this.handleFieldResolution(
      async () => {
        return await this.nodeRelationRepository.findByTargetNodeId(node.id as NodeId)
      },
      'incomingRelations',
      'Node',
      { nodeId: node.id }
    )
    return result ?? []
  }

  async relationCount_field(node: NodeDto, _context?: GraphQLContext): Promise<number> {
    const result = await this.handleFieldResolution(
      async () => {
        const outgoingCount = await this.nodeRelationRepository.countBySourceNodeId(node.id as NodeId)
        const incomingCount = await this.nodeRelationRepository.countByTargetNodeId(node.id as NodeId)
        return outgoingCount + incomingCount
      },
      'relationCount',
      'Node',
      { nodeId: node.id }
    )
    return result ?? 0
  }

  // Graph traversal field resolvers
  async connectedNodes_field(
    node: NodeDto,
    args?: {
      depth?: number
      direction?: 'OUTGOING' | 'INCOMING' | 'BOTH'
      relationTypes?: string[]
    },
    _context?: GraphQLContext
  ): Promise<any[]> {
    this.logger.info('connectedNodes field resolver called', {
      parentId: node.id,
      args,
    })

    try {
      const depth = args?.depth || 1
      const direction = args?.direction || 'BOTH'
      const relationTypes = args?.relationTypes

      const visited = new Set<string>()
      const result: any[] = []

      await this._traverseGraph(node.id as NodeId, depth, direction, relationTypes, visited, result, 0)

      // Extract just the nodes from the result objects
      // Filter out the starting node itself and only return connected nodes
      const connectedNodes = result
        .filter((item) => item.node && item.node.getId() !== node.id)
        .map((item) => item.node)
        .filter((n) => n !== null)

      this.logger.info('connectedNodes field resolver result', {
        parentId: node.id,
        resultLength: result.length,
        connectedNodesLength: connectedNodes.length,
      })

      return connectedNodes
    } catch (error) {
      this.logger.error('Error in connectedNodes field resolver', {
        error,
        nodeId: node.id,
        args,
      })
      // Always return empty array for GraphQL non-nullable field
      this.logger.info('Returning empty array due to error')
      return []
    }
  }

  async shortestPath_field(
    node: NodeDto,
    args: { targetNodeId: string; maxDepth?: number },
    _context?: GraphQLContext
  ): Promise<any[]> {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('targetNodeId', 'Target Node ID'),
        BaseResolver.validationRules.nonEmpty('targetNodeId', 'Target Node ID'),
      ],
      'shortestPath'
    )

    const result = await this.handleFieldResolution(
      async () => {
        const { targetNodeId, maxDepth = 6 } = args
        const path = await this._findShortestPath(node.id as NodeId, targetNodeId as NodeId, maxDepth)

        // Return just the nodes array
        return path ? path.nodes : []
      },
      'shortestPath',
      'Node',
      { sourceNodeId: node.id, targetNodeId: args.targetNodeId }
    )
    return result ?? []
  }

  // Private helper methods for graph traversal
  private async _traverseGraph(
    nodeId: NodeId,
    remainingDepth: number,
    direction: 'OUTGOING' | 'INCOMING' | 'BOTH',
    relationTypes: string[] | undefined,
    visited: Set<string>,
    result: any[],
    currentDepth: number
  ): Promise<void> {
    if (remainingDepth <= 0 || visited.has(nodeId)) return

    visited.add(nodeId)
    const node = await this.nodeRepository.findById(nodeId)
    if (!node) return

    result.push({
      node,
      depth: currentDepth,
      path: Array.from(visited),
    })

    // Get related relations
    const relations: any[] = []

    if (direction === 'OUTGOING' || direction === 'BOTH') {
      const outgoing = await this.nodeRelationRepository.findBySourceNodeId(nodeId)
      relations.push(...outgoing)
    }

    if (direction === 'INCOMING' || direction === 'BOTH') {
      const incoming = await this.nodeRelationRepository.findByTargetNodeId(nodeId)
      relations.push(...incoming)
    }

    // Filter by relationTypes if specified
    const filteredRelations = relationTypes
      ? relations.filter((rel) => relationTypes.includes(rel.getRelationTypeId()))
      : relations

    // Traverse next level
    for (const relation of filteredRelations) {
      const nextNodeId =
        relation.getSourceNodeId() === nodeId
          ? relation.getTargetNodeId()
          : relation.getSourceNodeId()

      if (nextNodeId) {
        await this._traverseGraph(
          nextNodeId as NodeId,
          remainingDepth - 1,
          direction,
          relationTypes,
          visited,
          result,
          currentDepth + 1
        )
      }
    }
  }

  private async _findShortestPath(
    sourceId: NodeId,
    targetId: NodeId,
    maxDepth: number
  ): Promise<{ nodes: any[]; relations: any[]; distance: number } | null> {
    const queue: Array<{ nodeId: NodeId; path: NodeId[]; relations: any[]; depth: number }> = [
      { nodeId: sourceId, path: [sourceId], relations: [], depth: 0 },
    ]
    const visited = new Set<string>()

    while (queue.length > 0) {
      const current = queue.shift()!

      if (current.nodeId === targetId) {
        // Path found
        const nodes = await Promise.all(current.path.map((id) => this.nodeRepository.findById(id)))
        return {
          nodes: nodes.filter((node) => node !== null),
          relations: current.relations,
          distance: current.depth,
        }
      }

      if (current.depth >= maxDepth || visited.has(current.nodeId)) {
        continue
      }

      visited.add(current.nodeId)

      // Explore connected nodes
      const outgoing = await this.nodeRelationRepository.findBySourceNodeId(current.nodeId)
      const incoming = await this.nodeRelationRepository.findByTargetNodeId(current.nodeId)

      const allRelations = [...outgoing, ...incoming]

      for (const relation of allRelations) {
        const nextNodeId =
          relation.getSourceNodeId() === current.nodeId
            ? relation.getTargetNodeId()
            : relation.getSourceNodeId()

        if (nextNodeId && !visited.has(nextNodeId) && !current.path.includes(nextNodeId as NodeId)) {
          queue.push({
            nodeId: nextNodeId as NodeId,
            path: [...current.path, nextNodeId as NodeId],
            relations: [...current.relations, relation],
            depth: current.depth + 1,
          })
        }
      }
    }

    return null // No path found
  }
}

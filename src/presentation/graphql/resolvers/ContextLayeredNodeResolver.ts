import type { GraphQLContext } from '@/core/types/GraphQLTypes.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'
import { NodeDto } from '@/application/dtos/NodeDto.js'
import { TableDto } from '@/application/dtos/TableDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { 
  GraphHandlerDependencies,
  GraphOperations,
  CreateNodeInput as ContextNodeInput,
  SearchNodesInput as ContextSearchInput
} from '@/context-layered'
import { 
  createGraphHandlers, 
  createGraphActions,
  createInitialGraphState
} from '@/context-layered'

// GraphQL input types (compatible with existing schema)
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

/**
 * Context-layered version of NodeResolver
 * This demonstrates how to migrate existing GraphQL resolvers to use context-layered architecture
 * while maintaining compatibility with existing GraphQL schema
 */
export class ContextLayeredNodeResolver extends BaseResolver {
  private handlers: ReturnType<typeof createGraphHandlers>
  private actions: ReturnType<typeof createGraphActions>
  private state = createInitialGraphState()

  constructor(
    private readonly dependencies: GraphHandlerDependencies,
    private readonly logger: ILogger
  ) {
    super()
    
    // Create handlers with injected dependencies
    this.handlers = createGraphHandlers(dependencies)
    
    // Create actions with state management
    this.actions = createGraphActions({
      handlers: this.handlers,
      state: this.state,
      setState: (updater) => {
        this.state = updater(this.state)
      },
      onStateChange: (event) => {
        this.logger.info('Context-layered state change', { event })
      }
    })
  }

  // Query resolvers using context-layered handlers
  async node(args: { id: string }, context?: GraphQLContext): Promise<NodeDto | null> {
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
        const node = await this.handlers.findNodeById(args.id)
        if (!node) return null
        
        // Convert domain entity to DTO for GraphQL compatibility
        return this.convertNodeToDto(node)
      },
      'findNodeById',
      { id: args.id }
    )
  }

  async nodeByContent(
    args: { tableId: string; content: string },
    context?: GraphQLContext
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
        // Find table first to validate
        const table = await this.handlers.findTableById(args.tableId)
        if (!table) {
          throw new Error(`Table with id '${args.tableId}' not found`)
        }

        // Get all nodes from the table
        const nodesResult = await this.handlers.searchNodes({
          tableId: args.tableId,
          query: args.content, // Use content as search query
          limit: 100
        })

        if (!nodesResult.success || !nodesResult.data) {
          return null
        }

        // Find exact content match
        const exactMatch = nodesResult.data.nodes?.find(node => 
          node.getContent() === args.content
        )

        return exactMatch ? this.convertNodeToDto(exactMatch) : null
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
    const { pagination = { limit: 10, offset: 0 } } = args

    return this.handleQuery(
      async () => {
        const result = await this.handlers.searchNodes({
          tableId: args.tableId,
          limit: pagination.limit || 10,
          offset: pagination.offset || 0
        })

        if (!result.success || !result.data) {
          this.logger.warn('No data returned from searchNodes', {
            tableId: args.tableId,
          })
          return {
            nodes: [],
            totalCount: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          }
        }

        const paginatedResult = result.data
        const nodes = (paginatedResult.nodes || paginatedResult.data || [])
          .map(node => this.convertNodeToDto(node))

        return {
          nodes,
          totalCount: paginatedResult.totalCount || paginatedResult.total || 0,
          hasNextPage: paginatedResult.hasNextPage || paginatedResult.hasMore || false,
          hasPreviousPage: (pagination.offset || 0) > 0,
        }
      },
      'findNodesByTableId',
      { tableId: args.tableId, pagination }
    )
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
    return this.handleQuery(
      async () => {
        const result = await this.handlers.searchNodes({
          tableId: args.input.tableId,
          query: args.input.query,
          limit: args.input.limit,
          offset: args.input.offset
        })

        if (!result.success || !result.data) {
          throw new Error(`Search failed: ${result.error?.message || 'Unknown error'}`)
        }

        const searchResult = result.data
        const nodes = (searchResult.nodes || searchResult.data || [])
          .map(node => this.convertNodeToDto(node))

        return {
          nodes,
          totalCount: searchResult.totalCount || searchResult.total || 0,
          hasNextPage: searchResult.hasNextPage || searchResult.hasMore || false,
          hasPreviousPage: (args.input.offset ?? 0) > 0,
          query: {
            originalQuery: args.input.query || '',
            parsedConditions: {}, // Could be enhanced with actual parsing
          },
        }
      },
      'searchNodes',
      { input: args.input }
    )
  }

  // Mutation resolvers using context-layered actions
  async createNode(
    args: { input: CreateNodeInput },
    context?: GraphQLContext
  ): Promise<{
    success: boolean
    data?: NodeDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    this.validateArgs(
      args.input,
      [
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.required('content', 'Content'),
        BaseResolver.validationRules.nonEmpty('content', 'Content'),
      ],
      'createNode'
    )

    const result = await this.handleMutation(
      async () => {
        // Convert GraphQL input to context-layered input
        const contextInput: ContextNodeInput = {
          tableId: args.input.tableId,
          content: args.input.content,
          title: args.input.title,
          description: args.input.description,
          attributes: {} // TODO: Convert attributes if needed
        }

        const actionResult = await this.actions.createNode(contextInput)
        
        if (!actionResult.success || !actionResult.data) {
          throw actionResult.error || new Error('Failed to create node')
        }

        return this.convertNodeToDto(actionResult.data)
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
    return this.handleMutation(
      async () => {
        const actionResult = await this.actions.updateNode(args.id, {
          content: args.input.content,
          title: args.input.title,
          description: args.input.description
        })

        if (!actionResult.success || !actionResult.data) {
          throw actionResult.error || new Error('Failed to update node')
        }

        return this.convertNodeToDto(actionResult.data)
      },
      'updateNode',
      { id: args.id, input: args.input }
    ).then(result => ({
      node: result.success ? result.data : null,
      errors: result.success ? [] : result.errors
    }))
  }

  async deleteNode(
    args: { id: string },
    context?: GraphQLContext
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
        const actionResult = await this.actions.deleteNode(args.id)
        
        if (!actionResult.success) {
          throw actionResult.error || new Error('Failed to delete node')
        }

        return true
      },
      'deleteNode',
      { id: args.id }
    )

    return {
      success: result.success,
      data: result.success ? true : undefined,
      errors: result.errors,
    }
  }

  // Field resolvers
  async table_field(node: NodeDto, context?: GraphQLContext): Promise<TableDto | null> {
    return this.handleFieldResolution(
      async () => {
        const table = await this.handlers.findTableById(node.tableId)
        return table ? this.convertTableToDto(table) : null
      },
      'table',
      'Node',
      { nodeId: node.id }
    )
  }

  async attributeCount_field(node: NodeDto, context?: GraphQLContext): Promise<number> {
    const result = await this.handleFieldResolution(
      async () => {
        // This would need to be implemented in handlers
        // For now, return the count from the node DTO
        return Object.keys(node.attributes || {}).length
      },
      'attributeCount',
      'Node',
      { nodeId: node.id }
    )
    return result ?? 0
  }

  // Helper methods for conversion
  private convertNodeToDto(node: any): NodeDto {
    // Convert domain Node entity to NodeDto
    return {
      id: node.getId(),
      tableId: node.getTableId(),
      content: node.getContent(),
      title: node.getTitle(),
      description: node.getDescription(),
      createdAt: node.getCreatedAt(),
      updatedAt: node.getUpdatedAt(),
      attributes: {} // TODO: Populate attributes
    }
  }

  private convertTableToDto(table: any): TableDto {
    // Convert domain Table entity to TableDto
    return {
      id: table.getId(),
      identifier: table.identifier,
      description: table.description,
      qualityWeight: table.qualityWeight || 1.0,
      createdAt: table.getCreatedAt(),
      updatedAt: table.getUpdatedAt()
    }
  }
}

// Factory function for easy integration with existing DI container
export const createContextLayeredNodeResolver = (
  dependencies: GraphHandlerDependencies,
  logger: ILogger
) => {
  return new ContextLayeredNodeResolver(dependencies, logger)
}

// Migration helper to gradually switch from old to new resolver
export class HybridNodeResolver extends BaseResolver {
  constructor(
    private readonly oldResolver: any, // Original NodeResolver
    private readonly newResolver: ContextLayeredNodeResolver,
    private readonly logger: ILogger,
    private readonly useNewResolver: boolean = false // Feature flag
  ) {
    super()
  }

  // Delegate methods to the appropriate resolver
  async node(args: { id: string }, context?: GraphQLContext) {
    if (this.useNewResolver) {
      this.logger.info('Using context-layered resolver for node query')
      return this.newResolver.node(args, context)
    } else {
      this.logger.info('Using legacy resolver for node query')
      return this.oldResolver.node(args, context)
    }
  }

  async createNode(args: { input: CreateNodeInput }, context?: GraphQLContext) {
    if (this.useNewResolver) {
      this.logger.info('Using context-layered resolver for createNode mutation')
      return this.newResolver.createNode(args, context)
    } else {
      this.logger.info('Using legacy resolver for createNode mutation')
      return this.oldResolver.createNode(args, context)
    }
  }

  // Add other methods as needed...
  // This allows for gradual migration by switching the feature flag
}
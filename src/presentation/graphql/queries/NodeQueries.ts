import type { ILogger } from '@/application/ports/ILogger.js'
import type { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import type {
  GraphQLContext,
  GraphQLParent,
  NodeArgs,
  NodeByContentArgs,
  NodesArgs,
  SearchNodesArgs,
} from '@/core/types/GraphQLTypes.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'

interface AttributeFilter {
  attributeId?: string
  identifier?: string
  value: string
  operator?: string
}

export class NodeQueries extends BaseResolver {
  protected logger: ILogger
  private searchNodesUseCase: SearchNodesUseCase | null = null
  private attributeRepository: IAttributeRepository | null = null

  constructor(
    private readonly nodeRepository: INodeRepository,
    private readonly searchNodesUseCaseResolver:
      | (() => Promise<SearchNodesUseCase | null>)
      | SearchNodesUseCase
      | null,
    logger: ILogger,
    attributeRepository?: IAttributeRepository
  ) {
    super()
    this.logger = logger
    this.attributeRepository = attributeRepository || null
    // Handle both direct instance and resolver function
    if (typeof searchNodesUseCaseResolver === 'function') {
      // Lazy load the use case when first needed
      this.searchNodesUseCase = null
    } else {
      this.searchNodesUseCase = searchNodesUseCaseResolver
    }
  }

  /**
   * Convert attributeFilters to query string format
   * Supports both attributeId and identifier
   */
  private async buildQueryFromFilters(
    tableId: string,
    attributeFilters: AttributeFilter[],
    existingQuery?: string
  ): Promise<string> {
    const queryParts: string[] = existingQuery ? [existingQuery] : []

    for (const filter of attributeFilters) {
      let attrIdentifier = filter.identifier

      // If identifier not provided but attributeId is, we need to look up the identifier
      if (!attrIdentifier && filter.attributeId && this.attributeRepository) {
        try {
          const attr = await this.attributeRepository.findById(filter.attributeId)
          attrIdentifier = attr?.getIdentifier()
        } catch {
          this.logger.warn('Failed to resolve attribute identifier', {
            attributeId: filter.attributeId,
          })
        }
      }

      if (!attrIdentifier) {
        this.logger.warn('AttributeFilter missing both identifier and valid attributeId', {
          filter,
        })
        continue
      }

      // Build query part based on operator
      const operator = filter.operator || 'EQUALS'
      let queryPart: string

      switch (operator) {
        case 'EQUALS':
          queryPart = `${attrIdentifier}:"${filter.value}"`
          break
        case 'CONTAINS':
          queryPart = `${attrIdentifier}:*${filter.value}*`
          break
        case 'STARTS_WITH':
          queryPart = `${attrIdentifier}:${filter.value}*`
          break
        case 'ENDS_WITH':
          queryPart = `${attrIdentifier}:*${filter.value}`
          break
        case 'GREATER_THAN':
          queryPart = `${attrIdentifier}:>${filter.value}`
          break
        case 'GREATER_THAN_OR_EQUAL':
          queryPart = `${attrIdentifier}:>=${filter.value}`
          break
        case 'LESS_THAN':
          queryPart = `${attrIdentifier}:<${filter.value}`
          break
        case 'LESS_THAN_OR_EQUAL':
          queryPart = `${attrIdentifier}:<=${filter.value}`
          break
        default:
          queryPart = `${attrIdentifier}:"${filter.value}"`
      }

      queryParts.push(queryPart)
    }

    return queryParts.join(' AND ')
  }

  async node(_: GraphQLParent, args: NodeArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as any,
      [
        BaseResolver.validationRules.required('id', 'Node ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Node ID'),
      ],
      'node'
    )

    return this.handleQuery(
      async () => {
        const node = await this.nodeRepository.findById(args.id)
        this.logger.info(`Repository findById result for ${args.id}:`, {
          node: node
            ? {
                id: node.getId ? node.getId() : 'no getId method',
                content: node.getContent ? node.getContent() : 'no getContent method',
                type: typeof node,
                constructor: node.constructor?.name,
                keys: Object.keys(node),
              }
            : null,
        })
        return node
      },
      'findNodeById',
      { id: args.id }
    )
  }

  async nodeByContent(_: GraphQLParent, args: NodeByContentArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as any,
      [
        BaseResolver.validationRules.required('content', 'Content'),
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('content', 'Content'),
      ],
      'nodeByContent'
    )

    return this.handleQuery(
      async () => {
        // Ensure tableId is not undefined before passing to repository
        if (!args.tableId) {
          throw new Error('Table ID is required')
        }
        return await this.nodeRepository.findByTableIdAndContent(args.tableId, args.content)
      },
      'findNodeByContent',
      { content: args.content, tableId: args.tableId }
    )
  }

  async nodes(_: GraphQLParent, args: NodesArgs, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        try {
          const result = await this.nodeRepository.findAll(
            args.pagination || { limit: 10, offset: 0 }
          )

          // Check if result is properly formatted
          if (!result || !result.nodes) {
            this.logger.warn('Invalid result from nodeRepository.findAll', { result })
            return {
              nodes: [],
              totalCount: 0,
              hasNextPage: false,
              hasPreviousPage: false,
            }
          }

          return {
            nodes: result.nodes,
            totalCount: result.totalCount || 0,
            hasNextPage: result.hasNextPage || false,
            hasPreviousPage: result.hasPreviousPage || false,
          }
        } catch (error) {
          this.logger.error('Error in nodes query', { args, ...toErrorMeta(error) })
          throw error
        }
      },
      'findAllNodes',
      { args }
    )
  }

  async searchNodes(_: GraphQLParent, args: SearchNodesArgs, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        // Lazy load SearchNodesUseCase if needed
        if (!this.searchNodesUseCase && typeof this.searchNodesUseCaseResolver === 'function') {
          this.searchNodesUseCase = await this.searchNodesUseCaseResolver()
        }

        // Fallback to basic findAll when SearchNodesUseCase is not available
        if (!this.searchNodesUseCase) {
          this.logger.warn('SearchNodesUseCase not available, using basic node listing')
          const result = await this.nodeRepository.findAll(
            args.pagination || { limit: 10, offset: 0 }
          )

          // Ensure all fields are non-null to satisfy GraphQL schema
          return {
            nodes: result.nodes || [],
            totalCount: result.totalCount || 0,
            hasNextPage: result.hasNextPage || false,
            hasPreviousPage: result.hasPreviousPage || false,
          }
        }

        // Transform GraphQL args to SearchNodesInput format
        // Prioritize the new 'query' field over legacy 'search' field
        let queryString = args.filter?.query || args.filter?.search

        // Handle attributeFilters - convert to query string format
        if (args.filter?.attributeFilters && args.filter.attributeFilters.length > 0) {
          const tableId = args.filter?.tableId || ''
          queryString = await this.buildQueryFromFilters(
            tableId,
            args.filter.attributeFilters as AttributeFilter[],
            queryString
          )
        }

        const searchInput = {
          tableId: args.filter?.tableId || '', // Provide default empty string if not provided
          query: queryString,
          limit: args.pagination?.limit,
          offset: args.pagination?.offset,
          sortBy: args.sort
            ? Array.isArray(args.sort)
              ? args.sort.map((s: any) => ({
                  field: s.field,
                  direction: s.direction.toLowerCase() as 'asc' | 'desc',
                }))
              : [
                  {
                    field: (args.sort as any).field,
                    direction: (args.sort as any).direction.toLowerCase() as 'asc' | 'desc',
                  },
                ]
            : undefined,
        }

        // Validate that tableId is provided
        if (!searchInput.tableId) {
          throw new Error('Table ID is required for searching nodes')
        }

        const result = await this.searchNodesUseCase.execute(searchInput)

        return {
          nodes: result.nodes || [],
          totalCount: result.total || 0,
          hasNextPage: result.hasNextPage || false,
          hasPreviousPage: result.hasPreviousPage || false,
        }
      },
      'searchNodes',
      { args }
    )
  }
}

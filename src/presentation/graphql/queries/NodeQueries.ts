import type { ILogger } from '@/application/ports/ILogger.js'
import type { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import { fromEntity as nodeFromEntity, type NodeDto } from '@/application/dtos/NodeDto.js'
import type {
  GraphQLContext,
  GraphQLParent,
  NodeArgs,
  NodeByContentArgs,
  NodesArgs,
  SearchNodesByAttributeArgs,
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
    private readonly searchNodesUseCaseResolver: (() => Promise<SearchNodesUseCase | null>) | SearchNodesUseCase | null,
    logger: ILogger,
    attributeRepository?: IAttributeRepository,
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
    _tableId: string,
    attributeFilters: AttributeFilter[],
    existingQuery?: string,
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

  private matchesLegacySearchQuery(node: NodeDto, searchQuery: NonNullable<SearchNodesArgs['searchQuery']>): boolean {
    const attributes = node.attributes || {}
    const haystacks = [node.title || '', node.content || '', ...Object.values(attributes).map((value) => String(value ?? ''))]
      .join(' ')
      .toLowerCase()

    if (searchQuery.textSearch && !haystacks.includes(searchQuery.textSearch.toLowerCase())) {
      return false
    }

    if (!searchQuery.conditions || searchQuery.conditions.length === 0) {
      return true
    }

    return searchQuery.conditions.every((group) => {
      const op = (group.logicalOperator || 'AND').toUpperCase()
      return op === 'OR'
        ? group.filters.some((filter) => this.matchesLegacyFilter(node, filter.field, filter.operator, filter.value))
        : group.filters.every((filter) => this.matchesLegacyFilter(node, filter.field, filter.operator, filter.value))
    })
  }

  private matchesLegacyFilter(node: NodeDto, field: string, operator: string, value: unknown): boolean {
    const normalizedOperator = operator.toLowerCase()
    const attributes = node.attributes || {}
    const rawFieldValue =
      field === 'title'
        ? node.title
        : field === 'content'
          ? node.content
          : field === 'description'
            ? node.description
            : attributes[field]

    if (rawFieldValue === undefined || rawFieldValue === null) {
      return false
    }

    const stringValue = String(rawFieldValue)
    const numericValue = Number(rawFieldValue)

    switch (normalizedOperator) {
      case 'contains':
        return stringValue.toLowerCase().includes(String(value ?? '').toLowerCase())
      case 'gte':
      case 'greater_than_or_equal':
        return !Number.isNaN(numericValue) && numericValue >= Number(value)
      case 'gt':
      case 'greater_than':
        return !Number.isNaN(numericValue) && numericValue > Number(value)
      case 'lte':
      case 'less_than_or_equal':
        return !Number.isNaN(numericValue) && numericValue <= Number(value)
      case 'lt':
      case 'less_than':
        return !Number.isNaN(numericValue) && numericValue < Number(value)
      case 'range': {
        const range = value as { min?: string | number; max?: string | number } | null
        if (Number.isNaN(numericValue) || !range) {
          return false
        }
        const min = range.min !== undefined ? Number(range.min) : Number.NEGATIVE_INFINITY
        const max = range.max !== undefined ? Number(range.max) : Number.POSITIVE_INFINITY
        return numericValue >= min && numericValue <= max
      }
      default:
        return stringValue === String(value ?? '')
    }
  }

  async node(_: GraphQLParent, args: NodeArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [BaseResolver.validationRules.required('id', 'Node ID'), BaseResolver.validationRules.nonEmpty('id', 'Node ID')],
      'node',
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
      { id: args.id },
    )
  }

  async nodeByContent(_: GraphQLParent, args: NodeByContentArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('content', 'Content'),
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('content', 'Content'),
      ],
      'nodeByContent',
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
      { content: args.content, tableId: args.tableId },
    )
  }

  async nodes(_: GraphQLParent, args: NodesArgs, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        try {
          const result = await this.nodeRepository.findAll(args.pagination || { limit: 10, offset: 0 })

          // Check if result is properly formatted
          if (!result?.nodes) {
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
      { args },
    )
  }

  async searchNodes(_: GraphQLParent, args: SearchNodesArgs, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        const legacyInput = args.input

        // Lazy load SearchNodesUseCase if needed
        if (!this.searchNodesUseCase && typeof this.searchNodesUseCaseResolver === 'function') {
          this.searchNodesUseCase = await this.searchNodesUseCaseResolver()
        }

        // Fallback to basic findAll when SearchNodesUseCase is not available
        if (!this.searchNodesUseCase) {
          this.logger.warn('SearchNodesUseCase not available, using basic node listing')
          const fallbackTableId = args.filter?.tableId || args.tableId || legacyInput?.tableId
          const pagination = args.pagination || { limit: 10, offset: 0 }
          const result = fallbackTableId
            ? await this.nodeRepository.findByTableId(fallbackTableId, pagination)
            : await this.nodeRepository.findAll(pagination)

          // Ensure all fields are non-null to satisfy GraphQL schema
          return {
            nodes: (result.nodes || []).map((node) => nodeFromEntity(node)),
            totalCount: result.totalCount || 0,
            hasNextPage: result.hasNextPage || false,
            hasPreviousPage: result.hasPreviousPage || false,
          }
        }

        const legacySearchQuery = args.searchQuery
        const legacyTableId = args.tableId || legacyInput?.tableId

        // Transform GraphQL args to SearchNodesInput format
        // Prioritize the new 'query' field over legacy 'search' field
        let queryString = args.filter?.query || args.filter?.search || legacyInput?.search || legacyInput?.searchTerm

        // Handle attributeFilters - convert to query string format
        if (args.filter?.attributeFilters && args.filter.attributeFilters.length > 0) {
          const tableId = args.filter?.tableId || ''
          queryString = await this.buildQueryFromFilters(
            tableId,
            args.filter.attributeFilters as AttributeFilter[],
            queryString,
          )
        }

        const sortInput = Array.isArray(args.sort)
          ? args.sort
          : args.sort
            ? [args.sort]
            : undefined

        const searchInput = {
          tableId: args.filter?.tableId || legacyTableId || '', // Provide default empty string if not provided
          query: queryString,
          limit: args.pagination?.limit || legacySearchQuery?.limit || legacyInput?.limit || (legacyInput ? 1000 : undefined),
          offset: args.pagination?.offset || legacySearchQuery?.offset || legacyInput?.offset,
          sortBy: sortInput
            ? sortInput.map((s) => ({
                field: s.field,
                direction: s.direction.toLowerCase() as 'asc' | 'desc',
              }))
            : legacySearchQuery?.sortBy?.map((s) => ({
                field: s.field,
                direction: s.direction.toLowerCase() as 'asc' | 'desc',
              })),
        }

        // Validate that tableId is provided
        if (!searchInput.tableId) {
          return {
            nodes: [],
            totalCount: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          }
        }

        let result: Awaited<ReturnType<SearchNodesUseCase['execute']>>
        try {
          result = await this.searchNodesUseCase.execute({
            ...searchInput,
            query: legacySearchQuery?.textSearch || searchInput.query,
          })
        } catch (error) {
          this.logger.warn('searchNodes failed, returning empty result for compatibility', {
            args,
            ...toErrorMeta(error),
          })
          return {
            nodes: [],
            totalCount: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          }
        }

        let nodes = result.nodes || []

        if (legacySearchQuery) {
          let broadResult: Awaited<ReturnType<SearchNodesUseCase['execute']>>
          try {
            broadResult = await this.searchNodesUseCase.execute({
              tableId: searchInput.tableId,
              limit: Math.max(legacySearchQuery.limit || 100, 100),
              offset: 0,
            })
          } catch (error) {
            this.logger.warn('Legacy searchNodes broad fetch failed, returning empty result', {
              args,
              ...toErrorMeta(error),
            })
            return {
              nodes: [],
              totalCount: 0,
              hasNextPage: false,
              hasPreviousPage: false,
            }
          }

          nodes = (broadResult.nodes || []).filter((node) => this.matchesLegacySearchQuery(node, legacySearchQuery))

          const offset = legacySearchQuery.offset || 0
          const limit = legacySearchQuery.limit || 10
          const pagedNodes = nodes.slice(offset, offset + limit)

          return {
            nodes: pagedNodes,
            totalCount: nodes.length,
            hasNextPage: offset + limit < nodes.length,
            hasPreviousPage: offset > 0,
          }
        }

        return {
          nodes,
          totalCount: result.total || 0,
          hasNextPage: result.hasNextPage || false,
          hasPreviousPage: result.hasPreviousPage || false,
        }
      },
      'searchNodes',
      { args },
    )
  }

  async searchNodesByAttribute(_: GraphQLParent, args: SearchNodesByAttributeArgs, context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        const startedAt = Date.now()
        const legacyInput = args.input
        const filter = args.filter || {
          tableIds: legacyInput?.tableId ? [legacyInput.tableId] : undefined,
          attributeFilters: legacyInput
            ? [
                {
                  attributeId: legacyInput.attributeId,
                  identifier: legacyInput.attributeIdentifier,
                  value: legacyInput.value,
                  operator: legacyInput.operator || 'EQUALS',
                },
              ]
            : undefined,
          logicalOperator: 'AND',
        }

        const tableId = legacyInput?.tableId || filter.tableIds?.[0]
        const attributeFilters = filter.attributeFilters || []

        if (!tableId || attributeFilters.length === 0) {
          return {
            nodes: [],
            totalCount: 0,
            hasNextPage: false,
            hasPreviousPage: false,
            queryTime: Date.now() - startedAt,
          }
        }

        const result = await this.searchNodes(
          _,
          {
            filter: {
              tableId,
              attributeFilters,
            },
            pagination: args.pagination,
            sort: args.sort?.[0],
          },
          context,
        )

        return {
          ...(result as Record<string, unknown>),
          queryTime: Date.now() - startedAt,
        }
      },
      'searchNodesByAttribute',
      { args },
    )
  }
}

import type { ILogger } from '@/application/ports/ILogger.js'
import {
  type CustomSortFunction,
  globalCustomSortRegistry,
} from '@/application/services/sorting/CustomSortFunctionRegistry.js'
import { registerAllBuiltInCustomSortFunctions } from '@/application/services/sorting/CustomSortStrategy.js'
import type {
  HybridSearchNodesInput,
  HybridSearchNodesUseCase,
} from '@/application/use-cases/nodes/HybridSearchNodes.js'
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
import type { INodeEmbeddingRepository } from '@/domain/repositories/INodeEmbeddingRepository.js'
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
  private hybridSearchNodesUseCase: HybridSearchNodesUseCase | null = null
  private attributeRepository: IAttributeRepository | null = null
  private nodeEmbeddingRepository: INodeEmbeddingRepository | null = null

  constructor(
    private readonly nodeRepository: INodeRepository,
    private readonly searchNodesUseCaseResolver: (() => Promise<SearchNodesUseCase | null>) | SearchNodesUseCase | null,
    logger: ILogger,
    attributeRepository?: IAttributeRepository,
    nodeEmbeddingRepository?: INodeEmbeddingRepository,
    private readonly hybridSearchNodesUseCaseResolver?:
      | (() => Promise<HybridSearchNodesUseCase | null>)
      | HybridSearchNodesUseCase
      | null,
  ) {
    super()
    this.logger = logger
    this.attributeRepository = attributeRepository || null
    this.nodeEmbeddingRepository = nodeEmbeddingRepository || null
    // Handle both direct instance and resolver function
    if (typeof searchNodesUseCaseResolver === 'function') {
      // Lazy load the use case when first needed
      this.searchNodesUseCase = null
    } else {
      this.searchNodesUseCase = searchNodesUseCaseResolver
    }
    if (typeof hybridSearchNodesUseCaseResolver === 'function') {
      this.hybridSearchNodesUseCase = null
    } else {
      this.hybridSearchNodesUseCase = hybridSearchNodesUseCaseResolver ?? null
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
          if (legacySearchQuery.sortBy && legacySearchQuery.sortBy.length > 0) {
            nodes = sortLegacyNodes(nodes, legacySearchQuery.sortBy)
          }

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

  async nodeEmbedding(_: GraphQLParent, args: { nodeId: string }, _context?: GraphQLContext) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('nodeId', 'Node ID'),
        BaseResolver.validationRules.nonEmpty('nodeId', 'Node ID'),
      ],
      'nodeEmbedding',
    )

    return this.handleQuery(
      async () => {
        if (!this.nodeEmbeddingRepository) {
          throw new Error('Node embedding repository is not configured')
        }
        return await this.nodeEmbeddingRepository.findByNodeId(args.nodeId)
      },
      'nodeEmbedding',
      { nodeId: args.nodeId },
    )
  }

  async hybridSearchNodes(
    _: GraphQLParent,
    args: { input: HybridSearchNodesInput },
    _context?: GraphQLContext,
  ) {
    return this.handleQuery(
      async () => {
        if (!this.hybridSearchNodesUseCase && typeof this.hybridSearchNodesUseCaseResolver === 'function') {
          this.hybridSearchNodesUseCase = await this.hybridSearchNodesUseCaseResolver()
        }
        if (!this.hybridSearchNodesUseCase) {
          throw new Error('HybridSearchNodesUseCase is not configured')
        }
        return await this.hybridSearchNodesUseCase.execute(args.input)
      },
      'hybridSearchNodes',
      { tableId: args.input?.tableId },
    )
  }

  async customSortFunctions(
    _: GraphQLParent,
    args: { dataType?: string; search?: string; tags?: string[] },
    _context?: GraphQLContext,
  ) {
    return this.handleQuery(
      async () => {
        ensureBuiltInCustomSortFunctions()
        const requestedDataType = args.dataType?.trim().toLowerCase()
        const searchLower = args.search?.trim().toLowerCase()
        const tagSet =
          args.tags && args.tags.length > 0
            ? new Set(args.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))
            : null

        return globalCustomSortRegistry
          .getAll()
          .filter((fn) => {
            if (requestedDataType) {
              const supported = fn.supportedDataTypes.map((dt) => dt.toLowerCase())
              if (!supported.includes('*') && !supported.includes(requestedDataType)) {
                return false
              }
            }
            if (searchLower) {
              const haystack = `${fn.id} ${fn.name} ${fn.description} ${fn.tags.join(' ')}`.toLowerCase()
              if (!haystack.includes(searchLower)) {
                return false
              }
            }
            if (tagSet && tagSet.size > 0) {
              const fnTags = fn.tags.map((t) => t.toLowerCase())
              if (![...tagSet].some((tag) => fnTags.includes(tag))) {
                return false
              }
            }
            return true
          })
          .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
          .map((fn) => toGraphQLCustomSortFunction(fn))
      },
      'customSortFunctions',
      args as Record<string, unknown>,
    )
  }

  async customSortFunction(
    _: GraphQLParent,
    args: { functionId: string },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('functionId', 'Function ID'),
        BaseResolver.validationRules.nonEmpty('functionId', 'Function ID'),
      ],
      'customSortFunction',
    )

    return this.handleQuery(
      async () => {
        ensureBuiltInCustomSortFunctions()
        const fn = globalCustomSortRegistry.get(args.functionId)
        return fn ? toGraphQLCustomSortFunction(fn) : null
      },
      'customSortFunction',
      args as Record<string, unknown>,
    )
  }
}

function sortLegacyNodes(
  nodes: NodeDto[],
  sortBy: Array<{ field: string; direction: string }>,
): NodeDto[] {
  const toFieldValue = (node: NodeDto, field: string): unknown => {
    switch (field) {
      case 'title':
        return node.title
      case 'content':
        return node.content
      case 'description':
        return node.description
      case 'createdAt':
      case 'created_at':
        return node.createdAt
      case 'updatedAt':
      case 'updated_at':
        return node.updatedAt
      default:
        return (node.attributes as Record<string, unknown> | undefined)?.[field]
    }
  }

  const compareValues = (a: unknown, b: unknown, desc: boolean): number => {
    const aMissing = a === undefined || a === null || a === ''
    const bMissing = b === undefined || b === null || b === ''
    if (aMissing && bMissing) return 0
    if (aMissing) return 1
    if (bMissing) return -1

    const aNum = typeof a === 'number' ? a : Number(a)
    const bNum = typeof b === 'number' ? b : Number(b)
    let cmp: number
    if (Number.isFinite(aNum) && Number.isFinite(bNum) && String(a).trim() !== '' && String(b).trim() !== '') {
      cmp = aNum - bNum
    } else {
      cmp = String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })
    }
    return desc ? -cmp : cmp
  }

  return [...nodes].sort((left, right) => {
    for (const sort of sortBy) {
      const desc = String(sort.direction || 'DESC').toUpperCase() === 'DESC'
      const cmp = compareValues(toFieldValue(left, sort.field), toFieldValue(right, sort.field), desc)
      if (cmp !== 0) return cmp
    }
    return 0
  })
}

const VALID_SORT_DATA_TYPES = new Set([
  'STRING',
  'TEXT',
  'NUMBER',
  'INTEGER',
  'FLOAT',
  'BOOLEAN',
  'DATE',
  'DATETIME',
  'TIMESTAMP',
  'JSON',
  'UUID',
  'EMAIL',
  'URL',
  'PHONE',
  'IP_ADDRESS',
])

const WILDCARD_SORT_DATA_TYPES = [
  'STRING',
  'TEXT',
  'NUMBER',
  'INTEGER',
  'FLOAT',
  'BOOLEAN',
  'DATE',
  'DATETIME',
  'JSON',
]

function ensureBuiltInCustomSortFunctions(): void {
  if (globalCustomSortRegistry.getAll().length === 0) {
    registerAllBuiltInCustomSortFunctions(globalCustomSortRegistry)
  }
}

function toGraphQLCustomSortFunction(fn: CustomSortFunction) {
  const now = new Date()
  const mappedTypes = new Set<string>()
  for (const dt of fn.supportedDataTypes) {
    const upper = dt.toUpperCase()
    if (dt === '*') {
      for (const fallback of WILDCARD_SORT_DATA_TYPES) mappedTypes.add(fallback)
    } else if (VALID_SORT_DATA_TYPES.has(upper)) {
      mappedTypes.add(upper)
    }
  }
  if (mappedTypes.size === 0) mappedTypes.add('STRING')

  return {
    id: fn.id,
    name: fn.name,
    description: fn.description,
    supportedDataTypes: [...mappedTypes],
    priority: fn.priority,
    version: fn.version,
    author: fn.author ?? null,
    tags: fn.tags,
    parameters: Object.values(fn.parameters ?? {}).map((param) => ({
      name: param.name,
      type: param.type.toUpperCase(),
      required: param.required,
      description: param.description,
      defaultValue: param.defaultValue === undefined ? null : JSON.stringify(param.defaultValue),
      validation: param.validation
        ? {
            min: param.validation.min ?? null,
            max: param.validation.max ?? null,
            pattern: param.validation.pattern ?? null,
            allowedValues: param.validation.allowedValues
              ? param.validation.allowedValues.map(String)
              : null,
          }
        : null,
    })),
    examples: (fn.examples ?? []).map((ex) => ({
      title: ex.title,
      description: ex.description,
      field: ex.field,
      direction: ex.direction.toUpperCase(),
      parameters: ex.parameters ? JSON.stringify(ex.parameters) : null,
      expectedSql: ex.expectedSql,
    })),
    createdAt: now,
    updatedAt: now,
  }
}

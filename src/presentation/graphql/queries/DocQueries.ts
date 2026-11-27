import { DocDto } from '@/application/dtos/DocDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { DocId, PaginatedResult, TableId } from '@/core/types/CommonTypes.js'
import type { GraphQLContext, GraphQLParent } from '@/core/types/GraphQLTypes.js'
import type { Doc, DocCategory } from '@/domain/entities/Doc.js'
import type { DocSearchOptions, IDocRepository } from '@/domain/repositories/IDocRepository.js'
import { BaseResolver } from '../base/BaseResolver.js'

interface GetDocArgs {
  id: DocId
}

interface GetActiveDocArgs {
  tableId: string
  category: DocCategory
}

interface DocsFilterInput {
  tableId?: string
  category?: DocCategory
  isActive?: boolean
  version?: number
  createdAfter?: string | Date
  createdBefore?: string | Date
}

interface DocSortInput {
  field?: string
  direction?: 'ASC' | 'DESC'
}

interface GetDocsArgs {
  tableId?: string
  category?: DocCategory
  isActive?: boolean
  filter?: DocsFilterInput
  pagination?: {
    limit?: number
    offset?: number
  }
  sort?: DocSortInput[]
}

interface GetDocVersionsArgs {
  tableId: string
  category: DocCategory
  pagination?: {
    limit?: number
    offset?: number
  }
}

interface SearchDocsArgs {
  query?: string
  tableId?: string
  category?: DocCategory
  isActive?: boolean
  filter?: DocsFilterInput
  pagination?: {
    limit?: number
    offset?: number
  }
  sort?: DocSortInput[]
}

function toOptionalDate(value?: string | Date): Date | undefined {
  if (value === undefined) return undefined
  return value instanceof Date ? value : new Date(value)
}

function buildDocSearchOptions(args: GetDocsArgs | SearchDocsArgs): DocSearchOptions {
  const filter = args.filter
  return {
    tableId: (args.tableId ?? filter?.tableId) as TableId | undefined,
    category: args.category ?? filter?.category,
    isActive: args.isActive ?? filter?.isActive,
    version: filter?.version,
    createdAfter: toOptionalDate(filter?.createdAfter),
    createdBefore: toOptionalDate(filter?.createdBefore),
    limit: args.pagination?.limit ?? 10,
    offset: args.pagination?.offset ?? 0,
    sortBy: args.sort?.[0]?.field,
    sortDirection: args.sort?.[0]?.direction,
  }
}

function toDocsConnection(result: Doc[] | PaginatedResult<Doc>) {
  return {
    docs: DocDto.fromEntities(Array.isArray(result) ? result : result.nodes || []),
    totalCount: Array.isArray(result) ? result.length : result.totalCount || 0,
    hasNextPage: Array.isArray(result) ? false : result.hasNextPage || false,
    hasPreviousPage: Array.isArray(result) ? false : result.hasPreviousPage || false,
  }
}

export class DocQueries extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly docRepository: IDocRepository,
    logger: ILogger,
  ) {
    super()
    this.logger = logger
  }

  async getDoc(_: GraphQLParent, args: GetDocArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [BaseResolver.validationRules.required('id', 'Doc ID'), BaseResolver.validationRules.nonEmpty('id', 'Doc ID')],
      'getDoc',
    )

    return this.handleQuery(
      async () => {
        const doc = await this.docRepository.findById(args.id)
        return doc ? DocDto.fromEntity(doc) : null
      },
      'findDocById',
      { id: args.id },
    )
  }

  async getActiveDoc(_: GraphQLParent, args: GetActiveDocArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.required('category', 'Doc category'),
        BaseResolver.validationRules.nonEmpty('tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('category', 'Doc category'),
      ],
      'getActiveDoc',
    )

    return this.handleQuery(
      async () => {
        const doc = await this.docRepository.findActiveByTableAndCategory(args.tableId, args.category)
        return doc ? DocDto.fromEntity(doc) : null
      },
      'findActiveDocByTableAndCategory',
      { tableId: args.tableId, category: args.category },
    )
  }

  async getDocs(_: GraphQLParent, args: GetDocsArgs, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        const options = buildDocSearchOptions(args)
        const result = await this.docRepository.findAll(options)
        return toDocsConnection(result)
      },
      'findDocs',
      {
        tableId: args.tableId ?? args.filter?.tableId,
        category: args.category ?? args.filter?.category,
        isActive: args.isActive ?? args.filter?.isActive,
        pagination: args.pagination,
      },
    )
  }

  async getDocVersions(_: GraphQLParent, args: GetDocVersionsArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.required('category', 'Doc category'),
        BaseResolver.validationRules.nonEmpty('tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('category', 'Doc category'),
      ],
      'getDocVersions',
    )

    return this.handleQuery(
      async () => {
        const result = await this.docRepository.findVersionsByTableAndCategory(args.tableId, args.category)

        return {
          docs: DocDto.fromEntities(result),
          totalCount: result.length,
          hasNextPage: false,
          hasPreviousPage: false,
        }
      },
      'findDocVersions',
      {
        tableId: args.tableId,
        category: args.category,
        pagination: args.pagination,
      },
    )
  }

  async searchDocs(_: GraphQLParent, args: SearchDocsArgs, _context?: GraphQLContext) {
    if (args.filter !== undefined) {
      return this.handleQuery(
        async () => {
          const options = buildDocSearchOptions(args)
          const result = await this.docRepository.searchDocs(options)
          return toDocsConnection(result)
        },
        'searchDocs',
        {
          filter: args.filter,
          pagination: args.pagination,
          sort: args.sort,
        },
      )
    }

    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('query', 'Search query'),
        BaseResolver.validationRules.nonEmpty('query', 'Search query'),
      ],
      'searchDocs',
    )

    return this.handleQuery(
      async () => {
        const result = await this.docRepository.searchByContent(
          {
            query: args.query ?? '',
            tableId: args.tableId,
            category: args.category,
            isActive: args.isActive,
          },
          args.pagination || { limit: 10, offset: 0 },
        )

        return toDocsConnection(result)
      },
      'searchDocs',
      {
        query: args.query,
        tableId: args.tableId,
        category: args.category,
        isActive: args.isActive,
        pagination: args.pagination,
      },
    )
  }
}

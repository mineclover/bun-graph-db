import { DocDto } from '@/application/dtos/DocDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { DocId } from '@/core/types/CommonTypes.js'
import type { GraphQLContext, GraphQLParent } from '@/core/types/GraphQLTypes.js'
import type { DocCategory } from '@/domain/entities/Doc.js'
import type { IDocRepository } from '@/domain/repositories/IDocRepository.js'
import { BaseResolver } from '../base/BaseResolver.js'

interface GetDocArgs {
  id: DocId
}

interface GetActiveDocArgs {
  tableId: string
  category: DocCategory
}

interface GetDocsArgs {
  tableId?: string
  category?: DocCategory
  isActive?: boolean
  pagination?: {
    limit?: number
    offset?: number
  }
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
  query: string
  tableId?: string
  category?: DocCategory
  isActive?: boolean
  pagination?: {
    limit?: number
    offset?: number
  }
}

export class DocQueries extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly docRepository: IDocRepository,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  async getDoc(_: GraphQLParent, args: GetDocArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as any,
      [
        BaseResolver.validationRules.required('id', 'Doc ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Doc ID'),
      ],
      'getDoc'
    )

    return this.handleQuery(
      async () => {
        const doc = await this.docRepository.findById(args.id)
        return doc ? DocDto.fromEntity(doc) : null
      },
      'findDocById',
      { id: args.id }
    )
  }

  async getActiveDoc(_: GraphQLParent, args: GetActiveDocArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as any,
      [
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.required('category', 'Doc category'),
        BaseResolver.validationRules.nonEmpty('tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('category', 'Doc category'),
      ],
      'getActiveDoc'
    )

    return this.handleQuery(
      async () => {
        const doc = await this.docRepository.findActiveByTableAndCategory(
          args.tableId,
          args.category
        )
        return doc ? DocDto.fromEntity(doc) : null
      },
      'findActiveDocByTableAndCategory',
      { tableId: args.tableId, category: args.category }
    )
  }

  async getDocs(_: GraphQLParent, args: GetDocsArgs, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        const options = {
          tableId: args.tableId,
          category: args.category,
          isActive: args.isActive,
          limit: args.pagination?.limit || 10,
          offset: args.pagination?.offset || 0,
        }
        const result = await this.docRepository.findAll(options)

        return {
          docs: DocDto.fromEntities(Array.isArray(result) ? result : result.nodes || []),
          totalCount: Array.isArray(result) ? result.length : result.totalCount || 0,
          hasNextPage: Array.isArray(result) ? false : result.hasNextPage || false,
          hasPreviousPage: Array.isArray(result) ? false : result.hasPreviousPage || false,
        }
      },
      'findDocs',
      {
        tableId: args.tableId,
        category: args.category,
        isActive: args.isActive,
        pagination: args.pagination,
      }
    )
  }

  async getDocVersions(_: GraphQLParent, args: GetDocVersionsArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as any,
      [
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.required('category', 'Doc category'),
        BaseResolver.validationRules.nonEmpty('tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('category', 'Doc category'),
      ],
      'getDocVersions'
    )

    return this.handleQuery(
      async () => {
        const result = await this.docRepository.findVersionsByTableAndCategory(
          args.tableId,
          args.category
        )

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
      }
    )
  }

  async searchDocs(_: GraphQLParent, args: SearchDocsArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as any,
      [
        BaseResolver.validationRules.required('query', 'Search query'),
        BaseResolver.validationRules.nonEmpty('query', 'Search query'),
      ],
      'searchDocs'
    )

    return this.handleQuery(
      async () => {
        const result = await this.docRepository.searchByContent(
          {
            query: args.query,
            tableId: args.tableId,
            category: args.category,
            isActive: args.isActive,
          },
          args.pagination || { limit: 10, offset: 0 }
        )

        return {
          docs: DocDto.fromEntities(Array.isArray(result) ? result : result.nodes || []),
          totalCount: Array.isArray(result) ? result.length : result.totalCount || 0,
          hasNextPage: Array.isArray(result) ? false : result.hasNextPage || false,
          hasPreviousPage: Array.isArray(result) ? false : result.hasPreviousPage || false,
        }
      },
      'searchDocs',
      {
        query: args.query,
        tableId: args.tableId,
        category: args.category,
        isActive: args.isActive,
        pagination: args.pagination,
      }
    )
  }
}

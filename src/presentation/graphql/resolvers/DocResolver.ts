import { DocDto } from '@/application/dtos/DocDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { ActivateDocUseCase } from '@/application/use-cases/docs/ActivateDoc.js'
import type { CreateDocUseCase } from '@/application/use-cases/docs/CreateDoc.js'
import type { DeleteDocUseCase } from '@/application/use-cases/docs/DeleteDoc.js'
import type { UpdateDocUseCase } from '@/application/use-cases/docs/UpdateDoc.js'
import type { DocId, TableId } from '@/core/types/CommonTypes.js'
import type {
  CreateDocInput,
  DocsFilter,
  GraphQLContext,
  UpdateDocInput,
} from '@/core/types/GraphQLTypes.js'
import { DocCategory } from '@/domain/entities/Doc.js'
import type { IDocRepository } from '@/domain/repositories/IDocRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'

export class DocResolver extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly createDocUseCase: CreateDocUseCase,
    private readonly updateDocUseCase: UpdateDocUseCase,
    private readonly deleteDocUseCase: DeleteDocUseCase,
    private readonly activateDocUseCase: ActivateDocUseCase,
    private readonly docRepository: IDocRepository,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  private mapGraphQLCategoryToDomain(category: any): DocCategory {
    const categoryMapping: Record<string, DocCategory> = {
      USAGE: DocCategory.USAGE,
      GUIDE: DocCategory.GUIDE,
      EXAMPLE: DocCategory.EXAMPLE,
      SPEC: DocCategory.SPEC,
      GENERAL: DocCategory.GENERAL,
    }
    return categoryMapping[category] || category
  }

  // Query resolvers
  async getDoc(args: { id: string }, _context?: GraphQLContext): Promise<DocDto | null> {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Doc ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Doc ID'),
      ],
      'getDoc'
    )

    return this.handleQuery(
      async () => {
        const doc = await this.docRepository.findById(args.id as DocId)
        return doc ? DocDto.fromEntity(doc) : null
      },
      'findDocById',
      { id: args.id }
    )
  }

  async getActiveDoc(
    args: { tableId: string; category: DocCategory },
    _context?: GraphQLContext
  ): Promise<DocDto | null> {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('tableId', 'Table ID'),
        BaseResolver.validationRules.required('category', 'Doc Category'),
      ],
      'getActiveDoc'
    )

    return this.handleQuery(
      async () => {
        const doc = await this.docRepository.findActiveByTableAndCategory(
          args.tableId as TableId,
          args.category
        )
        return doc ? DocDto.fromEntity(doc) : null
      },
      'findActiveDoc',
      { tableId: args.tableId, category: args.category }
    )
  }

  async getDocs(args: {
    tableId: string
    category?: DocCategory
    filter?: DocsFilter
    pagination?: { limit?: number; offset?: number }
    sort?: Array<{ field: string; direction: 'ASC' | 'DESC' }>
  }): Promise<{
    docs: DocDto[]
    totalCount: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }> {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('tableId', 'Table ID'),
      ],
      'getDocs'
    )

    try {
      const { pagination = { limit: 10, offset: 0 }, filter, sort } = args

      const searchOptions = {
        limit: pagination.limit || 10,
        offset: pagination.offset || 0,
        tableId: args.tableId as TableId,
        category: args.category
          ? this.mapGraphQLCategoryToDomain(args.category)
          : filter?.category
            ? this.mapGraphQLCategoryToDomain(filter.category)
            : undefined,
        isActive: filter?.isActive || undefined,
        version: filter?.version || undefined,
        createdAfter: filter?.createdAfter ? new Date(filter.createdAfter) : undefined,
        createdBefore: filter?.createdBefore ? new Date(filter.createdBefore) : undefined,
        sortBy: sort?.[0]?.field || 'createdAt',
        sortDirection: (sort?.[0]?.direction || 'DESC') as 'ASC' | 'DESC',
      }

      const result = await this.docRepository.findAll(searchOptions)

      return {
        docs: (result.nodes || []).map((doc) => DocDto.fromEntity(doc)),
        totalCount: result.totalCount || 0,
        hasNextPage: result.hasNextPage || false,
        hasPreviousPage: (pagination.offset || 0) > 0,
      }
    } catch (error) {
      this.logger.error('Failed to find docs', { args, error })
      throw error
    }
  }

  async getDocVersions(
    args: { tableId: string; category: DocCategory },
    _context?: GraphQLContext
  ): Promise<DocDto[]> {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('tableId', 'Table ID'),
        BaseResolver.validationRules.required('category', 'Doc Category'),
      ],
      'getDocVersions'
    )

    return this.handleQuery(
      async () => {
        const docs = await this.docRepository.findVersionsByTableAndCategory(
          args.tableId as TableId,
          args.category
        )
        return docs.map((doc) => DocDto.fromEntity(doc))
      },
      'findDocVersions',
      { tableId: args.tableId, category: args.category }
    )
  }

  async searchDocs(args: {
    filter: DocsFilter
    pagination?: { limit?: number; offset?: number }
    sort?: Array<{ field: string; direction: 'ASC' | 'DESC' }>
  }): Promise<{
    docs: DocDto[]
    totalCount: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }> {
    this.validateArgs(
      args,
      [BaseResolver.validationRules.required('filter', 'Search Filter')],
      'searchDocs'
    )

    try {
      const { pagination = { limit: 10, offset: 0 }, filter, sort } = args

      const searchOptions = {
        limit: pagination.limit || 10,
        offset: pagination.offset || 0,
        tableId: filter.tableId as TableId,
        category: filter.category ? this.mapGraphQLCategoryToDomain(filter.category) : undefined,
        isActive: filter.isActive || undefined,
        version: filter.version || undefined,
        createdAfter: filter.createdAfter ? new Date(filter.createdAfter) : undefined,
        createdBefore: filter.createdBefore ? new Date(filter.createdBefore) : undefined,
        sortBy: sort?.[0]?.field || 'createdAt',
        sortDirection: (sort?.[0]?.direction || 'DESC') as 'ASC' | 'DESC',
      }

      const result = await this.docRepository.searchDocs(searchOptions)

      return {
        docs: (result.nodes || []).map((doc) => DocDto.fromEntity(doc)),
        totalCount: result.totalCount || 0,
        hasNextPage: result.hasNextPage || false,
        hasPreviousPage: (pagination.offset || 0) > 0,
      }
    } catch (error) {
      this.logger.error('Failed to search docs', { args, error })
      throw error
    }
  }

  // Mutation resolvers
  async createDoc(
    args: { input: CreateDocInput },
    _context?: GraphQLContext
  ): Promise<{
    success: boolean
    doc?: DocDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    this.validateArgs(
      args.input,
      [
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('tableId', 'Table ID'),
        BaseResolver.validationRules.required('category', 'Doc Category'),
        BaseResolver.validationRules.required('content', 'Doc Content'),
        BaseResolver.validationRules.nonEmpty('content', 'Doc Content'),
      ],
      'createDoc'
    )

    const result = await this.handleMutation(
      async () => {
        const useCaseResult = await this.createDocUseCase.execute({
          tableId: args.input.tableId as TableId,
          category: args.input.category as DocCategory,
          content: args.input.content || '',
          version: args.input.version || 1,
        })
        return useCaseResult.doc
      },
      'createDoc',
      { input: args.input }
    )

    return {
      success: result.success,
      doc: result.data,
      errors: result.errors,
    }
  }

  async updateDoc(args: { id: string; input: UpdateDocInput }): Promise<{
    success: boolean
    doc: DocDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    this.validateArgs(
      { id: args.id },
      [
        BaseResolver.validationRules.required('id', 'Doc ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Doc ID'),
      ],
      'updateDoc'
    )

    try {
      const result = await this.updateDocUseCase.execute(args.id as DocId, {
        content: args.input.content || undefined,
      })

      return {
        success: true,
        doc: result.doc,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to update doc', { id: args.id, input: args.input, error })

      if (error instanceof NotFoundException || error instanceof ValidationException) {
        return {
          success: false,
          doc: null,
          errors: [
            {
              message: error.message,
              code: error.code,
            },
          ],
        }
      }

      return {
        success: false,
        doc: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  async deleteDoc(args: { id: string }): Promise<{
    success: boolean
    errors: Array<{ message: string; code: string }>
  }> {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Doc ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Doc ID'),
      ],
      'deleteDoc'
    )

    try {
      await this.deleteDocUseCase.execute(args.id as DocId)

      return {
        success: true,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to delete doc', { id: args.id, error })

      return {
        success: false,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: error instanceof NotFoundException ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  async activateDoc(args: { id: string }): Promise<{
    success: boolean
    doc: DocDto | null
    errors: Array<{ message: string; code: string }>
  }> {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Doc ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Doc ID'),
      ],
      'activateDoc'
    )

    try {
      const result = await this.activateDocUseCase.execute(args.id as DocId)

      return {
        success: true,
        doc: result.doc,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to activate doc', { id: args.id, error })

      return {
        success: false,
        doc: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: error instanceof NotFoundException ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  async createDocVersion(args: {
    tableId: string
    category: DocCategory
    content: string
  }): Promise<{
    success: boolean
    doc?: DocDto | null
    errors: Array<{ message: string; code: string; field?: string }>
  }> {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('tableId', 'Table ID'),
        BaseResolver.validationRules.required('category', 'Doc Category'),
        BaseResolver.validationRules.required('content', 'Doc Content'),
        BaseResolver.validationRules.nonEmpty('content', 'Doc Content'),
      ],
      'createDocVersion'
    )

    const result = await this.handleMutation(
      async () => {
        // Get the latest version number
        const latestVersion = await this.docRepository.getLatestVersion(
          args.tableId as TableId,
          args.category
        )

        const useCaseResult = await this.createDocUseCase.execute({
          tableId: args.tableId as TableId,
          category: args.category,
          content: args.content,
          version: latestVersion + 1,
        })
        return useCaseResult.doc
      },
      'createDocVersion',
      { tableId: args.tableId, category: args.category }
    )

    return {
      success: result.success,
      doc: result.data,
      errors: result.errors,
    }
  }
}

import type { ILogger } from '@/application/ports/ILogger.js'
import type { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import type {
  IQueryTemplateRepository,
  SearchCriteria,
} from '@/domain/repositories/IQueryTemplateRepository.js'
import { ValidationException } from '@/shared/exceptions/DomainException.js'

export interface SearchQueryTemplatesRequest {
  tags?: string[]
  tagMatchMode?: 'ANY' | 'ALL'
  applicableToTable?: string
  includeUniversal?: boolean
  templateType?: 'query' | 'mutation' | 'subscription'
  isActive?: boolean
  orderBy?: 'usage_count' | 'created_at' | 'updated_at'
  orderDirection?: 'ASC' | 'DESC'
  limit?: number
  offset?: number
}

export interface SearchQueryTemplatesResponse {
  success: boolean
  results: {
    items: QueryTemplate[]
    total: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
  errors: Array<{
    message: string
    code: string
  }>
}

export class SearchQueryTemplates {
  constructor(
    private readonly queryTemplateRepository: IQueryTemplateRepository,
    private readonly logger: ILogger
  ) {}

  async execute(request: SearchQueryTemplatesRequest = {}): Promise<SearchQueryTemplatesResponse> {
    try {
      this.logger.info('Searching query templates', { searchCriteria: request })

      // Validate search parameters
      this.validateSearchRequest(request)

      // Build search options
      const searchOptions: SearchCriteria = {
        tags: request.tags,
        tagMatchMode: request.tagMatchMode,
        applicableToTable: request.applicableToTable,
        includeUniversal: request.includeUniversal ?? true,
        templateType: request.templateType,
        isActive: request.isActive,
        orderBy: request.orderBy || 'created_at',
        orderDirection: request.orderDirection || 'DESC',
        limit: this.validateLimit(request.limit),
        offset: this.validateOffset(request.offset),
      }

      // Execute search
      const results = await this.queryTemplateRepository.search(searchOptions)

      this.logger.info('Query template search completed', {
        totalFound: results.total,
        returned: results.items.length,
        hasNextPage: results.hasNextPage,
      })

      return {
        success: true,
        results,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Failed to search query templates', { error, request })

      if (error instanceof ValidationException) {
        throw error
      }

      throw new ValidationException(
        'Failed to search query templates',
        { originalError: error }
      )
    }
  }

  private validateSearchRequest(request: SearchQueryTemplatesRequest): void {
    // Validate tag match mode
    if (request.tagMatchMode && !['ANY', 'ALL'].includes(request.tagMatchMode)) {
      throw new ValidationException('Tag match mode must be either ANY or ALL')
    }

    // Validate template type
    if (
      request.templateType &&
      !['query', 'mutation', 'subscription'].includes(request.templateType)
    ) {
      throw new ValidationException('Template type must be query, mutation, or subscription')
    }

    // Validate order by
    if (request.orderBy && !['usage_count', 'created_at', 'updated_at'].includes(request.orderBy)) {
      throw new ValidationException('Order by must be usage_count, created_at, or updated_at')
    }

    // Validate order direction
    if (request.orderDirection && !['ASC', 'DESC'].includes(request.orderDirection)) {
      throw new ValidationException('Order direction must be ASC or DESC')
    }

    // Validate tags if tagMatchMode is specified without tags
    if (request.tagMatchMode && (!request.tags || request.tags.length === 0)) {
      throw new ValidationException('Tag match mode requires tags to be specified')
    }
  }

  private validateLimit(limit?: number): number {
    if (limit === undefined) return 10

    if (limit < 1) {
      throw new ValidationException('Limit must be greater than 0')
    }

    if (limit > 100) {
      throw new ValidationException('Limit cannot exceed 100')
    }

    return limit
  }

  private validateOffset(offset?: number): number {
    if (offset === undefined) return 0

    if (offset < 0) {
      throw new ValidationException('Offset must be greater than or equal to 0')
    }

    return offset
  }
}

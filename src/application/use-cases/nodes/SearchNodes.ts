import { type NodeDto, fromEntity as nodeFromEntity } from '@/application/dtos/NodeDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import {
  type AttributeTypeInfo,
  SearchQueryParser,
} from '@/application/services/SearchQueryParser.js'
import type { PaginatedResult, TableId } from '@/core/types/CommonTypes.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { SearchQuery } from '@/domain/value-objects/SearchFilter.js'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'

export interface SearchNodesInput {
  tableId: string
  query?: string
  limit?: number
  offset?: number
  sortBy?: {
    field: string
    direction: 'asc' | 'desc'
  }[]
}

export interface SearchNodesOutput {
  nodes: NodeDto[]
  total: number
  hasMore: boolean
  hasNextPage: boolean
  hasPreviousPage: boolean
  totalCount: number
  query: {
    parsed: SearchQuery
    originalQuery: string
  }
}

export interface INodeSearchRepository {
  searchNodes(
    tableId: TableId,
    searchQuery: SearchQuery,
    availableAttributes: AttributeTypeInfo[]
  ): Promise<PaginatedResult<any>>
}

export class SearchNodesUseCase {
  constructor(
    readonly _nodeRepository: INodeRepository,
    private readonly nodeSearchRepository: INodeSearchRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly tableRepository: ITableRepository,
    private readonly logger: ILogger
  ) {}

  async execute(input: SearchNodesInput): Promise<SearchNodesOutput> {
    this.logger.info('Searching nodes', {
      tableId: input.tableId,
      query: input.query,
      limit: input.limit,
      offset: input.offset,
    })

    // Validate input
    this.validateInput(input)

    // Check if table exists
    const table = await this.tableRepository.findById(input.tableId as TableId)
    if (!table) {
      throw new NotFoundException(`Table with id '${input.tableId}' not found`)
    }

    try {
      // Get available attributes for this table
      const attributes = await this.attributeRepository.findByTableId(input.tableId as TableId)
      const attributeInfo: AttributeTypeInfo[] = await Promise.all(
        (attributes.data || []).map(async (attr: any) => ({
          identifier: attr.getIdentifier(),
          dataType:
            (
              await this.attributeRepository.getAttributeTypeForAttribute(attr.getId())
            )?.getIdentifier() || 'string',
        }))
      )

      // Parse search query if provided
      let searchQuery: SearchQuery
      if (input.query && input.query.trim().length > 0) {
        const parser = new SearchQueryParser(attributeInfo)
        searchQuery = parser.parse(input.query)

        // Override with input parameters
        if (input.limit) searchQuery.limit = input.limit
        if (input.offset) searchQuery.offset = input.offset
        if (input.sortBy) searchQuery.sortBy = input.sortBy
      } else {
        // Create empty search query with pagination
        searchQuery = {
          conditions: [],
          limit: input.limit || 10,
          offset: input.offset || 0,
          sortBy: input.sortBy,
        }
      }

      // Execute search
      const result = await this.nodeSearchRepository.searchNodes(
        input.tableId as TableId,
        searchQuery,
        attributeInfo
      )

      // Convert to DTOs
      const nodeDtos = (result.data || []).map((nodeData) =>
        nodeFromEntity(nodeData.node, nodeData.attributes || {})
      )

      this.logger.info('Node search completed', {
        tableId: input.tableId,
        foundNodes: (result.data || []).length,
        total: result.total,
      })

      return {
        nodes: nodeDtos,
        total: result.total || 0,
        hasMore: result.hasMore || false,
        hasNextPage: result.hasNextPage || false,
        hasPreviousPage: result.hasPreviousPage || false,
        totalCount: result.total || 0,
        query: {
          parsed: searchQuery,
          originalQuery: input.query || '',
        },
      }
    } catch (error) {
      this.logger.error('Failed to search nodes', {
        input,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  private validateInput(input: SearchNodesInput): void {
    if (!input.tableId?.trim()) {
      throw new ValidationException('Table ID is required')
    }

    if (input.limit !== undefined && (input.limit < 1 || input.limit > 1000)) {
      throw new ValidationException('Limit must be between 1 and 1000')
    }

    if (input.offset !== undefined && input.offset < 0) {
      throw new ValidationException('Offset must be non-negative')
    }
  }
}

import { NodeDto } from '@/application/dtos/NodeDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { NodeId, PaginatedResult, TableId } from '@/core/types/CommonTypes.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { GraphQuery, PathQuery, RelationFilter } from '@/domain/value-objects/RelationQuery.js'
import { RelationDirection } from '@/domain/value-objects/RelationQuery.js'
import { NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'

export interface SearchRelatedNodesInput {
  tableId: string
  sourceNodeIds?: string[]
  relationFilters?: RelationFilter[]
  pathQueries?: PathQuery[]
  nodeFilters?: Record<string, any>
  limit?: number
  offset?: number
}

export interface SearchRelatedNodesOutput {
  nodes: NodeDto[]
  relations: Array<{
    sourceNodeId: string
    targetNodeId: string
    relationTypeId: string
    properties?: Record<string, any>
    strength?: number
  }>
  paths?: Array<{
    startNodeId: string
    endNodeId: string
    path: string[]
    length: number
  }>
  total: number
  hasMore: boolean
  hasNextPage: boolean
  hasPreviousPage: boolean
  totalCount: number
}

export interface IGraphRepository {
  searchRelatedNodes(tableId: TableId, graphQuery: GraphQuery): Promise<PaginatedResult<any>>

  findPathsBetweenNodes(
    tableId: TableId,
    startNodeIds: string[],
    endNodeIds: string[],
    maxDepth?: number,
    relationTypes?: string[]
  ): Promise<
    Array<{
      startNodeId: string
      endNodeId: string
      path: string[]
      length: number
    }>
  >

  getDependencyChain(
    tableId: TableId,
    nodeId: string,
    direction: RelationDirection,
    relationTypes?: string[]
  ): Promise<
    Array<{
      nodeId: string
      level: number
      relationPath: string[]
    }>
  >
}

export class SearchRelatedNodesUseCase {
  constructor(
    private readonly nodeRepository: INodeRepository,
    private readonly relationRepository: INodeRelationRepository,
    private readonly graphRepository: IGraphRepository,
    private readonly tableRepository: ITableRepository,
    private readonly logger: ILogger
  ) {}

  async execute(input: SearchRelatedNodesInput): Promise<SearchRelatedNodesOutput> {
    this.logger.info('Searching related nodes', {
      tableId: input.tableId,
      sourceNodeIds: input.sourceNodeIds?.length || 0,
      filters: Object.keys(input.nodeFilters || {}).length,
    })

    // Validate input
    this.validateInput(input)

    // Check if table exists
    const table = await this.tableRepository.findById(input.tableId as TableId)
    if (!table) {
      throw new NotFoundException(`Table with id '${input.tableId}' not found`)
    }

    try {
      // Build graph query
      const graphQuery: GraphQuery = {
        nodeFilters: input.nodeFilters,
        relationFilters: input.relationFilters,
        pathQueries: input.pathQueries,
        limit: input.limit || 10,
        offset: input.offset || 0,
      }

      // Execute graph search
      const result = await this.graphRepository.searchRelatedNodes(
        input.tableId as TableId,
        graphQuery
      )

      // Process path queries if specified
      const paths: Array<{
        startNodeId: string
        endNodeId: string
        path: string[]
        length: number
      }> = []

      if (input.pathQueries && input.pathQueries.length > 0) {
        for (const pathQuery of input.pathQueries) {
          if (pathQuery.startNodeIds && pathQuery.endNodeIds) {
            const queryPaths = await this.graphRepository.findPathsBetweenNodes(
              input.tableId as TableId,
              pathQuery.startNodeIds,
              pathQuery.endNodeIds,
              pathQuery.maxDepth,
              pathQuery.relationTypes
            )
            paths.push(...queryPaths)
          }
        }
      }

      // Convert to DTOs
      const nodeDtos = (result.data || []).map((item: any) =>
        NodeDto.fromEntity(item.node, item.attributes || {})
      )

      this.logger.info('Related nodes search completed', {
        tableId: input.tableId,
        foundNodes: result.data?.length || 0,
        foundPaths: paths.length,
        total: result.total,
      })

      return {
        nodes: nodeDtos,
        relations: (result.data || []).map((item: any) => ({
          sourceNodeId: item.sourceNodeId,
          targetNodeId: item.targetNodeId,
          relationTypeId: item.relationTypeId,
          properties: item.properties,
          strength: item.strength,
        })),
        paths,
        total: result.total || 0,
        hasMore: result.hasMore || false,
        hasNextPage: result.hasNextPage || false,
        hasPreviousPage: result.hasPreviousPage || false,
        totalCount: result.total || 0,
      }
    } catch (error) {
      this.logger.error('Failed to search related nodes', {
        input,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  async getDependencies(
    tableId: string,
    nodeId: string,
    direction: RelationDirection = RelationDirection.INCOMING,
    relationTypes?: string[]
  ): Promise<
    Array<{
      nodeId: string
      level: number
      relationPath: string[]
    }>
  > {
    // Validate input
    if (!tableId?.trim()) {
      throw new ValidationException('Table ID is required')
    }
    if (!nodeId?.trim()) {
      throw new ValidationException('Node ID is required')
    }

    // Check if table exists
    const table = await this.tableRepository.findById(tableId as TableId)
    if (!table) {
      throw new NotFoundException(`Table with id '${tableId}' not found`)
    }

    try {
      return await this.graphRepository.getDependencyChain(
        tableId as TableId,
        nodeId,
        direction,
        relationTypes
      )
    } catch (error) {
      this.logger.error('Failed to get dependencies', {
        tableId,
        nodeId,
        direction,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  private validateInput(input: SearchRelatedNodesInput): void {
    if (!input.tableId?.trim()) {
      throw new ValidationException('Table ID is required')
    }

    if (input.limit !== undefined && (input.limit < 1 || input.limit > 1000)) {
      throw new ValidationException('Limit must be between 1 and 1000')
    }

    if (input.offset !== undefined && input.offset < 0) {
      throw new ValidationException('Offset must be non-negative')
    }

    if (input.pathQueries) {
      for (const pathQuery of input.pathQueries) {
        if (pathQuery.maxDepth !== undefined && pathQuery.maxDepth < 1) {
          throw new ValidationException('Path query max depth must be at least 1')
        }
      }
    }
  }
}

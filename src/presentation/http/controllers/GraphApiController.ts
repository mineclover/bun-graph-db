import type { HttpControllerRequest as Request, HttpControllerResponse as Response } from '../adapters/BunControllerAdapter.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { TableSchemaProjectionService } from '@/application/services/TableSchemaProjectionService.js'
import type { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import type { SearchRelatedNodesUseCase } from '@/application/use-cases/relations/SearchRelatedNodes.js'
import type { GetTableDocsUseCase } from '@/application/use-cases/tables/GetTableDocs.js'
import {
  toTableSchemaOpenApiOperationContractProjectionResult,
  toTableSchemaOpenApiProjectionResult,
} from '@/core/schema/TableSchemaOpenApiProjection.js'
import type { NodeId, PaginatedResult, TableId } from '@/core/types/CommonTypes.js'
import type { NodeRelation } from '@/domain/entities/NodeRelation.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { RelationDirection } from '@/domain/value-objects/RelationQuery.js'
import { ResponseHelper } from '../utils/responseHelpers.js'

interface GraphQLResponse<T = unknown> {
  data?: T
  errors?: Array<{ message: string }>
}

interface RelationSearchResult {
  data: NodeRelation[]
  total: number
  hasMore: boolean
}

interface ExportTableResponse {
  metadata?: unknown
  statistics?: unknown
}

class GraphQLClient {
  constructor(private endpoint: string) {}

  async query<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<GraphQLResponse<T>> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: variables || {},
        }),
      })

      const result = await response.json()
      return result
    } catch (error) {
      return {
        errors: [{ message: error instanceof Error ? error.message : 'GraphQL request failed' }],
      }
    }
  }
}

export class GraphApiController {
  private graphqlClient: GraphQLClient
  private responseHelper: ResponseHelper

  constructor(
    private readonly logger: ILogger,
    private readonly getTableDocsUseCase: GetTableDocsUseCase,
    readonly _searchNodesUseCase: SearchNodesUseCase,
    private readonly searchRelatedNodesUseCase: SearchRelatedNodesUseCase,
    private readonly tableRepository: ITableRepository,
    private readonly nodeRelationRepository: INodeRelationRepository,
    port?: number,
    private readonly tableSchemaProjectionService?: Pick<TableSchemaProjectionService, 'project'>,
  ) {
    // Use the same port as the server instance
    const serverPort = port || 4000
    this.graphqlClient = new GraphQLClient(`http://localhost:${serverPort}/graphql`)
    this.responseHelper = new ResponseHelper(logger)
  }

  async getTables(req: Request, res: Response): Promise<void> {
    try {
      const { hasNodes, limit = 50, offset = 0, search = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.query

      // Use tableRepository to get tables with search and pagination
      const searchOptions = {
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
        search: search as string,
        sortBy: sortBy as string,
        sortDirection: (sortOrder as string).toUpperCase() as 'ASC' | 'DESC',
        hasNodes: hasNodes ? hasNodes === 'true' : undefined,
      }

      const tablesResult = await this.tableRepository.findAll(searchOptions)

      const result = {
        tables: (tablesResult.data || []).map((table) => ({
          id: table.id,
          identifier: table.identifier,
          description: table.description,
          createdAt: table.createdAt,
          updatedAt: table.updatedAt,
        })),
        total: tablesResult.total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
        hasMore: tablesResult.hasMore,
        hasNextPage: tablesResult.hasMore,
        hasPreviousPage: parseInt(offset as string, 10) > 0,
      }

      this.responseHelper.success(res, result)
    } catch (error) {
      this.responseHelper.handleError(res, error, 'Get tables')
    }
  }

  async getTableDocs(req: Request, res: Response): Promise<void> {
    try {
      const { tableId, identifier } = req.query
      const {
        includeSampleNodes = true,
        includeUsageStats = false,
        includeRelatedTemplates = true,
        sampleLimit = 3,
      } = req.query

      if (!tableId && !identifier) {
        this.responseHelper.validationError(res, 'Either tableId or identifier is required')
        return
      }

      // Use the actual GetTableDocs Use Case
      const result = await this.getTableDocsUseCase.execute({
        tableId: tableId as string,
        identifier: identifier as string,
        includeSampleNodes:
          typeof includeSampleNodes === 'string' ? includeSampleNodes === 'true' : !!includeSampleNodes,
        includeUsageStats: typeof includeUsageStats === 'string' ? includeUsageStats === 'true' : !!includeUsageStats,
        includeRelatedTemplates: includeRelatedTemplates === 'true' || includeRelatedTemplates === true,
        sampleLimit: parseInt(sampleLimit as string, 10) || 3,
      })

      if (!result.tableDocs) {
        this.responseHelper.notFound(res, 'Table')
        return
      }

      this.responseHelper.success(res, result.tableDocs)
    } catch (error) {
      this.responseHelper.handleError(res, error, 'Get table docs')
    }
  }

  async getTableOpenApiProjection(req: Request, res: Response): Promise<void> {
    try {
      const { tableId } = req.params
      const profile = normalizeProjectionProfile(req.query.profile)

      if (!tableId) {
        this.responseHelper.validationError(res, 'tableId is required')
        return
      }
      if (!profile) {
        this.responseHelper.validationError(res, 'profile must be component-bundle or operation-contract')
        return
      }
      if (!this.tableSchemaProjectionService) {
        this.responseHelper.error(res, 503, 'Table schema projection service is not configured', 'Get table OpenAPI projection')
        return
      }

      const projection = await this.tableSchemaProjectionService.project({ tableId })
      const result = profile === 'operation-contract'
        ? toTableSchemaOpenApiOperationContractProjectionResult(projection)
        : toTableSchemaOpenApiProjectionResult(projection)

      this.responseHelper.success(res, result)
    } catch (error) {
      this.responseHelper.handleError(res, error, 'Get table OpenAPI projection')
    }
  }

  async exportTableWithNodes(req: Request, res: Response): Promise<void> {
    try {
      const { tableId } = req.params
      const { flatFormat = true, outputPath = '' } = req.body

      if (!tableId) {
        this.responseHelper.validationError(res, 'tableId is required')
        return
      }

      // GraphQL 쿼리 실행
      const query = `
        query ExportTable($tableId: String!) {
          exportTable(tableId: $tableId, options: {format: "json", includeData: true}) {
            metadata {
              exportedAt
              version
              source
              options
              checksum
            }
            tables {
              id
              identifier
              description
              nodes {
                id
                content
                attributes
                createdAt
                updatedAt
              }
              attributes {
                id
                identifier
                name
                attributeType {
                  id
                  name
                  dataType
                }
              }
              statistics {
                nodeCount
                attributeCount
                relationCount
              }
            }
            statistics {
              totalTables
              totalNodes
              totalRelations
              totalAttributes
              exportSize
            }
          }
        }
      `

      const graphqlResult = await this.graphqlClient.query<{ exportTable?: ExportTableResponse }>(query, { tableId })

      if (graphqlResult.errors) {
        this.logger.error('GraphQL export error:', { errors: graphqlResult.errors })
        this.responseHelper.error(
          res,
          500,
          `GraphQL error: ${graphqlResult.errors.map((e) => e.message).join(', ')}`,
          'Export table with nodes',
        )
        return
      }

      const exportData = graphqlResult.data?.exportTable
      if (!exportData) {
        this.responseHelper.notFound(res, 'Export data')
        return
      }

      // 파일로 저장이 요청된 경우
      if (outputPath) {
        try {
          const fs = await import('node:fs/promises')
          const path = await import('node:path')

          // 디렉토리 생성 (존재하지 않는 경우)
          const dir = path.dirname(outputPath)
          await fs.mkdir(dir, { recursive: true })

          // JSON 데이터를 파일에 저장
          await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2), 'utf-8')

          this.logger.info(`Table ${tableId} exported to ${outputPath}`)

          this.responseHelper.success(res, {
            tableId,
            flatFormat,
            outputPath,
            fileSize: JSON.stringify(exportData).length,
            metadata: exportData.metadata,
            statistics: exportData.statistics,
          })
        } catch (fileError) {
          this.responseHelper.handleError(res, fileError, 'File write')
        }
      } else {
        // JSON 응답으로 반환
        this.responseHelper.success(res, exportData)
      }
    } catch (error) {
      this.responseHelper.handleError(res, error, 'Export table with nodes')
    }
  }

  async searchRelations(req: Request, res: Response): Promise<void> {
    try {
      const { tableId, sourceNodeId, targetNodeId, relationTypeId, limit = 20 } = req.query

      if (!tableId) {
        this.responseHelper.validationError(res, 'tableId is required')
        return
      }

      // Use nodeRelationRepository to search relations with filters
      const searchOptions = {
        limit: parseInt(limit as string, 10),
        offset: 0,
      }

      let relationsResult: RelationSearchResult

      if (sourceNodeId && targetNodeId) {
        // Search for specific relation between two nodes
        const relation = await this.nodeRelationRepository.findByExternalIds(
          sourceNodeId as string,
          targetNodeId as string,
          tableId as TableId,
        )
        relationsResult = {
          data: relation ? [relation] : [],
          total: relation ? 1 : 0,
          hasMore: false,
        }
      } else if (sourceNodeId) {
        // Search relations by source node
        relationsResult = this.toRelationSearchResult(
          await this.nodeRelationRepository.findBySourceExternalId(sourceNodeId as string, tableId as TableId, searchOptions),
        )
      } else if (targetNodeId) {
        // Search relations by target node
        relationsResult = this.toRelationSearchResult(
          await this.nodeRelationRepository.findByTargetExternalId(targetNodeId as string, tableId as TableId, searchOptions),
        )
      } else if (relationTypeId) {
        // Search relations by type
        relationsResult = this.toRelationSearchResult(
          await this.nodeRelationRepository.findByRelationType(relationTypeId as string, searchOptions),
        )
      } else {
        // Search all relations for the table
        relationsResult = this.toRelationSearchResult(
          await this.nodeRelationRepository.findByTableId(tableId as TableId, searchOptions),
        )
      }

      const result = {
        relations: (relationsResult.data || []).map((relation: NodeRelation) => ({
          id: relation.getId(),
          sourceNodeId: relation.getSourceNodeId(),
          targetNodeId: relation.getTargetNodeId(),
          relationTypeId: relation.getRelationTypeId(),
          tableId: relation.getTableId(),
          createdAt: relation.getCreatedAt(),
        })),
        total: relationsResult.total || 0,
        limit: parseInt(limit as string, 10),
        hasMore: relationsResult.hasMore || false,
      }

      this.responseHelper.success(res, result)
    } catch (error) {
      this.responseHelper.handleError(res, error, 'Search relations')
    }
  }

  async getConnectedNodes(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params
      const { depth = 1, direction = 'BOTH', relationTypes = [], tableId } = req.query

      if (!nodeId) {
        this.responseHelper.validationError(res, 'nodeId is required')
        return
      }

      if (!tableId) {
        this.responseHelper.validationError(res, 'tableId is required')
        return
      }

      const relationTypesArray = Array.isArray(relationTypes) ? relationTypes : relationTypes ? [relationTypes] : []

      // Use SearchRelatedNodesUseCase to find connected nodes
      const searchInput = {
        tableId: tableId as string,
        sourceNodeIds: [nodeId as string],
        relationFilters:
          relationTypesArray.length > 0
            ? [
                {
                  relationTypes: relationTypesArray as string[],
                  direction:
                    direction === 'INCOMING'
                      ? RelationDirection.INCOMING
                      : direction === 'OUTGOING'
                        ? RelationDirection.OUTGOING
                        : RelationDirection.BOTH,
                  depth: parseInt(depth as string, 10),
                },
              ]
            : undefined,
        limit: 100, // Default limit for connected nodes
      }

      const searchResult = await this.searchRelatedNodesUseCase.execute(searchInput)

      const result = {
        nodeId,
        depth: parseInt(depth as string, 10),
        direction,
        relationTypes: relationTypesArray,
        connectedNodes: searchResult.nodes.map((node) => ({
          id: node.id,
          title: node.title,
          content: node.content,
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
          attributes: node.attributes || {},
        })),
        relations: searchResult.relations,
        totalCount: searchResult.totalCount,
      }

      this.responseHelper.success(res, result)
    } catch (error) {
      this.responseHelper.handleError(res, error, 'Get connected nodes')
    }
  }

  private toRelationSearchResult(result: PaginatedResult<NodeRelation>): RelationSearchResult {
    return {
      data: result.data ?? [],
      total: result.total ?? 0,
      hasMore: result.hasMore ?? false,
    }
  }

  async findShortestPath(req: Request, res: Response): Promise<void> {
    try {
      const { fromNodeId, toNodeId, maxDepth = 6, tableId } = req.body

      if (!fromNodeId || !toNodeId) {
        this.responseHelper.validationError(res, 'fromNodeId and toNodeId are required')
        return
      }

      if (!tableId) {
        this.responseHelper.validationError(res, 'tableId is required')
        return
      }

      // Use SearchRelatedNodesUseCase with path queries to find shortest path
      const searchInput = {
        tableId: tableId as string,
        pathQueries: [
          {
            startNodeIds: [fromNodeId as string],
            endNodeIds: [toNodeId as string],
            maxDepth: parseInt(maxDepth as string, 10),
          },
        ],
        limit: 1, // We only need one path result
      }

      const searchResult = await this.searchRelatedNodesUseCase.execute(searchInput)

      // Extract the path from the search result
      const path = searchResult.paths && searchResult.paths.length > 0 ? searchResult.paths[0] : null

      const result = {
        fromNodeId,
        toNodeId,
        maxDepth: parseInt(maxDepth as string, 10),
        path: path ? path.path : [],
        distance: path ? path.length : -1,
        found: path !== null,
      }

      this.responseHelper.success(res, result)
    } catch (error) {
      this.responseHelper.handleError(res, error, 'Find shortest path')
    }
  }

  async getNodeRelations(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params
      const { direction = 'BOTH', relationTypes = [] } = req.query

      if (!nodeId) {
        this.responseHelper.validationError(res, 'nodeId is required')
        return
      }

      const relationTypesArray = Array.isArray(relationTypes) ? relationTypes : relationTypes ? [relationTypes] : []

      // Use nodeRelationRepository to get node relations
      const relations = await this.nodeRelationRepository.findByNodeId(
        nodeId as NodeId,
        { limit: 1000 }, // Default limit for relations
      )

      // Filter relations by type if specified
      let incomingRelations = relations.incoming || []
      let outgoingRelations = relations.outgoing || []

      if (relationTypesArray.length > 0) {
        incomingRelations = incomingRelations.filter((relation) =>
          relationTypesArray.includes(relation.getRelationTypeId()),
        )
        outgoingRelations = outgoingRelations.filter((relation) =>
          relationTypesArray.includes(relation.getRelationTypeId()),
        )
      }

      // Filter by direction
      const result: Record<string, unknown> = {
        nodeId,
        direction,
        relationTypes: relationTypesArray,
      }

      if (direction === 'BOTH' || direction === 'INCOMING') {
        result.incomingRelations = incomingRelations.map((relation: NodeRelation) => ({
          id: relation.getId(),
          sourceNodeId: relation.getSourceNodeId(),
          targetNodeId: relation.getTargetNodeId(),
          relationTypeId: relation.getRelationTypeId(),
          tableId: relation.getTableId(),
          createdAt: relation.getCreatedAt(),
        }))
      }

      if (direction === 'BOTH' || direction === 'OUTGOING') {
        result.outgoingRelations = outgoingRelations.map((relation: NodeRelation) => ({
          id: relation.getId(),
          sourceNodeId: relation.getSourceNodeId(),
          targetNodeId: relation.getTargetNodeId(),
          relationTypeId: relation.getRelationTypeId(),
          tableId: relation.getTableId(),
          createdAt: relation.getCreatedAt(),
        }))
      }

      result.totalIncoming = incomingRelations.length
      result.totalOutgoing = outgoingRelations.length

      this.responseHelper.success(res, result)
    } catch (error) {
      this.responseHelper.handleError(res, error, 'Get node relations')
    }
  }
}

function normalizeProjectionProfile(value: unknown): 'component-bundle' | 'operation-contract' | undefined {
  const profile = value === undefined ? 'component-bundle' : value
  if (profile === 'component-bundle' || profile === 'operation-contract') return profile
  return undefined
}

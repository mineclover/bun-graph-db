import type { HttpControllerRequest as Request, HttpControllerResponse as Response } from '../adapters/BunControllerAdapter.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import {
  GraphTraversalService,
  resolveRelationTypeRefs,
  type TraversalDirection,
} from '@/application/services/GraphTraversalService.js'
import type { NodeAttributeSchemaGate } from '@/application/services/NodeAttributeSchemaGate.js'
import type { TableSchemaProjectionService } from '@/application/services/TableSchemaProjectionService.js'
import type {
  HybridSearchNodesInput,
  HybridSearchNodesUseCase,
} from '@/application/use-cases/nodes/HybridSearchNodes.js'
import type { SearchNodesUseCase } from '@/application/use-cases/nodes/SearchNodes.js'
import type { SearchRelatedNodesUseCase } from '@/application/use-cases/relations/SearchRelatedNodes.js'
import type { GetTableDocsUseCase } from '@/application/use-cases/tables/GetTableDocs.js'
import { DEFAULT_PORTS } from '@/core/config/PortConfiguration.js'
import { sha256Base64Url } from '@/shared/utils/portableHash.js'
import {
  toTableSchemaOpenApiOperationContractProjectionResult,
  toTableSchemaOpenApiProjectionResult,
} from '@/core/schema/TableSchemaOpenApiProjection.js'
import type { NodeId, PaginatedResult, TableId } from '@/core/types/CommonTypes.js'
import type { NodeRelation } from '@/domain/entities/NodeRelation.js'
import type { INodeEmbeddingRepository } from '@/domain/repositories/INodeEmbeddingRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { RelationDirection } from '@/domain/value-objects/RelationQuery.js'
import type { FetchLike } from '@/models/GraphQLOperation.js'
import {
  sendError,
  sendHandleError,
  sendNotFound,
  sendSuccess,
  sendValidationError,
} from '../utils/responseHelpers.js'

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
  private readonly authorizationHeader: string | undefined

  constructor(
    private endpoint: string,
    private fetchImpl: FetchLike = fetch,
    internalBridgeToken?: string,
  ) {
    const token = internalBridgeToken?.trim()
    this.authorizationHeader = token ? `Bearer ${token}` : undefined
  }

  async query<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<GraphQLResponse<T>> {
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authorizationHeader ? { Authorization: this.authorizationHeader } : {}),
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
  private readonly graphTraversal?: GraphTraversalService

  constructor(
    private readonly logger: ILogger,
    private readonly getTableDocsUseCase: GetTableDocsUseCase,
    readonly _searchNodesUseCase: SearchNodesUseCase,
    private readonly searchRelatedNodesUseCase: SearchRelatedNodesUseCase,
    private readonly tableRepository: ITableRepository,
    private readonly nodeRelationRepository: INodeRelationRepository,
    port?: number,
    private readonly tableSchemaProjectionService?: Pick<TableSchemaProjectionService, 'project'>,
    fetchImpl?: FetchLike,
    internalBridgeToken?: string,
    private readonly schemaGate?: NodeAttributeSchemaGate,
    private readonly nodeEmbeddingRepository?: INodeEmbeddingRepository,
    private readonly hybridSearchNodesUseCase?: HybridSearchNodesUseCase,
    private readonly nodeRepository?: INodeRepository,
    private readonly relationTypeRepository?: IRelationTypeRepository,
  ) {
    // Use the same port as the server instance
    const serverPort = port || DEFAULT_PORTS.development
    this.graphqlClient = new GraphQLClient(`http://localhost:${serverPort}/graphql`, fetchImpl, internalBridgeToken)
    if (nodeRepository) {
      this.graphTraversal = new GraphTraversalService(nodeRepository, nodeRelationRepository)
    }
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

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Get tables')
    }
  }

  async getTableDocs(req: Request, res: Response): Promise<void> {
    try {
      const tableId = (req.params?.tableId as string | undefined) || (req.query.tableId as string | undefined)
      const { identifier } = req.query
      const {
        includeSampleNodes = true,
        includeUsageStats = false,
        includeRelatedTemplates = true,
        sampleLimit = 3,
      } = req.query

      if (!tableId && !identifier) {
        sendValidationError(res, 'Either tableId or identifier is required')
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
        sendNotFound(res, 'Table')
        return
      }

      sendSuccess(res, result.tableDocs)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Get table docs')
    }
  }

  async getTableOpenApiProjection(req: Request, res: Response): Promise<void> {
    try {
      const { tableId } = req.params
      const profile = normalizeProjectionProfile(req.query.profile)

      if (!tableId) {
        sendValidationError(res, 'tableId is required')
        return
      }
      if (!profile) {
        sendValidationError(res, 'profile must be component-bundle or operation-contract')
        return
      }
      if (!this.tableSchemaProjectionService) {
        sendError(res, this.logger, 503, 'Table schema projection service is not configured', 'Get table OpenAPI projection')
        return
      }

      const projection = await this.tableSchemaProjectionService.project({ tableId })
      const result = profile === 'operation-contract'
        ? toTableSchemaOpenApiOperationContractProjectionResult(projection)
        : toTableSchemaOpenApiProjectionResult(projection)
      const etag = createRepresentationEtag({ success: true, data: result })
      res.setHeader?.('ETag', etag)
      res.setHeader?.('Cache-Control', 'private, must-revalidate')
      const ifNoneMatch = req.headers['if-none-match']
      const requestedEtags = Array.isArray(ifNoneMatch) ? ifNoneMatch : ifNoneMatch?.split(',')
      if (requestedEtags?.some((candidate) => candidate.trim() === etag || candidate.trim() === '*')) {
        res.status(304).send('')
        return
      }

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Get table OpenAPI projection')
    }
  }

  async getTableSchemaAudit(req: Request, res: Response): Promise<void> {
    try {
      const { tableId } = req.params
      if (!tableId) {
        sendValidationError(res, 'tableId is required')
        return
      }
      if (!this.schemaGate) {
        sendError(res, this.logger, 503, 'Node attribute schema gate is not configured', 'Get table schema audit')
        return
      }

      const maxViolationsParam = req.query.maxViolations ? Number(req.query.maxViolations) : undefined
      const report = await this.schemaGate.auditTableConformance(
        { tableId },
        { maxViolations: Number.isFinite(maxViolationsParam) ? maxViolationsParam : undefined },
      )
      sendSuccess(res, report)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Get table schema audit')
    }
  }

  async exportTableWithNodes(req: Request, res: Response): Promise<void> {
    try {
      const { tableId } = req.params
      const { flatFormat = true, outputPath = '' } = req.body

      if (!tableId) {
        sendValidationError(res, 'tableId is required')
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
        sendError(
          res,
          this.logger,
          500,
          `GraphQL error: ${graphqlResult.errors.map((e) => e.message).join(', ')}`,
          'Export table with nodes',
        )
        return
      }

      const exportData = graphqlResult.data?.exportTable
      if (!exportData) {
        sendNotFound(res, 'Export data')
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

          sendSuccess(res, {
            tableId,
            flatFormat,
            outputPath,
            fileSize: JSON.stringify(exportData).length,
            metadata: exportData.metadata,
            statistics: exportData.statistics,
          })
        } catch (fileError) {
          sendHandleError(res, this.logger, fileError, 'File write')
        }
      } else {
        // JSON 응답으로 반환
        sendSuccess(res, exportData)
      }
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Export table with nodes')
    }
  }

  async searchRelations(req: Request, res: Response): Promise<void> {
    try {
      const { tableId, sourceNodeId, targetNodeId, relationTypeId, limit = 20 } = req.query

      if (!tableId) {
        sendValidationError(res, 'tableId is required')
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

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Search relations')
    }
  }

  async getConnectedNodes(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params
      const { depth = 1, direction = 'BOTH', relationTypes = [], tableId } = req.query

      if (!nodeId) {
        sendValidationError(res, 'nodeId is required')
        return
      }

      const rawTypes = Array.isArray(relationTypes)
        ? relationTypes.map(String)
        : typeof relationTypes === 'string' && relationTypes.trim()
          ? relationTypes.split(',').map((entry) => entry.trim()).filter(Boolean)
          : []
      const parsedDepth = Number.isFinite(Number(depth)) ? Number.parseInt(String(depth), 10) : 1
      const directionUpper = String(direction || 'BOTH').toUpperCase()
      const traversalDirection: TraversalDirection =
        directionUpper === 'INCOMING' ? 'INCOMING' : directionUpper === 'OUTGOING' ? 'OUTGOING' : 'BOTH'

      if (this.graphTraversal && this.nodeRepository) {
        const sourceNode = await this.nodeRepository.findById(nodeId as NodeId)
        if (!sourceNode) {
          sendError(res, this.logger, 404, `Node with id '${nodeId}' not found`, 'Get connected nodes')
          return
        }
        const resolvedTableId = (tableId as string | undefined) ?? sourceNode.getTableId()
        const resolvedTypes =
          this.relationTypeRepository && rawTypes.length > 0
            ? await resolveRelationTypeRefs(this.relationTypeRepository, rawTypes)
            : undefined

        if (resolvedTypes && resolvedTypes.ids.length === 0) {
          sendSuccess(res, {
            nodeId,
            tableId: resolvedTableId,
            depth: parsedDepth,
            direction: traversalDirection,
            relationTypes: rawTypes,
            connectedNodes: [],
            relations: [],
            totalCount: 0,
          })
          return
        }

        const traversal = await this.graphTraversal.connectedNodesWithDetails(
          nodeId,
          parsedDepth,
          traversalDirection,
          resolvedTypes?.ids,
        )
        const result = {
          nodeId,
          tableId: resolvedTableId,
          depth: parsedDepth,
          direction: traversalDirection,
          relationTypes: rawTypes,
          connectedNodes: traversal.nodes.map(({ node, distance }) => ({
            id: node.getId(),
            tableId: node.getTableId(),
            title: node.getTitle(),
            content: node.getContent(),
            description: node.getDescription(),
            distance,
            createdAt: node.getCreatedAt(),
            updatedAt: node.getUpdatedAt(),
          })),
          relations: traversal.relations.map((relation) => ({
            id: relation.getId(),
            sourceNodeId: relation.getSourceNodeId(),
            targetNodeId: relation.getTargetNodeId(),
            relationTypeId: relation.getRelationTypeId(),
            properties: relation.getProperties(),
            strength: relation.getStrength(),
            confidence: relation.getConfidence(),
          })),
          totalCount: traversal.nodes.length,
        }
        sendSuccess(res, result)
        return
      }

      if (!tableId) {
        sendValidationError(res, 'tableId is required')
        return
      }

      // Fallback when unit tests construct GraphApiController without repositories
      const searchInput = {
        tableId: tableId as string,
        sourceNodeIds: [nodeId as string],
        relationFilters: [
          {
            ...(rawTypes.length > 0 ? { relationTypes: rawTypes } : {}),
            direction:
              traversalDirection === 'INCOMING'
                ? RelationDirection.INCOMING
                : traversalDirection === 'OUTGOING'
                  ? RelationDirection.OUTGOING
                  : RelationDirection.BOTH,
            depth: parsedDepth,
          },
        ],
        limit: 100,
      }

      const searchResult = await this.searchRelatedNodesUseCase.execute(searchInput)

      const result = {
        nodeId,
        depth: parsedDepth,
        direction: traversalDirection,
        relationTypes: rawTypes,
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

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Get connected nodes')
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
      const body = (req.body ?? {}) as {
        fromNodeId?: string
        toNodeId?: string
        startNodeIds?: string[]
        endNodeIds?: string[]
        maxDepth?: number | string
        direction?: string
        relationTypes?: string[]
        tableId?: string
      }
      const fromNodeId = body.fromNodeId || body.startNodeIds?.[0]
      const toNodeId = body.toNodeId || body.endNodeIds?.[0]
      const maxDepth = body.maxDepth !== undefined ? Number.parseInt(String(body.maxDepth), 10) : 6
      const directionUpper = String(body.direction || 'BOTH').toUpperCase()
      const traversalDirection: TraversalDirection =
        directionUpper === 'OUTGOING' ? 'OUTGOING' : directionUpper === 'INCOMING' ? 'INCOMING' : 'BOTH'

      if (!fromNodeId || !toNodeId) {
        sendValidationError(res, 'fromNodeId and toNodeId are required')
        return
      }

      if (this.graphTraversal && this.nodeRepository) {
        const relationTypeRefs = Array.isArray(body.relationTypes) ? body.relationTypes.map(String) : undefined
        const resolvedTypes =
          this.relationTypeRepository && relationTypeRefs && relationTypeRefs.length > 0
            ? await resolveRelationTypeRefs(this.relationTypeRepository, relationTypeRefs)
            : undefined

        const shortest =
          resolvedTypes && resolvedTypes.ids.length === 0
            ? null
            : await this.graphTraversal.findShortestPath(
                fromNodeId,
                toNodeId,
                maxDepth,
                traversalDirection,
                resolvedTypes?.ids,
              )

        sendSuccess(res, {
          fromNodeId,
          toNodeId,
          maxDepth,
          direction: traversalDirection,
          path: shortest ? shortest.nodes.map((node) => node.getId()) : [],
          nodes: shortest
            ? shortest.nodes.map((node) => ({
                id: node.getId(),
                tableId: node.getTableId(),
                content: node.getContent(),
                title: node.getTitle(),
              }))
            : [],
          relations: shortest
            ? shortest.relations.map((relation) => ({
                id: relation.getId(),
                sourceNodeId: relation.getSourceNodeId(),
                targetNodeId: relation.getTargetNodeId(),
                relationTypeId: relation.getRelationTypeId(),
                strength: relation.getStrength(),
                confidence: relation.getConfidence(),
              }))
            : [],
          distance: shortest ? shortest.distance : -1,
          found: shortest !== null,
        })
        return
      }

      if (!body.tableId) {
        sendValidationError(res, 'tableId is required')
        return
      }

      const searchInput = {
        tableId: body.tableId,
        pathQueries: [
          {
            startNodeIds: [fromNodeId],
            endNodeIds: [toNodeId],
            maxDepth,
          },
        ],
        limit: 1,
      }

      const searchResult = await this.searchRelatedNodesUseCase.execute(searchInput)
      const path = searchResult.paths && searchResult.paths.length > 0 ? searchResult.paths[0] : null

      const result = {
        fromNodeId,
        toNodeId,
        maxDepth,
        path: path ? path.path : [],
        distance: path ? path.length : -1,
        found: path !== null,
      }

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Find shortest path')
    }
  }

  async getNodeRelations(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params
      const { direction = 'BOTH', relationTypes = [] } = req.query

      if (!nodeId) {
        sendValidationError(res, 'nodeId is required')
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

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Get node relations')
    }
  }

  async setNodeEmbedding(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params
      if (!nodeId) {
        sendValidationError(res, 'nodeId is required')
        return
      }
      if (!this.nodeEmbeddingRepository) {
        sendError(
          res,
          this.logger,
          503,
          'Node embedding repository is not configured',
          'Set node embedding',
        )
        return
      }

      const body = (req.body ?? {}) as {
        vector?: number[]
        model?: string
        tableId?: string
      }
      const embedding = await this.nodeEmbeddingRepository.upsert({
        nodeId,
        tableId: body.tableId,
        vector: Array.isArray(body.vector) ? body.vector : [],
        model: body.model,
      })
      sendSuccess(res, embedding)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Set node embedding')
    }
  }

  async getNodeEmbedding(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params
      if (!nodeId) {
        sendValidationError(res, 'nodeId is required')
        return
      }
      if (!this.nodeEmbeddingRepository) {
        sendError(
          res,
          this.logger,
          503,
          'Node embedding repository is not configured',
          'Get node embedding',
        )
        return
      }

      const embedding = await this.nodeEmbeddingRepository.findByNodeId(nodeId)
      if (!embedding) {
        sendNotFound(res, 'Node embedding')
        return
      }
      sendSuccess(res, embedding)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Get node embedding')
    }
  }

  async removeNodeEmbedding(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params
      if (!nodeId) {
        sendValidationError(res, 'nodeId is required')
        return
      }
      if (!this.nodeEmbeddingRepository) {
        sendError(
          res,
          this.logger,
          503,
          'Node embedding repository is not configured',
          'Remove node embedding',
        )
        return
      }

      const deleted = await this.nodeEmbeddingRepository.deleteByNodeId(nodeId)
      sendSuccess(res, { nodeId, deleted })
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Remove node embedding')
    }
  }

  async hybridSearchNodes(req: Request, res: Response): Promise<void> {
    try {
      if (!this.hybridSearchNodesUseCase) {
        sendError(
          res,
          this.logger,
          503,
          'Hybrid search service is not configured',
          'Hybrid search nodes',
        )
        return
      }

      const input = (req.body ?? {}) as HybridSearchNodesInput
      const result = await this.hybridSearchNodesUseCase.execute(input)
      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Hybrid search nodes')
    }
  }
}

function createRepresentationEtag(value: unknown): string {
  const digest = sha256Base64Url(JSON.stringify(value))
  return `"sha256-${digest}"`
}

function normalizeProjectionProfile(value: unknown): 'component-bundle' | 'operation-contract' | undefined {
  const profile = value === undefined ? 'component-bundle' : value
  if (profile === 'component-bundle' || profile === 'operation-contract') return profile
  return undefined
}

import type { Request, Response } from 'express'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { GetTableDocsUseCase } from '@/application/use-cases/tables/GetTableDocs.js'
import { getErrorMessage, toErrorMeta } from '../utils/errorHelpers.js'

interface GraphQLResponse<T = any> {
  data?: T
  errors?: Array<{ message: string }>
}

class GraphQLClient {
  constructor(private endpoint: string) {}

  async query<T = any>(query: string, variables?: any): Promise<GraphQLResponse<T>> {
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
        errors: [{ message: error instanceof Error ? error.message : 'GraphQL request failed' }]
      }
    }
  }
}

export class GraphApiController {
  private graphqlClient: GraphQLClient

  constructor(
    private readonly logger: ILogger,
    private readonly getTableDocsUseCase: GetTableDocsUseCase,
    port?: number
  ) {
    // Use the same port as the server instance
    const serverPort = port || 4000
    this.graphqlClient = new GraphQLClient(`http://localhost:${serverPort}/graphql`)
  }

  async getTables(req: Request, res: Response): Promise<void> {
    try {
      const {
        hasNodes,
        limit = 50,
        offset = 0,
        search = '',
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query

      // TODO: Implement with actual use case
      const result = {
        tables: [],
        total: 0,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      }

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      this.logger.error('Get tables error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: 'Get tables failed',
      })
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
        res.status(400).json({
          success: false,
          error: 'Either tableId or identifier is required',
        })
        return
      }

      // Use the actual GetTableDocs Use Case
      const result = await this.getTableDocsUseCase.execute({
        tableId: tableId as string,
        identifier: identifier as string,
        includeSampleNodes: (typeof includeSampleNodes === 'string' ? includeSampleNodes === 'true' : !!includeSampleNodes),
        includeUsageStats: (typeof includeUsageStats === 'string' ? includeUsageStats === 'true' : !!includeUsageStats),
        includeRelatedTemplates:
          includeRelatedTemplates === 'true' || includeRelatedTemplates === true,
        sampleLimit: parseInt(sampleLimit as string, 10) || 3,
      })

      if (!result.tableDocs) {
        res.status(404).json({
          success: false,
          error: 'Table not found',
        })
        return
      }

      res.json({
        success: true,
        data: result.tableDocs,
      })
    } catch (error) {
      this.logger.error('Get table docs error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: 'Get table docs failed',
      })
    }
  }

  async exportTableWithNodes(req: Request, res: Response): Promise<void> {
    try {
      const { tableId } = req.params
      const { flatFormat = true, outputPath = '' } = req.body

      if (!tableId) {
        res.status(400).json({
          success: false,
          error: 'tableId is required',
        })
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

      const graphqlResult = await this.graphqlClient.query(query, { tableId })

      if (graphqlResult.errors) {
        this.logger.error('GraphQL export error:', { errors: graphqlResult.errors })
        res.status(500).json({
          success: false,
          error: `GraphQL error: ${graphqlResult.errors.map(e => e.message).join(', ')}`,
        })
        return
      }

      const exportData = graphqlResult.data?.exportTable
      if (!exportData) {
        res.status(404).json({
          success: false,
          error: 'No export data returned',
        })
        return
      }

      // 파일로 저장이 요청된 경우
      if (outputPath) {
        try {
          const fs = await import('fs/promises')
          const path = await import('path')

          // 디렉토리 생성 (존재하지 않는 경우)
          const dir = path.dirname(outputPath)
          await fs.mkdir(dir, { recursive: true })

          // JSON 데이터를 파일에 저장
          await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2), 'utf-8')

          this.logger.info(`Table ${tableId} exported to ${outputPath}`)

          res.json({
            success: true,
            data: {
              tableId,
              flatFormat,
              outputPath,
              fileSize: JSON.stringify(exportData).length,
              metadata: exportData.metadata,
              statistics: exportData.statistics,
            },
          })
        } catch (fileError) {
          this.logger.error('File write error:', toErrorMeta(fileError))
          res.status(500).json({
            success: false,
            error: `Failed to save file: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`,
          })
        }
      } else {
        // JSON 응답으로 반환
        res.json({
          success: true,
          data: exportData,
        })
      }
    } catch (error) {
      this.logger.error('Export table with nodes error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Export table with nodes failed',
      })
    }
  }

  async searchRelations(req: Request, res: Response): Promise<void> {
    try {
      const { tableId, sourceNodeId, targetNodeId, relationTypeId, limit = 20 } = req.query

      // TODO: Implement with actual use case
      const result = {
        relations: [],
        total: 0,
        limit: parseInt(limit as string, 10),
      }

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      this.logger.error('Search relations error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: 'Search relations failed',
      })
    }
  }

  async getConnectedNodes(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params
      const { depth = 1, direction = 'BOTH', relationTypes = [] } = req.query

      if (!nodeId) {
        res.status(400).json({
          success: false,
          error: 'nodeId is required',
        })
        return
      }

      const relationTypesArray = Array.isArray(relationTypes)
        ? relationTypes
        : relationTypes
          ? [relationTypes]
          : []

      // TODO: Implement with actual use case
      const result = {
        nodeId,
        depth: parseInt(depth as string, 10),
        direction,
        relationTypes: relationTypesArray,
        connectedNodes: [],
      }

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      this.logger.error('Get connected nodes error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: 'Get connected nodes failed',
      })
    }
  }

  async findShortestPath(req: Request, res: Response): Promise<void> {
    try {
      const { fromNodeId, toNodeId, maxDepth = 6 } = req.body

      if (!fromNodeId || !toNodeId) {
        res.status(400).json({
          success: false,
          error: 'fromNodeId and toNodeId are required',
        })
        return
      }

      // TODO: Implement with actual use case
      const result = {
        fromNodeId,
        toNodeId,
        maxDepth: parseInt(maxDepth as string, 10),
        path: [],
        distance: -1,
      }

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      this.logger.error('Find shortest path error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Find shortest path failed',
      })
    }
  }

  async getNodeRelations(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params
      const { direction = 'BOTH', relationTypes = [] } = req.query

      if (!nodeId) {
        res.status(400).json({
          success: false,
          error: 'nodeId is required',
        })
        return
      }

      const relationTypesArray = Array.isArray(relationTypes)
        ? relationTypes
        : relationTypes
          ? [relationTypes]
          : []

      // TODO: Implement with actual use case
      const result = {
        nodeId,
        direction,
        relationTypes: relationTypesArray,
        outgoingRelations: [],
        incomingRelations: [],
      }

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      this.logger.error('Get node relations error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: 'Get node relations failed',
      })
    }
  }
}

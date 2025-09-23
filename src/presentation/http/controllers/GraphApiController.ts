import type { Request, Response } from 'express'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { GetTableDocsUseCase } from '@/application/use-cases/tables/GetTableDocs.js'
import { getErrorMessage, toErrorMeta } from '../utils/errorHelpers.js'

export class GraphApiController {
  constructor(
    private readonly logger: ILogger,
    private readonly getTableDocsUseCase: GetTableDocsUseCase
  ) {}

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

      // TODO: Implement with actual use case
      const result = {
        tableId,
        flatFormat,
        exportData: {},
        outputPath: outputPath || null,
      }

      res.json({
        success: true,
        data: result,
      })
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

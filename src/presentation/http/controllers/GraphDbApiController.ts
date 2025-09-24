import type { Request, Response } from 'express'
import type { ILogger } from '@/application/ports/ILogger.js'
import type {
  ApiResponse,
  ExecuteTemplateData,
  ExportTemplateData,
  HealthCheckData,
  ImportTemplateData,
  NodeData,
  RelationData,
  SearchNodesData,
  SearchTablesData,
  SearchTemplatesData,
  SystemStatsData,
  TableData,
  TemplateData,
} from '../types/ApiResponseTypes.js'
import { getErrorMessage, toErrorMeta } from '../utils/errorHelpers.js'
import { sendSuccess, sendHandleError, sendValidationError } from '../utils/responseHelpers.js'

export class GraphDbApiController {
  constructor(private readonly logger: ILogger) {}

  // System Operations
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const result: HealthCheckData = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: 'Connected',
        version: '1.0.0',
      }
      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Health check')
    }
  }

  async systemStats(req: Request, res: Response): Promise<void> {
    try {
      const result = {
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          percentage: Math.round(
            (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
          ),
        },
        process: {
          pid: process.pid,
          cpu: process.cpuUsage(),
          platform: process.platform,
        },
      }
      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'System stats')
    }
  }

  // Table Operations
  async createTable(req: Request, res: Response): Promise<void> {
    try {
      const { identifier, name, description } = req.body

      if (!identifier) {
        sendValidationError(res, 'identifier is required')
        return
      }

      const result = {
        id: `table_${Date.now()}`,
        identifier,
        name: name || identifier,
        description: description || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Create table')
    }
  }

  async searchTables(req: Request, res: Response): Promise<void> {
    try {
      const searchTerm = (req.query.searchTerm as string) || ''
      const limit = parseInt(req.query.limit as string) || 10

      const result = {
        tables: [],
        total: 0,
        searchTerm,
        limit,
      }

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Search tables')
    }
  }

  // Node Operations
  async createNode(req: Request, res: Response): Promise<void> {
    try {
      const { tableId, content, metadata } = req.body

      if (!tableId || !content) {
        sendValidationError(res, 'tableId and content are required')
        return
      }

      const result = {
        id: `node_${Date.now()}`,
        tableId,
        content,
        metadata: metadata || {},
        createdAt: new Date().toISOString(),
      }

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Create node')
    }
  }

  async searchNodes(req: Request, res: Response): Promise<void> {
    try {
      const tableId = req.query.tableId as string
      const search = (req.query.search as string) || ''
      const limit = parseInt(req.query.limit as string) || 10

      if (!tableId) {
        sendValidationError(res, 'tableId is required')
        return
      }

      const result = {
        nodes: [],
        total: 0,
        tableId,
        search,
        limit,
      }

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Search nodes')
    }
  }

  // Relation Operations
  async createRelation(req: Request, res: Response): Promise<void> {
    try {
      const { fromNodeId, toNodeId, relationshipType, tableId, properties } = req.body

      if (!fromNodeId || !toNodeId || !relationshipType || !tableId) {
        sendValidationError(res, 'fromNodeId, toNodeId, relationshipType, and tableId are required')
        return
      }

      const result = {
        id: `relation_${Date.now()}`,
        fromNodeId,
        toNodeId,
        relationshipType,
        tableId,
        properties: properties || {},
        createdAt: new Date().toISOString(),
      }

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Create relation')
    }
  }

  // Template Operations
  async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { identifier, name, query, tags } = req.body

      if (!identifier || !name || !query) {
        sendValidationError(res, 'identifier, name, and query are required')
        return
      }

      const result = {
        id: `template_${Date.now()}`,
        identifier,
        name,
        query,
        tags: tags || [],
        createdAt: new Date().toISOString(),
      }

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Create template')
    }
  }

  async searchTemplates(req: Request, res: Response): Promise<void> {
    try {
      const searchTerm = (req.query.searchTerm as string) || ''
      const tags = (req.query.tags as string[]) || []

      const result = {
        templates: [],
        total: 0,
        searchTerm,
        tags,
      }

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Search templates')
    }
  }

  async executeTemplateWithGraphQL(req: Request, res: Response): Promise<void> {
    try {
      const { templateIdentifier, variables } = req.body

      if (!templateIdentifier) {
        sendValidationError(res, 'templateIdentifier is required')
        return
      }

      const result = {
        templateIdentifier,
        variables: variables || {},
        executionResult: {
          success: true,
          data: {},
          errors: [],
        },
        executedAt: new Date().toISOString(),
      }

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Execute template')
    }
  }

  async exportTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateIdentifier } = req.body

      if (!templateIdentifier) {
        sendValidationError(res, 'templateIdentifier is required')
        return
      }

      const result: ExportTemplateData = {
        templateIdentifier,
        exportData: {
          template: {
            id: `template_${Date.now()}`,
            identifier: templateIdentifier,
            name: `Template ${templateIdentifier}`,
            query: 'query { placeholder }',
            tags: [],
            createdAt: new Date().toISOString(),
          },
          metadata: {
            exportVersion: '1.0.0',
            dependencies: [],
          },
        },
        exportedAt: new Date().toISOString(),
      }

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Export template')
    }
  }

  async importTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { jsonData, overwriteExisting, generateNewIdentifier } = req.body

      if (!jsonData) {
        sendValidationError(res, 'jsonData is required')
        return
      }

      const result: ImportTemplateData = {
        importResult: {
          success: true,
          templateIdentifier: 'imported_template',
          conflicts: overwriteExisting ? [] : ['Template already exists'],
        },
        importedAt: new Date().toISOString(),
      }

      sendSuccess(res, result)
    } catch (error) {
      sendHandleError(res, this.logger, error, 'Import template')
    }
  }
}

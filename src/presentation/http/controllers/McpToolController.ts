import type { Request, Response } from 'express'
import type { ILogger } from '@/application/ports/ILogger.js'
import { BulkTemplateImportTool } from '@/application/services/BulkTemplateImportTool.js'
import { RestApiClient } from '@/application/services/RestApiClient.js'
import { getErrorMessage, toErrorMeta } from '../utils/errorHelpers.js'

/**
 * MCP Tool Controller - Bridge between MCP protocol and local services
 *
 * Handles MCP tool execution requests and provides the bridge between
 * GraphQL operations and local file system services
 */
export class McpToolController {
  private bulkImportTool: BulkTemplateImportTool

  constructor(
    private readonly logger: ILogger,
    port?: number
  ) {
    // Initialize the REST client pointing to our GraphQL server
    const serverPort = port || 4000
    const restClient = new RestApiClient(`http://localhost:${serverPort}`)

    // Initialize the bulk import tool
    this.bulkImportTool = new BulkTemplateImportTool(restClient)
  }

  /**
   * Handle bulk template import MCP tool call
   */
  async bulkImportTemplates(req: Request, res: Response): Promise<void> {
    try {
      const {
        overwriteExisting = false,
        generateNewIdentifier = false,
        dryRun = false,
        filter = [],
        batchSize = 10,
      } = req.body

      this.logger.info('MCP Tool: bulk-import-templates called', {
        overwriteExisting,
        generateNewIdentifier,
        dryRun,
        filterCount: filter.length,
        batchSize,
      })

      const result = await this.bulkImportTool.bulkImportTemplates({
        overwriteExisting,
        generateNewIdentifier,
        dryRun,
        filter,
        batchSize,
      })

      res.json({
        success: true,
        data: result,
        tool: 'bulk-import-templates',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: bulk-import-templates error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'bulk-import-templates',
      })
    }
  }

  /**
   * Handle list available templates MCP tool call
   */
  async listAvailableTemplates(_req: Request, res: Response): Promise<void> {
    try {
      this.logger.info('MCP Tool: list-available-templates called')

      const result = await this.bulkImportTool.listAvailableTemplates()

      res.json({
        success: true,
        data: {
          templates: result,
          count: result.length,
        },
        tool: 'list-available-templates',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: list-available-templates error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'list-available-templates',
      })
    }
  }

  /**
   * Handle get import status MCP tool call
   */
  async getImportStatus(_req: Request, res: Response): Promise<void> {
    try {
      this.logger.info('MCP Tool: get-import-status called')

      const result = await this.bulkImportTool.getImportStatus()

      res.json({
        success: true,
        data: result,
        tool: 'get-import-status',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: get-import-status error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'get-import-status',
      })
    }
  }

  /**
   * Generic MCP tool call handler
   * Routes tool calls to appropriate handlers based on tool name
   */
  async callMcpTool(req: Request, res: Response): Promise<void> {
    try {
      const { toolName, parameters = {} } = req.body

      if (!toolName) {
        res.status(400).json({
          success: false,
          error: 'toolName is required',
          tool: 'unknown',
        })
        return
      }

      this.logger.info(`MCP Tool: ${toolName} called`, { parameters })

      // Route to appropriate handler based on tool name
      switch (toolName) {
        case 'bulk-import-templates':
          req.body = parameters
          return this.bulkImportTemplates(req, res)

        case 'list-available-templates':
          req.body = parameters
          return this.listAvailableTemplates(req, res)

        case 'get-import-status':
          req.body = parameters
          return this.getImportStatus(req, res)

        default:
          res.status(404).json({
            success: false,
            error: `Unknown MCP tool: ${toolName}`,
            tool: toolName,
            availableTools: [
              'bulk-import-templates',
              'list-available-templates',
              'get-import-status',
            ],
          })
      }
    } catch (error) {
      this.logger.error('MCP Tool: Generic call error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'generic-mcp-call',
      })
    }
  }

  /**
   * List all available MCP tools
   */
  async listMcpTools(_req: Request, res: Response): Promise<void> {
    try {
      const tools = [
        {
          name: 'bulk-import-templates',
          description:
            'Bulk import templates from exported-templates directory. Bridge between local file system and GraphQL operations.',
          operationType: 'mutation',
          parameters: {
            overwriteExisting: 'boolean (default: false)',
            generateNewIdentifier: 'boolean (default: false)',
            dryRun: 'boolean (default: false)',
            filter: 'string[] (optional)',
            batchSize: 'number (default: 10, max: 50)',
          },
        },
        {
          name: 'list-available-templates',
          description:
            'List all available template files in exported-templates directory with metadata.',
          operationType: 'query',
          parameters: {},
        },
        {
          name: 'get-import-status',
          description: 'Get status and summary of available templates for import.',
          operationType: 'query',
          parameters: {},
        },
      ]

      res.json({
        success: true,
        data: {
          tools,
          count: tools.length,
          description: 'MCP Tools serve as bridges between GraphQL operations and local services',
        },
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: List tools error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
      })
    }
  }
}

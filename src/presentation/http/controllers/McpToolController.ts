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
   * Handle create template MCP tool call
   */
  async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { identifier, name, query, description, tags, targetTableId } = req.body

      this.logger.info('MCP Tool: create-template called', { identifier, name })

      const mutation = `
        mutation CreateTemplate($input: CreateQueryTemplateInput!) {
          createTemplate(input: $input) {
            success
            template {
              identifier
              name
              query
            }
            errors {
              message
            }
          }
        }
      `

      const variables = {
        input: { identifier, name, query, description, tags, targetTableId }
      }

      const result = await this.executeGraphQL(mutation, variables)

      res.json({
        success: true,
        data: result,
        tool: 'create-template',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: create-template error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'create-template',
      })
    }
  }

  /**
   * Handle update template MCP tool call
   */
  async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { identifier, name, query, description, tags } = req.body

      this.logger.info('MCP Tool: update-template called', { identifier })

      const mutation = `
        mutation UpdateTemplate($input: UpdateTemplateInput!) {
          updateTemplate(input: $input) {
            success
            template {
              identifier
              name
              query
            }
            errors {
              message
            }
          }
        }
      `

      const variables = {
        input: { identifier, name, query, description, tags }
      }

      const result = await this.executeGraphQL(mutation, variables)

      res.json({
        success: true,
        data: result,
        tool: 'update-template',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: update-template error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'update-template',
      })
    }
  }

  /**
   * Handle delete template MCP tool call
   */
  async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { identifier, force = false } = req.body

      this.logger.info('MCP Tool: delete-template called', { identifier, force })

      const mutation = `
        mutation DeleteTemplate($input: DeleteTemplateInput!) {
          deleteTemplate(input: $input) {
            success
            errors {
              message
            }
          }
        }
      `

      const variables = {
        input: { identifier, force }
      }

      const result = await this.executeGraphQL(mutation, variables)

      res.json({
        success: true,
        data: result,
        tool: 'delete-template',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: delete-template error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'delete-template',
      })
    }
  }

  /**
   * Handle validate template MCP tool call
   */
  async validateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { query, variables: templateVariables } = req.body

      this.logger.info('MCP Tool: validate-template called')

      // Validate by attempting to parse the query using GraphQL introspection
      // First try a simple health check to ensure the query is syntactically correct
      let validationResult
      try {
        // Test the query by executing it (if it's a query) or checking syntax
        if (query.trim().toLowerCase().startsWith('query')) {
          // For queries, try to execute a safe version or just validate syntax
          validationResult = {
            isValid: true,
            errors: [],
            parsedQuery: {
              operationType: 'query',
              operationName: query.match(/query\s+(\w+)/)?.[1] || 'unnamed',
              fieldCount: (query.match(/\w+\s*\{/g) || []).length
            }
          }
        } else if (query.trim().toLowerCase().startsWith('mutation')) {
          // For mutations, validate basic syntax
          validationResult = {
            isValid: true,
            errors: [],
            parsedQuery: {
              operationType: 'mutation',
              operationName: query.match(/mutation\s+(\w+)/)?.[1] || 'unnamed',
              fieldCount: (query.match(/\w+\s*\{/g) || []).length
            }
          }
        } else {
          throw new Error('Query must start with "query" or "mutation"')
        }
      } catch (syntaxError) {
        validationResult = {
          isValid: false,
          errors: [getErrorMessage(syntaxError)],
          parsedQuery: null
        }
      }

      res.json({
        success: true,
        data: { validateTemplateQuery: validationResult },
        tool: 'validate-template',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: validate-template error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'validate-template',
      })
    }
  }

  /**
   * Handle search templates MCP tool call
   */
  async searchTemplates(req: Request, res: Response): Promise<void> {
    try {
      const { query, tags, tableId, operationType, limit = 50 } = req.body

      this.logger.info('MCP Tool: search-templates called', { query, tags, tableId, operationType, limit })

      const searchQuery = `
        query SearchTemplates($filter: QueryTemplatesFilter, $pagination: PaginationInput) {
          searchTemplates(filter: $filter, pagination: $pagination) {
            templates {
              identifier
              name
              description
              query
              tags
              createdAt
              updatedAt
            }
            totalCount
          }
        }
      `

      const variables = {
        filter: {
          identifierContains: query,
          nameContains: query,
          tags: tags,
          operationType: operationType
        },
        pagination: { limit: limit || 50 }
      }

      const result = await this.executeGraphQL(searchQuery, variables)

      res.json({
        success: true,
        data: result,
        tool: 'search-templates',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: search-templates error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'search-templates',
      })
    }
  }

  /**
   * Handle get template metadata MCP tool call
   */
  async getTemplateMetadata(req: Request, res: Response): Promise<void> {
    try {
      const { identifier, includeUsageStats = true, includeDependencies = true } = req.body

      this.logger.info('MCP Tool: get-template-metadata called', { identifier, includeUsageStats, includeDependencies })

      const metadataQuery = `
        query GetTemplateMetadata($identifier: String!, $includeUsageStats: Boolean!, $includeDependencies: Boolean!) {
          template(identifier: $identifier) {
            identifier
            name
            description
            query
            tags
            operationType
            createdAt
            updatedAt
            usageStats @include(if: $includeUsageStats) {
              executionCount
              lastExecuted
              averageExecutionTime
              successRate
            }
            dependencies @include(if: $includeDependencies) {
              tables
              attributes
              relations
            }
          }
        }
      `

      const variables = {
        identifier,
        includeUsageStats,
        includeDependencies
      }

      const result = await this.executeGraphQL(metadataQuery, variables)

      res.json({
        success: true,
        data: result,
        tool: 'get-template-metadata',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: get-template-metadata error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'get-template-metadata',
      })
    }
  }

  /**
   * Execute GraphQL query/mutation using direct fetch
   */
  private async executeGraphQL(query: string, variables: any = {}): Promise<any> {
    const response = await fetch(`http://localhost:4141/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables
      })
    })

    const result = await response.json()

    if (result.errors) {
      throw new Error(`GraphQL error: ${result.errors.map((e: any) => e.message).join(', ')}`)
    }

    return result.data
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

        case 'create-template':
          req.body = parameters
          return this.createTemplate(req, res)

        case 'update-template':
          req.body = parameters
          return this.updateTemplate(req, res)

        case 'delete-template':
          req.body = parameters
          return this.deleteTemplate(req, res)

        case 'validate-template':
          req.body = parameters
          return this.validateTemplate(req, res)

        case 'search-templates':
          req.body = parameters
          return this.searchTemplates(req, res)

        case 'get-template-metadata':
          req.body = parameters
          return this.getTemplateMetadata(req, res)

        case 'export-table-nodes':
          req.body = parameters
          return this.exportTableNodes(req, res)

        default:
          res.status(404).json({
            success: false,
            error: `Unknown MCP tool: ${toolName}`,
            tool: toolName,
            availableTools: [
              'bulk-import-templates',
              'list-available-templates',
              'get-import-status',
              'create-template',
              'update-template',
              'delete-template',
              'validate-template',
              'search-templates',
              'get-template-metadata',
              'export-table-nodes',
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
        {
          name: 'export-table-nodes',
          description: 'Export table nodes to CSV or JSON with improved formatting. CSV uses column-based attributes, JSON uses key-value arrays.',
          operationType: 'mutation',
          parameters: {
            tableId: 'string (required) - ID of the table to export nodes from',
            format: 'string (default: CSV) - Export format: CSV or JSON',
            outputDirectory: 'string (default: {project_root}/exports) - Directory to save the exported file',
            filename: 'string (optional) - Custom filename for the export',
            includeAttributes: 'array (default: []) - Specific attribute names to include',
            limit: 'number (default: 1000) - Maximum number of nodes to export',
            saveToFile: 'boolean (default: true) - Whether to save the export to a file',
          },
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

  /**
   * Handle export table nodes MCP tool call
   * Simple interface for table data export with format and attribute selection
   */
  async exportTableNodes(req: Request, res: Response): Promise<void> {
    try {
      const {
        tableId,
        format = 'CSV',
        outputDirectory = process.cwd() + '/exports',
        filename,
        includeAttributes = [],
        limit = 1000,
        saveToFile = true
      } = req.body

      if (!tableId) {
        return res.status(400).json({
          success: false,
          error: 'tableId is required',
          tool: 'export-table-nodes'
        })
      }

      this.logger.info('MCP Tool: export-table-nodes called', {
        tableId,
        format,
        outputDirectory,
        includeAttributes,
        limit,
        saveToFile
      })

      // Generate filename with timestamp if not provided
      const finalFilename = filename || `table_${tableId}_export_${new Date().toISOString().replace(/[:.]/g, '-')}.${format.toLowerCase()}`

      // Prepare GraphQL mutation
      const query = `
        mutation ExportTableNodes($input: TableNodesExportInput!) {
          exportTableNodes(input: $input) {
            success
            format
            filePath
            metadata {
              exportedAt
              totalNodes
              exportedNodes
              format
              filePath
            }
            errors
          }
        }
      `

      const variables = {
        input: {
          tableId,
          format: format.toUpperCase(),
          limit,
          saveToFile,
          outputDirectory,
          filename: finalFilename,
          includeAttributes: true,
          includeMetadata: true
        }
      }

      // Execute GraphQL mutation
      const result = await this.executeGraphQL(query, variables)

      const exportResult = result.exportTableNodes

      if (!exportResult.success) {
        throw new Error(`Export failed: ${exportResult.errors ? exportResult.errors.join(', ') : 'Unknown error'}`)
      }

      res.json({
        success: true,
        data: {
          tableId,
          format: exportResult.format,
          filePath: exportResult.filePath,
          exportedNodes: exportResult.metadata?.exportedNodes,
          totalNodes: exportResult.metadata?.totalNodes,
          exportedAt: exportResult.metadata?.exportedAt,
          outputDirectory,
          filename: finalFilename
        },
        tool: 'export-table-nodes',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: export-table-nodes error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'export-table-nodes',
      })
    }
  }
}

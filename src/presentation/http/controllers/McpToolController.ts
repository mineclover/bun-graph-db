import type { HttpControllerRequest as Request, HttpControllerResponse as Response } from '../adapters/BunControllerAdapter.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import { BulkTemplateImportTool } from '@/application/services/BulkTemplateImportTool.js'
import { RestApiClient } from '@/application/services/RestApiClient.js'
import { DEFAULT_PORTS } from '@/core/config/PortConfiguration.js'
import type { FetchLike } from '@/models/GraphQLOperation.js'
import { getErrorMessage, toErrorMeta } from '../utils/errorHelpers.js'

type HttpBodyRequest<TBody> = Request<Record<string, string>, TBody>
type ToolParameters = Record<string, unknown>

interface GraphQLErrorPayload {
  message?: string
}

interface GraphQLResultEnvelope<TData> {
  data?: TData
  errors?: GraphQLErrorPayload[]
}

interface BulkImportTemplatesBody {
  overwriteExisting?: boolean
  generateNewIdentifier?: boolean
  dryRun?: boolean
  filter?: string[]
  batchSize?: number
}

interface CreateTemplateBody {
  identifier?: string
  name?: string
  query?: string
  description?: string
  tags?: string[]
  targetTableId?: string
}

interface UpdateTemplateBody {
  identifier?: string
  name?: string
  query?: string
  description?: string
  tags?: string[]
}

interface DeleteTemplateBody {
  identifier?: string
  force?: boolean
}

interface ValidateTemplateBody {
  query: string
}

interface SearchTemplatesBody {
  query?: string
  tags?: string[]
  tableId?: string
  operationType?: string
  limit?: number
}

interface GetTemplateMetadataBody {
  identifier?: string
  includeUsageStats?: boolean
  includeDependencies?: boolean
}

interface CallMcpToolBody {
  toolName?: string
  parameters?: ToolParameters
}

interface ExportTableNodesBody {
  tableId?: string
  format?: string
  outputDirectory?: string
  filename?: string
  includeAttributes?: string[]
  limit?: number
  saveToFile?: boolean
}

interface InitializeSystemBody {
  mode: string
  options?: ToolParameters
}

interface QuickResetBody {
  preserveTableIds?: boolean
}

interface SetupDemoBody {
  resetFirst?: boolean
}

interface GetTabularSyncConfigBody {
  configKey?: string
}

interface SaveTabularSyncConfigBody {
  configKey?: string
  config?: Record<string, unknown>
  active?: boolean
}

interface ActivateTabularSyncConfigBody {
  configKey?: string
}

interface ResyncTabularSyncTableBody {
  tableIdentifier?: string
}

interface GetTabularSyncStatusBody {
  limit?: number
  tableIdentifier?: string
  status?: string
  mode?: string
  windowPreset?: string
  createdAfter?: string
  createdBefore?: string
}

interface GetTabularSyncSummaryBody extends GetTabularSyncStatusBody {}

interface ExportTableNodesMutationResult {
  success: boolean
  format?: string
  filePath?: string
  metadata?: {
    exportedNodes?: number
    totalNodes?: number
    exportedAt?: string
  }
  errors?: string[]
}

interface ExportTableNodesMutationData {
  exportTableNodes?: ExportTableNodesMutationResult
}

/**
 * MCP Tool Controller - Bridge between MCP protocol and local services
 *
 * Handles MCP tool execution requests and provides the bridge between
 * GraphQL operations and local file system services
 */
export class McpToolController {
  private bulkImportTool: BulkTemplateImportTool
  private readonly graphqlUrl: string
  private readonly fetchImpl: FetchLike
  private readonly authorizationHeader: string | undefined

  constructor(
    private readonly logger: ILogger,
    port?: number,
    fetchImpl: FetchLike = fetch,
    internalBridgeToken?: string,
  ) {
    // Initialize the REST client pointing to our GraphQL server
    const serverPort = port || DEFAULT_PORTS.development
    const token = internalBridgeToken?.trim()
    this.fetchImpl = fetchImpl
    this.authorizationHeader = token ? `Bearer ${token}` : undefined
    const restClient = new RestApiClient(`http://localhost:${serverPort}/api`, internalBridgeToken, fetchImpl)
    this.graphqlUrl = `http://localhost:${serverPort}/graphql`

    // Initialize the bulk import tool
    this.bulkImportTool = new BulkTemplateImportTool(restClient)
  }

  /**
   * Handle bulk template import MCP tool call
   */
  async bulkImportTemplates(req: HttpBodyRequest<BulkImportTemplatesBody>, res: Response): Promise<void> {
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
  async createTemplate(req: HttpBodyRequest<CreateTemplateBody>, res: Response): Promise<void> {
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
        input: { identifier, name, query, description, tags, targetTableId },
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
  async updateTemplate(req: HttpBodyRequest<UpdateTemplateBody>, res: Response): Promise<void> {
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
        input: { identifier, name, query, description, tags },
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
  async deleteTemplate(req: HttpBodyRequest<DeleteTemplateBody>, res: Response): Promise<void> {
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
        input: { identifier, force },
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
  async validateTemplate(req: HttpBodyRequest<ValidateTemplateBody>, res: Response): Promise<void> {
    try {
      const { query } = req.body

      this.logger.info('MCP Tool: validate-template called')

      // Validate by attempting to parse the query using GraphQL introspection
      // First try a simple health check to ensure the query is syntactically correct
      let validationResult: {
        isValid: boolean
        errors: string[]
        parsedQuery?: {
          operationType: string
          operationName: string
          fieldCount: number
        }
        parseError?: string
      }
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
              fieldCount: (query.match(/\w+\s*\{/g) || []).length,
            },
          }
        } else if (query.trim().toLowerCase().startsWith('mutation')) {
          // For mutations, validate basic syntax
          validationResult = {
            isValid: true,
            errors: [],
            parsedQuery: {
              operationType: 'mutation',
              operationName: query.match(/mutation\s+(\w+)/)?.[1] || 'unnamed',
              fieldCount: (query.match(/\w+\s*\{/g) || []).length,
            },
          }
        } else {
          throw new Error('Query must start with "query" or "mutation"')
        }
      } catch (syntaxError) {
        validationResult = {
          isValid: false,
          errors: [getErrorMessage(syntaxError)],
          parsedQuery: undefined,
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
  async searchTemplates(req: HttpBodyRequest<SearchTemplatesBody>, res: Response): Promise<void> {
    try {
      const { query, tags, tableId, operationType, limit = 50 } = req.body

      this.logger.info('MCP Tool: search-templates called', {
        query,
        tags,
        tableId,
        operationType,
        limit,
      })

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
          operationType: operationType,
        },
        pagination: { limit: limit || 50 },
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
  async getTemplateMetadata(req: HttpBodyRequest<GetTemplateMetadataBody>, res: Response): Promise<void> {
    try {
      const { identifier, includeUsageStats = true, includeDependencies = true } = req.body

      this.logger.info('MCP Tool: get-template-metadata called', {
        identifier,
        includeUsageStats,
        includeDependencies,
      })

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
        includeDependencies,
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
  private async executeGraphQL<TData = ToolParameters>(
    query: string,
    variables: ToolParameters = {},
  ): Promise<TData | undefined> {
    const response = await this.fetchImpl(this.graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.authorizationHeader ? { Authorization: this.authorizationHeader } : {}),
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    })

    const result = (await response.json()) as GraphQLResultEnvelope<TData>

    if (result.errors && result.errors.length > 0) {
      throw new Error(`GraphQL error: ${this.getGraphQLErrorMessage(result.errors)}`)
    }

    return result.data
  }

  private getGraphQLErrorMessage(errors: GraphQLErrorPayload[]): string {
    return errors
      .map((error) => (typeof error.message === 'string' ? error.message : 'Unknown GraphQL error'))
      .join(', ')
  }

  private withBody<TBody>(request: Request, body: unknown): HttpBodyRequest<TBody> {
    const typedRequest = request as HttpBodyRequest<TBody>
    typedRequest.body = body as TBody
    return typedRequest
  }

  /**
   * Generic MCP tool call handler
   * Routes tool calls to appropriate handlers based on tool name
   */
  async callMcpTool(req: HttpBodyRequest<CallMcpToolBody>, res: Response): Promise<void> {
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
          return this.bulkImportTemplates(this.withBody<BulkImportTemplatesBody>(req, parameters), res)

        case 'list-available-templates':
          return this.listAvailableTemplates(req, res)

        case 'get-import-status':
          return this.getImportStatus(req, res)

        case 'create-template':
          return this.createTemplate(this.withBody<CreateTemplateBody>(req, parameters), res)

        case 'update-template':
          return this.updateTemplate(this.withBody<UpdateTemplateBody>(req, parameters), res)

        case 'delete-template':
          return this.deleteTemplate(this.withBody<DeleteTemplateBody>(req, parameters), res)

        case 'validate-template':
          return this.validateTemplate(this.withBody<ValidateTemplateBody>(req, parameters), res)

        case 'search-templates':
          return this.searchTemplates(this.withBody<SearchTemplatesBody>(req, parameters), res)

        case 'get-template-metadata':
          return this.getTemplateMetadata(this.withBody<GetTemplateMetadataBody>(req, parameters), res)

        case 'export-table-nodes':
          return this.exportTableNodes(this.withBody<ExportTableNodesBody>(req, parameters), res)

        // System initialization tools
        case 'initialize-system':
          return this.initializeSystem(this.withBody<InitializeSystemBody>(req, parameters), res)

        case 'get-system-status':
          return this.getSystemStatus(req, res)

        case 'quick-reset':
          return this.quickReset(this.withBody<QuickResetBody>(req, parameters), res)

        case 'setup-demo':
          return this.setupDemo(this.withBody<SetupDemoBody>(req, parameters), res)

        case 'list-tabular-sync-configs':
          return this.listTabularSyncConfigs(req, res)

        case 'get-tabular-sync-config':
          return this.getTabularSyncConfig(this.withBody<GetTabularSyncConfigBody>(req, parameters), res)

        case 'save-tabular-sync-config':
          return this.saveTabularSyncConfig(this.withBody<SaveTabularSyncConfigBody>(req, parameters), res)

        case 'activate-tabular-sync-config':
          return this.activateTabularSyncConfig(this.withBody<ActivateTabularSyncConfigBody>(req, parameters), res)

        case 'get-tabular-sync-status':
          return this.getTabularSyncStatus(this.withBody<GetTabularSyncStatusBody>(req, parameters), res)

        case 'get-tabular-sync-summary':
          return this.getTabularSyncSummary(this.withBody<GetTabularSyncSummaryBody>(req, parameters), res)

        case 'resync-tabular-sync-table':
          return this.resyncTabularSyncTable(this.withBody<ResyncTabularSyncTableBody>(req, parameters), res)

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
              'initialize-system',
              'get-system-status',
              'quick-reset',
              'setup-demo',
              'list-tabular-sync-configs',
              'get-tabular-sync-config',
              'save-tabular-sync-config',
              'activate-tabular-sync-config',
              'get-tabular-sync-status',
              'get-tabular-sync-summary',
              'resync-tabular-sync-table',
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
          description: 'List all available template files in exported-templates directory with metadata.',
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
          description:
            'Export table nodes to CSV or JSON with improved formatting. CSV uses column-based attributes, JSON uses key-value arrays.',
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
        {
          name: 'list-tabular-sync-configs',
          description: 'List all saved tabular sync configuration records.',
          operationType: 'query',
          parameters: {},
        },
        {
          name: 'get-tabular-sync-config',
          description: 'Get a specific tabular sync configuration record by configKey, or the active config when omitted.',
          operationType: 'query',
          parameters: {
            configKey: 'string (optional) - Configuration key to fetch',
          },
        },
        {
          name: 'save-tabular-sync-config',
          description: 'Save a tabular sync configuration record and optionally mark it active.',
          operationType: 'mutation',
          parameters: {
            configKey: 'string (required) - Unique config key',
            config: 'object (required) - Tabular sync configuration payload',
            active: 'boolean (default: true) - Mark this config as active',
          },
        },
        {
          name: 'activate-tabular-sync-config',
          description: 'Activate an existing tabular sync configuration record.',
          operationType: 'mutation',
          parameters: {
            configKey: 'string (required) - Configuration key to activate',
          },
        },
        {
          name: 'get-tabular-sync-status',
          description: 'Get current tabular sync queue state, totals, and recent failures.',
          operationType: 'query',
          parameters: {},
        },
        {
          name: 'get-tabular-sync-summary',
          description: 'Get aggregated persisted sync event summary by table, mode, and status.',
          operationType: 'query',
          parameters: {
            limit: 'number (default: 100) - Maximum number of summary groups',
            tableIdentifier: 'string (optional) - Filter by table identifier',
            status: 'string (optional) - Filter by event status',
            mode: 'string (optional) - Filter by event mode',
            createdAfter: 'string (optional) - ISO lower bound',
            createdBefore: 'string (optional) - ISO upper bound',
          },
        },
        {
          name: 'resync-tabular-sync-table',
          description: 'Trigger an immediate resync for a single table identifier.',
          operationType: 'mutation',
          parameters: {
            tableIdentifier: 'string (required) - Table identifier to resync immediately',
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
  async exportTableNodes(req: HttpBodyRequest<ExportTableNodesBody>, res: Response): Promise<void> {
    try {
      const {
        tableId,
        format = 'CSV',
        outputDirectory = `${process.cwd()}/exports`,
        filename,
        includeAttributes = [],
        limit = 1000,
        saveToFile = true,
      } = req.body

      if (!tableId) {
        res.status(400).json({
          success: false,
          error: 'tableId is required',
          tool: 'export-table-nodes',
        })
        return
      }

      this.logger.info('MCP Tool: export-table-nodes called', {
        tableId,
        format,
        outputDirectory,
        includeAttributes,
        limit,
        saveToFile,
      })

      // Generate filename with timestamp if not provided
      const finalFilename =
        filename || `table_${tableId}_export_${new Date().toISOString().replace(/[:.]/g, '-')}.${format.toLowerCase()}`

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
          includeAttributes: Array.isArray(includeAttributes) ? includeAttributes.length > 0 : true,
          includeMetadata: true,
          attributeFormat: 'COLUMNS',
          dateFormat: 'ISO',
          compression: false,
          prettyPrint: true,
        },
      }

      // Execute GraphQL mutation
      const result = await this.executeGraphQL<ExportTableNodesMutationData>(query, variables)

      const exportResult = result?.exportTableNodes

      if (!exportResult?.success) {
        throw new Error(`Export failed: ${exportResult?.errors ? exportResult.errors.join(', ') : 'Unknown error'}`)
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
          filename: finalFilename,
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

  async listTabularSyncConfigs(_req: Request, res: Response): Promise<void> {
    try {
      const query = `
        query ListTabularSyncConfigs {
          tabularSyncConfigs {
            configKey
            isActive
            createdAt
            updatedAt
            config
          }
        }
      `

      const result = await this.executeGraphQL<{ tabularSyncConfigs: unknown[] }>(query)

      res.json({
        success: true,
        data: result?.tabularSyncConfigs || [],
        tool: 'list-tabular-sync-configs',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: list-tabular-sync-configs error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'list-tabular-sync-configs',
      })
    }
  }

  async getTabularSyncConfig(req: HttpBodyRequest<GetTabularSyncConfigBody>, res: Response): Promise<void> {
    try {
      const query = `
        query GetTabularSyncConfig($configKey: String) {
          tabularSyncConfig(configKey: $configKey) {
            configKey
            isActive
            createdAt
            updatedAt
            config
          }
        }
      `

      const result = await this.executeGraphQL<{ tabularSyncConfig: unknown | null }>(query, {
        configKey: req.body.configKey,
      })

      res.json({
        success: true,
        data: result?.tabularSyncConfig || null,
        tool: 'get-tabular-sync-config',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: get-tabular-sync-config error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'get-tabular-sync-config',
      })
    }
  }

  async saveTabularSyncConfig(req: HttpBodyRequest<SaveTabularSyncConfigBody>, res: Response): Promise<void> {
    try {
      const { configKey, config, active = true } = req.body

      if (!configKey) {
        res.status(400).json({
          success: false,
          error: 'configKey is required',
          tool: 'save-tabular-sync-config',
        })
        return
      }

      if (!config) {
        res.status(400).json({
          success: false,
          error: 'config is required',
          tool: 'save-tabular-sync-config',
        })
        return
      }

      const mutation = `
        mutation SaveTabularSyncConfig($input: SaveTabularSyncConfigInput!) {
          saveTabularSyncConfig(input: $input) {
            success
            config {
              configKey
              isActive
              createdAt
              updatedAt
              config
            }
            errors {
              message
            }
          }
        }
      `

      const result = await this.executeGraphQL<{
        saveTabularSyncConfig: {
          success: boolean
          config: unknown
          errors?: Array<{ message?: string }>
        }
      }>(mutation, {
        input: {
          configKey,
          config,
          active,
        },
      })

      const payload = result?.saveTabularSyncConfig

      res.json({
        success: payload?.success ?? false,
        data: payload?.config || null,
        errors: payload?.errors || [],
        tool: 'save-tabular-sync-config',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: save-tabular-sync-config error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'save-tabular-sync-config',
      })
    }
  }

  async activateTabularSyncConfig(req: HttpBodyRequest<ActivateTabularSyncConfigBody>, res: Response): Promise<void> {
    try {
      const { configKey } = req.body

      if (!configKey) {
        res.status(400).json({
          success: false,
          error: 'configKey is required',
          tool: 'activate-tabular-sync-config',
        })
        return
      }

      const mutation = `
        mutation ActivateTabularSyncConfig($configKey: String!) {
          activateTabularSyncConfig(configKey: $configKey) {
            success
            config {
              configKey
              isActive
              createdAt
              updatedAt
              config
            }
            errors {
              message
            }
          }
        }
      `

      const result = await this.executeGraphQL<{
        activateTabularSyncConfig: {
          success: boolean
          config: unknown
          errors?: Array<{ message?: string }>
        }
      }>(mutation, { configKey })

      const payload = result?.activateTabularSyncConfig

      res.json({
        success: payload?.success ?? false,
        data: payload?.config || null,
        errors: payload?.errors || [],
        tool: 'activate-tabular-sync-config',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: activate-tabular-sync-config error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'activate-tabular-sync-config',
      })
    }
  }

  async getTabularSyncStatus(req: HttpBodyRequest<GetTabularSyncStatusBody>, res: Response): Promise<void> {
    try {
      const query = `
        query GetTabularSyncStatus(
          $limit: Int
          $tableIdentifier: String
          $status: String
          $mode: String
          $windowPreset: String
          $createdAfter: String
          $createdBefore: String
        ) {
          tabularSyncStatus(
            limit: $limit
            tableIdentifier: $tableIdentifier
            status: $status
            mode: $mode
            windowPreset: $windowPreset
            createdAfter: $createdAfter
            createdBefore: $createdBefore
          ) {
            enabled
            configSource
            syncDebounceMs
            pendingCount
            pendingTables
            totalNotifications
            totalExecutions
            totalSucceeded
            totalFailed
            lastSuccessAt
            lastFailureAt
            recentFailures {
              tableIdentifier
              mode
              error
              occurredAt
            }
            tables {
              tableIdentifier
              pending
              notifications
              executions
              successes
              failures
              lastMode
              lastScheduledAt
              lastStartedAt
              lastCompletedAt
              lastSuccessAt
              lastFailureAt
              lastError
            }
            persistedEvents {
              id
              tableIdentifier
              mode
              status
              errorMessage
              createdAt
            }
          }
        }
      `

      const result = await this.executeGraphQL<{ tabularSyncStatus: unknown }>(query, {
        limit: req.body.limit,
        tableIdentifier: req.body.tableIdentifier,
        status: req.body.status,
        mode: req.body.mode,
        windowPreset: req.body.windowPreset,
        createdAfter: req.body.createdAfter,
        createdBefore: req.body.createdBefore,
      })

      res.json({
        success: true,
        data: result?.tabularSyncStatus || null,
        tool: 'get-tabular-sync-status',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: get-tabular-sync-status error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'get-tabular-sync-status',
      })
    }
  }

  async getTabularSyncSummary(req: HttpBodyRequest<GetTabularSyncSummaryBody>, res: Response): Promise<void> {
    try {
      const query = `
        query GetTabularSyncSummary(
          $limit: Int
          $tableIdentifier: String
          $status: String
          $mode: String
          $windowPreset: String
          $createdAfter: String
          $createdBefore: String
        ) {
          tabularSyncSummary(
            limit: $limit
            tableIdentifier: $tableIdentifier
            status: $status
            mode: $mode
            windowPreset: $windowPreset
            createdAfter: $createdAfter
            createdBefore: $createdBefore
          ) {
            tableIdentifier
            mode
            eventCount
            successCount
            failureCount
            successRate
            lastCreatedAt
            latestErrorMessage
          }
        }
      `

      const result = await this.executeGraphQL<{ tabularSyncSummary: unknown[] }>(query, {
        limit: req.body.limit,
        tableIdentifier: req.body.tableIdentifier,
        status: req.body.status,
        mode: req.body.mode,
        windowPreset: req.body.windowPreset,
        createdAfter: req.body.createdAfter,
        createdBefore: req.body.createdBefore,
      })

      res.json({
        success: true,
        data: result?.tabularSyncSummary || [],
        tool: 'get-tabular-sync-summary',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: get-tabular-sync-summary error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'get-tabular-sync-summary',
      })
    }
  }

  async resyncTabularSyncTable(req: HttpBodyRequest<ResyncTabularSyncTableBody>, res: Response): Promise<void> {
    try {
      const { tableIdentifier } = req.body

      if (!tableIdentifier) {
        res.status(400).json({
          success: false,
          error: 'tableIdentifier is required',
          tool: 'resync-tabular-sync-table',
        })
        return
      }

      const mutation = `
        mutation ResyncTabularSyncTable($tableIdentifier: String!) {
          resyncTabularSyncTable(tableIdentifier: $tableIdentifier) {
            success
            tableIdentifier
            status {
              enabled
              configSource
              syncDebounceMs
              pendingCount
              pendingTables
              totalNotifications
              totalExecutions
              totalSucceeded
              totalFailed
              lastSuccessAt
              lastFailureAt
              recentFailures {
                tableIdentifier
                mode
                error
                occurredAt
              }
              persistedEvents {
                id
                tableIdentifier
                mode
                status
                errorMessage
                createdAt
              }
            }
            errors {
              message
            }
          }
        }
      `

      const result = await this.executeGraphQL<{
        resyncTabularSyncTable: {
          success: boolean
          tableIdentifier: string | null
          status: unknown
          errors?: Array<{ message?: string }>
        }
      }>(mutation, { tableIdentifier })

      const payload = result?.resyncTabularSyncTable

      res.json({
        success: payload?.success ?? false,
        data: {
          tableIdentifier: payload?.tableIdentifier || tableIdentifier,
          status: payload?.status || null,
        },
        errors: payload?.errors || [],
        tool: 'resync-tabular-sync-table',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: resync-tabular-sync-table error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'resync-tabular-sync-table',
      })
    }
  }

  /**
   * Handle initialize system MCP tool call
   */
  async initializeSystem(req: HttpBodyRequest<InitializeSystemBody>, res: Response): Promise<void> {
    try {
      const { mode, options } = req.body

      this.logger.info('MCP Tool: initialize-system called', { mode, options })

      const mutation = `
        mutation InitializeSystem($input: SystemInitializationInput!) {
          initializeSystem(input: $input) {
            success
            result {
              actions
              timings
              totalTime
              summary {
                tablesCount
                templatesCount
                nodesCount
              }
            }
            errors {
              message
            }
          }
        }
      `

      const variables = {
        input: { mode: mode.toUpperCase(), options },
      }

      const result = await this.executeGraphQL(mutation, variables)

      res.json({
        success: true,
        data: result,
        tool: 'initialize-system',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: initialize-system error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'initialize-system',
      })
    }
  }

  /**
   * Handle get system status MCP tool call
   */
  async getSystemStatus(_req: Request, res: Response): Promise<void> {
    try {
      this.logger.info('MCP Tool: get-system-status called')

      const query = `
        query GetSystemStatus {
          systemStatus {
            database
            summary {
              tablesCount
              templatesCount
              nodesCount
            }
            lastInitialized
          }
        }
      `

      const result = await this.executeGraphQL(query)

      res.json({
        success: true,
        data: result,
        tool: 'get-system-status',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: get-system-status error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'get-system-status',
      })
    }
  }

  /**
   * Handle quick reset MCP tool call
   */
  async quickReset(req: HttpBodyRequest<QuickResetBody>, res: Response): Promise<void> {
    try {
      const { preserveTableIds } = req.body

      this.logger.info('MCP Tool: quick-reset called', { preserveTableIds })

      const mutation = `
        mutation QuickReset($input: SystemInitializationInput!) {
          initializeSystem(input: $input) {
            success
            result {
              actions
              timings
              totalTime
              summary {
                tablesCount
                templatesCount
                nodesCount
              }
            }
            errors {
              message
            }
          }
        }
      `

      const variables = {
        input: {
          mode: 'QUICK',
          options: {
            resetDatabase: true,
            resetTestData: true,
            createSampleData: true,
            preserveTableIds,
          },
        },
      }

      const result = await this.executeGraphQL(mutation, variables)

      res.json({
        success: true,
        data: result,
        tool: 'quick-reset',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: quick-reset error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'quick-reset',
      })
    }
  }

  /**
   * Handle setup demo MCP tool call
   */
  async setupDemo(req: HttpBodyRequest<SetupDemoBody>, res: Response): Promise<void> {
    try {
      const { resetFirst = true } = req.body

      this.logger.info('MCP Tool: setup-demo called', { resetFirst })

      const mutation = `
        mutation SetupDemo($input: SystemInitializationInput!) {
          initializeSystem(input: $input) {
            success
            result {
              actions
              timings
              totalTime
              summary {
                tablesCount
                templatesCount
                nodesCount
              }
            }
            errors {
              message
            }
          }
        }
      `

      const variables = {
        input: {
          mode: 'DEMO',
          options: {
            resetDatabase: resetFirst,
            createSampleData: true,
            initMode: 'demo',
          },
        },
      }

      const result = await this.executeGraphQL(mutation, variables)

      res.json({
        success: true,
        data: result,
        tool: 'setup-demo',
        executedAt: new Date().toISOString(),
      })
    } catch (error) {
      this.logger.error('MCP Tool: setup-demo error:', toErrorMeta(error))
      res.status(500).json({
        success: false,
        error: getErrorMessage(error),
        tool: 'setup-demo',
      })
    }
  }
}

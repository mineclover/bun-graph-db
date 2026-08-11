/**
 * T018: MCP tool registry service
 *
 * Purpose: Central registry for tool definitions with discovery capabilities
 * Must Include: Load the versioned root tool contract, tools/list, tool lookup
 * Integration: Tool discovery for MCP protocol
 */

// import toolsContract from '../../specs/005-graphql-mcp-graphql/contracts/graphql-tools.json'
// import {
//   createMcpToolFromContract,
//   type McpToolDefinition,
//   validateMcpToolDefinition,
// } from '../models/McpToolDefinition.ts'

import { debugMcp } from '@/shared/utils/debugLog.js'

export interface McpToolInputSchema {
  type?: unknown
  properties?: object
  required?: unknown
  additionalProperties?: unknown
}

export const ROOT_MCP_TOOL_CONTRACT_VERSION = '2026-08-10.1'

export type McpToolAction = 'read' | 'write'

export interface McpToolAccessContract {
  action: McpToolAction
  scope: 'global' | 'table'
  tableIdArgument?: 'tableId' | 'tableIdentifier'
}

export interface ResolvedMcpToolAccess extends McpToolAccessContract {
  tableId?: string
}

export interface McpToolDefinition {
  name: string
  description: string
  inputSchema: McpToolInputSchema
  _meta?: Record<string, unknown>
  annotations?: Record<string, unknown>
  operationType?: 'query' | 'mutation'
  graphqlOperation?: {
    operationType?: string
    query?: string
  }
  contractVersion?: string
  access?: McpToolAccessContract
}

export interface ToolDiscoveryResult {
  tools: Array<{
    name: string
    description: string
    inputSchema: McpToolInputSchema
  }>
}

export interface McpToolAudience {
  role: AccessRole
}

type AccessRole = 'reader' | 'writer' | 'admin'

export interface ToolLookupResult {
  found: boolean
  tool?: McpToolDefinition
  error?: string
}

export class McpToolRegistry {
  private tools: Map<string, McpToolDefinition> = new Map()
  private loaded: boolean = false

  /**
   * Load tool definitions from the GraphQL tools contract
   */
  async loadFromContract(): Promise<void> {
    try {
      this.loadBuiltInContract()
      this.loaded = true
      debugMcp('root tool contract loaded', () => ({
        tools: this.tools.size,
        version: ROOT_MCP_TOOL_CONTRACT_VERSION,
      }))
    } catch (error) {
      console.error('Failed to load tools from contract:', error)
      throw new Error(`Tool registry initialization failed: ${error}`)
    }
  }

  /**
   * Register a new tool definition
   */
  register(tool: McpToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`)
    }

    this.tools.set(tool.name, this.withContractMetadata(tool))
  }

  /**
   * Unregister a tool definition
   */
  unregister(name: string): boolean {
    return this.tools.delete(name)
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): ToolLookupResult {
    const tool = this.tools.get(name)

    if (!tool) {
      return {
        found: false,
        error: `Tool "${name}" not found`,
      }
    }

    return {
      found: true,
      tool,
    }
  }

  /**
   * List all available tools (MCP tools/list implementation)
   */
  listTools(audience?: McpToolAudience): ToolDiscoveryResult {
    const tools = Array.from(this.tools.values())
      .filter((tool) => this.isVisibleTo(tool, audience))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      ...(tool._meta ? { _meta: tool._meta } : {}),
      ...(tool.annotations ? { annotations: tool.annotations } : {}),
      }))

    return { tools }
  }

  /**
   * Get all tool definitions
   */
  getAllTools(): McpToolDefinition[] {
    return Array.from(this.tools.values())
  }

  /**
   * Check if a tool exists
   */
  exists(name: string): boolean {
    return this.tools.has(name)
  }

  /**
   * Get tool count
   */
  getToolCount(): number {
    return this.tools.size
  }

  resolveAccess(name: string, argumentsValue: unknown): ResolvedMcpToolAccess | undefined {
    const access = this.tools.get(name)?.access
    if (!access) return undefined

    if (!access.tableIdArgument || !isRecord(argumentsValue)) return access
    const tableId = argumentsValue[access.tableIdArgument]
    return typeof tableId === 'string' && tableId.trim() ? { ...access, tableId: tableId.trim() } : access
  }

  /**
   * Get tools by operation type
   */
  getToolsByType(operationType: 'query' | 'mutation'): McpToolDefinition[] {
    return Array.from(this.tools.values()).filter((tool) => tool.operationType === operationType)
  }

  /**
   * Search tools by name or description
   */
  searchTools(query: string): McpToolDefinition[] {
    if (!query || query.trim().length === 0) {
      return this.getAllTools()
    }

    const searchTerm = query.toLowerCase().trim()

    return Array.from(this.tools.values()).filter(
      (tool) => tool.name.toLowerCase().includes(searchTerm) || tool.description.toLowerCase().includes(searchTerm),
    )
  }

  /**
   * Validate all tools in the registry
   */
  validateAllTools(): { valid: boolean; errors: Array<{ tool: string; errors: string[] }> } {
    const errors: Array<{ tool: string; errors: string[] }> = []

    // Enhanced validation will be implemented when contract validation system is available
    for (const [name, tool] of this.tools) {
      // Basic validation - ensure tool has required fields
      const toolErrors: string[] = []
      if (!tool.name) toolErrors.push('Missing name')
      if (!tool.description) toolErrors.push('Missing description')
      if (!tool.inputSchema) toolErrors.push('Missing inputSchema')

      if (toolErrors.length > 0) {
        errors.push({
          tool: name,
          errors: toolErrors,
        })
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalTools: number
    queryTools: number
    mutationTools: number
    loaded: boolean
    toolNames: string[]
  } {
    const queryTools = this.getToolsByType('query').length
    const mutationTools = this.getToolsByType('mutation').length

    return {
      totalTools: this.tools.size,
      queryTools,
      mutationTools,
      loaded: this.loaded,
      toolNames: Array.from(this.tools.keys()),
    }
  }

  /**
   * Export tool definitions for debugging or backup
   */
  exportTools(): Array<{ name: string; definition: McpToolDefinition }> {
    return Array.from(this.tools.entries()).map(([name, definition]) => ({
      name,
      definition,
    }))
  }

  /**
   * Reset the registry
   */
  clear(): void {
    this.tools.clear()
    this.loaded = false
  }

  /**
   * Check if registry is loaded
   */
  isLoaded(): boolean {
    return this.loaded
  }

  /**
   * Initialize registry with auto-loading
   */
  async initialize(): Promise<void> {
    await this.loadFromContract()
  }

  /**
   * Register built-in MCP tools
   */
  private loadBuiltInContract(): void {
    const healthCheckTool: McpToolDefinition = {
      name: 'healthCheck',
      description: 'Check GraphQL server health status and runtime readiness.',
      operationType: 'query',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
      graphqlOperation: {
        operationType: 'custom',
      },
    }

    const createTableTool: McpToolDefinition = {
      name: 'createTable',
      description: 'Create a new table in the graph database.',
      operationType: 'mutation',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['identifier'],
        properties: {
          identifier: {
            type: 'string',
            minLength: 1,
            description: 'Unique table identifier',
          },
          name: {
            type: 'string',
            description: 'Optional display name for compatibility with older clients',
          },
          description: {
            type: 'string',
            description: 'Optional table description',
          },
        },
      },
      graphqlOperation: {
        operationType: 'custom',
      },
    }

    const searchNodesTool: McpToolDefinition = {
      name: 'searchNodes',
      description: 'Search nodes inside a table by free-text content.',
      operationType: 'query',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['tableId'],
        properties: {
          tableId: {
            type: 'string',
            minLength: 1,
            description: 'Table ID to search within',
          },
          search: {
            type: 'string',
            description: 'Optional free-text search term',
            default: '',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 10,
            description: 'Maximum number of nodes to return',
          },
        },
      },
      graphqlOperation: {
        operationType: 'custom',
      },
    }

    const rootOpenApiProjectionTool: McpToolDefinition = {
      name: 'get-root-openapi-projection',
      description:
        'Export a root MCP OpenAPI 3.2 component-bundle projection with argument schemas derived from tools/list inputSchema contracts.',
      operationType: 'query',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          profile: {
            type: 'string',
            enum: ['component-bundle'],
            default: 'component-bundle',
            description: 'Projection profile to return. Root MCP tool contracts currently export component-bundle.',
          },
        },
      },
      graphqlOperation: {
        operationType: 'custom',
      },
    }

    this.register(healthCheckTool)
    this.register(createTableTool)
    this.register(searchNodesTool)
    this.register(rootOpenApiProjectionTool)

    const systemStatsTool: McpToolDefinition = {
      name: 'systemStats',
      description: 'Get system statistics through the REST API proxy.',
      operationType: 'query',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
      graphqlOperation: {
        operationType: 'query',
        query: 'query SystemStatsPlaceholder { _schema }',
      },
    }

    const searchTablesTool: McpToolDefinition = {
      name: 'searchTables',
      description: 'Search tables through the REST API proxy.',
      operationType: 'query',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          searchTerm: { type: 'string', default: '' },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
        },
      },
      graphqlOperation: {
        operationType: 'query',
        query: 'query SearchTablesPlaceholder { _schema }',
      },
    }

    const getTablesTool: McpToolDefinition = {
      name: 'getTables',
      description: 'List tables through the REST API proxy.',
      operationType: 'query',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          search: { type: 'string', default: '' },
        },
      },
      graphqlOperation: {
        operationType: 'query',
        query: 'query GetTablesPlaceholder { _schema }',
      },
    }

    const createAttributeTool: McpToolDefinition = {
      name: 'createAttribute',
      description: 'Create an attribute through the REST API proxy.',
      operationType: 'mutation',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['tableId', 'identifier', 'name'],
        properties: {
          tableId: { type: 'string', minLength: 1 },
          identifier: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
          attributeTypeId: { type: 'string' },
          description: { type: 'string' },
        },
      },
      graphqlOperation: {
        operationType: 'mutation',
        query: 'mutation CreateAttributePlaceholder { _schema }',
      },
    }

    const searchTemplatesToolCompat: McpToolDefinition = {
      name: 'searchTemplates',
      description: 'Search templates through the REST API proxy.',
      operationType: 'query',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          searchTerm: { type: 'string', default: '' },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          tags: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
      graphqlOperation: {
        operationType: 'query',
        query: 'query SearchTemplatesPlaceholder { _schema }',
      },
    }

    this.register(systemStatsTool)
    this.register(searchTablesTool)
    this.register(getTablesTool)
    this.register(createAttributeTool)
    this.register(searchTemplatesToolCompat)

    // Register bulk template import tool - file path based with parallel processing
    const bulkImportTool: McpToolDefinition = {
      name: 'bulk-import-templates',
      description:
        'Bulk import templates using file paths with parallel processing. Bridge between local file system and GraphQL operations.',
      operationType: 'mutation',
      inputSchema: {
        type: 'object',
        required: ['filePaths'],
        properties: {
          filePaths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of absolute file paths to JSON template files to import',
            minItems: 1,
          },
          overwriteExisting: {
            type: 'boolean',
            description: 'Whether to overwrite existing templates with same identifier',
            default: false,
          },
          generateNewIdentifier: {
            type: 'boolean',
            description: 'Whether to generate new identifier if conflict exists',
            default: false,
          },
          dryRun: {
            type: 'boolean',
            description: 'Whether to perform dry run without actually importing',
            default: false,
          },
          batchSize: {
            type: 'number',
            description: 'Number of templates to process in each parallel batch',
            default: 10,
            minimum: 1,
            maximum: 50,
          },
        },
      },
      graphqlOperation: {
        operationType: 'custom',
        query: 'File path based parallel template import',
      },
    }

    this.register(bulkImportTool)

    // Register list available templates tool
    const listTemplatesStatusTool: McpToolDefinition = {
      name: 'list-available-templates',
      description: 'List all available template files in exported-templates directory with metadata.',
      operationType: 'query',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      graphqlOperation: {
        operationType: 'custom',
        query: 'File system discovery for available templates',
      },
    }

    this.register(listTemplatesStatusTool)

    // Register import status tool
    const importStatusTool: McpToolDefinition = {
      name: 'get-import-status',
      description: 'Get status and summary of available templates for import.',
      operationType: 'query',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      graphqlOperation: {
        operationType: 'custom',
        query: 'Import status and estimation',
      },
    }

    this.register(importStatusTool)

    // Register create template tool (Global template creation)
    const createTemplateTool: McpToolDefinition = {
      name: 'create-template',
      description:
        'Create a new global GraphQL template with validation. For table-specific templates, use the table MCP server create-template tool.',
      operationType: 'mutation',
      inputSchema: {
        type: 'object',
        required: ['identifier', 'name', 'query'],
        properties: {
          identifier: {
            type: 'string',
            description: 'Unique identifier for the template',
          },
          name: {
            type: 'string',
            description: 'Human-readable name for the template',
          },
          query: {
            type: 'string',
            description: 'GraphQL query/mutation string',
          },
          description: {
            type: 'string',
            description: 'Description of what the template does',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags for categorizing the template',
          },
          targetTableId: {
            type: 'string',
            description: 'Optional table context for the template',
          },
        },
      },
      graphqlOperation: {
        operationType: 'custom',
        query: 'Template creation with GraphQL validation',
      },
    }

    this.register(createTemplateTool)

    // Register update template tool
    const updateTemplateTool: McpToolDefinition = {
      name: 'update-template',
      description: 'Update an existing template by identifier with validation.',
      operationType: 'mutation',
      inputSchema: {
        type: 'object',
        required: ['identifier'],
        properties: {
          identifier: {
            type: 'string',
            description: 'Template identifier to update',
          },
          name: {
            type: 'string',
            description: 'New name for the template',
          },
          query: {
            type: 'string',
            description: 'New GraphQL query/mutation string',
          },
          description: {
            type: 'string',
            description: 'New description of what the template does',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'New tags for categorizing the template',
          },
        },
      },
      graphqlOperation: {
        operationType: 'custom',
        query: 'Template update with validation',
      },
    }

    this.register(updateTemplateTool)

    // Register delete template tool
    const deleteTemplateTool: McpToolDefinition = {
      name: 'delete-template',
      description: 'Delete a template by identifier with dependency checking.',
      operationType: 'mutation',
      inputSchema: {
        type: 'object',
        required: ['identifier'],
        properties: {
          identifier: {
            type: 'string',
            description: 'Template identifier to delete',
          },
          force: {
            type: 'boolean',
            description: 'Force deletion even with dependencies',
            default: false,
          },
        },
      },
      graphqlOperation: {
        operationType: 'custom',
        query: 'Template deletion with dependency checking',
      },
    }

    this.register(deleteTemplateTool)

    // Register validate template tool
    const validateTemplateTool: McpToolDefinition = {
      name: 'validate-template',
      description: 'Validate GraphQL template syntax and schema compliance.',
      operationType: 'query',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'GraphQL query/mutation string to validate',
          },
          variables: {
            type: 'object',
            description: 'Optional variables to validate with the query',
          },
        },
      },
      graphqlOperation: {
        operationType: 'custom',
        query: 'GraphQL syntax and schema validation',
      },
    }

    this.register(validateTemplateTool)

    // Register search templates tool
    const searchTemplatesTool: McpToolDefinition = {
      name: 'search-templates',
      description: 'Advanced template search with filtering by name, tags, or description.',
      operationType: 'query',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search term for name or description',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by tags',
          },
          tableId: {
            type: 'string',
            description: 'Filter by target table ID',
          },
          operationType: {
            type: 'string',
            enum: ['query', 'mutation'],
            description: 'Filter by GraphQL operation type',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results',
            default: 50,
            minimum: 1,
            maximum: 1000,
          },
        },
      },
      graphqlOperation: {
        operationType: 'custom',
        query: 'Advanced template search with filtering',
      },
    }

    this.register(searchTemplatesTool)

    // Register get template metadata tool
    const getTemplateMetadataTool: McpToolDefinition = {
      name: 'get-template-metadata',
      description: 'Get complete template information including usage statistics and dependencies.',
      operationType: 'query',
      inputSchema: {
        type: 'object',
        required: ['identifier'],
        properties: {
          identifier: {
            type: 'string',
            description: 'Template identifier to get metadata for',
          },
          includeUsageStats: {
            type: 'boolean',
            description: 'Include usage statistics',
            default: true,
          },
          includeDependencies: {
            type: 'boolean',
            description: 'Include dependency information',
            default: true,
          },
        },
      },
      graphqlOperation: {
        operationType: 'custom',
        query: 'Complete template metadata access',
      },
    }

    this.register(getTemplateMetadataTool)

    // Register export table nodes tool
    const exportTableNodesTool: McpToolDefinition = {
      name: 'export-table-nodes',
      description:
        'Export table nodes to CSV or JSON with improved formatting. CSV uses column-based attributes, JSON uses key-value arrays.',
      operationType: 'mutation',
      inputSchema: {
        type: 'object',
        required: ['tableId'],
        properties: {
          tableId: {
            type: 'string',
            description: 'ID of the table to export nodes from',
          },
          format: {
            type: 'string',
            enum: ['CSV', 'JSON'],
            description: 'Export format - CSV with column attributes or JSON with key-value arrays',
            default: 'CSV',
          },
          outputDirectory: {
            type: 'string',
            description: 'Directory to save the exported file',
            default: './exports',
          },
          filename: {
            type: 'string',
            description: 'Custom filename for the export (without extension)',
          },
          includeAttributes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific attribute names to include in export (empty = all attributes)',
            default: [],
          },
          limit: {
            type: 'number',
            description: 'Maximum number of nodes to export',
            default: 1000,
            minimum: 1,
            maximum: 10000,
          },
          saveToFile: {
            type: 'boolean',
            description: 'Whether to save the export to a file',
            default: true,
          },
        },
      },
      graphqlOperation: {
        operationType: 'custom',
        query: 'Table nodes export with improved formatting',
      },
    }

    this.register(exportTableNodesTool)

    // ========== SYSTEM INITIALIZATION TOOLS ==========

    // Register system initialization tool
    const systemInitializationTool: McpToolDefinition = {
      name: 'initialize-system',
      description:
        'Initialize or reset the system with various modes: quick reset for development, full reset, demo setup, or custom initialization.',
      operationType: 'mutation',
      inputSchema: {
        type: 'object',
        required: ['mode'],
        properties: {
          mode: {
            type: 'string',
            enum: ['quick', 'full', 'demo', 'custom'],
            description:
              'Initialization mode: quick (reset DB + test data + samples), full (complete clean slate), demo (demo data), custom (specific options)',
          },
          options: {
            type: 'object',
            description: 'Custom options for initialization (only used with custom mode)',
            properties: {
              resetDatabase: {
                type: 'boolean',
                description: 'Reset database to clean state',
                default: false,
              },
              resetTemplates: {
                type: 'boolean',
                description: 'Reset templates to baseline',
                default: false,
              },
              resetTestData: {
                type: 'boolean',
                description: 'Reset test data',
                default: false,
              },
              createSampleData: {
                type: 'boolean',
                description: 'Create sample/demo data',
                default: false,
              },
              resetMetrics: {
                type: 'boolean',
                description: 'Reset performance metrics',
                default: false,
              },
              preserveTableIds: {
                type: 'array',
                items: { type: 'number' },
                description: 'Preserve specific table IDs (for testing)',
              },
              initMode: {
                type: 'string',
                enum: ['development', 'testing', 'production', 'demo'],
                description: 'Initialization environment mode',
                default: 'development',
              },
            },
          },
        },
      },
      graphqlOperation: {
        operationType: 'mutation',
        query: `
          mutation InitializeSystem($input: SystemInitializationInput!) {
            initializeSystem(input: $input) {
              success
              result {
                actions
                timings
                summary {
                  tablesCount
                  templatesCount
                  nodesCount
                  attributesCount
                }
                totalTime
              }
              errors {
                message
              }
            }
          }
        `,
      },
    }

    this.register(systemInitializationTool)

    // Register system status tool
    const systemStatusTool: McpToolDefinition = {
      name: 'get-system-status',
      description: 'Get current system status including database state, table counts, and last initialization info.',
      operationType: 'query',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      graphqlOperation: {
        operationType: 'query',
        query: `
          query GetSystemStatus {
            systemStatus {
              database
              summary {
                tablesCount
                templatesCount
                nodesCount
                attributesCount
              }
              lastInitialized
            }
          }
        `,
      },
    }

    this.register(systemStatusTool)

    // Register quick reset tool
    const quickResetTool: McpToolDefinition = {
      name: 'quick-reset',
      description:
        'Quick development reset: reset database, test data, and create sample data. Ideal for development workflow.',
      operationType: 'mutation',
      inputSchema: {
        type: 'object',
        properties: {
          preserveTableIds: {
            type: 'array',
            items: { type: 'number' },
            description: 'Preserve specific table IDs during reset',
          },
        },
      },
      graphqlOperation: {
        operationType: 'mutation',
        query: `
          mutation QuickReset($preserveTableIds: [Int!]) {
            initializeSystem(input: {
              mode: QUICK
              options: {
                preserveTableIds: $preserveTableIds
              }
            }) {
              success
              result {
                actions
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
        `,
      },
    }

    this.register(quickResetTool)

    // Register demo setup tool
    const demoSetupTool: McpToolDefinition = {
      name: 'setup-demo',
      description: 'Setup demo environment with sample data for presentations and demonstrations.',
      operationType: 'mutation',
      inputSchema: {
        type: 'object',
        properties: {
          resetFirst: {
            type: 'boolean',
            description: 'Reset database before creating demo data',
            default: true,
          },
        },
      },
      graphqlOperation: {
        operationType: 'mutation',
        query: `
          mutation SetupDemo($resetFirst: Boolean) {
            initializeSystem(input: {
              mode: DEMO
              options: {
                resetDatabase: $resetFirst
              }
            }) {
              success
              result {
                actions
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
        `,
      },
    }

    this.register(demoSetupTool)

    // Register tabular sync config list tool
    const listTabularSyncConfigsTool: McpToolDefinition = {
      name: 'list-tabular-sync-configs',
      description: 'List saved tabular sync configurations and their active state.',
      operationType: 'query',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
      graphqlOperation: {
        operationType: 'query',
        query: `
          query ListTabularSyncConfigs {
            tabularSyncConfigs {
              configKey
              isActive
              createdAt
              updatedAt
              config
            }
          }
        `,
      },
    }
    this.register(listTabularSyncConfigsTool)

    const getTabularSyncConfigTool: McpToolDefinition = {
      name: 'get-tabular-sync-config',
      description: 'Get one tabular sync configuration by key, or the active config when no key is provided.',
      operationType: 'query',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          configKey: {
            type: 'string',
            description: 'Optional config key. Omit to fetch the active config.',
          },
        },
      },
      graphqlOperation: {
        operationType: 'query',
        query: `
          query GetTabularSyncConfig($configKey: String) {
            tabularSyncConfig(configKey: $configKey) {
              configKey
              isActive
              createdAt
              updatedAt
              config
            }
          }
        `,
      },
    }
    this.register(getTabularSyncConfigTool)

    const saveTabularSyncConfigTool: McpToolDefinition = {
      name: 'save-tabular-sync-config',
      description: 'Save a tabular sync configuration and optionally activate it.',
      operationType: 'mutation',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['configKey', 'config'],
        properties: {
          configKey: {
            type: 'string',
            description: 'Config identifier key.',
          },
          config: {
            type: 'object',
            description: 'Full tabular sync config JSON.',
          },
          active: {
            type: 'boolean',
            description: 'Whether to activate the config immediately.',
            default: true,
          },
        },
      },
      graphqlOperation: {
        operationType: 'mutation',
        query: `
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
                code
              }
            }
          }
        `,
      },
    }
    this.register(saveTabularSyncConfigTool)

    const activateTabularSyncConfigTool: McpToolDefinition = {
      name: 'activate-tabular-sync-config',
      description: 'Activate an existing tabular sync configuration by key.',
      operationType: 'mutation',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['configKey'],
        properties: {
          configKey: {
            type: 'string',
            description: 'Config identifier key to activate.',
          },
        },
      },
      graphqlOperation: {
        operationType: 'mutation',
        query: `
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
                code
              }
            }
          }
        `,
      },
    }
    this.register(activateTabularSyncConfigTool)

    const getTabularSyncStatusTool: McpToolDefinition = {
      name: 'get-tabular-sync-status',
      description: 'Get current tabular sync queue status, per-table metrics, and recent failures.',
      operationType: 'query',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of persisted events to return.',
          },
          tableIdentifier: {
            type: 'string',
            description: 'Optional table identifier filter for persisted events.',
          },
          status: {
            type: 'string',
            description: 'Optional persisted event status filter (e.g. success or failure).',
          },
          mode: {
            type: 'string',
            description: 'Optional persisted event mode filter (e.g. sync or clear).',
          },
          windowPreset: {
            type: 'string',
            description: 'Optional preset window filter (1h, 24h, 7d).',
          },
          createdAfter: {
            type: 'string',
            description: 'Optional lower bound ISO timestamp for persisted events.',
          },
          createdBefore: {
            type: 'string',
            description: 'Optional upper bound ISO timestamp for persisted events.',
          },
        },
      },
      graphqlOperation: {
        operationType: 'query',
        query: `
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
        `,
      },
    }
    this.register(getTabularSyncStatusTool)

    const getTabularSyncSummaryTool: McpToolDefinition = {
      name: 'get-tabular-sync-summary',
      description: 'Get aggregated persisted sync event counts grouped by table, mode, and status.',
      operationType: 'query',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of summary groups to return.',
          },
          tableIdentifier: {
            type: 'string',
            description: 'Optional table identifier filter.',
          },
          status: {
            type: 'string',
            description: 'Optional event status filter.',
          },
          mode: {
            type: 'string',
            description: 'Optional event mode filter.',
          },
          windowPreset: {
            type: 'string',
            description: 'Optional preset window filter (1h, 24h, 7d).',
          },
          createdAfter: {
            type: 'string',
            description: 'Optional lower bound ISO timestamp.',
          },
          createdBefore: {
            type: 'string',
            description: 'Optional upper bound ISO timestamp.',
          },
        },
      },
      graphqlOperation: {
        operationType: 'query',
        query: `
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
        `,
      },
    }
    this.register(getTabularSyncSummaryTool)

    const resyncTabularSyncTableTool: McpToolDefinition = {
      name: 'resync-tabular-sync-table',
      description: 'Trigger an immediate resync for one table identifier and return updated sync status.',
      operationType: 'mutation',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['tableIdentifier'],
        properties: {
          tableIdentifier: {
            type: 'string',
            description: 'Table identifier to resync immediately.',
          },
        },
      },
      graphqlOperation: {
        operationType: 'mutation',
        query: `
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
                code
              }
            }
          }
        `,
      },
    }
    this.register(resyncTabularSyncTableTool)

    // ========== BACKUP & RESTORE TOOLS ==========

    // Register database backup tool
    const backupDatabaseTool: McpToolDefinition = {
      name: 'backup-database',
      description:
        'Create a full SQLite database backup. Uses VACUUM INTO for clean backup or falls back to file copy. Returns backup path, size, and checksum.',
      operationType: 'mutation',
      inputSchema: {
        type: 'object',
        properties: {
          outputPath: {
            type: 'string',
            description: 'Custom output path (default: ./backups/database/db_{timestamp}.sqlite)',
          },
          compress: {
            type: 'boolean',
            description: 'Enable gzip compression',
            default: false,
          },
          validate: {
            type: 'boolean',
            description: 'Validate backup integrity after creation',
            default: true,
          },
        },
      },
      graphqlOperation: {
        operationType: 'mutation',
        query: `
          mutation BackupDatabase($input: BackupDatabaseInput) {
            backupDatabase(input: $input) {
              success
              backupPath
              sizeBytes
              duration
              checksum
              errors
              warnings
            }
          }
        `,
      },
    }

    this.register(backupDatabaseTool)

    // Register database restore tool
    const restoreDatabaseTool: McpToolDefinition = {
      name: 'restore-database',
      description:
        'Restore database from a backup file. Creates a safety backup before restore. WARNING: Requires server restart to take effect.',
      operationType: 'mutation',
      inputSchema: {
        type: 'object',
        required: ['backupPath'],
        properties: {
          backupPath: {
            type: 'string',
            description: 'Path to the backup file to restore from',
          },
          safetyBackup: {
            type: 'boolean',
            description: 'Create safety backup before restore',
            default: true,
          },
          validateBeforeRestore: {
            type: 'boolean',
            description: 'Validate backup before restore',
            default: true,
          },
          verifyAfterRestore: {
            type: 'boolean',
            description: 'Verify database after restore',
            default: true,
          },
        },
      },
      graphqlOperation: {
        operationType: 'mutation',
        query: `
          mutation RestoreDatabase($input: RestoreDatabaseInput!) {
            restoreDatabase(input: $input) {
              success
              restoredPath
              safetyBackupPath
              duration
              errors
              warnings
              verification {
                tablesCount
                nodesCount
                relationsCount
                checksumMatch
              }
            }
          }
        `,
      },
    }

    this.register(restoreDatabaseTool)

    // Register list backups tool
    const listBackupsTool: McpToolDefinition = {
      name: 'list-backups',
      description: 'List all available database backups with metadata including path, size, and creation date.',
      operationType: 'query',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['FILE', 'TABLE', 'ALL'],
            description: 'Filter by backup type',
            default: 'ALL',
          },
          createdAfter: {
            type: 'string',
            description: 'Only backups created after this date (ISO 8601)',
          },
          createdBefore: {
            type: 'string',
            description: 'Only backups created before this date (ISO 8601)',
          },
        },
      },
      graphqlOperation: {
        operationType: 'query',
        query: `
          query ListBackups($filter: BackupListFilterInput) {
            listBackups(filter: $filter) {
              fileBackups {
                path
                sizeBytes
                createdAt
                compressed
                checksum
              }
              tableBackups {
                path
                sizeBytes
                createdAt
                tableIdentifier
                nodeCount
              }
              totalCount
              totalSizeBytes
            }
          }
        `,
      },
    }

    this.register(listBackupsTool)

    // Register JSONL export tool
    const exportJsonlTool: McpToolDefinition = {
      name: 'export-jsonl',
      description:
        'Export database to JSONL format for Git-friendly backup. Creates per-table files, schema, and relations in a folder structure.',
      operationType: 'mutation',
      inputSchema: {
        type: 'object',
        properties: {
          outputDir: {
            type: 'string',
            description: 'Output directory path (default: ./backups/jsonl)',
          },
          tableIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific table IDs to export (default: all tables)',
          },
          includeRelations: {
            type: 'boolean',
            description: 'Include relations in export',
            default: true,
          },
          includeSchema: {
            type: 'boolean',
            description: 'Include schema file',
            default: true,
          },
        },
      },
      graphqlOperation: {
        operationType: 'mutation',
        query: `
          mutation ExportJsonl($input: JsonlExportInput) {
            exportJsonl(input: $input) {
              success
              outputDir
              files {
                path
                type
                tableIdentifier
                lineCount
                sizeBytes
              }
              stats {
                tablesExported
                nodesExported
                relationsExported
                totalBytes
              }
              errors
              warnings
            }
          }
        `,
      },
    }

    this.register(exportJsonlTool)

    // Register JSONL import tool
    const importJsonlTool: McpToolDefinition = {
      name: 'import-jsonl',
      description:
        'Import database from JSONL backup with conflict resolution (skip/overwrite/merge). Supports dry run mode for validation.',
      operationType: 'mutation',
      inputSchema: {
        type: 'object',
        required: ['inputDir', 'conflictResolution'],
        properties: {
          inputDir: {
            type: 'string',
            description: 'Input directory containing JSONL backup',
          },
          tableIdentifiers: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific table identifiers to import (default: all)',
          },
          conflictResolution: {
            type: 'string',
            enum: ['SKIP', 'OVERWRITE', 'MERGE'],
            description: 'How to handle conflicts with existing data',
          },
          dryRun: {
            type: 'boolean',
            description: 'Validate without importing',
            default: false,
          },
        },
      },
      graphqlOperation: {
        operationType: 'mutation',
        query: `
          mutation ImportJsonl($input: JsonlImportInput!) {
            importJsonl(input: $input) {
              success
              inputDir
              stats {
                tablesImported
                nodesImported
                nodesSkipped
                nodesUpdated
                relationsImported
              }
              errors
              warnings
            }
          }
        `,
      },
    }

    this.register(importJsonlTool)

    debugMcp('root tool registry initialized', () => ({ tools: this.getToolCount() }))
  }

  private withContractMetadata(tool: McpToolDefinition): McpToolDefinition {
    const action: McpToolAction = tool.access?.action || (tool.operationType === 'query' ? 'read' : 'write')
    const tableIdArgument = tool.access?.tableIdArgument || this.requiredTableIdArgument(tool.inputSchema)
    const scope = tool.access?.scope || (tableIdArgument ? 'table' : 'global')
    const contractVersion = tool.contractVersion || ROOT_MCP_TOOL_CONTRACT_VERSION

    return {
      ...tool,
      contractVersion,
      access: { action, scope, ...(tableIdArgument ? { tableIdArgument } : {}) },
      _meta: {
        ...tool._meta,
        contractVersion,
        action,
        scope,
      },
    }
  }

  private requiredTableIdArgument(inputSchema: McpToolInputSchema): 'tableId' | 'tableIdentifier' | undefined {
    const required = Array.isArray(inputSchema.required) ? inputSchema.required : []
    if (required.includes('tableId')) return 'tableId'
    if (required.includes('tableIdentifier')) return 'tableIdentifier'
    return undefined
  }

  private isVisibleTo(tool: McpToolDefinition, audience?: McpToolAudience): boolean {
    if (audience?.role !== 'reader') return true
    return tool.access?.action === 'read'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Create a registry with tools loaded from contract
 */
export async function createMcpToolRegistryWithContract(_contractPath?: string): Promise<McpToolRegistry> {
  const registry = new McpToolRegistry()
  await registry.initialize()
  return registry
}

/**
 * Create an empty registry for custom tool registration
 */
export function createEmptyMcpToolRegistry(): McpToolRegistry {
  return new McpToolRegistry()
}

/**
 * Create registry and validate all tools
 */
export async function createAndValidateMcpToolRegistry(contractPath?: string): Promise<{
  registry: McpToolRegistry
  validation: { valid: boolean; errors: Array<{ tool: string; errors: string[] }> }
}> {
  const registry = await createMcpToolRegistryWithContract(contractPath)
  const validation = registry.validateAllTools()

  return {
    registry,
    validation,
  }
}

/**
 * Table MCP Server Implementation
 *
 * Purpose: Table-specific MCP server extending base McpHttpServer
 * Task: Phase 3, Task 13 - MCP Server Factory Implementation
 * Dependencies: Tasks 11-12 (RED phase complete)
 * Sequential: Implements after comprehensive testing
 */

import { McpHttpServer } from '../../../mcp/http-server/McpHttpServer'
import { SchemaMapper } from '../schema/SchemaMapper'
import type { McpToolDefinition } from '../../../application/services/McpToolRegistry'
import { SchemaDiscoveryService } from '../../../infrastructure/ai-metadata/SchemaDiscoveryService'

interface Template {
  identifier: string
  name: string
  description?: string
  query: string
  tags?: string[]
  inputSchema?: any
  parameters?: Array<{
    name: string
    type: string
    description: string
    required: boolean
    default?: any
  }>
  tableId?: string
}

interface McpRequest {
  jsonrpc: '2.0'
  id?: string | number
  method: string
  params?: any
}

interface McpResponse {
  jsonrpc: '2.0'
  id?: string | number | null
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

/**
 * Table-specific MCP Server that provides templates as discoverable tools
 */
export class TableMcpServer {
  private tableId: string
  private tableTools: Map<string, McpToolDefinition> = new Map()
  private tableInitialized: boolean = false
  private mcpServer: McpHttpServer
  private schemaDiscoveryService: SchemaDiscoveryService | null = null

  constructor(tableId: string, graphqlEndpoint: string, restApiBaseUrl?: string) {
    this.tableId = tableId
    this.mcpServer = new McpHttpServer(graphqlEndpoint, restApiBaseUrl)
  }

  /**
   * Initialize table-specific MCP server
   */
  async initialize(): Promise<void> {
    if (this.tableInitialized) return

    console.log(`Initializing Table MCP Server for table: ${this.tableId}`)

    // First initialize the base MCP server
    await this.mcpServer.initialize()

    // Add basic CRUD tools for table management
    this.addTableCrudTools()

    // Load table-specific templates and convert to tools
    await this.loadTableTemplates()

    this.tableInitialized = true
    console.log(`Table MCP Server initialized for table ${this.tableId} with ${this.tableTools.size} tools`)
  }

  /**
   * Load templates for this table and convert them to MCP tools
   */
  private async loadTableTemplates(): Promise<void> {
    try {
      // Add aiMetadata tool first
      this.addAiMetadataTool()

      // Add schema discovery tools
      this.addSchemaDiscoveryTools()

      // Query templates associated with this table
      const templates = await this.getTableTemplates(this.tableId)

      console.log(`Found ${templates.length} templates for table ${this.tableId}`)

      // Convert each template to MCP tool
      templates.forEach(template => {
        try {
          const mcpTool = this.convertTemplateToMcpTool(template)
          this.tableTools.set(mcpTool.name, mcpTool)
        } catch (error) {
          console.warn(`Failed to convert template ${template.identifier} to MCP tool:`, error)
        }
      })

      console.log(`Converted ${this.tableTools.size} tools (including aiMetadata) for table ${this.tableId}`)
    } catch (error) {
      console.error(`Failed to load templates for table ${this.tableId}:`, error)
      // Continue with empty tool set rather than failing
    }
  }

  /**
   * Add aiMetadata tool for this table
   */
  private addAiMetadataTool(): void {
    const aiMetadataTool: McpToolDefinition = {
      name: `get-table-metadata-${this.tableId}`,
      description: `Get AI-friendly metadata for table ${this.tableId}, including schema info, usage patterns, and sample data`,
      inputSchema: {
        type: 'object',
        properties: {
          includeSampleData: {
            type: 'boolean',
            description: 'Whether to include sample data in the response',
            default: true
          },
          sampleLimit: {
            type: 'number',
            description: 'Maximum number of sample nodes to include',
            default: 5
          }
        },
        required: []
      },
      operationType: 'query',
      graphqlOperation: {
        operationType: 'query',
        query: `
          query GetTableMetadata($tableId: ID!, $includeAiMetadata: Boolean!) {
            table(id: $tableId) {
              id
              identifier
              description
              aiMetadata @include(if: $includeAiMetadata) {
                schemaInfo {
                  dataTypes
                  requiredFields
                  searchableFields
                  relationshipCapabilities
                }
                usagePatterns {
                  commonQueries {
                    pattern
                    description
                    example
                  }
                  templateRecommendations {
                    templateId
                    useCase
                  }
                  queryComplexity
                }
                sampleData {
                  nodes {
                    id
                    content
                    attributes
                  }
                  relationships {
                    from
                    to
                    type
                  }
                }
              }
            }
          }
        `
      }
    }

    this.tableTools.set(aiMetadataTool.name, aiMetadataTool)
  }

  /**
   * Add schema discovery tools for this table
   */
  private addSchemaDiscoveryTools(): void {
    try {
      // Add schema discovery tools immediately (deferred initialization)
      // The SchemaDiscoveryService will be initialized lazily when first called

      // 1. Discover search operations tool
      const discoverSearchOperationsTool: McpToolDefinition = {
        name: `discover-search-operations-${this.tableId}`,
        description: `Discover all available SearchNodes operation variations for table ${this.tableId}`,
        inputSchema: {
          type: 'object',
          properties: {
            baseOperation: {
              type: 'string',
              description: 'Base operation to discover variations for',
              default: 'searchNodes'
            }
          },
          required: []
        },
        operationType: 'query'
      }

      // 2. Discover filter options tool
      const discoverFilterOptionsTool: McpToolDefinition = {
        name: `discover-filter-options-${this.tableId}`,
        description: `Discover all available SearchNodesFilter options for table ${this.tableId}`,
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
        operationType: 'query'
      }

      // 3. Generate search examples tool
      const generateSearchExamplesTool: McpToolDefinition = {
        name: `generate-search-examples-${this.tableId}`,
        description: `Generate comprehensive search examples for table ${this.tableId}`,
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
        operationType: 'query'
      }

      // Add all schema discovery tools
      this.tableTools.set(discoverSearchOperationsTool.name, discoverSearchOperationsTool)
      this.tableTools.set(discoverFilterOptionsTool.name, discoverFilterOptionsTool)
      this.tableTools.set(generateSearchExamplesTool.name, generateSearchExamplesTool)

      console.log(`Added 3 schema discovery tools for table ${this.tableId}`)
    } catch (error) {
      console.error(`Failed to add schema discovery tools for table ${this.tableId}:`, error)
    }
  }

  /**
   * Get GraphQL schema from the MCP server
   */
  private async getGraphQLSchema(): Promise<any> {
    try {
      // Access the GraphQL executor to get schema via introspection
      const graphqlExecutor = (this.mcpServer as any).graphqlExecutor
      if (graphqlExecutor) {
        // Use introspection query to get schema
        const introspectionQuery = `
          query IntrospectionQuery {
            __schema {
              types {
                name
                kind
                description
                fields {
                  name
                  description
                  args {
                    name
                    description
                    type {
                      name
                      kind
                      ofType {
                        name
                        kind
                      }
                    }
                  }
                  type {
                    name
                    kind
                    ofType {
                      name
                      kind
                    }
                  }
                }
                inputFields {
                  name
                  description
                  type {
                    name
                    kind
                    ofType {
                      name
                      kind
                    }
                  }
                }
              }
            }
          }
        `
        
        const result = await graphqlExecutor.execute({
          operationName: 'IntrospectionQuery',
          operationType: 'query',
          query: introspectionQuery,
          variables: {}
        })
        
        if (result.data && result.data.__schema && !result.errors) {
          return result.data.__schema
        }
      }
      
      console.warn('Could not get GraphQL schema via introspection')
      return null
    } catch (error) {
      console.error('Failed to get GraphQL schema:', error)
      return null
    }
  }

  /**
   * Add table CRUD tools for this table
   */
  private addTableCrudTools(): void {
    // 1. Get table attributes
    const getAttributesTool: McpToolDefinition = {
      name: `get-table-${this.tableId}-attributes`,
      description: `Get all attributes for table ${this.tableId}`,
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      },
      operationType: 'query',
      graphqlOperation: {
        operationType: 'query',
        query: `
          query table_attributes($tableId: ID!) {
            table(id: $tableId) {
              id
              identifier
              description
              attributes {
                id
                identifier
                name
                description
                attributeType {
                  id
                  identifier
                  name
                  dataType
                  description
                }
              }
            }
          }
        `
      }
    }

    // 2. Create attribute - Fixed: removed unused $tableId variable
    const createAttributeTool: McpToolDefinition = {
      name: `create-table-${this.tableId}-attribute`,
      description: `Create a new attribute for table ${this.tableId}`,
      inputSchema: {
        type: 'object',
        properties: {
          identifier: {
            type: 'string',
            description: 'Unique identifier for the attribute'
          },
          name: {
            type: 'string',
            description: 'Display name for the attribute'
          },
          description: {
            type: 'string',
            description: 'Description of the attribute'
          },
          attributeTypeId: {
            type: 'string',
            description: 'ID of the attribute type'
          },
          required: {
            type: 'boolean',
            description: 'Whether this attribute is required',
            default: false
          }
        },
        required: ['identifier', 'name', 'attributeTypeId']
      },
      operationType: 'mutation',
      graphqlOperation: {
        operationType: 'mutation',
        query: `
          mutation create_attribute($input: CreateAttributeInput!) {
            createAttribute(input: $input) {
              success
              attribute {
                id
                identifier
                name
                description
              }
              errors {
                field
                message
              }
            }
          }
        `
      }
    }

    // 3. Update attribute
    const updateAttributeTool: McpToolDefinition = {
      name: `update-table-${this.tableId}-attribute`,
      description: `Update an existing attribute for table ${this.tableId}`,
      inputSchema: {
        type: 'object',
        properties: {
          attributeId: {
            type: 'string',
            description: 'ID of the attribute to update'
          },
          name: {
            type: 'string',
            description: 'New display name for the attribute'
          },
          description: {
            type: 'string',
            description: 'New description of the attribute'
          },
          required: {
            type: 'boolean',
            description: 'Whether this attribute is required'
          }
        },
        required: ['attributeId']
      },
      operationType: 'mutation',
      graphqlOperation: {
        operationType: 'mutation',
        query: `
          mutation UpdateAttribute($id: ID!, $input: UpdateAttributeInput!) {
            updateAttribute(id: $id, input: $input) {
              success
              attribute {
                id
                identifier
                name
                description
              }
              errors {
                field
                message
              }
            }
          }
        `
      }
    }

    // 4. Delete attribute
    const deleteAttributeTool: McpToolDefinition = {
      name: `delete-table-${this.tableId}-attribute`,
      description: `Delete an attribute from table ${this.tableId}`,
      inputSchema: {
        type: 'object',
        properties: {
          attributeId: {
            type: 'string',
            description: 'ID of the attribute to delete'
          }
        },
        required: ['attributeId']
      },
      operationType: 'mutation',
      graphqlOperation: {
        operationType: 'mutation',
        query: `
          mutation DeleteAttribute($id: ID!) {
            deleteAttribute(id: $id) {
              success
              errors {
                field
                message
              }
            }
          }
        `
      }
    }

    // 5. Get table templates
    const getTemplatesTool: McpToolDefinition = {
      name: `get-table-${this.tableId}-templates`,
      description: `Get all templates associated with table ${this.tableId}`,
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of templates to return',
            default: 50
          },
          offset: {
            type: 'number',
            description: 'Number of templates to skip',
            default: 0
          }
        },
        required: []
      },
      operationType: 'query',
      graphqlOperation: {
        operationType: 'query',
        query: `
          query GetTableTemplates($tableId: String!, $limit: Int!, $offset: Int!) {
            searchTemplates(
              filter: {
                tags: [$tableId]
              }
              pagination: {
                limit: $limit
                offset: $offset
              }
            ) {
              templates {
                id
                identifier
                name
                description
                query
                tags
                createdAt
                updatedAt
              }
              totalCount
              hasNextPage
            }
          }
        `
      }
    }

    // 6. Create table-specific template
    const createTemplateTool: McpToolDefinition = {
      name: `create-table-${this.tableId}-template`,
      description: `Create a new template specifically for table ${this.tableId}. This template will be tagged with table:${this.tableId} for easy discovery.`,
      inputSchema: {
        type: 'object',
        properties: {
          identifier: {
            type: 'string',
            description: 'Unique identifier for the template'
          },
          name: {
            type: 'string',
            description: 'Human-readable name for the template'
          },
          description: {
            type: 'string',
            description: 'Description of what the template does'
          },
          query: {
            type: 'string',
            description: 'GraphQL query/mutation string that operates on this table'
          },
          additionalTags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional tags besides the automatic table tag'
          }
        },
        required: ['identifier', 'name', 'query']
      },
      operationType: 'mutation',
      graphqlOperation: {
        operationType: 'mutation',
        query: `
          mutation CreateTableTemplate($input: CreateQueryTemplateInput!) {
            createTemplate(input: $input) {
              success
              template {
                id
                identifier
                name
                description
                query
                tags
              }
              errors {
                field
                message
              }
            }
          }
        `
      }
    }

    // 7. Search table-specific templates (permission filtered) - FIXED: removed unsupported query field
    const searchTableTemplatesTool: McpToolDefinition = {
      name: `search-table-${this.tableId}-templates`,
      description: `Search and list templates available for table ${this.tableId}. Only shows templates tagged with table:${this.tableId} or global templates.`,
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of templates to return',
            default: 20
          },
          offset: {
            type: 'number',
            description: 'Number of templates to skip',
            default: 0
          },
          includeGlobal: {
            type: 'boolean',
            description: 'Whether to include global templates (not table-specific)',
            default: true
          }
        },
        required: []
      },
      operationType: 'query',
      graphqlOperation: {
        operationType: 'query',
        query: `
          query SearchTableTemplates($tableTag: String!, $limit: Int!, $offset: Int!) {
            searchTemplates(
              filter: {
                tags: [$tableTag]
              }
              pagination: {
                limit: $limit
                offset: $offset
              }
            ) {
              templates {
                id
                identifier
                name
                description
                query
                tags
                createdAt
                updatedAt
              }
              totalCount
              hasNextPage
            }
          }
        `
      }
    }

    // 8. Execute table-specific template
    const executeTableTemplateTool: McpToolDefinition = {
      name: `execute-table-${this.tableId}-template`,
      description: `Execute a template that is available for table ${this.tableId}. Only templates tagged with table:${this.tableId} or global templates can be executed.`,
      inputSchema: {
        type: 'object',
        properties: {
          templateIdentifier: {
            type: 'string',
            description: 'Identifier of the template to execute'
          },
          variables: {
            type: 'object',
            description: 'Variables to pass to the template execution',
            additionalProperties: true
          }
        },
        required: ['templateIdentifier']
      },
      operationType: 'mutation',
      graphqlOperation: {
        operationType: 'mutation',
        query: `
          mutation ExecuteTableTemplate($templateIdentifier: String!, $variables: JSON!) {
            executeTemplateWithGraphQL(
              templateIdentifier: $templateIdentifier
              variables: $variables
            ) {
              success
              data
              errors {
                message
              }
            }
          }
        `
      }
    }

    // 9. Update template
    const updateTemplateTool: McpToolDefinition = {
      name: `update-table-${this.tableId}-template`,
      description: `Update a template associated with table ${this.tableId}`,
      inputSchema: {
        type: 'object',
        properties: {
          templateId: {
            type: 'string',
            description: 'ID of the template to update'
          },
          name: {
            type: 'string',
            description: 'New name for the template'
          },
          description: {
            type: 'string',
            description: 'New description for the template'
          },
          query: {
            type: 'string',
            description: 'New GraphQL query for the template'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'New tags for the template'
          }
        },
        required: ['templateId']
      },
      operationType: 'mutation',
      graphqlOperation: {
        operationType: 'mutation',
        query: `
          mutation UpdateTemplate($id: ID!, $input: UpdateQueryTemplateInput!) {
            updateTemplate(id: $id, input: $input) {
              success
              template {
                id
                identifier
                name
                description
                query
                tags
              }
              errors {
                field
                message
              }
            }
          }
        `
      }
    }

    // Add all tools to the registry
    this.tableTools.set(getAttributesTool.name, getAttributesTool)
    this.tableTools.set(createAttributeTool.name, createAttributeTool)
    this.tableTools.set(updateAttributeTool.name, updateAttributeTool)
    this.tableTools.set(deleteAttributeTool.name, deleteAttributeTool)
    this.tableTools.set(getTemplatesTool.name, getTemplatesTool)
    this.tableTools.set(createTemplateTool.name, createTemplateTool)
    this.tableTools.set(searchTableTemplatesTool.name, searchTableTemplatesTool)
    this.tableTools.set(executeTableTemplateTool.name, executeTableTemplateTool)
    this.tableTools.set(updateTemplateTool.name, updateTemplateTool)
  }

  /**
   * Get templates associated with this table
   */
  private async getTableTemplates(tableId: string): Promise<Template[]> {
    try {
      // Query GraphQL for templates related to this table
      const query = `
        query GetTableTemplates($tableId: String!) {
          searchTemplates(
            filter: {
              tags: [$tableId]
            }
            pagination: {
              limit: 100
              offset: 0
            }
          ) {
            templates {
              identifier
              name
              description
              query
              tags
              inputSchema
            }
          }
        }
      `

      const variables = { tableId: `table:${tableId}` }

      const operation = {
        operationName: 'GetTableTemplates',
        query,
        variables,
        operationType: 'query' as const
      }

      const result = await (this.mcpServer as any).graphqlExecutor.execute(operation)

      if (result.errors && result.errors.length > 0) {
        console.warn(`GraphQL errors when fetching templates for table ${tableId}:`, result.errors)
      }

      const templates = result.data?.searchTemplates?.templates || []

      // Filter templates that are actually associated with this table
      return templates.filter((template: Template) => {
        // Check if template has table-specific tag or query references
        const hasTableTag = template.tags?.some(tag => tag === `table:${tableId}`)
        const hasTableReference = template.query?.includes(tableId)

        return hasTableTag || hasTableReference
      })
    } catch (error) {
      console.error(`Error querying templates for table ${tableId}:`, error)
      return []
    }
  }

  /**
   * Convert template to MCP tool definition
   */
  private convertTemplateToMcpTool(template: Template): McpToolDefinition {
    try {
      // Use SchemaMapper to convert template to MCP tool
      const mcpTool = SchemaMapper.convertTemplateToMcpTool(template)

      // Detect operation type from GraphQL query
      const detectedOperationType = this.detectGraphQLOperationType(template.query)

      return {
        name: mcpTool.name,
        description: `${mcpTool.description} (Table: ${this.tableId})`,
        inputSchema: mcpTool.inputSchema,
        operationType: detectedOperationType,
        graphqlOperation: {
          operationType: detectedOperationType,
          query: template.query
        }
      }
    } catch (error) {
      console.warn(`Failed to map template ${template.identifier}:`, error)

      // Detect operation type for fallback as well
      const detectedOperationType = this.detectGraphQLOperationType(template.query)

      // Fallback tool definition
      return {
        name: template.identifier,
        description: `Execute template: ${template.name} (Table: ${this.tableId})`,
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
        operationType: detectedOperationType,
        graphqlOperation: {
          operationType: detectedOperationType,
          query: template.query
        }
      }
    }
  }

  /**
   * Override tools/list to return ONLY table-specific tools
   */
  async handleToolsList(id: string | number | undefined): Promise<McpResponse> {
    await this.initialize()

    // Return ONLY table-specific tools - no base tools inheritance
    // Sub-table MCP servers should be isolated and table-focused
    const tableSpecificTools = Array.from(this.tableTools.values())

    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: tableSpecificTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      }
    }
  }

  /**
   * Override tools/call to handle table-specific tool execution
   */
  async handleToolsCall(
    id: string | number | undefined,
    params: any
  ): Promise<McpResponse> {
    if (!params || !params.name) {
      return this.createErrorResponse(id, -32602, 'Invalid params', 'Tool name required')
    }

    const { name, arguments: args } = params

    await this.initialize()

    // Check if this is a table-specific tool
    console.log(`🔍 Looking for tool: ${name}`)
    console.log(`🔍 Available table tools: ${Array.from(this.tableTools.keys()).join(', ')}`)
    console.log(`🔍 Tool found in table tools: ${this.tableTools.has(name)}`)

    if (this.tableTools.has(name)) {
      console.log(`✅ Executing table-specific tool: ${name}`)
      return await this.executeTableTool(id, name, args || {})
    }

    // Do NOT delegate to base MCP server - sub-table MCP should be isolated
    console.log(`❌ Tool not found in table-specific tools: ${name}`)
    return this.createErrorResponse(
      id,
      -32601,
      'Method not found',
      `Tool '${name}' is not available in table ${this.tableId} MCP server. Use the root MCP server for global tools.`
    )
  }

  /**
   * Execute table-specific tool (template)
   */
  private async executeTableTool(
    id: string | number | undefined,
    toolName: string,
    args: any
  ): Promise<McpResponse> {
    try {
      const tool = this.tableTools.get(toolName)
      if (!tool) {
        return this.createErrorResponse(id, -32601, 'Method not found', `Tool ${toolName} not found`)
      }

      // Validate arguments against tool schema
      if (tool.inputSchema && Object.keys(tool.inputSchema.properties || {}).length > 0) {
        const validation = this.validateToolArguments(args, tool.inputSchema)
        if (!validation.valid) {
          return this.createErrorResponse(
            id,
            -32602,
            'Invalid params',
            `Schema validation failed: ${validation.errors.join(', ')}`
          )
        }
      }

      // Check if this is a CRUD tool or a template tool
      if (tool.operationType && tool.graphqlOperation) {
        // This is a CRUD tool - execute GraphQL directly
        const result = await this.executeGraphQL(tool, args)

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ],
            isError: result.errors && result.errors.length > 0
          }
        }
      } else {
        // This is a template tool - execute via executeTemplateWithGraphQL
        const result = await this.executeTemplate(toolName, args)

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ],
            isError: !result.success
          }
        }
      }
    } catch (error) {
      console.error(`Error executing table tool ${toolName}:`, error)
      return this.createErrorResponse(
        id,
        -32603,
        'Internal error',
        `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Execute template using GraphQL
   */
  private async executeTemplate(templateIdentifier: string, variables: any): Promise<any> {
    try {
      // Special handling for aiMetadata tool
      if (templateIdentifier === `get-table-metadata-${this.tableId}`) {
        return this.executeAiMetadataQuery(variables)
      }

      // Special handling for schema discovery tools
      if (templateIdentifier === `discover-search-operations-${this.tableId}`) {
        return this.executeSchemaDiscoveryTool('discoverSearchOperations', variables)
      }
      if (templateIdentifier === `discover-filter-options-${this.tableId}`) {
        return this.executeSchemaDiscoveryTool('discoverFilterOptions', variables)
      }
      if (templateIdentifier === `generate-search-examples-${this.tableId}`) {
        return this.executeSchemaDiscoveryTool('generateSearchExamples', variables)
      }

      // Clean variables - remove any variables that are not expected by the template
      const cleanVariables = { ...variables }

      // Remove common variables that are added by the system but not used by templates
      delete cleanVariables.tableId

      // Regular template execution
      const mutation = `
        mutation ExecuteTemplateWithGraphQL(
          $templateIdentifier: String!
          $variables: JSON!
        ) {
          executeTemplateWithGraphQL(
            templateIdentifier: $templateIdentifier
            variables: $variables
          ) {
            success
            data
            errors {
              message
            }
          }
        }
      `

      const operation = {
        operationName: 'ExecuteTemplateWithGraphQL',
        query: mutation,
        variables: {
          templateIdentifier,
          variables: cleanVariables
        },
        operationType: 'mutation' as const
      }

      const result = await (this.mcpServer as any).graphqlExecutor.execute(operation)

      if (result.errors && result.errors.length > 0) {
        return {
          success: false,
          error: result.errors[0].message,
          data: null
        }
      }

      return result.data?.executeTemplateWithGraphQL || {
        success: false,
        error: 'No result returned',
        data: null
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: null
      }
    }
  }

  /**
   * Execute aiMetadata query directly
   */
  private async executeAiMetadataQuery(variables: any): Promise<any> {
    try {
      const includeSampleData = variables.includeSampleData !== false
      const sampleLimit = variables.sampleLimit || 5

      const query = `
        query GetTableMetadata($tableId: ID!, $includeAiMetadata: Boolean!) {
          table(id: $tableId) {
            id
            identifier
            description
            aiMetadata @include(if: $includeAiMetadata) {
              schemaInfo {
                dataTypes
                requiredFields
                searchableFields
                relationshipCapabilities
              }
              usagePatterns {
                commonQueries {
                  pattern
                  description
                  example
                }
                templateRecommendations {
                  templateId
                  useCase
                }
                queryComplexity
              }
              sampleData {
                nodes {
                  id
                  content
                  attributes
                }
                relationships {
                  from
                  to
                  type
                }
              }
            }
          }
        }
      `

      const operation = {
        operationName: 'GetTableMetadata',
        query,
        variables: {
          tableId: this.tableId,
          includeAiMetadata: true
        },
        operationType: 'query' as const
      }

      const result = await (this.mcpServer as any).graphqlExecutor.execute(operation)

      if (result.errors && result.errors.length > 0) {
        return {
          success: false,
          error: result.errors[0].message,
          data: null
        }
      }

      return {
        success: true,
        data: result.data?.table || null
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: null
      }
    }
  }

  /**
   * Execute schema discovery tool using SchemaDiscoveryService
   */
  private async executeSchemaDiscoveryTool(method: string, variables: any): Promise<any> {
    try {
      // Lazy initialization of SchemaDiscoveryService
      if (!this.schemaDiscoveryService) {
        console.log(`Initializing SchemaDiscoveryService for table ${this.tableId}`)
        const schema = await this.getGraphQLSchema()
        if (schema) {
          this.schemaDiscoveryService = new SchemaDiscoveryService(schema)
          console.log(`SchemaDiscoveryService initialized successfully for table ${this.tableId}`)
        } else {
          return {
            success: false,
            error: 'Unable to access GraphQL schema for schema discovery',
            data: null
          }
        }
      }

      let result: any

      switch (method) {
        case 'discoverSearchOperations':
          result = await this.schemaDiscoveryService.discoverSearchOperations(
            variables.baseOperation || 'searchNodes'
          )
          break

        case 'discoverFilterOptions':
          result = await this.schemaDiscoveryService.discoverFilterOptions()
          break

        case 'generateSearchExamples':
          result = await this.schemaDiscoveryService.generateSearchExamples(this.tableId)
          break

        default:
          return {
            success: false,
            error: `Unknown schema discovery method: ${method}`,
            data: null
          }
      }

      return {
        success: true,
        data: result
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: null
      }
    }
  }

  /**
   * Validate tool arguments against schema
   */
  private validateToolArguments(args: any, schema: any): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!schema || schema.type !== 'object') {
      return { valid: true, errors: [] }
    }

    // Check required fields
    if (schema.required && Array.isArray(schema.required)) {
      schema.required.forEach((field: string) => {
        if (args[field] === undefined || args[field] === null) {
          errors.push(`Required field '${field}' is missing`)
        }
      })
    }

    // Check field types (basic validation)
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([field, fieldSchema]: [string, any]) => {
        if (args[field] !== undefined) {
          const expectedType = fieldSchema.type
          const actualType = typeof args[field]

          if (expectedType === 'number' && actualType !== 'number') {
            errors.push(`Field '${field}' should be a number, got ${actualType}`)
          } else if (expectedType === 'string' && actualType !== 'string') {
            errors.push(`Field '${field}' should be a string, got ${actualType}`)
          } else if (expectedType === 'boolean' && actualType !== 'boolean') {
            errors.push(`Field '${field}' should be a boolean, got ${actualType}`)
          }
        }
      })
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Override server info to include table context
   */
  getServerInfo(): { name: string; version: string } {
    return {
      name: `Bun Graph DB MCP Server - Table ${this.tableId}`,
      version: '1.0.0'
    }
  }

  /**
   * Get table ID
   */
  getTableId(): string {
    return this.tableId
  }

  /**
   * Get table-specific tools count
   */
  getTableToolsCount(): number {
    return this.tableTools.size
  }

  /**
   * Check if table has been initialized
   */
  isTableInitialized(): boolean {
    return this.tableInitialized
  }

  /**
   * Refresh table templates (useful for dynamic updates)
   */
  async refreshTableTemplates(): Promise<void> {
    console.log(`Refreshing templates for table ${this.tableId}`)
    this.tableTools.clear()
    await this.loadTableTemplates()
  }

  /**
   * Handle MCP requests by delegating to appropriate handlers
   */
  async handleRequest(request: Request): Promise<Response> {
    try {
      const body = await request.text()
      const jsonRpcRequest = JSON.parse(body)

      const { method, id, params } = jsonRpcRequest

      let result: McpResponse

      switch (method) {
        case 'initialize':
          result = await (this.mcpServer as any).handleInitialize(id, params)
          break
        case 'tools/list':
          result = await this.handleToolsList(id)
          break
        case 'tools/call':
          result = await this.handleToolsCall(id, params)
          break
        default:
          result = this.createErrorResponse(id, -32601, 'Method not found')
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      const errorResponse = this.createErrorResponse(null, -32700, 'Parse error')
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  /**
   * Extract GraphQL operation name from a query string
   */
  private extractOperationName(query: string): string {
    try {
      // Use regex to extract operation name from query
      const match = query.match(/(query|mutation)\s+(\w+)/i)
      if (match && match[2]) {
        return match[2]
      }
    } catch (error) {
      console.warn('Failed to extract operation name from GraphQL query:', error)
    }
    return 'Operation'
  }

  /**
   * Detect GraphQL operation type from query string
   */
  private detectGraphQLOperationType(query: string): 'query' | 'mutation' {
    try {
      // Clean up the query string and check for operation type
      const cleanQuery = query.trim()

      // Check if it starts with 'query' keyword
      if (/^\s*query\s/i.test(cleanQuery)) {
        return 'query'
      }

      // Check if it starts with 'mutation' keyword
      if (/^\s*mutation\s/i.test(cleanQuery)) {
        return 'mutation'
      }

      // If no explicit operation type, assume query (GraphQL default)
      return 'query'
    } catch (error) {
      console.warn('Failed to detect GraphQL operation type:', error)
      return 'query' // Default to query if detection fails
    }
  }

  /**
   * Execute GraphQL operation for CRUD tools
   */
  private async executeGraphQL(tool: McpToolDefinition, args: any): Promise<any> {
    try {
      if (!tool.graphqlOperation) {
        throw new Error('No GraphQL operation defined for this tool')
      }

      let variables: any = {}
      let operationType = tool.graphqlOperation.operationType

      // Handle different tool types with proper variable preparation
      if (tool.name.includes('get-table-') && tool.name.includes('-attributes')) {
        // CRUD: Get table attributes - needs tableId
        variables = { tableId: this.tableId }
        
      } else if (tool.name.includes('create-table-') && tool.name.includes('-attribute')) {
        // CRUD: Create attribute - needs only input object (tableId goes inside input)
        variables = {
          input: {
            tableId: this.tableId,
            ...args
          }
        }
        
      } else if (tool.name.includes('update-table-') && tool.name.includes('-attribute')) {
        // CRUD: Update attribute - needs id and input object
        // Extract attributeId and create proper structure
        const { attributeId, ...inputFields } = args
        variables = {
          id: attributeId,
          input: inputFields
        }
        
      } else if (tool.name.includes('delete-table-') && tool.name.includes('-attribute')) {
        // CRUD: Delete attribute - needs id parameter
        variables = { id: args.attributeId }
        
      } else if (tool.name.includes('get-table-') && tool.name.includes('-templates')) {
        // CRUD: Get table templates - needs special filter format
        variables = {
          tableId: `table:${this.tableId}`,
          limit: args.limit || 50,
          offset: args.offset || 0
        }
        
      } else if (tool.name.includes('create-table-') && tool.name.includes('-template')) {
        // CRUD: Create table-specific template - needs input object with automatic table tagging
        const { additionalTags = [], ...templateFields } = args
        variables = {
          input: {
            ...templateFields,
            tags: [`table:${this.tableId}`, ...additionalTags]
          }
        }

      } else if (tool.name.includes('update-table-') && tool.name.includes('-template')) {
        // CRUD: Update template - needs id and input object
        // Extract templateId and create proper structure
        const { templateId, ...inputFields } = args
        variables = {
          id: templateId,
          input: inputFields
        }

      } else if (tool.name.includes('search-table-') && tool.name.includes('-templates')) {
        // FIXED: Search table-specific templates with permission filtering
        // Match the corrected GraphQL query variables: $tableTag, $limit, $offset (removed $query)
        const { limit = 20, offset = 0 } = args
        variables = {
          tableTag: `table:${this.tableId}`,
          limit,
          offset
        }
        
      } else if (tool.name.includes('execute-table-') && tool.name.includes('-template')) {
        // NEW: Execute table-accessible template
        // Match the GraphQL query variables: $templateIdentifier, $variables
        const { templateIdentifier, variables: templateVariables = {} } = args
        variables = {
          templateIdentifier,
          variables: templateVariables
        }

      } else if (tool.name.includes('get-table-metadata-')) {
        // CRUD: Get table metadata - metadata tool uses direct GraphQL execution
        // Only pass the parameters that the GraphQL query expects
        variables = {
          tableId: this.tableId,
          includeAiMetadata: true
        }
        
      } else {
        // Template-based tool - pass args directly without modifications
        variables = { ...args }
        
        // Auto-detect operation type for template tools
        operationType = this.detectGraphQLOperationType(tool.graphqlOperation.query || '')
      }

      // Extract operation name from the GraphQL query
      const operationName = this.extractOperationName(tool.graphqlOperation.query || '')

      const operation = {
        operationName: operationName,
        query: tool.graphqlOperation.query,
        variables,
        operationType: operationType as 'query' | 'mutation'
      }

      console.log(`🔧 Executing GraphQL ${operationType} for tool ${tool.name}:`, {
        operation: operationType,
        variables
      })

      const result = await (this.mcpServer as any).graphqlExecutor.execute(operation)

      if (result.errors && result.errors.length > 0) {
        console.warn(`GraphQL errors for tool ${tool.name}:`, result.errors)
        return {
          success: false,
          errors: result.errors,
          data: result.data
        }
      }

      return {
        success: true,
        data: result.data,
        errors: []
      }
    } catch (error) {
      console.error(`Error executing GraphQL for tool ${tool.name}:`, error)
      return {
        success: false,
        errors: [{ message: error instanceof Error ? error.message : 'Unknown error' }],
        data: null
      }
    }
  }

  /**
   * Create MCP error response
   */
  private createErrorResponse(
    id: string | number | undefined | null,
    code: number,
    message: string,
    data?: any
  ): McpResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        ...(data && { data })
      }
    }
  }
}
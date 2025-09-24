/**
 * T018: MCP tool registry service
 *
 * Purpose: Central registry for tool definitions with discovery capabilities
 * Must Include: Load from contracts/graphql-tools.json, tools/list, tool lookup
 * Integration: Tool discovery for MCP protocol
 */

// import toolsContract from '../../specs/005-graphql-mcp-graphql/contracts/graphql-tools.json'
// import {
//   createMcpToolFromContract,
//   type McpToolDefinition,
//   validateMcpToolDefinition,
// } from '../models/McpToolDefinition.ts'

export interface McpToolDefinition {
  name: string
  description: string
  inputSchema: any
  operationType?: 'query' | 'mutation'
  graphqlOperation?: {
    operationType?: string
    query?: string
  }
}

export interface ToolDiscoveryResult {
  tools: Array<{
    name: string
    description: string
    inputSchema: any
  }>
}

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
      // TODO: Restore contract loading when contract file is available
      console.log('MCP Tool Registry: Contract loading temporarily disabled')
      this.loaded = true
      console.log(`Loaded ${this.tools.size} tools from contract (empty registry)`)
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

    this.tools.set(tool.name, tool)
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
  listTools(): ToolDiscoveryResult {
    const tools = Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
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
      (tool) =>
        tool.name.toLowerCase().includes(searchTerm) ||
        tool.description.toLowerCase().includes(searchTerm)
    )
  }

  /**
   * Validate all tools in the registry
   */
  validateAllTools(): { valid: boolean; errors: Array<{ tool: string; errors: string[] }> } {
    const errors: Array<{ tool: string; errors: string[] }> = []

    // TODO: Restore validation when contract validation is available
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
    await this.registerBuiltInTools()
  }

  /**
   * Register built-in MCP tools
   */
  private async registerBuiltInTools(): Promise<void> {
    // Register bulk template import tool - file path based with parallel processing
    const bulkImportTool: McpToolDefinition = {
      name: 'bulk-import-templates',
      description: 'Bulk import templates using file paths with parallel processing. Bridge between local file system and GraphQL operations.',
      operationType: 'mutation',
      inputSchema: {
        type: 'object',
        required: ['filePaths'],
        properties: {
          filePaths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of absolute file paths to JSON template files to import',
            minItems: 1
          },
          overwriteExisting: {
            type: 'boolean',
            description: 'Whether to overwrite existing templates with same identifier',
            default: false
          },
          generateNewIdentifier: {
            type: 'boolean',
            description: 'Whether to generate new identifier if conflict exists',
            default: false
          },
          dryRun: {
            type: 'boolean',
            description: 'Whether to perform dry run without actually importing',
            default: false
          },
          batchSize: {
            type: 'number',
            description: 'Number of templates to process in each parallel batch',
            default: 10,
            minimum: 1,
            maximum: 50
          }
        }
      },
      graphqlOperation: {
        operationType: 'custom',
        query: 'File path based parallel template import'
      }
    }

    this.register(bulkImportTool)

    // Register list available templates tool
    const listTemplatesStatusTool: McpToolDefinition = {
      name: 'list-available-templates',
      description: 'List all available template files in exported-templates directory with metadata.',
      operationType: 'query',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      graphqlOperation: {
        operationType: 'custom',
        query: 'File system discovery for available templates'
      }
    }

    this.register(listTemplatesStatusTool)

    // Register import status tool
    const importStatusTool: McpToolDefinition = {
      name: 'get-import-status',
      description: 'Get status and summary of available templates for import.',
      operationType: 'query',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      graphqlOperation: {
        operationType: 'custom',
        query: 'Import status and estimation'
      }
    }

    this.register(importStatusTool)

    console.log(`MCP Tool Registry: Registered ${this.getToolCount()} built-in tools`)
  }
}

/**
 * Create a registry with tools loaded from contract
 */
export async function createMcpToolRegistryWithContract(
  _contractPath?: string
): Promise<McpToolRegistry> {
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

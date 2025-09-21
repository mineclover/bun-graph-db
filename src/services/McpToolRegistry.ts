/**
 * T018: MCP tool registry service
 *
 * Purpose: Central registry for tool definitions with discovery capabilities
 * Must Include: Load from contracts/graphql-tools.json, tools/list, tool lookup
 * Integration: Tool discovery for MCP protocol
 */

import toolsContract from '../../specs/005-graphql-mcp-graphql/contracts/graphql-tools.json'
import {
  createMcpToolFromContract,
  type McpToolDefinition,
  validateMcpToolDefinition,
} from '../models/McpToolDefinition.ts'

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
      // Load tools from the contract file
      const contractTools = toolsContract.tools

      if (!contractTools || !Array.isArray(contractTools)) {
        throw new Error('Invalid tools contract: tools array not found')
      }

      this.tools.clear()

      for (const contractTool of contractTools) {
        try {
          const toolDefinition = createMcpToolFromContract(contractTool)
          this.tools.set(toolDefinition.name, toolDefinition)
        } catch (error) {
          console.error(`Failed to load tool "${contractTool.name}":`, error)
          throw new Error(`Tool "${contractTool.name}" validation failed: ${error}`)
        }
      }

      this.loaded = true
      console.log(`Loaded ${this.tools.size} tools from contract`)
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

    for (const [name, tool] of this.tools) {
      const validation = validateMcpToolDefinition(tool)
      if (!validation.valid) {
        errors.push({
          tool: name,
          errors: validation.errors,
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

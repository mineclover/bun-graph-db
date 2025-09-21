/**
 * T013: McpToolDefinition model
 *
 * Purpose: Core entity representing MCP tool with GraphQL mapping
 * Must Include: name, description, inputSchema, graphqlOperation fields with validation
 * Based On: data-model.md McpToolDefinition specification
 */

import type { JSONSchema7 } from 'json-schema'

export type OperationType = 'query' | 'mutation'

export interface GraphQLOperation {
  operationName: string
  query: string
  variables: Record<string, any>
  operationType: OperationType
}

export interface McpToolDefinition {
  name: string
  description: string
  inputSchema: JSONSchema7
  graphqlOperation: GraphQLOperation
  operationType: OperationType
}

export class McpToolDefinitionBuilder {
  private tool: Partial<McpToolDefinition> = {}

  withName(name: string): McpToolDefinitionBuilder {
    if (!name || name.trim().length === 0) {
      throw new Error('Tool name cannot be empty')
    }
    this.tool.name = name.trim()
    return this
  }

  withDescription(description: string): McpToolDefinitionBuilder {
    if (!description || description.trim().length === 0) {
      throw new Error('Tool description cannot be empty')
    }
    this.tool.description = description.trim()
    return this
  }

  withInputSchema(schema: JSONSchema7): McpToolDefinitionBuilder {
    if (!schema || typeof schema !== 'object') {
      throw new Error('Input schema must be a valid JSON Schema object')
    }

    // Validate that it's a proper JSON Schema
    if (schema.type !== 'object') {
      throw new Error('Input schema must be of type "object"')
    }

    // Ensure additionalProperties is defined (security requirement)
    if (schema.additionalProperties === undefined) {
      schema.additionalProperties = false
    }

    this.tool.inputSchema = schema
    return this
  }

  withGraphQLOperation(operation: GraphQLOperation): McpToolDefinitionBuilder {
    if (!operation) {
      throw new Error('GraphQL operation cannot be null')
    }

    if (!operation.operationName || operation.operationName.trim().length === 0) {
      throw new Error('GraphQL operation name cannot be empty')
    }

    if (!operation.query || operation.query.trim().length === 0) {
      throw new Error('GraphQL query cannot be empty')
    }

    if (!operation.operationType || !['query', 'mutation'].includes(operation.operationType)) {
      throw new Error('GraphQL operation type must be "query" or "mutation"')
    }

    this.tool.graphqlOperation = {
      ...operation,
      operationName: operation.operationName.trim(),
      query: operation.query.trim(),
      variables: operation.variables || {},
    }

    this.tool.operationType = operation.operationType
    return this
  }

  build(): McpToolDefinition {
    // Validate required fields
    if (!this.tool.name) {
      throw new Error('Tool name is required')
    }
    if (!this.tool.description) {
      throw new Error('Tool description is required')
    }
    if (!this.tool.inputSchema) {
      throw new Error('Tool input schema is required')
    }
    if (!this.tool.graphqlOperation) {
      throw new Error('Tool GraphQL operation is required')
    }
    if (!this.tool.operationType) {
      throw new Error('Tool operation type is required')
    }

    return this.tool as McpToolDefinition
  }
}

export function validateMcpToolDefinition(tool: McpToolDefinition): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Validate name
  if (!tool.name || tool.name.trim().length === 0) {
    errors.push('Tool name is required and cannot be empty')
  } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(tool.name)) {
    errors.push(
      'Tool name must start with a letter and contain only letters, numbers, and underscores'
    )
  }

  // Validate description
  if (!tool.description || tool.description.trim().length === 0) {
    errors.push('Tool description is required and cannot be empty')
  } else if (tool.description.length > 500) {
    errors.push('Tool description cannot exceed 500 characters')
  }

  // Validate input schema
  if (!tool.inputSchema) {
    errors.push('Tool input schema is required')
  } else {
    if (tool.inputSchema.type !== 'object') {
      errors.push('Input schema must be of type "object"')
    }
    if (tool.inputSchema.additionalProperties === undefined) {
      errors.push('Input schema must define additionalProperties (recommended: false)')
    }
  }

  // Validate GraphQL operation
  if (!tool.graphqlOperation) {
    errors.push('Tool GraphQL operation is required')
  } else {
    if (
      !tool.graphqlOperation.operationName ||
      tool.graphqlOperation.operationName.trim().length === 0
    ) {
      errors.push('GraphQL operation name is required')
    }
    if (!tool.graphqlOperation.query || tool.graphqlOperation.query.trim().length === 0) {
      errors.push('GraphQL query is required')
    }
    if (!['query', 'mutation'].includes(tool.graphqlOperation.operationType)) {
      errors.push('GraphQL operation type must be "query" or "mutation"')
    }
  }

  // Validate operation type consistency
  if (tool.operationType !== tool.graphqlOperation?.operationType) {
    errors.push('Tool operation type must match GraphQL operation type')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function validateMcpToolUniqueName(tools: McpToolDefinition[], name: string): boolean {
  return !tools.some((tool) => tool.name === name)
}

export class McpToolDefinitionRegistry {
  private tools: Map<string, McpToolDefinition> = new Map()

  register(tool: McpToolDefinition): void {
    const validation = validateMcpToolDefinition(tool)
    if (!validation.valid) {
      throw new Error(`Tool validation failed: ${validation.errors.join(', ')}`)
    }

    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name "${tool.name}" already exists`)
    }

    this.tools.set(tool.name, tool)
  }

  get(name: string): McpToolDefinition | undefined {
    return this.tools.get(name)
  }

  getAll(): McpToolDefinition[] {
    return Array.from(this.tools.values())
  }

  list(): string[] {
    return Array.from(this.tools.keys())
  }

  exists(name: string): boolean {
    return this.tools.has(name)
  }

  unregister(name: string): boolean {
    return this.tools.delete(name)
  }

  clear(): void {
    this.tools.clear()
  }

  size(): number {
    return this.tools.size
  }
}

// Utility functions for common tool creation patterns
export function createMcpQueryTool(
  name: string,
  description: string,
  inputSchema: JSONSchema7,
  query: string,
  operationName?: string
): McpToolDefinition {
  return new McpToolDefinitionBuilder()
    .withName(name)
    .withDescription(description)
    .withInputSchema(inputSchema)
    .withGraphQLOperation({
      operationName: operationName || name,
      query,
      variables: {},
      operationType: 'query',
    })
    .build()
}

export function createMcpMutationTool(
  name: string,
  description: string,
  inputSchema: JSONSchema7,
  mutation: string,
  operationName?: string
): McpToolDefinition {
  return new McpToolDefinitionBuilder()
    .withName(name)
    .withDescription(description)
    .withInputSchema(inputSchema)
    .withGraphQLOperation({
      operationName: operationName || name,
      query: mutation,
      variables: {},
      operationType: 'mutation',
    })
    .build()
}

export function createMcpToolFromContract(contractTool: any): McpToolDefinition {
  if (
    !contractTool.name ||
    !contractTool.description ||
    !contractTool.inputSchema ||
    !contractTool.graphqlOperation
  ) {
    throw new Error('Invalid contract tool: missing required fields')
  }

  const operationType = contractTool.graphqlOperation.type as OperationType
  if (!operationType || !['query', 'mutation'].includes(operationType)) {
    throw new Error(`Invalid operation type: ${contractTool.graphqlOperation.type}`)
  }

  return new McpToolDefinitionBuilder()
    .withName(contractTool.name)
    .withDescription(contractTool.description)
    .withInputSchema(contractTool.inputSchema)
    .withGraphQLOperation({
      operationName: contractTool.name,
      query: contractTool.graphqlOperation.query,
      variables: {},
      operationType: operationType,
    })
    .build()
}

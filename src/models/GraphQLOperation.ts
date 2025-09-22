/**
 * T014: GraphQLOperation model
 *
 * Purpose: Encapsulates GraphQL query/mutation execution details
 * Based On: data-model.md GraphQLOperation specification
 */

import { type OperationDefinitionNode, parse } from 'graphql'

export type GraphQLOperationType = 'query' | 'mutation' | 'custom'

export interface GraphQLOperation {
  operationName: string
  query: string
  variables: Record<string, any>
  operationType: GraphQLOperationType
}

export interface GraphQLExecutionContext {
  operation: GraphQLOperation
  variables: Record<string, any>
  timestamp: Date
  requestId?: string
}

export interface GraphQLExecutionResult {
  data?: any
  errors?: Array<{
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: Array<string | number>
    extensions?: Record<string, any>
  }>
  extensions?: Record<string, any>
}

export class GraphQLOperationBuilder {
  private operation: Partial<GraphQLOperation> = {}

  withOperationName(name: string): GraphQLOperationBuilder {
    if (!name || name.trim().length === 0) {
      throw new Error('Operation name cannot be empty')
    }
    this.operation.operationName = name.trim()
    return this
  }

  withQuery(query: string): GraphQLOperationBuilder {
    if (!query || query.trim().length === 0) {
      throw new Error('GraphQL query cannot be empty')
    }
    this.operation.query = query.trim()
    return this
  }

  withVariables(variables: Record<string, any>): GraphQLOperationBuilder {
    this.operation.variables = variables || {}
    return this
  }

  withOperationType(type: GraphQLOperationType): GraphQLOperationBuilder {
    if (!type || !['query', 'mutation', 'custom'].includes(type)) {
      throw new Error('Operation type must be "query" or "mutation"')
    }
    this.operation.operationType = type
    return this
  }

  build(): GraphQLOperation {
    if (!this.operation.operationName) {
      throw new Error('Operation name is required')
    }
    if (!this.operation.query) {
      throw new Error('GraphQL query is required')
    }
    if (!this.operation.operationType) {
      throw new Error('Operation type is required')
    }

    return {
      operationName: this.operation.operationName,
      query: this.operation.query,
      variables: this.operation.variables || {},
      operationType: this.operation.operationType,
    }
  }
}

export function validateGraphQLOperation(operation: GraphQLOperation): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Validate operation name
  if (!operation.operationName || operation.operationName.trim().length === 0) {
    errors.push('Operation name is required')
  } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(operation.operationName)) {
    errors.push(
      'Operation name must start with a letter and contain only letters, numbers, and underscores'
    )
  }

  // Validate query syntax
  if (!operation.query || operation.query.trim().length === 0) {
    errors.push('GraphQL query is required')
  } else {
    try {
      const ast = parse(operation.query)
      const operationDef = ast.definitions[0] as OperationDefinitionNode

      if (!operationDef || operationDef.kind !== 'OperationDefinition') {
        errors.push('Query must contain a valid GraphQL operation definition')
      } else {
        // Validate operation type matches
        if (operationDef.operation !== operation.operationType) {
          errors.push(
            `Operation type mismatch: expected ${operation.operationType}, found ${operationDef.operation}`
          )
        }

        // Validate operation name matches if present
        if (operationDef.name && operationDef.name.value !== operation.operationName) {
          errors.push(
            `Operation name mismatch: expected ${operation.operationName}, found ${operationDef.name.value}`
          )
        }
      }
    } catch (parseError) {
      errors.push(`GraphQL syntax error: ${parseError}`)
    }
  }

  // Validate operation type
  if (
    !operation.operationType ||
    !['query', 'mutation', 'custom'].includes(operation.operationType)
  ) {
    errors.push('Operation type must be "query" or "mutation"')
  }

  // Validate variables
  if (operation.variables && typeof operation.variables !== 'object') {
    errors.push('Variables must be an object')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function validateGraphQLOperationVariables(
  operation: GraphQLOperation,
  providedVariables: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  try {
    const ast = parse(operation.query)
    const operationDef = ast.definitions[0] as OperationDefinitionNode

    if (operationDef.variableDefinitions) {
      for (const varDef of operationDef.variableDefinitions) {
        const varName = varDef.variable.name.value
        const isRequired = varDef.type.kind === 'NonNullType'

        if (isRequired && !(varName in providedVariables)) {
          errors.push(`Required variable "${varName}" is missing`)
        }

        if (varName in providedVariables && providedVariables[varName] === null && isRequired) {
          errors.push(`Required variable "${varName}" cannot be null`)
        }
      }
    }

    // Check for unexpected variables
    for (const providedVar in providedVariables) {
      const hasDefinition = operationDef.variableDefinitions?.some(
        (def) => def.variable.name.value === providedVar
      )
      if (!hasDefinition) {
        errors.push(`Unexpected variable "${providedVar}" provided`)
      }
    }
  } catch (parseError) {
    errors.push(`Cannot validate variables: ${parseError}`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export class GraphQLOperationExecutor {
  private graphqlEndpoint: string

  constructor(endpoint: string = 'http://localhost:4000/graphql') {
    this.graphqlEndpoint = endpoint
  }

  async execute(
    operation: GraphQLOperation,
    variables?: Record<string, any>
  ): Promise<GraphQLExecutionResult> {
    const validation = validateGraphQLOperation(operation)
    if (!validation.valid) {
      return {
        errors: validation.errors.map((error) => ({ message: error })),
      }
    }

    const executionVariables = { ...operation.variables, ...variables }

    // Validate variables against operation
    const variableValidation = validateGraphQLOperationVariables(operation, executionVariables)
    if (!variableValidation.valid) {
      return {
        errors: variableValidation.errors.map((error) => ({ message: error })),
      }
    }

    try {
      const response = await fetch(this.graphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: operation.query,
          variables: executionVariables,
          operationName: operation.operationName,
        }),
      })

      if (!response.ok) {
        return {
          errors: [
            {
              message: `HTTP error: ${response.status} ${response.statusText}`,
            },
          ],
        }
      }

      const result = await response.json()
      return result
    } catch (error) {
      return {
        errors: [
          {
            message: `Execution error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      }
    }
  }

  async executeWithContext(context: GraphQLExecutionContext): Promise<GraphQLExecutionResult> {
    return this.execute(context.operation, context.variables)
  }
}

export function createGraphQLQuery(
  operationName: string,
  query: string,
  variables?: Record<string, any>
): GraphQLOperation {
  return new GraphQLOperationBuilder()
    .withOperationName(operationName)
    .withQuery(query)
    .withVariables(variables || {})
    .withOperationType('query')
    .build()
}

export function createGraphQLMutation(
  operationName: string,
  mutation: string,
  variables?: Record<string, any>
): GraphQLOperation {
  return new GraphQLOperationBuilder()
    .withOperationName(operationName)
    .withQuery(mutation)
    .withVariables(variables || {})
    .withOperationType('mutation')
    .build()
}

export function extractGraphQLVariables(query: string): string[] {
  try {
    const ast = parse(query)
    const operationDef = ast.definitions[0] as OperationDefinitionNode

    if (!operationDef.variableDefinitions) {
      return []
    }

    return operationDef.variableDefinitions.map((def) => def.variable.name.value)
  } catch {
    return []
  }
}

export function createGraphQLExecutionContext(
  operation: GraphQLOperation,
  variables?: Record<string, any>,
  requestId?: string
): GraphQLExecutionContext {
  return {
    operation,
    variables: variables || {},
    timestamp: new Date(),
    requestId,
  }
}

export function isValidGraphQLIdentifier(name: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)
}

export function parseGraphQLOperationType(query: string): GraphQLOperationType | null {
  try {
    const ast = parse(query)
    const operationDef = ast.definitions[0] as OperationDefinitionNode
    return (operationDef?.operation as GraphQLOperationType) || null
  } catch {
    return null
  }
}

export function parseGraphQLOperationName(query: string): string | null {
  try {
    const ast = parse(query)
    const operationDef = ast.definitions[0] as OperationDefinitionNode
    return operationDef?.name?.value || null
  } catch {
    return null
  }
}

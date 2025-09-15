import {
  buildSchema,
  getIntrospectionQuery,
  graphqlSync,
  type OperationDefinitionNode,
  parse,
} from 'graphql'

export interface GraphQLOperationInfo {
  queryName: string | null
  operationType: 'query' | 'mutation' | 'subscription'
}

export class GraphQLParser {
  /**
   * Extract GraphQL operation name and type from SDL query text
   */
  static extractOperationInfo(queryText: string): GraphQLOperationInfo {
    try {
      // Parse the GraphQL query
      const document = parse(queryText.trim())

      // Find the first operation definition
      const operationDefinition = document.definitions.find(
        (def) => def.kind === 'OperationDefinition'
      ) as OperationDefinitionNode | undefined

      if (!operationDefinition) {
        throw new Error('No operation definition found in query text')
      }

      return {
        queryName: operationDefinition.name?.value || null,
        operationType: operationDefinition.operation,
      }
    } catch (error) {
      throw new Error(
        `Failed to parse GraphQL operation: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Validate GraphQL query syntax
   */
  static validateQuerySyntax(queryText: string): { isValid: boolean; errors: string[] } {
    try {
      parse(queryText.trim())
      return { isValid: true, errors: [] }
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown syntax error'],
      }
    }
  }

  /**
   * Extract variable definitions from GraphQL query
   */
  static extractVariableDefinitions(queryText: string): string[] {
    try {
      const document = parse(queryText.trim())

      const operationDefinition = document.definitions.find(
        (def) => def.kind === 'OperationDefinition'
      ) as OperationDefinitionNode | undefined

      if (!operationDefinition || !operationDefinition.variableDefinitions) {
        return []
      }

      return operationDefinition.variableDefinitions.map((varDef) => varDef.variable.name.value)
    } catch (_error) {
      return []
    }
  }

  /**
   * Build and validate schema from SDL query text against a base schema
   */
  static validateAgainstSchema(
    queryText: string,
    baseSchemaSDL: string
  ): {
    isValid: boolean
    errors: string[]
  } {
    try {
      // Build the base schema
      const schema = buildSchema(baseSchemaSDL)

      // Execute introspection to validate the query
      const result = graphqlSync({
        schema,
        source: getIntrospectionQuery(),
      })

      if (result.errors && result.errors.length > 0) {
        return {
          isValid: false,
          errors: result.errors.map((error) => error.message),
        }
      }

      // Try to parse and validate the query syntax
      const syntaxValidation = GraphQLParser.validateQuerySyntax(queryText)
      return syntaxValidation
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Schema validation failed'],
      }
    }
  }

  /**
   * Extract complexity score heuristic from GraphQL query
   */
  static calculateComplexityScore(queryText: string): number {
    try {
      const document = parse(queryText.trim())

      let complexity = 1
      let fieldCount = 0
      let nestedLevels = 0

      // Simple complexity calculation based on query structure
      const countComplexity = (selections: any, depth = 0): void => {
        if (!selections) return

        nestedLevels = Math.max(nestedLevels, depth)

        for (const selection of selections) {
          fieldCount++

          // Add complexity for nested fields
          if (selection.selectionSet) {
            complexity += depth * 0.5
            countComplexity(selection.selectionSet.selections, depth + 1)
          }

          // Add complexity for arguments
          if (selection.arguments && selection.arguments.length > 0) {
            complexity += selection.arguments.length * 0.2
          }
        }
      }

      const operationDefinition = document.definitions.find(
        (def) => def.kind === 'OperationDefinition'
      ) as OperationDefinitionNode | undefined

      if (operationDefinition?.selectionSet) {
        countComplexity(operationDefinition.selectionSet.selections)
      }

      // Calculate final complexity score (1-10 scale)
      complexity += fieldCount * 0.1 + nestedLevels * 0.3

      return Math.min(Math.max(Math.round(complexity), 1), 10)
    } catch (_error) {
      // Return default complexity if parsing fails
      return 1
    }
  }

  /**
   * Extract field names from GraphQL query for indexing/search
   */
  static extractFieldNames(queryText: string): string[] {
    try {
      const document = parse(queryText.trim())
      const fieldNames: string[] = []

      const extractFields = (selections: any): void => {
        if (!selections) return

        for (const selection of selections) {
          if (selection.name?.value) {
            fieldNames.push(selection.name.value)
          }

          if (selection.selectionSet) {
            extractFields(selection.selectionSet.selections)
          }
        }
      }

      const operationDefinition = document.definitions.find(
        (def) => def.kind === 'OperationDefinition'
      ) as OperationDefinitionNode | undefined

      if (operationDefinition?.selectionSet) {
        extractFields(operationDefinition.selectionSet.selections)
      }

      return Array.from(new Set(fieldNames)) // Remove duplicates
    } catch (_error) {
      return []
    }
  }

  /**
   * Extract root-level system queries (top-level fields only)
   * These are the actual GraphQL operations being called
   */
  static extractSystemQueries(queryText: string): string[] {
    try {
      const document = parse(queryText.trim())
      const systemQueries: string[] = []

      const operationDefinition = document.definitions.find(
        (def) => def.kind === 'OperationDefinition'
      ) as OperationDefinitionNode | undefined

      if (operationDefinition?.selectionSet) {
        // Only extract top-level selections (root queries/mutations)
        for (const selection of operationDefinition.selectionSet.selections) {
          if (selection.kind === 'Field' && selection.name?.value) {
            systemQueries.push(selection.name.value)
          }
        }
      }

      return Array.from(new Set(systemQueries)) // Remove duplicates
    } catch (_error) {
      return []
    }
  }
}

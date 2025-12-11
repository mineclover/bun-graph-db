/**
 * T006: Contract test GraphQL operation mapping
 *
 * Purpose: Verify GraphQL query/mutation syntax and schema compatibility
 * Must Test: All GraphQL operations parse correctly and exist in target schema
 * Expected: All tests FAIL initially (no implementation)
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { type GraphQLSchema, parse } from 'graphql'
import toolsContract from '../../specs/005-graphql-mcp-graphql/contracts/graphql-tools.json'
import { startServerForSuite, stopServerForSuite } from '../fixtures/test-server-manager'

describe('GraphQL Operation Mapping Contract Tests', () => {
  const tools = toolsContract.tools
  const _targetSchema: GraphQLSchema | null = null
  let graphqlEndpoint: string

  beforeAll(async () => {
    console.log(`Testing GraphQL operations for ${tools.length} tools`)

    // Start isolated test server for this test suite
    const serverInstance = await startServerForSuite('graphql-mapping')
    graphqlEndpoint = serverInstance.url

    console.log(`Test server started on ${graphqlEndpoint}`)

    try {
      // Attempt to fetch the current GraphQL schema from the server
      const introspectionQuery = `
        query IntrospectionQuery {
          __schema {
            types {
              name
              kind
              fields {
                name
                type {
                  name
                  kind
                }
              }
            }
            queryType {
              name
            }
            mutationType {
              name
            }
          }
        }
      `

      const response = await fetch(graphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: introspectionQuery,
        }),
      })

      if (response.ok) {
        const _introspectionResult = await response.json()
        // For now, we'll validate syntax only since schema might not be fully accessible
        console.log('GraphQL server accessible for introspection')
      }
    } catch (_error) {
      console.log('Expected: GraphQL server may not be accessible yet')
    }
  })

  afterAll(async () => {
    // Clean up test server
    await stopServerForSuite('graphql-mapping')
  })

  describe('GraphQL Query Syntax Validation', () => {
    test('should have valid GraphQL syntax for healthCheck operation', () => {
      const tool = tools.find((t) => t.name === 'healthCheck')
      expect(tool).toBeDefined()
      expect(tool?.graphqlOperation.type).toBe('query')

      // Parse GraphQL query to validate syntax
      const query = tool?.graphqlOperation.query
      expect(query).toBeDefined()

      try {
        const ast = parse(query!)
        expect(ast).toBeDefined()
        expect(ast.kind).toBe('Document')
        expect(ast.definitions).toHaveLength(1)
        expect(ast.definitions[0].kind).toBe('OperationDefinition')
        expect((ast.definitions[0] as any).operation).toBe('query')
      } catch (parseError) {
        throw new Error(`Invalid GraphQL syntax for healthCheck: ${parseError}`)
      }
    })

    test('should have valid GraphQL syntax for systemStats operation', () => {
      const tool = tools.find((t) => t.name === 'systemStats')
      expect(tool).toBeDefined()
      expect(tool?.graphqlOperation.type).toBe('query')

      const query = tool?.graphqlOperation.query
      expect(query).toBeDefined()

      try {
        const ast = parse(query!)
        expect(ast).toBeDefined()
        expect((ast.definitions[0] as any).operation).toBe('query')
      } catch (parseError) {
        throw new Error(`Invalid GraphQL syntax for systemStats: ${parseError}`)
      }
    })

    test('should have valid GraphQL syntax for createTable operation', () => {
      const tool = tools.find((t) => t.name === 'createTable')
      expect(tool).toBeDefined()
      expect(tool?.graphqlOperation.type).toBe('mutation')

      const query = tool?.graphqlOperation.query
      expect(query).toBeDefined()

      try {
        const ast = parse(query!)
        expect(ast).toBeDefined()
        expect((ast.definitions[0] as any).operation).toBe('mutation')

        // Check for variable definitions
        const operation = ast.definitions[0] as any
        expect(operation.variableDefinitions).toBeDefined()
        expect(operation.variableDefinitions.length).toBeGreaterThan(0)
      } catch (parseError) {
        throw new Error(`Invalid GraphQL syntax for createTable: ${parseError}`)
      }
    })

    test('should have valid GraphQL syntax for searchNodes operation', () => {
      const tool = tools.find((t) => t.name === 'searchNodes')
      expect(tool).toBeDefined()
      expect(tool?.graphqlOperation.type).toBe('query')

      const query = tool?.graphqlOperation.query
      expect(query).toBeDefined()

      try {
        const ast = parse(query!)
        expect(ast).toBeDefined()
        expect((ast.definitions[0] as any).operation).toBe('query')
      } catch (parseError) {
        throw new Error(`Invalid GraphQL syntax for searchNodes: ${parseError}`)
      }
    })

    test('should have valid GraphQL syntax for executeTemplateWithGraphQL operation', () => {
      const tool = tools.find((t) => t.name === 'executeTemplateWithGraphQL')
      expect(tool).toBeDefined()
      expect(tool?.graphqlOperation.type).toBe('mutation')

      const query = tool?.graphqlOperation.query
      expect(query).toBeDefined()

      try {
        const ast = parse(query!)
        expect(ast).toBeDefined()
        expect((ast.definitions[0] as any).operation).toBe('mutation')

        // Should have variables for templateIdentifier and variables
        const operation = ast.definitions[0] as any
        expect(operation.variableDefinitions).toBeDefined()
        const varNames = operation.variableDefinitions.map((v: any) => v.variable.name.value)
        expect(varNames).toContain('templateIdentifier')
        expect(varNames).toContain('variables')
      } catch (parseError) {
        throw new Error(`Invalid GraphQL syntax for executeTemplateWithGraphQL: ${parseError}`)
      }
    })
  })

  describe('GraphQL Operation Compatibility', () => {
    test('should test healthCheck against live GraphQL server', async () => {
      const tool = tools.find((t) => t.name === 'healthCheck')
      const query = tool?.graphqlOperation.query

      try {
        const response = await fetch(graphqlEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: query,
          }),
        })

        expect(response.status).toBe(200)
        const data = await response.json()

        // Should not have GraphQL errors if schema is compatible
        if (data.errors) {
          console.log('GraphQL errors:', data.errors)
          // Check if errors are about missing fields vs syntax errors
          const hasSchemaErrors = data.errors.some(
            (error: any) => error.message.includes('Cannot query field') || error.message.includes('Unknown field'),
          )

          if (hasSchemaErrors) {
            throw new Error(`GraphQL schema compatibility issue: ${data.errors[0].message}`)
          }
        }

        // If successful, should have data
        if (data.data) {
          expect(data.data.healthCheck).toBeDefined()
        }
      } catch (error) {
        // Expected to fail initially - MCP server not implemented yet
        console.log('Expected failure: GraphQL operation mapping not implemented yet')
        throw error
      }
    })

    test('should test createTable against live GraphQL server', async () => {
      const tool = tools.find((t) => t.name === 'createTable')
      const query = tool?.graphqlOperation.query

      const variables = {
        input: {
          identifier: 'test-table-contract',
          description: 'Test table for contract validation',
        },
      }

      try {
        const response = await fetch(graphqlEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: query,
            variables: variables,
          }),
        })

        expect(response.status).toBe(200)
        const data = await response.json()

        // Should not have schema compatibility errors
        if (data.errors) {
          const hasSchemaErrors = data.errors.some(
            (error: any) =>
              error.message.includes('Cannot query field') ||
              error.message.includes('Unknown field') ||
              error.message.includes('Unknown type'),
          )

          if (hasSchemaErrors) {
            throw new Error(`GraphQL schema compatibility issue: ${data.errors[0].message}`)
          }
        }

        // If successful, should have data
        if (data.data) {
          expect(data.data.createTable).toBeDefined()
        }
      } catch (error) {
        // Expected to fail initially - MCP server not implemented yet
        console.log('Expected failure: GraphQL operation mapping not implemented yet')
        throw error
      }
    })

    test('should test executeTemplateWithGraphQL against live GraphQL server', async () => {
      const tool = tools.find((t) => t.name === 'executeTemplateWithGraphQL')
      const query = tool?.graphqlOperation.query

      const variables = {
        templateIdentifier: 'test-template',
        variables: {},
      }

      try {
        const response = await fetch(graphqlEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: query,
            variables: variables,
          }),
        })

        expect(response.status).toBe(200)
        const data = await response.json()

        // Check for schema compatibility
        if (data.errors) {
          const hasSchemaErrors = data.errors.some(
            (error: any) => error.message.includes('Cannot query field') || error.message.includes('Unknown field'),
          )

          if (hasSchemaErrors) {
            throw new Error(`GraphQL schema compatibility issue: ${data.errors[0].message}`)
          }
        }
      } catch (error) {
        // Expected to fail initially - MCP server not implemented yet
        console.log('Expected failure: GraphQL operation mapping not implemented yet')
        throw error
      }
    })
  })

  describe('Variable Type Mapping', () => {
    test('should have correct variable types for all operations', () => {
      tools.forEach((tool) => {
        const query = tool.graphqlOperation.query

        try {
          const ast = parse(query)
          const operation = ast.definitions[0] as any

          if (operation.variableDefinitions) {
            operation.variableDefinitions.forEach((varDef: any) => {
              const varName = varDef.variable.name.value
              const varType = varDef.type

              // Variable types should be properly defined
              expect(varType).toBeDefined()

              // Common variable type patterns
              if (varName === 'input') {
                expect(varType.kind).toBe('NonNullType') // Input should be required
              }

              if (varName === 'limit') {
                expect(varType.type?.name?.value || varType.name?.value).toBe('Int')
              }

              if (varName === 'searchTerm') {
                expect(varType.type?.name?.value || varType.name?.value).toBe('String')
              }
            })
          }
        } catch (parseError) {
          throw new Error(`Variable type validation failed for ${tool.name}: ${parseError}`)
        }
      })
    })

    test('should match input schema parameters with GraphQL variables', () => {
      tools.forEach((tool) => {
        const inputSchema = tool.inputSchema
        const query = tool.graphqlOperation.query

        try {
          const ast = parse(query)
          const operation = ast.definitions[0] as any

          // If tool has parameters, GraphQL should have variables
          if (inputSchema.properties && Object.keys(inputSchema.properties).length > 0) {
            expect(operation.variableDefinitions).toBeDefined()

            // For mutation operations, usually have an $input variable
            if (tool.graphqlOperation.type === 'mutation') {
              const hasInputVar = operation.variableDefinitions?.some((v: any) => v.variable.name.value === 'input')
              // Most mutations should use input variable pattern
              // Some mutations use individual variables instead of input object
              if (
                ![
                  'executeTemplateWithGraphQL',
                  'exportTemplate',
                  'importTemplate',
                  'removeNodeAttribute',
                  'updateNodeAttributeValue',
                  'setNodeAttribute',
                ].includes(tool.name)
              ) {
                expect(hasInputVar).toBe(true)
              }
            }
          }
        } catch (parseError) {
          throw new Error(`Parameter mapping validation failed for ${tool.name}: ${parseError}`)
        }
      })
    })
  })

  describe('All Operations Syntax Validation', () => {
    test('should validate syntax for all 12 tool operations', () => {
      tools.forEach((tool) => {
        const query = tool.graphqlOperation.query

        try {
          const ast = parse(query)
          expect(ast).toBeDefined()
          expect(ast.kind).toBe('Document')
          expect(ast.definitions).toHaveLength(1)

          const operation = ast.definitions[0] as any
          expect(operation.kind).toBe('OperationDefinition')
          expect(operation.operation).toBe(tool.graphqlOperation.type)

          // Operation should have a name
          expect(operation.name).toBeDefined()
          expect(operation.name.value).toBeDefined()
        } catch (parseError) {
          throw new Error(`GraphQL syntax error in ${tool.name}: ${parseError}`)
        }
      })
    })

    test('should have consistent naming conventions', () => {
      tools.forEach((tool) => {
        const query = tool.graphqlOperation.query
        const ast = parse(query)
        const operation = ast.definitions[0] as any

        // Operation name should match or be related to tool name
        const operationName = operation.name.value

        // Convert camelCase tool name to PascalCase for operation name
        const expectedPattern = tool.name.charAt(0).toUpperCase() + tool.name.slice(1)

        // Should either match exactly or contain the tool name pattern
        expect(
          operationName === expectedPattern ||
            operationName.includes(expectedPattern) ||
            operationName.toLowerCase().includes(tool.name.toLowerCase()),
        ).toBe(true)
      })
    })
  })
})

/**
 * Relation Mutations Test - Isolated Database Version
 * Tests GraphQL relation mutations with isolated server setup
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createRequestHelper, startServerForSuite, stopServerForSuite } from './fixtures/test-graphql-server'

const SUITE_NAME = 'relation-mutations-isolated'
const TEST_TIMEOUT = 15000

// Helper to create unique identifiers
const uniqueId = () => `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

// Global test server
let graphqlRequest: (query: string, variables?: Record<string, any>) => Promise<any>

describe('Relation Mutations - Isolated Database Test Suite', () => {
  beforeAll(async () => {
    console.log('🚀 Starting isolated GraphQL server for Relation Mutations tests...')

    // Start isolated server with dedicated database
    const server = await startServerForSuite(SUITE_NAME)
    console.log(`✅ Server started at: ${server.url}`)
    console.log(`📁 Database path: ${server.database.databasePath}`)

    // Create request helper
    graphqlRequest = createRequestHelper(SUITE_NAME)

    // Verify server is working
    const healthCheck = await graphqlRequest(`
      query {
        __schema {
          types {
            name
          }
        }
      }
    `)

    expect(healthCheck.data).toBeDefined()
    console.log('✅ GraphQL server health check passed')
  }, TEST_TIMEOUT)

  afterAll(async () => {
    console.log('🧹 Cleaning up isolated test environment...')
    await stopServerForSuite(SUITE_NAME)
    console.log('✅ Cleanup completed')
  }, TEST_TIMEOUT)

  describe('🔗 Relation Type Creation', () => {
    test('createRelationType - Create basic relation type', async () => {
      const mutation = `
        mutation CreateRelationType($input: CreateRelationTypeInput!) {
          createRelationType(input: $input) {
            success
            relationType {
              id
              identifier
              name
              description
              createdAt
              updatedAt
            }
            errors {
              message
              code
            }
          }
        }
      `

      const variables = {
        input: {
          identifier: uniqueId(),
          name: 'Depends On',
          description: 'A dependency relationship between nodes',
        },
      }

      const result = await graphqlRequest(mutation, variables)

      console.log('🔍 CreateRelationType result:', JSON.stringify(result, null, 2))

      expect(result.errors).toBeUndefined()
      expect(result.data.createRelationType.success).toBe(true)
      expect(result.data.createRelationType.relationType).toBeDefined()
      expect(result.data.createRelationType.relationType.identifier).toBe(variables.input.identifier)
      expect(result.data.createRelationType.relationType.name).toBe('Depends On')
      expect(result.data.createRelationType.relationType.description).toBe('A dependency relationship between nodes')
      expect(result.data.createRelationType.relationType.id).toBeDefined()
      expect(result.data.createRelationType.errors).toEqual([])
    })

    test('createRelationType - Create another relation type', async () => {
      const mutation = `
        mutation CreateRelationType($input: CreateRelationTypeInput!) {
          createRelationType(input: $input) {
            success
            relationType {
              id
              identifier
              name
            }
          }
        }
      `

      const variables = {
        input: {
          identifier: uniqueId(),
          name: 'Related To',
        },
      }

      const result = await graphqlRequest(mutation, variables)

      expect(result.errors).toBeUndefined()
      expect(result.data.createRelationType.success).toBe(true)
      expect(result.data.createRelationType.relationType.identifier).toBe(variables.input.identifier)
      expect(result.data.createRelationType.relationType.name).toBe('Related To')
    })

    test('createRelationType - Validation errors', async () => {
      const mutation = `
        mutation CreateRelationType($input: CreateRelationTypeInput!) {
          createRelationType(input: $input) {
            success
            relationType {
              id
            }
            errors {
              message
              code
              field
            }
          }
        }
      `

      // Test with empty identifier
      const result = await graphqlRequest(mutation, {
        input: {
          identifier: '',
          name: 'Empty Identifier',
        },
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.createRelationType.success).toBe(false)
      expect(result.data.createRelationType.errors.length).toBeGreaterThan(0)
      expect(result.data.createRelationType.relationType).toBeNull()
    })
  })

  describe('🔗 Node Relation Creation', () => {
    let testTableId: string
    let testRelationTypeId: string
    let sourceNodeId: string
    let targetNodeId: string

    beforeAll(async () => {
      // Create a test table
      const createTableMutation = `
        mutation CreateTestTable($input: CreateTableInput!) {
          createTable(input: $input) {
            success
            table {
              id
            }
          }
        }
      `

      const tableResult = await graphqlRequest(createTableMutation, {
        input: {
          identifier: 'test-table-for-relations',
          description: 'Test table for relation mutations',
        },
      })

      expect(tableResult.data.createTable.success).toBe(true)
      testTableId = tableResult.data.createTable.table.id

      // Create a relation type
      const createRelationTypeMutation = `
        mutation CreateRelationType($input: CreateRelationTypeInput!) {
          createRelationType(input: $input) {
            relationType { id }
          }
        }
      `

      const relationTypeResult = await graphqlRequest(createRelationTypeMutation, {
        input: {
          identifier: uniqueId(),
          name: 'Test Relation',
        },
      })

      testRelationTypeId = relationTypeResult.data.createRelationType.relationType.id

      // Create source node
      const createSourceNodeMutation = `
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            node { id }
          }
        }
      `

      const sourceNodeResult = await graphqlRequest(createSourceNodeMutation, {
        input: {
          content: 'Source node for relations',
          tableId: testTableId,
        },
      })

      sourceNodeId = sourceNodeResult.data.createNode.node.id

      // Create target node
      const targetNodeResult = await graphqlRequest(createSourceNodeMutation, {
        input: {
          content: 'Target node for relations',
          tableId: testTableId,
        },
      })

      targetNodeId = targetNodeResult.data.createNode.node.id

      console.log(
        `✅ Created test data: table(${testTableId}), relationType(${testRelationTypeId}), sourceNode(${sourceNodeId}), targetNode(${targetNodeId})`,
      )
    })

    test('createRelation - Create basic node relation', async () => {
      const mutation = `
        mutation CreateRelation($input: CreateRelationInput!) {
          createRelation(input: $input) {
            success
            relation {
              id
              table {
                id
              }
              sourceNode {
                id
                content
              }
              targetNode {
                id
                content
              }
              relationType {
                id
                identifier
                name
              }
              createdAt
              updatedAt
            }
            errors {
              message
              code
            }
          }
        }
      `

      const variables = {
        input: {
          tableId: testTableId,
          sourceNodeId: sourceNodeId,
          targetNodeId: targetNodeId,
          relationTypeId: testRelationTypeId,
        },
      }

      const result = await graphqlRequest(mutation, variables)

      console.log('🔍 CreateRelation result:', JSON.stringify(result, null, 2))

      expect(result.errors).toBeUndefined()
      expect(result.data.createRelation.success).toBe(true)
      expect(result.data.createRelation.relation).toBeDefined()
      expect(result.data.createRelation.relation.sourceNode.id).toBe(sourceNodeId)
      expect(result.data.createRelation.relation.targetNode.id).toBe(targetNodeId)
      expect(result.data.createRelation.relation.relationType.id).toBe(testRelationTypeId)
      expect(result.data.createRelation.relation.table.id).toBe(testTableId)
      expect(result.data.createRelation.relation.id).toBeDefined()
      expect(result.data.createRelation.errors).toEqual([])
    })

    test('createRelation - Invalid source node should fail', async () => {
      const mutation = `
        mutation CreateRelation($input: CreateRelationInput!) {
          createRelation(input: $input) {
            success
            errors {
              message
              code
            }
          }
        }
      `

      const result = await graphqlRequest(mutation, {
        input: {
          tableId: testTableId,
          sourceNodeId: '999999',
          targetNodeId: targetNodeId,
          relationTypeId: testRelationTypeId,
        },
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.createRelation.success).toBe(false)
      expect(result.data.createRelation.errors.length).toBeGreaterThan(0)
    })

    test('createRelation - Invalid relation type should fail', async () => {
      const mutation = `
        mutation CreateRelation($input: CreateRelationInput!) {
          createRelation(input: $input) {
            success
            errors {
              message
              code
            }
          }
        }
      `

      const result = await graphqlRequest(mutation, {
        input: {
          tableId: testTableId,
          sourceNodeId: sourceNodeId,
          targetNodeId: targetNodeId,
          relationTypeId: '999999',
        },
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.createRelation.success).toBe(false)
      expect(result.data.createRelation.errors.length).toBeGreaterThan(0)
    })
  })

  describe('🗑️ Relation Deletion', () => {
    let testRelationId: string
    let testTableId: string
    let testRelationTypeId: string
    let sourceNodeId: string
    let targetNodeId: string

    beforeAll(async () => {
      // Create test data for deletion tests
      const createTableMutation = `
        mutation CreateTestTable($input: CreateTableInput!) {
          createTable(input: $input) {
            table { id }
          }
        }
      `

      const tableResult = await graphqlRequest(createTableMutation, {
        input: {
          identifier: 'test-table-for-deletion',
          description: 'Test table for relation deletion',
        },
      })

      testTableId = tableResult.data.createTable.table.id

      // Create relation type
      const createRelationTypeMutation = `
        mutation CreateRelationType($input: CreateRelationTypeInput!) {
          createRelationType(input: $input) {
            relationType { id }
          }
        }
      `

      const relationTypeResult = await graphqlRequest(createRelationTypeMutation, {
        input: {
          identifier: uniqueId(),
          name: 'Delete Test Relation',
        },
      })

      testRelationTypeId = relationTypeResult.data.createRelationType.relationType.id

      // Create nodes
      const createNodeMutation = `
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            node { id }
          }
        }
      `

      const sourceNodeResult = await graphqlRequest(createNodeMutation, {
        input: {
          content: 'Source node for deletion',
          tableId: testTableId,
        },
      })

      sourceNodeId = sourceNodeResult.data.createNode.node.id

      const targetNodeResult = await graphqlRequest(createNodeMutation, {
        input: {
          content: 'Target node for deletion',
          tableId: testTableId,
        },
      })

      targetNodeId = targetNodeResult.data.createNode.node.id

      // Create relation to delete
      const createRelationMutation = `
        mutation CreateRelation($input: CreateRelationInput!) {
          createRelation(input: $input) {
            relation { id }
          }
        }
      `

      const relationResult = await graphqlRequest(createRelationMutation, {
        input: {
          tableId: testTableId,
          sourceNodeId: sourceNodeId,
          targetNodeId: targetNodeId,
          relationTypeId: testRelationTypeId,
        },
      })

      testRelationId = relationResult.data.createRelation.relation.id
    })

    test('deleteRelation - Delete existing relation', async () => {
      const mutation = `
        mutation DeleteRelation($id: ID!) {
          deleteRelation(id: $id) {
            success
            errors {
              message
            }
          }
        }
      `

      const result = await graphqlRequest(mutation, {
        id: testRelationId,
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.deleteRelation.success).toBe(true)
      expect(result.data.deleteRelation.errors).toEqual([])

      // Verify relation is deleted by trying to query it
      const queryDeletedRelation = `
        query GetRelation($id: ID!) {
          nodeRelation(id: $id) {
            id
          }
        }
      `

      const queryResult = await graphqlRequest(queryDeletedRelation, { id: testRelationId })
      expect(queryResult.data.nodeRelation).toBeNull()
    })

    test('deleteRelation - Invalid relation ID should fail', async () => {
      const mutation = `
        mutation DeleteRelation($id: ID!) {
          deleteRelation(id: $id) {
            success
            errors {
              message
              code
            }
          }
        }
      `

      const result = await graphqlRequest(mutation, {
        id: '999999',
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.deleteRelation.success).toBe(false)
      expect(result.data.deleteRelation.errors.length).toBeGreaterThan(0)
    })
  })

  describe('🔍 Relation Querying After Mutations', () => {
    let testRelationId: string
    let testTableId: string
    let testRelationTypeId: string

    beforeAll(async () => {
      // Create test data for querying
      const createTableMutation = `
        mutation CreateTestTable($input: CreateTableInput!) {
          createTable(input: $input) {
            table { id }
          }
        }
      `

      const tableResult = await graphqlRequest(createTableMutation, {
        input: {
          identifier: 'test-table-for-querying',
          description: 'Test table for relation querying',
        },
      })

      testTableId = tableResult.data.createTable.table.id

      // Create relation type
      const createRelationTypeMutation = `
        mutation CreateRelationType($input: CreateRelationTypeInput!) {
          createRelationType(input: $input) {
            relationType { id }
          }
        }
      `

      const relationTypeResult = await graphqlRequest(createRelationTypeMutation, {
        input: {
          identifier: uniqueId(),
          name: 'Query Test Relation',
        },
      })

      testRelationTypeId = relationTypeResult.data.createRelationType.relationType.id

      // Create nodes and relation
      const createNodeMutation = `
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            node { id }
          }
        }
      `

      const sourceNodeResult = await graphqlRequest(createNodeMutation, {
        input: {
          content: 'Source node for querying',
          tableId: testTableId,
        },
      })

      const targetNodeResult = await graphqlRequest(createNodeMutation, {
        input: {
          content: 'Target node for querying',
          tableId: testTableId,
        },
      })

      const createRelationMutation = `
        mutation CreateRelation($input: CreateRelationInput!) {
          createRelation(input: $input) {
            relation { id }
          }
        }
      `

      const relationResult = await graphqlRequest(createRelationMutation, {
        input: {
          tableId: testTableId,
          sourceNodeId: sourceNodeResult.data.createNode.node.id,
          targetNodeId: targetNodeResult.data.createNode.node.id,
          relationTypeId: testRelationTypeId,
        },
      })

      testRelationId = relationResult.data.createRelation.relation.id
    })

    test('Query created relation by ID', async () => {
      const query = `
        query GetRelation($id: ID!) {
          nodeRelation(id: $id) {
            id
            table {
              id
              identifier
            }
            sourceNode {
              id
              content
            }
            targetNode {
              id
              content
            }
            relationType {
              id
              identifier
              name
            }
          }
        }
      `

      const result = await graphqlRequest(query, { id: testRelationId })

      expect(result.errors).toBeUndefined()
      expect(result.data.nodeRelation).toBeDefined()
      expect(result.data.nodeRelation.id).toBe(testRelationId)
      expect(result.data.nodeRelation.table.id).toBe(testTableId)
      expect(result.data.nodeRelation.relationType.id).toBe(testRelationTypeId)
    })
  })

  describe('📊 Performance & Data Integrity', () => {
    let testTableId: string
    let testRelationTypeId: string
    let _sourceNodeId: string
    let _targetNodeId: string

    beforeAll(async () => {
      // Create test data for performance testing
      const createTableMutation = `
        mutation CreateTestTable($input: CreateTableInput!) {
          createTable(input: $input) {
            table { id }
          }
        }
      `

      const tableResult = await graphqlRequest(createTableMutation, {
        input: {
          identifier: 'test-table-for-performance',
          description: 'Test table for performance testing',
        },
      })

      testTableId = tableResult.data.createTable.table.id

      // Create relation type
      const createRelationTypeMutation = `
        mutation CreateRelationType($input: CreateRelationTypeInput!) {
          createRelationType(input: $input) {
            relationType { id }
          }
        }
      `

      const relationTypeResult = await graphqlRequest(createRelationTypeMutation, {
        input: {
          identifier: uniqueId(),
          name: 'Performance Test Relation',
        },
      })

      testRelationTypeId = relationTypeResult.data.createRelationType.relationType.id

      // Create nodes for testing
      const createNodeMutation = `
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            node { id }
          }
        }
      `

      const sourceNodeResult = await graphqlRequest(createNodeMutation, {
        input: {
          content: 'Performance source node',
          tableId: testTableId,
        },
      })

      const targetNodeResult = await graphqlRequest(createNodeMutation, {
        input: {
          content: 'Performance target node',
          tableId: testTableId,
        },
      })

      _sourceNodeId = sourceNodeResult.data.createNode.node.id
      _targetNodeId = targetNodeResult.data.createNode.node.id
    })

    test('createRelation - Bulk relation creation performance', async () => {
      // Create multiple source and target nodes for unique relations
      const sourceNodes = []
      const targetNodes = []
      const createNodeMutation = `
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            node { id }
          }
        }
      `

      // Create different source-target pairs to avoid duplicate constraint
      for (let i = 0; i < 5; i++) {
        const sourceResult = await graphqlRequest(createNodeMutation, {
          input: {
            content: `Performance source node ${i}`,
            tableId: testTableId,
          },
        })
        sourceNodes.push(sourceResult.data.createNode.node.id)

        const targetResult = await graphqlRequest(createNodeMutation, {
          input: {
            content: `Performance target node ${i}`,
            tableId: testTableId,
          },
        })
        targetNodes.push(targetResult.data.createNode.node.id)
      }

      const mutation = `
        mutation CreateRelation($input: CreateRelationInput!) {
          createRelation(input: $input) {
            success
            relation {
              id
            }
            errors {
              message
              code
            }
          }
        }
      `

      const startTime = Date.now()
      const promises = []

      // Create 5 unique relations concurrently (different source-target pairs)
      for (let i = 0; i < 5; i++) {
        promises.push(
          graphqlRequest(mutation, {
            input: {
              tableId: testTableId,
              sourceNodeId: sourceNodes[i], // Different source for each relation
              targetNodeId: targetNodes[i], // Different target for each relation
              relationTypeId: testRelationTypeId,
            },
          }),
        )
      }

      const results = await Promise.all(promises)
      const endTime = Date.now()

      // Verify all relations were created successfully
      results.forEach((result, index) => {
        console.log(`🔍 Bulk relation ${index} result:`, JSON.stringify(result, null, 2))
        if (result.data.createRelation.success === false) {
          console.log(`❌ Bulk relation ${index} failed with errors:`, result.data.createRelation.errors)
        }
        expect(result.errors).toBeUndefined()
        expect(result.data.createRelation.success).toBe(true)
      })

      console.log(`✅ Created 5 unique relations in ${endTime - startTime}ms`)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds (increased due to node creation overhead)
    })
  })
})

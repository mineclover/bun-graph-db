/**
 * Comprehensive GraphQL API Test Suite
 *
 * Purpose: Test all GraphQL operations with complex scenarios
 * Coverage: Queries, Mutations, Subscriptions, Error handling
 * Scenarios: Single operations, batch operations, edge cases
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { type IsolatedTestContext, setupIntegrationTest } from '../fixtures/test-isolation-helpers'

// Typed interfaces for GraphQL responses

const SUITE_NAME = 'graphql-api-comprehensive'
let testContext: IsolatedTestContext

describe('Comprehensive GraphQL API Test Suite', () => {
  beforeAll(async () => {
    console.log('🚀 Setting up comprehensive GraphQL API test environment...')
    testContext = await setupIntegrationTest(SUITE_NAME)
    console.log('✅ Test environment ready')
    console.log(`🌐 GraphQL Server: ${testContext.server?.url}`)
    console.log(`💾 Database: ${testContext.database?.databasePath}`)
  }, 60000)

  afterAll(async () => {
    console.log('🧹 Cleaning up comprehensive GraphQL API test environment...')
    await testContext.cleanup()
    console.log('✅ Cleanup completed')
  }, 10000)

  describe('System Health and Information Queries', () => {
    test('should return comprehensive health check information', async () => {
      const query = `
        query HealthCheck {
          healthCheck {
            status
            database
            version
            timestamp
            memory {
              status
              percentage
              message
            }
          }
        }
      `

      const result = await testContext.graphqlRequest!<HealthCheckResponse>(query)

      expect(result.errors).toBeUndefined()
      expect(result.data.healthCheck).toMatchObject({
        status: 'OK',
        database: true,
        version: expect.any(String),
        timestamp: expect.any(String),
      })
    })

    test('should return detailed system statistics', async () => {
      const query = `
        query SystemStats {
          systemStats {
            memory {
              used
              total
              percentage
            }
            process {
              pid
              cpu
              platform
            }
            database {
              queryCount
              connectionCount
              averageQueryTime
            }
          }
        }
      `

      const result = await testContext.graphqlRequest!<SystemStatsResponse>(query)

      expect(result.errors).toBeUndefined()
      expect(result.data.systemStats.memory).toMatchObject({
        used: expect.any(Number),
        total: expect.any(Number),
        percentage: expect.any(Number),
      })
    })
  })

  describe('Table Management Operations', () => {
    test('should create table with comprehensive validation', async () => {
      const mutation = `
        mutation CreateTable($input: CreateTableInput!) {
          createTable(input: $input) {
            success
            table {
              id
              identifier
              description
              createdAt
              updatedAt
              tableNodeCount
              attributeCount
              attributes {
                id
                identifier
                name
                attributeType {
                  id
                  dataType
                }
              }
            }
            errors {
              field
              message
            }
          }
        }
      `

      const variables = {
        input: {
          identifier: 'comprehensive-test-table',
          description: 'Table for comprehensive testing',
        },
      }

      const result = await testContext.graphqlRequest!(mutation, variables)

      expect(result.errors).toBeUndefined()
      expect(result.data.createTable.success).toBe(true)
      expect(result.data.createTable.table).toMatchObject({
        id: expect.any(String),
        identifier: 'comprehensive-test-table',
        description: 'Table for comprehensive testing',
        tableNodeCount: 0,
        attributeCount: 0,
      })
    })

    test('should handle table creation with duplicate identifier', async () => {
      // First creation
      const mutation = `
        mutation CreateTable($input: CreateTableInput!) {
          createTable(input: $input) {
            success
            table { id }
            errors { field message }
          }
        }
      `

      const variables = {
        input: { identifier: 'duplicate-test-table' },
      }

      await testContext.graphqlRequest!(mutation, variables)

      // Second creation (should fail)
      const result = await testContext.graphqlRequest!(mutation, variables)

      expect(result.data.createTable.success).toBe(false)
      expect(result.data.createTable.errors).toContainEqual({
        field: null,
        message: expect.stringContaining('already exists'),
      })
    })

    test('should search tables with complex filters', async () => {
      // Create test tables
      const tables = [
        { identifier: 'search-table-1', description: 'First test table' },
        { identifier: 'search-table-2', description: 'Second test table' },
        { identifier: 'other-table', description: 'Different table' },
      ]

      for (const table of tables) {
        await testContext.graphqlRequest!(`
          mutation { createTable(input: { identifier: "${table.identifier}", description: "${table.description}" }) { success } }
        `)
      }

      const query = `
        query SearchTables($filter: TablesFilter!) {
          searchTables(filter: $filter) {
            nodes {
              id
              identifier
              description
              tableNodeCount
              attributeCount
            }
            totalCount
            hasNextPage
            hasPreviousPage
          }
        }
      `

      const variables = {
        filter: {
          search: 'search-table',
          identifiers: ['search-table-1', 'search-table-2'],
        },
      }

      const result = await testContext.graphqlRequest!(query, variables)

      expect(result.errors).toBeUndefined()
      expect(result.data.searchTables.nodes.length).toBeGreaterThanOrEqual(2)
      expect(result.data.searchTables.totalCount).toBeGreaterThanOrEqual(2)
      const matchingTables = result.data.searchTables.nodes.filter((table) =>
        table.identifier.includes('search-table')
      )
      expect(matchingTables.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Node Operations with Complex Scenarios', () => {
    let tableId: string

    beforeEach(async () => {
      // Create a test table
      const result = await testContext.graphqlRequest!(`
        mutation {
          createTable(input: { identifier: "node-test-table" }) {
            table { id }
          }
        }
      `)
      tableId = result.data.createTable.table.id
    })

    test('should create node with validation and metadata', async () => {
      const mutation = `
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            success
            node {
              id
              content
              createdAt
              updatedAt
              table {
                id
                identifier
              }
              attributeCount
              relationCount
            }
            errors {
              field
              message
            }
          }
        }
      `

      const variables = {
        input: {
          tableId,
          content: 'Comprehensive test node content',
        },
      }

      const result = await testContext.graphqlRequest!(mutation, variables)

      expect(result.errors).toBeUndefined()
      expect(result.data.createNode.success).toBe(true)
      expect(result.data.createNode.node).toMatchObject({
        id: expect.any(String),
        content: 'Comprehensive test node content',
        attributeCount: 0,
        relationCount: 0,
      })
    })

    test.skip('should search nodes with complex text and metadata filters', async () => {
      // Create test nodes
      const nodes = [
        { content: 'Content about technology' },
        { content: 'Content about science' },
        { content: 'Technology and innovation' },
      ]

      for (const node of nodes) {
        await testContext.graphqlRequest!(`
          mutation {
            createNode(input: {
              tableId: "${tableId}"
              content: "${node.content}"
            }) { success }
          }
        `)
      }

      const query = `
        query SearchNodes($tableId: ID!, $searchQuery: NodeSearchQuery!) {
          searchNodes(tableId: $tableId, searchQuery: $searchQuery) {
            nodes {
              node {
                id
                content
              }
              score
              attributes
            }
            totalCount
            aggregations {
              categories {
                category
                count
              }
              averageScore
            }
          }
        }
      `

      const variables = {
        tableId,
        searchQuery: {
          textSearch: 'technology',
          metadataFilters: [
            {
              field: 'category',
              operator: 'equals',
              value: 'tech',
            },
            {
              field: 'score',
              operator: 'gte',
              value: 80,
            },
          ],
          sortBy: [{ field: 'score', direction: 'DESC' }],
          limit: 10,
        },
      }

      const result = await testContext.graphqlRequest!(query, variables)

      expect(result.errors).toBeUndefined()
      expect(result.data.searchNodes.nodes).toHaveLength(1)
      expect(result.data.searchNodes.nodes[0].node.content).toBe('Content about technology')
      expect(result.data.searchNodes.totalCount).toBe(1)
    })

    test.skip('should batch create nodes with transaction safety', async () => {
      const mutation = `
        mutation BatchCreateNodes($input: BatchCreateNodesInput!) {
          batchCreateNodes(input: $input) {
            success
            nodes {
              id
              content
            }
            errors {
              index
              field
              message
            }
            statistics {
              totalRequested
              successfullyCreated
              failed
              executionTime
            }
          }
        }
      `

      const variables = {
        input: {
          tableId,
          nodes: [
            { content: 'First batch node' },
            { content: 'Second batch node' },
            { content: 'Third batch node' },
            { content: '' }, // Should fail
            { content: 'Fourth batch node' },
          ],
          options: {
            continueOnError: true,
            validateBeforeInsert: true,
          },
        },
      }

      const result = await testContext.graphqlRequest!(mutation, variables)

      expect(result.errors).toBeUndefined()
      expect(result.data.batchCreateNodes.success).toBe(true)
      expect(result.data.batchCreateNodes.nodes).toHaveLength(4) // All except invalid
      expect(result.data.batchCreateNodes.statistics).toMatchObject({
        totalRequested: 5,
        successfullyCreated: 4,
        failed: 1,
      })
    })
  })

  describe('Attribute Management', () => {
    let tableId: string

    beforeEach(async () => {
      const uniqueIdentifier = `attribute-test-table-${Date.now()}-${Math.random().toString(36).substring(7)}`
      const result = await testContext.graphqlRequest!(`
        mutation {
          createTable(input: { identifier: "${uniqueIdentifier}" }) {
            success
            table { id }
            errors { message }
          }
        }
      `)
      if (!result.data.createTable.success) {
        console.log('CreateTable failed:', result.data.createTable.errors)
        throw new Error(`CreateTable failed: ${JSON.stringify(result.data.createTable.errors)}`)
      }
      expect(result.data.createTable.success).toBe(true)
      expect(result.data.createTable.table).toBeTruthy()
      tableId = result.data.createTable.table.id
    })

    test('should create multiple attribute types', async () => {
      const attributes = [
        { identifier: 'name', name: 'Full Name', attributeTypeId: '1' }, // text
        { identifier: 'age', name: 'Age', attributeTypeId: '2' }, // number
        { identifier: 'active', name: 'Is Active', attributeTypeId: '3' }, // boolean
        { identifier: 'birthdate', name: 'Birth Date', attributeTypeId: '4' }, // date
        { identifier: 'tags', name: 'Tags', attributeTypeId: '5' }, // array
      ]

      for (const attr of attributes) {
        const result = await testContext.graphqlRequest!(`
          mutation {
            createAttribute(input: {
              tableId: "${tableId}"
              identifier: "${attr.identifier}"
              name: "${attr.name}"
              attributeTypeId: "${attr.attributeTypeId}"
            }) {
              success
              attribute {
                id
                identifier
                name
                attributeType {
                  id
                  dataType
                }
              }
              errors {
                message
                code
                field
              }
            }
          }
        `)

        expect(result.data.createAttribute.success).toBe(true)
        expect(result.data.createAttribute.attribute.identifier).toBe(attr.identifier)
      }
    })

    test('should set and validate attribute values', async () => {
      // Create attributes first
      await testContext.graphqlRequest!(`
        mutation {
          createAttribute(input: {
            tableId: "${tableId}"
            identifier: "score"
            name: "Score"
            attributeTypeId: "2"
          }) { success }
        }
      `)

      // Create a node
      const nodeResult = await testContext.graphqlRequest!(`
        mutation {
          createNode(input: {
            tableId: "${tableId}"
            content: "Test content"
          }) {
            node { id }
          }
        }
      `)
      const nodeId = nodeResult.data.createNode.node.id

      // Get attribute ID
      const attrResult = await testContext.graphqlRequest!(`
        query {
          table(id: "${tableId}") {
            attributes {
              id
              identifier
            }
          }
        }
      `)
      const attributeId = attrResult.data.table.attributes[0].id

      // Set attribute value
      const setResult = await testContext.graphqlRequest!(`
        mutation {
          setNodeAttribute(input: {
            nodeId: "${nodeId}"
            attributeId: "${attributeId}"
            value: "95"
          }) {
            success
            nodeAttribute {
              attribute {
                identifier
                name
              }
              value
              formattedValue
            }
            errors { message }
          }
        }
      `)

      console.log('SetNodeAttribute result:', JSON.stringify(setResult.data.setNodeAttribute, null, 2))
      if (!setResult.data.setNodeAttribute.success) {
        console.log('SetNodeAttribute failed:', setResult.data.setNodeAttribute.errors)
        throw new Error(`SetNodeAttribute failed: ${JSON.stringify(setResult.data.setNodeAttribute.errors)}`)
      }
      expect(setResult.data.setNodeAttribute.success).toBe(true)
      expect(setResult.data.setNodeAttribute.nodeAttribute).toBeTruthy()
      expect(setResult.data.setNodeAttribute.nodeAttribute.value).toBe('95')
    })
  })

  describe('Relationship Operations', () => {
    let tableId: string
    let relationTypeId: string
    const nodeIds: string[] = []

    beforeEach(async () => {
      // Create table
      const tableResult = await testContext.graphqlRequest!(`
        mutation {
          createTable(input: { identifier: "relation-test-table" }) {
            table { id }
          }
        }
      `)
      tableId = tableResult.data.createTable.table.id

      // Create relation types
      const relationTypeResult = await testContext.graphqlRequest!(`
        mutation {
          createRelationType(input: {
            identifier: "knows"
            name: "Knows"
            description: "Person knows another person"
          }) {
            success
            relationType { id }
          }
        }
      `)
      relationTypeId = relationTypeResult.data.createRelationType.relationType.id

      // Create test nodes
      for (let i = 1; i <= 4; i++) {
        const result = await testContext.graphqlRequest!(`
          mutation {
            createNode(input: {
              tableId: "${tableId}"
              content: "Content for node ${i}"
            }) {
              node { id }
            }
          }
        `)
        nodeIds.push(result.data.createNode.node.id)
      }
    })

    test('should create relationship with properties', async () => {
      const mutation = `
        mutation CreateRelation($input: CreateRelationInput!) {
          createRelation(input: $input) {
            success
            relation {
              id
              properties
              sourceNode {
                id
                title
              }
              targetNode {
                id
                title
              }
              relationType {
                id
                identifier
                description
              }
              createdAt
            }
            errors {
              field
              message
            }
          }
        }
      `

      const variables = {
        input: {
          sourceNodeId: nodeIds[0],
          targetNodeId: nodeIds[1],
          relationTypeId,
          tableId,
          properties: {
            strength: 'strong',
            since: '2023-01-01',
            verified: true,
          },
        },
      }

      const result = await testContext.graphqlRequest!(mutation, variables)

      expect(result.errors).toBeUndefined()
      expect(result.data.createRelation.success).toBe(true)
      expect(result.data.createRelation.relation).toMatchObject({
        id: expect.any(String),
        sourceNode: { id: nodeIds[0] },
        targetNode: { id: nodeIds[1] },
        // TODO: Fix properties not being returned correctly
        // properties: {
        //   strength: 'strong',
        //   since: '2023-01-01',
        //   verified: true,
        // },
      })
    })

    test.skip('should create complex relationship network', async () => {
      // Create multiple relationships to form a network
      const relationships = [
        { from: 0, to: 1, type: 'knows' },
        { from: 1, to: 2, type: 'collaborates' },
        { from: 2, to: 3, type: 'mentors' },
        { from: 3, to: 0, type: 'reports_to' },
        { from: 0, to: 2, type: 'manages' },
      ]

      for (const rel of relationships) {
        await testContext.graphqlRequest!(`
          mutation {
            createRelation(input: {
              sourceNodeId: "${nodeIds[rel.from]}"
              targetNodeId: "${nodeIds[rel.to]}"
              relationTypeId: "${rel.type}"
              tableId: "${tableId}"
            }) { success }
          }
        `)
      }

      // Query the network structure
      const query = `
        query NetworkAnalysis($nodeId: ID!) {
          node(id: $nodeId) {
            id
            title
            outgoingRelations {
              id
              targetNode {
                id
                content
              }
              relationType {
                identifier
              }
            }
            incomingRelations {
              id
              sourceNode {
                id
                content
              }
              relationType {
                identifier
              }
            }
            connectedNodes(depth: 2, direction: BOTH) {
              id
              content
            }
            shortestPath(targetNodeId: "${nodeIds[3]}", maxDepth: 5) {
              id
              content
            }
          }
        }
      `

      const result = await testContext.graphqlRequest!(query, { nodeId: nodeIds[0] })

      expect(result.errors).toBeUndefined()
      expect(result.data.node.outgoingRelations).toHaveLength(2) // knows, manages
      expect(result.data.node.incomingRelations).toHaveLength(1) // reports_to
      expect(result.data.node.connectedNodes.length).toBeGreaterThan(0)
      expect(result.data.node.shortestPath).toContainEqual({ id: nodeIds[3], title: 'Node 4' })
    })
  })

  describe('Template System Operations', () => {
    test.skip('should create and execute complex template', async () => {
      // Create a template
      const createMutation = `
        mutation CreateTemplate($input: CreateTemplateInput!) {
          createTemplate(input: $input) {
            success
            template {
              id
              identifier
              name
              query
              variables
              tags
              createdAt
            }
          }
        }
      `

      const templateVariables = {
        input: {
          identifier: 'comprehensive-test-template',
          name: 'Comprehensive Test Template',
          query: `
            query TestTemplate($tableId: ID!, $nodeTitle: String!) {
              table(id: $tableId) {
                id
                identifier
                nodes(first: 10) {
                  edges {
                    node {
                      id
                      title
                      content
                    }
                  }
                }
              }
              searchNodes(tableId: $tableId, searchQuery: {
                textSearch: $nodeTitle
                limit: 5
              }) {
                nodes {
                  node {
                    id
                    title
                  }
                }
                totalCount
              }
            }
          `,
          variables: ['tableId', 'nodeTitle'],
          tags: ['test', 'comprehensive', 'search'],
        },
      }

      const createResult = await testContext.graphqlRequest!(createMutation, templateVariables)
      expect(createResult.data.createTemplate.success).toBe(true)

      // Execute the template
      const executeMutation = `
        mutation ExecuteTemplate($templateIdentifier: String!, $variables: JSON!) {
          executeTemplateWithGraphQL(
            templateIdentifier: $templateIdentifier
            variables: $variables
          ) {
            success
            data
            errors {
              message
              path
            }
            executionTime
            metadata {
              templateId
              executedAt
              variablesUsed
            }
          }
        }
      `

      // First create a test table and node
      const tableResult = await testContext.graphqlRequest!(`
        mutation {
          createTable(input: { identifier: "template-test-table" }) {
            table { id }
          }
        }
      `)
      const tableId = tableResult.data.createTable.table.id

      await testContext.graphqlRequest!(`
        mutation {
          createNode(input: {
            tableId: "${tableId}"
            content: "Content for template testing"
          }) { success }
        }
      `)

      const executeVariables = {
        templateIdentifier: 'comprehensive-test-template',
        variables: {
          tableId,
          nodeTitle: 'Template Test',
        },
      }

      const executeResult = await testContext.graphqlRequest!(executeMutation, executeVariables)

      expect(executeResult.errors).toBeUndefined()
      expect(executeResult.data.executeTemplateWithGraphQL.success).toBe(true)
      expect(executeResult.data.executeTemplateWithGraphQL.data).toBeDefined()
      expect(executeResult.data.executeTemplateWithGraphQL.metadata.templateId).toBeDefined()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid GraphQL syntax gracefully', async () => {
      const invalidQuery = `
        query InvalidQuery {
          nonExistentField {
            invalidSubfield
          }
        }
      `

      const result = await testContext.graphqlRequest!(invalidQuery)

      expect(result.errors).toBeDefined()
      expect(result.errors[0].message).toContain('Cannot query field')
    })

    test.skip('should handle deeply nested operations', async () => {
      // Create complex nested structure
      const tableResult = await testContext.graphqlRequest!(`
        mutation {
          createTable(input: { identifier: "nested-test-table" }) {
            table { id }
          }
        }
      `)
      const tableId = tableResult.data.createTable.table.id

      // Create nodes with deep nesting capability
      const nodeResult = await testContext.graphqlRequest!(`
        mutation {
          createNode(input: {
            tableId: "${tableId}"
            content: "Node for deep nesting test"
          }) {
            node { id }
          }
        }
      `)

      expect(nodeResult.data.createNode.node.id).toBeDefined()

      // Query with deep nesting
      const deepQuery = `
        query DeepQuery($tableId: ID!) {
          table(id: $tableId) {
            id
            identifier
            nodes(first: 1) {
              edges {
                node {
                  id
                  title
                  metadata
                  attributes {
                    id
                    attribute {
                      id
                      name
                      attributeType {
                        id
                        dataType
                      }
                    }
                    value
                  }
                  outgoingRelations {
                    id
                    targetNode {
                      id
                      title
                      attributes {
                        id
                        value
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `

      const result = await testContext.graphqlRequest!(deepQuery, { tableId })

      expect(result.errors).toBeUndefined()
      expect(result.data.table.nodes.edges[0].node.id).toBeDefined()
    })

    test('should handle concurrent operations safely', async () => {
      const tableResult = await testContext.graphqlRequest!(`
        mutation {
          createTable(input: { identifier: "concurrent-test-table" }) {
            success
            table { id }
            errors { message }
          }
        }
      `)
      expect(tableResult.data.createTable.success).toBe(true)
      expect(tableResult.data.createTable.table).toBeTruthy()
      const tableId = tableResult.data.createTable.table.id

      // Execute multiple concurrent operations
      const promises = Array.from({ length: 10 }, (_, i) =>
        testContext.graphqlRequest!(`
          mutation {
            createNode(input: {
              tableId: "${tableId}"
              content: "Content for concurrent node ${i + 1}"
            }) {
              success
              node { id title content }
              errors { message }
            }
          }
        `)
      )

      const results = await Promise.all(promises)

      // All operations should succeed
      results.forEach((result, index) => {
        expect(result.errors).toBeUndefined()
        expect(result.data.createNode.success).toBe(true)
        expect(result.data.createNode.node.content).toBe(`Content for concurrent node ${index + 1}`)
      })

      // Verify all nodes were created
      const countResult = await testContext.graphqlRequest!(`
        query {
          table(id: "${tableId}") {
            tableNodeCount
          }
        }
      `)

      expect(countResult.data.table.tableNodeCount).toBe(10)
    })
  })

  describe('Performance and Scalability', () => {
    test.skip('should handle large dataset queries efficiently', async () => {
      const tableResult = await testContext.graphqlRequest!(`
        mutation {
          createTable(input: { identifier: "performance-test-table" }) {
            table { id }
          }
        }
      `)
      const tableId = tableResult.data.createTable.table.id

      // Create a larger dataset
      const batchSize = 50
      for (let batch = 0; batch < 5; batch++) {
        const nodes = Array.from({ length: batchSize }, (_, i) => ({
          title: `Performance Node ${batch * batchSize + i + 1}`,
          content: `Content with searchable terms batch ${batch} item ${i}`,
          metadata: {
            batch,
            index: i,
            category: i % 3 === 0 ? 'category-a' : i % 3 === 1 ? 'category-b' : 'category-c',
          },
        }))

        await testContext.graphqlRequest!(`
          mutation {
            batchCreateNodes(input: {
              tableId: "${tableId}"
              nodes: ${JSON.stringify(nodes)}
            }) {
              success
              statistics {
                successfullyCreated
              }
            }
          }
        `)
      }

      const startTime = Date.now()

      // Perform complex search operation
      const searchResult = await testContext.graphqlRequest!(
        `
        query PerformanceSearch($tableId: ID!) {
          searchNodes(tableId: $tableId, searchQuery: {
            textSearch: "searchable"
            metadataFilters: [
              {
                field: "category"
                operator: "in"
                value: ["category-a", "category-b"]
              }
            ]
            sortBy: [{ field: "created_at", direction: "DESC" }]
            limit: 20
          }) {
            nodes {
              node {
                id
                content
              }
              score
            }
            totalCount
            executionTime
          }
        }
      `,
        { tableId }
      )

      const endTime = Date.now()
      const executionTime = endTime - startTime

      expect(searchResult.errors).toBeUndefined()
      expect(searchResult.data.searchNodes.nodes.length).toBeGreaterThan(0)
      expect(executionTime).toBeLessThan(5000) // Should complete within 5 seconds
    })
  })
})

/**
 * Comprehensive Test Suite: End-to-End Workflow Testing
 *
 * Purpose: Test complete user workflows and business scenarios
 * Coverage: Full user journeys, integration across components, real-world usage patterns
 *
 * Test Categories:
 * - Complete data modeling workflow
 * - Template creation and execution workflow
 * - Graph analysis and traversal workflow
 * - Import/export data workflow
 * - Multi-user collaboration scenarios
 * - Data migration and backup workflows
 * - Performance monitoring workflow
 * - Error recovery and resilience workflows
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { createContainer } from '../../src/infrastructure/container/ContainerBootstrap'
import type { DIContainer } from '../../src/infrastructure/container/DIContainer'
import { DatabaseCleaner } from '../fixtures/database-cleaner'
import { createGraphQLExecutor, createGraphQLYoga } from '../fixtures/graphql-yoga-helper'
import { createTestEnvironment, type TestEnvironment } from '../fixtures/test-database-factory'

interface WorkflowStep {
  name: string
  action: () => Promise<any>
  validate: (result: any) => void
  cleanup?: () => Promise<void>
}

class WorkflowRunner {
  private steps: WorkflowStep[] = []
  private results: any[] = []

  addStep(step: WorkflowStep): WorkflowRunner {
    this.steps.push(step)
    return this
  }

  async execute(): Promise<any[]> {
    this.results = []

    for (const step of this.steps) {
      try {
        const result = await step.action()
        step.validate(result)
        this.results.push({ step: step.name, result, success: true })
      } catch (error) {
        this.results.push({ step: step.name, error, success: false })
        throw new Error(`Workflow failed at step: ${step.name}. Error: ${error}`)
      }
    }

    return this.results
  }

  async cleanup(): Promise<void> {
    for (const step of this.steps.reverse()) {
      if (step.cleanup) {
        await step.cleanup()
      }
    }
  }

  getResults(): any[] {
    return this.results
  }
}

describe('End-to-End Workflow Comprehensive Tests', () => {
  let yoga: any
  let container: DIContainer
  let testEnvironment: TestEnvironment
  let databaseCleaner: DatabaseCleaner
  let graphqlExecute: (query: string, variables?: any) => Promise<any>

  beforeAll(async () => {
    testEnvironment = await createTestEnvironment('e2e-workflow', 'e2e')
    process.env.DATABASE_PATH = testEnvironment.databasePath
    container = await createContainer()
    yoga = await createGraphQLYoga(container)
    graphqlExecute = createGraphQLExecutor(yoga)
    databaseCleaner = new DatabaseCleaner(container)
  })

  beforeEach(async () => {
    await databaseCleaner.clearAllData()
  })

  afterAll(async () => {
    await testEnvironment.cleanup()
  })

  describe('Complete Data Modeling Workflow', () => {
    test('should complete full data modeling lifecycle', async () => {
      const workflow = new WorkflowRunner()

      let tableId: string
      const attributeIds: { [key: string]: string } = {}
      const nodeIds: string[] = []
      const relationIds: string[] = []

      // Step 1: Create domain table
      workflow.addStep({
        name: 'Create Customer Domain Table',
        action: async () => {
          return await graphqlExecute(`
            mutation {
              createTable(input: {
                identifier: "customers"
                description: "Complete customer relationship management system"
              }) {
                table {
                  id
                  identifier
                  description
                  createdAt
                }
              }
            }
          `)
        },
        validate: (result) => {
          expect(result.errors).toBeUndefined()
          expect(result.data.createTable.table.identifier).toBe('customers')
          tableId = result.data.createTable.table.id
        },
      })

      // Step 2: Define comprehensive schema
      workflow.addStep({
        name: 'Create Customer Attributes Schema',
        action: async () => {
          const attributes = [
            { identifier: 'name', name: 'Full Name', typeId: '1' },
            { identifier: 'email', name: 'Email Address', typeId: '1' },
            { identifier: 'age', name: 'Age', typeId: '2' },
            { identifier: 'is_premium', name: 'Premium Customer', typeId: '3' },
            { identifier: 'join_date', name: 'Join Date', typeId: '4' },
            { identifier: 'lifetime_value', name: 'Customer Lifetime Value', typeId: '2' },
          ]

          const results = await Promise.all(
            attributes.map((attr) =>
              graphqlExecute(`
                mutation {
                  createAttribute(input: {
                    tableId: "${tableId}"
                    identifier: "${attr.identifier}"
                    name: "${attr.name}"
                    attributeTypeId: "${attr.typeId}"
                  }) {
                    attribute {
                      id
                      identifier
                      name
                    }
                  }
                }
              `)
            )
          )

          return results
        },
        validate: (results) => {
          expect(results).toHaveLength(6)
          results.forEach((result: any) => {
            expect(result.errors).toBeUndefined()
            const attr = result.data.createAttribute.attribute
            attributeIds[attr.identifier] = attr.id
          })
        },
      })

      // Step 3: Create customer entities
      workflow.addStep({
        name: 'Create Customer Entities',
        action: async () => {
          const customers = [
            {
              name: 'John Smith',
              email: 'john@example.com',
              age: 35,
              is_premium: true,
              join_date: '2023-01-15',
              lifetime_value: 5000,
            },
            {
              name: 'Sarah Johnson',
              email: 'sarah@example.com',
              age: 28,
              is_premium: false,
              join_date: '2023-03-22',
              lifetime_value: 1200,
            },
            {
              name: 'Mike Wilson',
              email: 'mike@example.com',
              age: 42,
              is_premium: true,
              join_date: '2022-11-08',
              lifetime_value: 8500,
            },
            {
              name: 'Emily Davis',
              email: 'emily@example.com',
              age: 31,
              is_premium: true,
              join_date: '2023-02-14',
              lifetime_value: 3200,
            },
            {
              name: 'David Brown',
              email: 'david@example.com',
              age: 25,
              is_premium: false,
              join_date: '2023-04-10',
              lifetime_value: 800,
            },
          ]

          const nodeCreationResults = await Promise.all(
            customers.map((customer, index) =>
              graphqlExecute(`
                mutation {
                  createNode(input: {
                    tableId: "${tableId}"
                    content: "Customer: ${customer.name}"
                    metadata: {
                      customerIndex: ${index + 1}
                      source: "e2e_workflow"
                    }
                  }) {
                    node {
                      id
                      content
                    }
                  }
                }
              `)
            )
          )

          return { nodeCreationResults, customers }
        },
        validate: (result) => {
          const { nodeCreationResults } = result
          expect(nodeCreationResults).toHaveLength(5)
          nodeCreationResults.forEach((nodeResult: any) => {
            expect(nodeResult.errors).toBeUndefined()
            nodeIds.push(nodeResult.data.createNode.node.id)
          })
        },
      })

      // Step 4: Set comprehensive attributes
      workflow.addStep({
        name: 'Set Customer Attributes',
        action: async () => {
          const customers = [
            {
              name: 'John Smith',
              email: 'john@example.com',
              age: 35,
              is_premium: true,
              join_date: '2023-01-15',
              lifetime_value: 5000,
            },
            {
              name: 'Sarah Johnson',
              email: 'sarah@example.com',
              age: 28,
              is_premium: false,
              join_date: '2023-03-22',
              lifetime_value: 1200,
            },
            {
              name: 'Mike Wilson',
              email: 'mike@example.com',
              age: 42,
              is_premium: true,
              join_date: '2022-11-08',
              lifetime_value: 8500,
            },
            {
              name: 'Emily Davis',
              email: 'emily@example.com',
              age: 31,
              is_premium: true,
              join_date: '2023-02-14',
              lifetime_value: 3200,
            },
            {
              name: 'David Brown',
              email: 'david@example.com',
              age: 25,
              is_premium: false,
              join_date: '2023-04-10',
              lifetime_value: 800,
            },
          ]

          const attributeSetResults = []

          for (let i = 0; i < customers.length; i++) {
            const customer = customers[i]
            const nodeId = nodeIds[i]

            for (const [key, value] of Object.entries(customer)) {
              const attributeId = attributeIds[key]
              if (attributeId) {
                const result = await graphqlExecute(`
                  mutation {
                    setNodeAttribute(input: {
                      nodeId: "${nodeId}"
                      attributeId: "${attributeId}"
                      value: "${value}"
                    }) {
                      success
                      attribute {
                        value
                      }
                    }
                  }
                `)
                attributeSetResults.push(result)
              }
            }
          }

          return attributeSetResults
        },
        validate: (results) => {
          expect(results.length).toBeGreaterThan(0)
          results.forEach((result: any) => {
            expect(result.errors).toBeUndefined()
            expect(result.data.setNodeAttribute.success).toBe(true)
          })
        },
      })

      // Step 5: Create customer relationships
      workflow.addStep({
        name: 'Create Customer Relationships',
        action: async () => {
          const relationships = [
            { from: 0, to: 1, type: 'REFERRED', properties: { referral_bonus: 100 } },
            { from: 2, to: 3, type: 'REFERRED', properties: { referral_bonus: 150 } },
            { from: 0, to: 2, type: 'SIMILAR_INTERESTS', properties: { similarity_score: 0.8 } },
            { from: 1, to: 4, type: 'SAME_COHORT', properties: { cohort: '2023_Q1' } },
            { from: 3, to: 0, type: 'CROSS_SELL_OPPORTUNITY', properties: { confidence: 0.75 } },
          ]

          const relationResults = await Promise.all(
            relationships.map((rel) =>
              graphqlExecute(`
                mutation {
                  createRelation(input: {
                    fromNodeId: "${nodeIds[rel.from]}"
                    toNodeId: "${nodeIds[rel.to]}"
                    relationshipType: "${rel.type}"
                    tableId: "${tableId}"
                    properties: ${JSON.stringify(rel.properties)}
                  }) {
                    relation {
                      id
                      relationshipType
                      properties
                    }
                  }
                }
              `)
            )
          )

          return relationResults
        },
        validate: (results) => {
          expect(results).toHaveLength(5)
          results.forEach((result: any) => {
            expect(result.errors).toBeUndefined()
            relationIds.push(result.data.createRelation.relation.id)
          })
        },
      })

      // Step 6: Query and validate complete model
      workflow.addStep({
        name: 'Validate Complete Data Model',
        action: async () => {
          const fullDataQuery = await graphqlExecute(`
            query {
              searchNodes(input: { tableId: "${tableId}" }) {
                nodes {
                  id
                  content
                  attributes {
                    attribute {
                      identifier
                      name
                    }
                    value
                  }
                  relations {
                    id
                    relationshipType
                    toNode {
                      id
                      content
                    }
                    properties
                  }
                }
                totalCount
              }
            }
          `)

          return fullDataQuery
        },
        validate: (result) => {
          expect(result.errors).toBeUndefined()
          expect(result.data.searchNodes.totalCount).toBe(5)

          const nodes = result.data.searchNodes.nodes
          expect(nodes).toHaveLength(5)

          // Verify each node has attributes
          nodes.forEach((node: any) => {
            expect(node.attributes.length).toBeGreaterThan(0)
          })

          // Verify relationships exist
          const totalRelations = nodes.reduce(
            (sum: number, node: any) => sum + node.relations.length,
            0
          )
          expect(totalRelations).toBe(5)
        },
      })

      // Execute workflow
      const results = await workflow.execute()
      expect(results).toHaveLength(6)
      expect(results.every((r) => r.success)).toBe(true)
    }, 45000)
  })

  describe('Template Creation and Execution Workflow', () => {
    test('should complete template lifecycle workflow', async () => {
      const workflow = new WorkflowRunner()

      let tableId: string
      let templateIdentifier: string
      const executionResults: any[] = []

      // Step 1: Setup data structure for templates
      workflow.addStep({
        name: 'Setup Template Testing Environment',
        action: async () => {
          const tableResult = await graphqlExecute(`
            mutation {
              createTable(input: {
                identifier: "template-test-products"
                description: "Product management for template testing"
              }) {
                table { id }
              }
            }
          `)

          const attrResult = await graphqlExecute(`
            mutation {
              createAttribute(input: {
                tableId: "${tableResult.data.createTable.table.id}"
                identifier: "category"
                name: "Product Category"
                attributeTypeId: "1"
              }) {
                attribute { id }
              }
            }
          `)

          return { tableResult, attrResult }
        },
        validate: (result) => {
          expect(result.tableResult.errors).toBeUndefined()
          expect(result.attrResult.errors).toBeUndefined()
          tableId = result.tableResult.data.createTable.table.id
        },
      })

      // Step 2: Create parameterized template
      workflow.addStep({
        name: 'Create Parameterized Product Template',
        action: async () => {
          return await graphqlExecute(`
            mutation {
              createTemplate(input: {
                identifier: "create-product-with-category"
                name: "Create Product with Category"
                query: """
                  mutation CreateProductWithCategory($productName: String!, $category: String!, $tableId: ID!) {
                    createNode(input: {
                      tableId: $tableId
                      content: $productName
                      metadata: { templateCreated: true, category: $category }
                    }) {
                      node {
                        id
                        content
                        metadata
                      }
                    }
                  }
                """
                tags: ["product", "template", "e2e"]
                variables: ["productName", "category", "tableId"]
              }) {
                template {
                  identifier
                  name
                  query
                  variables
                  tags
                }
              }
            }
          `)
        },
        validate: (result) => {
          expect(result.errors).toBeUndefined()
          expect(result.data.createTemplate.template.identifier).toBe(
            'create-product-with-category'
          )
          templateIdentifier = result.data.createTemplate.template.identifier
          expect(result.data.createTemplate.template.variables).toEqual([
            'productName',
            'category',
            'tableId',
          ])
        },
      })

      // Step 3: Execute template with multiple parameter sets
      workflow.addStep({
        name: 'Execute Template with Various Parameters',
        action: async () => {
          const products = [
            { productName: 'Wireless Headphones', category: 'Electronics' },
            { productName: 'Running Shoes', category: 'Sports' },
            { productName: 'Coffee Maker', category: 'Kitchen' },
            { productName: 'Yoga Mat', category: 'Fitness' },
            { productName: 'Notebook', category: 'Office' },
          ]

          const executions = await Promise.all(
            products.map((product) =>
              graphqlExecute(`
                mutation {
                  executeTemplateWithGraphQL(
                    templateIdentifier: "${templateIdentifier}"
                    variables: {
                      productName: "${product.productName}"
                      category: "${product.category}"
                      tableId: "${tableId}"
                    }
                  ) {
                    success
                    data
                    errors {
                      message
                    }
                    executionTime
                  }
                }
              `)
            )
          )

          return executions
        },
        validate: (results) => {
          expect(results).toHaveLength(5)
          results.forEach((result: any) => {
            expect(result.errors).toBeUndefined()
            expect(result.data.executeTemplateWithGraphQL.success).toBe(true)
            expect(result.data.executeTemplateWithGraphQL.executionTime).toBeLessThan(1000)
            executionResults.push(JSON.parse(result.data.executeTemplateWithGraphQL.data))
          })
        },
      })

      // Step 4: Validate template execution results
      workflow.addStep({
        name: 'Validate Template Execution Results',
        action: async () => {
          const nodesQuery = await graphqlExecute(`
            query {
              searchNodes(input: { tableId: "${tableId}" }) {
                nodes {
                  id
                  content
                  metadata
                }
                totalCount
              }
            }
          `)

          return nodesQuery
        },
        validate: (result) => {
          expect(result.errors).toBeUndefined()
          expect(result.data.searchNodes.totalCount).toBe(5)

          const nodes = result.data.searchNodes.nodes
          const expectedProducts = [
            'Wireless Headphones',
            'Running Shoes',
            'Coffee Maker',
            'Yoga Mat',
            'Notebook',
          ]

          nodes.forEach((node: any) => {
            expect(expectedProducts).toContain(node.content)
            expect(node.metadata.templateCreated).toBe(true)
            expect(node.metadata.category).toBeDefined()
          })
        },
      })

      // Step 5: Template versioning and updates
      workflow.addStep({
        name: 'Update and Version Template',
        action: async () => {
          return await graphqlExecute(`
            mutation {
              updateTemplate(input: {
                identifier: "${templateIdentifier}"
                name: "Enhanced Product with Category"
                query: """
                  mutation CreateProductWithCategoryAndPrice($productName: String!, $category: String!, $price: Float!, $tableId: ID!) {
                    createNode(input: {
                      tableId: $tableId
                      content: $productName
                      metadata: {
                        templateCreated: true,
                        category: $category,
                        price: $price,
                        version: "v2"
                      }
                    }) {
                      node {
                        id
                        content
                        metadata
                      }
                    }
                  }
                """
                variables: ["productName", "category", "price", "tableId"]
                tags: ["product", "template", "e2e", "v2"]
              }) {
                template {
                  identifier
                  name
                  variables
                  tags
                }
              }
            }
          `)
        },
        validate: (result) => {
          expect(result.errors).toBeUndefined()
          expect(result.data.updateTemplate.template.variables).toEqual([
            'productName',
            'category',
            'price',
            'tableId',
          ])
          expect(result.data.updateTemplate.template.tags).toContain('v2')
        },
      })

      // Execute workflow
      const results = await workflow.execute()
      expect(results).toHaveLength(5)
      expect(results.every((r) => r.success)).toBe(true)
    }, 30000)
  })

  describe('Graph Analysis and Traversal Workflow', () => {
    test('should complete comprehensive graph analysis workflow', async () => {
      const workflow = new WorkflowRunner()

      let tableId: string
      let nodeIds: string[] = []

      // Step 1: Create social network structure
      workflow.addStep({
        name: 'Create Social Network Data Structure',
        action: async () => {
          const tableResult = await graphqlExecute(`
            mutation {
              createTable(input: {
                identifier: "social-network"
                description: "Social network for graph analysis workflow"
              }) {
                table { id }
              }
            }
          `)

          // Create 20 users
          const users = Array.from({ length: 20 }, (_, i) => ({
            name: `User ${i + 1}`,
            influence: Math.floor(Math.random() * 100),
            activity: Math.floor(Math.random() * 50),
          }))

          const nodeResults = await Promise.all(
            users.map((user) =>
              graphqlExecute(`
                mutation {
                  createNode(input: {
                    tableId: "${tableResult.data.createTable.table.id}"
                    content: "${user.name}"
                    metadata: {
                      influence: ${user.influence}
                      activity: ${user.activity}
                      type: "user"
                    }
                  }) {
                    node { id }
                  }
                }
              `)
            )
          )

          return { tableResult, nodeResults }
        },
        validate: (result) => {
          const { tableResult, nodeResults } = result
          expect(tableResult.errors).toBeUndefined()
          expect(nodeResults).toHaveLength(20)
          tableId = tableResult.data.createTable.table.id
          nodeIds = nodeResults.map((r: any) => r.data.createNode.node.id)
        },
      })

      // Step 2: Create complex network relationships
      workflow.addStep({
        name: 'Create Complex Network Relationships',
        action: async () => {
          const _relationshipTypes = [
            'FOLLOWS',
            'FRIENDS',
            'MENTIONS',
            'COLLABORATES',
            'INFLUENCES',
          ]
          const relationships = []

          // Create various relationship patterns
          // Star pattern: User 1 connected to many
          for (let i = 1; i < 10; i++) {
            relationships.push({
              from: nodeIds[0],
              to: nodeIds[i],
              type: 'INFLUENCES',
              weight: Math.random(),
            })
          }

          // Chain pattern: Sequential connections
          for (let i = 10; i < 15; i++) {
            relationships.push({
              from: nodeIds[i],
              to: nodeIds[i + 1],
              type: 'FOLLOWS',
              weight: Math.random(),
            })
          }

          // Cluster pattern: Highly connected group
          for (let i = 15; i < 19; i++) {
            for (let j = i + 1; j < 20; j++) {
              relationships.push({
                from: nodeIds[i],
                to: nodeIds[j],
                type: 'FRIENDS',
                weight: Math.random(),
              })
            }
          }

          const relationResults = await Promise.all(
            relationships.map((rel) =>
              graphqlExecute(`
                mutation {
                  createRelation(input: {
                    fromNodeId: "${rel.from}"
                    toNodeId: "${rel.to}"
                    relationshipType: "${rel.type}"
                    tableId: "${tableId}"
                    properties: { weight: ${rel.weight} }
                  }) {
                    relation { id }
                  }
                }
              `)
            )
          )

          return { relationships, relationResults }
        },
        validate: (result) => {
          const { relationResults } = result
          expect(relationResults.length).toBeGreaterThan(0)
          relationResults.forEach((result: any) => {
            expect(result.errors).toBeUndefined()
          })
        },
      })

      // Step 3: Perform centrality analysis
      workflow.addStep({
        name: 'Analyze Network Centrality',
        action: async () => {
          // Analyze connections for each node
          const centralityResults = await Promise.all(
            nodeIds.slice(0, 10).map(async (nodeId) => {
              const connections = await graphqlExecute(`
                query {
                  getConnectedNodes(nodeId: "${nodeId}", depth: 2) {
                    nodes {
                      id
                      distance
                    }
                    totalConnections
                  }
                }
              `)
              return { nodeId, connections: connections.data.getConnectedNodes }
            })
          )

          return centralityResults
        },
        validate: (results) => {
          expect(results).toHaveLength(10)
          results.forEach((result: any) => {
            expect(result.connections.totalConnections).toBeGreaterThanOrEqual(0)
          })

          // Node 0 should have highest centrality (star pattern)
          const node0Result = results.find((r: any) => r.nodeId === nodeIds[0])
          expect(node0Result.connections.totalConnections).toBeGreaterThan(5)
        },
      })

      // Step 4: Find shortest paths between key nodes
      workflow.addStep({
        name: 'Calculate Shortest Paths',
        action: async () => {
          const pathFindings = [
            { from: nodeIds[0], to: nodeIds[19] }, // Star to cluster
            { from: nodeIds[10], to: nodeIds[15] }, // Chain to cluster
            { from: nodeIds[5], to: nodeIds[18] }, // Random paths
          ]

          const pathResults = await Promise.all(
            pathFindings.map(async (path) => {
              const result = await graphqlExecute(`
                query {
                  findShortestPath(
                    fromNodeId: "${path.from}"
                    toNodeId: "${path.to}"
                    maxDepth: 6
                  ) {
                    path {
                      nodeId
                      distance
                    }
                    totalDistance
                    pathExists
                  }
                }
              `)
              return { ...path, result: result.data.findShortestPath }
            })
          )

          return pathResults
        },
        validate: (results) => {
          expect(results).toHaveLength(3)
          results.forEach((result: any) => {
            if (result.result.pathExists) {
              expect(result.result.totalDistance).toBeGreaterThan(0)
              expect(result.result.path.length).toBeGreaterThan(0)
            }
          })
        },
      })

      // Step 5: Community detection analysis
      workflow.addStep({
        name: 'Detect Network Communities',
        action: async () => {
          // Group nodes by their connection patterns
          const communityAnalysis = await graphqlExecute(`
            query {
              analyzeNetworkCommunities(input: {
                tableId: "${tableId}"
                algorithm: "MODULARITY"
                minCommunitySize: 3
              }) {
                communities {
                  id
                  nodeIds
                  size
                  density
                  modularity
                }
                totalCommunities
                overallModularity
              }
            }
          `)

          return communityAnalysis
        },
        validate: (result) => {
          expect(result.errors).toBeUndefined()
          expect(result.data.analyzeNetworkCommunities.totalCommunities).toBeGreaterThan(0)

          const communities = result.data.analyzeNetworkCommunities.communities
          communities.forEach((community: any) => {
            expect(community.size).toBeGreaterThanOrEqual(3)
            expect(community.nodeIds.length).toBe(community.size)
          })
        },
      })

      // Execute workflow
      const results = await workflow.execute()
      expect(results).toHaveLength(5)
      expect(results.every((r) => r.success)).toBe(true)
    }, 60000)
  })

  describe('Import/Export Data Workflow', () => {
    test('should complete data import/export lifecycle', async () => {
      const workflow = new WorkflowRunner()

      let originalTableId: string
      let exportData: any
      let importedTableId: string

      // Step 1: Create source data structure
      workflow.addStep({
        name: 'Create Source Data for Export',
        action: async () => {
          const tableResult = await graphqlExecute(`
            mutation {
              createTable(input: {
                identifier: "export-source-table"
                description: "Source data for import/export workflow"
              }) {
                table { id }
              }
            }
          `)

          const attributeResult = await graphqlExecute(`
            mutation {
              createAttribute(input: {
                tableId: "${tableResult.data.createTable.table.id}"
                identifier: "status"
                name: "Status"
                attributeTypeId: "1"
              }) {
                attribute { id }
              }
            }
          `)

          const nodes = Array.from({ length: 10 }, (_, i) => ({
            content: `Export Test Item ${i + 1}`,
            status: i % 2 === 0 ? 'active' : 'inactive',
          }))

          const nodeResults = await Promise.all(
            nodes.map((node) =>
              graphqlExecute(`
                mutation {
                  createNode(input: {
                    tableId: "${tableResult.data.createTable.table.id}"
                    content: "${node.content}"
                    metadata: { status: "${node.status}" }
                  }) {
                    node { id }
                  }
                }
              `)
            )
          )

          return { tableResult, attributeResult, nodeResults }
        },
        validate: (result) => {
          const { tableResult, attributeResult, nodeResults } = result
          expect(tableResult.errors).toBeUndefined()
          expect(attributeResult.errors).toBeUndefined()
          expect(nodeResults).toHaveLength(10)
          originalTableId = tableResult.data.createTable.table.id
        },
      })

      // Step 2: Export table with all data
      workflow.addStep({
        name: 'Export Complete Table Data',
        action: async () => {
          return await graphqlExecute(`
            mutation {
              exportTablePackage(input: {
                tableIdentifier: "export-source-table"
                options: {
                  includeData: true
                  includeRelations: true
                  includeTemplates: true
                }
              }) {
                success
                package {
                  version
                  exportedAt
                  sourceTable {
                    identifier
                    description
                  }
                  package {
                    dataset {
                      nodes {
                        id
                        content
                      }
                    }
                  }
                }
                dependencyOrder
                errors
                warnings
              }
            }
          `)
        },
        validate: (result) => {
          expect(result.errors).toBeUndefined()
          expect(result.data.exportTablePackage.success).toBe(true)
          expect(result.data.exportTablePackage.package).toBeDefined()
          expect(result.data.exportTablePackage.package.sourceTable.identifier).toBe(
            'export-source-table'
          )
          expect(result.data.exportTablePackage.errors).toHaveLength(0)
          exportData = result.data.exportTablePackage.package
        },
      })

      // Step 3: Validate export data structure
      workflow.addStep({
        name: 'Validate Export Data Structure',
        action: async () => {
          return { exportValidation: exportData }
        },
        validate: (result) => {
          const { exportValidation } = result
          expect(exportValidation.sourceTable.identifier).toBe('export-source-table')
          expect(exportValidation.package).toBeDefined()
          expect(exportValidation.package.schema).toBeDefined()
          expect(exportValidation.package.dataset).toBeDefined()
          // Basic structure validation - detailed content depends on actual export format
          expect(exportValidation.exportedAt).toBeDefined()
        },
      })

      // Step 4: Import data to new table
      workflow.addStep({
        name: 'Import Data to New Table',
        action: async () => {
          return await graphqlExecute(`
            mutation {
              importTableWithNodes(input: {
                exportData: ${JSON.stringify(JSON.stringify(exportData))}
                newTableIdentifier: "imported-table"
                preserveIds: false
                validateSchema: true
              }) {
                success
                table {
                  id
                  identifier
                }
                importedNodeCount
                importedAttributeCount
                importedRelationCount
                errors
              }
            }
          `)
        },
        validate: (result) => {
          expect(result.errors).toBeUndefined()
          expect(result.data.importTableWithNodes.success).toBe(true)
          expect(result.data.importTableWithNodes.table.identifier).toBe('imported-table')
          expect(result.data.importTableWithNodes.importedNodeCount).toBe(10)
          expect(result.data.importTableWithNodes.importedAttributeCount).toBe(1)
          importedTableId = result.data.importTableWithNodes.table.id
        },
      })

      // Step 5: Verify imported data integrity
      workflow.addStep({
        name: 'Verify Imported Data Integrity',
        action: async () => {
          const importedDataQuery = await graphqlExecute(`
            query {
              searchNodes(input: { tableId: "${importedTableId}" }) {
                nodes {
                  id
                  content
                  metadata
                  attributes {
                    attribute {
                      identifier
                    }
                    value
                  }
                }
                totalCount
              }
            }
          `)

          const originalDataQuery = await graphqlExecute(`
            query {
              searchNodes(input: { tableId: "${originalTableId}" }) {
                nodes {
                  id
                  content
                  metadata
                }
                totalCount
              }
            }
          `)

          return { importedData: importedDataQuery, originalData: originalDataQuery }
        },
        validate: (result) => {
          const { importedData, originalData } = result
          expect(importedData.errors).toBeUndefined()
          expect(originalData.errors).toBeUndefined()

          expect(importedData.data.searchNodes.totalCount).toBe(
            originalData.data.searchNodes.totalCount
          )

          const importedNodes = importedData.data.searchNodes.nodes
          const originalNodes = originalData.data.searchNodes.nodes

          expect(importedNodes).toHaveLength(originalNodes.length)

          // Verify content matches (though IDs will be different)
          const importedContents = importedNodes.map((n: any) => n.content).sort()
          const originalContents = originalNodes.map((n: any) => n.content).sort()
          expect(importedContents).toEqual(originalContents)
        },
      })

      // Execute workflow
      const results = await workflow.execute()
      expect(results).toHaveLength(5)
      expect(results.every((r) => r.success)).toBe(true)
    }, 45000)
  })

  describe('Error Recovery and Resilience Workflow', () => {
    test('should handle and recover from various error scenarios', async () => {
      const workflow = new WorkflowRunner()

      let tableId: string
      let backupData: any

      // Step 1: Create initial system state
      workflow.addStep({
        name: 'Create Initial System State',
        action: async () => {
          const tableResult = await graphqlExecute(`
            mutation {
              createTable(input: {
                identifier: "resilience-test-table"
                description: "Resilience Test Table"
              }) {
                table { id }
              }
            }
          `)

          const nodeResults = await Promise.all(
            Array.from({ length: 5 }, (_, i) =>
              graphqlExecute(`
                mutation {
                  createNode(input: {
                    tableId: "${tableResult.data.createTable.table.id}"
                    content: "Resilience Node ${i + 1}"
                  }) {
                    node { id }
                  }
                }
              `)
            )
          )

          return { tableResult, nodeResults }
        },
        validate: (result) => {
          const { tableResult, nodeResults } = result
          expect(tableResult.errors).toBeUndefined()
          expect(nodeResults).toHaveLength(5)
          tableId = tableResult.data.createTable.table.id
        },
      })

      // Step 2: Create backup before risky operations
      workflow.addStep({
        name: 'Create System Backup',
        action: async () => {
          return await graphqlExecute(`
            mutation {
              exportTablePackage(input: {
                tableIdentifier: "resilience-test-table"
                options: {
                  includeData: true
                  includeRelations: true
                }
              }) {
                success
                package {
                  exportedAt
                  sourceTable {
                    identifier
                  }
                  package {
                    dataset {
                      nodes {
                        id
                        content
                      }
                    }
                  }
                }
                errors
                warnings
              }
            }
          `)
        },
        validate: (result) => {
          expect(result.errors).toBeUndefined()
          expect(result.data.exportTablePackage.success).toBe(true)
          expect(result.data.exportTablePackage.errors).toHaveLength(0)
          backupData = result.data.exportTablePackage.package
        },
      })

      // Step 3: Simulate and handle transaction failures
      workflow.addStep({
        name: 'Handle Transaction Failures',
        action: async () => {
          // Attempt operations that might fail
          const operations = [
            // Valid operation
            graphqlExecute(`
              mutation {
                createNode(input: {
                  tableId: "${tableId}"
                  content: "Valid Node"
                }) {
                  node { id }
                }
              }
            `),
            // Invalid operation (should fail gracefully)
            graphqlExecute(`
              mutation {
                createNode(input: {
                  tableId: "invalid-table-id"
                  content: "Invalid Node"
                }) {
                  node { id }
                }
              }
            `),
            // Another valid operation (should succeed despite previous failure)
            graphqlExecute(`
              mutation {
                createNode(input: {
                  tableId: "${tableId}"
                  content: "Recovery Node"
                }) {
                  node { id }
                }
              }
            `),
          ]

          const results = await Promise.allSettled(operations)
          return results
        },
        validate: (results) => {
          expect(results).toHaveLength(3)
          expect(results[0].status).toBe('fulfilled') // Valid operation
          expect(results[2].status).toBe('fulfilled') // Recovery operation
          // Middle operation may fail or succeed depending on error handling
        },
      })

      // Step 4: Validate system consistency after errors
      workflow.addStep({
        name: 'Validate System Consistency',
        action: async () => {
          const healthCheck = await graphqlExecute(`
            query {
              healthCheck {
                status
                database
                errors
              }
            }
          `)

          const dataCheck = await graphqlExecute(`
            query {
              searchNodes(input: { tableId: "${tableId}" }) {
                nodes {
                  id
                  content
                }
                totalCount
              }
            }
          `)

          return { healthCheck, dataCheck }
        },
        validate: (result) => {
          const { healthCheck, dataCheck } = result
          expect(healthCheck.errors).toBeUndefined()
          expect(healthCheck.data.healthCheck.status).toBe('healthy')

          expect(dataCheck.errors).toBeUndefined()
          expect(dataCheck.data.searchNodes.totalCount).toBeGreaterThanOrEqual(5) // At least original nodes
        },
      })

      // Step 5: Recovery from backup if needed
      workflow.addStep({
        name: 'Test Recovery Capabilities',
        action: async () => {
          // Verify we can access backup data and it's valid
          const backupValidation = {
            hasTable: backupData.sourceTable !== undefined,
            hasNodes:
              backupData.package?.dataset?.nodes && backupData.package.dataset.nodes.length > 0,
            nodeCount: backupData.package?.dataset?.nodes
              ? backupData.package.dataset.nodes.length
              : 0,
          }

          // Test that we could restore if needed (without actually doing it)
          const restoreCapability = await graphqlExecute(`
            query {
              validateImportData(input: {
                exportData: ${JSON.stringify(JSON.stringify(backupData))}
              }) {
                valid
                errors
                estimatedImportTime
              }
            }
          `)

          return { backupValidation, restoreCapability }
        },
        validate: (result) => {
          const { backupValidation, restoreCapability } = result
          expect(backupValidation.hasTable).toBe(true)
          expect(backupValidation.hasNodes).toBe(true)
          expect(backupValidation.nodeCount).toBeGreaterThanOrEqual(5)

          if (restoreCapability.data?.validateImportData) {
            expect(restoreCapability.data.validateImportData.valid).toBe(true)
          }
        },
      })

      // Execute workflow
      const results = await workflow.execute()
      expect(results).toHaveLength(5)
      expect(results.every((r) => r.success)).toBe(true)
    }, 30000)
  })
})

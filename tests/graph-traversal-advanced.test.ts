/**
 * Advanced Graph Traversal and Search Test Suite
 * Comprehensive tests for graph traversal algorithms and advanced search functionality
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createRequestHelper, startServerForSuite, stopServerForSuite } from './fixtures/test-graphql-server'

const SUITE_NAME = 'graph-traversal-advanced'
const TEST_TIMEOUT = 30000

// Global test server
let graphqlRequest: (query: string, variables?: Record<string, any>) => Promise<any>

describe('🔍 Advanced Graph Traversal and Search Test Suite', () => {
  beforeAll(async () => {
    console.log('🚀 Starting isolated GraphQL server for Graph Traversal tests...')

    // Start isolated server with dedicated database
    const server = await startServerForSuite(SUITE_NAME)
    console.log(`✅ Server started at: ${server.url}`)
    console.log(`📁 Database path: ${server.database.databasePath}`)

    // Create request helper
    graphqlRequest = createRequestHelper(SUITE_NAME)

    // Verify server is working and set up test data
    await setupTestData()
    console.log('✅ Test data setup completed')
  }, TEST_TIMEOUT)

  afterAll(async () => {
    console.log('🧹 Cleaning up isolated test environment...')
    await stopServerForSuite(SUITE_NAME)
    console.log('✅ Cleanup completed')
  }, TEST_TIMEOUT)

  /**
   * Setup test data for graph traversal tests
   * Creates a network: Person -> Knows -> Person, Company -> Employs -> Person
   */
  async function setupTestData() {
    // Create tables
    const createPersonTable = await graphqlRequest(`
      mutation {
        createTable(input: { identifier: "persons", description: "Person entities" }) {
          success
          table { id identifier }
        }
      }
    `)

    const createCompanyTable = await graphqlRequest(`
      mutation {
        createTable(input: { identifier: "companies", description: "Company entities" }) {
          success
          table { id identifier }
        }
      }
    `)

    const personTableId = createPersonTable.data.createTable.table.id
    const companyTableId = createCompanyTable.data.createTable.table.id

    // Create attributes for persons
    await graphqlRequest(`
      mutation {
        createAttribute(input: {
          tableId: "${personTableId}"
          identifier: "name"
          name: "Full Name"
          attributeTypeId: "1"
        }) { success }
      }
    `)

    await graphqlRequest(`
      mutation {
        createAttribute(input: {
          tableId: "${personTableId}"
          identifier: "age"
          name: "Age"
          attributeTypeId: "2"
        }) { success }
      }
    `)

    // Create attributes for companies
    await graphqlRequest(`
      mutation {
        createAttribute(input: {
          tableId: "${companyTableId}"
          identifier: "company_name"
          name: "Company Name"
          attributeTypeId: "1"
        }) { success }
      }
    `)

    // Create person nodes
    const createAlice = await graphqlRequest(`
      mutation {
        createNode(input: { tableId: "${personTableId}" content: "Alice Profile" title: "Alice" }) {
          success
          node { id }
        }
      }
    `)

    const createBob = await graphqlRequest(`
      mutation {
        createNode(input: { tableId: "${personTableId}" content: "Bob Profile" title: "Bob" }) {
          success
          node { id }
        }
      }
    `)

    const createCharlie = await graphqlRequest(`
      mutation {
        createNode(input: { tableId: "${personTableId}" content: "Charlie Profile" title: "Charlie" }) {
          success
          node { id }
        }
      }
    `)

    // Create company node
    const createTechCorp = await graphqlRequest(`
      mutation {
        createNode(input: { tableId: "${companyTableId}" content: "Tech Corporation" title: "TechCorp" }) {
          success
          node { id }
        }
      }
    `)

    const aliceId = createAlice.data.createNode.node.id
    const bobId = createBob.data.createNode.node.id
    const charlieId = createCharlie.data.createNode.node.id
    const techCorpId = createTechCorp.data.createNode.node.id

    // Set attributes
    await graphqlRequest(`
      mutation {
        setNodeAttribute(input: { nodeId: "${aliceId}" attributeId: "name" value: "Alice Smith" }) { success }
      }
    `)

    await graphqlRequest(`
      mutation {
        setNodeAttribute(input: { nodeId: "${aliceId}" attributeId: "age" value: "30" }) { success }
      }
    `)

    await graphqlRequest(`
      mutation {
        setNodeAttribute(input: { nodeId: "${bobId}" attributeId: "name" value: "Bob Johnson" }) { success }
      }
    `)

    await graphqlRequest(`
      mutation {
        setNodeAttribute(input: { nodeId: "${bobId}" attributeId: "age" value: "25" }) { success }
      }
    `)

    await graphqlRequest(`
      mutation {
        setNodeAttribute(input: { nodeId: "${charlieId}" attributeId: "name" value: "Charlie Brown" }) { success }
      }
    `)

    await graphqlRequest(`
      mutation {
        setNodeAttribute(input: { nodeId: "${charlieId}" attributeId: "age" value: "35" }) { success }
      }
    `)

    await graphqlRequest(`
      mutation {
        setNodeAttribute(input: { nodeId: "${techCorpId}" attributeId: "company_name" value: "Tech Corporation Inc" }) { success }
      }
    `)

    // Create relation types
    await graphqlRequest(`
      mutation {
        createRelationType(input: { identifier: "knows", description: "Person knows another person" }) {
          success
          relationType { id }
        }
      }
    `)

    await graphqlRequest(`
      mutation {
        createRelationType(input: { identifier: "employs", description: "Company employs person" }) {
          success
          relationType { id }
        }
      }
    `)

    // Create relationships: Alice knows Bob, Bob knows Charlie, TechCorp employs Alice and Bob
    await graphqlRequest(`
      mutation {
        createRelation(input: {
          fromNodeId: "${aliceId}"
          toNodeId: "${bobId}"
          relationshipType: "knows"
        }) { success }
      }
    `)

    await graphqlRequest(`
      mutation {
        createRelation(input: {
          fromNodeId: "${bobId}"
          toNodeId: "${charlieId}"
          relationshipType: "knows"
        }) { success }
      }
    `)

    await graphqlRequest(`
      mutation {
        createRelation(input: {
          fromNodeId: "${techCorpId}"
          toNodeId: "${aliceId}"
          relationshipType: "employs"
        }) { success }
      }
    `)

    await graphqlRequest(`
      mutation {
        createRelation(input: {
          fromNodeId: "${techCorpId}"
          toNodeId: "${bobId}"
          relationshipType: "employs"
        }) { success }
      }
    `)

    // Store IDs for later use
    global.testData = {
      personTableId,
      companyTableId,
      aliceId,
      bobId,
      charlieId,
      techCorpId,
    }
  }

  describe('🎯 Graph Traversal - Connected Nodes', () => {
    test('connectedNodes - Basic connectivity with depth control', async () => {
      const query = `
        query GetConnectedNodes($nodeId: ID!, $depth: Int, $direction: String) {
          node(id: $nodeId) {
            id
            title
            connectedNodes(depth: $depth, direction: $direction) {
              id
              title
              content
            }
          }
        }
      `

      const result = await graphqlRequest(query, {
        nodeId: global.testData.aliceId,
        depth: 1,
        direction: 'OUTGOING',
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.node.connectedNodes).toBeDefined()
      expect(Array.isArray(result.data.node.connectedNodes)).toBe(true)
      // Alice should be connected to Bob (depth 1 outgoing)
      expect(result.data.node.connectedNodes.some((node) => node.title === 'Bob')).toBe(true)
    })

    test('connectedNodes - Deep traversal with multiple hops', async () => {
      const query = `
        query GetConnectedNodesDeep($nodeId: ID!) {
          node(id: $nodeId) {
            id
            title
            connectedNodes(depth: 2, direction: "OUTGOING") {
              id
              title
            }
          }
        }
      `

      const result = await graphqlRequest(query, {
        nodeId: global.testData.aliceId,
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.node.connectedNodes).toBeDefined()
      // Alice -> Bob -> Charlie (depth 2) should include both Bob and Charlie
      const connectedTitles = result.data.node.connectedNodes.map((node) => node.title)
      expect(connectedTitles).toContain('Bob')
      expect(connectedTitles).toContain('Charlie')
    })

    test('connectedNodes - Bidirectional traversal', async () => {
      const query = `
        query GetConnectedNodesBoth($nodeId: ID!) {
          node(id: $nodeId) {
            id
            title
            connectedNodes(depth: 1, direction: "BOTH") {
              id
              title
            }
          }
        }
      `

      const result = await graphqlRequest(query, {
        nodeId: global.testData.bobId,
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.node.connectedNodes).toBeDefined()
      // Bob should be connected to Alice (incoming) and Charlie (outgoing) and TechCorp (incoming)
      const connectedTitles = result.data.node.connectedNodes.map((node) => node.title)
      expect(connectedTitles).toContain('Alice')
      expect(connectedTitles).toContain('Charlie')
      expect(connectedTitles).toContain('TechCorp')
    })
  })

  describe('🛤️ Graph Traversal - Shortest Path', () => {
    test('shortestPath - Direct connection', async () => {
      const query = `
        query GetShortestPath($sourceId: ID!, $targetId: ID!) {
          node(id: $sourceId) {
            id
            title
            shortestPath(targetNodeId: $targetId) {
              id
              title
              content
            }
          }
        }
      `

      const result = await graphqlRequest(query, {
        sourceId: global.testData.aliceId,
        targetId: global.testData.bobId,
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.node.shortestPath).toBeDefined()
      expect(Array.isArray(result.data.node.shortestPath)).toBe(true)
      // Path should include Alice and Bob
      const pathTitles = result.data.node.shortestPath.map((node) => node.title)
      expect(pathTitles).toContain('Alice')
      expect(pathTitles).toContain('Bob')
    })

    test('shortestPath - Multi-hop path', async () => {
      const query = `
        query GetShortestPathMultiHop($sourceId: ID!, $targetId: ID!) {
          node(id: $sourceId) {
            id
            title
            shortestPath(targetNodeId: $targetId, maxDepth: 3) {
              id
              title
            }
          }
        }
      `

      const result = await graphqlRequest(query, {
        sourceId: global.testData.aliceId,
        targetId: global.testData.charlieId,
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.node.shortestPath).toBeDefined()
      // Path from Alice to Charlie should go through Bob
      const pathTitles = result.data.node.shortestPath.map((node) => node.title)
      expect(pathTitles).toContain('Alice')
      expect(pathTitles).toContain('Bob')
      expect(pathTitles).toContain('Charlie')
    })

    test('shortestPath - No path exists', async () => {
      // Create isolated node
      const createIsolated = await graphqlRequest(`
        mutation {
          createNode(input: { tableId: "${global.testData.personTableId}" content: "Isolated" title: "Isolated" }) {
            success
            node { id }
          }
        }
      `)

      const isolatedId = createIsolated.data.createNode.node.id

      const query = `
        query GetShortestPathNone($sourceId: ID!, $targetId: ID!) {
          node(id: $sourceId) {
            id
            shortestPath(targetNodeId: $targetId) {
              id
            }
          }
        }
      `

      const result = await graphqlRequest(query, {
        sourceId: global.testData.aliceId,
        targetId: isolatedId,
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.node.shortestPath).toBeDefined()
      // Should be empty array when no path exists
      expect(result.data.node.shortestPath).toEqual([])
    })
  })

  describe('🔗 Relationship-Type Filtering', () => {
    test('neighborsByRelationType - Filter by specific relation type', async () => {
      const query = `
        query GetNeighborsByRelationType($nodeId: ID!, $relationTypes: [String!]) {
          node(id: $nodeId) {
            id
            title
            neighborsByRelationType(relationTypes: $relationTypes, direction: "OUTGOING") {
              id
              title
            }
          }
        }
      `

      const result = await graphqlRequest(query, {
        nodeId: global.testData.techCorpId,
        relationTypes: ['employs'],
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.node.neighborsByRelationType).toBeDefined()
      // TechCorp employs Alice and Bob
      const neighborTitles = result.data.node.neighborsByRelationType.map((node) => node.title)
      expect(neighborTitles).toContain('Alice')
      expect(neighborTitles).toContain('Bob')
      expect(neighborTitles).not.toContain('Charlie') // Not employed by TechCorp
    })

    test('connectedNodes - Filter by relation types', async () => {
      const query = `
        query GetConnectedNodesByType($nodeId: ID!) {
          node(id: $nodeId) {
            id
            title
            connectedNodes(depth: 1, direction: "OUTGOING", relationTypes: ["knows"]) {
              id
              title
            }
          }
        }
      `

      const result = await graphqlRequest(query, {
        nodeId: global.testData.aliceId,
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.node.connectedNodes).toBeDefined()
      // Alice knows Bob but doesn't employ anyone
      const connectedTitles = result.data.node.connectedNodes.map((node) => node.title)
      expect(connectedTitles).toContain('Bob')
      expect(connectedTitles).not.toContain('TechCorp')
    })
  })

  describe('🔍 Advanced Search Features', () => {
    test('searchNodes - Text search with faceted filtering', async () => {
      const query = `
        query SearchNodesAdvanced($tableId: ID!, $searchQuery: SearchQueryInput!) {
          searchNodes(tableId: $tableId, searchQuery: $searchQuery) {
            nodes {
              node {
                id
                title
                content
              }
              attributes
            }
            totalCount
            hasNextPage
          }
        }
      `

      const result = await graphqlRequest(query, {
        tableId: global.testData.personTableId,
        searchQuery: {
          textSearch: 'Alice',
          conditions: [
            {
              logicalOperator: 'AND',
              filters: [
                {
                  field: 'age',
                  operator: 'gte',
                  value: '25',
                },
              ],
            },
          ],
          sortBy: [
            {
              field: 'created_at',
              direction: 'DESC',
            },
          ],
          limit: 10,
          offset: 0,
        },
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.searchNodes).toBeDefined()
      expect(result.data.searchNodes.nodes).toBeDefined()
      // Should find Alice (contains "Alice" and age >= 25)
      const foundNodes = result.data.searchNodes.nodes
      expect(foundNodes.some((item) => item.node.title === 'Alice')).toBe(true)
    })

    test('searchNodes - Range queries and multiple operators', async () => {
      const query = `
        query SearchNodesRange($tableId: ID!, $searchQuery: SearchQueryInput!) {
          searchNodes(tableId: $tableId, searchQuery: $searchQuery) {
            nodes {
              node {
                id
                title
              }
              attributes
            }
            totalCount
          }
        }
      `

      const result = await graphqlRequest(query, {
        tableId: global.testData.personTableId,
        searchQuery: {
          conditions: [
            {
              logicalOperator: 'AND',
              filters: [
                {
                  field: 'age',
                  operator: 'range',
                  value: { min: '20', max: '32' },
                },
              ],
            },
          ],
          limit: 10,
        },
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.searchNodes.nodes).toBeDefined()
      // Should find Alice (30) and Bob (25), but not Charlie (35)
      const foundTitles = result.data.searchNodes.nodes.map((item) => item.node.title)
      expect(foundTitles).toContain('Alice')
      expect(foundTitles).toContain('Bob')
      expect(foundTitles).not.toContain('Charlie')
    })

    test('searchNodes - Complex boolean logic with multiple conditions', async () => {
      const query = `
        query SearchNodesComplex($tableId: ID!, $searchQuery: SearchQueryInput!) {
          searchNodes(tableId: $tableId, searchQuery: $searchQuery) {
            nodes {
              node {
                id
                title
              }
            }
          }
        }
      `

      const result = await graphqlRequest(query, {
        tableId: global.testData.personTableId,
        searchQuery: {
          conditions: [
            {
              logicalOperator: 'OR',
              filters: [
                {
                  field: 'name',
                  operator: 'contains',
                  value: 'Alice',
                },
                {
                  field: 'name',
                  operator: 'contains',
                  value: 'Bob',
                },
              ],
            },
            {
              logicalOperator: 'AND',
              filters: [
                {
                  field: 'age',
                  operator: 'lt',
                  value: '32',
                },
              ],
            },
          ],
          limit: 10,
        },
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.searchNodes.nodes).toBeDefined()
      // Should find Bob (name contains "Bob" and age < 32) and Alice (name contains "Alice" and age < 32)
      const foundTitles = result.data.searchNodes.nodes.map((item) => item.node.title)
      expect(foundTitles).toContain('Alice')
      expect(foundTitles).toContain('Bob')
    })
  })

  describe('📊 Performance and Edge Cases', () => {
    test('connectedNodes - Large depth handling', async () => {
      const query = `
        query GetConnectedNodesLargeDepth($nodeId: ID!) {
          node(id: $nodeId) {
            id
            connectedNodes(depth: 10, direction: "BOTH") {
              id
              title
            }
          }
        }
      `

      const result = await graphqlRequest(query, {
        nodeId: global.testData.aliceId,
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.node.connectedNodes).toBeDefined()
      // Should handle large depth without errors, even if network is small
      expect(Array.isArray(result.data.node.connectedNodes)).toBe(true)
    })

    test('shortestPath - Self-reference', async () => {
      const query = `
        query GetShortestPathSelf($nodeId: ID!) {
          node(id: $nodeId) {
            id
            shortestPath(targetNodeId: $nodeId) {
              id
            }
          }
        }
      `

      const result = await graphqlRequest(query, {
        nodeId: global.testData.aliceId,
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.node.shortestPath).toBeDefined()
      // Path to self should contain only the source node
      expect(result.data.node.shortestPath).toHaveLength(1)
      expect(result.data.node.shortestPath[0].id).toBe(global.testData.aliceId)
    })

    test('searchNodes - Empty result handling', async () => {
      const query = `
        query SearchNodesEmpty($tableId: ID!, $searchQuery: SearchQueryInput!) {
          searchNodes(tableId: $tableId, searchQuery: $searchQuery) {
            nodes {
              node { id }
            }
            totalCount
            hasNextPage
          }
        }
      `

      const result = await graphqlRequest(query, {
        tableId: global.testData.personTableId,
        searchQuery: {
          textSearch: 'NonExistentContent12345',
          limit: 10,
        },
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.searchNodes.nodes).toEqual([])
      expect(result.data.searchNodes.totalCount).toBe(0)
      expect(result.data.searchNodes.hasNextPage).toBe(false)
    })
  })

  describe('❌ Error Handling and Validation', () => {
    test('connectedNodes - Invalid node ID', async () => {
      const query = `
        query GetConnectedNodesInvalid($nodeId: ID!) {
          node(id: $nodeId) {
            id
            connectedNodes {
              id
            }
          }
        }
      `

      const result = await graphqlRequest(query, {
        nodeId: '999999',
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.node).toBeNull()
    })

    test('searchNodes - Invalid table ID', async () => {
      const query = `
        query SearchNodesInvalidTable($tableId: ID!) {
          searchNodes(tableId: $tableId, searchQuery: { limit: 10 }) {
            nodes {
              node { id }
            }
          }
        }
      `

      const result = await graphqlRequest(query, {
        tableId: '999999',
      })

      // Should handle gracefully - either error or empty result
      expect(result.data.searchNodes.nodes).toEqual([])
    })

    test('shortestPath - Invalid target node', async () => {
      const query = `
        query GetShortestPathInvalid($sourceId: ID!, $targetId: ID!) {
          node(id: $sourceId) {
            id
            shortestPath(targetNodeId: $targetId) {
              id
            }
          }
        }
      `

      const result = await graphqlRequest(query, {
        sourceId: global.testData.aliceId,
        targetId: '999999',
      })

      expect(result.errors).toBeUndefined()
      expect(result.data.node.shortestPath).toEqual([])
    })
  })
})

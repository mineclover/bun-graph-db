import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import { GraphQLTestClient } from './utils/GraphQLTestClient.js'
import { TestDataFixtures } from './utils/TestDataFixtures.js'
import type { TestContext } from './utils/GraphQLTestClient.js'

describe('Comprehensive GraphQL Query Tests', () => {
  let client: GraphQLTestClient
  let fixtures: TestDataFixtures
  let context: TestContext

  beforeAll(async () => {
    client = new GraphQLTestClient()
    fixtures = new TestDataFixtures(client)

    // Health check to ensure server is running
    const isHealthy = await client.healthCheck()
    if (!isHealthy) {
      throw new Error('GraphQL server is not healthy. Please start the server before running tests.')
    }
  })

  beforeEach(() => {
    client.clearContext()
    context = client.getContext()
  })

  afterAll(async () => {
    // Cleanup all created resources
    console.log('Test cleanup - created resources:', client.getContext())
  })

  describe('Health and System Queries', () => {
    test('should return system health', async () => {
      const result = await client.query(`
        query HealthCheck {
          health {
            status
            timestamp
            database
            version
          }
        }
      `)

      expect(result.data).toBeTruthy()
      expect(result.data.health.status).toBe('OK')
      expect(result.data.health.timestamp).toBeTruthy()
      expect(result.data.health.database).toBeTruthy()
      expect(result.data.health.version).toBeTruthy()
      expect(result.errors).toBeUndefined()
    })

    test('should return system health status', async () => {
      const result = await client.getSystemHealth()

      expect(result.data).toBeTruthy()
      expect(result.data.getSystemHealth).toBeTruthy()
      expect(result.data.getSystemHealth.status).toBe('HEALTHY')
      expect(result.errors).toBeUndefined()
    })
  })

  describe('Table Operations', () => {
    test('should create, read, and list tables', async () => {
      // Create table
      const tableId = await client.createTable('test-table', 'Test table for comprehensive testing')
      expect(tableId).toBeTruthy()

      // Get single table
      const tableResult = await client.getTable(tableId)
      expect(tableResult.data).toBeTruthy()
      expect(tableResult.data.table).toBeTruthy()
      expect(tableResult.data.table.id).toBe(tableId)
      expect(tableResult.data.table.identifier).toBe('test-table')
      expect(tableResult.data.table.description).toBe('Test table for comprehensive testing')

      // List all tables
      const tablesResult = await client.getTables()
      expect(tablesResult.data).toBeTruthy()
      expect(tablesResult.data.tables.nodes).toBeTruthy()
      expect(tablesResult.data.tables.nodes.length).toBeGreaterThan(0)
      
      const createdTable = tablesResult.data.tables.nodes.find(t => t.id === tableId)
      expect(createdTable).toBeTruthy()
      expect(createdTable.identifier).toBe('test-table')
    })

    test('should handle table creation errors gracefully', async () => {
      // Try to create table with duplicate identifier
      const tableId1 = await client.createTable('duplicate-table', 'First table')
      expect(tableId1).toBeTruthy()

      const tableId2 = await client.createTable('duplicate-table', 'Second table')
      expect(tableId2).toBeNull() // Should fail due to duplicate identifier
    })
  })

  describe('Attribute Type Operations', () => {
    test('should create and retrieve attribute types', async () => {
      // Create attribute type
      const attrTypeId = await client.createAttributeType('test-string-type', 'Test string attribute type')
      expect(attrTypeId).toBeTruthy()

      // Get attribute types
      const result = await client.getAttributeTypes()
      expect(result.data).toBeTruthy()
      expect(result.data.attributeTypes).toBeTruthy()
      expect(Array.isArray(result.data.attributeTypes)).toBe(true)
      
      const createdType = result.data.attributeTypes.find(at => at.id === attrTypeId)
      expect(createdType).toBeTruthy()
      expect(createdType.identifier).toBe('test-string-type')
    })
  })

  describe('Attribute Operations', () => {
    test('should create and retrieve attributes for a table', async () => {
      // Setup: Create table and attribute type
      const tableId = await client.createTable('attr-test-table', 'Table for attribute testing')
      const attrTypeId = await client.createAttributeType('name-type', 'Name attribute type')

      // Create attribute
      const attrId = await client.createAttribute(tableId, 'name', attrTypeId)
      expect(attrId).toBeTruthy()

      // Get attributes for table
      const result = await client.getAttributes(tableId)
      expect(result.data).toBeTruthy()
      expect(Array.isArray(result.data.attributes)).toBe(true)
      expect(result.data.attributes.length).toBe(1)

      const createdAttr = result.data.attributes[0]
      expect(createdAttr.id).toBe(attrId)
      expect(createdAttr.identifier).toBe('name')
      expect(createdAttr.attributeType).toBeTruthy()
      expect(createdAttr.attributeType.id).toBe(attrTypeId)
      expect(createdAttr.table).toBeTruthy()
      expect(createdAttr.table.id).toBe(tableId)
    })
  })

  describe('Node Operations', () => {
    test('should create, retrieve, and search nodes', async () => {
      // Setup: Create table
      const tableId = await client.createTable('node-test-table', 'Table for node testing')

      // Create nodes
      const nodeId1 = await client.createNode(tableId, 'Test Node 1', 'First test node')
      const nodeId2 = await client.createNode(tableId, 'Test Node 2', 'Second test node')
      expect(nodeId1).toBeTruthy()
      expect(nodeId2).toBeTruthy()

      // Get nodes for table
      const nodesResult = await client.getNodes(tableId)
      expect(nodesResult.data).toBeTruthy()
      expect(nodesResult.data.nodes.nodes).toBeTruthy()
      expect(nodesResult.data.nodes.nodes.length).toBe(2)
      expect(nodesResult.data.nodes.totalCount).toBe(2)

      // Search nodes
      const searchResult = await client.searchNodes(tableId, 'Test', 10)
      expect(searchResult.data).toBeTruthy()
      expect(searchResult.data.searchNodes.nodes.length).toBe(2)
      expect(searchResult.data.searchNodes.total).toBe(2)
    })

    test('should handle node search with no results', async () => {
      const tableId = await client.createTable('empty-search-table', 'Empty table for search testing')

      const searchResult = await client.searchNodes(tableId, 'nonexistent', 10)
      expect(searchResult.data).toBeTruthy()
      expect(searchResult.data.searchNodes.nodes.length).toBe(0)
      expect(searchResult.data.searchNodes.total).toBe(0)
    })
  })

  describe('Relation Operations', () => {
    test('should create relations and retrieve node relations', async () => {
      // Setup: Create table, relation type, and nodes
      const tableId = await client.createTable('relation-test-table', 'Table for relation testing')
      const relTypeId = await client.createRelationType('connected-to', 'Connection relation type')
      const nodeId1 = await client.createNode(tableId, 'Node A', 'First node')
      const nodeId2 = await client.createNode(tableId, 'Node B', 'Second node')

      // Create relation using external IDs (node IDs)
      const relationId = await client.createRelation(tableId, relTypeId, nodeId1, nodeId2, 0.8, 0.9)
      expect(relationId).toBeTruthy()

      // Get node relations for table
      const relationsResult = await client.getNodeRelations(tableId)
      expect(relationsResult.data).toBeTruthy()
      expect(Array.isArray(relationsResult.data.nodeRelations)).toBe(true)
      expect(relationsResult.data.nodeRelations.length).toBe(1)

      const relation = relationsResult.data.nodeRelations[0]
      expect(relation.id).toBe(relationId)
      expect(relation.sourceExternalId).toBe(nodeId1)
      expect(relation.targetExternalId).toBe(nodeId2)
      expect(relation.strength).toBe(0.8)
      expect(relation.confidence).toBe(0.9)
      expect(relation.relationType).toBeTruthy()
      expect(relation.relationType.id).toBe(relTypeId)
    })

    test('should retrieve relation types', async () => {
      // Create relation type
      const relTypeId = await client.createRelationType('depends-on', 'Dependency relation')

      // Get all relation types
      const result = await client.getRelationTypes()
      expect(result.data).toBeTruthy()
      expect(Array.isArray(result.data.relationTypes)).toBe(true)
      
      const createdType = result.data.relationTypes.find(rt => rt.id === relTypeId)
      expect(createdType).toBeTruthy()
      expect(createdType.identifier).toBe('depends-on')
    })
  })

  describe('Advanced Search Operations', () => {
    test('should perform advanced search with filters', async () => {
      // Setup test environment with related nodes
      const tableId = await client.createTable('advanced-search-table', 'Advanced search test table')
      const relTypeId = await client.createRelationType('relates-to', 'General relation')
      const nodeIds = []

      // Create multiple nodes
      for (let i = 1; i <= 5; i++) {
        const nodeId = await client.createNode(tableId, `Search Node ${i}`, `Test node number ${i}`)
        nodeIds.push(nodeId)
      }

      // Create some relations
      await client.createRelation(tableId, relTypeId, nodeIds[0], nodeIds[1], 0.7, 0.8)
      await client.createRelation(tableId, relTypeId, nodeIds[1], nodeIds[2], 0.6, 0.9)

      // Search for related nodes
      const searchResult = await client.searchRelatedNodes(tableId, [nodeIds[0]], 2)
      expect(searchResult.data).toBeTruthy()
      expect(searchResult.data.searchRelatedNodes.nodes).toBeTruthy()
      expect(searchResult.data.searchRelatedNodes.relations).toBeTruthy()
    })
  })

  describe('Export Operations', () => {
    test('should export table data', async () => {
      // Setup: Create table with some data
      const tableId = await client.createTable('export-test-table', 'Export test table')
      await client.createNode(tableId, 'Export Node', 'Node for export testing')

      const exportResult = await client.exportTable(tableId)
      expect(exportResult.data).toBeTruthy()
      expect(exportResult.data.exportTable).toBeTruthy()
      expect(exportResult.data.exportTable.success).toBe(true)
      expect(exportResult.data.exportTable.data).toBeTruthy()
      expect(exportResult.data.exportTable.format).toBeTruthy()
    })

    test('should export all tables', async () => {
      const exportResult = await client.exportAllTables()
      expect(exportResult.data).toBeTruthy()
      expect(exportResult.data.exportAllTables).toBeTruthy()
      expect(exportResult.data.exportAllTables.success).toBe(true)
      expect(exportResult.data.exportAllTables.data).toBeTruthy()
    })
  })

  describe('E-commerce Domain Test Suite', () => {
    test('should create complete e-commerce environment', async () => {
      const ecommerceData = await fixtures.createECommerceEnvironment()
      
      expect(ecommerceData.tableId).toBeTruthy()
      expect(ecommerceData.productNodes.length).toBe(3)
      expect(ecommerceData.customerNodes.length).toBe(2)
      expect(ecommerceData.orderNodes.length).toBe(2)
      expect(ecommerceData.relations.length).toBeGreaterThan(0)

      // Verify product search works
      const searchResult = await client.searchNodes(ecommerceData.tableId, 'Laptop', 10)
      expect(searchResult.data.searchNodes.nodes.length).toBeGreaterThan(0)
      
      const laptopNode = searchResult.data.searchNodes.nodes.find(n => n.content.includes('Laptop'))
      expect(laptopNode).toBeTruthy()
    })
  })

  describe('Project Management Domain Test Suite', () => {
    test('should create complete project management environment', async () => {
      const projectData = await fixtures.createProjectManagementEnvironment()
      
      expect(projectData.tableId).toBeTruthy()
      expect(projectData.projectNodes.length).toBe(2)
      expect(projectData.taskNodes.length).toBe(6)
      expect(projectData.userNodes.length).toBe(3)
      expect(projectData.relations.length).toBeGreaterThan(0)

      // Verify task search works
      const searchResult = await client.searchNodes(projectData.tableId, 'Setup', 10)
      expect(searchResult.data.searchNodes.nodes.length).toBeGreaterThan(0)
    })
  })

  describe('Knowledge Graph Domain Test Suite', () => {
    test('should create complete knowledge graph environment', async () => {
      const knowledgeData = await fixtures.createKnowledgeGraphEnvironment()
      
      expect(knowledgeData.tableId).toBeTruthy()
      expect(knowledgeData.conceptNodes.length).toBe(6)
      expect(knowledgeData.relations.length).toBeGreaterThan(0)

      // Verify concept relationships
      const relationsResult = await client.getNodeRelations(knowledgeData.tableId)
      expect(relationsResult.data.nodeRelations.length).toBeGreaterThan(0)
      
      // Should have hierarchical relationships (is-a, part-of)
      const relationTypes = relationsResult.data.nodeRelations.map(r => r.relationType.identifier)
      expect(relationTypes).toContain('is-a')
      expect(relationTypes).toContain('part-of')
    })
  })

  describe('Performance Test Suite', () => {
    test('should handle performance test data creation', async () => {
      const performanceData = await fixtures.createPerformanceTestData()
      
      expect(performanceData.tableId).toBeTruthy()
      expect(performanceData.nodeCount).toBe(100)
      expect(performanceData.relationCount).toBe(200)

      // Verify search performance with larger dataset
      const startTime = Date.now()
      const searchResult = await client.searchNodes(performanceData.tableId, 'Performance', 20)
      const endTime = Date.now()
      
      expect(searchResult.data.searchNodes.nodes.length).toBeGreaterThan(0)
      expect(endTime - startTime).toBeLessThan(2000) // Should complete within 2 seconds
    })
  })

  describe('Error Handling', () => {
    test('should handle invalid table ID gracefully', async () => {
      const result = await client.getTable('invalid-table-id')
      expect(result.data.table).toBeNull()
    })

    test('should handle missing relation endpoints', async () => {
      const tableId = await client.createTable('error-test-table', 'Error testing table')
      const relTypeId = await client.createRelationType('test-relation', 'Test relation')
      
      // Try to create relation with non-existent nodes
      const relationId = await client.createRelation(tableId, relTypeId, 'nonexistent-1', 'nonexistent-2')
      expect(relationId).toBeNull()
    })
  })
})
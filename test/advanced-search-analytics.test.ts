import { describe, expect, test, beforeAll, afterAll } from '@jest/globals'
import { graphqlRequest } from './graphql-integration.test.js'

/**
 * Advanced Search and Analytics Integration Tests
 * Tests complex search queries, analytics, and performance monitoring
 */

describe('Advanced Search and Analytics Tests', () => {
  let testTableId: string
  let nodeIds: string[] = []

  beforeAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000))
    await setupAdvancedTestData()
  })

  async function setupAdvancedTestData() {
    const timestamp = Date.now()
    
    // Create test table
    const tableResult = await graphqlRequest(`
      mutation CreateAdvancedTestTable($input: CreateTableInput!) {
        createTable(input: $input) {
          table {
            id
            identifier
          }
          errors { message }
        }
      }
    `, {
      input: {
        identifier: `advanced-test-${timestamp}`,
        description: 'Advanced search and analytics test table'
      }
    })
    
    testTableId = tableResult.data.createTable.table.id

    // Create test attributes for complex queries
    await graphqlRequest(`
      mutation CreateTestTypeAttribute($input: CreateAttributeInput!) {
        createAttribute(input: $input) {
          attribute { id }
          errors { message }
        }
      }
    `, {
      input: {
        tableId: testTableId,
        identifier: "test_type",
        attributeTypeId: "1", // string
        description: "Test type classification",
        isRequired: true
      }
    })

    await graphqlRequest(`
      mutation CreateStatusAttribute($input: CreateAttributeInput!) {
        createAttribute(input: $input) {
          attribute { id }
          errors { message }
        }
      }
    `, {
      input: {
        tableId: testTableId,
        identifier: "status",
        attributeTypeId: "1", // string
        description: "Test execution status",
        isRequired: true
      }
    })

    // Create multiple test nodes with different characteristics
    const testCases = [
      { content: "User Authentication Test", type: "integration", status: "passing" },
      { content: "API Endpoint Validation", type: "integration", status: "failing" },
      { content: "Database Connection Test", type: "unit", status: "passing" },
      { content: "Performance Load Test", type: "performance", status: "flaky" },
      { content: "UI Component Test", type: "unit", status: "passing" },
      { content: "End-to-End User Flow", type: "e2e", status: "pending" },
    ]

    for (const testCase of testCases) {
      const result = await graphqlRequest(`
        mutation CreateTestNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            node {
              id
              content
            }
            errors { message }
          }
        }
      `, {
        input: {
          tableId: testTableId,
          content: testCase.content,
          title: testCase.content,
          attributes: [
            { attributeId: "test_type_attr", value: testCase.type },
            { attributeId: "status_attr", value: testCase.status }
          ]
        }
      })

      if (result.data.createNode.node) {
        nodeIds.push(result.data.createNode.node.id)
      }
    }
  }

  describe('1. Advanced Node Search', () => {
    test('should perform complex search queries', async () => {
      const result = await graphqlRequest(`
        query AdvancedNodeSearch($input: SearchNodesInput!) {
          searchNodes(input: $input) {
            nodes {
              id
              content
              title
              attributes {
                attribute {
                  identifier
                }
                value
              }
            }
            totalCount
            query {
              originalQuery
              parsedConditions
            }
          }
        }
      `, {
        input: {
          tableId: testTableId,
          query: "integration AND (passing OR failing)",
          limit: 10
        }
      })

      expect(result.data.searchNodes).toBeTruthy()
      expect(result.data.searchNodes.nodes).toBeInstanceOf(Array)
      expect(result.data.searchNodes.totalCount).toBeGreaterThan(0)
      expect(result.data.searchNodes.query.originalQuery).toContain('integration')
    })

    test('should search by content patterns', async () => {
      const result = await graphqlRequest(`
        query SearchByPattern($input: SearchNodesInput!) {
          searchNodes(input: $input) {
            nodes {
              content
              title
            }
            totalCount
          }
        }
      `, {
        input: {
          tableId: testTableId,
          query: "Test",
          limit: 20
        }
      })

      expect(result.data.searchNodes.nodes.length).toBeGreaterThan(0)
      // All results should contain "Test" in content or title
      result.data.searchNodes.nodes.forEach((node: any) => {
        const hasTestInContent = node.content.toLowerCase().includes('test')
        const hasTestInTitle = node.title?.toLowerCase().includes('test') || false
        expect(hasTestInContent || hasTestInTitle).toBe(true)
      })
    })

    test('should support sorting and pagination', async () => {
      const result = await graphqlRequest(`
        query SearchWithSorting($input: SearchNodesInput!) {
          searchNodes(input: $input) {
            nodes {
              id
              content
              createdAt
            }
            totalCount
            hasNextPage
            hasPreviousPage
          }
        }
      `, {
        input: {
          tableId: testTableId,
          query: "*", // match all
          limit: 3,
          offset: 0,
          sortBy: [
            { field: "createdAt", direction: "DESC" }
          ]
        }
      })

      expect(result.data.searchNodes.nodes.length).toBeLessThanOrEqual(3)
      expect(result.data.searchNodes.totalCount).toBeGreaterThanOrEqual(3)
      
      // Check if sorted by creation date (newer first)
      const dates = result.data.searchNodes.nodes.map((node: any) => new Date(node.createdAt))
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i-1].getTime()).toBeGreaterThanOrEqual(dates[i].getTime())
      }
    })
  })

  describe('2. Analytics and Aggregations', () => {
    test('should provide node analytics', async () => {
      const result = await graphqlRequest(`
        query GetNodeAnalytics($input: NodeAnalyticsInput!) {
          analyzeNodes(input: $input) {
            tableAnalytics {
              totalNodes
              totalRelations
              averageNodeDegree
              clusteringCoefficient
              growthTrends {
                date
                nodeCount
                relationCount
              }
            }
            nodeMetrics {
              nodeId
              incomingCount
              outgoingCount
              totalRelations
              centrality
            }
            qualityScores {
              metric
              score
              description
            }
            recommendations {
              type
              message
              priority
            }
          }
        }
      `, {
        input: {
          tableId: testTableId,
          nodeFilters: {},
          timeRange: {
            startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date().toISOString()
          }
        }
      })

      expect(result.data.analyzeNodes).toBeTruthy()
      expect(result.data.analyzeNodes.tableAnalytics).toBeTruthy()
      expect(result.data.analyzeNodes.tableAnalytics.totalNodes).toBeGreaterThan(0)
      expect(result.data.analyzeNodes.nodeMetrics).toBeInstanceOf(Array)
      expect(result.data.analyzeNodes.qualityScores).toBeInstanceOf(Array)
      expect(result.data.analyzeNodes.recommendations).toBeInstanceOf(Array)
    })

    test('should provide aggregated data insights', async () => {
      const result = await graphqlRequest(`
        query GetAggregatedData($input: AggregationInput!) {
          aggregateData(input: $input) {
            field
            aggregationType
            value
            groupedBy {
              key
              value
              count
            }
          }
        }
      `, {
        input: {
          tableId: testTableId,
          field: "status",
          aggregationType: "COUNT",
          groupBy: ["status"],
          timeRange: {
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date().toISOString()
          }
        }
      })

      expect(result.data.aggregateData).toBeInstanceOf(Array)
      expect(result.data.aggregateData.length).toBeGreaterThan(0)
      
      const statusAggregation = result.data.aggregateData[0]
      expect(statusAggregation.field).toBe('status')
      expect(statusAggregation.aggregationType).toBe('COUNT')
      expect(statusAggregation.groupedBy).toBeInstanceOf(Array)
      expect(statusAggregation.groupedBy.length).toBeGreaterThan(0)
    })
  })

  describe('3. Performance Monitoring', () => {
    test('should provide performance metrics', async () => {
      const result = await graphqlRequest(`
        query GetPerformanceMetrics($input: PerformanceAnalysisInput!) {
          getPerformanceMetrics(input: $input) {
            tableId
            queryResponseTimes {
              operationType
              averageMs
              maxMs
              minMs
              count
            }
            indexEfficiency
            cacheHitRatio
            concurrentOperations
            averageQueryTime
            slowestQueries {
              queryType
              duration
              timestamp
              parameters
            }
          }
        }
      `, {
        input: {
          tableId: testTableId,
          timeRange: {
            startDate: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            endDate: new Date().toISOString()
          },
          includeSlowQueries: true
        }
      })

      expect(result.data.getPerformanceMetrics).toBeTruthy()
      expect(result.data.getPerformanceMetrics.tableId).toBe(testTableId)
      expect(result.data.getPerformanceMetrics.queryResponseTimes).toBeInstanceOf(Array)
      expect(result.data.getPerformanceMetrics.indexEfficiency).toBeGreaterThan(0)
      expect(result.data.getPerformanceMetrics.cacheHitRatio).toBeGreaterThan(0)
      expect(result.data.getPerformanceMetrics.slowestQueries).toBeInstanceOf(Array)
    })

    test('should provide system health status', async () => {
      const result = await graphqlRequest(`
        query GetSystemHealth($tableId: String!) {
          getSystemHealth(tableId: $tableId) {
            status
            databaseSize
            totalTables
            totalNodes
            totalRelations
            uptime
            memoryUsage
            activeConnections
            lastUpdate
          }
        }
      `, {
        tableId: testTableId
      })

      expect(result.data.getSystemHealth).toBeTruthy()
      expect(['HEALTHY', 'WARNING', 'CRITICAL']).toContain(result.data.getSystemHealth.status)
      expect(result.data.getSystemHealth.totalTables).toBeGreaterThan(0)
      expect(result.data.getSystemHealth.totalNodes).toBeGreaterThan(0)
      expect(result.data.getSystemHealth.uptime).toBeGreaterThan(0)
    })
  })

  describe('4. Advanced Search Features', () => {
    test('should perform advanced search with filters', async () => {
      const result = await graphqlRequest(`
        query AdvancedSearchWithFilters($input: AdvancedSearchInput!) {
          advancedSearch(input: $input) {
            nodes {
              id
              content
              title
              score
              attributes
            }
            aggregations {
              field
              operation
              value
              groupedResults {
                groupKey
                value
                count
              }
            }
            totalCount
            hasNextPage
            executionTime
          }
        }
      `, {
        input: {
          tableId: testTableId,
          filters: [
            {
              field: "content",
              operator: "contains",
              value: "Test"
            },
            {
              field: "status",
              operator: "in",
              values: ["passing", "failing"]
            }
          ],
          aggregations: [
            {
              field: "status",
              operation: "count",
              groupBy: ["status"]
            }
          ],
          sort: [
            {
              field: "score",
              direction: "desc"
            }
          ],
          limit: 10,
          includeAttributes: true
        }
      })

      expect(result.data.advancedSearch).toBeTruthy()
      expect(result.data.advancedSearch.nodes).toBeInstanceOf(Array)
      expect(result.data.advancedSearch.aggregations).toBeInstanceOf(Array)
      expect(result.data.advancedSearch.totalCount).toBeGreaterThan(0)
      expect(result.data.advancedSearch.executionTime).toBeGreaterThan(0)
    })

    test('should support complex boolean queries', async () => {
      const result = await graphqlRequest(`
        query ComplexBooleanSearch($input: AdvancedSearchInput!) {
          advancedSearch(input: $input) {
            nodes {
              content
              score
            }
            totalCount
          }
        }
      `, {
        input: {
          tableId: testTableId,
          filters: [
            {
              field: "content",
              operator: "and",
              values: ["Test", "API", "Database"]
            }
          ],
          limit: 5
        }
      })

      expect(result.data.advancedSearch.nodes).toBeInstanceOf(Array)
      // Should find nodes that contain Test AND (API OR Database)
      result.data.advancedSearch.nodes.forEach((node: any) => {
        expect(node.content.toLowerCase()).toContain('test')
      })
    })
  })

  describe('5. Test Suite Analysis', () => {
    test('should analyze test suite status', async () => {
      const result = await graphqlRequest(`
        query GetTestSuiteStatus($input: TestSuiteAnalysisInput!) {
          getTestSuiteStatus(input: $input) {
            suiteId
            suiteName
            status
            totalTests
            passingTests
            failingTests
            blockedTests
            successRate
            executionTime
            lastRun
            dependencies {
              dependencyId
              dependencyName
              status
              blocking
              reason
            }
          }
        }
      `, {
        input: {
          tableId: testTableId,
          suiteFilters: {},
          includeDependencies: true
        }
      })

      expect(result.data.getTestSuiteStatus).toBeInstanceOf(Array)
      
      result.data.getTestSuiteStatus.forEach((suite: any) => {
        expect(suite.suiteId).toBeTruthy()
        expect(suite.suiteName).toBeTruthy()
        expect(['PASSING', 'FAILING', 'FLAKY', 'PENDING']).toContain(suite.status)
        expect(suite.totalTests).toBeGreaterThanOrEqual(0)
        expect(suite.successRate).toBeGreaterThanOrEqual(0)
        expect(suite.successRate).toBeLessThanOrEqual(100)
        expect(suite.dependencies).toBeInstanceOf(Array)
      })
    })
  })

  describe('6. Performance and Scalability', () => {
    test('should handle large result sets efficiently', async () => {
      const startTime = Date.now()
      
      const result = await graphqlRequest(`
        query LargeResultSetTest($input: SearchNodesInput!) {
          searchNodes(input: $input) {
            nodes {
              id
              content
            }
            totalCount
            hasNextPage
          }
        }
      `, {
        input: {
          tableId: testTableId,
          query: "*",
          limit: 100
        }
      })

      const executionTime = Date.now() - startTime

      expect(result.data.searchNodes).toBeTruthy()
      expect(executionTime).toBeLessThan(5000) // Should complete within 5 seconds
      
      console.log(`✅ Large result set query completed in ${executionTime}ms`)
      console.log(`   Returned ${result.data.searchNodes.nodes.length} nodes`)
      console.log(`   Total available: ${result.data.searchNodes.totalCount}`)
    })

    test('should provide query performance insights', async () => {
      const result = await graphqlRequest(`
        query GetQueryPerformance($input: AdvancedSearchInput!) {
          advancedSearch(input: $input) {
            executionTime
            totalCount
            hasNextPage
          }
        }
      `, {
        input: {
          tableId: testTableId,
          filters: [
            {
              field: "content",
              operator: "fulltext",
              value: "Test API Database"
            }
          ],
          limit: 50
        }
      })

      expect(result.data.advancedSearch.executionTime).toBeGreaterThan(0)
      expect(result.data.advancedSearch.executionTime).toBeLessThan(1000) // Should be under 1 second
      
      console.log(`✅ Advanced search performance: ${result.data.advancedSearch.executionTime}ms`)
    })
  })
})
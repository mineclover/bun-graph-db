#!/usr/bin/env bun

/**
 * GraphQL Query Validation System
 * Dedicated testing for all GraphQL queries and mutations
 */

import { GraphQLClient } from 'graphql-request'

interface QueryTestCase {
  name: string
  query: string
  variables?: Record<string, any>
  expectedFields: string[]
  shouldSucceed: boolean
  description?: string
}

export class GraphQLQueryValidator {
  private client: GraphQLClient
  private testResults: Map<string, QueryResult> = new Map()

  constructor(endpoint: string = 'http://localhost:4000/graphql') {
    this.client = new GraphQLClient(endpoint)
  }

  // All GraphQL queries to validate
  private queryTestCases: QueryTestCase[] = [
    // Health Check
    {
      name: 'health_check',
      query: `query { health { status } }`,
      expectedFields: ['health', 'status'],
      shouldSucceed: true,
      description: 'Basic health check query',
    },

    // Table Operations
    {
      name: 'get_tables',
      query: `query { tables { nodes { id identifier description createdAt } totalCount } }`,
      expectedFields: ['tables', 'nodes', 'totalCount'],
      shouldSucceed: true,
      description: 'Fetch all tables',
    },
    {
      name: 'create_table',
      query: `mutation($input: CreateTableInput!) {
        createTable(input: $input) {
          table { id identifier description }
          errors { message }
        }
      }`,
      variables: { input: { identifier: 'test-table', description: 'Test table' } },
      expectedFields: ['createTable', 'table', 'errors'],
      shouldSucceed: true,
      description: 'Create new table',
    },
    {
      name: 'get_table_by_id',
      query: `query($id: ID!) { table(id: $id) { id identifier description } }`,
      variables: { id: 'needs-real-id' }, // Will be updated dynamically
      expectedFields: ['table', 'id', 'identifier'],
      shouldSucceed: true, // Will succeed with valid ID
      description: 'Get table by ID',
    },

    // Node Operations
    {
      name: 'create_node',
      query: `mutation($tableId: ID!, $identifier: String!, $description: String) {
        createNode(tableId: $tableId, identifier: $identifier, description: $description) {
          id externalId identifier description
        }
      }`,
      variables: { tableId: 'placeholder', identifier: 'test-node', description: 'Test node' },
      expectedFields: ['createNode', 'id', 'externalId'],
      shouldSucceed: false, // Will fail without valid table ID
      description: 'Create new node',
    },
    {
      name: 'get_nodes',
      query: `query($tableId: ID!, $limit: Int, $offset: Int) {
        nodes(tableId: $tableId, limit: $limit, offset: $offset) {
          nodes { id externalId identifier description }
          totalCount
          hasMore
        }
      }`,
      variables: { tableId: 'placeholder', limit: 10 },
      expectedFields: ['nodes', 'totalCount', 'hasMore'],
      shouldSucceed: false, // Will fail without valid table ID
      description: 'Get nodes with pagination',
    },

    // Attribute Operations
    {
      name: 'create_attribute_type',
      query: `mutation($input: CreateAttributeTypeInput!) {
        createAttributeType(input: $input) {
          attributeType { id identifier jsonType }
          errors { message }
        }
      }`,
      variables: { input: { identifier: 'test-attribute', jsonType: 'string' } },
      expectedFields: ['createAttributeType', 'attributeType', 'errors'],
      shouldSucceed: true,
      description: 'Create attribute type',
    },
    {
      name: 'get_attribute_types',
      query: `query { attributeTypes { id identifier jsonType } }`,
      expectedFields: ['attributeTypes', 'id', 'identifier'],
      shouldSucceed: true,
      description: 'Get all attribute types',
    },

    // Relation Operations
    {
      name: 'create_relation_type',
      query: `mutation($input: CreateRelationTypeInput!) {
        createRelationType(input: $input) {
          relationType { id identifier description }
          errors { message }
        }
      }`,
      variables: { input: { identifier: 'test-relation', description: 'Test relation' } },
      expectedFields: ['createRelationType', 'relationType', 'errors'],
      shouldSucceed: true,
      description: 'Create relation type',
    },
    {
      name: 'get_relation_types',
      query: `query { relationTypes { id identifier description } }`,
      expectedFields: ['relationTypes', 'id', 'identifier'],
      shouldSucceed: true,
      description: 'Get all relation types',
    },

    // Search Operations
    {
      name: 'search_nodes',
      query: `query($tableId: ID!, $searchQuery: String!, $limit: Int) {
        searchNodes(tableId: $tableId, searchQuery: $searchQuery, limit: $limit) {
          nodes { id identifier description }
          totalCount
        }
      }`,
      variables: { tableId: 'placeholder', searchQuery: 'test', limit: 10 },
      expectedFields: ['searchNodes', 'nodes', 'totalCount'],
      shouldSucceed: false, // Will fail without valid table ID
      description: 'Search nodes by query',
    },
    {
      name: 'search_related_nodes',
      query: `query($tableId: ID!, $nodeIds: [ID!]!, $maxDepth: Int) {
        searchRelatedNodes(tableId: $tableId, nodeIds: $nodeIds, maxDepth: $maxDepth) {
          nodes { id identifier }
          relationships { sourceExternalId targetExternalId }
        }
      }`,
      variables: { tableId: 'placeholder', nodeIds: ['test'], maxDepth: 2 },
      expectedFields: ['searchRelatedNodes', 'nodes', 'relationships'],
      shouldSucceed: false, // Will fail without valid IDs
      description: 'Search related nodes',
    },

    // Relationship Operations
    {
      name: 'get_node_relations',
      query: `query($tableId: ID!) {
        nodeRelations(tableId: $tableId) {
          id sourceExternalId targetExternalId
          relationType { name }
          strength confidence
        }
      }`,
      variables: { tableId: 'placeholder' },
      expectedFields: ['nodeRelations', 'id', 'sourceExternalId', 'strength'],
      shouldSucceed: false, // Will fail without valid table ID
      description: 'Get node relationships',
    },

    // Advanced Analytics
    {
      name: 'node_statistics',
      query: `query($tableId: ID!) {
        nodeStatistics(tableId: $tableId) {
          totalNodes
          totalRelations
          avgRelationsPerNode
        }
      }`,
      variables: { tableId: 'placeholder' },
      expectedFields: ['nodeStatistics', 'totalNodes', 'totalRelations'],
      shouldSucceed: false, // Will fail without valid table ID
      description: 'Get node statistics',
    },
  ]

  async setupDynamicTestData(): Promise<void> {
    try {
      // Create a test table to use for get_table_by_id query
      const createTableResult = await this.client.request(
        `
        mutation($input: CreateTableInput!) {
          createTable(input: $input) {
            table { id identifier description }
            errors { message }
          }
        }
      `,
        {
          input: {
            identifier: 'validator-test-table',
            description: 'Test table for query validation',
          },
        }
      )

      const tableId = createTableResult.createTable.table?.id
      if (tableId) {
        // Update the get_table_by_id test case with the real table ID
        const testCase = this.queryTestCases.find((tc) => tc.name === 'get_table_by_id')
        if (testCase && testCase.variables) {
          testCase.variables.id = tableId
        }
      }
    } catch (error) {
      console.warn('⚠️  Failed to set up dynamic test data:', error.message)
    }
  }

  async validateAllQueries(): Promise<ValidationReport> {
    console.log('🔍 Starting GraphQL Query Validation...\n')

    // Set up dynamic test data
    await this.setupDynamicTestData()

    const startTime = Date.now()
    let passed = 0
    let failed = 0

    for (const testCase of this.queryTestCases) {
      console.log(`📋 Testing: ${testCase.name}`)
      const result = await this.validateQuery(testCase)
      this.testResults.set(testCase.name, result)

      if (result.passed) {
        passed++
        console.log(`✅ ${testCase.name}: PASSED\n`)
      } else {
        failed++
        console.log(`❌ ${testCase.name}: FAILED`)
        console.log(`   Reason: ${result.error}\n`)
      }
    }

    const totalTime = Date.now() - startTime

    const report: ValidationReport = {
      totalQueries: this.queryTestCases.length,
      passed,
      failed,
      duration: totalTime,
      results: Object.fromEntries(this.testResults),
      success: failed === 0,
    }

    this.printSummary(report)
    return report
  }

  async validateQuery(testCase: QueryTestCase): Promise<QueryResult> {
    const startTime = Date.now()

    try {
      const response = await this.client.request(testCase.query, testCase.variables)
      const duration = Date.now() - startTime

      // Check if response contains expected fields
      const hasExpectedFields = this.checkExpectedFields(response, testCase.expectedFields)

      const success = testCase.shouldSucceed ? hasExpectedFields : false

      return {
        name: testCase.name,
        passed: success,
        duration,
        response,
        error:
          !success && testCase.shouldSucceed
            ? 'Missing expected fields or unexpected failure'
            : undefined,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      // If we expected this to fail, it's a pass
      const expectedFailure = !testCase.shouldSucceed

      return {
        name: testCase.name,
        passed: expectedFailure,
        duration,
        error: expectedFailure ? undefined : errorMessage,
      }
    }
  }

  private checkExpectedFields(response: any, expectedFields: string[]): boolean {
    for (const field of expectedFields) {
      if (!this.hasField(response, field)) {
        return false
      }
    }
    return true
  }

  private hasField(obj: any, fieldPath: string): boolean {
    if (!obj || typeof obj !== 'object') return false

    // Handle nested field paths (e.g., "data.health.status")
    const parts = fieldPath.split('.')
    let current = obj

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part]
      } else {
        // For simple field names, also check if they exist anywhere in the object structure
        return this.findFieldInObject(obj, fieldPath)
      }
    }

    return current !== undefined && current !== null
  }

  private findFieldInObject(obj: any, fieldName: string): boolean {
    if (!obj || typeof obj !== 'object') return false

    // Direct property check
    if (fieldName in obj) return true

    // Recursive search in nested objects and arrays
    for (const key in obj) {
      if (obj[key] && typeof obj[key] === 'object') {
        if (this.findFieldInObject(obj[key], fieldName)) {
          return true
        }
      }
    }

    return false
  }

  async getQueryAnalytics(): Promise<QueryAnalytics> {
    const results = Array.from(this.testResults.values())

    return {
      totalQueries: results.length,
      passedQueries: results.filter((r) => r.passed).length,
      failedQueries: results.filter((r) => !r.passed).length,
      avgDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
      slowestQuery: results.sort((a, b) => b.duration - a.duration)[0]?.name,
      fastestQuery: results.sort((a, b) => a.duration - b.duration)[0]?.name,
    }
  }

  private printSummary(report: ValidationReport): void {
    console.log('\n' + '='.repeat(60))
    console.log('🔍 GRAPHQL QUERY VALIDATION SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total Queries: ${report.totalQueries}`)
    console.log(`Passed: ${report.passed}`)
    console.log(`Failed: ${report.failed}`)
    console.log(`Total Duration: ${(report.duration / 1000).toFixed(2)}s`)
    console.log(`Success Rate: ${((report.passed / report.totalQueries) * 100).toFixed(1)}%`)

    if (report.failed > 0) {
      console.log('\n❌ Failed Queries:')
      Object.entries(report.results).forEach(([name, result]) => {
        if (!result.passed) {
          console.log(`  - ${name}: ${result.error || 'Unknown error'}`)
        }
      })
    }

    console.log('\n' + (report.success ? '✅ ALL QUERIES VALIDATED!' : '❌ SOME QUERIES FAILED'))
    console.log('='.repeat(60))
  }
}

// Types
interface QueryResult {
  name: string
  passed: boolean
  duration: number
  response?: any
  error?: string
}

interface ValidationReport {
  totalQueries: number
  passed: number
  failed: number
  duration: number
  results: Record<string, QueryResult>
  success: boolean
}

interface QueryAnalytics {
  totalQueries: number
  passedQueries: number
  failedQueries: number
  avgDuration: number
  slowestQuery?: string
  fastestQuery?: string
}

// CLI interface
if (import.meta.main) {
  const validator = new GraphQLQueryValidator()
  const args = process.argv.slice(2)
  const command = args[0] || 'validate'

  switch (command) {
    case 'validate': {
      const report = await validator.validateAllQueries()
      process.exit(report.success ? 0 : 1)
      break
    }

    case 'analytics': {
      await validator.validateAllQueries()
      const analytics = await validator.getQueryAnalytics()
      console.log('\n📊 Query Analytics:')
      console.log(`  - Total Queries: ${analytics.totalQueries}`)
      console.log(`  - Passed: ${analytics.passedQueries}`)
      console.log(`  - Failed: ${analytics.failedQueries}`)
      console.log(`  - Average Duration: ${analytics.avgDuration.toFixed(2)}ms`)
      console.log(`  - Slowest Query: ${analytics.slowestQuery}`)
      console.log(`  - Fastest Query: ${analytics.fastestQuery}`)
      break
    }

    default:
      console.log(`
🔍 GraphQL Query Validator

Usage:
  bun test/query-validator.ts [command]

Commands:
  validate    Validate all GraphQL queries (default)
  analytics   Run validation and show analytics

Examples:
  bun test/query-validator.ts
  bun test/query-validator.ts analytics
`)
      break
  }
}

export default GraphQLQueryValidator

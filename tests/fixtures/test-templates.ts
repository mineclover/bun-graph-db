/**
 * Test Template Definitions
 * 
 * Pre-configured template data for testing template creation,
 * parsing, and database operations.
 */

import { sampleQueries, sampleVariablesSchemas } from './sample-queries.js'

export const testTemplates = [
  {
    identifier: 'test-simple-query',
    name: 'Simple User Query',
    queryText: sampleQueries.simpleQuery,
    variablesSchema: sampleVariablesSchemas.simpleQuery,
    description: 'Basic query for retrieving a single user by ID',
    expectedQueryName: 'GetUser',
    expectedOperationType: 'query',
    expectedComplexity: 2
  },

  {
    identifier: 'test-complex-query',
    name: 'Complex User List Query',
    queryText: sampleQueries.complexQuery,
    variablesSchema: sampleVariablesSchemas.complexQuery,
    description: 'Advanced query with filtering and pagination',
    expectedQueryName: 'ListUsers',
    expectedOperationType: 'query',
    expectedComplexity: 8
  },

  {
    identifier: 'test-mutation',
    name: 'Create User Mutation',
    queryText: sampleQueries.mutation,
    variablesSchema: sampleVariablesSchemas.mutation,
    description: 'Mutation for creating a new user',
    expectedQueryName: 'CreateUser',
    expectedOperationType: 'mutation',
    expectedComplexity: 3
  },

  {
    identifier: 'test-anonymous-query',
    name: 'Anonymous Health Check',
    queryText: sampleQueries.anonymousQuery,
    variablesSchema: null,
    description: 'Anonymous query without operation name',
    expectedQueryName: null,
    expectedOperationType: 'query',
    expectedComplexity: 1
  },

  {
    identifier: 'test-subscription',
    name: 'Node Updates Subscription',
    queryText: sampleQueries.subscription,
    variablesSchema: { 
      type: 'object', 
      properties: { 
        nodeId: { type: 'string' } 
      }, 
      required: ['nodeId'] 
    },
    description: 'Real-time subscription for node updates',
    expectedQueryName: 'NodeUpdates',
    expectedOperationType: 'subscription',
    expectedComplexity: 4
  },

  {
    identifier: 'test-nested-query',
    name: 'Nested Relations Query',
    queryText: sampleQueries.nestedQuery,
    variablesSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Node ID' }
      },
      required: ['id']
    },
    description: 'Complex nested query with fragments',
    expectedQueryName: 'GetNodeWithRelations',
    expectedOperationType: 'query',
    expectedComplexity: 12
  }
]

export const performanceTestTemplates = [
  // Templates for performance testing
  ...Array.from({ length: 100 }, (_, i) => ({
    identifier: `perf-test-${i + 1}`,
    name: `Performance Test Query ${i + 1}`,
    queryText: `query PerfTest${i + 1}($id: ID!) { node(id: $id) { id content } }`,
    variablesSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id']
    },
    description: `Performance test template ${i + 1}`,
    expectedQueryName: `PerfTest${i + 1}`,
    expectedOperationType: 'query',
    expectedComplexity: 2
  }))
]


/**
 * Sample GraphQL Queries for Testing
 * 
 * Provides standardized GraphQL query samples for testing parsing,
 * template creation, and indexing functionality.
 */

export const sampleQueries = {
  // Simple query with operation name and variables
  simpleQuery: `query GetUser($id: ID!) {
    node(id: $id) {
      id
      content
    }
  }`,

  // Complex query with multiple fields and fragments
  complexQuery: `query ListUsers($filter: NodesFilter, $limit: Int = 10) {
    nodes(filter: $filter, limit: $limit) {
      id
      content
      metadata
      relations {
        id
        targetNodeId
        relationType
        strength
      }
    }
  }`,

  // Mutation example
  mutation: `mutation CreateUser($input: CreateNodeInput!) {
    createNode(input: $input) {
      id
      content
      createdAt
    }
  }`,

  // Anonymous query (no operation name)
  anonymousQuery: `{
    health {
      status
      timestamp
    }
  }`,

  // Subscription example
  subscription: `subscription NodeUpdates($nodeId: ID!) {
    nodeUpdated(id: $nodeId) {
      id
      content
      lastModified
    }
  }`,

  // Nested query with fragments
  nestedQuery: `query GetNodeWithRelations($id: ID!) {
    node(id: $id) {
      ...NodeDetails
      relations {
        ...RelationDetails
        targetNode {
          ...NodeDetails
        }
      }
    }
  }
  
  fragment NodeDetails on Node {
    id
    content
    metadata
    createdAt
  }
  
  fragment RelationDetails on Relation {
    id
    relationType
    strength
    confidence
  }`,

  // Query with complex variables schema
  complexVariablesQuery: `query SearchNodes(
    $searchText: String!
    $filters: SearchFilters
    $pagination: PaginationInput = { limit: 20, offset: 0 }
    $sortBy: SortOption = RELEVANCE
  ) {
    searchNodes(
      text: $searchText
      filters: $filters
      pagination: $pagination
      sortBy: $sortBy
    ) {
      totalCount
      nodes {
        id
        content
        relevanceScore
        highlightedText
      }
      facets {
        category
        count
      }
    }
  }`
}

export const errorTestCases = [
  {
    identifier: 'test-invalid-syntax',
    queryText: 'query InvalidSyntax { invalid syntax here',
    expectError: true,
    errorType: 'syntax'
  },
  {
    identifier: 'test-empty-query',
    queryText: '',
    expectError: true,
    errorType: 'empty'
  },
  {
    identifier: 'test-malformed-operation',
    queryText: 'not a graphql query at all',
    expectError: true,
    errorType: 'malformed'
  }
]

export const sampleVariablesSchemas = {
  simpleQuery: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Node ID' }
    },
    required: ['id']
  },

  complexQuery: {
    type: 'object',
    properties: {
      filter: {
        type: 'object',
        properties: {
          contentContains: { type: 'string' },
          createdAfter: { type: 'string', format: 'date-time' },
          hasRelations: { type: 'boolean' }
        }
      },
      limit: { type: 'integer', minimum: 1, maximum: 100 }
    }
  },

  mutation: {
    type: 'object',
    properties: {
      input: {
        type: 'object',
        properties: {
          content: { type: 'string' },
          metadata: { type: 'object' }
        },
        required: ['content']
      }
    },
    required: ['input']
  }
}
/**
 * Demo Templates
 *
 * 실제 서버 테스트용 템플릿 데이터
 */

export const demoTemplates = [
  {
    identifier: 'demo-get-user',
    name: 'Get User by ID',
    description: 'Retrieve a single user by their unique identifier',
    query: `
      query GetUser($userId: ID!) {
        node(id: $userId) {
          id
          content
          ... on User {
            name
            email
            profile {
              avatar
              bio
            }
          }
        }
      }
    `,
    tags: ['demo', 'user', 'basic'],
    variablesSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User unique identifier',
        },
      },
      required: ['userId'],
    },
    defaultVariables: {
      userId: 'user_1',
    },
  },

  {
    identifier: 'demo-list-users',
    name: 'List Users with Pagination',
    description: 'Get a paginated list of users with filtering options',
    query: `
      query ListUsers($filter: NodesFilter, $limit: Int, $offset: Int) {
        nodes(filter: $filter, limit: $limit, offset: $offset) {
          items {
            id
            content
            ... on User {
              name
              email
              createdAt
            }
          }
          total
          hasNextPage
          hasPreviousPage
        }
      }
    `,
    tags: ['demo', 'user', 'list', 'pagination'],
    variablesSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'Number of items per page',
          default: 10,
        },
        offset: {
          type: 'integer',
          description: 'Number of items to skip',
          default: 0,
        },
        filter: {
          type: 'object',
          description: 'Filtering criteria',
        },
      },
    },
    defaultVariables: {
      limit: 5,
      offset: 0,
    },
  },

  {
    identifier: 'demo-create-user',
    name: 'Create New User',
    description: 'Create a new user account with profile information',
    query: `
      mutation CreateUser($input: CreateUserInput!) {
        createUser(input: $input) {
          success
          data {
            id
            name
            email
            createdAt
          }
          errors
        }
      }
    `,
    tags: ['demo', 'user', 'create', 'mutation'],
    variablesSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'User full name',
            },
            email: {
              type: 'string',
              description: 'User email address',
            },
            profile: {
              type: 'object',
              description: 'User profile data',
            },
          },
          required: ['name', 'email'],
        },
      },
      required: ['input'],
    },
    defaultVariables: {
      input: {
        name: 'Demo User',
        email: 'demo@example.com',
        profile: {
          bio: 'This is a demo user created by the template system',
        },
      },
    },
  },

  {
    identifier: 'demo-complex-search',
    name: 'Complex Search Query',
    description: 'Advanced search with multiple criteria and relations',
    query: `
      query ComplexSearch($searchQuery: SearchInput!) {
        search(input: $searchQuery) {
          results {
            id
            score
            item {
              id
              content
              relations {
                target {
                  id
                  content
                }
                strength
                relationType
              }
            }
          }
          facets {
            type
            values {
              value
              count
            }
          }
          total
        }
      }
    `,
    tags: ['demo', 'search', 'complex', 'relations'],
    variablesSchema: {
      type: 'object',
      properties: {
        searchQuery: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query string',
            },
            filters: {
              type: 'object',
              description: 'Search filters',
            },
            limit: {
              type: 'integer',
              description: 'Result limit',
              default: 20,
            },
          },
          required: ['query'],
        },
      },
      required: ['searchQuery'],
    },
    defaultVariables: {
      searchQuery: {
        query: 'demo',
        limit: 10,
      },
    },
  },

  {
    identifier: 'demo-health-check',
    name: 'System Health Check',
    description: 'Check system health and status information',
    query: `
      query HealthCheck {
        health {
          status
          timestamp
          version
          uptime
          metrics {
            totalNodes
            totalRelations
            totalTemplates
            avgQueryTime
          }
        }
      }
    `,
    tags: ['demo', 'health', 'monitoring'],
  },

  {
    identifier: 'demo-performance-test',
    name: 'Performance Test Query',
    description: 'Query designed to measure system performance',
    query: `
      query PerformanceTest($complexity: Int) {
        nodes(limit: $complexity) {
          items {
            id
            content
            relations(limit: 5) {
              target {
                id
                content
                relations(limit: 3) {
                  target {
                    id
                    content
                  }
                  strength
                }
              }
              strength
              relationType
            }
          }
        }
      }
    `,
    tags: ['demo', 'performance', 'nested'],
    variablesSchema: {
      type: 'object',
      properties: {
        complexity: {
          type: 'integer',
          description: 'Query complexity level (number of nodes to fetch)',
          default: 10,
          minimum: 1,
          maximum: 100,
        },
      },
    },
    defaultVariables: {
      complexity: 10,
    },
  },
]

// 성능 테스트용 대용량 템플릿 생성기
export function generatePerformanceTemplates(count: number = 50) {
  const templates = []

  for (let i = 1; i <= count; i++) {
    templates.push({
      identifier: `perf-test-${i.toString().padStart(3, '0')}`,
      name: `Performance Test ${i}`,
      description: `Auto-generated performance test template #${i}`,
      query: `
        query PerfTest${i}($id: ID!, $limit: Int) {
          node(id: $id) {
            id
            content
            relations(limit: $limit) {
              target {
                id
                content
              }
              strength
            }
          }
        }
      `,
      tags: ['performance', 'auto-generated', `batch-${Math.ceil(i / 10)}`],
      variablesSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Node ID',
          },
          limit: {
            type: 'integer',
            description: 'Relation limit',
            default: 10,
          },
        },
        required: ['id'],
      },
      defaultVariables: {
        id: `node_${i}`,
        limit: Math.min(10, (i % 20) + 1),
      },
    })
  }

  return templates
}

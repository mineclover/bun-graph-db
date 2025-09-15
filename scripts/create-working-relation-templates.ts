#!/usr/bin/env bun

/**
 * 실제 작동하는 관계 기반 쿼리 템플릿 생성 스크립트
 *
 * 기존 스키마에서 작동하는 것으로 확인된 기능들을 활용:
 * 1. 관계 타입 생성 및 관리 (CreateRelationType 작동 확인됨)
 * 2. 노드 관계 생성 (CreateRelation 스키마 존재)
 * 3. 기존 노드 기반 관계 분석 (searchRelatedNodes, findPathsBetweenNodes)
 * 4. 테이블 내 관계 추적
 */

interface RelationTemplate {
  identifier: string
  name: string
  description: string
  query: string
  variables: Record<string, any>
  variablesSchema: Record<string, any>
  defaultVariables: Record<string, any>
  tags: string[]
  complexityScore: number
  category: string
}

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql'

const workingRelationTemplates: RelationTemplate[] = [
  // 1. 관계 타입 생성 (작동 확인됨)
  {
    identifier: 'create-relation-type-working',
    name: 'CreateRelationTypeWorking',
    description: '새로운 관계 타입을 생성합니다 (작동 검증됨)',
    query: `mutation CreateRelationType($input: CreateRelationTypeInput!) {
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
      field
    }
  }
}`,
    variables: {
      input: {
        identifier: 'RELATED_TO',
        name: 'Related To',
        description: 'General relationship between entities',
      },
    },
    variablesSchema: {
      input: {
        type: 'object',
        required: true,
        properties: {
          identifier: {
            type: 'string',
            required: true,
            description: 'Unique identifier for the relation type',
          },
          name: {
            type: 'string',
            required: true,
            description: 'Human readable name for the relation type',
          },
          description: {
            type: 'string',
            description: 'Optional description of the relation type',
          },
        },
      },
    },
    defaultVariables: {
      input: {
        identifier: 'RELATED_TO',
        name: 'Related To',
        description: 'General relationship between entities',
      },
    },
    tags: ['relation', 'type', 'create', 'mutation', 'management', 'working', 'fixed'],
    complexityScore: 2,
    category: 'relation',
  },

  // 2. 노드 관계 생성
  {
    identifier: 'create-node-relation-working',
    name: 'CreateNodeRelationWorking',
    description: '두 노드 간에 관계를 생성합니다',
    query: `mutation CreateRelation($input: CreateRelationInput!) {
  createRelation(input: $input) {
    success
    relation {
      id
      createdAt
      updatedAt
      table {
        id
        identifier
        description
      }
      sourceNode {
        id
        title
        content
      }
      targetNode {
        id
        title
        content
      }
      relationType {
        id
        identifier
        name
        description
      }
    }
    errors {
      message
      code
      field
    }
  }
}`,
    variables: {
      input: {
        tableId: 'example-table-id',
        sourceNodeId: 'source-node-id',
        targetNodeId: 'target-node-id',
        relationTypeId: 'relation-type-id',
      },
    },
    variablesSchema: {
      input: {
        type: 'object',
        required: true,
        properties: {
          tableId: {
            type: 'string',
            required: true,
            description: 'ID of the table containing the nodes',
          },
          sourceNodeId: {
            type: 'string',
            required: true,
            description: 'ID of the source node',
          },
          targetNodeId: {
            type: 'string',
            required: true,
            description: 'ID of the target node',
          },
          relationTypeId: {
            type: 'string',
            required: true,
            description: 'ID of the relation type',
          },
        },
      },
    },
    defaultVariables: {
      input: {
        tableId: 'example-table-id',
        sourceNodeId: 'source-node-id',
        targetNodeId: 'target-node-id',
        relationTypeId: 'relation-type-id',
      },
    },
    tags: ['relation', 'node', 'create', 'mutation', 'connection', 'working', 'fixed'],
    complexityScore: 3,
    category: 'relation',
  },

  // 3. 관련 노드 검색 (기존 작동하는 기능)
  {
    identifier: 'search-related-nodes-working',
    name: 'SearchRelatedNodesWorking',
    description: '노드의 관련 노드들을 검색합니다',
    query: `query SearchRelatedNodes($filter: SearchRelatedNodesFilter!, $pagination: PaginationInput) {
  searchRelatedNodes(filter: $filter, pagination: $pagination) {
    nodes {
      id
      title
      content
      tableId
      createdAt
      updatedAt
      isActive
    }
    relations {
      id
      createdAt
      relationType {
        id
        identifier
        name
      }
      sourceNode {
        id
        title
      }
      targetNode {
        id
        title
      }
    }
    totalCount
    hasNextPage
    hasPreviousPage
  }
}`,
    variables: {
      filter: {
        sourceNodeId: 'example-node-id',
        direction: 'OUTGOING',
        maxDepth: 2,
      },
      pagination: {
        limit: 20,
        offset: 0,
      },
    },
    variablesSchema: {
      filter: {
        type: 'object',
        required: true,
        properties: {
          sourceNodeId: {
            type: 'string',
            required: true,
            description: 'Starting node for relationship search',
          },
          relationTypeIds: {
            type: 'array',
            description: 'Filter by specific relation types',
          },
          direction: {
            type: 'string',
            description: 'Direction of relationships (INCOMING, OUTGOING, BOTH)',
            default: 'OUTGOING',
          },
          maxDepth: {
            type: 'number',
            description: 'Maximum depth to search',
            default: 1,
          },
        },
      },
      pagination: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of results to return',
          },
          offset: {
            type: 'number',
            description: 'Offset for pagination',
          },
        },
      },
    },
    defaultVariables: {
      filter: {
        sourceNodeId: 'example-node-id',
        direction: 'OUTGOING',
        maxDepth: 2,
      },
      pagination: {
        limit: 20,
        offset: 0,
      },
    },
    tags: ['relation', 'search', 'nodes', 'query', 'traversal', 'working', 'fixed'],
    complexityScore: 4,
    category: 'relation',
  },

  // 4. 노드 간 경로 찾기
  {
    identifier: 'find-node-paths-working',
    name: 'FindNodePathsWorking',
    description: '두 노드 간의 경로를 찾습니다',
    query: `query FindPathsBetweenNodes($input: FindPathsInput!) {
  findPathsBetweenNodes(input: $input) {
    nodes {
      id
      title
      content
      tableId
    }
    relations {
      id
      relationType {
        id
        identifier
        name
      }
      sourceNode {
        id
        title
      }
      targetNode {
        id
        title
      }
    }
    length
    totalWeight
  }
}`,
    variables: {
      input: {
        sourceNodeId: 'source-node-id',
        targetNodeId: 'target-node-id',
        maxDepth: 3,
      },
    },
    variablesSchema: {
      input: {
        type: 'object',
        required: true,
        properties: {
          sourceNodeId: {
            type: 'string',
            required: true,
            description: 'Starting node ID',
          },
          targetNodeId: {
            type: 'string',
            required: true,
            description: 'Target node ID',
          },
          maxDepth: {
            type: 'number',
            description: 'Maximum path depth to search',
            default: 3,
          },
          relationTypeIds: {
            type: 'array',
            description: 'Filter by specific relation types',
          },
        },
      },
    },
    defaultVariables: {
      input: {
        sourceNodeId: 'source-node-id',
        targetNodeId: 'target-node-id',
        maxDepth: 3,
      },
    },
    tags: ['relation', 'pathfinding', 'query', 'graph', 'traversal', 'working', 'fixed'],
    complexityScore: 5,
    category: 'relation',
  },

  // 5. 의존성 체인 조회
  {
    identifier: 'get-dependency-chain-working',
    name: 'GetDependencyChainWorking',
    description: '노드의 의존성 체인을 조회합니다',
    query: `query GetDependencyChain($input: DependencyChainInput!) {
  getDependencyChain(input: $input) {
    nodes {
      id
      title
      content
      tableId
      createdAt
      updatedAt
    }
    relations {
      id
      relationType {
        id
        identifier
        name
        description
      }
      sourceNode {
        id
        title
      }
      targetNode {
        id
        title
      }
    }
    totalCount
    hasNextPage
    hasPreviousPage
  }
}`,
    variables: {
      input: {
        nodeId: 'example-node-id',
        direction: 'OUTGOING',
        maxDepth: 5,
      },
    },
    variablesSchema: {
      input: {
        type: 'object',
        required: true,
        properties: {
          nodeId: {
            type: 'string',
            required: true,
            description: 'Node to trace dependencies from',
          },
          direction: {
            type: 'string',
            description: 'Direction to trace (INCOMING, OUTGOING, BOTH)',
            default: 'OUTGOING',
          },
          maxDepth: {
            type: 'number',
            description: 'Maximum depth for dependency tracing',
            default: 5,
          },
          relationTypeIds: {
            type: 'array',
            description: 'Filter by specific relation types',
          },
        },
      },
    },
    defaultVariables: {
      input: {
        nodeId: 'example-node-id',
        direction: 'OUTGOING',
        maxDepth: 5,
      },
    },
    tags: ['relation', 'dependency', 'chain', 'query', 'tracing', 'working', 'fixed'],
    complexityScore: 4,
    category: 'relation',
  },
]

async function createWorkingRelationTemplate(template: RelationTemplate): Promise<boolean> {
  try {
    const mutation = `
      mutation CreateTemplate($input: CreateQueryTemplateInput!) {
        createTemplate(input: $input) {
          success
          template {
            id
            identifier
            name
            description
          }
          errors {
            field
            message
            code
          }
        }
      }
    `

    const variables = {
      input: {
        identifier: template.identifier,
        name: template.name,
        description: template.description,
        query: template.query,
        variables: template.variables,
        variablesSchema: template.variablesSchema,
        defaultVariables: template.defaultVariables,
        tags: template.tags,
        complexityScore: template.complexityScore,
        version: '1.0.0',
      },
    }

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error(`❌ HTTP 오류: ${response.status} ${response.statusText}`)
      console.error('응답 내용:', result)
      return false
    }

    if (result.errors) {
      console.error(`❌ GraphQL 오류:`, result.errors)
      return false
    }

    if (result.data?.createTemplate?.success) {
      const createdTemplate = result.data.createTemplate.template
      console.log(`  ✅ 성공: ${createdTemplate.name}`)
      console.log(`  📝 ID: ${createdTemplate.id}`)
      console.log(`  🎯 복잡도: ${template.complexityScore}/10`)
      console.log(
        `  🏷️ 태그: [${template.tags
          .filter((tag) => tag !== 'working' && tag !== 'fixed')
          .slice(0, 3)
          .join(', ')}]`
      )
      return true
    } else {
      console.error(`❌ 생성 실패: ${template.name}`)
      if (result.data?.createTemplate?.errors) {
        console.error('  오류:', result.data.createTemplate.errors)
      }
      return false
    }
  } catch (error) {
    console.error(`❌ 네트워크 오류: ${template.name}`, error)
    return false
  }
}

async function main() {
  console.log('🚀 작동하는 관계 기반 쿼리 템플릿 생성 시작')
  console.log(`📡 서버: ${GRAPHQL_ENDPOINT}`)
  console.log(`📋 생성할 템플릿 수: ${workingRelationTemplates.length}개`)
  console.log()

  let successCount = 0
  let failureCount = 0
  const createdTemplates: string[] = []

  for (const template of workingRelationTemplates) {
    console.log(`🔄 생성 중: ${template.identifier}`)

    const success = await createWorkingRelationTemplate(template)
    if (success) {
      successCount++
      createdTemplates.push(`${template.identifier}: ${template.name}`)
    } else {
      failureCount++
    }
    console.log()
  }

  console.log('📊 생성 결과 요약:')
  console.log(`  ✅ 성공: ${successCount}개`)
  console.log(`  ❌ 실패: ${failureCount}개`)
  console.log()

  if (successCount > 0) {
    console.log('✅ 생성된 관계 기반 템플릿들:')
    createdTemplates.forEach((template) => {
      const complexity =
        workingRelationTemplates.find((t) => template.startsWith(t.identifier))?.complexityScore ||
        1
      const icon = complexity >= 5 ? '🔥' : complexity >= 3 ? '⚡' : '🔍'
      console.log(`  ${icon} ${template}`)
    })
    console.log()
  }

  console.log('🎉 작동하는 관계 기반 템플릿 생성 완료!')
  console.log()
  console.log('💡 생성된 템플릿 기능:')
  console.log('  🏗️ 관계 타입 생성: CreateRelationType (검증됨)')
  console.log('  🔗 노드 관계 생성: CreateRelation')
  console.log('  🔍 관련 노드 검색: SearchRelatedNodes')
  console.log('  🛤️ 경로 찾기: FindPathsBetweenNodes')
  console.log('  🔄 의존성 체인: GetDependencyChain')
  console.log()
  console.log('💪 사용법:')
  console.log('  1. 먼저 관계 타입을 생성하세요 (create-relation-type-working)')
  console.log('  2. 노드 간 관계를 생성하세요 (create-node-relation-working)')
  console.log('  3. 관계 기반 분석을 수행하세요 (나머지 템플릿들)')
  console.log('  4. bun run export:fixed로 모든 템플릿을 내보내세요')
}

main().catch(console.error)

#!/usr/bin/env bun

/**
 * 기존 GraphQL 스키마에 맞는 관계(Relation) 템플릿 생성 스크립트
 *
 * 현재 시스템에 구현된 기능들을 기반으로 한 실용적 템플릿들:
 * 1. 관계 타입 관리 (CRUD)
 * 2. 노드 관계 관리 (CRUD)
 * 3. 관계 검색 및 조회
 * 4. 관련 노드 탐색
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

const relationTemplates: RelationTemplate[] = [
  // 1. 관계 타입 관리
  {
    identifier: 'create-relation-type-with-params',
    name: 'CreateRelationTypeWithParams',
    description: '새로운 관계 타입을 생성합니다 (파라미터화)',
    query: `mutation CreateRelationType($input: CreateRelationTypeInput!) {
  createRelationType(input: $input) {
    success
    relationType {
      id
      identifier
      description
      category
      createdAt
      updatedAt
    }
    errors {
      field
      message
      code
    }
  }
}`,
    variables: {
      input: {
        identifier: 'SIMILAR_TO',
        name: 'Similar To',
        description: '두 노드가 유사한 관계를 나타냅니다',
      },
    },
    variablesSchema: {
      input: {
        type: 'object',
        required: true,
        properties: {
          identifier: {
            type: 'string',
            description: '관계 타입 식별자 (UPPERCASE_WITH_UNDERSCORES)',
          },
          name: {
            type: 'string',
            description: '관계 타입 이름',
          },
          description: {
            type: 'string',
            description: '관계 타입 설명',
          },
        },
      },
    },
    defaultVariables: {
      input: {
        identifier: 'SIMILAR_TO',
        name: 'Similar To',
        description: '두 노드가 유사한 관계를 나타냅니다',
      },
    },
    tags: ['relation', 'mutation', 'type', 'create', 'parameterized', 'fixed'],
    complexityScore: 2,
    category: 'relation',
  },

  {
    identifier: 'get-relation-type-with-params',
    name: 'GetRelationTypeWithParams',
    description: '특정 관계 타입을 조회합니다 (파라미터화)',
    query: `query GetRelationType($id: ID!) {
  relationType(id: $id) {
    id
    identifier
    description
    category
    createdAt
    updatedAt
  }
}`,
    variables: {
      id: 'relation-type-id-example',
    },
    variablesSchema: {
      id: {
        type: 'string',
        required: true,
        description: '조회할 관계 타입 ID',
      },
    },
    defaultVariables: {
      id: 'relation-type-id-example',
    },
    tags: ['relation', 'query', 'type', 'get', 'parameterized', 'fixed'],
    complexityScore: 1,
    category: 'relation',
  },

  {
    identifier: 'list-relation-types-with-params',
    name: 'ListRelationTypesWithParams',
    description: '모든 관계 타입을 조회합니다 (파라미터화)',
    query: `query ListRelationTypes {
  relationTypes {
    id
    identifier
    description
    category
    createdAt
    updatedAt
  }
}`,
    variables: {},
    variablesSchema: {},
    defaultVariables: {},
    tags: ['relation', 'query', 'type', 'list', 'parameterized', 'fixed'],
    complexityScore: 1,
    category: 'relation',
  },

  // 2. 노드 관계 관리
  {
    identifier: 'create-node-relation-with-params',
    name: 'CreateNodeRelationWithParams',
    description: '두 노드 간의 관계를 생성합니다 (파라미터화)',
    query: `mutation CreateRelation($input: CreateRelationInput!) {
  createRelation(input: $input) {
    success
    relation {
      id
      tableId
      sourceNodeId
      sourceExternalId
      targetNodeId
      targetExternalId
      relationTypeId
      properties
      strength
      createdAt
      updatedAt
    }
    errors {
      field
      message
      code
    }
  }
}`,
    variables: {
      input: {
        tableId: 'table-example-id',
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
            description: '테이블 ID',
          },
          sourceNodeId: {
            type: 'string',
            description: '소스 노드 ID',
          },
          targetNodeId: {
            type: 'string',
            description: '타겟 노드 ID',
          },
          relationTypeId: {
            type: 'string',
            description: '관계 타입 ID',
          },
        },
      },
    },
    defaultVariables: {
      input: {
        tableId: 'table-example-id',
        sourceNodeId: 'source-node-id',
        targetNodeId: 'target-node-id',
        relationTypeId: 'relation-type-id',
      },
    },
    tags: ['relation', 'mutation', 'create', 'node', 'parameterized', 'fixed'],
    complexityScore: 3,
    category: 'relation',
  },

  {
    identifier: 'get-node-relation-with-params',
    name: 'GetNodeRelationWithParams',
    description: '특정 노드 관계를 조회합니다 (파라미터화)',
    query: `query GetNodeRelation($id: ID!) {
  nodeRelation(id: $id) {
    id
    tableId
    sourceNodeId
    sourceExternalId
    targetNodeId
    targetExternalId
    relationTypeId
    properties
    strength
    createdAt
    updatedAt
  }
}`,
    variables: {
      id: 'node-relation-id-example',
    },
    variablesSchema: {
      id: {
        type: 'string',
        required: true,
        description: '조회할 노드 관계 ID',
      },
    },
    defaultVariables: {
      id: 'node-relation-id-example',
    },
    tags: ['relation', 'query', 'get', 'node', 'parameterized', 'fixed'],
    complexityScore: 2,
    category: 'relation',
  },

  {
    identifier: 'list-node-relations-with-params',
    name: 'ListNodeRelationsWithParams',
    description: '노드 관계 목록을 조회합니다 (파라미터화)',
    query: `query ListNodeRelations($pagination: Pagination) {
  nodeRelations(pagination: $pagination) {
    nodes {
      id
      tableId
      sourceNodeId
      sourceExternalId
      targetNodeId
      targetExternalId
      relationTypeId
      properties
      strength
      createdAt
      updatedAt
    }
    totalCount
    hasNextPage
    hasPreviousPage
  }
}`,
    variables: {
      pagination: {
        limit: 20,
        offset: 0,
      },
    },
    variablesSchema: {
      pagination: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: '조회할 개수',
          },
          offset: {
            type: 'number',
            description: '시작 위치',
          },
        },
      },
    },
    defaultVariables: {
      pagination: {
        limit: 20,
        offset: 0,
      },
    },
    tags: ['relation', 'query', 'list', 'node', 'pagination', 'parameterized', 'fixed'],
    complexityScore: 3,
    category: 'relation',
  },

  {
    identifier: 'delete-node-relation-with-params',
    name: 'DeleteNodeRelationWithParams',
    description: '노드 관계를 삭제합니다 (파라미터화)',
    query: `mutation DeleteRelation($id: ID!) {
  deleteRelation(id: $id)
}`,
    variables: {
      id: 'relation-to-delete-id',
    },
    variablesSchema: {
      id: {
        type: 'string',
        required: true,
        description: '삭제할 관계 ID',
      },
    },
    defaultVariables: {
      id: 'relation-to-delete-id',
    },
    tags: ['relation', 'mutation', 'delete', 'node', 'parameterized', 'fixed'],
    complexityScore: 2,
    category: 'relation',
  },

  // 3. 관련 노드 검색
  {
    identifier: 'search-related-nodes-simple-with-params',
    name: 'SearchRelatedNodesSimpleWithParams',
    description: '관련된 노드들을 검색합니다 (파라미터화)',
    query: `query SearchRelatedNodes($filter: SearchRelatedNodesFilter, $pagination: Pagination) {
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
      tableId
      sourceNodeId
      sourceExternalId
      targetNodeId
      targetExternalId
      relationTypeId
      strength
      createdAt
    }
    totalCount
    hasNextPage
    hasPreviousPage
  }
}`,
    variables: {
      filter: {
        nodeId: 'source-node-id',
        relationTypeId: 'relation-type-id',
        direction: 'BOTH',
      },
      pagination: {
        limit: 10,
        offset: 0,
      },
    },
    variablesSchema: {
      filter: {
        type: 'object',
        properties: {
          nodeId: {
            type: 'string',
            description: '기준이 되는 노드 ID',
          },
          relationTypeId: {
            type: 'string',
            description: '필터링할 관계 타입 ID',
          },
          direction: {
            type: 'string',
            description: '관계 방향 (OUTGOING, INCOMING, BOTH)',
          },
        },
      },
      pagination: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: '조회할 개수',
          },
          offset: {
            type: 'number',
            description: '시작 위치',
          },
        },
      },
    },
    defaultVariables: {
      filter: {
        nodeId: 'source-node-id',
        relationTypeId: 'relation-type-id',
        direction: 'BOTH',
      },
      pagination: {
        limit: 10,
        offset: 0,
      },
    },
    tags: ['relation', 'query', 'search', 'node', 'related', 'parameterized', 'fixed'],
    complexityScore: 4,
    category: 'relation',
  },

  // 4. 의존성 체인 조회
  {
    identifier: 'get-dependency-chain-with-params',
    name: 'GetDependencyChainWithParams',
    description: '노드의 의존성 체인을 조회합니다 (파라미터화)',
    query: `query GetDependencyChain($nodeId: ID!, $maxDepth: Int, $direction: String) {
  getDependencyChain(nodeId: $nodeId, maxDepth: $maxDepth, direction: $direction) {
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
      tableId
      sourceNodeId
      sourceExternalId
      targetNodeId
      targetExternalId
      relationTypeId
      strength
      createdAt
    }
    totalCount
    hasNextPage
    hasPreviousPage
  }
}`,
    variables: {
      nodeId: 'start-node-id',
      maxDepth: 5,
      direction: 'OUTGOING',
    },
    variablesSchema: {
      nodeId: {
        type: 'string',
        required: true,
        description: '시작 노드 ID',
      },
      maxDepth: {
        type: 'number',
        description: '최대 탐색 깊이',
      },
      direction: {
        type: 'string',
        description: '탐색 방향 (OUTGOING, INCOMING, BOTH)',
      },
    },
    defaultVariables: {
      nodeId: 'start-node-id',
      maxDepth: 5,
      direction: 'OUTGOING',
    },
    tags: ['relation', 'query', 'dependency', 'chain', 'graph', 'parameterized', 'fixed'],
    complexityScore: 5,
    category: 'relation',
  },
]

async function createRelationTemplate(template: RelationTemplate): Promise<boolean> {
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
        category: template.category,
        version: '1.0.0',
        isActive: true,
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

    if (!response.ok) {
      console.error(`❌ HTTP 오류: ${response.status} ${response.statusText}`)
      return false
    }

    const result = await response.json()

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
        `  🏷️ 카테고리: [${template.tags
          .filter((tag) => tag !== 'parameterized' && tag !== 'fixed')
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
  console.log('🚀 실용적 관계(Relation) 템플릿 생성 시작')
  console.log(`📡 서버: ${GRAPHQL_ENDPOINT}`)
  console.log(`📋 생성할 템플릿 수: ${relationTemplates.length}개`)
  console.log()

  let successCount = 0
  let failureCount = 0
  const createdTemplates: string[] = []

  for (const template of relationTemplates) {
    console.log(`🔄 생성 중: ${template.identifier}`)

    const success = await createRelationTemplate(template)
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
    console.log('✅ 생성된 관계 템플릿들:')
    createdTemplates.forEach((template) => {
      const complexity =
        relationTemplates.find((t) => template.startsWith(t.identifier))?.complexityScore || 1
      const icon = complexity >= 4 ? '🔥' : complexity >= 3 ? '⚡' : '🔍'
      console.log(`  ${icon} ${template}`)
    })
    console.log()
  }

  console.log('🎉 관계 템플릿 생성 완료!')
  console.log()
  console.log('💡 기능별 템플릿 카테고리:')
  console.log('  🏷️ Relation Types: 관계 타입 생성, 조회, 목록')
  console.log('  🔗 Node Relations: 노드 간 관계 생성, 조회, 삭제')
  console.log('  🔍 Related Search: 관련 노드 검색 및 탐색')
  console.log('  📊 Dependency Chain: 의존성 체인 및 그래프 분석')
  console.log()
  console.log('💪 사용법:')
  console.log('  1. bun run export:fixed - 모든 Fixed 템플릿들 export')
  console.log('  2. 관계 타입 템플릿으로 관계 스키마 구축')
  console.log('  3. 노드 관계 템플릿으로 데이터 연결')
  console.log('  4. 검색 템플릿으로 관련 정보 탐색')
}

main().catch(console.error)

#!/usr/bin/env bun

/**
 * 관계 타입(RelationType) 기반 쿼리 템플릿 생성 스크립트
 *
 * 실제 GraphQL 스키마의 RelationType과 NodeRelation을 활용한 템플릿들:
 * 1. 관계 타입 관리 (CRUD)
 * 2. 관계 타입 기반 노드 관계 분석
 * 3. 관계 타입별 통계 및 분석
 * 4. 관계 네트워크 탐색
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

const relationTypeTemplates: RelationTemplate[] = [
  // 1. 관계 타입 기본 관리
  {
    identifier: 'list-all-relation-types-with-params',
    name: 'ListAllRelationTypesWithParams',
    description: '모든 관계 타입을 조회합니다 (파라미터화)',
    query: `query ListAllRelationTypes($pagination: PaginationInput, $sort: [SortInput!]) {
  relationTypes(pagination: $pagination, sort: $sort) {
    nodes {
      id
      identifier
      name
      description
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
        limit: 50,
        offset: 0,
      },
      sort: [
        {
          field: 'name',
          direction: 'ASC',
        },
      ],
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
      sort: {
        type: 'array',
        description: '정렬 조건',
      },
    },
    defaultVariables: {
      pagination: {
        limit: 50,
        offset: 0,
      },
      sort: [
        {
          field: 'name',
          direction: 'ASC',
        },
      ],
    },
    tags: ['relation', 'type', 'query', 'list', 'management', 'parameterized', 'fixed'],
    complexityScore: 2,
    category: 'relation',
  },

  {
    identifier: 'get-relation-type-by-identifier-with-params',
    name: 'GetRelationTypeByIdentifierWithParams',
    description: '식별자로 관계 타입을 조회합니다 (파라미터화)',
    query: `query GetRelationTypeByIdentifier($identifier: String!) {
  relationTypeByIdentifier(identifier: $identifier) {
    id
    identifier
    name
    description
    createdAt
    updatedAt
  }
}`,
    variables: {
      identifier: 'RELATED_TO',
    },
    variablesSchema: {
      identifier: {
        type: 'string',
        required: true,
        description: '관계 타입 식별자 (예: RELATED_TO, DEPENDS_ON, CONTAINS)',
      },
    },
    defaultVariables: {
      identifier: 'RELATED_TO',
    },
    tags: ['relation', 'type', 'query', 'identifier', 'parameterized', 'fixed'],
    complexityScore: 1,
    category: 'relation',
  },

  // 2. 노드 관계 조회 및 분석
  {
    identifier: 'get-node-relations-with-params',
    name: 'GetNodeRelationsWithParams',
    description: '노드 관계를 조회합니다 (파라미터화)',
    query: `query GetNodeRelations($filter: NodeRelationsFilter, $pagination: PaginationInput, $sort: [SortInput!]) {
  nodeRelations(filter: $filter, pagination: $pagination, sort: $sort) {
    nodes {
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
    totalCount
    hasNextPage
    hasPreviousPage
  }
}`,
    variables: {
      filter: {
        tableId: 'target-table-id',
      },
      pagination: {
        limit: 20,
        offset: 0,
      },
      sort: [
        {
          field: 'createdAt',
          direction: 'DESC',
        },
      ],
    },
    variablesSchema: {
      filter: {
        type: 'object',
        properties: {
          tableId: {
            type: 'string',
            description: '특정 테이블의 관계만 조회',
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
        tableId: 'target-table-id',
      },
      pagination: {
        limit: 20,
        offset: 0,
      },
      sort: [
        {
          field: 'createdAt',
          direction: 'DESC',
        },
      ],
    },
    tags: ['relation', 'node', 'query', 'analysis', 'filter', 'parameterized', 'fixed'],
    complexityScore: 4,
    category: 'relation',
  },

  {
    identifier: 'get-single-node-relation-with-params',
    name: 'GetSingleNodeRelationWithParams',
    description: '특정 노드 관계의 상세 정보를 조회합니다 (파라미터화)',
    query: `query GetSingleNodeRelation($relationId: ID!) {
  nodeRelation(id: $relationId) {
    id
    createdAt
    updatedAt

    table {
      id
      identifier
      description
      nodeCount
      attributeCount
    }

    sourceNode {
      id
      title
      content
      createdAt
      updatedAt
      isActive
    }

    targetNode {
      id
      title
      content
      createdAt
      updatedAt
      isActive
    }

    relationType {
      id
      identifier
      name
      description
      createdAt
      updatedAt
    }
  }
}`,
    variables: {
      relationId: 'node-relation-id-example',
    },
    variablesSchema: {
      relationId: {
        type: 'string',
        required: true,
        description: '조회할 노드 관계 ID',
      },
    },
    defaultVariables: {
      relationId: 'node-relation-id-example',
    },
    tags: ['relation', 'node', 'query', 'detail', 'single', 'parameterized', 'fixed'],
    complexityScore: 3,
    category: 'relation',
  },

  // 3. 관계 타입별 분석
  {
    identifier: 'analyze-relations-by-type-with-params',
    name: 'AnalyzeRelationsByTypeWithParams',
    description: '특정 관계 타입의 모든 관계를 분석합니다 (파라미터화)',
    query: `query AnalyzeRelationsByType($relationTypeId: ID!, $includeNodeDetails: Boolean!) {
  relationType(id: $relationTypeId) {
    id
    identifier
    name
    description
    createdAt
    updatedAt
  }

  nodeRelations(
    filter: { relationTypeId: $relationTypeId }
    pagination: { limit: 100 }
    sort: [{ field: "createdAt", direction: DESC }]
  ) {
    nodes {
      id
      createdAt
      updatedAt

      table {
        id
        identifier
        description
      }

      sourceNode @include(if: $includeNodeDetails) {
        id
        title
        content
        tableId
      }

      targetNode @include(if: $includeNodeDetails) {
        id
        title
        content
        tableId
      }

      relationType {
        id
        identifier
        name
      }
    }
    totalCount
  }
}`,
    variables: {
      relationTypeId: 'relation-type-id',
      includeNodeDetails: true,
    },
    variablesSchema: {
      relationTypeId: {
        type: 'string',
        required: true,
        description: '분석할 관계 타입 ID',
      },
      includeNodeDetails: {
        type: 'boolean',
        required: true,
        description: '노드 상세 정보 포함 여부',
      },
    },
    defaultVariables: {
      relationTypeId: 'relation-type-id',
      includeNodeDetails: true,
    },
    tags: ['relation', 'type', 'analysis', 'statistics', 'query', 'parameterized', 'fixed'],
    complexityScore: 5,
    category: 'relation',
  },

  // 4. 관계 네트워크 탐색
  {
    identifier: 'explore-node-network-with-params',
    name: 'ExploreNodeNetworkWithParams',
    description: '노드를 중심으로 관계 네트워크를 탐색합니다 (파라미터화)',
    query: `query ExploreNodeNetwork($nodeId: ID!, $relationTypeIds: [ID!], $maxDepth: Int!) {
  centralNode: node(id: $nodeId) {
    id
    title
    content
    tableId
    createdAt
    updatedAt
    isActive

    table {
      id
      identifier
      description
    }
  }

  outgoingRelations: nodeRelations(
    filter: { sourceNodeId: $nodeId, relationTypeIds: $relationTypeIds }
    pagination: { limit: 50 }
  ) {
    nodes {
      id
      createdAt

      targetNode {
        id
        title
        content
        tableId
      }

      relationType {
        id
        identifier
        name
        description
      }
    }
    totalCount
  }

  incomingRelations: nodeRelations(
    filter: { targetNodeId: $nodeId, relationTypeIds: $relationTypeIds }
    pagination: { limit: 50 }
  ) {
    nodes {
      id
      createdAt

      sourceNode {
        id
        title
        content
        tableId
      }

      relationType {
        id
        identifier
        name
        description
      }
    }
    totalCount
  }
}`,
    variables: {
      nodeId: 'central-node-id',
      relationTypeIds: ['type1-id', 'type2-id'],
      maxDepth: 2,
    },
    variablesSchema: {
      nodeId: {
        type: 'string',
        required: true,
        description: '중심 노드 ID',
      },
      relationTypeIds: {
        type: 'array',
        description: '탐색할 관계 타입 ID 목록',
      },
      maxDepth: {
        type: 'number',
        required: true,
        description: '최대 탐색 깊이',
      },
    },
    defaultVariables: {
      nodeId: 'central-node-id',
      relationTypeIds: ['type1-id', 'type2-id'],
      maxDepth: 2,
    },
    tags: ['relation', 'network', 'exploration', 'graph', 'navigation', 'parameterized', 'fixed'],
    complexityScore: 6,
    category: 'relation',
  },
]

async function createRelationTypeTemplate(template: RelationTemplate): Promise<boolean> {
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
  console.log('🚀 관계 타입 기반 쿼리 템플릿 생성 시작')
  console.log(`📡 서버: ${GRAPHQL_ENDPOINT}`)
  console.log(`📋 생성할 템플릿 수: ${relationTypeTemplates.length}개`)
  console.log()

  let successCount = 0
  let failureCount = 0
  const createdTemplates: string[] = []

  for (const template of relationTypeTemplates) {
    console.log(`🔄 생성 중: ${template.identifier}`)

    const success = await createRelationTypeTemplate(template)
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
    console.log('✅ 생성된 관계 타입 템플릿들:')
    createdTemplates.forEach((template) => {
      const complexity =
        relationTypeTemplates.find((t) => template.startsWith(t.identifier))?.complexityScore || 1
      const icon = complexity >= 5 ? '🔥' : complexity >= 3 ? '⚡' : '🔍'
      console.log(`  ${icon} ${template}`)
    })
    console.log()
  }

  console.log('🎉 관계 타입 기반 템플릿 생성 완료!')
  console.log()
  console.log('💡 기능별 템플릿 카테고리:')
  console.log('  🏷️ Type Management: 관계 타입 조회 및 관리')
  console.log('  🔗 Relation Analysis: 노드 관계 분석 및 조회')
  console.log('  📊 Type Analytics: 관계 타입별 통계 및 분석')
  console.log('  🕸️ Network Exploration: 관계 네트워크 탐색 및 네비게이션')
  console.log()
  console.log('💪 사용법:')
  console.log('  1. bun run export:fixed - 모든 Fixed 템플릿들 export')
  console.log('  2. 관계 타입 관리로 스키마 구축')
  console.log('  3. 관계 분석으로 연결성 파악')
  console.log('  4. 네트워크 탐색으로 그래프 구조 분석')
}

main().catch(console.error)

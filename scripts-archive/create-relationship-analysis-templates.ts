#!/usr/bin/env bun

/**
 * 관계 분석 중심의 실용적 템플릿 생성 스크립트
 *
 * 현재 작동하는 시스템을 기반으로 관계형 데이터 분석에 특화된 템플릿들:
 * 1. 노드 간 연결성 분석
 * 2. 테이블 관계 및 구조 분석
 * 3. 데이터 네트워크 패턴 분석
 * 4. 관계형 검색 및 탐색
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
  // 1. 노드 간 연결성 분석
  {
    identifier: 'find-connected-nodes-with-params',
    name: 'FindConnectedNodesWithParams',
    description: '특정 노드와 연결된 노드들을 찾습니다 (파라미터화)',
    query: `query FindConnectedNodes($nodeId: ID!, $tableId: ID, $searchTerm: String, $pagination: NodesPagination) {
  node(id: $nodeId) {
    id
    title
    content
    tableId
    createdAt
    updatedAt
  }

  searchNodes(
    filter: { searchTerm: $searchTerm, tableId: $tableId }
    pagination: $pagination
  ) {
    id
    title
    content
    tableId
    createdAt
    updatedAt
    isActive
    relevanceScore
  }
}`,
    variables: {
      nodeId: 'target-node-id',
      tableId: 'same-table-id',
      searchTerm: 'related content',
      pagination: {
        limit: 20,
        offset: 0,
      },
    },
    variablesSchema: {
      nodeId: {
        type: 'string',
        required: true,
        description: '기준 노드 ID',
      },
      tableId: {
        type: 'string',
        description: '검색할 테이블 ID (같은 테이블 내에서)',
      },
      searchTerm: {
        type: 'string',
        description: '관련 내용 검색어',
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
      nodeId: 'target-node-id',
      tableId: 'same-table-id',
      searchTerm: 'related content',
      pagination: {
        limit: 20,
        offset: 0,
      },
    },
    tags: ['relation', 'query', 'nodes', 'connected', 'search', 'parameterized', 'fixed'],
    complexityScore: 4,
    category: 'relation',
  },

  // 2. 테이블 간 관계 분석
  {
    identifier: 'analyze-table-relationships-simple-with-params',
    name: 'AnalyzeTableRelationshipsSimpleWithParams',
    description: '테이블 간의 관계와 구조를 분석합니다 (파라미터화)',
    query: `query AnalyzeTableRelationships($tableIds: [ID!], $includeNodes: Boolean) {
  tables(filter: { ids: $tableIds }) {
    nodes {
      id
      identifier
      description
      createdAt
      updatedAt
      nodeCount
      attributeCount
      isActive

      nodes(pagination: { limit: 5 }) @include(if: $includeNodes) {
        nodes {
          id
          title
          content
          createdAt
        }
        totalCount
      }

      attributes {
        nodes {
          id
          identifier
          description
          isRequired
          defaultValue
          attributeType {
            id
            identifier
            name
            dataType
          }
        }
        totalCount
      }
    }
    totalCount
  }
}`,
    variables: {
      tableIds: ['table1-id', 'table2-id'],
      includeNodes: true,
    },
    variablesSchema: {
      tableIds: {
        type: 'array',
        required: true,
        description: '분석할 테이블 ID 목록',
      },
      includeNodes: {
        type: 'boolean',
        description: '노드 정보 포함 여부',
      },
    },
    defaultVariables: {
      tableIds: ['table1-id', 'table2-id'],
      includeNodes: true,
    },
    tags: ['relation', 'query', 'table', 'analysis', 'structure', 'parameterized', 'fixed'],
    complexityScore: 5,
    category: 'relation',
  },

  // 3. 콘텐츠 기반 관련성 분석
  {
    identifier: 'find-similar-content-with-params',
    name: 'FindSimilarContentWithParams',
    description: '콘텐츠 유사성을 기반으로 관련 노드를 찾습니다 (파라미터화)',
    query: `query FindSimilarContent($referenceNodeId: ID!, $searchTerm: String!, $tableId: ID, $pagination: NodesPagination) {
  referenceNode: node(id: $referenceNodeId) {
    id
    title
    content
    tableId
    createdAt
  }

  similarNodes: searchNodes(
    filter: { searchTerm: $searchTerm, tableId: $tableId }
    pagination: $pagination
    sort: [{ field: "relevanceScore", direction: DESC }]
  ) {
    id
    title
    content
    tableId
    createdAt
    updatedAt
    relevanceScore
  }
}`,
    variables: {
      referenceNodeId: 'reference-node-id',
      searchTerm: 'similar keywords',
      tableId: null,
      pagination: {
        limit: 15,
        offset: 0,
      },
    },
    variablesSchema: {
      referenceNodeId: {
        type: 'string',
        required: true,
        description: '기준이 되는 노드 ID',
      },
      searchTerm: {
        type: 'string',
        required: true,
        description: '유사성 검색 키워드',
      },
      tableId: {
        type: 'string',
        description: '검색할 테이블 ID (null이면 전체)',
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
      referenceNodeId: 'reference-node-id',
      searchTerm: 'similar keywords',
      tableId: null,
      pagination: {
        limit: 15,
        offset: 0,
      },
    },
    tags: ['relation', 'query', 'similarity', 'content', 'search', 'parameterized', 'fixed'],
    complexityScore: 4,
    category: 'relation',
  },

  // 4. 테이블 구조 비교 분석
  {
    identifier: 'compare-table-structures-with-params',
    name: 'CompareTableStructuresWithParams',
    description: '여러 테이블의 구조를 비교 분석합니다 (파라미터화)',
    query: `query CompareTableStructures($tableIds: [ID!]!) {
  tables(filter: { ids: $tableIds }) {
    nodes {
      id
      identifier
      description
      nodeCount
      attributeCount
      createdAt
      updatedAt

      attributes {
        nodes {
          id
          identifier
          description
          isRequired
          defaultValue
          attributeType {
            id
            identifier
            name
            dataType
            description
          }
        }
        totalCount
      }
    }
    totalCount
  }
}`,
    variables: {
      tableIds: ['table1-id', 'table2-id', 'table3-id'],
    },
    variablesSchema: {
      tableIds: {
        type: 'array',
        required: true,
        description: '비교할 테이블 ID 목록',
      },
    },
    defaultVariables: {
      tableIds: ['table1-id', 'table2-id', 'table3-id'],
    },
    tags: ['relation', 'query', 'table', 'compare', 'structure', 'parameterized', 'fixed'],
    complexityScore: 4,
    category: 'relation',
  },

  // 5. 노드 클러스터 분석
  {
    identifier: 'analyze-node-clusters-with-params',
    name: 'AnalyzeNodeClustersWithParams',
    description: '노드들의 클러스터링 패턴을 분석합니다 (파라미터화)',
    query: `query AnalyzeNodeClusters($tableId: ID!, $searchTerms: [String!], $dateRange: String) {
  table(id: $tableId) {
    id
    identifier
    description
    nodeCount
    attributeCount

    nodes(pagination: { limit: 50 }) {
      nodes {
        id
        title
        content
        createdAt
        updatedAt
        isActive
        attributes {
          nodes {
            id
            identifier
            value
            attributeType {
              name
              dataType
            }
          }
        }
      }
      totalCount
    }
  }

  searchResults: searchNodes(
    filter: { tableId: $tableId }
    pagination: { limit: 100 }
    sort: [{ field: "createdAt", direction: DESC }]
  ) {
    id
    title
    content
    createdAt
    relevanceScore
  }
}`,
    variables: {
      tableId: 'target-table-id',
      searchTerms: ['cluster1', 'cluster2', 'cluster3'],
      dateRange: '2024-01-01',
    },
    variablesSchema: {
      tableId: {
        type: 'string',
        required: true,
        description: '분석할 테이블 ID',
      },
      searchTerms: {
        type: 'array',
        description: '클러스터 식별 키워드들',
      },
      dateRange: {
        type: 'string',
        description: '분석 기간 시작일',
      },
    },
    defaultVariables: {
      tableId: 'target-table-id',
      searchTerms: ['cluster1', 'cluster2', 'cluster3'],
      dateRange: '2024-01-01',
    },
    tags: ['relation', 'query', 'cluster', 'analysis', 'pattern', 'parameterized', 'fixed'],
    complexityScore: 6,
    category: 'relation',
  },

  // 6. 관계형 데이터 네비게이션
  {
    identifier: 'navigate-related-data-with-params',
    name: 'NavigateRelatedDataWithParams',
    description: '관련 데이터를 따라 네비게이션합니다 (파라미터화)',
    query: `query NavigateRelatedData($startNodeId: ID!, $maxDepth: Int!, $includeAttributes: Boolean) {
  startNode: node(id: $startNodeId) {
    id
    title
    content
    tableId

    table {
      id
      identifier
      description
      nodeCount
    }

    attributes @include(if: $includeAttributes) {
      nodes {
        id
        identifier
        value
        attributeType {
          name
          dataType
        }
      }
    }
  }

  relatedNodes: searchNodes(
    filter: { tableId: null }
    pagination: { limit: 20 }
  ) {
    id
    title
    content
    tableId
    createdAt
    relevanceScore

    table {
      id
      identifier
      description
    }
  }
}`,
    variables: {
      startNodeId: 'start-node-id',
      maxDepth: 3,
      includeAttributes: true,
    },
    variablesSchema: {
      startNodeId: {
        type: 'string',
        required: true,
        description: '시작 노드 ID',
      },
      maxDepth: {
        type: 'number',
        required: true,
        description: '최대 탐색 깊이',
      },
      includeAttributes: {
        type: 'boolean',
        description: '속성 정보 포함 여부',
      },
    },
    defaultVariables: {
      startNodeId: 'start-node-id',
      maxDepth: 3,
      includeAttributes: true,
    },
    tags: ['relation', 'query', 'navigation', 'traverse', 'data', 'parameterized', 'fixed'],
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
  console.log('🚀 관계형 데이터 분석 템플릿 생성 시작')
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
    console.log('✅ 생성된 관계형 분석 템플릿들:')
    createdTemplates.forEach((template) => {
      const complexity =
        relationTemplates.find((t) => template.startsWith(t.identifier))?.complexityScore || 1
      const icon = complexity >= 5 ? '🔥' : complexity >= 4 ? '⚡' : '🔍'
      console.log(`  ${icon} ${template}`)
    })
    console.log()
  }

  console.log('🎉 관계형 데이터 분석 템플릿 생성 완료!')
  console.log()
  console.log('💡 기능별 템플릿 카테고리:')
  console.log('  🔗 Connected Analysis: 노드 간 연결성 및 관련성 분석')
  console.log('  🏗️ Structure Analysis: 테이블 구조 및 관계 분석')
  console.log('  🔍 Content Similarity: 콘텐츠 기반 유사성 검색')
  console.log('  📊 Cluster Analysis: 노드 클러스터링 및 패턴 분석')
  console.log('  🧭 Data Navigation: 관련 데이터 네비게이션 및 탐색')
  console.log()
  console.log('💪 사용법:')
  console.log('  1. bun run export:fixed - 모든 Fixed 템플릿들 export')
  console.log('  2. 연결성 분석으로 노드 간 관계 파악')
  console.log('  3. 구조 분석으로 테이블 설계 최적화')
  console.log('  4. 유사성 검색으로 관련 콘텐츠 발견')
}

main().catch(console.error)

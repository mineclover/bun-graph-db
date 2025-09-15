#!/usr/bin/env bun

/**
 * 기존 성공 패턴을 따른 간단한 관계 분석 템플릿 생성
 *
 * 검증된 쿼리 패턴만을 사용한 관계형 분석 템플릿들:
 * 1. 노드 관계 검색
 * 2. 테이블 연관 분석
 * 3. 콘텐츠 관련성 탐색
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
  // 1. 관련 노드 검색 (기존 패턴 활용)
  {
    identifier: 'search-related-nodes-by-content-params',
    name: 'SearchRelatedNodesByContentParams',
    description: '콘텐츠 기반으로 관련 노드를 검색합니다 (파라미터화)',
    query: `query SearchRelatedNodesByContent($filter: SearchNodesFilter!, $pagination: NodesPagination, $sort: [NodeSortInput!]) {
  searchNodes(filter: $filter, pagination: $pagination, sort: $sort) {
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
      filter: {
        searchTerm: '관련 키워드',
        tableId: null,
      },
      pagination: {
        limit: 20,
        offset: 0,
      },
      sort: [
        {
          field: 'relevanceScore',
          direction: 'DESC',
        },
      ],
    },
    variablesSchema: {
      filter: {
        type: 'object',
        required: true,
        properties: {
          searchTerm: {
            type: 'string',
            description: '관련 콘텐츠 검색 키워드',
          },
          tableId: {
            type: 'string',
            description: '특정 테이블로 제한 (null이면 전체)',
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
        searchTerm: '관련 키워드',
        tableId: null,
      },
      pagination: {
        limit: 20,
        offset: 0,
      },
      sort: [
        {
          field: 'relevanceScore',
          direction: 'DESC',
        },
      ],
    },
    tags: ['relation', 'query', 'search', 'content', 'relevance', 'parameterized', 'fixed'],
    complexityScore: 3,
    category: 'relation',
  },

  // 2. 같은 테이블 내 관련 노드 탐색
  {
    identifier: 'find-nodes-in-same-table-params',
    name: 'FindNodesInSameTableParams',
    description: '같은 테이블 내에서 관련 노드들을 찾습니다 (파라미터화)',
    query: `query FindNodesInSameTable($tableId: ID!, $searchTerm: String, $pagination: NodesPagination) {
  table(id: $tableId) {
    id
    identifier
    description
    nodeCount
    attributeCount
    isActive
  }

  searchNodes(
    filter: { searchTerm: $searchTerm, tableId: $tableId }
    pagination: $pagination
    sort: [{ field: "createdAt", direction: DESC }]
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
      tableId: 'target-table-id',
      searchTerm: '검색어',
      pagination: {
        limit: 15,
        offset: 0,
      },
    },
    variablesSchema: {
      tableId: {
        type: 'string',
        required: true,
        description: '검색할 테이블 ID',
      },
      searchTerm: {
        type: 'string',
        description: '검색할 키워드',
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
      tableId: 'target-table-id',
      searchTerm: '검색어',
      pagination: {
        limit: 15,
        offset: 0,
      },
    },
    tags: ['relation', 'query', 'table', 'nodes', 'same-table', 'parameterized', 'fixed'],
    complexityScore: 3,
    category: 'relation',
  },

  // 3. 테이블 간 구조 비교
  {
    identifier: 'compare-table-structures-simple-params',
    name: 'CompareTableStructuresSimpleParams',
    description: '여러 테이블의 구조를 비교합니다 (파라미터화)',
    query: `query CompareTableStructures($tableIds: [ID!]!) {
  tables(filter: { ids: $tableIds }) {
    nodes {
      id
      identifier
      description
      nodeCount
      attributeCount
      isActive
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
    },
    variablesSchema: {
      tableIds: {
        type: 'array',
        required: true,
        description: '비교할 테이블 ID 목록',
      },
    },
    defaultVariables: {
      tableIds: ['table1-id', 'table2-id'],
    },
    tags: ['relation', 'query', 'table', 'compare', 'structure', 'parameterized', 'fixed'],
    complexityScore: 4,
    category: 'relation',
  },

  // 4. 노드 기반 관련 정보 조회
  {
    identifier: 'get-node-context-with-params',
    name: 'GetNodeContextWithParams',
    description: '노드와 관련된 컨텍스트 정보를 조회합니다 (파라미터화)',
    query: `query GetNodeContext($nodeId: ID!, $includeAttributes: Boolean!) {
  node(id: $nodeId) {
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
      nodeCount
      attributeCount
    }

    attributes @include(if: $includeAttributes) {
      nodes {
        id
        identifier
        value
        description
        attributeType {
          id
          name
          dataType
        }
      }
      totalCount
    }
  }
}`,
    variables: {
      nodeId: 'target-node-id',
      includeAttributes: true,
    },
    variablesSchema: {
      nodeId: {
        type: 'string',
        required: true,
        description: '조회할 노드 ID',
      },
      includeAttributes: {
        type: 'boolean',
        required: true,
        description: '속성 정보 포함 여부',
      },
    },
    defaultVariables: {
      nodeId: 'target-node-id',
      includeAttributes: true,
    },
    tags: ['relation', 'query', 'node', 'context', 'attributes', 'parameterized', 'fixed'],
    complexityScore: 3,
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
  console.log('🚀 간단한 관계 분석 템플릿 생성 시작')
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
    console.log('✅ 생성된 관계 분석 템플릿들:')
    createdTemplates.forEach((template) => {
      const complexity =
        relationTemplates.find((t) => template.startsWith(t.identifier))?.complexityScore || 1
      const icon = complexity >= 4 ? '⚡' : '🔍'
      console.log(`  ${icon} ${template}`)
    })
    console.log()
  }

  console.log('🎉 관계 분석 템플릿 생성 완료!')
  console.log()
  console.log('💡 기능별 템플릿 카테고리:')
  console.log('  🔍 Content Search: 콘텐츠 기반 관련성 검색')
  console.log('  🏗️ Table Analysis: 테이블 내부 및 구조 분석')
  console.log('  📊 Node Context: 노드 컨텍스트 및 관련 정보')
  console.log()
  console.log('💪 사용법:')
  console.log('  1. bun run export:fixed - 모든 Fixed 템플릿들 export')
  console.log('  2. 콘텐츠 검색으로 관련 노드 발견')
  console.log('  3. 테이블 분석으로 데이터 구조 파악')
  console.log('  4. 노드 컨텍스트로 관련 정보 탐색')
}

main().catch(console.error)

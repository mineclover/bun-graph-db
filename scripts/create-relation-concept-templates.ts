#!/usr/bin/env bun

/**
 * 관계 개념을 시뮬레이션하는 실용적 템플릿 생성 스크립트
 *
 * 기존 작동하는 시스템을 활용하여 관계 분석 기능을 제공:
 * 1. 속성 기반 관계 분석
 * 2. 콘텐츠 기반 관계 탐색
 * 3. 테이블 간 관계 매핑
 * 4. 시간적 관계 분석
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

const relationConceptTemplates: RelationTemplate[] = [
  // 1. 속성 기반 관계 분석
  {
    identifier: 'find-nodes-by-shared-attributes-params',
    name: 'FindNodesBySharedAttributesParams',
    description: '공통 속성을 가진 노드들을 찾아 관계를 분석합니다 (파라미터화)',
    query: `query FindNodesBySharedAttributes($tableId: ID!, $attributeIdentifier: String!, $attributeValue: String) {
  table(id: $tableId) {
    id
    identifier
    description
    nodeCount

    attributes {
      nodes {
        id
        identifier
        description
        attributeType {
          id
          name
          dataType
        }
      }
    }
  }

  targetAttribute: attributeByIdentifier(identifier: $attributeIdentifier, tableId: $tableId) {
    id
    identifier
    description
    isRequired
    defaultValue
    attributeType {
      id
      name
      dataType
    }
  }

  relatedNodes: nodes(
    filter: {
      tableId: $tableId,
      attributes: [
        {
          identifier: $attributeIdentifier,
          value: $attributeValue,
          operator: EQUALS
        }
      ]
    }
    pagination: { limit: 50 }
  ) {
    nodes {
      id
      title
      content
      createdAt
      updatedAt

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
}`,
    variables: {
      tableId: 'target-table-id',
      attributeIdentifier: 'category',
      attributeValue: 'related-value',
    },
    variablesSchema: {
      tableId: {
        type: 'string',
        required: true,
        description: '검색할 테이블 ID',
      },
      attributeIdentifier: {
        type: 'string',
        required: true,
        description: '관계를 찾을 속성 식별자',
      },
      attributeValue: {
        type: 'string',
        description: '공통 속성 값',
      },
    },
    defaultVariables: {
      tableId: 'target-table-id',
      attributeIdentifier: 'category',
      attributeValue: 'related-value',
    },
    tags: ['relation', 'attributes', 'shared', 'analysis', 'query', 'parameterized', 'fixed'],
    complexityScore: 4,
    category: 'relation',
  },

  // 2. 시간적 관계 분석
  {
    identifier: 'analyze-temporal-relationships-params',
    name: 'AnalyzeTemporalRelationshipsParams',
    description: '시간 기반으로 노드 간 관계를 분석합니다 (파라미터화)',
    query: `query AnalyzeTemporalRelationships($tableId: ID!, $timeWindow: String!, $includeInactive: Boolean!) {
  table(id: $tableId) {
    id
    identifier
    description
    nodeCount
    createdAt
    updatedAt
  }

  recentNodes: nodes(
    filter: {
      tableId: $tableId,
      isActive: $includeInactive
    }
    pagination: { limit: 100 }
    sort: [{ field: "createdAt", direction: DESC }]
  ) {
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
          createdAt
          attributeType {
            name
            dataType
          }
        }
        totalCount
      }
    }
    totalCount
  }

  searchContext: searchNodes(
    filter: {
      tableId: $tableId,
      searchTerm: $timeWindow
    }
    pagination: { limit: 50 }
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
      tableId: 'target-table-id',
      timeWindow: 'recent activity',
      includeInactive: false,
    },
    variablesSchema: {
      tableId: {
        type: 'string',
        required: true,
        description: '분석할 테이블 ID',
      },
      timeWindow: {
        type: 'string',
        required: true,
        description: '시간 관계 검색 키워드',
      },
      includeInactive: {
        type: 'boolean',
        required: true,
        description: '비활성 노드 포함 여부',
      },
    },
    defaultVariables: {
      tableId: 'target-table-id',
      timeWindow: 'recent activity',
      includeInactive: false,
    },
    tags: ['relation', 'temporal', 'time', 'analysis', 'query', 'parameterized', 'fixed'],
    complexityScore: 5,
    category: 'relation',
  },

  // 3. 테이블 간 관계 매핑
  {
    identifier: 'map-cross-table-relationships-params',
    name: 'MapCrossTableRelationshipsParams',
    description: '여러 테이블 간의 관계를 매핑합니다 (파라미터화)',
    query: `query MapCrossTableRelationships($tableIds: [ID!]!, $relationKeyword: String!) {
  targetTables: tables(filter: { ids: $tableIds }) {
    nodes {
      id
      identifier
      description
      nodeCount
      attributeCount
      isActive
      createdAt

      attributes {
        nodes {
          id
          identifier
          description
          isRequired
          attributeType {
            id
            name
            dataType
            description
          }
        }
        totalCount
      }

      nodes(pagination: { limit: 10 }) {
        nodes {
          id
          title
          content
          createdAt
        }
        totalCount
      }
    }
    totalCount
  }

  relatedContent: searchNodes(
    filter: { searchTerm: $relationKeyword }
    pagination: { limit: 50 }
    sort: [{ field: "relevanceScore", direction: DESC }]
  ) {
    id
    title
    content
    tableId
    createdAt
    updatedAt
    relevanceScore

    table {
      id
      identifier
      description
    }
  }
}`,
    variables: {
      tableIds: ['table1-id', 'table2-id', 'table3-id'],
      relationKeyword: '관련 키워드',
    },
    variablesSchema: {
      tableIds: {
        type: 'array',
        required: true,
        description: '관계를 매핑할 테이블 ID 목록',
      },
      relationKeyword: {
        type: 'string',
        required: true,
        description: '관계 탐색 키워드',
      },
    },
    defaultVariables: {
      tableIds: ['table1-id', 'table2-id', 'table3-id'],
      relationKeyword: '관련 키워드',
    },
    tags: ['relation', 'cross-table', 'mapping', 'analysis', 'query', 'parameterized', 'fixed'],
    complexityScore: 5,
    category: 'relation',
  },

  // 4. 콘텐츠 유사성 기반 관계
  {
    identifier: 'discover-content-relationships-params',
    name: 'DiscoverContentRelationshipsParams',
    description: '콘텐츠 유사성을 기반으로 관계를 발견합니다 (파라미터화)',
    query: `query DiscoverContentRelationships($sourceNodeId: ID!, $similarityKeywords: [String!]!, $maxResults: Int!) {
  sourceNode: node(id: $sourceNodeId) {
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
    }

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
      totalCount
    }
  }

  relatedByContent: searchNodes(
    filter: {
      searchTerm: $similarityKeywords[0]
    }
    pagination: { limit: $maxResults }
    sort: [{ field: "relevanceScore", direction: DESC }]
  ) {
    id
    title
    content
    tableId
    createdAt
    updatedAt
    relevanceScore

    table {
      id
      identifier
      description
    }
  }

  sameTableNodes: nodes(
    filter: { tableId: $sourceNodeId }
    pagination: { limit: 20 }
    sort: [{ field: "createdAt", direction: DESC }]
  ) {
    nodes {
      id
      title
      content
      createdAt
      updatedAt
    }
    totalCount
  }
}`,
    variables: {
      sourceNodeId: 'source-node-id',
      similarityKeywords: ['유사성', '관련성', '연관'],
      maxResults: 25,
    },
    variablesSchema: {
      sourceNodeId: {
        type: 'string',
        required: true,
        description: '기준이 되는 소스 노드 ID',
      },
      similarityKeywords: {
        type: 'array',
        required: true,
        description: '유사성 판단 키워드 목록',
      },
      maxResults: {
        type: 'number',
        required: true,
        description: '최대 결과 개수',
      },
    },
    defaultVariables: {
      sourceNodeId: 'source-node-id',
      similarityKeywords: ['유사성', '관련성', '연관'],
      maxResults: 25,
    },
    tags: ['relation', 'content', 'similarity', 'discovery', 'query', 'parameterized', 'fixed'],
    complexityScore: 4,
    category: 'relation',
  },
]

async function createRelationConceptTemplate(template: RelationTemplate): Promise<boolean> {
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
  console.log('🚀 관계 개념 템플릿 생성 시작')
  console.log(`📡 서버: ${GRAPHQL_ENDPOINT}`)
  console.log(`📋 생성할 템플릿 수: ${relationConceptTemplates.length}개`)
  console.log()

  let successCount = 0
  let failureCount = 0
  const createdTemplates: string[] = []

  for (const template of relationConceptTemplates) {
    console.log(`🔄 생성 중: ${template.identifier}`)

    const success = await createRelationConceptTemplate(template)
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
    console.log('✅ 생성된 관계 개념 템플릿들:')
    createdTemplates.forEach((template) => {
      const complexity =
        relationConceptTemplates.find((t) => template.startsWith(t.identifier))?.complexityScore ||
        1
      const icon = complexity >= 5 ? '🔥' : complexity >= 4 ? '⚡' : '🔍'
      console.log(`  ${icon} ${template}`)
    })
    console.log()
  }

  console.log('🎉 관계 개념 템플릿 생성 완료!')
  console.log()
  console.log('💡 기능별 템플릿 카테고리:')
  console.log('  🏷️ Attribute Relations: 속성 기반 관계 분석')
  console.log('  ⏰ Temporal Relations: 시간 기반 관계 탐색')
  console.log('  🌐 Cross-Table Relations: 테이블 간 관계 매핑')
  console.log('  📝 Content Relations: 콘텐츠 유사성 기반 관계')
  console.log()
  console.log('💪 사용법:')
  console.log('  1. bun run export:fixed - 모든 Fixed 템플릿들 export')
  console.log('  2. 속성 관계로 데이터 연결성 분석')
  console.log('  3. 시간 관계로 동시성 패턴 파악')
  console.log('  4. 콘텐츠 관계로 유사성 발견')
}

main().catch(console.error)

#!/usr/bin/env bun

/**
 * Create Basic Parameterized Templates
 *
 * 기본적인 동작을 담당하는 쿼리들의 파라미터를 노출하는 템플릿들을 생성하는 스크립트
 */

const SERVER_URL = process.env.GRAPHQL_URL || 'http://localhost:4000/graphql'

interface BasicTemplate {
  identifier: string
  name: string
  description: string
  query: string
  tags: string[]
  defaultVariables?: Record<string, any>
  variablesSchema?: Record<string, any>
}

// 기본 파라미터화된 템플릿들
const basicParameterizedTemplates: BasicTemplate[] = [
  // 1. Tables 관련 기본 쿼리들
  {
    identifier: 'get-table-by-id',
    name: 'Get Table By ID',
    description: '특정 ID로 테이블 정보를 조회합니다',
    query: `query GetTableById($tableId: ID!) {
  getTable(id: $tableId) {
    id
    identifier
    description
    createdAt
    updatedAt
    nodeCount
    attributeCount
    isActive
  }
}`,
    tags: ['table', 'query', 'basic', 'parameterized', 'fixed'],
    defaultVariables: {
      tableId: 'example-table-id',
    },
    variablesSchema: {
      tableId: {
        type: 'string',
        required: true,
        description: '조회할 테이블의 ID',
      },
    },
  },

  {
    identifier: 'list-tables-with-filter',
    name: 'List Tables With Filter',
    description: '필터와 페이지네이션을 사용하여 테이블 목록을 조회합니다',
    query: `query ListTablesWithFilter($filter: TablesFilter, $pagination: TablesPagination, $sort: [TableSortInput!]) {
  tables(filter: $filter, pagination: $pagination, sort: $sort) {
    id
    identifier
    description
    nodeCount
    attributeCount
    isActive
    createdAt
    updatedAt
  }
}`,
    tags: ['table', 'query', 'list', 'filter', 'pagination', 'fixed'],
    defaultVariables: {
      filter: {
        isActive: true,
      },
      pagination: {
        limit: 10,
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
          isActive: { type: 'boolean', description: '활성 상태 필터' },
          identifier: { type: 'string', description: '식별자 필터' },
        },
      },
      pagination: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: '조회할 개수' },
          offset: { type: 'number', description: '시작 위치' },
        },
      },
      sort: {
        type: 'array',
        description: '정렬 옵션',
      },
    },
  },

  // 2. Nodes 관련 기본 쿼리들
  {
    identifier: 'get-node-by-id',
    name: 'Get Node By ID',
    description: '특정 ID로 노드 정보를 조회합니다',
    query: `query GetNodeById($nodeId: ID!) {
  getNode(id: $nodeId) {
    id
    title
    content
    tableId
    createdAt
    updatedAt
    isActive
    metadata
  }
}`,
    tags: ['node', 'query', 'basic', 'parameterized', 'fixed'],
    defaultVariables: {
      nodeId: 'example-node-id',
    },
    variablesSchema: {
      nodeId: {
        type: 'string',
        required: true,
        description: '조회할 노드의 ID',
      },
    },
  },

  {
    identifier: 'search-nodes-with-filter',
    name: 'Search Nodes With Filter',
    description: '필터와 페이지네이션을 사용하여 노드를 검색합니다',
    query: `query SearchNodesWithFilter($filter: SearchNodesFilter!, $pagination: NodesPagination, $sort: [NodeSortInput!]) {
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
    tags: ['node', 'query', 'search', 'filter', 'pagination', 'fixed'],
    defaultVariables: {
      filter: {
        searchTerm: 'example',
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
          searchTerm: { type: 'string', description: '검색할 키워드' },
          tableId: { type: 'string', description: '특정 테이블로 제한' },
        },
      },
      pagination: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: '조회할 개수' },
          offset: { type: 'number', description: '시작 위치' },
        },
      },
    },
  },

  // 3. Attributes 관련 기본 쿼리들
  {
    identifier: 'get-attribute-by-id',
    name: 'Get Attribute By ID',
    description: '특정 ID로 속성 정보를 조회합니다',
    query: `query GetAttributeById($attributeId: ID!) {
  getAttribute(id: $attributeId) {
    id
    name
    type
    description
    tableId
    isRequired
    defaultValue
    validationRules
    createdAt
    updatedAt
  }
}`,
    tags: ['attribute', 'query', 'basic', 'parameterized', 'fixed'],
    defaultVariables: {
      attributeId: 'example-attribute-id',
    },
    variablesSchema: {
      attributeId: {
        type: 'string',
        required: true,
        description: '조회할 속성의 ID',
      },
    },
  },

  {
    identifier: 'list-attributes-with-filter',
    name: 'List Attributes With Filter',
    description: '필터와 페이지네이션을 사용하여 속성 목록을 조회합니다',
    query: `query ListAttributesWithFilter($filter: AttributesFilter, $pagination: PaginationInput, $sort: [AttributeSortInput!]) {
  attributes(filter: $filter, pagination: $pagination, sort: $sort) {
    id
    name
    type
    description
    tableId
    isRequired
    defaultValue
    createdAt
    updatedAt
  }
}`,
    tags: ['attribute', 'query', 'list', 'filter', 'pagination', 'fixed'],
    defaultVariables: {
      filter: {
        tableId: null,
      },
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
      filter: {
        type: 'object',
        properties: {
          tableId: { type: 'string', description: '특정 테이블의 속성만 조회' },
          type: { type: 'string', description: '속성 타입 필터' },
        },
      },
    },
  },

  // 4. Templates 관련 기본 쿼리들
  {
    identifier: 'get-template-by-identifier',
    name: 'Get Template By Identifier',
    description: '식별자로 템플릿 정보를 조회합니다',
    query: `query GetTemplateByIdentifier($identifier: String!) {
  getTemplateByIdentifier(identifier: $identifier) {
    id
    identifier
    name
    description
    query
    tags
    isActive
    usageCount
    avgExecutionTimeMs
    createdAt
    updatedAt
  }
}`,
    tags: ['template', 'query', 'basic', 'parameterized', 'fixed'],
    defaultVariables: {
      identifier: 'example-template',
    },
    variablesSchema: {
      identifier: {
        type: 'string',
        required: true,
        description: '조회할 템플릿의 식별자',
      },
    },
  },

  {
    identifier: 'search-templates-with-filter',
    name: 'Search Templates With Filter',
    description: '필터와 페이지네이션을 사용하여 템플릿을 검색합니다',
    query: `query SearchTemplatesWithFilter($filter: QueryTemplatesFilter, $pagination: PaginationInput, $sort: [TemplateSortInput!]) {
  searchTemplates(filter: $filter, pagination: $pagination, sort: $sort) {
    id
    identifier
    name
    description
    tags
    operationType
    complexityScore
    usageCount
    avgExecutionTimeMs
    isActive
    createdAt
  }
}`,
    tags: ['template', 'query', 'search', 'filter', 'pagination', 'fixed'],
    defaultVariables: {
      filter: {
        tags: ['fixed'],
        isActive: true,
      },
      pagination: {
        limit: 25,
        offset: 0,
      },
      sort: [
        {
          field: 'usageCount',
          direction: 'DESC',
        },
      ],
    },
    variablesSchema: {
      filter: {
        type: 'object',
        properties: {
          tags: { type: 'array', description: '태그 필터' },
          isActive: { type: 'boolean', description: '활성 상태 필터' },
          operationType: {
            type: 'string',
            description: '쿼리 타입 필터 (QUERY, MUTATION, SUBSCRIPTION)',
          },
        },
      },
    },
  },

  // 5. 시스템 관련 기본 쿼리들
  {
    identifier: 'get-system-health-status',
    name: 'Get System Health Status',
    description: '시스템 상태를 확인합니다',
    query: `query GetSystemHealthStatus {
  health {
    status
    timestamp
    version
    uptime
    database {
      status
      connectionCount
      queryCount
    }
    memory {
      used
      total
      percentage
    }
  }
}`,
    tags: ['system', 'health', 'monitoring', 'basic', 'fixed'],
    defaultVariables: {},
    variablesSchema: {},
  },

  {
    identifier: 'get-system-statistics',
    name: 'Get System Statistics',
    description: '시스템 통계 정보를 조회합니다',
    query: `query GetSystemStatistics {
  systemStatistics {
    totalTables
    totalNodes
    totalAttributes
    totalTemplates
    activeTemplates
    avgQueryTime
    totalQueries
    lastHourQueries
  }
}`,
    tags: ['system', 'statistics', 'monitoring', 'basic', 'fixed'],
    defaultVariables: {},
    variablesSchema: {},
  },
]

async function createTemplate(template: BasicTemplate) {
  const mutation = `
    mutation CreateTemplate($input: CreateQueryTemplateInput!) {
      createTemplate(input: $input) {
        success
        template {
          id
          identifier
          name
        }
        errors {
          message
        }
      }
    }
  `

  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: {
            identifier: template.identifier,
            name: template.name,
            description: template.description,
            query: template.query,
            tags: template.tags,
            defaultVariables: template.defaultVariables,
            variablesSchema: template.variablesSchema,
            complexityScore: 2, // 기본 복잡도
            version: '1.0.0',
          },
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.errors) {
      throw new Error(`GraphQL 오류: ${JSON.stringify(data.errors)}`)
    }

    if (!data.data.createTemplate.success) {
      throw new Error(`생성 실패: ${JSON.stringify(data.data.createTemplate.errors)}`)
    }

    return {
      success: true,
      template: data.data.createTemplate.template,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main() {
  console.log('🚀 기본 파라미터화 템플릿 생성 시작')
  console.log(`📡 서버: ${SERVER_URL}`)
  console.log(`📋 생성할 템플릿 수: ${basicParameterizedTemplates.length}개`)

  const results = []

  for (const template of basicParameterizedTemplates) {
    console.log(`\n🔄 생성 중: ${template.identifier}`)

    const result = await createTemplate(template)
    results.push({ template, result })

    if (result.success) {
      console.log(`  ✅ 성공: ${template.name}`)
      console.log(`  📝 ID: ${result.template.id}`)
    } else {
      console.log(`  ❌ 실패: ${result.error}`)
    }

    // 서버 부하 방지를 위한 짧은 대기
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  // 결과 요약
  console.log('\n📊 생성 결과 요약:')
  const successful = results.filter((r) => r.result.success)
  const failed = results.filter((r) => !r.result.success)

  console.log(`  ✅ 성공: ${successful.length}개`)
  console.log(`  ❌ 실패: ${failed.length}개`)

  if (successful.length > 0) {
    console.log('\n✅ 생성된 템플릿들:')
    successful.forEach((s) => {
      console.log(`  - ${s.template.identifier}: ${s.template.name}`)
    })
  }

  if (failed.length > 0) {
    console.log('\n❌ 실패한 템플릿들:')
    failed.forEach((f) => {
      console.log(`  - ${f.template.identifier}: ${f.result.error}`)
    })
  }

  console.log('\n🎉 기본 파라미터화 템플릿 생성 완료!')
  console.log('\n💡 사용법:')
  console.log('  1. bun run export:fixed - Fixed 템플릿들 export')
  console.log('  2. GraphQL Playground에서 변수와 함께 실행')
  console.log('  3. 각 템플릿의 defaultVariables를 참고하여 파라미터 설정')
}

// 스크립트 실행
if (import.meta.main) {
  main().catch((error) => {
    console.error('💥 스크립트 실행 중 오류:', error)
    process.exit(1)
  })
}

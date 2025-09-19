#!/usr/bin/env bun

/**
 * Create Extended Parameterized Templates
 *
 * 뮤테이션과 고급 기능들의 파라미터를 노출하는 템플릿들을 추가로 생성하는 스크립트
 */

const SERVER_URL = process.env.GRAPHQL_URL || 'http://localhost:4000/graphql'

interface ExtendedTemplate {
  identifier: string
  name: string
  description: string
  query: string
  tags: string[]
  defaultVariables?: Record<string, any>
  variablesSchema?: Record<string, any>
  complexityScore?: number
}

// 확장된 파라미터화 템플릿들
const extendedParameterizedTemplates: ExtendedTemplate[] = [
  // 1. Table 관련 뮤테이션들
  {
    identifier: 'create-table-with-params',
    name: 'Create Table With Parameters',
    description: '파라미터를 사용하여 새 테이블을 생성합니다',
    query: `mutation CreateTableWithParams($input: CreateTableInput!) {
  createTable(input: $input) {
    success
    table {
      id
      identifier
      description
      createdAt
      isActive
    }
    errors {
      message
      code
    }
  }
}`,
    tags: ['table', 'mutation', 'create', 'parameterized', 'fixed'],
    defaultVariables: {
      input: {
        identifier: 'new-table',
        description: '새로운 테이블입니다',
      },
    },
    variablesSchema: {
      input: {
        type: 'object',
        required: true,
        properties: {
          identifier: { type: 'string', required: true, description: '테이블 식별자' },
          description: { type: 'string', required: true, description: '테이블 설명' },
        },
      },
    },
    complexityScore: 3,
  },

  {
    identifier: 'update-table-with-params',
    name: 'Update Table With Parameters',
    description: '파라미터를 사용하여 테이블을 업데이트합니다',
    query: `mutation UpdateTableWithParams($id: ID!, $input: UpdateTableInput!) {
  updateTable(id: $id, input: $input) {
    success
    table {
      id
      identifier
      description
      updatedAt
    }
    errors {
      message
      code
    }
  }
}`,
    tags: ['table', 'mutation', 'update', 'parameterized', 'fixed'],
    defaultVariables: {
      id: 'example-table-id',
      input: {
        description: '업데이트된 테이블 설명',
      },
    },
    variablesSchema: {
      id: {
        type: 'string',
        required: true,
        description: '업데이트할 테이블 ID',
      },
      input: {
        type: 'object',
        required: true,
        properties: {
          description: { type: 'string', description: '새로운 설명' },
        },
      },
    },
    complexityScore: 3,
  },

  // 2. Node 관련 뮤테이션들
  {
    identifier: 'create-node-with-params',
    name: 'Create Node With Parameters',
    description: '파라미터를 사용하여 새 노드를 생성합니다',
    query: `mutation CreateNodeWithParams($input: CreateNodeInput!) {
  createNode(input: $input) {
    success
    node {
      id
      title
      content
      tableId
      createdAt
      isActive
    }
    errors {
      message
      code
    }
  }
}`,
    tags: ['node', 'mutation', 'create', 'parameterized', 'fixed'],
    defaultVariables: {
      input: {
        title: '새 노드',
        content: '노드 내용입니다',
        tableId: 'example-table-id',
      },
    },
    variablesSchema: {
      input: {
        type: 'object',
        required: true,
        properties: {
          title: { type: 'string', required: true, description: '노드 제목' },
          content: { type: 'string', required: true, description: '노드 내용' },
          tableId: { type: 'string', required: true, description: '소속 테이블 ID' },
        },
      },
    },
    complexityScore: 3,
  },

  {
    identifier: 'update-node-with-params',
    name: 'Update Node With Parameters',
    description: '파라미터를 사용하여 노드를 업데이트합니다',
    query: `mutation UpdateNodeWithParams($id: ID!, $input: UpdateNodeInput!) {
  updateNode(id: $id, input: $input) {
    success
    node {
      id
      title
      content
      updatedAt
    }
    errors {
      message
      code
    }
  }
}`,
    tags: ['node', 'mutation', 'update', 'parameterized', 'fixed'],
    defaultVariables: {
      id: 'example-node-id',
      input: {
        title: '업데이트된 제목',
        content: '업데이트된 내용',
      },
    },
    variablesSchema: {
      id: {
        type: 'string',
        required: true,
        description: '업데이트할 노드 ID',
      },
      input: {
        type: 'object',
        required: true,
        properties: {
          title: { type: 'string', description: '새로운 제목' },
          content: { type: 'string', description: '새로운 내용' },
        },
      },
    },
    complexityScore: 3,
  },

  {
    identifier: 'delete-node-with-params',
    name: 'Delete Node With Parameters',
    description: '파라미터를 사용하여 노드를 삭제합니다',
    query: `mutation DeleteNodeWithParams($id: ID!) {
  deleteNode(id: $id) {
    success
    errors {
      message
      code
    }
  }
}`,
    tags: ['node', 'mutation', 'delete', 'parameterized', 'fixed'],
    defaultVariables: {
      id: 'example-node-id',
    },
    variablesSchema: {
      id: {
        type: 'string',
        required: true,
        description: '삭제할 노드 ID',
      },
    },
    complexityScore: 2,
  },

  // 3. Attribute 관련 뮤테이션들
  {
    identifier: 'create-attribute-with-params',
    name: 'Create Attribute With Parameters',
    description: '파라미터를 사용하여 새 속성을 생성합니다',
    query: `mutation CreateAttributeWithParams($input: CreateAttributeInput!) {
  createAttribute(input: $input) {
    success
    attribute {
      id
      name
      type
      description
      tableId
      isRequired
      defaultValue
      createdAt
    }
    errors {
      message
      code
    }
  }
}`,
    tags: ['attribute', 'mutation', 'create', 'parameterized', 'fixed'],
    defaultVariables: {
      input: {
        name: '새_속성',
        type: 'STRING',
        description: '새로운 속성입니다',
        tableId: 'example-table-id',
        isRequired: false,
      },
    },
    variablesSchema: {
      input: {
        type: 'object',
        required: true,
        properties: {
          name: { type: 'string', required: true, description: '속성 이름' },
          type: {
            type: 'string',
            required: true,
            description: '속성 타입 (STRING, NUMBER, BOOLEAN, DATE)',
          },
          description: { type: 'string', description: '속성 설명' },
          tableId: { type: 'string', required: true, description: '소속 테이블 ID' },
          isRequired: { type: 'boolean', description: '필수 여부' },
        },
      },
    },
    complexityScore: 4,
  },

  // 4. 고급 검색 및 관계 쿼리들
  {
    identifier: 'search-related-nodes-with-params',
    name: 'Search Related Nodes With Parameters',
    description: '파라미터를 사용하여 관련 노드들을 검색합니다',
    query: `query SearchRelatedNodesWithParams($filter: SearchRelatedNodesFilter!, $pagination: PaginationInput) {
  searchRelatedNodes(filter: $filter, pagination: $pagination) {
    id
    title
    content
    tableId
    relationshipType
    relationshipStrength
    distance
    createdAt
  }
}`,
    tags: ['node', 'query', 'relationship', 'search', 'parameterized', 'fixed'],
    defaultVariables: {
      filter: {
        sourceNodeId: 'example-source-node-id',
        maxDistance: 3,
        minStrength: 0.5,
      },
      pagination: {
        limit: 15,
        offset: 0,
      },
    },
    variablesSchema: {
      filter: {
        type: 'object',
        required: true,
        properties: {
          sourceNodeId: { type: 'string', required: true, description: '기준 노드 ID' },
          maxDistance: { type: 'number', description: '최대 거리' },
          minStrength: { type: 'number', description: '최소 관계 강도' },
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
    complexityScore: 5,
  },

  {
    identifier: 'find-paths-between-nodes-with-params',
    name: 'Find Paths Between Nodes With Parameters',
    description: '파라미터를 사용하여 노드 간 경로를 찾습니다',
    query: `query FindPathsBetweenNodesWithParams($input: FindPathsInput!) {
  findPathsBetweenNodes(input: $input) {
    paths {
      nodes {
        id
        title
      }
      relationships {
        type
        strength
      }
      totalDistance
      pathStrength
    }
    totalPaths
    executionTime
  }
}`,
    tags: ['node', 'query', 'pathfinding', 'graph', 'parameterized', 'fixed'],
    defaultVariables: {
      input: {
        sourceNodeId: 'example-source-node-id',
        targetNodeId: 'example-target-node-id',
        maxDepth: 5,
        algorithm: 'SHORTEST_PATH',
      },
    },
    variablesSchema: {
      input: {
        type: 'object',
        required: true,
        properties: {
          sourceNodeId: { type: 'string', required: true, description: '시작 노드 ID' },
          targetNodeId: { type: 'string', required: true, description: '목표 노드 ID' },
          maxDepth: { type: 'number', description: '최대 탐색 깊이' },
          algorithm: { type: 'string', description: '경로 찾기 알고리즘' },
        },
      },
    },
    complexityScore: 6,
  },

  // 5. 템플릿 관리 뮤테이션들
  {
    identifier: 'create-template-with-params',
    name: 'Create Template With Parameters',
    description: '파라미터를 사용하여 새 템플릿을 생성합니다',
    query: `mutation CreateTemplateWithParams($input: CreateQueryTemplateInput!) {
  createTemplate(input: $input) {
    success
    template {
      id
      identifier
      name
      description
      tags
      complexityScore
      version
      createdAt
    }
    errors {
      message
      code
    }
  }
}`,
    tags: ['template', 'mutation', 'create', 'parameterized', 'fixed'],
    defaultVariables: {
      input: {
        identifier: 'new-custom-template',
        name: '새 커스텀 템플릿',
        description: '사용자 정의 템플릿입니다',
        query: 'query CustomQuery { health { status } }',
        tags: ['custom', 'user-defined'],
        complexityScore: 1,
        version: '1.0.0',
      },
    },
    variablesSchema: {
      input: {
        type: 'object',
        required: true,
        properties: {
          identifier: { type: 'string', required: true, description: '템플릿 식별자' },
          name: { type: 'string', required: true, description: '템플릿 이름' },
          description: { type: 'string', description: '템플릿 설명' },
          query: { type: 'string', required: true, description: 'GraphQL 쿼리' },
          tags: { type: 'array', description: '태그 목록' },
          complexityScore: { type: 'number', description: '복잡도 점수' },
          version: { type: 'string', description: '버전' },
        },
      },
    },
    complexityScore: 4,
  },

  {
    identifier: 'update-template-with-params',
    name: 'Update Template With Parameters',
    description: '파라미터를 사용하여 템플릿을 업데이트합니다',
    query: `mutation UpdateTemplateWithParams($id: ID!, $input: UpdateQueryTemplateInput!) {
  updateTemplate(id: $id, input: $input) {
    success
    template {
      id
      identifier
      name
      description
      tags
      updatedAt
    }
    errors {
      message
      code
    }
  }
}`,
    tags: ['template', 'mutation', 'update', 'parameterized', 'fixed'],
    defaultVariables: {
      id: 'example-template-id',
      input: {
        name: '업데이트된 템플릿 이름',
        description: '업데이트된 설명',
        tags: ['updated', 'modified'],
      },
    },
    variablesSchema: {
      id: {
        type: 'string',
        required: true,
        description: '업데이트할 템플릿 ID',
      },
      input: {
        type: 'object',
        required: true,
        properties: {
          name: { type: 'string', description: '새로운 이름' },
          description: { type: 'string', description: '새로운 설명' },
          tags: { type: 'array', description: '새로운 태그 목록' },
        },
      },
    },
    complexityScore: 3,
  },

  // 6. 시스템 모니터링 고급 쿼리들
  {
    identifier: 'get-detailed-system-metrics',
    name: 'Get Detailed System Metrics',
    description: '파라미터를 사용하여 상세한 시스템 메트릭을 조회합니다',
    query: `query GetDetailedSystemMetrics($timeRange: String, $includeHistory: Boolean) {
  systemMetrics(timeRange: $timeRange, includeHistory: $includeHistory) {
    timestamp
    cpu {
      usage
      loadAverage
      cores
    }
    memory {
      used
      total
      percentage
      available
    }
    database {
      connections {
        active
        idle
        total
      }
      performance {
        queriesPerSecond
        avgQueryTime
        slowQueries
      }
    }
    history {
      timestamp
      cpuUsage
      memoryUsage
    }
  }
}`,
    tags: ['system', 'monitoring', 'metrics', 'query', 'parameterized', 'fixed'],
    defaultVariables: {
      timeRange: '1h',
      includeHistory: true,
    },
    variablesSchema: {
      timeRange: {
        type: 'string',
        description: '시간 범위 (1h, 24h, 7d)',
      },
      includeHistory: {
        type: 'boolean',
        description: '이력 데이터 포함 여부',
      },
    },
    complexityScore: 5,
  },

  // 7. 배치 작업 관련 뮤테이션들
  {
    identifier: 'bulk-create-nodes-with-params',
    name: 'Bulk Create Nodes With Parameters',
    description: '파라미터를 사용하여 여러 노드를 일괄 생성합니다',
    query: `mutation BulkCreateNodesWithParams($input: BulkCreateNodesInput!) {
  bulkCreateNodes(input: $input) {
    success
    totalCreated
    totalFailed
    createdNodes {
      id
      title
      tableId
    }
    errors {
      index
      message
      code
    }
  }
}`,
    tags: ['node', 'mutation', 'bulk', 'batch', 'parameterized', 'fixed'],
    defaultVariables: {
      input: {
        nodes: [
          {
            title: '배치 노드 1',
            content: '첫 번째 노드 내용',
            tableId: 'example-table-id',
          },
          {
            title: '배치 노드 2',
            content: '두 번째 노드 내용',
            tableId: 'example-table-id',
          },
        ],
        options: {
          skipErrors: true,
          validateBeforeCreate: true,
        },
      },
    },
    variablesSchema: {
      input: {
        type: 'object',
        required: true,
        properties: {
          nodes: {
            type: 'array',
            required: true,
            description: '생성할 노드 목록',
          },
          options: {
            type: 'object',
            properties: {
              skipErrors: { type: 'boolean', description: '오류 무시 여부' },
              validateBeforeCreate: { type: 'boolean', description: '생성 전 검증 여부' },
            },
          },
        },
      },
    },
    complexityScore: 6,
  },
]

async function createTemplate(template: ExtendedTemplate) {
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
            complexityScore: template.complexityScore || 3,
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
  console.log('🚀 확장된 파라미터화 템플릿 생성 시작')
  console.log(`📡 서버: ${SERVER_URL}`)
  console.log(`📋 생성할 템플릿 수: ${extendedParameterizedTemplates.length}개`)

  const results = []

  for (const template of extendedParameterizedTemplates) {
    console.log(`\n🔄 생성 중: ${template.identifier}`)

    const result = await createTemplate(template)
    results.push({ template, result })

    if (result.success) {
      console.log(`  ✅ 성공: ${template.name}`)
      console.log(`  📝 ID: ${result.template.id}`)
      console.log(`  🎯 복잡도: ${template.complexityScore}/10`)
    } else {
      console.log(`  ❌ 실패: ${result.error}`)
    }

    // 서버 부하 방지를 위한 짧은 대기
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  // 결과 요약
  console.log('\n📊 생성 결과 요약:')
  const successful = results.filter((r) => r.result.success)
  const failed = results.filter((r) => !r.result.success)

  console.log(`  ✅ 성공: ${successful.length}개`)
  console.log(`  ❌ 실패: ${failed.length}개`)

  if (successful.length > 0) {
    console.log('\n✅ 생성된 확장 템플릿들:')
    successful.forEach((s) => {
      const category = s.template.tags.includes('mutation') ? '🔧' : '🔍'
      const domain =
        s.template.tags.find((tag) =>
          ['table', 'node', 'attribute', 'template', 'system'].includes(tag)
        ) || 'general'
      console.log(`  ${category} ${s.template.identifier}: ${s.template.name} [${domain}]`)
    })
  }

  if (failed.length > 0) {
    console.log('\n❌ 실패한 템플릿들:')
    failed.forEach((f) => {
      console.log(`  - ${f.template.identifier}: ${f.result.error}`)
    })
  }

  console.log('\n🎉 확장된 파라미터화 템플릿 생성 완료!')
  console.log('\n💡 사용법:')
  console.log('  1. bun run export:fixed - 모든 Fixed 템플릿들 export')
  console.log('  2. 뮤테이션 템플릿으로 데이터 생성/수정/삭제')
  console.log('  3. 고급 검색 템플릿으로 관계형 데이터 탐색')
  console.log('  4. 배치 템플릿으로 대량 작업 수행')
}

// 스크립트 실행
if (import.meta.main) {
  main().catch((error) => {
    console.error('💥 스크립트 실행 중 오류:', error)
    process.exit(1)
  })
}

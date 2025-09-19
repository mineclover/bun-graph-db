#!/usr/bin/env bun

/**
 * Create Core Query Templates Script
 *
 * executeTemplate 방식으로 핵심 GraphQL 쿼리들을 구현합니다:
 * 1. 기본 CRUD 쿼리 (Create, Read, Update, Delete)
 * 2. 고급 검색 및 필터링 쿼리
 * 3. 통계 및 분석 쿼리
 * 4. 관계형 데이터 쿼리
 * 5. 배치 작업 쿼리
 */

const DB_PATH = 'data/bun-graph-db.sqlite'

interface CoreQueryTemplate {
  identifier: string
  name: string
  description: string
  query: string
  defaultVariables: any
  tags: string[]
  complexityScore: number
  category: 'crud' | 'search' | 'analytics' | 'relations' | 'batch'
}

// 핵심 쿼리 템플릿들
const coreQueryTemplates: CoreQueryTemplate[] = [
  // === 기본 CRUD 쿼리 ===
  {
    identifier: 'get-node-by-id',
    name: 'ID로 노드 조회',
    description: '특정 ID를 가진 노드를 조회합니다',
    query: `
      query GetNodeById($nodeId: ID!) {
        node(id: $nodeId) {
          id
          content
          createdAt
          updatedAt
          table {
            id
            identifier
            description
          }
          attributes {
            id
            value
            attribute {
              id
              identifier
              dataType
            }
          }
        }
      }
    `,
    defaultVariables: {
      nodeId: "80"
    },
    tags: ['crud', 'read', 'node'],
    complexityScore: 2,
    category: 'crud'
  },
  {
    identifier: 'get-table-by-id',
    name: 'ID로 테이블 조회',
    description: '특정 ID를 가진 테이블을 조회합니다',
    query: `
      query GetTableById($tableId: ID!) {
        table(id: $tableId) {
          id
          identifier
          description
          nodeCount
          attributeCount
          createdAt
          updatedAt
        }
      }
    `,
    defaultVariables: {
      tableId: "101"
    },
    tags: ['crud', 'read', 'table'],
    complexityScore: 2,
    category: 'crud'
  },
  {
    identifier: 'create-node-simple',
    name: '간단한 노드 생성',
    description: '기본 속성을 가진 노드를 생성합니다',
    query: `
      mutation CreateNodeSimple($input: CreateNodeInput!) {
        createNode(input: $input) {
          success
          node {
            id
            content
            createdAt
            table {
              id
              identifier
            }
          }
          errors {
            message
            field
          }
        }
      }
    `,
    defaultVariables: {
      input: {
        content: `심플 노드 ${Date.now()}`,
        tableId: "101",
        attributes: []
      }
    },
    tags: ['crud', 'create', 'node'],
    complexityScore: 3,
    category: 'crud'
  },
  {
    identifier: 'update-node-simple',
    name: '간단한 노드 업데이트',
    description: '노드의 내용을 업데이트합니다',
    query: `
      mutation UpdateNodeSimple($id: ID!, $input: UpdateNodeInput!) {
        updateNode(id: $id, input: $input) {
          success
          node {
            id
            content
            updatedAt
            table {
              id
              identifier
            }
          }
          errors {
            message
            field
          }
        }
      }
    `,
    defaultVariables: {
      id: "80",
      input: {
        content: `업데이트된 노드 ${Date.now()}`
      }
    },
    tags: ['crud', 'update', 'node'],
    complexityScore: 3,
    category: 'crud'
  },
  {
    identifier: 'delete-node-simple',
    name: '간단한 노드 삭제',
    description: '노드를 삭제합니다',
    query: `
      mutation DeleteNodeSimple($id: ID!) {
        deleteNode(id: $id) {
          success
          errors {
            message
            field
          }
        }
      }
    `,
    defaultVariables: {
      id: "999" // 안전한 테스트를 위해 존재하지 않는 ID 사용
    },
    tags: ['crud', 'delete', 'node'],
    complexityScore: 2,
    category: 'crud'
  },

  // === 고급 검색 및 필터링 쿼리 ===
  {
    identifier: 'search-nodes-advanced',
    name: '고급 노드 검색',
    description: '여러 조건으로 노드를 검색합니다',
    query: `
      query SearchNodesAdvanced($filter: NodesFilter!, $pagination: PaginationInput!) {
        nodes(filter: $filter, pagination: $pagination) {
          nodes {
            id
            content
            createdAt
            updatedAt
            table {
              id
              identifier
            }
            attributes {
              id
              value
              attribute {
                id
                identifier
                dataType
              }
            }
          }
          totalCount
          hasNextPage
          hasPreviousPage
        }
      }
    `,
    defaultVariables: {
      filter: {
        tableId: "101",
        search: "노드"
      },
      pagination: {
        limit: 20,
        offset: 0
      }
    },
    tags: ['search', 'filter', 'node', 'pagination'],
    complexityScore: 4,
    category: 'search'
  },
  {
    identifier: 'search-tables-with-stats',
    name: '통계 포함 테이블 검색',
    description: '노드 수와 속성 수를 포함하여 테이블을 검색합니다',
    query: `
      query SearchTablesWithStats($search: String, $limit: Int!) {
        tables(filter: { search: $search }, pagination: { limit: $limit, offset: 0 }) {
          tables {
            id
            identifier
            description
            nodeCount
            attributeCount
            createdAt
            updatedAt
          }
          totalCount
          hasNextPage
        }
      }
    `,
    defaultVariables: {
      search: null,
      limit: 10
    },
    tags: ['search', 'table', 'statistics'],
    complexityScore: 3,
    category: 'search'
  },
  {
    identifier: 'filter-nodes-by-attribute',
    name: '속성별 노드 필터링',
    description: '특정 속성 값을 가진 노드들을 필터링합니다',
    query: `
      query FilterNodesByAttribute($tableId: ID!, $attributeFilter: String!, $limit: Int!) {
        nodes(
          filter: {
            tableId: $tableId
            search: $attributeFilter
          }
          pagination: { limit: $limit, offset: 0 }
        ) {
          nodes {
            id
            content
            createdAt
            attributes {
              id
              value
              attribute {
                identifier
                dataType
              }
            }
          }
          totalCount
        }
      }
    `,
    defaultVariables: {
      tableId: "101",
      attributeFilter: "완료",
      limit: 15
    },
    tags: ['search', 'filter', 'attribute'],
    complexityScore: 4,
    category: 'search'
  },

  // === 통계 및 분석 쿼리 ===
  {
    identifier: 'get-system-statistics',
    name: '시스템 통계 조회',
    description: '전체 시스템의 통계 정보를 조회합니다',
    query: `
      query GetSystemStatistics {
        tables(pagination: { limit: 1000, offset: 0 }) {
          totalCount
        }
        allNodes: nodes(pagination: { limit: 1, offset: 0 }) {
          totalCount
        }
        attributeTypes(pagination: { limit: 1000, offset: 0 }) {
          totalCount
        }
      }
    `,
    defaultVariables: {},
    tags: ['analytics', 'statistics', 'system'],
    complexityScore: 5,
    category: 'analytics'
  },
  {
    identifier: 'get-table-analytics',
    name: '테이블 분석 데이터',
    description: '특정 테이블의 상세 분석 데이터를 조회합니다',
    query: `
      query GetTableAnalytics($tableId: ID!) {
        table(id: $tableId) {
          id
          identifier
          description
          nodeCount
          attributeCount
          createdAt
          updatedAt
        }
        tableNodes: nodes(
          filter: { tableId: $tableId }
          pagination: { limit: 100, offset: 0 }
        ) {
          totalCount
          nodes {
            id
            content
            createdAt
            attributes {
              id
              value
              attribute {
                identifier
              }
            }
          }
        }
        tableAttributeTypes: attributeTypes(
          filter: { tableId: $tableId }
          pagination: { limit: 50, offset: 0 }
        ) {
          totalCount
          attributeTypes {
            id
            identifier
            dataType
            createdAt
          }
        }
      }
    `,
    defaultVariables: {
      tableId: "101"
    },
    tags: ['analytics', 'table', 'detailed'],
    complexityScore: 6,
    category: 'analytics'
  },
  {
    identifier: 'get-recent-activity',
    name: '최근 활동 조회',
    description: '최근 생성/수정된 노드들을 조회합니다',
    query: `
      query GetRecentActivity($limit: Int!) {
        recentNodes: nodes(
          pagination: { limit: $limit, offset: 0 }
        ) {
          nodes {
            id
            content
            createdAt
            updatedAt
            table {
              id
              identifier
            }
          }
        }
        recentTables: tables(
          pagination: { limit: 5, offset: 0 }
        ) {
          tables {
            id
            identifier
            description
            createdAt
            updatedAt
            nodeCount
          }
        }
      }
    `,
    defaultVariables: {
      limit: 20
    },
    tags: ['analytics', 'activity', 'recent'],
    complexityScore: 4,
    category: 'analytics'
  },

  // === 관계형 데이터 쿼리 ===
  {
    identifier: 'get-table-with-nodes',
    name: '노드 포함 테이블 조회',
    description: '테이블과 그 안의 노드들을 함께 조회합니다',
    query: `
      query GetTableWithNodes($tableId: ID!, $nodeLimit: Int!) {
        table(id: $tableId) {
          id
          identifier
          description
          nodeCount
          attributeCount
          createdAt
          updatedAt
        }
        tableNodes: nodes(
          filter: { tableId: $tableId }
          pagination: { limit: $nodeLimit, offset: 0 }
        ) {
          nodes {
            id
            content
            createdAt
            updatedAt
            attributes {
              id
              value
              attribute {
                id
                identifier
                dataType
              }
            }
          }
          totalCount
          hasNextPage
        }
      }
    `,
    defaultVariables: {
      tableId: "101",
      nodeLimit: 25
    },
    tags: ['relations', 'table', 'nodes'],
    complexityScore: 5,
    category: 'relations'
  },
  {
    identifier: 'get-node-with-table-context',
    name: '테이블 컨텍스트 포함 노드 조회',
    description: '노드와 그 테이블의 전체 컨텍스트를 조회합니다',
    query: `
      query GetNodeWithTableContext($nodeId: ID!) {
        node(id: $nodeId) {
          id
          content
          createdAt
          updatedAt
          table {
            id
            identifier
            description
            nodeCount
            attributeCount
          }
          attributes {
            id
            value
            attribute {
              id
              identifier
              dataType
              description
            }
          }
        }
        siblingNodes: nodes(
          filter: { tableId: "101" }
          pagination: { limit: 5, offset: 0 }
        ) {
          nodes {
            id
            content
            createdAt
          }
          totalCount
        }
      }
    `,
    defaultVariables: {
      nodeId: "80"
    },
    tags: ['relations', 'node', 'context'],
    complexityScore: 5,
    category: 'relations'
  },

  // === 배치 작업 쿼리 ===
  {
    identifier: 'batch-create-nodes',
    name: '노드 일괄 생성',
    description: '여러 노드를 한 번에 생성합니다',
    query: `
      mutation BatchCreateNodes($input1: CreateNodeInput!, $input2: CreateNodeInput!, $input3: CreateNodeInput!) {
        node1: createNode(input: $input1) {
          success
          node {
            id
            content
            createdAt
          }
          errors {
            message
            field
          }
        }
        node2: createNode(input: $input2) {
          success
          node {
            id
            content
            createdAt
          }
          errors {
            message
            field
          }
        }
        node3: createNode(input: $input3) {
          success
          node {
            id
            content
            createdAt
          }
          errors {
            message
            field
          }
        }
      }
    `,
    defaultVariables: {
      input1: {
        content: `배치 노드 1 - ${Date.now()}`,
        tableId: "101",
        attributes: []
      },
      input2: {
        content: `배치 노드 2 - ${Date.now()}`,
        tableId: "101",
        attributes: []
      },
      input3: {
        content: `배치 노드 3 - ${Date.now()}`,
        tableId: "101",
        attributes: []
      }
    },
    tags: ['batch', 'create', 'nodes'],
    complexityScore: 7,
    category: 'batch'
  },
  {
    identifier: 'batch-node-operations',
    name: '노드 일괄 작업',
    description: '읽기, 생성, 업데이트를 한 번에 수행합니다',
    query: `
      mutation BatchNodeOperations($readId: ID!, $createInput: CreateNodeInput!, $updateId: ID!, $updateInput: UpdateNodeInput!) {
        readNode: node(id: $readId) {
          id
          content
          updatedAt
        }
        createNode: createNode(input: $createInput) {
          success
          node {
            id
            content
            createdAt
          }
          errors {
            message
          }
        }
        updateNode: updateNode(id: $updateId, input: $updateInput) {
          success
          node {
            id
            content
            updatedAt
          }
          errors {
            message
          }
        }
      }
    `,
    defaultVariables: {
      readId: "80",
      createInput: {
        content: `배치 작업 새 노드 ${Date.now()}`,
        tableId: "101",
        attributes: []
      },
      updateId: "81",
      updateInput: {
        content: `배치 작업 업데이트 ${Date.now()}`
      }
    },
    tags: ['batch', 'mixed', 'operations'],
    complexityScore: 8,
    category: 'batch'
  }
]

// Database operations
async function insertCoreQueryTemplate(template: CoreQueryTemplate): Promise<void> {
  const { Database } = require('bun:sqlite')
  const db = new Database(DB_PATH)

  try {
    console.log(`🔧 Inserting core query template: ${template.identifier}`)

    // Delete existing template if it exists
    db.run(`DELETE FROM templates WHERE identifier = ?`, [template.identifier])

    // Insert new template
    const insertQuery = `
      INSERT INTO templates (
        identifier, name, description, query_text, query_name,
        operation_type, variables_schema, default_variables,
        template_type, complexity_score, usage_count, is_active,
        tags, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `

    const operationType = template.query.trim().toLowerCase().startsWith('mutation') ? 'mutation' : 'query'

    db.run(insertQuery, [
      template.identifier,
      template.name,
      template.description,
      template.query.trim(),
      JSON.stringify([template.identifier]),
      operationType,
      null,
      JSON.stringify(template.defaultVariables),
      'query',
      template.complexityScore,
      0,
      1,
      JSON.stringify([...template.tags, template.category]),
      '1.0.0'
    ])

    console.log(`✅ Inserted template: ${template.identifier} (${template.category})`)
  } catch (error) {
    console.error(`❌ Failed to insert template ${template.identifier}:`, error)
  } finally {
    db.close()
  }
}

// Test core query template execution
async function testCoreQueryTemplate(identifier: string, variables: any): Promise<boolean> {
  try {
    console.log(`🧪 Testing core query template: ${identifier}`)

    const response = await fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          mutation ExecuteTemplate($input: ExecuteQueryTemplateInput!) {
            executeTemplate(input: $input) {
              success
              data
              errors {
                message
                code
              }
            }
          }
        `,
        variables: {
          input: {
            templateIdentifier: identifier,
            variables: variables
          }
        }
      }),
    })

    const result = await response.json()

    if (result.data?.executeTemplate?.success) {
      console.log(`✅ Core query template test passed: ${identifier}`)
      return true
    } else {
      console.log(`❌ Core query template test failed: ${identifier}`)
      console.log(`   Errors:`, result.data?.executeTemplate?.errors || result.errors)
      return false
    }
  } catch (error) {
    console.log(`❌ Core query template test error: ${identifier} - ${error}`)
    return false
  }
}

// Demo core query execution
async function demoCoreQueries(): Promise<void> {
  console.log('\n🎯 핵심 쿼리 데모 실행')
  console.log('='.repeat(60))

  const demoQueries = [
    {
      template: 'get-node-by-id',
      description: 'ID로 노드 조회',
      variables: { nodeId: "80" }
    },
    {
      template: 'search-nodes-advanced',
      description: '고급 노드 검색',
      variables: {
        filter: { tableId: "101", search: "노드" },
        pagination: { limit: 5, offset: 0 }
      }
    },
    {
      template: 'get-system-statistics',
      description: '시스템 통계',
      variables: {}
    },
    {
      template: 'get-table-with-nodes',
      description: '테이블과 노드 함께 조회',
      variables: { tableId: "101", nodeLimit: 3 }
    }
  ]

  for (const demo of demoQueries) {
    console.log(`\n📊 ${demo.description}`)
    console.log('-'.repeat(40))

    const response = await fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ExecuteTemplate($input: ExecuteQueryTemplateInput!) {
            executeTemplate(input: $input) {
              success
              data
              errors { message }
            }
          }
        `,
        variables: {
          input: {
            templateIdentifier: demo.template,
            variables: demo.variables
          }
        }
      })
    })

    const result = await response.json()

    if (result.data?.executeTemplate?.success) {
      console.log('✅ 성공!')
      console.log('📤 결과 미리보기:', JSON.stringify(result.data.executeTemplate.data, null, 2).substring(0, 200) + '...')
    } else {
      console.log('❌ 실패:', result.data?.executeTemplate?.errors || result.errors)
    }

    await new Promise(resolve => setTimeout(resolve, 500))
  }
}

// Main execution function
async function main() {
  console.log('🚀 핵심 GraphQL 쿼리 템플릿 생성')
  console.log('='.repeat(60))

  // Test server connectivity
  try {
    const response = await fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'query { __typename }' })
    })

    if (!response.ok) {
      throw new Error('Server not responding')
    }
    console.log('✅ GraphQL 서버 연결 확인')
  } catch (error) {
    console.error('❌ 서버에 연결할 수 없습니다:', error)
    process.exit(1)
  }

  // Insert core query templates by category
  const categories = ['crud', 'search', 'analytics', 'relations', 'batch'] as const

  for (const category of categories) {
    const categoryTemplates = coreQueryTemplates.filter(t => t.category === category)
    console.log(`\n📝 ${category.toUpperCase()} 템플릿 삽입 중... (${categoryTemplates.length}개)`)

    for (const template of categoryTemplates) {
      await insertCoreQueryTemplate(template)
    }
  }

  // Test core query templates
  console.log('\n🧪 핵심 쿼리 템플릿 테스트...')
  const testResults: boolean[] = []

  for (const template of coreQueryTemplates) {
    const success = await testCoreQueryTemplate(template.identifier, template.defaultVariables)
    testResults.push(success)
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  // Demo execution
  await demoCoreQueries()

  // Summary
  const passedCount = testResults.filter(Boolean).length
  const totalCount = testResults.length

  console.log('\n📊 핵심 쿼리 템플릿 결과:')
  console.log('='.repeat(50))
  console.log(`   총 템플릿 수: ${totalCount}`)
  console.log(`   성공: ${passedCount}`)
  console.log(`   실패: ${totalCount - passedCount}`)
  console.log(`   성공률: ${((passedCount / totalCount) * 100).toFixed(1)}%`)

  // Category breakdown
  console.log('\n📋 카테고리별 템플릿:')
  for (const category of categories) {
    const categoryTemplates = coreQueryTemplates.filter(t => t.category === category)
    console.log(`   ${category.toUpperCase()}: ${categoryTemplates.length}개`)
  }

  if (passedCount === totalCount) {
    console.log('\n🎉 모든 핵심 쿼리 템플릿이 성공적으로 생성되고 테스트되었습니다!')
  } else {
    console.log('\n⚠️ 일부 템플릿에 문제가 있습니다')
  }

  console.log('\n💡 이제 executeTemplate을 통해 모든 핵심 GraphQL 쿼리를 실행할 수 있습니다!')
}

// Run script if executed directly
if (import.meta.main) {
  main()
}
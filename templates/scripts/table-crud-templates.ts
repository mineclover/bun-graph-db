#!/usr/bin/env bun

/**
 * Table CRUD Templates Generator
 *
 * 이 스크립트는 GraphQL 인터페이스를 통해 테이블을 생성하고,
 * 일관된 템플릿으로 CRUD 작업을 수행할 수 있는 템플릿을 생성합니다.
 *
 * todo-templates-guide.md를 참고하여 만든 제네릭 테이블 CRUD 시스템입니다.
 */

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql'
const DB_PATH = 'data/bun-graph-db.sqlite'

interface TableTemplate {
  identifier: string
  name: string
  description: string
  query: string
  variables: any
  operationType: 'query' | 'mutation'
  tags: string[]
  complexityScore: number
}

interface TableConfig {
  identifier: string
  description: string
  attributes: AttributeConfig[]
  attributeIds?: { [key: string]: string }
}

interface AttributeConfig {
  identifier: string
  name: string
  description: string
  dataType: 'STRING' | 'INTEGER' | 'FLOAT' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'JSON'
  isRequired: boolean
  enumValues?: string[]
}

// GraphQL 클라이언트 헬퍼
async function graphqlRequest(query: string, variables?: any): Promise<any> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })

  const result = await response.json()

  if (result.errors) {
    throw new Error(result.errors[0].message)
  }

  return result.data
}

// 데이터베이스 헬퍼
function getDatabase() {
  const { Database } = require('bun:sqlite')
  return new Database(DB_PATH)
}

// 템플릿을 데이터베이스에 삽입
async function insertTemplate(template: TableTemplate): Promise<boolean> {
  const db = getDatabase()

  try {
    const insertQuery = `
      INSERT OR REPLACE INTO templates (
        identifier, name, description, query_text, default_variables,
        operation_type, tags, complexity_score, is_active,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `

    db.run(insertQuery, [
      template.identifier,
      template.name,
      template.description,
      template.query,
      JSON.stringify(template.variables),
      template.operationType,
      JSON.stringify(template.tags),
      template.complexityScore
    ])

    console.log(`✅ Template created: ${template.identifier}`)
    return true
  } catch (error) {
    console.error(`❌ Failed to create template ${template.identifier}:`, error)
    return false
  } finally {
    db.close()
  }
}

// 1. 테이블 생성 템플릿
function createTableTemplate(): TableTemplate {
  return {
    identifier: 'create-dynamic-table',
    name: '동적 테이블 생성',
    description: '식별자와 설명을 포함한 새로운 테이블을 생성합니다',
    operationType: 'mutation',
    complexityScore: 4,
    tags: ['table', 'create', 'crud', 'dynamic'],
    query: `
      mutation CreateTable($input: CreateTableInput!) {
        createTable(input: $input) {
          success
          table {
            id
            identifier
            description
            createdAt
            updatedAt
            tableNodeCount
            attributeCount
          }
          errors {
            message
            code
            field
          }
        }
      }
    `,
    variables: {
      input: {
        identifier: "{{tableIdentifier}}",
        description: "{{tableDescription}}"
      }
    }
  }
}

// 2. 속성 생성 템플릿
function createAttributeTemplate(): TableTemplate {
  return {
    identifier: 'create-table-attribute',
    name: '테이블 속성 생성',
    description: '테이블에 새로운 속성을 추가합니다',
    operationType: 'mutation',
    complexityScore: 3,
    tags: ['attribute', 'create', 'crud', 'dynamic'],
    query: `
      mutation CreateAttribute($input: CreateAttributeInput!) {
        createAttribute(input: $input) {
          success
          attribute {
            id
            tableId
            identifier
            name
            description
            dataType
            isRequired
            enumValues
            createdAt
          }
          errors {
            message
            code
            field
          }
        }
      }
    `,
    variables: {
      input: {
        tableId: "{{tableId}}",
        identifier: "{{attributeIdentifier}}",
        name: "{{attributeName}}",
        description: "{{attributeDescription}}",
        dataType: "{{dataType}}",
        isRequired: "{{isRequired}}",
        enumValues: "{{enumValues}}"
      }
    }
  }
}

// 3. 노드 생성 템플릿
function createNodeTemplate(): TableTemplate {
  return {
    identifier: 'create-table-node',
    name: '테이블 노드 생성',
    description: '지정된 테이블에 새로운 노드를 생성합니다',
    operationType: 'mutation',
    complexityScore: 5,
    tags: ['node', 'create', 'crud', 'dynamic'],
    query: `
      mutation CreateNode($input: CreateNodeInput!) {
        createNode(input: $input) {
          success
          node {
            id
            tableId
            content
            createdAt
            updatedAt
            attributes {
              id
              name
              value
              dataType
            }
          }
          errors {
            message
            code
            field
          }
        }
      }
    `,
    variables: {
      input: {
        tableId: "{{tableId}}",
        content: "{{nodeContent}}",
        attributes: "{{nodeAttributes}}"
      }
    }
  }
}

// 4. 노드 조회 템플릿
function getNodeTemplate(): TableTemplate {
  return {
    identifier: 'get-table-node',
    name: '테이블 노드 조회',
    description: '특정 노드의 상세 정보를 조회합니다',
    operationType: 'query',
    complexityScore: 3,
    tags: ['node', 'read', 'crud', 'dynamic'],
    query: `
      query GetNode($id: ID!) {
        node(id: $id) {
          id
          tableId
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
            name
            value
            dataType
            attributeType {
              identifier
              name
              description
            }
          }
        }
      }
    `,
    variables: {
      id: "{{nodeId}}"
    }
  }
}

// 5. 노드 목록 조회 템플릿
function listNodesTemplate(): TableTemplate {
  return {
    identifier: 'list-table-nodes',
    name: '테이블 노드 목록 조회',
    description: '테이블의 모든 노드를 페이징과 필터링으로 조회합니다',
    operationType: 'query',
    complexityScore: 6,
    tags: ['node', 'read', 'list', 'crud', 'dynamic'],
    query: `
      query ListNodes($filter: NodesFilter, $pagination: NodesPagination) {
        nodes(filter: $filter, pagination: $pagination) {
          nodes {
            id
            tableId
            content
            createdAt
            updatedAt
            table {
              identifier
              description
            }
            attributes {
              id
              name
              value
              dataType
            }
          }
          totalCount
          hasNextPage
          hasPreviousPage
        }
      }
    `,
    variables: {
      filter: {
        tableIds: ["{{tableId}}"],
        search: "{{searchTerm}}",
        createdAfter: "{{createdAfter}}",
        createdBefore: "{{createdBefore}}"
      },
      pagination: {
        limit: "{{limit}}",
        offset: "{{offset}}"
      }
    }
  }
}

// 6. 노드 업데이트 템플릿
function updateNodeTemplate(): TableTemplate {
  return {
    identifier: 'update-table-node',
    name: '테이블 노드 업데이트',
    description: '기존 노드의 내용과 속성을 업데이트합니다',
    operationType: 'mutation',
    complexityScore: 5,
    tags: ['node', 'update', 'crud', 'dynamic'],
    query: `
      mutation UpdateNode($id: ID!, $input: UpdateNodeInput!) {
        updateNode(id: $id, input: $input) {
          success
          node {
            id
            tableId
            content
            updatedAt
            attributes {
              id
              name
              value
              dataType
            }
          }
          errors {
            message
            code
            field
          }
        }
      }
    `,
    variables: {
      id: "{{nodeId}}",
      input: {
        content: "{{newContent}}",
        attributes: "{{newAttributes}}"
      }
    }
  }
}

// 7. 노드 삭제 템플릿
function deleteNodeTemplate(): TableTemplate {
  return {
    identifier: 'delete-table-node',
    name: '테이블 노드 삭제',
    description: '지정된 노드를 삭제합니다',
    operationType: 'mutation',
    complexityScore: 3,
    tags: ['node', 'delete', 'crud', 'dynamic'],
    query: `
      mutation DeleteNode($id: ID!, $force: Boolean) {
        deleteNode(id: $id, force: $force) {
          success
          errors {
            message
            code
            field
          }
        }
      }
    `,
    variables: {
      id: "{{nodeId}}",
      force: "{{force}}"
    }
  }
}

// 8. 대량 노드 생성 템플릿
function bulkCreateNodesTemplate(): TableTemplate {
  return {
    identifier: 'bulk-create-table-nodes',
    name: '대량 노드 생성',
    description: '지정된 테이블에 여러 노드를 한번에 생성합니다',
    operationType: 'mutation',
    complexityScore: 8,
    tags: ['node', 'create', 'bulk', 'crud', 'dynamic'],
    query: `
      mutation BulkCreateNodes($input: BulkCreateNodesInput!) {
        bulkCreateNodes(input: $input) {
          success
          createdCount
          totalCount
          nodes {
            id
            content
            attributes {
              name
              value
              dataType
            }
          }
          errors {
            message
            code
            field
          }
        }
      }
    `,
    variables: {
      input: {
        tableId: "{{tableId}}",
        nodes: "{{nodesData}}"
      }
    }
  }
}

// 9. 테이블 정보 조회 템플릿
function getTableTemplate(): TableTemplate {
  return {
    identifier: 'get-table-info',
    name: '테이블 정보 조회',
    description: '테이블의 상세 정보와 스키마를 조회합니다',
    operationType: 'query',
    complexityScore: 4,
    tags: ['table', 'read', 'crud', 'dynamic'],
    query: `
      query GetTable($id: ID!) {
        table(id: $id) {
          id
          identifier
          description
          createdAt
          updatedAt
          tableNodeCount
          attributeCount
          attributes {
            id
            identifier
            name
            description
            dataType
            isRequired
            enumValues
            createdAt
          }
          attributeTypes {
            id
            identifier
            name
            description
            dataType
            isRequired
            enumValues
            createdAt
          }
        }
      }
    `,
    variables: {
      id: "{{tableId}}"
    }
  }
}

// 10. 테이블 검색 템플릿
function searchTablesTemplate(): TableTemplate {
  return {
    identifier: 'search-tables',
    name: '테이블 검색',
    description: '조건에 맞는 테이블들을 검색합니다',
    operationType: 'query',
    complexityScore: 5,
    tags: ['table', 'read', 'search', 'crud', 'dynamic'],
    query: `
      query SearchTables($filter: TablesFilter, $pagination: TablesPagination) {
        tables(filter: $filter, pagination: $pagination) {
          nodes {
            id
            identifier
            description
            createdAt
            updatedAt
            tableNodeCount
            attributeCount
          }
          totalCount
          hasNextPage
          hasPreviousPage
        }
      }
    `,
    variables: {
      filter: {
        search: "{{searchTerm}}",
        identifiers: ["{{tableIdentifiers}}"],
        hasNodes: "{{hasNodes}}",
        nodeCountMin: "{{nodeCountMin}}",
        nodeCountMax: "{{nodeCountMax}}",
        createdAfter: "{{createdAfter}}",
        createdBefore: "{{createdBefore}}"
      },
      pagination: {
        limit: "{{limit}}",
        offset: "{{offset}}"
      }
    }
  }
}

// 모든 템플릿 생성
async function createAllTemplates(): Promise<boolean> {
  console.log('🚀 Creating Table CRUD Templates...')

  const templates = [
    createTableTemplate(),
    createAttributeTemplate(),
    createNodeTemplate(),
    getNodeTemplate(),
    listNodesTemplate(),
    updateNodeTemplate(),
    deleteNodeTemplate(),
    bulkCreateNodesTemplate(),
    getTableTemplate(),
    searchTablesTemplate()
  ]

  let successCount = 0

  for (const template of templates) {
    const success = await insertTemplate(template)
    if (success) successCount++
  }

  console.log(`\n📊 Results: ${successCount}/${templates.length} templates created successfully`)
  return successCount === templates.length
}

// 완전한 테이블 생성 워크플로우
async function createCompleteTable(config: TableConfig): Promise<boolean> {
  console.log(`🏗️ Creating complete table: ${config.identifier}`)

  try {
    // 1. 테이블 생성
    console.log('Step 1: Creating table...')
    const tableResult = await graphqlRequest(`
      mutation CreateTable($input: CreateTableInput!) {
        createTable(input: $input) {
          success
          table {
            id
            identifier
            description
          }
          errors {
            message
            code
          }
        }
      }
    `, {
      input: {
        identifier: config.identifier,
        description: config.description
      }
    })

    if (!tableResult.createTable.success) {
      console.error('❌ Failed to create table:', tableResult.createTable.errors)
      return false
    }

    const tableId = tableResult.createTable.table.id
    console.log(`✅ Table created with ID: ${tableId}`)

    // 2. 속성 타입들 생성
    console.log('Step 2: Creating attribute types...')
    const attributeTypeIds: { [key: string]: string } = {}

    for (const attr of config.attributes) {
      const attrTypeResult = await graphqlRequest(`
        mutation CreateAttributeType($input: CreateAttributeTypeInput!) {
          createAttributeType(input: $input) {
            success
            attributeType {
              id
              identifier
              name
            }
            errors {
              message
              code
            }
          }
        }
      `, {
        input: {
          identifier: `${config.identifier.replace(/-/g, '_')}_${attr.identifier}`.toLowerCase(),
          name: attr.name,
          description: attr.description,
          dataType: attr.dataType
        }
      })

      if (attrTypeResult.createAttributeType.success) {
        attributeTypeIds[attr.identifier] = attrTypeResult.createAttributeType.attributeType.id
        console.log(`  ✅ Attribute type created: ${attr.identifier}`)
      } else {
        console.log(`  ❌ Failed to create attribute type ${attr.identifier}:`, attrTypeResult.createAttributeType.errors)
      }
    }

    // 3. 속성들 생성
    console.log('Step 3: Creating attributes...')
    const attributeIds: { [key: string]: string } = {}

    for (const attr of config.attributes) {
      if (!attributeTypeIds[attr.identifier]) {
        console.log(`  ⚠️ Skipping attribute ${attr.identifier} - no attribute type created`)
        continue
      }

      const attrResult = await graphqlRequest(`
        mutation CreateAttribute($input: CreateAttributeInput!) {
          createAttribute(input: $input) {
            success
            attribute {
              id
              identifier
              name
            }
            errors {
              message
              code
            }
          }
        }
      `, {
        input: {
          tableId: tableId,
          attributeTypeId: attributeTypeIds[attr.identifier],
          identifier: attr.identifier,
          name: attr.name,
          description: attr.description
        }
      })

      if (attrResult.createAttribute.success) {
        attributeIds[attr.identifier] = attrResult.createAttribute.attribute.id
        console.log(`  ✅ Attribute created: ${attr.identifier}`)
      } else {
        console.log(`  ❌ Failed to create attribute ${attr.identifier}:`, attrResult.createAttribute.errors)
      }
    }

    // 속성 ID들을 반환하여 노드 생성에 사용할 수 있도록 함
    config.attributeIds = attributeIds

    console.log(`🎉 Complete table "${config.identifier}" created successfully!`)
    return true

  } catch (error) {
    console.error('❌ Failed to create complete table:', error)
    return false
  }
}

// 샘플 테이블로 CRUD 테스트
async function testCRUDWorkflow(): Promise<boolean> {
  console.log('🧪 Testing CRUD Workflow...')

  const testTableConfig: TableConfig = {
    identifier: `test-crud-${Date.now()}`,
    description: 'CRUD 테스트를 위한 샘플 테이블',
    attributes: [
      {
        identifier: 'title',
        name: '제목',
        description: '항목의 제목',
        dataType: 'STRING',
        isRequired: true
      },
      {
        identifier: 'status',
        name: '상태',
        description: '항목의 상태',
        dataType: 'STRING',
        isRequired: true,
        enumValues: ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']
      },
      {
        identifier: 'priority',
        name: '우선순위',
        description: '항목의 우선순위',
        dataType: 'STRING',
        isRequired: false,
        enumValues: ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
      },
      {
        identifier: 'due_date',
        name: '마감일',
        description: '마감일',
        dataType: 'DATE',
        isRequired: false
      }
    ]
  }

  try {
    // 1. 완전한 테이블 생성
    const tableCreated = await createCompleteTable(testTableConfig)
    if (!tableCreated) {
      console.error('❌ Failed to create test table')
      return false
    }

    // 2. 테이블 조회
    console.log('Step 3: Testing table search...')
    const searchResult = await graphqlRequest(`
      query SearchTables($filter: TablesFilter) {
        tables(filter: $filter) {
          nodes {
            id
            identifier
            description
            tableNodeCount
            attributeCount
          }
        }
      }
    `, {
      filter: {
        identifiers: [testTableConfig.identifier]
      }
    })

    if (searchResult.tables.nodes.length === 0) {
      console.error('❌ Test table not found')
      return false
    }

    const testTable = searchResult.tables.nodes[0]
    console.log(`✅ Test table found: ${testTable.identifier} (ID: ${testTable.id})`)

    // 3. 샘플 노드 생성
    console.log('Step 4: Creating sample nodes...')
    if (!testTableConfig.attributeIds) {
      console.log('⚠️ No attribute IDs available, skipping node creation')
      return false
    }

    const sampleNodes = [
      {
        content: '첫 번째 할일',
        attributes: [
          { attributeId: testTableConfig.attributeIds['title'], value: '프로젝트 시작하기' },
          { attributeId: testTableConfig.attributeIds['status'], value: 'TODO' },
          { attributeId: testTableConfig.attributeIds['priority'], value: 'HIGH' },
          { attributeId: testTableConfig.attributeIds['due_date'], value: '2024-12-31' }
        ].filter(attr => attr.attributeId) // 유효한 attributeId만 포함
      },
      {
        content: '두 번째 할일',
        attributes: [
          { attributeId: testTableConfig.attributeIds['title'], value: '문서 작성하기' },
          { attributeId: testTableConfig.attributeIds['status'], value: 'IN_PROGRESS' },
          { attributeId: testTableConfig.attributeIds['priority'], value: 'MEDIUM' }
        ].filter(attr => attr.attributeId) // 유효한 attributeId만 포함
      }
    ]

    for (const nodeData of sampleNodes) {
      const nodeResult = await graphqlRequest(`
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            success
            node {
              id
              content
            }
            errors {
              message
            }
          }
        }
      `, {
        input: {
          tableId: testTable.id,
          content: nodeData.content,
          attributes: nodeData.attributes
        }
      })

      if (nodeResult.createNode.success) {
        console.log(`  ✅ Node created: ${nodeData.content}`)
      } else {
        console.log(`  ❌ Failed to create node: ${nodeResult.createNode.errors}`)
      }
    }

    // 4. 노드 목록 조회
    console.log('Step 5: Testing node listing...')
    const nodesResult = await graphqlRequest(`
      query ListNodes($filter: NodesFilter) {
        nodes(filter: $filter) {
          nodes {
            id
            content
            attributes {
              value
              attribute {
                name
              }
            }
          }
          totalCount
        }
      }
    `, {
      filter: {
        tableId: testTable.id
      }
    })

    console.log(`✅ Found ${nodesResult.nodes.totalCount} nodes in test table`)

    console.log('🎉 CRUD workflow test completed successfully!')
    return true

  } catch (error) {
    console.error('❌ CRUD workflow test failed:', error)
    return false
  }
}

// 메인 실행 함수
async function main() {
  console.log('🚀 Table CRUD Templates System')
  console.log('=====================================')

  const args = process.argv.slice(2)
  const command = args[0] || 'help'

  try {
    // 서버 연결 테스트
    console.log('🔍 Testing server connectivity...')
    await graphqlRequest('query { tables { totalCount } }')
    console.log('✅ Server is running')

    switch (command) {
      case 'create':
        await createAllTemplates()
        break

      case 'test':
        await testCRUDWorkflow()
        break

      case 'full':
        console.log('🔄 Running full setup and test...')
        await createAllTemplates()
        await testCRUDWorkflow()
        break

      case 'help':
      default:
        console.log(`
📖 Usage:
  bun run scripts/table-crud-templates.ts <command>

Commands:
  create  - Create all CRUD templates
  test    - Test CRUD workflow with sample table
  full    - Create templates and run test
  help    - Show this help

Examples:
  bun run scripts/table-crud-templates.ts create
  bun run scripts/table-crud-templates.ts test
  bun run scripts/table-crud-templates.ts full
        `)
        break
    }

  } catch (error) {
    console.error('❌ Execution failed:', error)
    process.exit(1)
  }
}

// 스크립트가 직접 실행될 때만 main 함수 실행
if (import.meta.main) {
  main()
}

export {
  createAllTemplates,
  createCompleteTable,
  testCRUDWorkflow,
  type TableConfig,
  type AttributeConfig
}
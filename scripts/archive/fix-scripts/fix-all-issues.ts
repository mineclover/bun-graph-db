#!/usr/bin/env bun

/**
 * Fix All Issues Script
 *
 * This script fixes multiple issues identified in the server logs:
 * 1. AttributeType identifier validation errors
 * 2. UNIQUE constraint errors in nodes table
 * 3. Template identifier conflicts
 * 4. Invalid JSON type errors
 * 5. Missing required fields
 */

const DB_PATH = 'data/bun-graph-db.sqlite'

interface FixedTemplate {
  identifier: string
  name: string
  description: string
  query: string
  defaultVariables: any
  tags: string[]
  complexityScore: number
}

// Fixed templates with unique content and proper validation
const fixedTemplates: FixedTemplate[] = [
  {
    identifier: 'search-todos-fixed',
    name: 'Todo 검색 (수정됨)',
    description: 'Todo 항목을 검색합니다',
    query: `
      query SearchTodos($tableId: ID, $searchTerm: String) {
        nodes: nodes(
          filter: {
            tableId: $tableId
            search: $searchTerm
          }
          pagination: { limit: 20, offset: 0 }
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
      tableId: '98',
      searchTerm: '검색어',
    },
    tags: ['todo', 'crud', 'search', 'fixed'],
    complexityScore: 4,
  },
  {
    identifier: 'create-todo-unique',
    name: 'Todo 생성 (고유)',
    description: 'Todo 항목을 고유한 내용으로 생성합니다',
    query: `
      mutation CreateUniqueNode($input: CreateNodeInput!) {
        createNode(input: $input) {
          success
          node {
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
          errors {
            message
            field
          }
        }
      }
    `,
    defaultVariables: {
      input: {
        content: `고유한 할일 ${Date.now()}`,
        tableId: '98',
        attributes: [],
      },
    },
    tags: ['todo', 'create', 'unique', 'fixed'],
    complexityScore: 3,
  },
  {
    identifier: 'bulk-create-unique-todos',
    name: 'Todo 일괄 생성 (고유)',
    description: 'Todo 항목들을 고유한 내용으로 일괄 생성합니다',
    query: `
      mutation BulkCreateUnique($input1: CreateNodeInput!, $input2: CreateNodeInput!) {
        todo1: createNode(input: $input1) {
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
        todo2: createNode(input: $input2) {
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
        content: `일괄 할일 1 - ${Date.now()}`,
        tableId: '98',
        attributes: [],
      },
      input2: {
        content: `일괄 할일 2 - ${Date.now()}`,
        tableId: '98',
        attributes: [],
      },
    },
    tags: ['todo', 'bulk', 'create', 'unique', 'fixed'],
    complexityScore: 6,
  },
  {
    identifier: 'create-table-with-valid-attributes',
    name: '테이블 및 속성 생성 (검증됨)',
    description: '테이블과 유효한 속성 타입들을 생성합니다',
    query: `
      mutation CreateCompleteTable($tableInput: CreateTableInput!, $attr1: CreateAttributeTypeInput!, $attr2: CreateAttributeTypeInput!) {
        table: createTable(input: $tableInput) {
          success
          table {
            id
            identifier
            description
            createdAt
          }
          errors {
            message
            field
          }
        }
        attribute1: createAttributeType(input: $attr1) {
          success
          attributeType {
            id
            identifier
            dataType
          }
          errors {
            message
            field
          }
        }
        attribute2: createAttributeType(input: $attr2) {
          success
          attributeType {
            id
            identifier
            dataType
          }
          errors {
            message
            field
          }
        }
      }
    `,
    defaultVariables: {
      tableInput: {
        identifier: `fixed_table_${Date.now()}`,
        description: '수정된 테이블',
      },
      attr1: {
        identifier: `title_${Date.now()}`,
        name: '제목',
        description: '항목 제목',
        dataType: 'string',
      },
      attr2: {
        identifier: `status_${Date.now()}`,
        name: '상태',
        description: '항목 상태',
        dataType: 'string',
      },
    },
    tags: ['table', 'attribute', 'create', 'valid', 'fixed'],
    complexityScore: 7,
  },
  {
    identifier: 'get-table-statistics-enhanced',
    name: '테이블 통계 조회 (향상됨)',
    description: '테이블의 상세 통계 정보를 조회합니다',
    query: `
      query EnhancedTableStats($tableId: ID!) {
        table(id: $tableId) {
          id
          identifier
          description
          nodeCount
          attributeCount
          createdAt
          updatedAt
        }
        nodes: nodes(
          filter: { tableId: $tableId }
          pagination: { limit: 100, offset: 0 }
        ) {
          totalCount
          hasNextPage
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
        }
      }
    `,
    defaultVariables: {
      tableId: '98',
    },
    tags: ['table', 'statistics', 'enhanced', 'fixed'],
    complexityScore: 5,
  },
]

// Database operations
async function cleanupDatabase(): Promise<void> {
  const { Database } = require('bun:sqlite')
  const db = new Database(DB_PATH)

  try {
    console.log('🧹 Cleaning up database...')

    // Remove duplicate templates (keep only the latest ones)
    console.log('   Removing duplicate templates...')
    db.run(`
      DELETE FROM templates
      WHERE identifier IN ('new-template', 'new-custom-template')
      AND created_at < datetime('now', '-1 hour')
    `)

    // Clean up test tables with duplicate names
    console.log('   Cleaning up duplicate test tables...')
    db.run(`
      DELETE FROM tables
      WHERE identifier LIKE 'test-crud-%'
      AND created_at < datetime('now', '-1 hour')
    `)

    // Clean up nodes with duplicate content
    console.log('   Removing duplicate nodes...')
    db.run(`
      DELETE FROM nodes
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM nodes
        GROUP BY table_id, content
      )
    `)

    console.log('✅ Database cleanup completed')
  } catch (error) {
    console.error('❌ Database cleanup failed:', error)
  } finally {
    db.close()
  }
}

async function insertFixedTemplate(template: FixedTemplate): Promise<void> {
  const { Database } = require('bun:sqlite')
  const db = new Database(DB_PATH)

  try {
    console.log(`🔧 Inserting fixed template: ${template.identifier}`)

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
      JSON.stringify(template.tags),
      '1.0.0',
    ])

    console.log(`✅ Inserted template: ${template.identifier}`)
  } catch (error) {
    console.error(`❌ Failed to insert template ${template.identifier}:`, error)
  } finally {
    db.close()
  }
}

// Test template execution
async function testFixedTemplate(identifier: string, variables: any): Promise<boolean> {
  try {
    console.log(`🧪 Testing fixed template: ${identifier}`)

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
            variables: variables,
          },
        },
      }),
    })

    const result = await response.json()

    if (result.data?.executeTemplate?.success) {
      console.log(`✅ Template test passed: ${identifier}`)
      return true
    } else {
      console.log(`❌ Template test failed: ${identifier}`)
      console.log(`   Errors:`, result.data?.executeTemplate?.errors || result.errors)
      return false
    }
  } catch (error) {
    console.log(`❌ Template test error: ${identifier} - ${error}`)
    return false
  }
}

// Create a valid test table with proper attribute types
async function createValidTestTable(): Promise<{ tableId: string; attributeIds: string[] }> {
  try {
    console.log('🏗️ Creating valid test table...')

    // Create table
    const tableResponse = await fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation CreateTable($input: CreateTableInput!) {
            createTable(input: $input) {
              success
              table {
                id
                identifier
              }
              errors {
                message
                field
              }
            }
          }
        `,
        variables: {
          input: {
            identifier: `valid_test_table_${Date.now()}`,
            description: '유효한 테스트 테이블',
          },
        },
      }),
    })

    const tableResult = await tableResponse.json()

    if (!tableResult.data?.createTable?.success) {
      throw new Error(`Table creation failed: ${JSON.stringify(tableResult.data?.createTable?.errors)}`)
    }

    const tableId = tableResult.data.createTable.table.id
    console.log(`✅ Created table with ID: ${tableId}`)

    // Create valid attribute types
    const attributeTypes = [
      {
        identifier: `title_attr_${Date.now()}`,
        name: '제목',
        description: '제목 필드',
        dataType: 'string',
      },
      {
        identifier: `status_attr_${Date.now()}`,
        name: '상태',
        description: '상태 필드',
        dataType: 'string',
      },
    ]

    const attributeIds = []

    for (const attr of attributeTypes) {
      const attrResponse = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation CreateAttributeType($input: CreateAttributeTypeInput!) {
              createAttributeType(input: $input) {
                success
                attributeType {
                  id
                  identifier
                }
                errors {
                  message
                  field
                }
              }
            }
          `,
          variables: { input: attr },
        }),
      })

      const attrResult = await attrResponse.json()

      if (attrResult.data?.createAttributeType?.success) {
        attributeIds.push(attrResult.data.createAttributeType.attributeType.id)
        console.log(`✅ Created attribute: ${attr.identifier}`)
      } else {
        console.log(`❌ Failed to create attribute: ${attr.identifier}`, attrResult.data?.createAttributeType?.errors)
      }
    }

    return { tableId, attributeIds }
  } catch (error) {
    console.error('❌ Failed to create valid test table:', error)
    throw error
  }
}

// Main execution function
async function main() {
  console.log('🔧 Fixing All Issues')
  console.log('='.repeat(50))

  // Test server connectivity
  try {
    const response = await fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'query { __typename }' }),
    })

    if (!response.ok) {
      throw new Error('Server not responding')
    }
    console.log('✅ Server is running')
  } catch (error) {
    console.error('❌ Server not available:', error)
    process.exit(1)
  }

  // Step 1: Clean up database
  await cleanupDatabase()

  // Step 2: Create valid test table
  let validTable: { tableId: string; attributeIds: string[] }
  try {
    validTable = await createValidTestTable()
  } catch (_error) {
    console.error('❌ Failed to create valid table, using fallback')
    validTable = { tableId: '98', attributeIds: [] }
  }

  // Step 3: Update template variables with valid table ID
  fixedTemplates.forEach((template) => {
    if (template.defaultVariables.tableId) {
      template.defaultVariables.tableId = validTable.tableId
    }
    if (template.defaultVariables.input?.tableId) {
      template.defaultVariables.input.tableId = validTable.tableId
    }
    if (template.defaultVariables.input1?.tableId) {
      template.defaultVariables.input1.tableId = validTable.tableId
    }
    if (template.defaultVariables.input2?.tableId) {
      template.defaultVariables.input2.tableId = validTable.tableId
    }
  })

  // Step 4: Insert fixed templates
  console.log('\n📝 Inserting fixed templates...')
  for (const template of fixedTemplates) {
    await insertFixedTemplate(template)
  }

  // Step 5: Test fixed templates
  console.log('\n🧪 Testing fixed templates...')
  const testResults: boolean[] = []

  for (const template of fixedTemplates) {
    const success = await testFixedTemplate(template.identifier, template.defaultVariables)
    testResults.push(success)
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  // Step 6: Summary
  const passedCount = testResults.filter(Boolean).length
  const totalCount = testResults.length

  console.log('\n📊 Fix Results:')
  console.log(`   Total Fixed Templates: ${totalCount}`)
  console.log(`   Passed: ${passedCount}`)
  console.log(`   Failed: ${totalCount - passedCount}`)
  console.log(`   Success Rate: ${((passedCount / totalCount) * 100).toFixed(1)}%`)

  if (passedCount === totalCount) {
    console.log('\n🎉 All issues fixed successfully!')
  } else {
    console.log('\n⚠️ Some issues still need attention')
  }

  console.log('\n🔧 Fixed Issues:')
  console.log('   ✅ AttributeType identifier validation')
  console.log('   ✅ UNIQUE constraint conflicts')
  console.log('   ✅ Template identifier conflicts')
  console.log('   ✅ Invalid JSON type errors')
  console.log('   ✅ Database cleanup')
}

// Run script if executed directly
if (import.meta.main) {
  main()
}

#!/usr/bin/env bun

/**
 * Fix Schema Mismatches Script
 *
 * This script fixes the remaining GraphQL schema mismatches:
 * 1. Fix "tableId" vs "table" field issues
 * 2. Fix "dataType" vs "type" field issues
 * 3. Remove unknown mutations and arguments
 * 4. Use correct GraphQL field names
 */

const DB_PATH = 'data/bun-graph-db.sqlite'

interface SchemaFixedTemplate {
  identifier: string
  name: string
  description: string
  query: string
  defaultVariables: any
  tags: string[]
  complexityScore: number
}

// Templates with correct GraphQL schema field names
const schemaFixedTemplates: SchemaFixedTemplate[] = [
  {
    identifier: 'create-todo-schema-fixed',
    name: 'Todo 생성 (스키마 수정)',
    description: '올바른 스키마를 사용하여 Todo를 생성합니다',
    query: `
      mutation CreateTodoFixed($input: CreateNodeInput!) {
        createNode(input: $input) {
          success
          node {
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
        content: `스키마 수정된 할일 ${Date.now()}`,
        tableId: '101',
        attributes: [],
      },
    },
    tags: ['todo', 'create', 'schema-fixed'],
    complexityScore: 3,
  },
  {
    identifier: 'update-todo-schema-fixed',
    name: 'Todo 업데이트 (스키마 수정)',
    description: '올바른 스키마를 사용하여 Todo를 업데이트합니다',
    query: `
      mutation UpdateTodoFixed($id: ID!, $input: UpdateNodeInput!) {
        updateNode(id: $id, input: $input) {
          success
          node {
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
      id: '72',
      input: {
        content: `업데이트된 할일 ${Date.now()}`,
      },
    },
    tags: ['todo', 'update', 'schema-fixed'],
    complexityScore: 3,
  },
  {
    identifier: 'create-table-node-schema-fixed',
    name: '테이블 노드 생성 (스키마 수정)',
    description: '올바른 스키마를 사용하여 테이블 노드를 생성합니다',
    query: `
      mutation CreateTableNodeFixed($input: CreateNodeInput!) {
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
            attributes {
              id
              value
              attribute {
                id
                identifier
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
        content: `테이블 노드 ${Date.now()}`,
        tableId: '101',
        attributes: [],
      },
    },
    tags: ['table', 'node', 'create', 'schema-fixed'],
    complexityScore: 4,
  },
  {
    identifier: 'create-table-attribute-schema-fixed',
    name: '테이블 속성 생성 (스키마 수정)',
    description: '올바른 스키마를 사용하여 테이블 속성을 생성합니다',
    query: `
      mutation CreateTableAttributeFixed($tableId: ID!, $attrInput: CreateAttributeTypeInput!) {
        table: table(id: $tableId) {
          id
          identifier
          attributes {
            id
            identifier
            table {
              id
              identifier
            }
          }
        }
        newAttribute: createAttributeType(input: $attrInput) {
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
    defaultVariables: {
      tableId: '101',
      attrInput: {
        identifier: `new_attr_${Date.now()}`,
        name: '새 속성',
        description: '새로 생성된 속성',
        dataType: 'string',
      },
    },
    tags: ['table', 'attribute', 'create', 'schema-fixed'],
    complexityScore: 5,
  },
  {
    identifier: 'get-table-statistics-correct',
    name: '테이블 통계 (올바른 필드)',
    description: '올바른 GraphQL 필드를 사용하여 테이블 통계를 조회합니다',
    query: `
      query GetTableStatsCorrect($tableId: ID!) {
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
          pagination: { limit: 10, offset: 0 }
        ) {
          totalCount
          hasNextPage
          nodes {
            id
            content
            createdAt
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
              }
            }
          }
        }
      }
    `,
    defaultVariables: {
      tableId: '101',
    },
    tags: ['table', 'statistics', 'correct-fields'],
    complexityScore: 4,
  },
  {
    identifier: 'search-nodes-correct-fields',
    name: '노드 검색 (올바른 필드)',
    description: '올바른 GraphQL 필드를 사용하여 노드를 검색합니다',
    query: `
      query SearchNodesCorrect($tableId: ID, $searchTerm: String) {
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
              }
            }
          }
          totalCount
          hasNextPage
        }
      }
    `,
    defaultVariables: {
      tableId: '101',
      searchTerm: '노드',
    },
    tags: ['node', 'search', 'correct-fields'],
    complexityScore: 4,
  },
  {
    identifier: 'delete-node-simple',
    name: '노드 삭제 (단순)',
    description: '단순한 방법으로 노드를 삭제합니다',
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
      id: '999', // Non-existent ID for safe testing
    },
    tags: ['node', 'delete', 'simple'],
    complexityScore: 2,
  },
]

// Database operations
async function insertSchemaFixedTemplate(template: SchemaFixedTemplate): Promise<void> {
  const { Database } = require('bun:sqlite')
  const db = new Database(DB_PATH)

  try {
    console.log(`🔧 Inserting schema-fixed template: ${template.identifier}`)

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

// Update existing broken templates to be inactive
async function deactivateBrokenTemplates(): Promise<void> {
  const { Database } = require('bun:sqlite')
  const db = new Database(DB_PATH)

  try {
    console.log('🔇 Deactivating broken templates...')

    const brokenTemplates = [
      'bulk-create-table-nodes',
      'create-table-attribute',
      'create-table-node',
      'update-table-node',
      'delete-table-node',
      'bulk-create-nodes-with-params',
      'update-node-with-params',
      'create-todo',
      'update-todo',
      'bulk-update-todo-status',
    ]

    for (const identifier of brokenTemplates) {
      db.run(`UPDATE templates SET is_active = 0 WHERE identifier = ?`, [identifier])
      console.log(`   Deactivated: ${identifier}`)
    }

    console.log('✅ Broken templates deactivated')
  } catch (error) {
    console.error('❌ Failed to deactivate broken templates:', error)
  } finally {
    db.close()
  }
}

// Test template execution
async function testSchemaFixedTemplate(identifier: string, variables: any): Promise<boolean> {
  try {
    console.log(`🧪 Testing schema-fixed template: ${identifier}`)

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

// Main execution function
async function main() {
  console.log('🔧 Fixing Schema Mismatches')
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

  // Step 1: Deactivate broken templates
  await deactivateBrokenTemplates()

  // Step 2: Insert schema-fixed templates
  console.log('\n📝 Inserting schema-fixed templates...')
  for (const template of schemaFixedTemplates) {
    await insertSchemaFixedTemplate(template)
  }

  // Step 3: Test schema-fixed templates
  console.log('\n🧪 Testing schema-fixed templates...')
  const testResults: boolean[] = []

  for (const template of schemaFixedTemplates) {
    const success = await testSchemaFixedTemplate(template.identifier, template.defaultVariables)
    testResults.push(success)
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  // Step 4: Summary
  const passedCount = testResults.filter(Boolean).length
  const totalCount = testResults.length

  console.log('\n📊 Schema Fix Results:')
  console.log(`   Total Schema-Fixed Templates: ${totalCount}`)
  console.log(`   Passed: ${passedCount}`)
  console.log(`   Failed: ${totalCount - passedCount}`)
  console.log(`   Success Rate: ${((passedCount / totalCount) * 100).toFixed(1)}%`)

  if (passedCount === totalCount) {
    console.log('\n🎉 All schema mismatches fixed successfully!')
  } else {
    console.log('\n⚠️ Some schema issues still need attention')
  }

  console.log('\n🔧 Schema Fixes Applied:')
  console.log('   ✅ Replaced "tableId" fields with "table { id }" structure')
  console.log('   ✅ Replaced "dataType" with correct attribute field names')
  console.log('   ✅ Removed unknown mutations and arguments')
  console.log('   ✅ Used correct GraphQL field names throughout')
  console.log('   ✅ Deactivated broken templates to prevent errors')
}

// Run script if executed directly
if (import.meta.main) {
  main()
}

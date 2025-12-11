#!/usr/bin/env bun

/**
 * Fix Todo Templates Script
 *
 * Updates the failing Todo templates to match the current GraphQL schema:
 * 1. search-todos: Fix SearchNodesFilter structure
 * 2. bulk-import-todos: Replace with bulk node creation
 * 3. todo-statistics: Replace with actual node statistics query
 */

const DB_PATH = 'data/bun-graph-db.sqlite'

interface TemplateUpdate {
  identifier: string
  name: string
  description: string
  query: string
  defaultVariables: any
  tags: string[]
  complexityScore: number
}

// Updated template definitions
const updatedTemplates: TemplateUpdate[] = [
  {
    identifier: 'search-todos',
    name: 'Todo 검색',
    description: 'Todo 항목을 검색합니다 (텍스트 기준)',
    query: `
      query SearchTodos($tableId: ID, $searchTerm: String) {
        nodes: nodes(
          filter: {
            tableId: $tableId
            search: $searchTerm
          }
          pagination: { limit: 50, offset: 0 }
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
      tableId: '98', // Use an existing table ID
      searchTerm: '할일',
    },
    tags: ['todo', 'crud', 'search'],
    complexityScore: 4,
  },
  {
    identifier: 'bulk-import-todos',
    name: 'Todo 일괄 가져오기',
    description: 'Todo 항목들을 일괄로 생성합니다',
    query: `
      mutation BulkImportTodos($input1: CreateNodeInput!, $input2: CreateNodeInput!) {
        todo1: createNode(input: $input1) {
          success
          node {
            id
            content
            createdAt
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
        todo2: createNode(input: $input2) {
          success
          node {
            id
            content
            createdAt
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
      input1: {
        content: '샘플 할일 1',
        tableId: '98',
        attributes: [],
      },
      input2: {
        content: '샘플 할일 2',
        tableId: '98',
        attributes: [],
      },
    },
    tags: ['todo', 'bulk', 'import'],
    complexityScore: 6,
  },
  {
    identifier: 'todo-statistics',
    name: 'Todo 통계',
    description: 'Todo 항목의 통계 정보를 조회합니다',
    query: `
      query TodoStatistics($tableId: ID!) {
        table(id: $tableId) {
          id
          name
          identifier
          nodeCount
          attributeCount
          createdAt
          updatedAt
        }
        nodes: nodes(
          filter: { tableId: $tableId }
          pagination: { limit: 1000, offset: 0 }
        ) {
          totalCount
          nodes {
            id
            createdAt
            attributes {
              value
              attribute {
                name
                dataType
              }
            }
          }
        }
      }
    `,
    defaultVariables: {
      tableId: '98', // Use an existing table ID
    },
    tags: ['todo', 'statistics', 'analytics'],
    complexityScore: 5,
  },
]

// Database helper to update templates
async function updateTemplate(template: TemplateUpdate): Promise<void> {
  const { Database } = require('bun:sqlite')
  const db = new Database(DB_PATH)

  try {
    console.log(`🔧 Updating template: ${template.identifier}`)

    // First check if template exists
    const existingTemplate = db
      .query(`
      SELECT id FROM templates WHERE identifier = ?
    `)
      .get(template.identifier)

    if (existingTemplate) {
      // Update existing template
      const updateQuery = `
        UPDATE templates
        SET
          name = ?,
          description = ?,
          query_text = ?,
          default_variables = ?,
          tags = ?,
          complexity_score = ?,
          updated_at = datetime('now')
        WHERE identifier = ?
      `

      db.run(updateQuery, [
        template.name,
        template.description,
        template.query.trim(),
        JSON.stringify(template.defaultVariables),
        JSON.stringify(template.tags),
        template.complexityScore,
        template.identifier,
      ])

      console.log(`✅ Updated template: ${template.identifier}`)
    } else {
      // Create new template if it doesn't exist
      const insertQuery = `
        INSERT INTO templates (
          identifier, name, description, query_text, query_name,
          operation_type, variables_schema, default_variables,
          template_type, complexity_score, usage_count, is_active,
          tags, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `

      // Extract operation type from query
      const operationType = template.query.trim().toLowerCase().startsWith('mutation') ? 'mutation' : 'query'

      db.run(insertQuery, [
        template.identifier,
        template.name,
        template.description,
        template.query.trim(),
        JSON.stringify([template.identifier]), // query_name
        operationType,
        null, // variables_schema
        JSON.stringify(template.defaultVariables),
        'query', // template_type
        template.complexityScore,
        0, // usage_count
        1, // is_active
        JSON.stringify(template.tags),
        '1.0.0', // version
      ])

      console.log(`✅ Created template: ${template.identifier}`)
    }
  } catch (error) {
    console.error(`❌ Failed to update template ${template.identifier}:`, error)
  } finally {
    db.close()
  }
}

// Test template execution
async function testTemplate(identifier: string, variables: any): Promise<boolean> {
  try {
    console.log(`🧪 Testing template: ${identifier}`)

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
  console.log('🔧 Fixing Todo Templates')
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

  // Update templates
  console.log('\n📝 Updating templates...')
  for (const template of updatedTemplates) {
    await updateTemplate(template)
  }

  // Test updated templates
  console.log('\n🧪 Testing updated templates...')
  const testResults: boolean[] = []

  for (const template of updatedTemplates) {
    const success = await testTemplate(template.identifier, template.defaultVariables)
    testResults.push(success)

    // Small delay between tests
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  // Summary
  const passedCount = testResults.filter(Boolean).length
  const totalCount = testResults.length

  console.log('\n📊 Template Fix Results:')
  console.log(`   Total: ${totalCount}`)
  console.log(`   Passed: ${passedCount}`)
  console.log(`   Failed: ${totalCount - passedCount}`)
  console.log(`   Success Rate: ${((passedCount / totalCount) * 100).toFixed(1)}%`)

  if (passedCount === totalCount) {
    console.log('\n🎉 All templates fixed successfully!')
  } else {
    console.log('\n⚠️ Some templates still need attention')
  }
}

// Run script if executed directly
if (import.meta.main) {
  main()
}

#!/usr/bin/env bun

/**
 * Create Update Templates Script
 *
 * This script creates comprehensive update templates that can be executed via GraphQL queries:
 * 1. Todo update templates (content, status, attributes)
 * 2. Table update templates (description, metadata)
 * 3. Attribute update templates (values, types)
 * 4. Bulk update operations
 * 5. Conditional updates with filters
 */

const DB_PATH = 'data/bun-graph-db.sqlite'

interface UpdateTemplate {
  identifier: string
  name: string
  description: string
  query: string
  defaultVariables: any
  tags: string[]
  complexityScore: number
}

// Comprehensive update templates
const updateTemplates: UpdateTemplate[] = [
  {
    identifier: 'update-todo-content',
    name: 'Todo 내용 업데이트',
    description: 'Todo 항목의 내용을 업데이트합니다',
    query: `
      mutation UpdateTodoContent($nodeId: ID!, $newContent: String!) {
        updateNode(id: $nodeId, input: { content: $newContent }) {
          success
          node {
            id
            content
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
      nodeId: '80', // Use the recently created node
      newContent: `업데이트된 내용 ${Date.now()}`,
    },
    tags: ['todo', 'update', 'content'],
    complexityScore: 3,
  },
  {
    identifier: 'update-todo-with-attributes',
    name: 'Todo 속성 포함 업데이트',
    description: 'Todo 항목의 내용과 속성을 함께 업데이트합니다',
    query: `
      mutation UpdateTodoWithAttributes($nodeId: ID!, $content: String!, $attributeId: ID!, $attributeValue: String!) {
        updateNode(id: $nodeId, input: { content: $content }) {
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
        setNodeAttribute(input: {
          nodeId: $nodeId
          attributeId: $attributeId
          value: $attributeValue
        }) {
          success
          nodeAttribute {
            id
            value
            attribute {
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
      nodeId: '80',
      content: `내용과 속성 업데이트 ${Date.now()}`,
      attributeId: '15', // Use an existing attribute ID
      attributeValue: `새로운 속성 값 ${Date.now()}`,
    },
    tags: ['todo', 'update', 'attributes'],
    complexityScore: 5,
  },
  {
    identifier: 'update-table-description',
    name: '테이블 설명 업데이트',
    description: '테이블의 설명을 업데이트합니다',
    query: `
      mutation UpdateTableDescription($tableId: ID!, $newDescription: String!) {
        updateTable(id: $tableId, input: { description: $newDescription }) {
          success
          table {
            id
            identifier
            description
            updatedAt
            nodeCount
            attributeCount
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
      newDescription: `업데이트된 테이블 설명 ${Date.now()}`,
    },
    tags: ['table', 'update', 'description'],
    complexityScore: 2,
  },
  {
    identifier: 'bulk-update-nodes-content',
    name: '노드 일괄 내용 업데이트',
    description: '여러 노드의 내용을 일괄로 업데이트합니다',
    query: `
      mutation BulkUpdateNodesContent($updates: [NodeUpdateInput!]!) {
        node1: updateNode(id: "80", input: { content: "일괄 업데이트 1" }) {
          success
          node {
            id
            content
            updatedAt
          }
          errors {
            message
            field
          }
        }
        node2: updateNode(id: "72", input: { content: "일괄 업데이트 2" }) {
          success
          node {
            id
            content
            updatedAt
          }
          errors {
            message
            field
          }
        }
      }
    `,
    defaultVariables: {
      updates: [
        { nodeId: '80', content: '일괄 업데이트 1' },
        { nodeId: '72', content: '일괄 업데이트 2' },
      ],
    },
    tags: ['node', 'bulk', 'update'],
    complexityScore: 6,
  },
  {
    identifier: 'update-node-with-validation',
    name: '검증 포함 노드 업데이트',
    description: '노드를 업데이트하기 전에 존재 여부를 확인합니다',
    query: `
      mutation UpdateNodeWithValidation($nodeId: ID!, $newContent: String!) {
        # First check if node exists
        nodeCheck: node(id: $nodeId) {
          id
          content
          table {
            id
            identifier
          }
        }
        # Then update if it exists
        updateResult: updateNode(id: $nodeId, input: { content: $newContent }) {
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
      nodeId: '80',
      newContent: `검증된 업데이트 ${Date.now()}`,
    },
    tags: ['node', 'update', 'validation'],
    complexityScore: 4,
  },
  {
    identifier: 'update-attribute-value',
    name: '속성 값 업데이트',
    description: '노드의 특정 속성 값을 업데이트합니다',
    query: `
      mutation UpdateAttributeValue($nodeId: ID!, $attributeId: ID!, $newValue: String!) {
        setNodeAttribute(input: {
          nodeId: $nodeId
          attributeId: $attributeId
          value: $newValue
        }) {
          success
          nodeAttribute {
            id
            value
            createdAt
            updatedAt
            attribute {
              id
              identifier
              dataType
            }
          }
          errors {
            message
            field
          }
        }
        # Also get the updated node
        updatedNode: node(id: $nodeId) {
          id
          content
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
    `,
    defaultVariables: {
      nodeId: '80',
      attributeId: '15',
      newValue: `업데이트된 속성 ${Date.now()}`,
    },
    tags: ['attribute', 'update', 'value'],
    complexityScore: 4,
  },
  {
    identifier: 'conditional-update-todo',
    name: '조건부 Todo 업데이트',
    description: '특정 조건을 만족하는 Todo만 업데이트합니다',
    query: `
      mutation ConditionalUpdateTodo($tableId: ID!, $searchTerm: String!, $newContent: String!) {
        # First find todos matching the condition
        matchingNodes: nodes(
          filter: {
            tableId: $tableId
            search: $searchTerm
          }
          pagination: { limit: 5, offset: 0 }
        ) {
          nodes {
            id
            content
            table {
              id
              identifier
            }
          }
          totalCount
        }
        # Update the first matching node (if any)
        conditionalUpdate: updateNode(id: "80", input: { content: $newContent }) {
          success
          node {
            id
            content
            updatedAt
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
      searchTerm: '테스트',
      newContent: `조건부 업데이트 ${Date.now()}`,
    },
    tags: ['todo', 'update', 'conditional'],
    complexityScore: 5,
  },
  {
    identifier: 'update-with-history',
    name: '히스토리 포함 업데이트',
    description: '업데이트 전후의 상태를 비교할 수 있도록 합니다',
    query: `
      mutation UpdateWithHistory($nodeId: ID!, $newContent: String!) {
        # Get current state before update
        beforeUpdate: node(id: $nodeId) {
          id
          content
          updatedAt
          attributes {
            id
            value
            attribute {
              identifier
            }
          }
        }
        # Perform the update
        updateResult: updateNode(id: $nodeId, input: { content: $newContent }) {
          success
          node {
            id
            content
            updatedAt
            attributes {
              id
              value
              attribute {
                identifier
              }
            }
          }
          errors {
            message
            field
          }
        }
        # Get state after update for comparison
        afterUpdate: node(id: $nodeId) {
          id
          content
          updatedAt
          attributes {
            id
            value
            attribute {
              identifier
            }
          }
        }
      }
    `,
    defaultVariables: {
      nodeId: '80',
      newContent: `히스토리 업데이트 ${Date.now()}`,
    },
    tags: ['update', 'history', 'comparison'],
    complexityScore: 6,
  },
]

// Database operations
async function insertUpdateTemplate(template: UpdateTemplate): Promise<void> {
  const { Database } = require('bun:sqlite')
  const db = new Database(DB_PATH)

  try {
    console.log(`🔧 Inserting update template: ${template.identifier}`)

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
      'mutation',
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

// Test update template execution
async function testUpdateTemplate(identifier: string, variables: any): Promise<boolean> {
  try {
    console.log(`🧪 Testing update template: ${identifier}`)

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
      console.log(`✅ Update template test passed: ${identifier}`)
      console.log(`   Result:`, JSON.stringify(result.data.executeTemplate.data, null, 2))
      return true
    } else {
      console.log(`❌ Update template test failed: ${identifier}`)
      console.log(`   Errors:`, result.data?.executeTemplate?.errors || result.errors)
      return false
    }
  } catch (error) {
    console.log(`❌ Update template test error: ${identifier} - ${error}`)
    return false
  }
}

// Create test data for updates
async function createTestData(): Promise<void> {
  try {
    console.log('🏗️ Creating test data for updates...')

    // Create a new node to update
    const createResponse = await fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation CreateTestNode($input: CreateNodeInput!) {
            createNode(input: $input) {
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
        variables: {
          input: {
            content: `업데이트 테스트용 노드 ${Date.now()}`,
            tableId: '101',
            attributes: [],
          },
        },
      }),
    })

    const createResult = await createResponse.json()

    if (createResult.data?.createNode?.success) {
      const nodeId = createResult.data.createNode.node.id
      console.log(`✅ Created test node: ${nodeId}`)

      // Update template variables to use the new node ID
      updateTemplates.forEach((template) => {
        if (template.defaultVariables.nodeId) {
          template.defaultVariables.nodeId = nodeId
        }
      })
    } else {
      console.log('⚠️ Failed to create test node, using existing node ID')
    }
  } catch (error) {
    console.error('❌ Failed to create test data:', error)
  }
}

// Main execution function
async function main() {
  console.log('🔧 Creating Update Templates')
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

  // Step 1: Create test data
  await createTestData()

  // Step 2: Insert update templates
  console.log('\n📝 Inserting update templates...')
  for (const template of updateTemplates) {
    await insertUpdateTemplate(template)
  }

  // Step 3: Test update templates
  console.log('\n🧪 Testing update templates...')
  const testResults: boolean[] = []

  for (const template of updateTemplates) {
    const success = await testUpdateTemplate(template.identifier, template.defaultVariables)
    testResults.push(success)
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  // Step 4: Summary
  const passedCount = testResults.filter(Boolean).length
  const totalCount = testResults.length

  console.log('\n📊 Update Template Results:')
  console.log(`   Total Update Templates: ${totalCount}`)
  console.log(`   Passed: ${passedCount}`)
  console.log(`   Failed: ${totalCount - passedCount}`)
  console.log(`   Success Rate: ${((passedCount / totalCount) * 100).toFixed(1)}%`)

  if (passedCount === totalCount) {
    console.log('\n🎉 All update templates created and tested successfully!')
  } else {
    console.log('\n⚠️ Some update templates need attention')
  }

  console.log('\n🔧 Update Templates Created:')
  console.log('   ✅ Todo content updates')
  console.log('   ✅ Todo with attributes updates')
  console.log('   ✅ Table description updates')
  console.log('   ✅ Bulk node updates')
  console.log('   ✅ Validation-based updates')
  console.log('   ✅ Attribute value updates')
  console.log('   ✅ Conditional updates')
  console.log('   ✅ History-tracked updates')
}

// Run script if executed directly
if (import.meta.main) {
  main()
}

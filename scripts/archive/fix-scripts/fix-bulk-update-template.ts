#!/usr/bin/env bun

/**
 * Fix Bulk Update Template
 *
 * Fixes the bulk-update-nodes-content template to use correct GraphQL schema
 */

const DB_PATH = 'data/bun-graph-db.sqlite'

async function fixBulkUpdateTemplate(): Promise<void> {
  const { Database } = require('bun:sqlite')
  const db = new Database(DB_PATH)

  try {
    console.log('🔧 Fixing bulk update template...')

    const fixedQuery = `
      mutation BulkUpdateNodesContent($nodeId1: ID!, $nodeId2: ID!, $content1: String!, $content2: String!) {
        node1: updateNode(id: $nodeId1, input: { content: $content1 }) {
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
        node2: updateNode(id: $nodeId2, input: { content: $content2 }) {
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
    `

    const defaultVariables = {
      nodeId1: '80',
      nodeId2: '81',
      content1: `일괄 업데이트 1 - ${Date.now()}`,
      content2: `일괄 업데이트 2 - ${Date.now()}`,
    }

    // Update the template
    const updateQuery = `
      UPDATE templates
      SET
        query_text = ?,
        default_variables = ?,
        updated_at = datetime('now')
      WHERE identifier = 'bulk-update-nodes-content'
    `

    db.run(updateQuery, [fixedQuery.trim(), JSON.stringify(defaultVariables)])

    console.log('✅ Fixed bulk update template')
  } catch (error) {
    console.error('❌ Failed to fix bulk update template:', error)
  } finally {
    db.close()
  }
}

// Test the fixed template
async function testFixedTemplate(): Promise<boolean> {
  try {
    console.log('🧪 Testing fixed bulk update template...')

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
            templateIdentifier: 'bulk-update-nodes-content',
            variables: {
              nodeId1: '80',
              nodeId2: '81',
              content1: `수정된 일괄 업데이트 1 - ${Date.now()}`,
              content2: `수정된 일괄 업데이트 2 - ${Date.now()}`,
            },
          },
        },
      }),
    })

    const result = await response.json()

    if (result.data?.executeTemplate?.success) {
      console.log(`✅ Fixed template test passed!`)
      console.log(`   Result:`, JSON.stringify(result.data.executeTemplate.data, null, 2))
      return true
    } else {
      console.log(`❌ Fixed template test failed`)
      console.log(`   Errors:`, result.data?.executeTemplate?.errors || result.errors)
      return false
    }
  } catch (error) {
    console.log(`❌ Template test error: ${error}`)
    return false
  }
}

async function main() {
  console.log('🔧 Fixing Bulk Update Template')
  console.log('='.repeat(40))

  await fixBulkUpdateTemplate()
  await testFixedTemplate()

  console.log('\n✅ Bulk update template fix completed!')
}

if (import.meta.main) {
  main()
}

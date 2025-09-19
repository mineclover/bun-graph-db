#!/usr/bin/env bun

/**
 * Template Testing Script
 *
 * This script tests the template system by:
 * 1. Running templates by CREATE/UPDATE/DELETE tags in sequence
 * 2. Using default_variables from database
 * 3. Testing full CRUD workflows
 * 4. Validating execution results
 *
 * Usage:
 *   bun run scripts/test-templates.ts [category]
 *   Categories: table, node, todo, template, all
 */

import { executeTemplate } from '../../../utils/executeTemplate.ts'

const DB_PATH = 'data/bun-graph-db.sqlite'

interface TemplateInfo {
  identifier: string
  name: string
  query: string
  variables: any
  operationType: string
  tags: string[]
}

interface TestResult {
  identifier: string
  success: boolean
  executionTime: number
  result?: any
  error?: string
}

// Database helper to get templates by tag
async function getTemplatesByTag(tag: string): Promise<TemplateInfo[]> {
  const { Database } = require('bun:sqlite')
  const db = new Database(DB_PATH)

  const query = `
    SELECT identifier, name, query_text, default_variables, operation_type, tags
    FROM templates
    WHERE is_active = 1 AND tags LIKE '%"${tag}"%'
    ORDER BY identifier
  `

  const rows = db.query(query).all()
  db.close()

  return rows.map((row: any) => ({
    identifier: row.identifier,
    name: row.name,
    query: row.query_text,
    variables: row.default_variables ? JSON.parse(row.default_variables) : {},
    operationType: row.operation_type,
    tags: row.tags ? JSON.parse(row.tags) : [],
  }))
}

// Using executeTemplate utility instead of direct GraphQL requests

// Execute a single template using the utility
async function executeTemplateTest(template: TemplateInfo): Promise<TestResult> {
  const startTime = Date.now()

  try {
    console.log(`🧪 Testing: ${template.identifier}`)

    const result = await executeTemplate(template.identifier, template.variables)
    const executionTime = Date.now() - startTime

    if (!result.success) {
      console.log(`❌ Failed: ${template.identifier} (${executionTime}ms)`)
      console.log(`   Errors:`, result.errors)
      return {
        identifier: template.identifier,
        success: false,
        executionTime,
        error: result.errors?.[0]?.message || 'Unknown error',
      }
    }

    console.log(`✅ Success: ${template.identifier} (${executionTime}ms)`)
    return {
      identifier: template.identifier,
      success: true,
      executionTime,
      result: result.data,
    }
  } catch (error) {
    const executionTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    console.log(`❌ Failed: ${template.identifier} (${executionTime}ms)`)
    console.log(`   Error: ${errorMessage}`)

    return {
      identifier: template.identifier,
      success: false,
      executionTime,
      error: errorMessage,
    }
  }
}

// Run CRUD test suite for a specific category
async function runCRUDTestSuite(category: string): Promise<void> {
  console.log(`\n📋 Running ${category.toUpperCase()} CRUD Test Suite`)
  console.log('='.repeat(50))

  const createTemplates = await getTemplatesByTag('create')
  const updateTemplates = await getTemplatesByTag('update')
  const deleteTemplates = await getTemplatesByTag('delete')

  // Filter by category
  const categoryCreateTemplates = createTemplates.filter(
    (t) => t.identifier.includes(category) || t.tags.includes(category)
  )
  const categoryUpdateTemplates = updateTemplates.filter(
    (t) => t.identifier.includes(category) || t.tags.includes(category)
  )
  const categoryDeleteTemplates = deleteTemplates.filter(
    (t) => t.identifier.includes(category) || t.tags.includes(category)
  )

  console.log(`📊 Found templates:`)
  console.log(`   Create: ${categoryCreateTemplates.length}`)
  console.log(`   Update: ${categoryUpdateTemplates.length}`)
  console.log(`   Delete: ${categoryDeleteTemplates.length}`)

  const results: TestResult[] = []

  // Execute in order: CREATE → UPDATE → DELETE
  const executionOrder = [
    ...categoryCreateTemplates,
    ...categoryUpdateTemplates,
    ...categoryDeleteTemplates,
  ]

  if (executionOrder.length === 0) {
    console.log(`⚠️ No templates found for category: ${category}`)
    return
  }

  for (const template of executionOrder) {
    const result = await executeTemplateTest(template)
    results.push(result)

    // Small delay between tests
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  // Print summary
  const passed = results.filter((r) => r.success).length
  const failed = results.length - passed
  const totalTime = results.reduce((sum, r) => sum + r.executionTime, 0)
  const successRate = results.length > 0 ? ((passed / results.length) * 100).toFixed(1) : 0

  console.log(`\n📊 ${category.toUpperCase()} CRUD Test Results:`)
  console.log(`   Total: ${results.length}`)
  console.log(`   Passed: ${passed}`)
  console.log(`   Failed: ${failed}`)
  console.log(`   Success Rate: ${successRate}%`)
  console.log(`   Total Time: ${totalTime}ms`)

  if (failed > 0) {
    console.log(`\n❌ Failed Tests:`)
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`   • ${r.identifier}: ${r.error}`)
      })
  }
}

// Advanced test for complex template execution
async function _testComplexTemplate() {
  console.log('🧪 Testing Complex Template Workflow...')

  try {
    // 1. Create a table using template
    console.log('Step 1: Creating table via template...')
    const createTableResult = await graphqlRequest(
      `mutation ExecuteTemplate($input: ExecuteQueryTemplateInput!) {
        executeTemplate(input: $input) {
          success
          data
          errors {
            message
            code
          }
        }
      }`,
      {
        input: {
          templateIdentifier: 'create-table',
          variables: {
            input: {
              identifier: `template-test-${Date.now()}`,
              name: 'Template Test Table',
              description: 'Created via template execution',
            },
          },
        },
      }
    )

    if (createTableResult.error) {
      console.error('❌ Failed to create table:', createTableResult.error)
      return false
    }

    // 2. Create attribute types for the table
    console.log('Step 2: Creating attribute types...')
    const tableId = createTableResult.data?.executeTemplate?.createTable?.id

    if (tableId) {
      const createAttrResult = await graphqlRequest(
        `mutation ExecuteTemplate($input: ExecuteQueryTemplateInput!) {
          executeTemplate(input: $input) {
            success
            data
            errors {
              message
              code
            }
          }
        }`,
        {
          input: {
            templateIdentifier: 'create-attribute-type',
            variables: {
              input: {
                tableId: tableId,
                identifier: 'test-name',
                name: 'Test Name',
                description: 'Name field for testing',
                dataType: 'STRING',
                isRequired: true,
              },
            },
          },
        }
      )

      console.log('✅ Attribute creation result:', createAttrResult.data)
    }

    // 3. Test usage tracking
    console.log('Step 3: Checking usage tracking...')
    const usageResult = await graphqlRequest(
      `query GetTemplate($identifier: String!) {
        getTemplateByIdentifier(identifier: $identifier) {
          id
          identifier
          name
          usageCount
          isActive
        }
      }`,
      { identifier: 'create-table' }
    )

    if (usageResult.data?.getTemplateByIdentifier) {
      const template = usageResult.data.getTemplateByIdentifier
      console.log(`📊 Template usage count: ${template.usageCount}`)
      return template.usageCount > 0
    }

    return true
  } catch (error) {
    console.error('❌ Complex template test failed:', error)
    return false
  }
}

// Run template execution test
async function _testTemplateExecution(templateId: string, variables: any) {
  console.log(`🎯 Testing template execution: ${templateId}`)

  return await graphqlRequest(
    `mutation ExecuteTemplate($input: ExecuteQueryTemplateInput!) {
      executeTemplate(input: $input) {
        success
        data
        errors {
          message
          code
        }
      }
    }`,
    {
      input: {
        templateIdentifier: templateId,
        variables: variables,
      },
    }
  )
}

// List all available templates
async function _listAvailableTemplates() {
  console.log('📑 Available Templates:')

  const result = await graphqlRequest(
    `query SearchTemplates {
      searchTemplates(pagination: { limit: 50 }) {
        nodes {
          id
          identifier
          name
          description
          usageCount
          isActive
          createdAt
          updatedAt
        }
        totalCount
      }
    }`
  )

  if (result.data?.searchTemplates?.nodes) {
    result.data.searchTemplates.nodes.forEach((template: any, index: number) => {
      console.log(`${index + 1}. ${template.identifier}`)
      console.log(`   📝 ${template.name}`)
      console.log(`   📋 ${template.description || 'No description'}`)
      console.log(`   📊 Usage: ${template.usageCount} | Active: ${template.isActive}`)
      console.log('')
    })
  }

  return result.data?.searchTemplates?.nodes || []
}

// Test template variable validation
async function _testVariableValidation() {
  console.log('🔍 Testing Variable Validation...')

  // Test with missing required variable
  console.log('Testing missing required variable...')
  const invalidResult = await graphqlRequest(
    `mutation ExecuteTemplate($input: ExecuteQueryTemplateInput!) {
      executeTemplate(input: $input) {
        success
        data
        errors {
          message
          code
        }
      }
    }`,
    {
      input: {
        templateIdentifier: 'create-table',
        variables: {
          input: {
            // Missing required 'identifier' field
            name: 'Test Table',
          },
        },
      },
    }
  )

  const hasValidationError = invalidResult.error?.includes('Missing required')

  console.log(
    hasValidationError
      ? '✅ Variable validation working correctly'
      : '❌ Variable validation not working'
  )

  return hasValidationError
}

// Main test function
async function main() {
  console.log('🚀 Starting Template CRUD Testing...')
  console.log(`📍 GraphQL Endpoint: ${GRAPHQL_ENDPOINT}`)
  console.log(`📁 Database: ${DB_PATH}`)

  const args = process.argv.slice(2)
  const category = args[0] || 'all'

  try {
    // Test server connectivity
    console.log('\n🔍 Testing server connectivity...')
    const healthResult = await graphqlRequest('query { tables { totalCount } }')
    if (healthResult.error) {
      throw new Error('Server not responding. Make sure the GraphQL server is running.')
    }
    console.log('✅ Server is running')

    if (category === 'all') {
      // Run all category tests
      const categories = ['table', 'node', 'todo', 'template']

      console.log('\n🎯 Running All CRUD Test Suites...')

      for (const cat of categories) {
        await runCRUDTestSuite(cat)
      }

      console.log('\n🎉 All CRUD test suites completed!')
    } else {
      // Run specific category test
      await runCRUDTestSuite(category)
    }
  } catch (error) {
    console.error('❌ Test execution failed:', error)
    process.exit(1)
  }
}

// Run tests if this script is executed directly
if (import.meta.main) {
  main()
}

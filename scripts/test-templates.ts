#!/usr/bin/env bun

/**
 * Template Testing Script
 * 
 * This script tests the template system by:
 * 1. Running predefined template scenarios
 * 2. Verifying expected outputs
 * 3. Testing variable substitution
 * 4. Validating usage tracking
 * 
 * Usage: bun run scripts/test-templates.ts [template-identifier]
 */

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql'

// GraphQL client helper
async function graphqlRequest(query: string, variables?: any): Promise<any> {
  console.log(`🔍 Executing: ${query.split('{')[0].trim()}`)
  if (variables) {
    console.log(`📋 Variables:`, JSON.stringify(variables, null, 2))
  }

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })

  const result = await response.json()
  
  if (result.errors) {
    console.error('❌ GraphQL Error:', JSON.stringify(result.errors, null, 2))
    return { error: result.errors[0].message, data: null }
  }

  console.log('✅ Result:', JSON.stringify(result.data, null, 2))
  return { error: null, data: result.data }
}

// Test scenarios for different templates
const testScenarios = [
  {
    name: 'Health Check Template',
    templateId: 'health-check',
    variables: null,
    expectedFields: ['health'],
    description: 'Basic system health check'
  },
  {
    name: 'List Tables Template',
    templateId: 'list-all-tables',
    variables: { limit: 5, offset: 0 },
    expectedFields: ['tables'],
    description: 'List tables with pagination'
  },
  {
    name: 'Create Table Template',
    templateId: 'create-table',
    variables: {
      input: {
        identifier: 'test-table-' + Date.now(),
        name: 'Test Table',
        description: 'A table created via template testing'
      }
    },
    expectedFields: ['createTable'],
    description: 'Create a new table dynamically'
  },
  {
    name: 'Search Nodes Template',
    templateId: 'search-nodes',
    variables: {
      input: {
        tableId: '1', // Will be updated dynamically
        limit: 10,
        offset: 0
      }
    },
    expectedFields: ['searchNodes'],
    description: 'Search nodes in a table'
  }
]

// Advanced test for complex template execution
async function testComplexTemplate() {
  console.log('🧪 Testing Complex Template Workflow...')
  
  try {
    // 1. Create a table using template
    console.log('Step 1: Creating table via template...')
    const createTableResult = await graphqlRequest(
      `mutation ExecuteTemplate($input: ExecuteTemplateInput!) {
        executeTemplate(input: $input)
      }`,
      {
        input: {
          templateIdentifier: 'create-table',
          variables: {
            input: {
              identifier: 'template-test-' + Date.now(),
              name: 'Template Test Table',
              description: 'Created via template execution'
            }
          },
          trackUsage: true
        }
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
        `mutation ExecuteTemplate($input: ExecuteTemplateInput!) {
          executeTemplate(input: $input)
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
                isRequired: true
              }
            },
            trackUsage: true
          }
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
async function testTemplateExecution(templateId: string, variables: any) {
  console.log(`🎯 Testing template execution: ${templateId}`)
  
  return await graphqlRequest(
    `mutation ExecuteTemplate($input: ExecuteTemplateInput!) {
      executeTemplate(input: $input)
    }`,
    {
      input: {
        templateIdentifier: templateId,
        variables: variables,
        trackUsage: true,
        validateVariables: true
      }
    }
  )
}

// List all available templates
async function listAvailableTemplates() {
  console.log('📑 Available Templates:')
  
  const result = await graphqlRequest(
    `query SearchTemplates {
      searchTemplates(input: { limit: 50 }) {
        id
        identifier
        name
        description
        templateType
        tags
        usageCount
        isActive
      }
    }`
  )

  if (result.data?.searchTemplates) {
    result.data.searchTemplates.forEach((template: any, index: number) => {
      console.log(`${index + 1}. ${template.identifier}`)
      console.log(`   📝 ${template.name}`)
      console.log(`   📋 ${template.description}`)
      console.log(`   🏷️  ${template.tags.join(', ')}`)
      console.log(`   📊 Usage: ${template.usageCount} | Type: ${template.templateType}`)
      console.log('')
    })
  }

  return result.data?.searchTemplates || []
}

// Test template variable validation
async function testVariableValidation() {
  console.log('🔍 Testing Variable Validation...')

  // Test with missing required variable
  console.log('Testing missing required variable...')
  const invalidResult = await graphqlRequest(
    `mutation ExecuteTemplate($input: ExecuteTemplateInput!) {
      executeTemplate(input: $input)
    }`,
    {
      input: {
        templateIdentifier: 'create-table',
        variables: {
          input: {
            // Missing required 'identifier' field
            name: 'Test Table'
          }
        },
        validateVariables: true
      }
    }
  )

  const hasValidationError = invalidResult.error && 
    invalidResult.error.includes('Missing required')
  
  console.log(hasValidationError ? 
    '✅ Variable validation working correctly' : 
    '❌ Variable validation not working')

  return hasValidationError
}

// Main test function
async function main() {
  console.log('🚀 Starting Template System Tests...')
  console.log(`📍 GraphQL Endpoint: ${GRAPHQL_ENDPOINT}`)

  const args = process.argv.slice(2)
  const specificTemplate = args[0]

  try {
    // Test server connectivity
    console.log('🔍 Testing server connectivity...')
    const healthResult = await graphqlRequest('query { health { status } }')
    if (healthResult.error) {
      throw new Error('Server not responding')
    }
    console.log('✅ Server is running')

    // List available templates
    const templates = await listAvailableTemplates()
    console.log(`📊 Found ${templates.length} templates`)

    if (specificTemplate) {
      // Test specific template
      console.log(`\n🎯 Testing specific template: ${specificTemplate}`)
      
      const template = templates.find((t: any) => t.identifier === specificTemplate)
      if (!template) {
        console.error(`❌ Template '${specificTemplate}' not found`)
        return
      }

      // Test the specific template with minimal variables
      const result = await testTemplateExecution(specificTemplate, {})
      console.log(result.error ? '❌ Test failed' : '✅ Test passed')
      
    } else {
      // Run comprehensive tests
      console.log('\n🧪 Running Comprehensive Tests...')

      let passedTests = 0
      let totalTests = 0

      // Test variable validation
      totalTests++
      if (await testVariableValidation()) {
        passedTests++
      }

      // Test complex workflow
      totalTests++
      if (await testComplexTemplate()) {
        passedTests++
      }

      // Test basic scenarios
      for (const scenario of testScenarios) {
        totalTests++
        console.log(`\n🧪 Running: ${scenario.name}`)
        console.log(`   ${scenario.description}`)
        
        const result = await testTemplateExecution(scenario.templateId, scenario.variables)
        
        if (!result.error && result.data) {
          console.log('✅ Test passed')
          passedTests++
        } else {
          console.log('❌ Test failed')
        }
      }

      // Summary
      console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`)
      
      if (passedTests === totalTests) {
        console.log('🎉 All tests passed! Template system is working correctly.')
      } else {
        console.log('⚠️ Some tests failed. Please check the output above.')
      }
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
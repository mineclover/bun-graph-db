#!/usr/bin/env bun

/**
 * Template-based Node Mutations Test Runner
 *
 * This script runs comprehensive tests for template-based node creation functionality
 * and provides detailed output about the test results.
 */

import { spawn } from 'bun'
import { createSampleTemplates } from '../examples/sample-node-templates.js'

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql'

async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query HealthCheck {
            health {
              status
              database
              version
            }
          }
        `,
      }),
    })

    const data = await response.json()
    return data.data?.health?.status === 'OK'
  } catch (error) {
    console.error('❌ Server health check failed:', error)
    return false
  }
}

async function setupSampleData(): Promise<void> {
  console.log('📋 Setting up sample templates...')

  try {
    await createSampleTemplates(GRAPHQL_ENDPOINT)
    console.log('✅ Sample templates created successfully')
  } catch (error) {
    console.error('❌ Failed to create sample templates:', error)
    throw error
  }
}

async function runTests(): Promise<void> {
  console.log('🧪 Running template-based node mutation tests...')

  try {
    const testProcess = spawn(
      ['bun', 'test', 'tests/template-based-node-mutations.test.ts', '--verbose'],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'test',
        },
      }
    )

    const decoder = new TextDecoder()

    // Handle stdout
    if (testProcess.stdout && 'on' in testProcess.stdout) {
      ;(testProcess.stdout as any).on('data', (chunk: any) => {
        process.stdout.write(decoder.decode(chunk))
      })
    }

    // Handle stderr
    if (testProcess.stderr && 'on' in testProcess.stderr) {
      ;(testProcess.stderr as any).on('data', (chunk: any) => {
        process.stderr.write(decoder.decode(chunk))
      })
    }

    const exitCode = await testProcess.exited

    if (exitCode === 0) {
      console.log('\n✅ All tests passed successfully!')
    } else {
      console.log(`\n❌ Tests failed with exit code: ${exitCode}`)
      process.exit(exitCode)
    }
  } catch (error) {
    console.error('❌ Failed to run tests:', error)
    process.exit(1)
  }
}

async function demonstrateTemplateUsage(): Promise<void> {
  console.log('\n🎯 Demonstrating template usage...')

  // Create a test table
  console.log('Creating test table...')
  const createTableResponse = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation CreateTestTable($input: CreateTableInput!) {
          createTable(input: $input) {
            id
            identifier
            description
          }
        }
      `,
      variables: {
        input: {
          identifier: `demo-products-${Date.now()}`,
          description: 'Demo table for template usage',
        },
      },
    }),
  })

  const tableData = await createTableResponse.json()
  const testTableId = tableData.data.createTable.id
  console.log(`✅ Created test table: ${tableData.data.createTable.identifier}`)

  // Create attributes for the table
  console.log('Creating attributes...')
  const attributes = [
    { identifier: 'product_name', type: '1', description: 'Product name' },
    { identifier: 'product_price', type: '4', description: 'Product price' },
    { identifier: 'product_category', type: '1', description: 'Product category' },
  ]

  const createdAttributes = []
  for (const attr of attributes) {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation CreateAttribute($input: CreateAttributeInput!) {
            createAttribute(input: $input) {
              id
              identifier
            }
          }
        `,
        variables: {
          input: {
            tableId: testTableId,
            identifier: attr.identifier,
            attributeTypeId: attr.type,
            description: attr.description,
            isRequired: true,
          },
        },
      }),
    })
    const attrData = await response.json()
    createdAttributes.push({
      id: attrData.data.createAttribute.id,
      identifier: attr.identifier,
    })
  }
  console.log(`✅ Created ${createdAttributes.length} attributes`)

  // Search for a node creation template
  console.log('Searching for node creation templates...')
  const searchResponse = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query SearchTemplates($input: SearchTemplatesInput!) {
          searchTemplates(input: $input) {
            id
            identifier
            name
            tags
            usageCount
          }
        }
      `,
      variables: {
        input: {
          tags: ['node-creation'],
          tagMatchMode: 'ANY',
          templateType: 'mutation',
          isActive: true,
          limit: 1,
        },
      },
    }),
  })

  const searchData = await searchResponse.json()
  const templates = searchData.data.searchTemplates

  if (templates.length === 0) {
    console.log('⚠️  No node creation templates found. Creating a simple one...')

    // Create a basic template
    const createTemplateResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation CreateQueryTemplate($input: CreateQueryTemplateInput!) {
            createQueryTemplate(input: $input) {
              id
              identifier
              name
            }
          }
        `,
        variables: {
          input: {
            identifier: 'demo-create-product',
            name: 'Demo Create Product',
            description: 'Demo template for creating product nodes',
            queryText: `
              mutation CreateProductNode($tableId: ID!, $productName: String!, $productPrice: Float!, $productCategory: String) {
                createNode(input: {
                  tableId: $tableId
                  content: $productName
                  title: $productName
                  description: "Product: " + $productName
                }) {
                  id
                  content
                  title
                  description
                  createdAt
                }
              }
            `,
            variablesSchema: {
              type: 'object',
              properties: {
                tableId: { type: 'string' },
                productName: { type: 'string' },
                productPrice: { type: 'number' },
                productCategory: { type: 'string' },
              },
              required: ['tableId', 'productName', 'productPrice'],
            },
            defaultVariables: {
              productCategory: 'General',
            },
            templateType: 'mutation',
            complexityScore: 2,
            tags: ['node-creation', 'products', 'demo'],
          },
        },
      }),
    })

    const templateData = await createTemplateResponse.json()
    console.log(`✅ Created demo template: ${templateData.data.createQueryTemplate.name}`)

    // Use the created template
    const executeResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ExecuteTemplate($input: ExecuteTemplateInput!) {
            executeTemplate(input: $input)
          }
        `,
        variables: {
          input: {
            templateIdentifier: 'demo-create-product',
            variables: {
              tableId: testTableId,
              productName: 'Demo Wireless Speaker',
              productPrice: 89.99,
              productCategory: 'Electronics',
            },
            trackUsage: true,
          },
        },
      }),
    })

    const executeData = await executeResponse.json()
    if (executeData.data?.executeTemplate?.createNode) {
      console.log(`✅ Created product node: ${executeData.data.executeTemplate.createNode.content}`)
    } else if (executeData.errors) {
      console.log('⚠️  Template execution encountered errors:', executeData.errors)
    }

    // Get template usage statistics
    const statsResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetTemplate($identifier: String!) {
            getTemplateByIdentifier(identifier: $identifier) {
              id
              name
              usageCount
              updatedAt
            }
          }
        `,
        variables: {
          identifier: 'demo-create-product',
        },
      }),
    })

    const statsData = await statsResponse.json()
    if (statsData.data?.getTemplateByIdentifier) {
      const template = statsData.data.getTemplateByIdentifier
      console.log(`📊 Template Statistics:`)
      console.log(`   Name: ${template.name}`)
      console.log(`   Usage Count: ${template.usageCount}`)
      console.log(`   Last Updated: ${template.updatedAt}`)
    }
  } else {
    console.log(`✅ Found ${templates.length} node creation templates`)
    templates.forEach((template: any, index: number) => {
      console.log(`   ${index + 1}. ${template.name} (${template.usageCount} uses)`)
    })
  }
}

async function main(): Promise<void> {
  console.log('🚀 Starting Template-based Node Mutations Test Suite\n')

  // Check if server is running
  console.log('🔍 Checking server health...')
  const isHealthy = await checkServerHealth()

  if (!isHealthy) {
    console.error('❌ GraphQL server is not running or unhealthy')
    console.log('💡 Please start the server with: bun run dev')
    process.exit(1)
  }

  console.log('✅ Server is healthy and ready')

  try {
    // Setup sample data
    await setupSampleData()

    // Run the comprehensive tests
    await runTests()

    // Demonstrate template usage
    await demonstrateTemplateUsage()

    console.log('\n🎉 Template-based node mutations test suite completed successfully!')
    console.log('\n📚 Next steps:')
    console.log('   • Review the test results above')
    console.log('   • Check the created templates in GraphiQL')
    console.log('   • Explore the sample templates in examples/sample-node-templates.ts')
    console.log('   • Read the documentation in docs/template-workflow.md')
  } catch (error) {
    console.error('\n💥 Test suite failed:', error)
    process.exit(1)
  }
}

// Run the main function
if (require.main === module) {
  main().catch(console.error)
}

export { main as runTemplateTests }

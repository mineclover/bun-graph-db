/**
 * Quick test for the new executeTemplateWithGraphQL functionality
 */

import { GraphQLClient } from './test/api/clients/GraphQLClient.js'

async function testTemplateWithGraphQLExecution() {
  console.log('🧪 Testing executeTemplateWithGraphQL functionality...')

  const client = new GraphQLClient('http://localhost:4001')

  try {
    // First, let's test if our new mutation is available
    const introspectionQuery = `
      query IntrospectionQuery {
        __schema {
          mutationType {
            fields {
              name
              args {
                name
                type {
                  name
                }
              }
            }
          }
        }
      }
    `

    console.log('1. Checking if executeTemplateWithGraphQL mutation exists...')
    const introspectionResult = await client.query(introspectionQuery)

    if (introspectionResult.isSuccess) {
      const mutations = introspectionResult.data?.data?.__schema?.mutationType?.fields || []
      const templateMutation = mutations.find(
        (field: any) => field.name === 'executeTemplateWithGraphQL'
      )

      if (templateMutation) {
        console.log('✅ executeTemplateWithGraphQL mutation found!')
        console.log(
          '   Arguments:',
          templateMutation.args.map((arg: any) => `${arg.name}: ${arg.type.name}`).join(', ')
        )
      } else {
        console.log('❌ executeTemplateWithGraphQL mutation not found in schema')
        console.log('Available mutations:', mutations.map((m: any) => m.name).join(', '))
        return
      }
    } else {
      console.log('❌ Failed to get schema introspection')
      return
    }

    // Test creating a simple template first
    console.log('\n2. Creating a test template...')
    const createTemplateMutation = `
      mutation CreateTemplate($input: CreateQueryTemplateInput!) {
        createTemplate(input: $input) {
          success
          template {
            id
            identifier
          }
          errors {
            message
          }
        }
      }
    `

    const templateInput = {
      identifier: 'test-health-check',
      name: 'Test Health Check Template',
      description: 'Simple health check query for testing',
      query: '{ health { status timestamp version } }',
      variables: null,
    }

    const createResult = await client.mutation(createTemplateMutation, { input: templateInput })

    if (!createResult.isSuccess || !createResult.data?.data?.createTemplate?.success) {
      console.log(
        '❌ Failed to create test template:',
        createResult.data?.data?.createTemplate?.errors || createResult.data?.errors
      )
      return
    }

    console.log('✅ Test template created successfully!')

    // Now test the new executeTemplateWithGraphQL mutation
    console.log('\n3. Testing executeTemplateWithGraphQL...')
    const executeTemplateMutation = `
      mutation ExecuteTemplateWithGraphQL($templateIdentifier: String!, $variables: JSON, $trackUsage: Boolean) {
        executeTemplateWithGraphQL(templateIdentifier: $templateIdentifier, variables: $variables, trackUsage: $trackUsage) {
          success
          data
          errors {
            message
            code
          }
          metadata {
            templateId
            templateName
            executionTime
          }
        }
      }
    `

    const executeResult = await client.mutation(executeTemplateMutation, {
      templateIdentifier: 'test-health-check',
      variables: {},
      trackUsage: true,
    })

    console.log('Execute result:', JSON.stringify(executeResult.data, null, 2))

    if (executeResult.isSuccess) {
      const result = executeResult.data?.data?.executeTemplateWithGraphQL
      if (result?.success) {
        console.log('🎉 executeTemplateWithGraphQL works!')
        console.log('   Execution time:', result.metadata.executionTime + 'ms')
        console.log('   Template name:', result.metadata.templateName)
        console.log('   Health check result:', result.data?.health?.status)
      } else {
        console.log('❌ Template execution failed:', result?.errors)
      }
    } else {
      console.log('❌ GraphQL mutation failed:', executeResult.data?.errors)
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error)
  }
}

// Run the test
testTemplateWithGraphQLExecution()

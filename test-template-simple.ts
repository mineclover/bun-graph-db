/**
 * Simple test to check if we have existing templates to work with
 */

import { GraphQLClient } from './test/api/clients/GraphQLClient.js'

async function checkExistingTemplates() {
  console.log('🔍 Checking for existing templates...')

  const client = new GraphQLClient('http://localhost:4001')

  try {
    // Check if we have existing templates
    const getTemplatesQuery = `
      query GetTemplates {
        searchTemplates(filter: {}) {
          nodes {
            id
            identifier
            name
            query
            isActive
            variables
          }
          totalCount
        }
      }
    `

    const result = await client.query(getTemplatesQuery)

    if (result.isSuccess) {
      const templates = result.data?.data?.searchTemplates?.nodes || []
      console.log(`Found ${templates.length} existing templates:`)

      if (templates.length > 0) {
        templates.forEach((template: any) => {
          console.log(
            `- ${template.identifier}: ${template.name} (${template.isActive ? 'active' : 'inactive'})`
          )
        })

        // Test with the first template
        const firstTemplate = templates[0]
        console.log(
          `\n🧪 Testing executeTemplateWithGraphQL with existing template: ${firstTemplate.identifier}`
        )

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
          templateIdentifier: firstTemplate.identifier,
          variables: firstTemplate.variables || {},
          trackUsage: true,
        })

        console.log('Execute result:', JSON.stringify(executeResult.data, null, 2))

        if (executeResult.isSuccess) {
          const result = executeResult.data?.data?.executeTemplateWithGraphQL
          if (result?.success) {
            console.log('🎉 executeTemplateWithGraphQL works!')
            console.log('   Execution time:', result.metadata.executionTime + 'ms')
            console.log('   Template name:', result.metadata.templateName)
          } else {
            console.log('❌ Template execution failed:', result?.errors)
          }
        } else {
          console.log('❌ GraphQL mutation failed:', executeResult.data?.errors)
        }
      } else {
        console.log("No existing templates found. Let's try a simple health check query instead.")

        // Test with a direct health check query
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

        // This should fail gracefully since there's no template, but we can see the error handling
        const executeResult = await client.mutation(executeTemplateMutation, {
          templateIdentifier: 'non-existent-template',
          variables: {},
          trackUsage: false,
        })

        console.log(
          'Result with non-existent template:',
          JSON.stringify(executeResult.data, null, 2)
        )
      }
    } else {
      console.log('❌ Failed to query templates:', result.data?.errors)
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error)
  }
}

// Run the test
checkExistingTemplates()

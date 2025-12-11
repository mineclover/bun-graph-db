/**
 * Template System Examples
 *
 * Comprehensive examples demonstrating the template system functionality
 * based on real-world testing experience and working patterns.
 *
 * Run these examples against a running bun-graph-db server.
 */

const SERVER_URL = 'http://localhost:4000/graphql'

/**
 * Basic GraphQL client for template operations
 */
class TemplateClient {
  async query(query: string, variables: any = {}) {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    })

    const data = await response.json()

    if (data.errors) {
      console.error('GraphQL errors:', data.errors)
      throw new Error(`GraphQL Error: ${data.errors.map((e: any) => e.message).join(', ')}`)
    }

    return data.data
  }

  async mutation(mutation: string, variables: any = {}) {
    return this.query(mutation, variables)
  }
}

const client = new TemplateClient()

/**
 * Example 1: Basic Query Template Creation and Execution
 *
 * This demonstrates the most common use case: creating a simple query template
 * for frequently used operations.
 */
export async function basicQueryTemplateExample() {
  console.log('🔹 Example 1: Basic Query Template')

  // Create a simple table query template
  const createResult = await client.mutation(
    `
    mutation CreateTemplate($input: CreateQueryTemplateInput!) {
      createTemplate(input: $input) {
        template {
          id
          identifier
          name
          description
          query
          usageCount
          isActive
        }
        errors {
          message
        }
      }
    }
  `,
    {
      input: {
        identifier: 'basic-table-query',
        name: 'Get Table Information',
        description: 'Retrieve basic table information with node count',
        query: 'query GetTable($tableId: ID!) { table(id: $tableId) { id identifier description nodeCount } }',
        variables: { tableId: '1' },
        createdBy: 'example-system',
      },
    },
  )

  console.log('✅ Template created:', createResult.createTemplate.template.identifier)

  // Execute the template with different variables
  const executeResult = await client.mutation(
    `
    mutation ExecuteTemplate($input: ExecuteQueryTemplateInput!) {
      executeTemplate(input: $input) {
        success
        data
        errors {
          message
        }
      }
    }
  `,
    {
      input: {
        templateIdentifier: 'basic-table-query',
        variables: { tableId: '2' },
      },
    },
  )

  if (executeResult.executeTemplate.success) {
    console.log('✅ Template executed successfully')
    console.log('📊 Metadata:', executeResult.executeTemplate.data.metadata)
  } else {
    console.log('❌ Template execution failed:', executeResult.executeTemplate.errors)
  }
}

/**
 * Example 2: GraphQL Execution with Real Data
 *
 * Demonstrates executing templates that return actual GraphQL data
 * rather than just query information.
 */
export async function graphqlExecutionExample() {
  console.log('🔹 Example 2: GraphQL Execution with Real Data')

  // First, get an existing table to use
  const tablesResult = await client.query(`
    query GetTables {
      tables {
        nodes {
          id
          identifier
          description
        }
      }
    }
  `)

  if (tablesResult.tables.nodes.length === 0) {
    console.log('⚠️ No tables found, skipping example')
    return
  }

  const tableId = tablesResult.tables.nodes[0].id
  console.log(`📋 Using table: ${tableId}`)

  // Execute with GraphQL to get real data
  const realExecutionResult = await client.mutation(
    `
    mutation ExecuteWithGraphQL($templateIdentifier: String!, $variables: JSON, $trackUsage: Boolean) {
      executeTemplateWithGraphQL(
        templateIdentifier: $templateIdentifier
        variables: $variables
        trackUsage: $trackUsage
      ) {
        success
        data
        errors {
          message
        }
      }
    }
  `,
    {
      templateIdentifier: 'basic-table-query',
      variables: { tableId },
      trackUsage: true,
    },
  )

  if (realExecutionResult.executeTemplateWithGraphQL.success) {
    const result = realExecutionResult.executeTemplateWithGraphQL.data
    console.log('✅ Real GraphQL execution successful')
    console.log('📊 Table data:', result.data.table)
  } else {
    console.log('❌ Real execution failed:', realExecutionResult.executeTemplateWithGraphQL.errors)
  }
}

/**
 * Example 3: Template Search and Discovery
 *
 * Shows how to discover and search through existing templates.
 */
export async function templateSearchExample() {
  console.log('🔹 Example 3: Template Search and Discovery')

  // Search all templates
  const searchResult = await client.query(`
    query SearchTemplates {
      searchTemplates(filter: {}) {
        nodes {
          id
          identifier
          name
          description
          query
          usageCount
          isActive
        }
        totalCount
        hasNextPage
        hasPreviousPage
      }
    }
  `)

  console.log(`📊 Found ${searchResult.searchTemplates.totalCount} templates`)

  // Categorize templates
  const templates = searchResult.searchTemplates.nodes
  const categories = {
    queries: templates.filter((t: any) => t.query.trim().startsWith('query')),
    mutations: templates.filter((t: any) => t.query.trim().startsWith('mutation')),
    subscriptions: templates.filter((t: any) => t.query.trim().startsWith('subscription')),
  }

  console.log('📋 Template Distribution:')
  console.log(`   Queries: ${categories.queries.length}`)
  console.log(`   Mutations: ${categories.mutations.length}`)
  console.log(`   Subscriptions: ${categories.subscriptions.length}`)

  // Show top used templates
  const sortedByUsage = templates.sort((a: any, b: any) => b.usageCount - a.usageCount)
  console.log('🔥 Most Used Templates:')
  sortedByUsage.slice(0, 3).forEach((template: any, i: number) => {
    console.log(`   ${i + 1}. ${template.name} (${template.usageCount} uses)`)
  })
}

/**
 * Example 4: Template Usage Tracking
 *
 * Demonstrates how usage tracking works and how to monitor template statistics.
 */
export async function usageTrackingExample() {
  console.log('🔹 Example 4: Usage Tracking')

  // Get template before usage
  const beforeResult = await client.query(
    `
    query GetTemplate($identifier: String!) {
      getTemplateByIdentifier(identifier: $identifier) {
        id
        identifier
        usageCount
      }
    }
  `,
    {
      identifier: 'basic-table-query',
    },
  )

  const usageCountBefore = beforeResult.getTemplateByIdentifier.usageCount

  // Execute template with tracking enabled
  await client.mutation(
    `
    mutation ExecuteWithGraphQL($templateIdentifier: String!, $variables: JSON, $trackUsage: Boolean) {
      executeTemplateWithGraphQL(
        templateIdentifier: $templateIdentifier
        variables: $variables
        trackUsage: $trackUsage
      ) {
        success
        data
      }
    }
  `,
    {
      templateIdentifier: 'basic-table-query',
      variables: { tableId: '1' },
      trackUsage: true,
    },
  )

  // Get template after usage
  const afterResult = await client.query(
    `
    query GetTemplate($identifier: String!) {
      getTemplateByIdentifier(identifier: $identifier) {
        id
        identifier
        usageCount
      }
    }
  `,
    {
      identifier: 'basic-table-query',
    },
  )

  const usageCountAfter = afterResult.getTemplateByIdentifier.usageCount

  console.log(`📊 Usage tracking: ${usageCountBefore} → ${usageCountAfter}`)
  console.log('✅ Usage count incremented successfully')
}

/**
 * Example 5: Mutation Template
 *
 * Shows how to create and execute mutation templates for data modification.
 */
export async function mutationTemplateExample() {
  console.log('🔹 Example 5: Mutation Template')

  // Get an existing table for the mutation
  const tablesResult = await client.query(`
    query GetTables {
      tables {
        nodes {
          id
          identifier
        }
      }
    }
  `)

  if (tablesResult.tables.nodes.length === 0) {
    console.log('⚠️ No tables found, skipping mutation example')
    return
  }

  const tableId = tablesResult.tables.nodes[0].id

  // Create a mutation template for node creation
  const createResult = await client.mutation(
    `
    mutation CreateTemplate($input: CreateQueryTemplateInput!) {
      createTemplate(input: $input) {
        template {
          id
          identifier
          name
          query
        }
        errors {
          message
        }
      }
    }
  `,
    {
      input: {
        identifier: 'create-simple-node',
        name: 'Create Simple Node',
        description: 'Template for creating a simple node',
        query:
          'mutation CreateNode($tableId: ID!, $content: String!, $title: String!) { createNode(input: { tableId: $tableId, content: $content, title: $title }) { id content title createdAt } }',
        variables: {
          tableId,
          content: 'Sample content',
          title: 'Sample title',
        },
        createdBy: 'example-system',
      },
    },
  )

  if (createResult.createTemplate.errors.length === 0) {
    console.log('✅ Mutation template created:', createResult.createTemplate.template.identifier)

    // Execute the mutation template
    const executeResult = await client.mutation(
      `
      mutation ExecuteWithGraphQL($templateIdentifier: String!, $variables: JSON, $trackUsage: Boolean) {
        executeTemplateWithGraphQL(
          templateIdentifier: $templateIdentifier
          variables: $variables
          trackUsage: $trackUsage
        ) {
          success
          data
          errors {
            message
          }
        }
      }
    `,
      {
        templateIdentifier: 'create-simple-node',
        variables: {
          tableId,
          content: 'Example node from template',
          title: 'Template-created Node',
        },
        trackUsage: true,
      },
    )

    if (executeResult.executeTemplateWithGraphQL.success) {
      const result = executeResult.executeTemplateWithGraphQL.data
      if (result.success) {
        console.log('✅ Node created successfully via template')
        console.log('📊 Created node:', result.data.createNode)
      } else {
        console.log('❌ Node creation failed:', result.errors)
      }
    }
  } else {
    console.log('❌ Failed to create mutation template:', createResult.createTemplate.errors)
  }
}

/**
 * Example 6: Error Handling Patterns
 *
 * Demonstrates proper error handling for template operations.
 */
export async function errorHandlingExample() {
  console.log('🔹 Example 6: Error Handling')

  // Try to execute a non-existent template
  try {
    const result = await client.mutation(
      `
      mutation ExecuteTemplate($input: ExecuteQueryTemplateInput!) {
        executeTemplate(input: $input) {
          success
          data
          errors {
            message
          }
        }
      }
    `,
      {
        input: {
          templateIdentifier: 'non-existent-template',
          variables: {},
        },
      },
    )

    if (!result.executeTemplate.success) {
      console.log('✅ Proper error handling for non-existent template:')
      result.executeTemplate.errors.forEach((error: any) => {
        console.log(`   - ${error.message}`)
      })
    }
  } catch (error) {
    console.log('✅ Caught error for non-existent template:', (error as Error).message)
  }

  // Try to execute template with missing variables
  try {
    const result = await client.mutation(
      `
      mutation ExecuteWithGraphQL($templateIdentifier: String!, $variables: JSON, $trackUsage: Boolean) {
        executeTemplateWithGraphQL(
          templateIdentifier: $templateIdentifier
          variables: $variables
          trackUsage: $trackUsage
        ) {
          success
          data
          errors {
            message
          }
        }
      }
    `,
      {
        templateIdentifier: 'basic-table-query',
        variables: {}, // Missing required tableId
        trackUsage: false,
      },
    )

    if (result.executeTemplateWithGraphQL.success) {
      const executionResult = result.executeTemplateWithGraphQL.data
      if (!executionResult.success) {
        console.log('✅ Proper error handling for missing variables:')
        executionResult.errors?.forEach((error: any) => {
          console.log(`   - ${error.message}`)
        })
      }
    }
  } catch (error) {
    console.log('✅ Caught error for missing variables:', (error as Error).message)
  }
}

/**
 * Main example runner
 */
export async function runAllExamples() {
  console.log('🚀 Running Template System Examples')
  console.log('=====================================\n')

  try {
    await basicQueryTemplateExample()
    console.log()

    await graphqlExecutionExample()
    console.log()

    await templateSearchExample()
    console.log()

    await usageTrackingExample()
    console.log()

    await mutationTemplateExample()
    console.log()

    await errorHandlingExample()
    console.log()

    console.log('✅ All examples completed successfully!')
  } catch (error) {
    console.error('❌ Example execution failed:', error)
  }
}

// Run examples if this file is executed directly
if (import.meta.main) {
  runAllExamples()
}

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createYoga } from 'graphql-yoga'
import { ContainerBootstrap } from '../src/infrastructure/container/ContainerBootstrap.js'
import type { DIContainer } from '../src/infrastructure/container/DIContainer.js'
import { GraphQLSchemaBuilder } from '../src/presentation/graphql/GraphQLSchemaBuilder.js'

/**
 * Improved Template System Tests
 * 
 * Based on real testing experience, this test suite uses:
 * - Correct GraphQL schema field names (discovered through testing)
 * - Proper error handling for template execution
 * - Realistic template examples that actually work
 * - Better test organization and cleanup
 */
describe('Template System - Improved Tests', () => {
  let yoga: ReturnType<typeof createYoga>
  let container: DIContainer
  let serverUrl = 'http://localhost:4000/graphql'

  beforeAll(async () => {
    container = await ContainerBootstrap.createContainer()
    const schemaBuilder = new GraphQLSchemaBuilder(container)
    const schema = await schemaBuilder.build()
    yoga = createYoga({ schema })
  })

  describe('Template CRUD Operations', () => {
    let testTemplateId: string
    const testTemplateIdentifier = `test-template-${Date.now()}`

    test('should create a simple query template', async () => {
      // Using correct field names based on actual schema
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
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
          variables: {
            input: {
              identifier: testTemplateIdentifier,
              name: 'Test Table Query',
              description: 'Simple test template for table queries',
              query: 'query GetTable($tableId: ID!) { table(id: $tableId) { id identifier description nodeCount } }',
              variables: { tableId: '1' },
              createdBy: 'test-system'
            }
          }
        })
      })

      const data = await response.json()
      
      // Better error handling
      if (data.errors) {
        console.error('GraphQL errors:', data.errors)
        throw new Error(`Failed to create template: ${data.errors.map((e: any) => e.message).join(', ')}`)
      }

      expect(data.data.createTemplate.errors).toHaveLength(0)
      expect(data.data.createTemplate.template).toBeDefined()
      expect(data.data.createTemplate.template.identifier).toBe(testTemplateIdentifier)
      expect(data.data.createTemplate.template.usageCount).toBe(0)
      expect(data.data.createTemplate.template.isActive).toBe(true)

      testTemplateId = data.data.createTemplate.template.id
    })

    test('should retrieve template by ID', async () => {
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetTemplate($id: ID!) {
              getTemplate(id: $id) {
                id
                identifier
                name
                description
                query
                usageCount
                isActive
              }
            }
          `,
          variables: { id: testTemplateId }
        })
      })

      const data = await response.json()
      expect(data.data.getTemplate).toBeDefined()
      expect(data.data.getTemplate.id).toBe(testTemplateId)
      expect(data.data.getTemplate.identifier).toBe(testTemplateIdentifier)
    })

    test('should search templates with pagination', async () => {
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query SearchTemplates {
              searchTemplates(filter: {}) {
                nodes {
                  id
                  identifier
                  name
                  query
                  usageCount
                  isActive
                }
                totalCount
                hasNextPage
                hasPreviousPage
              }
            }
          `
        })
      })

      const data = await response.json()
      expect(data.data.searchTemplates).toBeDefined()
      expect(data.data.searchTemplates.nodes).toBeInstanceOf(Array)
      expect(data.data.searchTemplates.totalCount).toBeGreaterThan(0)
      
      // Find our test template
      const ourTemplate = data.data.searchTemplates.nodes.find(
        (t: any) => t.identifier === testTemplateIdentifier
      )
      expect(ourTemplate).toBeDefined()
    })
  })

  describe('Template Execution', () => {
    const workingTemplateIdentifier = `working-template-${Date.now()}`
    let existingTableId: string

    test('setup: get existing table for testing', async () => {
      // Get an existing table to use in our tests
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetTables {
              tables {
                nodes {
                  id
                  identifier
                  description
                }
              }
            }
          `
        })
      })

      const data = await response.json()
      expect(data.data.tables.nodes.length).toBeGreaterThan(0)
      
      existingTableId = data.data.tables.nodes[0].id
      console.log(`Using table ${existingTableId} for template testing`)
    })

    test('should create and execute a working template', async () => {
      // Create a working template
      const createResponse = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation CreateTemplate($input: CreateQueryTemplateInput!) {
              createTemplate(input: $input) {
                template {
                  id
                  identifier
                  name
                  query
                }
                errors { message }
              }
            }
          `,
          variables: {
            input: {
              identifier: workingTemplateIdentifier,
              name: 'Working Table Query',
              description: 'A template that definitely works',
              query: 'query WorkingTable($tableId: ID!) { table(id: $tableId) { id identifier description nodeCount } }',
              variables: { tableId: existingTableId },
              createdBy: 'test-system'
            }
          }
        })
      })

      const createData = await createResponse.json()
      expect(createData.data.createTemplate.errors).toHaveLength(0)
      expect(createData.data.createTemplate.template).toBeDefined()

      // Execute the template using the two different execution methods
      
      // Method 1: executeTemplate (returns query info)
      const executeResponse = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation ExecuteTemplate($input: ExecuteQueryTemplateInput!) {
              executeTemplate(input: $input) {
                success
                data
                errors { message }
              }
            }
          `,
          variables: {
            input: {
              templateIdentifier: workingTemplateIdentifier,
              variables: { tableId: existingTableId }
            }
          }
        })
      })

      const executeData = await executeResponse.json()
      expect(executeData.data.executeTemplate.success).toBe(true)
      expect(executeData.data.executeTemplate.data).toBeDefined()
      
      // Check metadata
      const metadata = executeData.data.executeTemplate.data.metadata
      expect(metadata.templateName).toBe('Working Table Query')
      expect(metadata.estimatedTokens).toBeGreaterThan(0)

      console.log('✅ Template execution metadata:', {
        templateName: metadata.templateName,
        complexityScore: metadata.complexityScore,
        estimatedTokens: metadata.estimatedTokens,
        executionTime: metadata.executionTime
      })
    })

    test('should execute template with GraphQL and return real data', async () => {
      // Method 2: executeTemplateWithGraphQL (executes real GraphQL)
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation ExecuteWithGraphQL($templateIdentifier: String!, $variables: JSON, $trackUsage: Boolean) {
              executeTemplateWithGraphQL(
                templateIdentifier: $templateIdentifier
                variables: $variables
                trackUsage: $trackUsage
              ) {
                success
                data
                errors { message }
              }
            }
          `,
          variables: {
            templateIdentifier: workingTemplateIdentifier,
            variables: { tableId: existingTableId },
            trackUsage: true
          }
        })
      })

      const data = await response.json()
      expect(data.data.executeTemplateWithGraphQL.success).toBe(true)
      
      const result = data.data.executeTemplateWithGraphQL.data
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.table).toBeDefined()
      expect(result.data.table.id).toBe(existingTableId)

      console.log('✅ Real GraphQL execution result:', {
        tableId: result.data.table.id,
        identifier: result.data.table.identifier,
        nodeCount: result.data.table.nodeCount
      })
    })

    test('should track template usage correctly', async () => {
      // Check usage count before
      const beforeResponse = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetTemplate($identifier: String!) {
              getTemplateByIdentifier(identifier: $identifier) {
                id
                identifier
                usageCount
              }
            }
          `,
          variables: { identifier: workingTemplateIdentifier }
        })
      })

      const beforeData = await beforeResponse.json()
      const usageCountBefore = beforeData.data.getTemplateByIdentifier.usageCount

      // Execute template with tracking
      await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
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
          variables: {
            templateIdentifier: workingTemplateIdentifier,
            variables: { tableId: existingTableId },
            trackUsage: true
          }
        })
      })

      // Check usage count after
      const afterResponse = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetTemplate($identifier: String!) {
              getTemplateByIdentifier(identifier: $identifier) {
                id
                identifier
                usageCount
              }
            }
          `,
          variables: { identifier: workingTemplateIdentifier }
        })
      })

      const afterData = await afterResponse.json()
      const usageCountAfter = afterData.data.getTemplateByIdentifier.usageCount

      expect(usageCountAfter).toBe(usageCountBefore + 1)
      console.log(`✅ Usage tracking verified: ${usageCountBefore} → ${usageCountAfter}`)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle non-existent template gracefully', async () => {
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation ExecuteTemplate($input: ExecuteQueryTemplateInput!) {
              executeTemplate(input: $input) {
                success
                data
                errors { message }
              }
            }
          `,
          variables: {
            input: {
              templateIdentifier: 'non-existent-template',
              variables: {}
            }
          }
        })
      })

      const data = await response.json()
      expect(data.data.executeTemplate.success).toBe(false)
      expect(data.data.executeTemplate.errors.length).toBeGreaterThan(0)
      
      const errorMessage = data.data.executeTemplate.errors[0].message
      expect(errorMessage).toContain('not found')
      console.log('✅ Non-existent template error:', errorMessage)
    })

    test('should handle template with missing variables', async () => {
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation ExecuteWithGraphQL($templateIdentifier: String!, $variables: JSON, $trackUsage: Boolean) {
              executeTemplateWithGraphQL(
                templateIdentifier: $templateIdentifier
                variables: $variables
                trackUsage: $trackUsage
              ) {
                success
                data
                errors { message }
              }
            }
          `,
          variables: {
            templateIdentifier: 'basic-table-query-test', // Assuming this exists from manual testing
            variables: {}, // Missing required tableId
            trackUsage: false
          }
        })
      })

      const data = await response.json()
      
      // The template execution might succeed but GraphQL execution will fail
      if (data.data.executeTemplateWithGraphQL.success) {
        const result = data.data.executeTemplateWithGraphQL.data
        expect(result.success).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
        console.log('✅ Missing variable error:', result.errors[0].message)
      } else {
        expect(data.data.executeTemplateWithGraphQL.errors.length).toBeGreaterThan(0)
        console.log('✅ Template execution error:', data.data.executeTemplateWithGraphQL.errors[0].message)
      }
    })
  })

  describe('Template Categories and Discovery', () => {
    test('should show template distribution by categories', async () => {
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetAllTemplates {
              searchTemplates(filter: {}) {
                nodes {
                  id
                  identifier
                  name
                  query
                  usageCount
                  isActive
                }
                totalCount
              }
            }
          `
        })
      })

      const data = await response.json()
      const templates = data.data.searchTemplates.nodes

      // Categorize templates based on their queries
      const categories = {
        queries: templates.filter((t: any) => t.query.trim().startsWith('query')),
        mutations: templates.filter((t: any) => t.query.trim().startsWith('mutation')),
        subscriptions: templates.filter((t: any) => t.query.trim().startsWith('subscription'))
      }

      console.log('📊 Template Distribution:')
      console.log(`   Total Templates: ${templates.length}`)
      console.log(`   Queries: ${categories.queries.length}`)
      console.log(`   Mutations: ${categories.mutations.length}`)
      console.log(`   Subscriptions: ${categories.subscriptions.length}`)

      // Show top used templates
      const sortedByUsage = templates.sort((a: any, b: any) => b.usageCount - a.usageCount)
      console.log('🔥 Most Used Templates:')
      sortedByUsage.slice(0, 3).forEach((t: any, i: number) => {
        console.log(`   ${i + 1}. ${t.name} (${t.usageCount} uses)`)
      })

      expect(templates.length).toBeGreaterThan(0)
      expect(categories.queries.length + categories.mutations.length + categories.subscriptions.length).toBe(templates.length)
    })
  })

  afterAll(() => {
    console.log('🧹 Template system tests completed')
  })
})
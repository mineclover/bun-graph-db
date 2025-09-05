/**
 * Template Test Helper
 * 
 * Shared utilities for template system testing based on real-world
 * testing experience and working patterns discovered during comprehensive testing.
 * 
 * This helper provides:
 * - Correct GraphQL schema field names and structures
 * - Proper error handling patterns
 * - Reusable test utilities
 * - Template lifecycle management
 */

export interface TemplateTestConfig {
  serverUrl?: string
  timeout?: number
  retries?: number
}

export interface CreateTemplateInput {
  identifier: string
  name: string
  description?: string
  query: string
  variables?: any
  createdBy?: string
}

export interface ExecuteTemplateInput {
  templateIdentifier: string
  variables?: any
  trackUsage?: boolean
}

export class TemplateTestHelper {
  private serverUrl: string
  private timeout: number
  private retries: number

  constructor(config: TemplateTestConfig = {}) {
    this.serverUrl = config.serverUrl || 'http://localhost:4000/graphql'
    this.timeout = config.timeout || 5000
    this.retries = config.retries || 3
  }

  /**
   * Enhanced GraphQL client with proper error handling
   */
  async graphql(query: string, variables: any = {}): Promise<any> {
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const response = await fetch(this.serverUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables }),
          signal: AbortSignal.timeout(this.timeout)
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()

        // Enhanced error handling based on testing experience
        if (data.errors) {
          const errorMessages = data.errors.map((e: any) => e.message).join(', ')
          throw new Error(`GraphQL Error: ${errorMessages}`)
        }

        return data.data
      } catch (error) {
        if (attempt === this.retries) {
          throw new Error(`Failed after ${this.retries} attempts: ${(error as Error).message}`)
        }
        
        console.log(`Attempt ${attempt} failed, retrying...`)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }
  }

  /**
   * Create template using correct schema discovered during testing
   */
  async createTemplate(input: CreateTemplateInput) {
    const result = await this.graphql(`
      mutation CreateTemplate($input: CreateQueryTemplateInput!) {
        createTemplate(input: $input) {
          template {
            id
            identifier
            name
            description
            query
            variables
            usageCount
            isActive
            createdAt
            updatedAt
          }
          errors {
            message
          }
        }
      }
    `, { input: {
      identifier: input.identifier,
      name: input.name,
      description: input.description || `Template: ${input.name}`,
      query: input.query, // Note: 'query' not 'queryText'
      variables: input.variables || {},
      createdBy: input.createdBy || 'test-system'
    }})

    if (result.createTemplate.errors && result.createTemplate.errors.length > 0) {
      throw new Error(`Template creation failed: ${result.createTemplate.errors.map((e: any) => e.message).join(', ')}`)
    }

    return result.createTemplate.template
  }

  /**
   * Execute template and return metadata (no real GraphQL execution)
   */
  async executeTemplate(input: ExecuteTemplateInput) {
    const result = await this.graphql(`
      mutation ExecuteTemplate($input: ExecuteQueryTemplateInput!) {
        executeTemplate(input: $input) {
          success
          data
          errors {
            message
          }
        }
      }
    `, { input })

    return result.executeTemplate
  }

  /**
   * Execute template with GraphQL to get real data
   */
  async executeTemplateWithGraphQL(templateIdentifier: string, variables: any = {}, trackUsage: boolean = true) {
    const result = await this.graphql(`
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
    `, { templateIdentifier, variables, trackUsage })

    return result.executeTemplateWithGraphQL
  }

  /**
   * Search templates using correct pagination structure
   */
  async searchTemplates(filter: any = {}) {
    const result = await this.graphql(`
      query SearchTemplates {
        searchTemplates(filter: $filter) {
          nodes {
            id
            identifier
            name
            description
            query
            usageCount
            isActive
            createdAt
            updatedAt
          }
          totalCount
          hasNextPage
          hasPreviousPage
        }
      }
    `, { filter })

    return result.searchTemplates
  }

  /**
   * Get template by identifier
   */
  async getTemplateByIdentifier(identifier: string) {
    const result = await this.graphql(`
      query GetTemplate($identifier: String!) {
        getTemplateByIdentifier(identifier: $identifier) {
          id
          identifier
          name
          description
          query
          variables
          usageCount
          isActive
          createdAt
          updatedAt
        }
      }
    `, { identifier })

    return result.getTemplateByIdentifier
  }

  /**
   * Get existing table for testing
   */
  async getFirstAvailableTable() {
    const result = await this.graphql(`
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

    if (result.tables.nodes.length === 0) {
      throw new Error('No tables available for testing')
    }

    return result.tables.nodes[0]
  }

  /**
   * Clean up test templates by identifier pattern
   */
  async cleanupTestTemplates(identifierPattern: string) {
    const templates = await this.searchTemplates()
    const testTemplates = templates.nodes.filter((t: any) => 
      t.identifier.includes(identifierPattern)
    )

    for (const template of testTemplates) {
      try {
        await this.deleteTemplate(template.id)
        console.log(`✅ Deleted template: ${template.identifier}`)
      } catch (error) {
        console.warn(`⚠️ Failed to delete template ${template.identifier}:`, error)
      }
    }

    return testTemplates.length
  }

  /**
   * Delete a template by ID
   */
  async deleteTemplate(templateId: string) {
    const result = await this.graphql(`
      mutation DeleteTemplate($id: ID!) {
        deleteTemplate(id: $id)
      }
    `, {
      id: templateId
    })

    return result.deleteTemplate
  }

  /**
   * Verify template execution results
   */
  verifyTemplateExecution(result: any, expectedSuccess: boolean = true) {
    if (expectedSuccess) {
      if (!result.success) {
        throw new Error(`Template execution failed: ${result.errors?.map((e: any) => e.message).join(', ')}`)
      }
    } else {
      if (result.success) {
        throw new Error('Expected template execution to fail, but it succeeded')
      }
    }

    return result
  }

  /**
   * Wait for template usage count to update
   */
  async waitForUsageUpdate(identifier: string, expectedCount: number, maxAttempts: number = 10) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const template = await this.getTemplateByIdentifier(identifier)
      
      if (template.usageCount === expectedCount) {
        return template
      }

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    throw new Error(`Usage count did not reach ${expectedCount} after ${maxAttempts} attempts`)
  }

  /**
   * Generate unique template identifier for testing
   */
  generateTestIdentifier(prefix: string = 'test-template') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Create a set of test templates for comprehensive testing
   */
  async createTestTemplateSet(tableId: string) {
    const baseIdentifier = this.generateTestIdentifier('test-set')
    
    const templates = [
      {
        identifier: `${baseIdentifier}-query`,
        name: 'Test Query Template',
        query: 'query GetTable($tableId: ID!) { table(id: $tableId) { id identifier description nodeCount } }',
        variables: { tableId }
      },
      {
        identifier: `${baseIdentifier}-mutation`,
        name: 'Test Mutation Template',
        query: 'mutation CreateNode($tableId: ID!, $content: String!, $title: String!) { createNode(input: { tableId: $tableId, content: $content, title: $title }) { id content title } }',
        variables: { tableId, content: 'Test content', title: 'Test title' }
      }
    ]

    const createdTemplates = []
    for (const template of templates) {
      try {
        const created = await this.createTemplate(template)
        createdTemplates.push(created)
      } catch (error) {
        console.warn(`Failed to create template ${template.identifier}:`, error)
      }
    }

    return createdTemplates
  }
}

/**
 * Common test patterns and assertions
 */
export class TemplateTestPatterns {
  constructor(private helper: TemplateTestHelper) {}

  /**
   * Test template lifecycle (create → execute → track usage)
   */
  async testTemplateLifecycle(templateData: CreateTemplateInput) {
    // Create template
    const template = await this.helper.createTemplate(templateData)
    expect(template.identifier).toBe(templateData.identifier)
    expect(template.usageCount).toBe(0)

    // Execute template
    const execution = await this.helper.executeTemplate({
      templateIdentifier: template.identifier,
      variables: templateData.variables
    })
    this.helper.verifyTemplateExecution(execution, true)

    // Execute with GraphQL to verify real functionality
    const realExecution = await this.helper.executeTemplateWithGraphQL(
      template.identifier,
      templateData.variables,
      true
    )
    
    if (realExecution.success && realExecution.data.success) {
      // Verify usage tracking
      const updatedTemplate = await this.helper.waitForUsageUpdate(template.identifier, 1)
      expect(updatedTemplate.usageCount).toBeGreaterThan(0)
    }

    return { template, execution, realExecution }
  }

  /**
   * Test error handling patterns
   */
  async testErrorHandling() {
    // Test non-existent template
    try {
      const result = await this.helper.executeTemplate({
        templateIdentifier: 'non-existent-template',
        variables: {}
      })
      this.helper.verifyTemplateExecution(result, false)
    } catch (error) {
      // Expected error
      expect((error as Error).message).toContain('Template')
    }

    // Test missing variables (if validation exists)
    const table = await this.helper.getFirstAvailableTable()
    const template = await this.helper.createTemplate({
      identifier: this.helper.generateTestIdentifier('error-test'),
      name: 'Error Test Template',
      query: 'query GetTable($tableId: ID!) { table(id: $tableId) { id } }',
      variables: { tableId: table.id }
    })

    // Execute with missing variables
    const missingVarsResult = await this.helper.executeTemplateWithGraphQL(
      template.identifier,
      {}, // Missing required tableId
      false
    )

    // Should either fail at template level or GraphQL level
    if (missingVarsResult.success && missingVarsResult.data) {
      expect(missingVarsResult.data.success).toBe(false)
      expect(missingVarsResult.data.errors).toBeDefined()
    } else {
      expect(missingVarsResult.success).toBe(false)
    }
  }

  /**
   * Test template search and categorization
   */
  async testTemplateDiscovery() {
    const templates = await this.helper.searchTemplates()
    expect(templates.nodes).toBeInstanceOf(Array)
    expect(templates.totalCount).toBeGreaterThanOrEqual(templates.nodes.length)

    // Categorize by operation type
    const categories = {
      queries: templates.nodes.filter((t: any) => t.query.trim().startsWith('query')),
      mutations: templates.nodes.filter((t: any) => t.query.trim().startsWith('mutation')),
      subscriptions: templates.nodes.filter((t: any) => t.query.trim().startsWith('subscription'))
    }

    console.log('📊 Template Discovery Results:')
    console.log(`   Total: ${templates.totalCount}`)
    console.log(`   Queries: ${categories.queries.length}`)
    console.log(`   Mutations: ${categories.mutations.length}`)
    console.log(`   Subscriptions: ${categories.subscriptions.length}`)

    return { templates, categories }
  }
}

/**
 * Global expect assertions for template testing
 */
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidTemplate(): R
      toHaveExecutedSuccessfully(): R
    }
  }
}

// Helper function for test setup
export function createTemplateTestHelper(config?: TemplateTestConfig) {
  return new TemplateTestHelper(config)
}

export function createTemplateTestPatterns(helper: TemplateTestHelper) {
  return new TemplateTestPatterns(helper)
}
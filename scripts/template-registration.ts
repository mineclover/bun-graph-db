#!/usr/bin/env bun
/**
 * Template Registration Script
 *
 * Provides automated registration and management of templates
 * as default/core templates for the graph database system.
 */

interface TemplateRegistrationInput {
  identifier: string
  name: string
  description: string
  query: string
  tags?: string[]
  variables?: Record<string, any>
  applicableTables?: string[]
  priority?: 'high' | 'medium' | 'low'
  category?: string
}

interface RegistrationResult {
  success: boolean
  templateId?: string
  message: string
  errors: string[]
}

class TemplateRegistrationManager {
  private serverUrl = 'http://localhost:4000/graphql'

  async registerTemplate(input: TemplateRegistrationInput): Promise<RegistrationResult> {
    console.log(`📝 Registering template: ${input.identifier}`)

    try {
      // 1. Validate input
      const validation = this.validateInput(input)
      if (!validation.valid) {
        return {
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        }
      }

      // 2. Check if template already exists
      const existsCheck = await this.checkTemplateExists(input.identifier)
      if (existsCheck) {
        return {
          success: false,
          message: `Template ${input.identifier} already exists`,
          errors: ['Template identifier must be unique']
        }
      }

      // 3. Create template via GraphQL
      const createResult = await this.createTemplate(input)
      if (!createResult.success) {
        return createResult
      }

      // 4. Register as core template if high priority
      if (input.priority === 'high') {
        await this.registerAsCoreTemplate(input.identifier)
      }

      console.log(`✅ Template ${input.identifier} registered successfully`)
      return {
        success: true,
        templateId: createResult.templateId,
        message: `Template ${input.identifier} registered successfully`,
        errors: []
      }

    } catch (error) {
      console.error(`❌ Registration failed: ${error}`)
      return {
        success: false,
        message: `Registration failed: ${error}`,
        errors: [String(error)]
      }
    }
  }

  private validateInput(input: TemplateRegistrationInput): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!input.identifier || input.identifier.trim() === '') {
      errors.push('Template identifier is required')
    }

    if (!input.name || input.name.trim() === '') {
      errors.push('Template name is required')
    }

    if (!input.query || input.query.trim() === '') {
      errors.push('GraphQL query is required')
    }

    // Validate GraphQL syntax
    if (input.query) {
      const queryValidation = this.validateGraphQLSyntax(input.query)
      if (!queryValidation.valid) {
        errors.push(...queryValidation.errors)
      }
    }

    // Validate identifier format
    if (input.identifier && !/^[a-z0-9-_]+$/.test(input.identifier)) {
      errors.push('Template identifier must contain only lowercase letters, numbers, hyphens, and underscores')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  private validateGraphQLSyntax(query: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    try {
      const trimmedQuery = query.trim()

      // Check for basic GraphQL structure
      if (!trimmedQuery.match(/^(query|mutation|subscription)/i) && !trimmedQuery.startsWith('{')) {
        errors.push('Query must start with query, mutation, subscription, or {')
      }

      // Check for balanced braces
      const openBraces = (trimmedQuery.match(/\\{/g) || []).length
      const closeBraces = (trimmedQuery.match(/\\}/g) || []).length
      if (openBraces !== closeBraces) {
        errors.push('Unbalanced braces in GraphQL query')
      }

      // Check for valid field syntax
      if (!trimmedQuery.includes('{') || !trimmedQuery.includes('}')) {
        errors.push('GraphQL query must contain field selections')
      }

    } catch (error) {
      errors.push(`GraphQL syntax validation failed: ${error}`)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  private async checkTemplateExists(identifier: string): Promise<boolean> {
    const query = `
      query CheckTemplate($identifier: String!) {
        getTemplateByIdentifier(identifier: $identifier) {
          id
        }
      }
    `

    try {
      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { identifier }
        })
      })

      const result = await response.json()
      return !!result.data?.getTemplateByIdentifier
    } catch (error) {
      console.warn(`Warning: Could not check template existence: ${error}`)
      return false
    }
  }

  private async createTemplate(input: TemplateRegistrationInput): Promise<RegistrationResult> {
    const mutation = `
      mutation CreateTemplate($input: CreateQueryTemplateInput!) {
        createTemplate(input: $input) {
          success
          template {
            id
            identifier
            name
          }
          errors {
            message
          }
        }
      }
    `

    const createInput = {
      identifier: input.identifier,
      name: input.name,
      description: input.description,
      query: input.query,
      tags: input.tags || [],
      variables: input.variables || {},
      applicableTables: input.applicableTables || []
    }

    try {
      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: mutation,
          variables: { input: createInput }
        })
      })

      const result = await response.json()

      if (result.errors) {
        return {
          success: false,
          message: 'GraphQL errors occurred',
          errors: result.errors.map((e: any) => e.message)
        }
      }

      const createResult = result.data?.createTemplate
      if (!createResult?.success) {
        return {
          success: false,
          message: 'Template creation failed',
          errors: createResult?.errors?.map((e: any) => e.message) || ['Unknown error']
        }
      }

      return {
        success: true,
        templateId: createResult.template.id,
        message: 'Template created successfully',
        errors: []
      }

    } catch (error) {
      return {
        success: false,
        message: `Template creation failed: ${error}`,
        errors: [String(error)]
      }
    }
  }

  private async registerAsCoreTemplate(identifier: string): Promise<void> {
    try {
      // Import and use CoreTemplateManager
      const { CoreTemplateManager } = await import('./core-template-manager.js')
      const manager = new CoreTemplateManager()
      await manager.initialize()
      await manager.registerCoreTemplate(identifier)
    } catch (error) {
      console.warn(`Warning: Could not register as core template: ${error}`)
    }
  }

  async batchRegister(templates: TemplateRegistrationInput[]): Promise<RegistrationResult[]> {
    console.log(`📋 Starting batch registration of ${templates.length} templates\\n`)

    const results: RegistrationResult[] = []
    let successCount = 0

    for (let i = 0; i < templates.length; i++) {
      const template = templates[i]
      console.log(`[${i + 1}/${templates.length}] Processing: ${template.identifier}`)

      const result = await this.registerTemplate(template)
      results.push(result)

      if (result.success) {
        successCount++
        console.log(`   ✅ Success`)
      } else {
        console.log(`   ❌ Failed: ${result.message}`)
        result.errors.forEach(error => {
          console.log(`      - ${error}`)
        })
      }
    }

    console.log(`\\n📊 Batch registration complete:`)
    console.log(`   Successful: ${successCount}`)
    console.log(`   Failed: ${templates.length - successCount}`)

    return results
  }

  async deleteTemplate(identifier: string): Promise<RegistrationResult> {
    console.log(`🗑️ Deleting template: ${identifier}`)

    const mutation = `
      mutation DeleteTemplate($identifier: String!) {
        deleteTemplateByIdentifier(identifier: $identifier) {
          success
          errors {
            message
          }
        }
      }
    `

    try {
      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: mutation,
          variables: { identifier }
        })
      })

      const result = await response.json()

      if (result.errors) {
        return {
          success: false,
          message: 'GraphQL errors occurred',
          errors: result.errors.map((e: any) => e.message)
        }
      }

      const deleteResult = result.data?.deleteTemplateByIdentifier
      if (!deleteResult?.success) {
        return {
          success: false,
          message: 'Template deletion failed',
          errors: deleteResult?.errors?.map((e: any) => e.message) || ['Unknown error']
        }
      }

      console.log(`✅ Template ${identifier} deleted successfully`)
      return {
        success: true,
        message: `Template ${identifier} deleted successfully`,
        errors: []
      }

    } catch (error) {
      return {
        success: false,
        message: `Template deletion failed: ${error}`,
        errors: [String(error)]
      }
    }
  }

  async updateTemplate(identifier: string, updates: Partial<TemplateRegistrationInput>): Promise<RegistrationResult> {
    console.log(`✏️ Updating template: ${identifier}`)

    const mutation = `
      mutation UpdateTemplate($identifier: String!, $input: UpdateQueryTemplateInput!) {
        updateTemplateByIdentifier(identifier: $identifier, input: $input) {
          success
          template {
            id
            identifier
            name
          }
          errors {
            message
          }
        }
      }
    `

    const updateInput: any = {}
    if (updates.name) updateInput.name = updates.name
    if (updates.description) updateInput.description = updates.description
    if (updates.query) updateInput.queryText = updates.query
    if (updates.tags) updateInput.tags = updates.tags

    try {
      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: mutation,
          variables: { identifier, input: updateInput }
        })
      })

      const result = await response.json()

      if (result.errors) {
        return {
          success: false,
          message: 'GraphQL errors occurred',
          errors: result.errors.map((e: any) => e.message)
        }
      }

      const updateResult = result.data?.updateTemplateByIdentifier
      if (!updateResult?.success) {
        return {
          success: false,
          message: 'Template update failed',
          errors: updateResult?.errors?.map((e: any) => e.message) || ['Unknown error']
        }
      }

      console.log(`✅ Template ${identifier} updated successfully`)
      return {
        success: true,
        templateId: updateResult.template.id,
        message: `Template ${identifier} updated successfully`,
        errors: []
      }

    } catch (error) {
      return {
        success: false,
        message: `Template update failed: ${error}`,
        errors: [String(error)]
      }
    }
  }

  // Utility method to generate template identifier from name
  generateIdentifier(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\\s]/g, '')
      .replace(/\\s+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  // Predefined template examples for common use cases
  getTemplateExamples(): TemplateRegistrationInput[] {
    return [
      {
        identifier: 'health-check-basic',
        name: 'Basic Health Check',
        description: 'Simple system health check query',
        query: 'query HealthCheck { health { status timestamp database version } }',
        tags: ['system', 'health', 'basic'],
        priority: 'high',
        category: 'System Operations'
      },
      {
        identifier: 'list-tables-simple',
        name: 'Simple Table List',
        description: 'Basic table listing without pagination',
        query: 'query ListTables { tables { nodes { id identifier description } totalCount } }',
        tags: ['table', 'list', 'basic'],
        priority: 'medium',
        category: 'Query Operations'
      },
      {
        identifier: 'create-node-basic',
        name: 'Basic Node Creation',
        description: 'Create a new node with basic content',
        query: `mutation CreateNode($tableId: ID!, $content: String!, $title: String) {
          createNode(input: { tableId: $tableId, content: $content, title: $title }) {
            success
            node { id content title }
            errors { message }
          }
        }`,
        variables: {
          tableId: '',
          content: '',
          title: ''
        },
        tags: ['node', 'create', 'basic'],
        priority: 'medium',
        category: 'CRUD Operations'
      }
    ]
  }
}

// CLI Interface
async function main() {
  const manager = new TemplateRegistrationManager()
  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case 'register':
      if (args.length < 4) {
        console.error('❌ Usage: bun template-registration.ts register <identifier> <name> <query> [description] [tags]')
        process.exit(1)
      }

      const [, identifier, name, query, description, tagsStr] = args
      const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : []

      const result = await manager.registerTemplate({
        identifier,
        name,
        description: description || `Template: ${name}`,
        query,
        tags,
        priority: 'medium'
      })

      if (result.success) {
        console.log(`\\n✅ Registration successful!`)
        console.log(`   Template ID: ${result.templateId}`)
      } else {
        console.log(`\\n❌ Registration failed: ${result.message}`)
        result.errors.forEach(error => console.log(`   - ${error}`))
        process.exit(1)
      }
      break

    case 'batch':
      console.log('📋 Running batch registration with example templates...')
      const examples = manager.getTemplateExamples()
      const results = await manager.batchRegister(examples)

      const successful = results.filter(r => r.success).length
      if (successful === results.length) {
        console.log('\\n🎉 All templates registered successfully!')
      } else {
        console.log(`\\n⚠️ ${successful}/${results.length} templates registered successfully`)
      }
      break

    case 'delete':
      if (args.length < 2) {
        console.error('❌ Usage: bun template-registration.ts delete <identifier>')
        process.exit(1)
      }

      const deleteResult = await manager.deleteTemplate(args[1])
      if (!deleteResult.success) {
        console.log(`❌ Deletion failed: ${deleteResult.message}`)
        process.exit(1)
      }
      break

    case 'examples':
      console.log('📋 Available template examples:')
      const exampleTemplates = manager.getTemplateExamples()
      exampleTemplates.forEach((template, index) => {
        console.log(`\\n${index + 1}. ${template.identifier}`)
        console.log(`   Name: ${template.name}`)
        console.log(`   Description: ${template.description}`)
        console.log(`   Priority: ${template.priority}`)
        console.log(`   Tags: ${template.tags?.join(', ')}`)
      })
      break

    case 'help':
    default:
      console.log(`
🔧 Template Registration CLI

Usage:
  register <identifier> <name> <query> [description] [tags]  Register a new template
  batch                                                      Register example templates
  delete <identifier>                                        Delete a template
  examples                                                   Show template examples
  help                                                       Show this help

Examples:
  # Register a simple query template
  bun template-registration.ts register "my-query" "My Query" "query { health { status } }"

  # Register with description and tags
  bun template-registration.ts register "user-list" "User List" "query { users { nodes { id name } } }" "List all users" "user,list,basic"

  # Register example templates
  bun template-registration.ts batch

  # Delete a template
  bun template-registration.ts delete "my-query"

  # View examples
  bun template-registration.ts examples
      `)
      break
  }
}

if (import.meta.main) {
  main().catch(console.error)
}

export { TemplateRegistrationManager, type TemplateRegistrationInput, type RegistrationResult }
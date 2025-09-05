#!/usr/bin/env bun

import { DatasetManager } from '../loaders/index.js'
import type { QueryTemplate } from '../loaders/types/DatasetTypes.js'

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql'

interface ImportResult {
  template: QueryTemplate
  success: boolean
  error?: string
  serverId?: string
}

async function executeGraphQL(query: string, variables: any = {}): Promise<any> {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    })

    const result = await response.json()

    if (result.errors) {
      throw new Error(`GraphQL Error: ${result.errors.map((e: any) => e.message).join(', ')}`)
    }

    return result.data
  } catch (error) {
    throw error instanceof Error ? error : new Error(`Network error: ${error}`)
  }
}

async function checkServerHealth(): Promise<boolean> {
  try {
    const query = `
      query HealthCheck {
        health {
          status
          timestamp
        }
      }
    `

    await executeGraphQL(query)
    return true
  } catch (error) {
    console.error('❌ Server health check failed:', error instanceof Error ? error.message : error)
    return false
  }
}

async function createTemplateOnServer(template: QueryTemplate): Promise<ImportResult> {
  const createTemplateMutation = `
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
          code
        }
      }
    }
  `

  try {
    const result = await executeGraphQL(createTemplateMutation, {
      input: {
        identifier: template.identifier,
        name: template.name,
        description: template.description,
        query: template.queryText,
        variables: template.variablesSchema,
      },
    })

    if (result.createTemplate.success) {
      return {
        template,
        success: true,
        serverId: result.createTemplate.template.id,
      }
    } else {
      return {
        template,
        success: false,
        error: result.createTemplate.errors.map((e: any) => e.message).join(', '),
      }
    }
  } catch (error) {
    return {
      template,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

async function importTemplatesFromDomain(domain: string): Promise<ImportResult[]> {
  console.log(`📂 Importing templates from ${domain} domain...`)

  const datasetManager = new DatasetManager()
  const templates = await datasetManager.templates.loadTemplatesByDomain(domain, { cache: false })

  console.log(`   Found ${templates.length} templates to import`)

  const results: ImportResult[] = []

  for (const template of templates) {
    console.log(`   🔄 Importing: ${template.name} (${template.identifier})`)

    const result = await createTemplateOnServer(template)
    results.push(result)

    if (result.success) {
      console.log(`   ✅ Successfully imported: ${template.name}`)
    } else {
      console.log(`   ❌ Failed to import: ${template.name} - ${result.error}`)
    }
  }

  return results
}

async function importAllTemplates(): Promise<void> {
  console.log('🚀 Template Import to Server')
  console.log('============================\n')

  // Check server connectivity
  console.log('🔍 Checking server connectivity...')
  const isHealthy = await checkServerHealth()

  if (!isHealthy) {
    console.error('❌ Server is not accessible. Please ensure the GraphQL server is running.')
    console.log('\n💡 Start the server with: bun run dev')
    process.exit(1)
  }

  console.log('✅ Server is accessible\n')

  // Get available domains
  const datasetManager = new DatasetManager()
  const availableTemplates = await datasetManager.templates.listAvailableTemplates()

  const domains = new Set<string>()

  // Extract domains from file names
  Object.entries(availableTemplates).forEach(([type, files]) => {
    files.forEach((file) => {
      // Extract domain from filename (e.g., "ecommerce-basic" -> "ecommerce")
      const domain = file.split('-')[0]
      if (domain) {
        domains.add(domain)
      }
    })
  })

  if (domains.size === 0) {
    console.log('⚠️  No templates found to import')
    return
  }

  console.log(`📋 Found templates in ${domains.size} domains: ${Array.from(domains).join(', ')}`)

  let totalImported = 0
  let totalFailed = 0

  for (const domain of domains) {
    try {
      const results = await importTemplatesFromDomain(domain)
      const successful = results.filter((r) => r.success).length
      const failed = results.filter((r) => !r.success).length

      totalImported += successful
      totalFailed += failed

      console.log(`   📊 ${domain}: ${successful} imported, ${failed} failed\\n`)
    } catch (error) {
      console.error(
        `   ❌ Error importing from ${domain}:`,
        error instanceof Error ? error.message : error
      )
      totalFailed++
    }
  }

  console.log('🎉 Import Summary:')
  console.log(`   ✅ Successfully imported: ${totalImported} templates`)
  console.log(`   ❌ Failed: ${totalFailed} templates`)

  if (totalFailed > 0) {
    console.log('\\n💡 Check server logs for detailed error information')
  }
}

// Run if called directly
if (import.meta.main) {
  importAllTemplates().catch((error) => {
    console.error('❌ Import failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}

export { importAllTemplates, importTemplatesFromDomain, createTemplateOnServer }

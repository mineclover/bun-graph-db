#!/usr/bin/env bun

import { DatasetManager } from '../loaders/index.js'
import { importAllTemplates } from './import-templates-to-server.js'

async function listTemplates() {
  const manager = new DatasetManager()

  console.log('📋 Available Templates')
  console.log('=====================\n')

  const available = await manager.templates.listAvailableTemplates()
  const stats = await manager.templates.getTemplateStats()

  console.log(`📊 Summary: ${stats.totalTemplates} total templates`)
  console.log(`   Average complexity: ${stats.averageComplexity.toFixed(1)}`)
  console.log(
    `   Most common tags: ${stats.mostCommonTags
      .slice(0, 3)
      .map((t) => t.tag)
      .join(', ')}\n`
  )

  for (const [type, files] of Object.entries(available)) {
    if (files.length > 0) {
      console.log(`🔸 ${type.toUpperCase()}:`)
      for (const file of files) {
        console.log(`   • ${file}`)
      }
      console.log()
    }
  }
}

async function searchTemplates(query: string) {
  const manager = new DatasetManager()

  console.log(`🔍 Searching templates for: "${query}"`)
  console.log(`=${'='.repeat(25 + query.length)}\n`)

  const results = await manager.templates.searchTemplates(
    {
      textSearch: query,
    },
    { cache: false }
  )

  if (results.length === 0) {
    console.log('❌ No templates found matching the search criteria')
    return
  }

  console.log(`✅ Found ${results.length} matching templates:\n`)

  for (const [index, template] of results.entries()) {
    console.log(`${index + 1}. ${template.name} (${template.identifier})`)
    console.log(`   Type: ${template.templateType} | Complexity: ${template.complexityScore}`)
    console.log(`   Tags: ${template.tags.join(', ')}`)
    console.log(`   Description: ${template.description || 'No description'}`)
    console.log()
  }
}

async function showComplexityStats() {
  const manager = new DatasetManager()

  console.log('📊 Template Complexity Analysis')
  console.log('================================\n')

  const simple = await manager.templates.getTemplatesByComplexity('simple')
  const moderate = await manager.templates.getTemplatesByComplexity('moderate')
  const complex = await manager.templates.getTemplatesByComplexity('complex')
  const advanced = await manager.templates.getTemplatesByComplexity('advanced')

  console.log(`🟢 Simple (1-3):    ${simple.length} templates`)
  console.log(`🟡 Moderate (3-5):  ${moderate.length} templates`)
  console.log(`🟠 Complex (5-7):   ${complex.length} templates`)
  console.log(`🔴 Advanced (7-10): ${advanced.length} templates`)

  if (simple.length > 0) {
    console.log('\\n🟢 Simple Templates:')
    for (const t of simple) {
      console.log(`   • ${t.name} (complexity: ${t.complexityScore})`)
    }
  }

  if (advanced.length > 0) {
    console.log('\\n🔴 Advanced Templates:')
    for (const t of advanced) {
      console.log(`   • ${t.name} (complexity: ${t.complexityScore})`)
    }
  }
}

async function validateTemplates() {
  const manager = new DatasetManager()

  console.log('🔍 Validating Templates')
  console.log('=======================\n')

  const available = await manager.templates.listAvailableTemplates()
  let totalTemplates = 0
  let validTemplates = 0
  const errors: string[] = []

  for (const [type, files] of Object.entries(available)) {
    if (files.length === 0) continue

    console.log(`📂 Validating ${type} templates...`)

    for (const file of files) {
      try {
        const collection = await manager.templates.loadTemplateCollection(type as any, file, {
          validate: true,
          cache: false,
        })

        totalTemplates += collection.templates.length
        validTemplates += collection.templates.length
        console.log(`   ✅ ${file}: ${collection.templates.length} templates`)
      } catch (error) {
        const errorMsg = `❌ ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.log(`   ${errorMsg}`)
        errors.push(errorMsg)
      }
    }
  }

  console.log(`\\n📊 Validation Summary:`)
  console.log(`   Total templates: ${totalTemplates}`)
  console.log(`   Valid templates: ${validTemplates}`)
  console.log(`   Errors: ${errors.length}`)

  if (errors.length > 0) {
    console.log('\\n❌ Validation Errors:')
    for (const error of errors) {
      console.log(`   ${error}`)
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case 'list':
      await listTemplates()
      break

    case 'search':
      if (!args[1]) {
        console.error('❌ Search query required. Usage: template-manager search <query>')
        process.exit(1)
      }
      await searchTemplates(args[1])
      break

    case 'complexity':
      await showComplexityStats()
      break

    case 'validate':
      await validateTemplates()
      break

    case 'import':
      await importAllTemplates()
      break
    default:
      console.log('📋 Template Manager CLI')
      console.log('=======================\\n')
      console.log('Usage: template-manager <command> [options]\\n')
      console.log('Commands:')
      console.log('  list       - List all available templates')
      console.log('  search     - Search templates by text')
      console.log('  complexity - Show complexity distribution')
      console.log('  validate   - Validate all templates')
      console.log('  import     - Import templates to server')
      console.log('  help       - Show this help message\\n')
      console.log('Examples:')
      console.log('  bun datasets/scripts/template-manager.ts list')
      console.log('  bun datasets/scripts/template-manager.ts search "product"')
      console.log('  bun datasets/scripts/template-manager.ts import')
      break
  }
}

// Run if called directly
if (import.meta.main) {
  main().catch((error) => {
    console.error('❌ Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}

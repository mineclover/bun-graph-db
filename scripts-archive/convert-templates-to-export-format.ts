#!/usr/bin/env bun

/**
 * Convert Template Format Script
 *
 * Converts templates from direct format to export format for import
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface DirectTemplate {
  identifier: string
  name: string
  description: string
  query: string
  queryName: string[]
  operationType: string
  variables?: object
  variablesSchema?: object
  defaultVariables?: object
  applicableTables: string[]
  complexityScore: number
  version: string
  tags: string[]
  isActive: boolean
  statistics: {
    usageCount: number
    avgExecutionTimeMs: number
    lastUsedAt: string | null
  }
}

interface ExportTemplate {
  version: string
  exportedAt: string
  template: {
    identifier: string
    name: string
    description: string
    query: string
    queryName?: string[]
    operationType?: string
    variables?: object
    variablesSchema?: object
    defaultVariables?: object
    applicableTables?: string[]
    complexityScore?: number
    version?: string
    tags?: string[]
    isActive?: boolean
    statistics?: {
      usageCount: number
      avgExecutionTimeMs: number
      lastUsedAt: string | null
    }
  }
}

function convertToExportFormat(directTemplate: DirectTemplate): ExportTemplate {
  return {
    version: directTemplate.version,
    exportedAt: new Date().toISOString(),
    template: {
      identifier: directTemplate.identifier,
      name: directTemplate.name,
      description: directTemplate.description,
      query: directTemplate.query,
      queryName: directTemplate.queryName,
      operationType: directTemplate.operationType,
      variables: directTemplate.variables,
      variablesSchema: directTemplate.variablesSchema,
      defaultVariables: directTemplate.defaultVariables,
      applicableTables: directTemplate.applicableTables,
      complexityScore: directTemplate.complexityScore,
      version: directTemplate.version,
      tags: directTemplate.tags,
      isActive: directTemplate.isActive,
      statistics: directTemplate.statistics,
    },
  }
}

async function main() {
  console.log('🔄 Converting templates to export format')
  console.log('=====================================')

  const newTemplateFiles = [
    'find-paths-between-nodes_v1-0-0.json',
    'get-dependency-chain_v1-0-0.json',
    'search-related-nodes_v1-0-0.json',
    'create-node-with-attributes_v1-0-0.json',
    'create-relation-between-nodes_v1-0-0.json',
    'update-node-content_v1-0-0.json',
    'delete-node-cascade_v1-0-0.json',
    'subscribe-node-changes_v1-0-0.json',
    'subscribe-system-health_v1-0-0.json',
    'subscribe-template-execution-stream_v1-0-0.json',
    'export-import-schema_v1-0-0.json',
    'search-nodes-advanced-filtering_v1-0-0.json',
  ]

  let convertedCount = 0

  for (const filename of newTemplateFiles) {
    console.log(`🔄 Converting: ${filename}`)

    try {
      const filePath = join('./demo/templates', filename)
      const directTemplate: DirectTemplate = JSON.parse(readFileSync(filePath, 'utf-8'))

      const exportTemplate = convertToExportFormat(directTemplate)

      const outputPath = join('./temp-new-templates', filename)
      writeFileSync(outputPath, JSON.stringify(exportTemplate, null, 2))

      console.log(`   ✅ Converted to export format`)
      convertedCount++
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  console.log(`\n📊 Conversion Summary:`)
  console.log(`✅ Converted: ${convertedCount}`)
  console.log(`❌ Failed: ${newTemplateFiles.length - convertedCount}`)
  console.log(`📈 Success Rate: ${Math.round((convertedCount / newTemplateFiles.length) * 100)}%`)

  console.log('\n🎉 Template conversion complete!')
}

main().catch((error) => {
  console.error('Conversion script failed:', error)
  process.exit(1)
})

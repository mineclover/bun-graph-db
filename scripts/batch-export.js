#!/usr/bin/env node

/**
 * Batch Export Script
 * Exports table data to all supported formats automatically
 * Usage: node scripts/batch-export.js [tableId] [outputDir]
 */

import { exportTableNodes } from './auto-export.js'

// Available export formats
const ALL_FORMATS = ['CSV', 'JSON', 'EXCEL', 'XML', 'YAML']

// Default configuration
const DEFAULT_CONFIG = {
  tableId: '267',
  outputDir: './exports',
  limit: 100,
}

/**
 * Export table to all formats
 */
async function batchExport(config) {
  console.log(`🚀 Starting batch export for table ${config.tableId}...`)
  console.log(`📁 Output directory: ${config.outputDir}`)
  console.log(`📊 Formats: ${ALL_FORMATS.join(', ')}`)
  console.log('')

  const results = []

  for (const format of ALL_FORMATS) {
    try {
      console.log(`📄 Exporting ${format}...`)

      const exportConfig = {
        host: 'localhost',
        port: 4141,
        tableId: config.tableId,
        format: format,
        outputDir: config.outputDir,
        limit: config.limit,
      }

      const response = await exportTableNodes(exportConfig)

      if (response.errors && response.errors.length > 0) {
        throw new Error(`GraphQL errors: ${response.errors.map((e) => e.message).join(', ')}`)
      }

      const result = response.data.exportTableNodes

      if (result.success) {
        console.log(`✅ ${format} export completed: ${result.filePath}`)
        results.push({
          format: format,
          success: true,
          filePath: result.filePath,
          exportedNodes: result.metadata.exportedNodes,
          totalNodes: result.metadata.totalNodes,
        })
      } else {
        throw new Error(
          `Export failed: ${result.errors ? result.errors.join(', ') : 'Unknown error'}`
        )
      }
    } catch (error) {
      console.error(`❌ ${format} export failed: ${error.message}`)
      results.push({
        format: format,
        success: false,
        error: error.message,
      })
    }
  }

  console.log('')
  console.log('📋 Batch Export Summary:')
  console.log('========================')

  const successful = results.filter((r) => r.success)
  const failed = results.filter((r) => !r.success)

  console.log(`✅ Successful: ${successful.length}/${ALL_FORMATS.length}`)
  successful.forEach((result) => {
    console.log(`   ${result.format}: ${result.filePath} (${result.exportedNodes} nodes)`)
  })

  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}/${ALL_FORMATS.length}`)
    failed.forEach((result) => {
      console.log(`   ${result.format}: ${result.error}`)
    })
  }

  return results
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2)

  const config = {
    tableId: args[0] || DEFAULT_CONFIG.tableId,
    outputDir: args[1] || DEFAULT_CONFIG.outputDir,
    limit: DEFAULT_CONFIG.limit,
  }

  try {
    const results = await batchExport(config)

    const successful = results.filter((r) => r.success).length
    const total = results.length

    if (successful === total) {
      console.log(`\n🎉 All exports completed successfully!`)
      process.exit(0)
    } else if (successful > 0) {
      console.log(`\n⚠️ Partial success: ${successful}/${total} exports completed`)
      process.exit(1)
    } else {
      console.log(`\n💥 All exports failed!`)
      process.exit(1)
    }
  } catch (error) {
    console.error(`❌ Batch export failed: ${error.message}`)
    process.exit(1)
  }
}

// Show usage if --help is passed
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Batch Export Script

Exports table data to all supported formats: ${ALL_FORMATS.join(', ')}

Usage:
  node scripts/batch-export.js [tableId] [outputDir]

Arguments:
  tableId     Table ID to export (default: ${DEFAULT_CONFIG.tableId})
  outputDir   Output directory (default: ${DEFAULT_CONFIG.outputDir})

Examples:
  node scripts/batch-export.js                    # Export table 267 to ./exports
  node scripts/batch-export.js 265                # Export table 265 to ./exports
  node scripts/batch-export.js 267 ./my-exports   # Export table 267 to custom directory

Supported formats: ${ALL_FORMATS.join(', ')}
`)
  process.exit(0)
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`❌ Unexpected error: ${error.message}`)
    process.exit(1)
  })
}

#!/usr/bin/env node

/**
 * Automatic Table Export Script
 * Automatically exports table data to various formats via GraphQL API
 * Usage: node scripts/auto-export.js [tableId] [format] [outputDir]
 */

import http from 'node:http'

// Default configuration
const DEFAULT_CONFIG = {
  host: 'localhost',
  port: 4141,
  tableId: '267',
  format: 'CSV',
  outputDir: './exports',
  limit: 100,
}

// Available export formats
const FORMATS = ['CSV', 'JSON', 'EXCEL', 'XML', 'YAML']

/**
 * Make GraphQL request to export table nodes
 */
async function exportTableNodes(config) {
  const query = `
    mutation ExportTableNodes($input: TableNodesExportInput!) {
      exportTableNodes(input: $input) {
        success
        format
        filePath
        metadata {
          exportedAt
          totalNodes
          exportedNodes
          format
          filePath
        }
        errors
      }
    }
  `

  const variables = {
    input: {
      tableId: config.tableId,
      format: config.format,
      limit: config.limit,
      saveToFile: true,
      outputDirectory: config.outputDir,
      filename: `auto_export_table_${config.tableId}_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.${config.format.toLowerCase()}`,
    },
  }

  const postData = JSON.stringify({
    query: query,
    variables: variables,
  })

  const options = {
    hostname: config.host,
    port: config.port,
    path: '/graphql',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  }

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const response = JSON.parse(data)
          resolve(response)
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`))
    })

    req.write(postData)
    req.end()
  })
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2)

  const config = {
    ...DEFAULT_CONFIG,
    tableId: args[0] || DEFAULT_CONFIG.tableId,
    format: (args[1] || DEFAULT_CONFIG.format).toUpperCase(),
    outputDir: args[2] || DEFAULT_CONFIG.outputDir,
  }

  // Validate format
  if (!FORMATS.includes(config.format)) {
    console.error(
      `❌ Error: Invalid format '${config.format}'. Available formats: ${FORMATS.join(', ')}`
    )
    process.exit(1)
  }

  console.log(`🚀 Starting automatic export...`)
  console.log(`📊 Table ID: ${config.tableId}`)
  console.log(`📄 Format: ${config.format}`)
  console.log(`📁 Output Directory: ${config.outputDir}`)
  console.log('')

  try {
    const response = await exportTableNodes(config)

    if (response.errors && response.errors.length > 0) {
      console.error('❌ GraphQL errors:')
      for (const error of response.errors) {
        console.error(`  - ${error.message}`)
      }
      process.exit(1)
    }

    const result = response.data.exportTableNodes

    if (result.success) {
      console.log('✅ Export completed successfully!')
      console.log(`📁 File saved to: ${result.filePath}`)
      console.log(
        `📊 Exported ${result.metadata.exportedNodes} of ${result.metadata.totalNodes} nodes`
      )
      console.log(`🕒 Export time: ${result.metadata.exportedAt}`)
    } else {
      console.error('❌ Export failed:')
      if (result.errors && result.errors.length > 0) {
        for (const error of result.errors) {
          console.error(`  - ${error}`)
        }
      }
      process.exit(1)
    }
  } catch (error) {
    console.error(`❌ Export failed: ${error.message}`)
    process.exit(1)
  }
}

// Show usage if --help is passed
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Automatic Table Export Script

Usage:
  node scripts/auto-export.js [tableId] [format] [outputDir]

Arguments:
  tableId     Table ID to export (default: ${DEFAULT_CONFIG.tableId})
  format      Export format: ${FORMATS.join(', ')} (default: ${DEFAULT_CONFIG.format})
  outputDir   Output directory (default: ${DEFAULT_CONFIG.outputDir})

Examples:
  node scripts/auto-export.js                        # Export table 267 as CSV
  node scripts/auto-export.js 267 JSON               # Export table 267 as JSON
  node scripts/auto-export.js 267 CSV ./my-exports   # Export to custom directory
  node scripts/auto-export.js 265 EXCEL              # Export table 265 as Excel

Available formats: ${FORMATS.join(', ')}
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

export { exportTableNodes }

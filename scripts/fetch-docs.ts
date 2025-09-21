#!/usr/bin/env bun

/**
 * Documentation System Data Fetcher
 *
 * This script demonstrates how to fetch documentation data from the database-driven
 * documentation system that was implemented to replace the hardcoded MCP content.
 *
 * Uses GraphQL API to query the docs stored in the database.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface DocsSummary {
  totalDocs: number
  categories: Record<string, number>
  docs: Array<{
    id: string
    category: string
    version: number
    contentLength: number
    tableId: string
    createdAt: Date
    updatedAt: Date
  }>
}

async function graphqlQuery(query: string, variables: any = {}) {
  const response = await fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })

  const result = await response.json()

  if (result.errors) {
    throw new Error(`GraphQL Error: ${JSON.stringify(result.errors, null, 2)}`)
  }

  return result.data
}

async function fetchAllDocs(): Promise<DocsSummary> {
  console.log('📚 Fetching documentation data from database via GraphQL...')

  try {
    const data = await graphqlQuery(
      `
      query GetDocs($tableId: ID!) {
        getDocs(tableId: $tableId) {
          docs {
            id
            category
            content
            version
            table {
              id
              identifier
            }
            createdAt
            updatedAt
          }
          totalCount
        }
      }
    `,
      { tableId: '106' }
    )

    const docs = data.getDocs.docs

    // Create debugging output directory in project
    const debugDir = join(process.cwd(), 'tmp', 'debug', new Date().toISOString().split('T')[0])
    mkdirSync(debugDir, { recursive: true })
    console.log(`🔍 Debug output directory: ${debugDir}`)

    // Write raw GraphQL response to debug file
    const rawDataFile = join(debugDir, 'raw-graphql-response.json')
    writeFileSync(rawDataFile, JSON.stringify(data, null, 2))
    console.log(`📄 Raw GraphQL response saved to: ${rawDataFile}`)

    // Prepare summary
    const summary: DocsSummary = {
      totalDocs: docs.length,
      categories: {},
      docs: [],
    }

    // Process each doc
    for (const doc of docs) {
      // Count by category
      const category = doc.category
      summary.categories[category] = (summary.categories[category] || 0) + 1

      // Add to docs list
      summary.docs.push({
        id: doc.id,
        category: doc.category,
        version: doc.version,
        contentLength: doc.content.length,
        tableId: doc.table.id,
        createdAt: new Date(doc.createdAt),
        updatedAt: new Date(doc.updatedAt),
      })

      // Write individual doc content to separate file
      const docFile = join(debugDir, `doc-${doc.id}-${doc.category}.md`)
      const docContent = `# Document ${doc.id} - ${doc.category}

**Version**: ${doc.version}
**Table ID**: ${doc.table.id} (${doc.table.identifier})
**Created**: ${doc.createdAt}
**Updated**: ${doc.updatedAt}
**Content Length**: ${doc.content.length} characters

---

${doc.content}
`
      writeFileSync(docFile, docContent)
      console.log(`📝 Doc ${doc.id} (${doc.category}) saved to: ${docFile}`)
    }

    // Write summary to debug file
    const summaryFile = join(debugDir, 'docs-summary.json')
    writeFileSync(summaryFile, JSON.stringify(summary, null, 2))
    console.log(`📊 Summary saved to: ${summaryFile}`)

    // Write metadata file
    const metadataFile = join(debugDir, 'fetch-metadata.json')
    const metadata = {
      fetchTime: new Date().toISOString(),
      totalDocs: docs.length,
      tableId: '106',
      graphqlEndpoint: 'http://localhost:4000/graphql',
      categories: Object.keys(summary.categories),
      debugDir,
    }
    writeFileSync(metadataFile, JSON.stringify(metadata, null, 2))
    console.log(`🏷️  Metadata saved to: ${metadataFile}`)

    console.log(`\n✅ Debugging files saved to: ${debugDir}`)
    console.log(`📁 Files created:`)
    console.log(`   • raw-graphql-response.json - Raw API response`)
    console.log(`   • docs-summary.json - Processed summary`)
    console.log(`   • fetch-metadata.json - Fetch metadata`)
    docs.forEach((doc) => {
      console.log(`   • doc-${doc.id}-${doc.category}.md - Individual doc content`)
    })

    return summary
  } catch (error) {
    console.error('❌ Failed to fetch docs:', error)
    throw error
  }
}

async function fetchDocsByCategory(category: string): Promise<any[]> {
  console.log(`📖 Fetching docs for category: ${category}`)

  try {
    const data = await graphqlQuery(
      `
      query GetDocsByCategory($tableId: ID!, $category: DocCategory!) {
        getDocs(tableId: $tableId, category: $category) {
          docs {
            id
            category
            content
            version
            table {
              id
              identifier
            }
            createdAt
            updatedAt
          }
          totalCount
        }
      }
    `,
      {
        tableId: '106',
        category: category.toLowerCase(),
      }
    )

    return data.getDocs.docs
  } catch (error) {
    console.error(`❌ Failed to fetch docs for category ${category}:`, error)
    throw error
  }
}

async function fetchDocsByTableId(tableId: string): Promise<any[]> {
  console.log(`🗂️  Fetching docs for table: ${tableId}`)

  try {
    const data = await graphqlQuery(
      `
      query GetDocsByTable($tableId: ID!) {
        getDocs(tableId: $tableId) {
          docs {
            id
            category
            content
            version
            table {
              id
              identifier
            }
            createdAt
            updatedAt
          }
          totalCount
        }
      }
    `,
      {
        tableId,
      }
    )

    return data.getDocs.docs
  } catch (error) {
    console.error(`❌ Failed to fetch docs for table ${tableId}:`, error)
    throw error
  }
}

async function fetchSpecificDoc(id: string): Promise<any | null> {
  console.log(`📄 Fetching specific doc: ${id}`)

  try {
    const data = await graphqlQuery(
      `
      query GetDoc($id: ID!) {
        getDoc(id: $id) {
          id
          category
          content
          version
          table {
            id
            identifier
          }
          createdAt
          updatedAt
        }
      }
    `,
      { id }
    )

    return data.getDoc
  } catch (error) {
    console.error(`❌ Failed to fetch doc ${id}:`, error)
    throw error
  }
}

async function testHealthCheck(): Promise<void> {
  console.log('🩺 Testing GraphQL health check...')

  try {
    const data = await graphqlQuery(`
      query HealthCheck {
        healthCheck {
          status
          database
          version
          timestamp
        }
      }
    `)

    console.log('✅ Health Check Result:', data.healthCheck)
  } catch (error) {
    console.error('❌ Health check failed:', error)
    throw error
  }
}

async function demonstrateMcpToolPattern(): Promise<void> {
  console.log('🧪 Demonstrating database-driven documentation retrieval pattern...')
  console.log('   (This shows how the removed MCP UsageGuideTool would work)\n')

  try {
    // This simulates how the MCP UsageGuideTool would query the database
    const sections = ['overview', 'queries', 'mutations', 'examples']
    const categoryMap: Record<string, string> = {
      overview: 'usage',
      queries: 'guide',
      mutations: 'spec',
      examples: 'example',
    }

    for (const section of sections) {
      const category = categoryMap[section]
      console.log(`📖 Section '${section}' (category: ${category})`)

      const docs = await fetchDocsByCategory(category)
      console.log(`   Found ${docs.length} documents`)

      if (docs.length > 0) {
        const doc = docs[0] // Get the first/latest doc
        console.log(`   Content preview: ${doc.content.substring(0, 100)}...`)
        console.log(`   Full length: ${doc.content.length} characters\n`)
      } else {
        console.log('   No documents found\n')
      }
    }

    console.log('✅ Database-driven documentation system working correctly!')
    console.log('   This replaces the hardcoded MCP content that was removed.')
  } catch (error) {
    console.error('❌ MCP tool pattern demonstration failed:', error)
    throw error
  }
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  try {
    // First check if server is running
    await testHealthCheck()
    console.log('')

    switch (command) {
      case 'all': {
        console.log('🔍 Fetching all documentation...')
        const summary = await fetchAllDocs()

        console.log('\n📊 Documentation Summary:')
        console.log(`📚 Total Documents: ${summary.totalDocs}`)
        console.log('\n📁 Categories:')
        Object.entries(summary.categories).forEach(([category, count]) => {
          console.log(`   ${category}: ${count} docs`)
        })

        console.log('\n📋 Document Details:')
        summary.docs.forEach((doc) => {
          console.log(
            `   • [${doc.id}] ${doc.category} v${doc.version} (${doc.contentLength} chars) - Table ${doc.tableId}`
          )
        })
        break
      }

      case 'category': {
        const category = args[1]
        if (!category) {
          console.error('❌ Please specify a category: usage, guide, example, spec, general')
          process.exit(1)
        }

        console.log(`🔍 Fetching docs for category: ${category}`)
        const categoryDocs = await fetchDocsByCategory(category)

        console.log(`\n📁 Found ${categoryDocs.length} documents in category '${category}':`)
        categoryDocs.forEach((doc) => {
          console.log(`\n   • [${doc.id}] v${doc.version} (${doc.content.length} chars)`)
          console.log(`     Table: ${doc.table.identifier} (${doc.table.id})`)
          console.log(`     Created: ${doc.createdAt}`)
          console.log(`     Preview: ${doc.content.substring(0, 200)}...`)
        })
        break
      }

      case 'table': {
        const tableId = args[1]
        if (!tableId) {
          console.error('❌ Please specify a table ID')
          process.exit(1)
        }

        console.log(`🔍 Fetching docs for table: ${tableId}`)
        const tableDocs = await fetchDocsByTableId(tableId)

        console.log(`\n🗂️  Found ${tableDocs.length} documents for table '${tableId}':`)
        tableDocs.forEach((doc) => {
          console.log(`\n   • [${doc.id}] ${doc.category} v${doc.version}`)
          console.log(`     Content: ${doc.content.length} characters`)
          console.log(`     Preview: ${doc.content.substring(0, 150)}...`)
        })
        break
      }

      case 'doc': {
        const docId = args[1]
        if (!docId) {
          console.error('❌ Please specify a document ID')
          process.exit(1)
        }

        console.log(`🔍 Fetching document: ${docId}`)
        const doc = await fetchSpecificDoc(docId)

        if (doc) {
          console.log(`\n📄 Document Details:`)
          console.log(`   ID: ${doc.id}`)
          console.log(`   Category: ${doc.category}`)
          console.log(`   Version: ${doc.version}`)
          console.log(`   Table: ${doc.table.identifier} (${doc.table.id})`)
          console.log(`   Created: ${doc.createdAt}`)
          console.log(`   Updated: ${doc.updatedAt}`)
          console.log(`   Content Length: ${doc.content.length} characters`)
          console.log(`\n📝 Full Content:`)
          console.log('='.repeat(60))
          console.log(doc.content)
          console.log('='.repeat(60))
        } else {
          console.log(`❌ Document ${docId} not found`)
        }
        break
      }

      case 'test-mcp-pattern':
        await demonstrateMcpToolPattern()
        break

      default:
        console.log(`
📚 Documentation System Data Fetcher

Usage:
  bun scripts/fetch-docs.ts <command> [options]

Commands:
  all                    - Fetch all documentation summary
  category <category>    - Fetch docs by category (usage, guide, example, spec, general)
  table <tableId>       - Fetch docs by table ID (e.g., 106)
  doc <docId>           - Fetch specific document by ID (e.g., 51, 52, 53, 54)
  test-mcp-pattern      - Demonstrate database-driven documentation retrieval

Examples:
  bun scripts/fetch-docs.ts all
  bun scripts/fetch-docs.ts category usage
  bun scripts/fetch-docs.ts table 106
  bun scripts/fetch-docs.ts doc 51
  bun scripts/fetch-docs.ts test-mcp-pattern

📝 Notes:
  - Server must be running on http://localhost:4000
  - This demonstrates the database-driven documentation system
  - Replaces the hardcoded MCP content that was removed
  - Uses GraphQL API to access docs stored in SQLite database
        `)
        break
    }
  } catch (error) {
    console.error('💥 Script failed:', error)
    process.exit(1)
  }
}

// Run the script
if (import.meta.main) {
  main()
}

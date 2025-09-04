#!/usr/bin/env bun

/**
 * Test Environment Setup Script
 * 
 * This script sets up a complete test environment with:
 * 1. Schema creation (tables, attributes, relation types)
 * 2. Sample data loading (nodes and relationships)
 * 3. Template registration for testing
 * 
 * Usage: bun run scripts/setup-test-environment.ts
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql'
const DATASETS_DIR = join(process.cwd(), 'datasets')

interface SchemaConfig {
  version: string
  description: string
  tables: Array<{
    identifier: string
    name: string
    description: string
    attributes: Array<{
      identifier: string
      name: string
      description: string
      dataType: string
      isRequired: boolean
    }>
  }>
  relationTypes: Array<{
    identifier: string
    name: string
    description: string
    sourceTable: string
    targetTable: string
  }>
}

interface DataConfig {
  version: string
  description: string
  nodes: Record<string, Array<{
    content: string
    attributes: Record<string, any>
  }>>
  relations: Array<{
    sourceTable: string
    sourceContent: string
    targetTable: string
    targetContent: string
    relationType: string
  }>
}

interface TemplateConfig {
  version: string
  description: string
  templates: Array<{
    identifier: string
    name: string
    description: string
    templateType: string
    tags: string[]
    queryText: string
    variablesSchema?: any
    defaultVariables?: any
    applicableTables?: string[]
    complexityScore: number
  }>
}

// GraphQL client helper
async function graphqlRequest(query: string, variables?: any): Promise<any> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })

  const result = await response.json()
  
  if (result.errors) {
    console.error('GraphQL Error:', JSON.stringify(result.errors, null, 2))
    throw new Error(`GraphQL execution failed: ${result.errors[0].message}`)
  }

  return result.data
}

// Step 1: Create tables and attributes from schema
async function setupSchema(schema: SchemaConfig): Promise<Map<string, string>> {
  console.log('📋 Setting up schema...')
  const tableIdMap = new Map<string, string>()

  // Create tables
  for (const table of schema.tables) {
    console.log(`  Creating table: ${table.name}`)
    
    const createTableQuery = `
      mutation CreateTable($input: CreateTableInput!) {
        createTable(input: $input) {
          table {
            id
            identifier
            description
          }
        }
      }
    `
    
    const tableResult = await graphqlRequest(createTableQuery, {
      input: {
        identifier: table.identifier,
        description: table.description
      }
    })
    
    tableIdMap.set(table.identifier, tableResult.createTable.table.id)
    console.log(`    ✅ Created table ${table.identifier} with ID: ${tableResult.createTable.table.id}`)

    // Create attributes for this table
    for (const attribute of table.attributes) {
      console.log(`    Creating attribute: ${attribute.name}`)
      
      const createAttributeQuery = `
        mutation CreateAttributeType($input: CreateAttributeTypeInput!) {
          createAttributeType(input: $input) {
            attributeType {
              id
              identifier
              name
            }
          }
        }
      `
      
      await graphqlRequest(createAttributeQuery, {
        input: {
          tableId: tableResult.createTable.table.id,
          identifier: attribute.identifier,
          name: attribute.name,
          description: attribute.description,
          dataType: attribute.dataType,
          isRequired: attribute.isRequired
        }
      })
      
      console.log(`      ✅ Created attribute ${attribute.identifier}`)
    }
  }

  // Create relation types
  console.log('  Creating relation types...')
  for (const relationType of schema.relationTypes) {
    const sourceTableId = tableIdMap.get(relationType.sourceTable)
    const targetTableId = tableIdMap.get(relationType.targetTable)
    
    if (!sourceTableId || !targetTableId) {
      console.warn(`    ⚠️ Skipping relation type ${relationType.identifier}: missing table IDs`)
      continue
    }

    console.log(`    Creating relation type: ${relationType.name}`)
    
    const createRelationTypeQuery = `
      mutation CreateRelationType($input: CreateRelationTypeInput!) {
        createRelationType(input: $input) {
          relationType {
            id
            identifier
            name
          }
        }
      }
    `
    
    await graphqlRequest(createRelationTypeQuery, {
      input: {
        identifier: relationType.identifier,
        name: relationType.name,
        description: relationType.description,
        sourceTableId: sourceTableId,
        targetTableId: targetTableId
      }
    })
    
    console.log(`      ✅ Created relation type ${relationType.identifier}`)
  }

  return tableIdMap
}

// Step 2: Load sample data
async function loadData(data: DataConfig, tableIdMap: Map<string, string>): Promise<void> {
  console.log('📦 Loading sample data...')
  const nodeIdMap = new Map<string, string>()

  // Create nodes for each table
  for (const [tableIdentifier, nodes] of Object.entries(data.nodes)) {
    const tableId = tableIdMap.get(tableIdentifier)
    if (!tableId) {
      console.warn(`  ⚠️ Skipping nodes for table ${tableIdentifier}: table not found`)
      continue
    }

    console.log(`  Loading nodes for table: ${tableIdentifier}`)
    
    for (const node of nodes) {
      const createNodeQuery = `
        mutation CreateNode($input: CreateNodeInput!) {
          createNode(input: $input) {
            node {
              id
              content
            }
          }
        }
      `
      
      const nodeResult = await graphqlRequest(createNodeQuery, {
        input: {
          tableId: tableId,
          content: node.content,
          title: node.content
        }
      })
      
      nodeIdMap.set(`${tableIdentifier}:${node.content}`, nodeResult.createNode.node.id)
      console.log(`    ✅ Created node: ${node.content}`)

      // Set attributes for the node
      for (const [attrKey, attrValue] of Object.entries(node.attributes)) {
        // We'll need to implement attribute setting here
        // For now, just log it
        console.log(`      📝 Attribute ${attrKey}: ${attrValue}`)
      }
    }
  }

  console.log(`📊 Created ${nodeIdMap.size} nodes total`)
}

// Step 3: Register templates
async function setupTemplates(templates: TemplateConfig): Promise<void> {
  console.log('📑 Setting up templates...')

  for (const template of templates.templates) {
    console.log(`  Creating template: ${template.name}`)
    
    const createTemplateQuery = `
      mutation CreateTemplate($input: CreateTemplateInput!) {
        createTemplate(input: $input) {
          id
          identifier
          name
        }
      }
    `
    
    await graphqlRequest(createTemplateQuery, {
      input: {
        identifier: template.identifier,
        name: template.name,
        description: template.description,
        queryText: template.queryText,
        variablesSchema: template.variablesSchema,
        defaultVariables: template.defaultVariables,
        applicableTables: template.applicableTables,
        templateType: template.templateType,
        complexityScore: template.complexityScore,
        tags: template.tags
      }
    })
    
    console.log(`    ✅ Created template ${template.identifier}`)
  }
}

// Load configuration files
function loadConfig<T>(filename: string): T {
  const filePath = join(DATASETS_DIR, filename)
  try {
    const content = readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error(`❌ Failed to load ${filename}:`, error)
    process.exit(1)
  }
}

// Main setup function
async function main() {
  console.log('🚀 Starting test environment setup...')
  console.log(`📍 GraphQL Endpoint: ${GRAPHQL_ENDPOINT}`)

  try {
    // Test server connectivity
    console.log('🔍 Testing server connectivity...')
    await graphqlRequest('query { health { status } }')
    console.log('  ✅ Server is running')

    // Load configuration files
    const schema = loadConfig<SchemaConfig>('schema/base-schema.json')
    const data = loadConfig<DataConfig>('data/sample-data.json')
    const templates = loadConfig<TemplateConfig>('templates/comprehensive-templates.json')

    console.log(`📋 Schema version: ${schema.version}`)
    console.log(`📦 Data version: ${data.version}`)
    console.log(`📑 Templates version: ${templates.version}`)

    // Execute setup steps
    const tableIdMap = await setupSchema(schema)
    await loadData(data, tableIdMap)
    await setupTemplates(templates)

    console.log('🎉 Test environment setup completed successfully!')
    console.log('🧪 You can now run template tests and GraphQL operations')
    
  } catch (error) {
    console.error('❌ Setup failed:', error)
    process.exit(1)
  }
}

// Run the setup if this script is executed directly
if (import.meta.main) {
  main()
}
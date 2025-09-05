#!/usr/bin/env bun
/**
 * GraphQL Schema Generator
 * Generates a complete GraphQL schema file and TypeScript types for frontend usage
 */

import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const schemaDir = join(rootDir, 'src/presentation/graphql/schema')
const outputDir = join(rootDir, 'generated')

// Ensure output directory exists
await Bun.write(join(outputDir, '.gitkeep'), '')

/**
 * Read all GraphQL schema files and combine them
 */
async function combineSchemaFiles(): Promise<string> {
  const schemaFiles: string[] = []

  // Define the order of schema files for proper dependency resolution
  const schemaOrder = [
    'base-types.graphql',
    'types/node.graphql',
    'types/table.graphql',
    'types/attribute.graphql',
    'types/relation.graphql',
    'types/query-template.graphql',
    'queries/node-queries.graphql',
    'queries/table-queries.graphql',
    'queries/attribute-queries.graphql',
    'queries/relation-queries.graphql',
    'queries/template-queries.graphql',
    'mutations/node-mutations.graphql',
    'mutations/table-mutations.graphql',
    'mutations/attribute-mutations.graphql',
    'mutations/relation-mutations.graphql',
    'mutations/template-mutations.graphql',
    'subscriptions/realtime.graphql',
    'schema-export-import.graphql',
  ]

  // Read files in order
  for (const file of schemaOrder) {
    const filePath = join(schemaDir, file)
    try {
      const content = await readFile(filePath, 'utf-8')
      schemaFiles.push(`# ========== ${file} ==========\n${content}`)
    } catch (error) {
      console.log(`⚠️  Skipping ${file} (not found)`)
    }
  }

  // Also read any other .graphql files not in the order list
  async function readDir(dir: string, prefix = ''): Promise<void> {
    const files = await readdir(dir, { withFileTypes: true })

    for (const file of files) {
      const fullPath = join(dir, file.name)
      const relativePath = prefix ? `${prefix}/${file.name}` : file.name

      if (file.isDirectory()) {
        await readDir(fullPath, relativePath)
      } else if (file.name.endsWith('.graphql') && !schemaOrder.includes(relativePath)) {
        const content = await readFile(fullPath, 'utf-8')
        schemaFiles.push(`# ========== ${relativePath} ==========\n${content}`)
      }
    }
  }

  await readDir(schemaDir)

  return schemaFiles.join('\n\n')
}

/**
 * Generate the combined schema
 */
async function generateSchema() {
  console.log('🔄 Generating GraphQL schema...')

  const combinedSchema = await combineSchemaFiles()

  // Write combined schema
  const schemaPath = join(outputDir, 'schema.graphql')
  await Bun.write(schemaPath, combinedSchema)
  console.log(`✅ Generated schema: ${schemaPath}`)

  // Generate introspection JSON
  console.log('🔄 Generating introspection JSON...')
  const introspectionPath = join(outputDir, 'introspection.json')

  // We'll create a simple introspection runner
  const introspectionRunner = `
import { makeExecutableSchema } from '@graphql-tools/schema'
import { getIntrospectionQuery, buildClientSchema, printSchema } from 'graphql'
import { graphql } from 'graphql'

const schemaString = \`${combinedSchema.replace(/`/g, '\\`')}\`

try {
  const schema = makeExecutableSchema({ typeDefs: schemaString })
  const result = await graphql({
    schema,
    source: getIntrospectionQuery()
  })
  
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error('Failed to generate introspection:', error)
  process.exit(1)
}
`

  const tempFile = join(outputDir, 'temp-introspection.ts')
  await Bun.write(tempFile, introspectionRunner)

  try {
    const proc = Bun.spawn(['bun', tempFile], {
      cwd: rootDir,
      stdout: 'pipe',
    })

    const output = await new Response(proc.stdout).text()
    await Bun.write(introspectionPath, output)
    console.log(`✅ Generated introspection: ${introspectionPath}`)
  } catch (error) {
    console.error('⚠️  Could not generate introspection (server may need to be running)')
  }

  // Clean up temp file
  await Bun.spawn(['rm', tempFile]).exited

  return { schemaPath, introspectionPath }
}

// Run the generator
await generateSchema()

console.log(`
📦 Schema files generated successfully!

Frontend Usage:
===============

1. GraphQL Schema File:
   - Location: ./generated/schema.graphql
   - Use with GraphQL clients like Apollo, urql, or graphql-request
   
2. TypeScript Types Generation:
   - Run: bun run codegen
   - Generates TypeScript types from schema

3. Example Frontend Setup:
   - See ./generated/FRONTEND_USAGE.md for integration examples
`)

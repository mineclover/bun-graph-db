#!/usr/bin/env bun

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DataGenerator } from '../loaders/generators/DataGenerator.js'
import type { DatasetSize, DomainType } from '../loaders/types/DatasetTypes.js'

// Configuration
const DOMAINS: DomainType[] = ['ecommerce', 'social', 'enterprise', 'knowledge']
const SIZES: DatasetSize[] = ['small', 'medium', 'large']

async function generateSampleData() {
  const generator = new DataGenerator()

  console.log('🚀 Generating sample datasets...')

  for (const domain of DOMAINS) {
    console.log(`\n📊 Generating ${domain} domain data...`)

    for (const size of SIZES) {
      console.log(`  📝 Creating ${size} dataset...`)

      try {
        // Generate fixtures
        const fixtures = await generator.generateDomainFixtures({
          domain,
          size,
          seed: 12345, // Fixed seed for reproducible data
          includeMetadata: true,
        })

        // Ensure directory exists
        const outputDir = join('datasets', 'fixtures', domain, size)
        await mkdir(outputDir, { recursive: true })

        // Save fixtures
        const fixturesPath = join(outputDir, 'generated-data.json')
        await writeFile(fixturesPath, JSON.stringify(fixtures, null, 2))

        console.log(
          `    ✅ Generated ${fixtures.metadata.totalNodes} nodes, ${fixtures.metadata.totalRelations} relations`
        )

        // Log distribution
        const tableStats = Object.entries(fixtures.tables)
          .map(([table, nodes]) => `${table}(${nodes.length})`)
          .join(', ')
        console.log(`    📈 Tables: ${tableStats}`)
      } catch (error) {
        console.error(
          `    ❌ Failed to generate ${domain}/${size}:`,
          error instanceof Error ? error.message : error
        )
      }
    }
  }

  console.log('\n🎉 Sample data generation completed!')
}

// Run if called directly
if (import.meta.main) {
  generateSampleData().catch(console.error)
}

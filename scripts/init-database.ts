#!/usr/bin/env bun
/**
 * Database Initialization Script
 *
 * Applies schema.sql to the SQLite database
 */

import { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'

const DB_PATH = './data/bun-graph-db.sqlite'
const SCHEMA_PATH = './scripts/database/schema.sql'

async function initializeDatabase() {
  console.log('🔧 Initializing database...')
  console.log(`📁 Database path: ${DB_PATH}`)
  console.log(`📄 Schema file: ${SCHEMA_PATH}`)

  try {
    // Read schema SQL
    const schemaSql = readFileSync(SCHEMA_PATH, 'utf-8')
    console.log(`📖 Schema file loaded (${schemaSql.length} bytes)`)

    // Open database connection
    const db = new Database(DB_PATH, { create: true })
    console.log('✅ Database connection opened')

    // Execute the entire schema as one script
    // This handles transactions properly
    console.log(`📝 Executing schema SQL...`)

    try {
      db.exec(schemaSql)
      console.log(`✅ Schema executed successfully`)
    } catch (error) {
      console.error(`❌ Error executing schema:`, error)
      throw error
    }

    // Verify tables were created
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    console.log('\n📊 Created tables:')
    tables.forEach((table: any) => {
      console.log(`  - ${table.name}`)
    })

    db.close()
    console.log('\n✅ Database initialized successfully!')
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    process.exit(1)
  }
}

initializeDatabase()

/**
 * System Initialization Service
 * Comprehensive tool for initializing and resetting the development environment
 */

import type { Database } from 'bun:sqlite'
import type { DIContainer } from '../../infrastructure/container/DIContainer'
import { DatabaseTokens } from '../../infrastructure/container/tokens/DatabaseTokens'
import { ConsoleLogger } from '../../infrastructure/logging/ConsoleLogger'

export interface InitializationOptions {
  /** Reset database to clean state */
  resetDatabase: boolean

  /** Reset templates to baseline */
  resetTemplates: boolean

  /** Reset test data */
  resetTestData: boolean

  /** Create sample/demo data */
  createSampleData: boolean

  /** Reset performance metrics */
  resetMetrics: boolean

  /** Preserve specific table IDs (for testing) */
  preserveTableIds?: number[]

  /** Initialization mode */
  mode: 'development' | 'testing' | 'production' | 'demo'
}

export interface InitializationResult {
  success: boolean
  actions: string[]
  errors: string[]
  timings: Record<string, number>
  summary: {
    tablesCount: number
    templatesCount: number
    nodesCount: number
    attributesCount: number
  }
}

export class SystemInitializationService {
  private logger = new ConsoleLogger()

  constructor(private container: DIContainer) {}

  /**
   * Initialize system with specified options
   */
  async initialize(options: InitializationOptions): Promise<InitializationResult> {
    const startTime = Date.now()
    const result: InitializationResult = {
      success: false,
      actions: [],
      errors: [],
      timings: {},
      summary: {
        tablesCount: 0,
        templatesCount: 0,
        nodesCount: 0,
        attributesCount: 0
      }
    }

    try {
      this.logger.info(`🚀 Starting system initialization (mode: ${options.mode})`)

      const database = await this.container.resolve<Database>(DatabaseTokens.DATABASE_CONNECTION)

      // Step 1: Database reset
      if (options.resetDatabase) {
        const dbStart = Date.now()
        await this.resetDatabase(database, options)
        result.timings.database = Date.now() - dbStart
        result.actions.push('Database reset completed')
      }

      // Step 2: Template reset
      if (options.resetTemplates) {
        const templateStart = Date.now()
        await this.resetTemplates(database, options)
        result.timings.templates = Date.now() - templateStart
        result.actions.push('Templates reset completed')
      }

      // Step 3: Test data reset
      if (options.resetTestData) {
        const testStart = Date.now()
        await this.resetTestData(database, options)
        result.timings.testData = Date.now() - testStart
        result.actions.push('Test data reset completed')
      }

      // Step 4: Sample data creation
      if (options.createSampleData) {
        const sampleStart = Date.now()
        await this.createSampleData(database, options)
        result.timings.sampleData = Date.now() - sampleStart
        result.actions.push('Sample data created')
      }

      // Step 5: Performance metrics reset
      if (options.resetMetrics) {
        const metricsStart = Date.now()
        await this.resetMetrics(database)
        result.timings.metrics = Date.now() - metricsStart
        result.actions.push('Performance metrics reset')
      }

      // Step 6: Collect summary statistics
      result.summary = await this.collectSummary(database)
      result.timings.total = Date.now() - startTime

      result.success = true
      this.logger.info(`✅ System initialization completed in ${result.timings.total}ms`)

    } catch (error) {
      result.errors.push(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`)
      this.logger.error('❌ System initialization failed', {
        error: error instanceof Error ? error.message : String(error)
      })
    }

    return result
  }

  /**
   * Quick reset for development - common case
   */
  async quickReset(): Promise<InitializationResult> {
    return this.initialize({
      resetDatabase: true,
      resetTemplates: false,
      resetTestData: true,
      createSampleData: true,
      resetMetrics: true,
      mode: 'development'
    })
  }

  /**
   * Full reset - complete clean slate
   */
  async fullReset(): Promise<InitializationResult> {
    return this.initialize({
      resetDatabase: true,
      resetTemplates: true,
      resetTestData: true,
      createSampleData: false,
      resetMetrics: true,
      mode: 'development'
    })
  }

  /**
   * Demo setup - creates demo data for presentations
   */
  async demoSetup(): Promise<InitializationResult> {
    return this.initialize({
      resetDatabase: true,
      resetTemplates: false,
      resetTestData: false,
      createSampleData: true,
      resetMetrics: true,
      mode: 'demo'
    })
  }

  /**
   * Reset database tables in dependency order
   */
  private async resetDatabase(database: Database, options: InitializationOptions): Promise<void> {
    this.logger.info('🗃️ Resetting database...')

    // Tables to clear in dependency order (referencing tables first)
    const tablesToClear = [
      'node_attributes',
      'node_relations',
      'nodes',
      'attributes',
      'docs'
    ]

    // Conditionally clear tables based on preserve options
    const additionalTables = ['tables', 'templates']

    database.transaction(() => {
      // Clear dependent tables first
      for (const table of tablesToClear) {
        try {
          const count = database.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }
          if (count.count > 0) {
            database.exec(`DELETE FROM ${table}`)
            this.logger.debug(`Cleared ${count.count} records from ${table}`)
          }
        } catch (error) {
          this.logger.debug(`Could not clear table ${table}: ${error}`)
        }
      }

      // Clear main tables unless preserving specific data
      for (const table of additionalTables) {
        try {
          let query = `DELETE FROM ${table}`

          // Preserve specific table IDs if requested
          if (table === 'tables' && options.preserveTableIds?.length) {
            const preserveIds = options.preserveTableIds.join(',')
            query = `DELETE FROM ${table} WHERE id NOT IN (${preserveIds})`
          }

          const count = database.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }
          if (count.count > 0) {
            database.exec(query)
            this.logger.debug(`Processed ${table} table`)
          }
        } catch (error) {
          this.logger.debug(`Could not clear table ${table}: ${error}`)
        }
      }

      // Reset auto-increment sequences
      database.exec(`UPDATE sqlite_sequence SET seq = 0 WHERE name IN ('tables', 'nodes', 'attributes', 'templates')`)
    })()
  }

  /**
   * Reset templates to baseline set
   */
  private async resetTemplates(database: Database, options: InitializationOptions): Promise<void> {
    this.logger.info('📄 Resetting templates...')

    // Keep only essential system templates
    const essentialTemplates = [
      'system-health-check_v1-0-0',
      'test-template-001'
    ]

    if (essentialTemplates.length > 0) {
      const templatePlaceholders = essentialTemplates.map(() => '?').join(',')
      database.prepare(`DELETE FROM templates WHERE identifier NOT IN (${templatePlaceholders})`)
        .run(...essentialTemplates)
    } else {
      database.exec('DELETE FROM templates')
    }
  }

  /**
   * Reset test data specifically
   */
  private async resetTestData(database: Database, options: InitializationOptions): Promise<void> {
    this.logger.info('🧪 Resetting test data...')

    // Remove test tables (those with test prefixes)
    const testTablePrefixes = ['test-', 'mcp_', 'auto-', 'simple_test']

    for (const prefix of testTablePrefixes) {
      database.prepare(`DELETE FROM tables WHERE identifier LIKE ? OR identifier = ?`)
        .run(`${prefix}%`, prefix)
    }
  }

  /**
   * Create sample data for development/demo
   */
  private async createSampleData(database: Database, options: InitializationOptions): Promise<void> {
    this.logger.info('🎭 Creating sample data...')

    // Create sample table
    const result = database.prepare(`
      INSERT INTO tables (identifier, description)
      VALUES (?, ?)
    `).run('sample-people', 'Sample people table for demonstration')

    const tableId = result.lastInsertRowid as number

    // Create sample attributes
    const nameAttrResult = database.prepare(`
      INSERT INTO attributes (table_id, identifier, name, attribute_type_id)
      VALUES (?, ?, ?, ?)
    `).run(tableId, 'name', 'Full Name', 1) // string type

    const ageAttrResult = database.prepare(`
      INSERT INTO attributes (table_id, identifier, name, attribute_type_id)
      VALUES (?, ?, ?, ?)
    `).run(tableId, 'age', 'Age', 3) // integer type

    // Create sample nodes
    const samplePeople = [
      { content: 'Alice Johnson - Software Engineer', name: 'Alice Johnson', age: '28' },
      { content: 'Bob Smith - Product Manager', name: 'Bob Smith', age: '35' },
      { content: 'Carol Davis - Designer', name: 'Carol Davis', age: '31' }
    ]

    for (const person of samplePeople) {
      const nodeResult = database.prepare(`
        INSERT INTO nodes (table_id, content, title)
        VALUES (?, ?, ?)
      `).run(tableId, person.content, person.name)

      const nodeId = nodeResult.lastInsertRowid as number

      // Add name attribute
      database.prepare(`
        INSERT INTO node_attributes (node_id, attribute_id, value)
        VALUES (?, ?, ?)
      `).run(nodeId, nameAttrResult.lastInsertRowid, person.name)

      // Add age attribute
      database.prepare(`
        INSERT INTO node_attributes (node_id, attribute_id, value)
        VALUES (?, ?, ?)
      `).run(nodeId, ageAttrResult.lastInsertRowid, person.age)
    }

    // Create sample template
    database.prepare(`
      INSERT INTO templates (identifier, name, query_text, operation_type)
      VALUES (?, ?, ?, ?)
    `).run(
      'sample-people-search',
      'Search Sample People',
      `query SearchSamplePeople($search: String) {
        searchNodes(filter: { tableId: "${tableId}", search: $search }) {
          nodes {
            node { id title content }
            attributes { value attribute { identifier } }
          }
          totalCount
        }
      }`,
      'query'
    )
  }

  /**
   * Reset performance metrics and statistics
   */
  private async resetMetrics(database: Database): Promise<void> {
    this.logger.info('📊 Resetting performance metrics...')

    // Reset template usage statistics
    database.exec(`
      UPDATE templates SET
        usage_count = 0,
        last_used_at = NULL,
        avg_execution_time_ms = 0
    `)

    // Clear system stats if they exist
    const systemTables = ['system_stats', 'memory_stats', 'health_checks']
    for (const table of systemTables) {
      try {
        database.exec(`DELETE FROM ${table}`)
      } catch (error) {
        // Table might not exist, ignore
      }
    }
  }

  /**
   * Collect summary statistics after initialization
   */
  private async collectSummary(database: Database): Promise<InitializationResult['summary']> {
    const summary = {
      tablesCount: 0,
      templatesCount: 0,
      nodesCount: 0,
      attributesCount: 0
    }

    try {
      const tables = database.prepare('SELECT COUNT(*) as count FROM tables').get() as { count: number }
      summary.tablesCount = tables.count

      const templates = database.prepare('SELECT COUNT(*) as count FROM templates').get() as { count: number }
      summary.templatesCount = templates.count

      const nodes = database.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number }
      summary.nodesCount = nodes.count

      const attributes = database.prepare('SELECT COUNT(*) as count FROM attributes').get() as { count: number }
      summary.attributesCount = attributes.count
    } catch (error) {
      this.logger.error('Error collecting summary statistics', {
        error: error instanceof Error ? error.message : String(error)
      })
    }

    return summary
  }

  /**
   * Get current system status
   */
  async getSystemStatus(): Promise<{
    database: boolean
    tablesCount: number
    templatesCount: number
    nodesCount: number
    lastInitialized?: string
  }> {
    try {
      const database = await this.container.resolve<Database>(DatabaseTokens.DATABASE_CONNECTION)

      const tables = database.prepare('SELECT COUNT(*) as count FROM tables').get() as { count: number }
      const templates = database.prepare('SELECT COUNT(*) as count FROM templates').get() as { count: number }
      const nodes = database.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number }

      return {
        database: true,
        tablesCount: tables.count,
        templatesCount: templates.count,
        nodesCount: nodes.count
      }
    } catch (error) {
      return {
        database: false,
        tablesCount: 0,
        templatesCount: 0,
        nodesCount: 0
      }
    }
  }
}
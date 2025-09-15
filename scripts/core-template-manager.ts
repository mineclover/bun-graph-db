#!/usr/bin/env bun
/**
 * Core Template Manager
 *
 * Manages high-value reusable templates as default/core templates
 * for the graph database system. Provides functionality to register,
 * update, and maintain core template library.
 */

interface CoreTemplate {
  identifier: string
  name: string
  description: string
  category: string
  reuseScore: number
  priority: 'high' | 'medium' | 'low'
  status: 'active' | 'deprecated' | 'maintenance'
  tags: string[]
}

interface CoreTemplateConfig {
  version: string
  lastUpdated: string
  coreTemplates: CoreTemplate[]
  categories: {
    [key: string]: {
      description: string
      priority: number
      templates: string[]
    }
  }
}

class CoreTemplateManager {
  private serverUrl = 'http://localhost:4000/graphql'
  private configPath = 'config/core-templates.json'
  private coreTemplates: CoreTemplate[] = []
  private config: CoreTemplateConfig = {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    coreTemplates: [],
    categories: {}
  }

  // Core template identifiers based on analysis results
  private static readonly TOP_CORE_TEMPLATES = [
    // Tier 1: Essential Operations (Score >= 7.0)
    'search-templates-advanced',
    'test-search-nodes',
    'list-tables-with-pagination',
    'get-table-schema',
    'list-nodes-by-table',
    'execute-template-with-variables',
    'get-table-detailed-statistics',

    // Tier 2: Common Operations (Score >= 6.0)
    'test-get-table',
    'test-get-node',
    'get-table-attributes-by-id',
    'list-all-attribute-types',
    'create-attribute-with-type',
    'template-create-new-template',
    'execute-template-with-graphql',
    'create-template-basic',

    // Tier 3: CRUD Operations (Score >= 5.0)
    'create-table',
    'test-create-node',
    'delete-template-by-id'
  ]

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Core Template Manager...\n')

    // Load existing config or create new one
    await this.loadConfig()

    // Fetch template data from GraphQL server
    await this.fetchTemplateData()

    // Update core template definitions
    this.buildCoreTemplateList()

    // Save updated configuration
    await this.saveConfig()

    console.log('✅ Core Template Manager initialized successfully!')
  }

  private async loadConfig(): Promise<void> {
    try {
      const configFile = Bun.file(this.configPath)
      if (await configFile.exists()) {
        const configData = await configFile.text()
        this.config = JSON.parse(configData)
        console.log(`📁 Loaded existing configuration (version ${this.config.version})`)
      } else {
        console.log('📁 Creating new configuration file')
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load config: ${error}, using defaults`)
    }
  }

  private async fetchTemplateData(): Promise<void> {
    const query = `
      query GetCoreTemplates($identifiers: [String!]!) {
        searchTemplates(
          filter: { identifiers: $identifiers }
          pagination: { limit: 100 }
        ) {
          templates {
            identifier
            name
            description
            tags
            complexityScore
            isActive
            usageCount
            operationType
          }
        }
      }
    `

    try {
      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { identifiers: CoreTemplateManager.TOP_CORE_TEMPLATES }
        })
      })

      const result = await response.json()
      if (result.errors) {
        // Fallback to individual template fetching
        console.log('📡 Using fallback template fetching...')
        await this.fetchTemplatesIndividually()
      } else {
        const templates = result.data?.searchTemplates?.templates || []
        this.processTemplateData(templates)
      }
    } catch (error) {
      console.warn(`⚠️ GraphQL fetch failed: ${error}`)
      await this.fetchTemplatesIndividually()
    }
  }

  private async fetchTemplatesIndividually(): Promise<void> {
    const query = `
      query GetAllTemplates {
        searchTemplates(pagination: { limit: 100 }) {
          templates {
            identifier
            name
            description
            tags
            complexityScore
            isActive
            usageCount
            operationType
          }
        }
      }
    `

    const response = await fetch(this.serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    })

    const result = await response.json()
    const allTemplates = result.data?.searchTemplates?.templates || []

    // Filter for core templates
    const coreTemplateData = allTemplates.filter((t: any) =>
      CoreTemplateManager.TOP_CORE_TEMPLATES.includes(t.identifier)
    )

    this.processTemplateData(coreTemplateData)
  }

  private processTemplateData(templates: any[]): void {
    this.coreTemplates = templates.map(template => ({
      identifier: template.identifier,
      name: template.name,
      description: template.description || 'No description available',
      category: this.categorizeTemplate(template),
      reuseScore: this.calculateReuseScore(template),
      priority: this.determinePriority(template),
      status: template.isActive ? 'active' : 'deprecated' as const,
      tags: template.tags || []
    }))

    console.log(`📋 Processed ${this.coreTemplates.length} core templates`)
  }

  private categorizeTemplate(template: any): string {
    const identifier = template.identifier.toLowerCase()

    if (identifier.includes('search') || identifier.includes('list')) return 'Query Operations'
    if (identifier.includes('create') || identifier.includes('delete') || identifier.includes('update')) return 'CRUD Operations'
    if (identifier.includes('template')) return 'Template Management'
    if (identifier.includes('table')) return 'Table Operations'
    if (identifier.includes('node')) return 'Node Operations'
    if (identifier.includes('attribute')) return 'Attribute Operations'
    if (identifier.includes('system') || identifier.includes('health')) return 'System Operations'

    return 'General'
  }

  private calculateReuseScore(template: any): number {
    let score = 3.0 // Base score for core templates

    // Operation type scoring
    if (template.operationType === 'QUERY') score += 2.0
    else if (template.operationType === 'MUTATION') score += 1.5
    else if (template.operationType === 'SUBSCRIPTION') score += 1.0

    // Usage count bonus
    score += Math.min(template.usageCount * 0.1, 2.0)

    // Complexity penalty for overly complex templates
    if (template.complexityScore > 5) score -= 0.5

    // Template name quality indicators
    const nameIndicators = ['advanced', 'enhanced', 'detailed', 'comprehensive']
    for (const indicator of nameIndicators) {
      if (template.name.toLowerCase().includes(indicator)) {
        score += 0.5
        break
      }
    }

    return Math.round(score * 10) / 10
  }

  private determinePriority(template: any): 'high' | 'medium' | 'low' {
    const identifier = template.identifier

    // High priority: Essential operations
    const highPriorityPatterns = [
      'search-templates-advanced', 'get-table-schema', 'list-tables-with-pagination',
      'execute-template-with-variables', 'create-template-basic'
    ]

    if (highPriorityPatterns.some(pattern => identifier.includes(pattern))) {
      return 'high'
    }

    // Medium priority: Common operations
    const mediumPriorityPatterns = ['get-table', 'get-node', 'list-', 'create-']
    if (mediumPriorityPatterns.some(pattern => identifier.includes(pattern))) {
      return 'medium'
    }

    return 'low'
  }

  private buildCoreTemplateList(): void {
    // Group templates by category
    const categories: { [key: string]: CoreTemplate[] } = {}

    for (const template of this.coreTemplates) {
      if (!categories[template.category]) {
        categories[template.category] = []
      }
      categories[template.category].push(template)
    }

    // Build category configuration
    this.config.categories = {}
    for (const [categoryName, templates] of Object.entries(categories)) {
      this.config.categories[categoryName] = {
        description: this.getCategoryDescription(categoryName),
        priority: this.getCategoryPriority(categoryName),
        templates: templates
          .sort((a, b) => b.reuseScore - a.reuseScore)
          .map(t => t.identifier)
      }
    }

    this.config.coreTemplates = this.coreTemplates
    this.config.lastUpdated = new Date().toISOString()
  }

  private getCategoryDescription(category: string): string {
    const descriptions: { [key: string]: string } = {
      'Query Operations': 'Templates for searching and retrieving data',
      'CRUD Operations': 'Templates for creating, reading, updating, and deleting entities',
      'Template Management': 'Templates for managing and executing other templates',
      'Table Operations': 'Templates for table schema and metadata operations',
      'Node Operations': 'Templates for node management and relationships',
      'Attribute Operations': 'Templates for attribute and attribute type management',
      'System Operations': 'Templates for system health and monitoring',
      'General': 'General-purpose templates'
    }
    return descriptions[category] || 'Templates for various operations'
  }

  private getCategoryPriority(category: string): number {
    const priorities: { [key: string]: number } = {
      'Template Management': 10,
      'Query Operations': 9,
      'Table Operations': 8,
      'Node Operations': 7,
      'CRUD Operations': 6,
      'Attribute Operations': 5,
      'System Operations': 4,
      'General': 3
    }
    return priorities[category] || 1
  }

  private async saveConfig(): Promise<void> {
    try {
      await Bun.write(this.configPath, JSON.stringify(this.config, null, 2))
      console.log(`💾 Configuration saved to ${this.configPath}`)
    } catch (error) {
      console.error(`❌ Failed to save configuration: ${error}`)
    }
  }

  async generateReport(): Promise<void> {
    console.log('\n' + '='.repeat(80))
    console.log('📋 CORE TEMPLATE MANAGEMENT REPORT')
    console.log('='.repeat(80))

    console.log(`\n📊 Summary:`)
    console.log(`   Total Core Templates: ${this.coreTemplates.length}`)
    console.log(`   Active Templates: ${this.coreTemplates.filter(t => t.status === 'active').length}`)
    console.log(`   Categories: ${Object.keys(this.config.categories).length}`)

    // Category breakdown
    console.log(`\n📁 Categories by Priority:`)
    const sortedCategories = Object.entries(this.config.categories)
      .sort(([,a], [,b]) => b.priority - a.priority)

    for (const [category, info] of sortedCategories) {
      console.log(`   ${info.priority}. ${category}: ${info.templates.length} templates`)
      console.log(`      └─ ${info.description}`)
    }

    // Top templates by priority
    console.log(`\n⭐ HIGH PRIORITY CORE TEMPLATES:`)
    const highPriorityTemplates = this.coreTemplates
      .filter(t => t.priority === 'high')
      .sort((a, b) => b.reuseScore - a.reuseScore)

    highPriorityTemplates.forEach((template, index) => {
      console.log(`   ${index + 1}. ${template.identifier}`)
      console.log(`      └─ ${template.name} (Score: ${template.reuseScore}, Category: ${template.category})`)
    })

    // Templates by category
    console.log(`\n📋 TEMPLATES BY CATEGORY:`)
    for (const [category, info] of sortedCategories) {
      console.log(`\n   ${category}:`)
      const categoryTemplates = this.coreTemplates.filter(t => t.category === category)
      categoryTemplates.forEach((template, index) => {
        const statusIcon = template.status === 'active' ? '✅' : template.status === 'deprecated' ? '⚠️' : '🔧'
        console.log(`     ${statusIcon} ${template.identifier} (${template.reuseScore})`)
      })
    }

    console.log('\n' + '='.repeat(80))
  }

  // Public API methods for template management
  async registerCoreTemplate(identifier: string): Promise<boolean> {
    console.log(`📋 Registering ${identifier} as core template...`)

    // Fetch template data
    const query = `
      query GetTemplate($identifier: String!) {
        getTemplateByIdentifier(identifier: $identifier) {
          identifier
          name
          description
          tags
          isActive
        }
      }
    `

    try {
      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { identifier }
        })
      })

      const result = await response.json()
      const template = result.data?.getTemplateByIdentifier

      if (!template) {
        console.error(`❌ Template ${identifier} not found`)
        return false
      }

      // Add to core templates list
      if (!CoreTemplateManager.TOP_CORE_TEMPLATES.includes(identifier)) {
        CoreTemplateManager.TOP_CORE_TEMPLATES.push(identifier)
      }

      console.log(`✅ Template ${identifier} registered as core template`)
      return true
    } catch (error) {
      console.error(`❌ Failed to register template: ${error}`)
      return false
    }
  }

  getCoreTemplatesByCategory(category: string): CoreTemplate[] {
    return this.coreTemplates.filter(t => t.category === category)
  }

  getCoreTemplatesByPriority(priority: 'high' | 'medium' | 'low'): CoreTemplate[] {
    return this.coreTemplates.filter(t => t.priority === priority)
  }

  getAllCoreTemplates(): CoreTemplate[] {
    return [...this.coreTemplates]
  }

  getConfiguration(): CoreTemplateConfig {
    return { ...this.config }
  }
}

// CLI Interface
async function main() {
  const manager = new CoreTemplateManager()

  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case 'init':
      await manager.initialize()
      await manager.generateReport()
      break

    case 'register':
      const identifier = args[1]
      if (!identifier) {
        console.error('❌ Usage: bun core-template-manager.ts register <template-identifier>')
        process.exit(1)
      }
      await manager.initialize()
      await manager.registerCoreTemplate(identifier)
      break

    case 'report':
      await manager.initialize()
      await manager.generateReport()
      break

    case 'list':
      const category = args[1]
      await manager.initialize()

      if (category) {
        const templates = manager.getCoreTemplatesByCategory(category)
        console.log(`\n📋 Core templates in category "${category}":`)
        templates.forEach((t, i) => {
          console.log(`   ${i + 1}. ${t.identifier} (${t.reuseScore})`)
        })
      } else {
        const templates = manager.getAllCoreTemplates()
        console.log(`\n📋 All core templates (${templates.length}):`)
        templates.forEach((t, i) => {
          console.log(`   ${i + 1}. ${t.identifier} (${t.category}, ${t.reuseScore})`)
        })
      }
      break

    default:
      console.log(`
🔧 Core Template Manager CLI

Usage:
  bun core-template-manager.ts init           Initialize and generate report
  bun core-template-manager.ts register <id>  Register template as core
  bun core-template-manager.ts report         Generate management report
  bun core-template-manager.ts list [cat]     List core templates [by category]

Examples:
  bun core-template-manager.ts init
  bun core-template-manager.ts register my-custom-template
  bun core-template-manager.ts list "Query Operations"
      `)
      break
  }
}

if (import.meta.main) {
  main().catch(console.error)
}

export { CoreTemplateManager, type CoreTemplate, type CoreTemplateConfig }
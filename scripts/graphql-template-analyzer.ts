#!/usr/bin/env bun
/**
 * GraphQL Template Analyzer
 *
 * Analyzes registered templates via GraphQL queries, tests their execution,
 * and identifies high-value reusable templates for promotion to core library.
 */

import { performance } from 'node:perf_hooks'

interface TemplateAnalysis {
  id: string
  identifier: string
  name: string
  description: string
  category: string
  complexity: number
  executionTime: number
  success: boolean
  error?: string
  reuseScore: number
  tags: string[]
  operationType: 'QUERY' | 'MUTATION' | 'SUBSCRIPTION'
  hasVariables: boolean
  recommendation: 'core' | 'useful' | 'specialized' | 'deprecated'
  actualUsageCount: number
  avgExecutionTimeMs: number
}

interface GraphQLTemplate {
  id: string
  name: string
  identifier: string
  description: string
  query: string
  queryName: string[]
  operationType: 'QUERY' | 'MUTATION' | 'SUBSCRIPTION'
  complexityScore: number
  isActive: boolean
  usageCount: number
  tags: string[]
  applicableTables: string[] | null
  lastUsedAt: string | null
  avgExecutionTimeMs: number
  version: string
  createdAt: string
  updatedAt: string
}

class GraphQLTemplateAnalyzer {
  private serverUrl = 'http://localhost:4000/graphql'
  private results: TemplateAnalysis[] = []

  async analyze(): Promise<void> {
    console.log('🔍 Starting GraphQL template analysis...\n')

    // 1. Fetch all templates from GraphQL server
    const templates = await this.fetchAllTemplates()
    console.log(`Found ${templates.length} active templates\n`)

    let processed = 0
    for (const template of templates) {
      try {
        const analysis = await this.analyzeTemplate(template)
        this.results.push(analysis)
        processed++

        const status = analysis.success ? '✅' : '❌'
        console.log(
          `${status} [${processed}/${templates.length}] ${analysis.identifier} (${analysis.category})`
        )

        if (!analysis.success && analysis.error) {
          console.log(`   └─ Error: ${analysis.error}`)
        }
      } catch (error) {
        console.error(`❌ Failed to analyze ${template.identifier}: ${error}`)
      }
    }

    console.log('\n📊 Analysis complete!')
    this.generateReport()
  }

  private async fetchAllTemplates(): Promise<GraphQLTemplate[]> {
    const query = `
      query GetAllTemplates {
        searchTemplates(pagination: { limit: 100, offset: 0 }) {
          templates {
            id
            name
            identifier
            description
            query
            queryName
            operationType
            complexityScore
            isActive
            usageCount
            tags
            applicableTables
            lastUsedAt
            avgExecutionTimeMs
            version
            createdAt
            updatedAt
          }
          totalCount
        }
      }
    `

    const response = await fetch(this.serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })

    const result = await response.json()
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`)
    }

    return result.data.searchTemplates.templates.filter((t: GraphQLTemplate) => t.isActive)
  }

  private async analyzeTemplate(template: GraphQLTemplate): Promise<TemplateAnalysis> {
    // Test execution
    const startTime = performance.now()
    const { success, error } = await this.testExecution(template)
    const executionTime = performance.now() - startTime

    // Calculate scores
    const complexity = template.complexityScore || this.calculateComplexity(template)
    const reuseScore = this.calculateReuseScore(template)
    const category = this.categorizeTemplate(template)
    const recommendation = this.getRecommendation(template, success, reuseScore)

    return {
      id: template.id,
      identifier: template.identifier,
      name: template.name,
      description: template.description,
      category,
      complexity,
      executionTime,
      success,
      error,
      reuseScore,
      tags: template.tags || [],
      operationType: template.operationType,
      hasVariables: this.hasVariables(template.query),
      recommendation,
      actualUsageCount: template.usageCount,
      avgExecutionTimeMs: template.avgExecutionTimeMs,
    }
  }

  private async testExecution(
    template: GraphQLTemplate
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Basic GraphQL syntax validation
      if (!template.query || typeof template.query !== 'string') {
        return { success: false, error: 'Invalid query format' }
      }

      // Check for basic GraphQL structure
      const trimmedQuery = template.query.trim()
      if (!trimmedQuery.match(/^(query|mutation|subscription)/i) && !trimmedQuery.startsWith('{')) {
        return { success: false, error: 'Invalid GraphQL operation' }
      }

      // Check for balanced braces
      const openBraces = (trimmedQuery.match(/\{/g) || []).length
      const closeBraces = (trimmedQuery.match(/\}/g) || []).length
      if (openBraces !== closeBraces) {
        return { success: false, error: 'Unbalanced braces in query' }
      }

      // Test execution with template if it's a simple query without required variables
      if (this.canExecuteDirectly(template)) {
        const executeQuery = `
          mutation ExecuteTemplate($templateIdentifier: String!, $variables: JSON) {
            executeTemplate(input: {
              templateIdentifier: $templateIdentifier
              variables: $variables
              trackUsage: false
            }) {
              success
              errors { message }
            }
          }
        `

        const response = await fetch(this.serverUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: executeQuery,
            variables: {
              templateIdentifier: template.identifier,
              variables: {},
            },
          }),
        })

        const result = await response.json()
        if (result.errors) {
          return { success: false, error: `Execution failed: ${result.errors[0].message}` }
        }

        const executeResult = result.data?.executeTemplate
        if (!executeResult?.success) {
          return {
            success: false,
            error: executeResult?.errors?.[0]?.message || 'Unknown execution error',
          }
        }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: `Execution failed: ${error}` }
    }
  }

  private canExecuteDirectly(template: GraphQLTemplate): boolean {
    // Check if template can be executed without required variables
    const query = template.query

    // Skip if it contains required variables (indicated by ! after type)
    if (query.match(/\$\w+:\s*\w+!/)) {
      return false
    }

    // Skip mutations that likely modify data
    if (
      (template.operationType === 'MUTATION' && query.toLowerCase().includes('create')) ||
      query.toLowerCase().includes('delete') ||
      query.toLowerCase().includes('update')
    ) {
      return false
    }

    return true
  }

  private hasVariables(query: string): boolean {
    return /\$\w+/.test(query)
  }

  private calculateComplexity(template: GraphQLTemplate): number {
    const query = template.query || ''
    let score = 1

    // Count query depth
    const braceDepth = this.calculateBraceDepth(query)
    score += braceDepth * 0.5

    // Count fields
    const fieldCount = (query.match(/\w+\s*\{/g) || []).length
    score += fieldCount * 0.3

    // Variables complexity
    const variableCount = (query.match(/\$\w+/g) || []).length
    score += variableCount * 0.2

    // Special operations
    if (query.includes('mutation')) score += 1
    if (query.includes('subscription')) score += 1.5
    if (query.includes('fragment')) score += 0.5

    return Math.round(score * 10) / 10
  }

  private calculateBraceDepth(query: string): number {
    let depth = 0
    let maxDepth = 0

    for (const char of query) {
      if (char === '{') {
        depth++
        maxDepth = Math.max(maxDepth, depth)
      } else if (char === '}') {
        depth--
      }
    }

    return maxDepth
  }

  private calculateReuseScore(template: GraphQLTemplate): number {
    let score = 0

    // Base score by operation type
    switch (template.operationType) {
      case 'QUERY':
        score += 3
        break
      case 'MUTATION':
        score += 2
        break
      case 'SUBSCRIPTION':
        score += 1
        break
    }

    // Actual usage count (strong indicator of reusability)
    score += Math.min(template.usageCount * 0.1, 3)

    // Generality score (fewer specific hardcoded values = higher reuse)
    const query = template.query || ''
    const hasHardcodedIds = /id:\s*["']\w+["']/.test(query)
    if (!hasHardcodedIds) score += 2

    // Variable usage (parameterized queries are more reusable)
    const variableCount = (query.match(/\$\w+/g) || []).length
    score += Math.min(variableCount * 0.5, 2)

    // Common operations get higher scores
    const commonPatterns = [
      'health',
      'status',
      'list',
      'search',
      'get',
      'create',
      'update',
      'delete',
      'node',
      'table',
      'attribute',
      'relation',
      'template',
      'system',
    ]

    for (const pattern of commonPatterns) {
      if (
        template.identifier.toLowerCase().includes(pattern) ||
        template.name.toLowerCase().includes(pattern)
      ) {
        score += 0.5
        break
      }
    }

    // Tag-based scoring
    const valuableTags = ['basic', 'management', 'core', 'essential', 'system']
    for (const tag of template.tags) {
      if (valuableTags.includes(tag.toLowerCase())) {
        score += 0.3
      }
    }

    // Performance bonus (fast templates are more reusable)
    if (template.avgExecutionTimeMs > 0 && template.avgExecutionTimeMs < 100) {
      score += 0.5
    }

    // Penalty for overly complex queries
    if (template.complexityScore > 8) {
      score -= 1
    }

    return Math.round(score * 10) / 10
  }

  private categorizeTemplate(template: GraphQLTemplate): string {
    const identifier = template.identifier.toLowerCase()
    const name = template.name.toLowerCase()
    const query = template.query.toLowerCase()

    // System operations
    if (
      identifier.includes('system') ||
      identifier.includes('health') ||
      identifier.includes('statistics')
    ) {
      return 'System'
    }

    // Template management
    if (identifier.includes('template') || name.includes('template')) {
      return 'Template Management'
    }

    // Node operations
    if (identifier.includes('node') || query.includes('node')) {
      return 'Node Operations'
    }

    // Table operations
    if (identifier.includes('table') || query.includes('table')) {
      return 'Table Operations'
    }

    // Attribute operations
    if (identifier.includes('attribute') || query.includes('attribute')) {
      return 'Attribute Operations'
    }

    // Relation operations
    if (identifier.includes('relation') || query.includes('relation')) {
      return 'Relation Operations'
    }

    // Search operations
    if (identifier.includes('search') || query.includes('search')) {
      return 'Search & Query'
    }

    // CRUD operations
    if (
      identifier.includes('create') ||
      identifier.includes('update') ||
      identifier.includes('delete') ||
      identifier.includes('get')
    ) {
      return 'CRUD Operations'
    }

    return 'Miscellaneous'
  }

  private getRecommendation(
    template: GraphQLTemplate,
    success: boolean,
    reuseScore: number
  ): 'core' | 'useful' | 'specialized' | 'deprecated' {
    if (!success) return 'deprecated'

    // Factor in actual usage
    const usageBonus = template.usageCount > 0 ? 0.5 : 0
    const adjustedScore = reuseScore + usageBonus

    if (adjustedScore >= 4.5) return 'core'
    if (adjustedScore >= 3.0) return 'useful'
    if (adjustedScore >= 2.0) return 'specialized'
    return 'deprecated'
  }

  private generateReport(): void {
    console.log('\n' + '='.repeat(80))
    console.log('📋 GRAPHQL TEMPLATE ANALYSIS REPORT')
    console.log('='.repeat(80))

    // Summary statistics
    const total = this.results.length
    const successful = this.results.filter((r) => r.success).length
    const failed = total - successful

    console.log(`\n📊 Summary:`)
    console.log(`   Total Templates: ${total}`)
    console.log(`   Successful: ${successful} (${Math.round((successful / total) * 100)}%)`)
    console.log(`   Failed: ${failed} (${Math.round((failed / total) * 100)}%)`)

    // Categories breakdown
    console.log(`\n📁 Categories:`)
    const categories = this.groupBy(this.results, 'category')
    for (const [category, templates] of Object.entries(categories)) {
      console.log(`   ${category}: ${templates.length}`)
    }

    // Recommendations
    console.log(`\n🎯 Recommendations:`)
    const recommendations = this.groupBy(this.results, 'recommendation')
    for (const [rec, templates] of Object.entries(recommendations)) {
      const icon =
        rec === 'core' ? '⭐' : rec === 'useful' ? '👍' : rec === 'specialized' ? '🔧' : '⚠️'
      console.log(`   ${icon} ${rec}: ${templates.length}`)
    }

    // Core templates (high reuse value)
    console.log(`\n⭐ CORE TEMPLATES (Recommended for base library):`)
    const coreTemplates = this.results
      .filter((r) => r.recommendation === 'core')
      .sort((a, b) => b.reuseScore - a.reuseScore)

    coreTemplates.forEach((template, index) => {
      console.log(`   ${index + 1}. ${template.identifier}`)
      console.log(
        `      └─ ${template.name} (Score: ${template.reuseScore}, Usage: ${template.actualUsageCount}, Category: ${template.category})`
      )
    })

    // Useful templates
    console.log(`\n👍 USEFUL TEMPLATES:`)
    const usefulTemplates = this.results
      .filter((r) => r.recommendation === 'useful')
      .sort((a, b) => b.reuseScore - a.reuseScore)
      .slice(0, 10) // Top 10

    usefulTemplates.forEach((template, index) => {
      console.log(
        `   ${index + 1}. ${template.identifier} (Score: ${template.reuseScore}, Usage: ${template.actualUsageCount})`
      )
    })

    // Most used templates
    console.log(`\n🔥 MOST USED TEMPLATES:`)
    const mostUsed = this.results
      .filter((r) => r.actualUsageCount > 0)
      .sort((a, b) => b.actualUsageCount - a.actualUsageCount)
      .slice(0, 5)

    if (mostUsed.length > 0) {
      mostUsed.forEach((template, index) => {
        console.log(
          `   ${index + 1}. ${template.identifier} (Usage: ${template.actualUsageCount}, Score: ${template.reuseScore})`
        )
      })
    } else {
      console.log(`   No templates have been used yet.`)
    }

    // Failed templates
    if (failed > 0) {
      console.log(`\n⚠️  FAILED TEMPLATES (Need attention):`)
      const failedTemplates = this.results.filter((r) => !r.success)
      failedTemplates.forEach((template, index) => {
        console.log(`   ${index + 1}. ${template.identifier}`)
        console.log(`      └─ Error: ${template.error}`)
      })
    }

    // Performance insights
    console.log(`\n⚡ Performance Insights:`)
    const avgExecutionTime = this.results.reduce((sum, r) => sum + r.executionTime, 0) / total
    const slowestTemplate = this.results.reduce((a, b) =>
      a.executionTime > b.executionTime ? a : b
    )

    console.log(`   Average analysis time: ${avgExecutionTime.toFixed(2)}ms`)
    console.log(
      `   Slowest template: ${slowestTemplate.identifier} (${slowestTemplate.executionTime.toFixed(2)}ms)`
    )

    console.log('\n' + '='.repeat(80))
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce(
      (groups, item) => {
        const value = String(item[key])
        groups[value] = groups[value] || []
        groups[value].push(item)
        return groups
      },
      {} as Record<string, T[]>
    )
  }

  // Export results to JSON for further processing
  async exportResults(filename: string = 'graphql-template-analysis-results.json'): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.length,
        successful: this.results.filter((r) => r.success).length,
        failed: this.results.filter((r) => !r.success).length,
      },
      categories: this.groupBy(this.results, 'category'),
      recommendations: this.groupBy(this.results, 'recommendation'),
      results: this.results,
    }

    await Bun.write(filename, JSON.stringify(report, null, 2))
    console.log(`\n💾 Results exported to ${filename}`)
  }

  // Generate core template list for management system
  generateCoreTemplateList(): string[] {
    return this.results
      .filter((r) => r.recommendation === 'core')
      .sort((a, b) => b.reuseScore - a.reuseScore)
      .map((t) => t.identifier)
  }
}

// Run the analyzer
async function main() {
  const analyzer = new GraphQLTemplateAnalyzer()
  await analyzer.analyze()
  await analyzer.exportResults()

  // Generate core template identifiers for management system
  const coreTemplates = analyzer.generateCoreTemplateList()
  console.log(`\n🎯 Core Template Identifiers (${coreTemplates.length}):`)
  coreTemplates.forEach((id, index) => {
    console.log(`   ${index + 1}. ${id}`)
  })
}

if (import.meta.main) {
  main().catch(console.error)
}

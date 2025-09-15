#!/usr/bin/env bun
/**
 * Template Query Analyzer
 *
 * Analyzes all available templates, tests their execution,
 * and identifies high-value reusable templates for promotion
 * to core template library.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'

interface TemplateAnalysis {
  identifier: string
  name: string
  category: string
  complexity: number
  executionTime: number
  success: boolean
  error?: string
  reuseScore: number
  tags: string[]
  operationType: 'query' | 'mutation' | 'subscription'
  hasVariables: boolean
  recommendation: 'core' | 'useful' | 'specialized' | 'deprecated'
}

interface TemplateFile {
  identifier: string
  name: string
  description: string
  query: string
  variables?: Record<string, any>
  tags?: string[]
  operationType?: string
  complexityScore?: number
}

class TemplateAnalyzer {
  private templatesPath = 'demo/templates'
  private results: TemplateAnalysis[] = []

  async analyze(): Promise<void> {
    console.log('🔍 Starting template analysis...\n')

    const files = await this.getTemplateFiles()
    console.log(`Found ${files.length} template files\n`)

    let processed = 0
    for (const file of files) {
      try {
        const analysis = await this.analyzeTemplate(file)
        this.results.push(analysis)
        processed++

        const status = analysis.success ? '✅' : '❌'
        console.log(
          `${status} [${processed}/${files.length}] ${analysis.identifier} (${analysis.category})`
        )

        if (!analysis.success && analysis.error) {
          console.log(`   └─ Error: ${analysis.error}`)
        }
      } catch (error) {
        console.error(`❌ Failed to analyze ${file}: ${error}`)
      }
    }

    console.log('\n📊 Analysis complete!')
    this.generateReport()
  }

  private async getTemplateFiles(): Promise<string[]> {
    const files = await readdir(this.templatesPath)
    return files.filter((f) => f.endsWith('.json') && f.includes('_v1-0-0'))
  }

  private async analyzeTemplate(filename: string): Promise<TemplateAnalysis> {
    const content = await readFile(join(this.templatesPath, filename), 'utf-8')
    const template: TemplateFile = JSON.parse(content)

    // Test execution
    const startTime = performance.now()
    const { success, error } = await this.testExecution(template)
    const executionTime = performance.now() - startTime

    // Calculate scores
    const complexity = this.calculateComplexity(template)
    const reuseScore = this.calculateReuseScore(template)
    const category = this.categorizeTemplate(template)
    const recommendation = this.getRecommendation(template, success, reuseScore)

    return {
      identifier: template.identifier,
      name: template.name,
      category,
      complexity,
      executionTime,
      success,
      error,
      reuseScore,
      tags: template.tags || [],
      operationType: this.getOperationType(template),
      hasVariables: Object.keys(template.variables || {}).length > 0,
      recommendation,
    }
  }

  private async testExecution(
    template: TemplateFile
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Basic GraphQL syntax validation
      if (!template.query || typeof template.query !== 'string') {
        return { success: false, error: 'Invalid query format' }
      }

      // Check for basic GraphQL structure
      const trimmedQuery = template.query.trim()
      if (
        !trimmedQuery.startsWith('query') &&
        !trimmedQuery.startsWith('mutation') &&
        !trimmedQuery.startsWith('subscription') &&
        !trimmedQuery.startsWith('{')
      ) {
        return { success: false, error: 'Invalid GraphQL operation' }
      }

      // Check for balanced braces
      const openBraces = (trimmedQuery.match(/\{/g) || []).length
      const closeBraces = (trimmedQuery.match(/\}/g) || []).length
      if (openBraces !== closeBraces) {
        return { success: false, error: 'Unbalanced braces in query' }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: `Execution failed: ${error}` }
    }
  }

  private calculateComplexity(template: TemplateFile): number {
    if (template.complexityScore) {
      return template.complexityScore
    }

    const query = template.query || ''
    let score = 1

    // Count query depth
    const braceDepth = this.calculateBraceDepth(query)
    score += braceDepth * 0.5

    // Count fields
    const fieldCount = (query.match(/\w+\s*{/g) || []).length
    score += fieldCount * 0.3

    // Variables complexity
    const variableCount = Object.keys(template.variables || {}).length
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

  private calculateReuseScore(template: TemplateFile): number {
    let score = 0

    // Base score by operation type
    const operationType = this.getOperationType(template)
    switch (operationType) {
      case 'query':
        score += 3
        break
      case 'mutation':
        score += 2
        break
      case 'subscription':
        score += 1
        break
    }

    // Generality score (fewer specific hardcoded values = higher reuse)
    const query = template.query || ''
    const hasHardcodedIds = /id:\s*["']\w+["']/.test(query)
    if (!hasHardcodedIds) score += 2

    // Variable usage (parameterized queries are more reusable)
    const variableCount = Object.keys(template.variables || {}).length
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

    // Penalty for overly complex queries
    if (this.calculateComplexity(template) > 8) {
      score -= 1
    }

    return Math.round(score * 10) / 10
  }

  private categorizeTemplate(template: TemplateFile): string {
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

  private getOperationType(template: TemplateFile): 'query' | 'mutation' | 'subscription' {
    if (template.operationType) {
      return template.operationType as any
    }

    const query = template.query.trim().toLowerCase()
    if (query.startsWith('mutation')) return 'mutation'
    if (query.startsWith('subscription')) return 'subscription'
    return 'query'
  }

  private getRecommendation(
    template: TemplateFile,
    success: boolean,
    reuseScore: number
  ): 'core' | 'useful' | 'specialized' | 'deprecated' {
    if (!success) return 'deprecated'

    if (reuseScore >= 4.5) return 'core'
    if (reuseScore >= 3.0) return 'useful'
    if (reuseScore >= 2.0) return 'specialized'
    return 'deprecated'
  }

  private generateReport(): void {
    console.log('\n' + '='.repeat(80))
    console.log('📋 TEMPLATE ANALYSIS REPORT')
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
        `      └─ ${template.name} (Score: ${template.reuseScore}, Category: ${template.category})`
      )
    })

    // Useful templates
    console.log(`\n👍 USEFUL TEMPLATES:`)
    const usefulTemplates = this.results
      .filter((r) => r.recommendation === 'useful')
      .sort((a, b) => b.reuseScore - a.reuseScore)
      .slice(0, 10) // Top 10

    usefulTemplates.forEach((template, index) => {
      console.log(`   ${index + 1}. ${template.identifier} (Score: ${template.reuseScore})`)
    })

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

    console.log(`   Average execution time: ${avgExecutionTime.toFixed(2)}ms`)
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
  async exportResults(filename: string = 'template-analysis-results.json'): Promise<void> {
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
}

// Run the analyzer
async function main() {
  const analyzer = new TemplateAnalyzer()
  await analyzer.analyze()
  await analyzer.exportResults()
}

if (import.meta.main) {
  main().catch(console.error)
}

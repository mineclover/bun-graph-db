#!/usr/bin/env bun

import { GraphQLClient } from 'graphql-request'
import * as fs from 'fs'
import * as path from 'path'

const client = new GraphQLClient('http://localhost:4000/graphql')

interface QueryInfo {
  name: string
  category: string
  status: 'implemented' | 'not-implemented' | 'error'
  priority: 'high' | 'medium' | 'low'
  file?: string
  description?: string
}

// GraphQL Query 목록과 분류
const QUERY_REGISTRY: QueryInfo[] = [
  // Core System
  { name: 'health', category: 'core', status: 'implemented', priority: 'high', description: 'System health check' },
  
  // Tables
  { name: 'table', category: 'tables', status: 'implemented', priority: 'high', description: 'Get table by ID' },
  { name: 'tableByIdentifier', category: 'tables', status: 'implemented', priority: 'high', description: 'Get table by identifier' },
  { name: 'tables', category: 'tables', status: 'implemented', priority: 'high', description: 'List all tables' },
  
  // Nodes  
  { name: 'node', category: 'nodes', status: 'implemented', priority: 'high', description: 'Get node by ID' },
  { name: 'nodeByContent', category: 'nodes', status: 'implemented', priority: 'medium', description: 'Get node by content' },
  { name: 'nodes', category: 'nodes', status: 'implemented', priority: 'high', description: 'List nodes with pagination' },
  { name: 'searchNodes', category: 'nodes', status: 'implemented', priority: 'high', description: 'Advanced node search' },
  
  // Attributes
  { name: 'attributeType', category: 'attributes', status: 'implemented', priority: 'high', description: 'Get attribute type' },
  { name: 'attributeTypeByIdentifier', category: 'attributes', status: 'implemented', priority: 'medium', description: 'Get attribute type by identifier' },
  { name: 'attributeTypes', category: 'attributes', status: 'implemented', priority: 'high', description: 'List attribute types' },
  { name: 'attribute', category: 'attributes', status: 'implemented', priority: 'medium', description: 'Get attribute by ID' },
  { name: 'attributes', category: 'attributes', status: 'implemented', priority: 'high', description: 'List table attributes' },
  
  // Relations
  { name: 'nodeRelation', category: 'relations', status: 'implemented', priority: 'medium', description: 'Get node relation' },
  { name: 'nodeRelations', category: 'relations', status: 'implemented', priority: 'high', description: 'List node relations' },
  { name: 'relationType', category: 'relations', status: 'implemented', priority: 'medium', description: 'Get relation type' },
  { name: 'relationTypes', category: 'relations', status: 'implemented', priority: 'high', description: 'List relation types' },
  { name: 'searchRelatedNodes', category: 'relations', status: 'implemented', priority: 'high', description: 'Search related nodes' },
  { name: 'findPathsBetweenNodes', category: 'relations', status: 'implemented', priority: 'medium', description: 'Find node paths' },
  { name: 'getDependencyChain', category: 'relations', status: 'implemented', priority: 'medium', description: 'Get dependency chain' },
  
  // Analytics
  { name: 'analyzeNodes', category: 'analytics', status: 'implemented', priority: 'medium', description: 'Node analysis and metrics' },
  { name: 'getPerformanceMetrics', category: 'analytics', status: 'implemented', priority: 'medium', description: 'System performance metrics' },
  { name: 'getSystemHealth', category: 'analytics', status: 'implemented', priority: 'high', description: 'System health analysis' },
  { name: 'getTestSuiteStatus', category: 'analytics', status: 'implemented', priority: 'low', description: 'Test suite status' },
  { name: 'aggregateData', category: 'analytics', status: 'implemented', priority: 'medium', description: 'Data aggregation' },
  
  // Advanced Search
  { name: 'advancedSearch', category: 'search', status: 'implemented', priority: 'medium', description: 'Advanced search capabilities' },
  { name: 'getAlertRules', category: 'search', status: 'implemented', priority: 'low', description: 'Get alert rules' },
  { name: 'getMonitoringMetrics', category: 'search', status: 'implemented', priority: 'low', description: 'Monitoring metrics' },
  { name: 'getSystemStatus', category: 'search', status: 'implemented', priority: 'medium', description: 'System status check' },
  
  // Not Implemented
  { name: 'searchNodesLegacy', category: 'legacy', status: 'not-implemented', priority: 'low', description: 'Legacy search method' },
  { name: 'previewNodeCreation', category: 'special', status: 'not-implemented', priority: 'medium', description: 'Node creation preview' },
  { name: 'exportTable', category: 'export', status: 'not-implemented', priority: 'high', description: 'Export table schema' },
  { name: 'exportAllTables', category: 'export', status: 'not-implemented', priority: 'high', description: 'Export all tables' },
  { name: 'getSearchPerformanceMetrics', category: 'analytics', status: 'not-implemented', priority: 'low', description: 'Search performance analysis' }
]

class QueryManager {
  private queries: QueryInfo[] = QUERY_REGISTRY

  async generateReport(): Promise<void> {
    console.log('\n🔍 GraphQL Query Management Report\n')
    
    const categories = this.groupByCategory()
    const stats = this.calculateStats()
    
    // Print statistics
    console.log('📊 Overall Statistics:')
    console.log(`Total Queries: ${stats.total}`)
    console.log(`Implemented: ${stats.implemented} (${((stats.implemented / stats.total) * 100).toFixed(1)}%)`)
    console.log(`Not Implemented: ${stats.notImplemented}`)
    console.log()
    
    // Print by category
    for (const [category, queries] of Object.entries(categories)) {
      const implemented = queries.filter(q => q.status === 'implemented').length
      const total = queries.length
      const rate = (implemented / total * 100).toFixed(1)
      
      console.log(`📁 ${category.toUpperCase()} (${implemented}/${total} - ${rate}%):`)
      
      queries.forEach(query => {
        const status = query.status === 'implemented' ? '✅' : '❌'
        const priority = query.priority === 'high' ? '🔥' : query.priority === 'medium' ? '🎯' : '📝'
        console.log(`  ${status} ${priority} ${query.name} - ${query.description}`)
      })
      console.log()
    }
    
    // Recommendations
    console.log('🎯 Recommendations:')
    const highPriorityMissing = this.queries.filter(q => q.status === 'not-implemented' && q.priority === 'high')
    const mediumPriorityMissing = this.queries.filter(q => q.status === 'not-implemented' && q.priority === 'medium')
    
    if (highPriorityMissing.length > 0) {
      console.log(`🔥 HIGH PRIORITY - Implement immediately (${highPriorityMissing.length} queries):`)
      highPriorityMissing.forEach(q => console.log(`   - ${q.name}: ${q.description}`))
    }
    
    if (mediumPriorityMissing.length > 0) {
      console.log(`🎯 MEDIUM PRIORITY - Implement next (${mediumPriorityMissing.length} queries):`)
      mediumPriorityMissing.forEach(q => console.log(`   - ${q.name}: ${q.description}`))
    }
    console.log()
  }

  async validateImplementation(): Promise<void> {
    console.log('🔍 Validating Query Implementation...\n')
    
    const testQueries = [
      { name: 'health', query: 'query { health { status } }' },
      { name: 'tables', query: 'query { tables { nodes { id } totalCount } }' },
      { name: 'attributeTypes', query: 'query { attributeTypes { id identifier } }' }
    ]
    
    for (const test of testQueries) {
      try {
        await client.request(test.query)
        console.log(`✅ ${test.name}: Working`)
      } catch (error) {
        console.log(`❌ ${test.name}: Failed - ${error.message.split('\n')[0]}`)
      }
    }
  }

  private groupByCategory(): Record<string, QueryInfo[]> {
    return this.queries.reduce((acc, query) => {
      if (!acc[query.category]) {
        acc[query.category] = []
      }
      acc[query.category].push(query)
      return acc
    }, {} as Record<string, QueryInfo[]>)
  }

  private calculateStats() {
    const implemented = this.queries.filter(q => q.status === 'implemented').length
    const notImplemented = this.queries.filter(q => q.status === 'not-implemented').length
    
    return {
      total: this.queries.length,
      implemented,
      notImplemented
    }
  }

  async generateImplementationPlan(): Promise<void> {
    const missing = this.queries.filter(q => q.status === 'not-implemented')
    
    console.log('📋 Implementation Plan:\n')
    
    const phases = {
      'Phase 1 (High Priority)': missing.filter(q => q.priority === 'high'),
      'Phase 2 (Medium Priority)': missing.filter(q => q.priority === 'medium'),
      'Phase 3 (Low Priority)': missing.filter(q => q.priority === 'low')
    }
    
    for (const [phase, queries] of Object.entries(phases)) {
      if (queries.length > 0) {
        console.log(`🎯 ${phase}:`)
        queries.forEach((q, idx) => {
          console.log(`  ${idx + 1}. ${q.name} (${q.category})`)
          console.log(`     ${q.description}`)
          console.log(`     Estimated effort: ${this.estimateEffort(q)}`)
          console.log()
        })
      }
    }
  }

  private estimateEffort(query: QueryInfo): string {
    if (query.category === 'export') return '2-3 days (Schema export implementation)'
    if (query.category === 'special') return '3-5 days (Complex preview logic)'
    if (query.category === 'legacy') return '1 day (Simple wrapper or removal)'
    return '1-2 days (Standard resolver)'
  }
}

// CLI Interface
const args = process.argv.slice(2)
const command = args[0] || 'report'

const manager = new QueryManager()

switch (command) {
  case 'report':
    await manager.generateReport()
    break
    
  case 'validate':
    await manager.validateImplementation()
    break
    
  case 'plan':
    await manager.generateImplementationPlan()
    break
    
  case 'help':
  default:
    console.log(`
🛠️  GraphQL Query Manager

Usage:
  bun scripts/query-manager.ts [command]

Commands:
  report    Show implementation status report (default)
  validate  Validate key queries are working
  plan      Generate implementation plan
  help      Show this help message

Examples:
  bun scripts/query-manager.ts report
  bun scripts/query-manager.ts validate
  bun scripts/query-manager.ts plan
`)
    break
}
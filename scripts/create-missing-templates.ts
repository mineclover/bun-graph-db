#!/usr/bin/env bun
/**
 * Missing Template Creator
 *
 * 갭 분석 결과를 바탕으로 누락된 템플릿들을 생성합니다.
 */

import { TemplateRegistrationManager } from './template-registration.js'

interface MissingTemplate {
  identifier: string
  name: string
  description: string
  query: string
  tags: string[]
  priority: 'critical' | 'high' | 'medium' | 'low'
  category: string
  variables?: Record<string, any>
}

class MissingTemplateCreator {
  private registrationManager = new TemplateRegistrationManager()

  // 높은 우선순위 템플릿들
  private readonly HIGH_PRIORITY_TEMPLATES: MissingTemplate[] = [
    {
      identifier: 'bulk-data-import',
      name: 'Bulk Data Import',
      description: 'CSV, JSON 등의 파일에서 대량의 노드를 한번에 생성하는 템플릿',
      query: `mutation BulkImport($input: BulkImportInput!) {
  bulkImport(input: $input) {
    success
    processedCount
    totalCount
    errors {
      line
      message
      severity
    }
    progress {
      percentage
      estimatedTimeRemaining
    }
    summary {
      created
      updated
      skipped
      failed
    }
  }
}`,
      tags: ['bulk', 'import', 'data-migration', 'batch-processing'],
      priority: 'high',
      category: 'Data Operations',
      variables: {
        input: {
          format: 'JSON',
          data: [],
          options: {
            skipErrors: true,
            batchSize: 100
          }
        }
      }
    },

    {
      identifier: 'real-time-monitoring',
      name: 'Real-time System Monitoring',
      description: '시스템 성능, 메모리 사용량, 쿼리 성능을 실시간으로 모니터링하는 구독 템플릿',
      query: `subscription SystemMonitoring($metrics: [MetricType!]) {
  systemMetrics(metrics: $metrics) {
    timestamp
    server {
      cpu {
        usage
        loadAverage
        cores
      }
      memory {
        used
        total
        percentage
        available
      }
      disk {
        used
        total
        percentage
      }
    }
    database {
      connections {
        active
        idle
        total
      }
      performance {
        queriesPerSecond
        avgQueryTime
        slowQueries
      }
      storage {
        size
        tables
        indexes
      }
    }
    alerts {
      level
      message
      timestamp
      component
    }
  }
}`,
      tags: ['monitoring', 'real-time', 'performance', 'subscription', 'system'],
      priority: 'high',
      category: 'System Operations',
      variables: {
        metrics: ['CPU', 'MEMORY', 'DATABASE', 'PERFORMANCE']
      }
    }
  ]

  // 중간 우선순위 템플릿들
  private readonly MEDIUM_PRIORITY_TEMPLATES: MissingTemplate[] = [
    {
      identifier: 'data-validation',
      name: 'Data Integrity Validation',
      description: '스키마 규칙 위반, 고아 노드, 중복 데이터 등을 검사하는 데이터 무결성 검증 템플릿',
      query: `query ValidateDataIntegrity($options: ValidationOptions) {
  validateDataIntegrity(options: $options) {
    isValid
    summary {
      totalChecks
      passedChecks
      failedChecks
      warningCount
    }
    issues {
      id
      type
      severity
      message
      affectedNodes {
        id
        table
        title
      }
      recommendation
      fixable
    }
    checks {
      orphanNodes {
        count
        samples {
          id
          table
          title
        }
      }
      duplicateData {
        count
        duplicateGroups {
          hash
          nodes {
            id
            title
          }
        }
      }
      schemaViolations {
        count
        violations {
          rule
          affectedCount
          samples
        }
      }
      brokenRelations {
        count
        samples {
          fromNode
          toNode
          relationType
        }
      }
    }
  }
}`,
      tags: ['validation', 'data-quality', 'integrity', 'schema'],
      priority: 'medium',
      category: 'Data Quality',
      variables: {
        options: {
          includeOrphans: true,
          includeDuplicates: true,
          includeSchemaViolations: true,
          includeBrokenRelations: true,
          sampleSize: 10
        }
      }
    },

    {
      identifier: 'advanced-analytics',
      name: 'Advanced Graph Analytics',
      description: '중심성 분석, 클러스터링, 경로 최적화 등의 고급 그래프 알고리즘 템플릿',
      query: `query GraphAnalytics($analysisType: AnalysisType!, $parameters: AnalysisParameters) {
  graphAnalytics(type: $analysisType, parameters: $parameters) {
    type
    executionTime
    results {
      ... on CentralityAnalysis {
        algorithm
        nodes {
          id
          title
          score
          rank
        }
        statistics {
          min
          max
          average
          median
        }
      }
      ... on ClusteringAnalysis {
        algorithm
        clusters {
          id
          size
          density
          nodes {
            id
            title
          }
          centroids
        }
        modularity
        silhouetteScore
      }
      ... on PathAnalysis {
        algorithm
        paths {
          source
          target
          length
          weight
          nodes {
            id
            title
          }
        }
        statistics {
          shortestPath
          longestPath
          averageLength
        }
      }
    }
    insights {
      keyFindings
      recommendations
      visualizationData
    }
  }
}`,
      tags: ['analytics', 'graph-algorithms', 'centrality', 'clustering', 'pathfinding'],
      priority: 'medium',
      category: 'Analytics',
      variables: {
        analysisType: 'CENTRALITY',
        parameters: {
          algorithm: 'BETWEENNESS',
          nodeFilter: {},
          relationFilter: {}
        }
      }
    },

    {
      identifier: 'data-export',
      name: 'Advanced Data Export',
      description: '다양한 형식(JSON, CSV, GraphML)으로 데이터를 내보내는 고급 내보내기 템플릿',
      query: `mutation ExportData($format: ExportFormat!, $options: ExportOptions!) {
  exportData(format: $format, options: $options) {
    success
    exportId
    format
    downloadUrl
    fileSize
    recordCount
    progress {
      percentage
      stage
      estimatedCompletion
    }
    metadata {
      exportedAt
      schema {
        tables
        relations
        attributes
      }
      statistics {
        nodeCount
        relationCount
        tableCount
      }
    }
    errors {
      message
      severity
      affectedRecords
    }
  }
}`,
      tags: ['export', 'data-transfer', 'formats', 'streaming'],
      priority: 'medium',
      category: 'Data Operations',
      variables: {
        format: 'JSON',
        options: {
          includeSchema: true,
          includeMetadata: true,
          compression: true,
          filter: {
            tables: [],
            dateRange: {}
          },
          streaming: true
        }
      }
    },

    {
      identifier: 'query-optimization',
      name: 'Query Performance Optimization',
      description: '느린 쿼리 식별, 인덱스 제안, 성능 튜닝을 위한 쿼리 최적화 템플릿',
      query: `query OptimizeQueries($options: OptimizationOptions) {
  queryOptimization(options: $options) {
    analysis {
      slowQueries {
        query
        avgExecutionTime
        executionCount
        lastExecuted
        optimization {
          currentPlan
          suggestedPlan
          expectedImprovement
        }
      }
      indexRecommendations {
        table
        columns
        type
        estimatedImprovement
        creationCost
        maintenanceCost
      }
      performanceBottlenecks {
        type
        description
        severity
        impact
        solution
      }
    }
    recommendations {
      immediate {
        action
        description
        expectedGain
        effort
      }
      longTerm {
        action
        description
        expectedGain
        effort
      }
    }
    metrics {
      currentPerformance {
        avgQueryTime
        queriesPerSecond
        cacheHitRate
      }
      projectedPerformance {
        avgQueryTime
        queriesPerSecond
        cacheHitRate
      }
    }
  }
}`,
      tags: ['optimization', 'performance', 'indexing', 'tuning'],
      priority: 'medium',
      category: 'Performance',
      variables: {
        options: {
          analyzeSlowQueries: true,
          suggestIndexes: true,
          includeExecutionPlans: true,
          timePeriod: '7days'
        }
      }
    },

    {
      identifier: 'user-management',
      name: 'User Access Management',
      description: '사용자별 접근 권한 설정 및 관리를 위한 사용자 관리 템플릿',
      query: `mutation ManageUserAccess($action: UserAction!, $input: UserManagementInput!) {
  userManagement(action: $action, input: $input) {
    success
    user {
      id
      username
      email
      roles {
        name
        permissions {
          resource
          actions
        }
      }
      status
      lastLogin
      createdAt
    }
    permissions {
      granted
      revoked
      current {
        tables {
          name
          access
        }
        operations {
          name
          allowed
        }
        features {
          name
          enabled
        }
      }
    }
    auditLog {
      action
      timestamp
      performedBy
      target
      changes
    }
    errors {
      message
      field
      code
    }
  }
}`,
      tags: ['users', 'permissions', 'security', 'access-control', 'roles'],
      priority: 'medium',
      category: 'Security',
      variables: {
        action: 'CREATE_USER',
        input: {
          username: '',
          email: '',
          roles: ['viewer'],
          permissions: {}
        }
      }
    }
  ]

  async createHighPriorityTemplates(): Promise<void> {
    console.log('🚀 Creating high-priority missing templates...\n')

    const results = await this.registrationManager.batchRegister(
      this.HIGH_PRIORITY_TEMPLATES.map(template => ({
        identifier: template.identifier,
        name: template.name,
        description: template.description,
        query: template.query,
        tags: template.tags,
        variables: template.variables,
        priority: template.priority
      }))
    )

    this.reportResults('High Priority', results)
  }

  async createMediumPriorityTemplates(): Promise<void> {
    console.log('📋 Creating medium-priority missing templates...\n')

    const results = await this.registrationManager.batchRegister(
      this.MEDIUM_PRIORITY_TEMPLATES.map(template => ({
        identifier: template.identifier,
        name: template.name,
        description: template.description,
        query: template.query,
        tags: template.tags,
        variables: template.variables,
        priority: template.priority
      }))
    )

    this.reportResults('Medium Priority', results)
  }

  async createAllMissingTemplates(): Promise<void> {
    console.log('🎯 Creating all missing templates based on gap analysis...\n')

    // 높은 우선순위 템플릿 먼저 생성
    await this.createHighPriorityTemplates()
    console.log('\n' + '─'.repeat(60) + '\n')

    // 중간 우선순위 템플릿 생성
    await this.createMediumPriorityTemplates()

    console.log('\n' + '='.repeat(80))
    console.log('✅ All missing templates created successfully!')
    console.log('='.repeat(80))
  }

  private reportResults(category: string, results: any[]): void {
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`📊 ${category} Templates Creation Results:`)
    console.log(`   ✅ Successful: ${successful}`)
    console.log(`   ❌ Failed: ${failed}`)

    if (failed > 0) {
      console.log('\n❌ Failed templates:')
      results.filter(r => !r.success).forEach(result => {
        console.log(`   - ${result.message}`)
        result.errors.forEach((error: string) => {
          console.log(`     └─ ${error}`)
        })
      })
    }
  }

  // 개별 템플릿 생성 메서드들
  async createBulkImportTemplate(): Promise<void> {
    const template = this.HIGH_PRIORITY_TEMPLATES.find(t => t.identifier === 'bulk-data-import')!
    const result = await this.registrationManager.registerTemplate({
      identifier: template.identifier,
      name: template.name,
      description: template.description,
      query: template.query,
      tags: template.tags,
      variables: template.variables,
      priority: template.priority
    })

    console.log(result.success ? '✅ Bulk import template created' : `❌ Failed: ${result.message}`)
  }

  async createMonitoringTemplate(): Promise<void> {
    const template = this.HIGH_PRIORITY_TEMPLATES.find(t => t.identifier === 'real-time-monitoring')!
    const result = await this.registrationManager.registerTemplate({
      identifier: template.identifier,
      name: template.name,
      description: template.description,
      query: template.query,
      tags: template.tags,
      variables: template.variables,
      priority: template.priority
    })

    console.log(result.success ? '✅ Monitoring template created' : `❌ Failed: ${result.message}`)
  }

  // 템플릿 정보 조회
  getTemplateInfo(identifier: string): MissingTemplate | undefined {
    return [...this.HIGH_PRIORITY_TEMPLATES, ...this.MEDIUM_PRIORITY_TEMPLATES]
      .find(t => t.identifier === identifier)
  }

  getAllTemplates(): MissingTemplate[] {
    return [...this.HIGH_PRIORITY_TEMPLATES, ...this.MEDIUM_PRIORITY_TEMPLATES]
  }
}

// CLI 인터페이스
async function main() {
  const creator = new MissingTemplateCreator()
  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case 'all':
      await creator.createAllMissingTemplates()
      break

    case 'high':
      await creator.createHighPriorityTemplates()
      break

    case 'medium':
      await creator.createMediumPriorityTemplates()
      break

    case 'bulk-import':
      await creator.createBulkImportTemplate()
      break

    case 'monitoring':
      await creator.createMonitoringTemplate()
      break

    case 'list':
      console.log('📋 Available missing templates:')
      const templates = creator.getAllTemplates()
      templates.forEach((template, index) => {
        const priorityIcon = template.priority === 'high' ? '⭐' :
                           template.priority === 'medium' ? '👍' : '📝'
        console.log(`   ${priorityIcon} ${index + 1}. ${template.identifier}`)
        console.log(`      Name: ${template.name}`)
        console.log(`      Priority: ${template.priority}`)
        console.log(`      Category: ${template.category}`)
        console.log(`      Tags: ${template.tags.join(', ')}`)
      })
      break

    case 'help':
    default:
      console.log(`
🔧 Missing Template Creator CLI

Usage:
  all           Create all missing templates (high + medium priority)
  high          Create only high-priority templates
  medium        Create only medium-priority templates
  bulk-import   Create bulk data import template
  monitoring    Create real-time monitoring template
  list          List all available missing templates
  help          Show this help

Examples:
  # Create all missing templates
  bun create-missing-templates.ts all

  # Create only high-priority templates
  bun create-missing-templates.ts high

  # List available templates
  bun create-missing-templates.ts list
      `)
      break
  }
}

if (import.meta.main) {
  main().catch(console.error)
}

export { MissingTemplateCreator }
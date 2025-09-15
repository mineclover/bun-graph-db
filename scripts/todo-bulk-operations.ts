#!/usr/bin/env bun
/**
 * Todo Bulk Operations Templates
 *
 * 할일 대량 작업을 위한 템플릿 생성 (import/export, bulk operations)
 */

interface GraphQLResponse {
  data?: any
  errors?: Array<{ message: string }>
}

class TodoBulkOperations {
  private serverUrl = 'http://localhost:4000/graphql'

  async createAllBulkTemplates(): Promise<void> {
    console.log('🎯 Creating Todo Bulk Operations templates...\n')

    // 1. Bulk Import Todos 템플릿
    await this.createBulkImportTemplate()
    console.log()

    // 2. Export Todos 템플릿
    await this.createExportTodosTemplate()
    console.log()

    // 3. Bulk Update Status 템플릿
    await this.createBulkUpdateStatusTemplate()
    console.log()

    // 4. Bulk Complete Todos 템플릿
    await this.createBulkCompleteTemplate()
    console.log()

    // 5. Archive Completed Todos 템플릿
    await this.createArchiveCompletedTemplate()
    console.log()

    // 6. Todo Statistics 템플릿
    await this.createTodoStatsTemplate()
    console.log()

    console.log('✅ All Todo Bulk Operations templates created!')
  }

  private async createBulkImportTemplate(): Promise<void> {
    console.log('📥 Creating "Bulk Import Todos" template...')

    const template = {
      identifier: 'bulk-import-todos',
      name: 'Bulk Import Todos',
      description: 'JSON 형태의 할일 목록을 대량으로 가져오는 템플릿',
      query: `mutation BulkImportTodos($todos: [TodoImportInput!]!) {
  bulkCreateNodes(
    tableId: "58"
    nodes: $todos
  ) {
    success
    createdCount
    totalCount
    errors {
      message
      line
    }
    nodes {
      id
      content
      attributes {
        name
        value
      }
    }
  }
}`,
      tags: ['todo', 'bulk', 'import', 'data'],
      priority: 'high',
      variables: {
        todos: [
          {
            content: "샘플 할일 1",
            attributes: [
              { name: "title", value: "샘플 할일 1" },
              { name: "description", value: "첫 번째 샘플 할일입니다" },
              { name: "status", value: "TODO" },
              { name: "priority", value: "HIGH" },
              { name: "category", value: "WORK" },
              { name: "created_at", value: "{{ now }}" }
            ]
          }
        ]
      }
    }

    const result = await this.registerTemplate(template)
    if (result.success) {
      console.log(`   ✅ Bulk Import Todos template created (ID: ${result.templateId})`)
    } else {
      console.log(`   ❌ Failed: ${result.message}`)
    }
  }

  private async createExportTodosTemplate(): Promise<void> {
    console.log('📤 Creating "Export Todos" template...')

    const template = {
      identifier: 'export-todos',
      name: 'Export Todos',
      description: '할일 목록을 내보내기 위한 조회 템플릿',
      query: `query ExportTodos($status: String, $category: String, $priority: String, $includeCompleted: Boolean = false) {
  exportNodes(
    tableId: "58"
    filters: [
      { attributeName: "status", value: $status }
      { attributeName: "category", value: $category }
      { attributeName: "priority", value: $priority }
    ]
    options: {
      format: "JSON"
      includeMetadata: true
      dateFormat: "ISO"
    }
  ) {
    data {
      id
      content
      createdAt
      attributes {
        name
        value
      }
    }
    metadata {
      exportedAt
      totalCount
      filters
    }
    summary {
      byStatus {
        status
        count
      }
      byCategory {
        category
        count
      }
      byPriority {
        priority
        count
      }
    }
  }
}`,
      tags: ['todo', 'export', 'data', 'analytics'],
      priority: 'high',
      variables: {
        status: '',
        category: '',
        priority: '',
        includeCompleted: false
      }
    }

    const result = await this.registerTemplate(template)
    if (result.success) {
      console.log(`   ✅ Export Todos template created (ID: ${result.templateId})`)
    } else {
      console.log(`   ❌ Failed: ${result.message}`)
    }
  }

  private async createBulkUpdateStatusTemplate(): Promise<void> {
    console.log('🔄 Creating "Bulk Update Status" template...')

    const template = {
      identifier: 'bulk-update-todo-status',
      name: 'Bulk Update Todo Status',
      description: '여러 할일의 상태를 한번에 업데이트하는 템플릿',
      query: `mutation BulkUpdateTodoStatus($todoIds: [ID!]!, $newStatus: String!, $completedAt: String) {
  bulkUpdateNodes(
    nodeIds: $todoIds
    updates: [
      { attributeName: "status", value: $newStatus }
      { attributeName: "completed_at", value: $completedAt }
    ]
  ) {
    success
    updatedCount
    totalCount
    errors {
      message
      nodeId
    }
    nodes {
      id
      content
      attributes {
        name
        value
      }
    }
  }
}`,
      tags: ['todo', 'bulk', 'update', 'status'],
      priority: 'medium',
      variables: {
        todoIds: [],
        newStatus: 'DONE',
        completedAt: '{{ now }}'
      }
    }

    const result = await this.registerTemplate(template)
    if (result.success) {
      console.log(`   ✅ Bulk Update Status template created (ID: ${result.templateId})`)
    } else {
      console.log(`   ❌ Failed: ${result.message}`)
    }
  }

  private async createBulkCompleteTemplate(): Promise<void> {
    console.log('✅ Creating "Bulk Complete Todos" template...')

    const template = {
      identifier: 'bulk-complete-todos',
      name: 'Bulk Complete Todos',
      description: '여러 할일을 한번에 완료 처리하는 템플릿',
      query: `mutation BulkCompleteTodos($todoIds: [ID!]!) {
  bulkUpdateNodes(
    nodeIds: $todoIds
    updates: [
      { attributeName: "status", value: "DONE" }
      { attributeName: "completed_at", value: "{{ now }}" }
    ]
  ) {
    success
    updatedCount
    totalCount
    errors {
      message
      nodeId
    }
    summary {
      previousStatus
      newStatus
      completedCount
    }
  }
}`,
      tags: ['todo', 'bulk', 'complete'],
      priority: 'medium',
      variables: {
        todoIds: []
      }
    }

    const result = await this.registerTemplate(template)
    if (result.success) {
      console.log(`   ✅ Bulk Complete Todos template created (ID: ${result.templateId})`)
    } else {
      console.log(`   ❌ Failed: ${result.message}`)
    }
  }

  private async createArchiveCompletedTemplate(): Promise<void> {
    console.log('📦 Creating "Archive Completed Todos" template...')

    const template = {
      identifier: 'archive-completed-todos',
      name: 'Archive Completed Todos',
      description: '완료된 할일들을 아카이브하는 템플릿',
      query: `mutation ArchiveCompletedTodos($olderThanDays: Int = 30) {
  archiveNodes(
    tableId: "58"
    criteria: {
      attributeFilter: { name: "status", value: "DONE" }
      olderThanDays: $olderThanDays
    }
    options: {
      createBackup: true
      deleteOriginal: false
      archiveFormat: "JSON"
    }
  ) {
    success
    archivedCount
    backupLocation
    errors {
      message
    }
    summary {
      totalCompleted
      archivedTodos
      oldestTodoDate
      newestTodoDate
    }
  }
}`,
      tags: ['todo', 'archive', 'maintenance'],
      priority: 'low',
      variables: {
        olderThanDays: 30
      }
    }

    const result = await this.registerTemplate(template)
    if (result.success) {
      console.log(`   ✅ Archive Completed template created (ID: ${result.templateId})`)
    } else {
      console.log(`   ❌ Failed: ${result.message}`)
    }
  }

  private async createTodoStatsTemplate(): Promise<void> {
    console.log('📊 Creating "Todo Statistics" template...')

    const template = {
      identifier: 'todo-statistics',
      name: 'Todo Statistics',
      description: '할일 통계 및 분석 정보를 제공하는 템플릿',
      query: `query TodoStatistics($dateRange: DateRange, $includeArchived: Boolean = false) {
  nodeStatistics(
    tableId: "58"
    dateRange: $dateRange
    includeArchived: $includeArchived
  ) {
    totalCount
    statusBreakdown {
      TODO: statusCount(status: "TODO")
      IN_PROGRESS: statusCount(status: "IN_PROGRESS")
      DONE: statusCount(status: "DONE")
      CANCELLED: statusCount(status: "CANCELLED")
    }
    priorityBreakdown {
      LOW: priorityCount(priority: "LOW")
      MEDIUM: priorityCount(priority: "MEDIUM")
      HIGH: priorityCount(priority: "HIGH")
      URGENT: priorityCount(priority: "URGENT")
    }
    categoryBreakdown {
      WORK: categoryCount(category: "WORK")
      PERSONAL: categoryCount(category: "PERSONAL")
      SHOPPING: categoryCount(category: "SHOPPING")
      HEALTH: categoryCount(category: "HEALTH")
      LEARNING: categoryCount(category: "LEARNING")
      OTHER: categoryCount(category: "OTHER")
    }
    timingAnalysis {
      overdueTodos: overdueCount
      dueTodayTodos: dueTodayCount
      upcomingTodos: upcomingCount
      averageCompletionTime: avgCompletionDays
    }
    productivity {
      dailyCompletionRate: todosCompletedToday
      weeklyCompletionRate: todosCompletedThisWeek
      monthlyCompletionRate: todosCompletedThisMonth
      completionTrend: completionTrendLastWeeks(weeks: 4)
    }
  }
}`,
      tags: ['todo', 'statistics', 'analytics', 'reporting'],
      priority: 'medium',
      variables: {
        dateRange: {
          start: "{{ date:30_days_ago }}",
          end: "{{ date:today }}"
        },
        includeArchived: false
      }
    }

    const result = await this.registerTemplate(template)
    if (result.success) {
      console.log(`   ✅ Todo Statistics template created (ID: ${result.templateId})`)
    } else {
      console.log(`   ❌ Failed: ${result.message}`)
    }
  }

  private async registerTemplate(template: any): Promise<{ success: boolean, templateId?: string, message?: string }> {
    const mutation = `
      mutation CreateTemplate($input: CreateQueryTemplateInput!) {
        createTemplate(input: $input) {
          success
          template {
            id
            identifier
            name
          }
          errors {
            message
          }
        }
      }
    `

    const variables = {
      input: {
        identifier: template.identifier,
        name: template.name,
        description: template.description,
        query: template.query,
        tags: template.tags,
        complexityScore: this.calculateComplexity(template.query),
        variables: template.variables
      }
    }

    const result = await this.executeGraphQL(mutation, variables)

    if (result.data?.createTemplate?.success) {
      return {
        success: true,
        templateId: result.data.createTemplate.template.id
      }
    } else {
      return {
        success: false,
        message: result.data?.createTemplate?.errors?.[0]?.message || result.errors?.[0]?.message || 'Unknown error'
      }
    }
  }

  private calculateComplexity(query: string): number {
    const complexityKeywords = ['mutation', 'query', 'subscription', 'filter', 'attributes', 'bulk', 'statistics']
    let complexity = Math.min(Math.floor(query.length / 150), 5)

    complexityKeywords.forEach(keyword => {
      if (query.includes(keyword)) complexity += 1
    })

    return Math.min(complexity, 10)
  }

  private async executeGraphQL(query: string, variables?: any): Promise<GraphQLResponse> {
    try {
      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
      })

      return await response.json()
    } catch (error) {
      return { errors: [{ message: `Network error: ${error}` }] }
    }
  }

  async showBulkTemplates(): Promise<void> {
    console.log('\n📊 Todo Bulk Operations Templates Status:')
    console.log('─'.repeat(50))

    const query = `
      query GetBulkTemplates {
        searchTemplates(
          filter: { tags: ["bulk", "todo"] }
          pagination: { limit: 20, offset: 0 }
        ) {
          templates {
            id
            identifier
            name
            description
            tags
            isActive
          }
          totalCount
        }
      }
    `

    const result = await this.executeGraphQL(query)
    const templates = result.data?.searchTemplates?.templates || []

    console.log(`📝 Bulk Operations Templates (${templates.length}):`)
    templates.forEach((template: any) => {
      const status = template.isActive ? '✅' : '❌'
      console.log(`   ${status} ${template.name} (${template.identifier})`)
      console.log(`      ${template.description}`)
    })
  }
}

// CLI 인터페이스
async function main() {
  const bulkOps = new TodoBulkOperations()
  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case 'create':
      await bulkOps.createAllBulkTemplates()
      break
    case 'status':
      await bulkOps.showBulkTemplates()
      break
    default:
      console.log(`
🎯 Todo Bulk Operations CLI

Usage:
  create   Create all bulk operations templates
  status   Show current bulk templates status

Examples:
  bun todo-bulk-operations.ts create
  bun todo-bulk-operations.ts status
      `)
      break
  }
}

if (import.meta.main) {
  main().catch(console.error)
}

export { TodoBulkOperations }
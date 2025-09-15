#!/usr/bin/env bun
/**
 * Todo CRUD Templates
 *
 * 할일 관리를 위한 CRUD 템플릿 생성 및 관리
 */

interface GraphQLResponse {
  data?: any
  errors?: Array<{ message: string }>
}

class TodoTemplates {
  private serverUrl = 'http://localhost:4000/graphql'

  async createAllTodoTemplates(): Promise<void> {
    console.log('🎯 Creating Todo CRUD templates...\n')

    // 1. Create Todo 템플릿
    await this.createTodoTemplate()
    console.log()

    // 2. Get Todo 템플릿
    await this.getTodoTemplate()
    console.log()

    // 3. Update Todo 템플릿
    await this.updateTodoTemplate()
    console.log()

    // 4. Delete Todo 템플릿
    await this.deleteTodoTemplate()
    console.log()

    // 5. List Todos 템플릿
    await this.listTodosTemplate()
    console.log()

    // 6. Search Todos 템플릿
    await this.searchTodosTemplate()
    console.log()

    console.log('✅ All Todo CRUD templates created!')
  }

  private async createTodoTemplate(): Promise<void> {
    console.log('📝 Creating "Create Todo" template...')

    const template = {
      identifier: 'create-todo',
      name: 'Create Todo',
      description: '새로운 할일을 생성하는 템플릿',
      query: `mutation CreateTodo($title: String!, $description: String, $status: String = "TODO", $priority: String = "MEDIUM", $category: String = "PERSONAL", $dueDate: String) {
  createNode(
    tableId: "58"
    content: $title
    attributes: [
      { name: "title", value: $title }
      { name: "description", value: $description }
      { name: "status", value: $status }
      { name: "priority", value: $priority }
      { name: "category", value: $category }
      { name: "due_date", value: $dueDate }
      { name: "created_at", value: "{{ now }}" }
    ]
  ) {
    success
    node {
      id
      content
      attributes {
        name
        value
      }
    }
    errors {
      message
    }
  }
}`,
      tags: ['todo', 'create', 'crud'],
      priority: 'high',
      variables: {
        title: '',
        description: '',
        status: 'TODO',
        priority: 'MEDIUM',
        category: 'PERSONAL',
        dueDate: ''
      }
    }

    const result = await this.registerTemplate(template)
    if (result.success) {
      console.log(`   ✅ Create Todo template created (ID: ${result.templateId})`)
    } else {
      console.log(`   ❌ Failed: ${result.message}`)
    }
  }

  private async getTodoTemplate(): Promise<void> {
    console.log('🔍 Creating "Get Todo" template...')

    const template = {
      identifier: 'get-todo',
      name: 'Get Todo',
      description: '특정 할일을 조회하는 템플릿',
      query: `query GetTodo($todoId: ID!) {
  node(id: $todoId) {
    id
    content
    createdAt
    updatedAt
    attributes {
      name
      value
    }
    table {
      identifier
    }
  }
}`,
      tags: ['todo', 'read', 'crud'],
      priority: 'high',
      variables: {
        todoId: ''
      }
    }

    const result = await this.registerTemplate(template)
    if (result.success) {
      console.log(`   ✅ Get Todo template created (ID: ${result.templateId})`)
    } else {
      console.log(`   ❌ Failed: ${result.message}`)
    }
  }

  private async updateTodoTemplate(): Promise<void> {
    console.log('✏️ Creating "Update Todo" template...')

    const template = {
      identifier: 'update-todo',
      name: 'Update Todo',
      description: '할일을 업데이트하는 템플릿',
      query: `mutation UpdateTodo($todoId: ID!, $title: String, $description: String, $status: String, $priority: String, $category: String, $dueDate: String, $completedAt: String) {
  updateNode(
    id: $todoId
    content: $title
    attributes: [
      { name: "title", value: $title }
      { name: "description", value: $description }
      { name: "status", value: $status }
      { name: "priority", value: $priority }
      { name: "category", value: $category }
      { name: "due_date", value: $dueDate }
      { name: "completed_at", value: $completedAt }
    ]
  ) {
    success
    node {
      id
      content
      attributes {
        name
        value
      }
    }
    errors {
      message
    }
  }
}`,
      tags: ['todo', 'update', 'crud'],
      priority: 'high',
      variables: {
        todoId: '',
        title: '',
        description: '',
        status: '',
        priority: '',
        category: '',
        dueDate: '',
        completedAt: ''
      }
    }

    const result = await this.registerTemplate(template)
    if (result.success) {
      console.log(`   ✅ Update Todo template created (ID: ${result.templateId})`)
    } else {
      console.log(`   ❌ Failed: ${result.message}`)
    }
  }

  private async deleteTodoTemplate(): Promise<void> {
    console.log('🗑️ Creating "Delete Todo" template...')

    const template = {
      identifier: 'delete-todo',
      name: 'Delete Todo',
      description: '할일을 삭제하는 템플릿',
      query: `mutation DeleteTodo($todoId: ID!) {
  deleteNode(id: $todoId) {
    success
    errors {
      message
    }
  }
}`,
      tags: ['todo', 'delete', 'crud'],
      priority: 'medium',
      variables: {
        todoId: ''
      }
    }

    const result = await this.registerTemplate(template)
    if (result.success) {
      console.log(`   ✅ Delete Todo template created (ID: ${result.templateId})`)
    } else {
      console.log(`   ❌ Failed: ${result.message}`)
    }
  }

  private async listTodosTemplate(): Promise<void> {
    console.log('📋 Creating "List Todos" template...')

    const template = {
      identifier: 'list-todos',
      name: 'List Todos',
      description: '모든 할일을 조회하는 템플릿',
      query: `query ListTodos($limit: Int = 20, $offset: Int = 0, $status: String) {
  nodes(
    filter: { tableId: "58", attributeFilter: { name: "status", value: $status } }
    pagination: { limit: $limit, offset: $offset }
  ) {
    nodes {
      id
      content
      createdAt
      attributes {
        name
        value
      }
    }
    totalCount
    hasNextPage
  }
}`,
      tags: ['todo', 'list', 'crud'],
      priority: 'high',
      variables: {
        limit: 20,
        offset: 0,
        status: ''
      }
    }

    const result = await this.registerTemplate(template)
    if (result.success) {
      console.log(`   ✅ List Todos template created (ID: ${result.templateId})`)
    } else {
      console.log(`   ❌ Failed: ${result.message}`)
    }
  }

  private async searchTodosTemplate(): Promise<void> {
    console.log('🔎 Creating "Search Todos" template...')

    const template = {
      identifier: 'search-todos',
      name: 'Search Todos',
      description: '할일을 검색하는 템플릿',
      query: `query SearchTodos($searchTerm: String!, $category: String, $priority: String, $status: String) {
  searchNodes(
    query: $searchTerm
    tableId: "58"
    filters: [
      { attributeName: "category", value: $category }
      { attributeName: "priority", value: $priority }
      { attributeName: "status", value: $status }
    ]
  ) {
    nodes {
      id
      content
      attributes {
        name
        value
      }
      relevanceScore
    }
    totalMatches
  }
}`,
      tags: ['todo', 'search', 'crud'],
      priority: 'medium',
      variables: {
        searchTerm: '',
        category: '',
        priority: '',
        status: ''
      }
    }

    const result = await this.registerTemplate(template)
    if (result.success) {
      console.log(`   ✅ Search Todos template created (ID: ${result.templateId})`)
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
    // Simple complexity calculation based on query length and keywords
    const complexityKeywords = ['mutation', 'query', 'subscription', 'filter', 'attributes']
    let complexity = Math.min(Math.floor(query.length / 100), 5)

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

  async showTodoTemplates(): Promise<void> {
    console.log('\n📊 Todo Templates Status:')
    console.log('─'.repeat(50))

    const query = `
      query GetTodoTemplates {
        searchTemplates(
          filter: { tags: ["todo"] }
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

    console.log(`📝 Todo Templates (${templates.length}):`)
    templates.forEach((template: any) => {
      const status = template.isActive ? '✅' : '❌'
      console.log(`   ${status} ${template.name} (${template.identifier})`)
      console.log(`      ${template.description}`)
    })
  }
}

// CLI 인터페이스
async function main() {
  const todoTemplates = new TodoTemplates()
  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case 'create':
      await todoTemplates.createAllTodoTemplates()
      break
    case 'status':
      await todoTemplates.showTodoTemplates()
      break
    default:
      console.log(`
🎯 Todo Templates CLI

Usage:
  create   Create all todo CRUD templates
  status   Show current todo templates status

Examples:
  bun todo-templates.ts create
  bun todo-templates.ts status
      `)
      break
  }
}

if (import.meta.main) {
  main().catch(console.error)
}

export { TodoTemplates }
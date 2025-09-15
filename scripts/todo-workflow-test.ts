#!/usr/bin/env bun
/**
 * Todo Workflow Test
 *
 * 할일 관리 시스템의 전체 워크플로우를 테스트하는 스크립트
 */

interface GraphQLResponse {
  data?: any
  errors?: Array<{ message: string }>
}

class TodoWorkflowTest {
  private serverUrl = 'http://localhost:4000/graphql'
  private createdTodoIds: string[] = []

  async runCompleteWorkflow(): Promise<void> {
    console.log('🎯 Starting Complete Todo Workflow Test...\n')

    try {
      // 1. 단일 할일 생성 테스트
      await this.testCreateSingleTodo()
      console.log()

      // 2. 할일 조회 테스트
      await this.testGetTodo()
      console.log()

      // 3. 할일 업데이트 테스트
      await this.testUpdateTodo()
      console.log()

      // 4. 할일 목록 조회 테스트
      await this.testListTodos()
      console.log()

      // 5. 할일 검색 테스트
      await this.testSearchTodos()
      console.log()

      // 6. 대량 할일 생성 테스트
      await this.testBulkCreateTodos()
      console.log()

      // 7. 대량 상태 업데이트 테스트
      await this.testBulkUpdateStatus()
      console.log()

      // 8. 할일 통계 조회 테스트
      await this.testTodoStatistics()
      console.log()

      // 9. 할일 내보내기 테스트
      await this.testExportTodos()
      console.log()

      // 10. 정리 작업 (선택사항)
      if (process.argv.includes('--cleanup')) {
        await this.cleanupTestTodos()
        console.log()
      }

      console.log('✅ Complete Todo Workflow Test finished successfully!')
      console.log(`📊 Created ${this.createdTodoIds.length} test todos during workflow`)

    } catch (error) {
      console.error('❌ Workflow test failed:', error)
      throw error
    }
  }

  private async testCreateSingleTodo(): Promise<void> {
    console.log('📝 Testing Create Single Todo...')

    const template = await this.executeTemplate('create-todo', {
      title: '워크플로우 테스트 할일',
      description: '완전한 todo 워크플로우를 테스트하기 위한 할일입니다',
      status: 'TODO',
      priority: 'HIGH',
      category: 'LEARNING',
      dueDate: '2024-12-31'
    })

    if (template.data?.executeTemplate?.success) {
      const result = template.data.executeTemplate.result
      if (result.data?.createNode?.success) {
        const todoId = result.data.createNode.node.id
        this.createdTodoIds.push(todoId)
        console.log(`   ✅ Todo created successfully (ID: ${todoId})`)
        console.log(`      Title: ${result.data.createNode.node.content}`)
      } else {
        console.log(`   ❌ Failed to create todo: ${result.data?.createNode?.errors?.[0]?.message || 'Unknown error'}`)
      }
    } else {
      console.log(`   ❌ Template execution failed: ${template.data?.executeTemplate?.errors?.[0]?.message || 'Unknown error'}`)
    }
  }

  private async testGetTodo(): Promise<void> {
    if (this.createdTodoIds.length === 0) {
      console.log('⚠️ Skipping Get Todo test - no todos created')
      return
    }

    console.log('🔍 Testing Get Todo...')

    const todoId = this.createdTodoIds[0]
    const template = await this.executeTemplate('get-todo', {
      todoId: todoId
    })

    if (template.data?.executeTemplate?.success) {
      const result = template.data.executeTemplate.result
      if (result.data?.node) {
        console.log(`   ✅ Todo retrieved successfully`)
        console.log(`      ID: ${result.data.node.id}`)
        console.log(`      Content: ${result.data.node.content}`)
        console.log(`      Attributes: ${result.data.node.attributes?.length || 0}`)
      } else {
        console.log(`   ❌ Todo not found`)
      }
    } else {
      console.log(`   ❌ Template execution failed`)
    }
  }

  private async testUpdateTodo(): Promise<void> {
    if (this.createdTodoIds.length === 0) {
      console.log('⚠️ Skipping Update Todo test - no todos created')
      return
    }

    console.log('✏️ Testing Update Todo...')

    const todoId = this.createdTodoIds[0]
    const template = await this.executeTemplate('update-todo', {
      todoId: todoId,
      title: '업데이트된 워크플로우 테스트 할일',
      description: '이 할일이 성공적으로 업데이트되었습니다',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM'
    })

    if (template.data?.executeTemplate?.success) {
      const result = template.data.executeTemplate.result
      if (result.data?.updateNode?.success) {
        console.log(`   ✅ Todo updated successfully`)
        console.log(`      New content: ${result.data.updateNode.node.content}`)
      } else {
        console.log(`   ❌ Failed to update todo: ${result.data?.updateNode?.errors?.[0]?.message || 'Unknown error'}`)
      }
    } else {
      console.log(`   ❌ Template execution failed`)
    }
  }

  private async testListTodos(): Promise<void> {
    console.log('📋 Testing List Todos...')

    const template = await this.executeTemplate('list-todos', {
      limit: 10,
      offset: 0,
      status: ''
    })

    if (template.data?.executeTemplate?.success) {
      const result = template.data.executeTemplate.result
      if (result.data?.nodes) {
        const todos = result.data.nodes.nodes || []
        console.log(`   ✅ Retrieved ${todos.length} todos`)
        console.log(`      Total count: ${result.data.nodes.totalCount}`)
        if (todos.length > 0) {
          console.log(`      Sample: ${todos[0].content}`)
        }
      } else {
        console.log(`   ❌ Failed to retrieve todos`)
      }
    } else {
      console.log(`   ❌ Template execution failed`)
    }
  }

  private async testSearchTodos(): Promise<void> {
    console.log('🔎 Testing Search Todos...')

    const template = await this.executeTemplate('search-todos', {
      searchTerm: '워크플로우',
      category: '',
      priority: '',
      status: ''
    })

    if (template.data?.executeTemplate?.success) {
      const result = template.data.executeTemplate.result
      if (result.data?.searchNodes) {
        const todos = result.data.searchNodes.nodes || []
        console.log(`   ✅ Found ${todos.length} matching todos`)
        console.log(`      Total matches: ${result.data.searchNodes.totalMatches}`)
        if (todos.length > 0) {
          console.log(`      Best match: ${todos[0].content} (score: ${todos[0].relevanceScore})`)
        }
      } else {
        console.log(`   ❌ Failed to search todos`)
      }
    } else {
      console.log(`   ❌ Template execution failed`)
    }
  }

  private async testBulkCreateTodos(): Promise<void> {
    console.log('📥 Testing Bulk Create Todos...')

    const bulkTodos = [
      {
        content: "대량 생성 테스트 1",
        attributes: [
          { name: "title", value: "대량 생성 테스트 1" },
          { name: "description", value: "첫 번째 대량 생성 할일" },
          { name: "status", value: "TODO" },
          { name: "priority", value: "LOW" },
          { name: "category", value: "WORK" }
        ]
      },
      {
        content: "대량 생성 테스트 2",
        attributes: [
          { name: "title", value: "대량 생성 테스트 2" },
          { name: "description", value: "두 번째 대량 생성 할일" },
          { name: "status", value: "TODO" },
          { name: "priority", value: "MEDIUM" },
          { name: "category", value: "PERSONAL" }
        ]
      },
      {
        content: "대량 생성 테스트 3",
        attributes: [
          { name: "title", value: "대량 생성 테스트 3" },
          { name: "description", value: "세 번째 대량 생성 할일" },
          { name: "status", value: "TODO" },
          { name: "priority", value: "HIGH" },
          { name: "category", value: "LEARNING" }
        ]
      }
    ]

    const template = await this.executeTemplate('bulk-import-todos', {
      todos: bulkTodos
    })

    if (template.data?.executeTemplate?.success) {
      const result = template.data.executeTemplate.result
      if (result.data?.bulkCreateNodes?.success) {
        const createdCount = result.data.bulkCreateNodes.createdCount
        const nodes = result.data.bulkCreateNodes.nodes || []

        // 생성된 ID들을 추적에 추가
        nodes.forEach((node: any) => {
          if (node.id) this.createdTodoIds.push(node.id)
        })

        console.log(`   ✅ Bulk created ${createdCount} todos successfully`)
        console.log(`      Total processed: ${result.data.bulkCreateNodes.totalCount}`)
      } else {
        console.log(`   ❌ Failed to bulk create todos`)
      }
    } else {
      console.log(`   ❌ Template execution failed`)
    }
  }

  private async testBulkUpdateStatus(): Promise<void> {
    if (this.createdTodoIds.length < 2) {
      console.log('⚠️ Skipping Bulk Update test - insufficient todos created')
      return
    }

    console.log('🔄 Testing Bulk Update Status...')

    // 마지막 2개 할일의 상태를 완료로 변경
    const idsToUpdate = this.createdTodoIds.slice(-2)

    const template = await this.executeTemplate('bulk-update-todo-status', {
      todoIds: idsToUpdate,
      newStatus: 'DONE',
      completedAt: new Date().toISOString()
    })

    if (template.data?.executeTemplate?.success) {
      const result = template.data.executeTemplate.result
      if (result.data?.bulkUpdateNodes?.success) {
        const updatedCount = result.data.bulkUpdateNodes.updatedCount
        console.log(`   ✅ Bulk updated ${updatedCount} todos to DONE status`)
        console.log(`      Total processed: ${result.data.bulkUpdateNodes.totalCount}`)
      } else {
        console.log(`   ❌ Failed to bulk update todos`)
      }
    } else {
      console.log(`   ❌ Template execution failed`)
    }
  }

  private async testTodoStatistics(): Promise<void> {
    console.log('📊 Testing Todo Statistics...')

    const template = await this.executeTemplate('todo-statistics', {
      dateRange: {
        start: "2024-01-01",
        end: "2024-12-31"
      },
      includeArchived: false
    })

    if (template.data?.executeTemplate?.success) {
      const result = template.data.executeTemplate.result
      if (result.data?.nodeStatistics) {
        const stats = result.data.nodeStatistics
        console.log(`   ✅ Statistics retrieved successfully`)
        console.log(`      Total count: ${stats.totalCount}`)
        console.log(`      Status breakdown: ${JSON.stringify(stats.statusBreakdown, null, 2)}`)
        console.log(`      Priority breakdown: ${JSON.stringify(stats.priorityBreakdown, null, 2)}`)
      } else {
        console.log(`   ❌ Failed to retrieve statistics`)
      }
    } else {
      console.log(`   ❌ Template execution failed`)
    }
  }

  private async testExportTodos(): Promise<void> {
    console.log('📤 Testing Export Todos...')

    const template = await this.executeTemplate('export-todos', {
      status: '',
      category: '',
      priority: '',
      includeCompleted: true
    })

    if (template.data?.executeTemplate?.success) {
      const result = template.data.executeTemplate.result
      if (result.data?.exportNodes) {
        const exportData = result.data.exportNodes
        const todoCount = exportData.data?.length || 0
        console.log(`   ✅ Export completed successfully`)
        console.log(`      Exported ${todoCount} todos`)
        console.log(`      Export metadata: ${JSON.stringify(exportData.metadata, null, 2)}`)
        if (exportData.summary) {
          console.log(`      Summary: ${JSON.stringify(exportData.summary, null, 2)}`)
        }
      } else {
        console.log(`   ❌ Failed to export todos`)
      }
    } else {
      console.log(`   ❌ Template execution failed`)
    }
  }

  private async cleanupTestTodos(): Promise<void> {
    console.log('🧹 Cleaning up test todos...')

    let deletedCount = 0
    for (const todoId of this.createdTodoIds) {
      const template = await this.executeTemplate('delete-todo', {
        todoId: todoId
      })

      if (template.data?.executeTemplate?.success) {
        const result = template.data.executeTemplate.result
        if (result.data?.deleteNode?.success) {
          deletedCount++
        }
      }
    }

    console.log(`   ✅ Cleaned up ${deletedCount}/${this.createdTodoIds.length} test todos`)
  }

  private async executeTemplate(identifier: string, variables: any): Promise<GraphQLResponse> {
    const mutation = `
      mutation ExecuteTemplate($identifier: String!, $variables: JSON!) {
        executeTemplate(identifier: $identifier, variables: $variables) {
          success
          result
          errors {
            message
          }
        }
      }
    `

    return await this.executeGraphQL(mutation, {
      identifier,
      variables
    })
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

  async showWorkflowSummary(): Promise<void> {
    console.log('\n📊 Todo Workflow Summary:')
    console.log('─'.repeat(50))

    // 도메인 상태 확인
    console.log('🏗️ Domain Status:')
    const domainCheck = await this.executeGraphQL(`
      query DomainCheck {
        table(id: "58") {
          id
          identifier
          attributes { id name }
          tableNodeCount
        }
      }
    `)

    if (domainCheck.data?.table) {
      const table = domainCheck.data.table
      console.log(`   ✅ Todo table: ${table.identifier} (${table.tableNodeCount} nodes)`)
      console.log(`   ✅ Attributes: ${table.attributes.length}`)
    }

    // 템플릿 상태 확인
    console.log('\n🎯 Templates Status:')
    const templatesCheck = await this.executeGraphQL(`
      query TemplatesCheck {
        searchTemplates(filter: { tags: ["todo"] }) {
          templates { identifier name isActive }
          totalCount
        }
      }
    `)

    if (templatesCheck.data?.searchTemplates) {
      const templates = templatesCheck.data.searchTemplates
      console.log(`   ✅ Todo templates: ${templates.totalCount}`)

      const activeTemplates = templates.templates.filter((t: any) => t.isActive)
      console.log(`   ✅ Active templates: ${activeTemplates.length}`)

      const templateCategories = {
        crud: activeTemplates.filter((t: any) => ['create-todo', 'get-todo', 'update-todo', 'delete-todo', 'list-todos', 'search-todos'].includes(t.identifier)).length,
        bulk: activeTemplates.filter((t: any) => t.identifier.includes('bulk')).length
      }

      console.log(`   📝 CRUD templates: ${templateCategories.crud}/6`)
      console.log(`   📦 Bulk templates: ${templateCategories.bulk}`)
    }

    console.log('\n🎯 Workflow Test Ready!')
    console.log('   Run: bun todo-workflow-test.ts test')
    console.log('   Run with cleanup: bun todo-workflow-test.ts test --cleanup')
  }
}

// CLI 인터페이스
async function main() {
  const workflowTest = new TodoWorkflowTest()
  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case 'test':
      await workflowTest.runCompleteWorkflow()
      break
    case 'summary':
      await workflowTest.showWorkflowSummary()
      break
    default:
      console.log(`
🎯 Todo Workflow Test CLI

Usage:
  test      Run complete todo workflow test
  summary   Show workflow readiness summary

Options:
  --cleanup  Clean up test data after workflow test

Examples:
  bun todo-workflow-test.ts test
  bun todo-workflow-test.ts test --cleanup
  bun todo-workflow-test.ts summary
      `)
      break
  }
}

if (import.meta.main) {
  main().catch(console.error)
}

export { TodoWorkflowTest }
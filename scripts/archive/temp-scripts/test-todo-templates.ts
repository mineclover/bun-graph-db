#!/usr/bin/env bun

/**
 * Todo Templates Testing Script
 *
 * Todo CRUD 템플릿과 Bulk 작업 템플릿을 테스트합니다.
 */

import { executeTemplate } from '../../../utils/executeTemplate.ts'

// 📝 Todo CRUD 템플릿 테스트
async function testTodoCRUDTemplates(): Promise<void> {
  console.log('\n📝 Testing Todo CRUD Templates (6개)')
  console.log('='.repeat(50))

  // 1. create-todo 템플릿
  console.log('\n1. create-todo 템플릿 테스트')
  const createResult = await executeTemplate('create-todo', {
    title: 'GraphQL 템플릿 시스템 완성하기',
    description: 'Todo CRUD와 동적 테이블 템플릿 모두 구현 완료',
    status: 'DONE',
    priority: 'HIGH',
    category: 'WORK',
    dueDate: '2024-12-31'
  })

  let todoId = null
  if (createResult.success) {
    // 결과에서 todoId 추출 시도
    console.log('   Created todo:', JSON.stringify(createResult.data, null, 2))
  }

  // 2. list-todos 템플릿
  console.log('\n2. list-todos 템플릿 테스트')
  const listResult = await executeTemplate('list-todos', {
    limit: 10,
    offset: 0,
    status: null // 모든 상태
  })

  if (listResult.success) {
    console.log('   Found todos:', JSON.stringify(listResult.data, null, 2))
  }

  // 3. search-todos 템플릿
  console.log('\n3. search-todos 템플릿 테스트')
  const searchResult = await executeTemplate('search-todos', {
    searchTerm: 'GraphQL',
    category: 'WORK',
    priority: 'HIGH',
    status: null
  })

  if (searchResult.success) {
    console.log('   Search results:', JSON.stringify(searchResult.data, null, 2))
  }

  // 4. get-todo 템플릿 (예시 ID)
  console.log('\n4. get-todo 템플릿 테스트')
  const getResult = await executeTemplate('get-todo', {
    todoId: '1' // 예시 ID
  })

  if (getResult.success) {
    console.log('   Todo details:', JSON.stringify(getResult.data, null, 2))
  }

  // 5. update-todo 템플릿
  console.log('\n5. update-todo 템플릿 테스트')
  const updateResult = await executeTemplate('update-todo', {
    todoId: '1',
    title: '업데이트된 할일 제목',
    description: '업데이트된 설명',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    category: 'PERSONAL'
  })

  if (updateResult.success) {
    console.log('   Updated todo:', JSON.stringify(updateResult.data, null, 2))
  }

  // 6. delete-todo 템플릿 (테스트용이므로 실제로는 삭제하지 않음)
  console.log('\n6. delete-todo 템플릿 테스트 (스킵 - 안전상 이유)')
  console.log('   ⚠️ 실제 데이터 삭제 방지를 위해 스킵합니다')
}

// 📦 Todo Bulk 작업 템플릿 테스트
async function testTodoBulkTemplates(): Promise<void> {
  console.log('\n📦 Testing Todo Bulk Templates (6개)')
  console.log('='.repeat(50))

  // 1. bulk-import-todos 템플릿
  console.log('\n1. bulk-import-todos 템플릿 테스트')
  const bulkImportResult = await executeTemplate('bulk-import-todos', {
    todos: [
      {
        content: '첫 번째 일괄 할일',
        attributes: [
          { name: 'title', value: '일괄 처리 테스트 1' },
          { name: 'description', value: '대량 가져오기 테스트' },
          { name: 'status', value: 'TODO' },
          { name: 'priority', value: 'MEDIUM' },
          { name: 'category', value: 'WORK' }
        ]
      },
      {
        content: '두 번째 일괄 할일',
        attributes: [
          { name: 'title', value: '일괄 처리 테스트 2' },
          { name: 'description', value: '대량 가져오기 테스트' },
          { name: 'status', value: 'TODO' },
          { name: 'priority', value: 'HIGH' },
          { name: 'category', value: 'PERSONAL' }
        ]
      }
    ]
  })

  if (bulkImportResult.success) {
    console.log('   Bulk import result:', JSON.stringify(bulkImportResult.data, null, 2))
  }

  // 2. export-todos 템플릿
  console.log('\n2. export-todos 템플릿 테스트')
  const exportResult = await executeTemplate('export-todos', {
    status: null, // 모든 상태
    category: 'WORK',
    priority: null,
    includeCompleted: true
  })

  if (exportResult.success) {
    console.log('   Export result:', JSON.stringify(exportResult.data, null, 2))
  }

  // 3. todo-statistics 템플릿
  console.log('\n3. todo-statistics 템플릿 테스트')
  const statsResult = await executeTemplate('todo-statistics', {
    dateRange: {
      start: '2024-01-01',
      end: '2024-12-31'
    },
    includeArchived: false
  })

  if (statsResult.success) {
    console.log('   Statistics:', JSON.stringify(statsResult.data, null, 2))
  }

  // 4. bulk-update-todo-status 템플릿
  console.log('\n4. bulk-update-todo-status 템플릿 테스트')
  const bulkUpdateResult = await executeTemplate('bulk-update-todo-status', {
    todoIds: ['1', '2'], // 예시 IDs
    newStatus: 'IN_PROGRESS',
    completedAt: null
  })

  if (bulkUpdateResult.success) {
    console.log('   Bulk update result:', JSON.stringify(bulkUpdateResult.data, null, 2))
  }

  // 5. bulk-complete-todos 템플릿
  console.log('\n5. bulk-complete-todos 템플릿 테스트')
  const bulkCompleteResult = await executeTemplate('bulk-complete-todos', {
    todoIds: ['1', '2'] // 예시 IDs
  })

  if (bulkCompleteResult.success) {
    console.log('   Bulk complete result:', JSON.stringify(bulkCompleteResult.data, null, 2))
  }

  // 6. archive-completed-todos 템플릿
  console.log('\n6. archive-completed-todos 템플릿 테스트')
  const archiveResult = await executeTemplate('archive-completed-todos', {
    olderThanDays: 30
  })

  if (archiveResult.success) {
    console.log('   Archive result:', JSON.stringify(archiveResult.data, null, 2))
  }
}

// 메인 실행 함수
async function main() {
  console.log('🚀 Todo Templates Testing')
  console.log('='.repeat(50))

  try {
    // 서버 연결 테스트
    console.log('🔍 Testing server connectivity...')
    const connectTest = await executeTemplate('get-system-statistics', {})
    if (connectTest.success) {
      console.log('✅ Server is running')
    } else {
      throw new Error('Server connection failed')
    }

    // Todo CRUD 템플릿 테스트
    await testTodoCRUDTemplates()

    // Todo Bulk 템플릿 테스트
    await testTodoBulkTemplates()

    console.log('\n🎉 All todo template tests completed!')

  } catch (error) {
    console.error('❌ Test execution failed:', error)
    process.exit(1)
  }
}

// 스크립트가 직접 실행될 때만 main 함수 실행
if (import.meta.main) {
  main()
}
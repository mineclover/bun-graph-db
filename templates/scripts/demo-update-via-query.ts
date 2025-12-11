#!/usr/bin/env bun

/**
 * Demo: Update via Query Templates
 *
 * 이 스크립트는 GraphQL 쿼리를 통해 업데이트를 수행하는 방법을 보여줍니다.
 * executeTemplate 뮤테이션을 사용하여 다양한 업데이트 작업을 수행할 수 있습니다.
 */

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql'

// GraphQL 클라이언트 헬퍼
async function executeUpdateTemplate(templateIdentifier: string, variables: any): Promise<any> {
  console.log(`\n🔄 Executing update template: ${templateIdentifier}`)
  console.log(`📥 Variables:`, JSON.stringify(variables, null, 2))

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        mutation ExecuteUpdateTemplate($input: ExecuteQueryTemplateInput!) {
          executeTemplate(input: $input) {
            success
            data
            errors {
              message
              code
            }
          }
        }
      `,
      variables: {
        input: {
          templateIdentifier,
          variables,
        },
      },
    }),
  })

  const result = await response.json()

  if (result.data?.executeTemplate?.success) {
    console.log(`✅ Update successful!`)
    console.log(`📤 Result:`, JSON.stringify(result.data.executeTemplate.data, null, 2))
    return result.data.executeTemplate.data
  } else {
    console.log(`❌ Update failed`)
    console.log(`   Errors:`, result.data?.executeTemplate?.errors || result.errors)
    return null
  }
}

// 데모 시나리오들
async function demoBasicUpdate(): Promise<void> {
  console.log('\n📝 Demo 1: Basic Todo Content Update')
  console.log('='.repeat(50))

  await executeUpdateTemplate('update-todo-content', {
    nodeId: '81',
    newContent: `데모 업데이트 - ${new Date().toLocaleString('ko-KR')}`,
  })
}

async function demoUpdateWithAttributes(): Promise<void> {
  console.log('\n📝 Demo 2: Update Todo with Attributes')
  console.log('='.repeat(50))

  await executeUpdateTemplate('update-todo-with-attributes', {
    nodeId: '81',
    content: `속성 포함 업데이트 - ${new Date().toLocaleString('ko-KR')}`,
    attributeId: '15',
    attributeValue: `새로운 속성 값 - ${Date.now()}`,
  })
}

async function demoTableUpdate(): Promise<void> {
  console.log('\n📝 Demo 3: Update Table Description')
  console.log('='.repeat(50))

  await executeUpdateTemplate('update-table-description', {
    tableId: '101',
    newDescription: `데모용 테이블 설명 - 업데이트 시간: ${new Date().toLocaleString('ko-KR')}`,
  })
}

async function demoBulkUpdate(): Promise<void> {
  console.log('\n📝 Demo 4: Bulk Update Multiple Nodes')
  console.log('='.repeat(50))

  await executeUpdateTemplate('bulk-update-nodes-content', {
    nodeId1: '80',
    nodeId2: '81',
    content1: `일괄 업데이트 노드 1 - ${new Date().toLocaleString('ko-KR')}`,
    content2: `일괄 업데이트 노드 2 - ${new Date().toLocaleString('ko-KR')}`,
  })
}

async function demoValidationUpdate(): Promise<void> {
  console.log('\n📝 Demo 5: Update with Validation')
  console.log('='.repeat(50))

  await executeUpdateTemplate('update-node-with-validation', {
    nodeId: '81',
    newContent: `검증된 업데이트 - ${new Date().toLocaleString('ko-KR')}`,
  })
}

async function demoConditionalUpdate(): Promise<void> {
  console.log('\n📝 Demo 6: Conditional Update')
  console.log('='.repeat(50))

  await executeUpdateTemplate('conditional-update-todo', {
    tableId: '101',
    searchTerm: '업데이트',
    newContent: `조건부 업데이트 결과 - ${new Date().toLocaleString('ko-KR')}`,
  })
}

async function demoHistoryUpdate(): Promise<void> {
  console.log('\n📝 Demo 7: Update with History Tracking')
  console.log('='.repeat(50))

  await executeUpdateTemplate('update-with-history', {
    nodeId: '81',
    newContent: `히스토리 추적 업데이트 - ${new Date().toLocaleString('ko-KR')}`,
  })
}

// 템플릿 기반 업데이트의 장점 설명
function explainBenefits(): void {
  console.log('\n🎯 템플릿 기반 업데이트의 장점:')
  console.log('='.repeat(50))
  console.log('✅ 재사용 가능한 업데이트 패턴')
  console.log('✅ 변수 치환을 통한 동적 업데이트')
  console.log('✅ 복잡한 업데이트 로직을 템플릿으로 캡슐화')
  console.log('✅ 업데이트 전후 상태 추적 가능')
  console.log('✅ 조건부 업데이트 로직 구현')
  console.log('✅ 일괄 업데이트 작업 지원')
  console.log('✅ GraphQL 스키마 검증과 타입 안전성')
  console.log('✅ 템플릿 실행 통계 및 성능 모니터링')
}

// 사용법 가이드
function showUsageGuide(): void {
  console.log('\n📚 사용법 가이드:')
  console.log('='.repeat(50))
  console.log('1. 기본 업데이트:')
  console.log('   executeTemplate(input: {')
  console.log('     templateIdentifier: "update-todo-content"')
  console.log('     variables: { nodeId: "123", newContent: "새 내용" }')
  console.log('   })')
  console.log('')
  console.log('2. 속성 포함 업데이트:')
  console.log('   executeTemplate(input: {')
  console.log('     templateIdentifier: "update-todo-with-attributes"')
  console.log('     variables: { nodeId: "123", content: "내용", attributeId: "456", attributeValue: "값" }')
  console.log('   })')
  console.log('')
  console.log('3. 일괄 업데이트:')
  console.log('   executeTemplate(input: {')
  console.log('     templateIdentifier: "bulk-update-nodes-content"')
  console.log('     variables: { nodeId1: "123", nodeId2: "456", content1: "내용1", content2: "내용2" }')
  console.log('   })')
}

// 메인 데모 실행
async function main() {
  console.log('🚀 GraphQL 템플릿을 통한 업데이트 데모')
  console.log('='.repeat(60))

  try {
    // 서버 연결 테스트
    const healthCheck = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'query { __typename }' }),
    })

    if (!healthCheck.ok) {
      throw new Error('GraphQL 서버에 연결할 수 없습니다.')
    }

    console.log('✅ GraphQL 서버 연결 확인')

    // 데모 시나리오 실행
    await demoBasicUpdate()
    await demoUpdateWithAttributes()
    await demoTableUpdate()
    await demoBulkUpdate()
    await demoValidationUpdate()
    await demoConditionalUpdate()
    await demoHistoryUpdate()

    // 설명 및 가이드
    explainBenefits()
    showUsageGuide()

    console.log('\n🎉 모든 업데이트 데모 완료!')
    console.log('\n💡 이제 GraphQL 쿼리를 통해 다양한 업데이트 작업을 수행할 수 있습니다!')
  } catch (error) {
    console.error('❌ 데모 실행 중 오류 발생:', error)
    process.exit(1)
  }
}

// 스크립트가 직접 실행될 때만 main 함수 실행
if (import.meta.main) {
  main()
}

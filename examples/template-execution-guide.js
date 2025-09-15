#!/usr/bin/env bun

/**
 * executeTemplateWithGraphQL 사용 가이드
 *
 * 이 스크립트는 executeTemplateWithGraphQL 을 사용하여 템플릿을 실행하는
 * 다양한 패턴과 예제를 보여줍니다.
 */

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql'

/**
 * GraphQL 요청을 보내는 유틸리티 함수
 */
async function sendGraphQLRequest(query, variables = {}) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  })

  const result = await response.json()
  return result
}

/**
 * 1. 사용 가능한 모든 템플릿 조회
 * 템플릿 실행 전에 사용 가능한 템플릿 목록을 확인합니다.
 */
async function listAllTemplates() {
  console.log('\n=== 1. 사용 가능한 템플릿 목록 조회 ===')

  const query = `
    query SearchAllTemplates($limit: Int, $offset: Int) {
      searchTemplates(limit: $limit, offset: $offset) {
        nodes {
          identifier
          name
          description
          operationType
          complexityScore
          tags
          isActive
        }
        totalCount
      }
    }
  `

  const result = await sendGraphQLRequest(query, { limit: 10, offset: 0 })

  if (result.errors) {
    console.error('Error:', result.errors)
    return []
  }

  const templates = result.data.searchTemplates.nodes
  console.log(
    `총 ${result.data.searchTemplates.totalCount}개 템플릿 중 ${templates.length}개 조회:`
  )

  templates.forEach((template, index) => {
    console.log(`${index + 1}. ${template.identifier}`)
    console.log(`   이름: ${template.name}`)
    console.log(`   타입: ${template.operationType}`)
    console.log(`   활성: ${template.isActive ? '✅' : '❌'}`)
    console.log(`   복잡도: ${template.complexityScore}/5`)
    console.log('')
  })

  return templates
}

/**
 * 2. 변수 없는 템플릿 실행 (단순 쿼리)
 */
async function executeSimpleTemplate() {
  console.log('\n=== 2. 단순 템플릿 실행 (변수 없음) ===')

  const mutation = `
    mutation ExecuteSimpleTemplate {
      executeTemplateWithGraphQL(templateIdentifier: "test-health-check") {
        success
        data
        errors {
          message
          code
        }
        metadata {
          templateId
          templateName
          executionTime
        }
      }
    }
  `

  const result = await sendGraphQLRequest(mutation)

  if (result.errors) {
    console.error('GraphQL Errors:', result.errors)
    return
  }

  const execution = result.data.executeTemplateWithGraphQL
  console.log(`실행 결과: ${execution.success ? '✅ 성공' : '❌ 실패'}`)
  console.log(`실행 시간: ${execution.metadata?.executionTime}ms`)

  if (execution.success) {
    console.log('응답 데이터:', JSON.stringify(execution.data, null, 2))
  } else {
    console.log('오류:', execution.errors)
  }
}

/**
 * 3. 변수가 있는 템플릿 실행 (페이징)
 */
async function executeTemplateWithVariables() {
  console.log('\n=== 3. 변수가 있는 템플릿 실행 (페이징) ===')

  const mutation = `
    mutation ExecuteTemplateWithVariables($templateId: String!, $variables: JSON) {
      executeTemplateWithGraphQL(
        templateIdentifier: $templateId, 
        variables: $variables
      ) {
        success
        data
        errors {
          message
          code
        }
        metadata {
          templateId
          templateName
          executionTime
        }
      }
    }
  `

  const variables = {
    templateId: 'test-list-tables',
    variables: {
      pagination: {
        limit: 5,
        offset: 0,
      },
    },
  }

  const result = await sendGraphQLRequest(mutation, variables)

  if (result.errors) {
    console.error('GraphQL Errors:', result.errors)
    return
  }

  const execution = result.data.executeTemplateWithGraphQL
  console.log(`실행 결과: ${execution.success ? '✅ 성공' : '❌ 실패'}`)
  console.log(`템플릿: ${execution.metadata?.templateName}`)
  console.log(`실행 시간: ${execution.metadata?.executionTime}ms`)

  if (execution.success && execution.data?.data?.tables) {
    const tables = execution.data.data.tables.nodes
    console.log(`조회된 테이블 수: ${tables.length}`)
    console.log(`전체 테이블 수: ${execution.data.data.tables.totalCount}`)

    tables.forEach((table, index) => {
      console.log(`${index + 1}. ${table.identifier} (ID: ${table.id})`)
    })
  }
}

/**
 * 4. 검색 변수가 있는 템플릿 실행
 */
async function executeSearchTemplate() {
  console.log('\n=== 4. 검색 템플릿 실행 ===')

  const mutation = `
    mutation ExecuteSearchTemplate {
      executeTemplateWithGraphQL(
        templateIdentifier: "test-search-nodes",
        variables: {
          searchFilters: {
            tableId: "1"
          },
          pagination: {
            limit: 3,
            offset: 0
          }
        }
      ) {
        success
        data
        errors {
          message
          code
        }
        metadata {
          templateName
          executionTime
        }
      }
    }
  `

  const result = await sendGraphQLRequest(mutation)

  if (result.errors) {
    console.error('GraphQL Errors:', result.errors)
    return
  }

  const execution = result.data.executeTemplateWithGraphQL
  console.log(`실행 결과: ${execution.success ? '✅ 성공' : '❌ 실패'}`)
  console.log(`실행 시간: ${execution.metadata?.executionTime}ms`)

  if (execution.success && execution.data?.data?.searchNodes) {
    const nodes = execution.data.data.searchNodes.nodes
    console.log(`검색된 노드 수: ${nodes.length}`)

    nodes.forEach((node, index) => {
      console.log(`${index + 1}. ${node.content} (테이블 ID: ${node.tableId})`)
    })
  }
}

/**
 * 5. 뮤테이션 템플릿 실행 (데이터 생성)
 */
async function executeMutationTemplate() {
  console.log('\n=== 5. 뮤테이션 템플릿 실행 (테이블 생성) ===')

  const timestamp = Date.now()
  const mutation = `
    mutation ExecuteCreateTableTemplate {
      executeTemplateWithGraphQL(
        templateIdentifier: "test-create-table",
        variables: {
          input: {
            identifier: "demo_table_${timestamp}",
            description: "Demo table created via executeTemplateWithGraphQL"
          }
        }
      ) {
        success
        data
        errors {
          message
          code
        }
        metadata {
          templateName
          executionTime
        }
      }
    }
  `

  const result = await sendGraphQLRequest(mutation)

  if (result.errors) {
    console.error('GraphQL Errors:', result.errors)
    return
  }

  const execution = result.data.executeTemplateWithGraphQL
  console.log(`실행 결과: ${execution.success ? '✅ 성공' : '❌ 실패'}`)
  console.log(`실행 시간: ${execution.metadata?.executionTime}ms`)

  if (execution.success && execution.data?.data?.createTable) {
    const table = execution.data.data.createTable.table
    console.log(`생성된 테이블: ${table.identifier} (ID: ${table.id})`)
    console.log(`설명: ${table.description}`)
  } else {
    console.log('오류:', execution.errors)
  }
}

/**
 * 6. 오류 처리 예제
 */
async function handleExecutionErrors() {
  console.log('\n=== 6. 오류 처리 예제 ===')

  const mutation = `
    mutation ExecuteNonExistentTemplate {
      executeTemplateWithGraphQL(templateIdentifier: "non-existent-template") {
        success
        data
        errors {
          message
          code
        }
        metadata {
          executionTime
        }
      }
    }
  `

  const result = await sendGraphQLRequest(mutation)

  if (result.errors) {
    console.error('GraphQL Level Errors:', result.errors)
    return
  }

  const execution = result.data.executeTemplateWithGraphQL
  console.log(`실행 결과: ${execution.success ? '✅ 성공' : '❌ 실패'}`)

  if (!execution.success) {
    console.log('실행 오류:')
    execution.errors?.forEach((error, index) => {
      console.log(`${index + 1}. ${error.message} (코드: ${error.code})`)
    })
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🚀 executeTemplateWithGraphQL 사용 가이드 시작')
  console.log(`GraphQL Endpoint: ${GRAPHQL_ENDPOINT}`)

  try {
    // 1. 템플릿 목록 조회
    await listAllTemplates()

    // 2. 단순 템플릿 실행
    await executeSimpleTemplate()

    // 3. 변수가 있는 템플릿 실행
    await executeTemplateWithVariables()

    // 4. 검색 템플릿 실행
    await executeSearchTemplate()

    // 5. 뮤테이션 템플릿 실행
    await executeMutationTemplate()

    // 6. 오류 처리 예제
    await handleExecutionErrors()

    console.log('\n✅ 모든 예제 실행 완료!')
  } catch (error) {
    console.error('❌ 예상치 못한 오류:', error.message)
  }
}

// 스크립트 실행
if (import.meta.main) {
  main()
}

// 개별 함수들을 내보내기 (모듈로 사용할 때)
export {
  listAllTemplates,
  executeSimpleTemplate,
  executeTemplateWithVariables,
  executeSearchTemplate,
  executeMutationTemplate,
  handleExecutionErrors,
  sendGraphQLRequest,
}

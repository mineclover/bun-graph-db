#!/usr/bin/env bun
/**
 * Find Problematic Templates System
 * 실제 존재하는 템플릿들 중에서 런타임 에러를 가진 것들을 식별하고 업데이트
 */

const GRAPHQL_ENDPOINT = 'http://localhost:4141/graphql'

async function executeGraphQLQuery(query: string, variables: any = {}) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })

  return await response.json()
}

// 런타임 로그에서 확인된 실제 문제가 있는 템플릿들의 에러 패턴
const PROBLEMATIC_ERROR_PATTERNS = [
  'Field "identifier" of required type "String!" was not provided',
  'Field "attributeTypeId" of required type "ID!" was not provided',
  'which cannot be used as an input type',
  'is not defined by type',
  'Field "algorithm" is not defined by type "FindPathsInput"',
  'Field "searchTerm" is not defined by type "SearchNodesFilter"',
  'Field "isActive" is not defined by type "TablesFilter"',
]

async function getAllTemplates() {
  const query = `
    query GetAllTemplates($pagination: PaginationInput) {
      searchTemplates(pagination: $pagination) {
        templates {
          id
          identifier
          name
          query
          defaultVariables
          tags
        }
      }
    }
  `

  // 충분히 큰 limit으로 모든 템플릿을 한 번에 가져오기
  const result = await executeGraphQLQuery(query, {
    pagination: {
      limit: 200,
      offset: 0,
    },
  })

  const data = result.data?.searchTemplates
  if (!data || !data.templates) {
    console.warn('⚠️ 템플릿 데이터를 가져올 수 없습니다.')
    return []
  }

  console.log(`📄 템플릿 조회 완료: ${data.templates.length}개`)
  return data.templates
}

async function testTemplate(templateIdentifier: string, maxRetries = 3) {
  let retryCount = 0

  while (retryCount < maxRetries) {
    try {
      const query = `
        mutation TestTemplate($templateId: String!, $vars: JSON) {
          executeTemplateWithGraphQL(
            templateIdentifier: $templateId
            variables: $vars
          ) {
            success
            data
            errors { message }
          }
        }
      `

      const result = await executeGraphQLQuery(query, {
        templateId: templateIdentifier,
        vars: {},
      })

      return {
        success: result.data?.executeTemplateWithGraphQL?.success || false,
        errors: result.data?.executeTemplateWithGraphQL?.errors || [],
        graphqlErrors: result.errors || [],
      }
    } catch (error) {
      retryCount++
      if (retryCount >= maxRetries) {
        return {
          success: false,
          errors: [
            {
              message: `Test failed after ${maxRetries} retries: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          graphqlErrors: [],
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount))
    }
  }
}

function hasProblematicPattern(errors: any[]): boolean {
  const allErrors = errors.map((e) => e.message || e).join(' ')
  return PROBLEMATIC_ERROR_PATTERNS.some((pattern) => allErrors.includes(pattern))
}

async function updateProblematicTemplate(template: any) {
  const identifier = template.identifier

  // 실제 문제 패턴에 따른 수정 전략
  let updatedQuery = template.query
  let updatedVariables = template.defaultVariables

  // create-attribute-with-params 타입 문제 수정
  if (identifier.includes('create-attribute') && template.query.includes('CreateAttributeInput')) {
    updatedQuery = `
      mutation CreateAttributeWithParams($input: CreateAttributeInput!) {
        createAttribute(input: $input) {
          id
          identifier
          name
          description
          attributeTypeId
          tableId
        }
      }
    `
    updatedVariables = JSON.stringify({
      input: {
        identifier: 'new_attribute',
        name: '새 속성',
        description: '새로운 속성입니다',
        tableId: '128',
        attributeTypeId: '1',
      },
    })
  }

  // list-tables-with-filter 타입 문제 수정
  else if (identifier.includes('list-tables-with-filter')) {
    updatedQuery = `
      query ListTablesWithFilter($filter: TablesFilter, $pagination: PaginationInput) {
        findAllTables(filter: $filter, pagination: $pagination) {
          tables {
            id
            identifier
            description
            createdAt
            updatedAt
          }
          pagination {
            total
            limit
            offset
            hasMore
          }
        }
      }
    `
    updatedVariables = JSON.stringify({
      filter: {},
      pagination: {
        limit: 10,
        offset: 0,
      },
    })
  }

  // search-nodes-with-filter searchTerm -> search 수정
  else if (identifier.includes('search-nodes-with-filter')) {
    updatedQuery = template.query.replace(/searchTerm/g, 'search')
    // variables도 searchTerm을 search로 변경
    if (updatedVariables) {
      updatedVariables = updatedVariables.replace(/searchTerm/g, 'search')
    }
  }

  // find-paths-between-nodes algorithm 필드 제거
  else if (identifier.includes('find-paths-between-nodes')) {
    if (updatedVariables) {
      const vars = JSON.parse(updatedVariables)
      if (vars.input && vars.input.algorithm) {
        delete vars.input.algorithm
        updatedVariables = JSON.stringify(vars)
      }
    }
  }

  // universal_metric_entry 필수 변수 추가
  else if (identifier.includes('universal_metric_entry')) {
    updatedVariables = JSON.stringify({
      tableId: '101',
      content: '메트릭 항목',
      metricName: 'response_time',
      metricValue: '150ms',
      timestamp: new Date().toISOString(),
    })
  }

  // 실제 업데이트 실행
  const updateMutation = `
    mutation UpdateTemplate($id: ID!, $input: UpdateTemplateInput!) {
      updateTemplate(id: $id, input: $input) {
        id
        identifier
        name
        query
        defaultVariables
      }
    }
  `

  const updateResult = await executeGraphQLQuery(updateMutation, {
    id: template.id,
    input: {
      query: updatedQuery.trim(),
      defaultVariables: updatedVariables,
    },
  })

  return updateResult.data?.updateTemplate
}

async function main() {
  console.log('🔍 실제 문제있는 템플릿 식별 및 수정 시작\n')

  try {
    // 서버 연결 확인
    const healthCheck = await executeGraphQLQuery(`
      query { healthCheck { status } }
    `)

    if (!healthCheck.data?.healthCheck?.status) {
      console.error('❌ GraphQL 서버에 연결할 수 없습니다.')
      process.exit(1)
    }

    console.log('✅ GraphQL 서버 연결 확인\n')

    // 모든 템플릿 가져오기
    console.log('📋 전체 템플릿 목록 조회 중...')
    const allTemplates = await getAllTemplates()
    console.log(`📊 총 ${allTemplates.length}개 템플릿 발견\n`)

    // 각 템플릿 테스트
    const problematicTemplates = []

    for (const template of allTemplates) {
      console.log(`🧪 테스트 중: ${template.identifier}`)

      const testResult = await testTemplate(template.identifier)

      if (
        !testResult.success ||
        hasProblematicPattern([...testResult.errors, ...testResult.graphqlErrors])
      ) {
        console.log(`  ❌ 문제 발견: ${template.identifier}`)
        problematicTemplates.push({
          template,
          errors: testResult.errors,
          graphqlErrors: testResult.graphqlErrors,
        })
      } else {
        console.log(`  ✅ 정상: ${template.identifier}`)
      }

      // 서버 부하 방지
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    console.log(`\n🔍 문제있는 템플릿 발견: ${problematicTemplates.length}개\n`)

    // 문제있는 템플릿들 수정
    const updateResults = []

    for (const { template, errors, graphqlErrors } of problematicTemplates) {
      console.log(`🔧 수정 중: ${template.identifier}`)

      try {
        const updated = await updateProblematicTemplate(template)

        if (updated) {
          console.log(`  ✅ 수정 완료: ${template.identifier}`)
          updateResults.push({
            identifier: template.identifier,
            status: 'SUCCESS',
            errors: errors.map((e) => e.message || e),
            graphqlErrors: graphqlErrors.map((e) => e.message || e),
          })
        } else {
          console.log(`  ❌ 수정 실패: ${template.identifier}`)
          updateResults.push({
            identifier: template.identifier,
            status: 'FAILED',
            errors: errors.map((e) => e.message || e),
            graphqlErrors: graphqlErrors.map((e) => e.message || e),
          })
        }
      } catch (error) {
        console.log(
          `  ❌ 수정 중 오류: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
        updateResults.push({
          identifier: template.identifier,
          status: 'ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          errors: errors.map((e) => e.message || e),
          graphqlErrors: graphqlErrors.map((e) => e.message || e),
        })
      }

      await new Promise((resolve) => setTimeout(resolve, 300))
    }

    // 결과 요약
    console.log('\n📊 수정 결과 요약:')
    const successful = updateResults.filter((r) => r.status === 'SUCCESS').length
    const failed = updateResults.filter((r) => r.status !== 'SUCCESS').length

    console.log(`✅ 성공: ${successful}개`)
    console.log(`❌ 실패: ${failed}개`)

    if (failed > 0) {
      console.log('\n💥 실패한 템플릿들:')
      updateResults
        .filter((r) => r.status !== 'SUCCESS')
        .forEach((r) => {
          console.log(`  - ${r.identifier}: ${r.message || 'Update failed'}`)
        })
    }

    // 결과 저장
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const resultPath = `./claudedocs/problematic-template-fix-results-${timestamp}.json`
    await Bun.write(resultPath, JSON.stringify(updateResults, null, 2))
    console.log(`\n📋 상세 결과 저장: ${resultPath}`)

    console.log('\n🎉 문제있는 템플릿 수정 완료!')
  } catch (error) {
    console.error('❌ 시스템 오류:', error)
    process.exit(1)
  }
}

// 스크립트 실행
if (import.meta.main) {
  main()
}

export { main as findAndFixProblematicTemplates }

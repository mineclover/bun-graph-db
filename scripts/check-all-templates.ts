#!/usr/bin/env bun
/**
 * Check All 44 Templates System
 * 전체 44개 템플릿의 상태를 확인하고 누락된 템플릿들을 식별
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

// 전체 44개 템플릿 목록 (이전 작업에서 확인된 목록)
const ALL_44_TEMPLATES = [
  'create-table-with-params',
  'create-node-with-params',
  'create-attribute-with-params',
  'update-table-with-params',
  'update-node-with-params',
  'delete-node-with-params',
  'bulk-create-nodes-with-params',
  'list-tables-with-filter',
  'list-nodes-with-filter',
  'list-attributes-with-filter',
  'search-nodes-with-filter',
  'search-templates-with-filter',
  'analyze-table-relationships-with-params',
  'analyze-query-performance-with-params',
  'get-system-health-status',
  'get-table-statistics-enhanced',
  'get-attribute-by-id',
  'get-template-by-identifier',
  'get-detailed-system-metrics',
  'create-table-attribute-schema-fixed',
  'create-table-node-schema-fixed',
  'search-todos-fixed',
  'search-templates-advanced',
  'bulk-create-unique-todos',
  'universal_metric_entry',
  'schedule-maintenance-tasks-with-params',
  'migrate-data-with-params',
  'smart-search-with-params',
  'validate-data-quality-with-params',
  'track-changes-with-params',
  'find-paths-between-nodes-with-params',
  'search-related-nodes-with-params',
  'list-tables-with-pagination',
  'data-validation',
  'query-optimization',
  'real-time-monitoring',
  'template-lifecycle-management',
  'data-export',
  'bulk-data-import',
  'system-health-check_v1-0-0',
  'system-health-check',
  'get-system-health-status',
  'create-template-basic',
  'create-node-advanced',
]

async function getAllTemplatesFromDB() {
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

async function testTemplate(templateIdentifier: string) {
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
    return {
      success: false,
      errors: [
        { message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      ],
      graphqlErrors: [],
    }
  }
}

async function main() {
  console.log('🔍 전체 44개 템플릿 상태 확인 시작\n')

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

    // 데이터베이스에서 템플릿 조회
    console.log('📋 데이터베이스에서 템플릿 조회 중...')
    const dbTemplates = await getAllTemplatesFromDB()
    console.log(`📊 데이터베이스에서 발견된 템플릿: ${dbTemplates.length}개`)

    const dbTemplateIds = new Set(dbTemplates.map((t) => t.identifier))
    console.log('📝 데이터베이스 템플릿:', Array.from(dbTemplateIds).sort())

    console.log(`\n🎯 전체 목표 템플릿: ${ALL_44_TEMPLATES.length}개`)
    console.log('📝 전체 템플릿 목록:', ALL_44_TEMPLATES.sort())

    // 누락된 템플릿 식별
    const missingTemplates = ALL_44_TEMPLATES.filter((template) => !dbTemplateIds.has(template))
    const extraTemplates = Array.from(dbTemplateIds).filter(
      (template) => !ALL_44_TEMPLATES.includes(template)
    )

    console.log(`\n❌ 누락된 템플릿 (${missingTemplates.length}개):`)
    missingTemplates.forEach((template) => console.log(`  - ${template}`))

    if (extraTemplates.length > 0) {
      console.log(`\n➕ 추가 템플릿 (${extraTemplates.length}개):`)
      extraTemplates.forEach((template) => console.log(`  - ${template}`))
    }

    // 데이터베이스에 있는 템플릿들 테스트
    console.log(`\n🧪 데이터베이스 템플릿 테스트 중...`)
    const testResults = []

    for (const template of dbTemplates) {
      console.log(`🧪 테스트 중: ${template.identifier}`)

      const testResult = await testTemplate(template.identifier)

      if (testResult.success) {
        console.log(`  ✅ 정상: ${template.identifier}`)
      } else {
        console.log(`  ❌ 문제 발견: ${template.identifier}`)
        if (testResult.errors.length > 0) {
          console.log(`     에러: ${testResult.errors.map((e) => e.message).join(', ')}`)
        }
      }

      testResults.push({
        identifier: template.identifier,
        success: testResult.success,
        errors: testResult.errors,
        graphqlErrors: testResult.graphqlErrors,
      })

      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // 결과 요약
    console.log('\n📊 상태 요약:')
    console.log(`✅ 데이터베이스에 있는 템플릿: ${dbTemplates.length}개`)
    console.log(`❌ 누락된 템플릿: ${missingTemplates.length}개`)
    console.log(`🧪 테스트 성공: ${testResults.filter((r) => r.success).length}개`)
    console.log(`🚨 테스트 실패: ${testResults.filter((r) => !r.success).length}개`)

    // 결과 저장
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const resultPath = `./claudedocs/all-templates-status-${timestamp}.json`

    const fullReport = {
      summary: {
        totalExpected: ALL_44_TEMPLATES.length,
        foundInDB: dbTemplates.length,
        missing: missingTemplates.length,
        testPassed: testResults.filter((r) => r.success).length,
        testFailed: testResults.filter((r) => !r.success).length,
      },
      missingTemplates,
      extraTemplates,
      dbTemplates: dbTemplates.map((t) => t.identifier),
      testResults,
    }

    await Bun.write(resultPath, JSON.stringify(fullReport, null, 2))
    console.log(`\n📋 상세 결과 저장: ${resultPath}`)

    console.log('\n🎉 전체 템플릿 상태 확인 완료!')
  } catch (error) {
    console.error('❌ 시스템 오류:', error)
    process.exit(1)
  }
}

// 스크립트 실행
if (import.meta.main) {
  main()
}

export { main as checkAllTemplates }

#!/usr/bin/env bun
/**
 * Template Validation Analyzer
 * 템플릿 유효성 분석 시스템 - defaultValue를 사용한 자동 테스트
 */

interface ValidationResult {
  templateId: string
  identifier: string
  name: string
  complexity: number
  status: 'SUCCESS' | 'WARNING' | 'ERROR'
  errorType?: 'SCHEMA_ERROR' | 'DATA_NOT_FOUND' | 'EXECUTION_ERROR'
  message?: string
  executionTime?: number
}

interface TemplateInfo {
  id: string
  identifier: string
  name: string
  complexity_score: number
  default_variables: string
}

const GRAPHQL_ENDPOINT = 'http://localhost:4500/graphql'

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

function classifyError(errorMessage: string, isSuccess: boolean): ValidationResult['status'] {
  if (isSuccess) return 'SUCCESS'

  // ERROR: GraphQL 스키마 문제 (쿼리 자체가 유효하지 않음)
  const schemaErrors = [
    'Syntax Error',
    'expected value of type',
    'which cannot be used as an input type',
    'Field "',
    'is not defined by type',
    'GRAPHQL_PARSE_FAILED',
    'GRAPHQL_EXECUTION_ERROR',
  ]

  if (schemaErrors.some((pattern) => errorMessage.includes(pattern))) {
    return 'ERROR'
  }

  // WARNING: 정상 동작했지만 데이터가 없음 (삭제할 ID가 없다는 등)
  const dataWarnings = ['not found', 'does not exist', 'already exists', 'No data', 'Empty result']

  if (dataWarnings.some((pattern) => errorMessage.includes(pattern))) {
    return 'WARNING'
  }

  // 기타는 ERROR로 분류
  return 'ERROR'
}

function getErrorType(errorMessage: string): ValidationResult['errorType'] {
  if (errorMessage.includes('Syntax Error') || errorMessage.includes('GRAPHQL_PARSE_FAILED')) {
    return 'SCHEMA_ERROR'
  }

  if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
    return 'DATA_NOT_FOUND'
  }

  return 'EXECUTION_ERROR'
}

async function validateTemplate(template: TemplateInfo): Promise<ValidationResult> {
  try {
    // defaultValue를 파싱하여 변수로 사용
    let variables = {}
    try {
      if (template.default_variables && template.default_variables.trim()) {
        variables = JSON.parse(template.default_variables)
      }
    } catch (e) {
      // defaultValue 파싱 실패시 빈 객체 사용
      variables = {}
    }

    const query = `
      mutation($templateId: String!, $vars: JSON) {
        executeTemplateWithGraphQL(
          templateIdentifier: $templateId
          variables: $vars
        ) {
          success
          data
          errors {
            message
          }
        }
      }
    `

    const queryVariables = {
      templateId: template.identifier,
      vars: variables,
    }

    const startTime = Date.now()
    const result = await executeGraphQLQuery(query, queryVariables)
    const executionTime = Date.now() - startTime

    if (result.errors) {
      // GraphQL 자체 에러 (파싱 실패 등)
      const errorMessage = result.errors[0]?.message || 'Unknown GraphQL error'
      return {
        templateId: template.id,
        identifier: template.identifier,
        name: template.name,
        complexity: template.complexity_score,
        status: 'ERROR',
        errorType: 'SCHEMA_ERROR',
        message: errorMessage,
        executionTime,
      }
    }

    const executeResult = result.data?.executeTemplateWithGraphQL
    if (!executeResult) {
      return {
        templateId: template.id,
        identifier: template.identifier,
        name: template.name,
        complexity: template.complexity_score,
        status: 'ERROR',
        errorType: 'EXECUTION_ERROR',
        message: 'No execution result',
        executionTime,
      }
    }

    if (executeResult.success) {
      return {
        templateId: template.id,
        identifier: template.identifier,
        name: template.name,
        complexity: template.complexity_score,
        status: 'SUCCESS',
        executionTime,
      }
    } else {
      // 실행은 되었지만 내부에서 실패
      const errorMessage = executeResult.errors?.[0]?.message || 'Template execution failed'
      const status = classifyError(errorMessage, false)

      return {
        templateId: template.id,
        identifier: template.identifier,
        name: template.name,
        complexity: template.complexity_score,
        status,
        errorType: getErrorType(errorMessage),
        message: errorMessage,
        executionTime,
      }
    }
  } catch (error) {
    return {
      templateId: template.id,
      identifier: template.identifier,
      name: template.name,
      complexity: template.complexity_score,
      status: 'ERROR',
      errorType: 'EXECUTION_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

async function getFixedTemplates(): Promise<TemplateInfo[]> {
  const { Database } = require('bun:sqlite')
  const db = new Database('./data/bun-graph-db.sqlite')

  const templates = db
    .query(`
    SELECT id, identifier, name, complexity_score, default_variables
    FROM templates
    WHERE tags LIKE '%fixed%' AND is_active = 1
    ORDER BY complexity_score DESC
  `)
    .all()

  db.close()
  return templates as TemplateInfo[]
}

function generateReport(results: ValidationResult[]): string {
  const successCount = results.filter((r) => r.status === 'SUCCESS').length
  const warningCount = results.filter((r) => r.status === 'WARNING').length
  const errorCount = results.filter((r) => r.status === 'ERROR').length

  let report = `# 템플릿 유효성 분석 보고서\n\n`
  report += `## 📊 전체 요약\n`
  report += `- **전체 템플릿**: ${results.length}개\n`
  report += `- **✅ 성공**: ${successCount}개 (${((successCount / results.length) * 100).toFixed(1)}%)\n`
  report += `- **⚠️ 경고**: ${warningCount}개 (${((warningCount / results.length) * 100).toFixed(1)}%)\n`
  report += `- **❌ 에러**: ${errorCount}개 (${((errorCount / results.length) * 100).toFixed(1)}%)\n\n`

  // 성공한 템플릿들
  const successResults = results.filter((r) => r.status === 'SUCCESS')
  if (successResults.length > 0) {
    report += `## ✅ 정상 작동 템플릿 (${successResults.length}개)\n\n`
    report += `| 템플릿 | 복잡도 | 실행시간 |\n`
    report += `|--------|--------|----------|\n`
    successResults.forEach((r) => {
      report += `| ${r.identifier} | ${r.complexity} | ${r.executionTime}ms |\n`
    })
    report += `\n`
  }

  // 경고 템플릿들
  const warningResults = results.filter((r) => r.status === 'WARNING')
  if (warningResults.length > 0) {
    report += `## ⚠️ 경고 템플릿 (${warningResults.length}개)\n`
    report += `*정상 실행되지만 데이터 관련 이슈*\n\n`
    report += `| 템플릿 | 복잡도 | 메시지 |\n`
    report += `|--------|--------|---------|\n`
    warningResults.forEach((r) => {
      report += `| ${r.identifier} | ${r.complexity} | ${r.message?.substring(0, 50)}... |\n`
    })
    report += `\n`
  }

  // 에러 템플릿들
  const errorResults = results.filter((r) => r.status === 'ERROR')
  if (errorResults.length > 0) {
    report += `## ❌ 오류 템플릿 (${errorResults.length}개)\n`
    report += `*스키마 불일치 또는 실행 실패*\n\n`

    // 에러 타입별 분류
    const schemaErrors = errorResults.filter((r) => r.errorType === 'SCHEMA_ERROR')
    const executionErrors = errorResults.filter((r) => r.errorType === 'EXECUTION_ERROR')

    if (schemaErrors.length > 0) {
      report += `### 🔴 스키마 오류 (${schemaErrors.length}개)\n`
      report += `| 템플릿 | 복잡도 | 메시지 |\n`
      report += `|--------|--------|---------|\n`
      schemaErrors.forEach((r) => {
        report += `| ${r.identifier} | ${r.complexity} | ${r.message?.substring(0, 50)}... |\n`
      })
      report += `\n`
    }

    if (executionErrors.length > 0) {
      report += `### 🔴 실행 오류 (${executionErrors.length}개)\n`
      report += `| 템플릿 | 복잡도 | 메시지 |\n`
      report += `|--------|--------|---------|\n`
      executionErrors.forEach((r) => {
        report += `| ${r.identifier} | ${r.complexity} | ${r.message?.substring(0, 50)}... |\n`
      })
      report += `\n`
    }
  }

  // 복잡도별 성공률
  const complexityGroups = {
    'Low (1-3)': results.filter((r) => r.complexity <= 3),
    'Medium (4-6)': results.filter((r) => r.complexity >= 4 && r.complexity <= 6),
    'High (7-10)': results.filter((r) => r.complexity >= 7),
  }

  report += `## 📈 복잡도별 성공률\n\n`
  Object.entries(complexityGroups).forEach(([group, templates]) => {
    if (templates.length > 0) {
      const success = templates.filter((t) => t.status === 'SUCCESS').length
      const successRate = ((success / templates.length) * 100).toFixed(1)
      report += `- **${group}**: ${success}/${templates.length} (${successRate}%)\n`
    }
  })

  return report
}

async function main() {
  console.log('🔍 템플릿 유효성 분석 시작...\n')

  try {
    // 서버 연결 확인
    const healthCheck = await executeGraphQLQuery(`
      query { healthCheck { status } }
    `)

    if (!healthCheck.data?.healthCheck?.status) {
      console.error('❌ GraphQL 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.')
      process.exit(1)
    }

    console.log('✅ GraphQL 서버 연결 확인\n')

    // Fixed 템플릿 목록 가져오기
    const templates = await getFixedTemplates()
    console.log(`📋 분석 대상: ${templates.length}개 fixed 템플릿\n`)

    // 각 템플릿 검증
    const results: ValidationResult[] = []
    for (let i = 0; i < templates.length; i++) {
      const template = templates[i]
      console.log(
        `[${i + 1}/${templates.length}] ${template.identifier} (복잡도: ${template.complexity_score})`
      )

      const result = await validateTemplate(template)
      results.push(result)

      const statusEmoji =
        result.status === 'SUCCESS' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌'
      console.log(
        `  ${statusEmoji} ${result.status} ${result.executionTime ? `(${result.executionTime}ms)` : ''}`
      )

      if (result.message) {
        console.log(`     ${result.message.substring(0, 80)}...`)
      }

      // 서버 부하 방지를 위한 짧은 대기
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // 보고서 생성
    const report = generateReport(results)

    // 보고서 저장
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const reportPath = `./claudedocs/template-validation-report-${timestamp}.md`
    await Bun.write(reportPath, report)

    console.log(`\n📄 보고서 저장: ${reportPath}`)
    console.log('\n' + report)

    // JSON 결과도 저장
    const jsonPath = `./claudedocs/template-validation-results-${timestamp}.json`
    await Bun.write(jsonPath, JSON.stringify(results, null, 2))
    console.log(`📊 상세 결과 저장: ${jsonPath}`)
  } catch (error) {
    console.error('❌ 분석 중 오류 발생:', error)
    process.exit(1)
  }
}

// 스크립트 실행
if (import.meta.main) {
  main()
}

export { validateTemplate, classifyError, getErrorType }

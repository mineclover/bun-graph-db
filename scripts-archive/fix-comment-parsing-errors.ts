#!/usr/bin/env bun

/**
 * Fix GraphQL Comment Parsing Errors Script
 *
 * 49개 템플릿에서 발생하는 GraphQL 주석 파싱 에러를 수정하는 스크립트
 * - 주석 라인 제거 또는 이스케이프 처리
 * - GraphQL 쿼리 정리 및 검증
 */

const SERVER_URL = process.env.GRAPHQL_URL || 'http://localhost:4000/graphql'

interface TemplateInfo {
  id: string
  identifier: string
  name: string
  query: string
  operationType: string
}

interface CleanupResult {
  success: boolean
  templateId: string
  templateName: string
  originalQuery: string
  cleanedQuery: string
  error?: string
}

async function main() {
  console.log('🔧 GraphQL 주석 파싱 에러 수정 시작')
  console.log(`📡 서버: ${SERVER_URL}`)

  try {
    // 1. 문제가 있는 템플릿들 조회
    const problematicTemplates = await getProblematicTemplates()
    console.log(`\n🔍 문제 템플릿 발견: ${problematicTemplates.length}개`)

    if (problematicTemplates.length === 0) {
      console.log('✅ 수정이 필요한 템플릿이 없습니다.')
      return
    }

    // 2. 각 템플릿의 쿼리 정리
    console.log('\n🧹 GraphQL 쿼리 정리 시작...')
    const cleanupResults = await cleanupTemplateQueries(problematicTemplates)

    // 3. 정리된 쿼리로 템플릿 업데이트
    console.log('\n📝 템플릿 업데이트 시작...')
    const updateResults = await updateTemplatesWithCleanedQueries(cleanupResults)

    // 4. 결과 요약
    displayResults(cleanupResults, updateResults)

    console.log('\n✅ GraphQL 주석 파싱 에러 수정 완료!')
  } catch (error) {
    console.error('💥 스크립트 실행 중 오류:', error)
    process.exit(1)
  }
}

async function getProblematicTemplates(): Promise<TemplateInfo[]> {
  try {
    const query = `
      query GetAllTemplates {
        searchTemplates(
          pagination: { limit: 200 }
        ) {
          templates {
            id
            identifier
            name
            query
            operationType
          }
        }
      }
    `

    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.errors) {
      throw new Error(`GraphQL 오류: ${JSON.stringify(data.errors)}`)
    }

    const allTemplates = data.data.searchTemplates.templates

    // GraphQL 주석 파싱 문제가 있을 수 있는 템플릿들 필터링
    const problematic = allTemplates.filter((template: TemplateInfo) => {
      const query = template.query
      return (
        query.includes('//') || // 한줄 주석
        query.includes('/*') || // 블록 주석
        query.includes('\\') || // 백슬래시
        query.includes('#') || // 해시 주석
        query.includes('쿼리 내용을 수동으로 확인 필요') // 플레이스홀더 텍스트
      )
    })

    console.log(`  📋 전체 템플릿: ${allTemplates.length}개`)
    console.log(`  ⚠️ 문제 가능성: ${problematic.length}개`)

    return problematic
  } catch (error) {
    console.error('템플릿 조회 실패:', error)
    return []
  }
}

async function cleanupTemplateQueries(templates: TemplateInfo[]): Promise<CleanupResult[]> {
  const results: CleanupResult[] = []

  for (const template of templates) {
    try {
      const cleanedQuery = cleanGraphQLQuery(template.query)

      results.push({
        success: true,
        templateId: template.id,
        templateName: template.name,
        originalQuery: template.query,
        cleanedQuery: cleanedQuery,
      })

      console.log(`  ✅ ${template.name} - 쿼리 정리 완료`)
    } catch (error) {
      results.push({
        success: false,
        templateId: template.id,
        templateName: template.name,
        originalQuery: template.query,
        cleanedQuery: '',
        error: error instanceof Error ? error.message : String(error),
      })

      console.log(`  ❌ ${template.name} - 정리 실패: ${error}`)
    }
  }

  return results
}

function cleanGraphQLQuery(query: string): string {
  // 플레이스홀더 텍스트 처리
  if (query.includes('쿼리 내용을 수동으로 확인 필요')) {
    throw new Error('플레이스홀더 쿼리는 수동 확인 필요')
  }

  let cleaned = query

  // 1. 한줄 주석 제거 (// 부터 줄 끝까지)
  cleaned = cleaned.replace(/\/\/.*$/gm, '')

  // 2. 블록 주석 제거 (/* ... */)
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')

  // 3. 해시 주석 제거 (# 부터 줄 끝까지) - GraphQL에서 # 주석도 지원
  cleaned = cleaned.replace(/#.*$/gm, '')

  // 4. 불필요한 백슬래시 제거 (문자열 내부가 아닌 경우)
  // 주의: 문자열 내부의 이스케이프 문자는 보존
  cleaned = cleaned.replace(/\\(?!["\\/bfnrt])/g, '')

  // 5. 연속된 공백 정리
  cleaned = cleaned.replace(/\s+/g, ' ')

  // 6. 앞뒤 공백 제거
  cleaned = cleaned.trim()

  // 7. 빈 줄 정리
  cleaned = cleaned.replace(/\n\s*\n/g, '\n')

  if (!cleaned || cleaned.length < 10) {
    throw new Error('정리 후 유효하지 않은 쿼리')
  }

  return cleaned
}

async function updateTemplatesWithCleanedQueries(cleanupResults: CleanupResult[]) {
  const updateResults: { success: boolean; templateId: string; error?: string }[] = []

  const successfulCleanups = cleanupResults.filter((result) => result.success)

  for (const cleanup of successfulCleanups) {
    try {
      const mutation = `
        mutation UpdateTemplate($id: ID!, $input: UpdateQueryTemplateInput!) {
          updateTemplate(id: $id, input: $input) {
            success
            errors {
              message
            }
          }
        }
      `

      const input = {
        query: cleanup.cleanedQuery,
      }

      const response = await fetch(SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: mutation,
          variables: { id: cleanup.templateId, input },
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.errors) {
        throw new Error(`GraphQL 오류: ${JSON.stringify(data.errors)}`)
      }

      const result = data.data.updateTemplate

      if (!result.success) {
        throw new Error(`업데이트 실패: ${result.errors?.map((e) => e.message).join(', ')}`)
      }

      updateResults.push({
        success: true,
        templateId: cleanup.templateId,
      })

      console.log(`  ✅ ${cleanup.templateName} - 업데이트 완료`)
    } catch (error) {
      updateResults.push({
        success: false,
        templateId: cleanup.templateId,
        error: error instanceof Error ? error.message : String(error),
      })

      console.log(`  ❌ ${cleanup.templateName} - 업데이트 실패: ${error}`)
    }

    // 요청 간 잠시 대기 (서버 부하 방지)
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return updateResults
}

function displayResults(cleanupResults: CleanupResult[], updateResults: any[]) {
  const successfulCleanups = cleanupResults.filter((r) => r.success)
  const failedCleanups = cleanupResults.filter((r) => !r.success)
  const successfulUpdates = updateResults.filter((r) => r.success)
  const failedUpdates = updateResults.filter((r) => !r.success)

  console.log('\n📊 작업 결과 요약:')
  console.log(`  🧹 쿼리 정리: ${successfulCleanups.length}/${cleanupResults.length}개 성공`)
  console.log(`  📝 템플릿 업데이트: ${successfulUpdates.length}/${updateResults.length}개 성공`)

  if (failedCleanups.length > 0) {
    console.log('\n❌ 쿼리 정리 실패:')
    failedCleanups.forEach((result) => {
      console.log(`  - ${result.templateName}: ${result.error}`)
    })
  }

  if (failedUpdates.length > 0) {
    console.log('\n❌ 업데이트 실패:')
    failedUpdates.forEach((result) => {
      console.log(`  - Template ID ${result.templateId}: ${result.error}`)
    })
  }

  // 정리된 쿼리 예시 몇개 보여주기
  if (successfulCleanups.length > 0) {
    console.log('\n💡 정리 예시 (처음 3개):')
    successfulCleanups.slice(0, 3).forEach((result) => {
      console.log(`\n📝 ${result.templateName}:`)
      console.log(`  원본 길이: ${result.originalQuery.length}자`)
      console.log(`  정리 후: ${result.cleanedQuery.length}자`)
      if (result.originalQuery.length !== result.cleanedQuery.length) {
        console.log(`  절약: ${result.originalQuery.length - result.cleanedQuery.length}자`)
      }
    })
  }
}

// 스크립트 실행
if (import.meta.main) {
  main()
}

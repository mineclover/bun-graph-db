#!/usr/bin/env bun

/**
 * Clean Failed Export Files Script
 *
 * import 실패한 49개 파일들을 정리하는 스크립트
 * - 플레이스홀더 쿼리가 있는 파일들 삭제
 * - 주석 파싱 에러가 있는 파일들의 쿼리 정리
 * - 깨끗한 export 디렉토리 유지
 */

import { promises as fs } from 'node:fs'
import { join } from 'node:path'

const EXPORTED_DIR = join(process.cwd(), 'exported-templates')

// 실패한 파일들 목록 (import 결과에서 추출)
const FAILED_FILES = [
  '00-advanced-system-query-analytics_v1-0-0.json',
  '00-create-new-template-demo-v2_v1-0-0.json',
  '00-create-node-with-attributes-v1-0-0_v1-0-0.json',
  '00-create-relation-between-nodes-v1-0-0_v1-0-0.json',
  '00-create-table-enhanced-demo_v1-0-0.json',
  '00-create-table-working-2025_v1-0-0.json',
  '00-create-table_v1-0-0.json',
  '00-delete-node-cascade-v1-0-0_v1-0-0.json',
  '00-delete-template-by-id_v1-0-0.json',
  '00-export-import-schema-v1-0-0_v1-0-0.json',
  '00-find-paths-between-nodes-v1-0-0_v1-0-0.json',
  '00-get-dependency-chain-v1-0-0_v1-0-0.json',
  '00-get-table-attributes-by-id-imported-1757186589697_v1-0-0.json',
  '00-get-table-detailed-2025_v1-0-0.json',
  '00-get-table-detailed-statistics_v1-0-0.json',
  '00-get-table-enhanced-demo_v1-0-0.json',
  '00-get-table_v1-0-0.json',
  '00-memory-monitoring-detailed-v1-0-0_v1-0-0.json',
  '00-new-template_v1-0-0.json',
  '00-process-memory-analysis-v1-0-0_v1-0-0.json',
  '00-search-by-system-queries_v1-0-0.json',
  '00-search-nodes-advanced-filtering-v1-0-0_v1-0-0.json',
  '00-search-related-nodes-v1-0-0_v1-0-0.json',
  '00-subscribe-node-changes-v1-0-0_v1-0-0.json',
  '00-subscribe-system-health-v1-0-0_v1-0-0.json',
  '00-subscribe-template-execution-stream-v1-0-0_v1-0-0.json',
  '00-system-health-check-v1-0-0_v1-0-0.json',
  '00-system-monitoring-dashboard-v1-0-0_v1-0-0.json',
  '00-system-query-statistics_v1-0-0.json',
  '00-system-statistics-full-v1-0-0_v1-0-0.json',
  '00-test-create-node_v1-0-0.json',
  '00-test-create-table_v1-0-0.json',
  '00-test-get-node_v1-0-0.json',
  '00-test-get-table_v1-0-0.json',
  '00-test-health-check_v1-0-0.json',
  '00-test-health-query_v1-0-0.json',
  '00-test-list-tables_v1-0-0.json',
  '00-test-search-nodes_v1-0-0.json',
  '00-test-system-queries_v1-0-0.json',
  '00-test-testmutation1_v1-0-0.json',
  '00-test-testquery1_v1-0-0.json',
  '00-test-testquery2_v1-0-0.json',
  '00-update-node-content-v1-0-0_v1-0-0.json',
  '00-validation-test-simple_v1-0-0.json',
  '00-validation-test-template-imported-1757183827044_v1-0-0.json',
  '00-validation-test-template_v1-0-0.json',
  '13-create-table_v1-0-0.json',
  '26-get-table-detailed-statistics_v1-0-0.json',
  'all-monitoring-templates.json',
]

interface CleanupResult {
  deleted: string[]
  fixed: string[]
  errors: Array<{ file: string; error: string }>
}

async function main() {
  console.log('🧹 실패한 Export 파일들 정리 시작')
  console.log(`📂 대상 디렉토리: ${EXPORTED_DIR}`)
  console.log(`🎯 정리 대상: ${FAILED_FILES.length}개 파일`)

  try {
    const result = await cleanFailedFiles()
    displayResults(result)

    console.log('\n✅ 실패 파일 정리 완료!')
  } catch (error) {
    console.error('💥 정리 작업 중 오류:', error)
    process.exit(1)
  }
}

async function cleanFailedFiles(): Promise<CleanupResult> {
  const result: CleanupResult = {
    deleted: [],
    fixed: [],
    errors: [],
  }

  console.log('\n🔍 파일들 검사 및 정리 중...')

  for (const filename of FAILED_FILES) {
    const filePath = join(EXPORTED_DIR, filename)

    try {
      // 파일 존재 확인
      try {
        await fs.access(filePath)
      } catch {
        console.log(`  ⚠️ ${filename} - 파일이 존재하지 않음, 건너뜀`)
        continue
      }

      // 파일 내용 읽기
      const fileContent = await fs.readFile(filePath, 'utf8')
      let fileData

      try {
        fileData = JSON.parse(fileContent)
      } catch (_parseError) {
        console.log(`  ❌ ${filename} - JSON 파싱 실패, 삭제`)
        await fs.unlink(filePath)
        result.deleted.push(filename)
        continue
      }

      // 템플릿 데이터 확인
      if (!fileData.template || !fileData.template.query) {
        console.log(`  ❌ ${filename} - 템플릿 데이터 없음, 삭제`)
        await fs.unlink(filePath)
        result.deleted.push(filename)
        continue
      }

      const query = fileData.template.query

      // 플레이스홀더 쿼리 확인
      if (
        query.includes('쿼리 내용을 수동으로 확인 필요') ||
        query.includes('// 쿼리 내용을 수동으로 확인 필요') ||
        query.trim().length < 10
      ) {
        console.log(`  ❌ ${filename} - 플레이스홀더 쿼리, 삭제`)
        await fs.unlink(filePath)
        result.deleted.push(filename)
        continue
      }

      // GraphQL 주석이 있는 경우 정리 시도
      if (query.includes('//') || query.includes('/*') || query.includes('#')) {
        console.log(`  🔧 ${filename} - GraphQL 주석 발견, 정리 시도`)

        const cleanedQuery = cleanGraphQLQuery(query)

        if (cleanedQuery && cleanedQuery.length > 10) {
          // 정리된 쿼리로 업데이트
          fileData.template.query = cleanedQuery

          const updatedContent = JSON.stringify(fileData, null, 2)
          await fs.writeFile(filePath, updatedContent, 'utf8')

          console.log(`  ✅ ${filename} - 쿼리 정리 완료`)
          result.fixed.push(filename)
        } else {
          console.log(`  ❌ ${filename} - 정리 후 유효하지 않은 쿼리, 삭제`)
          await fs.unlink(filePath)
          result.deleted.push(filename)
        }
        continue
      }

      // 기타 파싱 에러가 있는 경우
      console.log(`  ❌ ${filename} - 기타 파싱 에러, 삭제`)
      await fs.unlink(filePath)
      result.deleted.push(filename)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.log(`  💥 ${filename} - 처리 오류: ${errorMsg}`)
      result.errors.push({ file: filename, error: errorMsg })
    }
  }

  return result
}

function cleanGraphQLQuery(query: string): string {
  let cleaned = query

  try {
    // 1. 한줄 주석 제거 (// 부터 줄 끝까지)
    cleaned = cleaned.replace(/\/\/.*$/gm, '')

    // 2. 블록 주석 제거 (/* ... */)
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')

    // 3. 해시 주석 제거 (# 부터 줄 끝까지)
    cleaned = cleaned.replace(/#.*$/gm, '')

    // 4. 불필요한 백슬래시 제거 (문자열 내부가 아닌 경우)
    cleaned = cleaned.replace(/\\(?!["\\/bfnrt])/g, '')

    // 5. 연속된 공백 정리
    cleaned = cleaned.replace(/\s+/g, ' ')

    // 6. 앞뒤 공백 제거
    cleaned = cleaned.trim()

    // 7. 빈 줄 정리
    cleaned = cleaned.replace(/\n\s*\n/g, '\n')

    return cleaned
  } catch (error) {
    console.log(`    ⚠️ 쿼리 정리 중 오류: ${error}`)
    return ''
  }
}

function displayResults(result: CleanupResult) {
  console.log('\n📊 정리 결과 요약:')
  console.log(`  🗑️ 삭제된 파일: ${result.deleted.length}개`)
  console.log(`  🔧 수정된 파일: ${result.fixed.length}개`)
  console.log(`  ❌ 오류 발생: ${result.errors.length}개`)

  if (result.deleted.length > 0) {
    console.log('\n🗑️ 삭제된 파일들:')
    result.deleted.slice(0, 10).forEach((file) => {
      console.log(`  - ${file}`)
    })
    if (result.deleted.length > 10) {
      console.log(`  ... 및 ${result.deleted.length - 10}개 더`)
    }
  }

  if (result.fixed.length > 0) {
    console.log('\n🔧 수정된 파일들:')
    result.fixed.forEach((file) => {
      console.log(`  - ${file}`)
    })
  }

  if (result.errors.length > 0) {
    console.log('\n❌ 오류 발생 파일들:')
    result.errors.forEach(({ file, error }) => {
      console.log(`  - ${file}: ${error}`)
    })
  }

  const totalProcessed = result.deleted.length + result.fixed.length + result.errors.length
  console.log(`\n📈 전체 처리: ${totalProcessed}/${FAILED_FILES.length}개 파일`)

  // 남은 파일 개수 예상
  const estimatedRemaining = 198 - result.deleted.length
  console.log(`📁 정리 후 예상 파일 개수: ${estimatedRemaining}개`)
}

// 스크립트 실행
if (import.meta.main) {
  main()
}

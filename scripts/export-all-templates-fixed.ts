#!/usr/bin/env bun

/**
 * Fixed Templates Export Script
 *
 * 'fixed' 카테고리/태그가 있는 템플릿만 개별 JSON 파일로 export하는 스크립트
 * - fixed 태그가 있는 템플릿만 선별적으로 export
 * - 검증된 템플릿들만 export하여 품질 보장
 * - import 가능한 형태로 JSON 파일 생성
 */

import { promises as fs } from 'node:fs'
import { join } from 'node:path'

interface FullTemplate {
  id: string
  identifier: string
  name: string
  description: string
  query: string
  queryName: string[]
  operationType: string
  variables: any
  variablesSchema: any
  defaultVariables: any
  applicableTables: string[]
  complexityScore: number
  version: string
  tags: string[]
  isActive: boolean
  usageCount: number
  avgExecutionTimeMs: number
  lastUsedAt: string | null
}

interface ExportTemplate {
  version: string
  exportedAt: string
  template: FullTemplate
}

interface ExportResult {
  success: boolean
  filename?: string
  template?: FullTemplate
  error?: string
}

const SERVER_URL = process.env.GRAPHQL_URL || 'http://localhost:4000/graphql'
const OUTPUT_DIR = join(process.cwd(), 'exported-templates')

async function main() {
  console.log('🚀 Fixed 카테고리 템플릿 Export 시작')
  console.log(`📡 서버: ${SERVER_URL}`)
  console.log(`📂 출력 디렉토리: ${OUTPUT_DIR}`)

  try {
    // 1. 출력 디렉토리 정리 및 생성
    await cleanAndEnsureOutputDirectory()

    // 2. 모든 템플릿 목록 가져오기
    console.log('\n📋 모든 템플릿 목록 조회 중...')
    const allTemplates = await getAllTemplatesDetailed()
    console.log(`✅ 총 ${allTemplates.length}개 템플릿 발견`)

    // 3. fixed 태그가 있는 템플릿만 필터링
    const fixedTemplates = allTemplates.filter(
      (template) => template.tags?.includes('fixed')
    )
    console.log(`🎯 Fixed 카테고리 템플릿: ${fixedTemplates.length}개`)

    if (fixedTemplates.length === 0) {
      console.log('⚠️ Fixed 태그가 있는 템플릿이 없습니다.')
      return
    }

    // 4. 사용량별 정렬
    fixedTemplates.sort((a, b) => b.usageCount - a.usageCount)

    // 5. Fixed 템플릿 Export
    console.log('\n📤 Fixed 템플릿 Export 시작...')
    const results = await exportAllTemplatesFixed(fixedTemplates)

    // 6. 결과 요약
    displayResults(results, fixedTemplates)

    // 7. 인덱스 파일 생성
    await generateIndexFile(results)

    console.log('\n🎉 Fixed 템플릿 Export 완료!')
  } catch (error) {
    console.error('💥 Export 실행 중 오류:', error)
    process.exit(1)
  }
}

async function cleanAndEnsureOutputDirectory() {
  try {
    // 디렉토리가 존재하면 삭제
    await fs.access(OUTPUT_DIR)
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true })
    console.log(`🗑️ 기존 출력 디렉토리 삭제: ${OUTPUT_DIR}`)
  } catch {
    // 디렉토리가 없으면 무시
  }

  // 새로 디렉토리 생성
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  console.log(`📁 출력 디렉토리 생성: ${OUTPUT_DIR}`)
}

async function getAllTemplatesDetailed(): Promise<FullTemplate[]> {
  const query = `
    query GetAllTemplatesDetailed {
      getPopularTemplates(limit: 200) {
        id
        identifier
        name
        description
        query
        queryName
        operationType
        variables
        variablesSchema
        defaultVariables
        applicableTables
        complexityScore
        version
        tags
        isActive
        usageCount
        avgExecutionTimeMs
        lastUsedAt
      }
    }
  `

  const response = await fetch(SERVER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()

  if (data.errors) {
    throw new Error(`GraphQL 오류: ${JSON.stringify(data.errors)}`)
  }

  return data.data.getPopularTemplates || []
}

async function exportAllTemplatesFixed(templates: FullTemplate[]): Promise<ExportResult[]> {
  const results: ExportResult[] = []
  const batchSize = 5 // 동시 처리 개수

  for (let i = 0; i < templates.length; i += batchSize) {
    const batch = templates.slice(i, i + batchSize)
    console.log(
      `\n📦 배치 ${Math.floor(i / batchSize) + 1}/${Math.ceil(templates.length / batchSize)} 처리 중... (${i + 1}-${Math.min(i + batchSize, templates.length)}/${templates.length})`
    )

    // 배치 단위로 병렬 처리 (순위 번호 제거)
    const batchPromises = batch.map((template) => exportSingleTemplateFixed(template))
    const batchResults = await Promise.allSettled(batchPromises)

    // 결과 처리
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j]
      const template = batch[j]

      if (result.status === 'fulfilled') {
        results.push(result.value)
        const status = result.value.success ? '✅' : '❌'
        console.log(`  ${status} ${template.identifier} (사용${template.usageCount}회)`)
      } else {
        results.push({
          success: false,
          template,
          error: result.reason?.message || '알 수 없는 오류',
        })
        console.log(`  ❌ ${template.identifier} - ${result.reason?.message}`)
      }
    }

    // 배치 간 잠시 대기 (서버 부하 방지)
    if (i + batchSize < templates.length) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  return results
}

async function exportSingleTemplateFixed(template: FullTemplate): Promise<ExportResult> {
  try {
    // 1. Export 형태의 JSON 데이터 생성
    const exportData: ExportTemplate = {
      version: template.version || '1.0.0',
      exportedAt: new Date().toISOString(),
      template: {
        ...template,
        // GraphQL enum값을 소문자로 변환 (import 호환성을 위해)
        operationType: template.operationType.toLowerCase(),
        // statistics 필드를 기존 export 형태에 맞게 조정
        statistics: {
          usageCount: template.usageCount,
          avgExecutionTimeMs: template.avgExecutionTimeMs,
          lastUsedAt: template.lastUsedAt,
        },
      },
    }

    // 2. 파일명 생성 (번호 없이)
    const cleanIdentifier = template.identifier.replace(/[^a-zA-Z0-9-]/g, '-')
    const version = template.version || '1.0.0'
    const versionSuffix = version.replace(/\./g, '-')
    const targetFile = `${cleanIdentifier}_v${versionSuffix}.json`
    const targetPath = join(OUTPUT_DIR, targetFile)

    // 3. 파일 저장
    await fs.writeFile(targetPath, JSON.stringify(exportData, null, 2))

    return {
      success: true,
      filename: targetFile,
      template,
    }
  } catch (error) {
    return {
      success: false,
      template,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function _getPriority(usageCount: number): string {
  if (usageCount >= 50) return 'HIGH'
  if (usageCount >= 10) return 'MEDIUM'
  return 'LOW'
}

function getCategory(template: FullTemplate): string {
  const query = template.query?.toLowerCase() || ''
  const name = template.name?.toLowerCase() || ''
  const identifier = template.identifier?.toLowerCase() || ''

  if (query.includes('health') || name.includes('health')) return 'system'
  if (query.includes('table') || name.includes('table')) return 'table'
  if (query.includes('node') || name.includes('node')) return 'node'
  if (query.includes('mutation') || template.operationType === 'mutation') return 'mutation'
  if (query.includes('relation') || name.includes('relation')) return 'relation'
  if (query.includes('attribute') || name.includes('attribute')) return 'attribute'
  if (identifier.includes('test')) return 'test'
  if (query.includes('subscription') || template.operationType === 'subscription')
    return 'subscription'

  return 'general'
}

function displayResults(results: ExportResult[], templates: FullTemplate[]) {
  const successful = results.filter((r) => r.success)
  const failed = results.filter((r) => !r.success)

  console.log('\n📊 Export 결과 요약:')
  console.log(`  ✅ 성공: ${successful.length}개`)
  console.log(`  ❌ 실패: ${failed.length}개`)
  console.log(`  📈 전체: ${results.length}개 템플릿`)

  if (failed.length > 0) {
    console.log('\n❌ 실패한 템플릿들:')
    failed.forEach((result) => {
      console.log(`  - ${result.template?.identifier}: ${result.error}`)
    })
  }

  // 사용량별 분포
  const highUsage = templates.filter((t) => t.usageCount >= 50).length
  const mediumUsage = templates.filter((t) => t.usageCount >= 10 && t.usageCount < 50).length
  const lowUsage = templates.filter((t) => t.usageCount < 10).length

  console.log('\n📈 사용량 분포:')
  console.log(`  🔥 HIGH (50+ 회): ${highUsage}개`)
  console.log(`  🔧 MEDIUM (10-49회): ${mediumUsage}개`)
  console.log(`  🔍 LOW (<10회): ${lowUsage}개`)
}

async function generateIndexFile(results: ExportResult[]) {
  console.log('\n📋 인덱스 파일 생성 중...')

  const successful = results.filter((r) => r.success)
  const indexContent = `# Fixed 카테고리 템플릿 Export 결과

**생성일**: ${new Date().toISOString()}
**Fixed 템플릿 수**: ${successful.length}개
**Export 성공**: ${successful.length}개

## Fixed 템플릿 목록 (사용량 순)

| 파일명 | 템플릿명 | 사용횟수 | 카테고리 | 운영타입 |
|--------|----------|----------|----------|----------|
${successful
  .map((result) => {
    const template = result.template!
    const category = getCategory(template)
    return `| \`${result.filename}\` | ${template.name} | ${template.usageCount}회 | ${category} | ${template.operationType} |`
  })
  .join('\n')}

## 카테고리별 분포

${(() => {
  const categories = successful.reduce(
    (acc, result) => {
      const category = getCategory(result.template!)
      acc[category] = (acc[category] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return Object.entries(categories)
    .sort(([, a], [, b]) => b - a)
    .map(([category, count]) => `- **${category}**: ${count}개`)
    .join('\n')
})()}

## 사용 방법

각 JSON 파일은 완전한 Fixed 템플릿 정보를 포함하고 있습니다:
- ✅ 완전한 GraphQL 쿼리/뮤테이션
- ✅ 변수 스키마 및 기본값
- ✅ 메타데이터 및 태그 (fixed 태그 포함)
- ✅ 사용량 통계
- ✅ Import 호환 형태

\`\`\`bash
# 개별 Fixed 템플릿 import
bun run scripts/template-import.ts exported-templates/template-name.json

# 전체 Fixed 템플릿 import
bun run scripts/import-all-exported.ts
\`\`\`

## Fixed 카테고리란?

Fixed 카테고리는 검증되고 안정적인 템플릿들을 의미합니다:
- 🔍 충분히 테스트된 템플릿
- ✅ 품질이 보장된 템플릿
- 🚀 프로덕션 환경에서 사용 가능한 템플릿

---
*자동 생성됨 by export-all-templates-fixed.ts*
`

  const indexPath = join(OUTPUT_DIR, 'INDEX.md')
  await fs.writeFile(indexPath, indexContent)
  console.log(`✅ 인덱스 파일 생성: ${indexPath}`)
}

// 스크립트 실행
if (import.meta.main) {
  main()
}

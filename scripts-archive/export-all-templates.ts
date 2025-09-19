#!/usr/bin/env bun

/**
 * All Templates Export Script
 *
 * 시스템에 등록된 모든 템플릿을 개별 JSON 파일로 자동 export하는 스크립트
 */

import { promises as fs } from 'node:fs'
import { join } from 'node:path'

interface Template {
  id: string
  identifier: string
  name: string
  usageCount: number
  isActive: boolean
}

interface ExportResult {
  success: boolean
  filename?: string
  template?: Template
  error?: string
}

const SERVER_URL = process.env.GRAPHQL_URL || 'http://localhost:4000/graphql'
const OUTPUT_DIR = join(process.cwd(), 'exported-templates')

async function main() {
  console.log('🚀 모든 템플릿 자동 Export 시작')
  console.log(`📡 서버: ${SERVER_URL}`)
  console.log(`📂 출력 디렉토리: ${OUTPUT_DIR}`)

  try {
    // 1. 출력 디렉토리 생성
    await ensureOutputDirectory()

    // 2. 모든 템플릿 목록 가져오기
    console.log('\n📋 모든 템플릿 목록 조회 중...')
    const templates = await getAllTemplates()
    console.log(`✅ 총 ${templates.length}개 템플릿 발견`)

    // 3. 사용량별 정렬
    templates.sort((a, b) => b.usageCount - a.usageCount)

    // 4. 모든 템플릿 Export
    console.log('\n📤 모든 템플릿 Export 시작...')
    const results = await exportAllTemplates(templates)

    // 5. 결과 요약
    displayResults(results, templates)

    // 6. 인덱스 파일 생성
    await generateIndexFile(results)

    console.log('\n🎉 모든 템플릿 Export 완료!')
  } catch (error) {
    console.error('💥 Export 실행 중 오류:', error)
    process.exit(1)
  }
}

async function ensureOutputDirectory() {
  try {
    await fs.access(OUTPUT_DIR)
    console.log(`📁 출력 디렉토리 확인: ${OUTPUT_DIR}`)
  } catch {
    await fs.mkdir(OUTPUT_DIR, { recursive: true })
    console.log(`📁 출력 디렉토리 생성: ${OUTPUT_DIR}`)
  }
}

async function getAllTemplates(): Promise<Template[]> {
  const query = `
    query GetAllTemplates {
      getPopularTemplates(limit: 200) {
        id
        identifier
        name
        usageCount
        isActive
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

async function exportAllTemplates(templates: Template[]): Promise<ExportResult[]> {
  const results: ExportResult[] = []
  const batchSize = 5 // 동시 처리 개수

  for (let i = 0; i < templates.length; i += batchSize) {
    const batch = templates.slice(i, i + batchSize)
    console.log(
      `\n📦 배치 ${Math.floor(i / batchSize) + 1}/${Math.ceil(templates.length / batchSize)} 처리 중... (${i + 1}-${Math.min(i + batchSize, templates.length)}/${templates.length})`
    )

    // 배치 단위로 병렬 처리
    const batchPromises = batch.map((template) => exportSingleTemplate(template))
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

async function exportSingleTemplate(template: Template): Promise<ExportResult> {
  try {
    // 1. GraphQL export 실행
    const exportQuery = `
      mutation ExportTemplate($templateId: ID!) {
        exportTemplate(templateId: $templateId) {
          success
          filename
          errors {
            message
          }
        }
      }
    `

    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: exportQuery,
        variables: { templateId: template.id },
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.errors) {
      throw new Error(`GraphQL 오류: ${JSON.stringify(data.errors)}`)
    }

    const exportResult = data.data.exportTemplate

    if (!exportResult.success) {
      throw new Error(`Export 실패: ${exportResult.errors?.map((e) => e.message).join(', ')}`)
    }

    // 2. 파일을 대상 디렉토리로 복사 및 메타데이터 추가
    const sourceFile = join(process.cwd(), 'demo', 'templates', exportResult.filename)
    const targetFile = await copyAndEnhanceTemplate(sourceFile, template)

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

async function copyAndEnhanceTemplate(sourceFile: string, template: Template): Promise<string> {
  try {
    // 원본 파일 읽기
    const originalContent = await fs.readFile(sourceFile, 'utf8')
    const originalData = JSON.parse(originalContent)

    // 메타데이터 추가 및 개선
    const enhancedData = {
      ...originalData,
      exportedAt: new Date().toISOString(),
      template: {
        ...originalData.template,
        isActive: template.isActive,
        usageStats: {
          usageCount: template.usageCount,
          priority: getPriority(template.usageCount),
          category: getCategory(originalData.template),
          notes: generateNotes(originalData.template, template),
        },
      },
    }

    // 파일명 생성 (사용량 순위 기반)
    const rank = String(templates.findIndex((t) => t.id === template.id) + 1).padStart(2, '0')
    const cleanIdentifier = template.identifier.replace(/[^a-zA-Z0-9-]/g, '-')
    const version = originalData.template.version || '1.0.0'
    const versionSuffix = version.replace(/\./g, '-')
    const targetFile = `${rank}-${cleanIdentifier}_v${versionSuffix}.json`
    const targetPath = join(OUTPUT_DIR, targetFile)

    // 개선된 내용으로 저장
    await fs.writeFile(targetPath, JSON.stringify(enhancedData, null, 2))

    return targetFile
  } catch (_error) {
    // 원본 파일이 없는 경우 기본 구조로 생성
    const basicData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      template: {
        identifier: template.identifier,
        name: template.name,
        description: `자동 생성된 템플릿 (ID: ${template.id})`,
        query: '// 쿼리 내용을 수동으로 확인 필요',
        operationType: 'query',
        complexityScore: 1,
        version: '1.0.0',
        tags: ['exported'],
        isActive: template.isActive,
        usageStats: {
          usageCount: template.usageCount,
          priority: getPriority(template.usageCount),
          category: 'unknown',
          notes: '⚠️ 원본 파일을 찾을 수 없어 기본 구조로 생성됨',
        },
      },
    }

    const rank = String(templates.findIndex((t) => t.id === template.id) + 1).padStart(2, '0')
    const cleanIdentifier = template.identifier.replace(/[^a-zA-Z0-9-]/g, '-')
    const targetFile = `${rank}-${cleanIdentifier}_v1-0-0.json`
    const targetPath = join(OUTPUT_DIR, targetFile)

    await fs.writeFile(targetPath, JSON.stringify(basicData, null, 2))

    return targetFile
  }
}

function getPriority(usageCount: number): string {
  if (usageCount >= 50) return 'HIGH'
  if (usageCount >= 10) return 'MEDIUM'
  return 'LOW'
}

function getCategory(template: any): string {
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

  return 'general'
}

function generateNotes(template: any, templateMeta: Template): string {
  const notes: string[] = []

  // 운영 타입 검증
  if (template.query?.includes('mutation') && template.operationType !== 'mutation') {
    notes.push('⚠️ operationType이 잘못 분류됨')
  }

  // 설명 부족
  if (!template.description) {
    notes.push('📝 설명 추가 필요')
  }

  // 테스트 템플릿
  if (template.identifier?.includes('test')) {
    notes.push('🔧 테스트용 템플릿')
  }

  // 사용량 기반 평가
  if (templateMeta.usageCount > 50) {
    notes.push('✅ 고사용량 핵심 템플릿')
  } else if (templateMeta.usageCount === 0) {
    notes.push('💤 미사용 템플릿')
  }

  return notes.length > 0 ? notes.join(', ') : '✅ 정상 템플릿'
}

function displayResults(results: ExportResult[], templates: Template[]) {
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
  const indexContent = `# 전체 템플릿 Export 결과

**생성일**: ${new Date().toISOString()}
**총 템플릿 수**: ${successful.length}개
**Export 성공**: ${successful.length}개

## 템플릿 목록 (사용량 순)

| 순위 | 파일명 | 템플릿명 | 사용횟수 | 카테고리 |
|------|--------|----------|----------|----------|
${successful
  .map((result, index) => {
    const template = result.template!
    const rank = index + 1
    return `| ${rank} | \`${result.filename}\` | ${template.name} | ${template.usageCount}회 | ${getCategory({ identifier: template.identifier, name: template.name })} |`
  })
  .join('\n')}

## 사용 방법

각 JSON 파일은 완전한 템플릿 정보를 포함하고 있습니다:
- GraphQL 쿼리/뮤테이션
- 변수 스키마
- 사용량 통계
- 메타데이터

\`\`\`bash
# 템플릿 가져오기 예시
curl -X POST -H "Content-Type: application/json" \\
  -d @01-template-name.json \\
  http://localhost:4000/graphql/import
\`\`\`

---
*자동 생성됨 by export-all-templates.ts*
`

  const indexPath = join(OUTPUT_DIR, 'INDEX.md')
  await fs.writeFile(indexPath, indexContent)
  console.log(`✅ 인덱스 파일 생성: ${indexPath}`)
}

// 전역 변수로 템플릿 목록 저장 (순위 계산용)
const templates: Template[] = []

// 스크립트 실행
if (import.meta.main) {
  main()
}

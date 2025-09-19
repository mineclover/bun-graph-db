#!/usr/bin/env bun

/**
 * Simple Fixed Templates Export Script
 * Direct SQLite access to export fixed templates with descriptions
 */

import { promises as fs } from 'node:fs'
import { join } from 'node:path'

const OUTPUT_DIR = join(process.cwd(), 'exported-templates')
const DB_PATH = 'data/bun-graph-db.sqlite'

async function main() {
  console.log('🚀 Simple Fixed 템플릿 Export 시작')
  console.log(`📂 출력 디렉토리: ${OUTPUT_DIR}`)
  console.log(`📁 데이터베이스: ${DB_PATH}`)

  try {
    // 1. 출력 디렉토리 정리 및 생성
    await cleanAndEnsureOutputDirectory()

    // 2. SQLite에서 직접 템플릿 조회
    const fixedTemplates = await getFixedTemplatesFromDB()
    console.log(`🎯 Fixed 템플릿: ${fixedTemplates.length}개`)

    if (fixedTemplates.length === 0) {
      console.log('⚠️ Fixed 태그가 있는 템플릿이 없습니다.')
      return
    }

    // 3. 템플릿 export
    let exported = 0
    let failed = 0

    for (const template of fixedTemplates) {
      try {
        await exportSingleTemplate(template)
        console.log(`✅ ${template.identifier} (${template.description || '설명 없음'})`)
        exported++
      } catch (error) {
        console.log(`❌ ${template.identifier}: ${error}`)
        failed++
      }
    }

    // 4. INDEX.md 생성
    await generateIndexFile(fixedTemplates)

    console.log(`\n📊 Export 완료:`)
    console.log(`  ✅ 성공: ${exported}개`)
    console.log(`  ❌ 실패: ${failed}개`)
    console.log(`\n🎉 Fixed 템플릿 Export 완료!`)
  } catch (error) {
    console.error('💥 Export 실행 중 오류:', error)
    process.exit(1)
  }
}

async function cleanAndEnsureOutputDirectory() {
  try {
    await fs.access(OUTPUT_DIR)
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true })
    console.log(`🗑️ 기존 출력 디렉토리 삭제: ${OUTPUT_DIR}`)
  } catch {
    // 디렉토리가 없으면 무시
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  console.log(`📁 출력 디렉토리 생성: ${OUTPUT_DIR}`)
}

async function getFixedTemplatesFromDB() {
  const { Database } = require('bun:sqlite')
  const db = new Database(DB_PATH)

  const query = `
    SELECT
      id, identifier, name, description, query_text,
      default_variables, operation_type, tags, version,
      usage_count, is_active, created_at, updated_at
    FROM templates
    WHERE is_active = 1 AND tags LIKE '%fixed%'
    ORDER BY usage_count DESC, identifier
  `

  const rows = db.query(query).all()
  db.close()

  return rows.map((row: any) => ({
    id: row.id,
    identifier: row.identifier,
    name: row.name,
    description: row.description,
    query: row.query_text,
    variables: row.default_variables ? JSON.parse(row.default_variables) : null,
    operationType: row.operation_type.toUpperCase(),
    tags: row.tags ? JSON.parse(row.tags) : [],
    version: row.version || '1.0.0',
    usageCount: row.usage_count,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

async function exportSingleTemplate(template: any) {
  const exportData = {
    id: template.id,
    identifier: template.identifier,
    name: template.name,
    description: template.description,
    query: template.query,
    variables: template.variables,
    operationType: template.operationType,
    tags: template.tags,
    isActive: template.isActive,
    version: template.version,
    usageCount: template.usageCount,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    exportedAt: new Date().toISOString(),
  }

  const cleanIdentifier = template.identifier.replace(/[^a-zA-Z0-9-]/g, '-')
  const version = template.version.replace(/\./g, '-')
  const targetFile = `${cleanIdentifier}_v${version}.json`
  const targetPath = join(OUTPUT_DIR, targetFile)

  await fs.writeFile(targetPath, JSON.stringify(exportData, null, 2))
  return targetFile
}

async function generateIndexFile(templates: any[]) {
  console.log('\n📋 인덱스 파일 생성 중...')

  const indexContent = `# Fixed 카테고리 템플릿 Export 결과

**생성일**: ${new Date().toISOString()}
**Fixed 템플릿 수**: ${templates.length}개

## Fixed 템플릿 목록 (사용량 순)

| 파일명 | 템플릿명 | 설명 | 사용횟수 | 운영타입 | 태그 |
|--------|----------|------|----------|----------|------|
${templates
  .map((template) => {
    const fileName = `${template.identifier.replace(/[^a-zA-Z0-9-]/g, '-')}_v${template.version.replace(/\./g, '-')}.json`
    const description = template.description || '설명 없음'
    const truncatedDesc =
      description.length > 30 ? `${description.substring(0, 30)}...` : description
    const tags = template.tags.join(', ')
    return `| \`${fileName}\` | ${template.name} | ${truncatedDesc} | ${template.usageCount}회 | ${template.operationType} | ${tags} |`
  })
  .join('\n')}

## 카테고리별 분포

${(() => {
  const categories: Record<string, number> = {}
  templates.forEach((template) => {
    template.tags.forEach((tag: string) => {
      categories[tag] = (categories[tag] || 0) + 1
    })
  })

  return Object.entries(categories)
    .sort(([, a], [, b]) => b - a)
    .map(([category, count]) => `- **${category}**: ${count}개`)
    .join('\n')
})()}

## 사용 방법

각 JSON 파일은 완전한 Fixed 템플릿 정보를 포함하고 있습니다:
- ✅ 완전한 GraphQL 쿼리/뮤테이션
- ✅ 변수 및 기본값
- ✅ 메타데이터 및 태그 (fixed 태그 포함)
- ✅ 사용량 통계
- ✅ 템플릿 설명

---
*자동 생성됨 by simple-export-fixed.ts*
`

  const indexPath = join(OUTPUT_DIR, 'INDEX.md')
  await fs.writeFile(indexPath, indexContent)
  console.log(`✅ 인덱스 파일 생성: ${indexPath}`)
}

if (import.meta.main) {
  main()
}

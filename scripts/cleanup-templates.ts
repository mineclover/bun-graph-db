#!/usr/bin/env bun

/**
 * Template Cleanup Script
 * 
 * 정상 동작하는 핵심 템플릿만 남기고 나머지는 정리하는 스크립트
 */

import { promises as fs } from 'fs'
import { join } from 'path'

interface Template {
  id: string
  identifier: string
  name: string
  usageCount: number
  isActive: boolean
  query: string
}

interface CleanupCriteria {
  minUsageCount: number
  excludeTestTemplates: boolean
  excludeDuplicates: boolean
  testExecutability: boolean
}

const SERVER_URL = process.env.GRAPHQL_URL || 'http://localhost:4000/graphql'
const EXPORT_DIR = join(process.cwd(), 'exported-templates')

async function main() {
  console.log('🧹 템플릿 정리 스크립트 시작')
  
  const args = process.argv.slice(2)
  const mode = args[0] || 'interactive'
  
  try {
    if (mode === 'dry-run') {
      await dryRunCleanup()
    } else if (mode === 'auto') {
      await autoCleanup()
    } else {
      await interactiveCleanup()
    }
    
    console.log('\n🎉 템플릿 정리 완료!')
    
  } catch (error) {
    console.error('💥 정리 중 오류:', error)
    process.exit(1)
  }
}

async function interactiveCleanup() {
  console.log('\n🔍 현재 상태 분석 중...')
  
  // 1. 모든 템플릿 분석
  const templates = await getAllTemplates()
  const analysis = analyzeTemplates(templates)
  
  // 2. 분석 결과 출력
  displayAnalysis(analysis, templates)
  
  // 3. 사용자 선택
  console.log('\n📋 정리 옵션:')
  console.log('1. 고사용량 템플릿만 유지 (사용량 10회 이상)')
  console.log('2. 핵심 기능 템플릿만 유지 (사용량 5회 이상)')
  console.log('3. 테스트 템플릿 제거 (identifier에 test 포함)')
  console.log('4. 중복/유사 템플릿 제거')
  console.log('5. 실행 불가능한 템플릿 제거')
  console.log('6. 맞춤 정리 (여러 조건 조합)')
  
  // 실제 환경에서는 사용자 입력을 받지만, 여기서는 기본 옵션 적용
  console.log('\n🎯 자동 모드: 핵심 기능 템플릿만 유지 (옵션 2)')
  
  const criteria: CleanupCriteria = {
    minUsageCount: 5,
    excludeTestTemplates: false, // 일부 테스트 템플릿도 유용할 수 있음
    excludeDuplicates: true,
    testExecutability: true
  }
  
  await performCleanup(templates, criteria)
}

async function autoCleanup() {
  console.log('\n🤖 자동 정리 모드')
  
  const templates = await getAllTemplates()
  const criteria: CleanupCriteria = {
    minUsageCount: 5,
    excludeTestTemplates: true,
    excludeDuplicates: true,
    testExecutability: true
  }
  
  await performCleanup(templates, criteria)
}

async function dryRunCleanup() {
  console.log('\n🔍 Dry Run 모드 - 실제 삭제하지 않고 분석만 수행')
  
  const templates = await getAllTemplates()
  const criteria: CleanupCriteria = {
    minUsageCount: 3, // 3회 이상 사용된 템플릿 유지
    excludeTestTemplates: false, // 유용한 테스트 템플릿도 유지
    excludeDuplicates: true,
    testExecutability: true
  }
  
  const { toKeep, toRemove } = await filterTemplates(templates, criteria)
  
  console.log('\n📊 Dry Run 결과:')
  console.log(`  ✅ 유지할 템플릿: ${toKeep.length}개`)
  console.log(`  🗑️ 제거할 템플릿: ${toRemove.length}개`)
  
  console.log('\n✅ 유지할 핵심 템플릿들:')
  toKeep.slice(0, 20).forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.identifier} (사용${t.usageCount}회)`)
  })
  
  if (toRemove.length > 0) {
    console.log('\n🗑️ 제거 대상 템플릿들 (처음 20개):')
    toRemove.slice(0, 20).forEach((t, i) => {
      const reason = getRemovalReason(t, criteria)
      console.log(`  ${i + 1}. ${t.identifier} (사용${t.usageCount}회) - ${reason}`)
    })
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
        query
      }
    }
  `
  
  const response = await fetch(SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  
  const data = await response.json()
  return data.data.getPopularTemplates || []
}

function analyzeTemplates(templates: Template[]) {
  const analysis = {
    total: templates.length,
    highUsage: templates.filter(t => t.usageCount >= 50).length,
    mediumUsage: templates.filter(t => t.usageCount >= 10 && t.usageCount < 50).length,
    lowUsage: templates.filter(t => t.usageCount < 10).length,
    zeroUsage: templates.filter(t => t.usageCount === 0).length,
    testTemplates: templates.filter(t => t.identifier.includes('test')).length,
    duplicates: findDuplicates(templates).length,
    inactive: templates.filter(t => !t.isActive).length
  }
  
  return analysis
}

function displayAnalysis(analysis: any, templates: Template[]) {
  console.log('\n📊 현재 템플릿 현황:')
  console.log(`  📈 총 템플릿: ${analysis.total}개`)
  console.log(`  🔥 고사용량 (50+): ${analysis.highUsage}개`)
  console.log(`  🔧 중사용량 (10-49): ${analysis.mediumUsage}개`)
  console.log(`  🔍 저사용량 (1-9): ${analysis.lowUsage}개`)
  console.log(`  💤 미사용 (0): ${analysis.zeroUsage}개`)
  console.log(`  🧪 테스트 템플릿: ${analysis.testTemplates}개`)
  console.log(`  📥 비활성화: ${analysis.inactive}개`)
  console.log(`  🔁 중복 의심: ${analysis.duplicates}개`)
  
  // 상위 사용량 템플릿 표시
  console.log('\n🏆 상위 사용량 템플릿 (TOP 10):')
  const topTemplates = templates
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 10)
  
  topTemplates.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.identifier} (${t.usageCount}회)`)
  })
}

function findDuplicates(templates: Template[]): Template[] {
  const duplicates: Template[] = []
  const seen = new Map<string, Template[]>()
  
  // 쿼리 내용으로 그룹화
  templates.forEach(template => {
    const normalizedQuery = template.query?.replace(/\s+/g, ' ').trim() || ''
    if (normalizedQuery) {
      if (!seen.has(normalizedQuery)) {
        seen.set(normalizedQuery, [])
      }
      seen.get(normalizedQuery)!.push(template)
    }
  })
  
  // 중복된 쿼리가 있는 템플릿들 찾기
  seen.forEach(group => {
    if (group.length > 1) {
      // 사용량이 적은 것들을 중복으로 간주
      const sorted = group.sort((a, b) => b.usageCount - a.usageCount)
      duplicates.push(...sorted.slice(1))
    }
  })
  
  return duplicates
}

async function filterTemplates(templates: Template[], criteria: CleanupCriteria) {
  const toKeep: Template[] = []
  const toRemove: Template[] = []
  
  for (const template of templates) {
    let shouldKeep = true
    
    // 사용량 기준
    if (template.usageCount < criteria.minUsageCount) {
      shouldKeep = false
    }
    
    // 테스트 템플릿 제외 (단, 고사용량은 유지)
    if (criteria.excludeTestTemplates && 
        template.identifier.includes('test') && 
        template.usageCount < 20) {
      shouldKeep = false
    }
    
    // 비활성화된 템플릿
    if (!template.isActive) {
      shouldKeep = false
    }
    
    // 중복 템플릿
    if (criteria.excludeDuplicates) {
      const duplicates = findDuplicates(templates)
      if (duplicates.some(d => d.id === template.id)) {
        shouldKeep = false
      }
    }
    
    // 실행 가능성 테스트 (간단한 쿼리 유효성 검사)
    if (criteria.testExecutability) {
      if (!template.query || template.query.trim() === '' || template.query === '// 쿼리 내용을 수동으로 확인 필요') {
        shouldKeep = false
      }
    }
    
    if (shouldKeep) {
      toKeep.push(template)
    } else {
      toRemove.push(template)
    }
  }
  
  return { toKeep, toRemove }
}

function getRemovalReason(template: Template, criteria: CleanupCriteria): string {
  const reasons: string[] = []
  
  if (template.usageCount < criteria.minUsageCount) {
    reasons.push(`사용량 부족 (${template.usageCount}회)`)
  }
  
  if (criteria.excludeTestTemplates && template.identifier.includes('test') && template.usageCount < 20) {
    reasons.push('테스트 템플릿')
  }
  
  if (!template.isActive) {
    reasons.push('비활성화')
  }
  
  if (!template.query || template.query.trim() === '') {
    reasons.push('빈 쿼리')
  }
  
  return reasons.join(', ') || '기타'
}

async function performCleanup(templates: Template[], criteria: CleanupCriteria) {
  console.log('\n🔄 템플릿 필터링 중...')
  
  const { toKeep, toRemove } = await filterTemplates(templates, criteria)
  
  console.log(`\n📊 필터링 결과:`)
  console.log(`  ✅ 유지: ${toKeep.length}개`)
  console.log(`  🗑️ 제거: ${toRemove.length}개`)
  
  if (toRemove.length === 0) {
    console.log('🎉 제거할 템플릿이 없습니다!')
    return
  }
  
  // 실제 템플릿 삭제
  console.log('\n🗑️ 불필요한 템플릿 삭제 중...')
  let successCount = 0
  let failCount = 0
  
  for (const template of toRemove) {
    try {
      await deleteTemplate(template.id)
      successCount++
      console.log(`  ✅ 삭제됨: ${template.identifier}`)
    } catch (error) {
      failCount++
      console.log(`  ❌ 삭제 실패: ${template.identifier} - ${error}`)
    }
    
    // 서버 부하 방지를 위한 짧은 대기
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  
  console.log(`\n📊 삭제 결과:`)
  console.log(`  ✅ 성공: ${successCount}개`)
  console.log(`  ❌ 실패: ${failCount}개`)
  
  // Export된 파일들도 정리
  await cleanupExportedFiles(toKeep)
}

async function deleteTemplate(templateId: string) {
  const mutation = `
    mutation DeleteTemplate($id: ID!) {
      deleteTemplate(id: $id) {
        success
        errors {
          message
        }
      }
    }
  `
  
  const response = await fetch(SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: mutation,
      variables: { id: templateId }
    }),
  })
  
  const data = await response.json()
  
  if (data.errors || !data.data?.deleteTemplate?.success) {
    throw new Error(data.errors?.[0]?.message || data.data?.deleteTemplate?.errors?.[0]?.message || 'Unknown error')
  }
}

async function cleanupExportedFiles(keepTemplates: Template[]) {
  console.log('\n📂 Export 파일 정리 중...')
  
  try {
    const files = await fs.readdir(EXPORT_DIR)
    const jsonFiles = files.filter(f => f.endsWith('.json') && /^\d+/.test(f))
    
    // 유지할 템플릿의 식별자 목록
    const keepIdentifiers = new Set(keepTemplates.map(t => t.identifier))
    
    let removedCount = 0
    
    for (const filename of jsonFiles) {
      const filePath = join(EXPORT_DIR, filename)
      
      try {
        const content = await fs.readFile(filePath, 'utf8')
        const data = JSON.parse(content)
        const identifier = data.template?.identifier
        
        if (!identifier || !keepIdentifiers.has(identifier)) {
          await fs.unlink(filePath)
          removedCount++
          console.log(`  🗑️ 제거: ${filename}`)
        }
      } catch (error) {
        console.log(`  ⚠️ 파일 처리 오류: ${filename}`)
      }
    }
    
    console.log(`📊 파일 정리 결과: ${removedCount}개 파일 제거`)
    
    // 새로운 인덱스 파일 생성
    await generateNewIndex(keepTemplates)
    
  } catch (error) {
    console.error('📂 파일 정리 중 오류:', error)
  }
}

async function generateNewIndex(templates: Template[]) {
  const indexContent = `# 정리된 템플릿 컬렉션

**정리일**: ${new Date().toISOString()}
**핵심 템플릿 수**: ${templates.length}개

## 유지된 핵심 템플릿들

${templates
  .sort((a, b) => b.usageCount - a.usageCount)
  .map((t, i) => `${i + 1}. **${t.name}** (\`${t.identifier}\`) - ${t.usageCount}회 사용`)
  .join('\n')}

---
*자동 정리됨 by cleanup-templates.ts*
`

  const indexPath = join(EXPORT_DIR, 'CLEANED_INDEX.md')
  await fs.writeFile(indexPath, indexContent)
  console.log(`✅ 새 인덱스 생성: ${indexPath}`)
}

// 스크립트 실행
if (import.meta.main) {
  main()
}
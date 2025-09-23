#!/usr/bin/env bun
/**
 * Template Necessity Analysis System
 * 템플릿들의 개별 필요성 및 중복성 분석
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

interface TemplateAnalysis {
  identifier: string
  name: string
  query: string
  defaultVariables: string
  tags: string[]
  category: string
  purpose: string
  complexity: 'LOW' | 'MEDIUM' | 'HIGH'
  necessity: 'ESSENTIAL' | 'USEFUL' | 'REDUNDANT' | 'DEPRECATED'
  duplicates: string[]
  recommendations: string[]
}

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

function categorizeTemplate(template: any): string {
  const identifier = template.identifier.toLowerCase()
  const query = template.query.toLowerCase()

  // 카테고리 분류
  if (
    identifier.includes('create-table') ||
    (identifier.includes('table') && identifier.includes('create'))
  ) {
    return 'TABLE_MANAGEMENT'
  }
  if (
    identifier.includes('create-node') ||
    (identifier.includes('node') && identifier.includes('create'))
  ) {
    return 'NODE_MANAGEMENT'
  }
  if (
    identifier.includes('create-attribute') ||
    (identifier.includes('attribute') && identifier.includes('create'))
  ) {
    return 'ATTRIBUTE_MANAGEMENT'
  }
  if (
    identifier.includes('update-') ||
    query.includes('updatetable') ||
    query.includes('updatenode')
  ) {
    return 'UPDATE_OPERATIONS'
  }
  if (identifier.includes('delete-') || query.includes('deletenode')) {
    return 'DELETE_OPERATIONS'
  }
  if (
    identifier.includes('list-') ||
    identifier.includes('search-') ||
    query.includes('searchtemplates')
  ) {
    return 'SEARCH_OPERATIONS'
  }
  if (identifier.includes('bulk-') || identifier.includes('mass')) {
    return 'BULK_OPERATIONS'
  }
  if (
    identifier.includes('system-') ||
    identifier.includes('health') ||
    identifier.includes('metrics')
  ) {
    return 'SYSTEM_MONITORING'
  }
  if (
    identifier.includes('template') &&
    (identifier.includes('create') || identifier.includes('update'))
  ) {
    return 'TEMPLATE_MANAGEMENT'
  }
  if (identifier.includes('todo') || identifier.includes('task')) {
    return 'TODO_MANAGEMENT'
  }
  if (
    identifier.includes('export') ||
    identifier.includes('import') ||
    identifier.includes('migration')
  ) {
    return 'DATA_TRANSFER'
  }
  if (
    identifier.includes('validation') ||
    identifier.includes('optimize') ||
    identifier.includes('quality')
  ) {
    return 'QUALITY_ASSURANCE'
  }

  return 'MISCELLANEOUS'
}

function assessComplexity(template: any): 'LOW' | 'MEDIUM' | 'HIGH' {
  const query = template.query || ''
  const variables = String(template.defaultVariables || '{}')

  // 쿼리 복잡도 분석
  const mutationCount = (query.match(/mutation/gi) || []).length
  const queryCount = (query.match(/query/gi) || []).length
  const fieldCount = (query.match(/\{[^}]*\}/g) || []).length
  const variableCount = (variables.match(/"/g) || []).length / 2 // key-value pairs

  const complexityScore = mutationCount * 2 + queryCount + fieldCount + variableCount

  if (complexityScore <= 5) return 'LOW'
  if (complexityScore <= 15) return 'MEDIUM'
  return 'HIGH'
}

function assessNecessity(
  template: any,
  allTemplates: any[],
  category: string
): 'ESSENTIAL' | 'USEFUL' | 'REDUNDANT' | 'DEPRECATED' {
  const identifier = template.identifier.toLowerCase()

  // 기본 CRUD 작업은 ESSENTIAL
  if (
    identifier.includes('create-table') ||
    identifier.includes('create-node') ||
    identifier.includes('create-attribute')
  ) {
    return 'ESSENTIAL'
  }

  // 시스템 모니터링은 ESSENTIAL
  if (identifier.includes('health') || identifier.includes('system-stats')) {
    return 'ESSENTIAL'
  }

  // -with-params 접미사 검사
  if (identifier.includes('-with-params')) {
    // 동일한 기능의 기본 버전이 있는지 확인
    const baseIdentifier = identifier.replace('-with-params', '')
    const hasBasicVersion = allTemplates.some(
      (t) => t.identifier.toLowerCase() === baseIdentifier && t.identifier !== template.identifier
    )

    if (hasBasicVersion) {
      return 'REDUNDANT'
    }
  }

  // -fixed 접미사는 개선된 버전으로 간주
  if (identifier.includes('-fixed')) {
    const baseIdentifier = identifier.replace('-fixed', '')
    const hasBasicVersion = allTemplates.some(
      (t) => t.identifier.toLowerCase() === baseIdentifier && t.identifier !== template.identifier
    )

    if (hasBasicVersion) {
      return 'USEFUL' // 개선된 버전은 유용
    }
  }

  // 중복된 시스템 헬스체크
  if (identifier.includes('system-health-check') && identifier !== 'get-system-health-status') {
    return 'REDUNDANT'
  }

  // TODO/Task 관련 - 과도한 것 같으면 일부 REDUNDANT
  if (
    category === 'TODO_MANAGEMENT' &&
    allTemplates.filter((t) => categorizeTemplate(t) === 'TODO_MANAGEMENT').length > 3
  ) {
    return 'REDUNDANT'
  }

  // 템플릿 관리 자체 - 과도한 메타 관리
  if (category === 'TEMPLATE_MANAGEMENT' && identifier.includes('template')) {
    return 'USEFUL'
  }

  // 기본적으로 USEFUL
  return 'USEFUL'
}

function findDuplicates(template: any, allTemplates: any[]): string[] {
  const duplicates: string[] = []
  const identifier = template.identifier.toLowerCase()

  for (const other of allTemplates) {
    if (other.identifier === template.identifier) continue

    const otherIdentifier = other.identifier.toLowerCase()

    // 유사한 이름 패턴 검사
    const baseId = identifier.replace(/-with-params|-fixed|-v\d+/g, '')
    const otherBaseId = otherIdentifier.replace(/-with-params|-fixed|-v\d+/g, '')

    if (baseId === otherBaseId) {
      duplicates.push(other.identifier)
    }

    // 쿼리 유사성 검사 (간단한 키워드 매칭)
    const queryWords = template.query.toLowerCase().match(/\w+/g) || []
    const otherQueryWords = other.query.toLowerCase().match(/\w+/g) || []

    const commonWords = queryWords.filter(
      (word) => otherQueryWords.includes(word) && word.length > 3
    )
    const similarity = commonWords.length / Math.max(queryWords.length, otherQueryWords.length)

    if (similarity > 0.7 && template.identifier !== other.identifier) {
      if (!duplicates.includes(other.identifier)) {
        duplicates.push(other.identifier)
      }
    }
  }

  return duplicates
}

function generateRecommendations(analysis: TemplateAnalysis): string[] {
  const recommendations: string[] = []

  switch (analysis.necessity) {
    case 'ESSENTIAL':
      recommendations.push('✅ 유지 - 핵심 기능')
      break

    case 'USEFUL':
      recommendations.push('🔄 검토 - 사용성 및 최적화 가능성 평가')
      if (analysis.complexity === 'HIGH') {
        recommendations.push('🔧 단순화 고려')
      }
      break

    case 'REDUNDANT':
      recommendations.push('🗑️ 제거 고려 - 중복 기능')
      if (analysis.duplicates.length > 0) {
        recommendations.push(`🔀 대체 가능: ${analysis.duplicates.slice(0, 2).join(', ')}`)
      }
      break

    case 'DEPRECATED':
      recommendations.push('❌ 제거 권장 - 사용되지 않는 기능')
      break
  }

  if (analysis.duplicates.length > 2) {
    recommendations.push(`⚠️ 과도한 중복 (${analysis.duplicates.length}개)`)
  }

  return recommendations
}

async function analyzeTemplateNecessity() {
  console.log('🔍 템플릿 필요성 분석 시작\n')

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
    const allTemplates = await getAllTemplates()
    console.log(`📊 총 ${allTemplates.length}개 템플릿 분석 중...\n`)

    // 템플릿별 분석
    const analyses: TemplateAnalysis[] = []

    for (const template of allTemplates) {
      const category = categorizeTemplate(template)
      const complexity = assessComplexity(template)
      const necessity = assessNecessity(template, allTemplates, category)
      const duplicates = findDuplicates(template, allTemplates)

      const analysis: TemplateAnalysis = {
        identifier: template.identifier,
        name: template.name,
        query: template.query,
        defaultVariables: template.defaultVariables || '{}',
        tags: template.tags || [],
        category,
        purpose: `${category} 관련 작업`,
        complexity,
        necessity,
        duplicates,
        recommendations: [],
      }

      analysis.recommendations = generateRecommendations(analysis)
      analyses.push(analysis)

      console.log(`📋 분석: ${template.identifier}`)
      console.log(`   카테고리: ${category}`)
      console.log(`   복잡도: ${complexity}`)
      console.log(`   필요성: ${necessity}`)
      if (duplicates.length > 0) {
        console.log(
          `   중복: ${duplicates.slice(0, 3).join(', ')}${duplicates.length > 3 ? '...' : ''}`
        )
      }
      console.log('')
    }

    // 카테고리별 요약
    const categorySummary = analyses.reduce((acc, analysis) => {
      if (!acc[analysis.category]) {
        acc[analysis.category] = {
          total: 0,
          essential: 0,
          useful: 0,
          redundant: 0,
          deprecated: 0,
        }
      }
      acc[analysis.category].total++
      acc[analysis.category][analysis.necessity.toLowerCase()]++
      return acc
    }, {} as any)

    console.log('\n📊 카테고리별 요약:')
    for (const [category, summary] of Object.entries(categorySummary)) {
      console.log(`\n🏷️ ${category}:`)
      console.log(`   총 ${summary.total}개`)
      console.log(`   ✅ 필수: ${summary.essential}개`)
      console.log(`   🔄 유용: ${summary.useful}개`)
      console.log(`   🗑️ 중복: ${summary.redundant}개`)
      console.log(`   ❌ 사용안함: ${summary.deprecated}개`)
    }

    // 필요성별 요약
    const necessitySummary = analyses.reduce((acc, analysis) => {
      acc[analysis.necessity] = (acc[analysis.necessity] || 0) + 1
      return acc
    }, {} as any)

    console.log('\n🎯 전체 필요성 요약:')
    console.log(`✅ 필수 (ESSENTIAL): ${necessitySummary.ESSENTIAL || 0}개`)
    console.log(`🔄 유용 (USEFUL): ${necessitySummary.USEFUL || 0}개`)
    console.log(`🗑️ 중복 (REDUNDANT): ${necessitySummary.REDUNDANT || 0}개`)
    console.log(`❌ 사용안함 (DEPRECATED): ${necessitySummary.DEPRECATED || 0}개`)

    // 제거 후보 템플릿들
    const removalCandidates = analyses.filter(
      (a) => a.necessity === 'REDUNDANT' || a.necessity === 'DEPRECATED'
    )
    if (removalCandidates.length > 0) {
      console.log('\n🗑️ 제거 고려 대상:')
      removalCandidates.forEach((candidate) => {
        console.log(`   - ${candidate.identifier} (${candidate.necessity})`)
        candidate.recommendations.forEach((rec) => console.log(`     ${rec}`))
      })
    }

    // 결과 저장
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const resultPath = `./claudedocs/template-necessity-analysis-${timestamp}.json`

    const fullReport = {
      summary: {
        totalTemplates: analyses.length,
        essential: necessitySummary.ESSENTIAL || 0,
        useful: necessitySummary.USEFUL || 0,
        redundant: necessitySummary.REDUNDANT || 0,
        deprecated: necessitySummary.DEPRECATED || 0,
        categorySummary,
        removalCandidates: removalCandidates.length,
      },
      analyses,
      removalCandidates: removalCandidates.map((c) => ({
        identifier: c.identifier,
        necessity: c.necessity,
        duplicates: c.duplicates,
        recommendations: c.recommendations,
      })),
    }

    await Bun.write(resultPath, JSON.stringify(fullReport, null, 2))
    console.log(`\n📋 상세 분석 결과 저장: ${resultPath}`)

    console.log('\n🎉 템플릿 필요성 분석 완료!')
  } catch (error) {
    console.error('❌ 시스템 오류:', error)
    process.exit(1)
  }
}

// 스크립트 실행
if (import.meta.main) {
  analyzeTemplateNecessity()
}

export { analyzeTemplateNecessity }

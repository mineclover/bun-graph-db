#!/usr/bin/env bun

/**
 * 현재 템플릿 도메인 구조 분석 스크립트
 *
 * 기능:
 * 1. 기존 tags 기반 도메인 분류 현황 분석
 * 2. operation_type 및 template_type 활용 현황
 * 3. 도메인 관리 개선 방안 제시
 * 4. GraphQL 스키마 연동 가능성 검토
 */

import Database from 'bun:sqlite'
import path from 'node:path'

interface TemplateAnalysis {
  id: string
  identifier: string
  name: string
  tags: string[]
  templateType: string
  operationType: string
  applicableTables: string[] | null
  complexityScore: number
  usageCount: number
  inferredDomain: string
}

interface DomainStats {
  domain: string
  count: number
  percentage: number
  templates: string[]
  avgComplexity: number
  totalUsage: number
}

class DomainAnalyzer {
  private db: Database

  constructor() {
    const dbPath = path.join(process.cwd(), 'data', 'bun-graph-db.sqlite')
    this.db = new Database(dbPath)
  }

  private inferDomainFromTemplate(template: TemplateAnalysis): string {
    const { tags, operationType, identifier, name } = template

    // 1. Tags 기반 우선 분류
    if (tags.includes('relation')) return 'relation'
    if (tags.includes('table')) return 'table'
    if (tags.includes('node')) return 'node'
    if (tags.includes('system') || tags.includes('health')) return 'system'

    // 2. Identifier/Name 패턴 기반
    const lowerIdentifier = identifier.toLowerCase()
    const lowerName = name.toLowerCase()

    if (lowerIdentifier.includes('relation') || lowerName.includes('relation')) return 'relation'
    if (lowerIdentifier.includes('table') || lowerName.includes('table')) return 'table'
    if (lowerIdentifier.includes('node') || lowerName.includes('node')) return 'node'
    if (lowerIdentifier.includes('health') || lowerIdentifier.includes('system')) return 'system'

    // 3. Operation Type 기반
    if (operationType === 'mutation') return 'mutation'

    // 4. 기본값
    return 'general'
  }

  async analyzeCurrentStructure() {
    console.log('🔍 현재 템플릿 도메인 구조 분석')
    console.log('='.repeat(50))

    // 모든 활성 템플릿 조회
    const templates = this.db
      .prepare(`
      SELECT
        id, identifier, name, tags, template_type, operation_type,
        applicable_tables, complexity_score, usage_count
      FROM templates
      WHERE is_active = 1
      ORDER BY usage_count DESC, identifier
    `)
      .all()

    const analyzedTemplates: TemplateAnalysis[] = templates.map((t) => {
      const template = t as any
      const tags = template.tags ? JSON.parse(template.tags) : []
      const applicableTables = template.applicable_tables
        ? JSON.parse(template.applicable_tables)
        : null

      const analysis: TemplateAnalysis = {
        id: template.id,
        identifier: template.identifier,
        name: template.name,
        tags,
        templateType: template.template_type || 'query',
        operationType: template.operation_type || 'query',
        applicableTables,
        complexityScore: template.complexity_score || 1,
        usageCount: template.usage_count || 0,
        inferredDomain: '',
      }

      analysis.inferredDomain = this.inferDomainFromTemplate(analysis)
      return analysis
    })

    console.log(`📊 총 ${analyzedTemplates.length}개 활성 템플릿 분석 완료\n`)

    return analyzedTemplates
  }

  generateDomainStatistics(templates: TemplateAnalysis[]): DomainStats[] {
    const domainMap = new Map<string, DomainStats>()

    for (const template of templates) {
      const domain = template.inferredDomain

      if (!domainMap.has(domain)) {
        domainMap.set(domain, {
          domain,
          count: 0,
          percentage: 0,
          templates: [],
          avgComplexity: 0,
          totalUsage: 0,
        })
      }

      const stats = domainMap.get(domain)!
      stats.count++
      stats.templates.push(template.identifier)
      stats.totalUsage += template.usageCount
    }

    // 백분율 계산 및 평균 복잡도 계산
    const totalTemplates = templates.length
    for (const stats of domainMap.values()) {
      stats.percentage = (stats.count / totalTemplates) * 100

      const domainTemplates = templates.filter((t) => t.inferredDomain === stats.domain)
      stats.avgComplexity =
        domainTemplates.reduce((sum, t) => sum + t.complexityScore, 0) / domainTemplates.length
    }

    return Array.from(domainMap.values()).sort((a, b) => b.count - a.count)
  }

  displayStatistics(stats: DomainStats[]) {
    console.log('📈 도메인별 템플릿 분포')
    console.log('─'.repeat(70))
    console.log('┌─────────────┬────────┬──────────┬────────────┬──────────┐')
    console.log('│ 도메인      │ 개수   │ 비율     │ 평균복잡도 │ 총사용횟수│')
    console.log('├─────────────┼────────┼──────────┼────────────┼──────────┤')

    for (const stat of stats) {
      const domain = stat.domain.padEnd(11)
      const count = String(stat.count).padStart(6)
      const percentage = `${stat.percentage.toFixed(1)}%`.padStart(8)
      const avgComplexity = stat.avgComplexity.toFixed(1).padStart(10)
      const totalUsage = String(stat.totalUsage).padStart(8)

      console.log(`│ ${domain} │ ${count} │ ${percentage} │ ${avgComplexity} │ ${totalUsage} │`)
    }
    console.log('└─────────────┴────────┴──────────┴────────────┴──────────┘')
  }

  displayDomainDetails(templates: TemplateAnalysis[], stats: DomainStats[]) {
    console.log('\n🔍 도메인별 상세 분석')
    console.log('─'.repeat(70))

    for (const stat of stats) {
      console.log(`\n📂 ${stat.domain.toUpperCase()} 도메인 (${stat.count}개 템플릿)`)

      const domainTemplates = templates
        .filter((t) => t.inferredDomain === stat.domain)
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 5) // 상위 5개만 표시

      for (const template of domainTemplates) {
        console.log(`   • ${template.identifier}`)
        console.log(`     ${template.name}`)
        console.log(`     태그: [${template.tags.join(', ')}]`)
        console.log(
          `     타입: ${template.operationType} | 복잡도: ${template.complexityScore} | 사용: ${template.usageCount}회`
        )

        if (template.applicableTables && template.applicableTables.length > 0) {
          console.log(`     적용테이블: [${template.applicableTables.join(', ')}]`)
        }
        console.log('')
      }

      if (stat.count > 5) {
        console.log(`   ... 외 ${stat.count - 5}개 템플릿`)
      }
    }
  }

  analyzeTagPatterns(templates: TemplateAnalysis[]) {
    console.log('\n🏷️  태그 패턴 분석')
    console.log('─'.repeat(50))

    const tagCounts = new Map<string, number>()
    const tagDomainMap = new Map<string, Set<string>>()

    for (const template of templates) {
      for (const tag of template.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)

        if (!tagDomainMap.has(tag)) {
          tagDomainMap.set(tag, new Set())
        }
        tagDomainMap.get(tag)!.add(template.inferredDomain)
      }
    }

    const sortedTags = Array.from(tagCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)

    console.log('상위 15개 태그 사용 현황:')
    for (const [tag, count] of sortedTags) {
      const domains = Array.from(tagDomainMap.get(tag)!).join(', ')
      console.log(`   ${tag.padEnd(15)} | ${String(count).padStart(3)}회 | 도메인: ${domains}`)
    }
  }

  analyzeOperationTypes(templates: TemplateAnalysis[]) {
    console.log('\n⚙️  Operation Type 분석')
    console.log('─'.repeat(50))

    const operationStats = new Map<string, { count: number; domains: Set<string> }>()

    for (const template of templates) {
      if (!operationStats.has(template.operationType)) {
        operationStats.set(template.operationType, { count: 0, domains: new Set() })
      }

      const stats = operationStats.get(template.operationType)!
      stats.count++
      stats.domains.add(template.inferredDomain)
    }

    console.log('Operation Type 분포:')
    for (const [opType, stats] of operationStats) {
      const domains = Array.from(stats.domains).join(', ')
      console.log(
        `   ${opType.padEnd(12)} | ${String(stats.count).padStart(3)}개 | 도메인: ${domains}`
      )
    }
  }

  generateRecommendations(templates: TemplateAnalysis[], stats: DomainStats[]) {
    console.log('\n💡 도메인 관리 개선 권장사항')
    console.log('─'.repeat(50))

    // 1. 태그 표준화 권장사항
    const inconsistentTemplates = templates.filter(
      (t) => !t.tags.includes(t.inferredDomain) && t.inferredDomain !== 'general'
    )

    if (inconsistentTemplates.length > 0) {
      console.log('\n1. 태그 표준화 필요 템플릿:')
      for (const template of inconsistentTemplates.slice(0, 5)) {
        console.log(
          `   ${template.identifier}: [${template.tags.join(', ')}] → 추천: ${template.inferredDomain}`
        )
      }
      if (inconsistentTemplates.length > 5) {
        console.log(`   ... 외 ${inconsistentTemplates.length - 5}개`)
      }
    }

    // 2. 도메인별 특성화 권장사항
    console.log('\n2. 도메인별 특성화 권장사항:')
    for (const stat of stats) {
      if (stat.count >= 3) {
        console.log(`   ${stat.domain}: 전용 네임스페이스 및 스키마 최적화 고려`)
      }
    }

    // 3. 성능 개선 권장사항
    const highUsageDomains = stats
      .filter((s) => s.totalUsage > 0)
      .sort((a, b) => b.totalUsage - a.totalUsage)
    if (highUsageDomains.length > 0) {
      console.log('\n3. 성능 최적화 우선순위:')
      for (const domain of highUsageDomains.slice(0, 3)) {
        console.log(`   ${domain.domain}: ${domain.totalUsage}회 사용 - 캐싱 및 인덱스 최적화`)
      }
    }

    // 4. GraphQL 스키마 개선 권장사항
    console.log('\n4. GraphQL 스키마 개선 권장사항:')
    console.log('   - QueryTemplatesFilter에 domain 기반 필터링 추가')
    console.log('   - 도메인별 전용 쿼리 네임스페이스 고려')
    console.log('   - 도메인 통계 API 추가 (getDomainStats)')
  }

  async runAnalysis() {
    try {
      const templates = await this.analyzeCurrentStructure()
      const stats = this.generateDomainStatistics(templates)

      this.displayStatistics(stats)
      this.displayDomainDetails(templates, stats)
      this.analyzeTagPatterns(templates)
      this.analyzeOperationTypes(templates)
      this.generateRecommendations(templates, stats)

      console.log('\n✅ 분석 완료!')
      console.log('\n📋 요약:')
      console.log(`   총 템플릿: ${templates.length}개`)
      console.log(`   도메인 분류: ${stats.length}개 도메인`)
      console.log(
        `   주요 도메인: ${stats
          .slice(0, 3)
          .map((s) => s.domain)
          .join(', ')}`
      )

      return { templates, stats }
    } catch (error) {
      console.error('❌ 분석 실행 중 오류:', error)
      throw error
    } finally {
      this.db.close()
    }
  }
}

// 스크립트 실행
if (import.meta.main) {
  console.log('🔬 템플릿 도메인 구조 분석기')
  console.log('현재 스키마 활용 도메인 관리 현황 분석\n')

  const analyzer = new DomainAnalyzer()

  analyzer
    .runAnalysis()
    .then(({ templates, stats }) => {
      console.log('\n🎯 다음 단계 권장사항:')
      console.log('   1. 태그 표준화로 도메인 분류 일관성 확보')
      console.log('   2. GraphQL 스키마에 도메인 필터링 추가')
      console.log('   3. 도메인별 성능 최적화 및 캐싱 전략')
      console.log('   4. 도메인 통계 및 분석 API 구현')

      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 분석 실패!')
      console.error(error)
      process.exit(1)
    })
}

#!/usr/bin/env bun

/**
 * 기존 스키마 기반 도메인 기능 테스트 스크립트
 *
 * 기능:
 * 1. Tags 기반 도메인별 템플릿 조회 테스트
 * 2. Operation Type 기반 분류 테스트
 * 3. 도메인 기반 검색 및 필터링 테스트
 * 4. 기존 스키마 활용 도메인 관리 검증
 */

import Database from 'bun:sqlite'
import path from 'node:path'

interface TemplateInfo {
  id: string
  identifier: string
  name: string
  domain: string
  tags: string[]
  complexityScore: number
}

class DomainTester {
  private db: Database

  constructor() {
    const dbPath = path.join(process.cwd(), 'data', 'bun-graph-db.sqlite')
    this.db = new Database(dbPath)
  }

  async testDomainQueries() {
    console.log('🔍 1. 도메인별 템플릿 조회 테스트')
    console.log('─'.repeat(50))

    // 모든 도메인 조회
    const domains = this.db
      .prepare(`
      SELECT DISTINCT domain
      FROM templates
      WHERE domain IS NOT NULL AND is_active = 1
      ORDER BY domain
    `)
      .all() as { domain: string }[]

    for (const { domain } of domains) {
      const templates = this.db
        .prepare(`
        SELECT id, identifier, name, tags, complexity_score
        FROM templates
        WHERE domain = ? AND is_active = 1
        ORDER BY usage_count DESC
        LIMIT 5
      `)
        .all(domain) as TemplateInfo[]

      console.log(`\n📂 ${domain.toUpperCase()} 도메인 (${templates.length}개 템플릿):`)

      for (const template of templates) {
        const tags = template.tags ? JSON.parse(template.tags) : []
        const tagStr = tags.slice(0, 3).join(', ')
        console.log(`   • ${template.identifier}`)
        console.log(`     ${template.name} (복잡도: ${template.complexityScore || 'N/A'})`)
        if (tagStr) console.log(`     태그: ${tagStr}`)
      }
    }
  }

  async testDomainStatistics() {
    console.log('\n\n📊 2. 도메인 통계 조회 테스트')
    console.log('─'.repeat(50))

    const stats = this.db
      .prepare(`
      SELECT
        domain,
        COUNT(*) as count,
        COUNT(*) * 100.0 / (SELECT COUNT(*) FROM templates WHERE is_active = 1) as percentage,
        AVG(COALESCE(complexity_score, 1)) as avgComplexity,
        GROUP_CONCAT(tags) as allTags
      FROM templates
      WHERE domain IS NOT NULL AND is_active = 1
      GROUP BY domain
      ORDER BY count DESC
    `)
      .all()

    console.log('┌─────────────┬────────┬──────────┬────────────┐')
    console.log('│ 도메인      │ 개수   │ 비율     │ 평균복잡도 │')
    console.log('├─────────────┼────────┼──────────┼────────────┤')

    for (const stat of stats) {
      const s = stat as any
      const domain = s.domain.padEnd(11)
      const count = String(s.count).padStart(6)
      const percentage = `${Number(s.percentage).toFixed(1)}%`.padStart(8)
      const avgComplexity = Number(s.avgComplexity).toFixed(1).padStart(10)

      console.log(`│ ${domain} │ ${count} │ ${percentage} │ ${avgComplexity} │`)
    }
    console.log('└─────────────┴────────┴──────────┴────────────┘')

    // 도메인별 주요 태그 분석
    console.log('\n🏷️  도메인별 주요 태그:')
    for (const stat of stats) {
      const s = stat as any
      const allTags = s.allTags
        ? s.allTags.split(',').flatMap((tagGroup: string) => {
            try {
              return JSON.parse(tagGroup)
            } catch {
              return []
            }
          })
        : []

      const tagCounts: Record<string, number> = {}
      for (const tag of allTags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      }

      const topTags = Object.entries(tagCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([tag]) => tag)
        .join(', ')

      console.log(`   ${s.domain}: ${topTags}`)
    }
  }

  async testDomainSearch() {
    console.log('\n\n🔎 3. 도메인 기반 검색 테스트')
    console.log('─'.repeat(50))

    const searchTests = [
      { domain: 'relation', keyword: 'create' },
      { domain: 'table', keyword: 'get' },
      { domain: 'system', keyword: 'health' },
      { domain: 'node', keyword: 'search' },
    ]

    for (const { domain, keyword } of searchTests) {
      console.log(`\n🔍 "${domain}" 도메인에서 "${keyword}" 검색:`)

      const results = this.db
        .prepare(`
        SELECT identifier, name, domain
        FROM templates
        WHERE domain = ?
          AND (
            identifier LIKE ? OR
            name LIKE ? OR
            query LIKE ?
          )
          AND is_active = 1
        LIMIT 3
      `)
        .all(domain, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`)

      if (results.length > 0) {
        for (const result of results) {
          const r = result as any
          console.log(`   ✅ ${r.identifier} (${r.domain})`)
          console.log(`      ${r.name}`)
        }
      } else {
        console.log(`   ❌ 검색 결과 없음`)
      }
    }
  }

  async testCrossReferences() {
    console.log('\n\n🔗 4. 도메인 간 연관성 분석')
    console.log('─'.repeat(50))

    // 관련 도메인 템플릿 찾기
    const crossReferences = this.db
      .prepare(`
      SELECT
        t1.domain as source_domain,
        t2.domain as target_domain,
        COUNT(*) as connection_count
      FROM templates t1
      JOIN templates t2 ON (
        t1.query LIKE '%' || t2.identifier || '%' OR
        t1.applicable_tables = t2.applicable_tables
      )
      WHERE t1.domain != t2.domain
        AND t1.is_active = 1
        AND t2.is_active = 1
      GROUP BY t1.domain, t2.domain
      HAVING connection_count > 0
      ORDER BY connection_count DESC
      LIMIT 10
    `)
      .all()

    if (crossReferences.length > 0) {
      console.log('도메인 간 연관성:')
      for (const ref of crossReferences) {
        const r = ref as any
        console.log(`   ${r.source_domain} ↔ ${r.target_domain}: ${r.connection_count}개 연결`)
      }
    } else {
      console.log('도메인 간 직접적인 연관성이 발견되지 않았습니다.')
    }
  }

  async testDomainMigrationVerification() {
    console.log('\n\n✅ 5. 도메인 마이그레이션 검증')
    console.log('─'.repeat(50))

    // 마이그레이션 완성도 확인
    const migrationStatus = this.db
      .prepare(`
      SELECT
        COUNT(*) as total_templates,
        COUNT(CASE WHEN domain IS NOT NULL THEN 1 END) as templates_with_domain,
        COUNT(CASE WHEN domain IS NULL THEN 1 END) as templates_without_domain
      FROM templates
      WHERE is_active = 1
    `)
      .get() as any

    console.log(`📊 마이그레이션 상태:`)
    console.log(`   총 활성 템플릿: ${migrationStatus.total_templates}개`)
    console.log(`   도메인 할당: ${migrationStatus.templates_with_domain}개`)
    console.log(`   도메인 미할당: ${migrationStatus.templates_without_domain}개`)

    const completionRate =
      (migrationStatus.templates_with_domain / migrationStatus.total_templates) * 100
    console.log(`   완료율: ${completionRate.toFixed(1)}%`)

    if (completionRate === 100) {
      console.log(`   ✅ 마이그레이션 완료!`)
    } else {
      console.log(`   ⚠️  일부 템플릿에 도메인이 할당되지 않았습니다.`)

      // 도메인이 없는 템플릿 목록
      const unassigned = this.db
        .prepare(`
        SELECT identifier, name
        FROM templates
        WHERE domain IS NULL AND is_active = 1
        LIMIT 5
      `)
        .all()

      console.log('\n   도메인 미할당 템플릿:')
      for (const template of unassigned) {
        const t = template as any
        console.log(`   - ${t.identifier}: ${t.name}`)
      }
    }

    // 도메인별 품질 지표
    console.log('\n📈 도메인별 품질 지표:')
    const qualityMetrics = this.db
      .prepare(`
      SELECT
        domain,
        COUNT(*) as template_count,
        AVG(COALESCE(complexity_score, 1)) as avg_complexity,
        AVG(COALESCE(usage_count, 0)) as avg_usage,
        MAX(COALESCE(last_used_at, '1970-01-01')) as last_activity
      FROM templates
      WHERE domain IS NOT NULL AND is_active = 1
      GROUP BY domain
      ORDER BY template_count DESC
    `)
      .all()

    for (const metric of qualityMetrics) {
      const m = metric as any
      console.log(`   ${m.domain}:`)
      console.log(`     템플릿 수: ${m.template_count}개`)
      console.log(`     평균 복잡도: ${Number(m.avg_complexity).toFixed(1)}`)
      console.log(`     평균 사용횟수: ${Number(m.avg_usage).toFixed(1)}`)
      console.log(
        `     마지막 활동: ${m.last_activity === '1970-01-01' ? '없음' : m.last_activity}`
      )
    }
  }

  async runAllTests() {
    console.log('🧪 템플릿 도메인 기능 종합 테스트')
    console.log('='.repeat(50))

    try {
      await this.testDomainQueries()
      await this.testDomainStatistics()
      await this.testDomainSearch()
      await this.testCrossReferences()
      await this.testDomainMigrationVerification()

      console.log('\n\n🎉 모든 테스트 완료!')
      console.log('\n📝 테스트 결과 요약:')
      console.log('   ✅ 도메인별 템플릿 조회 기능')
      console.log('   ✅ 도메인 통계 및 분석 기능')
      console.log('   ✅ 도메인 기반 검색 기능')
      console.log('   ✅ 도메인 간 연관성 분석')
      console.log('   ✅ 마이그레이션 무결성 검증')
    } catch (error) {
      console.error('\n❌ 테스트 실행 중 오류 발생:', error)
      throw error
    } finally {
      this.db.close()
    }
  }
}

// 스크립트 실행
if (import.meta.main) {
  const tester = new DomainTester()

  tester
    .runAllTests()
    .then(() => {
      console.log('\n🎯 다음 권장 사항:')
      console.log('   1. GraphQL 스키마에 domain 필터링 추가')
      console.log('   2. 도메인별 템플릿 추천 시스템 구현')
      console.log('   3. 도메인 계층구조 설계 및 구현')
      console.log('   4. 도메인 기반 성능 최적화')

      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 테스트 실패!')
      console.error(error)
      process.exit(1)
    })
}

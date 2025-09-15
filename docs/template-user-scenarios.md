#!/usr/bin/env bun
/**
 * Template Gap Analyzer
 *
 * 사용자 시나리오와 현재 템플릿 간의 갭을 분석하고
 * 필요한 신규 템플릿을 제안합니다.
 */

interface UserScenario {
  id: string
  name: string
  description: string
  userIntent: string
  frequency: 'high' | 'medium' | 'low'
  complexity: 'simple' | 'moderate' | 'complex'
  requiredFeatures: string[]
}

interface TemplateGap {
  scenario: UserScenario
  matchingTemplates: string[]
  coverageScore: number // 0-100%
  missingFeatures: string[]
  recommendedTemplate: NewTemplateRecommendation | null
}

interface NewTemplateRecommendation {
  identifier: string
  name: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  estimatedEffort: 'small' | 'medium' | 'large'
  dependencies: string[]
  queryStructure: string
}

class TemplateGapAnalyzer {
  private serverUrl = 'http://localhost:4000/graphql'

  // 사용자 시나리오 정의
  private readonly USER_SCENARIOS: UserScenario[] = [
    {
      id: 'bulk-data-import',
      name: '대량 데이터 가져오기',
      description: 'CSV, JSON 등의 파일에서 대량의 노드를 한번에 생성',
      userIntent: '데이터 마이그레이션 및 초기 데이터 로드',
      frequency: 'high',
      complexity: 'complex',
      requiredFeatures: ['file-upload', 'batch-processing', 'error-handling', 'progress-tracking']
    },
    {
      id: 'real-time-monitoring',
      name: '실시간 시스템 모니터링',
      description: '시스템 성능, 메모리 사용량, 쿼리 성능을 실시간으로 모니터링',
      userIntent: '시스템 안정성 및 성능 관리',
      frequency: 'high',
      complexity: 'complex',
      requiredFeatures: ['real-time-metrics', 'subscription', 'alerting', 'dashboard']
    },
    {
      id: 'data-validation',
      name: '데이터 무결성 검증',
      description: '스키마 규칙 위반, 고아 노드, 중복 데이터 등을 검사',
      userIntent: '데이터 품질 관리',
      frequency: 'medium',
      complexity: 'moderate',
      requiredFeatures: ['validation-rules', 'integrity-check', 'report-generation']
    },
    {
      id: 'advanced-analytics',
      name: '고급 그래프 분석',
      description: '중심성 분석, 클러스터링, 경로 최적화 등의 그래프 알고리즘',
      userIntent: '데이터 인사이트 도출',
      frequency: 'medium',
      complexity: 'complex',
      requiredFeatures: ['graph-algorithms', 'statistical-analysis', 'visualization-data']
    },
    {
      id: 'backup-restore',
      name: '백업 및 복원',
      description: '시스템 전체 또는 특정 테이블의 백업 생성 및 복원',
      userIntent: '데이터 보호 및 재해 복구',
      frequency: 'low',
      complexity: 'complex',
      requiredFeatures: ['backup-creation', 'restore-process', 'incremental-backup', 'verification']
    },
    {
      id: 'template-lifecycle-management',
      name: '템플릿 생명주기 관리',
      description: '템플릿의 생성부터 삭제까지 전체 생명주기 관리 및 버전 관리',
      userIntent: '템플릿 체계적 관리',
      frequency: 'medium',
      complexity: 'moderate',
      requiredFeatures: ['template-versioning', 'template-archiving', 'dependency-tracking', 'usage-analytics']
    },
    {
      id: 'query-optimization',
      name: '쿼리 성능 최적화',
      description: '느린 쿼리 식별, 인덱스 제안, 성능 튜닝',
      userIntent: '시스템 성능 향상',
      frequency: 'medium',
      complexity: 'complex',
      requiredFeatures: ['query-profiling', 'performance-metrics', 'optimization-suggestions']
    },
    {
      id: 'data-export',
      name: '데이터 내보내기',
      description: '다양한 형식(JSON, CSV, GraphML)으로 데이터 내보내기',
      userIntent: '데이터 이동 및 백업',
      frequency: 'medium',
      complexity: 'moderate',
      requiredFeatures: ['format-conversion', 'large-dataset-handling', 'streaming-export']
    },
    {
      id: 'schema-evolution',
      name: '스키마 진화',
      description: '스키마 변경 시 기존 데이터의 마이그레이션',
      userIntent: '시스템 업데이트 및 확장',
      frequency: 'low',
      complexity: 'complex',
      requiredFeatures: ['migration-scripts', 'version-control', 'rollback-capability']
    },
    {
      id: 'collaborative-editing',
      name: '협업 편집',
      description: '여러 사용자가 동시에 데이터를 편집할 때의 충돌 해결',
      userIntent: '팀 협업 지원',
      frequency: 'medium',
      complexity: 'complex',
      requiredFeatures: ['conflict-resolution', 'real-time-sync', 'change-tracking']
    }
  ]

  async analyzeGaps(): Promise<TemplateGap[]> {
    console.log('🔍 Starting template gap analysis...\n')

    // 현재 사용 가능한 템플릿 조회
    const currentTemplates = await this.fetchCurrentTemplates()
    console.log(`📋 Found ${currentTemplates.length} current templates\n`)

    const gaps: TemplateGap[] = []

    for (const scenario of this.USER_SCENARIOS) {
      console.log(`🎯 Analyzing scenario: ${scenario.name}`)

      const gap = await this.analyzeScenario(scenario, currentTemplates)
      gaps.push(gap)

      const coverageIcon = gap.coverageScore >= 80 ? '✅' : gap.coverageScore >= 50 ? '⚠️' : '❌'
      console.log(`   ${coverageIcon} Coverage: ${gap.coverageScore}%`)

      if (gap.recommendedTemplate) {
        console.log(`   💡 Recommended: ${gap.recommendedTemplate.identifier}`)
      }
    }

    return gaps
  }

  private async fetchCurrentTemplates(): Promise<any[]> {
    const query = `
      query GetAllTemplates {
        searchTemplates(pagination: { limit: 100 }) {
          templates {
            identifier
            name
            description
            tags
            query
            operationType
          }
        }
      }
    `

    try {
      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })

      const result = await response.json()
      return result.data?.searchTemplates?.templates || []
    } catch (error) {
      console.warn(`⚠️ Failed to fetch templates: ${error}`)
      return []
    }
  }

  private async analyzeScenario(scenario: UserScenario, templates: any[]): Promise<TemplateGap> {
    // 시나리오와 매칭되는 템플릿 찾기
    const matchingTemplates = this.findMatchingTemplates(scenario, templates)

    // 기능 커버리지 계산
    const coverageScore = this.calculateCoverageScore(scenario, matchingTemplates, templates)

    // 누락된 기능 식별
    const missingFeatures = this.identifyMissingFeatures(scenario, matchingTemplates, templates)

    // 신규 템플릿 추천
    const recommendedTemplate = coverageScore < 80 ?
      this.generateTemplateRecommendation(scenario, missingFeatures) : null

    return {
      scenario,
      matchingTemplates: matchingTemplates.map(t => t.identifier),
      coverageScore,
      missingFeatures,
      recommendedTemplate
    }
  }

  private findMatchingTemplates(scenario: UserScenario, templates: any[]): any[] {
    const matching: any[] = []
    const scenarioKeywords = [
      ...scenario.name.toLowerCase().split(' '),
      ...scenario.description.toLowerCase().split(' '),
      ...scenario.requiredFeatures
    ]

    for (const template of templates) {
      const templateText = [
        template.identifier,
        template.name,
        template.description,
        ...(template.tags || []),
        template.query
      ].join(' ').toLowerCase()

      let matchScore = 0
      for (const keyword of scenarioKeywords) {
        if (templateText.includes(keyword)) {
          matchScore++
        }
      }

      // 매칭 점수가 임계값 이상인 템플릿만 포함
      if (matchScore >= 2) {
        matching.push({ ...template, matchScore })
      }
    }

    return matching.sort((a, b) => b.matchScore - a.matchScore)
  }

  private calculateCoverageScore(scenario: UserScenario, matchingTemplates: any[], allTemplates: any[]): number {
    if (scenario.requiredFeatures.length === 0) return 100

    let coveredFeatures = 0

    for (const feature of scenario.requiredFeatures) {
      // 매칭된 템플릿들이 이 기능을 제공하는지 확인
      const isFeatureCovered = matchingTemplates.some(template => {
        const templateContent = [
          template.identifier,
          template.name,
          template.description,
          template.query
        ].join(' ').toLowerCase()

        return templateContent.includes(feature.toLowerCase())
      })

      if (isFeatureCovered) {
        coveredFeatures++
      }
    }

    return Math.round((coveredFeatures / scenario.requiredFeatures.length) * 100)
  }

  private identifyMissingFeatures(scenario: UserScenario, matchingTemplates: any[], allTemplates: any[]): string[] {
    const missing: string[] = []

    for (const feature of scenario.requiredFeatures) {
      const isFeatureCovered = matchingTemplates.some(template => {
        const templateContent = [
          template.identifier,
          template.name,
          template.description,
          template.query
        ].join(' ').toLowerCase()

        return templateContent.includes(feature.toLowerCase())
      })

      if (!isFeatureCovered) {
        missing.push(feature)
      }
    }

    return missing
  }

  private generateTemplateRecommendation(scenario: UserScenario, missingFeatures: string[]): NewTemplateRecommendation {
    const identifier = scenario.id.replace(/-/g, '-')

    // 우선순위 결정
    let priority: 'critical' | 'high' | 'medium' | 'low' = 'medium'
    if (scenario.frequency === 'high' && scenario.complexity === 'simple') priority = 'critical'
    else if (scenario.frequency === 'high') priority = 'high'
    else if (scenario.frequency === 'low') priority = 'low'

    // 개발 노력 추정
    let estimatedEffort: 'small' | 'medium' | 'large' = 'medium'
    if (scenario.complexity === 'simple') estimatedEffort = 'small'
    else if (scenario.complexity === 'complex') estimatedEffort = 'large'

    // 쿼리 구조 생성
    const queryStructure = this.generateQueryStructure(scenario)

    return {
      identifier,
      name: scenario.name,
      description: `${scenario.description} - ${scenario.userIntent}`,
      priority,
      estimatedEffort,
      dependencies: this.identifyDependencies(scenario),
      queryStructure
    }
  }

  private generateQueryStructure(scenario: UserScenario): string {
    // 시나리오에 따라 기본 쿼리 구조 생성
    const operationType = scenario.requiredFeatures.some(f =>
      ['create', 'update', 'delete', 'import'].some(op => f.includes(op))
    ) ? 'mutation' : scenario.requiredFeatures.some(f => f.includes('subscription')) ? 'subscription' : 'query'

    switch (scenario.id) {
      case 'bulk-data-import':
        return `mutation BulkImport($input: BulkImportInput!) {
  bulkImport(input: $input) {
    success
    processedCount
    errors { message line }
    progress { total processed percentage }
  }
}`

      case 'real-time-monitoring':
        return `subscription SystemMonitoring {
  systemMetrics {
    timestamp
    cpu { usage percentage }
    memory { used total percentage }
    database { connections queries_per_second }
  }
}`

      case 'data-validation':
        return `query ValidateData($options: ValidationOptions) {
  validateDataIntegrity(options: $options) {
    isValid
    issues {
      type
      severity
      message
      affectedNodes
    }
    summary {
      totalChecks
      passedChecks
      failedChecks
    }
  }
}`

      default:
        return `${operationType} ${scenario.name.replace(/\s+/g, '')} {
  # Implementation needed based on requirements
}`
    }
  }

  private identifyDependencies(scenario: UserScenario): string[] {
    const dependencies: string[] = []

    // 일반적인 의존성 식별
    if (scenario.requiredFeatures.includes('file-upload')) {
      dependencies.push('file-handling-system')
    }
    if (scenario.requiredFeatures.includes('real-time-metrics')) {
      dependencies.push('monitoring-infrastructure')
    }
    if (scenario.requiredFeatures.includes('authentication')) {
      dependencies.push('auth-system')
    }

    return dependencies
  }

  async generateReport(gaps: TemplateGap[]): Promise<void> {
    console.log('\n' + '='.repeat(80))
    console.log('📊 TEMPLATE GAP ANALYSIS REPORT')
    console.log('='.repeat(80))

    // 전체 요약
    const totalScenarios = gaps.length
    const wellCovered = gaps.filter(g => g.coverageScore >= 80).length
    const partiallyCovered = gaps.filter(g => g.coverageScore >= 50 && g.coverageScore < 80).length
    const poorlyCovered = gaps.filter(g => g.coverageScore < 50).length

    console.log(`\n📈 Coverage Summary:`)
    console.log(`   Total Scenarios: ${totalScenarios}`)
    console.log(`   Well Covered (≥80%): ${wellCovered} (${Math.round(wellCovered/totalScenarios*100)}%)`)
    console.log(`   Partially Covered (50-79%): ${partiallyCovered} (${Math.round(partiallyCovered/totalScenarios*100)}%)`)
    console.log(`   Poorly Covered (<50%): ${poorlyCovered} (${Math.round(poorlyCovered/totalScenarios*100)}%)`)

    // 우선순위별 신규 템플릿 추천
    const recommendations = gaps
      .filter(g => g.recommendedTemplate)
      .map(g => g.recommendedTemplate!)
      .sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      })

    console.log(`\n🎯 Priority Template Recommendations:`)
    recommendations.forEach((rec, index) => {
      const priorityIcon = rec.priority === 'critical' ? '🔥' : rec.priority === 'high' ? '⭐' : rec.priority === 'medium' ? '👍' : '📝'
      console.log(`   ${priorityIcon} ${index + 1}. ${rec.identifier}`)
      console.log(`      Priority: ${rec.priority} | Effort: ${rec.estimatedEffort}`)
      console.log(`      Description: ${rec.description}`)
      if (rec.dependencies.length > 0) {
        console.log(`      Dependencies: ${rec.dependencies.join(', ')}`)
      }
    })

    // 상세 갭 분석
    console.log(`\n📋 Detailed Gap Analysis:`)
    gaps.forEach((gap, index) => {
      const coverageIcon = gap.coverageScore >= 80 ? '✅' : gap.coverageScore >= 50 ? '⚠️' : '❌'
      console.log(`\n   ${coverageIcon} ${index + 1}. ${gap.scenario.name} (${gap.coverageScore}% covered)`)
      console.log(`      Intent: ${gap.scenario.userIntent}`)
      console.log(`      Frequency: ${gap.scenario.frequency} | Complexity: ${gap.scenario.complexity}`)

      if (gap.matchingTemplates.length > 0) {
        console.log(`      Matching Templates: ${gap.matchingTemplates.slice(0, 3).join(', ')}${gap.matchingTemplates.length > 3 ? '...' : ''}`)
      }

      if (gap.missingFeatures.length > 0) {
        console.log(`      Missing Features: ${gap.missingFeatures.join(', ')}`)
      }
    })

    console.log('\n' + '='.repeat(80))
  }

  async exportResults(gaps: TemplateGap[], filename: string = 'template-gap-analysis.json'): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalScenarios: gaps.length,
        wellCovered: gaps.filter(g => g.coverageScore >= 80).length,
        partiallyCovered: gaps.filter(g => g.coverageScore >= 50 && g.coverageScore < 80).length,
        poorlyCovered: gaps.filter(g => g.coverageScore < 50).length,
        averageCoverage: Math.round(gaps.reduce((sum, g) => sum + g.coverageScore, 0) / gaps.length)
      },
      recommendations: gaps
        .filter(g => g.recommendedTemplate)
        .map(g => g.recommendedTemplate)
        .sort((a, b) => {
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
          return priorityOrder[b!.priority] - priorityOrder[a!.priority]
        }),
      gaps
    }

    await Bun.write(filename, JSON.stringify(report, null, 2))
    console.log(`\n💾 Gap analysis exported to ${filename}`)
  }
}

// CLI 인터페이스
async function main() {
  const analyzer = new TemplateGapAnalyzer()

  try {
    const gaps = await analyzer.analyzeGaps()
    await analyzer.generateReport(gaps)
    await analyzer.exportResults(gaps)
  } catch (error) {
    console.error(`❌ Analysis failed: ${error}`)
    process.exit(1)
  }
}

if (import.meta.main) {
  main().catch(console.error)
}

export { TemplateGapAnalyzer }
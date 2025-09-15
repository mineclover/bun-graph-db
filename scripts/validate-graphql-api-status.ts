#!/usr/bin/env bun
/**
 * GraphQL API 상태 검증 도구
 *
 * 이 스크립트는 GraphQL API의 현재 구현 상태를 검증하고
 * PRIORITY_API_IMPLEMENTATION_STATUS.md와 동기화합니다.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

interface APIEndpoint {
  name: string
  type: 'Query' | 'Mutation' | 'Subscription'
  expectedFile: string
  phase: string
  priority: 'High' | 'Medium' | 'Low'
  status: 'implemented' | 'partial' | 'missing' | 'deprecated'
}

// Phase 1A: 핵심 노드 관리 (최우선)
const PHASE_1A_ENDPOINTS: APIEndpoint[] = [
  {
    name: 'node',
    type: 'Query',
    expectedFile: 'queries/NodeQueries.ts',
    phase: '1A',
    priority: 'High',
    status: 'implemented',
  },
  {
    name: 'nodes',
    type: 'Query',
    expectedFile: 'queries/NodeQueries.ts',
    phase: '1A',
    priority: 'High',
    status: 'implemented',
  },
  {
    name: 'nodeByContent',
    type: 'Query',
    expectedFile: 'queries/NodeQueries.ts',
    phase: '1A',
    priority: 'High',
    status: 'implemented',
  },
  {
    name: 'createNode',
    type: 'Mutation',
    expectedFile: 'mutations/NodeMutations.ts',
    phase: '1A',
    priority: 'High',
    status: 'implemented',
  },
  {
    name: 'updateNode',
    type: 'Mutation',
    expectedFile: 'mutations/NodeMutations.ts',
    phase: '1A',
    priority: 'High',
    status: 'implemented',
  },
  {
    name: 'deleteNode',
    type: 'Mutation',
    expectedFile: 'mutations/NodeMutations.ts',
    phase: '1A',
    priority: 'High',
    status: 'implemented',
  },
]

// Phase 1B: 기본 테이블 관리
const PHASE_1B_ENDPOINTS: APIEndpoint[] = [
  {
    name: 'table',
    type: 'Query',
    expectedFile: 'queries/TableQueries.ts',
    phase: '1B',
    priority: 'High',
    status: 'implemented',
  },
  {
    name: 'tables',
    type: 'Query',
    expectedFile: 'queries/TableQueries.ts',
    phase: '1B',
    priority: 'High',
    status: 'implemented',
  },
  {
    name: 'tableByIdentifier',
    type: 'Query',
    expectedFile: 'queries/TableQueries.ts',
    phase: '1B',
    priority: 'High',
    status: 'implemented',
  },
  {
    name: 'createTable',
    type: 'Mutation',
    expectedFile: 'mutations/TableMutations.ts',
    phase: '1B',
    priority: 'High',
    status: 'implemented',
  },
  {
    name: 'updateTable',
    type: 'Mutation',
    expectedFile: 'mutations/TableMutations.ts',
    phase: '1B',
    priority: 'High',
    status: 'implemented',
  },
  {
    name: 'deleteTable',
    type: 'Mutation',
    expectedFile: 'mutations/TableMutations.ts',
    phase: '1B',
    priority: 'High',
    status: 'implemented',
  },
]

// Phase 1C: 템플릿 시스템 핵심 (차별화 기능)
const PHASE_1C_ENDPOINTS: APIEndpoint[] = [
  {
    name: 'getTemplate',
    type: 'Query',
    expectedFile: 'queries/TemplateQueries.ts',
    phase: '1C',
    priority: 'High',
    status: 'implemented',
  },
  {
    name: 'searchTemplates',
    type: 'Query',
    expectedFile: 'queries/TemplateQueries.ts',
    phase: '1C',
    priority: 'High',
    status: 'implemented',
  },
  {
    name: 'executeTemplate',
    type: 'Query',
    expectedFile: 'queries/TemplateQueries.ts',
    phase: '1C',
    priority: 'High',
    status: 'implemented',
  },
  {
    name: 'getPopularTemplates',
    type: 'Query',
    expectedFile: 'queries/TemplateQueries.ts',
    phase: '1C',
    priority: 'Medium',
    status: 'implemented',
  },
  {
    name: 'createTemplate',
    type: 'Mutation',
    expectedFile: 'mutations/TemplateMutations.ts',
    phase: '1C',
    priority: 'High',
    status: 'implemented',
  },
  {
    name: 'executeTemplate',
    type: 'Mutation',
    expectedFile: 'mutations/TemplateMutations.ts',
    phase: '1C',
    priority: 'High',
    status: 'implemented',
  },
  {
    name: 'activateTemplate',
    type: 'Mutation',
    expectedFile: 'mutations/TemplateMutations.ts',
    phase: '1C',
    priority: 'Medium',
    status: 'implemented',
  },
]

// Phase 2A: 관계 관리
const PHASE_2A_ENDPOINTS: APIEndpoint[] = [
  {
    name: 'nodeRelations',
    type: 'Query',
    expectedFile: 'queries/RelationQueries.ts',
    phase: '2A',
    priority: 'High',
    status: 'implemented',
  },
  {
    name: 'searchRelatedNodes',
    type: 'Query',
    expectedFile: 'queries/RelationQueries.ts',
    phase: '2A',
    priority: 'High',
    status: 'implemented',
  },
  {
    name: 'getDependencyChain',
    type: 'Query',
    expectedFile: 'queries/RelationQueries.ts',
    phase: '2A',
    priority: 'Medium',
    status: 'implemented',
  },
  {
    name: 'relationType',
    type: 'Query',
    expectedFile: 'queries/RelationQueries.ts',
    phase: '2A',
    priority: 'Low',
    status: 'implemented',
  },
  {
    name: 'relationTypes',
    type: 'Query',
    expectedFile: 'queries/RelationQueries.ts',
    phase: '2A',
    priority: 'Low',
    status: 'implemented',
  },
  {
    name: 'createRelation',
    type: 'Mutation',
    expectedFile: 'mutations/RelationMutations.ts',
    phase: '2A',
    priority: 'High',
    status: 'implemented',
  },
  {
    name: 'deleteRelation',
    type: 'Mutation',
    expectedFile: 'mutations/RelationMutations.ts',
    phase: '2A',
    priority: 'High',
    status: 'implemented',
  },
  {
    name: 'createRelationType',
    type: 'Mutation',
    expectedFile: 'mutations/RelationMutations.ts',
    phase: '2A',
    priority: 'Medium',
    status: 'implemented',
  },
]

// Phase 3A: 고급 검색 (향후 구현 예정)
const PHASE_3A_ENDPOINTS: APIEndpoint[] = [
  // searchNodes는 NodeQueries.ts에 이미 있음
  // advancedSearch는 보안 이슈로 제거됨 (SQL Injection 위험)
  // 향후 안전한 고급 검색 기능 새로 설계 예정
]

// Phase 3B: 분석 및 집계 (향후 구현 예정)
const PHASE_3B_ENDPOINTS: APIEndpoint[] = [
  // 향후 새로운 설계로 구현 예정
]

const ALL_ENDPOINTS = [
  ...PHASE_1A_ENDPOINTS,
  ...PHASE_1B_ENDPOINTS,
  ...PHASE_1C_ENDPOINTS,
  ...PHASE_2A_ENDPOINTS,
  ...PHASE_3A_ENDPOINTS,
  ...PHASE_3B_ENDPOINTS,
]

interface ValidationResult {
  endpoint: APIEndpoint
  fileExists: boolean
  methodExists: boolean
  issues: string[]
  recommendations: string[]
}

class GraphQLAPIValidator {
  private srcPath = join(process.cwd(), 'src')
  private graphqlPath = join(this.srcPath, 'presentation', 'graphql')

  async validateAllEndpoints(): Promise<ValidationResult[]> {
    console.log('🔍 GraphQL API 상태 검증 시작...\n')

    const results: ValidationResult[] = []

    for (const endpoint of ALL_ENDPOINTS) {
      const result = await this.validateEndpoint(endpoint)
      results.push(result)
    }

    return results
  }

  private async validateEndpoint(endpoint: APIEndpoint): Promise<ValidationResult> {
    const result: ValidationResult = {
      endpoint,
      fileExists: false,
      methodExists: false,
      issues: [],
      recommendations: [],
    }

    // 1. 파일 존재 확인
    const filePath = join(this.graphqlPath, endpoint.expectedFile)
    result.fileExists = existsSync(filePath)

    if (!result.fileExists) {
      result.issues.push(`파일이 존재하지 않음: ${endpoint.expectedFile}`)
      result.recommendations.push('해당 리졸버 파일 생성 필요')
      return result
    }

    // 2. 메서드 존재 확인
    try {
      const fileContent = readFileSync(filePath, 'utf-8')
      const methodPattern = new RegExp(`(async\\s+)?${endpoint.name}\\s*\\(`, 'i')
      result.methodExists = methodPattern.test(fileContent)

      if (!result.methodExists) {
        result.issues.push(`메서드가 존재하지 않음: ${endpoint.name}`)
        result.recommendations.push(`${endpoint.name} 메서드 구현 필요`)
      }

      // 3. 특별한 검증 로직들
      await this.validateSpecialCases(endpoint, fileContent, result)
    } catch (error) {
      result.issues.push(`파일 읽기 오류: ${error}`)
    }

    return result
  }

  private async validateSpecialCases(
    endpoint: APIEndpoint,
    fileContent: string,
    result: ValidationResult
  ): Promise<void> {
    // executeTemplate 특별 검증 (핵심 기능)
    if (endpoint.name === 'executeTemplate') {
      if (!fileContent.includes('JSON') || !fileContent.includes('schema')) {
        result.issues.push('JSON Schema 검증 로직이 없을 수 있음')
        result.recommendations.push('JSON Schema 기반 변수 검증 구현 확인 필요')
      }

      if (!fileContent.includes('error') && !fileContent.includes('Error')) {
        result.issues.push('에러 핸들링 로직이 부족할 수 있음')
        result.recommendations.push('GraphQL 실행 오류 핸들링 강화 필요')
      }
    }

    // advancedSearch 보안 검증
    if (endpoint.name === 'advancedSearch') {
      if (fileContent.includes('SQL') || fileContent.includes('sql')) {
        result.issues.push('⚠️ Raw SQL 쿼리 생성 감지 - 보안 검토 필요')
        result.recommendations.push('SQL Injection 방지 로직 재검토 및 보안 테스트 필요')
      }
    }

    // deleteTable 안전장치 검증
    if (endpoint.name === 'deleteTable') {
      if (!fileContent.includes('confirm') && !fileContent.includes('force')) {
        result.issues.push('⚠️ 안전장치가 없을 수 있음 - 데이터 손실 위험')
        result.recommendations.push('삭제 확인 로직 및 연쇄 삭제 방지 구현 필요')
      }
    }

    // Mock 데이터 감지 (Phase 3B)
    if (endpoint.phase === '3B') {
      if (
        fileContent.includes('mock') ||
        fileContent.includes('Mock') ||
        fileContent.includes('dummy')
      ) {
        result.issues.push('Mock 데이터 구현 상태')
        result.recommendations.push('실제 구현 로직으로 전환 필요 (Phase 3B 목표)')
      }
    }
  }

  generateReport(results: ValidationResult[]): void {
    console.log('📊 GraphQL API 검증 결과 리포트\n')
    console.log('='.repeat(60))

    // Phase별 요약
    const phaseGroups = this.groupByPhase(results)

    for (const [phase, phaseResults] of Object.entries(phaseGroups)) {
      this.printPhaseReport(phase, phaseResults)
    }

    // 전체 요약
    this.printOverallSummary(results)

    // 즉시 해결 필요한 이슈들
    this.printCriticalIssues(results)

    // 다음 단계 권장사항
    this.printNextSteps(results)
  }

  private groupByPhase(results: ValidationResult[]): Record<string, ValidationResult[]> {
    return results.reduce(
      (groups, result) => {
        const phase = result.endpoint.phase
        if (!groups[phase]) {
          groups[phase] = []
        }
        groups[phase].push(result)
        return groups
      },
      {} as Record<string, ValidationResult[]>
    )
  }

  private printPhaseReport(phase: string, results: ValidationResult[]): void {
    const phaseNames: Record<string, string> = {
      '1A': '🎯 Phase 1A: 핵심 노드 관리',
      '1B': '🎯 Phase 1B: 기본 테이블 관리',
      '1C': '🎯 Phase 1C: 템플릿 시스템 핵심',
      '2A': '🔗 Phase 2A: 관계 관리',
      '3A': '🔍 Phase 3A: 고급 검색 (향후 구현)',
      '3B': '🔍 Phase 3B: 분석 및 집계 (향후 구현)',
    }

    console.log(`\n${phaseNames[phase] || phase}`)
    console.log('-'.repeat(40))

    const implemented = results.filter((r) => r.fileExists && r.methodExists).length
    const total = results.length
    const percentage = Math.round((implemented / total) * 100)

    console.log(`진행률: ${implemented}/${total} (${percentage}%) 구현 완료`)

    for (const result of results) {
      const status = this.getStatusEmoji(result)
      const priority =
        result.endpoint.priority === 'High'
          ? '⚡'
          : result.endpoint.priority === 'Medium'
            ? '🔸'
            : '🔹'

      console.log(`  ${status} ${priority} ${result.endpoint.name} (${result.endpoint.type})`)

      if (result.issues.length > 0) {
        result.issues.forEach((issue) => {
          console.log(`    ❌ ${issue}`)
        })
      }

      if (result.recommendations.length > 0 && result.endpoint.priority === 'High') {
        result.recommendations.slice(0, 1).forEach((rec) => {
          console.log(`    💡 ${rec}`)
        })
      }
    }
  }

  private getStatusEmoji(result: ValidationResult): string {
    if (!result.fileExists) return '❌'
    if (!result.methodExists) return '❌'
    if (result.issues.some((i) => i.includes('Mock'))) return '🚧'
    if (result.issues.some((i) => i.includes('⚠️'))) return '⚠️'
    if (result.issues.length > 0) return '🧪'
    return '✅'
  }

  private printOverallSummary(results: ValidationResult[]): void {
    console.log(`\n${'='.repeat(60)}`)
    console.log('📈 전체 진행 상황 요약')
    console.log('='.repeat(60))

    const totalEndpoints = results.length
    const fullyImplemented = results.filter(
      (r) => r.fileExists && r.methodExists && r.issues.length === 0
    ).length
    const partiallyImplemented = results.filter(
      (r) => r.fileExists && r.methodExists && r.issues.length > 0
    ).length
    const notImplemented = results.filter((r) => !r.fileExists || !r.methodExists).length

    console.log(
      `✅ 완전 구현: ${fullyImplemented}/${totalEndpoints} (${Math.round((fullyImplemented / totalEndpoints) * 100)}%)`
    )
    console.log(
      `🧪 테스트 필요: ${partiallyImplemented}/${totalEndpoints} (${Math.round((partiallyImplemented / totalEndpoints) * 100)}%)`
    )
    console.log(
      `❌ 미구현: ${notImplemented}/${totalEndpoints} (${Math.round((notImplemented / totalEndpoints) * 100)}%)`
    )

    // Phase 1 (핵심 기능) 완성도
    const phase1Results = results.filter((r) => r.endpoint.phase.startsWith('1'))
    const phase1Ready = phase1Results.filter(
      (r) => r.fileExists && r.methodExists && !r.issues.some((i) => i.includes('⚠️'))
    ).length

    console.log(
      `\n🎯 Phase 1 (핵심 기능) 완성도: ${phase1Ready}/${phase1Results.length} (${Math.round((phase1Ready / phase1Results.length) * 100)}%)`
    )
  }

  private printCriticalIssues(results: ValidationResult[]): void {
    const criticalResults = results.filter(
      (r) => r.issues.some((issue) => issue.includes('⚠️')) && r.endpoint.priority === 'High'
    )

    if (criticalResults.length > 0) {
      console.log(`\n🚨 즉시 해결 필요한 이슈들`)
      console.log('='.repeat(60))

      criticalResults.forEach((result) => {
        console.log(`⚡ ${result.endpoint.name} (Phase ${result.endpoint.phase})`)
        result.issues.forEach((issue) => {
          if (issue.includes('⚠️')) {
            console.log(`  🚨 ${issue}`)
          }
        })
        result.recommendations.forEach((rec) => {
          console.log(`  🔧 ${rec}`)
        })
        console.log()
      })
    }
  }

  private printNextSteps(results: ValidationResult[]): void {
    console.log(`\n🚀 다음 단계 권장사항`)
    console.log('='.repeat(60))

    // Phase 1 우선순위
    const phase1Issues = results.filter(
      (r) =>
        r.endpoint.phase.startsWith('1') && r.endpoint.priority === 'High' && r.issues.length > 0
    )

    if (phase1Issues.length > 0) {
      console.log('📅 이번 주 최우선 작업:')
      phase1Issues.forEach((result, index) => {
        console.log(
          `  ${index + 1}. ${result.endpoint.name} - ${result.recommendations[0] || '테스트 및 검증 필요'}`
        )
      })
    }

    // 보안 이슈
    const securityIssues = results.filter((r) =>
      r.issues.some((issue) => issue.includes('보안') || issue.includes('SQL'))
    )

    if (securityIssues.length > 0) {
      console.log('\n🛡️ 보안 검토 필요:')
      securityIssues.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.endpoint.name} - 보안 감사 및 테스트`)
      })
    }

    console.log('\n💡 성공 기준:')
    console.log('  - Phase 1 (A+B+C) 모든 API가 ✅ 상태가 되면 핵심 기능 완성!')
    console.log('  - 보안 이슈 0개, 위험 기능 안전장치 구현 완료')
    console.log('  - executeTemplate 기능 완전 검증 완료 (AI 친화성의 핵심)')
  }
}

// 메인 실행
async function main() {
  const validator = new GraphQLAPIValidator()

  try {
    const results = await validator.validateAllEndpoints()
    validator.generateReport(results)

    // 결과를 기반으로 종료 코드 설정
    const criticalIssues = results.filter(
      (r) => r.issues.some((issue) => issue.includes('⚠️')) || !r.fileExists || !r.methodExists
    )

    if (criticalIssues.length > 0) {
      console.log(`\n⚠️ ${criticalIssues.length}개의 이슈가 발견되었습니다.`)
      process.exit(1)
    } else {
      console.log('\n✅ 모든 API가 정상 상태입니다!')
      process.exit(0)
    }
  } catch (error) {
    console.error('❌ 검증 중 오류 발생:', error)
    process.exit(1)
  }
}

// 스크립트가 직접 실행될 때만 main 함수 실행
if (import.meta.main) {
  main()
}

export { GraphQLAPIValidator }

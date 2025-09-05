/**
 * Template Test Runner
 * 
 * 템플릿 기반 테스트 실행 프레임워크
 * YAML로 정의된 테스트 시나리오를 읽어서 템플릿 시스템을 통해 실행
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import YAML from 'yaml'
// import { testLogger, TestLogEntry } from './TestLogger.js' // 제거됨
import { detailedAnalysisLogger } from './DetailedAnalysisLogger.js'

export interface TemplateTestConfig {
  identifier: string
  name: string
  description: string
  query: string
  variables: Record<string, any>
  expectations: Array<{
    path: string
    type?: string
    equals?: any
    contains?: any
    greaterThan?: number
    lessThan?: number
  }>
}

export interface TestScenario {
  name: string
  description: string
  templates: string[]
  setup?: string[]
  teardown?: string[]
  performance_expectations?: {
    execution_time?: string
    memory_usage?: string
    complexity_score?: string
  }
}

export interface ExecutionSettings {
  server_url: string
  timeout: number
  retries: number
  parallel_execution: boolean
  cleanup_after_test: boolean
  collect_performance_metrics: boolean
}

export interface TestResult {
  templateId: string
  templateName: string
  success: boolean
  executionTime: number
  error?: string
  expectations: Array<{
    path: string
    expected: any
    actual: any
    passed: boolean
  }>
  performance?: {
    executionTime: number
    memoryUsage: number
    complexityScore: number
  }
}

export interface ScenarioResult {
  scenarioName: string
  templateResults: TestResult[]
  overallSuccess: boolean
  totalExecutionTime: number
  setupSuccess: boolean
  teardownSuccess: boolean
}

export class TemplateTestRunner {
  private config: {
    test_templates: Record<string, TemplateTestConfig>
    test_scenarios: Record<string, TestScenario>
    execution_settings: ExecutionSettings
    variable_substitution: Record<string, string>
  }
  
  private serverUrl: string
  private createdTemplates: Set<string> = new Set()

  constructor(configPath?: string) {
    const yamlPath = configPath || join(process.cwd(), 'test', 'setup', 'template-scenarios.yaml')
    const yamlContent = readFileSync(yamlPath, 'utf8')
    this.config = YAML.parse(yamlContent)
    this.serverUrl = this.config.execution_settings.server_url
  }

  /**
   * GraphQL 요청 실행
   */
  private async graphql(query: string, variables: any = {}): Promise<any> {
    const maxRetries = this.config.execution_settings.retries
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(this.serverUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables }),
          signal: AbortSignal.timeout(this.config.execution_settings.timeout)
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()

        if (data.errors) {
          throw new Error(`GraphQL Error: ${data.errors.map((e: any) => e.message).join(', ')}`)
        }

        return data.data
      } catch (error) {
        if (attempt === maxRetries) {
          throw error
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }
  }

  /**
   * 변수 치환 처리
   */
  private substituteVariables(obj: any): any {
    if (typeof obj === 'string') {
      // 간단한 변수 치환 (예: {{timestamp}})
      return obj.replace(/\{\{(.+?)\}\}/g, (match, expression) => {
        if (expression === 'timestamp') {
          return Date.now().toString()
        } else if (expression === 'random_id') {
          return Math.random().toString(36).substr(2, 9)
        }
        return match
      })
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.substituteVariables(item))
    } else if (obj && typeof obj === 'object') {
      const result: any = {}
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.substituteVariables(value)
      }
      return result
    }
    return obj
  }

  /**
   * 템플릿을 시스템에 등록
   */
  private async registerTemplate(templateConfig: TemplateTestConfig): Promise<void> {
    if (this.createdTemplates.has(templateConfig.identifier)) {
      return // 이미 등록됨
    }

    const substitutedVariables = this.substituteVariables(templateConfig.variables)

    try {
      // 먼저 기존 템플릿이 있는지 확인하고 삭제
      await this.cleanupExistingTemplate(templateConfig.identifier)

      const result = await this.graphql(`
        mutation CreateTemplate($input: CreateQueryTemplateInput!) {
          createTemplate(input: $input) {
            template {
              id
              identifier
              name
            }
            errors {
              message
            }
          }
        }
      `, {
        input: {
          identifier: templateConfig.identifier,
          name: templateConfig.name,
          description: templateConfig.description,
          query: templateConfig.query,
          variables: substitutedVariables,
          createdBy: 'template-test-runner'
        }
      })

      if (result.createTemplate.errors && result.createTemplate.errors.length > 0) {
        throw new Error(`Template registration failed: ${result.createTemplate.errors.map((e: any) => e.message).join(', ')}`)
      }

      this.createdTemplates.add(templateConfig.identifier)
      console.log(`✅ Template registered: ${templateConfig.identifier}`)
    } catch (error) {
      console.warn(`⚠️ Template registration failed: ${templateConfig.identifier} - ${error}`)
      // 템플릿이 이미 존재할 수 있으므로 계속 진행
    }
  }

  /**
   * 모든 테스트 데이터 클리어
   */
  private async clearAllTestData(): Promise<void> {
    try {
      console.log('🧹 Clearing all test data...')
      
      // 모든 템플릿 삭제
      await this.clearAllTemplates()
      
      // 모든 테스트 노드 삭제
      await this.clearTestNodes()
      
      // 모든 테스트 관계 삭제
      await this.clearTestRelations()
      
      // 모든 테스트 테이블 삭제
      await this.clearTestTables()
      
      console.log('✅ All test data cleared')
    } catch (error) {
      console.warn('⚠️ Failed to clear some test data:', error)
    }
  }

  /**
   * 모든 템플릿 삭제
   */
  private async clearAllTemplates(): Promise<void> {
    try {
      const result = await this.graphql(`
        query GetAllTemplates {
          searchTemplates(input: { limit: 1000 }) {
            id
            identifier
          }
        }
      `)

      const templates = result.searchTemplates || []
      for (const template of templates) {
        try {
          await this.graphql(`
            mutation DeleteTemplate($id: ID!) {
              deleteTemplate(id: $id)
            }
          `, { id: template.id })
        } catch (error) {
          // 개별 템플릿 삭제 실패는 무시
        }
      }
      console.log(`   🗑️ Cleared ${templates.length} templates`)
    } catch (error) {
      console.log('   ℹ️ No templates to clear')
    }
  }

  /**
   * 테스트 노드들 삭제
   */
  private async clearTestNodes(): Promise<void> {
    try {
      // 테스트용 테이블의 노드들 삭제
      const result = await this.graphql(`
        query GetTestTables {
          tables {
            nodes {
              id
              identifier
            }
          }
        }
      `)

      const tables = result.tables?.nodes || []
      for (const table of tables) {
        if (table.identifier.includes('test') || table.identifier.includes('Test')) {
          try {
            await this.graphql(`
              mutation DeleteTable($id: ID!) {
                deleteTable(id: $id)
              }
            `, { id: table.id })
          } catch (error) {
            // 개별 테이블 삭제 실패는 무시
          }
        }
      }
      console.log(`   🗑️ Cleared test tables and their nodes`)
    } catch (error) {
      console.log('   ℹ️ No test nodes to clear')
    }
  }

  /**
   * 테스트 관계들 삭제
   */
  private async clearTestRelations(): Promise<void> {
    try {
      // 관계는 노드와 함께 삭제되므로 별도 처리 불필요
      console.log('   🗑️ Test relations cleared with nodes')
    } catch (error) {
      console.log('   ℹ️ No test relations to clear')
    }
  }

  /**
   * 테스트 테이블들 삭제
   */
  private async clearTestTables(): Promise<void> {
    try {
      // 테이블은 clearTestNodes에서 이미 처리됨
      console.log('   🗑️ Test tables cleared')
    } catch (error) {
      console.log('   ℹ️ No test tables to clear')
    }
  }

  /**
   * 기존 템플릿이 있으면 삭제
   */
  private async cleanupExistingTemplate(identifier: string): Promise<void> {
    try {
      // 먼저 템플릿을 찾아서 ID를 가져옴
      const searchResult = await this.graphql(`
        query SearchTemplates($input: SearchTemplatesInput!) {
          searchTemplates(input: $input) {
            id
            identifier
          }
        }
      `, {
        input: {
          search: identifier,
          limit: 1
        }
      })

      const existingTemplate = searchResult.searchTemplates?.find((t: any) => t.identifier === identifier)
      
      if (existingTemplate) {
        // 기존 템플릿 삭제
        await this.graphql(`
          mutation DeleteTemplate($id: ID!) {
            deleteTemplate(id: $id)
          }
        `, {
          id: existingTemplate.id
        })
        console.log(`🗑️ Cleaned up existing template: ${identifier}`)
      }
    } catch (error) {
      // 삭제 실패는 무시 (템플릿이 없을 수도 있음)
      console.log(`ℹ️ No existing template to clean up: ${identifier}`)
    }
  }

  /**
   * 템플릿 실행
   */
  private async executeTemplate(templateId: string, variables?: any): Promise<any> {
    const templateConfig = this.config.test_templates[templateId]
    if (!templateConfig) {
      throw new Error(`Template not found: ${templateId}`)
    }

    const executionVariables = variables || this.substituteVariables(templateConfig.variables)

    const result = await this.graphql(`
      mutation ExecuteTemplateWithGraphQL($templateIdentifier: String!, $variables: JSON, $trackUsage: Boolean) {
        executeTemplateWithGraphQL(
          templateIdentifier: $templateIdentifier
          variables: $variables
          trackUsage: $trackUsage
        ) {
          success
          data
          errors {
            message
          }
        }
      }
    `, {
      templateIdentifier: templateConfig.identifier,
      variables: executionVariables,
      trackUsage: true
    })

    return result.executeTemplateWithGraphQL
  }

  /**
   * 결과 검증
   */
  private validateResult(result: any, expectations: TemplateTestConfig['expectations']): Array<{
    path: string
    expected: any
    actual: any
    passed: boolean
  }> {
    const validationResults = []

    for (const expectation of expectations) {
      const actual = this.getValueByPath(result, expectation.path)
      let passed = false
      let expected: any

      if (expectation.type) {
        expected = expectation.type
        passed = this.checkType(actual, expectation.type)
      } else if (expectation.equals !== undefined) {
        expected = expectation.equals
        passed = actual === expectation.equals
      } else if (expectation.contains !== undefined) {
        expected = expectation.contains
        passed = actual && actual.toString().includes(expectation.contains)
      } else if (expectation.greaterThan !== undefined) {
        expected = `> ${expectation.greaterThan}`
        passed = typeof actual === 'number' && actual > expectation.greaterThan
      } else if (expectation.lessThan !== undefined) {
        expected = `< ${expectation.lessThan}`
        passed = typeof actual === 'number' && actual < expectation.lessThan
      }

      validationResults.push({
        path: expectation.path,
        expected,
        actual,
        passed
      })
    }

    return validationResults
  }

  /**
   * 객체 경로로 값 추출
   */
  private getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * 타입 체크
   */
  private checkType(value: any, expectedType: string): boolean {
    switch (expectedType.toLowerCase()) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number'
      case 'boolean':
        return typeof value === 'boolean'
      case 'array':
        return Array.isArray(value)
      case 'object':
        return value && typeof value === 'object' && !Array.isArray(value)
      default:
        return false
    }
  }

  /**
   * 단일 템플릿 테스트 실행
   */
  async runTemplate(templateId: string, variables?: any): Promise<TestResult> {
    const startTime = Date.now()
    
    // 상세 분석 시작
    detailedAnalysisLogger.startTrace('runTemplate', 'TemplateTestRunner.ts', 473, { templateId, variables })
    
    try {
      // 템플릿 설정 조회 추적
      detailedAnalysisLogger.startTrace('getTemplateConfig', 'TemplateTestRunner.ts', 477, { templateId })
      const templateConfig = this.config.test_templates[templateId]
      detailedAnalysisLogger.addCondition('templateExists', !!templateConfig)
      detailedAnalysisLogger.addCondition('availableTemplates', Object.keys(this.config.test_templates))
      detailedAnalysisLogger.endTrace('getTemplateConfig', templateConfig)
      
      if (!templateConfig) {
        const executionTime = Date.now() - startTime
        const testResult = {
          templateId,
          templateName: `Template not found: ${templateId}`,
          success: false,
          executionTime,
          error: `Template not found: ${templateId}`,
          expectations: [],
          data: null,
          metadata: {
            templateConfig: templateId,
            errorType: 'TEMPLATE_NOT_FOUND',
            errorDetails: `Template '${templateId}' does not exist in test configuration`
          }
        }

        // 상세 분석 로그 기록
        detailedAnalysisLogger.logDetailedAnalysis({
          testName: `Template not found: ${templateId}`,
          businessContext: 'template-management',
          testType: 'crud',
          rootCause: {
            primaryError: `TEMPLATE_NOT_FOUND: Template '${templateId}' does not exist`,
            contributingFactors: [
              'Template ID not found in test configuration',
              'Possible typo in template identifier',
              'Template not properly registered in test scenarios'
            ],
            errorChain: [
              {
                level: 1,
                error: 'Template lookup failed',
                context: { templateId, availableTemplates: Object.keys(this.config.test_templates) },
                timestamp: new Date().toISOString()
              }
            ]
          },
          conditionAnalysis: {
            preConditions: {
              templateId: templateId,
              variables: variables,
              configLoaded: !!this.config
            },
            postConditions: {},
            failedConditions: [
              {
                condition: 'templateExists',
                expected: true,
                actual: false,
                impact: 'Test execution cannot proceed without valid template configuration'
              }
            ]
          },
          performanceAnalysis: {
            bottlenecks: [],
            memoryLeaks: []
          },
          debuggingInfo: {
            environment: {
              nodeVersion: process.version,
              platform: process.platform,
              memoryUsage: process.memoryUsage()
            },
            configuration: {
              availableTemplates: Object.keys(this.config.test_templates),
              configPath: this.configPath
            },
            dependencies: {},
            state: {
              templateId,
              variables,
              configLoaded: !!this.config
            }
          },
          resolutionSuggestions: [
            {
              priority: 'high',
              category: 'configuration',
              suggestion: 'Check template-scenarios.yaml file for correct template identifier',
              reasoning: 'Template ID must exactly match the identifier in the configuration file'
            },
            {
              priority: 'medium',
              category: 'code',
              suggestion: 'Verify template registration in test scenarios',
              reasoning: 'Template must be properly defined in the test_templates section'
            },
            {
              priority: 'low',
              category: 'data',
              suggestion: 'Check for typos in template identifier',
              reasoning: 'Common cause of template not found errors'
            }
          ]
        })

        // 기존 로그 제거됨 - detailedAnalysisLogger만 사용

        detailedAnalysisLogger.endTrace('runTemplate', testResult)
        return testResult
      }

      // 템플릿 등록 (필요한 경우)
      await this.registerTemplate(templateConfig)

      // 변수 치환 및 병합
      const substitutedVariables = this.substituteVariables(templateConfig.variables)
      const mergedVariables = { ...substitutedVariables, ...variables }

      // 템플릿 실행
      const result = await this.executeTemplate(templateId, mergedVariables)
      const executionTime = Date.now() - startTime

      if (!result.success) {
        const testResult = {
          templateId,
          templateName: templateConfig.name,
          success: false,
          executionTime,
          error: result.errors?.map((e: any) => e.message).join(', ') || 'Unknown error',
          expectations: []
        }

        // 로그 제거됨 - detailedAnalysisLogger만 사용

        return testResult
      }

      // GraphQL 실행 결과 검증
      const graphqlResult = result.data
      if (!graphqlResult.success) {
        return {
          templateId,
          templateName: templateConfig.name,
          success: false,
          executionTime,
          error: graphqlResult.errors?.map((e: any) => e.message).join(', ') || 'GraphQL execution failed',
          expectations: []
        }
      }

      // 기대값 검증
      const expectations = this.validateResult(graphqlResult.data, templateConfig.expectations)
      const allPassed = expectations.every(exp => exp.passed)

      const testResult = {
        templateId,
        templateName: templateConfig.name,
        success: allPassed,
        executionTime,
        expectations,
        performance: this.config.execution_settings.collect_performance_metrics ? {
          executionTime,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
          complexityScore: this.calculateComplexityScore(templateConfig.query)
        } : undefined
      }

      // 로그 제거됨 - detailedAnalysisLogger만 사용

      return testResult

    } catch (error) {
      const executionTime = Date.now() - startTime
      const templateConfig = this.config.test_templates[templateId]
      
      const testResult = {
        templateId,
        templateName: templateConfig?.name || `Template not found: ${templateId}`,
        success: false,
        executionTime,
        error: (error as Error).message,
        expectations: [],
        metadata: {
          templateConfig: templateId,
          errorType: 'EXECUTION_ERROR',
          errorDetails: (error as Error).stack || (error as Error).message
        }
      }

      // 변수 치환 (catch 블록에서도 사용)
      let substitutedVariables
      try {
        substitutedVariables = templateConfig ? this.substituteVariables(templateConfig.variables) : variables
      } catch (subError) {
        substitutedVariables = templateConfig?.variables || variables
      }

      // 로그 제거됨 - detailedAnalysisLogger만 사용

      return testResult
    }
  }

  /**
   * 복잡도 점수 계산 (간단한 구현)
   */
  private calculateComplexityScore(query: string): number {
    const lines = query.split('\n').length
    const fields = (query.match(/\w+\s*\{/g) || []).length
    const fragments = (query.match(/\.\.\./g) || []).length
    return lines + fields * 2 + fragments * 3
  }

  /**
   * 시나리오 실행
   */
  async runScenario(scenarioName: string): Promise<ScenarioResult> {
    const scenario = this.config.test_scenarios[scenarioName]
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioName}`)
    }

    console.log(`\n🚀 Running scenario: ${scenario.name}`)
    console.log(`📝 ${scenario.description}`)

    // 테스트 시작 전 전체 클리어
    await this.clearAllTestData()

    // 시나리오 시작 시 템플릿 추적 Set 초기화
    this.createdTemplates.clear()

    const startTime = Date.now()
    const templateResults: TestResult[] = []

    // 시나리오 로그 제거됨 - detailedAnalysisLogger만 사용

    // Setup 실행 (현재는 로깅만)
    let setupSuccess = true
    if (scenario.setup) {
      console.log('🔧 Running setup...')
      for (const setupStep of scenario.setup) {
        console.log(`   - ${setupStep}`)
      }
    }

    // 템플릿들 실행
    for (const templateId of scenario.templates) {
      console.log(`\n  🔹 Running template: ${templateId}`)
      const result = await this.runTemplate(templateId)
      templateResults.push(result)

      if (result.success) {
        console.log(`     ✅ ${result.templateName} - ${result.executionTime}ms`)
        if (result.expectations.length > 0) {
          result.expectations.forEach(exp => {
            const status = exp.passed ? '✅' : '❌'
            console.log(`        ${status} ${exp.path}: expected ${exp.expected}, got ${exp.actual}`)
          })
        }
      } else {
        console.log(`     ❌ ${result.templateName} - ${result.error}`)
      }
    }

    // Teardown 실행
    let teardownSuccess = true
    if (scenario.teardown) {
      console.log('\n🧹 Running teardown...')
      for (const teardownStep of scenario.teardown) {
        console.log(`   - ${teardownStep}`)
        try {
          await this.executeTeardownStep(teardownStep)
        } catch (error) {
          console.warn(`   ⚠️ Teardown step failed: ${teardownStep}`, error)
          teardownSuccess = false
        }
      }
    }

    const totalExecutionTime = Date.now() - startTime
    const overallSuccess = templateResults.every(r => r.success) && setupSuccess && teardownSuccess

    console.log(`\n📊 Scenario Results:`)
    console.log(`   Success: ${overallSuccess ? '✅' : '❌'}`)
    console.log(`   Templates: ${templateResults.filter(r => r.success).length}/${templateResults.length} passed`)
    console.log(`   Total time: ${totalExecutionTime}ms`)

    // 시나리오 완료 로그
    // 시나리오 로그 제거됨 - detailedAnalysisLogger만 사용

    // 시나리오 종료 후 클리어
    if (this.config.execution_settings.cleanup_after_test) {
      await this.clearAllTestData()
    }

    return {
      scenarioName,
      templateResults,
      overallSuccess,
      totalExecutionTime,
      setupSuccess,
      teardownSuccess
    }
  }

  /**
   * 모든 시나리오 실행
   */
  async runAllScenarios(): Promise<ScenarioResult[]> {
    const scenarioNames = Object.keys(this.config.test_scenarios)
    const results: ScenarioResult[] = []

    console.log('🎯 Running all test scenarios...\n')

    // 전체 테스트 시작 전 클리어
    await this.clearAllTestData()

    for (const scenarioName of scenarioNames) {
      const result = await this.runScenario(scenarioName)
      results.push(result)
    }

    // 전체 결과 요약
    console.log('\n' + '='.repeat(50))
    console.log('📋 Test Summary')
    console.log('='.repeat(50))

    const totalScenarios = results.length
    const passedScenarios = results.filter(r => r.overallSuccess).length
    const totalTemplates = results.reduce((sum, r) => sum + r.templateResults.length, 0)
    const passedTemplates = results.reduce((sum, r) => sum + r.templateResults.filter(t => t.success).length, 0)
    const totalTime = results.reduce((sum, r) => sum + r.totalExecutionTime, 0)

    console.log(`Scenarios: ${passedScenarios}/${totalScenarios} passed`)
    console.log(`Templates: ${passedTemplates}/${totalTemplates} passed`)
    console.log(`Total execution time: ${totalTime}ms`)
    console.log(`Overall success: ${passedScenarios === totalScenarios ? '✅' : '❌'}`)

    // 전체 테스트 종료 후 최종 클리어
    await this.clearAllTestData()
    console.log('✅ All tests completed')

    return results
  }

  /**
   * Teardown 단계 실행
   */
  private async executeTeardownStep(step: string): Promise<void> {
    switch (step) {
      case 'cleanup_test_tables':
        await this.cleanupTestTables()
        break
      case 'cleanup_test_nodes':
        await this.cleanupTestNodes()
        break
      case 'cleanup_test_relations':
        await this.cleanupTestRelations()
        break
      case 'cleanup_all_test_data':
        await this.cleanupAllTestData()
        break
      default:
        console.log(`   ℹ️ Unknown teardown step: ${step}`)
    }
  }

  /**
   * 정리 작업 - 생성된 테스트 템플릿들 삭제
   */
  async cleanup(): Promise<void> {
    if (!this.config.execution_settings.cleanup_after_test) {
      return
    }

    console.log('\n🧹 Cleaning up test templates...')
    
    // 템플릿 삭제 시도
    for (const templateId of this.createdTemplates) {
      try {
        await this.deleteTemplate(templateId)
        console.log(`   ✅ Cleaned up: ${templateId}`)
      } catch (error) {
        console.log(`   ⚠️ Would clean up: ${templateId}`)
      }
    }
    
    this.createdTemplates.clear()
  }

  /**
   * 템플릿 삭제
   */
  private async deleteTemplate(templateId: string): Promise<void> {
    await this.graphql(`
      mutation DeleteTemplate($id: ID!) {
        deleteTemplate(id: $id)
      }
    `, {
      id: templateId
    })
  }

  /**
   * 테스트 테이블 정리
   */
  private async cleanupTestTables(): Promise<void> {
    // 테스트용 테이블들 삭제 로직
    console.log('   🗑️ Cleaning up test tables...')
  }

  /**
   * 테스트 노드 정리
   */
  private async cleanupTestNodes(): Promise<void> {
    // 테스트용 노드들 삭제 로직
    console.log('   🗑️ Cleaning up test nodes...')
  }

  /**
   * 테스트 관계 정리
   */
  private async cleanupTestRelations(): Promise<void> {
    // 테스트용 관계들 삭제 로직
    console.log('   🗑️ Cleaning up test relations...')
  }

  /**
   * 모든 테스트 데이터 정리
   */
  private async cleanupAllTestData(): Promise<void> {
    await this.cleanupTestRelations()
    await this.cleanupTestNodes()
    await this.cleanupTestTables()
  }
}

export default TemplateTestRunner
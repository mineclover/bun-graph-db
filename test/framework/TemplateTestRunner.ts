/**
 * Template Test Runner
 * 
 * 템플릿 기반 테스트 실행 프레임워크
 * YAML로 정의된 테스트 시나리오를 읽어서 템플릿 시스템을 통해 실행
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import YAML from 'yaml'

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
    const yamlPath = configPath || join(process.cwd(), 'test', 'template-scenarios.yaml')
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
   * 템플릿 실행
   */
  private async executeTemplate(templateId: string, variables?: any): Promise<any> {
    const templateConfig = this.config.test_templates[templateId]
    if (!templateConfig) {
      throw new Error(`Template not found: ${templateId}`)
    }

    const executionVariables = variables || this.substituteVariables(templateConfig.variables)

    const result = await this.graphql(`
      mutation ExecuteTemplate($input: ExecuteQueryTemplateInput!) {
        executeTemplateWithGraphQL(
          templateIdentifier: $templateIdentifier
          variables: $variables
          trackUsage: true
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
      variables: executionVariables
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
    const templateConfig = this.config.test_templates[templateId]
    if (!templateConfig) {
      throw new Error(`Template not found: ${templateId}`)
    }

    const startTime = Date.now()
    
    try {
      // 템플릿 등록 (필요한 경우)
      await this.registerTemplate(templateConfig)

      // 템플릿 실행
      const result = await this.executeTemplate(templateId, variables)
      const executionTime = Date.now() - startTime

      if (!result.success) {
        return {
          templateId,
          templateName: templateConfig.name,
          success: false,
          executionTime,
          error: result.errors?.map((e: any) => e.message).join(', ') || 'Unknown error',
          expectations: []
        }
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

      return {
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

    } catch (error) {
      return {
        templateId,
        templateName: templateConfig.name,
        success: false,
        executionTime: Date.now() - startTime,
        error: (error as Error).message,
        expectations: []
      }
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

    const startTime = Date.now()
    const templateResults: TestResult[] = []

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

    // Teardown 실행 (현재는 로깅만)
    let teardownSuccess = true
    if (scenario.teardown) {
      console.log('\n🧹 Running teardown...')
      for (const teardownStep of scenario.teardown) {
        console.log(`   - ${teardownStep}`)
      }
    }

    const totalExecutionTime = Date.now() - startTime
    const overallSuccess = templateResults.every(r => r.success) && setupSuccess && teardownSuccess

    console.log(`\n📊 Scenario Results:`)
    console.log(`   Success: ${overallSuccess ? '✅' : '❌'}`)
    console.log(`   Templates: ${templateResults.filter(r => r.success).length}/${templateResults.length} passed`)
    console.log(`   Total time: ${totalExecutionTime}ms`)

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

    return results
  }

  /**
   * 정리 작업 - 생성된 테스트 템플릿들 삭제
   */
  async cleanup(): Promise<void> {
    if (!this.config.execution_settings.cleanup_after_test) {
      return
    }

    console.log('\n🧹 Cleaning up test templates...')
    
    // 현재 스키마에서 템플릿 삭제 기능이 없을 수 있으므로 로깅만
    for (const templateId of this.createdTemplates) {
      console.log(`   Would clean up: ${templateId}`)
    }
    
    this.createdTemplates.clear()
  }
}

export default TemplateTestRunner
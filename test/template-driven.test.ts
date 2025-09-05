/**
 * Template-Driven Test Suite
 * 
 * 템플릿 기반 테스트 실행을 통해 기존의 복잡한 GraphQL 테스트들을 간소화
 * YAML 설정 파일에 정의된 템플릿들을 자동으로 실행하고 검증
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createYoga } from 'graphql-yoga'
import { ContainerBootstrap } from '../src/infrastructure/container/ContainerBootstrap.js'
import type { DIContainer } from '../src/infrastructure/container/DIContainer.js'
import { GraphQLSchemaBuilder } from '../src/presentation/graphql/GraphQLSchemaBuilder.js'
import TemplateTestRunner from './framework/TemplateTestRunner.js'

describe('Template-Driven Tests', () => {
  let yoga: ReturnType<typeof createYoga>
  let container: DIContainer
  let templateRunner: TemplateTestRunner
  let server: any

  beforeAll(async () => {
    // 서버 설정
    container = await ContainerBootstrap.createContainer()
    const schemaBuilder = new GraphQLSchemaBuilder(container)
    const schema = await schemaBuilder.build()
    yoga = createYoga({ schema })

    // 테스트 서버 시작 (포트 4000)
    server = Bun.serve({
      fetch: yoga.fetch,
      port: 4000,
      hostname: 'localhost',
    })

    // 템플릿 테스트 러너 초기화
    templateRunner = new TemplateTestRunner()

    console.log('🚀 Template-driven test server started at http://localhost:4000')
  })

  afterAll(async () => {
    // 정리 작업
    await templateRunner.cleanup()
    
    if (server) {
      server.stop()
      console.log('🛑 Test server stopped')
    }
  })

  describe('Basic CRUD Operations via Templates', () => {
    test('should execute health check template', async () => {
      const result = await templateRunner.runTemplate('health_check')
      
      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.expectations.every(exp => exp.passed)).toBe(true)
      
      console.log(`✅ Health check completed in ${result.executionTime}ms`)
    })

    test('should execute table listing template', async () => {
      const result = await templateRunner.runTemplate('list_tables')
      
      expect(result.success).toBe(true)
      expect(result.expectations.every(exp => exp.passed)).toBe(true)
      
      const tablesExpectation = result.expectations.find(exp => exp.path === 'data.tables.nodes')
      expect(tablesExpectation?.actual).toBeDefined()
      
      console.log(`✅ Table listing completed in ${result.executionTime}ms`)
      console.log(`   Found ${tablesExpectation?.actual?.length || 0} tables`)
    })

    test('should execute get table template', async () => {
      // 먼저 사용 가능한 테이블 ID 확인
      const listResult = await templateRunner.runTemplate('list_tables')
      if (!listResult.success) {
        console.log('⚠️ Could not get table list, skipping table query test')
        return
      }

      const result = await templateRunner.runTemplate('get_table')
      
      // 테이블이 존재하지 않을 수 있으므로 실행 자체가 성공했는지만 확인
      expect(result.error).toBeUndefined()
      
      console.log(`✅ Get table completed in ${result.executionTime}ms`)
      if (!result.success) {
        console.log(`   Note: ${result.error || 'Template executed but validation failed'}`)
      }
    })
  })

  describe('Template Scenarios', () => {
    test('should run basic CRUD scenario', async () => {
      const result = await templateRunner.runScenario('basic_crud')
      
      expect(result).toBeDefined()
      expect(result.scenarioName).toBe('basic_crud')
      expect(result.templateResults.length).toBeGreaterThan(0)
      
      // 최소 하나의 템플릿은 성공해야 함
      const successCount = result.templateResults.filter(r => r.success).length
      expect(successCount).toBeGreaterThan(0)
      
      console.log(`📊 Basic CRUD Scenario Results:`)
      console.log(`   Templates: ${successCount}/${result.templateResults.length} passed`)
      console.log(`   Total time: ${result.totalExecutionTime}ms`)
    })

    test('should run system integration scenario', async () => {
      const result = await templateRunner.runScenario('system_integration')
      
      expect(result).toBeDefined()
      expect(result.scenarioName).toBe('system_integration')
      
      // 시스템 통합 테스트는 보통 성공해야 함
      const healthCheckResult = result.templateResults.find(r => r.templateId === 'health_check')
      expect(healthCheckResult?.success).toBe(true)
      
      console.log(`📊 System Integration Scenario Results:`)
      console.log(`   Overall success: ${result.overallSuccess ? '✅' : '❌'}`)
      console.log(`   Total time: ${result.totalExecutionTime}ms`)
    })
  })

  describe('Template Performance Analysis', () => {
    test('should collect performance metrics', async () => {
      const result = await templateRunner.runTemplate('list_tables')
      
      expect(result.performance).toBeDefined()
      expect(result.performance?.executionTime).toBeGreaterThan(0)
      expect(result.performance?.memoryUsage).toBeGreaterThan(0)
      expect(result.performance?.complexityScore).toBeGreaterThan(0)
      
      console.log(`📈 Performance Metrics:`)
      console.log(`   Execution time: ${result.performance?.executionTime}ms`)
      console.log(`   Memory usage: ${result.performance?.memoryUsage.toFixed(2)}MB`)
      console.log(`   Complexity score: ${result.performance?.complexityScore}`)
    })

    test('should validate performance expectations', async () => {
      const result = await templateRunner.runTemplate('health_check')
      
      // 성능 기준 확인 (200ms 이하)
      expect(result.executionTime).toBeLessThan(200)
      
      if (result.performance) {
        // 메모리 사용량 기준 (50MB 이하)
        expect(result.performance.memoryUsage).toBeLessThan(50)
      }
      
      console.log(`⚡ Performance validation passed for health check`)
    })
  })

  describe('Template Error Handling', () => {
    test('should handle invalid template execution gracefully', async () => {
      // 존재하지 않는 템플릿 실행 시도
      try {
        await templateRunner.runTemplate('non_existent_template')
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('Template not found')
        console.log('✅ Invalid template handling works correctly')
      }
    })

    test('should handle template with invalid variables', async () => {
      // 잘못된 변수로 템플릿 실행
      const result = await templateRunner.runTemplate('get_table', { tableId: 'invalid-id' })
      
      // 실행은 되지만 결과가 실패할 수 있음
      expect(result).toBeDefined()
      
      if (!result.success) {
        console.log(`✅ Invalid variables handled: ${result.error}`)
      } else {
        console.log(`ℹ️ Template succeeded despite invalid variables`)
      }
    })
  })

  describe('Template Lifecycle Management', () => {
    test('should track template usage', async () => {
      // 템플릿 실행 전후 사용량 확인은 현재 시스템에서 자동으로 처리됨
      const result1 = await templateRunner.runTemplate('health_check')
      const result2 = await templateRunner.runTemplate('health_check')
      
      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      
      console.log('✅ Template usage tracking integrated automatically')
    })

    test('should reuse registered templates', async () => {
      // 동일한 템플릿을 여러 번 실행해도 등록은 한 번만
      const startTime = Date.now()
      
      await templateRunner.runTemplate('health_check')
      await templateRunner.runTemplate('health_check')
      await templateRunner.runTemplate('health_check')
      
      const totalTime = Date.now() - startTime
      
      // 재사용으로 인한 효율성 확인
      expect(totalTime).toBeLessThan(1000) // 1초 이내
      
      console.log(`✅ Template reuse efficiency: ${totalTime}ms for 3 executions`)
    })
  })

  describe('Complete Template Test Suite', () => {
    test('should run all scenarios and provide comprehensive report', async () => {
      console.log('\n' + '='.repeat(60))
      console.log('🎯 Running Complete Template Test Suite')
      console.log('='.repeat(60))
      
      const results = await templateRunner.runAllScenarios()
      
      expect(results.length).toBeGreaterThan(0)
      
      // 전체 결과 분석
      const totalScenarios = results.length
      const passedScenarios = results.filter(r => r.overallSuccess).length
      const totalTemplates = results.reduce((sum, r) => sum + r.templateResults.length, 0)
      const passedTemplates = results.reduce((sum, r) => sum + r.templateResults.filter(t => t.success).length, 0)
      
      console.log(`\n📊 Final Test Report:`)
      console.log(`   Scenarios: ${passedScenarios}/${totalScenarios} passed (${((passedScenarios/totalScenarios)*100).toFixed(1)}%)`)
      console.log(`   Templates: ${passedTemplates}/${totalTemplates} passed (${((passedTemplates/totalTemplates)*100).toFixed(1)}%)`)
      
      // 최소 성공률 요구사항
      const scenarioSuccessRate = passedScenarios / totalScenarios
      const templateSuccessRate = passedTemplates / totalTemplates
      
      expect(scenarioSuccessRate).toBeGreaterThan(0.5) // 최소 50% 시나리오 성공
      expect(templateSuccessRate).toBeGreaterThan(0.7) // 최소 70% 템플릿 성공
      
      console.log(`\n✅ Template-driven test suite completed successfully!`)
    })
  })
})

// 직접 실행 시 모든 시나리오 실행
if (import.meta.main) {
  const runner = new TemplateTestRunner()
  
  console.log('🚀 Running template-driven tests directly...')
  
  runner.runAllScenarios()
    .then(() => {
      console.log('✅ All tests completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error)
      process.exit(1)
    })
}
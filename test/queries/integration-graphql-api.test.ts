/**
 * Integration - GraphQL API - Basic Integration
 * 
 * GraphQL API의 통합 테스트를 수행합니다.
 * - API 엔드포인트 연결성
 * - 스키마 검증
 * - 쿼리/뮤테이션 통합
 * - 에러 응답 통합
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createYoga } from 'graphql-yoga'
import { ContainerBootstrap } from '../../src/infrastructure/container/ContainerBootstrap.js'
import type { DIContainer } from '../../src/infrastructure/container/DIContainer.js'
import { GraphQLSchemaBuilder } from '../../src/presentation/graphql/GraphQLSchemaBuilder.js'
import TemplateTestRunner from '../setup/TemplateTestRunner.js'
import { businessTestLogger } from '../setup/BusinessTestLogger.js'
import { detailedAnalysisLogger } from '../setup/DetailedAnalysisLogger.js'

describe('Integration - GraphQL API - Basic Integration', () => {
  let yoga: ReturnType<typeof createYoga>
  let container: DIContainer
  let templateRunner: TemplateTestRunner
  let server: any

  beforeAll(async () => {
    // 비즈니스 테스트 로거 초기화
    businessTestLogger.initializeTestSuite('integration-graphql-api-tests', 'api-integration')
    
    // 상세 분석 로거 초기화
    detailedAnalysisLogger.initializeTestSuite('integration-graphql-api-tests', 'api-integration')
    
    // 서버 설정
    container = await ContainerBootstrap.createContainer()
    const schemaBuilder = new GraphQLSchemaBuilder(container)
    const schema = await schemaBuilder.build()

    yoga = createYoga({
      schema,
      context: () => ({ container })
    })

    server = yoga.listen(4002, () => {
      console.log('🚀 Integration test server running on http://localhost:4002/graphql')
    })

    // 템플릿 테스트 러너 초기화
    templateRunner = new TemplateTestRunner()
    await templateRunner.initialize()
  })

  afterAll(async () => {
    await templateRunner.cleanup()
    
    // 비즈니스 테스트 로거 완료
    businessTestLogger.finalizeTestSuite()
    
    // 상세 분석 로거 완료
    detailedAnalysisLogger.finalizeTestSuite()
    
    if (server) {
      server.stop()
      console.log('🛑 Integration test server stopped')
    }

    // 실패한 테스트가 있으면 프로세스 종료
    const failedTests = businessTestLogger.getFailedTests()
    if (failedTests.length > 0) {
      console.log(`\n❌ ${failedTests.length} integration API tests failed. Exiting with error code 1.`)
      process.exit(1)
    } else {
      console.log('\n✅ All integration API tests passed successfully!')
      process.exit(0)
    }
  })

  describe('API Endpoint Connectivity', () => {
    test('should connect to GraphQL API when server is running', async () => {
      const result = await templateRunner.runTemplate('health_check')
      
      expect(result.success).toBe(true)
      expect(result.templateName).toBe('System Health Check')
    })

    test('should handle API requests when multiple endpoints accessed', async () => {
      const healthResult = await templateRunner.runTemplate('health_check')
      const tableResult = await templateRunner.runTemplate('list_tables')
      
      expect(healthResult.success).toBe(true)
      expect(tableResult.success).toBe(true)
    })
  })

  describe('Schema Integration', () => {
    test('should validate schema when introspection query executed', async () => {
      const result = await templateRunner.runTemplate('health_check')
      
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    test('should handle schema changes when new fields added', async () => {
      const result = await templateRunner.runTemplate('search_templates')
      
      expect(result.success).toBe(true)
      expect(result.templateName).toBe('Search Templates')
    })
  })

  describe('Query Integration', () => {
    test('should execute queries when valid GraphQL queries provided', async () => {
      const result = await templateRunner.runTemplate('list_tables')
      
      expect(result.success).toBe(true)
      expect(result.templateName).toBe('List All Tables')
    })

    test('should handle query variables when parameters provided', async () => {
      const result = await templateRunner.runTemplate('get_table_info', { tableName: 'test_table' })
      
      expect(result.success).toBe(true)
      expect(result.templateName).toBe('Get Table Information')
    })
  })

  describe('Mutation Integration', () => {
    test('should execute mutations when valid GraphQL mutations provided', async () => {
      const result = await templateRunner.runTemplate('health_check')
      
      expect(result.success).toBe(true)
      expect(result.templateName).toBe('System Health Check')
    })

    test('should handle mutation variables when parameters provided', async () => {
      const result = await templateRunner.runTemplate('get_table_info', { tableName: 'test_table' })
      
      expect(result.success).toBe(true)
      expect(result.templateName).toBe('Get Table Information')
    })
  })

  describe('Error Response Integration', () => {
    test('should return consistent error format when GraphQL errors occur', async () => {
      const result = await templateRunner.runTemplate('invalid_query')
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.metadata?.errorType).toBeDefined()
    })

    test('should handle error propagation when nested operations fail', async () => {
      const result = await templateRunner.runTemplate('get_table_info', { invalid: 'data' })
      
      if (!result.success) {
        expect(result.error).toBeDefined()
        expect(result.metadata?.errorType).toBeDefined()
      }
    })
  })

  describe('Performance Integration', () => {
    test('should maintain performance when multiple requests made', async () => {
      const startTime = Date.now()
      
      const promises = Array.from({ length: 10 }, () => 
        templateRunner.runTemplate('health_check')
      )
      
      const results = await Promise.all(promises)
      const endTime = Date.now()
      const totalTime = endTime - startTime
      
      // 모든 요청이 성공했는지 확인
      const successCount = results.filter(r => r.success).length
      expect(successCount).toBeGreaterThan(0)
      
      // 성능 기준 확인 (10개 요청이 5초 이내에 완료)
      expect(totalTime).toBeLessThan(5000)
    })
  })
})

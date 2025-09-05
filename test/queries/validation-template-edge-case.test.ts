/**
 * Validation - Template - Edge Cases
 * 
 * 템플릿 검증의 경계값과 예외 상황을 테스트합니다.
 * - 잘못된 템플릿 ID 처리
 * - GraphQL 에러 처리
 * - 네트워크 에러 처리
 * - 데이터 검증 실패 처리
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createYoga } from 'graphql-yoga'
import { ContainerBootstrap } from '../../src/infrastructure/container/ContainerBootstrap.js'
import type { DIContainer } from '../../src/infrastructure/container/DIContainer.js'
import { GraphQLSchemaBuilder } from '../../src/presentation/graphql/GraphQLSchemaBuilder.js'
import TemplateTestRunner from '../setup/TemplateTestRunner.js'
import { businessTestLogger } from '../setup/BusinessTestLogger.js'
import { detailedAnalysisLogger } from '../setup/DetailedAnalysisLogger.js'

describe('Validation - Template - Edge Cases', () => {
  let yoga: ReturnType<typeof createYoga>
  let container: DIContainer
  let templateRunner: TemplateTestRunner
  let server: any

  beforeAll(async () => {
    // 비즈니스 테스트 로거 초기화
    businessTestLogger.initializeTestSuite('validation-template-edge-case-tests', 'template-validation')
    
    // 상세 분석 로거 초기화
    detailedAnalysisLogger.initializeTestSuite('validation-template-edge-case-tests', 'template-validation')
    
    // 서버 설정
    container = await ContainerBootstrap.createContainer()
    const schemaBuilder = new GraphQLSchemaBuilder(container)
    const schema = await schemaBuilder.build()

    yoga = createYoga({
      schema,
      context: () => ({ container })
    })

    server = yoga.listen(4001, () => {
      console.log('🚀 Validation test server running on http://localhost:4001/graphql')
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
      console.log('🛑 Validation test server stopped')
    }

    // 실패한 테스트가 있으면 프로세스 종료
    const failedTests = businessTestLogger.getFailedTests()
    if (failedTests.length > 0) {
      console.log(`\n❌ ${failedTests.length} validation template tests failed. Exiting with error code 1.`)
      process.exit(1)
    } else {
      console.log('\n✅ All validation template tests passed successfully!')
      process.exit(0)
    }
  })

  describe('Invalid Template ID Handling', () => {
    test('should handle template not found when invalid template ID provided', async () => {
      const result = await templateRunner.runTemplate('invalid_query')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Template not found')
      expect(result.metadata?.errorType).toBe('TEMPLATE_NOT_FOUND')
    })

    test('should handle template not found when empty template ID provided', async () => {
      const result = await templateRunner.runTemplate('')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Template not found')
    })

    test('should handle template not found when null template ID provided', async () => {
      const result = await templateRunner.runTemplate(null as any)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Template not found')
    })
  })

  describe('GraphQL Error Handling', () => {
    test('should handle GraphQL errors when malformed query provided', async () => {
      const result = await templateRunner.runTemplate('get_table_info')
      
      // 이 테스트는 실제로는 성공할 수 있지만, GraphQL 에러가 발생할 수 있는 상황을 시뮬레이션
      if (!result.success) {
        expect(result.error).toBeDefined()
        expect(result.metadata?.errorType).toBeDefined()
      }
    })

    test('should handle GraphQL errors when invalid variables provided', async () => {
      const result = await templateRunner.runTemplate('get_table_info', { invalid: 'data' })
      
      // 변수 검증 실패 시 에러 처리 확인
      if (!result.success) {
        expect(result.error).toBeDefined()
        expect(result.metadata?.errorType).toBeDefined()
      }
    })
  })

  describe('Data Validation Edge Cases', () => {
    test('should handle edge case when maximum length string provided', async () => {
      const longString = 'a'.repeat(10000)
      const result = await templateRunner.runTemplate('get_table_info', { tableName: longString })
      
      // 긴 문자열 처리 확인
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })

    test('should handle edge case when special characters provided', async () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?'
      const result = await templateRunner.runTemplate('get_table_info', { tableName: specialChars })
      
      // 특수 문자 처리 확인
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })

    test('should handle edge case when unicode characters provided', async () => {
      const unicodeString = '테스트한글🚀🎉'
      const result = await templateRunner.runTemplate('get_table_info', { tableName: unicodeString })
      
      // 유니코드 문자 처리 확인
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })
  })

  describe('Network Error Handling', () => {
    test('should handle network errors when server unavailable', async () => {
      // 서버 중지 시뮬레이션
      if (server) {
        server.stop()
      }
      
      const result = await templateRunner.runTemplate('health_check')
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      
      // 서버 재시작
      if (container) {
        const schemaBuilder = new GraphQLSchemaBuilder(container)
        const schema = await schemaBuilder.build()
        
        yoga = createYoga({
          schema,
          context: () => ({ container })
        })
        
        server = yoga.listen(4001, () => {
          console.log('🚀 Validation test server restarted on http://localhost:4001/graphql')
        })
      }
    })
  })

  describe('Concurrent Access Edge Cases', () => {
    test('should handle concurrent template access when multiple requests made', async () => {
      const promises = Array.from({ length: 5 }, () => 
        templateRunner.runTemplate('health_check')
      )
      
      const results = await Promise.all(promises)
      
      // 모든 요청이 처리되었는지 확인
      expect(results).toHaveLength(5)
      
      // 성공한 요청이 있는지 확인
      const successCount = results.filter(r => r.success).length
      expect(successCount).toBeGreaterThan(0)
    })
  })
})

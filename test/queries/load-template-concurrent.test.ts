/**
 * Load - Template - Concurrent Access
 * 
 * 템플릿 시스템의 동시 접근 부하 테스트를 수행합니다.
 * - 동시 요청 처리
 * - 메모리 사용량 모니터링
 * - 응답 시간 측정
 * - 시스템 안정성 확인
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createYoga } from 'graphql-yoga'
import { ContainerBootstrap } from '../../src/infrastructure/container/ContainerBootstrap.js'
import type { DIContainer } from '../../src/infrastructure/container/DIContainer.js'
import { GraphQLSchemaBuilder } from '../../src/presentation/graphql/GraphQLSchemaBuilder.js'
import TemplateTestRunner from '../setup/TemplateTestRunner.js'
import { businessTestLogger } from '../setup/BusinessTestLogger.js'
import { detailedAnalysisLogger } from '../setup/DetailedAnalysisLogger.js'

describe('Load - Template - Concurrent Access', () => {
  let yoga: ReturnType<typeof createYoga>
  let container: DIContainer
  let templateRunner: TemplateTestRunner
  let server: any

  beforeAll(async () => {
    // 비즈니스 테스트 로거 초기화
    businessTestLogger.initializeTestSuite('load-template-concurrent-tests', 'template-performance')
    
    // 상세 분석 로거 초기화
    detailedAnalysisLogger.initializeTestSuite('load-template-concurrent-tests', 'template-performance')
    
    // 서버 설정
    container = await ContainerBootstrap.createContainer()
    const schemaBuilder = new GraphQLSchemaBuilder(container)
    const schema = await schemaBuilder.build()

    yoga = createYoga({
      schema,
      context: () => ({ container })
    })

    server = yoga.listen(4003, () => {
      console.log('🚀 Load test server running on http://localhost:4003/graphql')
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
      console.log('🛑 Load test server stopped')
    }

    // 실패한 테스트가 있으면 프로세스 종료
    const failedTests = businessTestLogger.getFailedTests()
    if (failedTests.length > 0) {
      console.log(`\n❌ ${failedTests.length} load template tests failed. Exiting with error code 1.`)
      process.exit(1)
    } else {
      console.log('\n✅ All load template tests passed successfully!')
      process.exit(0)
    }
  })

  describe('Concurrent Request Handling', () => {
    test('should handle concurrent requests when multiple users access simultaneously', async () => {
      const concurrentUsers = 20
      const startTime = Date.now()
      
      const promises = Array.from({ length: concurrentUsers }, (_, index) => 
        templateRunner.runTemplate('health_check')
      )
      
      const results = await Promise.all(promises)
      const endTime = Date.now()
      const totalTime = endTime - startTime
      
      // 성공률 확인
      const successCount = results.filter(r => r.success).length
      const successRate = (successCount / concurrentUsers) * 100
      
      expect(successRate).toBeGreaterThanOrEqual(80) // 80% 이상 성공
      expect(totalTime).toBeLessThan(10000) // 10초 이내 완료
      
      console.log(`📊 Concurrent Load Test Results:`)
      console.log(`   Users: ${concurrentUsers}`)
      console.log(`   Success Rate: ${successRate.toFixed(1)}%`)
      console.log(`   Total Time: ${totalTime}ms`)
      console.log(`   Average Time: ${(totalTime / concurrentUsers).toFixed(1)}ms per request`)
    })

    test('should maintain performance when high frequency requests made', async () => {
      const requestCount = 100
      const startTime = Date.now()
      
      const promises = Array.from({ length: requestCount }, () => 
        templateRunner.runTemplate('list_tables')
      )
      
      const results = await Promise.all(promises)
      const endTime = Date.now()
      const totalTime = endTime - startTime
      
      // 성공률 확인
      const successCount = results.filter(r => r.success).length
      const successRate = (successCount / requestCount) * 100
      
      expect(successRate).toBeGreaterThanOrEqual(90) // 90% 이상 성공
      expect(totalTime).toBeLessThan(15000) // 15초 이내 완료
      
      console.log(`📊 High Frequency Test Results:`)
      console.log(`   Requests: ${requestCount}`)
      console.log(`   Success Rate: ${successRate.toFixed(1)}%`)
      console.log(`   Total Time: ${totalTime}ms`)
      console.log(`   Requests per Second: ${(requestCount / (totalTime / 1000)).toFixed(1)}`)
    })
  })

  describe('Memory Usage Monitoring', () => {
    test('should maintain stable memory usage when concurrent requests processed', async () => {
      const initialMemory = process.memoryUsage()
      
      const promises = Array.from({ length: 50 }, () => 
        templateRunner.runTemplate('search_templates')
      )
      
      const results = await Promise.all(promises)
      const finalMemory = process.memoryUsage()
      
      // 메모리 사용량 증가 확인
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024
      
      expect(memoryIncreaseMB).toBeLessThan(100) // 100MB 이하 증가
      
      console.log(`📊 Memory Usage Test Results:`)
      console.log(`   Initial Memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(1)}MB`)
      console.log(`   Final Memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(1)}MB`)
      console.log(`   Memory Increase: ${memoryIncreaseMB.toFixed(1)}MB`)
    })

    test('should handle memory pressure when large number of requests made', async () => {
      const initialMemory = process.memoryUsage()
      
      // 대량의 요청을 순차적으로 처리
      for (let i = 0; i < 200; i++) {
        await templateRunner.runTemplate('health_check')
        
        // 메모리 정리 (가비지 컬렉션 시뮬레이션)
        if (i % 50 === 0) {
          global.gc && global.gc()
        }
      }
      
      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024
      
      expect(memoryIncreaseMB).toBeLessThan(200) // 200MB 이하 증가
      
      console.log(`📊 Memory Pressure Test Results:`)
      console.log(`   Requests: 200`)
      console.log(`   Memory Increase: ${memoryIncreaseMB.toFixed(1)}MB`)
    })
  })

  describe('Response Time Measurement', () => {
    test('should maintain consistent response times when load increases', async () => {
      const responseTimes: number[] = []
      
      for (let i = 0; i < 30; i++) {
        const startTime = Date.now()
        const result = await templateRunner.runTemplate('get_table_info', { tableName: `table_${i}` })
        const endTime = Date.now()
        
        if (result.success) {
          responseTimes.push(endTime - startTime)
        }
      }
      
      // 응답 시간 통계 계산
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      const maxResponseTime = Math.max(...responseTimes)
      const minResponseTime = Math.min(...responseTimes)
      
      expect(avgResponseTime).toBeLessThan(1000) // 평균 1초 이내
      expect(maxResponseTime).toBeLessThan(2000) // 최대 2초 이내
      
      console.log(`📊 Response Time Test Results:`)
      console.log(`   Average Response Time: ${avgResponseTime.toFixed(1)}ms`)
      console.log(`   Max Response Time: ${maxResponseTime}ms`)
      console.log(`   Min Response Time: ${minResponseTime}ms`)
    })

    test('should handle response time degradation when system under stress', async () => {
      const responseTimes: number[] = []
      
      // 시스템에 부하를 주면서 응답 시간 측정
      for (let i = 0; i < 20; i++) {
        const startTime = Date.now()
        
        // 동시에 여러 요청을 보내서 부하 생성
        const promises = Array.from({ length: 5 }, () => 
          templateRunner.runTemplate('health_check')
        )
        
        await Promise.all(promises)
        const endTime = Date.now()
        responseTimes.push(endTime - startTime)
      }
      
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      
      expect(avgResponseTime).toBeLessThan(3000) // 평균 3초 이내
      
      console.log(`📊 Stress Response Time Test Results:`)
      console.log(`   Average Response Time: ${avgResponseTime.toFixed(1)}ms`)
    })
  })

  describe('System Stability', () => {
    test('should maintain system stability when continuous load applied', async () => {
      const testDuration = 10000 // 10초
      const startTime = Date.now()
      let requestCount = 0
      let successCount = 0
      
      while (Date.now() - startTime < testDuration) {
        const result = await templateRunner.runTemplate('list_tables')
        requestCount++
        
        if (result.success) {
          successCount++
        }
        
        // 짧은 대기 시간
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      const successRate = (successCount / requestCount) * 100
      
      expect(successRate).toBeGreaterThanOrEqual(85) // 85% 이상 성공
      expect(requestCount).toBeGreaterThan(50) // 최소 50개 요청 처리
      
      console.log(`📊 System Stability Test Results:`)
      console.log(`   Test Duration: ${testDuration}ms`)
      console.log(`   Total Requests: ${requestCount}`)
      console.log(`   Success Rate: ${successRate.toFixed(1)}%`)
    })
  })
})

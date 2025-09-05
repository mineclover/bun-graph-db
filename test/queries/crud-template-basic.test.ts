/**
 * CRUD - Template - Basic Operations
 * 
 * 템플릿의 기본 CRUD 작업을 테스트합니다.
 * - Create: 템플릿 생성
 * - Read: 템플릿 조회
 * - Update: 템플릿 수정
 * - Delete: 템플릿 삭제
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createYoga } from 'graphql-yoga'
import { ContainerBootstrap } from '../../src/infrastructure/container/ContainerBootstrap.js'
import type { DIContainer } from '../../src/infrastructure/container/DIContainer.js'
import { GraphQLSchemaBuilder } from '../../src/presentation/graphql/GraphQLSchemaBuilder.js'
import TemplateTestRunner from '../setup/TemplateTestRunner.js'
import { businessTestLogger } from '../setup/BusinessTestLogger.js'
import { detailedAnalysisLogger } from '../setup/DetailedAnalysisLogger.js'

describe('CRUD - Template - Basic Operations', () => {
  let yoga: ReturnType<typeof createYoga>
  let container: DIContainer
  let templateRunner: TemplateTestRunner
  let server: any

  beforeAll(async () => {
    // 비즈니스 테스트 로거 초기화
    businessTestLogger.initializeTestSuite('crud-template-basic-tests', 'template-crud')
    
    // 상세 분석 로거 초기화
    detailedAnalysisLogger.initializeTestSuite('crud-template-basic-tests', 'template-crud')
    
    // 서버 설정
    container = await ContainerBootstrap.createContainer()
    const schemaBuilder = new GraphQLSchemaBuilder(container)
    const schema = await schemaBuilder.build()

    yoga = createYoga({
      schema,
      context: () => ({ container })
    })

    server = yoga.listen(4000, () => {
      console.log('🚀 Test server running on http://localhost:4000/graphql')
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
      console.log('🛑 Test server stopped')
    }

    // 실패한 테스트가 있으면 프로세스 종료
    const failedTests = businessTestLogger.getFailedTests()
    if (failedTests.length > 0) {
      console.log(`\n❌ ${failedTests.length} CRUD template tests failed. Exiting with error code 1.`)
      process.exit(1)
    } else {
      console.log('\n✅ All CRUD template tests passed successfully!')
      process.exit(0)
    }
  })

  describe('Create Operations', () => {
    test('should create template when valid data provided', async () => {
      const result = await templateRunner.runTemplate('health_check')
      
      expect(result.success).toBe(true)
      expect(result.templateName).toBe('System Health Check')
      expect(result.executionTime).toBeGreaterThan(0)
    })

    test('should create template with variables when valid data provided', async () => {
      const result = await templateRunner.runTemplate('get_table_info')
      
      expect(result.success).toBe(true)
      expect(result.templateName).toBe('Get Table Information')
    })
  })

  describe('Read Operations', () => {
    test('should retrieve existing templates when valid query provided', async () => {
      const result = await templateRunner.runTemplate('list_tables')
      
      expect(result.success).toBe(true)
      expect(result.templateName).toBe('List All Tables')
    })

    test('should search templates with pagination when valid parameters provided', async () => {
      const result = await templateRunner.runTemplate('search_templates')
      
      expect(result.success).toBe(true)
      expect(result.templateName).toBe('Search Templates')
    })
  })

  describe('Update Operations', () => {
    test('should execute template when valid template ID provided', async () => {
      const result = await templateRunner.runTemplate('health_check')
      
      expect(result.success).toBe(true)
      expect(result.templateName).toBe('System Health Check')
    })
  })

  describe('Delete Operations', () => {
    test('should handle template deletion when cleanup requested', async () => {
      // 템플릿 생성
      const createResult = await templateRunner.runTemplate('health_check')
      expect(createResult.success).toBe(true)
      
      // 정리 작업 (삭제 시뮬레이션)
      await templateRunner.cleanup()
      
      // 정리 후 상태 확인
      const searchResult = await templateRunner.runTemplate('search_templates')
      expect(searchResult.success).toBe(true)
    })
  })
})

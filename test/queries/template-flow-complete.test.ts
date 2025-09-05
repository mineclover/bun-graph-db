/**
 * Template Flow - Complete Database Lifecycle
 * 
 * 테이블 생성부터 노드 제거까지의 전체 데이터베이스 생명주기를 하나의 플로우로 테스트
 * - Step 1: 테이블 생성
 * - Step 2: 속성 정의
 * - Step 3: 노드 생성 (속성 포함)
 * - Step 4: 노드 조회
 * - Step 5: 노드 제거
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createYoga } from 'graphql-yoga'
import { ContainerBootstrap } from '../../src/infrastructure/container/ContainerBootstrap.js'
import type { DIContainer } from '../../src/infrastructure/container/DIContainer.js'
import { GraphQLSchemaBuilder } from '../../src/presentation/graphql/GraphQLSchemaBuilder.js'
import TemplateTestRunner from '../setup/TemplateTestRunner.js'
import { businessTestLogger } from '../setup/BusinessTestLogger.js'
import { detailedAnalysisLogger } from '../setup/DetailedAnalysisLogger.js'

interface FlowStep {
  step: number
  stepName: string
  templateId: string
  input: any
  output?: any
  executionTime?: number
  success?: boolean
  timestamp?: string
}

interface FlowResult {
  flowId: string
  flowName: string
  startTime: string
  endTime?: string
  totalDuration?: number
  steps: FlowStep[]
  overallSuccess?: boolean
  variables: Record<string, any>
}

describe('Template Flow - Complete Database Lifecycle', () => {
  let yoga: ReturnType<typeof createYoga>
  let container: DIContainer
  let templateRunner: TemplateTestRunner
  let flowResult: FlowResult

  beforeAll(async () => {
    // 비즈니스 테스트 로거 초기화
    businessTestLogger.initializeTestSuite('template-flow-complete-tests', 'template-flow')
    
    // 상세 분석 로거 초기화
    detailedAnalysisLogger.initializeTestSuite('template-flow-complete-tests', 'template-flow')
    
    // 플로우 결과 초기화
    flowResult = {
      flowId: `template-flow-${Date.now()}`,
      flowName: 'Complete Database Lifecycle',
      startTime: new Date().toISOString(),
      steps: [],
      variables: {}
    }
    
    // 서버 설정
    container = await ContainerBootstrap.createContainer()
    const schemaBuilder = new GraphQLSchemaBuilder(container)
    const schema = await schemaBuilder.build()

    yoga = createYoga({
      schema,
      context: () => ({ container })
    })

    console.log('🚀 Template flow test server configured')

    // 템플릿 테스트 러너 초기화
    templateRunner = new TemplateTestRunner()
    await templateRunner.initialize()
  })

  afterAll(async () => {
    // 플로우 결과 완료
    flowResult.endTime = new Date().toISOString()
    flowResult.totalDuration = new Date(flowResult.endTime).getTime() - new Date(flowResult.startTime).getTime()
    flowResult.overallSuccess = flowResult.steps.every(step => step.success)
    
    // 플로우 결과 로깅
    businessTestLogger.logBusinessTest({
      testName: 'Complete Template Flow',
      businessContext: 'template-flow',
      testType: 'integration',
      input: { flowId: flowResult.flowId, stepCount: flowResult.steps.length },
      output: flowResult,
      success: flowResult.overallSuccess,
      executionTime: flowResult.totalDuration,
      businessMetrics: {
        executionTime: flowResult.totalDuration,
        memoryUsage: process.memoryUsage().heapUsed,
        complexityScore: flowResult.steps.length
      },
      validationResults: {
        expectations: [],
        passed: flowResult.steps.filter(s => s.success).length,
        failed: flowResult.steps.filter(s => !s.success).length
      },
      metadata: {
        flowId: flowResult.flowId,
        stepCount: flowResult.steps.length,
        successCount: flowResult.steps.filter(s => s.success).length,
        failureCount: flowResult.steps.filter(s => !s.success).length
      }
    })
    
    await templateRunner.cleanup()
    
    // 비즈니스 테스트 로거 완료
    businessTestLogger.finalizeTestSuite()
    
    // 상세 분석 로거 완료
    detailedAnalysisLogger.finalizeTestSuite()
    
    console.log('🛑 Template flow test server stopped')

    // 실패한 테스트가 있으면 프로세스 종료
    const failedTests = businessTestLogger.getFailedTests()
    if (failedTests.length > 0) {
      console.log(`\n❌ ${failedTests.length} template flow tests failed. Exiting with error code 1.`)
      process.exit(1)
    } else {
      console.log('\n✅ All template flow tests passed successfully!')
      process.exit(0)
    }
  })

  describe('Step 1: Table Creation', () => {
    test('should create table when valid data provided', async () => {
      const stepStartTime = Date.now()
      const step: FlowStep = {
        step: 1,
        stepName: 'Table Creation',
        templateId: 'create_table',
        input: {
          tableName: 'test_users',
          description: 'Test user table for template flow validation'
        },
        timestamp: new Date().toISOString()
      }

      try {
        const result = await templateRunner.runTemplate('create_table', step.input)
        
        step.executionTime = Date.now() - stepStartTime
        step.success = result.success
        step.output = result.data

        if (result.success && result.data) {
          // 테이블 ID를 변수로 저장
          flowResult.variables.tableId = result.data.id || result.data.tableId
        }

        // 개별 단계 로깅
        businessTestLogger.logBusinessTest({
          testName: step.stepName,
          businessContext: 'template-flow',
          testType: 'integration',
          input: step.input,
          output: step.output,
          success: step.success,
          executionTime: step.executionTime,
          businessMetrics: {
            executionTime: step.executionTime,
            memoryUsage: process.memoryUsage().heapUsed,
            complexityScore: 1
          },
          validationResults: {
            expectations: [],
            passed: step.success ? 1 : 0,
            failed: step.success ? 0 : 1
          },
          metadata: {
            step: step.step,
            templateId: step.templateId,
            flowId: flowResult.flowId
          }
        })

        flowResult.steps.push(step)
        
        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(flowResult.variables.tableId).toBeDefined()
        
        console.log(`✅ Step 1 completed: Table created with ID ${flowResult.variables.tableId}`)
      } catch (error) {
        step.executionTime = Date.now() - stepStartTime
        step.success = false
        step.output = { error: error.message }
        
        flowResult.steps.push(step)
        throw error
      }
    })
  })

  describe('Step 2: Attribute Definition', () => {
    test('should define attributes when table exists', async () => {
      const stepStartTime = Date.now()
      const step: FlowStep = {
        step: 2,
        stepName: 'Attribute Definition',
        templateId: 'define_attributes',
        input: {
          tableId: flowResult.variables.tableId,
          attributes: [
            {
              name: 'name',
              type: 'string',
              required: true
            },
            {
              name: 'email',
              type: 'string',
              required: true
            },
            {
              name: 'age',
              type: 'integer',
              required: false
            }
          ]
        },
        timestamp: new Date().toISOString()
      }

      try {
        const result = await templateRunner.runTemplate('define_attributes', step.input)
        
        step.executionTime = Date.now() - stepStartTime
        step.success = result.success
        step.output = result.data

        if (result.success && result.data) {
          // 속성 ID들을 변수로 저장
          flowResult.variables.attributeIds = result.data.attributeIds || result.data.attributes?.map((attr: any) => attr.id)
        }

        // 개별 단계 로깅
        businessTestLogger.logBusinessTest({
          testName: step.stepName,
          businessContext: 'template-flow',
          testType: 'integration',
          input: step.input,
          output: step.output,
          success: step.success,
          executionTime: step.executionTime,
          businessMetrics: {
            executionTime: step.executionTime,
            memoryUsage: process.memoryUsage().heapUsed,
            complexityScore: 1
          },
          validationResults: {
            expectations: [],
            passed: step.success ? 1 : 0,
            failed: step.success ? 0 : 1
          },
          metadata: {
            step: step.step,
            templateId: step.templateId,
            flowId: flowResult.flowId
          }
        })

        flowResult.steps.push(step)
        
        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(flowResult.variables.attributeIds).toBeDefined()
        
        console.log(`✅ Step 2 completed: ${step.input.attributes.length} attributes defined`)
      } catch (error) {
        step.executionTime = Date.now() - stepStartTime
        step.success = false
        step.output = { error: error.message }
        
        flowResult.steps.push(step)
        throw error
      }
    })
  })

  describe('Step 3: Node Creation', () => {
    test('should create node with attributes when table and attributes defined', async () => {
      const stepStartTime = Date.now()
      const step: FlowStep = {
        step: 3,
        stepName: 'Node Creation',
        templateId: 'create_node_with_attributes',
        input: {
          tableId: flowResult.variables.tableId,
          attributes: {
            name: 'John Doe',
            email: 'john.doe@example.com',
            age: 30
          }
        },
        timestamp: new Date().toISOString()
      }

      try {
        const result = await templateRunner.runTemplate('create_node_with_attributes', step.input)
        
        step.executionTime = Date.now() - stepStartTime
        step.success = result.success
        step.output = result.data

        if (result.success && result.data) {
          // 노드 ID를 변수로 저장
          flowResult.variables.nodeId = result.data.id || result.data.nodeId
        }

        // 개별 단계 로깅
        businessTestLogger.logBusinessTest({
          testName: step.stepName,
          businessContext: 'template-flow',
          testType: 'integration',
          input: step.input,
          output: step.output,
          success: step.success,
          executionTime: step.executionTime,
          businessMetrics: {
            executionTime: step.executionTime,
            memoryUsage: process.memoryUsage().heapUsed,
            complexityScore: 1
          },
          validationResults: {
            expectations: [],
            passed: step.success ? 1 : 0,
            failed: step.success ? 0 : 1
          },
          metadata: {
            step: step.step,
            templateId: step.templateId,
            flowId: flowResult.flowId
          }
        })

        flowResult.steps.push(step)
        
        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(flowResult.variables.nodeId).toBeDefined()
        
        console.log(`✅ Step 3 completed: Node created with ID ${flowResult.variables.nodeId}`)
      } catch (error) {
        step.executionTime = Date.now() - stepStartTime
        step.success = false
        step.output = { error: error.message }
        
        flowResult.steps.push(step)
        throw error
      }
    })
  })

  describe('Step 4: Node Retrieval', () => {
    test('should retrieve node when node exists', async () => {
      const stepStartTime = Date.now()
      const step: FlowStep = {
        step: 4,
        stepName: 'Node Retrieval',
        templateId: 'get_node_with_attributes',
        input: {
          nodeId: flowResult.variables.nodeId
        },
        timestamp: new Date().toISOString()
      }

      try {
        const result = await templateRunner.runTemplate('get_node_with_attributes', step.input)
        
        step.executionTime = Date.now() - stepStartTime
        step.success = result.success
        step.output = result.data

        // 개별 단계 로깅
        businessTestLogger.logBusinessTest({
          testName: step.stepName,
          businessContext: 'template-flow',
          testType: 'integration',
          input: step.input,
          output: step.output,
          success: step.success,
          executionTime: step.executionTime,
          businessMetrics: {
            executionTime: step.executionTime,
            memoryUsage: process.memoryUsage().heapUsed,
            complexityScore: 1
          },
          validationResults: {
            expectations: [],
            passed: step.success ? 1 : 0,
            failed: step.success ? 0 : 1
          },
          metadata: {
            step: step.step,
            templateId: step.templateId,
            flowId: flowResult.flowId
          }
        })

        flowResult.steps.push(step)
        
        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        
        // 데이터 정합성 검증
        if (result.data && result.data.attributes) {
          expect(result.data.attributes.name).toBe('John Doe')
          expect(result.data.attributes.email).toBe('john.doe@example.com')
          expect(result.data.attributes.age).toBe(30)
        }
        
        console.log(`✅ Step 4 completed: Node retrieved with correct data`)
      } catch (error) {
        step.executionTime = Date.now() - stepStartTime
        step.success = false
        step.output = { error: error.message }
        
        flowResult.steps.push(step)
        throw error
      }
    })
  })

  describe('Step 5: Node Removal', () => {
    test('should remove node when node exists', async () => {
      const stepStartTime = Date.now()
      const step: FlowStep = {
        step: 5,
        stepName: 'Node Removal',
        templateId: 'delete_node',
        input: {
          nodeId: flowResult.variables.nodeId
        },
        timestamp: new Date().toISOString()
      }

      try {
        const result = await templateRunner.runTemplate('delete_node', step.input)
        
        step.executionTime = Date.now() - stepStartTime
        step.success = result.success
        step.output = result.data

        // 개별 단계 로깅
        businessTestLogger.logBusinessTest({
          testName: step.stepName,
          businessContext: 'template-flow',
          testType: 'integration',
          input: step.input,
          output: step.output,
          success: step.success,
          executionTime: step.executionTime,
          businessMetrics: {
            executionTime: step.executionTime,
            memoryUsage: process.memoryUsage().heapUsed,
            complexityScore: 1
          },
          validationResults: {
            expectations: [],
            passed: step.success ? 1 : 0,
            failed: step.success ? 0 : 1
          },
          metadata: {
            step: step.step,
            templateId: step.templateId,
            flowId: flowResult.flowId
          }
        })

        flowResult.steps.push(step)
        
        expect(result.success).toBe(true)
        
        // 노드 제거 확인
        const verifyResult = await templateRunner.runTemplate('get_node_with_attributes', { nodeId: flowResult.variables.nodeId })
        expect(verifyResult.success).toBe(false) // 노드가 존재하지 않아야 함
        
        console.log(`✅ Step 5 completed: Node removed successfully`)
      } catch (error) {
        step.executionTime = Date.now() - stepStartTime
        step.success = false
        step.output = { error: error.message }
        
        flowResult.steps.push(step)
        throw error
      }
    })
  })

  describe('Complete Flow', () => {
    test('should execute complete flow when all steps performed sequentially', async () => {
      // 전체 플로우 검증
      expect(flowResult.steps).toHaveLength(5)
      expect(flowResult.steps.every(step => step.success)).toBe(true)
      expect(flowResult.variables.tableId).toBeDefined()
      expect(flowResult.variables.nodeId).toBeDefined()
      
      console.log(`\n🎯 Complete Template Flow Summary:`)
      console.log(`   Flow ID: ${flowResult.flowId}`)
      console.log(`   Total Steps: ${flowResult.steps.length}`)
      console.log(`   Success Rate: ${(flowResult.steps.filter(s => s.success).length / flowResult.steps.length * 100).toFixed(1)}%`)
      console.log(`   Total Duration: ${flowResult.totalDuration}ms`)
      console.log(`   Variables: ${JSON.stringify(flowResult.variables, null, 2)}`)
    })
  })
})
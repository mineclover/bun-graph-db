import { describe, test, beforeAll, afterAll, expect } from 'bun:test'
import { createYoga } from 'graphql-yoga'
import { ContainerBootstrap } from '../../src/infrastructure/container/ContainerBootstrap.js'
import { GraphQLSchemaBuilder } from '../../src/presentation/graphql/GraphQLSchemaBuilder.js'
import { TemplateTestRunner } from '../setup/TemplateTestRunner.js'
import { businessTestLogger } from '../setup/BusinessTestLogger.js'
import { detailedAnalysisLogger } from '../setup/DetailedAnalysisLogger.js'

interface FlowStep {
  step: number
  stepName: string
  templateId: string
  input: any
  timestamp: string
  executionTime?: number
  success?: boolean
  output?: any
}

interface FlowResult {
  flowId: string
  flowName: string
  startTime: string
  steps: FlowStep[]
  variables: Record<string, any>
  endTime?: string
  totalDuration?: number
  overallSuccess?: boolean
}

describe('Template Flow Complete Tests', () => {
  let container: any
  let yoga: any
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
    console.log('TemplateTestRunner instance created:', templateRunner)
    console.log('TemplateTestRunner config loaded:', !!templateRunner.config)
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

        if (result.success && result.data?.createTable?.table?.id) {
          flowResult.variables.tableId = result.data.createTable.table.id
          console.log(`✅ Step 1: Table created with ID: ${result.data.createTable.table.id}`)
        } else {
          console.log(`❌ Step 1: Table creation failed:`, result.error)
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
      } catch (error) {
        step.executionTime = Date.now() - stepStartTime
        step.success = false
        step.output = { error: error.message }
        flowResult.steps.push(step)
        throw error
      }
    })
  })

  describe('Step 2: Create String Attribute Type', () => {
    test('should create string attribute type', async () => {
      const stepStartTime = Date.now()
      const step: FlowStep = {
        step: 2,
        stepName: 'Create String Attribute Type',
        templateId: 'create_string_attribute_type',
        input: {},
        timestamp: new Date().toISOString()
      }

      try {
        const result = await templateRunner.runTemplate('create_string_attribute_type', step.input)
        
        step.executionTime = Date.now() - stepStartTime
        step.success = result.success
        step.output = result.data

        if (result.success && result.data?.createAttributeType?.attributeType?.id) {
          flowResult.variables.stringAttributeTypeId = result.data.createAttributeType.attributeType.id
          console.log(`✅ Step 2: String attribute type created with ID: ${result.data.createAttributeType.attributeType.id}`)
        } else {
          console.log(`❌ Step 2: String attribute type creation failed:`, result.error)
        }

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
      } catch (error) {
        step.executionTime = Date.now() - stepStartTime
        step.success = false
        step.output = { error: error.message }
        flowResult.steps.push(step)
        throw error
      }
    })
  })

  describe('Step 3: Create Integer Attribute Type', () => {
    test('should create integer attribute type', async () => {
      const stepStartTime = Date.now()
      const step: FlowStep = {
        step: 3,
        stepName: 'Create Integer Attribute Type',
        templateId: 'create_integer_attribute_type',
        input: {},
        timestamp: new Date().toISOString()
      }

      try {
        const result = await templateRunner.runTemplate('create_integer_attribute_type', step.input)
        
        step.executionTime = Date.now() - stepStartTime
        step.success = result.success
        step.output = result.data

        if (result.success && result.data?.createAttributeType?.attributeType?.id) {
          flowResult.variables.integerAttributeTypeId = result.data.createAttributeType.attributeType.id
          console.log(`✅ Step 3: Integer attribute type created with ID: ${result.data.createAttributeType.attributeType.id}`)
        } else {
          console.log(`❌ Step 3: Integer attribute type creation failed:`, result.error)
        }

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
      } catch (error) {
        step.executionTime = Date.now() - stepStartTime
        step.success = false
        step.output = { error: error.message }
        flowResult.steps.push(step)
        throw error
      }
    })
  })

  describe('Step 4: Create Name Attribute', () => {
    test('should create name attribute for table', async () => {
      const stepStartTime = Date.now()
      const step: FlowStep = {
        step: 4,
        stepName: 'Create Name Attribute',
        templateId: 'create_name_attribute',
        input: {
          tableId: flowResult.variables.tableId
        },
        timestamp: new Date().toISOString()
      }

      try {
        const result = await templateRunner.runTemplate('create_name_attribute', step.input)
        
        step.executionTime = Date.now() - stepStartTime
        step.success = result.success
        step.output = result.data

        if (result.success && result.data?.createAttribute?.attribute?.id) {
          flowResult.variables.nameAttributeId = result.data.createAttribute.attribute.id
          console.log(`✅ Step 2: Name attribute created with ID: ${result.data.createAttribute.attribute.id}`)
        } else {
          console.log(`❌ Step 2: Name attribute creation failed:`, result.error)
        }

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
      } catch (error) {
        step.executionTime = Date.now() - stepStartTime
        step.success = false
        step.output = { error: error.message }
        flowResult.steps.push(step)
        throw error
      }
    })
  })

  describe('Step 5: Create Email Attribute', () => {
    test('should create email attribute for table', async () => {
      const stepStartTime = Date.now()
      const step: FlowStep = {
        step: 5,
        stepName: 'Create Email Attribute',
        templateId: 'create_email_attribute',
        input: {
          tableId: flowResult.variables.tableId
        },
        timestamp: new Date().toISOString()
      }

      try {
        const result = await templateRunner.runTemplate('create_email_attribute', step.input)
        
        step.executionTime = Date.now() - stepStartTime
        step.success = result.success
        step.output = result.data

        if (result.success && result.data?.createAttribute?.attribute?.id) {
          flowResult.variables.emailAttributeId = result.data.createAttribute.attribute.id
          console.log(`✅ Step 3: Email attribute created with ID: ${result.data.createAttribute.attribute.id}`)
        } else {
          console.log(`❌ Step 3: Email attribute creation failed:`, result.error)
        }

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
      } catch (error) {
        step.executionTime = Date.now() - stepStartTime
        step.success = false
        step.output = { error: error.message }
        flowResult.steps.push(step)
        throw error
      }
    })
  })

  describe('Step 6: Create Age Attribute', () => {
    test('should create age attribute for table', async () => {
      const stepStartTime = Date.now()
      const step: FlowStep = {
        step: 6,
        stepName: 'Create Age Attribute',
        templateId: 'create_age_attribute',
        input: {
          tableId: flowResult.variables.tableId
        },
        timestamp: new Date().toISOString()
      }

      try {
        const result = await templateRunner.runTemplate('create_age_attribute', step.input)
        
        step.executionTime = Date.now() - stepStartTime
        step.success = result.success
        step.output = result.data

        if (result.success && result.data?.createAttribute?.attribute?.id) {
          flowResult.variables.ageAttributeId = result.data.createAttribute.attribute.id
          console.log(`✅ Step 4: Age attribute created with ID: ${result.data.createAttribute.attribute.id}`)
        } else {
          console.log(`❌ Step 4: Age attribute creation failed:`, result.error)
        }

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
      } catch (error) {
        step.executionTime = Date.now() - stepStartTime
        step.success = false
        step.output = { error: error.message }
        flowResult.steps.push(step)
        throw error
      }
    })
  })

  describe('Step 7: Create Node with Attributes', () => {
    test('should create node with all attributes', async () => {
      const stepStartTime = Date.now()
      const step: FlowStep = {
        step: 7,
        stepName: 'Node Creation',
        templateId: 'create_node_with_attributes',
        input: {
          tableId: flowResult.variables.tableId,
          nameAttributeId: flowResult.variables.nameAttributeId,
          emailAttributeId: flowResult.variables.emailAttributeId,
          ageAttributeId: flowResult.variables.ageAttributeId
        },
        timestamp: new Date().toISOString()
      }

      try {
        const result = await templateRunner.runTemplate('create_node_with_attributes', step.input)
        
        step.executionTime = Date.now() - stepStartTime
        step.success = result.success
        step.output = result.data

        if (result.success && result.data?.createNode?.node?.id) {
          flowResult.variables.nodeId = result.data.createNode.node.id
          console.log(`✅ Step 5: Node created with ID: ${result.data.createNode.node.id}`)
        } else {
          console.log(`❌ Step 5: Node creation failed:`, result.error)
        }

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
      } catch (error) {
        step.executionTime = Date.now() - stepStartTime
        step.success = false
        step.output = { error: error.message }
        flowResult.steps.push(step)
        throw error
      }
    })
  })

  describe('Step 8: Retrieve Node with Attributes', () => {
    test('should retrieve node with all attributes', async () => {
      const stepStartTime = Date.now()
      const step: FlowStep = {
        step: 8,
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

        if (result.success && result.data?.node?.id) {
          console.log(`✅ Step 6: Node retrieved with ID: ${result.data.node.id}`)
          console.log(`   Attributes count: ${result.data.node.attributes?.length || 0}`)
        } else {
          console.log(`❌ Step 6: Node retrieval failed:`, result.error)
        }

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
      } catch (error) {
        step.executionTime = Date.now() - stepStartTime
        step.success = false
        step.output = { error: error.message }
        flowResult.steps.push(step)
        throw error
      }
    })
  })

  describe('Step 9: Delete Node', () => {
    test('should delete node successfully', async () => {
      const stepStartTime = Date.now()
      const step: FlowStep = {
        step: 9,
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

        if (result.success) {
          console.log(`✅ Step 7: Node deleted successfully`)
        } else {
          console.log(`❌ Step 7: Node deletion failed:`, result.error)
        }

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
      } catch (error) {
        step.executionTime = Date.now() - stepStartTime
        step.success = false
        step.output = { error: error.message }
        flowResult.steps.push(step)
        throw error
      }
    })
  })

  describe('Flow Validation', () => {
    test('should complete all steps successfully', () => {
      expect(flowResult.steps).toHaveLength(9)
      expect(flowResult.overallSuccess).toBe(true)
      expect(flowResult.variables.tableId).toBeDefined()
      expect(flowResult.variables.nameAttributeId).toBeDefined()
      expect(flowResult.variables.emailAttributeId).toBeDefined()
      expect(flowResult.variables.ageAttributeId).toBeDefined()
      expect(flowResult.variables.nodeId).toBeDefined()
      
      console.log('\n🎉 Complete Template Flow Summary:')
      console.log(`   Flow ID: ${flowResult.flowId}`)
      console.log(`   Total Steps: ${flowResult.steps.length}`)
      console.log(`   Success Rate: ${(flowResult.steps.filter(s => s.success).length / flowResult.steps.length * 100).toFixed(1)}%`)
      console.log(`   Total Duration: ${flowResult.totalDuration}ms`)
      console.log(`   Table ID: ${flowResult.variables.tableId}`)
      console.log(`   Node ID: ${flowResult.variables.nodeId}`)
    })
  })
})
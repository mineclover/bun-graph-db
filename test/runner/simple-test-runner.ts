#!/usr/bin/env bun

/**
 * Simple Test Runner
 * 
 * 단순화된 테스트 실행기
 * - setup: 환경 설정 테스트
 * - queries: 쿼리 테스트
 * - all: 모든 테스트
 */

import { spawn } from 'child_process'
import { frameworkTestLogger } from '../setup/FrameworkTestLogger.js'

interface TestCategory {
  name: string
  description: string
  path: string
}

const TEST_CATEGORIES: TestCategory[] = [
  {
    name: 'setup',
    description: '환경 설정 테스트',
    path: 'test/setup/'
  },
  {
    name: 'queries',
    description: '쿼리 테스트',
    path: 'test/queries/'
  }
]

function showHelp(): void {
  console.log(`
🎯 Simple Test Runner

Usage: bun simple-test-runner.ts [category]

Categories:
  setup     환경 설정 테스트
  queries   쿼리 테스트
  all       모든 테스트

Examples:
  bun simple-test-runner.ts setup      # 환경 설정 테스트만 실행
  bun simple-test-runner.ts queries    # 쿼리 테스트만 실행
  bun simple-test-runner.ts all        # 모든 테스트 실행
`)
}

async function runTest(category: TestCategory): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    
    console.log(`\n🚀 Running ${category.description}...`)
    console.log(`   Path: ${category.path}`)
    
    const child = spawn('bun', ['test', category.path], {
      stdio: 'inherit',
      shell: true
    })
    
    child.on('close', (code) => {
      const duration = Date.now() - startTime
      
      if (code === 0) {
        console.log(`✅ ${category.description} completed successfully (${duration}ms)`)
        resolve()
      } else {
        console.log(`❌ ${category.description} failed (exit code: ${code}, ${duration}ms)`)
        
        // 프레임워크 레벨 에러를 로그에 기록
        frameworkTestLogger.logFrameworkTest({
          testSuite: category.name,
          executionStatus: 'failed',
          summary: { total: 1, passed: 0, failed: 1 },
          duration,
          frameworkErrors: [`Test failed with exit code ${code}`],
          metadata: {
            testFramework: 'bun',
            exitCode: code,
            errorType: 'TEST_FRAMEWORK_ERROR',
            errorDetails: `Test '${category.name}' failed with exit code ${code}`,
            testPath: category.path
          }
        })
        
        reject(new Error(`Test failed with exit code ${code}`))
      }
    })
    
    child.on('error', (error) => {
      const duration = Date.now() - startTime
      console.log(`❌ ${category.description} execution error: ${error.message}`)
      
      // 테스트 실행 에러를 로그에 기록
      frameworkTestLogger.logFrameworkTest({
        testSuite: category.name,
        executionStatus: 'failed',
        summary: { total: 1, passed: 0, failed: 1 },
        duration,
        frameworkErrors: [error.message],
        metadata: {
          errorType: 'TEST_EXECUTION_ERROR',
          errorDetails: `Test execution failed: ${error.message}`,
          testPath: category.path
        }
      })
      
      reject(error)
    })
  })
}

async function runAllTests(): Promise<void> {
  console.log('\n🎯 Running all tests...')
  
  for (const category of TEST_CATEGORIES) {
    try {
      await runTest(category)
    } catch (error) {
      console.error(`Failed to run ${category.name}:`, error)
      // 계속 진행
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp()
    return
  }
  
  // 프레임워크 테스트 로거 초기화
  frameworkTestLogger.initializeTestSuite('simple-test-runner')
  
  const category = args[0] || 'all'
  
  try {
    if (category === 'all') {
      await runAllTests()
    } else {
      const testCategory = TEST_CATEGORIES.find(c => c.name === category)
      if (!testCategory) {
        console.log(`❌ Unknown category: ${category}`)
        showHelp()
        return
      }
      
      await runTest(testCategory)
    }
    
    console.log('\n✅ All tests completed successfully!')
  } catch (error) {
    console.error('\n❌ Some tests failed:', error)
  } finally {
    // 프레임워크 테스트 로거 완료
    frameworkTestLogger.finalizeTestSuite()
  }
}

if (import.meta.main) {
  main().catch((error) => {
    // CLI 에러도 프레임워크 로그에 기록
    frameworkTestLogger.logFrameworkTest({
      testSuite: 'CLI Error',
      executionStatus: 'failed',
      summary: { total: 0, passed: 0, failed: 1 },
      duration: 0,
      frameworkErrors: [error.message],
      metadata: {
        errorType: 'CLI_ERROR',
        errorDetails: `CLI execution failed: ${error.message}`
      }
    })
    
    frameworkTestLogger.finalizeTestSuite()
    console.error(error)
    process.exit(1)
  })
}

#!/usr/bin/env bun

/**
 * Test Runner by Purpose
 * 
 * 목적별로 테스트를 실행하는 스크립트
 * - CRUD 테스트
 * - 검증 테스트
 * - 통합 테스트
 * - 성능 테스트
 * - 보안 테스트
 * - 호환성 테스트
 * - 회귀 테스트
 */

import { spawn } from 'child_process'
import { join } from 'path'
import { frameworkTestLogger } from '../../framework/reporter/FrameworkTestLogger.js'

interface TestPurpose {
  name: string
  description: string
  path: string
  tags: string[]
  priority: 'critical' | 'high' | 'medium' | 'low'
}

const TEST_PURPOSES: TestPurpose[] = [
  {
    name: 'crud',
    description: 'CRUD 작업 테스트',
    path: 'test/business/crud/',
    tags: ['crud'],
    priority: 'critical'
  },
  {
    name: 'validation',
    description: '데이터 검증 테스트',
    path: 'test/business/validation/',
    tags: ['validation'],
    priority: 'high'
  },
  {
    name: 'business-rules',
    description: '비즈니스 규칙 테스트',
    path: 'test/business/business-rules/',
    tags: ['business-rules'],
    priority: 'high'
  },
  {
    name: 'workflow',
    description: '워크플로우 테스트',
    path: 'test/business/workflows/',
    tags: ['workflow'],
    priority: 'medium'
  },
  {
    name: 'integration',
    description: '통합 테스트',
    path: 'test/integration/',
    tags: ['integration'],
    priority: 'high'
  },
  {
    name: 'performance',
    description: '성능 테스트',
    path: 'test/performance/',
    tags: ['performance'],
    priority: 'medium'
  },
  {
    name: 'security',
    description: '보안 테스트',
    path: 'test/security/',
    tags: ['security'],
    priority: 'critical'
  },
  {
    name: 'compatibility',
    description: '호환성 테스트',
    path: 'test/compatibility/',
    tags: ['compatibility'],
    priority: 'low'
  },
  {
    name: 'regression',
    description: '회귀 테스트',
    path: 'test/regression/',
    tags: ['regression'],
    priority: 'high'
  }
]

function showHelp(): void {
  console.log(`
🎯 Test Runner by Purpose

Usage: bun test-runner-by-purpose.ts [options] [purpose...]

Options:
  --help, -h          Show this help message
  --list, -l          List all available test purposes
  --priority <level>  Run tests by priority (critical, high, medium, low)
  --tags <tags>       Run tests by tags (comma-separated)
  --parallel, -p      Run tests in parallel
  --sequential, -s    Run tests sequentially (default)
  --verbose, -v       Show detailed output
  --quiet, -q         Show minimal output

Test Purposes:
${TEST_PURPOSES.map(p => `  ${p.name.padEnd(15)} ${p.description} (${p.priority})`).join('\n')}

Examples:
  bun test-runner-by-purpose.ts crud                    # CRUD 테스트만 실행
  bun test-runner-by-purpose.ts validation integration  # 검증과 통합 테스트 실행
  bun test-runner-by-purpose.ts --priority critical     # 중요도 높은 테스트만 실행
  bun test-runner-by-purpose.ts --tags crud,template    # CRUD와 템플릿 관련 테스트 실행
  bun test-runner-by-purpose.ts --parallel performance  # 성능 테스트를 병렬로 실행
`)
}

function listTestPurposes(): void {
  console.log('\n📋 Available Test Purposes:\n')
  
  TEST_PURPOSES.forEach(purpose => {
    console.log(`🎯 ${purpose.name}`)
    console.log(`   Description: ${purpose.description}`)
    console.log(`   Path: ${purpose.path}`)
    console.log(`   Tags: ${purpose.tags.join(', ')}`)
    console.log(`   Priority: ${purpose.priority}`)
    console.log('')
  })
}

function getTestsByPriority(priority: string): TestPurpose[] {
  return TEST_PURPOSES.filter(p => p.priority === priority)
}

function getTestsByTags(tags: string[]): TestPurpose[] {
  return TEST_PURPOSES.filter(p => 
    tags.some(tag => p.tags.includes(tag))
  )
}

function getTestsByNames(names: string[]): TestPurpose[] {
  return TEST_PURPOSES.filter(p => names.includes(p.name))
}

async function runTest(purpose: TestPurpose, options: { parallel?: boolean; verbose?: boolean }): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    
    console.log(`\n🚀 Running ${purpose.description}...`)
    console.log(`   Path: ${purpose.path}`)
    console.log(`   Tags: ${purpose.tags.join(', ')}`)
    console.log(`   Priority: ${purpose.priority}`)
    
    const testCommand = `bun test ${purpose.path}`
    const child = spawn('bun', ['test', purpose.path], {
      stdio: options.verbose ? 'inherit' : 'pipe',
      shell: true
    })
    
    let output = ''
    let errorOutput = ''
    
    if (!options.verbose) {
      child.stdout?.on('data', (data) => {
        output += data.toString()
      })
      
      child.stderr?.on('data', (data) => {
        errorOutput += data.toString()
      })
    }
    
    child.on('close', (code) => {
      const duration = Date.now() - startTime
      
      if (code === 0) {
        console.log(`✅ ${purpose.description} completed successfully (${duration}ms)`)
        resolve()
      } else {
        console.log(`❌ ${purpose.description} failed (exit code: ${code}, ${duration}ms)`)
        
        // 프레임워크 레벨 에러를 로그에 기록
        frameworkTestLogger.logFrameworkTest({
          testSuite: purpose.name,
          executionStatus: 'failed',
          summary: { total: 1, passed: 0, failed: 1 },
          duration,
          frameworkErrors: [`Test failed with exit code ${code}`],
          metadata: {
            testFramework: 'bun',
            exitCode: code,
            errorType: 'TEST_FRAMEWORK_ERROR',
            errorDetails: `Test '${purpose.name}' failed with exit code ${code}`,
            testPath: purpose.path,
            testTags: purpose.tags,
            testPriority: purpose.priority
          }
        })
        
        reject(new Error(`Test failed with exit code ${code}`))
      }
    })
    
    child.on('error', (error) => {
      const duration = Date.now() - startTime
      console.log(`❌ ${purpose.description} execution error: ${error.message}`)
      
      // 테스트 실행 에러를 로그에 기록
      frameworkTestLogger.logFrameworkTest({
        testSuite: purpose.name,
        executionStatus: 'failed',
        summary: { total: 1, passed: 0, failed: 1 },
        duration,
        frameworkErrors: [error.message],
        metadata: {
          errorType: 'TEST_EXECUTION_ERROR',
          errorDetails: `Test execution failed: ${error.message}`,
          testPath: purpose.path,
          testTags: purpose.tags,
          testPriority: purpose.priority
        }
      })
      
      reject(error)
    })
  })
}

async function runTestsSequentially(tests: TestPurpose[], options: { verbose?: boolean }): Promise<void> {
  for (const test of tests) {
    try {
      await runTest(test, options)
    } catch (error) {
      console.error(`Failed to run ${test.name}:`, error)
      // 계속 진행
    }
  }
}

async function runTestsInParallel(tests: TestPurpose[], options: { verbose?: boolean }): Promise<void> {
  const promises = tests.map(test => 
    runTest(test, options).catch(error => {
      console.error(`Failed to run ${test.name}:`, error)
      return null
    })
  )
  
  await Promise.all(promises)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp()
    return
  }
  
  if (args.includes('--list') || args.includes('-l')) {
    listTestPurposes()
    return
  }
  
  // 프레임워크 테스트 로거 초기화
  frameworkTestLogger.initializeTestSuite('test-runner-by-purpose')
  
  const options = {
    parallel: args.includes('--parallel') || args.includes('-p'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    quiet: args.includes('--quiet') || args.includes('-q')
  }
  
  let testsToRun: TestPurpose[] = []
  
  // 우선순위별 테스트 실행
  const priorityIndex = args.indexOf('--priority')
  if (priorityIndex !== -1 && args[priorityIndex + 1]) {
    const priority = args[priorityIndex + 1]
    testsToRun = getTestsByPriority(priority)
    console.log(`\n🎯 Running tests by priority: ${priority}`)
  }
  
  // 태그별 테스트 실행
  const tagsIndex = args.indexOf('--tags')
  if (tagsIndex !== -1 && args[tagsIndex + 1]) {
    const tags = args[tagsIndex + 1].split(',').map(t => t.trim())
    testsToRun = getTestsByTags(tags)
    console.log(`\n🏷️ Running tests by tags: ${tags.join(', ')}`)
  }
  
  // 이름별 테스트 실행
  const testNames = args.filter(arg => 
    !arg.startsWith('--') && 
    !arg.startsWith('-') && 
    arg !== '--priority' && 
    arg !== '--tags' &&
    arg !== '--parallel' &&
    arg !== '--sequential' &&
    arg !== '--verbose' &&
    arg !== '--quiet'
  )
  
  if (testNames.length > 0) {
    testsToRun = getTestsByNames(testNames)
    console.log(`\n📝 Running tests by names: ${testNames.join(', ')}`)
  }
  
  // 기본값: 모든 테스트 실행
  if (testsToRun.length === 0) {
    testsToRun = TEST_PURPOSES
    console.log('\n🎯 Running all tests by purpose')
  }
  
  if (testsToRun.length === 0) {
    console.log('❌ No tests found to run')
    return
  }
  
  console.log(`\n📊 Found ${testsToRun.length} test purposes to run:`)
  testsToRun.forEach(test => {
    console.log(`   - ${test.name}: ${test.description} (${test.priority})`)
  })
  
  try {
    if (options.parallel) {
      console.log('\n⚡ Running tests in parallel...')
      await runTestsInParallel(testsToRun, options)
    } else {
      console.log('\n🔄 Running tests sequentially...')
      await runTestsSequentially(testsToRun, options)
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

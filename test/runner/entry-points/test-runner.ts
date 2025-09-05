#!/usr/bin/env bun

/**
 * Unified Test Runner
 * 
 * 모든 테스트를 실행하기 위한 단일 진입점
 * 주제별, 카테고리별로 테스트를 선택적으로 실행 가능
 */

import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { frameworkTestLogger } from '../../framework/reporter/FrameworkTestLogger.js'

interface TestConfig {
  name: string
  description: string
  path: string
  category: 'template' | 'node' | 'graphql' | 'integration' | 'all'
  priority: 'high' | 'medium' | 'low'
}

const TEST_CONFIGS: TestConfig[] = [
  {
    name: 'template-crud',
    description: 'Template CRUD Operations',
    path: 'test/suites/template/template-crud.test.ts',
    category: 'template',
    priority: 'high'
  },
  {
    name: 'template-driven',
    description: 'Template Driven Tests',
    path: 'test/suites/template/template-driven.test.ts',
    category: 'template',
    priority: 'high'
  },
  {
    name: 'template-system-improved',
    description: 'Improved Template System',
    path: 'test/suites/template/template-system-improved.test.ts',
    category: 'template',
    priority: 'medium'
  },
  {
    name: 'template-execution',
    description: 'Template Execution Tests',
    path: 'test/suites/template/template-execution.test.ts',
    category: 'template',
    priority: 'medium'
  },
  {
    name: 'template-basic',
    description: 'Basic Template Tests',
    path: 'test/suites/template/template-basic.test.ts',
    category: 'template',
    priority: 'low'
  },
  {
    name: 'template-node-mutations',
    description: 'Template-based Node Mutations',
    path: 'test/suites/template/template-based-node-mutations.test.ts',
    category: 'node',
    priority: 'medium'
  }
]

class TestRunner {
  private configs: TestConfig[]

  constructor() {
    this.configs = TEST_CONFIGS.filter(config => existsSync(config.path))
  }

  /**
   * 사용 가능한 테스트 목록 출력
   */
  listTests(): void {
    console.log('\n📋 Available Tests:')
    console.log('='.repeat(60))
    
    const categories = this.groupByCategory()
    
    for (const [category, tests] of Object.entries(categories)) {
      console.log(`\n🔹 ${category.toUpperCase()}:`)
      tests.forEach(test => {
        const priority = test.priority === 'high' ? '🔴' : test.priority === 'medium' ? '🟡' : '🟢'
        console.log(`   ${priority} ${test.name} - ${test.description}`)
      })
    }
    
    console.log('\n' + '='.repeat(60))
  }

  /**
   * 카테고리별로 테스트 그룹화
   */
  private groupByCategory(): Record<string, TestConfig[]> {
    return this.configs.reduce((groups, test) => {
      if (!groups[test.category]) {
        groups[test.category] = []
      }
      groups[test.category].push(test)
      return groups
    }, {} as Record<string, TestConfig[]>)
  }

  /**
   * 특정 테스트 실행
   */
  async runTest(testName: string, options: { timeout?: number; verbose?: boolean } = {}): Promise<void> {
    const test = this.configs.find(t => t.name === testName)
    
    if (!test) {
      console.error(`❌ Test not found: ${testName}`)
      this.listTests()
      process.exit(1)
    }

    console.log(`\n🚀 Running test: ${test.description}`)
    console.log(`📁 Path: ${test.path}`)
    console.log(`🏷️  Category: ${test.category}`)
    console.log(`⚡ Priority: ${test.priority}`)
    console.log('='.repeat(60))

    const args = ['test', test.path]
    
    if (options.timeout) {
      args.push('--timeout', options.timeout.toString())
    }
    
    if (options.verbose) {
      args.push('--verbose')
    }

    return new Promise((resolve, reject) => {
      const child = spawn('bun', args, {
        stdio: 'inherit',
        cwd: process.cwd()
      })

      child.on('close', (code) => {
        if (code === 0) {
          console.log(`\n✅ Test completed successfully: ${test.name}`)
          resolve()
        } else {
          console.log(`\n❌ Test failed: ${test.name} (exit code: ${code})`)
          
          // 테스트 프레임워크 레벨 에러를 로그에 기록
          testLogger.logTest({
            testName: `Test Framework Error: ${test.name}`,
            testType: 'framework',
            input: { testName: test.name, category: test.category, priority: test.priority },
            output: null,
            success: false,
            error: `Test failed with exit code ${code}`,
            executionTime: Date.now() - startTime,
            metadata: {
              testFramework: 'bun',
              exitCode: code,
              errorType: 'TEST_FRAMEWORK_ERROR',
              errorDetails: `Test '${test.name}' failed with exit code ${code}`
            },
            errorDetails: {
              errorType: 'TEST_FRAMEWORK_ERROR',
              errorMessage: `Test failed with exit code ${code}`,
              errorStack: new Error().stack,
              testName: test.name,
              exitCode: code
            }
          })
          
          reject(new Error(`Test failed with exit code ${code}`))
        }
      })

      child.on('error', (error) => {
        console.error(`\n💥 Test execution error: ${error.message}`)
        
        // 테스트 실행 에러를 로그에 기록
        testLogger.logTest({
          testName: `Test Execution Error: ${test.name}`,
          testType: 'framework',
          input: { testName: test.name, category: test.category, priority: test.priority },
          output: null,
          success: false,
          error: error.message,
          executionTime: Date.now() - startTime,
          metadata: {
            testFramework: 'bun',
            errorType: 'TEST_EXECUTION_ERROR',
            errorDetails: `Failed to execute test '${test.name}': ${error.message}`
          },
          errorDetails: {
            errorType: 'TEST_EXECUTION_ERROR',
            errorMessage: error.message,
            errorStack: error.stack,
            testName: test.name
          }
        })
        
        reject(error)
      })
    })
  }

  /**
   * 카테고리별 테스트 실행
   */
  async runCategory(category: string, options: { timeout?: number; verbose?: boolean } = {}): Promise<void> {
    const tests = this.configs.filter(t => t.category === category)
    
    if (tests.length === 0) {
      console.error(`❌ No tests found for category: ${category}`)
      this.listTests()
      process.exit(1)
    }

    console.log(`\n🎯 Running ${category} tests (${tests.length} tests)`)
    console.log('='.repeat(60))

    for (const test of tests) {
      try {
        await this.runTest(test.name, options)
      } catch (error) {
        console.error(`❌ Failed to run test: ${test.name}`)
        if (options.verbose) {
          console.error(error)
        }
      }
    }
  }

  /**
   * 우선순위별 테스트 실행
   */
  async runByPriority(priority: 'high' | 'medium' | 'low', options: { timeout?: number; verbose?: boolean } = {}): Promise<void> {
    const tests = this.configs.filter(t => t.priority === priority)
    
    if (tests.length === 0) {
      console.error(`❌ No tests found for priority: ${priority}`)
      this.listTests()
      process.exit(1)
    }

    console.log(`\n⚡ Running ${priority} priority tests (${tests.length} tests)`)
    console.log('='.repeat(60))

    for (const test of tests) {
      try {
        await this.runTest(test.name, options)
      } catch (error) {
        console.error(`❌ Failed to run test: ${test.name}`)
        if (options.verbose) {
          console.error(error)
        }
      }
    }
  }

  /**
   * 모든 테스트 실행
   */
  async runAll(options: { timeout?: number; verbose?: boolean } = {}): Promise<void> {
    console.log(`\n🎯 Running all tests (${this.configs.length} tests)`)
    console.log('='.repeat(60))

    for (const test of this.configs) {
      try {
        await this.runTest(test.name, options)
      } catch (error) {
        console.error(`❌ Failed to run test: ${test.name}`)
        if (options.verbose) {
          console.error(error)
        }
      }
    }
  }

  /**
   * 테스트 통계 출력
   */
  showStats(): void {
    const categories = this.groupByCategory()
    const priorities = this.configs.reduce((acc, test) => {
      acc[test.priority] = (acc[test.priority] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log('\n📊 Test Statistics:')
    console.log('='.repeat(40))
    console.log(`Total Tests: ${this.configs.length}`)
    
    console.log('\n📁 By Category:')
    for (const [category, tests] of Object.entries(categories)) {
      console.log(`   ${category}: ${tests.length} tests`)
    }
    
    console.log('\n⚡ By Priority:')
    for (const [priority, count] of Object.entries(priorities)) {
      const icon = priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢'
      console.log(`   ${icon} ${priority}: ${count} tests`)
    }
    
    console.log('='.repeat(40))
  }

  /**
   * 로그 정리
   */
  clearLogs(options: { oldOnly?: boolean; daysOld?: number } = {}): void {
    console.log('\n🧹 Clearing test logs...')
    
    if (options.oldOnly && options.daysOld) {
      testLogger.clearOldLogs(options.daysOld)
    } else {
      testLogger.clearLogs()
    }
  }

  /**
   * 로그 상태 확인
   */
  showLogStats(): void {
    const stats = testLogger.getLogStats()
    
    console.log('\n📊 Log Statistics:')
    console.log('='.repeat(40))
    console.log(`Total Log Files: ${stats.totalFiles}`)
    console.log(`Total Size: ${stats.totalSize}`)
    console.log('='.repeat(40))
  }
}

// CLI 인터페이스
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]
  const target = args[1]
  const options = {
    timeout: args.includes('--timeout') ? parseInt(args[args.indexOf('--timeout') + 1]) : 30000,
    verbose: args.includes('--verbose') || args.includes('-v')
  }

  const runner = new TestRunner()
  
  // 테스트 프레임워크 러너 초기화
  frameworkTestLogger.initializeTestSuite('test-runner-cli')

  switch (command) {
    case 'list':
      runner.listTests()
      break

    case 'stats':
      runner.showStats()
      break

    case 'log-stats':
      runner.showLogStats()
      break

    case 'clear-logs':
      const clearOptions = {
        oldOnly: args.includes('--old-only'),
        daysOld: args.includes('--days') ? parseInt(args[args.indexOf('--days') + 1]) : 7
      }
      runner.clearLogs(clearOptions)
      break

    case 'run':
      if (!target) {
        console.error('❌ Please specify a test name')
        runner.listTests()
        process.exit(1)
      }
      await runner.runTest(target, options)
      break

    case 'category':
      if (!target) {
        console.error('❌ Please specify a category (template, node, graphql, integration)')
        runner.listTests()
        process.exit(1)
      }
      await runner.runCategory(target, options)
      break

    case 'priority':
      if (!target) {
        console.error('❌ Please specify a priority (high, medium, low)')
        runner.listTests()
        process.exit(1)
      }
      await runner.runByPriority(target as 'high' | 'medium' | 'low', options)
      break

    case 'all':
      await runner.runAll(options)
      break

    default:
      console.log(`
🧪 Unified Test Runner

Usage: bun test/runner/entry-points/test-runner.ts [command] [target] [options]

Commands:
  list                    - List all available tests
  stats                   - Show test statistics
  log-stats               - Show log file statistics
  clear-logs              - Clear all test logs
  run <test-name>         - Run a specific test
  category <category>     - Run all tests in a category
  priority <priority>     - Run all tests with a specific priority
  all                     - Run all tests

Categories:
  template                - Template-related tests
  node                    - Node-related tests
  graphql                 - GraphQL-related tests
  integration             - Integration tests

Priorities:
  high                    - High priority tests
  medium                  - Medium priority tests
  low                     - Low priority tests

Options:
  --timeout <ms>          - Set test timeout (default: 30000)
  --verbose, -v           - Verbose output
  --old-only              - Clear only old logs (use with --days)
  --days <number>         - Days old for log cleanup (default: 7)

Examples:
  bun test/runner/entry-points/test-runner.ts list
  bun test/runner/entry-points/test-runner.ts log-stats
  bun test/runner/entry-points/test-runner.ts clear-logs
  bun test/runner/entry-points/test-runner.ts clear-logs --old-only --days 3
  bun test/runner/entry-points/test-runner.ts run template-crud
  bun test/runner/entry-points/test-runner.ts category template
  bun test/runner/entry-points/test-runner.ts priority high
  bun test/runner/entry-points/test-runner.ts all --verbose
`)
      break
  }
  
  // 테스트 프레임워크 스위트 완료
  frameworkTestLogger.finalizeTestSuite()
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

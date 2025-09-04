#!/usr/bin/env bun

/**
 * Unified Test Runner for Bun Graph DB
 * Manages both Bun native tests and Jest integration tests
 */

import { spawn, ChildProcess } from 'child_process'
import { GraphQLTestRunner } from './test-runner.js'

interface TestSuite {
  name: string
  description: string
  command: string[]
  timeout?: number
  env?: Record<string, string>
}

const TEST_SUITES: TestSuite[] = [
  {
    name: 'bun-comprehensive',
    description: 'Bun comprehensive GraphQL integration tests',
    command: ['bun', 'test/test-runner.ts', 'full'],
    timeout: 120000
  },
  {
    name: 'jest-performance',
    description: 'Performance and bulk operations tests',
    command: ['jest', '--testPathPattern=performance.test.ts', '--runInBand'],
    timeout: 120000,
    env: { NODE_ENV: 'test' }
  },
  {
    name: 'jest-relationships',
    description: 'Relationship quality system tests',
    command: ['jest', '--testPathPattern=relationships.test.ts', '--runInBand'],
    timeout: 90000,
    env: { NODE_ENV: 'test' }
  },
  {
    name: 'bun-unit',
    description: 'Bun native unit tests',
    command: ['bun', 'test', '--coverage'],
    timeout: 60000
  }
]

export class UnifiedTestRunner {
  private results: Map<string, TestResult> = new Map()

  async runAllTests(): Promise<TestReport> {
    console.log('🚀 Starting unified test suite...\n')
    
    const startTime = Date.now()
    let totalPassed = 0
    let totalFailed = 0

    for (const suite of TEST_SUITES) {
      console.log(`📋 Running: ${suite.description}`)
      const result = await this.runTestSuite(suite)
      this.results.set(suite.name, result)
      
      if (result.passed) {
        totalPassed++
        console.log(`✅ ${suite.name}: PASSED (${result.duration}ms)\n`)
      } else {
        totalFailed++
        console.log(`❌ ${suite.name}: FAILED (${result.duration}ms)`)
        console.log(`   Error: ${result.error}\n`)
      }
    }

    const totalTime = Date.now() - startTime
    
    const report: TestReport = {
      totalSuites: TEST_SUITES.length,
      passed: totalPassed,
      failed: totalFailed,
      duration: totalTime,
      results: Object.fromEntries(this.results),
      success: totalFailed === 0
    }

    this.printSummary(report)
    return report
  }

  async runTestSuite(suite: TestSuite): Promise<TestResult> {
    const startTime = Date.now()
    
    try {
      const exitCode = await this.executeCommand(suite.command, {
        timeout: suite.timeout || 60000,
        env: { ...process.env, ...suite.env }
      })
      
      const duration = Date.now() - startTime
      
      return {
        name: suite.name,
        passed: exitCode === 0,
        duration,
        error: exitCode !== 0 ? `Exit code: ${exitCode}` : undefined
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: suite.name,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async runSpecificSuite(suiteName: string): Promise<TestResult> {
    const suite = TEST_SUITES.find(s => s.name === suiteName)
    if (!suite) {
      throw new Error(`Test suite '${suiteName}' not found. Available: ${TEST_SUITES.map(s => s.name).join(', ')}`)
    }

    console.log(`🧪 Running specific suite: ${suite.description}`)
    return await this.runTestSuite(suite)
  }

  listSuites(): void {
    console.log('📋 Available test suites:\n')
    TEST_SUITES.forEach(suite => {
      console.log(`  ${suite.name}: ${suite.description}`)
      console.log(`    Command: ${suite.command.join(' ')}`)
      console.log(`    Timeout: ${(suite.timeout || 60000) / 1000}s\n`)
    })
  }

  private async executeCommand(command: string[], options: {
    timeout: number
    env: Record<string, string>
  }): Promise<number> {
    return new Promise((resolve, reject) => {
      const child = spawn(command[0], command.slice(1), {
        stdio: 'inherit',
        env: options.env
      })

      const timeout = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new Error(`Command timed out after ${options.timeout}ms`))
      }, options.timeout)

      child.on('exit', (code) => {
        clearTimeout(timeout)
        resolve(code || 0)
      })

      child.on('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })
  }

  private printSummary(report: TestReport): void {
    console.log('\n' + '='.repeat(60))
    console.log('📊 TEST SUITE SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total Suites: ${report.totalSuites}`)
    console.log(`Passed: ${report.passed}`)
    console.log(`Failed: ${report.failed}`)
    console.log(`Total Duration: ${(report.duration / 1000).toFixed(2)}s`)
    console.log(`Success Rate: ${((report.passed / report.totalSuites) * 100).toFixed(1)}%`)
    
    if (report.failed > 0) {
      console.log('\n❌ Failed Suites:')
      Object.entries(report.results).forEach(([name, result]) => {
        if (!result.passed) {
          console.log(`  - ${name}: ${result.error}`)
        }
      })
    }
    
    console.log('\n' + (report.success ? '✅ ALL TESTS PASSED!' : '❌ SOME TESTS FAILED'))
    console.log('='.repeat(60))
  }

  async generateCoverageReport(): Promise<void> {
    console.log('📊 Generating unified coverage report...')
    
    try {
      // Run Bun coverage
      await this.executeCommand(['bun', 'test', '--coverage'], {
        timeout: 60000,
        env: process.env
      })
      
      // Run Jest coverage
      await this.executeCommand(['jest', '--coverage', '--silent'], {
        timeout: 120000,
        env: { ...process.env, NODE_ENV: 'test' }
      })
      
      console.log('✅ Coverage reports generated')
      console.log('  - Bun coverage: coverage/')
      console.log('  - Jest coverage: coverage/jest/')
    } catch (error) {
      console.error('❌ Failed to generate coverage report:', error)
    }
  }
}

// Types
interface TestResult {
  name: string
  passed: boolean
  duration: number
  error?: string
}

interface TestReport {
  totalSuites: number
  passed: number
  failed: number
  duration: number
  results: Record<string, TestResult>
  success: boolean
}

// CLI interface
if (import.meta.main) {
  const runner = new UnifiedTestRunner()
  const args = process.argv.slice(2)
  const command = args[0] || 'all'

  switch (command) {
    case 'all':
      const report = await runner.runAllTests()
      process.exit(report.success ? 0 : 1)
      break

    case 'list':
      runner.listSuites()
      break

    case 'coverage':
      await runner.generateCoverageReport()
      break

    case 'run':
      const suiteName = args[1]
      if (!suiteName) {
        console.error('❌ Please specify a test suite name')
        runner.listSuites()
        process.exit(1)
      }
      try {
        const result = await runner.runSpecificSuite(suiteName)
        console.log(result.passed ? '✅ Test suite passed' : '❌ Test suite failed')
        process.exit(result.passed ? 0 : 1)
      } catch (error) {
        console.error('❌', error.message)
        process.exit(1)
      }
      break

    default:
      console.log(`
🧪 Unified Test Runner for Bun Graph DB

Usage:
  bun test/unified-test-runner.ts [command]

Commands:
  all       Run all test suites (default)
  list      List all available test suites
  coverage  Generate coverage reports for all test runners
  run <name> Run a specific test suite

Examples:
  bun test/unified-test-runner.ts all
  bun test/unified-test-runner.ts run jest-integration
  bun test/unified-test-runner.ts coverage
`)
      break
  }
}

export default UnifiedTestRunner
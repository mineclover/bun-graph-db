#!/usr/bin/env bun

/**
 * Enhanced Test Runner with Isolation Support
 *
 * Provides structured test execution with isolation strategies,
 * parallel execution, and comprehensive reporting.
 */

import { spawn } from 'bun'
import { cleanupAll } from './fixtures/test-isolation-helpers'

interface TestSuite {
  name: string
  path: string
  description: string
  category: 'unit' | 'integration' | 'e2e' | 'template-indexing'
  isolation: 'none' | 'database' | 'server' | 'full'
  parallel: boolean
  timeout: number
}

const testSuites: TestSuite[] = [
  // Unit Tests (Fast, in-memory)
  {
    name: 'GraphQL Parsing',
    path: 'tests/template-indexing/graphql-parsing.test.ts',
    description: 'GraphQL SDL parsing and operation extraction',
    category: 'unit',
    isolation: 'none',
    parallel: true,
    timeout: 5000,
  },
  {
    name: 'Template Creation',
    path: 'tests/template-indexing/template-creation.file-based-2025-09-17T19-09-39-484Z.test.ts',
    description: 'Template creation with auto-parsing functionality (migrated to file-based)',
    category: 'unit',
    isolation: 'database',
    parallel: true,
    timeout: 5000,
  },
  {
    name: 'System Queries Isolated',
    path: 'tests/system-queries-isolated.test.ts',
    description: 'System query functionality with isolated database',
    category: 'unit',
    isolation: 'database',
    parallel: true,
    timeout: 10000,
  },

  // Integration Tests (Database + Server)
  {
    name: 'Doc System Isolated',
    path: 'tests/doc-system-isolated.test.ts',
    description: 'Documentation system GraphQL API with isolated server',
    category: 'integration',
    isolation: 'server',
    parallel: true,
    timeout: 30000,
  },

  // Legacy Tests (Require migration)
  {
    name: 'Doc System Comprehensive (Legacy)',
    path: 'tests/doc-system-comprehensive.test.ts',
    description: 'Legacy doc system tests - requires running server',
    category: 'integration',
    isolation: 'none',
    parallel: false,
    timeout: 30000,
  },

  // Migrated tests (now re-enabled)
  {
    name: 'Query Name Indexing',
    path: 'tests/template-indexing/query-name-indexing.file-based-2025-09-17T19-09-12-913Z.test.ts',
    description: 'Database indexing and search performance (migrated to file-based)',
    category: 'integration',
    isolation: 'database',
    parallel: true,
    timeout: 15000,
  },
  {
    name: 'Performance Tracking',
    path: 'tests/template-indexing/performance-tracking.file-based-2025-09-17T19-06-19-946Z.test.ts',
    description: 'Execution time tracking and statistics (migrated to file-based)',
    category: 'integration',
    isolation: 'database',
    parallel: true,
    timeout: 15000,
  },
]

interface TestResult {
  suite: TestSuite
  success: boolean
  duration: number
  output: string
  error?: string
}

class TestRunner {
  private results: TestResult[] = []

  async runSuite(suite: TestSuite): Promise<TestResult> {
    console.log(`\n🧪 Running: ${suite.name}`)
    console.log(`   ${suite.description}`)
    console.log(`   📁 ${suite.path}`)

    const startTime = Date.now()

    try {
      const proc = spawn(['bun', 'test', suite.path], {
        stdout: 'pipe',
        stderr: 'pipe',
      })

      const output = await new Response(proc.stdout).text()
      const error = await new Response(proc.stderr).text()

      await proc.exited
      const duration = Date.now() - startTime

      const success = proc.exitCode === 0

      const result: TestResult = {
        suite,
        success,
        duration,
        output,
        error: success ? undefined : error,
      }

      this.results.push(result)

      if (success) {
        console.log(`   ✅ PASSED (${duration}ms)`)
      } else {
        console.log(`   ❌ FAILED (${duration}ms)`)
        if (error) {
          console.log(`   🔍 Error: ${error.split('\n')[0]}`)
        }
      }

      return result
    } catch (err) {
      const duration = Date.now() - startTime
      const result: TestResult = {
        suite,
        success: false,
        duration,
        output: '',
        error: err instanceof Error ? err.message : String(err),
      }

      this.results.push(result)
      console.log(`   💥 ERROR (${duration}ms): ${result.error}`)
      return result
    }
  }

  async runAll(category?: TestSuite['category'], parallel: boolean = false): Promise<void> {
    const suitesToRun = category ? testSuites.filter((suite) => suite.category === category) : testSuites

    console.log(`🚀 Running ${suitesToRun.length} test suite(s)`)
    if (category) {
      console.log(`📂 Category: ${category}`)
    }
    if (parallel) {
      console.log(`⚡ Parallel execution: ${parallel}`)
    }
    console.log('─'.repeat(80))

    const startTime = Date.now()

    if (parallel && suitesToRun.every((suite) => suite.parallel)) {
      // Run parallel suites concurrently
      console.log('🔀 Running tests in parallel...')
      const parallelResults = await Promise.all(suitesToRun.map((suite) => this.runSuite(suite)))
      this.results.push(...parallelResults)
    } else {
      // Run sequentially (default or mixed parallel/sequential)
      console.log('📋 Running tests sequentially...')
      for (const suite of suitesToRun) {
        await this.runSuite(suite)
      }
    }

    const totalDuration = Date.now() - startTime

    // Generate summary report
    this.printSummary(totalDuration, parallel)
  }

  private printSummary(totalDuration: number, parallel: boolean = false): void {
    const passed = this.results.filter((r) => r.success)
    const failed = this.results.filter((r) => !r.success)

    console.log(`\n${'═'.repeat(80)}`)
    console.log('📊 TEST SUMMARY')
    console.log('═'.repeat(80))

    console.log(`⏱️  Total Duration: ${totalDuration}ms`)
    console.log(`⚡ Execution Mode: ${parallel ? 'Parallel' : 'Sequential'}`)
    console.log(`✅ Passed: ${passed.length}`)
    console.log(`❌ Failed: ${failed.length}`)
    console.log(`📈 Success Rate: ${Math.round((passed.length / this.results.length) * 100)}%`)

    // Isolation strategy breakdown
    const isolationStats = this.results.reduce(
      (acc, result) => {
        const isolation = result.suite.isolation
        if (!acc[isolation]) acc[isolation] = { passed: 0, failed: 0 }
        if (result.success) {
          acc[isolation].passed++
        } else {
          acc[isolation].failed++
        }
        return acc
      },
      {} as Record<string, { passed: number; failed: number }>,
    )

    if (Object.keys(isolationStats).length > 1) {
      console.log('\n🔒 ISOLATION STRATEGY BREAKDOWN:')
      for (const [strategy, stats] of Object.entries(isolationStats)) {
        const total = stats.passed + stats.failed
        const rate = Math.round((stats.passed / total) * 100)
        console.log(`   • ${strategy}: ${stats.passed}/${total} passed (${rate}%)`)
      }
    }

    if (failed.length > 0) {
      console.log('\n🔍 FAILED TESTS:')
      failed.forEach((result) => {
        console.log(`   • ${result.suite.name}`)
        if (result.error) {
          console.log(`     Error: ${result.error.split('\n')[0]}`)
        }
      })
    }

    // Performance insights
    console.log('\n⚡ PERFORMANCE INSIGHTS:')
    const sortedByDuration = [...this.results].sort((a, b) => b.duration - a.duration)
    sortedByDuration.slice(0, 3).forEach((result, i) => {
      const emoji = i === 0 ? '🐌' : i === 1 ? '🚶' : '🏃'
      console.log(`   ${emoji} ${result.suite.name}: ${result.duration}ms`)
    })

    // Category breakdown
    const categories = [...new Set(this.results.map((r) => r.suite.category))]
    if (categories.length > 1) {
      console.log('\n📂 CATEGORY BREAKDOWN:')
      categories.forEach((category) => {
        const categoryResults = this.results.filter((r) => r.suite.category === category)
        const categoryPassed = categoryResults.filter((r) => r.success)
        console.log(`   • ${category}: ${categoryPassed.length}/${categoryResults.length} passed`)
      })
    }

    console.log(`\n${'═'.repeat(80)}`)

    if (failed.length === 0) {
      console.log('🎉 All tests passed! Template indexing functionality is working correctly.')
    } else {
      console.log(`⚠️  ${failed.length} test(s) failed. Please review the errors above.`)
      process.exit(1)
    }
  }

  async runWithWatchMode(): Promise<void> {
    console.log('👀 Watch mode not yet implemented')
    console.log('   Run with --watch flag when available')
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const runner = new TestRunner()

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📚 Enhanced Test Runner with Isolation Support

Usage:
  bun run test:runner [category] [options]

Categories:
  unit              🚀 Fast unit tests with in-memory databases
  integration       🔗 Integration tests with isolated GraphQL servers
  e2e               🌐 End-to-end tests with full isolation
  template-indexing 📋 Legacy template indexing tests

Isolation Strategies:
  none              No isolation (legacy tests)
  database          Isolated SQLite database
  server            Isolated database + GraphQL server
  full              Complete E2E isolation with mocks

Options:
  --help, -h        Show this help message
  --parallel, -p    Run tests in parallel (when supported)
  --watch, -w       Run in watch mode (coming soon)
  --cleanup         Force cleanup all test environments

Performance Targets:
  📊 Unit Tests:        < 100ms per test, < 5s per suite
  🔗 Integration Tests: < 1s per test, < 30s per suite
  🌐 E2E Tests:         < 5s per test, < 2min per suite

Examples:
  bun run test:runner unit --parallel          # Fast parallel unit tests
  bun run test:runner integration              # Isolated integration tests
  bun run test:runner --cleanup                # Clean up test environments

Current Test Suites:
  ✅ GraphQL Parsing (Unit, no isolation)
  ✅ Template Creation (Unit, database isolation) - migrated to file-based
  ✅ System Queries Isolated (Unit, database isolation)
  ✅ Doc System Isolated (Integration, server isolation)
  ✅ Query Name Indexing (Integration, database isolation) - migrated to file-based
  ✅ Performance Tracking (Integration, database isolation) - migrated to file-based
  ⚠️  Doc System Comprehensive (Legacy, requires server)
`)
    return
  }

  if (args.includes('--cleanup')) {
    console.log('🧹 Cleaning up all test environments...')
    await cleanupAll()
    console.log('✅ Cleanup completed')
    return
  }

  if (args.includes('--watch') || args.includes('-w')) {
    await runner.runWithWatchMode()
    return
  }

  const parallel = args.includes('--parallel') || args.includes('-p')
  const category = args.find((arg) => !arg.startsWith('--')) as TestSuite['category'] | undefined

  if (category && !['unit', 'integration', 'e2e', 'template-indexing'].includes(category)) {
    console.error(`❌ Invalid category: ${category}`)
    console.error('Valid categories: unit, integration, e2e, template-indexing')
    process.exit(1)
  }

  await runner.runAll(category, parallel)
}

// Execute if run directly
if (import.meta.main) {
  main().catch(console.error)
}

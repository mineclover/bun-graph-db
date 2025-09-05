#!/usr/bin/env bun

/**
 * API Test Runner
 * 
 * Unified runner for direct API testing with environment management
 */

import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { getCurrentEnvironment, getEnvironment, createTestConfig } from './config/environments.js'

interface TestRunOptions {
  environment?: string
  pattern?: string
  category?: string
  parallel?: boolean
  verbose?: boolean
  timeout?: number
  retries?: number
  reporter?: 'console' | 'json' | 'html'
  outputFile?: string
}

interface TestResult {
  suite: string
  test: string
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  error?: string
  performance?: {
    responseTime: number
    memoryUsage: number
  }
}

interface TestSummary {
  total: number
  passed: number
  failed: number
  skipped: number
  duration: number
  environment: string
  results: TestResult[]
}

class APITestRunner {
  private testDir: string
  private options: TestRunOptions

  constructor(options: TestRunOptions = {}) {
    this.testDir = join(import.meta.dir)
    this.options = {
      environment: 'development',
      pattern: '**/*.api.ts',
      parallel: true,
      verbose: false,
      timeout: 30000,
      retries: 1,
      reporter: 'console',
      ...options,
    }
  }

  async run(): Promise<TestSummary> {
    console.log('🚀 Starting API Test Suite')
    console.log(`Environment: ${this.options.environment}`)
    console.log(`Pattern: ${this.options.pattern}`)
    console.log('─'.repeat(50))

    const startTime = Date.now()
    const testFiles = this.findTestFiles()
    
    if (testFiles.length === 0) {
      console.log('❌ No test files found')
      return this.createEmptySummary()
    }

    console.log(`Found ${testFiles.length} test files`)
    
    const results: TestResult[] = []
    
    if (this.options.parallel) {
      console.log('🔄 Running tests in parallel...')
      results.push(...await this.runParallel(testFiles))
    } else {
      console.log('🔄 Running tests sequentially...')
      results.push(...await this.runSequential(testFiles))
    }

    const duration = Date.now() - startTime
    const summary = this.createSummary(results, duration)
    
    await this.generateReport(summary)
    this.printSummary(summary)

    return summary
  }

  private findTestFiles(): string[] {
    const files: string[] = []
    
    const searchDir = (dir: string) => {
      const entries = readdirSync(dir)
      
      for (const entry of entries) {
        const fullPath = join(dir, entry)
        const stat = statSync(fullPath)
        
        if (stat.isDirectory()) {
          // Skip node_modules and similar
          if (!entry.startsWith('.') && entry !== 'node_modules') {
            searchDir(fullPath)
          }
        } else if (entry.endsWith('.api.ts')) {
          // Apply category filter if specified
          if (this.options.category) {
            const relativePath = fullPath.replace(this.testDir, '')
            if (!relativePath.includes(this.options.category)) {
              continue
            }
          }
          
          files.push(fullPath)
        }
      }
    }

    searchDir(this.testDir)
    return files
  }

  private async runParallel(testFiles: string[]): Promise<TestResult[]> {
    const workers = testFiles.map(file => this.runTestFile(file))
    const results = await Promise.allSettled(workers)
    
    return results.flatMap(result => 
      result.status === 'fulfilled' ? result.value : []
    )
  }

  private async runSequential(testFiles: string[]): Promise<TestResult[]> {
    const results: TestResult[] = []
    
    for (const file of testFiles) {
      try {
        const fileResults = await this.runTestFile(file)
        results.push(...fileResults)
      } catch (error) {
        console.error(`❌ Failed to run ${file}:`, error)
      }
    }
    
    return results
  }

  private async runTestFile(filePath: string): Promise<TestResult[]> {
    const relativePath = filePath.replace(this.testDir, '').replace(/^\//, '')
    
    if (this.options.verbose) {
      console.log(`📝 Running ${relativePath}`)
    }

    const startTime = Date.now()
    const results: TestResult[] = []

    try {
      // Set environment variables for the test
      const env = this.options.environment ? getEnvironment(this.options.environment) : getCurrentEnvironment()
      const testConfig = createTestConfig(env.name)
      
      // Execute the test file using Bun's test runner
      const proc = Bun.spawn(['bun', 'test', filePath, '--timeout', String(this.options.timeout!)], {
        env: {
          ...process.env,
          TEST_ENV: env.name,
          GRAPHQL_ENDPOINT: testConfig.graphqlClient.endpoint,
          API_TIMEOUT: String(testConfig.graphqlClient.timeout),
        },
        stdout: 'pipe',
        stderr: 'pipe',
      })

      const output = await new Response(proc.stdout).text()
      const errors = await new Response(proc.stderr).text()
      
      await proc.exited

      const duration = Date.now() - startTime
      
      // Parse Bun test output to extract results
      const testResults = this.parseTestOutput(output, relativePath, duration)
      results.push(...testResults)

      if (proc.exitCode !== 0 && errors) {
        results.push({
          suite: relativePath,
          test: 'Test File Execution',
          status: 'failed',
          duration,
          error: errors,
        })
      }

      if (this.options.verbose) {
        console.log(`✅ Completed ${relativePath} in ${duration}ms`)
      }

    } catch (error) {
      const duration = Date.now() - startTime
      results.push({
        suite: relativePath,
        test: 'Test File Execution',
        status: 'failed',
        duration,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    return results
  }

  private parseTestOutput(output: string, suite: string, duration: number): TestResult[] {
    const results: TestResult[] = []
    const lines = output.split('\n')
    
    // Simple parsing - in a real implementation, you'd want more robust parsing
    for (const line of lines) {
      if (line.includes('✓') || line.includes('✗')) {
        const testName = line.replace(/^[^a-zA-Z]*/, '').trim()
        const status = line.includes('✓') ? 'passed' : 'failed'
        
        results.push({
          suite,
          test: testName,
          status,
          duration: 0, // Individual test timing would need more sophisticated parsing
        })
      }
    }

    // If no individual tests parsed, create a summary result
    if (results.length === 0) {
      results.push({
        suite,
        test: 'Test Suite',
        status: output.includes('error') || output.includes('fail') ? 'failed' : 'passed',
        duration,
      })
    }

    return results
  }

  private createSummary(results: TestResult[], duration: number): TestSummary {
    const passed = results.filter(r => r.status === 'passed').length
    const failed = results.filter(r => r.status === 'failed').length
    const skipped = results.filter(r => r.status === 'skipped').length

    return {
      total: results.length,
      passed,
      failed,
      skipped,
      duration,
      environment: this.options.environment || 'development',
      results,
    }
  }

  private createEmptySummary(): TestSummary {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      environment: this.options.environment || 'development',
      results: [],
    }
  }

  private async generateReport(summary: TestSummary): Promise<void> {
    if (!this.options.outputFile) return

    switch (this.options.reporter) {
      case 'json':
        await Bun.write(this.options.outputFile, JSON.stringify(summary, null, 2))
        break
      case 'html':
        const html = this.generateHTMLReport(summary)
        await Bun.write(this.options.outputFile, html)
        break
      default:
        // Console output handled in printSummary
        break
    }
  }

  private generateHTMLReport(summary: TestSummary): string {
    const successRate = summary.total > 0 ? (summary.passed / summary.total * 100).toFixed(1) : '0'
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>API Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .skipped { color: #ffc107; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
    </style>
</head>
<body>
    <h1>API Test Results</h1>
    
    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Environment:</strong> ${summary.environment}</p>
        <p><strong>Duration:</strong> ${summary.duration}ms</p>
        <p><strong>Success Rate:</strong> ${successRate}%</p>
        <p><strong>Total:</strong> ${summary.total}</p>
        <p class="passed"><strong>Passed:</strong> ${summary.passed}</p>
        <p class="failed"><strong>Failed:</strong> ${summary.failed}</p>
        <p class="skipped"><strong>Skipped:</strong> ${summary.skipped}</p>
    </div>

    <h2>Test Results</h2>
    <table>
        <thead>
            <tr>
                <th>Suite</th>
                <th>Test</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Error</th>
            </tr>
        </thead>
        <tbody>
            ${summary.results.map(result => `
                <tr class="${result.status}">
                    <td>${result.suite}</td>
                    <td>${result.test}</td>
                    <td>${result.status}</td>
                    <td>${result.duration}ms</td>
                    <td>${result.error || ''}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>
    `.trim()
  }

  private printSummary(summary: TestSummary): void {
    console.log('\n' + '═'.repeat(50))
    console.log('📊 TEST SUMMARY')
    console.log('═'.repeat(50))
    console.log(`Environment: ${summary.environment}`)
    console.log(`Duration: ${(summary.duration / 1000).toFixed(2)}s`)
    console.log(`Total Tests: ${summary.total}`)
    console.log(`✅ Passed: ${summary.passed}`)
    console.log(`❌ Failed: ${summary.failed}`)
    console.log(`⏭️ Skipped: ${summary.skipped}`)
    
    if (summary.total > 0) {
      const successRate = (summary.passed / summary.total * 100).toFixed(1)
      console.log(`📈 Success Rate: ${successRate}%`)
    }

    if (summary.failed > 0) {
      console.log('\n❌ FAILED TESTS:')
      summary.results
        .filter(r => r.status === 'failed')
        .forEach(result => {
          console.log(`  • ${result.suite} > ${result.test}`)
          if (result.error) {
            console.log(`    Error: ${result.error}`)
          }
        })
    }

    console.log('═'.repeat(50))
    
    // Exit with error code if tests failed
    if (summary.failed > 0) {
      process.exit(1)
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2)
  const options: TestRunOptions = {}

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    switch (arg) {
      case '--env':
      case '--environment':
        options.environment = args[++i]
        break
      case '--pattern':
        options.pattern = args[++i]
        break
      case '--category':
        options.category = args[++i]
        break
      case '--sequential':
        options.parallel = false
        break
      case '--verbose':
      case '-v':
        options.verbose = true
        break
      case '--timeout':
        options.timeout = parseInt(args[++i] || '30000', 10)
        break
      case '--retries':
        options.retries = parseInt(args[++i] || '1', 10)
        break
      case '--reporter':
        options.reporter = args[++i] as any
        break
      case '--output':
        options.outputFile = args[++i]
        break
      case '--help':
      case '-h':
        printHelp()
        process.exit(0)
        break
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`)
          process.exit(1)
        }
        break
    }
  }

  const runner = new APITestRunner(options)
  
  try {
    await runner.run()
  } catch (error) {
    console.error('❌ Test runner failed:', error)
    process.exit(1)
  }
}

function printHelp() {
  console.log(`
🧪 API Test Runner

Usage: bun test/api/api-test-runner.ts [options]

Options:
  --env, --environment <name>    Test environment (development, testing, staging, production)
  --pattern <pattern>            File pattern to match (default: **/*.api.ts)
  --category <category>          Test category to run (queries, mutations, scenarios, etc.)
  --sequential                   Run tests sequentially instead of parallel
  --verbose, -v                  Enable verbose output
  --timeout <ms>                 Test timeout in milliseconds (default: 30000)
  --retries <count>              Number of retries for failed tests (default: 1)
  --reporter <type>              Reporter type (console, json, html)
  --output <file>                Output file for reports
  --help, -h                     Show this help message

Examples:
  bun test/api/api-test-runner.ts
  bun test/api/api-test-runner.ts --env staging --category queries
  bun test/api/api-test-runner.ts --verbose --reporter html --output results.html
  bun test/api/api-test-runner.ts --sequential --timeout 60000
`)
}

// Run if called directly
if (import.meta.main) {
  main()
}
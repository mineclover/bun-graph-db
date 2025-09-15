#!/usr/bin/env bun

/**
 * Demo Runner Utility
 *
 * 데모 실행을 위한 공통 유틸리티
 */

import { GraphQLClient } from './graphql-client.js'

export interface DemoResult {
  name: string
  success: boolean
  duration: number
  output: string
  error?: string
  metrics?: Record<string, any>
}

export interface DemoOptions {
  serverUrl: string
  verbose?: boolean
  dryRun?: boolean
  timeout?: number
}

export class DemoRunner {
  private client: GraphQLClient
  private results: DemoResult[] = []

  constructor(private options: DemoOptions) {
    this.client = new GraphQLClient(options.serverUrl)
  }

  get config() {
    return this.options
  }

  async runDemo(
    name: string,
    demoFn: (client: GraphQLClient) => Promise<any>
  ): Promise<DemoResult> {
    console.log(`\n🚀 Running: ${name}`)
    console.log(`   Server: ${this.options.serverUrl}`)
    console.log('─'.repeat(80))

    const startTime = Date.now()
    let result: DemoResult

    try {
      if (this.options.dryRun) {
        console.log('   🔍 DRY RUN - Skipping actual execution')
        result = {
          name,
          success: true,
          duration: 0,
          output: 'Dry run completed',
        }
      } else {
        const output = await demoFn(this.client)
        const duration = Date.now() - startTime

        result = {
          name,
          success: true,
          duration,
          output: typeof output === 'string' ? output : JSON.stringify(output, null, 2),
        }

        console.log(`   ✅ SUCCESS (${duration}ms)`)
        if (this.options.verbose) {
          console.log('   📄 Output:')
          console.log('   ', result.output.split('\n').join('\n   '))
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime
      result = {
        name,
        success: false,
        duration,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      }

      console.log(`   ❌ FAILED (${duration}ms)`)
      console.log(`   🔍 Error: ${result.error}`)
    }

    this.results.push(result)
    return result
  }

  async testConnection(): Promise<boolean> {
    console.log(`\n🔗 Testing connection to ${this.options.serverUrl}`)

    try {
      const isConnected = await this.client.testConnection()
      if (isConnected) {
        console.log('   ✅ Connection successful')
        return true
      } else {
        console.log('   ❌ Connection failed')
        return false
      }
    } catch (error) {
      console.log(`   ❌ Connection error: ${error}`)
      return false
    }
  }

  printSummary(): void {
    const passed = this.results.filter((r) => r.success)
    const failed = this.results.filter((r) => !r.success)
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0)

    console.log(`\n${'═'.repeat(80)}`)
    console.log('📊 DEMO SUMMARY')
    console.log('═'.repeat(80))

    console.log(`⏱️  Total Duration: ${totalDuration}ms`)
    console.log(`✅ Passed: ${passed.length}`)
    console.log(`❌ Failed: ${failed.length}`)
    console.log(`📈 Success Rate: ${Math.round((passed.length / this.results.length) * 100)}%`)

    if (failed.length > 0) {
      console.log('\n🔍 FAILED DEMOS:')
      failed.forEach((result) => {
        console.log(`   • ${result.name}`)
        if (result.error) {
          console.log(`     Error: ${result.error}`)
        }
      })
    }

    // Performance insights
    console.log('\n⚡ PERFORMANCE INSIGHTS:')
    const sortedByDuration = [...this.results].sort((a, b) => b.duration - a.duration)
    sortedByDuration.slice(0, 3).forEach((result, i) => {
      const emoji = i === 0 ? '🐌' : i === 1 ? '🚶' : '🏃'
      console.log(`   ${emoji} ${result.name}: ${result.duration}ms`)
    })

    console.log(`\n${'═'.repeat(80)}`)

    if (failed.length === 0) {
      console.log('🎉 All demos completed successfully!')
    } else {
      console.log(`⚠️  ${failed.length} demo(s) failed. Check the errors above.`)
      process.exit(1)
    }
  }

  // 서버 헬스체크
  async checkServerHealth(): Promise<{ status: string; version?: string }> {
    try {
      const health = await this.client.healthCheck()
      console.log(`   📡 Server Status: ${health.status}`)
      console.log(`   🕐 Server Time: ${health.timestamp}`)
      return { status: health.status }
    } catch (error) {
      console.log(`   ❌ Health check failed: ${error}`)
      return { status: 'unhealthy' }
    }
  }

  // 메트릭 수집
  collectMetrics(): Record<string, any> {
    return {
      totalDemos: this.results.length,
      successCount: this.results.filter((r) => r.success).length,
      failureCount: this.results.filter((r) => !r.success).length,
      totalDuration: this.results.reduce((sum, r) => sum + r.duration, 0),
      averageDuration:
        this.results.length > 0
          ? Math.round(this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length)
          : 0,
      serverUrl: this.options.serverUrl,
      timestamp: new Date().toISOString(),
    }
  }
}

// CLI 파라미터 파싱
export function parseCliArgs(): DemoOptions {
  const args = process.argv.slice(2)
  const options: DemoOptions = {
    serverUrl: process.env.GRAPHQL_SERVER || 'http://localhost:4000/graphql',
    verbose: false,
    dryRun: false,
    timeout: 30000, // 30초
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case '--server':
      case '-s':
        options.serverUrl = args[++i]
        break
      case '--verbose':
      case '-v':
        options.verbose = true
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--timeout':
        options.timeout = parseInt(args[++i], 10)
        break
      case '--help':
      case '-h':
        console.log(`
📚 Demo Runner

Usage:
  bun run demo [options]

Options:
  --server, -s <url>    GraphQL server URL (default: http://localhost:4000/graphql)
  --verbose, -v         Verbose output
  --dry-run            Run without actual execution
  --timeout <ms>       Request timeout in milliseconds (default: 30000)
  --help, -h           Show this help message

Environment Variables:
  GRAPHQL_SERVER       Default server URL

Examples:
  bun run demo
  bun run demo --server http://localhost:3000/graphql
  bun run demo --verbose --dry-run
        `)
        process.exit(0)
        break
    }
  }

  return options
}

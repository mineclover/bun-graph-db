#!/usr/bin/env bun

/**
 * Integrated Demo Runner
 *
 * 모든 데모를 통합 실행하는 메인 스크립트
 */

import { runBasicDemo } from './template-queries/basic-demo.js'
import { DemoRunner, parseCliArgs } from './utils/demo-runner.js'

async function main() {
  console.log('🎯 BunGraphDB Template Query Demo Suite')
  console.log('═'.repeat(80))

  const options = parseCliArgs()
  const runner = new DemoRunner(options)

  // 연결 테스트
  console.log(`📡 Connecting to: ${options.serverUrl}`)
  const isConnected = await runner.testConnection()

  if (!isConnected) {
    console.error('\n❌ Cannot connect to GraphQL server!')
    console.error('   Please ensure:')
    console.error('   1. Server is running')
    console.error('   2. Server URL is correct')
    console.error('   3. GraphQL endpoint is accessible')
    console.error(`\n   Current server URL: ${options.serverUrl}`)
    console.error('   Use --server <url> to specify a different URL')
    process.exit(1)
  }

  // 서버 헬스체크
  await runner.checkServerHealth()

  if (options.dryRun) {
    console.log('\n🔍 DRY RUN MODE - No actual operations will be performed')
  }

  // 데모 실행
  console.log('\n🚀 Starting Demo Suite...')

  // 1. Basic Demo
  await runner.runDemo('Basic Template Operations', runBasicDemo)

  // 2. Advanced Demo (placeholder)
  await runner.runDemo('Advanced Template Features', async (_client) => {
    return (
      'Advanced demo not yet implemented - placeholder for future features:\n' +
      '- Complex template searches\n' +
      '- Variable schema validation\n' +
      '- Template versioning\n' +
      '- Performance optimization'
    )
  })

  // 3. Performance Demo (placeholder)
  await runner.runDemo('Performance Testing', async (_client) => {
    return (
      'Performance demo not yet implemented - placeholder for:\n' +
      '- Large dataset handling\n' +
      '- Concurrent query execution\n' +
      '- Performance metrics collection\n' +
      '- Query optimization analysis'
    )
  })

  // 결과 출력
  runner.printSummary()

  // 메트릭 수집 및 출력
  const metrics = runner.collectMetrics()
  console.log('\n📈 DEMO METRICS:')
  console.log(`   Server: ${metrics.serverUrl}`)
  console.log(`   Total Duration: ${metrics.totalDuration}ms`)
  console.log(`   Average Duration: ${metrics.averageDuration}ms`)
  console.log(`   Timestamp: ${metrics.timestamp}`)
}

// 에러 핸들링
process.on('uncaughtException', (error) => {
  console.error('\n💥 Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n💥 Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// 실행
if (import.meta.main) {
  main().catch(console.error)
}

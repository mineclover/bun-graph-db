#!/usr/bin/env bun

/**
 * Test Log Viewer CLI
 * 
 * 사용법:
 * bun run test/utils/view-logs.ts [command] [options]
 * 
 * 명령어:
 * - stats: 테스트 통계 보기
 * - failed: 실패한 테스트들 보기
 * - success: 성공한 테스트들 보기
 * - details <testName>: 특정 테스트 상세 정보 보기
 * - errors <pattern>: 특정 에러 패턴이 포함된 테스트들 보기
 * - report: 전체 리포트 생성
 * - clear: 로그 파일들 정리
 */

import { LogViewer, viewLogs, viewFailedTests, viewTestDetails } from './LogViewer.js'

const args = process.argv.slice(2)
const command = args[0]
const options = args[1]

const viewer = new LogViewer()

switch (command) {
  case 'stats':
    const stats = viewer.generateStats()
    console.log('\n📊 Test Statistics:')
    console.log('='.repeat(40))
    console.log(`Total Tests: ${stats.total}`)
    console.log(`Successful: ${stats.successful} (${stats.successRate.toFixed(1)}%)`)
    console.log(`Failed: ${stats.failed}`)
    console.log(`Average Execution Time: ${stats.averageExecutionTime.toFixed(2)}ms`)
    
    if (Object.keys(stats.errorTypes).length > 0) {
      console.log('\n🚨 Error Types:')
      for (const [errorType, count] of Object.entries(stats.errorTypes)) {
        console.log(`  ${errorType}: ${count}`)
      }
    }
    break

  case 'failed':
    viewFailedTests()
    break

  case 'success':
    const successTests = viewer.getSuccessfulTests()
    console.log(`\n✅ Successful Tests (${successTests.length}):`)
    console.log('='.repeat(50))
    
    for (const test of successTests) {
      console.log(`\n${test.testName}`)
      console.log(`  Execution Time: ${test.executionTime}ms`)
      console.log(`  File: ${test.fileName}`)
    }
    break

  case 'details':
    if (!options) {
      console.log('Usage: bun run view-logs.ts details <testName>')
      process.exit(1)
    }
    viewTestDetails(options)
    break

  case 'errors':
    if (!options) {
      console.log('Usage: bun run view-logs.ts errors <errorPattern>')
      process.exit(1)
    }
    const errorTests = viewer.getTestsByError(options)
    console.log(`\n🔍 Tests with error pattern "${options}" (${errorTests.length}):`)
    console.log('='.repeat(60))
    
    for (const test of errorTests) {
      console.log(`\n${test.testName}`)
      console.log(`  Error: ${test.error}`)
      console.log(`  File: ${test.fileName}`)
    }
    break

  case 'report':
    console.log(viewer.generateReport())
    break

  case 'clear':
    viewer.clearLogs()
    break

  case 'list':
    const files = viewer.listLogFiles()
    console.log(`\n📄 Log Files (${files.length}):`)
    console.log('='.repeat(40))
    
    for (const file of files) {
      console.log(`  ${file}`)
    }
    break

  default:
    console.log(`
📋 Test Log Viewer

사용법: bun run test/utils/view-logs.ts [command] [options]

명령어:
  stats                    - 테스트 통계 보기
  failed                   - 실패한 테스트들 보기
  success                  - 성공한 테스트들 보기
  details <testName>       - 특정 테스트 상세 정보 보기
  errors <pattern>         - 특정 에러 패턴이 포함된 테스트들 보기
  report                   - 전체 리포트 생성
  list                     - 로그 파일 목록 보기
  clear                    - 로그 파일들 정리

예시:
  bun run test/utils/view-logs.ts stats
  bun run test/utils/view-logs.ts failed
  bun run test/utils/view-logs.ts details "System Health Check"
  bun run test/utils/view-logs.ts errors "UNIQUE constraint"
  bun run test/utils/view-logs.ts report
`)
    break
}

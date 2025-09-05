import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

export interface LogViewerOptions {
  logDir?: string
  individualLogsDir?: string
  showSuccess?: boolean
  showFailed?: boolean
  filterByTestName?: string
  filterByError?: string
}

export class LogViewer {
  private logDir: string
  private individualLogsDir: string

  constructor(options: LogViewerOptions = {}) {
    this.logDir = options.logDir || 'test/logs'
    this.individualLogsDir = options.individualLogsDir || join(this.logDir, 'individual')
  }

  /**
   * 모든 로그 파일 목록 조회
   */
  listLogFiles(): string[] {
    if (!existsSync(this.individualLogsDir)) {
      return []
    }
    return readdirSync(this.individualLogsDir).filter(file => file.endsWith('.json'))
  }

  /**
   * 특정 테스트의 로그 파일들 조회
   */
  getTestLogs(testName: string): any[] {
    const files = this.listLogFiles()
    const testLogs: any[] = []

    for (const file of files) {
      if (file.includes(testName.replace(/[^a-zA-Z0-9-_]/g, '_'))) {
        try {
          const content = readFileSync(join(this.individualLogsDir, file), 'utf8')
          const log = JSON.parse(content)
          testLogs.push({ fileName: file, ...log })
        } catch (error) {
          console.warn(`Failed to read log file ${file}:`, error)
        }
      }
    }

    return testLogs
  }

  /**
   * 실패한 테스트들만 조회
   */
  getFailedTests(): any[] {
    const files = this.listLogFiles()
    const failedLogs: any[] = []

    for (const file of files) {
      try {
        const content = readFileSync(join(this.individualLogsDir, file), 'utf8')
        const log = JSON.parse(content)
        if (!log.success) {
          failedLogs.push({ fileName: file, ...log })
        }
      } catch (error) {
        console.warn(`Failed to read log file ${file}:`, error)
      }
    }

    return failedLogs
  }

  /**
   * 성공한 테스트들만 조회
   */
  getSuccessfulTests(): any[] {
    const files = this.listLogFiles()
    const successLogs: any[] = []

    for (const file of files) {
      try {
        const content = readFileSync(join(this.individualLogsDir, file), 'utf8')
        const log = JSON.parse(content)
        if (log.success) {
          successLogs.push({ fileName: file, ...log })
        }
      } catch (error) {
        console.warn(`Failed to read log file ${file}:`, error)
      }
    }

    return successLogs
  }

  /**
   * 특정 에러가 포함된 테스트들 조회
   */
  getTestsByError(errorPattern: string): any[] {
    const files = this.listLogFiles()
    const errorLogs: any[] = []

    for (const file of files) {
      try {
        const content = readFileSync(join(this.individualLogsDir, file), 'utf8')
        const log = JSON.parse(content)
        if (log.error && log.error.includes(errorPattern)) {
          errorLogs.push({ fileName: file, ...log })
        }
      } catch (error) {
        console.warn(`Failed to read log file ${file}:`, error)
      }
    }

    return errorLogs
  }

  /**
   * 테스트 통계 생성
   */
  generateStats(): {
    total: number
    successful: number
    failed: number
    successRate: number
    averageExecutionTime: number
    errorTypes: Record<string, number>
  } {
    const files = this.listLogFiles()
    let total = 0
    let successful = 0
    let failed = 0
    let totalExecutionTime = 0
    const errorTypes: Record<string, number> = {}

    for (const file of files) {
      try {
        const content = readFileSync(join(this.individualLogsDir, file), 'utf8')
        const log = JSON.parse(content)
        total++
        
        if (log.success) {
          successful++
        } else {
          failed++
          if (log.error) {
            const errorType = log.error.split(':')[0] || 'Unknown'
            errorTypes[errorType] = (errorTypes[errorType] || 0) + 1
          }
        }
        
        if (log.executionTime) {
          totalExecutionTime += log.executionTime
        }
      } catch (error) {
        console.warn(`Failed to read log file ${file}:`, error)
      }
    }

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      averageExecutionTime: total > 0 ? totalExecutionTime / total : 0,
      errorTypes
    }
  }

  /**
   * 상세한 테스트 리포트 생성
   */
  generateReport(): string {
    const stats = this.generateStats()
    const failedTests = this.getFailedTests()
    
    let report = '\n' + '='.repeat(80) + '\n'
    report += '📊 DETAILED TEST REPORT\n'
    report += '='.repeat(80) + '\n\n'
    
    // 통계 정보
    report += '📈 STATISTICS:\n'
    report += `   Total Tests: ${stats.total}\n`
    report += `   Successful: ${stats.successful} (${stats.successRate.toFixed(1)}%)\n`
    report += `   Failed: ${stats.failed}\n`
    report += `   Average Execution Time: ${stats.averageExecutionTime.toFixed(2)}ms\n\n`
    
    // 에러 타입별 통계
    if (Object.keys(stats.errorTypes).length > 0) {
      report += '🚨 ERROR TYPES:\n'
      for (const [errorType, count] of Object.entries(stats.errorTypes)) {
        report += `   ${errorType}: ${count} occurrences\n`
      }
      report += '\n'
    }
    
    // 실패한 테스트 상세 정보
    if (failedTests.length > 0) {
      report += '❌ FAILED TESTS:\n'
      for (const test of failedTests) {
        report += `\n   Test: ${test.testName}\n`
        report += `   File: ${test.fileName}\n`
        report += `   Error: ${test.error}\n`
        report += `   Execution Time: ${test.executionTime}ms\n`
        if (test.debugInfo?.graphqlRequest) {
          report += `   GraphQL Query: ${test.debugInfo.graphqlRequest.query.substring(0, 100)}...\n`
        }
        report += '   ' + '-'.repeat(60) + '\n'
      }
    }
    
    report += '\n' + '='.repeat(80) + '\n'
    
    return report
  }

  /**
   * 특정 테스트의 상세 정보 출력
   */
  showTestDetails(testName: string): void {
    const logs = this.getTestLogs(testName)
    
    if (logs.length === 0) {
      console.log(`No logs found for test: ${testName}`)
      return
    }
    
    console.log(`\n📋 Test Details for: ${testName}`)
    console.log('='.repeat(60))
    
    for (const log of logs) {
      console.log(`\nFile: ${log.fileName}`)
      console.log(`Success: ${log.success ? '✅' : '❌'}`)
      console.log(`Execution Time: ${log.executionTime}ms`)
      
      if (log.error) {
        console.log(`Error: ${log.error}`)
      }
      
      if (log.debugInfo?.graphqlRequest) {
        console.log(`\nGraphQL Request:`)
        console.log(JSON.stringify(log.debugInfo.graphqlRequest, null, 2))
      }
      
      if (log.debugInfo?.graphqlResponse) {
        console.log(`\nGraphQL Response:`)
        console.log(JSON.stringify(log.debugInfo.graphqlResponse, null, 2))
      }
      
      if (log.debugInfo?.errorStack) {
        console.log(`\nError Stack:`)
        console.log(log.debugInfo.errorStack)
      }
      
      console.log('\n' + '-'.repeat(60))
    }
  }

  /**
   * 로그 파일 정리
   */
  clearLogs(): void {
    if (existsSync(this.individualLogsDir)) {
      const fs = require('fs')
      const files = fs.readdirSync(this.individualLogsDir)
      files.forEach((file: string) => {
        fs.unlinkSync(join(this.individualLogsDir, file))
      })
    }
    console.log('🧹 Individual test logs cleared')
  }
}

// CLI 사용을 위한 헬퍼 함수들
export function viewLogs(options: LogViewerOptions = {}): void {
  const viewer = new LogViewer(options)
  console.log(viewer.generateReport())
}

export function viewFailedTests(): void {
  const viewer = new LogViewer()
  const failedTests = viewer.getFailedTests()
  
  console.log(`\n❌ Failed Tests (${failedTests.length}):`)
  console.log('='.repeat(50))
  
  for (const test of failedTests) {
    console.log(`\n${test.testName}`)
    console.log(`  Error: ${test.error}`)
    console.log(`  File: ${test.fileName}`)
  }
}

export function viewTestDetails(testName: string): void {
  const viewer = new LogViewer()
  viewer.showTestDetails(testName)
}

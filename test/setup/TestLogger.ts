import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'fs'
import { join } from 'path'

export interface TestLogEntry {
  timestamp: string
  testName: string
  testType: 'template' | 'scenario' | 'suite'
  input?: any
  output?: any
  success: boolean
  error?: string
  executionTime?: number
  metadata?: Record<string, any>
  debugInfo?: {
    graphqlRequest?: any
    graphqlResponse?: any
    variables?: any
    errorStack?: string
    performanceMetrics?: any
    environmentInfo?: any
  }
}

export interface TestSuiteLog {
  suiteName: string
  startTime: string
  endTime?: string
  totalTests: number
  passedTests: number
  failedTests: number
  totalExecutionTime: number
  tests: TestLogEntry[]
}

export class TestLogger {
  private logDir: string
  private currentSuite: TestSuiteLog | null = null

  constructor(logDir: string = 'test/logs') {
    this.logDir = logDir
    this.ensureLogDirectory()
  }

  private ensureLogDirectory(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true })
    }
  }

  /**
   * 테스트 시작 시 로그 초기화
   */
  initializeTestSuite(suiteName: string): void {
    this.currentSuite = {
      suiteName,
      startTime: new Date().toISOString(),
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      totalExecutionTime: 0,
      tests: []
    }
    
    // 기존 로그 파일 삭제
    const logFile = this.getLogFilePath(suiteName)
    if (existsSync(logFile)) {
      writeFileSync(logFile, '')
    }
    
    console.log(`📝 Test logger initialized for suite: ${suiteName}`)
  }

  /**
   * 테스트 로그 추가
   */
  logTest(entry: Omit<TestLogEntry, 'timestamp'>): void {
    if (!this.currentSuite) {
      throw new Error('Test suite not initialized. Call initializeTestSuite() first.')
    }

    const logEntry: TestLogEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    }

    // 에러 정보를 포함한 간소화된 로그
    const simplifiedEntry = {
      timestamp: logEntry.timestamp,
      testName: logEntry.testName,
      testType: logEntry.testType,
      input: logEntry.input,
      output: logEntry.output,
      success: logEntry.success,
      error: logEntry.error,
      executionTime: logEntry.executionTime,
      metadata: logEntry.metadata,
      // 에러가 있는 경우에만 에러 상세 정보 포함
      errorDetails: logEntry.error ? {
        errorType: logEntry.metadata?.errorType || 'UNKNOWN',
        errorMessage: logEntry.error,
        errorStack: logEntry.debugInfo?.errorStack,
        templateConfig: logEntry.metadata?.templateConfig
      } : undefined
    }

    this.currentSuite.tests.push(simplifiedEntry)
    this.currentSuite.totalTests++
    
    if (logEntry.success) {
      this.currentSuite.passedTests++
    } else {
      this.currentSuite.failedTests++
    }

    if (logEntry.executionTime) {
      this.currentSuite.totalExecutionTime += logEntry.executionTime
    }

    // 실시간 로그 출력
    this.printTestResult(logEntry)
    
    // 개별 테스트 로그 파일 생성 제거 (하나의 테스트 실행당 하나의 로그만)
    
    // 파일에 즉시 저장하지 않음 (테스트 스위트 완료 시에만 저장)
  }

  /**
   * 테스트 결과 실시간 출력
   */
  private printTestResult(entry: TestLogEntry): void {
    const status = entry.success ? '✅' : '❌'
    const time = entry.executionTime ? ` (${entry.executionTime}ms)` : ''
    
    console.log(`${status} ${entry.testName}${time}`)
    
    if (!entry.success && entry.error) {
      console.log(`   Error: ${entry.error}`)
    }
    
    if (entry.metadata) {
      console.log(`   Metadata: ${JSON.stringify(entry.metadata, null, 2)}`)
    }
  }

  /**
   * 테스트 스위트 완료
   */
  finalizeTestSuite(): void {
    if (!this.currentSuite) {
      return
    }

    this.currentSuite.endTime = new Date().toISOString()
    
    // 최종 요약 출력
    this.printSuiteSummary()
    
    // 파일에 최종 저장
    this.saveToFile()
    
    // 로그 파일 경로 출력
    const logFile = this.getLogFilePath(this.currentSuite.suiteName)
    console.log(`📄 Detailed test log saved to: ${logFile}`)
  }

  /**
   * 테스트 스위트 요약 출력
   */
  private printSuiteSummary(): void {
    if (!this.currentSuite) return

    const { suiteName, totalTests, passedTests, failedTests, totalExecutionTime } = this.currentSuite
    const successRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0'
    
    console.log('\n' + '='.repeat(60))
    console.log(`📊 Test Suite Summary: ${suiteName}`)
    console.log('='.repeat(60))
    console.log(`Total Tests: ${totalTests}`)
    console.log(`Passed: ${passedTests} (${successRate}%)`)
    console.log(`Failed: ${failedTests}`)
    console.log(`Total Execution Time: ${totalExecutionTime}ms`)
    console.log(`Overall Success: ${failedTests === 0 ? '✅' : '❌'}`)
    console.log('='.repeat(60))
  }

  /**
   * 파일에 로그 저장 (하나의 로그만)
   */
  private saveToFile(): void {
    if (!this.currentSuite) return

    const logFile = this.getLogFilePath(this.currentSuite.suiteName)
    const logContent = JSON.stringify(this.currentSuite, null, 2)
    writeFileSync(logFile, logContent)
  }


  /**
   * 로그 파일 경로 생성
   */
  private getLogFilePath(suiteName: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `${suiteName}-${timestamp}.json`
    return join(this.logDir, fileName)
  }

  /**
   * 실패한 테스트들만 필터링하여 반환
   */
  getFailedTests(): TestLogEntry[] {
    if (!this.currentSuite) return []
    return this.currentSuite.tests.filter(test => !test.success)
  }

  /**
   * 특정 테스트 타입의 결과만 반환
   */
  getTestsByType(type: 'template' | 'scenario' | 'suite'): TestLogEntry[] {
    if (!this.currentSuite) return []
    return this.currentSuite.tests.filter(test => test.testType === type)
  }

  /**
   * 현재 테스트 스위트 정보 반환
   */
  getCurrentSuite(): TestSuiteLog | null {
    return this.currentSuite
  }

  /**
   * 모든 로그 파일 정리
   */
  clearLogs(): void {
    try {
      let deletedCount = 0

      // 메인 로그 디렉토리의 모든 JSON 파일 삭제
      if (existsSync(this.logDir)) {
        const files = readdirSync(this.logDir)
        const jsonFiles = files.filter(file => file.endsWith('.json'))
        
        for (const file of jsonFiles) {
          const filePath = join(this.logDir, file)
          rmSync(filePath)
          console.log(`🗑️  Deleted log file: ${file}`)
          deletedCount++
        }
      }

      console.log(`✅ Cleared ${deletedCount} log files successfully!`)
    } catch (error) {
      console.error('❌ Failed to clear logs:', error)
    }
  }

  /**
   * 오래된 로그 파일 정리 (N일 이전)
   */
  clearOldLogs(daysOld: number = 7): void {
    try {
      const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000)
      let deletedCount = 0

      // 메인 로그 디렉토리 정리
      if (existsSync(this.logDir)) {
        const files = readdirSync(this.logDir)
        const jsonFiles = files.filter(file => file.endsWith('.json'))
        
        for (const file of jsonFiles) {
          const filePath = join(this.logDir, file)
          const stats = require('fs').statSync(filePath)
          
          if (stats.mtime.getTime() < cutoffTime) {
            rmSync(filePath)
            console.log(`🗑️  Deleted old log file: ${file}`)
            deletedCount++
          }
        }
      }

      console.log(`✅ Cleared ${deletedCount} old log files (older than ${daysOld} days)`)
    } catch (error) {
      console.error('❌ Failed to clear old logs:', error)
    }
  }

  /**
   * 로그 디렉토리 상태 확인
   */
  getLogStats(): { totalFiles: number; totalSize: string } {
    let totalFiles = 0
    let totalSize = 0

    try {
      // 메인 로그 디렉토리만 확인
      if (existsSync(this.logDir)) {
        const files = readdirSync(this.logDir)
        const jsonFiles = files.filter(file => file.endsWith('.json'))
        totalFiles = jsonFiles.length
        
        for (const file of jsonFiles) {
          const filePath = join(this.logDir, file)
          const stats = require('fs').statSync(filePath)
          totalSize += stats.size
        }
      }

      const formatSize = (bytes: number): string => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
      }

      return {
        totalFiles,
        totalSize: formatSize(totalSize)
      }
    } catch (error) {
      console.error('❌ Failed to get log stats:', error)
      return { totalFiles: 0, totalSize: '0 B' }
    }
  }
}

// 싱글톤 인스턴스 (하나의 테스트 실행당 하나의 로그만)
export const testLogger = new TestLogger('test/logs')

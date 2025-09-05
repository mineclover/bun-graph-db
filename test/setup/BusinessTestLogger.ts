/**
 * Business Test Logger
 * 
 * 비즈니스 로직 테스트 전용 로거
 * - CRUD 테스트, 통합 테스트, 성능 테스트 등
 * - 상세한 비즈니스 컨텍스트와 검증 결과 기록
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

export interface BusinessTestLogEntry {
  timestamp: string
  testName: string
  businessContext: string
  testType: 'crud' | 'integration' | 'performance' | 'validation'
  input: any
  output: any
  success: boolean
  error?: string
  executionTime: number
  businessMetrics: {
    executionTime: number
    memoryUsage: number
    complexityScore?: number
  }
  validationResults: {
    expectations: Array<{
      path: string
      expected: any
      received: any
      passed: boolean
    }>
    passed: number
    failed: number
  }
  metadata: {
    templateConfig?: string
    errorType?: string
    errorDetails?: string
  }
}

export interface BusinessTestSuiteLog {
  suiteName: string
  startTime: string
  endTime: string
  totalTests: number
  passedTests: number
  failedTests: number
  totalExecutionTime: number
  businessContext: string
  tests: BusinessTestLogEntry[]
}

export class BusinessTestLogger {
  private currentSuite: BusinessTestSuiteLog | null = null
  private logDir: string

  constructor(logDir: string = 'test/logs/business') {
    this.logDir = logDir
    this.ensureLogDirectory()
  }

  private ensureLogDirectory(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true })
    }
  }

  initializeTestSuite(suiteName: string, businessContext: string = 'general'): void {
    this.currentSuite = {
      suiteName,
      startTime: new Date().toISOString(),
      endTime: '',
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      totalExecutionTime: 0,
      businessContext,
      tests: []
    }
  }

  logBusinessTest(entry: Omit<BusinessTestLogEntry, 'timestamp'>): void {
    if (!this.currentSuite) {
      throw new Error('Business test suite not initialized. Call initializeTestSuite() first.')
    }

    const logEntry: BusinessTestLogEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    }

    this.currentSuite.tests.push(logEntry)
    this.currentSuite.totalTests++
    
    if (logEntry.success) {
      this.currentSuite.passedTests++
    } else {
      this.currentSuite.failedTests++
    }

    this.currentSuite.totalExecutionTime += logEntry.executionTime
  }

  finalizeTestSuite(): void {
    if (!this.currentSuite) {
      throw new Error('No active business test suite to finalize.')
    }

    this.currentSuite.endTime = new Date().toISOString()
    this.saveToFile()
    this.printResults()
    this.currentSuite = null
  }

  private saveToFile(): void {
    if (!this.currentSuite) return

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${this.currentSuite.suiteName}-${timestamp}.json`
    const filepath = join(this.logDir, filename)

    writeFileSync(filepath, JSON.stringify(this.currentSuite, null, 2))
    console.log(`📄 Business test log saved to: ${filepath}`)
  }

  private printResults(): void {
    if (!this.currentSuite) return

    console.log('\n' + '='.repeat(60))
    console.log(`📊 Business Test Suite Summary: ${this.currentSuite.suiteName}`)
    console.log('='.repeat(60))
    console.log(`Business Context: ${this.currentSuite.businessContext}`)
    console.log(`Total Tests: ${this.currentSuite.totalTests}`)
    console.log(`Passed: ${this.currentSuite.passedTests} (${((this.currentSuite.passedTests / this.currentSuite.totalTests) * 100).toFixed(1)}%)`)
    console.log(`Failed: ${this.currentSuite.failedTests}`)
    console.log(`Total Execution Time: ${this.currentSuite.totalExecutionTime}ms`)
    console.log(`Overall Success: ${this.currentSuite.failedTests === 0 ? '✅' : '❌'}`)
    console.log('='.repeat(60))
  }

  getCurrentSuite(): BusinessTestSuiteLog | null {
    return this.currentSuite
  }

  getFailedTests(): BusinessTestLogEntry[] {
    return this.currentSuite?.tests.filter(test => !test.success) || []
  }

  clearLogs(): void {
    // 비즈니스 로그만 삭제
    console.log('🧹 Clearing business test logs...')
    // 구현 생략 - 필요시 추가
  }
}

// 싱글톤 인스턴스
export const businessTestLogger = new BusinessTestLogger()

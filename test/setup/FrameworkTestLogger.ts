/**
 * Framework Test Logger
 * 
 * 테스트 프레임워크 전용 로거
 * - 테스트 실행 상태, 스케줄링, 결과 수집
 * - 간소한 실행 상태 중심의 로그
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

export interface FrameworkTestLogEntry {
  timestamp: string
  testSuite: string
  executionStatus: 'started' | 'completed' | 'failed' | 'timeout'
  summary: {
    total: number
    passed: number
    failed: number
    skipped?: number
  }
  duration: number
  frameworkErrors: string[]
  metadata: {
    category?: string
    priority?: string
    timeout?: number
    exitCode?: number
  }
}

export interface FrameworkTestSuiteLog {
  suiteName: string
  startTime: string
  endTime: string
  totalSuites: number
  successfulSuites: number
  failedSuites: number
  totalExecutionTime: number
  frameworkVersion: string
  tests: FrameworkTestLogEntry[]
}

export class FrameworkTestLogger {
  private currentSuite: FrameworkTestSuiteLog | null = null
  private logDir: string

  constructor(logDir: string = 'test/logs/framework') {
    this.logDir = logDir
    this.ensureLogDirectory()
  }

  private ensureLogDirectory(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true })
    }
  }

  initializeTestSuite(suiteName: string): void {
    this.currentSuite = {
      suiteName,
      startTime: new Date().toISOString(),
      endTime: '',
      totalSuites: 0,
      successfulSuites: 0,
      failedSuites: 0,
      totalExecutionTime: 0,
      frameworkVersion: '1.0.0',
      tests: []
    }
  }

  logFrameworkTest(entry: Omit<FrameworkTestLogEntry, 'timestamp'>): void {
    if (!this.currentSuite) {
      throw new Error('Framework test suite not initialized. Call initializeTestSuite() first.')
    }

    const logEntry: FrameworkTestLogEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    }

    this.currentSuite.tests.push(logEntry)
    this.currentSuite.totalSuites++
    
    if (logEntry.executionStatus === 'completed') {
      this.currentSuite.successfulSuites++
    } else {
      this.currentSuite.failedSuites++
    }

    this.currentSuite.totalExecutionTime += logEntry.duration
  }

  finalizeTestSuite(): void {
    if (!this.currentSuite) {
      throw new Error('No active framework test suite to finalize.')
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
    console.log(`📄 Framework test log saved to: ${filepath}`)
  }

  private printResults(): void {
    if (!this.currentSuite) return

    console.log('\n' + '='.repeat(50))
    console.log(`🚀 Framework Test Suite Summary: ${this.currentSuite.suiteName}`)
    console.log('='.repeat(50))
    console.log(`Total Suites: ${this.currentSuite.totalSuites}`)
    console.log(`Successful: ${this.currentSuite.successfulSuites}`)
    console.log(`Failed: ${this.currentSuite.failedSuites}`)
    console.log(`Total Execution Time: ${this.currentSuite.totalExecutionTime}ms`)
    console.log(`Framework Version: ${this.currentSuite.frameworkVersion}`)
    console.log(`Overall Success: ${this.currentSuite.failedSuites === 0 ? '✅' : '❌'}`)
    console.log('='.repeat(50))
  }

  getCurrentSuite(): FrameworkTestSuiteLog | null {
    return this.currentSuite
  }

  getFailedSuites(): FrameworkTestLogEntry[] {
    return this.currentSuite?.tests.filter(test => test.executionStatus !== 'completed') || []
  }

  clearLogs(): void {
    // 프레임워크 로그만 삭제
    console.log('🧹 Clearing framework test logs...')
    // 구현 생략 - 필요시 추가
  }
}

// 싱글톤 인스턴스
export const frameworkTestLogger = new FrameworkTestLogger()

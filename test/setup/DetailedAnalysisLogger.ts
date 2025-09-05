/**
 * Detailed Analysis Logger
 * 
 * 개별 코드의 상세 원인을 분석할 수 있는 로거
 * - 코드 실행 경로 추적
 * - 조건별 실패 원인 분석
 * - 스택 트레이스 및 컨텍스트 정보
 * - 성능 병목 지점 식별
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

export interface CodeExecutionTrace {
  functionName: string
  filePath: string
  lineNumber: number
  timestamp: string
  input: any
  output?: any
  error?: any
  duration: number
  memoryUsage: number
  conditions: Record<string, any>
  stackTrace?: string
}

export interface DetailedAnalysisEntry {
  timestamp: string
  testName: string
  businessContext: string
  testType: 'crud' | 'integration' | 'performance' | 'validation'
  
  // 코드 실행 경로 추적
  executionTrace: CodeExecutionTrace[]
  
  // 상세 원인 분석
  rootCause: {
    primaryError: string
    contributingFactors: string[]
    errorChain: Array<{
      level: number
      error: string
      context: any
      timestamp: string
    }>
  }
  
  // 조건별 분석
  conditionAnalysis: {
    preConditions: Record<string, any>
    postConditions: Record<string, any>
    failedConditions: Array<{
      condition: string
      expected: any
      actual: any
      impact: string
    }>
  }
  
  // 성능 분석
  performanceAnalysis: {
    bottlenecks: Array<{
      function: string
      duration: number
      percentage: number
      memoryImpact: number
    }>
    memoryLeaks: Array<{
      location: string
      size: number
      growth: number
    }>
  }
  
  // 디버깅 정보
  debuggingInfo: {
    environment: Record<string, any>
    configuration: Record<string, any>
    dependencies: Record<string, any>
    state: Record<string, any>
  }
  
  // 해결 방안 제안
  resolutionSuggestions: Array<{
    priority: 'high' | 'medium' | 'low'
    category: 'code' | 'configuration' | 'environment' | 'data'
    suggestion: string
    reasoning: string
  }>
}

export interface DetailedAnalysisSuite {
  suiteName: string
  startTime: string
  endTime: string
  totalTests: number
  passedTests: number
  failedTests: number
  totalExecutionTime: number
  businessContext: string
  
  // 분석 통계
  analysisStats: {
    totalErrors: number
    errorTypes: Record<string, number>
    commonBottlenecks: Array<{
      function: string
      frequency: number
      avgDuration: number
    }>
    resolutionSuccess: Record<string, number>
  }
  
  tests: DetailedAnalysisEntry[]
}

export class DetailedAnalysisLogger {
  private currentSuite: DetailedAnalysisSuite | null = null
  private logDir: string
  private executionTrace: CodeExecutionTrace[] = []

  constructor(logDir: string = 'test/logs/analysis') {
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
      analysisStats: {
        totalErrors: 0,
        errorTypes: {},
        commonBottlenecks: [],
        resolutionSuccess: {}
      },
      tests: []
    }
    this.executionTrace = []
  }

  // 코드 실행 경로 추적 시작
  startTrace(functionName: string, filePath: string, lineNumber: number, input: any): void {
    const trace: CodeExecutionTrace = {
      functionName,
      filePath,
      lineNumber,
      timestamp: new Date().toISOString(),
      input,
      duration: 0,
      memoryUsage: process.memoryUsage().heapUsed,
      conditions: {},
      stackTrace: new Error().stack
    }
    this.executionTrace.push(trace)
  }

  // 코드 실행 경로 추적 완료
  endTrace(functionName: string, output?: any, error?: any): void {
    const trace = this.executionTrace.find(t => t.functionName === functionName && !t.output && !t.error)
    if (trace) {
      trace.output = output
      trace.error = error
      trace.duration = Date.now() - new Date(trace.timestamp).getTime()
      trace.memoryUsage = process.memoryUsage().heapUsed - trace.memoryUsage
    }
  }

  // 조건 추가
  addCondition(condition: string, value: any): void {
    const lastTrace = this.executionTrace[this.executionTrace.length - 1]
    if (lastTrace) {
      lastTrace.conditions[condition] = value
    }
  }

  // 상세 분석 로그 기록
  logDetailedAnalysis(entry: Omit<DetailedAnalysisEntry, 'timestamp' | 'executionTrace'>): void {
    if (!this.currentSuite) {
      throw new Error('Detailed analysis suite not initialized. Call initializeTestSuite() first.')
    }

    const logEntry: DetailedAnalysisEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      executionTrace: [...this.executionTrace]
    }

    this.currentSuite.tests.push(logEntry)
    this.currentSuite.totalTests++
    
    if (logEntry.rootCause.primaryError) {
      this.currentSuite.failedTests++
      this.currentSuite.analysisStats.totalErrors++
      
      // 에러 타입 통계
      const errorType = logEntry.rootCause.primaryError.split(':')[0]
      this.currentSuite.analysisStats.errorTypes[errorType] = 
        (this.currentSuite.analysisStats.errorTypes[errorType] || 0) + 1
    } else {
      this.currentSuite.passedTests++
    }

    this.currentSuite.totalExecutionTime += logEntry.executionTrace.reduce((sum, trace) => sum + trace.duration, 0)
    
    // 실행 경로 초기화
    this.executionTrace = []
  }

  finalizeTestSuite(): void {
    if (!this.currentSuite) {
      throw new Error('No active detailed analysis suite to finalize.')
    }

    this.currentSuite.endTime = new Date().toISOString()
    this.generateAnalysisStats()
    this.saveToFile()
    this.printDetailedResults()
    this.currentSuite = null
  }

  private generateAnalysisStats(): void {
    if (!this.currentSuite) return

    // 공통 병목 지점 분석
    const functionDurations: Record<string, number[]> = {}
    
    this.currentSuite.tests.forEach(test => {
      test.executionTrace.forEach(trace => {
        if (!functionDurations[trace.functionName]) {
          functionDurations[trace.functionName] = []
        }
        functionDurations[trace.functionName].push(trace.duration)
      })
    })

    this.currentSuite.analysisStats.commonBottlenecks = Object.entries(functionDurations)
      .map(([functionName, durations]) => ({
        function: functionName,
        frequency: durations.length,
        avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 5)
  }

  private saveToFile(): void {
    if (!this.currentSuite) return

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${this.currentSuite.suiteName}-detailed-analysis-${timestamp}.json`
    const filepath = join(this.logDir, filename)

    writeFileSync(filepath, JSON.stringify(this.currentSuite, null, 2))
    console.log(`📄 Detailed analysis log saved to: ${filepath}`)
  }

  private printDetailedResults(): void {
    if (!this.currentSuite) return

    console.log('\n' + '='.repeat(80))
    console.log(`🔍 Detailed Analysis Summary: ${this.currentSuite.suiteName}`)
    console.log('='.repeat(80))
    console.log(`Business Context: ${this.currentSuite.businessContext}`)
    console.log(`Total Tests: ${this.currentSuite.totalTests}`)
    console.log(`Passed: ${this.currentSuite.passedTests}`)
    console.log(`Failed: ${this.currentSuite.failedTests}`)
    console.log(`Total Execution Time: ${this.currentSuite.totalExecutionTime}ms`)
    
    console.log('\n📊 Analysis Statistics:')
    console.log(`Total Errors: ${this.currentSuite.analysisStats.totalErrors}`)
    console.log('Error Types:', this.currentSuite.analysisStats.errorTypes)
    
    console.log('\n🐌 Common Bottlenecks:')
    this.currentSuite.analysisStats.commonBottlenecks.forEach((bottleneck, index) => {
      console.log(`${index + 1}. ${bottleneck.function}: ${bottleneck.avgDuration.toFixed(2)}ms (${bottleneck.frequency} calls)`)
    })
    
    console.log('='.repeat(80))
  }

  getCurrentSuite(): DetailedAnalysisSuite | null {
    return this.currentSuite
  }

  getFailedTests(): DetailedAnalysisEntry[] {
    return this.currentSuite?.tests.filter(test => test.rootCause.primaryError) || []
  }

  clearLogs(): void {
    console.log('🧹 Clearing detailed analysis logs...')
    // 구현 생략 - 필요시 추가
  }
}

// 싱글톤 인스턴스
export const detailedAnalysisLogger = new DetailedAnalysisLogger()

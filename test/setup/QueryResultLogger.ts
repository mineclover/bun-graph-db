/**
 * Query Result Logger
 * 
 * 개별 쿼리 결과를 상세하게 기록하고 조회할 수 있는 고도화된 로깅 시스템
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface QueryExecutionResult {
  queryId: string
  queryName: string
  queryType: 'mutation' | 'query' | 'subscription'
  templateId?: string
  stepNumber?: number
  flowId?: string
  
  // 실행 정보
  timestamp: string
  executionTime: number
  success: boolean
  
  // 쿼리 정보
  query: string
  variables: Record<string, any>
  
  // 결과 정보
  result?: any
  error?: string
  errorType?: string
  errorDetails?: any
  
  // 성능 정보
  performance: {
    memoryUsage: number
    cpuUsage?: number
    complexityScore?: number
  }
  
  // 검증 정보
  validation?: {
    expectations: Array<{
      path: string
      expected: any
      actual: any
      passed: boolean
    }>
    overallPassed: boolean
  }
  
  // 메타데이터
  metadata: {
    businessContext?: string
    testType?: string
    environment?: string
    version?: string
  }
}

export interface QuerySummary {
  totalQueries: number
  successfulQueries: number
  failedQueries: number
  averageExecutionTime: number
  totalExecutionTime: number
  successRate: number
  errorTypes: Record<string, number>
  slowestQueries: Array<{
    queryId: string
    queryName: string
    executionTime: number
  }>
  mostCommonErrors: Array<{
    errorType: string
    count: number
    examples: string[]
  }>
}

export class QueryResultLogger {
  private static instance: QueryResultLogger
  private currentSession: string
  private sessionStartTime: string
  private queryResults: QueryExecutionResult[] = []
  private logDirectory: string

  private constructor() {
    this.currentSession = `session-${Date.now()}`
    this.sessionStartTime = new Date().toISOString()
    this.logDirectory = join(process.cwd(), 'test', 'logs', 'queries')
    
    // 로그 디렉토리 생성
    if (!existsSync(this.logDirectory)) {
      mkdirSync(this.logDirectory, { recursive: true })
    }
  }

  static getInstance(): QueryResultLogger {
    if (!QueryResultLogger.instance) {
      QueryResultLogger.instance = new QueryResultLogger()
    }
    return QueryResultLogger.instance
  }

  /**
   * 쿼리 실행 결과 로깅
   */
  logQueryResult(result: Omit<QueryExecutionResult, 'timestamp' | 'performance'>): void {
    const queryResult: QueryExecutionResult = {
      ...result,
      timestamp: new Date().toISOString(),
      performance: {
        memoryUsage: process.memoryUsage().heapUsed,
        cpuUsage: process.cpuUsage?.()?.user,
        complexityScore: this.calculateComplexityScore(result.query)
      }
    }

    this.queryResults.push(queryResult)
    
    // 개별 쿼리 결과 파일 저장
    this.saveIndividualQueryResult(queryResult)
    
    // 실시간 콘솔 출력
    this.logToConsole(queryResult)
  }

  /**
   * 개별 쿼리 결과를 별도 파일로 저장
   */
  private saveIndividualQueryResult(result: QueryExecutionResult): void {
    const fileName = `${result.queryId}-${result.timestamp.replace(/[:.]/g, '-')}.json`
    const filePath = join(this.logDirectory, fileName)
    
    try {
      writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf8')
    } catch (error) {
      console.error('Failed to save individual query result:', error)
    }
  }

  /**
   * 실시간 콘솔 로깅
   */
  private logToConsole(result: QueryExecutionResult): void {
    const status = result.success ? '✅' : '❌'
    const stepInfo = result.stepNumber ? `[Step ${result.stepNumber}] ` : ''
    const flowInfo = result.flowId ? `[Flow: ${result.flowId}] ` : ''
    
    console.log(`${status} ${stepInfo}${flowInfo}${result.queryName}`)
    console.log(`   Execution Time: ${result.executionTime}ms`)
    console.log(`   Memory Usage: ${(result.performance.memoryUsage / 1024 / 1024).toFixed(2)}MB`)
    
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`)
      if (result.errorType) {
        console.log(`   Error Type: ${result.errorType}`)
      }
    }
    
    if (result.validation) {
      const passedCount = result.validation.expectations.filter(e => e.passed).length
      const totalCount = result.validation.expectations.length
      console.log(`   Validation: ${passedCount}/${totalCount} passed`)
    }
    
    console.log('')
  }

  /**
   * 쿼리 복잡도 계산
   */
  private calculateComplexityScore(query: string): number {
    const lines = query.split('\n').length
    const depth = (query.match(/\{/g) || []).length
    const variables = (query.match(/\$\w+/g) || []).length
    
    return lines + depth * 2 + variables
  }

  /**
   * 세션 요약 생성
   */
  generateSessionSummary(): QuerySummary {
    const totalQueries = this.queryResults.length
    const successfulQueries = this.queryResults.filter(r => r.success).length
    const failedQueries = totalQueries - successfulQueries
    const totalExecutionTime = this.queryResults.reduce((sum, r) => sum + r.executionTime, 0)
    const averageExecutionTime = totalQueries > 0 ? totalExecutionTime / totalQueries : 0
    const successRate = totalQueries > 0 ? (successfulQueries / totalQueries) * 100 : 0

    // 에러 타입별 집계
    const errorTypes: Record<string, number> = {}
    const errorExamples: Record<string, string[]> = {}
    
    this.queryResults
      .filter(r => !r.success && r.errorType)
      .forEach(r => {
        errorTypes[r.errorType!] = (errorTypes[r.errorType!] || 0) + 1
        if (!errorExamples[r.errorType!]) {
          errorExamples[r.errorType!] = []
        }
        if (errorExamples[r.errorType!].length < 3 && r.error) {
          errorExamples[r.errorType!].push(r.error)
        }
      })

    // 가장 느린 쿼리들
    const slowestQueries = this.queryResults
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 5)
      .map(r => ({
        queryId: r.queryId,
        queryName: r.queryName,
        executionTime: r.executionTime
      }))

    // 가장 흔한 에러들
    const mostCommonErrors = Object.entries(errorTypes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([errorType, count]) => ({
        errorType,
        count,
        examples: errorExamples[errorType] || []
      }))

    return {
      totalQueries,
      successfulQueries,
      failedQueries,
      averageExecutionTime,
      totalExecutionTime,
      successRate,
      errorTypes,
      slowestQueries,
      mostCommonErrors
    }
  }

  /**
   * 세션 로그 저장
   */
  saveSessionLog(): void {
    const summary = this.generateSessionSummary()
    const sessionData = {
      sessionId: this.currentSession,
      sessionStartTime: this.sessionStartTime,
      sessionEndTime: new Date().toISOString(),
      summary,
      queryResults: this.queryResults
    }

    const fileName = `session-${this.currentSession}.json`
    const filePath = join(this.logDirectory, fileName)
    
    try {
      writeFileSync(filePath, JSON.stringify(sessionData, null, 2), 'utf8')
      console.log(`📄 Session log saved to: ${filePath}`)
    } catch (error) {
      console.error('Failed to save session log:', error)
    }
  }

  /**
   * 특정 쿼리 결과 조회
   */
  getQueryResult(queryId: string): QueryExecutionResult | undefined {
    return this.queryResults.find(r => r.queryId === queryId)
  }

  /**
   * 플로우별 쿼리 결과 조회
   */
  getFlowResults(flowId: string): QueryExecutionResult[] {
    return this.queryResults.filter(r => r.flowId === flowId)
  }

  /**
   * 에러 타입별 쿼리 결과 조회
   */
  getQueriesByErrorType(errorType: string): QueryExecutionResult[] {
    return this.queryResults.filter(r => r.errorType === errorType)
  }

  /**
   * 성능 기준으로 쿼리 결과 조회
   */
  getSlowQueries(threshold: number = 1000): QueryExecutionResult[] {
    return this.queryResults.filter(r => r.executionTime > threshold)
  }

  /**
   * 현재 세션의 모든 쿼리 결과 조회
   */
  getAllQueryResults(): QueryExecutionResult[] {
    return [...this.queryResults]
  }

  /**
   * 세션 초기화
   */
  resetSession(): void {
    this.queryResults = []
    this.currentSession = `session-${Date.now()}`
    this.sessionStartTime = new Date().toISOString()
  }

  /**
   * 로그 디렉토리 정리
   */
  cleanupOldLogs(daysToKeep: number = 7): void {
    // 구현 예정: 오래된 로그 파일들 정리
    console.log(`🧹 Log cleanup not implemented yet. Will keep logs for ${daysToKeep} days.`)
  }
}

// 싱글톤 인스턴스 내보내기
export const queryResultLogger = QueryResultLogger.getInstance()

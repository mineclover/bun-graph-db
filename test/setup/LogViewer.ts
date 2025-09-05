/**
 * Log Viewer
 * 
 * 로그 파일들을 조회하고 분석할 수 있는 도구
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { QueryExecutionResult, QuerySummary } from './QueryResultLogger.js'

export interface LogViewerOptions {
  logDirectory?: string
  maxResults?: number
  sortBy?: 'timestamp' | 'executionTime' | 'success'
  sortOrder?: 'asc' | 'desc'
  filterBy?: {
    success?: boolean
    errorType?: string
    flowId?: string
    queryType?: 'mutation' | 'query' | 'subscription'
    minExecutionTime?: number
    maxExecutionTime?: number
  }
}

export interface LogAnalysisResult {
  totalSessions: number
  totalQueries: number
  overallSuccessRate: number
  averageExecutionTime: number
  errorDistribution: Record<string, number>
  performanceTrends: Array<{
    sessionId: string
    timestamp: string
    successRate: number
    averageExecutionTime: number
  }>
  topErrors: Array<{
    errorType: string
    count: number
    examples: string[]
  }>
  slowestQueries: Array<{
    sessionId: string
    queryId: string
    queryName: string
    executionTime: number
  }>
}

export class LogViewer {
  private logDirectory: string

  constructor(logDirectory?: string) {
    this.logDirectory = logDirectory || join(process.cwd(), 'test', 'logs', 'queries')
  }

  /**
   * 사용 가능한 세션 목록 조회
   */
  getAvailableSessions(): string[] {
    if (!existsSync(this.logDirectory)) {
      return []
    }

    return readdirSync(this.logDirectory)
      .filter(file => file.startsWith('session-') && file.endsWith('.json'))
      .map(file => file.replace('session-', '').replace('.json', ''))
      .sort((a, b) => b.localeCompare(a)) // 최신 세션부터
  }

  /**
   * 특정 세션 로드
   */
  loadSession(sessionId: string): { summary: QuerySummary; queryResults: QueryExecutionResult[] } | null {
    const filePath = join(this.logDirectory, `session-${sessionId}.json`)
    
    if (!existsSync(filePath)) {
      return null
    }

    try {
      const data = JSON.parse(readFileSync(filePath, 'utf8'))
      return {
        summary: data.summary,
        queryResults: data.queryResults
      }
    } catch (error) {
      console.error(`Failed to load session ${sessionId}:`, error)
      return null
    }
  }

  /**
   * 개별 쿼리 결과 로드
   */
  loadQueryResult(queryId: string, timestamp: string): QueryExecutionResult | null {
    const fileName = `${queryId}-${timestamp.replace(/[:.]/g, '-')}.json`
    const filePath = join(this.logDirectory, fileName)
    
    if (!existsSync(filePath)) {
      return null
    }

    try {
      return JSON.parse(readFileSync(filePath, 'utf8'))
    } catch (error) {
      console.error(`Failed to load query result ${queryId}:`, error)
      return null
    }
  }

  /**
   * 쿼리 결과 검색
   */
  searchQueryResults(options: LogViewerOptions = {}): QueryExecutionResult[] {
    const sessions = this.getAvailableSessions()
    let allResults: QueryExecutionResult[] = []

    // 모든 세션에서 쿼리 결과 수집
    for (const sessionId of sessions) {
      const session = this.loadSession(sessionId)
      if (session) {
        allResults = allResults.concat(session.queryResults)
      }
    }

    // 필터링 적용
    if (options.filterBy) {
      allResults = this.applyFilters(allResults, options.filterBy)
    }

    // 정렬 적용
    if (options.sortBy) {
      allResults = this.applySorting(allResults, options.sortBy, options.sortOrder || 'desc')
    }

    // 결과 수 제한
    if (options.maxResults) {
      allResults = allResults.slice(0, options.maxResults)
    }

    return allResults
  }

  /**
   * 필터 적용
   */
  private applyFilters(results: QueryExecutionResult[], filters: NonNullable<LogViewerOptions['filterBy']>): QueryExecutionResult[] {
    return results.filter(result => {
      if (filters.success !== undefined && result.success !== filters.success) {
        return false
      }
      if (filters.errorType && result.errorType !== filters.errorType) {
        return false
      }
      if (filters.flowId && result.flowId !== filters.flowId) {
        return false
      }
      if (filters.queryType && result.queryType !== filters.queryType) {
        return false
      }
      if (filters.minExecutionTime && result.executionTime < filters.minExecutionTime) {
        return false
      }
      if (filters.maxExecutionTime && result.executionTime > filters.maxExecutionTime) {
        return false
      }
      return true
    })
  }

  /**
   * 정렬 적용
   */
  private applySorting(results: QueryExecutionResult[], sortBy: string, sortOrder: 'asc' | 'desc'): QueryExecutionResult[] {
    return results.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy) {
        case 'timestamp':
          aValue = new Date(a.timestamp).getTime()
          bValue = new Date(b.timestamp).getTime()
          break
        case 'executionTime':
          aValue = a.executionTime
          bValue = b.executionTime
          break
        case 'success':
          aValue = a.success ? 1 : 0
          bValue = b.success ? 1 : 0
          break
        default:
          return 0
      }

      if (sortOrder === 'asc') {
        return aValue - bValue
      } else {
        return bValue - aValue
      }
    })
  }

  /**
   * 로그 분석
   */
  analyzeLogs(): LogAnalysisResult {
    const sessions = this.getAvailableSessions()
    let totalQueries = 0
    let successfulQueries = 0
    let totalExecutionTime = 0
    const errorDistribution: Record<string, number> = {}
    const performanceTrends: Array<{
      sessionId: string
      timestamp: string
      successRate: number
      averageExecutionTime: number
    }> = []
    const allSlowQueries: Array<{
      sessionId: string
      queryId: string
      queryName: string
      executionTime: number
    }> = []

    // 각 세션 분석
    for (const sessionId of sessions) {
      const session = this.loadSession(sessionId)
      if (!session) continue

      const { summary, queryResults } = session
      totalQueries += summary.totalQueries
      successfulQueries += summary.successfulQueries
      totalExecutionTime += summary.totalExecutionTime

      // 에러 분포 집계
      Object.entries(summary.errorTypes).forEach(([errorType, count]) => {
        errorDistribution[errorType] = (errorDistribution[errorType] || 0) + count
      })

      // 성능 트렌드 추가
      performanceTrends.push({
        sessionId,
        timestamp: sessionId,
        successRate: summary.successRate,
        averageExecutionTime: summary.averageExecutionTime
      })

      // 느린 쿼리들 추가
      summary.slowestQueries.forEach(query => {
        allSlowQueries.push({
          sessionId,
          queryId: query.queryId,
          queryName: query.queryName,
          executionTime: query.executionTime
        })
      })
    }

    const overallSuccessRate = totalQueries > 0 ? (successfulQueries / totalQueries) * 100 : 0
    const averageExecutionTime = totalQueries > 0 ? totalExecutionTime / totalQueries : 0

    // 상위 에러들
    const topErrors = Object.entries(errorDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([errorType, count]) => ({
        errorType,
        count,
        examples: [] // 실제 예시는 별도로 수집 필요
      }))

    // 가장 느린 쿼리들
    const slowestQueries = allSlowQueries
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10)

    return {
      totalSessions: sessions.length,
      totalQueries,
      overallSuccessRate,
      averageExecutionTime,
      errorDistribution,
      performanceTrends,
      topErrors,
      slowestQueries
    }
  }

  /**
   * 분석 결과를 콘솔에 출력
   */
  printAnalysis(): void {
    const analysis = this.analyzeLogs()
    
    console.log('\n📊 Log Analysis Report')
    console.log('='.repeat(50))
    console.log(`Total Sessions: ${analysis.totalSessions}`)
    console.log(`Total Queries: ${analysis.totalQueries}`)
    console.log(`Overall Success Rate: ${analysis.overallSuccessRate.toFixed(2)}%`)
    console.log(`Average Execution Time: ${analysis.averageExecutionTime.toFixed(2)}ms`)
    
    console.log('\n🔍 Error Distribution:')
    Object.entries(analysis.errorDistribution)
      .sort(([, a], [, b]) => b - a)
      .forEach(([errorType, count]) => {
        console.log(`  ${errorType}: ${count} occurrences`)
      })
    
    console.log('\n🐌 Slowest Queries:')
    analysis.slowestQueries.slice(0, 5).forEach((query, index) => {
      console.log(`  ${index + 1}. ${query.queryName} (${query.executionTime}ms)`)
      console.log(`     Session: ${query.sessionId}`)
    })
    
    console.log('\n📈 Performance Trends:')
    analysis.performanceTrends.slice(0, 5).forEach(trend => {
      console.log(`  Session ${trend.sessionId}: ${trend.successRate.toFixed(1)}% success, ${trend.averageExecutionTime.toFixed(1)}ms avg`)
    })
  }

  /**
   * 특정 에러 타입의 상세 정보 조회
   */
  getErrorDetails(errorType: string, limit: number = 10): QueryExecutionResult[] {
    return this.searchQueryResults({
      filterBy: { errorType },
      maxResults: limit,
      sortBy: 'timestamp',
      sortOrder: 'desc'
    })
  }

  /**
   * 플로우별 성능 분석
   */
  analyzeFlowPerformance(flowId: string): {
    totalSteps: number
    successfulSteps: number
    totalExecutionTime: number
    averageStepTime: number
    stepDetails: Array<{
      stepNumber: number
      queryName: string
      executionTime: number
      success: boolean
      error?: string
    }>
  } {
    const flowResults = this.searchQueryResults({
      filterBy: { flowId },
      sortBy: 'timestamp',
      sortOrder: 'asc'
    })

    const stepDetails = flowResults.map(result => ({
      stepNumber: result.stepNumber || 0,
      queryName: result.queryName,
      executionTime: result.executionTime,
      success: result.success,
      error: result.error
    }))

    const totalSteps = stepDetails.length
    const successfulSteps = stepDetails.filter(s => s.success).length
    const totalExecutionTime = stepDetails.reduce((sum, s) => sum + s.executionTime, 0)
    const averageStepTime = totalSteps > 0 ? totalExecutionTime / totalSteps : 0

    return {
      totalSteps,
      successfulSteps,
      totalExecutionTime,
      averageStepTime,
      stepDetails
    }
  }
}

// 기본 인스턴스 내보내기
export const logViewer = new LogViewer()
# 고도화된 로깅 시스템 가이드

## 📋 **개요**

템플릿 플로우 테스트의 개별 쿼리 결과를 상세하게 기록하고 조회할 수 있는 고도화된 로깅 시스템입니다. 각 쿼리 실행의 성공/실패, 성능, 에러 정보를 실시간으로 추적하고 분석할 수 있습니다.

## 🏗️ **시스템 구조**

### **핵심 컴포넌트**

1. **QueryResultLogger** - 개별 쿼리 결과 로깅
2. **LogViewer** - 로그 조회 및 분석
3. **BusinessTestLogger** - 비즈니스 로직 테스트 로깅
4. **DetailedAnalysisLogger** - 상세 분석 로깅

### **로그 저장 구조**

```
test/logs/
├── queries/                    # 개별 쿼리 결과
│   ├── session-{timestamp}.json    # 세션별 통합 로그
│   ├── {queryId}-{timestamp}.json  # 개별 쿼리 결과
│   └── ...
├── business/                   # 비즈니스 테스트 로그
│   └── {suite}-{timestamp}.json
├── analysis/                   # 상세 분석 로그
│   └── {suite}-{timestamp}.json
└── framework/                  # 프레임워크 로그
    └── {suite}-{timestamp}.json
```

## 🔧 **사용법**

### **1. QueryResultLogger 사용**

```typescript
import { queryResultLogger } from './setup/QueryResultLogger.js'

// 쿼리 실행 결과 로깅
queryResultLogger.logQueryResult({
  queryId: 'create-table-001',
  queryName: 'Create Table',
  queryType: 'mutation',
  templateId: 'create_table',
  stepNumber: 1,
  flowId: 'template-flow-123',
  executionTime: 150,
  success: true,
  query: 'mutation CreateTable($input: CreateTableInput!) { ... }',
  variables: { input: { identifier: 'test-table' } },
  result: { data: { createTable: { id: '123' } } },
  validation: {
    expectations: [
      { path: 'data.createTable.id', expected: 'string', actual: '123', passed: true }
    ],
    overallPassed: true
  },
  metadata: {
    businessContext: 'template-flow',
    testType: 'integration'
  }
})
```

### **2. LogViewer 사용**

```typescript
import { logViewer } from './setup/LogViewer.js'

// 사용 가능한 세션 목록 조회
const sessions = logViewer.getAvailableSessions()
console.log('Available sessions:', sessions)

// 특정 세션 로드
const session = logViewer.loadSession('session-1234567890')
if (session) {
  console.log('Session summary:', session.summary)
  console.log('Query results:', session.queryResults)
}

// 쿼리 결과 검색
const failedQueries = logViewer.searchQueryResults({
  filterBy: { success: false },
  maxResults: 10,
  sortBy: 'timestamp',
  sortOrder: 'desc'
})

// 특정 에러 타입 조회
const templateErrors = logViewer.getErrorDetails('TEMPLATE_NOT_FOUND', 5)

// 플로우별 성능 분석
const flowAnalysis = logViewer.analyzeFlowPerformance('template-flow-123')
console.log('Flow performance:', flowAnalysis)

// 전체 로그 분석
logViewer.printAnalysis()
```

### **3. 실시간 모니터링**

```typescript
// 실시간 쿼리 실행 모니터링
const monitorQuery = async (queryId: string, queryName: string, queryType: string) => {
  const startTime = Date.now()
  
  try {
    const result = await executeGraphQLQuery(query)
    const executionTime = Date.now() - startTime
    
    queryResultLogger.logQueryResult({
      queryId,
      queryName,
      queryType,
      executionTime,
      success: true,
      query: query,
      variables: variables,
      result: result,
      metadata: { businessContext: 'real-time-monitoring' }
    })
    
    return result
  } catch (error) {
    const executionTime = Date.now() - startTime
    
    queryResultLogger.logQueryResult({
      queryId,
      queryName,
      queryType,
      executionTime,
      success: false,
      query: query,
      variables: variables,
      error: error.message,
      errorType: error.constructor.name,
      metadata: { businessContext: 'real-time-monitoring' }
    })
    
    throw error
  }
}
```

## 📊 **로그 데이터 구조**

### **QueryExecutionResult**

```typescript
interface QueryExecutionResult {
  queryId: string                    // 고유 쿼리 ID
  queryName: string                  // 쿼리 이름
  queryType: 'mutation' | 'query' | 'subscription'
  templateId?: string               // 템플릿 ID (템플릿 기반인 경우)
  stepNumber?: number               // 플로우 내 단계 번호
  flowId?: string                   // 플로우 ID
  
  // 실행 정보
  timestamp: string                 // 실행 시간
  executionTime: number             // 실행 시간 (ms)
  success: boolean                  // 성공 여부
  
  // 쿼리 정보
  query: string                     // GraphQL 쿼리
  variables: Record<string, any>    // 쿼리 변수
  
  // 결과 정보
  result?: any                      // 실행 결과
  error?: string                    // 에러 메시지
  errorType?: string                // 에러 타입
  errorDetails?: any                // 상세 에러 정보
  
  // 성능 정보
  performance: {
    memoryUsage: number             // 메모리 사용량
    cpuUsage?: number               // CPU 사용량
    complexityScore?: number        // 복잡도 점수
  }
  
  // 검증 정보
  validation?: {
    expectations: Array<{
      path: string                  // 검증 경로
      expected: any                 // 예상 값
      actual: any                   // 실제 값
      passed: boolean               // 통과 여부
    }>
    overallPassed: boolean          // 전체 통과 여부
  }
  
  // 메타데이터
  metadata: {
    businessContext?: string        // 비즈니스 컨텍스트
    testType?: string               // 테스트 타입
    environment?: string            // 환경 정보
    version?: string                // 버전 정보
  }
}
```

### **QuerySummary**

```typescript
interface QuerySummary {
  totalQueries: number              // 전체 쿼리 수
  successfulQueries: number         // 성공한 쿼리 수
  failedQueries: number             // 실패한 쿼리 수
  averageExecutionTime: number      // 평균 실행 시간
  totalExecutionTime: number        // 총 실행 시간
  successRate: number               // 성공률 (%)
  errorTypes: Record<string, number> // 에러 타입별 발생 횟수
  slowestQueries: Array<{           // 가장 느린 쿼리들
    queryId: string
    queryName: string
    executionTime: number
  }>
  mostCommonErrors: Array<{         // 가장 흔한 에러들
    errorType: string
    count: number
    examples: string[]
  }>
}
```

## 🔍 **고급 기능**

### **1. 실시간 알림**

```typescript
// 에러 발생 시 실시간 알림
queryResultLogger.logQueryResult = (function(originalLog) {
  return function(result) {
    originalLog.call(this, result)
    
    if (!result.success) {
      // 에러 발생 시 알림
      console.error(`🚨 Query failed: ${result.queryName}`)
      console.error(`   Error: ${result.error}`)
      console.error(`   Error Type: ${result.errorType}`)
      
      // 필요시 외부 알림 시스템 연동
      // sendSlackNotification(result)
      // sendEmailAlert(result)
    }
  }
})(queryResultLogger.logQueryResult)
```

### **2. 성능 임계값 모니터링**

```typescript
// 느린 쿼리 감지
const SLOW_QUERY_THRESHOLD = 1000 // 1초

queryResultLogger.logQueryResult = (function(originalLog) {
  return function(result) {
    originalLog.call(this, result)
    
    if (result.executionTime > SLOW_QUERY_THRESHOLD) {
      console.warn(`🐌 Slow query detected: ${result.queryName}`)
      console.warn(`   Execution time: ${result.executionTime}ms`)
      console.warn(`   Threshold: ${SLOW_QUERY_THRESHOLD}ms`)
    }
  }
})(queryResultLogger.logQueryResult)
```

### **3. 자동 로그 정리**

```typescript
// 주기적 로그 정리
setInterval(() => {
  queryResultLogger.cleanupOldLogs(7) // 7일 이상 된 로그 정리
}, 24 * 60 * 60 * 1000) // 24시간마다 실행
```

## 📈 **분석 및 리포트**

### **1. 일일 리포트 생성**

```typescript
const generateDailyReport = () => {
  const analysis = logViewer.analyzeLogs()
  
  const report = {
    date: new Date().toISOString().split('T')[0],
    summary: {
      totalSessions: analysis.totalSessions,
      totalQueries: analysis.totalQueries,
      successRate: analysis.overallSuccessRate,
      averageExecutionTime: analysis.averageExecutionTime
    },
    topIssues: analysis.topErrors,
    performanceInsights: analysis.slowestQueries.slice(0, 5),
    recommendations: generateRecommendations(analysis)
  }
  
  // 리포트 파일 저장
  const reportPath = join(process.cwd(), 'test', 'logs', 'reports', `daily-${report.date}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  
  return report
}
```

### **2. 트렌드 분석**

```typescript
const analyzeTrends = (days: number = 7) => {
  const sessions = logViewer.getAvailableSessions()
  const recentSessions = sessions.slice(0, days)
  
  const trends = recentSessions.map(sessionId => {
    const session = logViewer.loadSession(sessionId)
    return session ? {
      date: sessionId,
      successRate: session.summary.successRate,
      averageExecutionTime: session.summary.averageExecutionTime,
      errorCount: session.summary.failedQueries
    } : null
  }).filter(Boolean)
  
  return {
    successRateTrend: trends.map(t => t.successRate),
    performanceTrend: trends.map(t => t.averageExecutionTime),
    errorTrend: trends.map(t => t.errorCount)
  }
}
```

## 🛠️ **설정 및 커스터마이징**

### **1. 로그 레벨 설정**

```typescript
// 환경 변수로 로그 레벨 제어
const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO'

const shouldLog = (level: string) => {
  const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG']
  return levels.indexOf(level) <= levels.indexOf(LOG_LEVEL)
}

// 조건부 로깅
if (shouldLog('DEBUG')) {
  queryResultLogger.logQueryResult(result)
}
```

### **2. 로그 포맷 커스터마이징**

```typescript
// 커스텀 로그 포맷터
const customFormatter = (result: QueryExecutionResult) => {
  return {
    timestamp: result.timestamp,
    level: result.success ? 'INFO' : 'ERROR',
    message: `${result.queryName} ${result.success ? 'succeeded' : 'failed'}`,
    executionTime: result.executionTime,
    error: result.error,
    context: {
      flowId: result.flowId,
      stepNumber: result.stepNumber,
      templateId: result.templateId
    }
  }
}
```

## 🔒 **보안 및 개인정보 보호**

### **1. 민감한 데이터 마스킹**

```typescript
const maskSensitiveData = (variables: Record<string, any>) => {
  const sensitiveKeys = ['password', 'token', 'secret', 'key']
  const masked = { ...variables }
  
  Object.keys(masked).forEach(key => {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      masked[key] = '***MASKED***'
    }
  })
  
  return masked
}
```

### **2. 로그 접근 제어**

```typescript
// 로그 파일 접근 권한 설정
const setLogPermissions = (filePath: string) => {
  // Unix/Linux 시스템에서만 작동
  if (process.platform !== 'win32') {
    chmodSync(filePath, 0o600) // 소유자만 읽기/쓰기 가능
  }
}
```

## 📚 **모범 사례**

### **1. 쿼리 ID 명명 규칙**

```typescript
// 의미있는 쿼리 ID 생성
const generateQueryId = (context: string, operation: string, step?: number) => {
  const timestamp = Date.now().toString().slice(-6)
  const stepSuffix = step ? `-step${step}` : ''
  return `${context}-${operation}${stepSuffix}-${timestamp}`
}

// 사용 예시
const queryId = generateQueryId('template-flow', 'create-table', 1)
// 결과: "template-flow-create-table-step1-123456"
```

### **2. 에러 분류 체계**

```typescript
const ERROR_TYPES = {
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  GRAPHQL_ERROR: 'GRAPHQL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const

const classifyError = (error: Error): string => {
  if (error.message.includes('Template not found')) {
    return ERROR_TYPES.TEMPLATE_NOT_FOUND
  }
  if (error.message.includes('GraphQL')) {
    return ERROR_TYPES.GRAPHQL_ERROR
  }
  if (error.message.includes('validation')) {
    return ERROR_TYPES.VALIDATION_ERROR
  }
  if (error.message.includes('timeout')) {
    return ERROR_TYPES.TIMEOUT_ERROR
  }
  return ERROR_TYPES.UNKNOWN_ERROR
}
```

### **3. 성능 모니터링 임계값**

```typescript
const PERFORMANCE_THRESHOLDS = {
  FAST: 100,      // 100ms 이하
  NORMAL: 500,    // 500ms 이하
  SLOW: 1000,     // 1초 이하
  VERY_SLOW: 5000 // 5초 이하
} as const

const getPerformanceLevel = (executionTime: number): string => {
  if (executionTime <= PERFORMANCE_THRESHOLDS.FAST) return 'FAST'
  if (executionTime <= PERFORMANCE_THRESHOLDS.NORMAL) return 'NORMAL'
  if (executionTime <= PERFORMANCE_THRESHOLDS.SLOW) return 'SLOW'
  return 'VERY_SLOW'
}
```

## 🚀 **확장 가능성**

### **1. 외부 시스템 연동**

- **Slack 알림**: 실시간 에러 알림
- **Grafana 대시보드**: 성능 모니터링
- **Elasticsearch**: 로그 검색 및 분석
- **Prometheus**: 메트릭 수집

### **2. 자동화 기능**

- **자동 재시도**: 실패한 쿼리 자동 재실행
- **성능 최적화 제안**: 느린 쿼리 분석 및 개선 제안
- **예측 분석**: 성능 트렌드 기반 예측

---

**문서 버전**: 1.0  
**최종 업데이트**: 2025-09-06  
**작성자**: AI Assistant

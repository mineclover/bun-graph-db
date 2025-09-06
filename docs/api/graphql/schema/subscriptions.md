# 🔔 GraphQL Subscriptions Reference

Subscription은 실시간 데이터 스트림을 제공합니다. WebSocket 연결을 통해 서버에서 클라이언트로 지속적인 데이터 업데이트를 전송합니다.

## 🚀 새로운 기능: 통합 템플릿 실행 시스템

### `executeTemplateStream` - 실시간 템플릿 실행 ⭐ **NEW!**

**설명**: 쿼리 템플릿을 실시간 스트리밍으로 실행하며, 진행 상황을 실시간으로 추적합니다.

**타입**: `TemplateExecutionStream!`

**파라미터**:
- `templateIdentifier: String!` - 템플릿 식별자
- `variables: JSON` (선택) - 템플릿 변수
- `trackUsage: Boolean` (기본값: true) - 사용 통계 추적 여부

#### 기본 실행 예제

```graphql
subscription ExecuteTemplateStream {
  executeTemplateStream(
    templateIdentifier: "user-analytics-live"
    variables: {
      "tableId": "users_table",
      "timeWindow": "1h"
    }
    trackUsage: true
  ) {
    status        # STARTING, IN_PROGRESS, COMPLETED, ERROR
    data          # 실행 결과 데이터 (JSON)
    progress      # 진행률 (0.0 ~ 1.0)
    timestamp     # 이벤트 발생 시간
    error         # 에러 메시지 (에러 발생 시)
    
    # 메타데이터
    metadata {
      templateId
      templateName
      complexityScore
      estimatedTokens
      version
      executionTime   # 현재까지 실행 시간 (ms)
    }
  }
}
```

**Variables**:
```json
{
  "templateIdentifier": "user-analytics-live",
  "variables": {
    "tableId": "users_table",
    "timeWindow": "1h"
  }
}
```

#### 실시간 응답 스트림

**1. 시작 이벤트**:
```json
{
  "data": {
    "executeTemplateStream": {
      "status": "STARTING",
      "data": null,
      "progress": 0.0,
      "timestamp": "2025-09-06T12:00:00.000Z",
      "error": null,
      "metadata": {
        "templateId": "template_123",
        "templateName": "User Analytics Live",
        "complexityScore": 5,
        "estimatedTokens": 150,
        "version": "1.2.0",
        "executionTime": 0
      }
    }
  }
}
```

**2. 진행 중 이벤트**:
```json
{
  "data": {
    "executeTemplateStream": {
      "status": "IN_PROGRESS",
      "data": null,
      "progress": 0.6,
      "timestamp": "2025-09-06T12:00:01.234Z",
      "error": null,
      "metadata": {
        "templateId": "template_123",
        "templateName": "User Analytics Live",
        "complexityScore": 5,
        "estimatedTokens": 150,
        "version": "1.2.0",
        "executionTime": 1234
      }
    }
  }
}
```

**3. 완료 이벤트**:
```json
{
  "data": {
    "executeTemplateStream": {
      "status": "COMPLETED",
      "data": {
        "users": [
          {"id": "user_1", "name": "김철수", "activity": 85},
          {"id": "user_2", "name": "박영희", "activity": 92}
        ],
        "summary": {
          "totalUsers": 1547,
          "activeUsers": 1205,
          "avgActivity": 78.5
        }
      },
      "progress": 1.0,
      "timestamp": "2025-09-06T12:00:02.567Z",
      "error": null,
      "metadata": {
        "templateId": "template_123",
        "templateName": "User Analytics Live",
        "complexityScore": 5,
        "estimatedTokens": 150,
        "version": "1.2.0",
        "executionTime": 2567
      }
    }
  }
}
```

#### 대용량 데이터 청킹 예제

장기 실행 또는 대용량 결과를 위한 청킹 지원:

```graphql
subscription ExecuteLargeTemplateStream {
  executeTemplateStream(
    templateIdentifier: "comprehensive-graph-analysis"
    variables: {
      "depth": 5,
      "includeMetrics": true
    }
  ) {
    status
    data
    progress
    
    # 청킹 정보
    metadata {
      templateName
      executionTime
      # 청킹이 적용되는 경우
      chunkIndex      # 현재 청크 번호
      totalChunks     # 전체 청크 수
      chunkSize       # 청크당 데이터 수
    }
  }
}
```

#### 에러 처리 예제

```graphql
subscription ExecuteTemplateWithErrorHandling {
  executeTemplateStream(
    templateIdentifier: "potentially-failing-template"
  ) {
    status
    data
    error
    
    metadata {
      templateName
      executionTime
    }
  }
}
```

**에러 응답 예시**:
```json
{
  "data": {
    "executeTemplateStream": {
      "status": "ERROR",
      "data": null,
      "error": "Template not found: potentially-failing-template",
      "metadata": {
        "templateId": "unknown",
        "templateName": "unknown",
        "complexityScore": 0,
        "version": "unknown",
        "executionTime": 15
      }
    }
  }
}
```

---

## 📊 데이터 변경 감지

### `tableCreated` - 새 테이블 생성 알림

**설명**: 새로운 테이블이 생성될 때마다 알림을 받습니다.

**타입**: `Table!`

#### 예제

```graphql
subscription OnTableCreated {
  tableCreated {
    id
    identifier
    name
    description
    createdAt
    
    # 초기 상태
    nodeCount     # 항상 0
    relationCount # 항상 0
  }
}
```

### `tableUpdated` - 테이블 업데이트 알림

**설명**: 테이블 정보가 업데이트될 때마다 알림을 받습니다.

**타입**: `Table!`

#### 예제

```graphql
subscription OnTableUpdated {
  tableUpdated {
    id
    identifier
    name
    description
    updatedAt
    
    # 변경된 통계
    nodeCount
    relationCount
  }
}
```

### `tableDeleted` - 테이블 삭제 알림

**설명**: 테이블이 삭제될 때 알림을 받습니다.

**타입**: `TableDeletedEvent!`

#### 예제

```graphql
subscription OnTableDeleted {
  tableDeleted {
    id
    identifier  # 삭제된 테이블의 식별자
    deletedAt   # 삭제 시점
  }
}
```

---

## 🔗 노드 실시간 변경

### `nodeCreated` - 노드 생성 알림

**설명**: 새로운 노드가 생성될 때 알림을 받습니다.

**타입**: `TableNode!`

**파라미터**:
- `tableId: ID` (선택) - 특정 테이블의 노드만 구독

#### 예제

**모든 노드 생성 구독**:
```graphql
subscription OnNodeCreated {
  nodeCreated {
    id
    content
    createdAt
    
    # 테이블 정보
    table {
      id
      name
      identifier
    }
    
    # 초기 속성들
    attributes {
      id
      name
      value
      type {
        name
        dataType
      }
    }
  }
}
```

**특정 테이블의 노드만 구독**:
```graphql
subscription OnNodeCreatedInTable($tableId: ID!) {
  nodeCreated(tableId: $tableId) {
    id
    content
    createdAt
    
    # 생성과 동시에 설정된 속성들
    attributes {
      name
      value
    }
  }
}
```

### `nodeUpdated` - 노드 업데이트 알림

**설명**: 노드가 수정될 때 알림을 받습니다.

**타입**: `TableNode!`

**파라미터**:
- `tableId: ID` (선택) - 특정 테이블의 노드만 구독

#### 예제

```graphql
subscription OnNodeUpdated($tableId: ID) {
  nodeUpdated(tableId: $tableId) {
    id
    content
    updatedAt
    
    # 변경된 속성들
    attributes {
      id
      name
      value
      updatedAt
    }
    
    # 관련 관계 정보 (변경에 영향받는)
    relations {
      id
      targetNode {
        id
        content
      }
    }
  }
}
```

### `nodeDeleted` - 노드 삭제 알림

**설명**: 노드가 삭제될 때 알림을 받습니다.

**타입**: `NodeDeletedEvent!`

**파라미터**:
- `tableId: ID` (선택) - 특정 테이블의 노드만 구독

#### 예제

```graphql
subscription OnNodeDeleted($tableId: ID!) {
  nodeDeleted(tableId: $tableId) {
    id
    tableId
    content    # 삭제된 노드의 내용
    deletedAt  # 삭제 시점
  }
}
```

---

## 🕸️ 관계 실시간 변경

### `relationCreated` - 관계 생성 알림

**설명**: 새로운 관계가 생성될 때 알림을 받습니다.

**타입**: `NodeRelation!`

**파라미터**:
- `tableId: ID` (선택) - 특정 테이블 내 관계만 구독

#### 예제

```graphql
subscription OnRelationCreated($tableId: ID) {
  relationCreated(tableId: $tableId) {
    id
    strength
    confidence
    description
    createdAt
    
    # 관계 타입
    type {
      name
      description
      isDirectional
    }
    
    # 연결된 노드들
    sourceNode {
      id
      content
    }
    targetNode {
      id
      content
    }
  }
}
```

### `relationDeleted` - 관계 삭제 알림

**설명**: 관계가 삭제될 때 알림을 받습니다.

**타입**: `NodeRelation!`

**파라미터**:
- `tableId: ID` (선택) - 특정 테이블 내 관계만 구독

#### 예제

```graphql
subscription OnRelationDeleted($tableId: ID) {
  relationDeleted(tableId: $tableId) {
    id
    
    # 삭제된 관계 정보
    type {
      name
    }
    
    # 연결되어 있던 노드들
    sourceNode {
      id
      content
    }
    targetNode {
      id
      content
    }
    
    # 삭제 시점은 이벤트 타임스탬프에서 확인
  }
}
```

---

## 📈 시스템 모니터링

### `systemHealthChanged` - 시스템 상태 변경

**설명**: 시스템 상태가 변경될 때 알림을 받습니다.

**타입**: `SystemHealth!`

#### 예제

```graphql
subscription OnSystemHealthChanged {
  systemHealthChanged {
    status        # "healthy" | "degraded" | "unhealthy"
    timestamp
    
    # 상세 상태 정보
    database {
      connected
      responseTime    # ms
      connectionPool {
        active
        idle
        total
      }
    }
    
    # 메모리 및 성능
    memory {
      used          # bytes
      total         # bytes
      percentage    # 0-100
    }
    
    performance {
      avgResponseTime   # ms
      requestsPerSecond
      errorRate        # 0-1
    }
    
    # 그래프 데이터 통계
    graphStats {
      totalNodes
      totalRelations
      totalTables
      avgNodesPerTable
    }
  }
}
```

### `performanceAlert` - 성능 경고

**설명**: 성능 임계치를 초과할 때 알림을 받습니다.

**타입**: `PerformanceMetrics!`

#### 예제

```graphql
subscription OnPerformanceAlert {
  performanceAlert {
    timestamp
    alertType      # "HIGH_RESPONSE_TIME" | "HIGH_ERROR_RATE" | "HIGH_MEMORY" | "HIGH_CPU"
    severity       # "WARNING" | "CRITICAL"
    
    # 현재 메트릭
    currentValue
    threshold
    
    # 상세 성능 데이터
    responseTime {
      current
      average
      p95
      p99
    }
    
    errorRate {
      current
      average
    }
    
    resourceUsage {
      cpu          # 0-100
      memory       # 0-100
      disk         # 0-100
    }
    
    # 권장 조치
    recommendations
  }
}
```

---

## 🔧 클라이언트 구현 예제

### JavaScript/TypeScript 클라이언트

```typescript
import { createClient } from 'graphql-ws'

const client = createClient({
  url: 'ws://localhost:4000/graphql',
})

// 템플릿 스트림 구독
const unsubscribe = client.subscribe(
  {
    query: `
      subscription ExecuteTemplateStream($templateId: String!, $variables: JSON) {
        executeTemplateStream(
          templateIdentifier: $templateId
          variables: $variables
        ) {
          status
          data
          progress
          error
          metadata {
            templateName
            executionTime
          }
        }
      }
    `,
    variables: {
      templateId: "real-time-dashboard",
      variables: { refreshInterval: 30 }
    }
  },
  {
    next: (data) => {
      console.log('받은 데이터:', data)
      const { status, progress, data: result } = data.data.executeTemplateStream
      
      switch (status) {
        case 'STARTING':
          console.log('템플릿 실행 시작')
          break
        case 'IN_PROGRESS':
          console.log(`진행률: ${(progress * 100).toFixed(1)}%`)
          break
        case 'COMPLETED':
          console.log('실행 완료:', result)
          break
        case 'ERROR':
          console.error('실행 에러:', data.data.executeTemplateStream.error)
          break
      }
    },
    error: (error) => {
      console.error('구독 에러:', error)
    },
    complete: () => {
      console.log('구독 완료')
    }
  }
)

// 구독 해제
// unsubscribe()
```

### React Hook 예제

```typescript
import { useSubscription } from '@apollo/client'

function useTemplateStreamExecution(templateId: string, variables: any) {
  const { data, loading, error } = useSubscription(
    gql`
      subscription ExecuteTemplateStream($templateId: String!, $variables: JSON) {
        executeTemplateStream(
          templateIdentifier: $templateId
          variables: $variables
        ) {
          status
          data
          progress
          error
          metadata {
            templateName
            executionTime
          }
        }
      }
    `,
    {
      variables: { templateId, variables }
    }
  )

  const stream = data?.executeTemplateStream
  
  return {
    status: stream?.status || 'STARTING',
    data: stream?.data,
    progress: stream?.progress || 0,
    error: stream?.error,
    metadata: stream?.metadata,
    loading
  }
}

// 사용 예시
function DashboardComponent() {
  const { status, data, progress, error } = useTemplateStreamExecution(
    'user-analytics-live',
    { timeWindow: '1h' }
  )

  if (error) {
    return <div>에러: {error}</div>
  }

  return (
    <div>
      <div>상태: {status}</div>
      <div>진행률: {(progress * 100).toFixed(1)}%</div>
      {data && <div>결과: {JSON.stringify(data, null, 2)}</div>}
    </div>
  )
}
```

---

## ⚡ 성능 최적화 및 모범 사례

### 1. **연결 관리**
```javascript
// 연결 재사용
const client = createClient({
  url: 'ws://localhost:4000/graphql',
  connectionParams: {
    authToken: 'your-auth-token'
  }
})

// 컴포넌트 언마운트 시 구독 해제
useEffect(() => {
  const subscription = client.subscribe(/* ... */)
  
  return () => {
    subscription.return?.()
  }
}, [])
```

### 2. **선택적 필드 요청**
```graphql
# ✅ 필요한 필드만 요청
subscription OptimizedTemplateStream {
  executeTemplateStream(templateIdentifier: "analytics") {
    status
    progress
    # data는 완료 시에만 필요한 경우 조건부 요청 고려
  }
}
```

### 3. **에러 복구**
```typescript
const subscribeWithRetry = (query, variables, maxRetries = 3) => {
  let retryCount = 0
  
  const subscribe = () => {
    return client.subscribe(query, variables)
      .catch(error => {
        if (retryCount < maxRetries) {
          retryCount++
          console.log(`재시도 ${retryCount}/${maxRetries}`)
          return new Promise(resolve => 
            setTimeout(() => resolve(subscribe()), 1000 * retryCount)
          )
        }
        throw error
      })
  }
  
  return subscribe()
}
```

### 4. **배치 처리**
대용량 스트림의 경우 클라이언트에서 배치 처리:

```typescript
const batchProcessor = {
  buffer: [],
  batchSize: 100,
  timeout: 1000,
  
  add(item) {
    this.buffer.push(item)
    if (this.buffer.length >= this.batchSize) {
      this.flush()
    }
  },
  
  flush() {
    if (this.buffer.length > 0) {
      this.processBatch([...this.buffer])
      this.buffer = []
    }
  },
  
  processBatch(items) {
    // 배치 처리 로직
    console.log(`${items.length}개 아이템 배치 처리`)
  }
}
```

---

**다음**: [Types 시스템 문서](./types.md) →  
**이전**: [Query 연산 문서](./queries.md) ←
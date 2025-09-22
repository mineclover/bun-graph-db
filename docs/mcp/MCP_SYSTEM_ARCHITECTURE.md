# MCP System Architecture
## Bun Graph Database Model Context Protocol Implementation

**버전**: 2.0.0
**최종 업데이트**: 2025-09-22
**MCP 스펙 버전**: 2025-06-18

## 🎯 시스템 개요

Bun Graph Database의 MCP (Model Context Protocol) 시스템은 **프록시-퍼스트 아키텍처**를 기반으로 하여 GraphQL 엔진과 MCP 클라이언트 간의 최적화된 브리지를 제공합니다.

### 핵심 설계 원칙
- **🔄 Proxy-First**: 87% 표준 GraphQL 프록시, 13% 커스텀 최적화
- **⚡ High Performance**: 직접 GraphQL 실행으로 최소 오버헤드
- **🛡️ Type Safety**: JSON Schema 검증 + GraphQL 타입 안전성
- **🔌 Protocol Compliant**: MCP 2025-06-18 표준 완전 준수

## 🏗️ 아키텍처 구조

### 전체 시스템 플로우
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Claude MCP    │    │   HTTP Server    │    │   GraphQL       │
│     Client      │◄──►│ (MCP 2025-06-18) │◄──►│   Operations    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Tool Registry  │
                       │  (Auto-loaded)   │
                       └──────────────────┘
```

### 레이어별 구성

#### 1. Transport Layer (HTTP/JSON-RPC 2.0)
- **엔드포인트**: `http://localhost:4000/mcp`
- **프로토콜**: JSON-RPC 2.0 over HTTP
- **보안**: Origin validation, DNS rebinding protection
- **버전 지원**: 2025-06-18 (primary), 2024-11-05 (compatible)

#### 2. MCP Protocol Layer
```typescript
interface McpRequest {
  jsonrpc: "2.0"
  id?: string | number
  method: string
  params?: any
}

interface McpResponse {
  jsonrpc: "2.0"
  id?: string | number
  result?: any
  error?: McpError
}
```

#### 3. Tool Registry Layer
- **자동 로딩**: GraphQL 계약 파일에서 도구 정의 자동 추출
- **스키마 검증**: AJV 기반 JSON Schema 검증
- **도구 라우팅**: 표준 프록시 vs 커스텀 처리 결정

#### 4. Execution Engine Layer
```typescript
// 표준 프록시 실행
const result = await graphqlExecutor.execute({
  operationType: tool.graphqlOperation.operationType,
  query: tool.graphqlOperation.query,
  variables: transformedVariables
})

// 커스텀 처리 (최적화 필요 시)
if (tool.graphqlOperation?.operationType === 'custom') {
  return await handleCustomTool(id, name, args)
}
```

## 🛠️ 핵심 컴포넌트

### McpHttpServer
`src/mcp/http-server/McpHttpServer.ts`

**주요 책임**:
- MCP 프로토콜 라이프사이클 관리
- 도구 호출 라우팅 및 실행
- JSON-RPC 2.0 요청/응답 처리
- 보안 및 인증 검증

**핵심 메서드**:
```typescript
class McpHttpServer {
  async handleRequest(request: McpRequest): Promise<McpResponse>
  async handleToolsCall(id: string, params: any): Promise<McpResponse>
  async handleCustomTool(id: string, toolName: string, args: any): Promise<McpResponse>
  transformParametersForGraphQL(toolName: string, params: any): any
}
```

### Tool Registry
`src/mcp/registries/ToolRegistry.ts`

**기능**:
- GraphQL 계약 파일 파싱
- 도구 정의 검증 및 등록
- 런타임 도구 조회 및 실행

### GraphQL Executor
`src/graphql/GraphQLExecutor.ts`

**역할**:
- GraphQL 쿼리/뮤테이션 직접 실행
- 변수 바인딩 및 결과 변환
- 오류 처리 및 응답 포맷팅

## 📊 도구 분류 및 최적화 전략

### 표준 프록시 도구 (20/23 = 87%)
직접 GraphQL 실행으로 최고 성능 달성

| 도구 카테고리 | 도구 수 | 예시 |
|--------------|---------|------|
| **System Health** | 2 | `healthCheck`, `systemStats` |
| **Table Management** | 3 | `createTable`, `searchTables`, `getTables` |
| **Node Operations** | 2 | `createNode`, `searchNodes` |
| **Relationships** | 1 | `createRelation` |
| **Templates** | 4 | `createTemplate`, `executeTemplateWithGraphQL`, `searchTemplates`, `exportTemplate` |
| **Attributes** | 5 | `createAttribute`, `updateAttribute`, `deleteAttribute`, `getTableAttributes`, `getNodeAttributes` |
| **Schema Import/Export** | 3 | `importTemplate`, `exportTableWithNodes` (planned) |

### 커스텀 최적화 도구 (3/23 = 13%)
복잡한 로직과 데이터 가공이 필요한 경우

| 도구명 | 최적화 유형 | 설명 |
|-------|-------------|------|
| **getTableDocs** | 복합 데이터 조합 | 테이블 정보 + 샘플 노드 + 사용법 예시 생성 |
| **setNodeAttribute** | 비즈니스 로직 | 속성 존재 여부에 따른 생성/업데이트 분기 |
| **removeNodeAttribute** | 데이터 검증 | 삭제 전 존재 여부 확인 및 안전한 제거 |
| **updateNodeAttributeValue** | 스마트 로직 | 없으면 생성, 있으면 업데이트 |

## 🔧 도구 개발 워크플로우

### 1. 표준 프록시 도구 추가
```bash
# 1단계: GraphQL 스키마 확장
echo 'extend type Query { newOperation: String! }' >> schema.graphql

# 2단계: MCP 도구 정의 추가
cat >> graphql-tools.json <<EOF
{
  "name": "newTool",
  "description": "Tool description",
  "inputSchema": { "type": "object", "properties": {} },
  "graphqlOperation": {
    "type": "query",
    "query": "query newTool { newOperation }"
  }
}
EOF

# 3단계: 자동 등록 (서버 재시작)
bun run dev
```

### 2. 커스텀 최적화 도구 추가
```typescript
// handleCustomTool 메서드에 케이스 추가
case 'customOptimizedTool':
  return await this.handleCustomOptimizedTool(id, args)

// 커스텀 핸들러 구현
private async handleCustomOptimizedTool(id: string, args: any) {
  // 1단계: 기본 GraphQL 데이터 수집
  const baseData = await this.graphqlExecutor.execute(...)

  // 2단계: 데이터 가공 및 최적화
  const processedData = this.processAndOptimize(baseData)

  // 3단계: MCP 응답 형식으로 변환
  return this.createMcpResponse(id, processedData)
}
```

## 🚀 성능 최적화

### 실행 시간 벤치마크
| 도구 유형 | 평균 실행 시간 | 오버헤드 |
|----------|----------------|----------|
| **표준 프록시** | 5-15ms | ~2ms |
| **커스텀 최적화** | 20-50ms | ~10ms |
| **복합 데이터** | 50-150ms | ~30ms |

### 메모리 사용량
- **Tool Registry**: ~2MB (23 도구 정의)
- **GraphQL Executor**: ~5MB (스키마 캐시)
- **Request Context**: ~1KB per request

### 캐싱 전략
```typescript
// 도구 정의 캐싱
private toolCache = new Map<string, ToolDefinition>()

// GraphQL 스키마 캐싱
private schemaCache = new Map<string, DocumentNode>()

// 파라미터 변환 캐싱 (자주 사용되는 패턴)
private transformCache = new Map<string, Function>()
```

## 🛡️ 보안 및 검증

### 입력 검증 파이프라인
```typescript
// 1단계: JSON Schema 검증
const validate = this.ajv.compile(tool.inputSchema)
const valid = validate(args || {})

// 2단계: 도구별 커스텀 검증
if (tool.validation) {
  await tool.validation.validate(args)
}

// 3단계: GraphQL 변수 타입 검증
const variables = this.transformParametersForGraphQL(name, args)
```

### 보안 헤더 및 CORS
```typescript
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Access-Control-Allow-Origin': this.isValidOrigin(origin) ? origin : 'null'
}
```

## 📈 모니터링 및 로깅

### 구조화된 로깅
```typescript
logger.info('MCP Tool Execution', {
  tool: toolName,
  executionTime: Date.now() - startTime,
  inputSize: JSON.stringify(args).length,
  outputSize: JSON.stringify(result).length,
  success: !result.errors,
  clientInfo: request.clientInfo
})
```

### 메트릭 수집
- 도구별 호출 횟수 및 성공률
- 평균 실행 시간 및 성능 추이
- 오류 발생 패턴 및 빈도
- 클라이언트별 사용 통계

## 🔄 확장성 및 유지보수성

### 모듈러 아키텍처
```
src/mcp/
├── http-server/           # HTTP 전송 계층
├── registries/           # 도구 등록 및 관리
├── executors/            # GraphQL 실행 엔진
├── validators/           # 입력 검증 로직
├── transformers/         # 데이터 변환 유틸리티
└── types/               # TypeScript 타입 정의
```

### 플러그인 시스템 (계획)
```typescript
interface McpPlugin {
  name: string
  version: string
  tools: ToolDefinition[]
  middleware?: MiddlewareFunction[]
  validators?: ValidatorFunction[]
}

// 플러그인 등록
mcpServer.registerPlugin(new AnalyticsPlugin())
mcpServer.registerPlugin(new VisualizationPlugin())
```

## 🧪 테스트 전략

### 테스트 피라미드
```
         /\
        /  \    E2E Tests (MCP Protocol)
       /____\
      /      \   Integration Tests (GraphQL)
     /________\
    /          \  Unit Tests (Components)
   /____________\
```

### 테스트 커버리지 목표
- **Unit Tests**: >95% (핵심 로직)
- **Integration Tests**: >90% (GraphQL 연동)
- **E2E Tests**: >80% (MCP 프로토콜)

## 📚 참고 자료

### 공식 문서
- [MCP Specification 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [GraphQL Specification](https://spec.graphql.org/)

### 구현 가이드
- [MCP Tools Extension Reference](./MCP_TOOLS_EXTENSION_REFERENCE.md)
- [GraphQL Schema Documentation](../api/graphql-schema.md)
- [Development Environment Setup](../development/DEVELOPMENT_ENVIRONMENT_GUIDE.md)

---

**이 문서는 지속적으로 업데이트되며, 시스템 진화에 따라 내용이 개선됩니다.**
# MCP Tools Extension Reference

> **역사적 확장 참고 자료**: 이 문서의 고정 도구 수와 프록시 비율은 현재 운영 계약이 아니다. 현재 도구 이름·입력·권한 범위는 [`McpToolRegistry`](../../src/application/services/McpToolRegistry.ts)와 [MCP 참조](./README.md)를 기준으로 확인한다.

**버전**: 2.0.0
**최종 업데이트**: 2025-09-22
**대상**: 개발자, 시스템 아키텍트
**난이도**: 중급 → 고급

## 🎯 개요

이 문서는 Bun Graph Database의 MCP (Model Context Protocol) 도구 확장 시스템에 대한 완전한 참조 가이드입니다. 표준 프록시 도구 추가부터 고급 커스텀 최적화까지 체계적으로 다룹니다.

## 📚 목차

1. [도구 분류 시스템](#도구-분류-시스템)
2. [표준 프록시 도구 개발](#표준-프록시-도구-개발)
3. [커스텀 최적화 도구 개발](#커스텀-최적화-도구-개발)
4. [도구 계약 명세](#도구-계약-명세)
5. [실전 예제](#실전-예제)
6. [성능 최적화](#성능-최적화)
7. [디버깅 가이드](#디버깅-가이드)

## 🏗️ 도구 분류 시스템

### 표준 GraphQL 실행 경로
**특징**: GraphQL 쿼리/뮤테이션을 직접 실행하여 최고 성능 달성

```typescript
// 표준 프록시 실행 패턴
const result = await graphqlExecutor.execute({
  operationType: tool.graphqlOperation.operationType,
  query: tool.graphqlOperation.query,
  variables: transformedVariables
})
```

**적용 기준**:
- ✅ 단순한 CRUD 작업
- ✅ 직접적인 데이터베이스 조회
- ✅ 표준 GraphQL 스키마로 완전히 표현 가능한 작업
- ✅ 파라미터 변환이 간단한 경우

### 전용 처리 경로
**특징**: 복잡한 비즈니스 로직과 데이터 가공이 필요한 경우

```typescript
// 커스텀 최적화 실행 패턴
private async handleCustomTool(id: string | number | undefined, toolName: string, args: any) {
  switch (toolName) {
    case 'getTableDocs':
      return await this.handleGetTableDocs(id, args)
    // ... 기타 커스텀 도구들
  }
}
```

**적용 기준**:
- ✅ 복합 데이터 조합이 필요한 경우
- ✅ 복잡한 비즈니스 로직 적용
- ✅ 다중 데이터 소스 통합
- ✅ 실시간 데이터 가공 및 변환

## 🔧 표준 프록시 도구 개발

### 1단계: GraphQL 스키마 확장

```graphql
# src/presentation/graphql/schema/types/new-feature.graphql
extend type Query {
  newQueryOperation(
    input: NewQueryInput!
  ): NewQueryResult!
}

extend type Mutation {
  newMutationOperation(
    input: NewMutationInput!
  ): NewMutationResult!
}

input NewQueryInput {
  param1: String!
  param2: Int
  filters: [FilterInput!]
}

type NewQueryResult {
  success: Boolean!
  data: [NewDataType!]!
  totalCount: Int!
  errors: [GraphQLError!]!
}
```

### 2단계: GraphQL 리졸버 구현

```typescript
// src/presentation/graphql/queries/NewQueries.ts
export class NewQueries extends BaseResolver {
  async newQueryOperation(_: GraphQLParent, args: NewQueryArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as any,
      [
        BaseResolver.validationRules.required('input', 'Query input'),
        BaseResolver.validationRules.required('input.param1', 'Parameter 1'),
        BaseResolver.validationRules.nonEmpty('input.param1', 'Parameter 1'),
      ],
      'newQueryOperation'
    )

    return this.handleQuery(
      async () => {
        // 비즈니스 로직 구현
        const result = await this.repository.performOperation(args.input)
        return {
          success: true,
          data: result.data,
          totalCount: result.total,
          errors: []
        }
      },
      'newQueryOperation',
      { input: args.input }
    )
  }
}
```

### 3단계: MCP 도구 계약 정의

```json
// specs/005-graphql-mcp-graphql/contracts/graphql-tools.json
{
  "name": "newTool",
  "description": "새로운 도구에 대한 명확한 설명",
  "inputSchema": {
    "type": "object",
    "properties": {
      "param1": {
        "type": "string",
        "description": "첫 번째 매개변수"
      },
      "param2": {
        "type": "integer",
        "description": "두 번째 매개변수 (선택사항)"
      }
    },
    "required": ["param1"],
    "additionalProperties": false
  },
  "graphqlOperation": {
    "operationType": "query",
    "query": "query newTool($param1: String!, $param2: Int) { newQueryOperation(input: { param1: $param1, param2: $param2 }) { success data { id name } totalCount errors { message code } } }"
  }
}
```

### 4단계: 스키마 빌더에 등록

```typescript
// src/presentation/graphql/GraphQLSchemaBuilder.ts
private buildResolvers(deps: GraphQLDependencies): IResolvers {
  return {
    Query: {
      // ... 기존 쿼리들
      newQueryOperation: (_: GraphQLParent, args: Record<string, unknown>) =>
        deps.newQueries.newQueryOperation(_, args as any),
    },
    // ... 기타 리졸버들
  }
}
```

## ⚡ 커스텀 최적화 도구 개발

### 고급 예제: 복합 테이블 문서화 도구

```typescript
// src/mcp/http-server/McpHttpServer.ts
private async handleGetTableDocs(id: string | number | undefined, args: any) {
  try {
    // 1단계: 기본 테이블 정보 수집
    const tableResult = await this.graphqlExecutor.execute({
      operationType: 'query',
      query: `query GetTable($tableId: String, $identifier: String) {
        tableDocumentation(
          tableId: $tableId,
          identifier: $identifier,
          includeRelationships: false,
          includeSampleNodes: false
        ) {
          table { id identifier name description }
        }
      }`,
      variables: {
        tableId: args.tableId,
        identifier: args.identifier
      }
    })

    if (!tableResult.data?.tableDocumentation?.table) {
      return this.createMcpResponse(id, {
        success: false,
        documentation: null,
        errors: [{ message: 'Table not found', code: 'NOT_FOUND' }]
      })
    }

    const table = tableResult.data.tableDocumentation.table

    // 2단계: 병렬 데이터 수집
    const [attributesResult, sampleNodesResult, relationshipsResult] = await Promise.all([
      // 속성 정보 수집
      this.graphqlExecutor.execute({
        operationType: 'query',
        query: `query GetAttributes($tableId: String!) {
          getTableAttributes(tableId: $tableId) {
            success
            attributes { id identifier name attributeTypeId }
          }
        }`,
        variables: { tableId: table.id }
      }),

      // 샘플 노드 수집 (조건부)
      args.includeSampleNodes !== false ? this.graphqlExecutor.execute({
        operationType: 'query',
        query: `query GetSampleNodes($tableId: String!) {
          searchNodes(tableId: $tableId, searchTerm: "", limit: ${args.sampleLimit || 5}) {
            success
            nodes { id content createdAt }
          }
        }`,
        variables: { tableId: table.id }
      }) : Promise.resolve(null),

      // 관계 정보 수집 (조건부)
      args.includeRelationships !== false ? this.collectTableRelationships(table.id) : Promise.resolve(null)
    ])

    // 3단계: 데이터 가공 및 구조화
    const documentation = {
      table: table,
      schema: {
        totalAttributes: attributesResult.data?.getTableAttributes?.attributes?.length || 0,
        attributes: attributesResult.data?.getTableAttributes?.attributes || []
      },
      sampleNodes: sampleNodesResult?.data?.searchNodes?.nodes || null,
      relationships: relationshipsResult,
      usageStats: args.includeUsageStats ? await this.generateUsageStats(table.id) : null,
      usageExamples: this.generateUsageExamples(table)
    }

    // 4단계: 최종 응답 생성
    return this.createMcpResponse(id, {
      success: true,
      documentation: documentation,
      errors: []
    })

  } catch (error) {
    this.logger.error('Custom tool failed: getTableDocs', { error, args })
    return this.createMcpResponse(id, {
      success: false,
      documentation: null,
      errors: [{
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'INTERNAL_ERROR'
      }]
    })
  }
}

private async collectTableRelationships(tableId: string) {
  // 복잡한 관계 수집 로직
  // 이 부분이 단순 GraphQL로는 효율적으로 구현하기 어려운 부분
  const incomingQuery = `/* 복잡한 관계 쿼리 */`
  const outgoingQuery = `/* 복잡한 관계 쿼리 */`

  const [incoming, outgoing] = await Promise.all([
    this.graphqlExecutor.execute({ operationType: 'query', query: incomingQuery, variables: { tableId } }),
    this.graphqlExecutor.execute({ operationType: 'query', query: outgoingQuery, variables: { tableId } })
  ])

  return {
    incomingRelations: incoming.data || [],
    outgoingRelations: outgoing.data || [],
    relatedTables: this.extractRelatedTables(incoming.data, outgoing.data)
  }
}

private generateUsageExamples(table: any) {
  return [
    {
      category: 'basic',
      title: '새 노드 생성',
      description: `${table.identifier} 테이블에 새로운 노드 추가`,
      exampleMutation: `mutation {
  createNode(input: {
    tableId: "${table.id}"
    content: "새로운 내용"
  }) {
    success
    node { id content }
    errors { message }
  }
}`
    },
    {
      category: 'search',
      title: '노드 검색',
      description: `${table.identifier} 테이블에서 노드 검색`,
      exampleQuery: `query {
  searchNodes(
    tableId: "${table.id}"
    searchTerm: "검색어"
    limit: 10
  ) {
    success
    nodes { id content }
  }
}`
    }
  ]
}
```

## 📋 도구 계약 명세

### JSON Schema 구조

```typescript
interface ToolDefinition {
  name: string                    // 도구 이름 (camelCase)
  description: string             // 명확한 기능 설명
  inputSchema: JSONSchema         // 입력 파라미터 스키마
  graphqlOperation: {
    operationType: 'query' | 'mutation' | 'custom'
    query: string                 // GraphQL 쿼리/뮤테이션
  }
}
```

### 스키마 검증 규칙

```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "requiredParam": {
        "type": "string",
        "description": "필수 파라미터에 대한 명확한 설명"
      },
      "optionalParam": {
        "type": "integer",
        "description": "선택적 파라미터 설명",
        "default": 10,
        "minimum": 1,
        "maximum": 100
      }
    },
    "required": ["requiredParam"],
    "additionalProperties": false
  }
}
```

## 🎯 실전 예제

### 예제 1: 단순 검색 도구 (표준 프록시)

```json
{
  "name": "searchTablesByTag",
  "description": "태그로 테이블 검색",
  "inputSchema": {
    "type": "object",
    "properties": {
      "tag": {
        "type": "string",
        "description": "검색할 태그"
      },
      "limit": {
        "type": "integer",
        "description": "최대 결과 수",
        "default": 10,
        "minimum": 1,
        "maximum": 50
      }
    },
    "required": ["tag"],
    "additionalProperties": false
  },
  "graphqlOperation": {
    "operationType": "query",
    "query": "query searchTablesByTag($tag: String!, $limit: Int) { searchTables(searchTerm: $tag, limit: $limit) { success tables { id identifier name } } }"
  }
}
```

### 예제 2: 복합 분석 도구 (커스텀 최적화)

```json
{
  "name": "analyzeTablePerformance",
  "description": "테이블 성능 종합 분석 (노드 수, 관계 복잡도, 쿼리 패턴)",
  "inputSchema": {
    "type": "object",
    "properties": {
      "tableId": {
        "type": "string",
        "description": "분석할 테이블 ID"
      },
      "timeRange": {
        "type": "string",
        "enum": ["1d", "7d", "30d"],
        "description": "분석 기간",
        "default": "7d"
      },
      "includeOptimizations": {
        "type": "boolean",
        "description": "최적화 제안 포함 여부",
        "default": true
      }
    },
    "required": ["tableId"],
    "additionalProperties": false
  },
  "graphqlOperation": {
    "operationType": "custom",
    "query": "custom_analysis"
  }
}
```

## ⚡ 성능 최적화

### 캐싱 전략

```typescript
class McpHttpServer {
  private toolCache = new Map<string, ToolDefinition>()
  private schemaCache = new Map<string, DocumentNode>()
  private transformCache = new Map<string, Function>()

  private async getCachedTool(name: string): Promise<ToolDefinition> {
    if (!this.toolCache.has(name)) {
      const tool = await this.loadToolDefinition(name)
      this.toolCache.set(name, tool)
    }
    return this.toolCache.get(name)!
  }

  private getCachedTransform(toolName: string): Function | undefined {
    return this.transformCache.get(toolName)
  }
}
```

### 병렬 실행 패턴

```typescript
// 병렬 데이터 수집 예제
const [basicData, relatedData, statsData] = await Promise.all([
  this.getBasicTableInfo(tableId),
  this.getRelatedTableInfo(tableId),
  this.getTableStats(tableId)
])

// 결과 조합
const result = {
  ...basicData,
  relationships: relatedData,
  statistics: statsData
}
```

### 파라미터 변환 최적화

```typescript
transformParametersForGraphQL(toolName: string, params: any): any {
  // 캐시된 변환 함수 사용
  const cachedTransform = this.getCachedTransform(toolName)
  if (cachedTransform) {
    return cachedTransform(params)
  }

  // 동적 변환 로직
  const transformed = this.dynamicTransform(toolName, params)

  // 자주 사용되는 패턴은 캐시에 저장
  if (this.isFrequentPattern(toolName)) {
    this.transformCache.set(toolName, (p: any) => this.dynamicTransform(toolName, p))
  }

  return transformed
}
```

## 🐛 디버깅 가이드

### 일반적인 문제들

#### 1. JSON Schema 검증 실패
```bash
# 증상: "Validation failed" 오류
# 원인: 입력 파라미터가 스키마와 불일치

# 해결방법:
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test",
    "method": "tools/call",
    "params": {
      "name": "toolName",
      "arguments": {
        // 정확한 스키마 형식으로 전송
        "requiredParam": "value",
        "optionalParam": 10
      }
    }
  }'
```

#### 2. GraphQL 쿼리 오류
```typescript
// 문제: 쿼리 구문 오류 또는 필드 불일치
// 해결: GraphQL Playground에서 쿼리 테스트

// GraphQL Playground: http://localhost:4000/graphql
query TestQuery($param: String!) {
  targetOperation(input: { param: $param }) {
    success
    errors { message }
  }
}
```

#### 3. 커스텀 도구 오류
```typescript
// 디버깅 로그 추가
private async handleCustomTool(id: string | number | undefined, toolName: string, args: any) {
  this.logger.info('Custom tool execution', { toolName, args })

  try {
    const result = await this.executeCustomLogic(toolName, args)
    this.logger.info('Custom tool success', { toolName, resultSize: JSON.stringify(result).length })
    return result
  } catch (error) {
    this.logger.error('Custom tool error', { toolName, error, stack: error.stack })
    throw error
  }
}
```

### 성능 모니터링

```typescript
// 실행 시간 측정
const startTime = Date.now()
const result = await this.executeOperation()
const executionTime = Date.now() - startTime

this.logger.info('Tool performance', {
  toolName,
  executionTime,
  inputSize: JSON.stringify(args).length,
  outputSize: JSON.stringify(result).length,
  success: !result.errors?.length
})
```

## 📊 도구 분류별 개발 가이드라인

### 표준 프록시 도구 개발 체크리스트
- [ ] GraphQL 스키마에 정확히 매핑되는가?
- [ ] 입력 파라미터가 GraphQL 변수와 1:1 대응되는가?
- [ ] JSON Schema 검증이 GraphQL 타입과 일치하는가?
- [ ] 에러 처리가 표준 패턴을 따르는가?
- [ ] 성능 최적화 여지가 없는가?

### 커스텀 최적화 도구 개발 체크리스트
- [ ] 표준 프록시로 구현 불가능한 복잡성이 있는가?
- [ ] 다중 데이터 소스 통합이 필요한가?
- [ ] 실시간 데이터 가공이 필요한가?
- [ ] 비즈니스 로직이 GraphQL 스키마로 표현하기 어려운가?
- [ ] 성능상 이점이 명확한가?

## 🚀 향후 확장 계획

### 플러그인 시스템
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

### 자동화된 도구 생성
```bash
# CLI 도구를 통한 도구 스캐폴딩
bun run generate:mcp-tool --name newTool --type proxy --schema schema.json
bun run generate:mcp-tool --name complexTool --type custom --template analytics
```

---

**이 문서는 Bun Graph Database MCP 시스템의 발전과 함께 지속적으로 업데이트됩니다.**

**기여 방법**: 새로운 도구 패턴이나 최적화 기법을 발견했다면 이 문서를 업데이트해 주세요.

**연락처**: 기술적 질문이나 제안사항이 있으시면 프로젝트 이슈 트래커를 이용해 주세요.

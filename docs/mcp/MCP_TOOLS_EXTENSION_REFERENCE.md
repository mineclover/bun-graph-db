# MCP Tools Extension Reference
## executeTemplateWithGraphQL 기반 도구 확장 가이드

**버전**: 1.0.0
**최종 업데이트**: 2025-09-21
**작성자**: Bun Graph DB Development Team

## 🎯 개요

이 문서는 `executeTemplateWithGraphQL`을 중심으로 한 MCP (Model Context Protocol) 도구 확장 방법론을 제공합니다. 모든 MCP 도구는 GraphQL 템플릿 실행 엔진을 통해 작동하며, JSON-RPC 2.0 프로토콜을 사용합니다.

## 📐 아키텍처 원칙

### 핵심 설계 철학
- **Template-Centric**: 모든 MCP 도구는 GraphQL 템플릿을 기반으로 작동
- **Unified Execution**: `executeTemplateWithGraphQL` 단일 엔진을 통한 실행
- **JSON Schema Validation**: 입력 데이터 무결성 보장
- **GraphQL Native**: GraphQL 쿼리/뮤테이션과 1:1 매핑

### 시스템 구성
```
MCP Client → JSON-RPC 2.0 → MCP Proxy → executeTemplateWithGraphQL → GraphQL Schema
```

## 🛠️ 기존 도구 분석

### 현재 구현된 12개 도구
| 도구명 | 타입 | 목적 | Template 기반 |
|--------|------|------|---------------|
| **executeTemplateWithGraphQL** | Core | 템플릿 실행 엔진 | ✅ 핵심 |
| healthCheck | Query | 시스템 상태 확인 | ✅ |
| systemStats | Query | 성능 메트릭 조회 | ✅ |
| createTable | Mutation | 테이블 생성 | ✅ |
| searchTables | Query | 테이블 검색 | ✅ |
| createNode | Mutation | 노드 생성 | ✅ |
| searchNodes | Query | 노드 검색 | ✅ |
| createRelation | Mutation | 관계 생성 | ✅ |
| createTemplate | Mutation | 템플릿 생성 | ✅ |
| searchTemplates | Query | 템플릿 검색 | ✅ |
| exportSchema | Query | 스키마 내보내기 | ✅ |
| importSchema | Mutation | 스키마 가져오기 | ✅ |

## 🔧 도구 확장 방법론

### 1. GraphQL First 접근법

새로운 MCP 도구를 추가하기 전에 먼저 GraphQL 스키마를 확장해야 합니다.

**예시: 새로운 Analytics 도구 추가**

```graphql
# 1. GraphQL 스키마 확장
type AnalyticsData {
  totalNodes: Int!
  totalRelations: Int!
  tableMetrics: [TableMetric!]!
  performanceMetrics: PerformanceMetric!
}

extend type Query {
  getAnalytics(
    tableId: String
    timeRange: String = "24h"
    includePerformance: Boolean = true
  ): AnalyticsData!
}
```

### 2. MCP 도구 정의

GraphQL 스키마가 준비되면 MCP 도구를 정의합니다.

```json
{
  "name": "getAnalytics",
  "description": "Get comprehensive analytics data for the graph database",
  "inputSchema": {
    "type": "object",
    "properties": {
      "tableId": {
        "type": "string",
        "description": "Optional table ID to filter analytics"
      },
      "timeRange": {
        "type": "string",
        "enum": ["1h", "24h", "7d", "30d"],
        "description": "Time range for analytics",
        "default": "24h"
      },
      "includePerformance": {
        "type": "boolean",
        "description": "Include performance metrics",
        "default": true
      }
    },
    "additionalProperties": false
  },
  "graphqlOperation": {
    "type": "query",
    "query": "query getAnalytics($tableId: String, $timeRange: String, $includePerformance: Boolean) { getAnalytics(tableId: $tableId, timeRange: $timeRange, includePerformance: $includePerformance) { totalNodes totalRelations tableMetrics { tableId nodeCount relationCount avgQueryTime } performanceMetrics { queriesPerSecond avgResponseTime memoryUsage } } }"
  }
}
```

### 3. 템플릿 기반 실행

모든 도구는 `executeTemplateWithGraphQL`을 통해 실행됩니다:

```typescript
// 내부 실행 흐름
async function executeMcpTool(toolName: string, arguments: Record<string, any>) {
  // 1. 도구 정의 조회
  const tool = registry.getTool(toolName);

  // 2. executeTemplateWithGraphQL을 통한 실행
  const result = await graphqlExecutor.execute(
    tool.graphqlOperation,
    arguments
  );

  // 3. MCP 응답 형식으로 변환
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result.data || result)
    }],
    isError: !!result.errors
  };
}
```

## 📋 실제 확장 예시

### Case Study: 고급 검색 도구 추가

**1단계: 요구사항 정의**
- 다중 테이블 검색
- 관계 깊이 제한
- 결과 랭킹

**2단계: GraphQL 스키마 확장**
```graphql
type AdvancedSearchResult {
  nodes: [SearchResultNode!]!
  relations: [SearchResultRelation!]!
  totalCount: Int!
  searchTime: Float!
  ranking: [RankingInfo!]!
}

extend type Query {
  advancedSearch(
    query: String!
    tableIds: [String!] = []
    maxDepth: Int = 3
    limit: Int = 50
    rankBy: SearchRankingType = RELEVANCE
  ): AdvancedSearchResult!
}
```

**3단계: MCP 도구 정의**
```json
{
  "name": "advancedSearch",
  "description": "Perform advanced multi-table search with relationship traversal",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query string",
        "minLength": 1
      },
      "tableIds": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Table IDs to search within",
        "default": []
      },
      "maxDepth": {
        "type": "integer",
        "description": "Maximum relationship traversal depth",
        "minimum": 1,
        "maximum": 10,
        "default": 3
      },
      "limit": {
        "type": "integer",
        "description": "Maximum number of results",
        "minimum": 1,
        "maximum": 1000,
        "default": 50
      },
      "rankBy": {
        "type": "string",
        "enum": ["RELEVANCE", "RECENCY", "POPULARITY", "CONNECTIVITY"],
        "description": "Ranking strategy",
        "default": "RELEVANCE"
      }
    },
    "required": ["query"],
    "additionalProperties": false
  },
  "graphqlOperation": {
    "type": "query",
    "query": "query advancedSearch($query: String!, $tableIds: [String!], $maxDepth: Int, $limit: Int, $rankBy: SearchRankingType) { advancedSearch(query: $query, tableIds: $tableIds, maxDepth: $maxDepth, limit: $limit, rankBy: $rankBy) { nodes { id content tableId relevanceScore } relations { fromNodeId toNodeId relationshipType strength } totalCount searchTime ranking { nodeId score explanation } } }"
  }
}
```

**4단계: 테스트**
```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "advancedSearch",
      "arguments": {
        "query": "machine learning",
        "tableIds": ["research-papers", "projects"],
        "maxDepth": 2,
        "limit": 20,
        "rankBy": "RELEVANCE"
      }
    },
    "id": 1
  }'
```

## 🎨 도구 설계 패턴

### 1. 단순 조회 패턴 (Simple Query Pattern)
```json
{
  "name": "getEntityCount",
  "inputSchema": {
    "type": "object",
    "properties": {
      "entityType": { "type": "string", "enum": ["nodes", "relations", "tables"] }
    },
    "required": ["entityType"]
  },
  "graphqlOperation": {
    "type": "query",
    "query": "query getEntityCount($entityType: String!) { getEntityCount(entityType: $entityType) }"
  }
}
```

### 2. 복합 뮤테이션 패턴 (Complex Mutation Pattern)
```json
{
  "name": "bulkCreateNodes",
  "inputSchema": {
    "type": "object",
    "properties": {
      "tableId": { "type": "string" },
      "nodes": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "content": { "type": "string" },
            "metadata": { "type": "object" }
          }
        }
      }
    },
    "required": ["tableId", "nodes"]
  },
  "graphqlOperation": {
    "type": "mutation",
    "query": "mutation bulkCreateNodes($tableId: String!, $nodes: [NodeInput!]!) { bulkCreateNodes(tableId: $tableId, nodes: $nodes) { success count errors { index message } } }"
  }
}
```

### 3. 조건부 실행 패턴 (Conditional Execution Pattern)
```json
{
  "name": "conditionalUpdate",
  "inputSchema": {
    "type": "object",
    "properties": {
      "conditions": { "type": "object" },
      "updates": { "type": "object" },
      "dryRun": { "type": "boolean", "default": false }
    },
    "required": ["conditions", "updates"]
  },
  "graphqlOperation": {
    "type": "mutation",
    "query": "mutation conditionalUpdate($conditions: JSON!, $updates: JSON!, $dryRun: Boolean) { conditionalUpdate(conditions: $conditions, updates: $updates, dryRun: $dryRun) { affected preview { before after } } }"
  }
}
```

## 🔐 보안 및 검증

### 입력 검증 규칙
1. **JSON Schema 검증**: 모든 입력은 정의된 스키마를 따라야 함
2. **필수 필드 검증**: required 필드는 반드시 제공되어야 함
3. **타입 안전성**: GraphQL 스키마와 MCP 입력 스키마의 타입 일치
4. **범위 제한**: 숫자 필드는 최소/최대값 제한

### 권한 관리
```json
{
  "name": "adminOnlyOperation",
  "description": "Administrative operation requiring elevated privileges",
  "inputSchema": {
    "type": "object",
    "properties": {
      "adminToken": { "type": "string", "description": "Admin authentication token" }
    },
    "required": ["adminToken"]
  },
  "graphqlOperation": {
    "type": "mutation",
    "query": "mutation adminOnlyOperation($adminToken: String!) { adminOperation(token: $adminToken) { success message } }"
  }
}
```

## 📊 성능 최적화

### 1. 쿼리 최적화
- **필드 선택**: 필요한 필드만 요청
- **페이지네이션**: 대용량 데이터 처리
- **캐싱**: 반복적인 조회 최적화

### 2. 배치 처리
```json
{
  "name": "batchOperation",
  "inputSchema": {
    "type": "object",
    "properties": {
      "operations": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "type": { "type": "string", "enum": ["create", "update", "delete"] },
            "data": { "type": "object" }
          }
        },
        "maxItems": 100
      }
    }
  }
}
```

## 🧪 테스트 전략

### 1. 단위 테스트
```typescript
describe('MCP Tool: advancedSearch', () => {
  test('should validate input schema', () => {
    const tool = registry.getTool('advancedSearch');
    const result = validateInput(tool.inputSchema, {
      query: 'test',
      maxDepth: 2
    });
    expect(result.valid).toBe(true);
  });

  test('should execute GraphQL operation', async () => {
    const result = await executor.execute(tool.graphqlOperation, {
      query: 'machine learning',
      limit: 10
    });
    expect(result.data).toBeDefined();
    expect(result.errors).toBeUndefined();
  });
});
```

### 2. 통합 테스트
```bash
# MCP 프로토콜 테스트
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "advancedSearch",
      "arguments": { "query": "test", "limit": 5 }
    },
    "id": 1
  }' | jq '.result.content[0].text | fromjson'
```

## 📚 확장 예시 라이브러리

### 분석 도구
```json
{
  "name": "getNetworkAnalysis",
  "description": "Analyze network structure and connectivity patterns",
  "graphqlOperation": {
    "type": "query",
    "query": "query networkAnalysis($tableId: String!, $analysisType: NetworkAnalysisType!) { networkAnalysis(tableId: $tableId, analysisType: $analysisType) { centralityScores clusteringCoefficient pathLengths communityDetection } }"
  }
}
```

### 시각화 도구
```json
{
  "name": "generateVisualization",
  "description": "Generate graph visualization data",
  "graphqlOperation": {
    "type": "query",
    "query": "query generateVisualization($tableId: String!, $layout: LayoutType!, $format: VisualizationFormat!) { generateVisualization(tableId: $tableId, layout: $layout, format: $format) { nodes { id x y size color } edges { source target weight } metadata { width height scale } } }"
  }
}
```

### 데이터 마이그레이션 도구
```json
{
  "name": "migrateData",
  "description": "Migrate data between tables or external sources",
  "graphqlOperation": {
    "type": "mutation",
    "query": "mutation migrateData($sourceId: String!, $targetId: String!, $mappingRules: JSON!, $validateOnly: Boolean) { migrateData(sourceId: $sourceId, targetId: $targetId, mappingRules: $mappingRules, validateOnly: $validateOnly) { success migratedCount errors { rowIndex message } validation { passed issues } } }"
  }
}
```

## 🚀 배포 및 등록

### 1. 도구 등록 프로세스
```typescript
// 1. GraphQL 스키마 업데이트
// 2. MCP 도구 정의 추가
// 3. 계약 파일 업데이트
await registry.loadFromContract();
console.log(`Loaded ${registry.getToolCount()} MCP tools`);

// 4. 검증
const validation = registry.validateAllTools();
if (!validation.valid) {
  throw new Error('Tool validation failed');
}
```

### 2. 버전 관리
```json
{
  "title": "GraphQL-to-MCP Tool Definitions",
  "version": "0.2.0",
  "changelog": [
    {
      "version": "0.2.0",
      "changes": ["Added advancedSearch tool", "Enhanced analytics capabilities"],
      "breaking": false
    }
  ]
}
```

## 🎯 모범 사례

### 1. 명명 규칙
- **동사 시작**: `get`, `create`, `update`, `delete`, `search`, `analyze`
- **명확한 목적**: `getUserPreferences` vs `getUser`
- **일관성**: 유사한 동작은 유사한 패턴 사용

### 2. 스키마 설계
- **최소 필수 필드**: 꼭 필요한 필드만 required로 설정
- **기본값 제공**: 합리적인 기본값으로 사용성 향상
- **enum 활용**: 제한된 선택지는 enum으로 정의

### 3. 오류 처리
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "data": {
        "type": "object",
        "additionalProperties": false,
        "errorMessage": {
          "additionalProperties": "Unknown property in data object"
        }
      }
    }
  }
}
```

## 🔧 디버깅 및 모니터링

### 로그 패턴
```typescript
logger.info('MCP Tool Execution', {
  tool: 'advancedSearch',
  arguments: { query: 'machine learning', limit: 20 },
  executionTime: 150,
  resultCount: 15
});
```

### 성능 메트릭
- 도구별 실행 시간
- 사용 빈도 통계
- 오류율 모니터링
- GraphQL 쿼리 복잡도

## 📞 지원 및 문의

### 개발팀 연락처
- **이슈 리포팅**: GitHub Issues
- **기능 요청**: Feature Request Template
- **문서 개선**: Documentation PR

### 관련 문서
- [GraphQL Schema Reference](../api/graphql-schema.md)
- [Template System Guide](../templates/template-system-guide.md)
- [MCP Protocol Specification](./mcp-protocol-spec.md)

---

**© 2025 Bun Graph DB Development Team. All rights reserved.**
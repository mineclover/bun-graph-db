# MCP Template Management API Reference

**완전 구현된 MCP 템플릿 관리 API 문서**

## 🎯 Overview

이 문서는 AI 메타데이터 기반 템플릿 생성을 위해 구현된 MCP (Model Context Protocol) API 엔드포인트들을 설명합니다.

## 🌐 Base URLs

- **GraphQL Server**: `http://localhost:4141/graphql`
- **REST API**: `http://localhost:4141/api`
- **Root MCP Server**: `http://localhost:4141/mcp` (JSON-RPC 2.0)
- **Table-Specific MCP Servers**: `http://localhost:4141/sub/{tableId}/mcp` (JSON-RPC 2.0)

## 🔧 Claude MCP Server Setup

### Adding Root MCP Server (Global Template Management)
```bash
# CLI Command
claude mcp add --transport http root-mcp http://localhost:4141/mcp

# Or add to Claude configuration file
{
  "mcpServers": {
    "root-mcp": {
      "type": "http",
      "url": "http://localhost:4141/mcp"
    }
  }
}
```

### Adding Table-Specific MCP Servers
```bash
# CLI Command (example with table ID 267)
claude mcp add --transport http test-schema-discovery-2 http://localhost:4141/sub/267/mcp

# Or add to Claude configuration file
{
  "mcpServers": {
    "test-schema-discovery-2": {
      "type": "http",
      "url": "http://localhost:4141/sub/267/mcp"
    },
    "test-table-validation": {
      "type": "http",
      "url": "http://localhost:4141/sub/265/mcp"
    }
  }
}
```

### Available Test Table MCP Servers
- **Table 267**: `test-schema-discovery-2` → `http://localhost:4141/sub/267/mcp`
- **Table 266**: `test-schema-discovery` → `http://localhost:4141/sub/266/mcp`
- **Table 265**: `test-table-validation` → `http://localhost:4141/sub/265/mcp`

## 📋 MCP Template Tools

### 1. List Available MCP Tools

**Endpoint**: `GET /api/mcp-tools`

**Response**:
```json
{
  "success": true,
  "data": {
    "tools": [
      {
        "name": "bulk-import-templates",
        "description": "Bulk import templates from exported-templates directory",
        "operationType": "mutation",
        "parameters": {
          "overwriteExisting": "boolean (default: false)",
          "generateNewIdentifier": "boolean (default: false)",
          "dryRun": "boolean (default: false)",
          "filter": "string[] (optional)",
          "batchSize": "number (default: 10, max: 50)"
        }
      }
    ],
    "count": 9,
    "description": "MCP Tools serve as bridges between GraphQL operations and local services"
  },
  "executedAt": "2025-09-27T17:15:19.870Z"
}
```

### 2. Generic MCP Tool Call

**Endpoint**: `POST /api/mcp-tools/call`

**Request Body**:
```json
{
  "toolName": "validate-template",
  "parameters": {
    "query": "query { healthCheck { status } }"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "validateTemplateQuery": {
      "isValid": true,
      "errors": [],
      "parsedQuery": {
        "operationType": "query",
        "operationName": "unnamed",
        "fieldCount": 2
      }
    }
  },
  "tool": "validate-template",
  "executedAt": "2025-09-27T17:16:41.313Z"
}
```

## 🛠️ Template Management Tools

### 1. Create Template

**Endpoint**: `POST /api/mcp-tools/create-template`

**Request Body**:
```json
{
  "identifier": "test-template-001",
  "name": "Test Health Check Template",
  "query": "query TestHealthCheck { healthCheck { status database version } }",
  "description": "A test template for health checking",
  "tags": ["test", "health", "validation"],
  "targetTableId": "optional-table-id"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "createTemplate": {
      "success": true,
      "errors": [],
      "template": {
        "identifier": "test-template-001",
        "name": "TestHealthCheck",
        "query": "query TestHealthCheck { healthCheck { status database version } }"
      }
    }
  },
  "tool": "create-template",
  "executedAt": "2025-09-27T17:15:36.475Z"
}
```

### 2. Validate Template

**Endpoint**: `POST /api/mcp-tools/validate-template`

**Request Body**:
```json
{
  "query": "query TestQuery { healthCheck { status } }",
  "variables": {}
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "validateTemplateQuery": {
      "isValid": true,
      "errors": [],
      "parsedQuery": {
        "operationType": "query",
        "operationName": "TestQuery",
        "fieldCount": 2
      }
    }
  },
  "tool": "validate-template",
  "executedAt": "2025-09-27T17:15:28.419Z"
}
```

### 3. Update Template

**Endpoint**: `PUT /api/mcp-tools/update-template`

**Request Body**:
```json
{
  "identifier": "test-template-001",
  "name": "Updated Template Name",
  "query": "query UpdatedQuery { healthCheck { status database version timestamp } }",
  "description": "Updated description",
  "tags": ["updated", "health", "validation"]
}
```

### 4. Delete Template

**Endpoint**: `DELETE /api/mcp-tools/delete-template`

**Request Body**:
```json
{
  "identifier": "test-template-001",
  "force": false
}
```

### 5. Search Templates

**Endpoint**: `POST /api/mcp-tools/search-templates`

**Request Body**:
```json
{
  "query": "health",
  "tags": ["test", "validation"],
  "tableId": "optional-table-id",
  "operationType": "query",
  "limit": 50
}
```

**Note**: 현재 GraphQL 스키마 제한으로 일부 필터링 옵션이 제한될 수 있습니다.

### 6. Get Template Metadata

**Endpoint**: `GET /api/mcp-tools/get-template-metadata`

**Query Parameters**:
- `identifier`: 템플릿 식별자 (required)
- `includeUsageStats`: 사용 통계 포함 여부 (default: true)
- `includeDependencies`: 의존성 정보 포함 여부 (default: true)

**Example**: `GET /api/mcp-tools/get-template-metadata?identifier=test-template-001`

## 🔄 Template Execution

### Execute Template via GraphQL

**Endpoint**: `POST /graphql`

**Request Body**:
```json
{
  "query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"test-template-001\", variables: {}) { success data errors { message } } }"
}
```

**Response**:
```json
{
  "data": {
    "executeTemplateWithGraphQL": {
      "success": true,
      "data": {
        "success": true,
        "data": {
          "healthCheck": {
            "status": "OK",
            "database": true,
            "version": "1.0.0"
          }
        },
        "metadata": {
          "templateId": "285",
          "templateName": "TestHealthCheck",
          "complexityScore": 2,
          "estimatedTokens": 17,
          "version": "1.0.0",
          "executionTime": 7
        }
      },
      "errors": []
    }
  }
}
```

## 🔍 Schema Discovery for AI

### GraphQL Schema Introspection

**Endpoint**: `POST /graphql`

**Request Body**:
```json
{
  "query": "query { __schema { queryType { fields { name args { name type { name } } } } } }"
}
```

**AI 유용한 작업들**:
- `searchNodes`: 기본 노드 검색
- `searchNodesAdvanced`: 고급 검색 기능
- `nodesWithSorting`: 정렬 기능 포함
- `searchNodesByAttribute`: 속성 기반 검색
- `tableDocumentation`: AI 메타데이터 포함 테이블 문서화

### Get Available Templates

**Endpoint**: `POST /graphql`

**Request Body**:
```json
{
  "query": "query { searchTemplates { templates { identifier name query description tags } } }"
}
```

**Response**: 현재 10개 이상의 템플릿 사용 가능
- `table-documentation-full`
- `ai-suggested-search-template`
- `analyze-query-performance-with-params`
- `bulk-create-nodes-with-params`
- 등등...

## 📊 Legacy MCP Tools

### Bulk Import Templates

**Endpoint**: `POST /api/mcp-tools/bulk-import-templates`

**Request Body**:
```json
{
  "overwriteExisting": false,
  "generateNewIdentifier": false,
  "dryRun": false,
  "filter": [],
  "batchSize": 10
}
```

### List Available Templates

**Endpoint**: `GET /api/mcp-tools/list-available-templates`

**Response**: 파일 시스템 기반 템플릿 목록

### Get Import Status

**Endpoint**: `GET /api/mcp-tools/import-status`

**Response**: 가져오기 상태 및 요약

## 🔧 Error Handling

### Standard Error Response

```json
{
  "success": false,
  "error": "GraphQL error: Unknown type 'InvalidType'",
  "tool": "create-template"
}
```

### Validation Errors

```json
{
  "success": true,
  "data": {
    "validateTemplateQuery": {
      "isValid": false,
      "errors": ["Query must start with \"query\" or \"mutation\""],
      "parsedQuery": null
    }
  },
  "tool": "validate-template"
}
```

## 🎯 AI Integration Guide

### 1. Template Creation Workflow

```bash
# 1. 스키마 발견
POST /graphql
{
  "query": "{ __schema { queryType { fields { name } } } }"
}

# 2. 템플릿 검증
POST /api/mcp-tools/validate-template
{
  "query": "query { /* AI 생성 쿼리 */ }"
}

# 3. 템플릿 생성
POST /api/mcp-tools/create-template
{
  "identifier": "ai-generated-template",
  "query": "/* 검증된 쿼리 */",
  ...
}

# 4. 템플릿 실행
POST /graphql
{
  "query": "mutation { executeTemplateWithGraphQL(...) }"
}
```

### 2. Schema Discovery Pattern

```javascript
// AI가 사용할 수 있는 스키마 발견 패턴
const discoverSearchOperations = async () => {
  const introspectionQuery = `
    query {
      __schema {
        queryType {
          fields {
            name
            args {
              name
              type { name }
            }
          }
        }
      }
    }
  `;

  const response = await fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: introspectionQuery })
  });

  const { data } = await response.json();
  return data.__schema.queryType.fields.filter(field =>
    field.name.includes('search') || field.name.includes('nodes')
  );
};
```

## 📈 Performance Notes

- **Template Creation**: ~200ms (검증 포함)
- **Template Validation**: ~50ms (클라이언트 사이드)
- **Template Execution**: ~10ms (GraphQL 엔진 기반)
- **Schema Introspection**: ~100ms (캐시 가능)

## 🔐 Security Considerations

- 모든 GraphQL 쿼리는 스키마 검증을 거침
- 템플릿 생성 시 구문 및 타입 검증 수행
- 의존성 확인을 통한 안전한 템플릿 삭제
- Rate limiting 및 input validation 권장

---

**구현 상태**: ✅ 완료
**테스트 상태**: ✅ 모든 엔드포인트 검증 완료
**AI 통합**: ✅ 메타데이터 기반 템플릿 생성 지원

*Last Updated: 2025-09-27*
# Data Model: Nested MCP Server Architecture

## Core Entities

### TableMcpServer
**Purpose**: Represents a table-specific MCP server instance
**Lifecycle**: Created per HTTP request, stateless

```typescript
interface TableMcpServer {
  tableId: string
  tools: McpTool[]
  capabilities: McpCapabilities
}
```

**Validation Rules**:
- `tableId` must exist in database tables
- `tools` array populated from associated templates
- `capabilities` static for all table servers

**State Transitions**: None (stateless design)

### McpTool
**Purpose**: MCP tool representation of a database template
**Lifecycle**: Generated from template data on request

```typescript
interface McpTool {
  name: string          // template identifier
  description: string   // template description
  inputSchema: object   // JSON Schema from template
}
```

**Validation Rules**:
- `name` must be valid MCP tool identifier (alphanumeric + underscore)
- `description` required, max 500 characters
- `inputSchema` must be valid JSON Schema

**Relationships**:
- 1:1 with Template entity
- Belongs to TableMcpServer

### SchemaMapping
**Purpose**: Converts template parameter types to MCP inputSchema format
**Lifecycle**: Applied during tool generation

```typescript
interface SchemaMapping {
  sourceType: string
  targetType: string
  converter: (value: any) => any
}
```

**Validation Rules**:
- `sourceType` must match template parameter type
- `targetType` must be valid JSON Schema type
- `converter` function must handle null/undefined

**State Transitions**:
```
Template Parameter → Type Analysis → Schema Mapping → MCP InputSchema
```

### McpRequest
**Purpose**: Represents incoming MCP JSON-RPC request
**Lifecycle**: Request-scoped, immutable

```typescript
interface McpRequest {
  jsonrpc: "2.0"
  method: string
  params?: object
  id: string | number
}
```

**Validation Rules**:
- `jsonrpc` must be exactly "2.0"
- `method` must be supported MCP method
- `id` required for request tracking

### McpResponse
**Purpose**: Outgoing MCP JSON-RPC response
**Lifecycle**: Generated per request

```typescript
interface McpResponse {
  jsonrpc: "2.0"
  result?: any
  error?: McpError
  id: string | number
}
```

**Validation Rules**:
- Must include either `result` or `error`, not both
- `id` must match request `id`
- `error` must follow JSON-RPC error format

## Existing Entity Extensions

### Template (Extended)
**New Fields**: None required
**New Methods**:
- `toMcpTool()`: Convert to MCP tool format
- `validateMcpSchema()`: Ensure schema compatibility

### Table (Extended)
**New Fields**: None required
**New Methods**:
- `getMcpEndpoint()`: Return `/sub/{id}/mcp` URL
- `getAssociatedTemplates()`: Query templates for MCP tools

## Data Flow

### Tool Discovery Flow
```
1. Client → GET /sub/table-123/mcp (tools/list)
2. TableMcpServer.create(table-123)
3. Query templates WHERE table_id = 'table-123'
4. For each template → SchemaMapping.convert()
5. Generate McpTool instances
6. Return tools list response
```

### Tool Execution Flow
```
1. Client → POST /sub/table-123/mcp (tools/call)
2. Validate McpRequest format
3. Resolve tool name → Template
4. SchemaMapping.convertParams(request.params)
5. Execute template with converted parameters
6. Return McpResponse with results
```

## Schema Mappings

### SQLite to JSON Schema Type Mappings
```typescript
const TYPE_MAPPINGS: Record<string, SchemaMapping> = {
  'TEXT': {
    sourceType: 'TEXT',
    targetType: 'string',
    converter: (v) => String(v ?? '')
  },
  'INTEGER': {
    sourceType: 'INTEGER',
    targetType: 'number',
    converter: (v) => Number(v ?? 0)
  },
  'BOOLEAN': {
    sourceType: 'BOOLEAN',
    targetType: 'boolean',
    converter: (v) => Boolean(v)
  },
  'JSON': {
    sourceType: 'JSON',
    targetType: 'object',
    converter: (v) => JSON.parse(v ?? '{}')
  }
}
```

### Complex Type Handling
- **Arrays**: Convert to JSON Schema `array` type with `items` definition
- **Enums**: Extract from CHECK constraints → JSON Schema `enum`
- **Foreign Keys**: Convert to `string` with description referencing target table

## Error Handling

### Schema Conversion Errors
- Invalid template schema → Tool excluded from list with warning log
- Type mapping failure → Default to `string` type with description
- Circular references → Flatten to avoid infinite recursion

### Runtime Errors
- Table not found → HTTP 404, MCP error -32601 (method not found)
- Template execution failure → MCP error -32603 (internal error)
- Invalid parameters → MCP error -32602 (invalid params)

## Performance Considerations

### Query Optimization
- Template queries use existing database indexes
- Schema mappings cached at application startup
- No persistent state reduces memory usage

### Concurrency
- Stateless design enables concurrent table server access
- Database connection pooling handles multiple table endpoints
- Schema conversion operations are CPU-bound, minimal I/O
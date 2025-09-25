# Research: Nested MCP Server Architecture

## MCP JSON-RPC 2.0 Protocol Specification

**Decision**: Implement full MCP JSON-RPC 2.0 compliance with required endpoints
**Rationale**: MCP protocol requires specific endpoints and message formats for tool server interoperability
**Alternatives considered**: Custom protocol (rejected - breaks MCP ecosystem compatibility)

### Required Endpoints
- `initialize`: Server capability negotiation
- `tools/list`: Enumerate available tools (templates)
- `tools/call`: Execute specific tool with parameters

### Message Format
```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "params": {},
  "id": "request-id"
}
```

### Error Handling
- Standard JSON-RPC 2.0 error codes
- Method not found: -32601
- Invalid params: -32602
- Internal error: -32603

## Template Parameter to MCP inputSchema Mapping

**Decision**: Implement dynamic schema mapping with type conversion fallbacks
**Rationale**: Existing templates may use SQLite-specific types not directly compatible with JSON Schema
**Alternatives considered**: Force template schema changes (rejected - breaks existing system)

### Mapping Strategy
1. **Direct Compatible Types**:
   - `TEXT` → `string`
   - `INTEGER` → `number`
   - `BOOLEAN` → `boolean`

2. **Complex Type Handling**:
   - `JSON` columns → `object` with nested schema
   - `BLOB` → `string` with base64 encoding
   - Enum constraints → `enum` arrays

3. **Fallback Strategy**:
   - Unknown types → `string` with description
   - Complex nested objects → `object` with `additionalProperties: true`

### Template Schema Analysis
Current template storage includes:
- `inputSchema`: JSON column with parameter definitions
- `description`: Tool description text
- `tags`: Array of category tags

## Express.js Dynamic Route Patterns

**Decision**: Use Express parameterized routes with middleware-based MCP server instantiation
**Rationale**: Efficient routing with per-table isolation without performance overhead
**Alternatives considered**: Separate Express apps per table (rejected - resource intensive)

### Implementation Approach
```typescript
// Route pattern
app.use('/sub/:tableId/mcp', createMcpHandler)

// Middleware creates table-specific MCP context
function createMcpHandler(req: Request, res: Response, next: NextFunction) {
  const tableId = req.params.tableId
  const mcpServer = createTableMcpServer(tableId)
  // Handle MCP JSON-RPC requests
}
```

### Performance Considerations
- MCP server instances created per request (stateless)
- Template queries cached at application level
- No persistent connections needed for HTTP transport

## SQLite Template Query Optimization

**Decision**: Direct template queries with table association joins
**Rationale**: Existing database schema supports efficient template-table relationships
**Alternatives considered**: Template caching layer (deferred - measure first approach)

### Query Pattern
```sql
SELECT t.*, tp.inputSchema, tp.description
FROM templates t
JOIN template_table_associations tta ON t.id = tta.template_id
WHERE tta.table_id = ?
```

### Real-time Updates
- No caching layer initially (YAGNI principle)
- Direct database queries on each `tools/list` request
- Database connection reuse through existing pool

## Technology Integration Points

### Existing Infrastructure Reuse
- **Database Layer**: Use existing SQLite repository pattern
- **HTTP Server**: Extend existing Express.js application
- **Logging**: Integrate with existing structured logging
- **Error Handling**: Follow existing error response patterns

### New Components Required
- MCP JSON-RPC message parser/serializer
- Template-to-tool metadata converter
- Schema type mapping utilities
- Table-specific MCP server factory

## Performance Expectations

### Response Time Targets
- `tools/list`: < 50ms (database query + mapping)
- `tools/call`: < 200ms (template execution + response)
- `initialize`: < 10ms (static capability response)

### Scaling Considerations
- Support 100+ concurrent table MCP servers
- Handle 10-50 templates per table efficiently
- Memory usage: < 10MB per active table endpoint

## Risk Assessment

### Low Risk
- MCP protocol implementation (well-documented standard)
- Express.js routing (established patterns)
- SQLite query performance (existing optimization)

### Medium Risk
- Schema mapping complexity (may require iterative refinement)
- Template execution isolation (table context switching)

### High Risk
- None identified - extends existing stable components
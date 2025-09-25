# Quickstart: Nested MCP Server Architecture

## Prerequisites
- Existing Bun Graph Database with tables and templates
- At least one table with associated templates
- HTTP client capable of JSON-RPC requests (curl, Postman, MCP client)

## Quick Verification Steps

### Step 1: Discover Available Tables
```bash
# List all tables to find table IDs
curl -X POST http://localhost:4141/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { tables { nodes { id identifier } } }"}'
```

Expected: JSON response with table list including `id` and `identifier` fields.

### Step 2: Initialize MCP Connection to Table
```bash
# Replace 'table-123' with actual table ID
curl -X POST http://localhost:4141/sub/table-123/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "0.1.0",
      "capabilities": {}
    },
    "id": "init"
  }'
```

Expected response:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "protocolVersion": "0.1.0",
    "capabilities": {
      "tools": {}
    },
    "serverInfo": {
      "name": "bun-graph-db-mcp",
      "version": "0.1.0"
    }
  },
  "id": "init"
}
```

### Step 3: List Available Tools (Templates)
```bash
curl -X POST http://localhost:4141/sub/table-123/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": "list-tools"
  }'
```

Expected response:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "tools": [
      {
        "name": "create_user_record",
        "description": "Creates a new user record in the system",
        "inputSchema": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "description": "User's full name"
            },
            "email": {
              "type": "string",
              "format": "email",
              "description": "User's email address"
            }
          },
          "required": ["name", "email"]
        }
      }
    ]
  },
  "id": "list-tools"
}
```

### Step 4: Execute a Tool (Template)
```bash
curl -X POST http://localhost:4141/sub/table-123/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "create_user_record",
      "arguments": {
        "name": "John Doe",
        "email": "john.doe@example.com"
      }
    },
    "id": "call-tool"
  }'
```

Expected response:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "User record created successfully. ID: 456"
      }
    ]
  },
  "id": "call-tool"
}
```

## Validation Scenarios

### Scenario 1: Table Isolation
1. Access two different table MCP endpoints: `/sub/table-1/mcp` and `/sub/table-2/mcp`
2. Execute `tools/list` on both
3. Verify each returns only templates associated with that specific table
4. Tool names should be different or have different schemas

**Success Criteria**: No tool overlap between different table MCP servers

### Scenario 2: Schema Mapping
1. Find a template with complex parameter types (JSON, arrays, enums)
2. Call `tools/list` on its table MCP endpoint
3. Verify `inputSchema` contains valid JSON Schema format
4. Test tool execution with complex parameters

**Success Criteria**: All parameter types correctly mapped to JSON Schema equivalents

### Scenario 3: Error Handling
1. Call non-existent table: `curl http://localhost:4141/sub/invalid-table/mcp`
2. Call invalid method: `{"method": "invalid/method", ...}`
3. Call tool with missing required parameters

**Success Criteria**: Proper JSON-RPC error responses with appropriate codes

### Scenario 4: Concurrent Access
1. Open 3 terminal windows
2. Simultaneously execute `tools/list` on same table from all windows
3. Execute different tools concurrently
4. Verify all requests complete successfully

**Success Criteria**: No request failures, consistent responses across concurrent clients

## Troubleshooting

### "Table not found" Error
- Verify table ID exists: `SELECT id FROM tables WHERE id = 'your-table-id'`
- Check table has associated templates: `SELECT COUNT(*) FROM template_table_associations WHERE table_id = 'your-table-id'`

### Empty Tools List
- Verify templates exist for table: Query template associations
- Check template has valid `inputSchema`: Must be valid JSON
- Review server logs for schema mapping errors

### Tool Execution Failures
- Validate parameter types match `inputSchema`
- Check template syntax and variable binding
- Verify table context is properly set during execution

### Performance Issues
- Monitor database query performance for template retrieval
- Check for N+1 queries in template-table associations
- Review response times exceed expected thresholds (>100ms for tools/list)

## Next Steps After Validation

1. **Integration Testing**: Create automated test suite covering all scenarios
2. **Client Integration**: Connect MCP client library to table-specific endpoints
3. **Production Deployment**: Configure load balancing for multiple table endpoints
4. **Monitoring**: Set up metrics for MCP request/response times and error rates
5. **Documentation**: Generate API documentation from OpenAPI contract
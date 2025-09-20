# GraphQL-to-MCP Proxy Quick Start Guide

## Prerequisites
- Existing GraphQL server running on localhost:4000
- Bun runtime installed
- TypeScript support

## Installation

```bash
# Install MCP SDK dependency
bun add @modelcontextprotocol/sdk

# Verify GraphQL server is running
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { healthCheck { status } }"}'
```

## Starting the MCP Proxy Server

```bash
# Start MCP proxy alongside GraphQL server
bun run src/mcp/mcp-proxy-server.ts --port 4000 --graphql-endpoint http://localhost:4000/graphql

# Verify MCP server is responding
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
```

## Basic Usage Examples

### 1. Tool Discovery
```bash
# List all available MCP tools
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

**Expected Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "tools": [
      {
        "name": "healthCheck",
        "description": "Check system health and status",
        "inputSchema": {"type": "object", "properties": {}}
      },
      {
        "name": "createTable",
        "description": "Create a new table in the graph database",
        "inputSchema": {
          "type": "object",
          "properties": {
            "identifier": {"type": "string"},
            "name": {"type": "string"}
          },
          "required": ["identifier", "name"]
        }
      }
    ]
  },
  "id": 1
}
```

### 2. Execute Health Check Tool
```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "healthCheck",
      "arguments": {}
    },
    "id": 2
  }'
```

**Expected Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"healthCheck\":{\"status\":\"OK\",\"database\":\"connected\",\"version\":\"1.0.0\"}}"
      }
    ]
  },
  "id": 2
}
```

### 3. Create a Table
```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "createTable",
      "arguments": {
        "identifier": "test-table-001",
        "name": "Test Table",
        "description": "A test table created via MCP"
      }
    },
    "id": 3
  }'
```

### 4. Search for Tables
```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "searchTables",
      "arguments": {
        "searchTerm": "test",
        "limit": 5
      }
    },
    "id": 4
  }'
```

### 5. Execute Template with GraphQL
```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "executeTemplateWithGraphQL",
      "arguments": {
        "templateIdentifier": "system-health-check_v1-0-0",
        "variables": {}
      }
    },
    "id": 5
  }'
```

## Integration with MCP Clients

### Using with Claude Code
1. Add MCP server configuration to Claude Code settings
2. Configure server endpoint: `http://localhost:4000/mcp`
3. Tools will be automatically discovered and available for use

### Using with Custom MCP Client
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

// Connect to MCP proxy server
const transport = new SSEClientTransport(
  new URL("http://localhost:4000/mcp")
);

const client = new Client(
  {
    name: "my-mcp-client",
    version: "1.0.0",
  },
  {
    capabilities: {}
  }
);

await client.connect(transport);

// List available tools
const tools = await client.listTools();
console.log('Available tools:', tools);

// Execute a tool
const result = await client.callTool({
  name: "healthCheck",
  arguments: {}
});
console.log('Health check result:', result);
```

## Testing the Integration

### 1. GraphQL Server Health
```bash
# Verify GraphQL is working independently
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { systemStats { memory { used total } } }"}'
```

### 2. MCP Protocol Compliance
```bash
# Test MCP protocol negotiation
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    },
    "id": 1
  }'
```

### 3. Error Handling
```bash
# Test invalid tool call
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "nonexistent-tool",
      "arguments": {}
    },
    "id": 6
  }'
```

**Expected Error Response:**
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601,
    "message": "Tool not found",
    "data": {
      "toolName": "nonexistent-tool"
    }
  },
  "id": 6
}
```

## Troubleshooting

### MCP Server Not Responding
1. Check if GraphQL server is running on port 4000
2. Verify MCP proxy server started successfully
3. Check logs for any startup errors

### Tool Execution Failures
1. Verify tool parameters match the input schema
2. Check GraphQL server logs for query errors
3. Ensure GraphQL operations are valid

### Performance Issues
1. Monitor GraphQL query execution times
2. Check for concurrent connection limits
3. Review proxy overhead in execution logs

## Configuration Options

### Environment Variables
```bash
# Server configuration
export MCP_PROXY_PORT=4000
export GRAPHQL_ENDPOINT=http://localhost:4000/graphql
export MCP_LOG_LEVEL=info

# Start with custom configuration
bun run src/mcp/mcp-proxy-server.ts
```

### CLI Options
```bash
# Available command line options
bun run src/mcp/mcp-proxy-server.ts --help

Options:
  --port <number>              MCP server port (default: 4000)
  --graphql-endpoint <url>     GraphQL endpoint URL
  --log-level <level>          Logging level (debug, info, warn, error)
  --max-connections <number>   Maximum concurrent connections
  --timeout <ms>               Request timeout in milliseconds
```

This quickstart guide provides a complete walkthrough for setting up and testing the MCP-GraphQL proxy server integration.
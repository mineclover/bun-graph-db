# MCP (Model Context Protocol) Server

## Overview
This directory contains the MCP server implementation for the Bun Graph Database project, fully compliant with the **MCP 2025-06-18 specification**.

## MCP HTTP Server
The HTTP server implementation provides a JSON-RPC 2.0 interface over HTTP that exposes GraphQL operations as MCP tools.

### Features
- ✅ **Full MCP 2025-06-18 Compliance**: Implements official specification
- 🔄 **Protocol Version Negotiation**: Supports 2025-06-18 and 2024-11-05
- 🔧 **Tool Registry**: Automatically loads tools from GraphQL contract
- 🌐 **HTTP Transport**: JSON-RPC 2.0 over HTTP with proper security
- 🚫 **Authentication-free**: No authentication required for tool execution
- 🛡️ **Security**: Origin validation and DNS rebinding protection
- ⚡ **Direct Execution**: Tools execute GraphQL operations directly

### Usage

#### Claude MCP Client Connection
```bash
claude mcp add --transport http graphdb http://localhost:4000/mcp
```

#### Manual HTTP Testing

**Initialize connection** (required first step):
```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {
        "roots": { "listChanged": true }
      },
      "clientInfo": {
        "name": "claude-code",
        "version": "1.0.0"
      }
    }
  }'
```

**Send initialized notification**:
```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialized"
  }'
```

**List available tools**:
```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -d '{
    "jsonrpc": "2.0",
    "id": "2",
    "method": "tools/list"
  }'
```

**Call a tool**:
```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -d '{
    "jsonrpc": "2.0",
    "id": "3",
    "method": "tools/call",
    "params": {
      "name": "healthCheck",
      "arguments": {}
    }
  }'
```

**Server discovery** (GET request):
```bash
curl -X GET http://localhost:4000/mcp \
  -H "Accept: application/json"
```

## Available Tools (12 tools)
The MCP server exposes all GraphQL operations as tools:

| Tool Name | Description | Input Schema |
|-----------|-------------|--------------|
| `healthCheck` | System health status | `{}` |
| `systemStats` | Performance metrics | `{}` |
| `createTable` | Create database tables | `{identifier, name, description?}` |
| `searchTables` | Search existing tables | `{searchTerm?, limit?}` |
| `createNode` | Add nodes to tables | `{tableId, content, metadata?}` |
| `searchNodes` | Find nodes by criteria | `{tableId, searchTerm?, limit?}` |
| `createRelation` | Create relationships | `{fromNodeId, toNodeId, relationshipType, properties?}` |
| `createTemplate` | Define query templates | `{identifier, name, query, tags?}` |
| `executeTemplateWithGraphQL` | Run parameterized queries | `{templateIdentifier, variables?}` |
| `searchTemplates` | Find templates | `{searchTerm?, tags?}` |
| `exportSchema` | Export database schema | `{format?, includeData?}` |
| `importSchema` | Import schema data | `{schemaData, format?, mergeStrategy?}` |

## Protocol Compliance

### MCP Lifecycle Implementation
1. **Initialize**: Client sends `initialize` request with protocol version and capabilities
2. **Initialized**: Client sends `initialized` notification
3. **Operation**: Normal tool calls and responses
4. **Shutdown**: Connection termination

### Transport Security Features
- **Origin Validation**: Prevents DNS rebinding attacks
- **Protocol Version Headers**: `MCP-Protocol-Version` header support
- **Proper HTTP Methods**: POST for JSON-RPC, GET for discovery
- **Error Handling**: Standard JSON-RPC 2.0 error codes

### Supported Protocol Versions
- **2025-06-18** (primary): Latest MCP specification
- **2024-11-05** (compatible): Backward compatibility for older clients

## Architecture
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

## Implementation Details

### Protocol Specification Compliance
- **Transport**: [MCP HTTP Transport Spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- **Lifecycle**: [MCP Lifecycle Spec](http://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle)
- **JSON-RPC 2.0**: Complete implementation with proper error handling
- **Security**: Origin validation and rebinding protection

### Key Features
- **Auto-Discovery**: Tools loaded automatically from GraphQL contract
- **Direct GraphQL Execution**: No template system overhead for tool calls
- **Error Handling**: Comprehensive error responses with proper codes
- **Version Negotiation**: Dynamic protocol version selection
- **Performance**: Optimized for speed and reliability

### Testing Status
✅ **Initialize request** - Protocol negotiation working
✅ **Tools/list request** - All 12 tools discovered
✅ **Tools/call request** - Direct GraphQL execution
✅ **Protocol version negotiation** - 2025-06-18 and 2024-11-05
✅ **Security headers** - Origin validation implemented
✅ **Error handling** - Proper JSON-RPC 2.0 responses

## 🔗 Endpoints

- **MCP Protocol**: `http://localhost:4000/mcp`
- **GraphQL API**: `http://localhost:4000/graphql`
- **GraphQL Playground**: `http://localhost:4000/graphql` (GET)

---

**Built with the official MCP 2025-06-18 specification**
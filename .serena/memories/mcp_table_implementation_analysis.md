# MCP Table Implementation Analysis

## Current State Analysis

### Existing MCP Infrastructure ✅
- **McpHttpServer**: Complete JSON-RPC 2.0 compliant MCP server at `/src/mcp/http-server/McpHttpServer.ts`
- **McpToolRegistry**: Tool discovery and registration system at `/src/application/services/McpToolRegistry.ts`  
- **REST API Client**: Bridge between MCP and GraphQL at `/src/application/services/RestApiClient.ts`
- **Express Routes**: Existing API routes structure in `/src/presentation/http/routes/`

### Architecture Patterns Found
- **Domain-driven design** with clear separation: domain, application, infrastructure, presentation
- **Dependency injection** container system in `/src/infrastructure/container/`
- **GraphQL-first** approach with comprehensive schema system
- **Repository pattern** for data access with SQLite implementations

## Key Requirements for 007-MCP-Table Feature

### Goal: Table-specific MCP endpoints exposing templates as discoverable tools
- **Route Pattern**: `/sub/:tableId/mcp` - Each table gets its own MCP endpoint
- **Template-to-Tool**: Convert table's templates into MCP tool definitions  
- **Table Isolation**: Different tables return different tool sets
- **Schema Mapping**: Template inputSchema → MCP-compatible format

### Technical Specifications
1. **Contract Tests First**: JSON-RPC 2.0 compliance validation
2. **Schema Mapping**: SQLite types → JSON Schema conversion utilities
3. **Factory Pattern**: TableMcpServerFactory creates table-specific servers
4. **Express Integration**: New routes handling `/sub/:tableId/mcp` pattern
5. **End-to-end Testing**: Real database queries and template execution

## Implementation Strategy

### Phase 1: Extend Existing vs Build New
**Decision: EXTEND existing MCP infrastructure** ✅
- Reuse McpHttpServer as base class
- Extend McpToolRegistry for table-specific tools  
- Add new routes to existing Express setup
- Leverage existing GraphQL execution engine

### Phase 2: Architecture Approach
**Table-specific MCP Server Instances**:
```
/sub/table123/mcp → TableMcpServer(tableId: "table123")
/sub/table456/mcp → TableMcpServer(tableId: "table456")  
```

Each TableMcpServer:
- Inherits from base McpHttpServer
- Loads templates specific to that table
- Converts templates to MCP tools
- Handles tools/list and tools/call for table context

### Phase 3: Key Components to Build
1. **SchemaMapper**: Template inputSchema → MCP schema conversion
2. **TableMcpServer**: Table-specific MCP server extending base
3. **TableMcpServerFactory**: Creates servers for table IDs  
4. **MCP Routes**: Express routes for `/sub/:tableId/mcp` pattern
5. **Integration Tests**: End-to-end validation

## Risk Assessment: LOW ✅

### Advantages of Existing Infrastructure
- **JSON-RPC compliance**: Already implemented and tested
- **Tool registry system**: Extensible for table-specific tools
- **GraphQL execution**: Template execution engine exists
- **Express integration**: Route patterns established
- **Domain architecture**: Clear patterns for new features

### Implementation Complexity: MODERATE
- **Estimated effort**: 5-7 hours as specified in tasks.md
- **28 tasks**: Well-structured TDD approach
- **Parallel opportunities**: Contract tests, schema mapping can run in parallel
- **Risk mitigation**: TDD approach with rollback points

## Next Steps
1. Examine Express routing patterns
2. Design TableMcpServer architecture  
3. Start with Phase 1 contract tests
4. Implement schema mapping utilities
5. Build factory and integration layer
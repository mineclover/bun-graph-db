# Implementation Tasks: Nested MCP Server Architecture

**Feature**: Table-specific MCP endpoints exposing templates as discoverable tools
**TDD Order**: Contract Tests → Integration Tests → Unit Tests → Implementation
**Estimated Tasks**: 28 total (5-7 hours implementation time)

## Phase 1: Contract Testing & Protocol Compliance [P]

### 1. MCP Protocol Contract Test Foundation
- **Deliverable**: `tests/contract/mcp-protocol-compliance.test.ts`
- **Acceptance**: Validate JSON-RPC 2.0 compliance for initialize, tools/list, tools/call methods
- **Dependencies**: None
- **Parallel**: Can run with task 2

### 2. MCP Request/Response Schema Validation
- **Deliverable**: Contract tests for request/response format validation
- **Acceptance**: All MCP message formats match OpenAPI specification exactly
- **Dependencies**: None
- **Parallel**: Can run with task 1

### 3. HTTP Route Contract Validation
- **Deliverable**: Contract tests for `/sub/:tableId/mcp` endpoint pattern
- **Acceptance**: Route accepts valid table IDs, rejects invalid patterns
- **Dependencies**: None
- **Parallel**: Can run with tasks 1-2

### 4. Error Response Contract Tests
- **Deliverable**: JSON-RPC error code compliance validation
- **Acceptance**: Proper error codes (-32601, -32602, -32603) for different failure scenarios
- **Dependencies**: None
- **Parallel**: Can run with tasks 1-3

### 5. Table Isolation Contract Tests
- **Deliverable**: Verify different tables return different tool sets
- **Acceptance**: `/sub/table1/mcp` and `/sub/table2/mcp` return isolated tool lists
- **Dependencies**: None
- **Parallel**: Can run with tasks 1-4

## Phase 2: Schema Mapping System [P]

### 6. Schema Type Mapping Utilities - Unit Tests
- **Deliverable**: `tests/unit/schema/schema-mapping.test.ts`
- **Acceptance**: Test type conversions (TEXT→string, INTEGER→number, JSON→object)
- **Dependencies**: None
- **Parallel**: Can run with Phase 1 tasks

### 7. Complex Type Handling Tests
- **Deliverable**: Unit tests for arrays, enums, foreign keys mapping
- **Acceptance**: All complex SQLite types map correctly to JSON Schema
- **Dependencies**: Task 6
- **Sequential**: Must complete after task 6

### 8. Schema Mapping Utilities Implementation
- **Deliverable**: `src/presentation/mcp/schema/SchemaMapper.ts`
- **Acceptance**: Converts template inputSchema to MCP-compatible format
- **Dependencies**: Tasks 6-7 (RED phase complete)
- **Sequential**: Implements after tests written

### 9. Schema Conversion Error Handling
- **Deliverable**: Fallback mechanisms for unsupported types
- **Acceptance**: Unknown types default to string with description, circular refs handled
- **Dependencies**: Task 8
- **Sequential**: Enhancement to core mapping

### 10. Schema Mapping Integration Tests
- **Deliverable**: `tests/integration/schema-mapping-integration.test.ts`
- **Acceptance**: End-to-end template parameter → MCP inputSchema conversion
- **Dependencies**: Task 8
- **Sequential**: Integration test after implementation

## Phase 3: MCP Server Factory System

### 11. TableMcpServer Unit Tests
- **Deliverable**: `tests/unit/mcp/table-mcp-server.test.ts`
- **Acceptance**: Test server instantiation, tool generation, capability reporting
- **Dependencies**: Task 8 (schema mapping available)
- **Sequential**: Needs schema mapping for tool generation

### 12. Template-to-Tool Conversion Tests
- **Deliverable**: Unit tests for template → McpTool transformation
- **Acceptance**: Template metadata correctly maps to MCP tool format
- **Dependencies**: Task 11
- **Sequential**: Core conversion logic testing

### 13. MCP Server Factory Implementation
- **Deliverable**: `src/presentation/mcp/factory/TableMcpServerFactory.ts`
- **Acceptance**: Creates table-specific MCP server instances with proper tool lists
- **Dependencies**: Tasks 11-12 (RED phase complete)
- **Sequential**: Implements after comprehensive testing

### 14. Tool Execution Engine
- **Deliverable**: MCP tool call → template execution bridge
- **Acceptance**: tools/call requests execute corresponding templates with parameter mapping
- **Dependencies**: Task 13
- **Sequential**: Core execution logic

### 15. Server Factory Integration Tests
- **Deliverable**: `tests/integration/mcp-server-factory.test.ts`
- **Acceptance**: Factory creates working MCP servers for different tables
- **Dependencies**: Tasks 13-14
- **Sequential**: End-to-end factory validation

## Phase 4: Express HTTP Integration

### 16. MCP HTTP Handler Unit Tests
- **Deliverable**: `tests/unit/mcp/mcp-http-handler.test.ts`
- **Acceptance**: HTTP request parsing, JSON-RPC processing, response formatting
- **Dependencies**: Task 13 (server factory available)
- **Sequential**: Needs server factory for request handling

### 17. Route Parameter Validation Tests
- **Deliverable**: Table ID validation and error handling tests
- **Acceptance**: Valid table IDs accepted, invalid IDs return 404 with proper MCP error
- **Dependencies**: Task 16
- **Sequential**: Parameter handling testing

### 18. Express Route Integration Implementation
- **Deliverable**: `src/presentation/mcp/routes/mcp-routes.ts`
- **Acceptance**: `/sub/:tableId/mcp` route handles all MCP methods correctly
- **Dependencies**: Tasks 16-17 (RED phase complete)
- **Sequential**: Route implementation after thorough testing

### 19. Middleware Integration
- **Deliverable**: Request logging, error handling, CORS middleware
- **Acceptance**: Proper request/response logging, error context preservation
- **Dependencies**: Task 18
- **Sequential**: Middleware enhancement

### 20. HTTP Integration Tests
- **Deliverable**: `tests/integration/mcp-http-integration.test.ts`
- **Acceptance**: Full HTTP request/response cycle for all MCP methods
- **Dependencies**: Tasks 18-19
- **Sequential**: Complete HTTP stack testing

## Phase 5: End-to-End Integration & Validation

### 21. Database Integration Tests
- **Deliverable**: `tests/integration/mcp-database-integration.test.ts`
- **Acceptance**: Real SQLite queries, template retrieval, table associations
- **Dependencies**: Task 20
- **Sequential**: Database layer integration

### 22. Concurrent Access Tests
- **Deliverable**: Multi-client MCP server access validation
- **Acceptance**: Multiple simultaneous requests to same/different table endpoints
- **Dependencies**: Task 21
- **Sequential**: Concurrency validation

### 23. Quickstart Scenario Validation
- **Deliverable**: Automated tests for all quickstart.md scenarios
- **Acceptance**: Table isolation, schema mapping, error handling, concurrent access
- **Dependencies**: Task 22
- **Sequential**: Complete scenario coverage

### 24. Performance Benchmark Tests
- **Deliverable**: Response time validation (<50ms tools/list, <200ms tools/call)
- **Acceptance**: All performance targets met under load
- **Dependencies**: Task 23
- **Sequential**: Performance validation

## Phase 6: System Integration & Documentation

### 25. Main Application Integration
- **Deliverable**: Integrate MCP routes into existing Express application
- **Acceptance**: MCP endpoints available alongside GraphQL without conflicts
- **Dependencies**: Task 24
- **Sequential**: Final system integration

### 26. Logging and Monitoring Integration
- **Deliverable**: Structured logging for MCP requests, error context
- **Acceptance**: All MCP operations logged with proper context and error details
- **Dependencies**: Task 25
- **Sequential**: Operational observability

### 27. Error Recovery and Resilience
- **Deliverable**: Graceful handling of database errors, template failures
- **Acceptance**: System remains stable under error conditions, proper error responses
- **Dependencies**: Task 26
- **Sequential**: System hardening

### 28. Final Validation and Documentation
- **Deliverable**: Complete system test, update CLAUDE.md with MCP endpoints
- **Acceptance**: All quickstart scenarios work, documentation reflects new capabilities
- **Dependencies**: Task 27
- **Sequential**: Final validation and documentation

## Dependency Graph Summary

**Phase 1 (Tasks 1-5)**: All parallel, no dependencies
**Phase 2 (Tasks 6-10)**: 6→7→8→9,10 (linear for core, parallel for integration)
**Phase 3 (Tasks 11-15)**: 8→11→12→13→14,15 (depends on schema mapping)
**Phase 4 (Tasks 16-20)**: 13→16→17→18→19,20 (depends on server factory)
**Phase 5 (Tasks 21-24)**: 20→21→22→23→24 (linear integration chain)
**Phase 6 (Tasks 25-28)**: 24→25→26→27→28 (final system integration)

## Parallel Execution Opportunities [P]

- **Phase 1**: Tasks 1-5 (all contract tests)
- **Schema + Contracts**: Tasks 6-7 can run parallel with Phase 1
- **Implementation Verification**: Tasks 9,10,14,15,19,20 (integration tests after implementation)

## Risk Mitigation

- **TDD Compliance**: Every implementation task has corresponding test tasks completed first
- **Incremental Integration**: Each phase builds on validated previous phase
- **Rollback Points**: Git commits after each phase for safe rollback
- **Quality Gates**: All tests must pass before proceeding to next phase
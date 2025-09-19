# Tasks: GraphQL Server MCP Integration (MCP 2025-06-18 + Streamable HTTP)

**Input**: Design documents from `/specs/005-graphql-mcp-utils/`
**Prerequisites**: implementation-plan.md, spec.md, existing GraphQL server
**MCP Version**: 2025-06-18 Specification with JSON-RPC 2.0, consent framework, and **Streamable HTTP** (SSE deprecated)

## Critical Update: SSE Deprecated in MCP 2025

**MCP officially deprecated Server-Sent Events (SSE) and moved to Streamable HTTP**:
- **Timeline**: MCP Specification updated March 26, 2025
- **First SDK**: TypeScript SDK v1.10.0 (April 17, 2025)
- **Reason**: SSE limitations - complex connection management, scalability issues, two separate endpoints
- **Replacement**: Streamable HTTP - single endpoint, dynamic upgrades, true bidirectional communication

## Key MCP 2025-06-18 Requirements (Updated)
- **JSON-RPC 2.0** communication protocol
- **Streamable HTTP** as primary transport (replaces SSE)
- **Explicit user consent** for all data access and operations
- **Capability negotiation** during server initialization
- **Security and trust mechanisms** for tool execution
- **Privacy controls** and data access authorization
- **Elicitation feature** support for enhanced interaction

## Phase 3.1: Setup (MCP 2025-06-18 Specification)
- [ ] T001 Create MCP server directory structure in src/mcp/
- [ ] T002 Install MCP protocol dependencies (@modelcontextprotocol/sdk v1.10.0+)
- [ ] T003 [P] Configure TypeScript types for MCP 2025-06-18 in src/mcp/types/McpTypes.ts
- [ ] T004 [P] Create MCP server configuration with capability negotiation in src/mcp/config/McpConfig.ts
- [ ] T005 [P] Implement JSON-RPC 2.0 message handler in src/mcp/transport/JsonRpcHandler.ts
- [ ] T006 [P] Create user consent and authorization framework in src/mcp/security/ConsentManager.ts

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T007 [P] MCP health check tool test with consent validation in tests/mcp/tools/test-health-check-tool.test.ts
- [ ] T008 [P] MCP template execution tool test with user authorization in tests/mcp/tools/test-template-execution-tool.test.ts
- [ ] T009 [P] MCP node search tool test with privacy controls in tests/mcp/tools/test-node-search-tool.test.ts
- [ ] T010 [P] MCP table query tool test with data access consent in tests/mcp/tools/test-table-query-tool.test.ts
- [ ] T011 [P] MCP GraphQL adapter test with JSON-RPC 2.0 compliance in tests/mcp/adapters/test-graphql-mcp-adapter.test.ts
- [ ] T012 [P] MCP server integration test with capability negotiation in tests/mcp/integration/test-mcp-server-integration.test.ts
- [ ] T013 [P] MCP consent manager test in tests/mcp/security/test-consent-manager.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [ ] T014 [P] MCP server base class with capability negotiation in src/mcp/server/McpServer.ts
- [ ] T015 [P] MCP tool registry with consent validation in src/mcp/server/McpToolRegistry.ts
- [ ] T016 [P] MCP resource registry with privacy controls in src/mcp/server/McpResourceRegistry.ts
- [ ] T017 [P] GraphQL to MCP adapter with JSON-RPC 2.0 compliance in src/mcp/adapters/GraphQLMcpAdapter.ts
- [ ] T018 [P] Health check MCP tool with explicit consent in src/mcp/tools/query-tools/HealthCheckTool.ts
- [ ] T019 [P] Node search MCP tool with data access authorization in src/mcp/tools/query-tools/NodeSearchTool.ts
- [ ] T020 [P] Table query MCP tool with user consent validation in src/mcp/tools/query-tools/TableQueryTool.ts
- [ ] T021 [P] Template search MCP tool with privacy protection in src/mcp/tools/query-tools/TemplateSearchTool.ts
- [ ] T022 [P] Template execution MCP tool with user authorization in src/mcp/tools/mutation-tools/TemplateExecutionTool.ts
- [ ] T023 [P] Node create MCP tool with consent management in src/mcp/tools/mutation-tools/NodeCreateTool.ts
- [ ] T024 [P] Node update MCP tool with data modification consent in src/mcp/tools/mutation-tools/NodeUpdateTool.ts
- [ ] T025 [P] Table create MCP tool with schema modification authorization in src/mcp/tools/mutation-tools/TableCreateTool.ts

## Phase 3.4: Template Tools (executeTemplate.ts integration with MCP 2025-06-18)
- [ ] T026 [P] Template executor wrapper with consent validation in src/mcp/tools/template-tools/TemplateExecutorWrapper.ts
- [ ] T027 [P] Bulk operations tool with batch authorization in src/mcp/tools/template-tools/BulkOperationsTool.ts
- [ ] T028 [P] Template statistics tool with privacy controls in src/mcp/tools/template-tools/TemplateStatsTool.ts

## Phase 3.5: MCP Resources with Streamable HTTP (2025 Standards)
- [ ] T029 [P] Subscription resource base with consent management and Streamable HTTP support in src/mcp/resources/subscription-resources/SubscriptionResourceBase.ts
- [ ] T030 [P] Template execution subscription with user authorization and bidirectional streaming in src/mcp/resources/subscription-resources/TemplateExecutionSubscription.ts
- [ ] T031 [P] System monitoring subscription with privacy controls and real-time streaming in src/mcp/resources/subscription-resources/SystemMonitoringSubscription.ts
- [ ] T032 [P] Data resource base with access controls and Streamable HTTP support in src/mcp/resources/data-resources/DataResourceBase.ts
- [ ] T033 [P] GraphQL schema resource with metadata filtering and streaming updates in src/mcp/resources/data-resources/GraphQLSchemaResource.ts
- [ ] T034 [P] System health resource with sensitive data protection and streaming metrics in src/mcp/resources/data-resources/SystemHealthResource.ts

## Phase 3.5a: Modern Streaming Infrastructure (MCP 2025 Streamable HTTP)
- [ ] T035 [P] Streamable HTTP transport (replaces deprecated SSE) in src/mcp/streaming/StreamableHttpTransport.ts
- [ ] T036 [P] WebSocket streaming manager with fallback logic in src/mcp/streaming/WebSocketManager.ts
- [ ] T037 [P] Unified streaming transport abstraction layer in src/mcp/streaming/StreamingTransport.ts
- [ ] T038 [P] Real-time event dispatcher with consent validation in src/mcp/streaming/EventDispatcher.ts
- [ ] T039 [P] Stream compression and optimization utilities in src/mcp/streaming/StreamOptimizer.ts
- [ ] T040 [P] SSE legacy support for backward compatibility in src/mcp/streaming/SseLegacyHandler.ts

## Phase 3.6: Integration (JSON-RPC 2.0 & Streamable HTTP)
- [ ] T041 Connect MCP server to existing GraphQL server with Streamable HTTP capability negotiation in src/mcp/server/McpServer.ts
- [ ] T042 Error handling and MCP error translation with Streamable HTTP error recovery in src/mcp/adapters/GraphQLMcpAdapter.ts
- [ ] T043 MCP server lifecycle management with unified streaming connection cleanup in src/mcp/server/McpServer.ts
- [ ] T044 MCP tool parameter validation with streaming consent verification in src/mcp/adapters/GraphQLMcpAdapter.ts
- [ ] T045 Implement progress tracking and cancellation for Streamable HTTP operations in src/mcp/server/McpServer.ts

## Phase 3.7: Advanced Features (Security, Performance & Streamable HTTP)
- [ ] T046 [P] Relation query MCP tool with streaming traversal authorization in src/mcp/tools/query-tools/RelationQueryTool.ts
- [ ] T047 [P] Template management MCP tool with real-time modification consent in src/mcp/tools/mutation-tools/TemplateManagementTool.ts
- [ ] T048 [P] Performance monitoring resource with streaming metrics privacy in src/mcp/resources/data-resources/PerformanceMetricsResource.ts
- [ ] T049 MCP caching layer with streaming-aware cache invalidation in src/mcp/adapters/GraphQLMcpAdapter.ts
- [ ] T050 Rate limiting for MCP tools with streaming-aware quotas in src/mcp/server/McpServer.ts
- [ ] T051 [P] Elicitation feature support with streaming interaction patterns in src/mcp/features/ElicitationHandler.ts
- [ ] T052 [P] WebTransport future-proofing layer for HTTP/3 support in src/mcp/streaming/WebTransportLayer.ts

## Phase 3.8: Streaming Tests & Validation
- [ ] T053 [P] Streamable HTTP tests with connection upgrade scenarios in tests/mcp/streaming/test-streamable-http.test.ts
- [ ] T054 [P] WebSocket streaming tests with fallback validation in tests/mcp/streaming/test-websocket-streaming.test.ts
- [ ] T055 [P] Streaming performance tests with latency measurements in tests/mcp/streaming/test-streaming-performance.test.ts
- [ ] T056 [P] Stream security tests with consent validation in tests/mcp/streaming/test-stream-security.test.ts
- [ ] T057 [P] SSE legacy compatibility tests in tests/mcp/streaming/test-sse-legacy.test.ts

## Phase 3.9: Polish & Documentation (Streamable HTTP Enhanced)
- [ ] T058 [P] Unit tests for MCP utilities with streaming validation in tests/mcp/unit/test-mcp-utilities.test.ts
- [ ] T059 [P] Performance tests (<25ms Streamable HTTP latency) with consent overhead in tests/mcp/performance/test-mcp-performance.test.ts
- [ ] T060 [P] MCP API documentation with Streamable HTTP guidelines in docs/mcp/mcp-api-reference.md
- [ ] T061 [P] MCP Streamable HTTP usage examples with real-time workflows in docs/mcp/mcp-streamable-http-examples.md
- [ ] T062 [P] Security best practices for Streamable HTTP in docs/mcp/mcp-streamable-http-security.md
- [ ] T063 [P] SSE deprecation and migration guide in docs/mcp/mcp-sse-migration-guide.md
- [ ] T064 Integration with existing CLI tools and Streamable HTTP support in src/mcp/cli/McpCliCommands.ts
- [ ] T065 MCP server startup script with Streamable HTTP configuration validation in scripts/start-mcp-server.ts

## Dependencies (Updated for MCP 2025-06-18 with Streamable HTTP)
- Setup (T001-T006) before tests (T007-T013)
- Tests (T007-T013) before implementation (T014-T028)
- Core MCP server (T014-T016) blocks tool implementation (T018-T025)
- Consent manager (T006) blocks all tools and resources requiring authorization
- Adapter (T017) blocks all tools and resources
- Template tools (T026-T028) require template executor wrapper (T026)
- Resources (T029-T034) require resource bases (T029, T032)
- Streamable HTTP infrastructure (T035-T040) requires resources implementation complete
- Integration (T041-T045) requires Streamable HTTP infrastructure complete
- Advanced features (T046-T052) require integration complete
- Streaming tests (T053-T057) require streaming features complete
- Polish (T058-T065) requires all implementation complete

## Parallel Example (MCP 2025-06-18 with Streamable HTTP)
```
# Phase 3.5a - Launch T035-T040 together (Streamable HTTP infrastructure):
Task: "Streamable HTTP transport (replaces deprecated SSE) in src/mcp/streaming/StreamableHttpTransport.ts"
Task: "WebSocket streaming manager with fallback logic in src/mcp/streaming/WebSocketManager.ts"
Task: "Unified streaming transport abstraction layer in src/mcp/streaming/StreamingTransport.ts"
Task: "Real-time event dispatcher with consent validation in src/mcp/streaming/EventDispatcher.ts"
Task: "Stream compression and optimization utilities in src/mcp/streaming/StreamOptimizer.ts"
Task: "SSE legacy support for backward compatibility in src/mcp/streaming/SseLegacyHandler.ts"

# Phase 3.8 - Launch T053-T057 together (streaming tests):
Task: "Streamable HTTP tests with connection upgrade scenarios in tests/mcp/streaming/test-streamable-http.test.ts"
Task: "WebSocket streaming tests with fallback validation in tests/mcp/streaming/test-websocket-streaming.test.ts"
Task: "Streaming performance tests with latency measurements in tests/mcp/streaming/test-streaming-performance.test.ts"
Task: "Stream security tests with consent validation in tests/mcp/streaming/test-stream-security.test.ts"
Task: "SSE legacy compatibility tests in tests/mcp/streaming/test-sse-legacy.test.ts"
```

## MCP 2025-06-18 Compliance Notes (with Streamable HTTP)
- **Explicit consent**: All tools require user authorization before execution
- **JSON-RPC 2.0**: Strict compliance with message format and error handling
- **Capability negotiation**: Server declares available features during initialization including streaming capabilities
- **Privacy first**: Data access requires explicit permission and audit logging, extended to streaming data
- **Security boundaries**: Clear separation between trusted and untrusted operations in both request/response and streaming contexts
- **Elicitation support**: Enhanced interaction patterns for better user experience, including real-time feedback
- **Streamable HTTP Standards (2025 MCP Standard)**:
  - **Streamable HTTP**: Primary streaming method replacing deprecated SSE
  - **Single Endpoint**: Unified communication eliminating SSE's two-endpoint complexity
  - **Dynamic Upgrades**: Connection can upgrade from simple to streaming
  - **True Bidirectional**: Native bidirectional communication without SSE limitations
  - **WebSocket Fallback**: Graceful fallback for unsupported environments
  - **Performance Target**: <25ms latency for real-time operations (improved from SSE)
  - **Legacy Support**: Backward compatibility with SSE for existing implementations

## Task Generation Rules (MCP 2025-06-18 Updated with Streamable HTTP)
1. **Security First**: Every tool and resource includes consent validation
2. **Privacy Controls**: Data access requires explicit user authorization
3. **JSON-RPC 2.0**: All communication follows strict protocol compliance
4. **Streamable HTTP**: Primary transport with SSE legacy support
5. **Capability Declaration**: Server exposes available features transparently
6. **Error Handling**: Detailed error reporting with security considerations
7. **Performance**: Streamable HTTP should achieve <25ms latency targets

## Validation Checklist (MCP 2025-06-18 with Streamable HTTP)
- [x] All MCP tools include consent validation mechanisms
- [x] JSON-RPC 2.0 compliance throughout the system
- [x] Capability negotiation implemented in server initialization
- [x] Privacy controls for all data access operations
- [x] Security boundaries clearly defined and enforced
- [x] Elicitation feature support included
- [x] Streamable HTTP as primary transport (SSE deprecated)
- [x] SSE legacy support for backward compatibility
- [x] executeTemplate.ts integration preserved with consent wrapper
- [x] All GraphQL operations have secure MCP tool equivalents
- [x] Migration path from SSE to Streamable HTTP documented
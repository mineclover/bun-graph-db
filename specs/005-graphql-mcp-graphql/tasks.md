# Tasks: GraphQL-to-MCP Proxy Server

**Input**: Design documents from `/specs/005-graphql-mcp-graphql/`
**Prerequisites**: plan.md (✓), research.md (✓), data-model.md (✓), contracts/ (✓)
**Tech Stack**: TypeScript/Bun, @modelcontextprotocol/sdk, existing GraphQL infrastructure
**Structure**: Single project (src/, tests/ at repository root)

## Path Conventions
- **Models**: `src/models/`
- **Services**: `src/services/`
- **MCP Components**: `src/mcp/`
- **Contract Tests**: `tests/contract/`
- **Integration Tests**: `tests/integration/`
- **Unit Tests**: `tests/unit/`

## Phase 3.1: Setup
- [ ] T001 Install @modelcontextprotocol/sdk dependency for MCP protocol implementation
- [ ] T002 [P] Configure TypeScript compiler options for MCP server compatibility
- [ ] T003 [P] Set up test structure with tests/contract/, tests/integration/, tests/unit/

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests [P] - Different files, can run parallel
- [ ] T004 [P] Contract test MCP protocol compliance in tests/contract/mcp-protocol.test.ts
- [ ] T005 [P] Contract test tool schema validation in tests/contract/tool-schema-validation.test.ts
- [ ] T006 [P] Contract test GraphQL operation mapping in tests/contract/graphql-mapping.test.ts

### Integration Tests [P] - Different files, can run parallel
- [ ] T007 [P] Integration test health check tool in tests/integration/tools/health-check.test.ts
- [ ] T008 [P] Integration test create table tool in tests/integration/tools/create-table.test.ts
- [ ] T009 [P] Integration test search nodes tool in tests/integration/tools/search-nodes.test.ts
- [ ] T010 [P] Integration test execute template tool in tests/integration/tools/execute-template.test.ts
- [ ] T011 [P] Integration test concurrent clients in tests/integration/concurrent-clients.test.ts
- [ ] T012 [P] Integration test performance benchmark in tests/integration/performance-benchmark.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models [P] - Different files, can run parallel
- [ ] T013 [P] McpToolDefinition model in src/models/McpToolDefinition.ts
- [ ] T014 [P] GraphQLOperation model in src/models/GraphQLOperation.ts
- [ ] T015 [P] McpSession model in src/models/McpSession.ts
- [ ] T016 [P] ToolExecutionResult model in src/models/ToolExecutionResult.ts
- [ ] T017 [P] ErrorContext model in src/models/ErrorContext.ts

### Core Services [P] - Different files, can run parallel
- [ ] T018 [P] MCP tool registry service in src/services/McpToolRegistry.ts
- [ ] T019 [P] GraphQL bridge service in src/services/GraphQLBridge.ts
- [ ] T020 [P] MCP session manager in src/services/McpSessionManager.ts
- [ ] T021 [P] MCP logger service in src/services/McpLogger.ts

### MCP Request Processing - Sequential (same file dependencies)
- [ ] T022 MCP request handler in src/services/McpRequestHandler.ts
- [ ] T023 HTTP server integration in src/mcp/http-server/McpHttpServer.ts
- [ ] T024 CLI interface in src/mcp/cli/mcp-proxy-cli.ts

### Tool Implementations [P] - Different operations, can run parallel
- [ ] T025 [P] System tools (healthCheck, systemStats) in src/mcp/tools/SystemTools.ts
- [ ] T026 [P] Table tools (createTable, searchTables) in src/mcp/tools/TableTools.ts
- [ ] T027 [P] Node tools (createNode, searchNodes) in src/mcp/tools/NodeTools.ts
- [ ] T028 [P] Relation tools (createRelation) in src/mcp/tools/RelationTools.ts
- [ ] T029 [P] Template tools (createTemplate, executeTemplateWithGraphQL, searchTemplates) in src/mcp/tools/TemplateTools.ts
- [ ] T030 [P] Schema tools (exportSchema, importSchema) in src/mcp/tools/SchemaTools.ts

## Phase 3.4: Integration
- [ ] T031 Connect MCP server to existing GraphQL endpoint configuration
- [ ] T032 Add structured logging integration with existing ConsoleLogger pattern
- [ ] T033 Configure environment variables and CLI argument parsing
- [ ] T034 Add error handling and MCP error format compliance

## Phase 3.5: Polish

### Unit Tests [P] - Different components, can run parallel
- [ ] T035 [P] Unit tests for tool registry in tests/unit/McpToolRegistry.test.ts
- [ ] T036 [P] Unit tests for GraphQL bridge in tests/unit/GraphQLBridge.test.ts
- [ ] T037 [P] Unit tests for session management in tests/unit/McpSessionManager.test.ts
- [ ] T038 [P] Unit tests for error handling in tests/unit/ErrorContext.test.ts

### Validation and Documentation
- [ ] T039 Performance validation (<100ms overhead requirement)
- [ ] T040 [P] Update quickstart.md with actual implementation details
- [ ] T041 Load testing with 10+ concurrent MCP clients
- [ ] T042 Final integration validation following quickstart guide

## Dependencies
- **Setup** (T001-T003) before everything
- **Tests** (T004-T012) before implementation (T013-T034)
- **Models** (T013-T017) before services (T018-T021)
- **Services** (T018-T021) before request processing (T022-T024)
- **Core infrastructure** (T022-T024) before tool implementations (T025-T030)
- **Implementation** (T013-T034) before polish (T035-T042)

## Parallel Execution Examples

### Phase 3.2: All contract and integration tests together
```bash
# Launch T004-T012 together (all test files are independent):
Task: "Contract test MCP protocol compliance in tests/contract/mcp-protocol.test.ts"
Task: "Contract test tool schema validation in tests/contract/tool-schema-validation.test.ts"
Task: "Contract test GraphQL operation mapping in tests/contract/graphql-mapping.test.ts"
Task: "Integration test health check tool in tests/integration/tools/health-check.test.ts"
Task: "Integration test create table tool in tests/integration/tools/create-table.test.ts"
Task: "Integration test search nodes tool in tests/integration/tools/search-nodes.test.ts"
Task: "Integration test execute template tool in tests/integration/tools/execute-template.test.ts"
Task: "Integration test concurrent clients in tests/integration/concurrent-clients.test.ts"
Task: "Integration test performance benchmark in tests/integration/performance-benchmark.test.ts"
```

### Phase 3.3a: All data models together
```bash
# Launch T013-T017 together (separate model files):
Task: "McpToolDefinition model in src/models/McpToolDefinition.ts"
Task: "GraphQLOperation model in src/models/GraphQLOperation.ts"
Task: "McpSession model in src/models/McpSession.ts"
Task: "ToolExecutionResult model in src/models/ToolExecutionResult.ts"
Task: "ErrorContext model in src/models/ErrorContext.ts"
```

### Phase 3.3b: All core services together
```bash
# Launch T018-T021 together (separate service files):
Task: "MCP tool registry service in src/services/McpToolRegistry.ts"
Task: "GraphQL bridge service in src/services/GraphQLBridge.ts"
Task: "MCP session manager in src/services/McpSessionManager.ts"
Task: "MCP logger service in src/services/McpLogger.ts"
```

### Phase 3.3c: All tool implementations together
```bash
# Launch T025-T030 together (separate tool category files):
Task: "System tools (healthCheck, systemStats) in src/mcp/tools/SystemTools.ts"
Task: "Table tools (createTable, searchTables) in src/mcp/tools/TableTools.ts"
Task: "Node tools (createNode, searchNodes) in src/mcp/tools/NodeTools.ts"
Task: "Relation tools (createRelation) in src/mcp/tools/RelationTools.ts"
Task: "Template tools (createTemplate, executeTemplateWithGraphQL, searchTemplates) in src/mcp/tools/TemplateTools.ts"
Task: "Schema tools (exportSchema, importSchema) in src/mcp/tools/SchemaTools.ts"
```

## Task Details

### T004: Contract test MCP protocol compliance
**File**: `tests/contract/mcp-protocol.test.ts`
**Purpose**: Verify MCP JSON-RPC 2.0 protocol compliance
**Must Test**: initialize, tools/list, tools/call methods against contracts/mcp-protocol.json
**Expected**: All tests FAIL initially (no implementation)

### T005: Contract test tool schema validation
**File**: `tests/contract/tool-schema-validation.test.ts`
**Purpose**: Verify JSON Schema validation for all 12 tools
**Must Test**: Parameter validation for each tool in contracts/graphql-tools.json
**Expected**: All tests FAIL initially (no implementation)

### T006: Contract test GraphQL operation mapping
**File**: `tests/contract/graphql-mapping.test.ts`
**Purpose**: Verify GraphQL query/mutation syntax and schema compatibility
**Must Test**: All GraphQL operations parse correctly and exist in target schema
**Expected**: All tests FAIL initially (no implementation)

### T013: McpToolDefinition model
**File**: `src/models/McpToolDefinition.ts`
**Purpose**: Core entity representing MCP tool with GraphQL mapping
**Must Include**: name, description, inputSchema, graphqlOperation fields with validation
**Based On**: data-model.md McpToolDefinition specification

### T018: MCP tool registry service
**File**: `src/services/McpToolRegistry.ts`
**Purpose**: Central registry for tool definitions with discovery capabilities
**Must Include**: Load from contracts/graphql-tools.json, tools/list, tool lookup
**Integration**: Tool discovery for MCP protocol

### T022: MCP request handler
**File**: `src/services/McpRequestHandler.ts`
**Purpose**: Main request processing pipeline for MCP JSON-RPC 2.0
**Must Include**: Method routing (initialize, tools/list, tools/call), error handling
**Dependencies**: T018-T021 (requires all services)

### T023: HTTP server integration
**File**: `src/mcp/http-server/McpHttpServer.ts`
**Purpose**: HTTP server for /mcp endpoint on shared port 4000
**Must Include**: JSON transport, port sharing with existing GraphQL server
**Dependencies**: T022 (requires request handler)

## Validation Checklist
*GATE: Checked before task completion*

- [x] All contracts have corresponding tests (T004-T006)
- [x] All entities have model tasks (T013-T017)
- [x] All tests come before implementation (T004-T012 before T013+)
- [x] Parallel tasks truly independent (verified file paths)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] TDD methodology enforced (tests must fail before implementation)
- [x] All 12 GraphQL tools have implementation coverage
- [x] Performance and concurrent client requirements addressed
- [x] Integration with existing GraphQL server preserved

## Notes
- **[P] tasks** = different files, no dependencies, can run in parallel
- **Verify tests fail** before implementing (TDD requirement)
- **Port sharing**: MCP server shares port 4000 with existing GraphQL server
- **Performance**: Must maintain <100ms tool execution overhead
- **Concurrency**: Must support 10+ concurrent MCP clients
- **Compatibility**: Must not modify existing GraphQL server functionality
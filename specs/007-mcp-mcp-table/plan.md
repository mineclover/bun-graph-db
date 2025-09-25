# Implementation Plan: Nested MCP Server Architecture with Table-Based Tool Isolation

**Branch**: `007-mcp-mcp-table` | **Date**: 2025-09-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-mcp-mcp-table/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → Spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type: single (backend GraphQL server)
   → Set Structure Decision: Option 1 (single project)
3. Evaluate Constitution Check section below
   → Constitution template found but no specific requirements
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → Research MCP JSON-RPC 2.0 protocol compliance
   → Research template parameter to inputSchema mapping strategies
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
6. Re-evaluate Constitution Check section
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Create nested MCP server architecture where each table exposes its templates as MCP tools through isolated `/sub/[tableid]/mcp` endpoints. Templates become discoverable tools with automatic schema mapping between template parameters and MCP inputSchema format.

## Technical Context
**Language/Version**: TypeScript with Bun runtime (existing project)
**Primary Dependencies**: Existing GraphQL server, Express.js, SQLite database with template storage
**Storage**: SQLite database with existing tables and templates schema
**Testing**: Bun test framework (existing project setup)
**Target Platform**: Server-side HTTP endpoints for MCP JSON-RPC 2.0 protocol
**Project Type**: single - extends existing GraphQL server with nested MCP endpoints
**Performance Goals**: Real-time template-to-tool mapping, sub-100ms MCP response times
**Constraints**: Must maintain compatibility with existing template system and database schema
**Scale/Scope**: Support for 100+ tables, each with 10-50 templates exposed as MCP tools

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (extending existing GraphQL server)
- Using framework directly? (extending existing Express/GraphQL setup)
- Single data model? (reusing existing template/table entities)
- Avoiding patterns? (no additional repository layers - using existing infrastructure)

**Architecture**:
- EVERY feature as library? (MCP server functionality as reusable library)
- Libraries listed: mcp-server-factory + template-tool-mapper + schema-converter
- CLI per library: mcp-server-factory --table-id --port, schema-converter --input --output
- Library docs: llms.txt format planned for MCP integration patterns

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? (contract tests for MCP protocol compliance)
- Git commits show tests before implementation? (MCP endpoint tests before implementation)
- Order: Contract→Integration→E2E→Unit strictly followed
- Real dependencies used? (actual SQLite database, real template data)
- Integration tests for: new MCP endpoints, schema mapping, template-tool contracts
- FORBIDDEN: Implementation before test, skipping RED phase

**Observability**:
- Structured logging included? (MCP request/response logging, schema mapping logs)
- Frontend logs → backend? (MCP client interaction logs)
- Error context sufficient? (template execution errors, schema mapping failures)

**Versioning**:
- Version number assigned? (0.1.0 - new MCP nested server feature)
- BUILD increments on every change? (following existing project versioning)
- Breaking changes handled? (backward compatibility with existing template system)

## Project Structure

### Documentation (this feature)
```
specs/007-mcp-mcp-table/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Extending existing single project structure
src/
├── models/                    # Existing
├── services/                 # Existing
├── infrastructure/           # Existing
├── presentation/
│   ├── graphql/             # Existing GraphQL layer
│   └── mcp/                 # NEW - MCP server endpoints
│       ├── factory/         # MCP server factory
│       ├── mapping/         # Template-to-tool mapping
│       └── schema/          # Schema conversion utilities
├── cli/                      # Existing
└── lib/                      # Existing

tests/
├── contract/                 # NEW - MCP protocol compliance tests
├── integration/              # Existing - add MCP endpoint tests
└── unit/                     # Existing - add mapping logic tests
```

**Structure Decision**: Option 1 (single project) - extending existing GraphQL server architecture

## Phase 0: Outline & Research

### Research Requirements
1. **MCP JSON-RPC 2.0 Protocol Specification**:
   - Required endpoints: initialize, tools/list, tools/call
   - Request/response format compliance
   - Error handling standards

2. **Template Parameter to MCP inputSchema Mapping**:
   - Analyze existing template schema structure
   - Define mapping rules for incompatible types
   - Research JSON Schema transformation patterns

3. **Express.js Dynamic Route Patterns**:
   - Implementation of `/sub/:tableId/mcp` routing
   - Request isolation between table-specific endpoints
   - Performance implications of dynamic server instantiation

4. **SQLite Template Query Optimization**:
   - Efficient template retrieval by table association
   - Real-time template list updates
   - Database connection pooling for MCP endpoints

**Output**: research.md with all technical decisions documented

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

### Entity Extraction & Data Model
- Identified core entities: TableMcpServer, McpTool, SchemaMapping, McpRequest/Response
- Template and Table entity extensions for MCP integration
- Schema mapping system for type conversions
- Stateless design for optimal performance

### API Contract Generation
- OpenAPI specification for MCP JSON-RPC over HTTP protocol
- Request/response schemas for initialize, tools/list, tools/call methods
- Error handling specifications with JSON-RPC error codes
- Path parameter validation for table IDs

### Contract Tests Framework
- MCP protocol compliance test structure
- Schema mapping validation tests
- Table isolation verification tests
- Error scenario testing patterns

### User Story Integration Tests
- Tool discovery workflow validation
- Template execution through MCP protocol
- Concurrent access and isolation testing
- End-to-end quickstart scenario validation

**Output**: data-model.md, /contracts/*, quickstart.md validation scenarios

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load existing template for structured task creation
- Generate from Phase 1 design artifacts (contracts, data model, quickstart)
- MCP protocol contract → protocol compliance test tasks [P]
- Schema mapping design → type conversion utility tasks [P]
- Each quickstart scenario → integration test task
- Implementation tasks following TDD: test-first, then implementation

**Ordering Strategy**:
- TDD order enforced: Contract tests → Integration tests → Unit tests → Implementation
- Dependency order: Schema utilities → MCP server factory → Express routing integration
- Mark [P] for parallel execution opportunities (independent components)

**Task Categories**:
1. **Contract Testing** (5-7 tasks): MCP protocol compliance, schema validation
2. **Schema Mapping** (4-6 tasks): Type conversion utilities, validation logic
3. **Server Factory** (6-8 tasks): Table-specific MCP server creation, tool generation
4. **HTTP Integration** (4-5 tasks): Express routing, request handling, error responses
5. **Integration Testing** (6-8 tasks): End-to-end scenarios, isolation verification

**Estimated Output**: 25-34 numbered, dependency-ordered tasks following constitutional TDD principles

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (TDD cycle: RED-GREEN-Refactor for each task)
**Phase 5**: Validation (quickstart.md execution, performance benchmarking)

## Complexity Tracking
*No constitutional violations identified*

All design decisions follow constitutional principles:
- Single project extension (no additional projects)
- Reuses existing infrastructure (no wrapper patterns)
- Library-first approach (MCP functionality as reusable components)
- TDD methodology enforced (tests before implementation)

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning approach described (/plan command)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All technical unknowns researched and resolved
- [x] No complexity deviations requiring justification

**Generated Artifacts**:
- [x] research.md - Technical decisions and rationale
- [x] data-model.md - Entity design and relationships
- [x] contracts/mcp-protocol.json - OpenAPI MCP specification
- [x] quickstart.md - Validation scenarios and troubleshooting

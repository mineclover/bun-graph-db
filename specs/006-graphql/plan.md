# Implementation Plan: MCP Schema Synchronization & Dynamic Variable Mapping

**Branch**: `006-graphql` | **Date**: 2025-01-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-graphql/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✅
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION) ✅
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below ✅
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md ✅
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI). ✅
6. Re-evaluate Constitution Check section ✅
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md) ✅
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
**Primary Requirement**: Implement automatic synchronization between GraphQL schema changes and MCP tool contracts to maintain compatibility without manual intervention.

**Technical Approach**: Build a schema introspection system that detects GraphQL schema changes, automatically updates MCP tool definitions, and transforms variables between MCP and GraphQL formats dynamically.

## Technical Context
**Language/Version**: TypeScript 5.x with Bun runtime
**Primary Dependencies**: @modelcontextprotocol/sdk 1.18.1, graphql 16.11.0, graphql-yoga 5.15.1
**Storage**: SQLite3 for existing graph database + file-based schema snapshots
**Testing**: Bun test framework (existing test setup)
**Target Platform**: Node.js compatible runtime (Bun 1.0+)
**Project Type**: single (existing MCP + GraphQL API architecture)
**Performance Goals**: Schema sync <200ms, tool execution <100ms response time
**Constraints**: Backward compatibility required, zero-downtime schema updates
**Scale/Scope**: Support for 100+ MCP tools, handle schema changes in production environment

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (existing bun-graph-db system - extension not new project)
- Using framework directly? Yes (GraphQL-Yoga, MCP SDK directly)
- Single data model? Yes (schema snapshots + contract mappings)
- Avoiding patterns? Yes (direct repository access, no unnecessary abstractions)

**Architecture**:
- EVERY feature as library? Yes (schema-sync as src/lib/schema-sync)
- Libraries listed:
  - schema-sync (GraphQL introspection and contract generation)
  - variable-transformer (MCP ↔ GraphQL argument mapping)
  - sync-monitor (change detection and triggers)
- CLI per library: schema-sync --help/--version/--format, sync-monitor --help/--version/--format
- Library docs: llms.txt format planned? Yes

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes (contract tests first)
- Git commits show tests before implementation? Yes
- Order: Contract→Integration→E2E→Unit strictly followed? Yes
- Real dependencies used? Yes (actual GraphQL server, real MCP connections)
- Integration tests for: schema sync library, contract generation, MCP tool execution
- FORBIDDEN: Implementation before test, skipping RED phase

**Observability**:
- Structured logging included? Yes (schema change events, sync operations)
- Frontend logs → backend? N/A (backend-only feature)
- Error context sufficient? Yes (sync failures, validation errors)

**Versioning**:
- Version number assigned? 0.1.0 (MAJOR.MINOR.BUILD)
- BUILD increments on every change? Yes
- Breaking changes handled? Yes (parallel schema support, gradual migration)

## Project Structure

### Documentation (this feature)
```
specs/006-graphql/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT) ✅
src/
├── models/              # Existing
├── services/            # Existing
├── cli/                 # Existing
├── lib/                 # Existing
│   ├── schema-sync/     # NEW: Schema synchronization library
│   ├── variable-transformer/ # NEW: Variable mapping library
│   └── sync-monitor/    # NEW: Change detection library
└── mcp/                 # Existing MCP implementation

tests/
├── contract/            # NEW: Contract validation tests
├── integration/         # Existing + NEW schema sync tests
└── unit/                # Existing + NEW library tests
```

**Structure Decision**: Option 1 (single project) - extending existing bun-graph-db architecture

## Phase 0: Outline & Research

### Research Tasks Identified
From the 4 NEEDS CLARIFICATION items in the spec:

1. **Sync frequency and triggers** (FR-010)
   - Research: Event-driven vs polling approaches for schema change detection
   - Decision needed: GraphQL schema hash monitoring, webhook triggers, or periodic checks

2. **Fallback behavior for schema introspection failures** (FR-011)
   - Research: Graceful degradation patterns for offline/unavailable GraphQL servers
   - Decision needed: Cached schema usage, error handling, tool disabling strategies

3. **Custom scalar type mapping** (FR-012)
   - Research: GraphQL custom scalars to JSON Schema type conversion
   - Decision needed: Scalar type registry, validation mapping, runtime conversion

4. **Schema versioning strategy** (FR-013)
   - Research: Multi-version schema support patterns
   - Decision needed: Version compatibility matrix, migration strategies, parallel support

### Research Agent Tasks

**For each NEEDS CLARIFICATION:**
- Task: "Research sync frequency options for GraphQL schema monitoring"
- Task: "Research fallback patterns for GraphQL introspection failures"
- Task: "Research custom scalar mapping from GraphQL to JSON Schema"
- Task: "Research GraphQL schema versioning strategies for MCP compatibility"

**For each technology choice:**
- Task: "Find best practices for GraphQL introspection in production"
- Task: "Find best practices for MCP tool contract generation"
- Task: "Find best practices for variable transformation between protocols"

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

### Entity Extraction from Feature Spec → `data-model.md`

**Core Entities:**
- **Schema Snapshot**: Version, introspection metadata, change detection hash, timestamp
- **Contract Mapping**: MCP tool definition, GraphQL operation, transformation rules, validation status
- **Variable Transformer**: Input schema, output schema, transformation rules, validation patterns
- **Sync Event**: Event type, changes detected, contracts updated, errors, timestamp

**Relationships:**
- Schema Snapshot → Contract Mapping (1:many)
- Contract Mapping → Variable Transformer (1:1)
- Schema Snapshot → Sync Event (1:many)

### API Contract Generation

**From functional requirements FR-001 through FR-013:**

1. **Schema Detection Endpoint**: POST /api/schema/detect
2. **Contract Sync Endpoint**: POST /api/contracts/sync
3. **Variable Transform Endpoint**: POST /api/transform/variables
4. **Sync Status Endpoint**: GET /api/sync/status
5. **Tool Validation Endpoint**: POST /api/tools/validate

### Contract Test Generation

**One test file per endpoint:**
- schema-detect.contract.test.ts
- contract-sync.contract.test.ts
- variable-transform.contract.test.ts
- sync-status.contract.test.ts
- tool-validation.contract.test.ts

**Test Requirements**: All tests must FAIL initially (no implementation)

### Integration Test Scenarios

**From user stories in spec:**
- Schema change detection and automatic contract updates
- Variable transformation during tool execution
- Fallback behavior during schema unavailability
- Multi-version schema compatibility

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md updates

## Phase 2: Task Planning Approach ✅
*Completed during /plan command execution*

**Task Generation Strategy**:
- TDD-first approach with contract tests as foundation
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity (4 entities) → model creation task [P]
- Each user story → integration test scenario task
- Implementation tasks to make failing tests pass

**Ordering Strategy**:
- TDD order: Contract tests → Integration tests → Unit tests → Implementation
- Dependency order: Models → Libraries → Services → API endpoints
- Mark [P] for parallel execution (independent contract tests, model creation)

**Estimated Task Output for /tasks command**: 28-32 numbered, ordered tasks

**Task Categories Planned:**
1. **Contract Test Creation** (5 tasks) [P]
   - schema-detect.contract.test.ts
   - contract-sync.contract.test.ts
   - variable-transform.contract.test.ts
   - sync-status.contract.test.ts
   - tool-validation.contract.test.ts

2. **Model Implementation** (4 tasks) [P]
   - Schema Snapshot entity and repository
   - Contract Mapping entity and repository
   - Variable Transformer entity and repository
   - Sync Event entity and repository

3. **Library Development** (9 tasks)
   - src/lib/schema-sync/ (3 tasks: core, detection, validation)
   - src/lib/variable-transformer/ (3 tasks: mapping, conversion, validation)
   - src/lib/sync-monitor/ (3 tasks: monitoring, events, metrics)

4. **Integration Test Implementation** (4 scenarios)
   - Schema change detection workflow
   - Contract synchronization workflow
   - Variable transformation workflow
   - Real-time monitoring workflow

5. **API Endpoint Implementation** (5 tasks)
   - Schema detection resolvers
   - Contract sync resolvers
   - Variable transformation resolvers
   - Sync status resolvers
   - Tool validation resolvers

6. **Documentation and Validation** (3 tasks)
   - Library documentation (llms.txt format)
   - Performance validation
   - Quickstart validation

**Ready for /tasks command execution**

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No constitutional violations identified - all requirements align with simplicity principles*

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
- [x] All NEEDS CLARIFICATION resolved (4 items fully researched)
- [x] Complexity deviations documented (none required)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
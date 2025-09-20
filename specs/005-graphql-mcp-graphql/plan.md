# Implementation Plan: GraphQL-to-MCP Proxy Server

**Branch**: `005-graphql-mcp-graphql` | **Date**: 2025-01-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-graphql-mcp-graphql/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI).
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Create an MCP (Model Context Protocol) proxy server that exposes all existing GraphQL server functionality as MCP tools, enabling standard MCP clients to access the graph database without requiring GraphQL knowledge. The proxy will translate MCP tool calls to GraphQL operations while sharing the same port infrastructure and supporting concurrent clients.

## Technical Context
**Language/Version**: TypeScript/Bun (matching existing project stack)
**Primary Dependencies**: @modelcontextprotocol/sdk, existing GraphQL infrastructure, Bun HTTP server
**Storage**: Shared with existing GraphQL server (SQLite graph database)
**Testing**: Bun test framework (matching existing project)
**Target Platform**: Local development servers (Node.js/Bun compatible)
**Project Type**: single (server-side proxy component)
**Performance Goals**: Support concurrent MCP clients, maintain GraphQL server performance, <100ms tool execution overhead
**Constraints**: MCP spec 2025-06-18 compliance, application/json transport, port sharing with GraphQL server, auto-authentication for local use
**Scale/Scope**: Support all existing GraphQL operations (~50+ queries/mutations), handle 10+ concurrent MCP clients

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (MCP proxy server only)
- Using framework directly? Yes (direct MCP SDK usage, direct GraphQL client)
- Single data model? Yes (MCP tool definitions map directly to GraphQL schema)
- Avoiding patterns? Yes (direct proxy pattern, no unnecessary abstractions)

**Architecture**:
- EVERY feature as library? Yes (MCP proxy as standalone library)
- Libraries listed: mcp-graphql-proxy (MCP server with GraphQL bridge)
- CLI per library: mcp-server --port --graphql-endpoint --help --version
- Library docs: llms.txt format planned? Yes

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes (tests written first)
- Git commits show tests before implementation? Yes (contract tests first)
- Order: Contract→Integration→E2E→Unit strictly followed? Yes
- Real dependencies used? Yes (actual GraphQL server, real MCP clients)
- Integration tests for: MCP-GraphQL contract, tool execution, concurrent clients
- FORBIDDEN: Implementation before test, skipping RED phase ✓

**Observability**:
- Structured logging included? Yes (MCP requests, GraphQL calls, errors)
- Frontend logs → backend? N/A (server-side only)
- Error context sufficient? Yes (MCP error format with GraphQL context)

**Versioning**:
- Version number assigned? 0.1.0 (new feature)
- BUILD increments on every change? Yes
- Breaking changes handled? N/A (new feature, no existing API)

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: Option 1 (Single project) - MCP proxy is a server-side component extending existing GraphQL infrastructure

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `/scripts/bash/update-agent-context.sh claude` for your AI assistant
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- MCP protocol contract → contract test tasks [P]
- GraphQL tool definitions → tool definition test tasks [P]
- Each entity (McpToolDefinition, GraphQLOperation, etc.) → model creation task [P]
- Each user story from quickstart → integration test task
- Implementation tasks to make tests pass (following TDD)

**MCP-Specific Task Categories**:
1. **Contract Tests** [P]: MCP protocol compliance, tool schema validation
2. **Tool Definition Tests** [P]: Each GraphQL operation mapping test
3. **Integration Tests**: End-to-end MCP client → GraphQL server flow
4. **Unit Tests**: Individual component testing (proxy, translator, session)
5. **Implementation Tasks**: Core proxy server, tool registry, GraphQL bridge

**Ordering Strategy**:
- TDD order: Tests before implementation (RED-GREEN-Refactor cycle)
- Dependency order:
  1. MCP protocol foundation
  2. Tool definition models
  3. GraphQL integration layer
  4. Session management
  5. Error handling and logging
- Mark [P] for parallel execution (independent files/components)
- Integration tests require contract tests to pass first

**Tool-Specific Task Breakdown**:
- Each of 12 GraphQL tools → individual contract test + implementation
- MCP server initialization → session management test + implementation
- GraphQL proxy layer → parameter translation test + implementation
- Error handling → error context test + implementation

**Estimated Output**: 35-40 numbered, ordered tasks in tasks.md
- 15 contract/schema tests [P]
- 12 tool-specific implementation tasks [P]
- 8 integration test scenarios
- 5 core infrastructure tasks

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (tasks.md created - 42 tasks following TDD methodology, executable format)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none required)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
# Implementation Plan: System Query Testing Framework

**Branch**: `002-sqlite-graphql-sql` | **Date**: 2025-01-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-sqlite-graphql-sql/spec.md`

## Summary
Develop comprehensive unit tests for system monitoring queries (systemStats, memoryStats, healthCheck) in the GraphQL-based graph database system. Tests will validate all query parameters and options using file-based SQLite databases for realistic performance testing, with each test having an isolated database that is cleaned up after execution.

## Technical Context
**Language/Version**: TypeScript/Bun runtime (from existing codebase)
**Primary Dependencies**: GraphQL, SQLite, existing SystemQueries class
**Storage**: File-based SQLite test databases (temp files)
**Testing**: Bun native test framework (from package.json)
**Target Platform**: Development environment (local testing)
**Project Type**: single - testing framework extension
**Performance Goals**: <200ms per system query execution, <100ms test database setup/teardown
**Constraints**: Isolated test environment, no shared state between tests, file cleanup required
**Scale/Scope**: 3 system queries × comprehensive parameter coverage ≈ 15-20 test cases

**User-provided Details**: Unit tests only, file-based SQLite databases (not in-memory), clean database state for each test, auto-cleanup after test completion, maximum parameter coverage for all system query options.

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (tests) - extending existing test suite
- Using framework directly? Yes - direct Bun test framework usage
- Single data model? Yes - existing SystemStats, MemoryStats, HealthStatus entities
- Avoiding patterns? Yes - direct test implementation without unnecessary abstractions

**Architecture**:
- EVERY feature as library? No - this is testing infrastructure, not a feature library
- Libraries listed: N/A - testing existing SystemQueries functionality
- CLI per library: N/A - test runner via `bun test`
- Library docs: N/A - test documentation in test files

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes - tests will be written first and fail before SystemQueries implementation
- Git commits show tests before implementation? Yes - existing SystemQueries already implemented, tests will validate behavior
- Order: Contract→Integration→E2E→Unit strictly followed? This is unit testing of existing functionality
- Real dependencies used? Yes - real SQLite files, not mocks
- Integration tests for: N/A - this IS the test implementation
- FORBIDDEN: Implementation before test, skipping RED phase - N/A

**Observability**:
- Structured logging included? Yes - tests will include logging validation
- Frontend logs → backend? N/A - backend-only system queries
- Error context sufficient? Yes - comprehensive error scenario testing

**Versioning**:
- Version number assigned? N/A - test framework extension
- BUILD increments on every change? N/A - follows existing project versioning
- Breaking changes handled? N/A - additive testing

## Project Structure

### Documentation (this feature)
```
specs/002-sqlite-graphql-sql/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
tests/
├── system-queries/          # New test directory
│   ├── fixtures/            # Test data and helper utilities
│   │   ├── test-database-setup.ts
│   │   └── sample-system-states.ts
│   ├── system-stats.test.ts      # systemStats query tests
│   ├── memory-stats.test.ts      # memoryStats query tests
│   └── health-check.test.ts      # healthCheck query tests
└── temp-dbs/               # Temporary SQLite files (auto-cleaned)
    ├── test-system-stats-*.sqlite
    ├── test-memory-stats-*.sqlite
    └── test-health-check-*.sqlite
```

**Structure Decision**: Option 1 (Single project) - extending existing test infrastructure

## Phase 0: Outline & Research

**Extract unknowns from Technical Context**:
- Test database isolation strategy - how to ensure clean state per test
- SQLite file naming and cleanup patterns - prevent conflicts in parallel test runs
- System query parameter coverage - all available options and edge cases
- Bun test framework capabilities - setup/teardown, async testing, file management

**Generate and dispatch research agents**:
```
Task: "Research Bun test framework setup/teardown patterns for file-based SQLite testing"
Task: "Analyze existing SystemQueries class for all available parameters and options"
Task: "Find best practices for SQLite test database lifecycle management"
Task: "Research system monitoring query edge cases and error scenarios"
```

**Consolidate findings** in `research.md` using format:
- Decision: [what was chosen]
- Rationale: [why chosen]
- Alternatives considered: [what else evaluated]

**Output**: research.md with all technical approaches resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

**Extract entities from feature spec** → `data-model.md`:
- TestDatabase entity with lifecycle management
- SystemQueryTestCase entity with parameter variations
- TestResults entity with validation criteria
- Existing entities: SystemStats, MemoryStats, HealthStatus, ProcessStats, DatabaseStats

**Generate API contracts** from functional requirements:
- Test setup/teardown contracts
- System query execution contracts
- Assertion and validation contracts
- Output contracts to `/contracts/`

**Generate contract tests** from contracts:
- Database setup contract tests
- Query execution contract tests
- Cleanup contract tests
- Tests must validate current SystemQueries behavior

**Extract test scenarios** from user stories:
- Normal system state testing
- Memory pressure scenarios (healthy/warning/critical)
- Database statistics accuracy
- Error handling and edge cases

**Update agent file incrementally**:
- Run `/scripts/bash/update-agent-context.sh claude`
- Add system query testing context
- Update with SQLite test database patterns
- Preserve existing manual additions

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs
- Each system query → comprehensive test suite task [P]
- Database lifecycle → setup/teardown utilities task [P]
- Each edge case → specific test scenario task
- Integration with existing test infrastructure

**Ordering Strategy**:
- TDD order: Test utilities before specific tests
- Dependency order: Database setup before query tests before cleanup validation
- Mark [P] for parallel execution (independent test files)
- Sequential dependency: utilities → test cases → validation

**Estimated Output**: 12-15 numbered, ordered tasks in tasks.md
- Database setup utilities (2 tasks)
- SystemStats testing (3-4 tasks)
- MemoryStats testing (3-4 tasks)
- HealthCheck testing (3-4 tasks)
- Integration and cleanup (1-2 tasks)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following TDD principles)
**Phase 5**: Validation (run tests, validate coverage, performance testing)

## Complexity Tracking
*No constitutional violations detected*

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
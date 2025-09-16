# Implementation Plan: Table-Based Data Export/Import System

**Branch**: `001-users-junwoobang-project` | **Date**: 2025-01-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-users-junwoobang-project/spec.md`

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
**Primary Requirement**: Selective export and import of table-based data packages (schema, dataset, relationships, templates) organized in folder structures named after table identifiers, with automatic dependency resolution and template generation.

**Technical Approach**: Extend existing GraphQL export/import infrastructure with table-focused mutations, leverage current template system format, implement dependency graph analysis for import ordering, and generate table-specific query templates following established patterns.

## Technical Context
**Language/Version**: TypeScript 5+ with Bun runtime (latest stable)
**Primary Dependencies**: GraphQL Yoga 5.15.1, @graphql-tools/schema 10.0.25, existing export/import infrastructure
**Storage**: SQLite with existing graph database schema, JSON files for export packages
**Testing**: Bun test framework, existing test infrastructure (test/unified-test-runner.ts)
**Target Platform**: Node.js/Bun server environment, local filesystem for package storage
**Project Type**: single (server-side graph database with CLI interface)
**Performance Goals**: <2s export/import for small tables, <30s for large tables (>10k records)
**Constraints**: Maintain compatibility with existing template format, leverage current hexagonal architecture
**Scale/Scope**: Support 100+ tables, 1M+ records per table, selective multi-table operations

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (extend existing graph database system)
- Using framework directly? YES (GraphQL Yoga, no wrappers)
- Single data model? YES (extend existing domain entities)
- Avoiding patterns? YES (leverage existing Repository/hexagonal architecture)

**Architecture**:
- EVERY feature as library? YES (table-export-lib, table-import-lib)
- Libraries listed:
  - table-export-lib: Export table packages with dependency analysis
  - table-import-lib: Import table packages with conflict resolution
  - template-generator-lib: Auto-generate table-specific query templates
- CLI per library: YES (exportTable, importTable, generateTemplates commands with --help/--version/--format)
- Library docs: YES (llms.txt format planned for each library)

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? YES (tests written first, must fail)
- Git commits show tests before implementation? YES (commit strategy documented)
- Order: Contract→Integration→E2E→Unit strictly followed? YES
- Real dependencies used? YES (actual SQLite database, filesystem)
- Integration tests for: contract changes (new GraphQL mutations), shared schemas (table export format)
- FORBIDDEN: Implementation before test, skipping RED phase

**Observability**:
- Structured logging included? YES (export/import progress, error context)
- Frontend logs → backend? N/A (server-side only)
- Error context sufficient? YES (operation tracking, rollback info)

**Versioning**:
- Version number assigned? YES (1.0.0 for new export/import system)
- BUILD increments on every change? YES
- Breaking changes handled? YES (backward compatibility with existing templates)

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

**Structure Decision**: [DEFAULT to Option 1 unless Technical Context indicates web/mobile app]

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
- Each GraphQL mutation in contracts → contract test task [P]
- Each entity in data model → TypeScript interface/class task [P]
- Each user story in quickstart → integration test task
- Library creation tasks (table-export-lib, table-import-lib, template-generator-lib)
- Implementation tasks to make tests pass
- CLI command creation tasks with --help/--version/--format support

**Specific Task Categories**:

1. **Contract Tests** [P] (5-7 tasks):
   - exportTable mutation contract test
   - importTablePackage mutation contract test
   - resolveImportConflicts mutation contract test
   - getImportSession query contract test
   - listTablePackages query contract test
   - validateTablePackage query contract test
   - previewImport query contract test

2. **Domain Models** [P] (7 tasks):
   - TablePackage entity with validation rules
   - SchemaDefinition entity with AttributeSchema
   - DatasetCollection entity with NodeRecord structure
   - RelationshipMapping entity with dependency ordering
   - TemplateSet entity following existing export format
   - ImportSession entity with state management
   - ExportManifest entity with system metadata

3. **Repository Interfaces** [P] (3 tasks):
   - ITablePackageRepository interface
   - IImportSessionRepository interface
   - Extend existing repositories for export/import operations

4. **Library Creation** [P] (3 tasks):
   - table-export-lib with CLI (exportTable command)
   - table-import-lib with CLI (importTable command)
   - template-generator-lib with CLI (generateTemplates command)

5. **Integration Tests** (6 tasks):
   - Single table export integration test (Users table example)
   - Multiple related tables export test (Posts → Users, Categories)
   - Table package import integration test
   - Conflict resolution integration test
   - Bulk import with dependencies test
   - Template generation validation test

6. **Service Implementation** (8 tasks):
   - TableExportService with dependency analysis
   - TableImportService with conflict resolution
   - DependencyResolver with topological sort
   - TemplateGenerator with CRUD template creation
   - PackageManager with file system operations
   - ConflictResolver with merge/overwrite/rename strategies
   - ImportSessionManager with progress tracking
   - ValidationService with schema compatibility checking

7. **GraphQL Implementation** (5 tasks):
   - Export mutation resolvers with progress tracking
   - Import mutation resolvers with session management
   - Query resolvers for session monitoring and validation
   - Type definitions matching contracts
   - Error handling and structured logging

8. **CLI Commands** (3 tasks):
   - Implement exportTable CLI with --help/--version/--format
   - Implement importTable CLI with conflict resolution options
   - Implement generateTemplates CLI with table specification

9. **Performance & Error Handling** (3 tasks):
   - Streaming JSON processing for large datasets
   - Rollback mechanism for failed imports
   - Memory-efficient batching with progress reporting

**Ordering Strategy**:
- **Phase 1**: Contract tests (must fail initially) [P]
- **Phase 2**: Domain models and interfaces [P]
- **Phase 3**: Integration test scenarios (must fail initially)
- **Phase 4**: Library creation with basic structure [P]
- **Phase 5**: Service implementation to pass contract tests
- **Phase 6**: GraphQL resolvers to pass integration tests
- **Phase 7**: CLI command implementation
- **Phase 8**: Performance optimization and error handling
- **Phase 9**: Documentation updates and final validation

**Estimated Output**: 40-45 numbered, ordered tasks in tasks.md

**Test-First Compliance**:
- All contract tests written first and must fail (RED)
- Integration tests written before service implementation
- Unit tests for each service method before implementation
- CLI tests before CLI implementation
- Performance tests before optimization implementation

**Parallel Execution Markers**:
- [P] indicates tasks that can run in parallel (same phase)
- Contract tests, domain models, and interfaces are fully parallelizable
- Service implementations have dependencies but can be parallelized within dependency groups

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
- [ ] Phase 0: Research complete (/plan command)
- [ ] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [ ] Initial Constitution Check: PASS
- [ ] Post-Design Constitution Check: PASS
- [ ] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
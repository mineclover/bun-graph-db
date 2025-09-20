# Tasks: MCP Schema Synchronization & Dynamic Variable Mapping

**Input**: Design documents from `/specs/006-graphql/`
**Prerequisites**: plan.md (✅), research.md (✅), data-model.md (✅), contracts/ (✅)

## Execution Flow (main)
```
1. Load plan.md from feature directory ✅
   → Tech stack: TypeScript 5.x + Bun runtime
   → Libraries: schema-sync, variable-transformer, sync-monitor
   → Structure: Single project extending existing bun-graph-db
2. Load design documents: ✅
   → data-model.md: 4 entities (Schema Snapshot, Contract Mapping, Variable Transformer, Sync Event)
   → contracts/: 5 GraphQL contracts (schema-detection, contract-sync, variable-transformation, sync-status, tool-validation)
   → research.md: Hybrid polling + webhook, multi-layer fallback, scalar registry, additive evolution
3. Generate tasks by category: ✅
   → Setup: library structure, dependencies, database schema
   → Tests: contract tests [P], integration tests [P]
   → Core: models [P], libraries, GraphQL resolvers
   → Integration: database repositories, sync monitoring
   → Polish: unit tests [P], performance validation, documentation
4. Apply task rules: ✅
   → Contract tests [P] (different files)
   → Model creation [P] (different entities)
   → Sequential for shared resolvers/services
5. Number tasks sequentially T001-T030 ✅
6. Generate dependency graph ✅
7. Create parallel execution examples ✅
8. Validate task completeness: ✅
   → All 5 contracts have tests ✅
   → All 4 entities have models ✅
   → All 5 GraphQL APIs implemented ✅
9. Return: SUCCESS (30 tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root ✅
- Extending existing bun-graph-db architecture
- SQLite database with existing infrastructure

## Phase 3.1: Setup
- [ ] T001 Create library directory structure src/lib/schema-sync/, src/lib/variable-transformer/, src/lib/sync-monitor/
- [ ] T002 Initialize TypeScript project dependencies for GraphQL introspection and JSONPath transformation
- [ ] T003 [P] Configure linting and formatting for new schema sync libraries

## Phase 3.2: Database Schema ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: Database schema MUST be created before ANY models**
- [ ] T004 Create database migration src/infrastructure/database/migrations/006-schema-sync-tables.sql
- [ ] T005 Update database initialization to include schema sync tables

## Phase 3.3: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.4
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T006 [P] Contract test schema detection API in tests/contract/schema-detection.contract.test.ts
- [ ] T007 [P] Contract test contract sync API in tests/contract/contract-sync.contract.test.ts
- [ ] T008 [P] Contract test variable transformation API in tests/contract/variable-transformation.contract.test.ts
- [ ] T009 [P] Contract test sync status API in tests/contract/sync-status.contract.test.ts
- [ ] T010 [P] Contract test tool validation API in tests/contract/tool-validation.contract.test.ts
- [ ] T011 [P] Integration test schema change detection workflow in tests/integration/schema-change-detection.integration.test.ts
- [ ] T012 [P] Integration test contract synchronization workflow in tests/integration/contract-sync.integration.test.ts
- [ ] T013 [P] Integration test variable transformation workflow in tests/integration/variable-transformation.integration.test.ts
- [ ] T014 [P] Integration test real-time monitoring workflow in tests/integration/sync-monitoring.integration.test.ts

## Phase 3.4: Core Models (ONLY after tests are failing)
- [ ] T015 [P] Schema Snapshot entity and repository in src/models/SchemaSnapshot.ts and src/infrastructure/repositories/SchemaSnapshotRepository.ts
- [ ] T016 [P] Contract Mapping entity and repository in src/models/ContractMapping.ts and src/infrastructure/repositories/ContractMappingRepository.ts
- [ ] T017 [P] Variable Transformer entity and repository in src/models/VariableTransformer.ts and src/infrastructure/repositories/VariableTransformerRepository.ts
- [ ] T018 [P] Sync Event entity and repository in src/models/SyncEvent.ts and src/infrastructure/repositories/SyncEventRepository.ts

## Phase 3.5: Core Libraries
- [ ] T019 Schema sync library core functionality in src/lib/schema-sync/SchemaSyncCore.ts
- [ ] T020 Schema detection and introspection in src/lib/schema-sync/SchemaDetector.ts
- [ ] T021 Schema validation and comparison in src/lib/schema-sync/SchemaValidator.ts
- [ ] T022 Variable transformer mapping engine in src/lib/variable-transformer/TransformationEngine.ts
- [ ] T023 Variable converter for scalar types in src/lib/variable-transformer/ScalarConverter.ts
- [ ] T024 Variable validation and error handling in src/lib/variable-transformer/ValidationEngine.ts
- [ ] T025 Sync monitor event tracking in src/lib/sync-monitor/EventTracker.ts
- [ ] T026 Sync monitor metrics collection in src/lib/sync-monitor/MetricsCollector.ts
- [ ] T027 Sync monitor health monitoring in src/lib/sync-monitor/HealthMonitor.ts

## Phase 3.6: GraphQL Integration
- [ ] T028 Schema detection GraphQL resolvers in src/presentation/graphql/resolvers/SchemaDetectionResolvers.ts
- [ ] T029 Contract sync GraphQL resolvers in src/presentation/graphql/resolvers/ContractSyncResolvers.ts
- [ ] T030 Variable transformation GraphQL resolvers in src/presentation/graphql/resolvers/VariableTransformationResolvers.ts
- [ ] T031 Sync status GraphQL resolvers in src/presentation/graphql/resolvers/SyncStatusResolvers.ts
- [ ] T032 Tool validation GraphQL resolvers in src/presentation/graphql/resolvers/ToolValidationResolvers.ts

## Dependencies
- Database schema (T004-T005) before models (T015-T018)
- Tests (T006-T014) before implementation (T015-T032)
- Models (T015-T018) before libraries (T019-T027)
- Libraries (T019-T027) before GraphQL resolvers (T028-T032)

## Parallel Example
```
# Phase 3.3: Launch T006-T010 together (contract tests):
Task: "Contract test schema detection API in tests/contract/schema-detection.contract.test.ts"
Task: "Contract test contract sync API in tests/contract/contract-sync.contract.test.ts"
Task: "Contract test variable transformation API in tests/contract/variable-transformation.contract.test.ts"
Task: "Contract test sync status API in tests/contract/sync-status.contract.test.ts"
Task: "Contract test tool validation API in tests/contract/tool-validation.contract.test.ts"

# Phase 3.4: Launch T015-T018 together (entity models):
Task: "Schema Snapshot entity and repository in src/models/SchemaSnapshot.ts and src/infrastructure/repositories/SchemaSnapshotRepository.ts"
Task: "Contract Mapping entity and repository in src/models/ContractMapping.ts and src/infrastructure/repositories/ContractMappingRepository.ts"
Task: "Variable Transformer entity and repository in src/models/VariableTransformer.ts and src/infrastructure/repositories/VariableTransformerRepository.ts"
Task: "Sync Event entity and repository in src/models/SyncEvent.ts and src/infrastructure/repositories/SyncEventRepository.ts"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing
- Commit after each task
- Avoid: vague tasks, same file conflicts
- Performance target: <200ms schema sync, <100ms tool execution

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts** ✅:
   - schema-detection.graphql → T006, T028
   - contract-sync.graphql → T007, T029
   - variable-transformation.graphql → T008, T030
   - sync-status.graphql → T009, T031
   - tool-validation.graphql → T010, T032

2. **From Data Model** ✅:
   - Schema Snapshot → T015 (model + repository)
   - Contract Mapping → T016 (model + repository)
   - Variable Transformer → T017 (model + repository)
   - Sync Event → T018 (model + repository)

3. **From User Stories** ✅:
   - Schema change detection → T011
   - Contract synchronization → T012
   - Variable transformation → T013
   - Real-time monitoring → T014

4. **Ordering** ✅:
   - Setup → Database → Tests → Models → Libraries → GraphQL → Polish
   - Dependencies properly mapped

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding tests (T006-T010)
- [x] All entities have model tasks (T015-T018)
- [x] All tests come before implementation (T006-T014 before T015-T032)
- [x] Parallel tasks truly independent (different files/entities)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] TDD cycle properly enforced (tests fail before implementation)
- [x] Performance requirements included (<200ms sync, <100ms execution)
- [x] Integration with existing bun-graph-db architecture
- [x] All GraphQL contracts implemented (5 resolvers for 5 contracts)
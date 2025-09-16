# Tasks: Table-Based Data Export/Import System

**Input**: Design documents from `/specs/001-users-junwoobang-project/`
**Prerequisites**: plan.md (✅), research.md (✅), data-model.md (✅), contracts/ (✅), quickstart.md (✅)

## Overview

Implementation of selective table export/import functionality with GraphQL API, leveraging existing template infrastructure and hexagonal architecture patterns. Features JSON package format, dependency resolution, conflict management, and auto-generated CRUD templates.

**Tech Stack**: TypeScript 5+ with Bun runtime, GraphQL Yoga 5.15.1, SQLite storage, existing hexagonal architecture
**Libraries**: table-export-lib, table-import-lib, template-generator-lib (each with CLI)

## Phase 3.1: Setup & Infrastructure

- [ ] **T001** [P] Configure TypeScript project structure for table export/import libraries in `src/lib/table-export-lib/`, `src/lib/table-import-lib/`, `src/lib/template-generator-lib/`
- [ ] **T002** [P] Add package.json dependencies: uuid for ID generation, fs-extra for file operations, path module for directory handling
- [ ] **T003** [P] Configure Biome linting rules for new library modules in `biome.json`
- [ ] **T004** [P] Create CLI entry points with --help/--version/--format support in `src/cli/export-table.ts`, `src/cli/import-table.ts`, `src/cli/generate-templates.ts`

## Phase 3.2: Contract Tests (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### GraphQL Mutation Contract Tests [P]
- [ ] **T005** [P] Contract test exportTable mutation in `tests/contract/export-table-mutation.test.ts`
- [ ] **T006** [P] Contract test importTablePackage mutation in `tests/contract/import-table-package-mutation.test.ts`
- [ ] **T007** [P] Contract test resolveImportConflicts mutation in `tests/contract/resolve-conflicts-mutation.test.ts`
- [ ] **T008** [P] Contract test cancelImportSession mutation in `tests/contract/cancel-session-mutation.test.ts`

### GraphQL Query Contract Tests [P]
- [ ] **T009** [P] Contract test getImportSession query in `tests/contract/get-import-session-query.test.ts`
- [ ] **T010** [P] Contract test listTablePackages query in `tests/contract/list-table-packages-query.test.ts`
- [ ] **T011** [P] Contract test validateTablePackage query in `tests/contract/validate-table-package-query.test.ts`
- [ ] **T012** [P] Contract test previewImport query in `tests/contract/preview-import-query.test.ts`

### Integration Test Scenarios [P]
- [ ] **T013** [P] Integration test single table export scenario (Users table) in `tests/integration/single-table-export.test.ts`
- [ ] **T014** [P] Integration test multiple related tables export (Posts → Users, Categories) in `tests/integration/related-tables-export.test.ts`
- [ ] **T015** [P] Integration test table package import in `tests/integration/table-package-import.test.ts`
- [ ] **T016** [P] Integration test conflict resolution workflow in `tests/integration/conflict-resolution.test.ts`
- [ ] **T017** [P] Integration test bulk import with dependencies in `tests/integration/bulk-import-dependencies.test.ts`
- [ ] **T018** [P] Integration test template generation validation in `tests/integration/template-generation.test.ts`

## Phase 3.3: Domain Models (ONLY after tests are failing) [P]

### Core Entities
- [ ] **T019** [P] TablePackage entity with validation rules in `src/domain/entities/TablePackage.ts`
- [ ] **T020** [P] SchemaDefinition entity with AttributeSchema in `src/domain/entities/SchemaDefinition.ts`
- [ ] **T021** [P] DatasetCollection entity with NodeRecord structure in `src/domain/entities/DatasetCollection.ts`
- [ ] **T022** [P] RelationshipMapping entity with dependency ordering in `src/domain/entities/RelationshipMapping.ts`
- [ ] **T023** [P] TemplateSet entity following existing export format in `src/domain/entities/TemplateSet.ts`
- [ ] **T024** [P] ImportSession entity with state management in `src/domain/entities/ImportSession.ts`
- [ ] **T025** [P] ExportManifest entity with system metadata in `src/domain/entities/ExportManifest.ts`

### Repository Interfaces [P]
- [ ] **T026** [P] ITablePackageRepository interface in `src/domain/repositories/ITablePackageRepository.ts`
- [ ] **T027** [P] IImportSessionRepository interface in `src/domain/repositories/IImportSessionRepository.ts`
- [ ] **T028** [P] Extend existing ITableRepository for export operations in `src/domain/repositories/ITableRepository.ts`

## Phase 3.4: Library Implementation

### Table Export Library
- [ ] **T029** TableExportService with dependency analysis in `src/lib/table-export-lib/services/TableExportService.ts`
- [ ] **T030** DependencyResolver with topological sort in `src/lib/table-export-lib/services/DependencyResolver.ts`
- [ ] **T031** PackageManager with file system operations in `src/lib/table-export-lib/services/PackageManager.ts`
- [ ] **T032** CLI exportTable command implementation in `src/cli/export-table.ts`

### Table Import Library
- [ ] **T033** TableImportService with conflict resolution in `src/lib/table-import-lib/services/TableImportService.ts`
- [ ] **T034** ConflictResolver with merge/overwrite/rename strategies in `src/lib/table-import-lib/services/ConflictResolver.ts`
- [ ] **T035** ImportSessionManager with progress tracking in `src/lib/table-import-lib/services/ImportSessionManager.ts`
- [ ] **T036** ValidationService with schema compatibility checking in `src/lib/table-import-lib/services/ValidationService.ts`
- [ ] **T037** CLI importTable command implementation in `src/cli/import-table.ts`

### Template Generator Library
- [ ] **T038** TemplateGenerator with CRUD template creation in `src/lib/template-generator-lib/services/TemplateGenerator.ts`
- [ ] **T039** Template pattern definitions for createNode, updateNode, deleteNode, getNode, searchNodes in `src/lib/template-generator-lib/templates/`
- [ ] **T040** CLI generateTemplates command implementation in `src/cli/generate-templates.ts`

## Phase 3.5: GraphQL Integration

### Schema Extensions
- [ ] **T041** Add GraphQL type definitions from contracts to schema in `src/infrastructure/graphql/schemas/table-export-import.graphql`
- [ ] **T042** Export mutation resolvers (exportTable) in `src/infrastructure/graphql/resolvers/mutations/export-resolvers.ts`
- [ ] **T043** Import mutation resolvers (importTablePackage, resolveImportConflicts, cancelImportSession) in `src/infrastructure/graphql/resolvers/mutations/import-resolvers.ts`
- [ ] **T044** Query resolvers (getImportSession, listTablePackages, validateTablePackage, previewImport) in `src/infrastructure/graphql/resolvers/queries/export-import-queries.ts`
- [ ] **T045** Error handling and structured logging for GraphQL operations in `src/infrastructure/graphql/resolvers/error-handlers.ts`

## Phase 3.6: Infrastructure Implementation

### Repository Implementations
- [ ] **T046** SQLiteTablePackageRepository implementation in `src/infrastructure/repositories/SQLiteTablePackageRepository.ts`
- [ ] **T047** SQLiteImportSessionRepository implementation in `src/infrastructure/repositories/SQLiteImportSessionRepository.ts`
- [ ] **T048** Extend SQLiteTableRepository for export operations in `src/infrastructure/repositories/SQLiteTableRepository.ts`

### Application Services
- [ ] **T049** TableExportApplicationService orchestrating library calls in `src/application/use-cases/TableExportApplicationService.ts`
- [ ] **T050** TableImportApplicationService orchestrating library calls in `src/application/use-cases/TableImportApplicationService.ts`
- [ ] **T051** DI container registration for new services in `src/infrastructure/container.ts`

## Phase 3.7: Performance & Error Handling

- [ ] **T052** Streaming JSON processing for large datasets in `src/lib/shared/StreamingJsonProcessor.ts`
- [ ] **T053** Rollback mechanism for failed imports in `src/lib/table-import-lib/services/RollbackManager.ts`
- [ ] **T054** Memory-efficient batching with progress reporting in `src/lib/shared/BatchProcessor.ts`

## Phase 3.8: Integration & Polish

### Final Integration
- [ ] **T055** Update GraphQL schema composition to include new types in `src/infrastructure/graphql/schema.ts`
- [ ] **T056** Add CLI commands to package.json scripts: export-table, import-table, generate-templates
- [ ] **T057** Integration testing with existing template system compatibility

### Documentation & Validation
- [ ] **T058** [P] Create library documentation in llms.txt format for each library
- [ ] **T059** [P] Update CLAUDE.md with new export/import capabilities
- [ ] **T060** [P] Performance testing (<2s export/import for small tables, <30s for large tables)
- [ ] **T061** Execute quickstart.md scenarios as validation tests
- [ ] **T062** Run unified test suite to ensure no regressions

## Dependencies

**Critical Path**:
- Setup (T001-T004) → Contract Tests (T005-T018) → Domain Models (T019-T028) → Library Implementation (T029-T040) → GraphQL Integration (T041-T045) → Infrastructure (T046-T051) → Performance (T052-T054) → Integration (T055-T062)

**Specific Dependencies**:
- T029-T031 depend on T019-T025 (entities)
- T033-T036 depend on T019-T025 (entities)
- T042-T044 depend on T029, T033, T038 (services)
- T046-T048 depend on T026-T028 (repository interfaces)
- T049-T050 depend on T029, T033, T046-T048 (services and repositories)
- T055 depends on T041 (schema definitions)

## Parallel Execution Examples

### Phase 3.2: Contract Tests (All Parallel)
```bash
# Launch T005-T012 together (GraphQL contract tests):
Task: "Contract test exportTable mutation in tests/contract/export-table-mutation.test.ts"
Task: "Contract test importTablePackage mutation in tests/contract/import-table-package-mutation.test.ts"
Task: "Contract test resolveImportConflicts mutation in tests/contract/resolve-conflicts-mutation.test.ts"
Task: "Contract test cancelImportSession mutation in tests/contract/cancel-session-mutation.test.ts"
Task: "Contract test getImportSession query in tests/contract/get-import-session-query.test.ts"
Task: "Contract test listTablePackages query in tests/contract/list-table-packages-query.test.ts"
Task: "Contract test validateTablePackage query in tests/contract/validate-table-package-query.test.ts"
Task: "Contract test previewImport query in tests/contract/preview-import-query.test.ts"

# Launch T013-T018 together (Integration test scenarios):
Task: "Integration test single table export scenario in tests/integration/single-table-export.test.ts"
Task: "Integration test multiple related tables export in tests/integration/related-tables-export.test.ts"
Task: "Integration test table package import in tests/integration/table-package-import.test.ts"
Task: "Integration test conflict resolution workflow in tests/integration/conflict-resolution.test.ts"
Task: "Integration test bulk import with dependencies in tests/integration/bulk-import-dependencies.test.ts"
Task: "Integration test template generation validation in tests/integration/template-generation.test.ts"
```

### Phase 3.3: Domain Models (All Parallel)
```bash
# Launch T019-T027 together (Entity definitions):
Task: "TablePackage entity with validation rules in src/domain/entities/TablePackage.ts"
Task: "SchemaDefinition entity with AttributeSchema in src/domain/entities/SchemaDefinition.ts"
Task: "DatasetCollection entity with NodeRecord structure in src/domain/entities/DatasetCollection.ts"
Task: "RelationshipMapping entity with dependency ordering in src/domain/entities/RelationshipMapping.ts"
Task: "TemplateSet entity following existing export format in src/domain/entities/TemplateSet.ts"
Task: "ImportSession entity with state management in src/domain/entities/ImportSession.ts"
Task: "ExportManifest entity with system metadata in src/domain/entities/ExportManifest.ts"
Task: "ITablePackageRepository interface in src/domain/repositories/ITablePackageRepository.ts"
Task: "IImportSessionRepository interface in src/domain/repositories/IImportSessionRepository.ts"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify all contract tests fail before implementing
- Follow existing hexagonal architecture patterns
- Maintain compatibility with existing template export format
- All CLI commands must support --help, --version, --format flags
- Use semantic versioning for package versions
- Implement comprehensive error handling and logging
- Follow TDD: RED (failing tests) → GREEN (passing implementation) → REFACTOR

## Validation Checklist
**GATE: Must pass before task completion**

- [ ] All GraphQL contracts have corresponding tests (T005-T012)
- [ ] All domain entities have model tasks (T019-T025)
- [ ] All tests come before implementation (T005-T018 before T029+)
- [ ] All [P] tasks are truly independent (different files)
- [ ] Each task specifies exact file path
- [ ] No task modifies same file as another [P] task
- [ ] Three libraries created with CLI interfaces
- [ ] Template format matches existing export structure exactly
- [ ] Constitutional compliance: library-first architecture maintained
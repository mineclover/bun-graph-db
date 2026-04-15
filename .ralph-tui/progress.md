# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- Table-scoped MCP schema cache invalidation should refresh only already-cached matching table server keys, resolving table id/identifier aliases when possible; table deletion should remove cached table servers instead of recreating them.
- Runtime updateNode validation should stay separate from createNode validation: transports normalize table context and identifier-keyed attributes, then `UpdateNodeUseCase` applies `validateProjectedNodeUpdateInput` so partial updates do not require all required create attributes.
- Downstream table docs/AI metadata freshness should be represented with the table schema projection `versionHash`, while persisted generated templates can be invalidated independently by marking `auto-generated` + `table:<id>` templates with stale metadata.
- Future shared schema extraction should keep pure projection/value-validation functions separate from repository/file/cache orchestration; generated transport shapes remain adapters over projections until both systems share the same value-level primitives.

---

## 2026-04-16 - US-004
- Implemented projection-based updateNode attribute validation with partial-update semantics.
- Added `validateProjectedNodeUpdateInput` so unknown updated attributes, enum violations, numeric constraint violations, and conflicting table context are reported as structured validation errors without requiring all required create attributes.
- Added `UpdateNodeUseCase` and wired it through DI, GraphQL `updateNode`, REST `PUT/PATCH /api/nodes/:nodeId`, and the table-scoped MCP update-node tool.
- Adjusted table-scoped MCP update input schemas so `attributes` allows partial projection updates instead of inheriting create-time required attributes.
- Existing valid create/update flows covered by focused use-case, projection, REST controller, and table MCP schema tests.
- `bun run typecheck`: pass.
- `bun run lint --max-diagnostics=20`: pass with the same 2 pre-existing warnings in `src/core/schema/TableSchemaProjection.ts`.
- Socket-bound GraphQL node mutation smoke did not run in this sandbox: `bun test tests/node-mutations-isolated.test.ts` failed with pre-existing environmental `Test port range exhausted (5500-5999)` from `tests/fixtures/test-graphql-server.ts`.
- Files changed: `index.ts`, `src/application/dtos/NodeDto.ts`, `src/application/use-cases/nodes/UpdateNode.ts`, `src/core/schema/TableSchemaProjection.ts`, `src/core/types/GraphQLTypes.ts`, `src/infrastructure/container/modules/GraphQLModule.ts`, `src/infrastructure/container/modules/UseCaseModule.ts`, `src/infrastructure/container/tokens/UseCaseTokens.ts`, `src/presentation/graphql/mutations/NodeMutations.ts`, `src/presentation/graphql/schema/types/node.graphql`, `src/presentation/http/controllers/GraphDbApiController.ts`, `src/presentation/http/routes/ApiRoutes.ts`, `src/presentation/mcp/factory/TableMcpServer.ts`, `tests/integration/mcp-table-projection-tools-list.test.ts`, `tests/unit/schema/table-schema-projection.test.ts`, `tests/unit/use-cases/UpdateNode.test.ts`, `.ralph-tui/progress.md`.
- **Learnings:**
  - Patterns discovered: update validation should project from the existing node table first, then reject any supplied request/table-scoped context that points elsewhere before persistence.
  - Patterns discovered: table-scoped MCP can use `updateNode` directly by passing the scoped tableId as request context, which turns cross-table node updates into the same structured table-mismatch error as GraphQL/REST.
  - Gotchas encountered: reusing create-node MCP attributes schema for update accidentally carries required create attributes into partial updates; update schemas need a cloned attributes object with `required: []`.
---

## 2026-04-16 - US-005
- Implemented table-scoped MCP schema cache invalidation through `TableMcpServerFactory.refreshServersForTableSchema`, which refreshes only cached servers matching the changed table and avoids warming uncached table servers.
- Added table cache removal through `removeMcpCacheForTableSchema` so table deletion clears affected table MCP server cache entries instead of trying to recreate deleted-table servers.
- Wired attribute create/update/delete flows to refresh the affected table schema cache in GraphQL and REST attribute controllers; attribute delete flow exists and is covered by the same table-scoped invalidation boundary.
- Wired AttributeType update/delete GraphQL flows to resolve attributes using the changed type and refresh the affected tables.
- Added focused tests for table-scoped factory behavior and for cached MCP tool schemas refreshing after a GraphQL attribute schema change.
- `bun test tests/unit/mcp-table-server-factory-cache.test.ts tests/integration/mcp-table-projection-tools-list.test.ts tests/unit/schema/table-schema-projection.test.ts tests/unit/schema/table-schema-projection-service.test.ts`: pass.
- `bun run typecheck`: pass.
- `bun run lint --max-diagnostics=20`: pass with the same 2 pre-existing warnings in `src/core/schema/TableSchemaProjection.ts`.
- Files changed: `src/presentation/mcp/factory/TableMcpServerFactory.ts`, `src/presentation/graphql/mutations/AttributeMutations.ts`, `src/presentation/graphql/mutations/TableMutations.ts`, `src/presentation/http/controllers/AttributeApiController.ts`, `tests/integration/mcp-table-projection-tools-list.test.ts`, `tests/unit/mcp-table-server-factory-cache.test.ts`, `.ralph-tui/progress.md`.
- **Learnings:**
  - Patterns discovered: schema mutations should call the table-scoped invalidation boundary with the affected table id(s); the factory is responsible for matching any cached id/identifier alias and preserving uncached-table behavior.
  - Patterns discovered: delete-table cache handling is a removal path, not a refresh path, because refreshing after deletion would validate and recreate against a missing table.
  - Gotchas encountered: AttributeType update/delete does not carry table ids directly, so affected tables must be derived through attributes using that attribute type before the type is changed or deleted.
---

## 2026-04-16 - US-006
- Added a projection freshness marker to `GetTableDocsUseCase` output: `schema.projectionVersionHash` and `aiMetadata.schemaInfo.projectionVersionHash` now reflect table, attribute, and attribute type schema changes without changing existing docs payload fields.
- Added generated-template invalidation through `TableTemplateAutoGenerator.markAutoGeneratedTemplatesStale`, tagging table-scoped auto-generated templates with `schema-stale` and a `schema-stale-at:*` marker.
- Wired template stale marking into attribute create, GraphQL attribute update/delete, GraphQL AttributeType update/delete, batch attribute create, and REST attribute update/delete flows while keeping MCP schema cache invalidation separate.
- Updated `TableTemplateAutoGenerator` to resolve real AttributeType data via `IAttributeTypeRepository.findByIds` when available, so generated setter/workflow templates use actual JSON data types instead of a misleading `dataType: 'string'` placeholder.
- Added focused tests for table docs freshness after AttributeType changes, template generator type resolution, generated template stale metadata, and attribute-create stale marking.
- `bun test tests/unit/table-docs-freshness.test.ts tests/unit/table-template-auto-generator.test.ts tests/unit/use-cases/CreateAttribute.test.ts tests/unit/schema/table-schema-projection.test.ts tests/unit/schema/table-schema-projection-service.test.ts tests/integration/mcp-table-projection-tools-list.test.ts`: pass.
- `bun run typecheck`: pass.
- `bun run lint --max-diagnostics=20`: pass with the same 2 pre-existing warnings in `src/core/schema/TableSchemaProjection.ts`.
- Files changed: `index.ts`, `src/application/dtos/TableDocsDto.ts`, `src/application/services/TableTemplateAutoGenerator.ts`, `src/application/use-cases/attributes/CreateAttribute.ts`, `src/application/use-cases/tables/GetTableDocs.ts`, `src/infrastructure/container/modules/GraphQLModule.ts`, `src/presentation/graphql/mutations/AttributeMutations.ts`, `src/presentation/graphql/schema/types/table.graphql`, `src/presentation/http/controllers/AttributeApiController.ts`, `tests/unit/table-docs-freshness.test.ts`, `tests/unit/table-template-auto-generator.test.ts`, `tests/unit/use-cases/CreateAttribute.test.ts`, `.ralph-tui/progress.md`.
- **Learnings:**
  - Patterns discovered: table docs and AI metadata are generated dynamically, so a deterministic projection hash is the safest backward-compatible freshness marker for downstream consumers.
  - Patterns discovered: generated template invalidation should use the persisted template repository and `auto-generated`/`table:<id>` tags, not table-scoped MCP server cache wiring.
  - Gotchas encountered: AttributeType update/delete only has the type id, so affected table ids must be resolved from attributes before the type changes or is removed.
---

## 2026-04-16 - US-007
- Added `docs/development/SHARED_SCHEMA_ENGINE_BOUNDARY.md`, documenting a future shared `SchemaEngine` interface boundary between OA SDK and bun-graph-db.
- Distinguished pure schema functions from repository-backed projection services, using `projectTableSchema()`, projected node validation, and `TableSchemaProjectionService.project()` as the current bun-graph-db split.
- Explained why table-specific shapes remain generated projections over runtime metadata instead of static GraphQL/REST/MCP server contracts.
- Mapped OA SDK concepts to bun-graph-db concepts for schema validation, `$ref` graphs, diagnostics, source coordinates, type generation, and incremental invalidation.
- Listed what is explicitly not shared yet and defined criteria for when to extract a shared package or module.
- Linked the new design note from `docs/README.md`.
- `bun test tests/unit/schema/table-schema-projection.test.ts tests/unit/schema/table-schema-projection-service.test.ts tests/integration/mcp-table-projection-tools-list.test.ts`: pass.
- `bun run typecheck`: pass.
- `bun run lint --max-diagnostics=20`: pass with the same 2 pre-existing warnings in `src/core/schema/TableSchemaProjection.ts`.
- Files changed: `docs/development/SHARED_SCHEMA_ENGINE_BOUNDARY.md`, `docs/README.md`, `.ralph-tui/progress.md`.
- **Learnings:**
  - Patterns discovered: the candidate shared boundary is the value-level schema graph contract, not either system's repository, file loader, cache, transport, or generated output layer.
  - Patterns discovered: extraction should wait until both systems can consume the same projection/refs/diagnostics/sources/versionHash shape without mirror adapters.
  - Gotchas encountered: documentation needs to name current downstream integrations, but those integrations should be evidence for the boundary rather than responsibilities moved into the shared engine.
---

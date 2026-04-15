# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- Baseline smoke checks can avoid socket binding by combining `createTestEnvironment`, `createGraphQLYoga`, and `createGraphQLExecutor`; table-scoped MCP can be smoked in-process through `createTableMcpMiddleware` by routing the configured GraphQL endpoint to the Yoga fetch handler.
- Runtime table MCP schema wiring should keep repository-backed projection construction at the composition root, pass a minimal `project()` provider through `createTableMcpMiddleware`/`TableMcpServerFactory`, and let table tools consume `SchemaMapper.mapTableProjectionToMcpInputSchema(projection)`.
- Runtime createNode validation should stay in `CreateNodeUseCase`: GraphQL, REST, and table-scoped MCP normalize payloads to identifier-keyed attributes, then the use case obtains `project({ tableId })` and applies `validateProjectedNodeInput` before node or attribute persistence.
- GraphQL/MCP attribute values may arrive as strings even when the projected schema is numeric/boolean/object/array; coerce stringified JSON using the projected attribute value schema before validation so transport compatibility does not bypass projection constraints.

---

## 2026-04-15 - US-001
- Established the current bun-graph-db runtime baseline without changing runtime behavior.
- `bun install --frozen-lockfile`: pass; Bun checked 751 installs across 638 packages and reported no changes.
- Focused projection tests: pass; `bun test tests/unit/schema/table-schema-projection.test.ts tests/unit/schema/table-schema-projection-service.test.ts` ran 6 tests with 0 failures.
- `bun run typecheck`: pass.
- `bun run lint --max-diagnostics=20`: pass with 2 warnings in `src/core/schema/TableSchemaProjection.ts` (`noNonNullAssertion`, `noPrototypeBuiltins`); the command exited 0.
- `bun run build`: pass; bundled `index.ts` to ignored `dist/index.js`.
- GraphQL health smoke: pass using isolated in-process Yoga helper against a temporary SQLite database; `healthCheck` returned `status: "OK"`, `database: true`, `version: "1.0.0"`.
- Table-scoped MCP smoke: pass using `createTableMcpMiddleware` in-process with an isolated table; GET `/sub/59/mcp` and JSON-RPC `tools/list` both returned 200 with 24 table tools, including table metadata tooling.
- Files changed: `.ralph-tui/progress.md` only.
- **Learnings:**
  - Patterns discovered: `tests/fixtures/graphql-yoga-helper.ts` is the reliable no-socket path for GraphQL health checks in restricted environments.
  - Patterns discovered: `src/presentation/mcp/routes/mcp-routes.ts` exposes middleware that can be called directly for table MCP smoke coverage when its GraphQL fetch dependency is routed to an in-process Yoga handler.
  - Gotchas encountered: fixed-port helpers such as `tests/fixtures/test-server-manager.ts` can report test port exhaustion in this sandbox because localhost binds fail with `EPERM`; this is environmental and not a runtime health failure.
  - Gotchas encountered: an external auto-commit occurred during the baseline and removed the previous untracked `.ralph-tui` directory, so the progress file was recreated with the required entry.
---

## 2026-04-15 - US-002
- Implemented table-scoped MCP projection wiring by constructing `TableSchemaProjectionService` at the runtime composition root and passing its `project()` boundary through MCP routes/factory/server.
- Added table-scoped create/update node tools whose `inputSchema.attributes` is derived from `SchemaMapper.mapTableProjectionToMcpInputSchema(projection)`, with projection metadata and diagnostics surfaced in MCP tool `_meta`.
- Preserved existing table-scoped tools in `tools/list` while adding projection-backed node tools.
- Added a focused in-process MCP/Yoga integration test verifying `tools/list` includes current projected table attributes and required attributes.
- Focused projection tests passed: `bun test tests/unit/schema/table-schema-projection.test.ts tests/unit/schema/table-schema-projection-service.test.ts`.
- Focused MCP test passed: `bun test tests/integration/mcp-table-projection-tools-list.test.ts`.
- `bun run typecheck`: pass.
- `bun run lint --max-diagnostics=20`: pass with the same 2 warnings documented in US-001 (`src/core/schema/TableSchemaProjection.ts` non-null assertion and `Object.prototype.hasOwnProperty.call`).
- Files changed: `index.ts`, `src/application/services/McpToolRegistry.ts`, `src/presentation/mcp/factory/TableMcpServer.ts`, `src/presentation/mcp/factory/TableMcpServerFactory.ts`, `src/presentation/mcp/routes/mcp-routes.ts`, `src/presentation/mcp/schema/SchemaMapper.ts`, `tests/integration/mcp-table-projection-tools-list.test.ts`, `.ralph-tui/progress.md`.
- **Learnings:**
  - Patterns discovered: table-scoped MCP can expose dynamic schema without coupling core projection code to repositories by injecting a narrow projection provider into the presentation MCP boundary.
  - Patterns discovered: MCP tool diagnostics can be carried safely in `_meta.tableSchemaProjection` while leaving `inputSchema` focused on MCP JSON Schema.
  - Gotchas encountered: GraphQL node attribute mutation inputs still use identifier arrays/string values, so table-scoped MCP execution maps projected `attributes` objects to `attributesByIdentifier`; deeper create/update validation is left for US-003/US-004.
---

## 2026-04-15 - US-003
- Implemented projection-based createNode attribute validation in `CreateNodeUseCase` through a narrow `project({ tableId })` provider wired at the DI composition root.
- Routed GraphQL `createNodeWithAttributes` through `CreateNodeUseCase`, which brings the table-scoped MCP create tool onto the same validation/persistence path as GraphQL `createNode` and REST `POST /api/nodes`.
- Added structured projection validation errors for missing required attributes, unknown attributes, enum violations, and numeric constraint violations, and surfaced validation error lists through GraphQL and REST error helpers.
- Preserved valid create flows, including stringified GraphQL/MCP numeric values, by coercing transport strings against the projected attribute value schema before validation and persistence.
- Updated table MCP execution so GraphQL mutation payloads with `success: false` become MCP tool errors instead of successful envelopes with failed payloads.
- Focused tests passed: `bun test tests/unit/use-cases/CreateNode.test.ts`.
- REST controller unit tests passed: `bun test tests/unit/rest-api-controllers.test.ts`.
- Focused projection tests passed: `bun test tests/unit/schema/table-schema-projection.test.ts tests/unit/schema/table-schema-projection-service.test.ts`.
- Table MCP projection smoke passed: `bun test tests/integration/mcp-table-projection-tools-list.test.ts`.
- `bun run typecheck`: pass.
- `bun run lint --max-diagnostics=20`: pass with the same 2 pre-existing warnings documented in US-001/US-002 (`src/core/schema/TableSchemaProjection.ts` non-null assertion and `Object.prototype.hasOwnProperty.call`).
- Socket-bound GraphQL node mutation smoke did not run in this sandbox: `bun test tests/node-mutations-isolated.test.ts` failed with pre-existing environmental `Test port range exhausted (5500-5999)` from `tests/fixtures/test-graphql-server.ts`.
- Files changed: `src/application/use-cases/nodes/CreateNode.ts`, `src/infrastructure/container/modules/UseCaseModule.ts`, `src/presentation/graphql/mutations/NodeMutations.ts`, `src/presentation/http/utils/errorHelpers.ts`, `src/presentation/http/utils/responseHelpers.ts`, `src/presentation/mcp/factory/TableMcpServer.ts`, `tests/unit/use-cases/CreateNode.test.ts`, `.ralph-tui/progress.md`.
- **Learnings:**
  - Patterns discovered: the shared createNode boundary is the right enforcement point for GraphQL, REST, and table-scoped MCP because each presentation layer can normalize input shape while the use case owns table projection lookup and persistence ordering.
  - Patterns discovered: projection validation errors can travel as `ValidationException.context.validationErrors`, then GraphQL/REST can fan those out into existing `{ message, code, field }` response shapes without changing schema contracts.
  - Gotchas encountered: `CreateNodeWithAttributesInput.value` is still `String!`, so MCP numeric values are stringified on the GraphQL hop and must be rehydrated from the projection schema before validation.
  - Gotchas encountered: socket-based isolated GraphQL tests can fail in this sandbox even when in-process Yoga/MCP checks pass; prefer the no-socket helper pattern for smoke coverage.
---

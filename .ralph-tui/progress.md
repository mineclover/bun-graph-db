# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- Table-scoped MCP schema cache invalidation should refresh only already-cached matching table server keys, resolving table id/identifier aliases when possible; table deletion should remove cached table servers instead of recreating them.
- Runtime updateNode validation should stay separate from createNode validation: transports normalize table context and identifier-keyed attributes, then `UpdateNodeUseCase` applies `validateProjectedNodeUpdateInput` so partial updates do not require all required create attributes.

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

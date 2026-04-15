# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

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

# Shared SchemaEngine Boundary

## Status

Design note. Do not extract a shared package from this document alone.

This document records the boundary that OA SDK and bun-graph-db can converge on after the current table schema projection work stabilizes. It builds on [SCHEMA_PROJECTION_EXPERIMENT.md](./SCHEMA_PROJECTION_EXPERIMENT.md), `src/core/schema/TableSchemaProjection.ts`, and the repository-backed `src/application/services/TableSchemaProjectionService.ts`.

## Goal

Define a future `SchemaEngine` interface that can be shared without making either system inherit the other's storage model, API shape, or runtime orchestration.

The shared part should be a pure schema engine: normalize schema inputs, construct a `$ref` graph, validate values, report diagnostics, preserve source coordinates, produce type-generation metadata, and expose version fingerprints for invalidation.

The non-shared part should remain system-specific: loading schema sources from OpenAPI files or graph repositories, deciding when projections are stale, mapping generated projections into GraphQL, MCP, REST, docs, AI metadata, or generated TypeScript files.

## Proposed Interface Shape

The names below are intentionally provisional. The important boundary is that the engine accepts already-loaded schema material and returns deterministic projection artifacts; it does not read files, query repositories, own caches, or mutate generated outputs.

```ts
export interface SchemaEngine<TSource, TProjection, TValue = unknown> {
  project(input: SchemaProjectInput<TSource>): SchemaProjectResult<TProjection>
  validate(input: SchemaValidateInput<TProjection, TValue>): SchemaValidateResult
  collectRefs(input: SchemaRefInput<TProjection>): SchemaRefGraph
  fingerprint(input: SchemaFingerprintInput<TSource | TProjection>): string
}

export interface SchemaProjectResult<TProjection> {
  projection: TProjection
  refs: SchemaRefEdge[]
  diagnostics: SchemaDiagnostic[]
  sources: Record<string, SchemaSourceCoordinate>
  versionHash: string
  typeTargets?: SchemaTypeTarget[]
}
```

For bun-graph-db, this would correspond to the pure behavior currently represented by `projectTableSchema()`, `validateProjectedNodeInput()`, and `validateProjectedNodeUpdateInput()` in `src/core/schema/TableSchemaProjection.ts`.

For OA SDK, this corresponds to the existing pure/parser-codegen concepts around `SchemaAlgebra`, `$ref` graph resolution, schema validation diagnostics, source-location lookup, and typegen alias analysis.

## Pure Engine vs Projection Services

The shared engine must stay pure.

| Boundary | Shared later | bun-graph-db today | OA SDK today |
|---|---|---|---|
| Schema input model | Yes, after convergence | `TableProjectionInput` loaded from table, attribute, and attribute type values | Parsed OpenAPI/JSON Schema fragments loaded from files |
| Projection construction | Yes | `projectTableSchema(input)` | Schema folds, deref/ref graph, schema-position alias analysis |
| Runtime value validation | Yes, if semantics converge | `validateProjectedNodeInput()` and `validateProjectedNodeUpdateInput()` | Request/spec validation and JSON Schema validation paths |
| Repository/file access | No | `TableSchemaProjectionService.project({ tableId | identifier })` | parse/load pipeline and external ref resolver file cache |
| Cache invalidation orchestration | No | MCP cache refresh/removal, docs freshness, generated template stale markers | WorkspaceIndex dirty detection and CLI/dev cache refresh |
| Transport mapping | No | `SchemaMapper.mapTableProjectionToMcpInputSchema()` and GraphQL/REST use cases | client/router/typegen/CLI output adapters |

`TableSchemaProjectionService` is the current bun-graph-db projection service boundary. It resolves the table id or identifier, reads repositories, converts domain entities into `TableProjectionInput`, and then delegates to the pure projection function. A future shared package should not import that service or any repository interface.

## Why Table Shapes Stay Generated Projections

Dynamic table-specific shapes are generated projections, not static server contracts.

bun-graph-db tables are runtime data. Attributes and attribute types can be created, renamed, constrained, or deleted after the server starts. Encoding each table as a static GraphQL, REST, or MCP contract would make server schemas drift from data and would force schema mutations to rewrite transport contracts.

The stable contract stays metadata-driven:

```txt
createNode(tableId, content, attributes)
updateNode(id, input)
searchNodes(filter)
table-scoped MCP tools derived from the current projection
```

The table-specific contract is a projection generated from the current table metadata:

```txt
Table + Attribute + AttributeType
  -> TableSchemaProjection
  -> validation / MCP input schema / docs / AI metadata / optional type generation
```

This keeps static API surfaces small while still letting consumers see precise table-specific schemas through projection artifacts. The same rule should apply to OA SDK integration points: generated client/router/type shapes can be derived from schema documents, but the shared engine should not make those generated shapes the engine's own server contract.

## Concept Mapping

| Concept | OA SDK | bun-graph-db |
|---|---|---|
| Schema validation | JSON Schema/OpenAPI validation, lint, request-shape validation, and schema algebra folds | Projection value validation through `validateProjectedNodeInput()` and `validateProjectedNodeUpdateInput()` |
| `$ref` graph | `resolveRefGraph()` tracks internal/external refs, nested external refs, cycles, and missing targets | `TableSchemaProjection.refs` tracks table attributes, attribute definitions, attribute type references, and value schema references |
| Diagnostics | Parser, ref graph, lint, validation, and typegen diagnostics with stable codes | `ProjectionDiagnostic` for projection-time issues and `ProjectionValidationError` for runtime value issues |
| Source coordinates | File path, JSON Pointer, YAML line/column via source location indexes | Database coordinates through `ProjectionSource`: entity kind, entity id, and pointer |
| Type generation | `generateTypes()`, `schemaToTs()`, external schema alias metadata, collision diagnostics | Future optional helper types from `TableSchemaProjection.document`, `attributeValueSchemas`, and generated node input projections |
| Incremental invalidation | `WorkspaceIndex` stores file hashes, refs, diagnostics, source locations, and type aliases for dirty detection | `versionHash` marks table schema projection freshness; table-scoped MCP cache invalidation refreshes/removes cached table servers; generated templates can be marked stale independently |

The common abstraction is not "OpenAPI" or "table". It is a schema graph with typed source coordinates, diagnostics, validation semantics, and deterministic fingerprints.

## Not Shared Yet

The following should remain local until both projects prove matching needs:

- Repository access, database queries, and domain entity conversion.
- File system loading, YAML parsing, external document caching, and CLI watch orchestration.
- GraphQL schema generation and GraphQL resolver contracts.
- REST route contracts and transport-specific coercion.
- MCP server construction, table-scoped server cache keys, and tools/list payload shape.
- Docs and AI metadata formatting.
- Generated template invalidation and template repository metadata.
- Concrete TypeScript output formatting, import paths, package exports, and generated file layout.
- Persistent cache storage such as `.oa-cache/state.sqlite` or any bun-graph-db database table.
- Compatibility policy for public package exports.

## Extraction Criteria

Extract a shared package or module only when all of the following are true:

- OA SDK and bun-graph-db both need the same value-level primitives: projection result, refs, diagnostics, sources, validation result, and version hash.
- The pure engine API can be tested without repositories, file I/O, SQLite, MCP, GraphQL, REST, or CLI state.
- At least two call sites in each system can consume the same interface without adapter methods that simply mirror old system-specific names.
- Diagnostic codes, source coordinate shape, and `$ref` edge semantics are stable enough to version.
- The shared package can preserve current behavior through adapter tests around `projectTableSchema()` and `TableSchemaProjectionService.project()`.
- Incremental invalidation remains an outer layer: OA SDK can keep `WorkspaceIndex`, and bun-graph-db can keep table-scoped MCP cache refresh/removal plus docs/template freshness markers.
- Package ownership, release cadence, and public export policy are clear. If either project still needs private iteration, keep the code local.

Until those conditions are met, prefer copying vocabulary into tests and docs over extracting code.

## Current bun-graph-db Boundary

The active boundary is:

```txt
src/application/services/TableSchemaProjectionService.ts
  reads ITableRepository / IAttributeRepository / IAttributeTypeRepository
  maps domain entities to TableProjectionInput
  calls projectTableSchema()

src/core/schema/TableSchemaProjection.ts
  stays pure
  projects JSON Schema $defs
  records refs, diagnostics, sources, versionHash
  validates create/update node payloads
```

Downstream adapters then consume the projection:

- `src/presentation/mcp/schema/SchemaMapper.ts` maps table projections into MCP input schemas.
- Table-scoped MCP cache invalidation refreshes only already-cached matching table servers and removes cached servers when a table is deleted.
- `GetTableDocsUseCase` exposes the projection `versionHash` as docs and AI metadata freshness.
- Generated templates are invalidated independently by marking matching `auto-generated` and `table:<id>` templates stale.

These downstream details are important integration evidence, but they are not part of the future shared `SchemaEngine` package.

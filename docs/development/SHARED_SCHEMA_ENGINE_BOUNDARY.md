# Shared SchemaEngine Boundary

## Status

Design note for the future shared engine boundary. The current shared contract package exists, but do not expand it into a shared engine from this document alone.

This document records the boundary that OA SDK and bun-graph-db can converge on after the current table schema projection work stabilizes. It builds on [SCHEMA_PROJECTION_EXPERIMENT.md](./SCHEMA_PROJECTION_EXPERIMENT.md), `src/core/schema/TableSchemaProjection.ts`, and the repository-backed `src/application/services/TableSchemaProjectionService.ts`.

## Goal

Define a future `SchemaEngine` interface that can be shared without making either system inherit the other's storage model, API shape, or runtime orchestration.

The shared part should be a pure schema engine: normalize schema inputs, construct a `$ref` graph, validate values, report diagnostics, preserve source coordinates, produce type-generation metadata, and expose version fingerprints for invalidation.

The non-shared part should remain system-specific: loading schema sources from OpenAPI files or graph repositories, deciding when projections are stale, mapping generated projections into GraphQL, MCP, REST, docs, AI metadata, or generated TypeScript files.

## As-Is / To-Be Alignment

As-is, sharing is limited to the OpenAPI projection contract and validation boundary:

- OA SDK keeps its native source model: file-backed OpenAPI definition fragments, Definition Registry nodes, target configs, source-location indexes, CLI orchestration, and workspace indexing.
- bun-graph-db keeps its native source model: runtime table, attribute, and attribute type metadata loaded from graph repositories, then converted into `TableProjectionInput`.
- OpenAPI 3.2 is the validation and exchange projection interface. OA SDK emits `full-api-document`; bun-graph-db emits `component-bundle` for reusable table schemas and `operation-contract` for create/update node request contracts.
- `@oa-sdk/openapi-projection-contract` is a contract and validation package, not a shared source loader or engine. It defines result types, profiles, root-level `x-schema-engine-*` projection metadata, and `validateOpenApiProjection()`.
- bun-graph-db table-scoped MCP tools/list schema generation consumes the OpenAPI operation-contract projection first and keeps the direct table projection mapper only as a compatibility fallback.
- bun-graph-db table-scoped MCP tools/call can export current OpenAPI projection results through `get-openapi-projection-{tableId}` without making MCP the source of truth.

To-be, implementation sharing remains optional and gated:

- Native source models remain separate unless both projects intentionally design a new source-neutral model.
- Cross-project exchange should continue through OpenAPI 3.2 projections and the shared envelope before any shared engine code is considered.
- Future shared implementation can only cover pure, already-loaded schema graph primitives. It must not absorb repositories, file scanners, SQLite cache state, GraphQL/REST/MCP transports, docs formatting, or generated output layout.

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

## Shared Vocabulary Contract

The first convergence step is the shared `@oa-sdk/openapi-projection-contract` vocabulary package, not a shared schema engine implementation. Both projects should be able to map native projection artifacts into this shape with thin adapters while keeping source loading, repositories, GraphQL, MCP, REST, storage, and cache invalidation local.

In this workspace, bun-graph-db consumes the contract as a development-only local file dependency:

```json
"@oa-sdk/openapi-projection-contract": "file:../../packages/openapi-projection-contract"
```

That path is a repository-relative integration path for local development. It should be replaced by a published package version or an explicitly vendored copy before bun-graph-db is consumed outside this repository layout. If the contract package `dist` output is missing in a fresh checkout, build `packages/openapi-projection-contract` before running bun-graph-db type checks that resolve the package export.

```ts
export type OpenApiProjectionResult<TProjection = Record<string, unknown>> = {
  profile: 'component-bundle' | 'operation-contract' | 'full-api-document'
  projection: TProjection
  refs: SchemaRefEdge[]
  diagnostics: SchemaDiagnostic[]
  sources: Record<string, SchemaSourceCoordinate>
  versionHash: string
  typeTargets?: SchemaTypeTarget[]
}

export type SchemaDiagnostic = {
  severity: 'error' | 'warning' | 'info'
  code: string
  message: string
  source?: SchemaSourceCoordinate
}

export type SchemaSourceCoordinate =
  | {
      kind: 'file'
      filePath: string
      pointer: string
      line?: number
      column?: number
    }
  | {
      kind: 'db'
      entity: string
      id: string
      pointer: string
    }

export type SchemaRefEdge = {
  from: string
  to?: string
  ref: string
  kind: string
  source: SchemaSourceCoordinate
}

export type SchemaValidateResult = {
  valid: boolean
  diagnostics: SchemaDiagnostic[]
}

export type SchemaTypeTarget = {
  id: string
  name: string
  kind: string
  source?: SchemaSourceCoordinate
}
```

Mapping status:

- OA SDK adapter test maps definition builder output into `OpenApiProjectionResult`.
- bun-graph-db adapter tests import contract package types and map `TableSchemaProjection` into `component-bundle` and `operation-contract` OpenAPI projections without importing OA SDK parser or codegen internals.
- Neither adapter imports the other project's source-specific loading, repository, GraphQL, MCP, REST, storage, or CLI implementation.
- Extending beyond the contract package remains blocked until the adapters stay thin across more than one real call site in each project.

## Projection Profiles and Consumers

| Profile | bun-graph-db use | OA SDK use | Intended consumers |
|---|---|---|---|
| `component-bundle` | Table metadata projected as reusable OpenAPI `components.schemas` with empty `paths`. | Not the primary OA SDK builder output. | Component validators, docs/AI metadata, MCP projection export, and tooling that needs reusable schemas without operation paths. |
| `operation-contract` | Table create/update node request contracts with synthetic table-specific paths, requestBody refs, and a required update `nodeId` path parameter. | Possible future operation-level validation fixtures. | MCP tools/list schema generation, MCP projection export, request payload contract tests, and clients that need operation input shapes without a complete API document. |
| `full-api-document` | Stable bun-graph-db REST and MCP protocol endpoints only, with table projections linked through export operations instead of inlined. | Definition Builder target output and `oa-gen build-spec` programmatic validation. | OpenAPI validators, stable client/router/type/mock flows, and complete API exchange artifacts for fixed endpoint contracts. |

Profiles describe the emitted OpenAPI 3.2 projection shape. They do not make the producer's native model shared.

The bun-graph-db full-document scope is defined in
[FULL_OPENAPI_DOCUMENT_SCOPE.md](./FULL_OPENAPI_DOCUMENT_SCOPE.md). Runtime
table shapes remain `component-bundle` or `operation-contract` projection
artifacts with their own `versionHash`.

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

`TableSchemaProjectionService` is the current bun-graph-db projection service boundary. It resolves the table id or identifier, reads repositories, converts domain entities into `TableProjectionInput`, and then delegates to the pure projection function. The shared contract package and any future shared engine should not import that service or any repository interface.

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

The future implementation abstraction is not "OpenAPI" or "table". OpenAPI 3.2 is the current validation and exchange projection interface; any later shared engine would need to stay one layer below that as a schema graph with typed source coordinates, diagnostics, validation semantics, and deterministic fingerprints.

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

These are gates for any future shared implementation beyond `@oa-sdk/openapi-projection-contract`. Extract a shared package or module only when all of the following are true:

- OA SDK and bun-graph-db both need the same value-level primitives: projection result, refs, diagnostics, sources, validation result, and version hash.
- The pure engine API can be tested without repositories, file I/O, SQLite, MCP, GraphQL, REST, or CLI state.
- At least two production call sites in each system can consume the same interface without adapter methods that simply mirror old system-specific names.
- Diagnostic codes, source coordinate shape, and `$ref` edge semantics are stable enough to version.
- The shared package can preserve current behavior through adapter tests around `projectTableSchema()` and `TableSchemaProjectionService.project()`.
- Incremental invalidation remains an outer layer: OA SDK can keep `WorkspaceIndex`, and bun-graph-db can keep table-scoped MCP cache refresh/removal plus docs/template freshness markers.
- Package ownership, release cadence, and public export policy are clear. If either project still needs private iteration, keep the code local.

Until those conditions are met, keep implementation local and share only the OpenAPI projection contract, validation entrypoint, adapter tests, and boundary docs.

## MCP Schema Generation Migration Notes

The bun-graph-db MCP migration is an adapter migration, not an engine migration:

- `TableSchemaProjectionService.project()` remains the table projection service boundary. It still loads repositories and delegates to pure projection functions.
- Table MCP schema generation should build `toTableSchemaOpenApiOperationContractProjectionResult(projection)`, validate it with `validateOpenApiProjection()`, then map requestBody schemas through `SchemaMapper.mapOpenApiProjectionToMcpNodeToolSchemas()`.
- The MCP mapper resolves `#/components/schemas/*` refs into concrete JSON Schema properties because current MCP clients and validators expect inspectable `type`, `properties`, and `required` fields in each tool input schema.
- `tableId` and `tableIdentifier` const body fields remain server/path context and should not be exposed as client arguments. The update tool combines required path parameters such as `nodeId` with the partial update body schema.
- Projection diagnostics stay in MCP `_meta.tableSchemaProjection`; invalid OpenAPI projections set `usable: false` and fall back to safe permissive schemas.
- `SchemaMapper.mapTableProjectionToMcpInputSchema()` is retained only as a compatibility fallback while operation-contract mapping proves stable. New MCP schema behavior should prefer the OpenAPI projection path.

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

- `src/core/schema/TableSchemaOpenApiProjection.ts` maps table projections into `component-bundle` and `operation-contract` OpenAPI 3.2 projections.
- `src/presentation/mcp/schema/SchemaMapper.ts` maps `operation-contract` projections into MCP input schemas, with direct table projection mapping retained only as a compatibility fallback.
- `src/presentation/mcp/factory/TableMcpServer.ts` exposes current table OpenAPI projection artifacts through `get-openapi-projection-{tableId}` as an MCP consumer surface.
- Table-scoped MCP cache invalidation refreshes only already-cached matching table servers and removes cached servers when a table is deleted.
- `GetTableDocsUseCase` exposes the projection `versionHash` as docs and AI metadata freshness.
- Generated templates are invalidated independently by marking matching `auto-generated` and `table:<id>` templates stale.

These downstream details are important integration evidence, but they are not part of the future shared `SchemaEngine` package.

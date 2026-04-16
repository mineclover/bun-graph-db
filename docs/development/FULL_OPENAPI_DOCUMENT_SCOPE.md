# Full OpenAPI Document Scope

## Purpose

This document defines the scope of the future bun-graph-db `full-api-document`
OpenAPI projection before the static document builder is implemented.

The `full-api-document` profile is for stable API discovery. It must document
fixed REST endpoints and MCP JSON-RPC protocol endpoints without freezing
runtime table schemas into a stale static artifact.

## Profile Boundary

`full-api-document` covers stable bun-graph-db endpoints only:

- REST operations whose URL shape and payload shape are part of the server API.
- MCP transport endpoints such as `/mcp` and `/sub/{tableId}/mcp`.
- MCP JSON-RPC envelope shapes for protocol methods such as `initialize`,
  `tools/list`, and `tools/call`.
- Stable discovery/export operations that tell clients how to fetch current
  table projections.

`full-api-document` does not mean "inline every current table shape." Runtime
tables are data. Their attributes and attribute types can change after server
startup, so their exact schemas belong in projection exports, not in the static
API document.

## Runtime Table Schema Access

Runtime table schemas remain available through table projection endpoints:

- REST: `GET /api/tables/:tableId/openapi-projection?profile=component-bundle`
- REST: `GET /api/tables/:tableId/openapi-projection?profile=operation-contract`
- GraphQL: `tableOpenApiProjection(tableId, identifier, profile)`
- Table-scoped MCP: `get-openapi-projection-{tableId}` through
  `/sub/:tableId/mcp`

The static full document may document these export surfaces and their profile
parameter. It should reference or link to the projection export operation when
a table-specific schema is needed.

It must not eagerly inline table projection output into the static document:

- Do not add a generated OpenAPI path for every runtime table.
- Do not copy `component-bundle` `components.schemas` into the full document.
- Do not copy `operation-contract` table-specific create/update paths into the
  full document.
- Do not snapshot MCP table tool argument schemas in the full document. Clients
  should discover current table tools through `tools/list` or the projection
  export tool.

## Projection Profiles

Use the narrowest profile that matches the client task:

| Profile | Producer scope | Use when |
|---|---|---|
| `full-api-document` | Stable REST and MCP protocol endpoint document. | A client needs API discovery for fixed server surfaces, transport contracts, or a starting point for stable client tooling. |
| `component-bundle` | Current table metadata as reusable OpenAPI 3.2 `components.schemas`. | A client needs reusable schemas for one runtime table. |
| `operation-contract` | Current table create/update node contracts with request-body schemas. | A client needs request contracts for one runtime table's node operations. |

Table-scoped projection export currently supports `component-bundle` and
`operation-contract` only. It must reject `full-api-document` because a
table-scoped server exports one table projection, not a whole API document.

## Freshness Guidance

Dynamic projection consumers must treat `versionHash` as the schema freshness
marker for the projection they fetched.

- Cache table projections by `{ tableId or identifier, profile, versionHash }`.
- Re-fetch a projection after table, attribute, or attribute type mutations.
- Re-fetch a projection when table docs or AI metadata report a different
  projection version hash.
- Treat a different `versionHash` as a different table schema contract, even if
  the stable full document has not changed.

`versionHash` on a table projection describes runtime table schema content. It
is not a substitute for the static full document's own version or build hash.
If a future `full-api-document` result also carries `versionHash`, that hash
should describe the stable API document content, not the set of runtime table
schemas present in storage at the time of generation.

## Non-Goals

The static full document is not responsible for:

- Client, router, or type generation over arbitrary runtime table shapes.
- Producing table-specific generated clients from one static server document.
- Freezing MCP table tool argument schemas that are derived from live table
  metadata.
- Supporting `full-api-document` from table-scoped projection exports.
- Replacing REST, GraphQL, or table-scoped MCP projection export.
- Coupling OpenAPI document generation to repository state or table cache state.

Clients that need generated code for runtime table shapes should fetch an
explicit table projection profile, validate it, record its `versionHash`, and
generate from that projection snapshot.

## Builder Guidance

When the static full document builder is added, tests should assert that it:

- Includes stable projection export endpoints and MCP protocol endpoints.
- Documents `component-bundle` and `operation-contract` as table projection
  profiles.
- Does not include generated table-specific component names or paths.
- Does not change when table attributes change unless the stable endpoint
  contract itself changes.

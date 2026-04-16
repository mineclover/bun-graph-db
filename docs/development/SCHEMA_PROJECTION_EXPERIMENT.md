# Schema Projection Experiment

## Purpose

This experiment treats bun-graph-db table metadata as a runtime schema source.
Instead of fixing each dynamic table as a static server contract, a table is projected into a `$defs`-based JSON Schema document.

The goal is to test whether each data-model element can become a `$ref`-addressable definition:

- `Table`
- `Attribute`
- `AttributeType`
- table-specific node input
- table-specific attributes object

## Current Prototype

Implementation:

- `src/core/schema/TableSchemaProjection.ts`
- `src/application/services/TableSchemaProjectionService.ts`
- `src/presentation/mcp/schema/SchemaMapper.ts` (`mapTableProjectionToMcpInputSchema`)
- `src/application/use-cases/nodes/CreateNode.ts`
- `src/application/use-cases/nodes/UpdateNode.ts`
- `src/presentation/mcp/factory/TableMcpServer.ts`
- `src/presentation/mcp/factory/TableMcpServerFactory.ts`
- `src/application/services/TableTemplateAutoGenerator.ts`
- `src/application/use-cases/tables/GetTableDocs.ts`

Focused tests:

- `tests/unit/schema/table-schema-projection.test.ts`
- `tests/unit/schema/table-schema-projection-service.test.ts`
- `tests/unit/use-cases/CreateNode.test.ts`
- `tests/unit/use-cases/UpdateNode.test.ts`
- `tests/unit/mcp-table-server-factory-cache.test.ts`
- `tests/unit/table-docs-freshness.test.ts`
- `tests/unit/table-template-auto-generator.test.ts`
- `tests/integration/mcp-table-projection-tools-list.test.ts`
- `tests/integration/projection-graphql-mcp-smoke.test.ts`

The prototype exports:

- `projectTableSchema(input)`
- `validateProjectedNodeInput(data, projection)`
- `validateProjectedNodeUpdateInput(data, projection)`
- `TableSchemaProjectionService.project({ tableId | identifier })`
- `SchemaMapper.mapTableProjectionToMcpInputSchema(projection)`
- `SchemaMapper.mapOpenApiProjectionToMcpNodeToolSchemas(projection)`
- table-scoped MCP `get-openapi-projection-{tableId}` export tool

## Projection Shape

For a table such as `project_tasks`, the projection creates:

```txt
$defs.Table_ProjectTasks
$defs.Attribute_Status
$defs.AttributeType_Status
$defs.NodeAttributes_ProjectTasks
$defs.NodeInput_ProjectTasks
```

`NodeInput_*` is the root schema.

```txt
NodeInput_ProjectTasks
  tableId: const table id
  content: string
  attributes: $ref -> NodeAttributes_ProjectTasks

NodeAttributes_ProjectTasks
  status: $ref -> AttributeType_Status
  priority: $ref -> AttributeType_Priority
```

The projection also emits:

- `refs`: schema-level dependency edges
- `sources`: pointer -> database source coordinates
- `versionHash`: stable hash of table/attribute/attributeType metadata
- `diagnostics`: missing attribute type, invalid JSON validation schema, invalid JSON type

`TableSchemaProjectionService` reads the runtime table definition from repositories:

```txt
ITableRepository
IAttributeRepository
IAttributeTypeRepository
  -> projectTableSchema()
```

This keeps repository access in the application layer while `src/core/schema/TableSchemaProjection.ts` remains a pure projection engine.

## Validation Scope

`validateProjectedNodeInput()` currently validates the generated node input subset:

- `tableId` const
- `content` string
- required attributes
- additional attribute rejection
- primitive JSON types
- `enum`
- `minimum` / `maximum`
- `minLength` / `maxLength`
- `pattern`
- `email`, `uuid`, `date-time` formats
- nested object `required`, `properties`, and `additionalProperties: false`
- array `minItems`, `maxItems`, and recursive `items`

`validateProjectedNodeUpdateInput()` validates partial node updates against the same projection but does not require all create-time required attributes.

This remains intentionally scoped. It proves projection-backed value validation without replacing every existing `SchemaMapper` path at once.

## Runtime Integration Status

Projection is now used beyond the pure experiment:

- table-scoped MCP `tools/list` create/update node tools expose projection-derived `inputSchema`
- table-scoped MCP `tools/call` can export the current OpenAPI projection through `get-openapi-projection-{tableId}`
- `CreateNodeUseCase` validates identifier-keyed attributes against the current projection
- `UpdateNodeUseCase` validates partial attribute updates without requiring all create-time required fields
- table schema changes refresh cached table-scoped MCP servers through `TableMcpServerFactory`
- generated table templates can be marked stale after schema changes
- `GetTableDocsUseCase` exposes projection freshness via `projectionVersionHash`
- integration smoke covers GraphQL table/attribute changes and table-scoped MCP schema refresh

## MCP Projection Export Usage

MCP is a consumer surface for table schema projections, not the source of
truth. The source path remains:

```txt
Table + Attribute + AttributeType repositories
  -> TableSchemaProjectionService.project()
  -> TableSchemaOpenApiProjection adapter
  -> shared validateOpenApiProjection()
  -> MCP / REST / GraphQL consumers
```

REST and GraphQL projection export remain available for non-MCP clients:

- REST: `GET /api/tables/:tableId/openapi-projection?profile=component-bundle`
- GraphQL: `tableOpenApiProjection(tableId: ID, identifier: String, profile: String = "component-bundle"): JSON`

The table-scoped MCP server exposes the same projection through the tool named
`get-openapi-projection-{tableId}` at `/sub/:tableId/mcp`. The tool accepts one
optional argument:

| Profile | Use when | Shape |
|---|---|---|
| `component-bundle` | A client needs reusable OpenAPI 3.2 component schemas for the table. This is the default. | Empty `paths` and populated `components.schemas`. |
| `operation-contract` | A client needs create/update request contracts for table nodes. | `paths` contains table node operations with request bodies that reference reusable schemas. |

Example JSON-RPC call for the default component bundle:

```json
{
  "jsonrpc": "2.0",
  "id": "projection-component-bundle",
  "method": "tools/call",
  "params": {
    "name": "get-openapi-projection-project_tasks",
    "arguments": {
      "profile": "component-bundle"
    }
  }
}
```

Example JSON-RPC call for the operation contract profile:

```json
{
  "jsonrpc": "2.0",
  "id": "projection-operation-contract",
  "method": "tools/call",
  "params": {
    "name": "get-openapi-projection-project_tasks",
    "arguments": {
      "profile": "operation-contract"
    }
  }
}
```

The MCP tool content is JSON text with this shape:

```json
{
  "projection": {
    "profile": "component-bundle",
    "projection": {
      "openapi": "3.2.0",
      "info": {
        "title": "Table schema components for project_tasks",
        "version": "..."
      },
      "paths": {},
      "components": {
        "schemas": {}
      },
      "x-schema-engine-profile": "component-bundle",
      "x-schema-engine-version-hash": "..."
    },
    "refs": [],
    "diagnostics": [],
    "sources": {},
    "versionHash": "...",
    "typeTargets": []
  },
  "validation": {
    "valid": true,
    "diagnostics": []
  }
}
```

`validation` is the direct result of
`validateOpenApiProjection(output.projection)`. When the projection is valid,
MCP returns `result.isError: false`. When projection diagnostics contain errors,
the tool still returns JSON content with `projection` and `validation`, but
`validation.valid` is `false` and MCP marks `result.isError: true`.

Troubleshooting:

- Unsupported profiles such as `full-api-document` are rejected by the MCP tool.
  The response has `projection: null`, `validation.valid: false`, and an
  `openapi-projection/invalid-profile` diagnostic. Table-scoped MCP currently
  supports only `component-bundle` and `operation-contract`.
- If the table MCP server was created without `TableSchemaProjectionService`,
  the response has `projection: null`, `validation.valid: false`, and an
  `openapi-projection/service-unavailable` diagnostic.
- If `tools/list` shows `_meta.tableSchemaProjection.usable: false` on
  create/update node tools, the server fell back to safe generic MCP input
  schemas because the current table projection has error diagnostics. Call
  `get-openapi-projection-{tableId}` and inspect both `projection.diagnostics`
  and `validation.diagnostics` for the failing database source coordinates.
- Invalid projections are not JSON-RPC transport failures. Clients should parse
  the tool content and branch on `validation.valid` plus `result.isError`.

## Integration Direction

Do not make dynamic table shapes static GraphQL/OpenAPI server contracts.

Preferred integration:

```txt
Table + Attribute + AttributeType
  -> TableSchemaProjection
  -> TableSchemaOpenApiProjection adapter
  -> SchemaMapper.mapOpenApiProjectionToMcpNodeToolSchemas()
  -> runtime data validation
  -> REST / GraphQL / MCP / docs / AI metadata
  -> optional generated helper types
```

The stable server contract should remain metadata-driven:

```txt
createNode(tableId, content, attributes)
updateNode(id, input)
searchNodes(filter)
```

The table-specific shape should be a generated projection, not a fixed API contract.

## Follow-up Questions

- Should source coordinates use `tableId`, `attributeId`, and `attributeTypeId` as first-class diagnostic locations?
- Should projection validation eventually delegate to a shared JSON Schema validator for full Draft 2020-12 coverage?
- Should table-scoped MCP schema caches store projection artifacts directly or continue recomputing through `TableSchemaProjectionService` on refresh?
- Should debug logging in attribute DTO/repository mapping be removed or gated before production use?

## Verification Snapshot

Validated on 2026-04-16:

```bash
bun test tests/unit/schema/table-schema-projection.test.ts \
  tests/unit/schema/table-schema-projection-service.test.ts \
  tests/unit/use-cases/CreateNode.test.ts \
  tests/unit/use-cases/UpdateNode.test.ts \
  tests/unit/mcp-openapi-projection-tool-handler.test.ts \
  tests/integration/mcp-table-projection-tools-list.test.ts \
  tests/integration/projection-graphql-mcp-smoke.test.ts

bun run typecheck
bun run lint --max-diagnostics=20
bun run build
```

Result:

- focused projection/runtime tests: pass
- typecheck: pass
- lint: pass with no warnings after projection lint cleanup
- build: pass

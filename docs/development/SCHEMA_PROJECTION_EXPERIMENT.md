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
- `CreateNodeUseCase` validates identifier-keyed attributes against the current projection
- `UpdateNodeUseCase` validates partial attribute updates without requiring all create-time required fields
- table schema changes refresh cached table-scoped MCP servers through `TableMcpServerFactory`
- generated table templates can be marked stale after schema changes
- `GetTableDocsUseCase` exposes projection freshness via `projectionVersionHash`
- integration smoke covers GraphQL table/attribute changes and table-scoped MCP schema refresh

## Integration Direction

Do not make dynamic table shapes static GraphQL/OpenAPI server contracts.

Preferred integration:

```txt
Table + Attribute + AttributeType
  -> TableSchemaProjection
  -> SchemaMapper.mapTableProjectionToMcpInputSchema()
  -> runtime data validation
  -> docs / AI metadata
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
  tests/integration/mcp-table-projection-tools-list.test.ts \
  tests/integration/projection-graphql-mcp-smoke.test.ts

bun run typecheck
bun run lint --max-diagnostics=20
```

Result:

- focused projection/runtime tests: pass
- typecheck: pass
- lint: pass with no warnings after projection lint cleanup

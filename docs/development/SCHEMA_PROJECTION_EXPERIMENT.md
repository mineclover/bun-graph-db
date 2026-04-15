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

Focused tests:

- `tests/unit/schema/table-schema-projection.test.ts`
- `tests/unit/schema/table-schema-projection-service.test.ts`

The prototype exports:

- `projectTableSchema(input)`
- `validateProjectedNodeInput(data, projection)`
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

This is intentionally small. It proves the projection model without replacing the full MCP `SchemaMapper` or table runtime.

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

- Should `versionHash` use a cryptographic hash when this moves from experiment to runtime cache?
- Should source coordinates use `tableId`, `attributeId`, and `attributeTypeId` as first-class diagnostic locations?
- Should projection invalidation call `TableMcpServerFactory.refreshServerForTable(tableId)` after attribute changes?
- Should table create/update tools consume `TableSchemaProjectionService` directly, or should projection be cached per table-scoped MCP server?

import {
  attachOpenApiProjectionExtensions,
  type OpenApiProjectionDocumentWithExtensions,
  type OpenApiProjectionResult,
  type SchemaDiagnostic,
  type SchemaRefEdge,
  type SchemaSourceCoordinate,
  type SchemaTypeTarget,
} from '@oa-sdk/openapi-projection-contract'
import type {
  JsonSchema,
  ProjectionDiagnostic,
  ProjectionRef,
  ProjectionSource,
  TableSchemaProjection,
} from './TableSchemaProjection.js'

export type TableSchemaOpenApiComponentBundle = {
  openapi: '3.2.0'
  info: {
    title: string
    version: string
  }
  paths: Record<string, never>
  components: {
    schemas: Record<string, JsonSchema>
  }
}

export type TableSchemaOpenApiSchemaReference = {
  $ref: string
}

export type TableSchemaOpenApiOperation = {
  operationId: string
  summary: string
  parameters?: Array<{
    name: string
    in: 'path' | 'query' | 'header' | 'cookie'
    required?: boolean
    schema: JsonSchema
    description?: string
  }>
  requestBody: {
    required: true
    content: {
      'application/json': {
        schema: TableSchemaOpenApiSchemaReference
      }
    }
  }
  responses: Record<string, { description: string }>
}

export type TableSchemaOpenApiOperationContract = {
  openapi: '3.2.0'
  info: {
    title: string
    version: string
  }
  paths: Record<string, {
    post?: TableSchemaOpenApiOperation
    patch?: TableSchemaOpenApiOperation
  }>
  components: {
    schemas: Record<string, JsonSchema>
  }
}

export type TableSchemaOpenApiProjectionDocument =
  OpenApiProjectionDocumentWithExtensions<TableSchemaOpenApiComponentBundle>

export type TableSchemaOpenApiProjectionResult =
  OpenApiProjectionResult<TableSchemaOpenApiProjectionDocument>

export type TableSchemaOpenApiOperationContractDocument =
  OpenApiProjectionDocumentWithExtensions<TableSchemaOpenApiOperationContract>

export type TableSchemaOpenApiOperationContractProjectionResult =
  OpenApiProjectionResult<TableSchemaOpenApiOperationContractDocument>

export function toTableSchemaOpenApiProjectionResult(
  projection: TableSchemaProjection,
): TableSchemaOpenApiProjectionResult {
  const schemas = mapDefsToComponentSchemas(projection.document.$defs ?? {})
  const sources = mapProjectionSources(projection.sources)
  const baseResult: OpenApiProjectionResult<TableSchemaOpenApiComponentBundle> = {
    profile: 'component-bundle',
    projection: {
      openapi: '3.2.0',
      info: {
        title: `Table schema components for ${projection.tableIdentifier}`,
        version: projection.versionHash,
      },
      paths: {},
      components: {
        schemas,
      },
    },
    refs: projection.refs.map(toSchemaRefEdge),
    diagnostics: projection.diagnostics.map(toSchemaDiagnostic),
    sources,
    versionHash: projection.versionHash,
    typeTargets: toSchemaTypeTargets(projection, sources),
  }

  return {
    ...baseResult,
    projection: attachOpenApiProjectionExtensions(baseResult),
  }
}

export function toTableSchemaOpenApiOperationContractProjectionResult(
  projection: TableSchemaProjection,
): TableSchemaOpenApiOperationContractProjectionResult {
  const baseSchemas = mapDefsToComponentSchemas(projection.document.$defs ?? {})
  const createInputName = schemaName('NodeCreateInput', projection.tableIdentifier)
  const updateAttributesName = schemaName('NodeUpdateAttributes', projection.tableIdentifier)
  const updateInputName = schemaName('NodeUpdateInput', projection.tableIdentifier)
  const schemas: Record<string, JsonSchema> = {
    ...baseSchemas,
    [createInputName]: createCreateInputSchema(projection),
    [updateAttributesName]: createPartialAttributesSchema(
      baseSchemas[projection.names.nodeAttributes],
      projection,
    ),
    [updateInputName]: createUpdateInputSchema(updateAttributesName, projection),
  }
  const sources = mapProjectionSources(projection.sources)
  const baseResult: OpenApiProjectionResult<TableSchemaOpenApiOperationContract> = {
    profile: 'operation-contract',
    projection: {
      openapi: '3.2.0',
      info: {
        title: `Table node operation contracts for ${projection.tableIdentifier}`,
        version: projection.versionHash,
      },
      paths: createOperationPaths(projection, createInputName, updateInputName),
      components: {
        schemas,
      },
    },
    refs: projection.refs.map(toSchemaRefEdge),
    diagnostics: projection.diagnostics.map(toSchemaDiagnostic),
    sources,
    versionHash: projection.versionHash,
    typeTargets: toSchemaTypeTargets(projection, sources, [
      updateAttributesName,
      updateInputName,
    ]),
  }

  return {
    ...baseResult,
    projection: attachOpenApiProjectionExtensions(baseResult),
  }
}

function mapDefsToComponentSchemas(defs: Record<string, JsonSchema>): Record<string, JsonSchema> {
  return Object.fromEntries(
    Object.entries(defs).map(([name, schema]) => [
      name,
      rewriteDefsRefs(schema) as JsonSchema,
    ]),
  )
}

function createPartialAttributesSchema(
  createAttributesSchema: JsonSchema | undefined,
  projection: TableSchemaProjection,
): JsonSchema {
  return {
    type: 'object',
    description: `Partial attribute values for table ${projection.tableIdentifier}`,
    properties: createAttributesSchema?.properties ?? {},
    additionalProperties: createAttributesSchema?.additionalProperties ?? false,
  }
}

function createCreateInputSchema(
  projection: TableSchemaProjection,
): JsonSchema {
  return {
    type: 'object',
    description: `Node create input for table ${projection.tableIdentifier}`,
    required: ['content', 'attributes'],
    properties: {
      content: { type: 'string' },
      attributes: { $ref: componentSchemaRef(projection.names.nodeAttributes) },
    },
    additionalProperties: false,
  }
}

function createUpdateInputSchema(
  updateAttributesName: string,
  projection: TableSchemaProjection,
): JsonSchema {
  return {
    type: 'object',
    description: `Node update input for table ${projection.tableIdentifier}`,
    properties: {
      tableId: { const: projection.tableId },
      tableIdentifier: { const: projection.tableIdentifier },
      content: { type: 'string' },
      attributes: { $ref: componentSchemaRef(updateAttributesName) },
    },
    additionalProperties: false,
  }
}

function createOperationPaths(
  projection: TableSchemaProjection,
  createInputName: string,
  updateInputName: string,
): TableSchemaOpenApiOperationContract['paths'] {
  const basePath = `/schema-engine/tables/${encodeURIComponent(projection.tableIdentifier)}/nodes`
  const tableName = toPascalCase(projection.tableIdentifier)

  return {
    [basePath]: {
      post: {
        operationId: `create${tableName}Node`,
        summary: `Create ${projection.tableIdentifier} node`,
        requestBody: jsonRequestBody(componentSchemaRef(createInputName)),
        responses: {
          201: { description: 'Node created.' },
          400: { description: 'Request payload failed validation.' },
        },
      },
    },
    [`${basePath}/{nodeId}`]: {
      patch: {
        operationId: `update${tableName}Node`,
        summary: `Update ${projection.tableIdentifier} node`,
        parameters: [{
          name: 'nodeId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Node identifier.',
        }],
        requestBody: jsonRequestBody(componentSchemaRef(updateInputName)),
        responses: {
          200: { description: 'Node updated.' },
          400: { description: 'Request payload failed validation.' },
          404: { description: 'Node not found.' },
        },
      },
    },
  }
}

function jsonRequestBody(schemaRef: string): TableSchemaOpenApiOperation['requestBody'] {
  return {
    required: true,
    content: {
      'application/json': {
        schema: { $ref: schemaRef },
      },
    },
  }
}

function rewriteDefsRefs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(rewriteDefsRefs)
  if (!isRecord(value)) return value

  const rewritten: Record<string, unknown> = {}
  for (const [key, entryValue] of Object.entries(value)) {
    rewritten[key] = key === '$ref' && typeof entryValue === 'string'
      ? rewriteDefsRef(entryValue)
      : rewriteDefsRefs(entryValue)
  }
  return rewritten
}

function rewriteDefsRef(ref: string): string {
  return toOpenApiComponentPointer(ref)
}

function componentSchemaRef(name: string): string {
  return `#/components/schemas/${escapePointer(name)}`
}

function toSchemaRefEdge(ref: ProjectionRef): SchemaRefEdge {
  return {
    from: toOpenApiComponentPointer(ref.from),
    to: toOpenApiComponentPointer(ref.to),
    ref: toOpenApiComponentPointer(ref.to),
    kind: ref.kind,
    source: toSchemaSourceCoordinate(ref.source),
  }
}

function toSchemaDiagnostic(diagnostic: ProjectionDiagnostic): SchemaDiagnostic {
  return {
    severity: diagnostic.severity,
    code: diagnostic.code,
    message: diagnostic.message,
    ...(diagnostic.source ? { source: toSchemaSourceCoordinate(diagnostic.source) } : {}),
  }
}

function mapProjectionSources(
  sources: Record<string, ProjectionSource>,
): Record<string, SchemaSourceCoordinate> {
  return Object.fromEntries(
    Object.entries(sources).map(([pointer, source]) => [
      toOpenApiComponentPointer(pointer),
      toSchemaSourceCoordinate(source),
    ]),
  )
}

function toSchemaTypeTargets(
  projection: TableSchemaProjection,
  sources: Record<string, SchemaSourceCoordinate>,
  generatedSchemaNames: string[] = [],
): SchemaTypeTarget[] {
  const sourceNames = [
    ...Object.keys(projection.document.$defs ?? {}),
    ...generatedSchemaNames,
  ]

  return sourceNames.map(name => {
    const id = componentSchemaRef(name)
    const target: SchemaTypeTarget = {
      id,
      name,
      kind: 'schema',
    }
    const source = sources[id]
    if (source) target.source = source
    return target
  })
}

function toOpenApiComponentPointer(pointer: string): string {
  return pointer.startsWith('#/$defs/')
    ? `#/components/schemas/${pointer.slice('#/$defs/'.length)}`
    : pointer
}

function toSchemaSourceCoordinate(source: ProjectionSource): SchemaSourceCoordinate {
  return {
    kind: 'db',
    entity: source.entity,
    id: source.id,
    pointer: source.pointer,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function escapePointer(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1')
}

function schemaName(prefix: string, identifier: string): string {
  return `${prefix}_${toPascalCase(identifier)}`
}

function toPascalCase(value: string): string {
  const normalized = value
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('')
  return normalized || 'Unnamed'
}

import {
  attachOpenApiProjectionExtensions,
  type OpenApiProjectionDocumentWithExtensions,
  type OpenApiProjectionResult,
  type SchemaDiagnostic,
  type SchemaRefEdge,
  type SchemaSourceCoordinate,
  type SchemaTypeTarget,
} from '@oa-sdk/openapi-projection-contract'
import { sha256Hex } from '@/shared/utils/portableHash.js'

export const ROOT_MCP_TOOL_CONTRACTS_EXTENSION = 'x-mcp-tool-contracts'

export type JsonSchema = Record<string, unknown>

export type RootMcpToolContractInput = {
  name: string
  description: string
  inputSchema?: unknown
}

export type RootMcpToolContractReference = {
  name: string
  description: string
  argumentsRef: string
}

export type RootMcpToolOpenApiComponentBundle = {
  openapi: '3.2.0'
  info: {
    title: string
    version: string
  }
  paths: Record<string, never>
  components: {
    schemas: Record<string, JsonSchema>
  }
  [ROOT_MCP_TOOL_CONTRACTS_EXTENSION]: RootMcpToolContractReference[]
}

export type RootMcpToolOpenApiProjectionDocument =
  OpenApiProjectionDocumentWithExtensions<RootMcpToolOpenApiComponentBundle>

export type RootMcpToolOpenApiProjectionResult =
  OpenApiProjectionResult<RootMcpToolOpenApiProjectionDocument>

const ROOT_MCP_TOOL_SOURCE_FILE =
  'references/bun-graph-db/src/application/services/McpToolRegistry.ts'

export function toRootMcpToolOpenApiProjectionResult(
  tools: RootMcpToolContractInput[],
): RootMcpToolOpenApiProjectionResult {
  const diagnostics: SchemaDiagnostic[] = []
  const schemas: Record<string, JsonSchema> = {}
  const refs: SchemaRefEdge[] = []
  const sources: Record<string, SchemaSourceCoordinate> = {}
  const typeTargets: SchemaTypeTarget[] = []
  const contracts: RootMcpToolContractReference[] = []
  const allocatedSchemaNames = new Set<string>()

  for (const tool of [...tools].sort((left, right) => left.name.localeCompare(right.name))) {
    const schemaName = allocateSchemaName(tool.name, allocatedSchemaNames)
    const schemaRef = componentSchemaRef(schemaName)
    const source = toToolInputSchemaSource(tool.name)
    const schema = toOpenApiCompatibleInputSchema(tool, source, diagnostics)

    schemas[schemaName] = schema
    sources[schemaRef] = source
    refs.push({
      from: toolContractId(tool.name),
      to: schemaRef,
      ref: schemaRef,
      kind: 'mcp-tool-argument-schema',
      source,
    })
    typeTargets.push({
      id: schemaRef,
      name: schemaName,
      kind: 'schema',
      source,
    })
    contracts.push({
      name: tool.name,
      description: nonEmptyString(tool.description)
        ? tool.description
        : `MCP tool ${tool.name}`,
      argumentsRef: schemaRef,
    })
  }

  const versionHash = computeRootMcpToolProjectionVersionHash({
    contracts,
    schemas,
    diagnostics,
  })
  const baseResult: OpenApiProjectionResult<RootMcpToolOpenApiComponentBundle> = {
    profile: 'component-bundle',
    projection: {
      openapi: '3.2.0',
      info: {
        title: 'Root MCP tool argument contracts',
        version: versionHash,
      },
      paths: {},
      components: {
        schemas,
      },
      [ROOT_MCP_TOOL_CONTRACTS_EXTENSION]: contracts,
    },
    refs,
    diagnostics,
    sources,
    versionHash,
    typeTargets,
  }

  return {
    ...baseResult,
    projection: attachOpenApiProjectionExtensions(baseResult),
  }
}

function toOpenApiCompatibleInputSchema(
  tool: RootMcpToolContractInput,
  source: SchemaSourceCoordinate,
  diagnostics: SchemaDiagnostic[],
): JsonSchema {
  if (!isRecord(tool.inputSchema)) {
    diagnostics.push({
      severity: 'error',
      code: 'mcp-tool-openapi-projection/input-schema-not-object',
      message: `MCP tool "${tool.name}" inputSchema must be an object to map to an OpenAPI schema component.`,
      source,
    })
    return createUnmappedInputSchema(tool)
  }

  const copiedSchema = copyJsonCompatible(tool.inputSchema, source, diagnostics)
  if (!isRecord(copiedSchema)) return createUnmappedInputSchema(tool)

  if (!isObjectSchemaType(copiedSchema.type)) {
    const severity = copiedSchema.type === undefined ? 'warning' : 'error'
    diagnostics.push({
      severity,
      code: copiedSchema.type === undefined
        ? 'mcp-tool-openapi-projection/missing-root-object-type'
        : 'mcp-tool-openapi-projection/non-object-root-type',
      message: copiedSchema.type === undefined
        ? `MCP tool "${tool.name}" inputSchema is missing root type "object"; the projection preserves the schema with tool metadata.`
        : `MCP tool "${tool.name}" inputSchema root type must include "object" to map cleanly to OpenAPI tool arguments.`,
      source,
    })
    if (severity === 'error') return createUnmappedInputSchema(tool)
  }

  return {
    ...copiedSchema,
    description: typeof copiedSchema.description === 'string'
      ? copiedSchema.description
      : tool.description,
    'x-mcp-tool-name': tool.name,
    'x-mcp-tool-description': tool.description,
  }
}

function createUnmappedInputSchema(tool: RootMcpToolContractInput): JsonSchema {
  return {
    type: 'object',
    description: `Arguments for MCP tool ${tool.name}. The original inputSchema could not be mapped to an OpenAPI-compatible object schema.`,
    additionalProperties: true,
    'x-mcp-tool-name': tool.name,
    'x-mcp-tool-description': tool.description,
    'x-mcp-input-schema-unmapped': true,
  }
}

function copyJsonCompatible(
  value: unknown,
  source: SchemaSourceCoordinate,
  diagnostics: SchemaDiagnostic[],
): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value

  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value
    diagnostics.push({
      severity: 'error',
      code: 'mcp-tool-openapi-projection/non-json-number',
      message: 'MCP tool inputSchema contains a non-finite number.',
      source,
    })
    return undefined
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => copyJsonCompatible(entry, source, diagnostics))
      .filter((entry) => entry !== undefined)
  }

  if (isRecord(value)) {
    const copied: Record<string, unknown> = {}
    for (const [key, entryValue] of Object.entries(value)) {
      const copiedValue = copyJsonCompatible(entryValue, source, diagnostics)
      if (copiedValue !== undefined) copied[key] = copiedValue
    }
    return copied
  }

  diagnostics.push({
    severity: 'error',
    code: 'mcp-tool-openapi-projection/non-json-value',
    message: `MCP tool inputSchema contains a non-JSON value of type ${typeof value}.`,
    source,
  })
  return undefined
}

function computeRootMcpToolProjectionVersionHash(input: unknown): string {
  return `sha256:${sha256Hex(stableStringify(input))}`
}

function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function allocateSchemaName(toolName: string, allocatedSchemaNames: Set<string>): string {
  const baseName = `${toPascalCase(toolName)}Arguments`
  let candidate = baseName
  if (allocatedSchemaNames.has(candidate)) {
    candidate = `${baseName}_${shortHash(toolName)}`
  }
  while (allocatedSchemaNames.has(candidate)) {
    candidate = `${baseName}_${shortHash(`${toolName}:${allocatedSchemaNames.size}`)}`
  }
  allocatedSchemaNames.add(candidate)
  return candidate
}

function toPascalCase(value: string): string {
  const normalized = value
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('')
  return normalized || 'Unnamed'
}

function shortHash(value: string): string {
  return sha256Hex(value).slice(0, 8)
}

function componentSchemaRef(name: string): string {
  return `#/components/schemas/${escapePointer(name)}`
}

function toolContractId(name: string): string {
  return `mcp://root/tools/${encodeURIComponent(name)}`
}

function toToolInputSchemaSource(toolName: string): SchemaSourceCoordinate {
  return {
    kind: 'file',
    filePath: ROOT_MCP_TOOL_SOURCE_FILE,
    pointer: `/tools/${escapePointer(toolName)}/inputSchema`,
  }
}

function isObjectSchemaType(value: unknown): boolean {
  return value === 'object' || (Array.isArray(value) && value.includes('object'))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function escapePointer(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1')
}

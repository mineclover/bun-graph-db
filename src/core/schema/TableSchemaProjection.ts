export type JsonSchema = {
  $schema?: string
  $id?: string
  $ref?: string
  $defs?: Record<string, JsonSchema>
  type?: string | string[]
  const?: unknown
  enum?: unknown[]
  format?: string
  description?: string
  default?: unknown
  examples?: unknown[]
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
  additionalProperties?: boolean | JsonSchema
  minItems?: number
  maxItems?: number
  uniqueItems?: boolean
  minLength?: number
  maxLength?: number
  pattern?: string
  minimum?: number
  maximum?: number
}

export type TableProjectionInput = {
  table: {
    id: string
    identifier: string
    description?: string | null
    updatedAt?: Date | string
  }
  attributes: TableProjectionAttribute[]
  attributeTypes: TableProjectionAttributeType[]
}

export type TableProjectionAttribute = {
  id: string
  tableId: string
  identifier: string
  name?: string | null
  description?: string | null
  attributeTypeId: string
  isRequired?: boolean
  metadata?: unknown
  updatedAt?: Date | string
}

export type TableProjectionAttributeType = {
  id: string
  identifier: string
  jsonType: string
  format?: string | null
  description?: string | null
  validationSchema?: unknown
  referenceConfig?: unknown
  defaultValue?: unknown
  examples?: unknown
  updatedAt?: Date | string
}

export type ProjectionRefKind = 'tableAttributes' | 'attribute' | 'attributeType' | 'valueSchema'

export type ProjectionRef = {
  from: string
  to: string
  kind: ProjectionRefKind
  source: ProjectionSource
}

export type ProjectionSource = {
  kind: 'db'
  entity: 'table' | 'attribute' | 'attributeType'
  id: string
  pointer: string
}

export type ProjectionDiagnostic = {
  severity: 'error' | 'warning'
  code: string
  message: string
  source?: ProjectionSource
}

export type TableSchemaProjection = {
  tableId: string
  tableIdentifier: string
  versionHash: string
  rootRef: string
  document: JsonSchema
  names: {
    nodeInput: string
    nodeAttributes: string
  }
  refs: ProjectionRef[]
  diagnostics: ProjectionDiagnostic[]
  sources: Record<string, ProjectionSource>
  attributeValueSchemas: Record<string, JsonSchema>
  requiredAttributes: string[]
}

export type ProjectionValidationError = {
  path: string
  code: string
  message: string
  expected?: unknown
  received?: unknown
  source?: ProjectionSource
}

export type ProjectionValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: ProjectionValidationError[] }

const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema'
const VALID_JSON_TYPES = new Set(['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'])

export function projectTableSchema(input: TableProjectionInput): TableSchemaProjection {
  const defs: Record<string, JsonSchema> = {}
  const refs: ProjectionRef[] = []
  const diagnostics: ProjectionDiagnostic[] = []
  const sources: Record<string, ProjectionSource> = {}
  const attributeValueSchemas: Record<string, JsonSchema> = {}
  const requiredAttributes: string[] = []

  const tableName = schemaName('Table', input.table.identifier)
  const nodeAttributesName = schemaName('NodeAttributes', input.table.identifier)
  const nodeInputName = schemaName('NodeInput', input.table.identifier)
  const rootRef = refToDef(nodeInputName)
  const attributeTypesById = new Map(input.attributeTypes.map(type => [type.id, type]))
  const attributeTypesByIdentifier = new Map(input.attributeTypes.map(type => [type.identifier, type]))

  const tableSource = dbSource('table', input.table.id, '#')
  addSource(sources, refToDef(tableName), tableSource)

  defs[tableName] = {
    type: 'object',
    description: input.table.description ?? `Table ${input.table.identifier}`,
    required: ['id', 'identifier', 'attributes'],
    properties: {
      id: { const: input.table.id },
      identifier: { const: input.table.identifier },
      attributes: {
        type: 'array',
        items: { $ref: refToDef('Attribute') },
      },
    },
  }

  for (const attributeType of input.attributeTypes) {
    const typeName = schemaName('AttributeType', attributeType.identifier)
    const typePointer = refToDef(typeName)
    const source = dbSource('attributeType', attributeType.id, '#')
    const schema = attributeTypeToSchema(attributeType, source, diagnostics)
    defs[typeName] = schema
    addSource(sources, typePointer, source)
  }

  const nodeAttributeProperties: Record<string, JsonSchema> = {}

  for (const attribute of input.attributes) {
    const attrSource = dbSource('attribute', attribute.id, '#')
    const attrName = schemaName('Attribute', attribute.identifier)
    const attrPointer = refToDef(attrName)
    const attributeType = attributeTypesById.get(attribute.attributeTypeId)
      ?? attributeTypesByIdentifier.get(attribute.attributeTypeId)

    if (!attributeType) {
      diagnostics.push({
        severity: 'error',
        code: 'attribute-type-not-found',
        message: `Attribute '${attribute.identifier}' references missing attributeType '${attribute.attributeTypeId}'`,
        source: attrSource,
      })
      continue
    }

    const typeName = schemaName('AttributeType', attributeType.identifier)
    const typePointer = refToDef(typeName)
    const valueRef = { $ref: typePointer }
    const escapedIdentifier = escapePointer(attribute.identifier)

    defs[attrName] = {
      type: 'object',
      description: attribute.description ?? `Attribute ${attribute.identifier}`,
      required: ['identifier', 'value'],
      properties: {
        identifier: { const: attribute.identifier },
        value: valueRef,
      },
      additionalProperties: false,
    }
    addSource(sources, attrPointer, attrSource)
    addSource(sources, `${refToDef(nodeAttributesName)}/properties/${escapedIdentifier}`, attrSource)

    refs.push({
      from: `${attrPointer}/properties/value`,
      to: typePointer,
      kind: 'attributeType',
      source: attrSource,
    })

    refs.push({
      from: `${refToDef(nodeAttributesName)}/properties/${escapedIdentifier}`,
      to: typePointer,
      kind: 'valueSchema',
      source: attrSource,
    })

    nodeAttributeProperties[attribute.identifier] = valueRef
    const valueSchema = defs[typeName]
    if (valueSchema) attributeValueSchemas[attribute.identifier] = valueSchema
    if (attribute.isRequired) requiredAttributes.push(attribute.identifier)
  }

  defs[nodeAttributesName] = {
    type: 'object',
    description: `Attribute values for table ${input.table.identifier}`,
    properties: nodeAttributeProperties,
    required: requiredAttributes,
    additionalProperties: false,
  }

  refs.push({
    from: `${rootRef}/properties/attributes`,
    to: refToDef(nodeAttributesName),
    kind: 'tableAttributes',
    source: tableSource,
  })

  defs[nodeInputName] = {
    type: 'object',
    description: `Node input for table ${input.table.identifier}`,
    required: ['tableId', 'content', 'attributes'],
    properties: {
      tableId: { const: input.table.id },
      tableIdentifier: { const: input.table.identifier },
      content: { type: 'string' },
      attributes: { $ref: refToDef(nodeAttributesName) },
    },
    additionalProperties: false,
  }

  const document: JsonSchema = {
    $schema: JSON_SCHEMA_DIALECT,
    $id: `table:${input.table.identifier}:${input.table.id}`,
    $ref: rootRef,
    $defs: defs,
  }

  return {
    tableId: input.table.id,
    tableIdentifier: input.table.identifier,
    versionHash: hashJson(normalizeProjectionInput(input)),
    rootRef,
    document,
    names: {
      nodeInput: nodeInputName,
      nodeAttributes: nodeAttributesName,
    },
    refs,
    diagnostics,
    sources,
    attributeValueSchemas,
    requiredAttributes,
  }
}

export function validateProjectedNodeInput(
  data: unknown,
  projection: TableSchemaProjection,
): ProjectionValidationResult {
  const errors: ProjectionValidationError[] = []

  if (!isRecord(data)) {
    return {
      valid: false,
      errors: [{
        path: '#',
        code: 'type',
        message: 'Node input must be an object',
        expected: 'object',
        received: typeof data,
      }],
    }
  }

  if (data.tableId !== projection.tableId) {
    errors.push({
      path: '#/tableId',
      code: 'const',
      message: `tableId must be '${projection.tableId}'`,
      expected: projection.tableId,
      received: data.tableId,
    })
  }

  if (typeof data.content !== 'string') {
    errors.push({
      path: '#/content',
      code: 'type',
      message: 'content must be a string',
      expected: 'string',
      received: typeof data.content,
    })
  }

  if (!isRecord(data.attributes)) {
    errors.push({
      path: '#/attributes',
      code: 'type',
      message: 'attributes must be an object',
      expected: 'object',
      received: typeof data.attributes,
    })
    return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors }
  }

  for (const required of projection.requiredAttributes) {
    if (!Object.hasOwn(data.attributes, required)) {
      errors.push({
        path: `#/attributes/${escapePointer(required)}`,
        code: 'required',
        message: `Missing required attribute '${required}'`,
      })
    }
  }

  for (const [name, value] of Object.entries(data.attributes)) {
    const schema = projection.attributeValueSchemas[name]
    const source = projection.sources[`${refToDef(projection.names.nodeAttributes)}/properties/${escapePointer(name)}`]

    if (!schema) {
      errors.push({
        path: `#/attributes/${escapePointer(name)}`,
        code: 'additional-property',
        message: `Attribute '${name}' is not defined for table '${projection.tableIdentifier}'`,
        source,
      })
      continue
    }

    errors.push(...validateValue(value, schema, `#/attributes/${escapePointer(name)}`, source))
  }

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors }
}

export function validateProjectedNodeUpdateInput(
  data: unknown,
  projection: TableSchemaProjection,
): ProjectionValidationResult {
  const errors: ProjectionValidationError[] = []

  if (!isRecord(data)) {
    return {
      valid: false,
      errors: [{
        path: '#',
        code: 'type',
        message: 'Node update input must be an object',
        expected: 'object',
        received: typeof data,
      }],
    }
  }

  if (data.tableId !== undefined && data.tableId !== projection.tableId) {
    errors.push({
      path: '#/tableId',
      code: 'const',
      message: `tableId must be '${projection.tableId}'`,
      expected: projection.tableId,
      received: data.tableId,
    })
  }

  if (data.tableIdentifier !== undefined && data.tableIdentifier !== projection.tableIdentifier) {
    errors.push({
      path: '#/tableIdentifier',
      code: 'const',
      message: `tableIdentifier must be '${projection.tableIdentifier}'`,
      expected: projection.tableIdentifier,
      received: data.tableIdentifier,
    })
  }

  if (data.content !== undefined && typeof data.content !== 'string') {
    errors.push({
      path: '#/content',
      code: 'type',
      message: 'content must be a string',
      expected: 'string',
      received: typeof data.content,
    })
  }

  if (data.attributes === undefined) {
    return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors }
  }

  if (!isRecord(data.attributes)) {
    errors.push({
      path: '#/attributes',
      code: 'type',
      message: 'attributes must be an object',
      expected: 'object',
      received: typeof data.attributes,
    })
    return { valid: false, errors }
  }

  for (const [name, value] of Object.entries(data.attributes)) {
    const schema = projection.attributeValueSchemas[name]
    const source = projection.sources[`${refToDef(projection.names.nodeAttributes)}/properties/${escapePointer(name)}`]

    if (!schema) {
      errors.push({
        path: `#/attributes/${escapePointer(name)}`,
        code: 'additional-property',
        message: `Attribute '${name}' is not defined for table '${projection.tableIdentifier}'`,
        source,
      })
      continue
    }

    errors.push(...validateValue(value, schema, `#/attributes/${escapePointer(name)}`, source))
  }

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors }
}

function attributeTypeToSchema(
  attributeType: TableProjectionAttributeType,
  source: ProjectionSource,
  diagnostics: ProjectionDiagnostic[],
): JsonSchema {
  const jsonType = attributeType.jsonType
  let schema: JsonSchema = VALID_JSON_TYPES.has(jsonType)
    ? { type: jsonType }
    : {}

  if (!VALID_JSON_TYPES.has(jsonType)) {
    diagnostics.push({
      severity: 'error',
      code: 'invalid-json-type',
      message: `Invalid JSON type '${jsonType}' for attributeType '${attributeType.identifier}'`,
      source,
    })
  }

  if (attributeType.description) schema.description = attributeType.description
  if (attributeType.format) schema.format = attributeType.format

  const validationSchema = parseOptionalJsonObject(attributeType.validationSchema, 'validationSchema', source, diagnostics)
  if (validationSchema) schema = { ...schema, ...validationSchema }

  const defaultValue = parseOptionalJsonValue(attributeType.defaultValue, 'defaultValue', source, diagnostics)
  if (defaultValue.present) schema.default = defaultValue.value

  const examples = parseOptionalJsonValue(attributeType.examples, 'examples', source, diagnostics)
  if (examples.present) schema.examples = Array.isArray(examples.value) ? examples.value : [examples.value]

  return schema
}

function validateValue(
  value: unknown,
  schema: JsonSchema,
  path: string,
  source: ProjectionSource | undefined,
): ProjectionValidationError[] {
  const errors: ProjectionValidationError[] = []
  const type = firstType(schema.type)

  if (type && !matchesJsonType(value, type)) {
    errors.push({
      path,
      code: 'type',
      message: `Expected ${type}`,
      expected: type,
      received: Array.isArray(value) ? 'array' : typeof value,
      source,
    })
    return errors
  }

  if (schema.enum && !schema.enum.some(item => Object.is(item, value))) {
    errors.push({
      path,
      code: 'enum',
      message: 'Value must be one of the allowed enum values',
      expected: schema.enum,
      received: value,
      source,
    })
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({ path, code: 'minLength', message: `String is shorter than ${schema.minLength}`, expected: schema.minLength, received: value.length, source })
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({ path, code: 'maxLength', message: `String is longer than ${schema.maxLength}`, expected: schema.maxLength, received: value.length, source })
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push({ path, code: 'pattern', message: `String does not match pattern ${schema.pattern}`, expected: schema.pattern, received: value, source })
    }
    if (schema.format) {
      const formatError = validateFormat(value, schema.format)
      if (formatError) errors.push({ path, code: 'format', message: formatError, expected: schema.format, received: value, source })
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({ path, code: 'minimum', message: `Number is less than ${schema.minimum}`, expected: schema.minimum, received: value, source })
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({ path, code: 'maximum', message: `Number is greater than ${schema.maximum}`, expected: schema.maximum, received: value, source })
    }
  }

  if (isRecord(value)) {
    errors.push(...validateObjectValue(value, schema, path, source))
  }

  if (Array.isArray(value)) {
    errors.push(...validateArrayValue(value, schema, path, source))
  }

  return errors
}

function validateObjectValue(
  value: Record<string, unknown>,
  schema: JsonSchema,
  path: string,
  source: ProjectionSource | undefined,
): ProjectionValidationError[] {
  const errors: ProjectionValidationError[] = []
  const properties = schema.properties ?? {}

  for (const required of schema.required ?? []) {
    if (!Object.hasOwn(value, required)) {
      errors.push({
        path: `${path}/${escapePointer(required)}`,
        code: 'required',
        message: `Missing required property '${required}'`,
        source,
      })
    }
  }

  for (const [propertyName, propertyValue] of Object.entries(value)) {
    const propertySchema = properties[propertyName]
    if (!propertySchema) {
      if (schema.additionalProperties === false) {
        errors.push({
          path: `${path}/${escapePointer(propertyName)}`,
          code: 'additional-property',
          message: `Property '${propertyName}' is not allowed`,
          source,
        })
      }
      continue
    }
    errors.push(...validateValue(propertyValue, propertySchema, `${path}/${escapePointer(propertyName)}`, source))
  }

  return errors
}

function validateArrayValue(
  value: unknown[],
  schema: JsonSchema,
  path: string,
  source: ProjectionSource | undefined,
): ProjectionValidationError[] {
  const errors: ProjectionValidationError[] = []

  if (schema.minItems !== undefined && value.length < schema.minItems) {
    errors.push({ path, code: 'minItems', message: `Array has fewer than ${schema.minItems} items`, expected: schema.minItems, received: value.length, source })
  }

  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    errors.push({ path, code: 'maxItems', message: `Array has more than ${schema.maxItems} items`, expected: schema.maxItems, received: value.length, source })
  }

  if (schema.uniqueItems === true) {
    const seen = new Set<string>()
    for (const item of value) {
      const key = JSON.stringify(sortJson(item))
      if (seen.has(key)) {
        errors.push({
          path,
          code: 'uniqueItems',
          message: 'Array items must be unique',
          expected: true,
          received: value,
          source,
        })
        break
      }
      seen.add(key)
    }
  }

  if (schema.items) {
    value.forEach((item, index) => {
      errors.push(...validateValue(item, schema.items as JsonSchema, `${path}/${index}`, source))
    })
  }

  return errors
}

function matchesJsonType(value: unknown, type: string): boolean {
  switch (type) {
    case 'string': return typeof value === 'string'
    case 'number': return typeof value === 'number' && Number.isFinite(value)
    case 'integer': return typeof value === 'number' && Number.isInteger(value)
    case 'boolean': return typeof value === 'boolean'
    case 'array': return Array.isArray(value)
    case 'object': return isRecord(value)
    case 'null': return value === null
    default: return true
  }
}

function validateFormat(value: string, format: string): string | undefined {
  switch (format) {
    case 'email':
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? undefined : 'String must be a valid email'
    case 'uuid':
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
        ? undefined
        : 'String must be a valid UUID'
    case 'date-time':
      return Number.isNaN(Date.parse(value)) ? 'String must be a valid date-time' : undefined
    default:
      return undefined
  }
}

function firstType(type: string | string[] | undefined): string | undefined {
  return Array.isArray(type) ? type.find(item => item !== 'null') : type
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

function refToDef(name: string): string {
  return `#/$defs/${escapePointer(name)}`
}

function dbSource(entity: ProjectionSource['entity'], id: string, pointer: string): ProjectionSource {
  return { kind: 'db', entity, id, pointer }
}

function addSource(sources: Record<string, ProjectionSource>, pointer: string, source: ProjectionSource): void {
  sources[pointer] = source
}

function parseOptionalJsonObject(
  value: unknown,
  field: string,
  source: ProjectionSource,
  diagnostics: ProjectionDiagnostic[],
): Record<string, unknown> | undefined {
  const parsed = parseOptionalJsonValue(value, field, source, diagnostics)
  if (!parsed.present) return undefined
  if (!isRecord(parsed.value)) {
    diagnostics.push({
      severity: 'error',
      code: 'invalid-json-object',
      message: `${field} must be a JSON object`,
      source,
    })
    return undefined
  }
  return parsed.value
}

function parseOptionalJsonValue(
  value: unknown,
  field: string,
  source: ProjectionSource,
  diagnostics: ProjectionDiagnostic[],
): { present: false } | { present: true; value: unknown } {
  if (value === undefined || value === null || value === '') return { present: false }
  if (typeof value !== 'string') return { present: true, value }
  try {
    return { present: true, value: JSON.parse(value) }
  } catch {
    diagnostics.push({
      severity: 'error',
      code: 'invalid-json',
      message: `${field} must be valid JSON`,
      source,
    })
    return { present: false }
  }
}

function normalizeProjectionInput(input: TableProjectionInput): unknown {
  return {
    table: input.table,
    attributes: [...input.attributes].sort((a, b) => a.identifier.localeCompare(b.identifier)),
    attributeTypes: [...input.attributeTypes].sort((a, b) => a.identifier.localeCompare(b.identifier)),
  }
}

function hashJson(value: unknown): string {
  return hashString(JSON.stringify(sortJson(value)))
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson)
  if (isRecord(value)) {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) sorted[key] = sortJson(value[key])
    return sorted
  }
  if (value instanceof Date) return value.toISOString()
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function escapePointer(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1')
}

function hashString(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

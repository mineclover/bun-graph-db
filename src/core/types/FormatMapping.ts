/**
 * Format Mapping Types
 *
 * Flexible format mapping system based on Flat JSON.
 * Allows defining custom export/import formats using address-based field mapping.
 *
 * Address System:
 * - $.nodes[*].id → Access all node IDs
 * - $.nodes[0].title → Access first node's title
 * - $.nodes[*].attributes.name → Access name attribute of all nodes
 * - $.table.identifier → Access table identifier
 *
 * Mapping Definition Example:
 * {
 *   "users": "$.nodes[*]",
 *   "users[*].userId": "$.nodes[*].id",
 *   "users[*].displayName": "$.nodes[*].title",
 *   "users[*].email": "$.nodes[*].email"
 * }
 */

// =============================================================================
// Address Path Types
// =============================================================================

/**
 * JSON Path address pointing to a location in Flat JSON
 * Uses JSONPath-like syntax:
 * - $ = root
 * - .property = object property access
 * - [*] = all array items
 * - [0] = specific array index
 */
export type FlatJsonPath = string

/**
 * Target path in custom format output
 */
export type TargetPath = string

// =============================================================================
// Mapping Definition Types
// =============================================================================

/**
 * Field mapping definition
 * Maps a target path to a source path in Flat JSON
 */
export interface FieldMapping {
  /** Target field path in output format */
  target: TargetPath
  /** Source field path in Flat JSON ($.nodes[*].field format) */
  source: FlatJsonPath
  /** Optional transform function name */
  transform?: TransformType
  /** Default value if source is undefined */
  defaultValue?: unknown
}

/**
 * Built-in transform types
 */
export type TransformType =
  | 'string' // Convert to string
  | 'number' // Convert to number
  | 'boolean' // Convert to boolean
  | 'date' // Format as ISO date
  | 'timestamp' // Unix timestamp
  | 'uppercase' // Uppercase string
  | 'lowercase' // Lowercase string
  | 'trim' // Trim whitespace
  | 'json' // JSON stringify
  | 'array' // Wrap in array
  | 'flatten' // Flatten nested object

/**
 * Format mapping template
 * Defines how to transform Flat JSON to a custom format
 */
export interface FormatMappingTemplate {
  /** Unique identifier for this mapping template */
  id: string
  /** Human-readable name */
  name: string
  /** Description of the format */
  description?: string
  /** Version of the mapping template */
  version: string
  /** Field mappings (target path → source path) */
  mappings: FieldMapping[]
  /** Root structure template (before applying mappings) */
  rootTemplate?: Record<string, unknown>
  /** Metadata about the mapping */
  metadata?: {
    author?: string
    createdAt?: string
    updatedAt?: string
    tags?: string[]
  }
}

/**
 * Simplified mapping definition using key-value pairs
 * Key = target path, Value = source path or mapping config
 */
export type SimpleMappingDefinition = Record<string, FlatJsonPath | FieldMapping>

// =============================================================================
// Node-Level Mapping (Simplified Syntax)
// =============================================================================

/**
 * Node field mapping with optional transform
 * Can be a simple string or detailed config
 *
 * Source field syntax:
 * - 'title'      → $.nodes[*].title (core field)
 * - '@email'     → $.nodes[*].attributes.email (attribute with @ prefix)
 * - '@@createdAt' → $.nodes[*].createdAt (system field with @@ prefix)
 */
export type NodeFieldMapping =
  | string // Simple field name
  | {
      /** Source field name (with @ prefix for attributes) */
      field: string
      /** Optional transform */
      transform?: TransformType
      /** Default value if source is undefined */
      defaultValue?: unknown
    }

/**
 * Node-level mapping definition
 * Simplified syntax for common node array transformations
 *
 * @example
 * ```typescript
 * const mapping: NodeLevelMapping = {
 *   outputKey: 'users',
 *   nodeMapping: {
 *     id: 'id',
 *     name: 'title',
 *     role: 'content',
 *     email: '@email',           // attribute field
 *     createdAt: '@@createdAt',  // system field
 *     uppercaseName: { field: 'title', transform: 'uppercase' }
 *   },
 *   metaMapping: {
 *     tableId: 'id',
 *     tableName: 'identifier'
 *   }
 * }
 * ```
 */
export interface NodeLevelMapping {
  /** Output array key name (default: 'items') */
  outputKey?: string

  /** Node field mappings: { outputField: sourceField } */
  nodeMapping: Record<string, NodeFieldMapping>

  /** Table metadata mappings (optional): { outputField: tableField } */
  metaMapping?: Record<string, NodeFieldMapping>

  /** Output path for meta (default: 'meta') */
  metaKey?: string
}

// =============================================================================
// Transform Options
// =============================================================================

/**
 * Export transform options
 */
export interface ExportTransformOptions {
  /** Mapping template to use */
  template: FormatMappingTemplate | SimpleMappingDefinition
  /** Pretty print output JSON */
  prettyPrint?: boolean
  /** Include null values in output */
  includeNulls?: boolean
  /** Fail on missing source fields */
  strictMode?: boolean
}

/**
 * Import/Patch transform options
 */
export interface ImportTransformOptions {
  /** Mapping template to use (inverted for import) */
  template: FormatMappingTemplate | SimpleMappingDefinition
  /** Merge strategy for existing data */
  mergeStrategy?: 'replace' | 'merge' | 'deep-merge'
  /** Validate against schema before import */
  validateSchema?: boolean
  /** Fail on unknown fields */
  strictMode?: boolean
}

// =============================================================================
// Result Types
// =============================================================================

/**
 * Export transformation result
 */
export interface FormatExportResult {
  success: boolean
  /** Transformed data in custom format */
  data?: unknown
  /** JSON string of transformed data */
  json?: string
  /** Number of items transformed */
  itemCount: number
  /** Field mapping statistics */
  stats: {
    mappedFields: number
    skippedFields: number
    transformedValues: number
    defaultsApplied: number
  }
  errors: string[]
  warnings: string[]
}

/**
 * Import/Patch transformation result
 */
export interface FormatImportResult {
  success: boolean
  /** Transformed data in Flat JSON format */
  flatData?: import('./JsonExport.js').FlatJsonExport
  /** Patches to apply */
  patches?: import('./JsonExport.js').FlatNodePatch[]
  /** Number of items transformed */
  itemCount: number
  /** Field mapping statistics */
  stats: {
    mappedFields: number
    skippedFields: number
    transformedValues: number
    unknownFields: number
  }
  errors: string[]
  warnings: string[]
}

// =============================================================================
// Mapping Validation Types
// =============================================================================

/**
 * Mapping validation result
 */
export interface MappingValidationResult {
  valid: boolean
  errors: MappingValidationError[]
  warnings: MappingValidationWarning[]
}

/**
 * Mapping validation error
 */
export interface MappingValidationError {
  code: MappingErrorCode
  message: string
  path?: string
  details?: Record<string, unknown>
}

/**
 * Mapping validation warning
 */
export interface MappingValidationWarning {
  code: MappingWarningCode
  message: string
  path?: string
  suggestion?: string
}

/**
 * Error codes for mapping validation
 */
export type MappingErrorCode =
  | 'INVALID_SOURCE_PATH'
  | 'INVALID_TARGET_PATH'
  | 'CIRCULAR_REFERENCE'
  | 'DUPLICATE_TARGET'
  | 'INVALID_TRANSFORM'
  | 'MISSING_REQUIRED_FIELD'
  | 'TYPE_MISMATCH'

/**
 * Warning codes for mapping validation
 */
export type MappingWarningCode =
  | 'UNUSED_SOURCE_FIELD'
  | 'DEEP_NESTING'
  | 'POTENTIAL_DATA_LOSS'
  | 'DEPRECATED_TRANSFORM'

// =============================================================================
// Preset Mapping Templates
// =============================================================================

/**
 * Common preset mapping templates
 */
export const PRESET_MAPPINGS = {
  /** CSV-like flat structure */
  CSV_FLAT: {
    id: 'preset:csv-flat',
    name: 'CSV Flat',
    description: 'Simple flat structure suitable for CSV export',
    version: '1.0.0',
    mappings: [
      { target: 'rows[*].id', source: '$.nodes[*].id' },
      { target: 'rows[*].title', source: '$.nodes[*].title' },
      { target: 'rows[*].content', source: '$.nodes[*].content' },
    ],
    rootTemplate: { rows: [] },
  } as FormatMappingTemplate,

  /** API response format */
  API_RESPONSE: {
    id: 'preset:api-response',
    name: 'API Response',
    description: 'Standard API response format with data and meta',
    version: '1.0.0',
    mappings: [
      { target: 'data.items[*].id', source: '$.nodes[*].id' },
      { target: 'data.items[*].name', source: '$.nodes[*].title' },
      { target: 'data.items[*].description', source: '$.nodes[*].content' },
      { target: 'meta.total', source: '$.nodes.length' },
      { target: 'meta.tableId', source: '$.table.id' },
      { target: 'meta.tableName', source: '$.table.identifier' },
    ],
    rootTemplate: { data: { items: [] }, meta: {} },
  } as FormatMappingTemplate,

  /** Graph/Network format */
  GRAPH_FORMAT: {
    id: 'preset:graph',
    name: 'Graph Format',
    description: 'Graph/Network visualization format',
    version: '1.0.0',
    mappings: [
      { target: 'nodes[*].id', source: '$.nodes[*].id' },
      { target: 'nodes[*].label', source: '$.nodes[*].title' },
      { target: 'nodes[*].data', source: '$.nodes[*]' },
    ],
    rootTemplate: { nodes: [], edges: [] },
  } as FormatMappingTemplate,
} as const

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if value is a FormatMappingTemplate
 */
export function isFormatMappingTemplate(value: unknown): value is FormatMappingTemplate {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'mappings' in value &&
    Array.isArray((value as FormatMappingTemplate).mappings)
  )
}

/**
 * Check if value is a SimpleMappingDefinition
 */
export function isSimpleMappingDefinition(value: unknown): value is SimpleMappingDefinition {
  return (
    typeof value === 'object' &&
    value !== null &&
    !('mappings' in value) &&
    Object.keys(value).length > 0
  )
}

/**
 * Check if value is a FieldMapping
 */
export function isFieldMapping(value: unknown): value is FieldMapping {
  return typeof value === 'object' && value !== null && 'target' in value && 'source' in value
}

/**
 * Check if value is a NodeLevelMapping
 */
export function isNodeLevelMapping(value: unknown): value is NodeLevelMapping {
  return (
    typeof value === 'object' &&
    value !== null &&
    'nodeMapping' in value &&
    typeof (value as NodeLevelMapping).nodeMapping === 'object'
  )
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert SimpleMappingDefinition to FormatMappingTemplate
 */
export function normalizeMapping(
  mapping: FormatMappingTemplate | SimpleMappingDefinition | NodeLevelMapping,
  name?: string
): FormatMappingTemplate {
  if (isFormatMappingTemplate(mapping)) {
    return mapping
  }

  // Handle NodeLevelMapping
  if (isNodeLevelMapping(mapping)) {
    return expandNodeMapping(mapping, name)
  }

  // Convert simple mapping to template
  const mappings: FieldMapping[] = []

  for (const [target, source] of Object.entries(mapping)) {
    if (isFieldMapping(source)) {
      mappings.push(source)
    } else if (typeof source === 'string') {
      mappings.push({ target, source })
    }
  }

  return {
    id: `custom:${Date.now()}`,
    name: name || 'Custom Mapping',
    version: '1.0.0',
    mappings,
  }
}

/**
 * Expand NodeLevelMapping to full FormatMappingTemplate
 *
 * Converts simplified node-level syntax to full JSONPath mappings:
 * - 'title'      → $.nodes[*].title
 * - '@email'     → $.nodes[*].attributes.email
 * - '@@createdAt' → $.nodes[*].createdAt
 *
 * @example
 * ```typescript
 * expandNodeMapping({
 *   outputKey: 'users',
 *   nodeMapping: { id: 'id', name: 'title', email: '@email' }
 * })
 * // Returns FormatMappingTemplate with mappings:
 * // - users[*].id → $.nodes[*].id
 * // - users[*].name → $.nodes[*].title
 * // - users[*].email → $.nodes[*].attributes.email
 * ```
 */
export function expandNodeMapping(
  nodeMapping: NodeLevelMapping,
  name?: string
): FormatMappingTemplate {
  const mappings: FieldMapping[] = []
  const outputKey = nodeMapping.outputKey || 'items'
  const metaKey = nodeMapping.metaKey || 'meta'

  // Process node mappings
  for (const [outputField, sourceConfig] of Object.entries(nodeMapping.nodeMapping)) {
    const { field, transform, defaultValue } = parseNodeFieldMapping(sourceConfig)
    const sourcePath = resolveNodeSourcePath(field)

    mappings.push({
      target: `${outputKey}[*].${outputField}`,
      source: sourcePath,
      ...(transform && { transform }),
      ...(defaultValue !== undefined && { defaultValue }),
    })
  }

  // Process meta mappings (table-level)
  if (nodeMapping.metaMapping) {
    for (const [outputField, sourceConfig] of Object.entries(nodeMapping.metaMapping)) {
      const { field, transform, defaultValue } = parseNodeFieldMapping(sourceConfig)
      const sourcePath = `$.table.${field}`

      mappings.push({
        target: `${metaKey}.${outputField}`,
        source: sourcePath,
        ...(transform && { transform }),
        ...(defaultValue !== undefined && { defaultValue }),
      })
    }
  }

  return {
    id: `node-level:${Date.now()}`,
    name: name || 'Node Level Mapping',
    version: '1.0.0',
    mappings,
    rootTemplate: {
      [outputKey]: [],
      ...(nodeMapping.metaMapping && { [metaKey]: {} }),
    },
  }
}

/**
 * Parse NodeFieldMapping to extract field, transform, and defaultValue
 */
function parseNodeFieldMapping(config: NodeFieldMapping): {
  field: string
  transform?: TransformType
  defaultValue?: unknown
} {
  if (typeof config === 'string') {
    return { field: config }
  }
  return {
    field: config.field,
    transform: config.transform,
    defaultValue: config.defaultValue,
  }
}

/**
 * Resolve node source path from field name
 *
 * - 'title'       → $.nodes[*].title (core field)
 * - '@email'      → $.nodes[*].attributes.email (attribute)
 * - '@@createdAt' → $.nodes[*].createdAt (system field, strip one @)
 */
function resolveNodeSourcePath(field: string): FlatJsonPath {
  if (field.startsWith('@@')) {
    // System field (e.g., @@createdAt → $.nodes[*].createdAt)
    return `$.nodes[*].${field.slice(2)}`
  }
  if (field.startsWith('@')) {
    // Attribute field (e.g., @email → $.nodes[*].attributes.email)
    return `$.nodes[*].attributes.${field.slice(1)}`
  }
  // Core field (e.g., title → $.nodes[*].title)
  return `$.nodes[*].${field}`
}

import type { Attribute } from '@/domain/entities/Attribute.js'
import type { EmbeddingTaskType } from '@/domain/ports/IEmbeddingProvider.js'
import { ValidationException } from '@/shared/exceptions/DomainException.js'
import type { SafeJsonValue } from '@/shared/utils/safeJson.js'

export const COLUMN_CONFIG_METADATA_KEY = 'columnConfig'

export const COLUMN_SEMANTIC_ROLES = [
  'title',
  'slug',
  'summary',
  'category',
  'tag',
  'status',
  'priority',
  'owner',
  'date',
  'metric',
  'reference',
  'body',
  'embedding',
  'custom',
] as const

export type ColumnSemanticRole = (typeof COLUMN_SEMANTIC_ROLES)[number]

const VALID_ROLES = new Set<string>(COLUMN_SEMANTIC_ROLES)
const VALID_DIMENSIONS = new Set<number>([128, 256, 512, 768])

export interface ColumnEmbeddingOption {
  enabled: boolean
  sourceColumns?: string[]
  includeTitle?: boolean
  includeContent?: boolean
  task?: EmbeddingTaskType
  model?: string
  dimension?: 128 | 256 | 512 | 768
}

export interface ColumnConfig {
  role?: ColumnSemanticRole
  searchable?: boolean
  facetable?: boolean
  filterable?: boolean
  sortable?: boolean
  enumValues?: string[]
  defaultValue?: SafeJsonValue
  displayOrder?: number
  hidden?: boolean
  embedding?: ColumnEmbeddingOption
}

export interface TableColumnSummary {
  id: string
  identifier: string
  name: string
  description: string | null
  attributeTypeId: string
  isRequired: boolean
  config: ColumnConfig
}

export interface TableColumnProfile {
  tableId: string
  tableIdentifier?: string
  columns: TableColumnSummary[]
  facetableColumns: string[]
  searchableColumns: string[]
  sortableColumns: string[]
  filterableColumns: string[]
  visibleColumns: string[]
  hiddenColumns: string[]
  enumConstraints: Record<string, string[]>
  defaultValues: Record<string, SafeJsonValue>
  embeddingColumns: Array<{ identifier: string; config: ColumnEmbeddingOption }>
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function validateColumnConfig(config: ColumnConfig): void {
  if (config.role !== undefined && !VALID_ROLES.has(config.role)) {
    throw new ValidationException(`Invalid column role '${String(config.role)}'`)
  }
  if (config.enumValues !== undefined) {
    if (!Array.isArray(config.enumValues)) {
      throw new ValidationException('Column enumValues must be an array of non-empty strings')
    }
    for (const val of config.enumValues) {
      if (typeof val !== 'string' || val.trim().length === 0) {
        throw new ValidationException('Column enumValues entries must be non-empty strings')
      }
    }
  }
  if (
    config.displayOrder !== undefined &&
    (!Number.isInteger(config.displayOrder) || !Number.isFinite(config.displayOrder))
  ) {
    throw new ValidationException('Column displayOrder must be an integer')
  }
  if (config.embedding?.dimension !== undefined && !VALID_DIMENSIONS.has(config.embedding.dimension)) {
    throw new ValidationException(
      `Invalid column embedding dimension '${config.embedding.dimension}'; supported: 128, 256, 512, 768`,
    )
  }
}

export function extractColumnConfig(metadata: unknown): ColumnConfig | undefined {
  let parsed: unknown = metadata
  if (typeof metadata === 'string') {
    if (metadata.trim().length === 0) return undefined
    try {
      parsed = JSON.parse(metadata)
    } catch {
      return undefined
    }
  }
  if (!isPlainRecord(parsed)) return undefined
  const raw = parsed[COLUMN_CONFIG_METADATA_KEY]
  if (!isPlainRecord(raw)) return undefined

  const config: ColumnConfig = {}
  if (typeof raw.role === 'string' && VALID_ROLES.has(raw.role)) {
    config.role = raw.role as ColumnSemanticRole
  }
  if (typeof raw.searchable === 'boolean') config.searchable = raw.searchable
  if (typeof raw.facetable === 'boolean') config.facetable = raw.facetable
  if (typeof raw.filterable === 'boolean') config.filterable = raw.filterable
  if (typeof raw.sortable === 'boolean') config.sortable = raw.sortable
  if (Array.isArray(raw.enumValues)) {
    config.enumValues = raw.enumValues.filter((v): v is string => typeof v === 'string')
  }
  if ('defaultValue' in raw && raw.defaultValue !== undefined) {
    config.defaultValue = raw.defaultValue as SafeJsonValue
  }
  if (typeof raw.displayOrder === 'number' && Number.isInteger(raw.displayOrder)) {
    config.displayOrder = raw.displayOrder
  }
  if (typeof raw.hidden === 'boolean') config.hidden = raw.hidden
  if (isPlainRecord(raw.embedding) && typeof raw.embedding.enabled === 'boolean') {
    const emb: ColumnEmbeddingOption = { enabled: raw.embedding.enabled }
    if (Array.isArray(raw.embedding.sourceColumns)) {
      emb.sourceColumns = raw.embedding.sourceColumns.filter(
        (s): s is string => typeof s === 'string',
      )
    }
    if (typeof raw.embedding.includeTitle === 'boolean') emb.includeTitle = raw.embedding.includeTitle
    if (typeof raw.embedding.includeContent === 'boolean') {
      emb.includeContent = raw.embedding.includeContent
    }
    if (typeof raw.embedding.task === 'string') {
      emb.task = raw.embedding.task as EmbeddingTaskType
    }
    if (typeof raw.embedding.model === 'string') emb.model = raw.embedding.model
    if (
      typeof raw.embedding.dimension === 'number' &&
      VALID_DIMENSIONS.has(raw.embedding.dimension)
    ) {
      emb.dimension = raw.embedding.dimension as 128 | 256 | 512 | 768
    }
    config.embedding = emb
  }

  return Object.keys(config).length > 0 ? config : undefined
}

export function mergeColumnConfigIntoMetadata(
  existingMetadata: unknown,
  config?: ColumnConfig,
): Record<string, SafeJsonValue> | undefined {
  let base: Record<string, SafeJsonValue> = {}
  if (typeof existingMetadata === 'string' && existingMetadata.trim().length > 0) {
    try {
      const parsed = JSON.parse(existingMetadata)
      if (isPlainRecord(parsed)) {
        base = { ...(parsed as Record<string, SafeJsonValue>) }
      }
    } catch {
      base = {}
    }
  } else if (isPlainRecord(existingMetadata)) {
    base = { ...(existingMetadata as Record<string, SafeJsonValue>) }
  }

  if (config) {
    validateColumnConfig(config)
    base[COLUMN_CONFIG_METADATA_KEY] = config as unknown as SafeJsonValue
  }

  return Object.keys(base).length > 0 ? base : undefined
}

export function resolveTableColumnSchema(
  tableId: string,
  attributes: Attribute[],
  tableIdentifier?: string,
): TableColumnProfile {
  const columns: TableColumnSummary[] = attributes.map((attr) => ({
    id: String(attr.getId()),
    identifier: attr.getIdentifier(),
    name: attr.getName(),
    description: attr.getDescription(),
    attributeTypeId: String(attr.getAttributeTypeId()),
    isRequired: attr.getIsRequired(),
    config: extractColumnConfig(attr.getParsedMetadata()) ?? {},
  }))

  columns.sort((a, b) => {
    const orderA = a.config.displayOrder ?? Number.MAX_SAFE_INTEGER
    const orderB = b.config.displayOrder ?? Number.MAX_SAFE_INTEGER
    if (orderA !== orderB) return orderA - orderB
    return a.identifier.localeCompare(b.identifier)
  })

  const facetableColumns: string[] = []
  const searchableColumns: string[] = []
  const sortableColumns: string[] = []
  const filterableColumns: string[] = []
  const visibleColumns: string[] = []
  const hiddenColumns: string[] = []
  const enumConstraints: Record<string, string[]> = {}
  const defaultValues: Record<string, SafeJsonValue> = {}
  const embeddingColumns: Array<{ identifier: string; config: ColumnEmbeddingOption }> = []

  for (const col of columns) {
    const cfg = col.config
    if (cfg.facetable) facetableColumns.push(col.identifier)
    if (cfg.searchable) searchableColumns.push(col.identifier)
    if (cfg.sortable) sortableColumns.push(col.identifier)
    if (cfg.filterable !== false) filterableColumns.push(col.identifier)
    if (cfg.hidden) {
      hiddenColumns.push(col.identifier)
    } else {
      visibleColumns.push(col.identifier)
    }
    if (cfg.enumValues && cfg.enumValues.length > 0) {
      enumConstraints[col.identifier] = cfg.enumValues
    }
    if (cfg.defaultValue !== undefined) {
      defaultValues[col.identifier] = cfg.defaultValue
    }
    if (cfg.embedding?.enabled) {
      embeddingColumns.push({ identifier: col.identifier, config: cfg.embedding })
    }
  }

  return {
    tableId,
    ...(tableIdentifier ? { tableIdentifier } : {}),
    columns,
    facetableColumns,
    searchableColumns,
    sortableColumns,
    filterableColumns,
    visibleColumns,
    hiddenColumns,
    enumConstraints,
    defaultValues,
    embeddingColumns,
  }
}

export interface ResolvedEmbeddingColumnOptions {
  enabledColumns: string[]
  attributeIdentifiers: string[]
  includeTitle: boolean
  includeContent: boolean
  task: EmbeddingTaskType
  model?: string
}

/**
 * Aggregate opt-in `embedding` column options into concrete `EmbedNodesUseCase` execution options.
 * Returns `null` when no column has `embedding.enabled === true`.
 */
export function resolveEmbeddingColumnExecutionOptions(
  profile: TableColumnProfile,
  overrideModel?: string,
): ResolvedEmbeddingColumnOptions | null {
  if (profile.embeddingColumns.length === 0) {
    return null
  }

  const sourceColumns = new Set<string>()
  let includeTitle = true
  let includeContent = true
  let task: EmbeddingTaskType = 'retrieval_document'
  let model = overrideModel

  for (const { identifier, config } of profile.embeddingColumns) {
    if (config.sourceColumns && config.sourceColumns.length > 0) {
      for (const col of config.sourceColumns) sourceColumns.add(col)
    } else {
      sourceColumns.add(identifier)
    }
    if (config.includeTitle === false) includeTitle = false
    if (config.includeContent === false) includeContent = false
    if (config.task) task = config.task
    if (!model && config.model) model = config.model
  }

  return {
    enabledColumns: profile.embeddingColumns.map((col) => col.identifier),
    attributeIdentifiers: [...sourceColumns],
    includeTitle,
    includeContent,
    task,
    ...(model ? { model } : {}),
  }
}

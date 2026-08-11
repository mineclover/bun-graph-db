import type { ILogger } from '@/application/ports/ILogger.js'
import type { TableId } from '@/core/types/CommonTypes.js'
import {
  projectTableSchema,
  type TableProjectionAttribute,
  type TableProjectionAttributeType,
  type TableSchemaProjection,
} from '@/core/schema/TableSchemaProjection.js'
import type { Attribute } from '@/domain/entities/Attribute.js'
import type { AttributeType } from '@/domain/entities/AttributeType.js'
import type { Table } from '@/domain/entities/Table.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'

export type TableSchemaProjectionRequest =
  | { tableId: string; identifier?: never }
  | { identifier: string; tableId?: never }

export class TableSchemaProjectionService {
  private static readonly cache = new Map<string, {
    identifier: string
    projection: TableSchemaProjection
    expiresAt: number
  }>()
  private static readonly tableIdByIdentifier = new Map<string, string>()
  private static readonly inFlight = new Map<string, Promise<TableSchemaProjection>>()
  private static readonly maxCacheEntries = 256
  private static readonly cacheTtlMs = 30_000
  private static generation = 0

  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly logger?: ILogger,
  ) {}

  async project(request: TableSchemaProjectionRequest): Promise<TableSchemaProjection> {
    const cached = TableSchemaProjectionService.getCached(request)
    if (cached) return cached

    const requestKey = 'tableId' in request ? `id:${request.tableId}` : `identifier:${request.identifier}`
    const existingFlight = TableSchemaProjectionService.inFlight.get(requestKey)
    if (existingFlight) return existingFlight

    const generation = TableSchemaProjectionService.generation
    const flight = this.projectFresh(request, generation)
    TableSchemaProjectionService.inFlight.set(requestKey, flight)
    try {
      return await flight
    } finally {
      if (TableSchemaProjectionService.inFlight.get(requestKey) === flight) {
        TableSchemaProjectionService.inFlight.delete(requestKey)
      }
    }
  }

  static clearCache(tableId?: string): void {
    TableSchemaProjectionService.generation += 1
    // An identifier-keyed flight may not have resolved its table yet. Detach
    // every flight so post-invalidation callers cannot join stale work.
    TableSchemaProjectionService.inFlight.clear()
    if (tableId === undefined) {
      TableSchemaProjectionService.cache.clear()
      TableSchemaProjectionService.tableIdByIdentifier.clear()
      return
    }

    const cached = TableSchemaProjectionService.cache.get(tableId)
    TableSchemaProjectionService.cache.delete(tableId)
    if (cached) TableSchemaProjectionService.tableIdByIdentifier.delete(cached.identifier)
    for (const [identifier, cachedTableId] of TableSchemaProjectionService.tableIdByIdentifier) {
      if (cachedTableId === tableId) TableSchemaProjectionService.tableIdByIdentifier.delete(identifier)
    }
  }

  private async projectFresh(
    request: TableSchemaProjectionRequest,
    generation: number,
  ): Promise<TableSchemaProjection> {
    const table = await this.findTable(request)
    if (!table) {
      const key = 'tableId' in request ? request.tableId : request.identifier
      throw new Error(`Table '${key}' not found`)
    }

    const cached = TableSchemaProjectionService.getCached({ tableId: table.id })
    if (cached) return cached

    const attributes = await this.findTableAttributes(table)
    const attributeTypes = await this.findAttributeTypes(attributes)
    const input = {
      table: {
        id: table.id,
        identifier: table.identifier,
        description: table.description,
        updatedAt: table.updatedAt,
      },
      attributes: attributes.map(attributeToProjection),
      attributeTypes: attributeTypes.map(attributeTypeToProjection),
    }

    const projection = projectTableSchema(input)
    if (generation === TableSchemaProjectionService.generation) {
      TableSchemaProjectionService.storeCached(table.id, table.identifier, projection)
    }

    this.logger?.debug('Projected table schema', {
      tableId: projection.tableId,
      tableIdentifier: projection.tableIdentifier,
      versionHash: projection.versionHash,
      diagnostics: projection.diagnostics.length,
      refs: projection.refs.length,
    })

    return projection
  }

  private static getCached(request: TableSchemaProjectionRequest): TableSchemaProjection | undefined {
    const tableId = 'tableId' in request
      ? request.tableId
      : TableSchemaProjectionService.tableIdByIdentifier.get(request.identifier)
    if (!tableId) return undefined
    const cached = TableSchemaProjectionService.cache.get(tableId)
    if (!cached) return undefined
    if (cached.expiresAt <= Date.now()) {
      TableSchemaProjectionService.cache.delete(tableId)
      TableSchemaProjectionService.tableIdByIdentifier.delete(cached.identifier)
      return undefined
    }
    TableSchemaProjectionService.cache.delete(tableId)
    TableSchemaProjectionService.cache.set(tableId, cached)
    return cached.projection
  }

  private static storeCached(tableId: string, identifier: string, projection: TableSchemaProjection): void {
    TableSchemaProjectionService.cache.delete(tableId)
    TableSchemaProjectionService.cache.set(tableId, {
      identifier,
      projection,
      expiresAt: Date.now() + TableSchemaProjectionService.cacheTtlMs,
    })
    TableSchemaProjectionService.tableIdByIdentifier.set(identifier, tableId)
    while (TableSchemaProjectionService.cache.size > TableSchemaProjectionService.maxCacheEntries) {
      const oldestTableId = TableSchemaProjectionService.cache.keys().next().value
      if (oldestTableId === undefined) break
      const evicted = TableSchemaProjectionService.cache.get(oldestTableId)
      TableSchemaProjectionService.cache.delete(oldestTableId)
      if (evicted) TableSchemaProjectionService.tableIdByIdentifier.delete(evicted.identifier)
    }
  }

  private async findTable(request: TableSchemaProjectionRequest): Promise<Table | null> {
    if ('tableId' in request) return this.tableRepository.findById(request.tableId as TableId)
    return this.tableRepository.findByIdentifier(request.identifier)
  }

  private async findTableAttributes(table: Table): Promise<Attribute[]> {
    const attributes: Attribute[] = []
    const limit = 500
    let offset = 0

    while (true) {
      const result = await this.attributeRepository.findByTableId(table.id, { limit, offset })
      const page = result.data ?? result.nodes ?? result.items ?? []
      attributes.push(...page)
      offset += page.length
      const total = result.total ?? result.totalCount ?? attributes.length
      if (page.length === 0 || offset >= total) return attributes
    }
  }

  private async findAttributeTypes(attributes: Attribute[]): Promise<AttributeType[]> {
    const ids = [...new Set(attributes.map(attribute => attribute.getAttributeTypeId()))]
    const found = await this.attributeTypeRepository.findByIds(ids)
    const byId = new Map(found.map(attributeType => [attributeType.getId(), attributeType]))
    const missing = ids.filter(id => !byId.has(id))

    if (missing.length > 0) {
      this.logger?.warn('Missing attribute types while projecting table schema', { missing })
    }

    return found
  }
}

function attributeToProjection(attribute: Attribute): TableProjectionAttribute {
  return {
    id: attribute.getId(),
    tableId: attribute.getTableId(),
    identifier: attribute.getIdentifier(),
    name: attribute.getName(),
    description: attribute.getDescription(),
    attributeTypeId: attribute.getAttributeTypeId(),
    isRequired: attribute.getIsRequired(),
    metadata: attribute.getParsedMetadata(),
    updatedAt: attribute.getUpdatedAt(),
  }
}

function attributeTypeToProjection(attributeType: AttributeType): TableProjectionAttributeType {
  return {
    id: attributeType.getId(),
    identifier: attributeType.getIdentifier(),
    jsonType: attributeType.getJsonType(),
    format: attributeType.getFormat(),
    description: attributeType.getDescription(),
    validationSchema: attributeType.getValidationSchema(),
    referenceConfig: attributeType.getReferenceConfig(),
    defaultValue: attributeType.getDefaultValue(),
    examples: attributeType.getExamples(),
    updatedAt: attributeType.getUpdatedAt(),
  }
}

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
  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly logger?: ILogger,
  ) {}

  async project(request: TableSchemaProjectionRequest): Promise<TableSchemaProjection> {
    const table = await this.findTable(request)
    if (!table) {
      const key = 'tableId' in request ? request.tableId : request.identifier
      throw new Error(`Table '${key}' not found`)
    }

    const attributes = await this.findTableAttributes(table)
    const attributeTypes = await this.findAttributeTypes(attributes)

    const projection = projectTableSchema({
      table: {
        id: table.id,
        identifier: table.identifier,
        description: table.description,
        updatedAt: table.updatedAt,
      },
      attributes: attributes.map(attributeToProjection),
      attributeTypes: attributeTypes.map(attributeTypeToProjection),
    })

    this.logger?.debug('Projected table schema', {
      tableId: projection.tableId,
      tableIdentifier: projection.tableIdentifier,
      versionHash: projection.versionHash,
      diagnostics: projection.diagnostics.length,
      refs: projection.refs.length,
    })

    return projection
  }

  private async findTable(request: TableSchemaProjectionRequest): Promise<Table | null> {
    if ('tableId' in request) return this.tableRepository.findById(request.tableId as TableId)
    return this.tableRepository.findByIdentifier(request.identifier)
  }

  private async findTableAttributes(table: Table): Promise<Attribute[]> {
    const result = await this.attributeRepository.findByTableId(table.id, { limit: 1000, offset: 0 })
    return result.data ?? result.nodes ?? result.items ?? []
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
    validationSchema: attributeType.getParsedValidationSchema(),
    referenceConfig: attributeType.getParsedReferenceConfig(),
    defaultValue: attributeType.getParsedDefaultValue(),
    examples: attributeType.getParsedExamples(),
    updatedAt: attributeType.getUpdatedAt(),
  }
}

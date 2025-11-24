import type {
  AttributeId,
  AttributeTypeId,
  PaginatedResult,
  PaginationOptions,
  TableId,
} from '@/core/types/CommonTypes.js'
import type { Attribute } from '@/domain/entities/Attribute.js'
import type { AttributeType } from '@/domain/entities/AttributeType.js'
import type { IFullRepository, ITableScopedRepository } from '@/core/types/RepositoryTypes.js'

export interface AttributeUpdateData {
  identifier?: string
  description?: string | null
  isRequired?: boolean
  defaultValue?: any
}

// Extends IFullRepository (provides: save, findById, findByIdentifier, findAll, delete,
// exists, count, saveMany, findByIds, update) and ITableScopedRepository (provides:
// findByParentId, countByParentId, deleteByParentId)
export interface IAttributeRepository
  extends IFullRepository<Attribute, AttributeId, AttributeUpdateData>,
          ITableScopedRepository<Attribute, AttributeId> {

  // Attribute-specific methods only
  findByTableIdAndIdentifier(
    tableId: TableId,
    identifier: string
  ): Promise<Attribute | null>

  findByAttributeTypeId(
    attributeTypeId: AttributeTypeId,
    options?: PaginationOptions
  ): Promise<PaginatedResult<Attribute>>

  findRequiredByTableId(tableId: TableId): Promise<Attribute[]>
  getAttributeTypeForAttribute(attributeId: AttributeId): Promise<AttributeType | null>

  // Note: The following methods are inherited from base interfaces:
  // - findById, findByIdentifier, findAll from IFullRepository
  // - save, delete, count, saveMany, findByIds, update from IFullRepository
  // - findByParentId (as findByTableId), countByParentId (as countByTableId),
  //   deleteByParentId (as deleteByTableId) from ITableScopedRepository
  // - exists from IFullRepository (uses identifier parameter)

  // Table-scoped existence check (more specific than base exists)
  existsByTableIdAndIdentifier(tableId: TableId, identifier: string): Promise<boolean>

  // Rename aliases for clarity (these map to ITableScopedRepository methods)
  findByTableId(tableId: TableId, options?: PaginationOptions): Promise<PaginatedResult<Attribute>>
  countByTableId(tableId: TableId): Promise<number>
  deleteByTableId(tableId: TableId): Promise<void>
}

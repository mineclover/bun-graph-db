import type { Attribute } from '@/domain/entities/Attribute.js'
import type { AttributeType } from '@/domain/entities/AttributeType.js'
import type { AttributeId, AttributeTypeId, TableId, PaginationOptions, PaginatedResult } from '@/shared/types/common.js'

export interface IAttributeRepository {
  save(attribute: Attribute): Promise<void>
  findById(id: AttributeId): Promise<Attribute | null>
  findByTableIdAndIdentifier(tableId: TableId, identifier: string): Promise<Attribute | null>
  findByTableId(tableId: TableId, options?: PaginationOptions): Promise<PaginatedResult<Attribute>>
  findByAttributeTypeId(attributeTypeId: AttributeTypeId, options?: PaginationOptions): Promise<PaginatedResult<Attribute>>
  findAll(options?: PaginationOptions): Promise<PaginatedResult<Attribute>>
  delete(id: AttributeId): Promise<void>
  deleteByTableId(tableId: TableId): Promise<void>
  exists(tableId: TableId, identifier: string): Promise<boolean>
  count(): Promise<number>
  countByTableId(tableId: TableId): Promise<number>
  saveMany(attributes: Attribute[]): Promise<void>
  findByIds(ids: AttributeId[]): Promise<Attribute[]>
  findRequiredByTableId(tableId: TableId): Promise<Attribute[]>
  getAttributeTypeForAttribute(attributeId: AttributeId): Promise<AttributeType | null>
}
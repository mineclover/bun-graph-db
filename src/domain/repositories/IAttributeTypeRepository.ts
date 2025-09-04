import type { AttributeType } from '@/domain/entities/AttributeType.js'
import type { AttributeTypeId, PaginationOptions, PaginatedResult } from '@/shared/types/common.js'

export interface IAttributeTypeRepository {
  save(attributeType: AttributeType): Promise<void>
  findById(id: AttributeTypeId): Promise<AttributeType | null>
  findByIdentifier(identifier: string): Promise<AttributeType | null>
  findAll(options?: PaginationOptions): Promise<PaginatedResult<AttributeType>>
  findByJsonType(jsonType: string, options?: PaginationOptions): Promise<PaginatedResult<AttributeType>>
  delete(id: AttributeTypeId): Promise<void>
  exists(identifier: string): Promise<boolean>
  count(): Promise<number>
  saveMany(attributeTypes: AttributeType[]): Promise<void>
  findByIds(ids: AttributeTypeId[]): Promise<AttributeType[]>
}
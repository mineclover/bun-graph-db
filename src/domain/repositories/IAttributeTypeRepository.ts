import type {
  AttributeTypeId,
  PaginatedResult,
  PaginationOptions,
} from '@/core/types/CommonTypes.js'
import type { AttributeType } from '@/domain/entities/AttributeType.js'

export interface IAttributeTypeRepository {
  save(attributeType: AttributeType): Promise<void>
  findById(id: AttributeTypeId): Promise<AttributeType | null>
  findByIdentifier(identifier: string): Promise<AttributeType | null>
  findAll(options?: PaginationOptions): Promise<PaginatedResult<AttributeType>>
  findByJsonType(
    jsonType: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<AttributeType>>
  delete(id: AttributeTypeId): Promise<void>
  exists(identifier: string): Promise<boolean>
  count(): Promise<number>
  saveMany(attributeTypes: AttributeType[]): Promise<void>
  findByIds(ids: AttributeTypeId[]): Promise<AttributeType[]>
  update(id: AttributeTypeId, updates: Partial<AttributeType>): Promise<AttributeType>
}

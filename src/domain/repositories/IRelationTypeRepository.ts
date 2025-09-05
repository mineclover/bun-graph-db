import type {
  PaginatedResult,
  PaginationOptions,
  RelationTypeId,
} from '@/core/types/CommonTypes.js'
import type { RelationType } from '@/domain/entities/RelationType.js'

export interface IRelationTypeRepository {
  save(relationType: RelationType): Promise<void>
  findById(id: RelationTypeId): Promise<RelationType | null>
  findByIdentifier(identifier: string): Promise<RelationType | null>
  findAll(options?: PaginationOptions): Promise<PaginatedResult<RelationType>>
  update(relationType: RelationType): Promise<void>
  delete(id: RelationTypeId): Promise<void>
  exists(identifier: string): Promise<boolean>
}

import type { RelationTypeId } from '@/core/types/CommonTypes.js'
import type {
  IRepositoryWithBatchOperations,
  IRepositoryWithIdentifier,
} from '@/core/types/RepositoryTypes.js'
import type { RelationType } from '@/domain/entities/RelationType.js'

// Extends IRepositoryWithIdentifier (provides: save, findById, findByIdentifier, findAll,
// delete, count, exists) and adds batch operations support
export interface IRelationTypeRepository
  extends IRepositoryWithIdentifier<RelationType, RelationTypeId>,
    IRepositoryWithBatchOperations<RelationType, RelationTypeId> {
  // Override update to use entity instead of partial updates
  update(relationType: RelationType): Promise<void>

  // Note: The following methods are inherited from base interfaces:
  // - save, findById, findByIdentifier, findAll, delete from IRepositoryWithIdentifier
  // - exists from IRepositoryWithIdentifier
  // - count from IBaseRepository
  // - saveMany, findByIds, deleteMany from IRepositoryWithBatchOperations
}

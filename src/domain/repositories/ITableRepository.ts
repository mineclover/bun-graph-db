import type { PaginatedResult, TableId, TableSearchOptions } from '@/core/types/CommonTypes.js'
import type { IFullRepository } from '@/core/types/RepositoryTypes.js'
import type { Table } from '@/domain/entities/Table.js'

// Repository interface (Port) - defines what the domain needs from persistence
// Extends IFullRepository which provides: save, findById, findByIdentifier, findAll, delete,
// exists, count, saveMany, findByIds, update
export interface ITableRepository extends IFullRepository<Table, TableId, Partial<Table>> {
  // Override findAll to use TableSearchOptions instead of generic PaginationOptions
  findAll(options?: TableSearchOptions): Promise<PaginatedResult<Table>>
}

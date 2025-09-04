import type { Table } from '@/domain/entities/Table.js'
import type { TableId, PaginationOptions, PaginatedResult } from '@/core/types/CommonTypes.js'

// Repository interface (Port) - defines what the domain needs from persistence
export interface ITableRepository {
  // Basic CRUD operations
  save(table: Table): Promise<void>
  findById(id: TableId): Promise<Table | null>
  findByIdentifier(identifier: string): Promise<Table | null>
  findAll(options?: PaginationOptions): Promise<PaginatedResult<Table>>
  delete(id: TableId): Promise<void>
  
  // Business-specific queries
  exists(identifier: string): Promise<boolean>
  count(): Promise<number>
  
  // Batch operations for performance
  saveMany(tables: Table[]): Promise<void>
  findByIds(ids: TableId[]): Promise<Table[]>
}
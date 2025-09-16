import type { DocId, TableId, PaginatedResult } from '@/core/types/CommonTypes.js'
import type { Doc, DocCategory } from '@/domain/entities/Doc.js'

export interface DocSearchOptions {
  limit?: number
  offset?: number
  tableId?: TableId
  category?: DocCategory
  isActive?: boolean
  version?: number
  createdAfter?: Date
  createdBefore?: Date
  sortBy?: string
  sortDirection?: 'ASC' | 'DESC'
}

// Repository interface (Port) - defines what the domain needs from persistence
export interface IDocRepository {
  // Basic CRUD operations
  save(doc: Doc): Promise<void>
  findById(id: DocId): Promise<Doc | null>
  findAll(options?: DocSearchOptions): Promise<PaginatedResult<Doc>>
  delete(id: DocId): Promise<void>

  // Doc-specific queries
  findByTableAndCategory(tableId: TableId, category: DocCategory): Promise<Doc[]>
  findActiveByTableAndCategory(tableId: TableId, category: DocCategory): Promise<Doc | null>
  findVersionsByTableAndCategory(tableId: TableId, category: DocCategory): Promise<Doc[]>
  searchDocs(options: DocSearchOptions): Promise<PaginatedResult<Doc>>

  // Versioning operations
  getLatestVersion(tableId: TableId, category: DocCategory): Promise<number>
  deactivateOthersInCategory(tableId: TableId, category: DocCategory, exceptId?: DocId): Promise<void>

  // Business-specific queries
  exists(tableId: TableId, category: DocCategory, version: number): Promise<boolean>
  count(tableId?: TableId): Promise<number>
  countByCategory(category: DocCategory): Promise<number>

  // Batch operations for performance
  saveMany(docs: Doc[]): Promise<void>
  findByIds(ids: DocId[]): Promise<Doc[]>
  findByTableIds(tableIds: TableId[]): Promise<Doc[]>
}
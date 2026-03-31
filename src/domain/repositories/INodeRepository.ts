import type { NodeId, PaginatedResult, PaginationOptions, TableId } from '@/core/types/CommonTypes.js'
import type { Node } from '@/domain/entities/Node.js'
import type { SafeJsonValue } from '@/shared/utils/safeJson.js'

export interface INodeRepository {
  save(node: Node): Promise<void>
  findById(id: NodeId): Promise<Node | null>
  findByTableIdAndContent(tableId: TableId, content: string): Promise<Node | null>
  findByTableId(tableId: TableId, options?: PaginationOptions): Promise<PaginatedResult<Node>>
  findAll(options?: PaginationOptions): Promise<PaginatedResult<Node>>
  delete(id: NodeId): Promise<void>
  deleteByTableId(tableId: TableId): Promise<void>
  exists(tableId: TableId, content: string): Promise<boolean>
  count(): Promise<number>
  countByTableId(tableId: TableId): Promise<number>
  saveMany(nodes: Node[]): Promise<void>
  findByIds(ids: NodeId[]): Promise<Node[]>
  searchByContent(tableId: TableId, searchTerm: string, options?: PaginationOptions): Promise<PaginatedResult<Node>>
  executeRawQuery(query: string, params?: unknown[]): Promise<unknown[]>
  update(
    id: NodeId,
    updates: { content?: string; title?: string | null; description?: string | null; metadata?: SafeJsonValue },
  ): Promise<Node>
}

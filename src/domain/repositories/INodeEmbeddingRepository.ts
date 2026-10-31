import type { NodeId, TableId } from '@/core/types/CommonTypes.js'

export interface NodeEmbeddingRecord {
  nodeId: NodeId
  tableId: TableId
  dimension: number
  model: string
  vector: number[]
  norm: number
  createdAt: string
  updatedAt: string
}

export interface UpsertNodeEmbeddingInput {
  nodeId: NodeId
  tableId?: TableId
  vector: readonly number[]
  model?: string
}

export interface VectorSimilarityHit {
  nodeId: NodeId
  score: number
  rank: number
  model: string
}

export interface VectorSimilaritySearchOptions {
  tableId: TableId
  queryVector: readonly number[]
  limit: number
  minScore?: number
  model?: string
  restrictToNodeIds?: ReadonlySet<string>
}

export interface VectorSimilaritySearchResult {
  hits: VectorSimilarityHit[]
  metrics: {
    dimension: number
    tableVectors: number
    scanned: number
    dimensionMismatches: number
    queryMs: number
  }
}

export interface INodeEmbeddingRepository {
  upsert(input: UpsertNodeEmbeddingInput): Promise<NodeEmbeddingRecord>
  upsertMany?(inputs: readonly UpsertNodeEmbeddingInput[]): Promise<NodeEmbeddingRecord[]>
  findByNodeId(nodeId: NodeId): Promise<NodeEmbeddingRecord | null>
  findByTableId?(
    tableId: TableId,
    options?: { limit?: number; offset?: number },
  ): Promise<NodeEmbeddingRecord[]>
  deleteByNodeId(nodeId: NodeId): Promise<boolean>
  countByTableId(tableId: TableId): Promise<number>
  searchSimilar(options: VectorSimilaritySearchOptions): Promise<VectorSimilaritySearchResult>
  invalidateCache(tableId?: TableId): void
}

import type { Statement } from './SqliteAdapter.js'
import type { ISqliteDatabase } from './SqlitePort.js'
import type { NodeId, TableId } from '@/core/types/CommonTypes.js'
import type {
  INodeEmbeddingRepository,
  NodeEmbeddingRecord,
  UpsertNodeEmbeddingInput,
  VectorSimilarityHit,
  VectorSimilaritySearchOptions,
  VectorSimilaritySearchResult,
} from '@/domain/repositories/INodeEmbeddingRepository.js'
import {
  BoundedTopKCollector,
  computeFloat32Norm,
  dotProductFloat32Slab,
} from '@/domain/services/vector/ExactVectorIndex.js'
import {
  DatabaseException,
  NotFoundException,
  ValidationException,
} from '@/shared/exceptions/DomainException.js'

export const MAX_EMBEDDING_DIMENSION = 8_192
const DEFAULT_MAX_CACHED_TABLES = 64
const DEFAULT_MAX_CACHE_BYTES = 128 * 1024 * 1024

export interface SqliteNodeEmbeddingRepositoryOptions {
  maxCachedTables?: number
  maxCacheBytes?: number
}

interface EmbeddingLocation {
  bucketKey: string
  slot: number
}

/**
 * Contiguous Float32Array slab grouped by `(dimension, model)` with swap-remove
 * compaction and unit-normalized vectors so cosine scans run sequentially over
 * dense typed arrays as pure dot products without per-candidate normalization.
 */
class Float32ModelSlabBucket {
  readonly dimension: number
  readonly model: string
  nodeIds: string[] = []
  slab: Float32Array
  hasSignal: Uint8Array
  private capacity: number
  count = 0

  constructor(dimension: number, model: string, initialCapacity = 32) {
    this.dimension = dimension
    this.model = model
    this.capacity = Math.max(4, initialCapacity)
    this.slab = new Float32Array(this.capacity * dimension)
    this.hasSignal = new Uint8Array(this.capacity)
  }

  get byteLength(): number {
    return this.slab.byteLength + this.hasSignal.byteLength + this.capacity * 64
  }

  append(nodeId: string, vector: Float32Array, norm: number): number {
    if (this.count >= this.capacity) {
      this.grow()
    }
    const slot = this.count
    this.count += 1
    this.nodeIds[slot] = nodeId
    this.writeNormalized(slot, vector, norm)
    return slot
  }

  overwrite(slot: number, vector: Float32Array, norm: number): void {
    this.writeNormalized(slot, vector, norm)
  }

  swapRemove(slot: number): string | null {
    const last = this.count - 1
    let movedNodeId: string | null = null
    if (slot < last) {
      movedNodeId = this.nodeIds[last] as string
      this.slab.copyWithin(
        slot * this.dimension,
        last * this.dimension,
        (last + 1) * this.dimension,
      )
      this.hasSignal[slot] = this.hasSignal[last] as number
      this.nodeIds[slot] = movedNodeId
    }
    this.nodeIds.pop()
    this.count -= 1
    return movedNodeId
  }

  private writeNormalized(slot: number, vector: Float32Array, norm: number): void {
    const offset = slot * this.dimension
    if (norm > 0) {
      const invNorm = 1 / norm
      for (let i = 0; i < this.dimension; i += 1) {
        this.slab[offset + i] = (vector[i] as number) * invNorm
      }
      this.hasSignal[slot] = 1
    } else {
      this.slab.fill(0, offset, offset + this.dimension)
      this.hasSignal[slot] = 0
    }
  }

  private grow(): void {
    const nextCapacity = this.capacity * 2
    const nextSlab = new Float32Array(nextCapacity * this.dimension)
    nextSlab.set(this.slab)
    const nextHasSignal = new Uint8Array(nextCapacity)
    nextHasSignal.set(this.hasSignal)
    this.slab = nextSlab
    this.hasSignal = nextHasSignal
    this.capacity = nextCapacity
  }
}

interface TableEmbeddingCache {
  revision: number
  totalVectors: number
  byteSize: number
  buckets: Map<string, Float32ModelSlabBucket>
  locations: Map<string, EmbeddingLocation>
}

interface NodeEmbeddingRow {
  node_id: string
  table_id: string
  dimension: number
  model: string
  vector_blob: Uint8Array
  norm: number
  created_at: string
  updated_at: string
}

interface PersistedTimestampRow {
  created_at: string
  updated_at: string
}

export class SqliteNodeEmbeddingRepository implements INodeEmbeddingRepository {
  private readonly tableCaches = new Map<string, TableEmbeddingCache>()
  private readonly maxCachedTables: number
  private readonly maxCacheBytes: number
  private totalCacheBytes = 0
  private hasRevisionTableVerified = false

  private selectNodeTableStmt: Statement<{ id: string; table_id: string }, [string]> | null = null
  private upsertReturningStmt: Statement<
    PersistedTimestampRow,
    [string, string, number, string, Uint8Array, number, string, string]
  > | null = null
  private findByNodeIdStmt: Statement<NodeEmbeddingRow, [string]> | null = null
  private selectOwnerStmt: Statement<{ node_id: string; table_id: string }, [string]> | null = null
  private deleteByNodeIdStmt: Statement<unknown, [string]> | null = null
  private countByTableIdStmt: Statement<{ count: number }, [string]> | null = null
  private loadTableEmbeddingsStmt: Statement<
    {
      node_id: string
      dimension: number
      model: string
      vector_blob: Uint8Array
      norm: number
    },
    [string]
  > | null = null
  private readRevisionStmt: Statement<{ revision: number }, [string]> | null = null

  constructor(
    private readonly db: ISqliteDatabase,
    options: SqliteNodeEmbeddingRepositoryOptions = {},
  ) {
    this.maxCachedTables = Math.max(1, options.maxCachedTables ?? DEFAULT_MAX_CACHED_TABLES)
    this.maxCacheBytes = Math.max(1024, options.maxCacheBytes ?? DEFAULT_MAX_CACHE_BYTES)
  }

  getCacheStats(): { tableCount: number; totalBytes: number } {
    return {
      tableCount: this.tableCaches.size,
      totalBytes: this.totalCacheBytes,
    }
  }

  async upsert(input: UpsertNodeEmbeddingInput): Promise<NodeEmbeddingRecord> {
    const nodeId = String(input.nodeId ?? '').trim()
    if (!nodeId) {
      throw new ValidationException('Node ID is required')
    }

    validateEmbeddingVector(input.vector)
    const model = input.model?.trim() || 'default'

    const nodeRow = this.getSelectNodeTableStmt().get(nodeId)
    if (!nodeRow) {
      throw new NotFoundException(`Node with id '${nodeId}' not found`)
    }

    if (input.tableId !== undefined && String(input.tableId).trim() !== nodeRow.table_id) {
      throw new ValidationException(
        `Node '${nodeId}' belongs to table '${nodeRow.table_id}', not '${input.tableId}'`,
      )
    }

    const float32 = Float32Array.from(input.vector)
    const norm = computeFloat32Norm(float32)
    const blob = new Uint8Array(float32.buffer, float32.byteOffset, float32.byteLength)
    const nowIso = new Date().toISOString()

    try {
      const timestamps = this.getUpsertReturningStmt().get(
        nodeRow.id,
        nodeRow.table_id,
        float32.length,
        model,
        blob,
        norm,
        nowIso,
        nowIso,
      )

      const cached = this.tableCaches.get(nodeRow.table_id)
      if (cached) {
        this.applyCacheUpsert(cached, nodeRow.id, float32, norm, model)
        cached.revision = this.readTableRevision(nodeRow.table_id)
      }

      return {
        nodeId: nodeRow.id as NodeId,
        tableId: nodeRow.table_id as TableId,
        dimension: float32.length,
        model,
        vector: Array.from(float32),
        norm,
        createdAt: timestamps ? toIsoTimestamp(timestamps.created_at) : nowIso,
        updatedAt: timestamps ? toIsoTimestamp(timestamps.updated_at) : nowIso,
      }
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ValidationException) {
        throw error
      }
      throw new DatabaseException(`Failed to upsert node embedding: ${error}`)
    }
  }

  async upsertMany(inputs: readonly UpsertNodeEmbeddingInput[]): Promise<NodeEmbeddingRecord[]> {
    if (inputs.length === 0) return []

    const preparedInputs = inputs.map((input) => {
      const nodeId = String(input.nodeId ?? '').trim()
      if (!nodeId) {
        throw new ValidationException('Node ID is required')
      }
      validateEmbeddingVector(input.vector)
      const float32 = Float32Array.from(input.vector)
      const norm = computeFloat32Norm(float32)
      return {
        nodeId,
        expectedTableId: input.tableId !== undefined ? String(input.tableId).trim() : undefined,
        model: input.model?.trim() || 'default',
        float32,
        norm,
        blob: new Uint8Array(float32.buffer, float32.byteOffset, float32.byteLength),
      }
    })

    try {
      const selectNodeStmt = this.getSelectNodeTableStmt()
      const upsertStmt = this.getUpsertReturningStmt()
      const nowIso = new Date().toISOString()
      const touchedTableIds = new Set<string>()
      const pendingCacheUpdates: Array<{
        tableId: string
        nodeId: string
        float32: Float32Array
        norm: number
        model: string
      }> = []

      const records = this.db.transaction((): NodeEmbeddingRecord[] => {
        const out: NodeEmbeddingRecord[] = []
        for (const item of preparedInputs) {
          const nodeRow = selectNodeStmt.get(item.nodeId)
          if (!nodeRow) {
            throw new NotFoundException(`Node with id '${item.nodeId}' not found`)
          }
          if (item.expectedTableId !== undefined && item.expectedTableId !== nodeRow.table_id) {
            throw new ValidationException(
              `Node '${item.nodeId}' belongs to table '${nodeRow.table_id}', not '${item.expectedTableId}'`,
            )
          }
          const timestamps = upsertStmt.get(
            nodeRow.id,
            nodeRow.table_id,
            item.float32.length,
            item.model,
            item.blob,
            item.norm,
            nowIso,
            nowIso,
          )
          touchedTableIds.add(nodeRow.table_id)
          pendingCacheUpdates.push({
            tableId: nodeRow.table_id,
            nodeId: nodeRow.id,
            float32: item.float32,
            norm: item.norm,
            model: item.model,
          })
          out.push({
            nodeId: nodeRow.id as NodeId,
            tableId: nodeRow.table_id as TableId,
            dimension: item.float32.length,
            model: item.model,
            vector: Array.from(item.float32),
            norm: item.norm,
            createdAt: timestamps ? toIsoTimestamp(timestamps.created_at) : nowIso,
            updatedAt: timestamps ? toIsoTimestamp(timestamps.updated_at) : nowIso,
          })
        }
        return out
      })()

      for (const update of pendingCacheUpdates) {
        const cached = this.tableCaches.get(update.tableId)
        if (cached) {
          this.applyCacheUpsert(cached, update.nodeId, update.float32, update.norm, update.model)
        }
      }
      for (const tableId of touchedTableIds) {
        const cached = this.tableCaches.get(tableId)
        if (cached) {
          cached.revision = this.readTableRevision(tableId)
        }
      }

      return records
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ValidationException) {
        throw error
      }
      throw new DatabaseException(`Failed to batch upsert node embeddings: ${error}`)
    }
  }

  async findByNodeId(nodeId: NodeId): Promise<NodeEmbeddingRecord | null> {
    const trimmed = String(nodeId ?? '').trim()
    if (!trimmed) return null

    try {
      const row = this.getFindByNodeIdStmt().get(trimmed)
      if (!row) return null
      const float32 = decodeFloat32Blob(row.vector_blob, row.dimension)
      return {
        nodeId: row.node_id as NodeId,
        tableId: row.table_id as TableId,
        dimension: row.dimension,
        model: row.model,
        vector: Array.from(float32),
        norm: row.norm,
        createdAt: toIsoTimestamp(row.created_at),
        updatedAt: toIsoTimestamp(row.updated_at),
      }
    } catch (error) {
      throw new DatabaseException(`Failed to find node embedding: ${error}`)
    }
  }

  async findByTableId(
    tableId: TableId,
    options: { limit?: number; offset?: number } = {},
  ): Promise<NodeEmbeddingRecord[]> {
    const trimmed = String(tableId ?? '').trim()
    if (!trimmed) return []

    const limit = Math.max(1, Math.trunc(options.limit ?? 500))
    const offset = Math.max(0, Math.trunc(options.offset ?? 0))

    try {
      const rows = this.db
        .query<NodeEmbeddingRow, [string, number, number]>(
          `
            SELECT
              CAST(node_id AS TEXT) AS node_id,
              CAST(table_id AS TEXT) AS table_id,
              dimension,
              model,
              vector_blob,
              norm,
              created_at,
              updated_at
            FROM node_embeddings
            WHERE table_id = ?
            ORDER BY node_id ASC
            LIMIT ? OFFSET ?
          `,
        )
        .all(trimmed, limit, offset)

      return rows.map((row) => {
        const float32 = decodeFloat32Blob(row.vector_blob, row.dimension)
        return {
          nodeId: row.node_id as NodeId,
          tableId: row.table_id as TableId,
          dimension: row.dimension,
          model: row.model,
          vector: Array.from(float32),
          norm: row.norm,
          createdAt: toIsoTimestamp(row.created_at),
          updatedAt: toIsoTimestamp(row.updated_at),
        }
      })
    } catch (error) {
      throw new DatabaseException(`Failed to find table node embeddings: ${error}`)
    }
  }

  async deleteByNodeId(nodeId: NodeId): Promise<boolean> {
    const trimmed = String(nodeId ?? '').trim()
    if (!trimmed) return false

    try {
      const existing = this.getSelectOwnerStmt().get(trimmed)
      if (!existing) return false

      const result = this.getDeleteByNodeIdStmt().run(trimmed)

      const cached = this.tableCaches.get(existing.table_id)
      if (cached) {
        this.applyCacheDelete(cached, existing.node_id)
        cached.revision = this.readTableRevision(existing.table_id)
      }

      return result.changes > 0
    } catch (error) {
      throw new DatabaseException(`Failed to delete node embedding: ${error}`)
    }
  }

  async countByTableId(tableId: TableId): Promise<number> {
    const trimmed = String(tableId ?? '').trim()
    if (!trimmed) return 0

    try {
      const row = this.getCountByTableIdStmt().get(trimmed)
      return row?.count ?? 0
    } catch (error) {
      throw new DatabaseException(`Failed to count table embeddings: ${error}`)
    }
  }

  async searchSimilar(options: VectorSimilaritySearchOptions): Promise<VectorSimilaritySearchResult> {
    const tableId = String(options.tableId ?? '').trim()
    if (!tableId) {
      throw new ValidationException('Table ID is required')
    }
    validateEmbeddingVector(options.queryVector)
    if (!Number.isSafeInteger(options.limit) || options.limit <= 0) {
      throw new ValidationException('Limit must be a positive integer')
    }
    const minScore = options.minScore ?? -1
    if (!Number.isFinite(minScore) || minScore < -1 || minScore > 1) {
      throw new ValidationException('minScore must be between -1 and 1')
    }
    const modelFilter = options.model?.trim() || undefined

    const startedAt = performance.now()
    const queryFloat32 = Float32Array.from(options.queryVector)
    const queryDim = queryFloat32.length
    const queryNorm = computeFloat32Norm(queryFloat32)
    const hasQuerySignal = queryNorm > 0
    if (hasQuerySignal) {
      const invNorm = 1 / queryNorm
      for (let i = 0; i < queryDim; i += 1) {
        queryFloat32[i] = (queryFloat32[i] as number) * invNorm
      }
    }

    if (options.restrictToNodeIds && options.restrictToNodeIds.size === 0) {
      return {
        hits: [],
        metrics: {
          dimension: queryDim,
          tableVectors: 0,
          scanned: 0,
          dimensionMismatches: 0,
          queryMs: performance.now() - startedAt,
        },
      }
    }

    const cache = this.ensureTableCache(tableId)
    if (cache.totalVectors === 0) {
      return {
        hits: [],
        metrics: {
          dimension: queryDim,
          tableVectors: 0,
          scanned: 0,
          dimensionMismatches: 0,
          queryMs: performance.now() - startedAt,
        },
      }
    }

    const collector = new BoundedTopKCollector<string>(options.limit)
    let scanned = 0
    let dimensionMismatches = 0

    const restrictSet = options.restrictToNodeIds
    if (restrictSet && restrictSet.size < cache.totalVectors) {
      for (const candidateId of restrictSet) {
        const location = cache.locations.get(candidateId)
        if (!location) continue
        const bucket = cache.buckets.get(location.bucketKey)
        if (!bucket) continue
        if (modelFilter && bucket.model !== modelFilter) continue
        if (bucket.dimension !== queryDim) {
          dimensionMismatches += 1
          continue
        }
        scanned += 1
        const targetSignal = bucket.hasSignal[location.slot] as number
        const rawScore =
          !hasQuerySignal || targetSignal === 0
            ? 0
            : dotProductFloat32Slab(
                queryFloat32,
                bucket.slab,
                location.slot * queryDim,
                queryDim,
              )
        const score = Math.min(1, Math.max(-1, rawScore))
        if (score >= minScore) {
          collector.offer(candidateId, score, bucket.model)
        }
      }
    } else {
      for (const bucket of cache.buckets.values()) {
        if (bucket.count === 0) continue
        if (modelFilter && bucket.model !== modelFilter) continue
        if (bucket.dimension !== queryDim) {
          if (restrictSet) {
            const ids = bucket.nodeIds
            for (let slot = 0; slot < bucket.count; slot += 1) {
              if (restrictSet.has(ids[slot] as string)) {
                dimensionMismatches += 1
              }
            }
          } else {
            dimensionMismatches += bucket.count
          }
          continue
        }

        const slab = bucket.slab
        const hasSignal = bucket.hasSignal
        const ids = bucket.nodeIds
        const model = bucket.model
        const count = bucket.count

        if (restrictSet) {
          for (let slot = 0; slot < count; slot += 1) {
            const nodeId = ids[slot] as string
            if (!restrictSet.has(nodeId)) continue
            scanned += 1
            const rawScore =
              !hasQuerySignal || (hasSignal[slot] as number) === 0
                ? 0
                : dotProductFloat32Slab(queryFloat32, slab, slot * queryDim, queryDim)
            const score = Math.min(1, Math.max(-1, rawScore))
            if (score >= minScore) {
              collector.offer(nodeId, score, model)
            }
          }
        } else if (!hasQuerySignal) {
          scanned += count
          if (0 >= minScore) {
            for (let slot = 0; slot < count; slot += 1) {
              collector.offer(ids[slot] as string, 0, model)
            }
          }
        } else {
          scanned += count
          for (let slot = 0; slot < count; slot += 1) {
            const rawScore =
              (hasSignal[slot] as number) === 0
                ? 0
                : dotProductFloat32Slab(queryFloat32, slab, slot * queryDim, queryDim)
            const score = Math.min(1, Math.max(-1, rawScore))
            if (score >= minScore) {
              collector.offer(ids[slot] as string, score, model)
            }
          }
        }
      }
    }

    const hits: VectorSimilarityHit[] = collector.toSortedArray().map((hit, index) => ({
      nodeId: hit.id as NodeId,
      score: hit.score,
      rank: index + 1,
      model: hit.meta,
    }))

    return {
      hits,
      metrics: {
        dimension: queryDim,
        tableVectors: cache.totalVectors,
        scanned,
        dimensionMismatches,
        queryMs: performance.now() - startedAt,
      },
    }
  }

  invalidateCache(tableId?: TableId): void {
    if (tableId === undefined) {
      this.tableCaches.clear()
      this.totalCacheBytes = 0
      return
    }
    const key = String(tableId).trim()
    const existing = this.tableCaches.get(key)
    if (existing) {
      this.totalCacheBytes = Math.max(0, this.totalCacheBytes - existing.byteSize)
      this.tableCaches.delete(key)
    }
  }

  private ensureTableCache(tableId: string): TableEmbeddingCache {
    const currentRevision = this.readTableRevision(tableId)
    const existing = this.tableCaches.get(tableId)
    if (existing && existing.revision === currentRevision) {
      this.tableCaches.delete(tableId)
      this.tableCaches.set(tableId, existing)
      return existing
    }
    if (existing) {
      this.totalCacheBytes = Math.max(0, this.totalCacheBytes - existing.byteSize)
      this.tableCaches.delete(tableId)
    }

    const rows = this.getLoadTableEmbeddingsStmt().all(tableId)

    // Pre-count per-(dimension, model) bucket sizes so each Float32Array slab
    // is allocated once at exact capacity without intermediate resizing.
    const bucketCounts = new Map<string, number>()
    for (const row of rows) {
      const key = makeBucketKey(row.dimension, row.model)
      bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1)
    }

    const buckets = new Map<string, Float32ModelSlabBucket>()
    const locations = new Map<string, EmbeddingLocation>()
    for (const row of rows) {
      const key = makeBucketKey(row.dimension, row.model)
      let bucket = buckets.get(key)
      if (!bucket) {
        bucket = new Float32ModelSlabBucket(
          row.dimension,
          row.model,
          bucketCounts.get(key) ?? 32,
        )
        buckets.set(key, bucket)
      }
      const vecView = viewFloat32Blob(row.vector_blob, row.dimension)
      const slot = bucket.append(row.node_id, vecView, row.norm)
      locations.set(row.node_id, { bucketKey: key, slot })
    }

    const loaded: TableEmbeddingCache = {
      revision: currentRevision,
      totalVectors: locations.size,
      byteSize: calculateCacheByteSize(buckets),
      buckets,
      locations,
    }
    this.tableCaches.set(tableId, loaded)
    this.totalCacheBytes += loaded.byteSize
    this.evictCachesIfNeeded(tableId)
    return loaded
  }

  private evictCachesIfNeeded(protectedTableId?: string): void {
    while (
      this.tableCaches.size > 1 &&
      (this.tableCaches.size > this.maxCachedTables || this.totalCacheBytes > this.maxCacheBytes)
    ) {
      let evictedKey: string | undefined
      for (const candidateKey of this.tableCaches.keys()) {
        if (candidateKey !== protectedTableId) {
          evictedKey = candidateKey
          break
        }
      }
      if (!evictedKey) break
      const evicted = this.tableCaches.get(evictedKey)
      if (evicted) {
        this.totalCacheBytes = Math.max(0, this.totalCacheBytes - evicted.byteSize)
      }
      this.tableCaches.delete(evictedKey)
    }
  }

  private applyCacheUpsert(
    cache: TableEmbeddingCache,
    nodeId: string,
    vector: Float32Array,
    norm: number,
    model: string,
  ): void {
    const previousBytes = cache.byteSize
    const nextBucketKey = makeBucketKey(vector.length, model)
    const existingLocation = cache.locations.get(nodeId)

    if (existingLocation) {
      if (existingLocation.bucketKey === nextBucketKey) {
        const sameBucket = cache.buckets.get(nextBucketKey)
        if (sameBucket) {
          sameBucket.overwrite(existingLocation.slot, vector, norm)
          cache.byteSize = calculateCacheByteSize(cache.buckets)
          this.totalCacheBytes = Math.max(0, this.totalCacheBytes - previousBytes + cache.byteSize)
          this.evictCachesIfNeeded()
          return
        }
      }
      this.applyCacheDelete(cache, nodeId)
    }

    const refreshedPrevBytes = cache.byteSize
    let targetBucket = cache.buckets.get(nextBucketKey)
    if (!targetBucket) {
      targetBucket = new Float32ModelSlabBucket(vector.length, model)
      cache.buckets.set(nextBucketKey, targetBucket)
    }
    const slot = targetBucket.append(nodeId, vector, norm)
    cache.locations.set(nodeId, { bucketKey: nextBucketKey, slot })
    cache.totalVectors = cache.locations.size
    cache.byteSize = calculateCacheByteSize(cache.buckets)
    this.totalCacheBytes = Math.max(0, this.totalCacheBytes - refreshedPrevBytes + cache.byteSize)
    this.evictCachesIfNeeded()
  }

  private applyCacheDelete(cache: TableEmbeddingCache, nodeId: string): void {
    const existingLocation = cache.locations.get(nodeId)
    if (!existingLocation) return
    const previousBytes = cache.byteSize

    const bucket = cache.buckets.get(existingLocation.bucketKey)
    if (bucket) {
      const movedNodeId = bucket.swapRemove(existingLocation.slot)
      if (movedNodeId !== null) {
        cache.locations.set(movedNodeId, {
          bucketKey: existingLocation.bucketKey,
          slot: existingLocation.slot,
        })
      }
      if (bucket.count === 0) {
        cache.buckets.delete(existingLocation.bucketKey)
      }
    }
    cache.locations.delete(nodeId)
    cache.totalVectors = cache.locations.size
    cache.byteSize = calculateCacheByteSize(cache.buckets)
    this.totalCacheBytes = Math.max(0, this.totalCacheBytes - previousBytes + cache.byteSize)
  }

  private readTableRevision(tableId: string): number {
    if (!this.hasRevisionTableVerified) {
      const hasRevisionTable = this.db
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'node_embedding_revisions'",
        )
        .get()
      if (!hasRevisionTable) {
        return -1
      }
      this.hasRevisionTableVerified = true
    }

    const row = this.getReadRevisionStmt().get(tableId)
    return row?.revision ?? 0
  }

  private getSelectNodeTableStmt(): Statement<{ id: string; table_id: string }, [string]> {
    this.selectNodeTableStmt ??= this.db.query<{ id: string; table_id: string }, [string]>(
      'SELECT CAST(id AS TEXT) AS id, CAST(table_id AS TEXT) AS table_id FROM nodes WHERE id = ?',
    )
    return this.selectNodeTableStmt
  }

  private getUpsertReturningStmt(): Statement<
    PersistedTimestampRow,
    [string, string, number, string, Uint8Array, number, string, string]
  > {
    this.upsertReturningStmt ??= this.db.query<
      PersistedTimestampRow,
      [string, string, number, string, Uint8Array, number, string, string]
    >(
      `INSERT INTO node_embeddings (node_id, table_id, dimension, model, vector_blob, norm, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(node_id) DO UPDATE SET
         table_id = excluded.table_id,
         dimension = excluded.dimension,
         model = excluded.model,
         vector_blob = excluded.vector_blob,
         norm = excluded.norm,
         updated_at = excluded.updated_at
       RETURNING created_at, updated_at`,
    )
    return this.upsertReturningStmt
  }

  private getFindByNodeIdStmt(): Statement<NodeEmbeddingRow, [string]> {
    this.findByNodeIdStmt ??= this.db.query<NodeEmbeddingRow, [string]>(
      `SELECT CAST(node_id AS TEXT) AS node_id,
              CAST(table_id AS TEXT) AS table_id,
              dimension,
              model,
              vector_blob,
              norm,
              created_at,
              updated_at
       FROM node_embeddings
       WHERE node_id = ?`,
    )
    return this.findByNodeIdStmt
  }

  private getSelectOwnerStmt(): Statement<{ node_id: string; table_id: string }, [string]> {
    this.selectOwnerStmt ??= this.db.query<{ node_id: string; table_id: string }, [string]>(
      `SELECT CAST(node_id AS TEXT) AS node_id,
              CAST(table_id AS TEXT) AS table_id
       FROM node_embeddings
       WHERE node_id = ?`,
    )
    return this.selectOwnerStmt
  }

  private getDeleteByNodeIdStmt(): Statement<unknown, [string]> {
    this.deleteByNodeIdStmt ??= this.db.query<unknown, [string]>(
      'DELETE FROM node_embeddings WHERE node_id = ?',
    )
    return this.deleteByNodeIdStmt
  }

  private getCountByTableIdStmt(): Statement<{ count: number }, [string]> {
    this.countByTableIdStmt ??= this.db.query<{ count: number }, [string]>(
      'SELECT COUNT(*) AS count FROM node_embeddings WHERE table_id = ?',
    )
    return this.countByTableIdStmt
  }

  private getLoadTableEmbeddingsStmt(): Statement<
    {
      node_id: string
      dimension: number
      model: string
      vector_blob: Uint8Array
      norm: number
    },
    [string]
  > {
    this.loadTableEmbeddingsStmt ??= this.db.query<
      {
        node_id: string
        dimension: number
        model: string
        vector_blob: Uint8Array
        norm: number
      },
      [string]
    >(
      `SELECT CAST(ne.node_id AS TEXT) AS node_id,
              ne.dimension AS dimension,
              ne.model AS model,
              ne.vector_blob AS vector_blob,
              ne.norm AS norm
       FROM node_embeddings ne
       WHERE ne.table_id = ?`,
    )
    return this.loadTableEmbeddingsStmt
  }

  private getReadRevisionStmt(): Statement<{ revision: number }, [string]> {
    this.readRevisionStmt ??= this.db.query<{ revision: number }, [string]>(
      'SELECT revision FROM node_embedding_revisions WHERE table_id = ?',
    )
    return this.readRevisionStmt
  }
}

export function validateEmbeddingVector(vector: readonly number[]): void {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new ValidationException('Embedding vector must be a non-empty array of finite numbers')
  }
  if (vector.length > MAX_EMBEDDING_DIMENSION) {
    throw new ValidationException(
      `Embedding vector dimension (${vector.length}) exceeds maximum (${MAX_EMBEDDING_DIMENSION})`,
    )
  }
  for (let i = 0; i < vector.length; i += 1) {
    const value = vector[i]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ValidationException(`Embedding vector element at index ${i} must be a finite number`)
    }
  }
}

function makeBucketKey(dimension: number, model: string): string {
  return `${dimension}:${model}`
}

function calculateCacheByteSize(buckets: ReadonlyMap<string, Float32ModelSlabBucket>): number {
  let bytes = 0
  for (const bucket of buckets.values()) {
    bytes += bucket.byteLength
  }
  return bytes
}

/**
 * Zero-copy view when aligned (used during slab population where `slab.set`
 * copies floats directly into the contiguous slab without an extra ArrayBuffer slice).
 */
function viewFloat32Blob(blob: Uint8Array, expectedDimension: number): Float32Array {
  const expectedBytes = expectedDimension * Float32Array.BYTES_PER_ELEMENT
  if (blob.byteLength !== expectedBytes) {
    throw new DatabaseException(
      `Corrupted embedding blob: expected ${expectedBytes} bytes for dimension ${expectedDimension}, got ${blob.byteLength}`,
    )
  }
  if (blob.byteOffset % Float32Array.BYTES_PER_ELEMENT === 0) {
    return new Float32Array(blob.buffer, blob.byteOffset, expectedDimension)
  }
  const aligned = new Uint8Array(blob.byteLength)
  aligned.set(blob)
  return new Float32Array(aligned.buffer)
}

function decodeFloat32Blob(blob: Uint8Array, expectedDimension: number): Float32Array {
  const view = viewFloat32Blob(blob, expectedDimension)
  return new Float32Array(view)
}

function toIsoTimestamp(raw: string): string {
  const normalized = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

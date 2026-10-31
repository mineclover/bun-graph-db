export interface VectorSearchHit {
  id: string
  score: number
}

export interface VectorIndexMetrics {
  dimension: number
  size: number
  scanned: number
  queryMs: number
}

/**
 * Fixed-capacity min-heap collector that retains the top-K highest-scoring
 * candidates without allocating per-candidate hit objects during full scans.
 * Tie-breaking is deterministic: higher score wins; equal score prefers
 * lexicographically smaller ID (`left.id.localeCompare(right.id) < 0`).
 */
export class BoundedTopKCollector<TMeta = undefined> {
  private readonly capacity: number
  private readonly scores: Float64Array
  private readonly ids: string[]
  private readonly metas: TMeta[]
  private count = 0

  constructor(limit: number) {
    if (!Number.isSafeInteger(limit) || limit <= 0) {
      throw new Error('limit must be a positive integer')
    }
    this.capacity = limit
    this.scores = new Float64Array(limit)
    this.ids = new Array<string>(limit)
    this.metas = new Array<TMeta>(limit)
  }

  get size(): number {
    return this.count
  }

  offer(id: string, score: number, meta: TMeta): void {
    if (this.count < this.capacity) {
      const index = this.count
      this.count += 1
      this.scores[index] = score
      this.ids[index] = id
      this.metas[index] = meta
      this.siftUp(index)
      return
    }

    const worstScore = this.scores[0] as number
    if (score < worstScore) return
    const worstId = this.ids[0] as string
    if (score === worstScore && id.localeCompare(worstId) >= 0) return

    this.scores[0] = score
    this.ids[0] = id
    this.metas[0] = meta
    this.siftDown(0)
  }

  toSortedArray(): Array<{ id: string; score: number; meta: TMeta }> {
    const out = new Array<{ id: string; score: number; meta: TMeta }>(this.count)
    for (let i = 0; i < this.count; i += 1) {
      out[i] = {
        id: this.ids[i] as string,
        score: this.scores[i] as number,
        meta: this.metas[i] as TMeta,
      }
    }
    out.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    return out
  }

  private isWorse(leftIndex: number, rightIndex: number): boolean {
    const leftScore = this.scores[leftIndex] as number
    const rightScore = this.scores[rightIndex] as number
    if (leftScore !== rightScore) return leftScore < rightScore
    return (this.ids[leftIndex] as string).localeCompare(this.ids[rightIndex] as string) > 0
  }

  private swap(i: number, j: number): void {
    const tmpScore = this.scores[i] as number
    this.scores[i] = this.scores[j] as number
    this.scores[j] = tmpScore

    const tmpId = this.ids[i] as string
    this.ids[i] = this.ids[j] as string
    this.ids[j] = tmpId

    const tmpMeta = this.metas[i] as TMeta
    this.metas[i] = this.metas[j] as TMeta
    this.metas[j] = tmpMeta
  }

  private siftUp(startIndex: number): void {
    let index = startIndex
    while (index > 0) {
      const parent = (index - 1) >> 1
      if (!this.isWorse(index, parent)) break
      this.swap(index, parent)
      index = parent
    }
  }

  private siftDown(startIndex: number): void {
    let index = startIndex
    while (true) {
      const left = (index << 1) + 1
      if (left >= this.count) break
      const right = left + 1
      let worst = left
      if (right < this.count && this.isWorse(right, left)) {
        worst = right
      }
      if (!this.isWorse(worst, index)) break
      this.swap(index, worst)
      index = worst
    }
  }
}

export function computeFloat32Norm(vector: Float32Array): number {
  const len = vector.length
  const unrolledEnd = len - (len & 3)
  let s0 = 0
  let s1 = 0
  let s2 = 0
  let s3 = 0
  let i = 0
  for (; i < unrolledEnd; i += 4) {
    const v0 = vector[i] as number
    const v1 = vector[i + 1] as number
    const v2 = vector[i + 2] as number
    const v3 = vector[i + 3] as number
    s0 += v0 * v0
    s1 += v1 * v1
    s2 += v2 * v2
    s3 += v3 * v3
  }
  let sumSq = s0 + s1 + s2 + s3
  for (; i < len; i += 1) {
    const v = vector[i] as number
    sumSq += v * v
  }
  return Math.sqrt(sumSq)
}

export function dotProductFloat32Slab(
  query: Float32Array,
  slab: Float32Array,
  slabOffset: number,
  dimension: number,
): number {
  const unrolledEnd = dimension - (dimension & 3)
  let s0 = 0
  let s1 = 0
  let s2 = 0
  let s3 = 0
  let i = 0
  for (; i < unrolledEnd; i += 4) {
    const base = slabOffset + i
    s0 += (query[i] as number) * (slab[base] as number)
    s1 += (query[i + 1] as number) * (slab[base + 1] as number)
    s2 += (query[i + 2] as number) * (slab[base + 2] as number)
    s3 += (query[i + 3] as number) * (slab[base + 3] as number)
  }
  let dot = s0 + s1 + s2 + s3
  for (; i < dimension; i += 1) {
    dot += (query[i] as number) * (slab[slabOffset + i] as number)
  }
  return dot
}

function dotProductFloat64Slab(
  query: Float64Array,
  slab: Float64Array,
  slabOffset: number,
  dimension: number,
): number {
  const unrolledEnd = dimension - (dimension & 3)
  let s0 = 0
  let s1 = 0
  let s2 = 0
  let s3 = 0
  let i = 0
  for (; i < unrolledEnd; i += 4) {
    const base = slabOffset + i
    s0 += (query[i] as number) * (slab[base] as number)
    s1 += (query[i + 1] as number) * (slab[base + 1] as number)
    s2 += (query[i + 2] as number) * (slab[base + 2] as number)
    s3 += (query[i + 3] as number) * (slab[base + 3] as number)
  }
  let dot = s0 + s1 + s2 + s3
  for (; i < dimension; i += 1) {
    dot += (query[i] as number) * (slab[slabOffset + i] as number)
  }
  return dot
}

/**
 * Exact cosine-similarity index backed by a contiguous Float64Array slab,
 * precomputed inverse L2 norms, 4-way unrolled dot product, and bounded min-heap Top-K.
 */
export class ExactVectorIndex {
  private readonly slotById = new Map<string, number>()
  private ids: string[] = []
  private slab: Float64Array
  private invNorms: Float64Array
  private capacity: number
  private count = 0

  constructor(private readonly dimension: number, initialCapacity = 64) {
    if (!Number.isSafeInteger(dimension) || dimension <= 0) {
      throw new Error('dimension must be a positive integer')
    }
    this.capacity = Math.max(4, initialCapacity)
    this.slab = new Float64Array(this.capacity * dimension)
    this.invNorms = new Float64Array(this.capacity)
  }

  upsert(id: string, vector: readonly number[]): void {
    validateVector(vector, this.dimension)
    if (!id.trim()) throw new Error('vector id must not be empty')

    let slot = this.slotById.get(id)
    if (slot === undefined) {
      if (this.count >= this.capacity) {
        this.grow()
      }
      slot = this.count
      this.count += 1
      this.slotById.set(id, slot)
      this.ids[slot] = id
    }

    const offset = slot * this.dimension
    let sumSq = 0
    for (let i = 0; i < this.dimension; i += 1) {
      const v = vector[i] as number
      this.slab[offset + i] = v
      sumSq += v * v
    }
    this.invNorms[slot] = sumSq > 0 ? 1 / Math.sqrt(sumSq) : 0
  }

  delete(id: string): boolean {
    const slot = this.slotById.get(id)
    if (slot === undefined) return false

    const last = this.count - 1
    if (slot < last) {
      const movedId = this.ids[last] as string
      this.slab.copyWithin(slot * this.dimension, last * this.dimension, (last + 1) * this.dimension)
      this.invNorms[slot] = this.invNorms[last] as number
      this.ids[slot] = movedId
      this.slotById.set(movedId, slot)
    }

    this.ids.pop()
    this.slotById.delete(id)
    this.count -= 1
    return true
  }

  clear(): void {
    this.slotById.clear()
    this.ids.length = 0
    this.count = 0
  }

  get size(): number {
    return this.count
  }

  search(
    query: readonly number[],
    limit = 10,
    minScore = -1,
  ): { hits: VectorSearchHit[]; metrics: VectorIndexMetrics } {
    validateVector(query, this.dimension)
    if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error('limit must be a positive integer')
    if (!(minScore >= -1 && minScore <= 1)) throw new Error('minScore must be between -1 and 1')

    const startedAt = performance.now()
    const dim = this.dimension
    const queryVec = new Float64Array(dim)
    let querySumSq = 0
    for (let i = 0; i < dim; i += 1) {
      const v = query[i] as number
      queryVec[i] = v
      querySumSq += v * v
    }
    const queryInvNorm = querySumSq > 0 ? 1 / Math.sqrt(querySumSq) : 0
    const collector = new BoundedTopKCollector<undefined>(Math.min(limit, Math.max(1, this.count)))

    if (queryInvNorm === 0) {
      if (0 >= minScore) {
        for (let slot = 0; slot < this.count; slot += 1) {
          collector.offer(this.ids[slot] as string, 0, undefined)
        }
      }
    } else {
      const slab = this.slab
      const invNorms = this.invNorms
      const ids = this.ids
      for (let slot = 0; slot < this.count; slot += 1) {
        const targetInvNorm = invNorms[slot] as number
        const score =
          targetInvNorm === 0
            ? 0
            : dotProductFloat64Slab(queryVec, slab, slot * dim, dim) * queryInvNorm * targetInvNorm
        if (score >= minScore) {
          collector.offer(ids[slot] as string, score, undefined)
        }
      }
    }

    const result: VectorSearchHit[] = collector.toSortedArray().map(({ id, score }) => ({ id, score }))
    return {
      hits: result,
      metrics: {
        dimension: dim,
        size: this.count,
        scanned: this.count,
        queryMs: performance.now() - startedAt,
      },
    }
  }

  private grow(): void {
    const nextCapacity = this.capacity * 2
    const nextSlab = new Float64Array(nextCapacity * this.dimension)
    nextSlab.set(this.slab)
    const nextInvNorms = new Float64Array(nextCapacity)
    nextInvNorms.set(this.invNorms)
    this.slab = nextSlab
    this.invNorms = nextInvNorms
    this.capacity = nextCapacity
  }
}

export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  if (left.length !== right.length || left.length === 0) {
    throw new Error('vectors must have the same non-zero dimension')
  }
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] as number
    const rightValue = right[index] as number
    dot += leftValue * rightValue
    leftNorm += leftValue * leftValue
    rightNorm += rightValue * rightValue
  }
  if (leftNorm === 0 || rightNorm === 0) return 0
  return dot / Math.sqrt(leftNorm * rightNorm)
}

function validateVector(vector: readonly number[], dimension: number): void {
  if (vector.length !== dimension) {
    throw new Error(`vector must contain exactly ${dimension} finite numbers`)
  }
  for (let i = 0; i < dimension; i += 1) {
    if (!Number.isFinite(vector[i])) {
      throw new Error(`vector must contain exactly ${dimension} finite numbers`)
    }
  }
}

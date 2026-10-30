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
 * Exact cosine-similarity index used as a correctness/read-model baseline.
 * It deliberately scans every vector; production ANN/HNSW can implement the same contract later.
 */
export class ExactVectorIndex {
  private readonly vectors = new Map<string, readonly number[]>()

  constructor(private readonly dimension: number) {
    if (!Number.isSafeInteger(dimension) || dimension <= 0) throw new Error('dimension must be a positive integer')
  }

  upsert(id: string, vector: readonly number[]): void {
    validateVector(vector, this.dimension)
    if (!id.trim()) throw new Error('vector id must not be empty')
    this.vectors.set(id, [...vector])
  }

  delete(id: string): boolean {
    return this.vectors.delete(id)
  }

  clear(): void {
    this.vectors.clear()
  }

  get size(): number {
    return this.vectors.size
  }

  search(query: readonly number[], limit = 10, minScore = -1): { hits: VectorSearchHit[]; metrics: VectorIndexMetrics } {
    validateVector(query, this.dimension)
    if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error('limit must be a positive integer')
    if (!(minScore >= -1 && minScore <= 1)) throw new Error('minScore must be between -1 and 1')

    const startedAt = performance.now()
    const hits: VectorSearchHit[] = []
    for (const [id, vector] of this.vectors) {
      const score = cosineSimilarity(query, vector)
      if (score >= minScore) hits.push({ id, score })
    }
    hits.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    const result = hits.slice(0, limit)
    return {
      hits: result,
      metrics: {
        dimension: this.dimension,
        size: this.vectors.size,
        scanned: this.vectors.size,
        queryMs: performance.now() - startedAt,
      },
    }
  }
}

export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  if (left.length !== right.length || left.length === 0) throw new Error('vectors must have the same non-zero dimension')
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0
    const rightValue = right[index] ?? 0
    dot += leftValue * rightValue
    leftNorm += leftValue * leftValue
    rightNorm += rightValue * rightValue
  }
  if (leftNorm === 0 || rightNorm === 0) return 0
  return dot / Math.sqrt(leftNorm * rightNorm)
}

function validateVector(vector: readonly number[], dimension: number): void {
  if (vector.length !== dimension || vector.some((value) => !Number.isFinite(value))) {
    throw new Error(`vector must contain exactly ${dimension} finite numbers`)
  }
}

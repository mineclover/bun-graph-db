import { describe, expect, test } from 'vitest'
import { ExactVectorIndex, cosineSimilarity } from '@/domain/services/vector/ExactVectorIndex.js'

describe('ExactVectorIndex', () => {
  test('returns deterministic cosine-ranked hits and scan metrics', () => {
    const index = new ExactVectorIndex(2)
    index.upsert('z', [1, 0])
    index.upsert('a', [1, 0])
    index.upsert('orthogonal', [0, 1])

    const result = index.search([1, 0], 3)
    expect(result.hits.map((hit) => hit.id)).toEqual(['a', 'z', 'orthogonal'])
    expect(result.hits[0]?.score).toBeCloseTo(1, 12)
    expect(result.metrics).toMatchObject({ dimension: 2, size: 3, scanned: 3 })
  })

  test('supports upsert, deletion, score filtering and empty-vector behavior', () => {
    const index = new ExactVectorIndex(3)
    index.upsert('item', [1, 0, 0])
    index.upsert('item', [0, 1, 0])
    expect(index.size).toBe(1)
    expect(index.search([1, 0, 0], 10, 0.9).hits).toEqual([])
    expect(index.delete('item')).toBe(true)
    expect(index.delete('item')).toBe(false)
    expect(cosineSimilarity([0, 0, 0], [1, 0, 0])).toBe(0)
  })

  test('validates dimensions, finite values, IDs, limits and thresholds', () => {
    expect(() => new ExactVectorIndex(0)).toThrow()
    const index = new ExactVectorIndex(2)
    expect(() => index.upsert('', [1, 0])).toThrow()
    expect(() => index.upsert('bad', [1])).toThrow()
    expect(() => index.upsert('bad', [1, Number.NaN])).toThrow()
    index.upsert('ok', [1, 0])
    expect(() => index.search([1, 0], 0)).toThrow()
    expect(() => index.search([1, 0], 1, 2)).toThrow()
  })

  test('keeps exact search as a correctness baseline for a small nearest-neighbor fixture', () => {
    const index = new ExactVectorIndex(3)
    const fixture = [
      ['doc-a', [1, 0, 0]],
      ['doc-b', [0.9, 0.1, 0]],
      ['doc-c', [0, 1, 0]],
      ['doc-d', [0, 0, 1]],
    ] as const
    for (const [id, vector] of fixture) index.upsert(id, vector)
    const result = index.search([1, 0.05, 0], 2)
    expect(result.hits.map((hit) => hit.id)).toEqual(['doc-a', 'doc-b'])
    expect(result.metrics.scanned).toBe(fixture.length)
  })
})

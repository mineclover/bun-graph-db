import { describe, expect, test } from 'bun:test'
import { pageRank } from '@/domain/services/graph/PageRank.js'

describe('pageRank', () => {
  test('assigns equal rank to a directed cycle and converges deterministically', () => {
    const result = pageRank(['a', 'b', 'c'], new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', ['a']],
    ]), { tolerance: 1e-12 })
    expect(result.converged).toBe(true)
    expect(result.iterations).toBeLessThan(100)
    expect([...result.scores.values()]).toEqual([1 / 3, 1 / 3, 1 / 3])
  })

  test('redistributes dangling rank and keeps total score normalized', () => {
    const result = pageRank(['a', 'b', 'c'], new Map([
      ['a', ['b', 'c']],
      ['b', []],
      ['c', []],
    ]), { tolerance: 1e-12 })
    const total = [...result.scores.values()].reduce((sum, score) => sum + score, 0)
    expect(result.converged).toBe(true)
    expect(total).toBeCloseTo(1, 12)
    expect(result.scores.get('b')).toBeGreaterThan(result.scores.get('a') ?? 0)
    expect(result.scores.get('c')).toBeGreaterThan(result.scores.get('a') ?? 0)
  })

  test('ignores unknown and duplicate edges without changing scores', () => {
    const clean = pageRank(['a', 'b'], new Map([['a', ['b']], ['b', ['a']]]), { tolerance: 1e-12 })
    const noisy = pageRank(['a', 'b'], new Map([['a', ['b', 'b', 'missing']], ['b', ['a']]]), { tolerance: 1e-12 })
    expect([...noisy.scores.entries()]).toEqual([...clean.scores.entries()])
  })

  test('returns a bounded non-converged result when the iteration budget is exhausted', () => {
    const result = pageRank(['a', 'b', 'c'], new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', []],
    ]), { maxIterations: 1, tolerance: 1e-15 })
    expect(result.iterations).toBe(1)
    expect(result.converged).toBe(false)
    expect(result.finalDelta).toBeGreaterThan(1e-15)
  })

  test('validates numeric convergence options and handles empty graphs', () => {
    expect(pageRank([], new Map())).toEqual({ scores: new Map(), iterations: 0, converged: true, finalDelta: 0 })
    expect(() => pageRank(['a'], new Map(), { dampingFactor: 1 })).toThrow()
    expect(() => pageRank(['a'], new Map(), { tolerance: 0 })).toThrow()
    expect(() => pageRank(['a'], new Map(), { maxIterations: 0 })).toThrow()
  })
})

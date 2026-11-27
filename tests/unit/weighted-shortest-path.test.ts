import { describe, expect, test } from 'vitest'
import {
  createRelationCostFn,
  dijkstraShortestPath,
  kShortestWeightedPaths,
  type RelationEdgeQuality,
  type WeightedEdge,
} from '../../src/domain/services/graph/WeightedShortestPath.js'

function buildAdjacency(
  edges: Array<{ from: string; to: string; strength: number; confidence: number; type?: string }>,
): Map<string, WeightedEdge<RelationEdgeQuality>[]> {
  const map = new Map<string, WeightedEdge<RelationEdgeQuality>[]>()
  for (const edge of edges) {
    const list = map.get(edge.from) ?? []
    list.push({
      targetId: edge.to,
      edge: {
        strength: edge.strength,
        confidence: edge.confidence,
        relationIdentifier: edge.type,
      },
    })
    map.set(edge.from, list)
  }
  return map
}

describe('WeightedShortestPath Dijkstra & Yen k-shortest', () => {
  test('prefers high-strength/high-confidence 3-hop path over weak 2-hop path under WEIGHTED_SHORTEST', () => {
    const adj = buildAdjacency([
      { from: 'D0', to: 'D1', strength: 0, confidence: 0, type: 'depends_on' },
      { from: 'D1', to: 'D3', strength: 0, confidence: 0, type: 'depends_on' },
      { from: 'D0', to: 'D2', strength: 4, confidence: 4, type: 'depends_on' },
      { from: 'D2', to: 'D4', strength: 4, confidence: 4, type: 'depends_on' },
      { from: 'D4', to: 'D3', strength: 4, confidence: 4, type: 'depends_on' },
    ])

    const weightedCost = createRelationCostFn('WEIGHTED_SHORTEST', 'STRENGTH_CONFIDENCE')
    const optimal = dijkstraShortestPath('D0', 'D3', adj, weightedCost)
    expect(optimal).not.toBeNull()
    expect(optimal?.nodeIds).toEqual(['D0', 'D2', 'D4', 'D3'])
    expect(optimal?.totalCost).toBeCloseTo(3, 6)

    const hopOnly = dijkstraShortestPath('D0', 'D3', adj, createRelationCostFn('SHORTEST'))
    expect(hopOnly?.nodeIds).toEqual(['D0', 'D1', 'D3'])
    expect(hopOnly?.distance).toBe(2)
  })

  test('produces deterministic k-shortest alternative paths via Yen algorithm', () => {
    const adj = buildAdjacency([
      { from: 'A', to: 'B', strength: 4, confidence: 4, type: 'primary' },
      { from: 'B', to: 'Z', strength: 4, confidence: 4, type: 'primary' },
      { from: 'A', to: 'C', strength: 2, confidence: 3, type: 'secondary' },
      { from: 'C', to: 'Z', strength: 2, confidence: 3, type: 'secondary' },
      { from: 'A', to: 'D', strength: 1, confidence: 1, type: 'fallback' },
      { from: 'D', to: 'Z', strength: 1, confidence: 1, type: 'fallback' },
    ])

    const paths = kShortestWeightedPaths(
      'A',
      'Z',
      adj,
      createRelationCostFn('BALANCED_QUALITY', 'STRENGTH_CONFIDENCE', new Set(['primary'])),
      3,
    )

    expect(paths.map((entry) => entry.nodeIds)).toEqual([
      ['A', 'B', 'Z'],
      ['A', 'C', 'Z'],
      ['A', 'D', 'Z'],
    ])
    expect(paths[0]?.totalCost).toBeLessThan(paths[1]?.totalCost ?? Number.POSITIVE_INFINITY)
    expect(paths[1]?.totalCost).toBeLessThan(paths[2]?.totalCost ?? Number.POSITIVE_INFINITY)
  })

  test('respects avoidNodes, maxDepth, self-loop zero-hop, and cycle termination', () => {
    const adj = buildAdjacency([
      { from: 'S', to: 'A', strength: 4, confidence: 4 },
      { from: 'A', to: 'S', strength: 4, confidence: 4 },
      { from: 'A', to: 'T', strength: 4, confidence: 4 },
      { from: 'S', to: 'B', strength: 1, confidence: 1 },
      { from: 'B', to: 'C', strength: 1, confidence: 1 },
      { from: 'C', to: 'T', strength: 1, confidence: 1 },
    ])
    const cost = createRelationCostFn('HIGHEST_CONFIDENCE', 'CONFIDENCE_ONLY')

    expect(dijkstraShortestPath('S', 'S', adj, cost)).toEqual({
      nodeIds: ['S'],
      edges: [],
      totalCost: 0,
      distance: 0,
    })

    const avoided = dijkstraShortestPath('S', 'T', adj, cost, { avoidNodes: new Set(['A']), maxDepth: 4 })
    expect(avoided?.nodeIds).toEqual(['S', 'B', 'C', 'T'])

    const blockedByDepth = dijkstraShortestPath('S', 'T', adj, cost, {
      avoidNodes: new Set(['A']),
      maxDepth: 2,
    })
    expect(blockedByDepth).toBeNull()
  })

  test('rejects non-positive or non-finite edge costs cleanly', () => {
    const adj = buildAdjacency([{ from: 'A', to: 'B', strength: 4, confidence: 4 }])
    expect(() => dijkstraShortestPath('A', 'B', adj, () => 0)).toThrow(
      'Edge cost must be a finite positive number',
    )
    expect(() => dijkstraShortestPath('A', 'B', adj, () => Number.NaN)).toThrow(
      'Edge cost must be a finite positive number',
    )
  })
})

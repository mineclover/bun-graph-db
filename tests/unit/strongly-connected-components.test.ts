import { describe, expect, test } from 'vitest'
import { stronglyConnectedComponents } from '@/domain/services/graph/StronglyConnectedComponents.js'

describe('stronglyConnectedComponents', () => {
  test('decomposes cycles, bridges and isolated nodes deterministically', () => {
    const result = stronglyConnectedComponents(
      ['a', 'b', 'c', 'd', 'e', 'isolated'],
      new Map([
        ['a', ['b']],
        ['b', ['a', 'c']],
        ['c', ['d']],
        ['d', ['c', 'e']],
        ['e', []],
      ]),
    )
    expect(result).toEqual([
      { id: 0, nodeIds: ['a', 'b'] },
      { id: 1, nodeIds: ['c', 'd'] },
      { id: 2, nodeIds: ['e'] },
      { id: 3, nodeIds: ['isolated'] },
    ])
  })

  test('ignores unknown and duplicate edges and keeps self loops as one component', () => {
    expect(stronglyConnectedComponents(
      ['root', 'leaf'],
      new Map([
        ['root', ['root', 'leaf', 'leaf', 'missing']],
        ['leaf', ['missing']],
      ]),
    )).toEqual([
      { id: 0, nodeIds: ['root'] },
      { id: 1, nodeIds: ['leaf'] },
    ])
  })

  test('deduplicates input IDs and supports an empty graph', () => {
    expect(stronglyConnectedComponents([], new Map())).toEqual([])
    expect(stronglyConnectedComponents(['a', 'a', 'b'], new Map([['a', ['b']], ['b', ['a']]]))).toEqual([
      { id: 0, nodeIds: ['a', 'b'] },
    ])
  })

  test('matches a reachability oracle for every directed three-node graph', () => {
    const nodeIds = ['a', 'b', 'c']
    const edges = nodeIds.flatMap((source) => nodeIds.filter((target) => source !== target).map((target) => [source, target] as const))
    for (let mask = 0; mask < 2 ** edges.length; mask += 1) {
      const adjacency = new Map(nodeIds.map((nodeId) => [nodeId, [] as string[]]))
      edges.forEach(([source, target], bit) => {
        if ((mask & (1 << bit)) !== 0) adjacency.get(source)?.push(target)
      })
      const components = stronglyConnectedComponents(nodeIds, adjacency)
      expect(new Set(components.flatMap((component) => component.nodeIds)).size).toBe(nodeIds.length)
      for (const left of nodeIds) {
        for (const right of nodeIds) {
          const sameComponent = components.find((component) => component.nodeIds.includes(left)) ===
            components.find((component) => component.nodeIds.includes(right))
          expect(sameComponent).toBe(reachable(adjacency, left, right) && reachable(adjacency, right, left))
        }
      }
    }
  })

  test('handles a 10,000-node chain without recursive stack growth', () => {
    const nodeIds = Array.from({ length: 10_000 }, (_, index) => String(index))
    const adjacency = new Map(nodeIds.map((nodeId, index) => [nodeId, index === 9_999 ? [] : [String(index + 1)]]))
    const result = stronglyConnectedComponents(nodeIds, adjacency)
    expect(result).toHaveLength(10_000)
    expect(result[0]).toEqual({ id: 0, nodeIds: ['0'] })
    expect(result.at(-1)).toEqual({ id: 9_999, nodeIds: ['9999'] })
  })
})

function reachable(adjacency: ReadonlyMap<string, readonly string[]>, source: string, target: string): boolean {
  const visited = new Set<string>([source])
  const stack = [source]
  while (stack.length > 0) {
    const nodeId = stack.pop()
    if (nodeId === target) return true
    for (const neighbor of adjacency.get(nodeId ?? '') ?? []) {
      if (visited.has(neighbor)) continue
      visited.add(neighbor)
      stack.push(neighbor)
    }
  }
  return false
}

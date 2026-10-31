import { describe, expect, test } from 'bun:test'
import {
  BidirectionalBreadthFirstSearch,
  BreadthFirstSearch,
  type GraphNeighbor,
} from '@/domain/services/graph/BreadthFirstSearch.js'

describe('BreadthFirstSearch', () => {
  test('restores ordered nodes and edges through first-discovered parents', () => {
    const search = new BreadthFirstSearch<string>('root')
    search.advance(adjacency({ root: ['a', 'b'] }))
    search.advance(adjacency({ a: ['target'], b: ['target'] }))

    expect(search.frontier).toEqual(['target'])
    expect(search.depth).toBe(2)
    expect(search.pathTo('target')).toEqual({
      nodeIds: ['root', 'a', 'target'],
      edges: ['root:a', 'a:target'],
      distance: 2,
    })
    expect(search.pathTo('unreachable')).toBeNull()
  })

  test('does not re-enqueue cycles, self loops, parallel edges or convergent vertices', () => {
    const search = new BreadthFirstSearch<string>('root')
    search.advance(adjacency({ root: ['root', 'a', 'a', 'b'] }))
    expect(search.frontier).toEqual(['a', 'b'])
    search.advance(adjacency({ a: ['root', 'b', 'target'], b: ['a', 'target'] }))
    expect(search.frontier).toEqual(['target'])
    search.advance(adjacency({ target: ['root', 'a', 'target'] }))
    expect(search.frontier).toEqual([])
    expect(search.pathTo('b')?.distance).toBe(1)
  })

  test('returns a zero-hop source path and independent materialized paths', () => {
    const search = new BreadthFirstSearch<string>('root')
    expect(search.pathTo('root')).toEqual({ nodeIds: ['root'], edges: [], distance: 0 })
    search.advance(adjacency({ root: ['target'] }))
    const first = search.pathTo('target')
    first?.nodeIds.reverse()
    first?.edges.push('extra')
    expect(search.pathTo('target')).toEqual({ nodeIds: ['root', 'target'], edges: ['root:target'], distance: 1 })
  })

  test('only scans frontier entries and treats omitted entries as terminal nodes', () => {
    const search = new BreadthFirstSearch<string>('root')
    search.advance(adjacency({ root: ['a'], disconnected: ['target'] }))
    search.advance(adjacency({ disconnected: ['target'] }))
    expect(search.frontier).toEqual([])
    expect(search.pathTo('target')).toBeNull()
  })

  test('restores a long path iteratively without recursive stack growth', () => {
    const search = new BreadthFirstSearch<string>('0')
    for (let index = 0; index < 10_000; index += 1) {
      search.advance(adjacency({ [String(index)]: [String(index + 1)] }))
    }
    const path = search.pathTo('10000')
    expect(path?.distance).toBe(10_000)
    expect(path?.nodeIds).toHaveLength(10_001)
    expect(path?.edges[0]).toBe('0:1')
    expect(path?.edges.at(-1)).toBe('9999:10000')
  })

  test('matches an independent all-pairs distance oracle for every directed three-node graph', () => {
    const ids = ['a', 'b', 'c']
    const possibleEdges = ids.flatMap((from) => ids.filter((to) => to !== from).map((to) => [from, to] as const))
    for (let mask = 0; mask < 2 ** possibleEdges.length; mask += 1) {
      const neighbors: Record<string, string[]> = { a: [], b: [], c: [] }
      const distances = ids.map((from) => ids.map((to) => from === to ? 0 : Infinity))
      possibleEdges.forEach(([from, to], bit) => {
        if ((mask & (1 << bit)) === 0) return
        neighbors[from]?.push(to)
        const row = distances[ids.indexOf(from)]
        if (row !== undefined) row[ids.indexOf(to)] = 1
      })
      for (let via = 0; via < ids.length; via += 1) {
        for (let from = 0; from < ids.length; from += 1) {
          for (let to = 0; to < ids.length; to += 1) {
            const row = distances[from]
            if (row !== undefined) {
              row[to] = Math.min(row[to] ?? Infinity, (row[via] ?? Infinity) + (distances[via]?.[to] ?? Infinity))
            }
          }
        }
      }

      const graph = adjacency(neighbors)
      const reverseNeighbors: Record<string, string[]> = { a: [], b: [], c: [] }
      for (const [from, targets] of Object.entries(neighbors)) {
        for (const to of targets) {
          reverseNeighbors[to]?.push(from)
        }
      }
      const reverseGraph = new Map(
        Object.entries(reverseNeighbors).map(([to, sources]) => [
          to,
          sources.map((from) => ({ nodeId: from, edge: `${from}:${to}` })),
        ]),
      )

      for (const source of ids) {
        const search = new BreadthFirstSearch<string>(source)
        while (search.frontier.length > 0) search.advance(graph)
        for (const target of ids) {
          const expectedDistance = distances[ids.indexOf(source)]?.[ids.indexOf(target)] ?? Infinity
          const path = search.pathTo(target)
          expect(path?.distance ?? Infinity).toBe(expectedDistance)

          const biSearch = new BidirectionalBreadthFirstSearch<string>(source, target)
          while (!biSearch.hasMeeting) {
            const side = biSearch.nextSide()
            if (side === null) break
            if (side === 'forward') biSearch.advanceForward(graph)
            else biSearch.advanceBackward(reverseGraph)
          }
          const biPath = biSearch.shortestPath()
          expect(biPath?.distance ?? Infinity).toBe(expectedDistance)

          for (const candidatePath of [path, biPath]) {
            if (candidatePath === null) continue
            expect(new Set(candidatePath.nodeIds).size).toBe(candidatePath.nodeIds.length)
            expect(candidatePath.nodeIds[0]).toBe(source)
            expect(candidatePath.nodeIds.at(-1)).toBe(target)
            for (let index = 0; index < candidatePath.edges.length; index += 1) {
              const from = candidatePath.nodeIds[index] ?? ''
              const to = candidatePath.nodeIds[index + 1] ?? ''
              expect(neighbors[from]).toContain(to)
              expect(candidatePath.edges[index]).toBe(`${from}:${to}`)
            }
          }
        }
      }
    }
  })

  test('bidirectional BFS terminates early when target is isolated in a high-fanout graph', () => {
    const fanout = Array.from({ length: 200 }, (_, index) => `branch-${index}`)
    const graph = adjacency({
      root: fanout,
      ...Object.fromEntries(fanout.map((id) => [id, ['hub']])),
    })
    const reverseGraph = new Map<string, GraphNeighbor<string>[]>([['isolated', []]])

    const biSearch = new BidirectionalBreadthFirstSearch<string>('root', 'isolated')
    let steps = 0
    while (!biSearch.hasMeeting) {
      const side = biSearch.nextSide()
      if (side === null) break
      steps += 1
      if (side === 'forward') biSearch.advanceForward(graph)
      else biSearch.advanceBackward(reverseGraph)
    }

    expect(biSearch.shortestPath()).toBeNull()
    expect(steps).toBe(2)
  })
})

function adjacency(neighbors: Record<string, readonly string[]>): Map<string, GraphNeighbor<string>[]> {
  return new Map(Object.entries(neighbors).map(([from, targets]) => [
    from,
    targets.map((nodeId) => ({ nodeId, edge: `${from}:${nodeId}` })),
  ]))
}

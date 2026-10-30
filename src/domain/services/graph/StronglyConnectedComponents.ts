export interface StronglyConnectedComponent {
  /** Stable component number after components are ordered by the input node order. */
  id: number
  nodeIds: string[]
}

/**
 * Iterative Kosaraju decomposition for a directed graph.
 *
 * The graph is supplied as IDs and adjacency, so storage, API and entity concerns stay outside
 * the algorithm. Unknown neighbors are ignored and duplicate edges do not change the result.
 * Explicit stacks avoid recursion limits on long dependency chains.
 */
export function stronglyConnectedComponents(
  nodeIds: readonly string[],
  outgoing: ReadonlyMap<string, readonly string[]>,
): StronglyConnectedComponent[] {
  const order = [...new Set(nodeIds)]
  const known = new Set(order)
  const normalized = new Map<string, string[]>(order.map((nodeId) => [nodeId, uniqueKnownNeighbors(outgoing.get(nodeId) ?? [], known)]))
  const reversed = new Map<string, string[]>(order.map((nodeId) => [nodeId, []]))

  for (const [source, neighbors] of normalized) {
    for (const target of neighbors) reversed.get(target)?.push(source)
  }

  const visited = new Set<string>()
  const finishOrder: string[] = []
  for (const start of order) {
    if (visited.has(start)) continue
    visited.add(start)
    const stack: Array<{ nodeId: string; nextNeighbor: number }> = [{ nodeId: start, nextNeighbor: 0 }]
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]
      if (frame === undefined) break
      const neighbors = normalized.get(frame.nodeId) ?? []
      const next = neighbors[frame.nextNeighbor]
      if (next !== undefined) {
        frame.nextNeighbor += 1
        if (!visited.has(next)) {
          visited.add(next)
          stack.push({ nodeId: next, nextNeighbor: 0 })
        }
        continue
      }
      finishOrder.push(frame.nodeId)
      stack.pop()
    }
  }

  const assigned = new Set<string>()
  const components: string[][] = []
  for (let index = finishOrder.length - 1; index >= 0; index -= 1) {
    const start = finishOrder[index]
    if (start === undefined || assigned.has(start)) continue
    const component: string[] = []
    const stack = [start]
    assigned.add(start)
    while (stack.length > 0) {
      const nodeId = stack.pop()
      if (nodeId === undefined) continue
      component.push(nodeId)
      for (const neighbor of reversed.get(nodeId) ?? []) {
        if (assigned.has(neighbor)) continue
        assigned.add(neighbor)
        stack.push(neighbor)
      }
    }
    component.sort((left, right) => order.indexOf(left) - order.indexOf(right))
    components.push(component)
  }

  components.sort((left, right) => order.indexOf(left[0] ?? '') - order.indexOf(right[0] ?? ''))
  return components.map((nodeIdsForComponent, id) => ({ id, nodeIds: nodeIdsForComponent }))
}

function uniqueKnownNeighbors(neighbors: readonly string[], known: ReadonlySet<string>): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  for (const neighbor of neighbors) {
    if (!known.has(neighbor) || seen.has(neighbor)) continue
    seen.add(neighbor)
    result.push(neighbor)
  }
  return result
}

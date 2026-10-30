export interface GraphNeighbor<TEdge> {
  nodeId: string
  edge: TEdge
}

export interface BreadthFirstPath<TEdge> {
  nodeIds: string[]
  edges: TEdge[]
  distance: number
}

interface Predecessor<TEdge> {
  nodeId: string
  edge: TEdge
}

/**
 * Unweighted, node-unique BFS state. Storage and transport stay with the caller.
 * First discovery wins ties in caller-provided adjacency order. Paths are only
 * materialized on demand, rather than copied for every pending vertex.
 */
export class BreadthFirstSearch<TEdge> {
  private readonly predecessors = new Map<string, Predecessor<TEdge>>()
  private readonly discovered: Set<string>
  private currentFrontier: string[]
  private currentDepth = 0

  constructor(private readonly sourceId: string) {
    this.discovered = new Set([sourceId])
    this.currentFrontier = [sourceId]
  }

  get frontier(): readonly string[] {
    return this.currentFrontier
  }

  get depth(): number {
    return this.currentDepth
  }

  /** Expand exactly one level; omitted adjacency entries have no neighbors. */
  advance(adjacency: ReadonlyMap<string, readonly GraphNeighbor<TEdge>[]>): void {
    const nextFrontier: string[] = []
    for (const nodeId of this.currentFrontier) {
      for (const neighbor of adjacency.get(nodeId) ?? []) {
        if (this.discovered.has(neighbor.nodeId)) continue
        this.discovered.add(neighbor.nodeId)
        this.predecessors.set(neighbor.nodeId, { nodeId, edge: neighbor.edge })
        nextFrontier.push(neighbor.nodeId)
      }
    }
    this.currentFrontier = nextFrontier
    this.currentDepth += 1
  }

  pathTo(targetId: string): BreadthFirstPath<TEdge> | null {
    if (!this.discovered.has(targetId)) return null

    const nodeIds = [targetId]
    const edges: TEdge[] = []
    let currentId = targetId
    while (currentId !== this.sourceId) {
      const predecessor = this.predecessors.get(currentId)
      if (predecessor === undefined) return null
      edges.push(predecessor.edge)
      currentId = predecessor.nodeId
      nodeIds.push(currentId)
    }

    nodeIds.reverse()
    edges.reverse()
    return { nodeIds, edges, distance: edges.length }
  }
}

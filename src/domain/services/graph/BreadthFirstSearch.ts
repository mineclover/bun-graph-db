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

  get visitedCount(): number {
    return this.discovered.size
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

interface MeetingCandidate {
  nodeId: string
  distance: number
  forwardOrder: number
}

/**
 * Unweighted bidirectional shortest-path BFS state.
 * Expands whichever active frontier is smaller (breaking ties toward forward
 * expansion), terminates early as soon as either frontier empties or an optimal
 * meeting layer completes, and reconstructs the minimum-hop forward path
 * iteratively without recursive stack growth.
 */
export class BidirectionalBreadthFirstSearch<TEdge> {
  private readonly forwardPredecessors = new Map<string, Predecessor<TEdge>>()
  private readonly backwardSuccessors = new Map<string, Predecessor<TEdge>>()
  private readonly forwardDepthById: Map<string, number>
  private readonly forwardOrderById: Map<string, number>
  private readonly backwardDepthById: Map<string, number>
  private currentForwardFrontier: string[]
  private currentBackwardFrontier: string[]
  private currentForwardDepth = 0
  private currentBackwardDepth = 0
  private nextForwardOrder = 1
  private bestMeeting: MeetingCandidate | null = null

  constructor(
    private readonly sourceId: string,
    private readonly targetId: string,
  ) {
    this.forwardDepthById = new Map([[sourceId, 0]])
    this.forwardOrderById = new Map([[sourceId, 0]])
    this.backwardDepthById = new Map([[targetId, 0]])
    this.currentForwardFrontier = [sourceId]
    this.currentBackwardFrontier = [targetId]

    if (sourceId === targetId) {
      this.bestMeeting = {
        nodeId: sourceId,
        distance: 0,
        forwardOrder: 0,
      }
    }
  }

  get forwardFrontier(): readonly string[] {
    return this.currentForwardFrontier
  }

  get backwardFrontier(): readonly string[] {
    return this.currentBackwardFrontier
  }

  get totalDepth(): number {
    return this.currentForwardDepth + this.currentBackwardDepth
  }

  get visitedCount(): number {
    return this.forwardDepthById.size + this.backwardDepthById.size
  }

  get hasMeeting(): boolean {
    return this.bestMeeting !== null
  }

  nextSide(): 'forward' | 'backward' | null {
    if (this.bestMeeting !== null) return null
    if (this.currentForwardFrontier.length === 0 || this.currentBackwardFrontier.length === 0) {
      return null
    }
    return this.currentForwardFrontier.length <= this.currentBackwardFrontier.length
      ? 'forward'
      : 'backward'
  }

  advanceForward(adjacency: ReadonlyMap<string, readonly GraphNeighbor<TEdge>[]>): void {
    const nextDepth = this.currentForwardDepth + 1
    const nextFrontier: string[] = []

    for (const nodeId of this.currentForwardFrontier) {
      for (const neighbor of adjacency.get(nodeId) ?? []) {
        if (this.forwardDepthById.has(neighbor.nodeId)) continue
        const order = this.nextForwardOrder++
        this.forwardDepthById.set(neighbor.nodeId, nextDepth)
        this.forwardOrderById.set(neighbor.nodeId, order)
        this.forwardPredecessors.set(neighbor.nodeId, { nodeId, edge: neighbor.edge })
        nextFrontier.push(neighbor.nodeId)

        const backwardDepth = this.backwardDepthById.get(neighbor.nodeId)
        if (backwardDepth !== undefined) {
          this.considerMeeting(neighbor.nodeId, nextDepth + backwardDepth, order)
        }
      }
    }

    this.currentForwardFrontier = nextFrontier
    this.currentForwardDepth = nextDepth
  }

  advanceBackward(reverseAdjacency: ReadonlyMap<string, readonly GraphNeighbor<TEdge>[]>): void {
    const nextDepth = this.currentBackwardDepth + 1
    const nextFrontier: string[] = []

    for (const nodeId of this.currentBackwardFrontier) {
      for (const neighbor of reverseAdjacency.get(nodeId) ?? []) {
        if (this.backwardDepthById.has(neighbor.nodeId)) continue
        this.backwardDepthById.set(neighbor.nodeId, nextDepth)
        this.backwardSuccessors.set(neighbor.nodeId, { nodeId, edge: neighbor.edge })
        nextFrontier.push(neighbor.nodeId)

        const forwardDepth = this.forwardDepthById.get(neighbor.nodeId)
        if (forwardDepth !== undefined) {
          const forwardOrder = this.forwardOrderById.get(neighbor.nodeId) ?? Number.MAX_SAFE_INTEGER
          this.considerMeeting(neighbor.nodeId, forwardDepth + nextDepth, forwardOrder)
        }
      }
    }

    this.currentBackwardFrontier = nextFrontier
    this.currentBackwardDepth = nextDepth
  }

  shortestPath(): BreadthFirstPath<TEdge> | null {
    if (this.bestMeeting === null) return null

    const meetingId = this.bestMeeting.nodeId
    const prefixNodeIds = [meetingId]
    const prefixEdges: TEdge[] = []
    let currentForward = meetingId
    while (currentForward !== this.sourceId) {
      const predecessor = this.forwardPredecessors.get(currentForward)
      if (predecessor === undefined) return null
      prefixEdges.push(predecessor.edge)
      currentForward = predecessor.nodeId
      prefixNodeIds.push(currentForward)
    }
    prefixNodeIds.reverse()
    prefixEdges.reverse()

    const suffixNodeIds: string[] = []
    const suffixEdges: TEdge[] = []
    let currentBackward = meetingId
    while (currentBackward !== this.targetId) {
      const successor = this.backwardSuccessors.get(currentBackward)
      if (successor === undefined) return null
      suffixEdges.push(successor.edge)
      currentBackward = successor.nodeId
      suffixNodeIds.push(currentBackward)
    }

    const edges = [...prefixEdges, ...suffixEdges]
    return {
      nodeIds: [...prefixNodeIds, ...suffixNodeIds],
      edges,
      distance: edges.length,
    }
  }

  private considerMeeting(nodeId: string, distance: number, forwardOrder: number): void {
    if (
      this.bestMeeting === null ||
      distance < this.bestMeeting.distance ||
      (distance === this.bestMeeting.distance && forwardOrder < this.bestMeeting.forwardOrder)
    ) {
      this.bestMeeting = { nodeId, distance, forwardOrder }
    }
  }
}

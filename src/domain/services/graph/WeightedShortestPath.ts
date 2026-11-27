export interface WeightedEdge<TEdge = unknown> {
  targetId: string
  edge: TEdge
}

export interface WeightedPathResult<TEdge = unknown> {
  nodeIds: string[]
  edges: TEdge[]
  totalCost: number
  distance: number
}

export type PathCostFn<TEdge = unknown> = (edge: TEdge, fromNodeId: string, toNodeId: string) => number

export interface WeightedPathOptions {
  maxDepth?: number
  avoidNodes?: ReadonlySet<string>
}

interface HeapItem {
  nodeId: string
  cost: number
  depth: number
}

/** Binary min-heap keyed by `(cost ASC, depth ASC, nodeId ASC)` for deterministic Dijkstra relaxation. */
class MinHeap {
  private readonly items: HeapItem[] = []

  get size(): number {
    return this.items.length
  }

  push(item: HeapItem): void {
    this.items.push(item)
    this.bubbleUp(this.items.length - 1)
  }

  pop(): HeapItem | undefined {
    const first = this.items[0]
    if (first === undefined) return undefined
    const last = this.items.pop()
    if (this.items.length > 0 && last !== undefined) {
      this.items[0] = last
      this.sinkDown(0)
    }
    return first
  }

  private bubbleUp(index: number): void {
    let cursor = index
    while (cursor > 0) {
      const parent = (cursor - 1) >> 1
      const curItem = this.items[cursor]
      const parItem = this.items[parent]
      if (curItem === undefined || parItem === undefined || compareHeapItem(curItem, parItem) >= 0) break
      this.items[cursor] = parItem
      this.items[parent] = curItem
      cursor = parent
    }
  }

  private sinkDown(index: number): void {
    let cursor = index
    const len = this.items.length
    while (true) {
      const left = cursor * 2 + 1
      const right = left + 1
      let smallest = cursor
      const leftItem = this.items[left]
      const rightItem = this.items[right]
      const smallestItem = this.items[smallest]
      if (left < len && leftItem !== undefined && smallestItem !== undefined && compareHeapItem(leftItem, smallestItem) < 0) {
        smallest = left
      }
      const nextSmallest = this.items[smallest]
      if (right < len && rightItem !== undefined && nextSmallest !== undefined && compareHeapItem(rightItem, nextSmallest) < 0) {
        smallest = right
      }
      if (smallest === cursor) break
      const swap = this.items[cursor]
      const target = this.items[smallest]
      if (swap !== undefined && target !== undefined) {
        this.items[cursor] = target
        this.items[smallest] = swap
      }
      cursor = smallest
    }
  }
}

function compareHeapItem(left: HeapItem, right: HeapItem): number {
  if (left.cost !== right.cost) return left.cost - right.cost
  if (left.depth !== right.depth) return left.depth - right.depth
  return left.nodeId < right.nodeId ? -1 : left.nodeId > right.nodeId ? 1 : 0
}

/**
 * Deterministic Dijkstra shortest-path search over an adjacency map with strictly positive edge weights.
 * Pure domain module with zero runtime or persistence dependencies.
 */
export function dijkstraShortestPath<TEdge>(
  sourceId: string,
  targetId: string,
  outgoing: ReadonlyMap<string, readonly WeightedEdge<TEdge>[]>,
  costFn: PathCostFn<TEdge>,
  options: WeightedPathOptions = {},
): WeightedPathResult<TEdge> | null {
  const avoid = options.avoidNodes
  if (avoid?.has(sourceId) || avoid?.has(targetId)) {
    return null
  }
  if (sourceId === targetId) {
    return { nodeIds: [sourceId], edges: [], totalCost: 0, distance: 0 }
  }

  const maxDepth = options.maxDepth ?? 32
  if (maxDepth <= 0) return null

  const bestCost = new Map<string, number>([[sourceId, 0]])
  const bestDepth = new Map<string, number>([[sourceId, 0]])
  const parent = new Map<string, { prevId: string; edge: TEdge }>()
  const settled = new Set<string>()
  const heap = new MinHeap()
  heap.push({ nodeId: sourceId, cost: 0, depth: 0 })

  while (heap.size > 0) {
    const current = heap.pop()
    if (current === undefined) break
    if (settled.has(current.nodeId)) continue
    settled.add(current.nodeId)

    if (current.nodeId === targetId) {
      return reconstructPath(sourceId, targetId, parent, current.cost)
    }
    if (current.depth >= maxDepth) continue

    for (const neighbor of outgoing.get(current.nodeId) ?? []) {
      const nextId = neighbor.targetId
      if (avoid?.has(nextId) || settled.has(nextId)) continue

      const stepCost = costFn(neighbor.edge, current.nodeId, nextId)
      if (!Number.isFinite(stepCost) || stepCost <= 0) {
        throw new Error(`Edge cost must be a finite positive number; got ${String(stepCost)}`)
      }

      const nextCost = current.cost + stepCost
      const nextDepth = current.depth + 1
      const prevBest = bestCost.get(nextId)
      const prevDepth = bestDepth.get(nextId)

      if (
        prevBest === undefined ||
        nextCost < prevBest - 1e-12 ||
        (Math.abs(nextCost - prevBest) <= 1e-12 && (prevDepth === undefined || nextDepth < prevDepth))
      ) {
        bestCost.set(nextId, nextCost)
        bestDepth.set(nextId, nextDepth)
        parent.set(nextId, { prevId: current.nodeId, edge: neighbor.edge })
        heap.push({ nodeId: nextId, cost: nextCost, depth: nextDepth })
      }
    }
  }

  return null
}

/**
 * Yen's algorithm producing up to `k` distinct simple loopless weighted shortest paths.
 */
export function kShortestWeightedPaths<TEdge>(
  sourceId: string,
  targetId: string,
  outgoing: ReadonlyMap<string, readonly WeightedEdge<TEdge>[]>,
  costFn: PathCostFn<TEdge>,
  k: number = 3,
  options: WeightedPathOptions = {},
): WeightedPathResult<TEdge>[] {
  if (k <= 0) return []
  const first = dijkstraShortestPath(sourceId, targetId, outgoing, costFn, options)
  if (first === null) return []
  if (first.distance === 0 || k === 1) return [first]

  const shortestPaths: WeightedPathResult<TEdge>[] = [first]
  const candidates: WeightedPathResult<TEdge>[] = []
  const seenSignatures = new Set<string>([first.nodeIds.join('->')])
  const baseAvoid = options.avoidNodes ?? new Set<string>()
  const maxDepth = options.maxDepth ?? 32

  for (let pathIdx = 1; pathIdx < k; pathIdx += 1) {
    const previousPath = shortestPaths[pathIdx - 1]
    if (previousPath === undefined) break

    for (let spurIndex = 0; spurIndex < previousPath.nodeIds.length - 1; spurIndex += 1) {
      const spurNode = previousPath.nodeIds[spurIndex]
      if (spurNode === undefined) continue

      const rootNodes = previousPath.nodeIds.slice(0, spurIndex + 1)
      const rootEdges = previousPath.edges.slice(0, spurIndex)
      let rootCost = 0
      for (let edgeIdx = 0; edgeIdx < rootEdges.length; edgeIdx += 1) {
        const fromId = rootNodes[edgeIdx]
        const toId = rootNodes[edgeIdx + 1]
        const edge = rootEdges[edgeIdx]
        if (fromId !== undefined && toId !== undefined && edge !== undefined) {
          rootCost += costFn(edge, fromId, toId)
        }
      }

      const blockedOutgoingEdges = new Set<TEdge>()
      for (const existing of shortestPaths) {
        if (
          existing.nodeIds.length > spurIndex + 1 &&
          arraysEqual(existing.nodeIds.slice(0, spurIndex + 1), rootNodes)
        ) {
          const edgeToRemove = existing.edges[spurIndex]
          if (edgeToRemove !== undefined) blockedOutgoingEdges.add(edgeToRemove)
        }
      }

      const spurAvoid = new Set<string>(baseAvoid)
      for (let idx = 0; idx < spurIndex; idx += 1) {
        const rootId = rootNodes[idx]
        if (rootId !== undefined) spurAvoid.add(rootId)
      }

      const filteredOutgoing = new Map<string, readonly WeightedEdge<TEdge>[]>()
      for (const [nodeId, neighbors] of outgoing) {
        if (nodeId === spurNode && blockedOutgoingEdges.size > 0) {
          filteredOutgoing.set(
            nodeId,
            neighbors.filter((neighbor) => !blockedOutgoingEdges.has(neighbor.edge)),
          )
        } else {
          filteredOutgoing.set(nodeId, neighbors)
        }
      }

      const remainingDepth = maxDepth - spurIndex
      const spurResult = dijkstraShortestPath(spurNode, targetId, filteredOutgoing, costFn, {
        maxDepth: remainingDepth,
        avoidNodes: spurAvoid,
      })
      if (spurResult === null) continue

      const totalNodeIds = [...rootNodes.slice(0, -1), ...spurResult.nodeIds]
      const signature = totalNodeIds.join('->')
      if (seenSignatures.has(signature)) continue
      seenSignatures.add(signature)

      candidates.push({
        nodeIds: totalNodeIds,
        edges: [...rootEdges, ...spurResult.edges],
        totalCost: rootCost + spurResult.totalCost,
        distance: totalNodeIds.length - 1,
      })
    }

    if (candidates.length === 0) break
    candidates.sort(
      (left, right) =>
        left.totalCost - right.totalCost ||
        left.distance - right.distance ||
        comparePathStrings(left.nodeIds, right.nodeIds),
    )
    const nextBest = candidates.shift()
    if (nextBest === undefined) break
    shortestPaths.push(nextBest)
  }

  return shortestPaths
}

export type PathAlgorithmKind =
  | 'SHORTEST'
  | 'WEIGHTED_SHORTEST'
  | 'HIGHEST_CONFIDENCE'
  | 'HIGHEST_STRENGTH'
  | 'BALANCED_QUALITY'

export type WeightingStrategyKind =
  | 'STRENGTH_ONLY'
  | 'CONFIDENCE_ONLY'
  | 'STRENGTH_CONFIDENCE'
  | 'INVERSE_STRENGTH'
  | 'CUSTOM'

export interface RelationEdgeQuality {
  strength: number
  confidence: number
  relationIdentifier?: string
}

/**
 * Builds a strictly positive Dijkstra cost function matching GraphQL `PathAlgorithm`
 * and `WeightingStrategy` semantics over SQLite's `0..4` integer strength and confidence scale.
 */
export function createRelationCostFn(
  algorithm: PathAlgorithmKind = 'WEIGHTED_SHORTEST',
  strategy: WeightingStrategyKind = 'STRENGTH_CONFIDENCE',
  preferredRelationTypes?: ReadonlySet<string>,
): PathCostFn<RelationEdgeQuality> {
  return (edge) => {
    const strength = Math.min(4, Math.max(0, edge.strength))
    const confidence = Math.min(4, Math.max(0, edge.confidence))
    let cost: number

    if (algorithm === 'SHORTEST') {
      cost = 1
    } else if (algorithm === 'HIGHEST_CONFIDENCE' || strategy === 'CONFIDENCE_ONLY') {
      cost = 5 - confidence
    } else if (algorithm === 'HIGHEST_STRENGTH' || strategy === 'STRENGTH_ONLY') {
      cost = 5 - strength
    } else if (strategy === 'INVERSE_STRENGTH') {
      cost = 1 / Math.max(1, strength + 1)
    } else if (algorithm === 'BALANCED_QUALITY' || strategy === 'STRENGTH_CONFIDENCE') {
      cost = 1 + (8 - (strength + confidence)) * 0.5
    } else {
      cost = 5 - (strength * 0.6 + confidence * 0.4)
    }

    if (
      preferredRelationTypes &&
      preferredRelationTypes.size > 0 &&
      edge.relationIdentifier !== undefined &&
      preferredRelationTypes.has(edge.relationIdentifier)
    ) {
      cost *= 0.85
    }

    return Math.max(0.05, cost)
  }
}

function reconstructPath<TEdge>(
  sourceId: string,
  targetId: string,
  parent: ReadonlyMap<string, { prevId: string; edge: TEdge }>,
  totalCost: number,
): WeightedPathResult<TEdge> | null {
  const nodeIds: string[] = [targetId]
  const edges: TEdge[] = []
  let cursor = targetId
  while (cursor !== sourceId) {
    const step = parent.get(cursor)
    if (step === undefined) return null
    nodeIds.push(step.prevId)
    edges.push(step.edge)
    cursor = step.prevId
  }
  nodeIds.reverse()
  edges.reverse()
  return {
    nodeIds,
    edges,
    totalCost,
    distance: edges.length,
  }
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function comparePathStrings(left: readonly string[], right: readonly string[]): number {
  const len = Math.min(left.length, right.length)
  for (let index = 0; index < len; index += 1) {
    const l = left[index] ?? ''
    const r = right[index] ?? ''
    if (l !== r) return l < r ? -1 : 1
  }
  return left.length - right.length
}

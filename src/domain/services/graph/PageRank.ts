export interface PageRankOptions {
  dampingFactor?: number
  tolerance?: number
  maxIterations?: number
}

export interface PageRankResult {
  scores: ReadonlyMap<string, number>
  iterations: number
  converged: boolean
  finalDelta: number
}

/**
 * Deterministic power-iteration PageRank for a directed graph.
 *
 * This is intentionally independent from SQLite and from the existing SQL sort approximation.
 * Unknown and duplicate neighbors are ignored. Dangling rank is redistributed uniformly and each
 * iteration preserves a total score of one up to floating-point error.
 */
export function pageRank(
  nodeIds: readonly string[],
  outgoing: ReadonlyMap<string, readonly string[]>,
  options: PageRankOptions = {},
): PageRankResult {
  const ids = [...new Set(nodeIds)]
  if (ids.length === 0) return { scores: new Map(), iterations: 0, converged: true, finalDelta: 0 }

  const dampingFactor = options.dampingFactor ?? 0.85
  const tolerance = options.tolerance ?? 1e-9
  const maxIterations = options.maxIterations ?? 100
  if (!(dampingFactor > 0 && dampingFactor < 1)) throw new Error('dampingFactor must be between 0 and 1')
  if (!(tolerance > 0)) throw new Error('tolerance must be greater than 0')
  if (!Number.isSafeInteger(maxIterations) || maxIterations <= 0) throw new Error('maxIterations must be a positive integer')

  const known = new Set(ids)
  const edges = new Map(ids.map((source) => [source, uniqueKnownNeighbors(outgoing.get(source) ?? [], known)]))
  const incoming = new Map(ids.map((target) => [target, [] as string[]]))
  for (const [source, targets] of edges) {
    for (const target of targets) incoming.get(target)?.push(source)
  }

  let scores = new Map(ids.map((id) => [id, 1 / ids.length]))
  let finalDelta = Number.POSITIVE_INFINITY
  let iterations = 0
  let converged = false
  while (iterations < maxIterations) {
    const danglingMass = ids.reduce((sum, id) => sum + (edges.get(id)?.length === 0 ? (scores.get(id) ?? 0) : 0), 0)
    const base = (1 - dampingFactor + dampingFactor * danglingMass) / ids.length
    const next = new Map<string, number>()
    for (const target of ids) {
      const incomingMass = (incoming.get(target) ?? []).reduce((sum, source) => {
        const degree = edges.get(source)?.length ?? 0
        return sum + (degree === 0 ? 0 : (scores.get(source) ?? 0) / degree)
      }, 0)
      next.set(target, base + dampingFactor * incomingMass)
    }

    finalDelta = ids.reduce((sum, id) => sum + Math.abs((next.get(id) ?? 0) - (scores.get(id) ?? 0)), 0)
    scores = next
    iterations += 1
    if (finalDelta <= tolerance) {
      converged = true
      break
    }
  }

  return { scores, iterations, converged, finalDelta }
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

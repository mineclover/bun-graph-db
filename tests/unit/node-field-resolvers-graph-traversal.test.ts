import { describe, expect, test } from 'bun:test'
import type { ILogger } from '@/application/ports/ILogger.js'
import { GraphTraversalService } from '@/application/services/GraphTraversalService.js'
import type { NodeParent } from '@/core/types/GraphQLTypes.js'
import { Node } from '@/domain/entities/Node.js'
import { NodeRelation } from '@/domain/entities/NodeRelation.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { NodeFieldResolvers } from '@/presentation/graphql/field-resolvers/NodeFieldResolvers.js'

const tableId = 'table-1'

describe('NodeFieldResolvers graph traversal', () => {
  test('traverses a cyclic high-degree graph by batched levels without truncating the frontier', async () => {
    const childIds = Array.from({ length: 125 }, (_, index) => `child-${index.toString().padStart(3, '0')}`)
    const nodeIds = ['root', ...childIds, 'terminal']
    const relations = [
      ...childIds.map((childId, index) => relation(`root-child-${index}`, 'root', childId)),
      ...childIds.map((childId, index) => relation(`child-terminal-${index}`, childId, 'terminal')),
      relation('terminal-root-cycle', 'terminal', 'root'),
    ]
    const harness = createHarness(nodeIds, relations)

    const result = await harness.resolver.connectedNodes(parent('root'), {
      depth: 2,
      direction: 'OUTGOING',
    })
    const resultIds = result.map((node) => node.getId())

    expect(resultIds).toHaveLength(126)
    expect(resultIds.slice(0, 125)).toEqual(childIds)
    expect(resultIds.at(-1)).toBe('terminal')
    expect(new Set(resultIds).size).toBe(resultIds.length)
    expect(resultIds).not.toContain('root')
    expect(harness.nodeBatchCalls).toEqual([
      ['root'],
      childIds,
      ['terminal'],
    ])
    expect(harness.findByIdCalls).toBe(0)
    expect(harness.maxRelationLoadsInFlight()).toBeGreaterThan(1)
  })

  test('finds the shortest path with level adjacency and preserves the maxDepth boundary', async () => {
    const relations = [
      relation('root-b', 'root', 'b'),
      relation('root-c', 'root', 'c'),
      relation('b-root-cycle', 'b', 'root'),
      relation('b-d', 'b', 'd'),
      relation('d-target', 'd', 'target'),
      relation('c-target', 'c', 'target'),
    ]

    const shallow = createHarness(['root', 'b', 'c', 'd', 'target'], relations)
    const outsideDepth = await shallow.resolver.shortestPath(parent('root'), {
      targetNodeId: 'target',
      maxDepth: 1,
    })
    expect(outsideDepth).toEqual([])
    expect(shallow.nodeBatchCalls).toEqual([])

    const exact = createHarness(['root', 'b', 'c', 'd', 'target'], relations)
    const shortest = await exact.resolver.shortestPath(parent('root'), {
      targetNodeId: 'target',
      maxDepth: 2,
    })

    expect(shortest?.map((node) => node.getId())).toEqual(['root', 'c', 'target'])
    expect(exact.nodeBatchCalls).toEqual([['root', 'c', 'target']])
    expect(exact.findByIdCalls).toBe(0)
    expect(exact.maxRelationLoadsInFlight()).toBeGreaterThan(1)
  })

  test('keeps incoming, outgoing and bidirectional loading separate from BFS state', async () => {
    const harness = createHarness(['root', 'incoming', 'outgoing'], [
      relation('in', 'incoming', 'root'),
      relation('out', 'root', 'outgoing'),
    ])
    for (const [direction, expected] of [
      ['INCOMING', ['root', 'incoming']],
      ['OUTGOING', ['root', 'outgoing']],
      ['BOTH', ['root', 'outgoing', 'incoming']],
    ] as const) {
      const nodes = await harness.service.connectedNodes('root', 1, direction)
      expect(nodes.map((entry) => entry.getId())).toEqual([...expected])
    }
  })

  test('filters relation ids before discovery and keeps an empty filter distinct from no filter', async () => {
    const harness = createHarness(['root', 'target'], [relation('edge', 'root', 'target')])
    expect((await harness.service.connectedNodes('root', 1, 'BOTH', [])).map((entry) => entry.getId())).toEqual(['root'])
    expect((await harness.service.connectedNodes('root', 1, 'BOTH', ['unknown'])).map((entry) => entry.getId())).toEqual(['root'])
    expect((await harness.service.connectedNodes('root', 1, 'BOTH', ['depends-on'])).map((entry) => entry.getId())).toEqual(['root', 'target'])
  })

  test('returns zero-hop paths and does not expand beyond a zero-hop limit', async () => {
    const harness = createHarness(['root', 'target'], [relation('edge', 'root', 'target')])
    expect(await harness.resolver.connectedNodes(parent('root'), { depth: 0 })).toEqual([])
    expect((await harness.service.connectedNodes('root', 0, 'BOTH')).map((entry) => entry.getId())).toEqual(['root'])
    const path = await harness.service.findShortestPath('root', 'root', 0)
    expect(path?.nodes.map((entry) => entry.getId())).toEqual(['root'])
    expect(path?.relations).toEqual([])
    expect(path?.distance).toBe(0)
    expect(await harness.service.findShortestPath('root', 'target', 0)).toBeNull()
  })

  test('reassembles node and relation order even when the repository returns nodes in reverse order', async () => {
    const harness = createHarness(['root', 'a', 'target'], [
      relation('root-a', 'root', 'a'),
      relation('a-target', 'a', 'target'),
    ], true)
    const path = await harness.service.findShortestPath('root', 'target', 2)
    expect(path?.nodes.map((entry) => entry.getId())).toEqual(['root', 'a', 'target'])
    expect(path?.relations.map((entry) => entry.getId())).toEqual(['root-a', 'a-target'])
    expect(path?.distance).toBe(2)
  })

  test('bounds adjacency concurrency and splits large node hydration without truncating results', async () => {
    const ids = Array.from({ length: 1_001 }, (_, index) => `child-${index}`)
    const harness = createHarness(['root', ...ids], ids.map((id) => relation(`root-${id}`, 'root', id)))
    const nodes = await harness.service.connectedNodes('root', 2, 'BOTH')
    expect(nodes).toHaveLength(1_002)
    expect(harness.nodeBatchCalls.map((batch) => batch.length)).toEqual([1, 500, 500, 1])
    expect(harness.maxRelationLoadsInFlight()).toBeLessThanOrEqual(128)
  })

  test('uses bulk adjacency when the repository supplies it and preserves direction/filter semantics', async () => {
    const harness = createHarness([
      'root',
      'incoming',
      'outgoing',
      'ignored',
    ], [
      relation('in', 'incoming', 'root'),
      relation('out', 'root', 'outgoing'),
      relationWithType('ignored-edge', 'root', 'ignored', 'other-type'),
    ], false, true)

    expect((await harness.service.connectedNodes('root', 1, 'INCOMING')).map((entry) => entry.getId())).toEqual(['root', 'incoming'])
    expect((await harness.service.connectedNodes('root', 1, 'OUTGOING', ['depends-on'])).map((entry) => entry.getId())).toEqual(['root', 'outgoing'])
    const both = await harness.service.connectedNodesWithMetrics('root', 1, 'BOTH', ['other-type'])
    expect(both.nodes.map((entry) => entry.getId())).toEqual(['root', 'ignored'])
    expect(both.metrics).toMatchObject({
      nodeBatchCount: 2,
      nodeIdsRequested: 2,
      nodeIdsLoaded: 2,
      adjacencyBatchCount: 1,
      bulkAdjacencyBatchCount: 1,
      perNodeAdjacencyCalls: 0,
      relationsLoaded: 3,
      maxFrontier: 1,
    })
    expect(harness.bulkRelationCalls).toBe(3)
    expect(harness.perNodeRelationCalls).toBe(0)
  })
})

function createHarness(nodeIds: readonly string[], relations: readonly NodeRelation[], reverseNodes = false, useBulk = false) {
  const nodesById = new Map(nodeIds.map((id) => [id, node(id)]))
  const nodeBatchCalls: string[][] = []
  let findByIdCalls = 0
  let relationLoadsInFlight = 0
  let maximumRelationLoadsInFlight = 0
  let bulkRelationCalls = 0
  let perNodeRelationCalls = 0

  const loadRelations = async (matching: NodeRelation[]): Promise<NodeRelation[]> => {
    relationLoadsInFlight += 1
    perNodeRelationCalls += 1
    maximumRelationLoadsInFlight = Math.max(maximumRelationLoadsInFlight, relationLoadsInFlight)
    await Promise.resolve()
    relationLoadsInFlight -= 1
    return matching
  }

  const nodeRepository = {
    findById: async (id: string) => {
      findByIdCalls += 1
      return nodesById.get(id) ?? null
    },
    findByIds: async (ids: string[]) => {
      nodeBatchCalls.push([...ids])
      const foundNodes = ids.flatMap((id) => {
        const found = nodesById.get(id)
        return found === undefined ? [] : [found]
      })
      return reverseNodes ? foundNodes.reverse() : foundNodes
    },
  } as unknown as INodeRepository

  const nodeRelationRepository = {
    findBySourceNodeId: async (nodeId: string) => loadRelations(
      relations.filter((candidate) => candidate.getSourceNodeId() === nodeId),
    ),
    findByTargetNodeId: async (nodeId: string) => loadRelations(
      relations.filter((candidate) => candidate.getTargetNodeId() === nodeId),
    ),
    ...(useBulk ? {
      findAdjacentByNodeIds: async (nodeIds: readonly string[], direction: 'OUTGOING' | 'INCOMING' | 'BOTH') => {
        bulkRelationCalls += 1
        const result = new Map(nodeIds.map((nodeId) => [nodeId, [] as NodeRelation[]]))
        for (const nodeId of nodeIds) {
          const matching = relations.filter((candidate) => {
            if (direction === 'OUTGOING') return candidate.getSourceNodeId() === nodeId
            if (direction === 'INCOMING') return candidate.getTargetNodeId() === nodeId
            return candidate.getSourceNodeId() === nodeId || candidate.getTargetNodeId() === nodeId
          })
          result.set(nodeId, matching)
        }
        return result
      },
    } : {}),
  } as unknown as INodeRelationRepository

  const resolver = new NodeFieldResolvers(
    nodeRepository,
    {} as ITableRepository,
    {} as INodeAttributeRepository,
    nodeRelationRepository,
    {} as IRelationTypeRepository,
    silentLogger,
  )

  return {
    resolver,
    service: new GraphTraversalService(nodeRepository, nodeRelationRepository),
    nodeBatchCalls,
    get findByIdCalls() {
      return findByIdCalls
    },
    maxRelationLoadsInFlight: () => maximumRelationLoadsInFlight,
    get bulkRelationCalls() {
      return bulkRelationCalls
    },
    get perNodeRelationCalls() {
      return perNodeRelationCalls
    },
  }
}

function node(id: string): Node {
  const timestamp = new Date('2026-01-01T00:00:00.000Z')
  return Node.fromDatabase(id, tableId, `content:${id}`, id, null, null, timestamp, timestamp)
}

function relation(id: string, sourceNodeId: string, targetNodeId: string): NodeRelation {
  return relationWithType(id, sourceNodeId, targetNodeId, 'depends-on')
}

function relationWithType(id: string, sourceNodeId: string, targetNodeId: string, relationTypeId: string): NodeRelation {
  const timestamp = new Date('2026-01-01T00:00:00.000Z')
  return NodeRelation.fromDatabase(
    id,
    tableId,
    sourceNodeId,
    'internal',
    targetNodeId,
    'internal',
    relationTypeId,
    null,
    1,
    timestamp,
    timestamp,
  )
}

function parent(id: string): NodeParent {
  const timestamp = new Date('2026-01-01T00:00:00.000Z')
  return {
    id,
    tableId,
    content: `content:${id}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  }
}

const silentLogger: ILogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
}

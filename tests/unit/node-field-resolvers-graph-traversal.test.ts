import { describe, expect, test } from 'bun:test'
import type { ILogger } from '@/application/ports/ILogger.js'
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
})

function createHarness(nodeIds: readonly string[], relations: readonly NodeRelation[]) {
  const nodesById = new Map(nodeIds.map((id) => [id, node(id)]))
  const nodeBatchCalls: string[][] = []
  let findByIdCalls = 0
  let relationLoadsInFlight = 0
  let maximumRelationLoadsInFlight = 0

  const loadRelations = async (matching: NodeRelation[]): Promise<NodeRelation[]> => {
    relationLoadsInFlight += 1
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
      return ids.flatMap((id) => {
        const found = nodesById.get(id)
        return found === undefined ? [] : [found]
      })
    },
  } as unknown as INodeRepository

  const nodeRelationRepository = {
    findBySourceNodeId: async (nodeId: string) => loadRelations(
      relations.filter((candidate) => candidate.getSourceNodeId() === nodeId),
    ),
    findByTargetNodeId: async (nodeId: string) => loadRelations(
      relations.filter((candidate) => candidate.getTargetNodeId() === nodeId),
    ),
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
    nodeBatchCalls,
    get findByIdCalls() {
      return findByIdCalls
    },
    maxRelationLoadsInFlight: () => maximumRelationLoadsInFlight,
  }
}

function node(id: string): Node {
  const timestamp = new Date('2026-01-01T00:00:00.000Z')
  return Node.fromDatabase(id, tableId, `content:${id}`, id, null, null, timestamp, timestamp)
}

function relation(id: string, sourceNodeId: string, targetNodeId: string): NodeRelation {
  const timestamp = new Date('2026-01-01T00:00:00.000Z')
  return NodeRelation.fromDatabase(
    id,
    tableId,
    sourceNodeId,
    'internal',
    targetNodeId,
    'internal',
    'depends-on',
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

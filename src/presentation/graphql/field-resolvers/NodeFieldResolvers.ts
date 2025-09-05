import type { ILogger } from '@/application/ports/ILogger.js'
import type { GraphQLContext, NodeParent } from '@/core/types/GraphQLTypes.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

export class NodeFieldResolvers extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly nodeRepository: INodeRepository,
    private readonly tableRepository: ITableRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly nodeRelationRepository: INodeRelationRepository,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  async table(parent: NodeParent, args?: any, context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => {
        return await this.tableRepository.findById(parent.tableId)
      },
      'table',
      'Node',
      { nodeId: parent.id, tableId: parent.tableId }
    )
  }

  async attributes(parent: NodeParent, args?: any, context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => {
        return await this.nodeAttributeRepository.findByNodeId(parent.id)
      },
      'attributes',
      'Node',
      { nodeId: parent.id }
    )
  }

  async attributeCount(parent: NodeParent, args?: any, context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => {
        return await this.nodeAttributeRepository.countByNodeId(parent.id)
      },
      'attributeCount',
      'Node',
      { nodeId: parent.id }
    )
  }

  async outgoingRelations(parent: NodeParent, args?: any, context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => {
        return await this.nodeRelationRepository.findBySourceNodeId(parent.id)
      },
      'outgoingRelations',
      'Node',
      { nodeId: parent.id }
    )
  }

  async incomingRelations(parent: NodeParent, args?: any, context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => {
        return await this.nodeRelationRepository.findByTargetNodeId(parent.id)
      },
      'incomingRelations',
      'Node',
      { nodeId: parent.id }
    )
  }

  async relationCount(parent: NodeParent, args?: any, context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => {
        const outgoingCount = await this.nodeRelationRepository.countBySourceNodeId(parent.id)
        const incomingCount = await this.nodeRelationRepository.countByTargetNodeId(parent.id)
        return outgoingCount + incomingCount
      },
      'relationCount',
      'Node',
      { nodeId: parent.id }
    )
  }

  // 그래프 탐색용 Field Resolvers
  async connectedNodes(
    parent: NodeParent,
    args?: {
      depth?: number
      direction?: 'OUTGOING' | 'INCOMING' | 'BOTH'
      relationTypes?: string[]
    },
    context?: GraphQLContext
  ) {
    return this.handleFieldResolution(
      async () => {
        const depth = args?.depth || 1
        const direction = args?.direction || 'BOTH'
        const relationTypes = args?.relationTypes

        const visited = new Set<string>()
        const result: any[] = []

        await this._traverseGraph(parent.id, depth, direction, relationTypes, visited, result, 0)

        return result
      },
      'connectedNodes',
      'Node',
      { nodeId: parent.id, depth: args?.depth, direction: args?.direction }
    )
  }

  async shortestPath(
    parent: NodeParent,
    args: { targetNodeId: string; maxDepth?: number },
    context?: GraphQLContext
  ) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('targetNodeId', 'Target Node ID'),
        BaseResolver.validationRules.nonEmpty('targetNodeId', 'Target Node ID'),
      ],
      'shortestPath'
    )

    return this.handleFieldResolution(
      async () => {
        const { targetNodeId, maxDepth = 6 } = args
        const path = await this._findShortestPath(parent.id, targetNodeId, maxDepth)
        return path
      },
      'shortestPath',
      'Node',
      { sourceNodeId: parent.id, targetNodeId: args.targetNodeId }
    )
  }

  async neighborsByRelationType(
    parent: NodeParent,
    args: { relationTypeId: string },
    context?: GraphQLContext
  ) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('relationTypeId', 'Relation Type ID'),
        BaseResolver.validationRules.nonEmpty('relationTypeId', 'Relation Type ID'),
      ],
      'neighborsByRelationType'
    )

    return this.handleFieldResolution(
      async () => {
        const outgoing = await this.nodeRelationRepository.findBySourceNodeIdAndRelationType(
          parent.id,
          args.relationTypeId
        )
        const incoming = await this.nodeRelationRepository.findByTargetNodeIdAndRelationType(
          parent.id,
          args.relationTypeId
        )

        const neighborIds = [
          ...outgoing.map((rel) => rel.getTargetNodeId()).filter((id): id is string => id !== null),
          ...incoming.map((rel) => rel.getSourceNodeId()).filter((id): id is string => id !== null),
        ]

        const uniqueNeighborIds = [...new Set(neighborIds)]
        const neighbors = await Promise.all(
          uniqueNeighborIds.map((id) => this.nodeRepository.findById(id))
        )

        return neighbors.filter((node) => node !== null)
      },
      'neighborsByRelationType',
      'Node',
      { nodeId: parent.id, relationTypeId: args.relationTypeId }
    )
  }

  // 그래프 탐색 헬퍼 메서드들
  private async _traverseGraph(
    nodeId: string,
    remainingDepth: number,
    direction: 'OUTGOING' | 'INCOMING' | 'BOTH',
    relationTypes: string[] | undefined,
    visited: Set<string>,
    result: any[],
    currentDepth: number
  ): Promise<void> {
    if (remainingDepth <= 0 || visited.has(nodeId)) return

    visited.add(nodeId)
    const node = await this.nodeRepository.findById(nodeId)
    if (!node) return

    result.push({
      node,
      depth: currentDepth,
      path: Array.from(visited),
    })

    // 관련된 relation들 가져오기
    const relations: any[] = []

    if (direction === 'OUTGOING' || direction === 'BOTH') {
      const outgoing = await this.nodeRelationRepository.findBySourceNodeId(nodeId)
      relations.push(...outgoing)
    }

    if (direction === 'INCOMING' || direction === 'BOTH') {
      const incoming = await this.nodeRelationRepository.findByTargetNodeId(nodeId)
      relations.push(...incoming)
    }

    // relationTypes 필터링
    const filteredRelations = relationTypes
      ? relations.filter((rel) => relationTypes.includes(rel.getRelationTypeId()))
      : relations

    // 다음 레벨 탐색
    for (const relation of filteredRelations) {
      const nextNodeId =
        relation.getSourceNodeId() === nodeId
          ? relation.getTargetNodeId()
          : relation.getSourceNodeId()

      await this._traverseGraph(
        nextNodeId,
        remainingDepth - 1,
        direction,
        relationTypes,
        visited,
        result,
        currentDepth + 1
      )
    }
  }

  private async _findShortestPath(
    sourceId: string,
    targetId: string,
    maxDepth: number
  ): Promise<{ nodes: any[]; relations: any[]; distance: number } | null> {
    const queue: Array<{ nodeId: string; path: string[]; relations: any[]; depth: number }> = [
      { nodeId: sourceId, path: [sourceId], relations: [], depth: 0 },
    ]
    const visited = new Set<string>()

    while (queue.length > 0) {
      const current = queue.shift()!

      if (current.nodeId === targetId) {
        // 경로 찾음
        const nodes = await Promise.all(current.path.map((id) => this.nodeRepository.findById(id)))
        return {
          nodes: nodes.filter((node) => node !== null),
          relations: current.relations,
          distance: current.depth,
        }
      }

      if (current.depth >= maxDepth || visited.has(current.nodeId)) {
        continue
      }

      visited.add(current.nodeId)

      // 연결된 노드들 탐색
      const outgoing = await this.nodeRelationRepository.findBySourceNodeId(current.nodeId)
      const incoming = await this.nodeRelationRepository.findByTargetNodeId(current.nodeId)

      const allRelations = [...outgoing, ...incoming]

      for (const relation of allRelations) {
        const nextNodeId =
          relation.getSourceNodeId() === current.nodeId
            ? relation.getTargetNodeId()
            : relation.getSourceNodeId()

        if (nextNodeId && !visited.has(nextNodeId) && !current.path.includes(nextNodeId)) {
          queue.push({
            nodeId: nextNodeId,
            path: [...current.path, nextNodeId],
            relations: [...current.relations, relation],
            depth: current.depth + 1,
          })
        }
      }
    }

    return null // 경로 없음
  }
}

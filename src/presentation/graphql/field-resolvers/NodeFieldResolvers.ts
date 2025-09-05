import type { ILogger } from '@/application/ports/ILogger.js'
import type { NodeParent } from '@/core/types/GraphQLTypes.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'

export class NodeFieldResolvers {
  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly nodeRelationRepository: INodeRelationRepository,
    private readonly logger: ILogger
  ) {}

  async table(parent: NodeParent) {
    try {
      this.logger.debug('Resolving node table', { nodeId: parent.id, tableId: parent.tableId })
      return await this.tableRepository.findById(parent.tableId)
    } catch (error) {
      this.logger.error('Error resolving node table', {
        error,
        nodeId: parent.id,
        tableId: parent.tableId,
      })
      throw error
    }
  }

  async attributes(parent: NodeParent) {
    try {
      this.logger.debug('Resolving node attributes', { nodeId: parent.id })
      return await this.nodeAttributeRepository.findByNodeId(parent.id)
    } catch (error) {
      this.logger.error('Error resolving node attributes', { error, nodeId: parent.id })
      throw error
    }
  }

  async attributeCount(parent: NodeParent) {
    try {
      this.logger.debug('Resolving node attribute count', { nodeId: parent.id })
      return await this.nodeAttributeRepository.countByNodeId(parent.id)
    } catch (error) {
      this.logger.error('Error resolving node attribute count', { error, nodeId: parent.id })
      throw error
    }
  }

  async outgoingRelations(parent: NodeParent) {
    try {
      this.logger.debug('Resolving node outgoing relations', { nodeId: parent.id })
      return await this.nodeRelationRepository.findBySourceNodeId(parent.id)
    } catch (error) {
      this.logger.error('Error resolving node outgoing relations', { error, nodeId: parent.id })
      throw error
    }
  }

  async incomingRelations(parent: NodeParent) {
    try {
      this.logger.debug('Resolving node incoming relations', { nodeId: parent.id })
      return await this.nodeRelationRepository.findByTargetNodeId(parent.id)
    } catch (error) {
      this.logger.error('Error resolving node incoming relations', { error, nodeId: parent.id })
      throw error
    }
  }

  async relationCount(parent: NodeParent) {
    try {
      this.logger.debug('Resolving node relation count', { nodeId: parent.id })
      const outgoingCount = await this.nodeRelationRepository.countBySourceNodeId(parent.id)
      const incomingCount = await this.nodeRelationRepository.countByTargetNodeId(parent.id)
      return outgoingCount + incomingCount
    } catch (error) {
      this.logger.error('Error resolving node relation count', { error, nodeId: parent.id })
      throw error
    }
  }

  // 그래프 탐색용 Field Resolvers
  async connectedNodes(parent: NodeParent, args?: { 
    depth?: number 
    direction?: 'OUTGOING' | 'INCOMING' | 'BOTH'
    relationTypes?: string[]
  }) {
    try {
      const depth = args?.depth || 1
      const direction = args?.direction || 'BOTH'
      const relationTypes = args?.relationTypes

      this.logger.debug('Resolving connected nodes with traversal', {
        nodeId: parent.id,
        depth,
        direction,
        relationTypes
      })

      const visited = new Set<string>()
      const result: any[] = []

      await this._traverseGraph(parent.id, depth, direction, relationTypes, visited, result, 0)
      
      return result
    } catch (error) {
      this.logger.error('Error resolving connected nodes', { 
        error, 
        nodeId: parent.id,
        args 
      })
      throw error
    }
  }

  async shortestPath(parent: NodeParent, args: { targetNodeId: string; maxDepth?: number }) {
    try {
      const { targetNodeId, maxDepth = 6 } = args
      
      this.logger.debug('Finding shortest path', {
        sourceNodeId: parent.id,
        targetNodeId,
        maxDepth
      })

      const path = await this._findShortestPath(parent.id, targetNodeId, maxDepth)
      return path
    } catch (error) {
      this.logger.error('Error finding shortest path', {
        error,
        sourceNodeId: parent.id,
        targetNodeId: args.targetNodeId
      })
      throw error
    }
  }

  async neighborsByRelationType(parent: NodeParent, args: { relationTypeId: string }) {
    try {
      this.logger.debug('Resolving neighbors by relation type', {
        nodeId: parent.id,
        relationTypeId: args.relationTypeId
      })

      const outgoing = await this.nodeRelationRepository.findBySourceNodeIdAndRelationType(
        parent.id,
        args.relationTypeId
      )
      const incoming = await this.nodeRelationRepository.findByTargetNodeIdAndRelationType(
        parent.id,
        args.relationTypeId
      )

      const neighborIds = [
        ...outgoing.map(rel => rel.getTargetNodeId()),
        ...incoming.map(rel => rel.getSourceNodeId())
      ]

      const uniqueNeighborIds = [...new Set(neighborIds)]
      const neighbors = await Promise.all(
        uniqueNeighborIds.map(id => this.nodeRepository.findById(id))
      )

      return neighbors.filter(node => node !== null)
    } catch (error) {
      this.logger.error('Error resolving neighbors by relation type', {
        error,
        nodeId: parent.id,
        relationTypeId: args.relationTypeId
      })
      throw error
    }
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
      path: Array.from(visited)
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
      ? relations.filter(rel => relationTypes.includes(rel.getRelationTypeId()))
      : relations

    // 다음 레벨 탐색
    for (const relation of filteredRelations) {
      const nextNodeId = relation.getSourceNodeId() === nodeId 
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
      { nodeId: sourceId, path: [sourceId], relations: [], depth: 0 }
    ]
    const visited = new Set<string>()

    while (queue.length > 0) {
      const current = queue.shift()!
      
      if (current.nodeId === targetId) {
        // 경로 찾음
        const nodes = await Promise.all(
          current.path.map(id => this.nodeRepository.findById(id))
        )
        return {
          nodes: nodes.filter(node => node !== null),
          relations: current.relations,
          distance: current.depth
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
        const nextNodeId = relation.getSourceNodeId() === current.nodeId
          ? relation.getTargetNodeId()
          : relation.getSourceNodeId()

        if (!visited.has(nextNodeId) && !current.path.includes(nextNodeId)) {
          queue.push({
            nodeId: nextNodeId,
            path: [...current.path, nextNodeId],
            relations: [...current.relations, relation],
            depth: current.depth + 1
          })
        }
      }
    }

    return null // 경로 없음
  }
}

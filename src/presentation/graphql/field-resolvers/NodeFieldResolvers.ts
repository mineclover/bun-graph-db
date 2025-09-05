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
}

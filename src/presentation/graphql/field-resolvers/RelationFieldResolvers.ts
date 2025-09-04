import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { NodeRelationParent } from '@/core/types/GraphQLTypes.js'

export class RelationFieldResolvers {
  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly relationTypeRepository: IRelationTypeRepository,
    private readonly logger: ILogger
  ) {}

  async table(parent: NodeRelationParent) {
    try {
      this.logger.debug('Resolving relation table', { relationId: parent.id, tableId: parent.tableId })
      return await this.tableRepository.findById(parent.tableId)
    } catch (error) {
      this.logger.error('Error resolving relation table', { error, relationId: parent.id, tableId: parent.tableId })
      throw error
    }
  }

  async sourceNode(parent: NodeRelationParent) {
    try {
      this.logger.debug('Resolving relation source node', { relationId: parent.id, sourceNodeId: parent.sourceNodeId })
      return await this.nodeRepository.findById(parent.sourceNodeId)
    } catch (error) {
      this.logger.error('Error resolving relation source node', { error, relationId: parent.id, sourceNodeId: parent.sourceNodeId })
      throw error
    }
  }

  async targetNode(parent: NodeRelationParent) {
    try {
      this.logger.debug('Resolving relation target node', { relationId: parent.id, targetNodeId: parent.targetNodeId })
      return await this.nodeRepository.findById(parent.targetNodeId)
    } catch (error) {
      this.logger.error('Error resolving relation target node', { error, relationId: parent.id, targetNodeId: parent.targetNodeId })
      throw error
    }
  }

  async relationType(parent: NodeRelationParent) {
    try {
      this.logger.debug('Resolving relation type', { relationId: parent.id, relationTypeId: parent.relationTypeId })
      return await this.relationTypeRepository.findById(parent.relationTypeId)
    } catch (error) {
      this.logger.error('Error resolving relation type', { error, relationId: parent.id, relationTypeId: parent.relationTypeId })
      throw error
    }
  }
}
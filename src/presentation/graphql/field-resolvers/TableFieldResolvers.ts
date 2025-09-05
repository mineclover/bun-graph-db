import type { ILogger } from '@/application/ports/ILogger.js'
import type { TableParent } from '@/core/types/GraphQLTypes.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'

export class TableFieldResolvers {
  constructor(
    private readonly attributeRepository: IAttributeRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly logger: ILogger
  ) {}

  async attributes(parent: TableParent) {
    try {
      this.logger.debug('Resolving table attributes', { tableId: parent.id })
      return await this.attributeRepository.findByTableId(parent.id)
    } catch (error) {
      this.logger.error('Error resolving table attributes', { error, tableId: parent.id })
      throw error
    }
  }

  async nodes(parent: TableParent) {
    try {
      this.logger.debug('Resolving table nodes', { tableId: parent.id })
      const result = await this.nodeRepository.findByTableId(parent.id)
      return result.items
    } catch (error) {
      this.logger.error('Error resolving table nodes', { error, tableId: parent.id })
      throw error
    }
  }

  async nodeCount(parent: TableParent) {
    try {
      this.logger.debug('Resolving table node count', { tableId: parent.id })
      return await this.nodeRepository.countByTableId(parent.id)
    } catch (error) {
      this.logger.error('Error resolving table node count', { error, tableId: parent.id })
      throw error
    }
  }

  async attributeCount(parent: TableParent) {
    try {
      this.logger.debug('Resolving table attribute count', { tableId: parent.id })
      return await this.attributeRepository.countByTableId(parent.id)
    } catch (error) {
      this.logger.error('Error resolving table attribute count', { error, tableId: parent.id })
      throw error
    }
  }
}

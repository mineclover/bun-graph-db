import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { AttributeParent } from '@/presentation/graphql/types/GraphQLTypes.js'

export class AttributeFieldResolvers {
  constructor(
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly tableRepository: ITableRepository,
    private readonly logger: ILogger
  ) {}

  async attributeType(parent: AttributeParent) {
    try {
      this.logger.debug('Resolving attribute type', { attributeId: parent.id, attributeTypeId: parent.attributeTypeId })
      return await this.attributeTypeRepository.findById(parent.attributeTypeId)
    } catch (error) {
      this.logger.error('Error resolving attribute type', { error, attributeId: parent.id, attributeTypeId: parent.attributeTypeId })
      throw error
    }
  }

  async table(parent: AttributeParent) {
    try {
      this.logger.debug('Resolving attribute table', { attributeId: parent.id, tableId: parent.tableId })
      return await this.tableRepository.findById(parent.tableId)
    } catch (error) {
      this.logger.error('Error resolving attribute table', { error, attributeId: parent.id, tableId: parent.tableId })
      throw error
    }
  }

  async attribute(parent: any) {
    try {
      this.logger.debug('Resolving node attribute', { nodeAttributeId: parent.id, attributeId: parent.attributeId })
      return await this.attributeRepository.findById(parent.attributeId)
    } catch (error) {
      this.logger.error('Error resolving node attribute', { error, nodeAttributeId: parent.id, attributeId: parent.attributeId })
      throw error
    }
  }
}
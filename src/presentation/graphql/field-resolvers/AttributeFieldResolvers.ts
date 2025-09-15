import type { ILogger } from '@/application/ports/ILogger.js'
import type { AttributeParent, GraphQLContext } from '@/core/types/GraphQLTypes.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

export class AttributeFieldResolvers extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly tableRepository: ITableRepository,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  async attributeType(parent: AttributeParent, _args?: any, _context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => {
        return await this.attributeTypeRepository.findById(parent.attributeTypeId)
      },
      'attributeType',
      'Attribute',
      { attributeId: parent.id, attributeTypeId: parent.attributeTypeId }
    )
  }

  async table(parent: AttributeParent, _args?: any, _context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => {
        return await this.tableRepository.findById(parent.tableId)
      },
      'table',
      'Attribute',
      { attributeId: parent.id, tableId: parent.tableId }
    )
  }

  async attribute(parent: any, _args?: any, _context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => {
        return await this.attributeRepository.findById(parent.attributeId)
      },
      'attribute',
      'NodeAttribute',
      { nodeAttributeId: parent.id, attributeId: parent.attributeId }
    )
  }
}

import type { ILogger } from '@/application/ports/ILogger.js'
import type { GraphQLContext, TableParent } from '@/core/types/GraphQLTypes.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

export class TableFieldResolvers extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly attributeRepository: IAttributeRepository,
    private readonly nodeRepository: INodeRepository,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  async attributes(parent: TableParent, args?: any, context?: GraphQLContext) {
    return this.handleFieldResolution(async () => {
      return await this.attributeRepository.findByTableId(parent.id)
    }, 'attributes', 'Table', { tableId: parent.id })
  }

  async nodes(parent: TableParent, args?: any, context?: GraphQLContext) {
    return this.handleFieldResolution(async () => {
      const result = await this.nodeRepository.findByTableId(parent.id)
      return result.items
    }, 'nodes', 'Table', { tableId: parent.id })
  }

  async nodeCount(parent: TableParent, args?: any, context?: GraphQLContext) {
    return this.handleFieldResolution(async () => {
      return await this.nodeRepository.countByTableId(parent.id)
    }, 'nodeCount', 'Table', { tableId: parent.id })
  }

  async attributeCount(parent: TableParent, args?: any, context?: GraphQLContext) {
    return this.handleFieldResolution(async () => {
      return await this.attributeRepository.countByTableId(parent.id)
    }, 'attributeCount', 'Table', { tableId: parent.id })
  }
}

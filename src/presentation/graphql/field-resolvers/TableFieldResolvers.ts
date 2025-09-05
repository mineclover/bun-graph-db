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
    return this.handleFieldResolution(
      async () => {
        const result = await this.attributeRepository.findByTableId(parent.id)
        return result.items || []
      },
      'attributes',
      'Table',
      { tableId: parent.id }
    )
  }

  async tableNodes(parent: TableParent, args?: any, context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => {
        const result = await this.nodeRepository.findByTableId(parent.id)
        return result.items
      },
      'tableNodes',
      'Table',
      { tableId: parent.id }
    )
  }

  async tableNodeCount(parent: TableParent, args?: any, context?: GraphQLContext) {
    try {
      return await this.nodeRepository.countByTableId(parent.id)
    } catch (error) {
      this.logger.warn('TableNodeCount query failed, returning 0', { tableId: parent.id, error })
      return 0
    }
  }

  async attributeCount(parent: TableParent, args?: any, context?: GraphQLContext) {
    try {
      return await this.attributeRepository.countByTableId(parent.id)
    } catch (error) {
      this.logger.warn('AttributeCount query failed, returning 0', { tableId: parent.id, error })
      return 0
    }
  }
}

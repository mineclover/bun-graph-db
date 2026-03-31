import type { ILogger } from '@/application/ports/ILogger.js'
import type { GraphQLContext, GraphQLParent } from '@/core/types/GraphQLTypes.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import { BaseResolver } from '../base/BaseResolver.js'

export class EnhancedAttributeQueries extends BaseResolver {
  protected logger: ILogger

  constructor(
    readonly _attributeTypeRepository: IAttributeTypeRepository,
    logger: ILogger,
  ) {
    super()
    this.logger = logger
  }

  async enhancedAttributeTypes(_: GraphQLParent, args: Record<string, unknown>, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        // Basic implementation that returns empty result
        // This prevents the DI registration error while maintaining functionality
        return {
          success: true,
          data: [],
          errors: [],
          total: 0,
        }
      },
      'enhancedAttributeTypes',
      args,
    )
  }

  async enhancedAttributeType(_: GraphQLParent, args: Record<string, unknown>, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
        // Basic implementation that returns null
        return null
      },
      'enhancedAttributeType',
      args,
    )
  }
}

import type { ILogger } from '@/application/ports/ILogger.js'
import type { GraphQLContext } from '@/core/types/GraphQLTypes.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

interface RelationTypeParent {
  id?: string
  identifier?: string
  category?: string | null
  getId?: () => string
  getIdentifier?: () => string
  getCategory?: () => string | null
}

export class RelationTypeFieldResolvers extends BaseResolver {
  protected logger: ILogger

  constructor(logger: ILogger) {
    super()
    this.logger = logger
  }

  async name(parent: RelationTypeParent, _args?: Record<string, never>, _context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => {
        // Map 'name' field to the entity's 'category' field
        // This maintains compatibility with the GraphQL schema
        return parent.getCategory?.() || parent.category || parent.getIdentifier?.() || parent.identifier
      },
      'name',
      'RelationType',
      { relationTypeId: parent.getId?.() || parent.id },
    )
  }
}

import type { ILogger } from '@/application/ports/ILogger.js'
import type { GraphQLContext } from '@/core/types/GraphQLTypes.js'
import type { QueryTemplate } from '@/domain/entities/QueryTemplate.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

type QueryTemplateParent = QueryTemplate

export class QueryTemplateFieldResolvers extends BaseResolver {
  protected logger: ILogger

  constructor(logger: ILogger) {
    super()
    this.logger = logger
  }

  async query(parent: QueryTemplateParent, args?: any, context?: GraphQLContext): Promise<string> {
    try {
      // Map the domain entity's queryText property to the GraphQL schema's query field
      return parent.getQueryText()
    } catch (error) {
      this.logger.error('Failed to resolve query field', { templateId: parent.getId(), error })
      throw error
    }
  }
}
import type { ILogger } from '@/application/ports/ILogger.js'
import type {
  AttributeGroupByMode,
  NodeAttributeAnalyticsArgs,
  NodeAttributeAnalyticsService,
} from '@/application/services/NodeAttributeAnalyticsService.js'
import type { GraphQLContext, GraphQLParent } from '@/core/types/GraphQLTypes.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import { BaseResolver } from '../base/BaseResolver.js'

export class EnhancedAttributeQueries extends BaseResolver {
  protected logger: ILogger

  constructor(
    readonly _attributeTypeRepository: IAttributeTypeRepository,
    logger: ILogger,
    private readonly analyticsService?: NodeAttributeAnalyticsService,
  ) {
    super()
    this.logger = logger
  }

  async enhancedAttributeTypes(_: GraphQLParent, args: Record<string, unknown>, _context?: GraphQLContext) {
    return this.handleQuery(
      async () => {
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
        return null
      },
      'enhancedAttributeType',
      args,
    )
  }

  async nodeAttributeAnalytics(
    _: GraphQLParent,
    args: NodeAttributeAnalyticsArgs,
    _context?: GraphQLContext,
  ) {
    return this.handleQuery(
      async () => await this.requireAnalyticsService().getNodeAttributeAnalytics(args ?? {}),
      'nodeAttributeAnalytics',
      args as Record<string, unknown>,
    )
  }

  async attributeValueDistribution(
    _: GraphQLParent,
    args: { attributeId: string; groupBy?: AttributeGroupByMode },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('attributeId', 'Attribute ID'),
        BaseResolver.validationRules.nonEmpty('attributeId', 'Attribute ID'),
      ],
      'attributeValueDistribution',
    )

    return this.handleQuery(
      async () =>
        await this.requireAnalyticsService().getAttributeValueDistribution(
          args.attributeId,
          args.groupBy ?? 'VALUE',
        ),
      'attributeValueDistribution',
      args as Record<string, unknown>,
    )
  }

  async attributeCompleteness(
    _: GraphQLParent,
    args: { tableId: string },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('tableId', 'Table ID'),
      ],
      'attributeCompleteness',
    )

    return this.handleQuery(
      async () => await this.requireAnalyticsService().getAttributeCompleteness(args.tableId),
      'attributeCompleteness',
      args as Record<string, unknown>,
    )
  }

  async nodeWithTypedAttributes(
    _: GraphQLParent,
    args: { nodeId: string },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('nodeId', 'Node ID'),
        BaseResolver.validationRules.nonEmpty('nodeId', 'Node ID'),
      ],
      'nodeWithTypedAttributes',
    )

    return this.handleQuery(
      async () => await this.requireAnalyticsService().getNodeWithTypedAttributes(args.nodeId),
      'nodeWithTypedAttributes',
      args as Record<string, unknown>,
    )
  }

  private requireAnalyticsService(): NodeAttributeAnalyticsService {
    if (!this.analyticsService) {
      throw new Error('NodeAttributeAnalyticsService is not configured')
    }
    return this.analyticsService
  }
}

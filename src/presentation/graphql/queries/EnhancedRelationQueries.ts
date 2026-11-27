import type { ILogger } from '@/application/ports/ILogger.js'
import type {
  ExternalReferenceInputArgs,
  GraphAnalyticsService,
  OptimalPathInputArgs,
  PatternDiscoveryInputArgs,
  RelationAnalyticsFilterInput,
  StrengthAnalysisFilterInput,
} from '@/application/services/GraphAnalyticsService.js'
import type { GraphHierarchyService, HierarchyMode } from '@/application/services/GraphHierarchyService.js'
import type { GraphQLContext, GraphQLParent } from '@/core/types/GraphQLTypes.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

export class EnhancedRelationQueries extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly analyticsService: GraphAnalyticsService,
    logger: ILogger,
    private readonly hierarchyService?: GraphHierarchyService,
  ) {
    super()
    this.logger = logger
  }

  async relationAnalytics(
    _: GraphQLParent,
    args: { filter?: RelationAnalyticsFilterInput },
    _context?: GraphQLContext,
  ) {
    return this.handleQuery(
      async () => await this.analyticsService.getRelationAnalytics(args.filter ?? {}),
      'relationAnalytics',
      { filter: args.filter },
    )
  }

  async findOptimalPath(
    _: GraphQLParent,
    args: { input: OptimalPathInputArgs },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args.input as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('sourceNodeId', 'Source Node ID'),
        BaseResolver.validationRules.required('targetNodeId', 'Target Node ID'),
        BaseResolver.validationRules.nonEmpty('sourceNodeId', 'Source Node ID'),
        BaseResolver.validationRules.nonEmpty('targetNodeId', 'Target Node ID'),
      ],
      'findOptimalPath',
    )

    return this.handleQuery(
      async () => await this.analyticsService.findOptimalPath(args.input),
      'findOptimalPath',
      { input: args.input },
    )
  }

  async getNodeConnectivity(
    _: GraphQLParent,
    args: { nodeId: string; maxDepth?: number; minStrength?: number; minConfidence?: number },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('nodeId', 'Node ID'),
        BaseResolver.validationRules.nonEmpty('nodeId', 'Node ID'),
      ],
      'getNodeConnectivity',
    )

    return this.handleQuery(
      async () =>
        await this.analyticsService.getNodeConnectivity(
          args.nodeId,
          args.maxDepth ?? 3,
          args.minStrength ?? 1,
          args.minConfidence ?? 1,
        ),
      'getNodeConnectivity',
      args,
    )
  }

  async analyzeRelationshipStrength(
    _: GraphQLParent,
    args: { filter?: StrengthAnalysisFilterInput },
    _context?: GraphQLContext,
  ) {
    return this.handleQuery(
      async () => await this.analyticsService.analyzeRelationshipStrength(args.filter ?? {}),
      'analyzeRelationshipStrength',
      { filter: args.filter },
    )
  }

  async resolveExternalReferences(
    _: GraphQLParent,
    args: { input: ExternalReferenceInputArgs },
    _context?: GraphQLContext,
  ) {
    return this.handleQuery(
      async () => await this.analyticsService.resolveExternalReferences(args.input ?? {}),
      'resolveExternalReferences',
      { input: args.input },
    )
  }

  async discoverRelationPatterns(
    _: GraphQLParent,
    args: { input: PatternDiscoveryInputArgs },
    _context?: GraphQLContext,
  ) {
    return this.handleQuery(
      async () => await this.analyticsService.discoverRelationPatterns(args.input ?? {}),
      'discoverRelationPatterns',
      { input: args.input },
    )
  }

  async getHighConfidenceRelations(
    _: GraphQLParent,
    args: { minConfidence?: number; relationTypes?: string[]; tableIds?: string[] },
    _context?: GraphQLContext,
  ) {
    return this.handleQuery(
      async () =>
        await this.analyticsService.getHighConfidenceRelations(
          args.minConfidence ?? 3,
          args.relationTypes,
          args.tableIds,
        ),
      'getHighConfidenceRelations',
      args,
    )
  }

  async stronglyConnectedComponents(
    _: GraphQLParent,
    args: { tableId: string; relationTypes?: string[] },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('tableId', 'Table ID'),
      ],
      'stronglyConnectedComponents',
    )

    return this.handleQuery(
      async () => await this.analyticsService.getStronglyConnectedComponents(args.tableId, args.relationTypes),
      'stronglyConnectedComponents',
      args,
    )
  }

  async pageRank(
    _: GraphQLParent,
    args: {
      tableId: string
      relationTypes?: string[]
      dampingFactor?: number
      maxIterations?: number
      tolerance?: number
      limit?: number
    },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('tableId', 'Table ID'),
      ],
      'pageRank',
    )

    return this.handleQuery(
      async () =>
        await this.analyticsService.getPageRank(
          args.tableId,
          args.relationTypes,
          args.dampingFactor ?? 0.85,
          args.maxIterations ?? 100,
          args.tolerance ?? 1e-9,
          args.limit ?? 50,
        ),
      'pageRank',
      args,
    )
  }

  async getAncestors(
    _: GraphQLParent,
    args: { nodeId: string; relationTypeId?: string; maxDepth?: number },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('nodeId', 'Node ID'),
        BaseResolver.validationRules.nonEmpty('nodeId', 'Node ID'),
      ],
      'getAncestors',
    )

    return this.handleQuery(
      async () =>
        await this.requireHierarchyService().getAncestors(
          args.nodeId,
          args.relationTypeId ?? 'parentOf',
          args.maxDepth ?? 32,
        ),
      'getAncestors',
      args,
    )
  }

  async getDescendants(
    _: GraphQLParent,
    args: { nodeId: string; relationTypeId?: string; maxDepth?: number },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('nodeId', 'Node ID'),
        BaseResolver.validationRules.nonEmpty('nodeId', 'Node ID'),
      ],
      'getDescendants',
    )

    return this.handleQuery(
      async () =>
        await this.requireHierarchyService().getDescendants(
          args.nodeId,
          args.relationTypeId ?? 'parentOf',
          args.maxDepth ?? 10,
        ),
      'getDescendants',
      args,
    )
  }

  async getSubtree(
    _: GraphQLParent,
    args: { rootNodeId: string; relationTypeId?: string; maxDepth?: number },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('rootNodeId', 'Root Node ID'),
        BaseResolver.validationRules.nonEmpty('rootNodeId', 'Root Node ID'),
      ],
      'getSubtree',
    )

    return this.handleQuery(
      async () =>
        await this.requireHierarchyService().getSubtree(
          args.rootNodeId,
          args.relationTypeId ?? 'parentOf',
          args.maxDepth ?? 6,
        ),
      'getSubtree',
      args,
    )
  }

  async getHierarchyRoots(
    _: GraphQLParent,
    args: { tableId: string; relationTypeId?: string; includeIsolated?: boolean },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('tableId', 'Table ID'),
      ],
      'getHierarchyRoots',
    )

    return this.handleQuery(
      async () =>
        await this.requireHierarchyService().getHierarchyRoots(
          args.tableId,
          args.relationTypeId ?? 'parentOf',
          args.includeIsolated ?? false,
        ),
      'getHierarchyRoots',
      args,
    )
  }

  async getHierarchyLeaves(
    _: GraphQLParent,
    args: { tableId: string; relationTypeId?: string; includeIsolated?: boolean },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('tableId', 'Table ID'),
      ],
      'getHierarchyLeaves',
    )

    return this.handleQuery(
      async () =>
        await this.requireHierarchyService().getHierarchyLeaves(
          args.tableId,
          args.relationTypeId ?? 'parentOf',
          args.includeIsolated ?? false,
        ),
      'getHierarchyLeaves',
      args,
    )
  }

  async getLowestCommonAncestor(
    _: GraphQLParent,
    args: { nodeIdA: string; nodeIdB: string; relationTypeId?: string; maxDepth?: number },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('nodeIdA', 'First Node ID'),
        BaseResolver.validationRules.required('nodeIdB', 'Second Node ID'),
        BaseResolver.validationRules.nonEmpty('nodeIdA', 'First Node ID'),
        BaseResolver.validationRules.nonEmpty('nodeIdB', 'Second Node ID'),
      ],
      'getLowestCommonAncestor',
    )

    return this.handleQuery(
      async () =>
        await this.requireHierarchyService().getLowestCommonAncestor(
          args.nodeIdA,
          args.nodeIdB,
          args.relationTypeId ?? 'parentOf',
          args.maxDepth ?? 32,
        ),
      'getLowestCommonAncestor',
      args,
    )
  }

  async validateHierarchy(
    _: GraphQLParent,
    args: { tableId: string; relationTypeId?: string; mode?: HierarchyMode },
    _context?: GraphQLContext,
  ) {
    this.validateArgs(
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('tableId', 'Table ID'),
        BaseResolver.validationRules.nonEmpty('tableId', 'Table ID'),
      ],
      'validateHierarchy',
    )

    return this.handleQuery(
      async () =>
        await this.requireHierarchyService().validateHierarchy(
          args.tableId,
          args.relationTypeId ?? 'parentOf',
          args.mode ?? 'TREE',
        ),
      'validateHierarchy',
      args,
    )
  }

  private requireHierarchyService(): GraphHierarchyService {
    if (!this.hierarchyService) {
      throw new Error('GraphHierarchyService is not configured')
    }
    return this.hierarchyService
  }
}

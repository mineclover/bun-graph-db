import type { ILogger } from '@/application/ports/ILogger.js'
import type { GraphQLContext, NodeRelationParent } from '@/core/types/GraphQLTypes.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

export class RelationFieldResolvers extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly tableRepository: ITableRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly relationTypeRepository: IRelationTypeRepository,
    logger: ILogger,
  ) {
    super()
    this.logger = logger
  }

  async table(parent: NodeRelationParent, _args?: Record<string, never>, context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () => await this.withRequestCache(context, 'tableById', parent.tableId, () => this.tableRepository.findById(parent.tableId)),
      'table',
      'NodeRelation',
      { relationId: parent.id, tableId: parent.tableId },
    )
  }

  async sourceNode(parent: NodeRelationParent, _args?: Record<string, never>, context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () =>
        await this.withRequestCache(context, 'nodeById', parent.sourceNodeId, () => this.nodeRepository.findById(parent.sourceNodeId)),
      'sourceNode',
      'NodeRelation',
      { relationId: parent.id, sourceNodeId: parent.sourceNodeId },
    )
  }

  async targetNode(parent: NodeRelationParent, _args?: Record<string, never>, context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () =>
        await this.withRequestCache(context, 'nodeById', parent.targetNodeId, () => this.nodeRepository.findById(parent.targetNodeId)),
      'targetNode',
      'NodeRelation',
      { relationId: parent.id, targetNodeId: parent.targetNodeId },
    )
  }

  async relationType(parent: NodeRelationParent, _args?: Record<string, never>, context?: GraphQLContext) {
    return this.handleFieldResolution(
      async () =>
        await this.withRequestCache(context, 'relationTypeById', parent.relationTypeId, () =>
          this.relationTypeRepository.findById(parent.relationTypeId),
        ),
      'relationType',
      'NodeRelation',
      { relationId: parent.id, relationTypeId: parent.relationTypeId },
    )
  }
}

import type { ILogger } from '@/application/ports/ILogger.js'
import type { CreateRelationUseCase } from '@/application/use-cases/relations/CreateRelation.js'
import type { CreateRelationTypeUseCase } from '@/application/use-cases/relations/CreateRelationType.js'
import type {
  CreateRelationArgs,
  CreateRelationTypeArgs,
  DeleteRelationArgs,
  GraphQLContext,
  GraphQLParent,
} from '@/core/types/GraphQLTypes.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'

export class RelationMutations extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly createRelationUseCase: CreateRelationUseCase,
    private readonly createRelationTypeUseCase: CreateRelationTypeUseCase,
    private readonly nodeRelationRepository: INodeRelationRepository,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  async createRelationType(
    _: GraphQLParent,
    args: CreateRelationTypeArgs,
    context?: GraphQLContext
  ) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('input', 'Create relation type input'),
        BaseResolver.validationRules.required('input.identifier', 'Relation type identifier'),
        BaseResolver.validationRules.required('input.name', 'Relation type name'),
        BaseResolver.validationRules.nonEmpty('input.identifier', 'Relation type identifier'),
        BaseResolver.validationRules.nonEmpty('input.name', 'Relation type name'),
      ],
      'createRelationType'
    )

    return this.handleMutation(
      async () => {
        const result = await this.createRelationTypeUseCase.execute({
          identifier: args.input.identifier,
          name: args.input.name,
          description: args.input.description,
        })

        return result
      },
      'createRelationType',
      { input: args.input }
    )
  }

  async createRelation(_: GraphQLParent, args: CreateRelationArgs, context?: GraphQLContext) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('input', 'Create relation input'),
        BaseResolver.validationRules.required('input.sourceNodeId', 'Source node ID'),
        BaseResolver.validationRules.required('input.targetNodeId', 'Target node ID'),
        BaseResolver.validationRules.required('input.relationTypeId', 'Relation type ID'),
        BaseResolver.validationRules.nonEmpty('input.sourceNodeId', 'Source node ID'),
        BaseResolver.validationRules.nonEmpty('input.targetNodeId', 'Target node ID'),
        BaseResolver.validationRules.nonEmpty('input.relationTypeId', 'Relation type ID'),
      ],
      'createRelation'
    )

    return this.handleMutation(
      async () => {
        const result = await this.createRelationUseCase.execute({
          sourceNodeId: args.input.sourceNodeId,
          targetNodeId: args.input.targetNodeId,
          relationTypeId: args.input.relationTypeId,
        })

        return result
      },
      'createRelation',
      { input: args.input }
    )
  }

  async deleteRelation(_: GraphQLParent, args: DeleteRelationArgs, context?: GraphQLContext) {
    this.validateArgs(
      args,
      [
        BaseResolver.validationRules.required('id', 'Relation ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Relation ID'),
      ],
      'deleteRelation'
    )

    return this.handleMutation(
      async () => {
        const existingRelation = await this.nodeRelationRepository.findById(args.id)
        if (!existingRelation) {
          throw new Error('Relation not found')
        }

        await this.nodeRelationRepository.delete(args.id)

        return true
      },
      'deleteRelation',
      { id: args.id }
    )
  }
}

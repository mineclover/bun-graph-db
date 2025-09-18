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
import { ConflictException, ValidationException, NotFoundException } from '@/shared/exceptions/DomainException.js'

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
    _context?: GraphQLContext
  ) {
    try {
      this.validateArgs(
        args as any,
        [
          BaseResolver.validationRules.required('input', 'Create relation type input'),
          BaseResolver.validationRules.required('input.identifier', 'Relation type identifier'),
          BaseResolver.validationRules.required('input.name', 'Relation type name'),
          BaseResolver.validationRules.nonEmpty('input.identifier', 'Relation type identifier'),
          BaseResolver.validationRules.nonEmpty('input.name', 'Relation type name'),
        ],
        'createRelationType'
      )

      this.logger.info('Executing mutation: createRelationType', { input: args.input })

      const result = await this.createRelationTypeUseCase.execute({
        identifier: args.input.identifier,
        description: args.input.description,
        category: args.input.name, // Map name to category for now
      })

      return {
        success: true,
        relationType: {
          ...result.relationType,
          name: args.input.name, // Add the name field from input
        },
        errors: []
      }
    } catch (error) {
      this.logger.error('Mutation failed: createRelationType', { error, input: args.input })

      return {
        success: false,
        relationType: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          }
        ]
      }
    }
  }

  async createRelation(_: GraphQLParent, args: CreateRelationArgs, _context?: GraphQLContext) {
    try {
      this.validateArgs(
        args as any,
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

      this.logger.info('Executing mutation: createRelation', { input: args.input })

      const result = await this.createRelationUseCase.execute({
        tableId: args.input.tableId,
        sourceNodeId: args.input.sourceNodeId,
        targetNodeId: args.input.targetNodeId,
        relationTypeId: args.input.relationTypeId,
      })

      return {
        success: true,
        relation: result.relation,
        errors: []
      }
    } catch (error) {
      this.logger.error('Mutation failed: createRelation', { error, input: args.input })

      // Handle specific domain exceptions
      if (error instanceof ConflictException) {
        return {
          success: false,
          relation: null,
          errors: [
            {
              message: error.message,
              code: 'CONFLICT',
            }
          ]
        }
      }

      if (error instanceof ValidationException) {
        return {
          success: false,
          relation: null,
          errors: [
            {
              message: error.message,
              code: 'VALIDATION_ERROR',
            }
          ]
        }
      }

      if (error instanceof NotFoundException) {
        return {
          success: false,
          relation: null,
          errors: [
            {
              message: error.message,
              code: 'NOT_FOUND',
            }
          ]
        }
      }

      return {
        success: false,
        relation: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          }
        ]
      }
    }
  }

  async deleteRelation(_: GraphQLParent, args: DeleteRelationArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as any,
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

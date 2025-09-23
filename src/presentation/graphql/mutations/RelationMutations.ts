import type { ILogger } from '@/application/ports/ILogger.js'
import type { CreateRelationUseCase } from '@/application/use-cases/relations/CreateRelation.js'
import type { CreateRelationTypeUseCase } from '@/application/use-cases/relations/CreateRelationType.js'
import type {
  CreateRelationArgs,
  CreateRelationTypeArgs,
  DeleteRelationArgs,
  GraphQLContext,
  GraphQLParent,
  MutationDeleteRelationTypeArgs,
  MutationUpdateRelationTypeArgs,
} from '@/core/types/GraphQLTypes.js'
import { RelationType } from '@/domain/entities/RelationType.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '@/shared/exceptions/DomainException.js'

export class RelationMutations extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly createRelationUseCase: CreateRelationUseCase,
    private readonly createRelationTypeUseCase: CreateRelationTypeUseCase,
    private readonly nodeRelationRepository: INodeRelationRepository,
    private readonly relationTypeRepository: IRelationTypeRepository,
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
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: createRelationType', {
        input: args.input,
        ...toErrorMeta(error),
      })

      return {
        success: false,
        relationType: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          },
        ],
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
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: createRelation', {
        input: args.input,
        ...toErrorMeta(error),
      })

      // Handle specific domain exceptions
      if (error instanceof ConflictException) {
        return {
          success: false,
          relation: null,
          errors: [
            {
              message: error.message,
              code: 'CONFLICT',
            },
          ],
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
            },
          ],
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
            },
          ],
        }
      }

      return {
        success: false,
        relation: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  async updateRelationType(
    _: GraphQLParent,
    args: MutationUpdateRelationTypeArgs,
    _context?: GraphQLContext
  ) {
    try {
      this.validateArgs(
        args as any,
        [
          BaseResolver.validationRules.required('id', 'Relation type ID'),
          BaseResolver.validationRules.required('input', 'Update relation type input'),
          BaseResolver.validationRules.nonEmpty('id', 'Relation type ID'),
        ],
        'updateRelationType'
      )

      this.logger.info('Executing mutation: updateRelationType', { id: args.id, input: args.input })

      const existingRelationType = await this.relationTypeRepository.findById(args.id)
      if (!existingRelationType) {
        throw new NotFoundException('Relation type not found')
      }

      // Create updated RelationType entity
      const updatedRelationType = RelationType.fromDatabase(
        existingRelationType.getId()!,
        existingRelationType.getIdentifier(),
        args.input.description !== undefined
          ? args.input.description
          : existingRelationType.getDescription(),
        args.input.name || existingRelationType.getCategory(),
        existingRelationType.getCreatedAt(),
        new Date() // Update timestamp
      )

      await this.relationTypeRepository.update(updatedRelationType)

      return {
        success: true,
        relationType: {
          id: updatedRelationType.getId(),
          identifier: updatedRelationType.getIdentifier(),
          description: updatedRelationType.getDescription(),
          category: updatedRelationType.getCategory(),
          name: updatedRelationType.getCategory(),
          createdAt: updatedRelationType.getCreatedAt(),
          updatedAt: updatedRelationType.getUpdatedAt(),
        },
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: updateRelationType', {
        id: args.id,
        input: args.input,
        ...toErrorMeta(error),
      })

      if (error instanceof NotFoundException) {
        return {
          success: false,
          relationType: null,
          errors: [
            {
              message: error.message,
              code: 'NOT_FOUND',
            },
          ],
        }
      }

      if (error instanceof ValidationException) {
        return {
          success: false,
          relationType: null,
          errors: [
            {
              message: error.message,
              code: 'VALIDATION_ERROR',
            },
          ],
        }
      }

      return {
        success: false,
        relationType: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  async deleteRelationType(
    _: GraphQLParent,
    args: MutationDeleteRelationTypeArgs,
    _context?: GraphQLContext
  ) {
    try {
      this.validateArgs(
        args as any,
        [
          BaseResolver.validationRules.required('id', 'Relation type ID'),
          BaseResolver.validationRules.nonEmpty('id', 'Relation type ID'),
        ],
        'deleteRelationType'
      )

      this.logger.info('Executing mutation: deleteRelationType', { id: args.id })

      const existingRelationType = await this.relationTypeRepository.findById(args.id)
      if (!existingRelationType) {
        throw new NotFoundException('Relation type not found')
      }

      await this.relationTypeRepository.delete(args.id)

      return {
        success: true,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: deleteRelationType', {
        id: args.id,
        ...toErrorMeta(error),
      })

      if (error instanceof NotFoundException) {
        return {
          success: false,
          errors: [
            {
              message: error.message,
              code: 'NOT_FOUND',
            },
          ],
        }
      }

      return {
        success: false,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          },
        ],
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

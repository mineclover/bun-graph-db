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
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import { BaseResolver } from '@/presentation/graphql/base/BaseResolver.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'
import { ConflictException, NotFoundException, ValidationException } from '@/shared/exceptions/DomainException.js'
import { sanitizeJsonValue, type SafeJsonValue } from '@/shared/utils/safeJson.js'

export class RelationMutations extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly createRelationUseCase: CreateRelationUseCase,
    private readonly createRelationTypeUseCase: CreateRelationTypeUseCase,
    private readonly nodeRelationRepository: INodeRelationRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly relationTypeRepository: IRelationTypeRepository,
    logger: ILogger,
  ) {
    super()
    this.logger = logger
  }

  async createRelationType(_: GraphQLParent, args: CreateRelationTypeArgs, _context?: GraphQLContext) {
    try {
      this.validateArgs(
        args as unknown as Record<string, unknown>,
        [
          BaseResolver.validationRules.required('input', 'Create relation type input'),
          BaseResolver.validationRules.required('input.identifier', 'Relation type identifier'),
          BaseResolver.validationRules.nonEmpty('input.identifier', 'Relation type identifier'),
        ],
        'createRelationType',
      )

      this.logger.info('Executing mutation: createRelationType', { input: args.input })

      const result = await this.createRelationTypeUseCase.execute({
        identifier: args.input.identifier,
        description: args.input.description,
        category: args.input.name || args.input.identifier, // Map name to category for now
      })

      return {
        success: true,
        relationType: {
          ...result.relationType,
          name: args.input.name || args.input.identifier, // Add the name field from input
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
      const sourceNodeId = args.input.sourceNodeId || args.input.fromNodeId
      const targetNodeId = args.input.targetNodeId || args.input.toNodeId
      let resolvedRelationTypeId =
        args.input.relationTypeId ||
        (args.input.relationshipType
          ? (await this.relationTypeRepository.findByIdentifier(args.input.relationshipType))?.getId() || undefined
          : undefined)

      if (!resolvedRelationTypeId && args.input.relationshipType) {
        try {
          const createdRelationType = await this.createRelationTypeUseCase.execute({
            identifier: args.input.relationshipType,
            category: args.input.relationshipType,
          })
          resolvedRelationTypeId = createdRelationType.relationType.id
        } catch {
          resolvedRelationTypeId =
            (await this.relationTypeRepository.findByIdentifier(args.input.relationshipType))?.getId() || undefined
        }
      }
      const resolvedTableId =
        args.input.tableId || (sourceNodeId ? (await this.nodeRepository.findById(sourceNodeId))?.getTableId() : undefined)

      this.validateArgs(
        {
          ...args,
          input: {
            ...args.input,
            tableId: resolvedTableId,
            sourceNodeId,
            targetNodeId,
            relationTypeId: resolvedRelationTypeId,
          },
        } as Record<string, unknown>,
        [
          BaseResolver.validationRules.required('input', 'Create relation input'),
          BaseResolver.validationRules.required('input.sourceNodeId', 'Source node ID'),
          BaseResolver.validationRules.required('input.targetNodeId', 'Target node ID'),
          BaseResolver.validationRules.required('input.relationTypeId', 'Relation type ID'),
          BaseResolver.validationRules.nonEmpty('input.sourceNodeId', 'Source node ID'),
          BaseResolver.validationRules.nonEmpty('input.targetNodeId', 'Target node ID'),
          BaseResolver.validationRules.nonEmpty('input.relationTypeId', 'Relation type ID'),
        ],
        'createRelation',
      )

      if (!resolvedTableId || !resolvedRelationTypeId) {
        throw new ValidationException('Table ID and relation type ID are required')
      }

      this.logger.info('Executing mutation: createRelation', { input: args.input })

      const result = await this.createRelationUseCase.execute({
        tableId: resolvedTableId,
        sourceNodeId,
        targetNodeId,
        relationTypeId: resolvedRelationTypeId,
        properties: args.input.properties
          ? (sanitizeJsonValue(args.input.properties) as Record<string, SafeJsonValue>)
          : undefined,
        strength: args.input.strength,
      })

      return {
        success: true,
        relation: {
          ...result.relation,
          fromNodeId: sourceNodeId,
          toNodeId: targetNodeId,
          relationshipType: args.input.relationshipType || resolvedRelationTypeId,
        },
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

  async updateRelationType(_: GraphQLParent, args: MutationUpdateRelationTypeArgs, _context?: GraphQLContext) {
    try {
      this.validateArgs(
        args as unknown as Record<string, unknown>,
        [
          BaseResolver.validationRules.required('id', 'Relation type ID'),
          BaseResolver.validationRules.required('input', 'Update relation type input'),
          BaseResolver.validationRules.nonEmpty('id', 'Relation type ID'),
        ],
        'updateRelationType',
      )

      this.logger.info('Executing mutation: updateRelationType', { id: args.id, input: args.input })

      const existingRelationType = await this.relationTypeRepository.findById(args.id)
      if (!existingRelationType) {
        throw new NotFoundException('Relation type not found')
      }

      const existingRelationTypeId = existingRelationType.getId()
      if (!existingRelationTypeId) {
        throw new ValidationException('Relation type ID is required')
      }

      // Create updated RelationType entity
      const updatedRelationType = RelationType.fromDatabase(
        existingRelationTypeId,
        existingRelationType.getIdentifier(),
        args.input.description !== undefined ? args.input.description : existingRelationType.getDescription(),
        args.input.name || existingRelationType.getCategory(),
        existingRelationType.getCreatedAt(),
        new Date(), // Update timestamp
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

  async batchCreateRelations(
    _: GraphQLParent,
    args: {
      relations: Array<
        CreateRelationArgs['input'] & {
          fromNodeId?: string
          toNodeId?: string
          relationshipType?: string
        }
      >
    },
  ) {
    const results: Array<{ relation: Record<string, unknown> | null; errors: string[] }> = []
    let totalCreated = 0
    let totalFailed = 0

    for (const relationInput of args.relations || []) {
      try {
        if (relationInput.relationshipType && !relationInput.relationTypeId) {
          let relationType = await this.relationTypeRepository.findByIdentifier(relationInput.relationshipType)
          if (!relationType) {
            try {
              const createdRelationType = await this.createRelationTypeUseCase.execute({
                identifier: relationInput.relationshipType,
                description: `${relationInput.relationshipType} relation`,
                category: relationInput.relationshipType,
              })
              relationType = await this.relationTypeRepository.findById(createdRelationType.relationType.id)
            } catch {
              relationType = await this.relationTypeRepository.findByIdentifier(relationInput.relationshipType)
            }
          }

          relationInput.relationTypeId = relationType?.getId()
        }

        const result = await this.createRelation(_, { input: relationInput })
        if (result.success && result.relation) {
          totalCreated++
          let relationshipType = relationInput.relationshipType || relationInput.relationTypeId
          if (result.relation.relationTypeId && !relationInput.relationshipType) {
            const relationType = await this.relationTypeRepository.findById(result.relation.relationTypeId)
            relationshipType = relationType?.getIdentifier() || result.relation.relationTypeId
          }
          results.push({
            relation: {
              id: result.relation.id,
              fromNodeId: relationInput.fromNodeId || relationInput.sourceNodeId || result.relation.sourceNodeId,
              toNodeId: relationInput.toNodeId || relationInput.targetNodeId || result.relation.targetNodeId,
              relationshipType,
              tableId: relationInput.tableId || result.relation.tableId,
            },
            errors: [],
          })
        } else {
          totalFailed++
          results.push({
            relation: null,
            errors: (result.errors || []).map((error) => error.message),
          })
        }
      } catch (error) {
        totalFailed++
        results.push({
          relation: null,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        })
      }
    }

    return {
      success: totalFailed === 0,
      results,
      totalCreated,
      totalFailed,
    }
  }

  async deleteRelationType(_: GraphQLParent, args: MutationDeleteRelationTypeArgs, _context?: GraphQLContext) {
    try {
      this.validateArgs(
        args as unknown as Record<string, unknown>,
        [
          BaseResolver.validationRules.required('id', 'Relation type ID'),
          BaseResolver.validationRules.nonEmpty('id', 'Relation type ID'),
        ],
        'deleteRelationType',
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
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('id', 'Relation ID'),
        BaseResolver.validationRules.nonEmpty('id', 'Relation ID'),
      ],
      'deleteRelation',
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
      { id: args.id },
    )
  }
}

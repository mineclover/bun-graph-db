import type { CreateRelationUseCase } from '@/application/use-cases/relations/CreateRelation.js'
import type { CreateRelationTypeUseCase } from '@/application/use-cases/relations/CreateRelationType.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { 
  GraphQLParent,
  CreateRelationTypeArgs,
  CreateRelationArgs,
  DeleteRelationArgs
} from '@/core/types/GraphQLTypes.js'

export class RelationMutations {
  constructor(
    private readonly createRelationUseCase: CreateRelationUseCase,
    private readonly createRelationTypeUseCase: CreateRelationTypeUseCase,
    private readonly nodeRelationRepository: INodeRelationRepository,
    private readonly logger: ILogger
  ) {}

  async createRelationType(_: GraphQLParent, args: CreateRelationTypeArgs) {
    try {
      this.logger.info('Creating relation type', { input: args.input })
      
      const result = await this.createRelationTypeUseCase.execute({
        identifier: args.input.identifier,
        name: args.input.name,
        description: args.input.description
      })

      return {
        success: !!result,
        relationType: result,
        errors: []
      }
    } catch (error) {
      this.logger.error('Error creating relation type', { error, input: args.input })
      return {
        success: false,
        relationType: null,
        errors: [{ message: error.message, code: 'CREATE_RELATION_TYPE_ERROR' }]
      }
    }
  }

  async createRelation(_: GraphQLParent, args: CreateRelationArgs) {
    try {
      this.logger.info('Creating relation', { input: args.input })
      
      const result = await this.createRelationUseCase.execute({
        sourceNodeId: args.input.sourceNodeId,
        targetNodeId: args.input.targetNodeId,
        relationTypeId: args.input.relationTypeId
      })

      return {
        success: !!result,
        relation: result,
        errors: []
      }
    } catch (error) {
      this.logger.error('Error creating relation', { error, input: args.input })
      return {
        success: false,
        relation: null,
        errors: [{ message: error.message, code: 'CREATE_RELATION_ERROR' }]
      }
    }
  }

  async deleteRelation(_: GraphQLParent, args: DeleteRelationArgs) {
    try {
      this.logger.info('Deleting relation', { id: args.id })
      
      const existingRelation = await this.nodeRelationRepository.findById(args.id)
      if (!existingRelation) {
        return {
          success: false,
          errors: [{ message: 'Relation not found', code: 'RELATION_NOT_FOUND' }]
        }
      }

      await this.nodeRelationRepository.delete(args.id)

      return {
        success: true,
        errors: []
      }
    } catch (error) {
      this.logger.error('Error deleting relation', { error, id: args.id })
      return {
        success: false,
        errors: [{ message: error.message, code: 'DELETE_RELATION_ERROR' }]
      }
    }
  }
}
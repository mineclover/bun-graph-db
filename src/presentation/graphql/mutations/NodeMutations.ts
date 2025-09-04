import type { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { 
  GraphQLParent,
  CreateNodeArgs,
  UpdateNodeArgs,
  DeleteNodeArgs,
  SetNodeAttributeArgs
} from '@/presentation/graphql/types/GraphQLTypes.js'

export class NodeMutations {
  constructor(
    private readonly createNodeUseCase: CreateNodeUseCase,
    private readonly nodeRepository: INodeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly logger: ILogger
  ) {}

  async createNode(_: GraphQLParent, args: CreateNodeArgs) {
    try {
      this.logger.info('Creating node', { input: args.input })
      
      const result = await this.createNodeUseCase.execute({
        content: args.input.content,
        tableId: args.input.tableId,
        attributes: args.input.attributes || []
      })

      return {
        success: !!result,
        node: result,
        errors: []
      }
    } catch (error) {
      this.logger.error('Error creating node', { error, input: args.input })
      return {
        success: false,
        node: null,
        errors: [{ message: error.message, code: 'CREATE_NODE_ERROR' }]
      }
    }
  }

  async updateNode(_: GraphQLParent, args: UpdateNodeArgs) {
    try {
      this.logger.info('Updating node', { id: args.id, input: args.input })
      
      const existingNode = await this.nodeRepository.findById(args.id)
      if (!existingNode) {
        return {
          success: false,
          node: null,
          errors: [{ message: 'Node not found', code: 'NODE_NOT_FOUND' }]
        }
      }

      const updatedNode = await this.nodeRepository.update(args.id, {
        content: args.input.content
      })

      return {
        success: !!updatedNode,
        node: updatedNode,
        errors: []
      }
    } catch (error) {
      this.logger.error('Error updating node', { error, id: args.id, input: args.input })
      return {
        success: false,
        node: null,
        errors: [{ message: error.message, code: 'UPDATE_NODE_ERROR' }]
      }
    }
  }

  async deleteNode(_: GraphQLParent, args: DeleteNodeArgs) {
    try {
      this.logger.info('Deleting node', { id: args.id })
      
      const existingNode = await this.nodeRepository.findById(args.id)
      if (!existingNode) {
        return {
          success: false,
          errors: [{ message: 'Node not found', code: 'NODE_NOT_FOUND' }]
        }
      }

      await this.nodeRepository.delete(args.id)

      return {
        success: true,
        errors: []
      }
    } catch (error) {
      this.logger.error('Error deleting node', { error, id: args.id })
      return {
        success: false,
        errors: [{ message: error.message, code: 'DELETE_NODE_ERROR' }]
      }
    }
  }

  async setNodeAttribute(_: GraphQLParent, args: SetNodeAttributeArgs) {
    try {
      this.logger.info('Setting node attribute', { input: args.input })
      
      const result = await this.nodeAttributeRepository.setNodeAttribute(
        args.input.nodeId,
        args.input.attributeId,
        args.input.value
      )

      return {
        success: !!result,
        nodeAttribute: result,
        errors: []
      }
    } catch (error) {
      this.logger.error('Error setting node attribute', { error, input: args.input })
      return {
        success: false,
        nodeAttribute: null,
        errors: [{ message: error.message, code: 'SET_NODE_ATTRIBUTE_ERROR' }]
      }
    }
  }
}
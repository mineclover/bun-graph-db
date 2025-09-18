import type { ILogger } from '@/application/ports/ILogger.js'
import type { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import type {
  CreateNodeArgs,
  DeleteNodeArgs,
  GraphQLContext,
  GraphQLParent,
  SetNodeAttributeArgs,
  UpdateNodeArgs,
} from '@/core/types/GraphQLTypes.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { BaseResolver } from '../base/BaseResolver.js'

export class NodeMutations extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly createNodeUseCase: CreateNodeUseCase | null,
    private readonly nodeRepository: INodeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly tableRepository: ITableRepository,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  async createNode(_: GraphQLParent, args: CreateNodeArgs, _context?: GraphQLContext) {
    try {
      this.validateArgs(
        args as any,
        [
          BaseResolver.validationRules.required('input', 'Create node input'),
          BaseResolver.validationRules.required('input.content', 'Node content'),
          BaseResolver.validationRules.required('input.tableId', 'Table ID'),
          BaseResolver.validationRules.nonEmpty('input.content', 'Node content'),
          BaseResolver.validationRules.nonEmpty('input.tableId', 'Table ID'),
        ],
        'createNode'
      )

      this.logger.info('Executing mutation: createNode', { input: args.input })

      // Fallback implementation when CreateNodeUseCase is not available
      if (!this.createNodeUseCase) {
        this.logger.warn('CreateNodeUseCase not available, using fallback implementation')

        // First, validate that the table exists
        const table = await this.tableRepository.findById(args.input.tableId)
        if (!table) {
          throw new Error(`Table with ID ${args.input.tableId} not found`)
        }

        // Import the Node entity for direct creation
        const { Node } = await import('@/domain/entities/Node.js')

        // Create the node directly using the repository
        const node = Node.create(
          args.input.tableId, // tableId first
          args.input.content  // content second
        )

        // Save the node
        await this.nodeRepository.save(node)

        // Fetch the saved node back to get the ID
        const savedNode = await this.nodeRepository.findByTableIdAndContent(
          args.input.tableId,
          args.input.content
        )

        if (!savedNode) {
          throw new Error('Failed to retrieve saved node')
        }

        // Import the NodeDto for proper formatting
        const { NodeDto } = await import('@/application/dtos/NodeDto.js')

        // Return the expected GraphQL structure
        return {
          success: true,
          node: NodeDto.fromEntity(savedNode),
          errors: []
        }
      }

      const result = await this.createNodeUseCase.execute({
        content: args.input.content,
        tableId: args.input.tableId,
        attributes: args.input.attributes || [],
      })

      return {
        success: true,
        node: result.node,
        errors: []
      }
    } catch (error) {
      this.logger.error('Mutation failed: createNode', { error, input: args.input })

      return {
        success: false,
        node: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          }
        ]
      }
    }
  }

  async updateNode(_: GraphQLParent, args: UpdateNodeArgs, _context?: GraphQLContext) {
    try {
      this.validateArgs(
        args as any,
        [
          BaseResolver.validationRules.required('id', 'Node ID'),
          BaseResolver.validationRules.required('input', 'Update node input'),
          BaseResolver.validationRules.required('input.content', 'Node content'),
          BaseResolver.validationRules.nonEmpty('id', 'Node ID'),
          BaseResolver.validationRules.nonEmpty('input.content', 'Node content'),
        ],
        'updateNode'
      )

      this.logger.info('Executing mutation: updateNode', { id: args.id, input: args.input })

      const existingNode = await this.nodeRepository.findById(args.id)
      if (!existingNode) {
        throw new Error('Node not found')
      }

      const updatedNode = await this.nodeRepository.update(args.id, {
        content: args.input.content,
      })

      if (!updatedNode) {
        throw new Error('Failed to update node')
      }

      // Import the NodeDto for proper formatting
      const { NodeDto } = await import('@/application/dtos/NodeDto.js')

      return {
        success: true,
        node: NodeDto.fromEntity(updatedNode),
        errors: []
      }
    } catch (error) {
      this.logger.error('Mutation failed: updateNode', { error, id: args.id, input: args.input })

      return {
        success: false,
        node: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          }
        ]
      }
    }
  }

  async deleteNode(_: GraphQLParent, args: DeleteNodeArgs, _context?: GraphQLContext) {
    try {
      this.validateArgs(
        args as any,
        [
          BaseResolver.validationRules.required('id', 'Node ID'),
          BaseResolver.validationRules.nonEmpty('id', 'Node ID'),
        ],
        'deleteNode'
      )

      this.logger.info('Executing mutation: deleteNode', { id: args.id })

      const existingNode = await this.nodeRepository.findById(args.id)
      if (!existingNode) {
        throw new Error('Node not found')
      }

      await this.nodeRepository.delete(args.id)

      return {
        success: true,
        errors: []
      }
    } catch (error) {
      this.logger.error('Mutation failed: deleteNode', { error, id: args.id })

      return {
        success: false,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          }
        ]
      }
    }
  }

  async setNodeAttribute(_: GraphQLParent, args: SetNodeAttributeArgs, _context?: GraphQLContext) {
    this.validateArgs(
      args as any,
      [
        BaseResolver.validationRules.required('input', 'Set node attribute input'),
        BaseResolver.validationRules.required('input.nodeId', 'Node ID'),
        BaseResolver.validationRules.required('input.attributeId', 'Attribute ID'),
        BaseResolver.validationRules.required('input.value', 'Attribute value'),
        BaseResolver.validationRules.nonEmpty('input.nodeId', 'Node ID'),
        BaseResolver.validationRules.nonEmpty('input.attributeId', 'Attribute ID'),
      ],
      'setNodeAttribute'
    )

    return this.handleMutation(
      async () => {
        const result = await this.nodeAttributeRepository.setNodeAttribute(
          args.input.nodeId,
          args.input.attributeId,
          args.input.value
        )

        return result
      },
      'setNodeAttribute',
      { input: args.input }
    )
  }
}

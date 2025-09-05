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
import { BaseResolver } from '../base/BaseResolver.js'

export class NodeMutations extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly createNodeUseCase: CreateNodeUseCase,
    private readonly nodeRepository: INodeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    logger: ILogger
  ) {
    super()
    this.logger = logger
  }

  async createNode(_: GraphQLParent, args: CreateNodeArgs, context?: GraphQLContext) {
    this.validateArgs(args, [
      BaseResolver.validationRules.required('input', 'Create node input'),
      BaseResolver.validationRules.required('input.content', 'Node content'),
      BaseResolver.validationRules.required('input.tableId', 'Table ID'),
      BaseResolver.validationRules.nonEmpty('input.content', 'Node content'),
      BaseResolver.validationRules.nonEmpty('input.tableId', 'Table ID')
    ], 'createNode')

    return this.handleMutation(async () => {
      const result = await this.createNodeUseCase.execute({
        content: args.input.content,
        tableId: args.input.tableId,
        attributes: args.input.attributes || [],
      })

      return result
    }, 'createNode', { input: args.input })
  }

  async updateNode(_: GraphQLParent, args: UpdateNodeArgs, context?: GraphQLContext) {
    this.validateArgs(args, [
      BaseResolver.validationRules.required('id', 'Node ID'),
      BaseResolver.validationRules.required('input', 'Update node input'),
      BaseResolver.validationRules.required('input.content', 'Node content'),
      BaseResolver.validationRules.nonEmpty('id', 'Node ID'),
      BaseResolver.validationRules.nonEmpty('input.content', 'Node content')
    ], 'updateNode')

    return this.handleMutation(async () => {
      const existingNode = await this.nodeRepository.findById(args.id)
      if (!existingNode) {
        throw new Error('Node not found')
      }

      const updatedNode = await this.nodeRepository.update(args.id, {
        content: args.input.content,
      })

      return updatedNode
    }, 'updateNode', { id: args.id, input: args.input })
  }

  async deleteNode(_: GraphQLParent, args: DeleteNodeArgs, context?: GraphQLContext) {
    this.validateArgs(args, [
      BaseResolver.validationRules.required('id', 'Node ID'),
      BaseResolver.validationRules.nonEmpty('id', 'Node ID')
    ], 'deleteNode')

    return this.handleMutation(async () => {
      const existingNode = await this.nodeRepository.findById(args.id)
      if (!existingNode) {
        throw new Error('Node not found')
      }

      await this.nodeRepository.delete(args.id)

      return true
    }, 'deleteNode', { id: args.id })
  }

  async setNodeAttribute(_: GraphQLParent, args: SetNodeAttributeArgs, context?: GraphQLContext) {
    this.validateArgs(args, [
      BaseResolver.validationRules.required('input', 'Set node attribute input'),
      BaseResolver.validationRules.required('input.nodeId', 'Node ID'),
      BaseResolver.validationRules.required('input.attributeId', 'Attribute ID'),
      BaseResolver.validationRules.required('input.value', 'Attribute value'),
      BaseResolver.validationRules.nonEmpty('input.nodeId', 'Node ID'),
      BaseResolver.validationRules.nonEmpty('input.attributeId', 'Attribute ID')
    ], 'setNodeAttribute')

    return this.handleMutation(async () => {
      const result = await this.nodeAttributeRepository.setNodeAttribute(
        args.input.nodeId,
        args.input.attributeId,
        args.input.value
      )

      return result
    }, 'setNodeAttribute', { input: args.input })
  }
}

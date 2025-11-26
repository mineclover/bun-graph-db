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

interface CreatePersonNodeInput {
  content: string
  name: string
  age: string
  testName?: string
}

interface CreateNodeWithAttributesInput {
  content: string
  tableId: string
  attributesByIdentifier: AttributeByIdentifierInput[]
}

interface AttributeByIdentifierInput {
  identifier: string
  value: string
}

interface SetNodeAttributesInput {
  nodeId: string
  attributes: NodeAttributeInput[]
}

interface SetNodeAttributesByIdentifierInput {
  nodeId: string
  attributesByIdentifier: AttributeByIdentifierInput[]
}

interface NodeAttributeInput {
  attributeId: string
  value: string
}

import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'
import { BaseResolver } from '../base/BaseResolver.js'

export class NodeMutations extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly createNodeUseCase: CreateNodeUseCase | null,
    private readonly nodeRepository: INodeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly tableRepository: ITableRepository,
    private readonly attributeRepository: IAttributeRepository,
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
          args.input.content // content second
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
        const { fromEntity: nodeFromEntity } = await import('@/application/dtos/NodeDto.js')

        // Return the expected GraphQL structure
        return {
          success: true,
          node: nodeFromEntity(savedNode),
          errors: [],
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
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: createNode', { input: args.input, ...toErrorMeta(error) })

      return {
        success: false,
        node: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          },
        ],
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
      const { fromEntity: nodeFromEntity } = await import('@/application/dtos/NodeDto.js')

      return {
        success: true,
        node: nodeFromEntity(updatedNode),
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: updateNode', {
        id: args.id,
        input: args.input,
        ...toErrorMeta(error),
      })

      return {
        success: false,
        node: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          },
        ],
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
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: deleteNode', { id: args.id, ...toErrorMeta(error) })

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

    const mutationResult = await this.handleMutation(
      async () => {
        const result = await this.nodeAttributeRepository.setNodeAttribute(
          args.input.nodeId,
          args.input.attributeId,
          args.input.value
        )

        // Transform domain entity to DTO
        const { nodeAttributeFromEntity } = await import('@/application/dtos/NodeDto.js')
        return nodeAttributeFromEntity(result)
      },
      'setNodeAttribute',
      { input: args.input }
    )

    // Transform handleMutation result to GraphQL schema format
    return {
      success: mutationResult.success,
      nodeAttribute: mutationResult.data,
      errors: mutationResult.errors || [],
    }
  }

  async removeNodeAttribute(
    _: GraphQLParent,
    args: { nodeId: string; attributeId: string },
    _context?: GraphQLContext
  ) {
    try {
      this.validateArgs(
        args as any,
        [
          BaseResolver.validationRules.required('nodeId', 'Node ID'),
          BaseResolver.validationRules.required('attributeId', 'Attribute ID'),
          BaseResolver.validationRules.nonEmpty('nodeId', 'Node ID'),
          BaseResolver.validationRules.nonEmpty('attributeId', 'Attribute ID'),
        ],
        'removeNodeAttribute'
      )

      this.logger.info('Executing mutation: removeNodeAttribute', {
        nodeId: args.nodeId,
        attributeId: args.attributeId,
      })

      // Check if the node attribute exists
      const existingNodeAttribute = await this.nodeAttributeRepository.findByNodeIdAndAttributeId(
        args.nodeId,
        args.attributeId
      )

      if (!existingNodeAttribute) {
        this.logger.warn('Node attribute not found', {
          nodeId: args.nodeId,
          attributeId: args.attributeId,
        })
        return {
          success: false,
          nodeAttribute: null,
          errors: [
            {
              message: 'Node attribute not found',
              code: 'NOT_FOUND',
            },
          ],
        }
      }

      // Delete the node attribute
      const nodeAttributeId = existingNodeAttribute.getId()
      if (!nodeAttributeId) {
        return {
          success: false,
          nodeAttribute: null,
          errors: [
            {
              message: 'Node attribute has no valid ID',
              code: 'INVALID_STATE',
            },
          ],
        }
      }
      await this.nodeAttributeRepository.delete(nodeAttributeId)

      return {
        success: true,
        nodeAttribute: null,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: removeNodeAttribute', {
        nodeId: args.nodeId,
        attributeId: args.attributeId,
        ...toErrorMeta(error),
      })

      return {
        success: false,
        nodeAttribute: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  async updateNodeAttributeValue(
    _: GraphQLParent,
    args: { nodeId: string; attributeId: string; value: string },
    _context?: GraphQLContext
  ) {
    try {
      this.validateArgs(
        args as any,
        [
          BaseResolver.validationRules.required('nodeId', 'Node ID'),
          BaseResolver.validationRules.required('attributeId', 'Attribute ID'),
          BaseResolver.validationRules.required('value', 'Attribute value'),
          BaseResolver.validationRules.nonEmpty('nodeId', 'Node ID'),
          BaseResolver.validationRules.nonEmpty('attributeId', 'Attribute ID'),
        ],
        'updateNodeAttributeValue'
      )

      this.logger.info('Executing mutation: updateNodeAttributeValue', {
        nodeId: args.nodeId,
        attributeId: args.attributeId,
        value: args.value,
      })

      // Check if the node attribute exists
      const existingNodeAttribute = await this.nodeAttributeRepository.findByNodeIdAndAttributeId(
        args.nodeId,
        args.attributeId
      )

      if (!existingNodeAttribute) {
        this.logger.warn('Node attribute not found, creating new one', {
          nodeId: args.nodeId,
          attributeId: args.attributeId,
        })

        // If it doesn't exist, create it (set operation)
        const result = await this.nodeAttributeRepository.setNodeAttribute(
          args.nodeId,
          args.attributeId,
          args.value
        )

        return {
          success: true,
          nodeAttribute: result,
          errors: [],
        }
      }

      // Update the existing node attribute value
      existingNodeAttribute.updateValue(args.value)
      await this.nodeAttributeRepository.update(existingNodeAttribute)

      return {
        success: true,
        nodeAttribute: existingNodeAttribute,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: updateNodeAttributeValue', {
        nodeId: args.nodeId,
        attributeId: args.attributeId,
        value: args.value,
        ...toErrorMeta(error),
      })

      return {
        success: false,
        nodeAttribute: null,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  async createPersonNode(
    _: GraphQLParent,
    args: { input: CreatePersonNodeInput },
    _context?: GraphQLContext
  ) {
    try {
      this.validateArgs(
        args as any,
        [
          BaseResolver.validationRules.required('input', 'Create person node input'),
          BaseResolver.validationRules.required('input.content', 'Node content'),
          BaseResolver.validationRules.required('input.name', 'Person name'),
          BaseResolver.validationRules.required('input.age', 'Person age'),
          BaseResolver.validationRules.nonEmpty('input.content', 'Node content'),
          BaseResolver.validationRules.nonEmpty('input.name', 'Person name'),
          BaseResolver.validationRules.nonEmpty('input.age', 'Person age'),
        ],
        'createPersonNode'
      )

      this.logger.info('Executing mutation: createPersonNode', { input: args.input })

      // Step 1: Create the node (hardcoded to table 267 for person nodes)
      const tableId = '267'

      // Import the Node entity
      const { Node } = await import('@/domain/entities/Node.js')

      // Create the node directly using the repository
      const node = Node.create(tableId, args.input.content)

      // Save the node
      await this.nodeRepository.save(node)

      // Fetch the saved node back to get the ID
      const savedNode = await this.nodeRepository.findByTableIdAndContent(
        tableId,
        args.input.content
      )

      if (!savedNode) {
        throw new Error('Failed to retrieve saved node')
      }

      const nodeId = savedNode.getId()
      if (!nodeId) {
        throw new Error('Saved node has no valid ID')
      }

      // Step 2: Find and set attributes
      const attributes = []

      // Find attributes by identifier and set them
      try {
        // Get all attributes for this table
        const nameAttributesResult = await this.attributeRepository.findByTableId(tableId)
        this.logger.info('Attribute query result', { result: nameAttributesResult })

        const nameAttributes = nameAttributesResult?.data || nameAttributesResult?.nodes || []
        this.logger.info('Parsed attributes', { count: nameAttributes.length })

        if (nameAttributes.length === 0) {
          this.logger.warn('No attributes found for table', { tableId })
          // Continue with node creation but no attributes
        } else {
          // Find "name" attribute (identifier: name)
          this.logger.info('Looking for name attribute', {
            availableAttributes: nameAttributes.map((attr) => attr.getIdentifier()),
          })
          const nameAttr = nameAttributes.find((attr) => attr.getIdentifier() === 'name')
          if (nameAttr) {
            const nameAttrId = nameAttr.getId()
            this.logger.info('Found name attribute', { nameAttrId, value: args.input.name })
            if (nameAttrId) {
              const nodeAttribute = await this.nodeAttributeRepository.setNodeAttribute(
                nodeId,
                nameAttrId,
                args.input.name
              )
              this.logger.info('Set name attribute', { nodeAttribute: nodeAttribute.getId() })
              attributes.push(nodeAttribute)
            }
          } else {
            this.logger.warn('Name attribute not found')
          }

          // Find "age" attribute (identifier: age)
          const ageAttr = nameAttributes.find((attr) => attr.getIdentifier() === 'age')
          if (ageAttr) {
            const ageAttrId = ageAttr.getId()
            if (ageAttrId) {
              const nodeAttribute = await this.nodeAttributeRepository.setNodeAttribute(
                nodeId,
                ageAttrId,
                args.input.age
              )
              attributes.push(nodeAttribute)
            }
          }

          // Find "testName" attribute if provided (identifier: test_name)
          if (args.input.testName) {
            const testNameAttr = nameAttributes.find((attr) => attr.getIdentifier() === 'test_name')
            if (testNameAttr) {
              const testNameAttrId = testNameAttr.getId()
              if (testNameAttrId) {
                const nodeAttribute = await this.nodeAttributeRepository.setNodeAttribute(
                  nodeId,
                  testNameAttrId,
                  args.input.testName
                )
                attributes.push(nodeAttribute)
              }
            }
          }
        }
      } catch (attributeError) {
        this.logger.warn('Some attributes could not be set', toErrorMeta(attributeError))
      }

      // Import the NodeDto for proper formatting
      const { fromEntity: nodeFromEntity, nodeAttributeFromEntity } = await import(
        '@/application/dtos/NodeDto.js'
      )

      // Return the expected GraphQL structure
      return {
        success: true,
        node: nodeFromEntity(savedNode),
        attributes: attributes.map((attr) => nodeAttributeFromEntity(attr)),
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: createPersonNode', {
        input: args.input,
        ...toErrorMeta(error),
      })

      return {
        success: false,
        node: null,
        attributes: [],
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  async createNodeWithAttributes(
    _: GraphQLParent,
    args: { input: CreateNodeWithAttributesInput },
    _context?: GraphQLContext
  ) {
    try {
      this.validateArgs(
        args as any,
        [
          BaseResolver.validationRules.required('input', 'Create node with attributes input'),
          BaseResolver.validationRules.required('input.content', 'Node content'),
          BaseResolver.validationRules.required('input.tableId', 'Table ID'),
          BaseResolver.validationRules.required(
            'input.attributesByIdentifier',
            'Attributes by identifier'
          ),
          BaseResolver.validationRules.nonEmpty('input.content', 'Node content'),
          BaseResolver.validationRules.nonEmpty('input.tableId', 'Table ID'),
        ],
        'createNodeWithAttributes'
      )

      this.logger.info('Executing mutation: createNodeWithAttributes', { input: args.input })

      // Step 1: Validate that the table exists
      const table = await this.tableRepository.findById(args.input.tableId)
      if (!table) {
        throw new Error(`Table with ID ${args.input.tableId} not found`)
      }

      // Step 2: Create the node
      const { Node } = await import('@/domain/entities/Node.js')
      const node = Node.create(args.input.tableId, args.input.content)
      await this.nodeRepository.save(node)

      // Step 3: Fetch the saved node back to get the ID
      const savedNode = await this.nodeRepository.findByTableIdAndContent(
        args.input.tableId,
        args.input.content
      )

      if (!savedNode) {
        throw new Error('Failed to retrieve saved node')
      }

      const nodeId = savedNode.getId()
      if (!nodeId) {
        throw new Error('Saved node has no valid ID')
      }

      // Step 4: Set attributes by identifier
      const attributes = []

      try {
        // Get all attributes for this table
        const attributesResult = await this.attributeRepository.findByTableId(args.input.tableId)
        const availableAttributes = attributesResult?.data || attributesResult?.nodes || []

        this.logger.info('Available attributes for table', {
          tableId: args.input.tableId,
          count: availableAttributes.length,
          identifiers: availableAttributes.map((attr) => attr.getIdentifier()),
        })

        // Map each input attribute by identifier
        for (const inputAttr of args.input.attributesByIdentifier) {
          const foundAttribute = availableAttributes.find(
            (attr) => attr.getIdentifier() === inputAttr.identifier
          )

          if (foundAttribute) {
            const attrId = foundAttribute.getId()
            if (attrId) {
              this.logger.info('Setting attribute', {
                identifier: inputAttr.identifier,
                value: inputAttr.value,
                attributeId: attrId,
              })

              const nodeAttribute = await this.nodeAttributeRepository.setNodeAttribute(
                nodeId,
                attrId,
                inputAttr.value
              )
              attributes.push(nodeAttribute)
            }
          } else {
            this.logger.warn('Attribute not found by identifier', {
              identifier: inputAttr.identifier,
              availableIdentifiers: availableAttributes.map((attr) => attr.getIdentifier()),
            })
          }
        }
      } catch (attributeError) {
        this.logger.warn('Some attributes could not be set', toErrorMeta(attributeError))
      }

      // Step 5: Format response
      const { fromEntity: nodeFromEntity, nodeAttributeFromEntity } = await import(
        '@/application/dtos/NodeDto.js'
      )

      return {
        success: true,
        node: nodeFromEntity(savedNode),
        attributes: attributes.map((attr) => nodeAttributeFromEntity(attr)),
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: createNodeWithAttributes', {
        input: args.input,
        ...toErrorMeta(error),
      })

      return {
        success: false,
        node: null,
        attributes: [],
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  async setNodeAttributes(
    _: GraphQLParent,
    args: { input: SetNodeAttributesInput },
    _context?: GraphQLContext
  ) {
    try {
      this.validateArgs(
        args as any,
        [
          BaseResolver.validationRules.required('input', 'Set node attributes input'),
          BaseResolver.validationRules.required('input.nodeId', 'Node ID'),
          BaseResolver.validationRules.required('input.attributes', 'Attributes'),
          BaseResolver.validationRules.nonEmpty('input.nodeId', 'Node ID'),
        ],
        'setNodeAttributes'
      )

      this.logger.info('Executing mutation: setNodeAttributes', { input: args.input })

      // Verify node exists
      const existingNode = await this.nodeRepository.findById(args.input.nodeId)
      if (!existingNode) {
        throw new Error('Node not found')
      }

      const nodeAttributes = []

      // Process each attribute
      for (const attr of args.input.attributes) {
        try {
          const nodeAttribute = await this.nodeAttributeRepository.setNodeAttribute(
            args.input.nodeId,
            attr.attributeId,
            attr.value
          )
          nodeAttributes.push(nodeAttribute)

          this.logger.info('Set attribute', {
            nodeId: args.input.nodeId,
            attributeId: attr.attributeId,
            value: attr.value,
          })
        } catch (error) {
          this.logger.warn('Failed to set attribute', {
            nodeId: args.input.nodeId,
            attributeId: attr.attributeId,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      // Import DTO for formatting
      const { nodeAttributeFromEntity } = await import('@/application/dtos/NodeDto.js')

      return {
        success: true,
        nodeAttributes: nodeAttributes.map((attr) => nodeAttributeFromEntity(attr)),
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: setNodeAttributes', {
        input: args.input,
        ...toErrorMeta(error),
      })

      return {
        success: false,
        nodeAttributes: [],
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }

  async setNodeAttributesByIdentifier(
    _: GraphQLParent,
    args: { input: SetNodeAttributesByIdentifierInput },
    _context?: GraphQLContext
  ) {
    try {
      this.validateArgs(
        args as any,
        [
          BaseResolver.validationRules.required('input', 'Set node attributes by identifier input'),
          BaseResolver.validationRules.required('input.nodeId', 'Node ID'),
          BaseResolver.validationRules.required(
            'input.attributesByIdentifier',
            'Attributes by identifier'
          ),
          BaseResolver.validationRules.nonEmpty('input.nodeId', 'Node ID'),
        ],
        'setNodeAttributesByIdentifier'
      )

      this.logger.info('Executing mutation: setNodeAttributesByIdentifier', { input: args.input })

      // Verify node exists and get its table
      const existingNode = await this.nodeRepository.findById(args.input.nodeId)
      if (!existingNode) {
        throw new Error('Node not found')
      }

      const tableId = existingNode.getTableId()

      // Get all attributes for the table
      const attributesResult = await this.attributeRepository.findByTableId(tableId)
      const availableAttributes = attributesResult?.data || attributesResult?.nodes || []

      this.logger.info('Available attributes for node table', {
        nodeId: args.input.nodeId,
        tableId,
        count: availableAttributes.length,
        identifiers: availableAttributes.map((attr) => attr.getIdentifier()),
      })

      const nodeAttributes = []

      // Process each attribute by identifier
      for (const inputAttr of args.input.attributesByIdentifier) {
        const foundAttribute = availableAttributes.find(
          (attr) => attr.getIdentifier() === inputAttr.identifier
        )

        if (foundAttribute) {
          const attrId = foundAttribute.getId()
          if (attrId) {
            try {
              const nodeAttribute = await this.nodeAttributeRepository.setNodeAttribute(
                args.input.nodeId,
                attrId,
                inputAttr.value
              )
              nodeAttributes.push(nodeAttribute)

              this.logger.info('Set attribute by identifier', {
                nodeId: args.input.nodeId,
                identifier: inputAttr.identifier,
                attributeId: attrId,
                value: inputAttr.value,
              })
            } catch (error) {
              this.logger.warn('Failed to set attribute by identifier', {
                nodeId: args.input.nodeId,
                identifier: inputAttr.identifier,
                error: error instanceof Error ? error.message : 'Unknown error',
              })
            }
          }
        } else {
          this.logger.warn('Attribute not found by identifier', {
            identifier: inputAttr.identifier,
            availableIdentifiers: availableAttributes.map((attr) => attr.getIdentifier()),
          })
        }
      }

      // Import DTO for formatting
      const { nodeAttributeFromEntity } = await import('@/application/dtos/NodeDto.js')

      return {
        success: true,
        nodeAttributes: nodeAttributes.map((attr) => nodeAttributeFromEntity(attr)),
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: setNodeAttributesByIdentifier', {
        input: args.input,
        ...toErrorMeta(error),
      })

      return {
        success: false,
        nodeAttributes: [],
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
          },
        ],
      }
    }
  }
}

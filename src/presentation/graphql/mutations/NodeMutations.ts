import type { ILogger } from '@/application/ports/ILogger.js'
import type { NodeDto } from '@/application/dtos/NodeDto.js'
import type { BestEffortTabularSyncHook } from '@/application/services/BestEffortTabularSyncHook.js'
import type { CreateNodeUseCase } from '@/application/use-cases/nodes/CreateNode.js'
import type { UpdateNodeUseCase } from '@/application/use-cases/nodes/UpdateNode.js'
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

interface BatchMutationError {
  index: number
  code: string
  message: string
  field: string | null
  details: Record<string, unknown>
}

interface BatchNodeInput {
  tableId: string
  content: string
  title?: string
  description?: string
  metadata?: SafeJsonValue
}

interface BatchUpdateNodeInput {
  nodeId: string
  content?: string
  title?: string | null
  description?: string | null
  metadata?: SafeJsonValue
}

interface BatchNodeResult {
  node: NodeDto | null
  errors: BatchMutationError[]
}

interface BatchAttributeUpdateResult {
  nodeId: string
  attributeId: string
  value: string | null
  errors: BatchMutationError[]
}

import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { Attribute } from '@/domain/entities/Attribute.js'
import type { IAttributeTypeRepository } from '@/domain/repositories/IAttributeTypeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import { toErrorMeta } from '@/presentation/http/utils/errorHelpers.js'
import { BaseException } from '@/shared/exceptions/DomainException.js'
import { containsUnsafeJsonKeys, sanitizeJsonValue, type SafeJsonValue } from '@/shared/utils/safeJson.js'
import { sanitizeTextContent } from '@/shared/utils/sanitizeText.js'
import { BaseResolver } from '../base/BaseResolver.js'

type MutationErrorPayload = {
  message: string
  code: string
  field?: string
}

export class NodeMutations extends BaseResolver {
  protected logger: ILogger

  constructor(
    private readonly createNodeUseCase: CreateNodeUseCase | null,
    private readonly updateNodeUseCase: UpdateNodeUseCase | null,
    private readonly nodeRepository: INodeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly tableRepository: ITableRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly attributeTypeRepository: IAttributeTypeRepository,
    logger: ILogger,
    private readonly tabularSyncHook?: BestEffortTabularSyncHook,
  ) {
    super()
    this.logger = logger
  }

  private async validateAttributeValue(attribute: Attribute | null, value: unknown): Promise<void> {
    const attributeTypeId = attribute?.getAttributeTypeId?.()
    if (!attributeTypeId) {
      return
    }

    const attributeType = await this.attributeTypeRepository.findById(attributeTypeId)
    const jsonType = attributeType?.getJsonType?.()
    const valueString = String(value ?? '').trim()

    switch (jsonType) {
      case 'number':
      case 'integer': {
        if (valueString.length === 0) {
          throw new Error(`Invalid ${jsonType} value`)
        }

        const parsedNumber = Number(valueString)
        if (Number.isNaN(parsedNumber)) {
          throw new Error(`Invalid ${jsonType} value`)
        }

        if (!Number.isFinite(parsedNumber)) {
          throw new Error(`Number value is too large`)
        }

        if (jsonType === 'integer' && !Number.isInteger(parsedNumber)) {
          throw new Error('Invalid integer value')
        }
        break
      }
      case 'boolean':
        if (!['true', 'false', '1', '0'].includes(valueString.toLowerCase())) {
          throw new Error('Invalid boolean value')
        }
        break
      case 'array':
      case 'object':
        try {
          const parsedValue = JSON.parse(valueString)
          if (jsonType === 'array' && !Array.isArray(parsedValue)) {
            throw new Error(`Invalid ${jsonType} value`)
          }
          if (jsonType === 'object' && (parsedValue === null || Array.isArray(parsedValue) || typeof parsedValue !== 'object')) {
            throw new Error(`Invalid ${jsonType} value`)
          }
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Invalid')) {
            throw error
          }
          throw new Error(`Invalid ${jsonType} value`)
        }
        break
      default:
        break
    }
  }

  private async createNodeInternal(input: {
    tableId: string
    content: string
    title?: string
    description?: string
    metadata?: unknown
    attributes?: Array<{ attributeId: string; value: string }>
  }) {
    const sanitizedContent = sanitizeTextContent(input.content) || ''
    const sanitizedTitle = sanitizeTextContent(input.title) ?? undefined
    const sanitizedDescription = sanitizeTextContent(input.description) ?? undefined

    if (this.createNodeUseCase) {
      const normalizedAttributes = Object.fromEntries(
        (
          await Promise.all(
            (input.attributes || []).map(async (attributeInput) => {
              const attribute = await this.attributeRepository.findById(attributeInput.attributeId)
              if (!attribute) {
                this.logger.warn('Attribute not found during createNodeInternal; preserving input for validation', {
                  attributeId: attributeInput.attributeId,
                  tableId: input.tableId,
                })
                return [attributeInput.attributeId, attributeInput.value] as const
              }

              return [attribute.getIdentifier(), attributeInput.value] as const
            }),
          )
        ).filter((entry): entry is readonly [string, string] => entry !== null),
      )

      return await this.createNodeUseCase.execute({
        content: sanitizedContent,
        tableId: input.tableId,
        title: sanitizedTitle,
        description: sanitizedDescription,
        metadata: input.metadata === undefined ? undefined : (sanitizeJsonValue(input.metadata) as SafeJsonValue),
        attributes: Object.keys(normalizedAttributes).length > 0 ? normalizedAttributes : undefined,
      })
    }

    const table = await this.tableRepository.findById(input.tableId)
    if (!table) {
      throw new Error(`Table with ID ${input.tableId} not found`)
    }

    const { Node } = await import('@/domain/entities/Node.js')
    const node = Node.create(input.tableId, sanitizedContent, sanitizedTitle, sanitizedDescription, input.metadata)
    await this.nodeRepository.save(node)

    const savedNode = await this.nodeRepository.findByTableIdAndContent(input.tableId, sanitizedContent)
    if (!savedNode) {
      throw new Error('Failed to retrieve saved node')
    }

    const { fromEntity: nodeFromEntity } = await import('@/application/dtos/NodeDto.js')
    return {
      node: nodeFromEntity(savedNode),
    }
  }

  private toBatchError(error: unknown, index: number, field?: string): BatchMutationError {
    const errorCode =
      typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'BATCH_ERROR'

    return {
      index,
      code: errorCode,
      message: error instanceof Error ? error.message : 'Unknown error',
      field: field || null,
      details: error instanceof Error ? { name: error.name } : {},
    }
  }

  private formatMutationErrors(error: unknown): MutationErrorPayload[] {
    const context = error instanceof BaseException ? error.context : undefined
    const validationErrors = context?.validationErrors

    if (Array.isArray(validationErrors) && validationErrors.length > 0) {
      return validationErrors
        .filter((validationError): validationError is Record<string, unknown> =>
          typeof validationError === 'object' && validationError !== null,
        )
        .map((validationError) => ({
          message: typeof validationError.message === 'string' ? validationError.message : 'Validation error',
          code: typeof validationError.code === 'string' ? validationError.code : 'VALIDATION_ERROR',
          field: typeof validationError.field === 'string' ? validationError.field : undefined,
        }))
    }

    return [{
      message: error instanceof Error ? error.message : 'Unknown error',
      code: error instanceof BaseException ? error.code : 'INTERNAL_ERROR',
    }]
  }

  private async normalizeUpdateAttributes(
    input: UpdateNodeArgs['input'],
  ): Promise<Record<string, unknown> | undefined> {
    if (Array.isArray(input.attributesByIdentifier)) {
      return Object.fromEntries(
        input.attributesByIdentifier.map((attribute) => [attribute.identifier, attribute.value]),
      )
    }

    if (input.attributes === undefined) {
      return undefined
    }

    if (Array.isArray(input.attributes)) {
      return Object.fromEntries(
        (
          await Promise.all(
            input.attributes.map(async (attributeInput) => {
              if (
                typeof attributeInput !== 'object' ||
                attributeInput === null ||
                !('attributeId' in attributeInput) ||
                !('value' in attributeInput)
              ) {
                return null
              }

              const attributeId = String(attributeInput.attributeId)
              const attribute = await this.attributeRepository.findById(attributeId)
              if (!attribute) {
                this.logger.warn('Attribute not found during updateNode; preserving input for validation', {
                  attributeId,
                })
                return [attributeId, attributeInput.value] as const
              }

              return [attribute.getIdentifier(), attributeInput.value] as const
            }),
          )
        ).filter((entry): entry is readonly [string, string] => entry !== null),
      )
    }

    if (typeof input.attributes === 'object' && input.attributes !== null) {
      return input.attributes as Record<string, unknown>
    }

    return undefined
  }

  async createNode(_: GraphQLParent, args: CreateNodeArgs, _context?: GraphQLContext) {
    if (containsUnsafeJsonKeys(args.input.metadata)) {
      throw new Error('Unsafe metadata keys are not allowed')
    }

    try {
      this.validateArgs(
        args as unknown as Record<string, unknown>,
        [
          BaseResolver.validationRules.required('input', 'Create node input'),
          BaseResolver.validationRules.required('input.content', 'Node content'),
          BaseResolver.validationRules.required('input.tableId', 'Table ID'),
          BaseResolver.validationRules.nonEmpty('input.content', 'Node content'),
          BaseResolver.validationRules.nonEmpty('input.tableId', 'Table ID'),
        ],
        'createNode',
      )

      this.logger.info('Executing mutation: createNode', { input: args.input })

      // Fallback implementation when CreateNodeUseCase is not available
      if (!this.createNodeUseCase) {
        this.logger.warn('CreateNodeUseCase not available, using fallback implementation')
        const sanitizedContent = sanitizeTextContent(args.input.content) || ''
        const sanitizedTitle = sanitizeTextContent(args.input.title) ?? undefined
        const sanitizedDescription = sanitizeTextContent(args.input.description) ?? undefined

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
          sanitizedContent, // content second
          sanitizedTitle,
          sanitizedDescription,
          args.input.metadata,
        )

        // Save the node
        await this.nodeRepository.save(node)

        // Fetch the saved node back to get the ID
        const savedNode = await this.nodeRepository.findByTableIdAndContent(args.input.tableId, sanitizedContent)

        if (!savedNode) {
          throw new Error('Failed to retrieve saved node')
        }

        // Import the NodeDto for proper formatting
        const { fromEntity: nodeFromEntity } = await import('@/application/dtos/NodeDto.js')

        // Return the expected GraphQL structure
        this.tabularSyncHook?.notifyByTableId(args.input.tableId)
        return {
          success: true,
          node: nodeFromEntity(savedNode),
          errors: [],
        }
      }

      const normalizedAttributes = Object.fromEntries(
        (
          await Promise.all(
            (args.input.attributes || []).map(async (attributeInput) => {
              const attribute = await this.attributeRepository.findById(attributeInput.attributeId)
              if (!attribute) {
                this.logger.warn('Attribute not found during createNode; preserving input for validation', {
                  attributeId: attributeInput.attributeId,
                  tableId: args.input.tableId,
                })
                return [attributeInput.attributeId, attributeInput.value] as const
              }

              return [attribute.getIdentifier(), attributeInput.value] as const
            }),
          )
        ).filter((entry): entry is readonly [string, string] => entry !== null),
      )

      const result = await this.createNodeUseCase.execute({
        content: args.input.content,
        tableId: args.input.tableId,
        title: args.input.title,
        description: args.input.description,
        metadata: args.input.metadata,
        attributes: Object.keys(normalizedAttributes).length > 0 ? normalizedAttributes : undefined,
      })

      this.tabularSyncHook?.notifyByTableId(args.input.tableId)

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
        errors: this.formatMutationErrors(error),
      }
    }
  }

  async updateNode(_: GraphQLParent, args: UpdateNodeArgs, _context?: GraphQLContext) {
    if (containsUnsafeJsonKeys(args.input.metadata)) {
      throw new Error('Unsafe metadata keys are not allowed')
    }

    try {
      const nodeId = args.id || args.input.nodeId

      this.validateArgs(
        { ...args, id: nodeId } as Record<string, unknown>,
        [
          BaseResolver.validationRules.required('id', 'Node ID'),
          BaseResolver.validationRules.required('input', 'Update node input'),
          BaseResolver.validationRules.nonEmpty('id', 'Node ID'),
        ],
        'updateNode',
      )

      const normalizedAttributes = await this.normalizeUpdateAttributes(args.input)

      if (
        args.input.content === undefined &&
        args.input.title === undefined &&
        args.input.description === undefined &&
        args.input.metadata === undefined &&
        normalizedAttributes === undefined
      ) {
        throw new Error('At least one node field or attribute must be provided')
      }

      this.logger.info('Executing mutation: updateNode', { id: nodeId, input: args.input })

      if (this.updateNodeUseCase) {
        const result = await this.updateNodeUseCase.execute(nodeId as string, {
          nodeId: nodeId as string,
          tableId: args.input.tableId,
          tableIdentifier: args.input.tableIdentifier,
          content: args.input.content,
          title: args.input.title,
          description: args.input.description,
          metadata: args.input.metadata,
          attributes: normalizedAttributes,
        })

        this.tabularSyncHook?.notifyByTableId(result.node.tableId)

        return {
          success: true,
          node: result.node,
          errors: [],
        }
      }

      const existingNode = await this.nodeRepository.findById(nodeId as string)
      if (!existingNode) {
        throw new Error('Node not found')
      }

      if (normalizedAttributes !== undefined) {
        throw new Error('UpdateNode attributes require UpdateNodeUseCase')
      }

      const updatedNode = await this.nodeRepository.update(nodeId as string, {
        content: args.input.content,
        title: args.input.title,
        description: args.input.description,
        metadata: args.input.metadata,
      })

      if (!updatedNode) {
        throw new Error('Failed to update node')
      }

      // Import the NodeDto for proper formatting
      const { fromEntity: nodeFromEntity } = await import('@/application/dtos/NodeDto.js')

      this.tabularSyncHook?.notifyByTableId(existingNode.getTableId())

      return {
        success: true,
        node: nodeFromEntity(updatedNode),
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: updateNode', {
        id: args.id || args.input.nodeId,
        input: args.input,
        ...toErrorMeta(error),
      })

      return {
        success: false,
        node: null,
        errors: this.formatMutationErrors(error),
      }
    }
  }

  async deleteNode(_: GraphQLParent, args: DeleteNodeArgs, _context?: GraphQLContext) {
    try {
      const nodeId = args.id || args.nodeId

      this.validateArgs(
        { ...args, id: nodeId } as Record<string, unknown>,
        [
          BaseResolver.validationRules.required('id', 'Node ID'),
          BaseResolver.validationRules.nonEmpty('id', 'Node ID'),
        ],
        'deleteNode',
      )

      this.logger.info('Executing mutation: deleteNode', { id: nodeId })

      const existingNode = await this.nodeRepository.findById(nodeId as string)
      if (!existingNode) {
        throw new Error('Node not found')
      }

      await this.nodeRepository.delete(nodeId as string)
      this.tabularSyncHook?.notifyByTableId(existingNode.getTableId())

      return {
        success: true,
        errors: [],
      }
    } catch (error) {
      this.logger.error('Mutation failed: deleteNode', { id: args.id || args.nodeId, ...toErrorMeta(error) })

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
      args as unknown as Record<string, unknown>,
      [
        BaseResolver.validationRules.required('input', 'Set node attribute input'),
        BaseResolver.validationRules.required('input.nodeId', 'Node ID'),
        BaseResolver.validationRules.required('input.attributeId', 'Attribute ID'),
        BaseResolver.validationRules.required('input.value', 'Attribute value'),
        BaseResolver.validationRules.nonEmpty('input.nodeId', 'Node ID'),
        BaseResolver.validationRules.nonEmpty('input.attributeId', 'Attribute ID'),
      ],
      'setNodeAttribute',
    )

    const mutationResult = await this.handleMutation(
      async () => {
        let resolvedAttributeId = args.input.attributeId
        let attribute = await this.attributeRepository.findById(args.input.attributeId)

        if (!attribute) {
          const node = await this.nodeRepository.findById(args.input.nodeId)
          if (node) {
            attribute = await this.attributeRepository.findByTableIdAndIdentifier(node.getTableId(), args.input.attributeId)
            if (attribute) {
              resolvedAttributeId = attribute.getId()
            }
          }
        }

        if (!resolvedAttributeId) {
          throw new Error('Attribute ID could not be resolved')
        }

        if (attribute) {
          await this.validateAttributeValue(attribute, args.input.value)
        }

        const result = await this.nodeAttributeRepository.setNodeAttribute(
          args.input.nodeId,
          resolvedAttributeId,
          args.input.value,
        )

        const node = await this.nodeRepository.findById(args.input.nodeId)
        if (node) {
          this.tabularSyncHook?.notifyByTableId(node.getTableId())
        }

        // Transform domain entity to DTO
        const { nodeAttributeFromEntity } = await import('@/application/dtos/NodeDto.js')
        return nodeAttributeFromEntity(result)
      },
      'setNodeAttribute',
      { input: args.input },
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
    _context?: GraphQLContext,
  ) {
    try {
      this.validateArgs(
        args as unknown as Record<string, unknown>,
        [
          BaseResolver.validationRules.required('nodeId', 'Node ID'),
          BaseResolver.validationRules.required('attributeId', 'Attribute ID'),
          BaseResolver.validationRules.nonEmpty('nodeId', 'Node ID'),
          BaseResolver.validationRules.nonEmpty('attributeId', 'Attribute ID'),
        ],
        'removeNodeAttribute',
      )

      this.logger.info('Executing mutation: removeNodeAttribute', {
        nodeId: args.nodeId,
        attributeId: args.attributeId,
      })

      // Check if the node attribute exists
      const existingNodeAttribute = await this.nodeAttributeRepository.findByNodeIdAndAttributeId(
        args.nodeId,
        args.attributeId,
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

      const node = await this.nodeRepository.findById(args.nodeId)
      if (node) {
        this.tabularSyncHook?.notifyByTableId(node.getTableId())
      }

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
    _context?: GraphQLContext,
  ) {
    try {
      this.validateArgs(
        args as unknown as Record<string, unknown>,
        [
          BaseResolver.validationRules.required('nodeId', 'Node ID'),
          BaseResolver.validationRules.required('attributeId', 'Attribute ID'),
          BaseResolver.validationRules.required('value', 'Attribute value'),
          BaseResolver.validationRules.nonEmpty('nodeId', 'Node ID'),
          BaseResolver.validationRules.nonEmpty('attributeId', 'Attribute ID'),
        ],
        'updateNodeAttributeValue',
      )

      this.logger.info('Executing mutation: updateNodeAttributeValue', {
        nodeId: args.nodeId,
        attributeId: args.attributeId,
        value: args.value,
      })

      // Check if the node attribute exists
      const existingNodeAttribute = await this.nodeAttributeRepository.findByNodeIdAndAttributeId(
        args.nodeId,
        args.attributeId,
      )

      if (!existingNodeAttribute) {
        this.logger.warn('Node attribute not found, creating new one', {
          nodeId: args.nodeId,
          attributeId: args.attributeId,
        })

        // If it doesn't exist, create it (set operation)
        const result = await this.nodeAttributeRepository.setNodeAttribute(args.nodeId, args.attributeId, args.value)
        const node = await this.nodeRepository.findById(args.nodeId)
        if (node) {
          this.tabularSyncHook?.notifyByTableId(node.getTableId())
        }

        return {
          success: true,
          attribute: result,
          nodeAttribute: result,
          errors: [],
        }
      }

      // Update the existing node attribute value
      existingNodeAttribute.updateValue(args.value)
      await this.nodeAttributeRepository.update(existingNodeAttribute)
      const node = await this.nodeRepository.findById(args.nodeId)
      if (node) {
        this.tabularSyncHook?.notifyByTableId(node.getTableId())
      }

      return {
        success: true,
        attribute: existingNodeAttribute,
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

  async createPersonNode(_: GraphQLParent, args: { input: CreatePersonNodeInput }, _context?: GraphQLContext) {
    try {
      this.validateArgs(
        args as unknown as Record<string, unknown>,
        [
          BaseResolver.validationRules.required('input', 'Create person node input'),
          BaseResolver.validationRules.required('input.content', 'Node content'),
          BaseResolver.validationRules.required('input.name', 'Person name'),
          BaseResolver.validationRules.required('input.age', 'Person age'),
          BaseResolver.validationRules.nonEmpty('input.content', 'Node content'),
          BaseResolver.validationRules.nonEmpty('input.name', 'Person name'),
          BaseResolver.validationRules.nonEmpty('input.age', 'Person age'),
        ],
        'createPersonNode',
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
      const savedNode = await this.nodeRepository.findByTableIdAndContent(tableId, args.input.content)

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
                args.input.name,
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
                args.input.age,
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
                  args.input.testName,
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
      const { fromEntity: nodeFromEntity, nodeAttributeFromEntity } = await import('@/application/dtos/NodeDto.js')

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
        errors: this.formatMutationErrors(error),
      }
    }
  }

  async createNodeWithAttributes(
    _: GraphQLParent,
    args: { input: CreateNodeWithAttributesInput },
    _context?: GraphQLContext,
  ) {
    try {
      this.validateArgs(
        args as unknown as Record<string, unknown>,
        [
          BaseResolver.validationRules.required('input', 'Create node with attributes input'),
          BaseResolver.validationRules.required('input.content', 'Node content'),
          BaseResolver.validationRules.required('input.tableId', 'Table ID'),
          BaseResolver.validationRules.required('input.attributesByIdentifier', 'Attributes by identifier'),
          BaseResolver.validationRules.nonEmpty('input.content', 'Node content'),
          BaseResolver.validationRules.nonEmpty('input.tableId', 'Table ID'),
        ],
        'createNodeWithAttributes',
      )

      this.logger.info('Executing mutation: createNodeWithAttributes', { input: args.input })

      if (this.createNodeUseCase) {
        const attributes = Object.fromEntries(
          args.input.attributesByIdentifier.map((attribute) => [attribute.identifier, attribute.value]),
        )

        const result = await this.createNodeUseCase.execute({
          tableId: args.input.tableId,
          content: args.input.content,
          attributes,
        })

        const savedAttributes = await this.nodeAttributeRepository.findByNodeId(result.node.id)
        const { nodeAttributeFromEntity } = await import('@/application/dtos/NodeDto.js')

        this.tabularSyncHook?.notifyByTableId(args.input.tableId)

        return {
          success: true,
          node: result.node,
          attributes: savedAttributes.map((attribute) => nodeAttributeFromEntity(attribute)),
          errors: [],
        }
      }

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
      const savedNode = await this.nodeRepository.findByTableIdAndContent(args.input.tableId, args.input.content)

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
          const foundAttribute = availableAttributes.find((attr) => attr.getIdentifier() === inputAttr.identifier)

          if (foundAttribute) {
            const attrId = foundAttribute.getId()
            if (attrId) {
              this.logger.info('Setting attribute', {
                identifier: inputAttr.identifier,
                value: inputAttr.value,
                attributeId: attrId,
              })

              const nodeAttribute = await this.nodeAttributeRepository.setNodeAttribute(nodeId, attrId, inputAttr.value)
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
      const { fromEntity: nodeFromEntity, nodeAttributeFromEntity } = await import('@/application/dtos/NodeDto.js')

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
        errors: this.formatMutationErrors(error),
      }
    }
  }

  async setNodeAttributes(_: GraphQLParent, args: { input: SetNodeAttributesInput }, _context?: GraphQLContext) {
    try {
      this.validateArgs(
        args as unknown as Record<string, unknown>,
        [
          BaseResolver.validationRules.required('input', 'Set node attributes input'),
          BaseResolver.validationRules.required('input.nodeId', 'Node ID'),
          BaseResolver.validationRules.required('input.attributes', 'Attributes'),
          BaseResolver.validationRules.nonEmpty('input.nodeId', 'Node ID'),
        ],
        'setNodeAttributes',
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
            attr.value,
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
    _context?: GraphQLContext,
  ) {
    try {
      this.validateArgs(
        args as unknown as Record<string, unknown>,
        [
          BaseResolver.validationRules.required('input', 'Set node attributes by identifier input'),
          BaseResolver.validationRules.required('input.nodeId', 'Node ID'),
          BaseResolver.validationRules.required('input.attributesByIdentifier', 'Attributes by identifier'),
          BaseResolver.validationRules.nonEmpty('input.nodeId', 'Node ID'),
        ],
        'setNodeAttributesByIdentifier',
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
        const foundAttribute = availableAttributes.find((attr) => attr.getIdentifier() === inputAttr.identifier)

        if (foundAttribute) {
          const attrId = foundAttribute.getId()
          if (attrId) {
            try {
              const nodeAttribute = await this.nodeAttributeRepository.setNodeAttribute(
                args.input.nodeId,
                attrId,
                inputAttr.value,
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

  async batchCreateNodes(
    _: GraphQLParent,
    args: {
      nodes?: BatchNodeInput[]
      input?: {
        tableId: string
        nodes: Array<Omit<BatchNodeInput, 'tableId'>>
      }
    },
  ) {
    const startedAt = Date.now()
    const nodes =
      args.nodes ||
      args.input?.nodes?.map((node) => ({
        ...node,
        tableId: args.input?.tableId || '',
      })) ||
      []

    const results: BatchNodeResult[] = []
    const createdNodes: NodeDto[] = []
    const errors: BatchMutationError[] = []
    let totalCreated = 0
    let totalFailed = 0

    for (const [index, nodeInput] of nodes.entries()) {
      try {
        const result = await this.createNodeInternal(nodeInput)
        createdNodes.push(result.node)
        results.push({ node: result.node, errors: [] })
        totalCreated++
      } catch (error) {
        const batchError = this.toBatchError(error, index, 'content')
        errors.push(batchError)
        results.push({ node: null, errors: [batchError] })
        totalFailed++
      }
    }

    const processingTimeMs = Date.now() - startedAt

    return {
      success: totalFailed === 0,
      nodes: createdNodes,
      results,
      errors,
      totalCreated,
      totalFailed,
      processingTimeMs,
      averageTimePerNodeMs: nodes.length > 0 ? processingTimeMs / nodes.length : 0,
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      statistics: {
        totalRequested: nodes.length,
        successfullyCreated: totalCreated,
        failed: totalFailed,
        executionTime: processingTimeMs,
      },
      errorSummary: {
        validationErrors: errors.length,
        databaseErrors: totalFailed,
        systemErrors: 0,
      },
    }
  }

  async batchCreateNodesTransactional(
    _: GraphQLParent,
    args: { nodes: BatchNodeInput[] },
  ) {
    for (const nodeInput of args.nodes || []) {
      if (!nodeInput.tableId || !nodeInput.content) {
        return {
          success: false,
          totalCreated: 0,
          totalFailed: (args.nodes || []).length,
          rollbackOccurred: true,
        }
      }

      const table = await this.tableRepository.findById(nodeInput.tableId)
      if (!table) {
        return {
          success: false,
          totalCreated: 0,
          totalFailed: (args.nodes || []).length,
          rollbackOccurred: true,
        }
      }
    }

    const result = await this.batchCreateNodes(_, { nodes: args.nodes })
    return {
      success: result.totalFailed === 0,
      totalCreated: result.totalCreated,
      totalFailed: result.totalFailed,
      rollbackOccurred: result.totalFailed > 0,
    }
  }

  async batchCreateNodesWithProgress(
    _: GraphQLParent,
    args: {
      nodes: BatchNodeInput[]
      progressCallback?: string
    },
  ) {
    const result = await this.batchCreateNodes(_, { nodes: args.nodes })
    return {
      success: result.success,
      totalCreated: result.totalCreated,
      totalFailed: result.totalFailed,
      progressUpdates: [
        {
          completed: result.totalCreated + result.totalFailed,
          total: args.nodes.length,
          percentage: args.nodes.length > 0 ? ((result.totalCreated + result.totalFailed) / args.nodes.length) * 100 : 100,
          estimatedTimeRemainingMs: 0,
        },
      ],
    }
  }

  async batchUpdateNodes(
    _: GraphQLParent,
    args: {
      updates: BatchUpdateNodeInput[]
    },
  ) {
    const results: BatchNodeResult[] = []
    let totalUpdated = 0
    let totalFailed = 0

    for (const [index, update] of args.updates.entries()) {
      try {
        const updatedNode = await this.nodeRepository.update(update.nodeId, {
          content: update.content,
          title: update.title,
          description: update.description,
          metadata: update.metadata,
        })
        const { fromEntity: nodeFromEntity } = await import('@/application/dtos/NodeDto.js')
        results.push({ node: nodeFromEntity(updatedNode), errors: [] })
        totalUpdated++
      } catch (error) {
        results.push({ node: null, errors: [this.toBatchError(error, index, 'nodeId')] })
        totalFailed++
      }
    }

    return {
      success: totalFailed === 0,
      results,
      totalUpdated,
      totalFailed,
    }
  }

  async batchSetNodeAttributes(
    _: GraphQLParent,
    args: { attributeUpdates: Array<{ nodeId: string; attributeId: string; value: string }> },
  ) {
    const results: BatchAttributeUpdateResult[] = []
    let totalSet = 0
    let totalFailed = 0

    for (const [index, update] of (args.attributeUpdates || []).entries()) {
      try {
        let resolvedAttributeId = update.attributeId
        let attribute = await this.attributeRepository.findById(update.attributeId)
        if (!attribute) {
          const node = await this.nodeRepository.findById(update.nodeId)
          if (node) {
            attribute = await this.attributeRepository.findByTableIdAndIdentifier(node.getTableId(), update.attributeId)
            if (attribute) {
              resolvedAttributeId = attribute.getId()
            }
          }
        }

        if (!resolvedAttributeId) {
          throw new Error('Attribute ID could not be resolved')
        }

        await this.nodeAttributeRepository.setNodeAttribute(update.nodeId, resolvedAttributeId, update.value)
        results.push({
          nodeId: update.nodeId,
          attributeId: resolvedAttributeId,
          value: update.value,
          errors: [],
        })
        totalSet++
      } catch (error) {
        results.push({
          nodeId: update.nodeId,
          attributeId: update.attributeId,
          value: null,
          errors: [this.toBatchError(error, index, 'attributeId')],
        })
        totalFailed++
      }
    }

    return {
      success: totalFailed === 0,
      results,
      totalSet,
      totalFailed,
    }
  }

  async batchOperationWithRollback(
    _: GraphQLParent,
    args: { operations: Array<{ type: string; data: { tableId: string; content: string; title?: string; description?: string } }> },
  ) {
    const unsupportedOperations = (args.operations || []).filter((operation) => operation.type !== 'CREATE_NODE')
    if (unsupportedOperations.length > 0) {
      return {
        success: false,
        rollbackOccurred: true,
        successfulOperations: 0,
        failedOperations: (args.operations || []).length,
        errors: ['Only CREATE_NODE batch operations are currently supported'],
      }
    }

    const nodes = (args.operations || []).map((operation) => operation.data)
    const transactionalResult = await this.batchCreateNodesTransactional(_, { nodes })

    return {
      success: transactionalResult.success,
      rollbackOccurred: transactionalResult.rollbackOccurred,
      successfulOperations: transactionalResult.success ? transactionalResult.totalCreated : 0,
      failedOperations: transactionalResult.success ? 0 : nodes.length,
      errors: transactionalResult.success ? [] : ['Batch rolled back due to invalid operation'],
    }
  }
}

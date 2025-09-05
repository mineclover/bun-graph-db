import type { CreateNodeInput, CreateNodeOutput } from '@/application/dtos/NodeDto.js'
import { NodeDto } from '@/application/dtos/NodeDto.js'
import type { ILogger } from '@/application/ports/ILogger.js'
import type { AttributeId, NodeId, TableId } from '@/core/types/CommonTypes.js'
import { Node } from '@/domain/entities/Node.js'
import { NodeAttribute } from '@/domain/entities/NodeAttribute.js'
import type { IAttributeRepository } from '@/domain/repositories/IAttributeRepository.js'
import type { INodeAttributeRepository } from '@/domain/repositories/INodeAttributeRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '@/shared/exceptions/DomainException.js'

export class CreateNodeUseCase {
  constructor(
    private readonly nodeRepository: INodeRepository,
    private readonly nodeAttributeRepository: INodeAttributeRepository,
    private readonly tableRepository: ITableRepository,
    private readonly attributeRepository: IAttributeRepository,
    private readonly logger: ILogger
  ) {}

  async execute(input: CreateNodeInput): Promise<CreateNodeOutput> {
    this.logger.info('Creating new node', {
      tableId: input.tableId,
      content: input.content,
    })

    // Validate input
    if (!input.tableId?.trim()) {
      throw new ValidationException('Table ID is required')
    }

    if (!input.content?.trim()) {
      throw new ValidationException('Node content is required')
    }

    // Check if table exists
    const table = await this.tableRepository.findById(input.tableId as TableId)
    if (!table) {
      throw new NotFoundException(`Table with id '${input.tableId}' not found`)
    }

    // Check if node with same content already exists in this table
    const existingNode = await this.nodeRepository.findByTableIdAndContent(
      input.tableId as TableId,
      input.content
    )
    if (existingNode) {
      throw new ConflictException(
        `Node with content '${input.content}' already exists in table '${table.identifier}'`
      )
    }

    try {
      // Create domain entity
      const node = Node.create(
        input.tableId as TableId,
        input.content,
        input.title,
        input.description
      )

      // Save node to repository
      await this.nodeRepository.save(node)

      // Retrieve the saved node with the generated ID
      const savedNode = await this.nodeRepository.findByTableIdAndContent(
        input.tableId as TableId,
        input.content
      )
      if (!savedNode) {
        throw new Error('Failed to retrieve saved node')
      }

      // Process attributes if provided
      const attributeValues: Record<string, any> = {}

      if (input.attributes) {
        for (const [attributeIdentifier, value] of Object.entries(input.attributes)) {
          // Find attribute by identifier for this table
          const attributes = await this.attributeRepository.findByTableId(input.tableId as TableId)
          const attribute = attributes.data?.find(
            (attr) => attr.getIdentifier() === attributeIdentifier
          )

          if (!attribute) {
            this.logger.warn(`Attribute '${attributeIdentifier}' not found for table, skipping`)
            continue
          }

          // Create node attribute
          const nodeAttribute = NodeAttribute.create(
            savedNode.getId() as NodeId,
            attribute.getId() as AttributeId,
            typeof value === 'string' ? value : JSON.stringify(value)
          )

          // Save node attribute
          await this.nodeAttributeRepository.save(nodeAttribute)

          // Store for response
          attributeValues[attributeIdentifier] = value
        }
      }

      this.logger.info('Node created successfully', {
        id: savedNode.getId(),
        content: savedNode.getContent(),
        attributeCount: Object.keys(attributeValues).length,
      })

      // Return DTO with attributes
      return {
        node: NodeDto.fromEntity(savedNode, attributeValues),
      }
    } catch (error) {
      this.logger.error('Failed to create node', {
        content: input.content,
        tableId: input.tableId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }
}

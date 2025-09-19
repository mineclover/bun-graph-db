import type { ILogger } from '@/application/ports/ILogger.js'
import type { NodeId, RelationTypeId, TableId } from '@/core/types/CommonTypes.js'
import { NodeRelation } from '@/domain/entities/NodeRelation.js'
import type { INodeRelationRepository } from '@/domain/repositories/INodeRelationRepository.js'
import type { INodeRepository } from '@/domain/repositories/INodeRepository.js'
import type { IRelationTypeRepository } from '@/domain/repositories/IRelationTypeRepository.js'
import type { ITableRepository } from '@/domain/repositories/ITableRepository.js'
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '@/shared/exceptions/DomainException.js'

export interface CreateRelationInput {
  tableId: string
  sourceNodeId?: string | null
  sourceExternalId?: string
  targetNodeId?: string | null
  targetExternalId?: string
  relationTypeId: string
  properties?: Record<string, any> | null
  strength?: number
}

export interface CreateRelationOutput {
  relation: {
    id: string
    tableId: string
    sourceNodeId: string | null
    sourceExternalId: string
    targetNodeId: string | null
    targetExternalId: string
    relationTypeId: string
    properties: Record<string, any> | null
    strength: number
    createdAt: string
    updatedAt: string
  }
}

export class CreateRelationUseCase {
  constructor(
    private readonly nodeRelationRepository: INodeRelationRepository,
    private readonly relationTypeRepository: IRelationTypeRepository,
    private readonly nodeRepository: INodeRepository,
    private readonly tableRepository: ITableRepository,
    private readonly logger: ILogger
  ) {}

  async execute(input: CreateRelationInput): Promise<CreateRelationOutput> {
    this.logger.info('Creating new node relation', {
      tableId: input.tableId,
      sourceNodeId: input.sourceNodeId,
      sourceExternalId: input.sourceExternalId,
      targetNodeId: input.targetNodeId,
      targetExternalId: input.targetExternalId,
      relationTypeId: input.relationTypeId,
    })

    // Validate input
    this.validateInput(input)

    // Check if table exists
    const table = await this.tableRepository.findById(input.tableId as TableId)
    if (!table) {
      throw new NotFoundException(`Table with id '${input.tableId}' not found`)
    }

    // Check if relation type exists
    const relationType = await this.relationTypeRepository.findById(
      input.relationTypeId as RelationTypeId
    )
    if (!relationType) {
      throw new NotFoundException(`RelationType with id '${input.relationTypeId}' not found`)
    }

    // Determine external IDs and validate nodes
    const { sourceNodeId, sourceExternalId, targetNodeId, targetExternalId } =
      await this.resolveNodesAndExternalIds(input)

    // Check for existing relation (prevent duplicates)
    let existingRelation = false

    if (
      sourceExternalId === 'internal' &&
      targetExternalId === 'internal' &&
      sourceNodeId &&
      targetNodeId
    ) {
      // For internal-to-internal relations, check by node IDs and relation type
      const existingRelations = await this.nodeRelationRepository.findBySourceNodeIdAndRelationType(
        sourceNodeId,
        input.relationTypeId as RelationTypeId
      )
      existingRelation = existingRelations.some(
        (relation) =>
          relation.getTargetNodeId() === targetNodeId && relation.getTableId() === input.tableId
      )
    } else {
      // For external relations, use the original exists method
      existingRelation = await this.nodeRelationRepository.exists(
        sourceExternalId,
        targetExternalId,
        input.tableId as TableId,
        input.relationTypeId as RelationTypeId
      )
    }

    if (existingRelation) {
      const sourceIdentifier = sourceNodeId ? `node:${sourceNodeId}` : sourceExternalId
      const targetIdentifier = targetNodeId ? `node:${targetNodeId}` : targetExternalId
      throw new ConflictException(
        `Relation of type '${relationType.getIdentifier()}' already exists between '${sourceIdentifier}' and '${targetIdentifier}'`
      )
    }

    try {
      // Create domain entity
      const nodeRelation = NodeRelation.create(
        input.tableId as TableId,
        sourceNodeId,
        sourceExternalId,
        targetNodeId,
        targetExternalId,
        input.relationTypeId as RelationTypeId,
        input.properties,
        input.strength
      )

      // Save to repository
      await this.nodeRelationRepository.save(nodeRelation)

      // Retrieve the saved relation with generated ID
      const savedRelation = await this.nodeRelationRepository.findByExternalIds(
        sourceExternalId,
        targetExternalId,
        input.tableId as TableId
      )

      if (!savedRelation) {
        throw new Error('Failed to retrieve saved node relation')
      }

      this.logger.info('Node relation created successfully', {
        id: savedRelation.getId(),
        sourceExternalId: savedRelation.getSourceExternalId(),
        targetExternalId: savedRelation.getTargetExternalId(),
        relationTypeId: savedRelation.getRelationTypeId(),
      })

      return {
        relation: {
          id: savedRelation.getId(),
          tableId: savedRelation.getTableId(),
          sourceNodeId: savedRelation.getSourceNodeId(),
          sourceExternalId: savedRelation.getSourceExternalId(),
          targetNodeId: savedRelation.getTargetNodeId(),
          targetExternalId: savedRelation.getTargetExternalId(),
          relationTypeId: savedRelation.getRelationTypeId(),
          properties: savedRelation.getProperties(),
          strength: savedRelation.getStrength(),
          createdAt: savedRelation.getCreatedAt().toISOString(),
          updatedAt: savedRelation.getUpdatedAt().toISOString(),
        },
      }
    } catch (error) {
      this.logger.error('Failed to create node relation', {
        input,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  private validateInput(input: CreateRelationInput): void {
    if (!input.tableId?.trim()) {
      throw new ValidationException('Table ID is required')
    }

    if (!input.relationTypeId?.trim()) {
      throw new ValidationException('Relation type ID is required')
    }

    // Must have either node ID or external ID for both source and target
    if (!input.sourceNodeId && !input.sourceExternalId) {
      throw new ValidationException('Either source node ID or source external ID is required')
    }

    if (!input.targetNodeId && !input.targetExternalId) {
      throw new ValidationException('Either target node ID or target external ID is required')
    }

    // Strength validation
    if (input.strength !== undefined) {
      if (!Number.isInteger(input.strength) || input.strength < 0 || input.strength > 100) {
        throw new ValidationException('Strength must be an integer between 0 and 100')
      }
    }
  }

  private async resolveNodesAndExternalIds(input: CreateRelationInput): Promise<{
    sourceNodeId: NodeId | null
    sourceExternalId: string
    targetNodeId: NodeId | null
    targetExternalId: string
  }> {
    let sourceNodeId: NodeId | null = null
    let sourceExternalId: string
    let targetNodeId: NodeId | null = null
    let targetExternalId: string

    // Resolve source node
    if (input.sourceNodeId) {
      const sourceNode = await this.nodeRepository.findById(input.sourceNodeId as NodeId)
      if (!sourceNode) {
        throw new NotFoundException(`Source node with id '${input.sourceNodeId}' not found`)
      }
      sourceNodeId = input.sourceNodeId as NodeId
      sourceExternalId = 'internal' // Internal node reference
    } else if (input.sourceExternalId) {
      // Try to find node by external ID (content)
      const sourceNode = await this.nodeRepository.findByTableIdAndContent(
        input.tableId as TableId,
        input.sourceExternalId
      )
      if (sourceNode) {
        // Found internal node, treat as internal reference
        sourceNodeId = sourceNode.getId()
        sourceExternalId = 'internal'
      } else {
        // External reference to node not in our system
        sourceExternalId = input.sourceExternalId
      }
    } else {
      throw new ValidationException('Either source node ID or source external ID is required')
    }

    // Resolve target node
    if (input.targetNodeId) {
      const targetNode = await this.nodeRepository.findById(input.targetNodeId as NodeId)
      if (!targetNode) {
        throw new NotFoundException(`Target node with id '${input.targetNodeId}' not found`)
      }
      targetNodeId = input.targetNodeId as NodeId
      targetExternalId = 'internal' // Internal node reference
    } else if (input.targetExternalId) {
      // Try to find node by external ID (content)
      const targetNode = await this.nodeRepository.findByTableIdAndContent(
        input.tableId as TableId,
        input.targetExternalId
      )
      if (targetNode) {
        // Found internal node, treat as internal reference
        targetNodeId = targetNode.getId()
        targetExternalId = 'internal'
      } else {
        // External reference to node not in our system
        targetExternalId = input.targetExternalId
      }
    } else {
      throw new ValidationException('Either target node ID or target external ID is required')
    }

    // Prevent self-referencing relations
    // For internal nodes, compare node IDs; for external nodes, compare external IDs
    const isSelfReferencing =
      (sourceExternalId === 'internal' &&
        targetExternalId === 'internal' &&
        sourceNodeId === targetNodeId) ||
      (sourceExternalId !== 'internal' &&
        targetExternalId !== 'internal' &&
        sourceExternalId === targetExternalId)

    if (isSelfReferencing) {
      throw new ValidationException('Source and target cannot be the same')
    }

    return {
      sourceNodeId,
      sourceExternalId,
      targetNodeId,
      targetExternalId,
    }
  }
}

import type { NodeId, NodeRelationId, RelationTypeId, TableId } from '@/core/types/CommonTypes.js'
import { DomainException } from '@/shared/exceptions/DomainException.js'

export class NodeRelation {
  constructor(
    private readonly id: NodeRelationId,
    private readonly tableId: TableId,
    private readonly sourceNodeId: NodeId | null,
    private readonly sourceExternalId: string,
    private readonly targetNodeId: NodeId | null,
    private readonly targetExternalId: string,
    private readonly relationTypeId: RelationTypeId,
    private readonly properties: Record<string, any> | null,
    private readonly strength: number,
    private readonly createdAt: Date,
    private readonly updatedAt: Date
  ) {
    this.validateExternalIds(sourceExternalId, targetExternalId)
    this.validateStrength(strength)
  }

  static create(
    tableId: TableId,
    sourceNodeId: NodeId | null,
    sourceExternalId: string,
    targetNodeId: NodeId | null,
    targetExternalId: string,
    relationTypeId: RelationTypeId,
    properties?: Record<string, any> | null,
    strength?: number
  ): NodeRelation {
    return new NodeRelation(
      null as any as NodeRelationId,
      tableId,
      sourceNodeId,
      sourceExternalId,
      targetNodeId,
      targetExternalId,
      relationTypeId,
      properties || null,
      strength ?? 1, // Default strength: 1=auto_generated (valid range: 0-4)
      new Date(),
      new Date()
    )
  }

  static fromDatabase(
    id: string,
    tableId: string,
    sourceNodeId: string | null,
    sourceExternalId: string,
    targetNodeId: string | null,
    targetExternalId: string,
    relationTypeId: string,
    properties: string | null,
    strength: number,
    createdAt: Date,
    updatedAt: Date
  ): NodeRelation {
    let parsedProperties: Record<string, any> | null = null
    if (properties) {
      try {
        parsedProperties = JSON.parse(properties)
      } catch {
        // If parsing fails, treat as null
        parsedProperties = null
      }
    }

    return new NodeRelation(
      id as NodeRelationId,
      tableId as TableId,
      sourceNodeId as NodeId | null,
      sourceExternalId,
      targetNodeId as NodeId | null,
      targetExternalId,
      relationTypeId as RelationTypeId,
      parsedProperties,
      strength,
      createdAt,
      updatedAt
    )
  }

  private validateExternalIds(sourceExternalId: string, targetExternalId: string): void {
    if (!sourceExternalId || sourceExternalId.trim().length === 0) {
      throw new DomainException('Source external ID is required')
    }

    if (!targetExternalId || targetExternalId.trim().length === 0) {
      throw new DomainException('Target external ID is required')
    }

    // For internal nodes (external_id = 'internal'), we rely on node IDs for uniqueness
    // For external nodes, external IDs must be different
    if (
      sourceExternalId !== 'internal' &&
      targetExternalId !== 'internal' &&
      sourceExternalId === targetExternalId
    ) {
      throw new DomainException('Source and target external IDs cannot be the same')
    }
  }

  private validateStrength(strength: number): void {
    if (!Number.isInteger(strength)) {
      throw new DomainException('Strength must be an integer')
    }

    if (strength < 0 || strength > 100) {
      throw new DomainException('Strength must be between 0 and 100')
    }
  }

  // Update methods
  updateProperties(properties: Record<string, any> | null): NodeRelation {
    return new NodeRelation(
      this.id,
      this.tableId,
      this.sourceNodeId,
      this.sourceExternalId,
      this.targetNodeId,
      this.targetExternalId,
      this.relationTypeId,
      properties,
      this.strength,
      this.createdAt,
      new Date()
    )
  }

  updateStrength(strength: number): NodeRelation {
    this.validateStrength(strength)
    return new NodeRelation(
      this.id,
      this.tableId,
      this.sourceNodeId,
      this.sourceExternalId,
      this.targetNodeId,
      this.targetExternalId,
      this.relationTypeId,
      this.properties,
      strength,
      this.createdAt,
      new Date()
    )
  }

  updateNodeIds(sourceNodeId: NodeId | null, targetNodeId: NodeId | null): NodeRelation {
    return new NodeRelation(
      this.id,
      this.tableId,
      sourceNodeId,
      this.sourceExternalId,
      targetNodeId,
      this.targetExternalId,
      this.relationTypeId,
      this.properties,
      this.strength,
      this.createdAt,
      new Date()
    )
  }

  // Getters
  getId(): NodeRelationId {
    return this.id
  }

  getTableId(): TableId {
    return this.tableId
  }

  getSourceNodeId(): NodeId | null {
    return this.sourceNodeId
  }

  getSourceExternalId(): string {
    return this.sourceExternalId
  }

  getTargetNodeId(): NodeId | null {
    return this.targetNodeId
  }

  getTargetExternalId(): string {
    return this.targetExternalId
  }

  getRelationTypeId(): RelationTypeId {
    return this.relationTypeId
  }

  getProperties(): Record<string, any> | null {
    return this.properties
  }

  getStrength(): number {
    return this.strength
  }

  getCreatedAt(): Date {
    return this.createdAt
  }

  getUpdatedAt(): Date {
    return this.updatedAt
  }

  // Helper methods
  isIncoming(nodeId: NodeId): boolean {
    return this.targetNodeId === nodeId
  }

  isOutgoing(nodeId: NodeId): boolean {
    return this.sourceNodeId === nodeId
  }

  getRelatedNodeId(nodeId: NodeId): NodeId | null {
    if (this.sourceNodeId === nodeId) {
      return this.targetNodeId
    }
    if (this.targetNodeId === nodeId) {
      return this.sourceNodeId
    }
    return null
  }

  // Database conversion
  toDatabase(): {
    id: string | null
    table_id: string
    source_node_id: string | null
    source_external_id: string
    target_node_id: string | null
    target_external_id: string
    relation_type_id: string
    properties: string | null
    strength: number
    created_at: string
    updated_at: string
  } {
    return {
      id: this.id as string | null,
      table_id: this.tableId as string,
      source_node_id: this.sourceNodeId as string | null,
      source_external_id: this.sourceExternalId,
      target_node_id: this.targetNodeId as string | null,
      target_external_id: this.targetExternalId,
      relation_type_id: this.relationTypeId as string,
      properties: this.properties ? JSON.stringify(this.properties) : null,
      strength: this.strength,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
    }
  }
}

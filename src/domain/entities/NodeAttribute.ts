import type { AttributeId, NodeId } from '@/core/types/CommonTypes.js'
import { DomainException } from '@/shared/exceptions/DomainException.js'
import type { SafeJsonValue } from '@/shared/utils/safeJson.js'

export class NodeAttribute {
  constructor(
    private readonly id: string | null,
    private readonly nodeId: NodeId,
    private readonly attributeId: AttributeId,
    private readonly value: string,
    private readonly createdAt: Date,
    private readonly updatedAt: Date,
  ) {
    this.validateValue(value)
  }

  static create(nodeId: NodeId, attributeId: AttributeId, value: string): NodeAttribute {
    return new NodeAttribute(null, nodeId, attributeId, value, new Date(), new Date())
  }

  static fromDatabase(
    id: string,
    nodeId: string,
    attributeId: string,
    value: string,
    createdAt: Date,
    updatedAt: Date,
  ): NodeAttribute {
    return new NodeAttribute(id, nodeId as NodeId, attributeId as AttributeId, value, createdAt, updatedAt)
  }

  private validateValue(value: string): void {
    if (value === null || value === undefined) {
      throw new DomainException('NodeAttribute value cannot be null', { code: 'DOMAIN_ERROR' })
    }

    // Value is stored as string (can be JSON for complex types)
    // Maximum size for TEXT in SQLite
    if (value.length > 65535) {
      throw new DomainException('NodeAttribute value cannot exceed 65535 characters', {
        code: 'DOMAIN_ERROR',
      })
    }
  }

  getId(): string | null {
    return this.id
  }

  getNodeId(): NodeId {
    return this.nodeId
  }

  getAttributeId(): AttributeId {
    return this.attributeId
  }

  getValue(): string {
    return this.value
  }

  getCreatedAt(): Date {
    return this.createdAt
  }

  getUpdatedAt(): Date {
    return this.updatedAt
  }

  // Try to parse value as JSON if applicable
  getParsedValue(): SafeJsonValue | string {
    try {
      return JSON.parse(this.value)
    } catch {
      return this.value
    }
  }

  updateValue(value: string): NodeAttribute {
    this.validateValue(value)
    return new NodeAttribute(this.id, this.nodeId, this.attributeId, value, this.createdAt, new Date())
  }

  toDatabase(): {
    id: string | null
    node_id: NodeId
    attribute_id: AttributeId
    value: string
    created_at: string
    updated_at: string
  } {
    return {
      id: this.id,
      node_id: this.nodeId,
      attribute_id: this.attributeId,
      value: this.value,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
    }
  }
}

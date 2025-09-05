import type { AttributeId, AttributeTypeId, TableId } from '@/core/types/CommonTypes.js'
import { DomainException } from '@/shared/exceptions/DomainException.js'

export class Attribute {
  constructor(
    private readonly id: AttributeId,
    private readonly tableId: TableId,
    private readonly identifier: string,
    private readonly attributeTypeId: AttributeTypeId,
    private readonly description: string | null,
    private readonly isRequired: boolean,
    private readonly metadata: string | null,
    private readonly createdAt: Date,
    private readonly updatedAt: Date
  ) {
    this.validateIdentifier(identifier)
    this.validateMetadata()
  }

  static create(
    tableId: TableId,
    identifier: string,
    attributeTypeId: AttributeTypeId,
    description?: string,
    isRequired: boolean = false,
    metadata?: string
  ): Attribute {
    return new Attribute(
      null as any as AttributeId,
      tableId,
      identifier,
      attributeTypeId,
      description || null,
      isRequired,
      metadata || null,
      new Date(),
      new Date()
    )
  }

  static fromDatabase(
    id: string,
    tableId: string,
    identifier: string,
    attributeTypeId: string,
    description: string | null,
    isRequired: boolean,
    metadata: string | null,
    createdAt: Date,
    updatedAt: Date
  ): Attribute {
    return new Attribute(
      id as AttributeId,
      tableId as TableId,
      identifier,
      attributeTypeId as AttributeTypeId,
      description,
      isRequired,
      metadata,
      createdAt,
      updatedAt
    )
  }

  private validateIdentifier(identifier: string): void {
    if (!identifier || identifier.trim() === '') {
      throw new DomainException('Attribute identifier cannot be empty', { code: 'DOMAIN_ERROR' })
    }

    if (!/^[a-z][a-z0-9_]*$/.test(identifier)) {
      throw new DomainException(
        'Attribute identifier must start with lowercase letter and contain only lowercase letters, numbers, and underscores',
        { code: 'DOMAIN_ERROR' }
      )
    }

    if (identifier.length > 50) {
      throw new DomainException('Attribute identifier cannot exceed 50 characters', { code: 'DOMAIN_ERROR' })
    }
  }

  private validateMetadata(): void {
    if (this.metadata !== null) {
      try {
        JSON.parse(this.metadata)
      } catch (error) {
        throw new DomainException('Attribute metadata must be valid JSON', { code: 'DOMAIN_ERROR' })
      }
    }
  }

  getId(): AttributeId {
    return this.id
  }

  getTableId(): TableId {
    return this.tableId
  }

  getIdentifier(): string {
    return this.identifier
  }

  getAttributeTypeId(): AttributeTypeId {
    return this.attributeTypeId
  }

  getDescription(): string | null {
    return this.description
  }

  getIsRequired(): boolean {
    return this.isRequired
  }

  getMetadata(): string | null {
    return this.metadata
  }

  getCreatedAt(): Date {
    return this.createdAt
  }

  getUpdatedAt(): Date {
    return this.updatedAt
  }

  getParsedMetadata(): object | null {
    if (!this.metadata) return null
    try {
      return JSON.parse(this.metadata)
    } catch {
      return null
    }
  }

  updateDescription(description: string | null): Attribute {
    return new Attribute(
      this.id,
      this.tableId,
      this.identifier,
      this.attributeTypeId,
      description,
      this.isRequired,
      this.metadata,
      this.createdAt,
      new Date()
    )
  }

  updateRequiredStatus(isRequired: boolean): Attribute {
    return new Attribute(
      this.id,
      this.tableId,
      this.identifier,
      this.attributeTypeId,
      this.description,
      isRequired,
      this.metadata,
      this.createdAt,
      new Date()
    )
  }

  updateMetadata(metadata: string | null): Attribute {
    if (metadata !== null) {
      try {
        JSON.parse(metadata)
      } catch (error) {
        throw new DomainException('Attribute metadata must be valid JSON', { code: 'DOMAIN_ERROR' })
      }
    }

    return new Attribute(
      this.id,
      this.tableId,
      this.identifier,
      this.attributeTypeId,
      this.description,
      this.isRequired,
      metadata,
      this.createdAt,
      new Date()
    )
  }

  toDatabase(): {
    id: AttributeId | null
    table_id: TableId
    identifier: string
    attribute_type_id: AttributeTypeId
    description: string | null
    is_required: boolean
    metadata: string | null
    created_at: string
    updated_at: string
  } {
    return {
      id: this.id,
      table_id: this.tableId,
      identifier: this.identifier,
      attribute_type_id: this.attributeTypeId,
      description: this.description,
      is_required: this.isRequired,
      metadata: this.metadata,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
    }
  }
}

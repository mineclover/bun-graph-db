import type { RelationTypeId } from '@/core/types/CommonTypes.js'
import { DomainException } from '@/shared/exceptions/DomainException.js'

export class RelationType {
  constructor(
    private readonly id: RelationTypeId,
    private readonly identifier: string,
    private readonly description: string | null,
    private readonly category: string | null,
    private readonly createdAt: Date,
    private readonly updatedAt: Date,
  ) {
    this.validateIdentifier(identifier)
  }

  static create(identifier: string, description?: string, category?: string): RelationType {
    return new RelationType(
      '' as RelationTypeId,
      identifier,
      description || null,
      category || null,
      new Date(),
      new Date(),
    )
  }

  static fromDatabase(
    id: string,
    identifier: string,
    description: string | null,
    category: string | null,
    createdAt: Date,
    updatedAt: Date,
  ): RelationType {
    return new RelationType(id as RelationTypeId, identifier, description, category, createdAt, updatedAt)
  }

  private validateIdentifier(identifier: string): void {
    if (!identifier || identifier.trim().length === 0) {
      throw new DomainException('RelationType identifier is required')
    }

    if (identifier.length > 50) {
      throw new DomainException('RelationType identifier must be 50 characters or less')
    }

    // Only allow alphanumeric characters, underscores, and hyphens
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(identifier)) {
      throw new DomainException(
        'RelationType identifier must start with a letter and contain only alphanumeric characters, underscores, and hyphens',
      )
    }
  }

  // Update methods
  updateDescription(description: string | null): RelationType {
    return new RelationType(this.id, this.identifier, description, this.category, this.createdAt, new Date())
  }

  updateCategory(category: string | null): RelationType {
    return new RelationType(this.id, this.identifier, this.description, category, this.createdAt, new Date())
  }

  // Getters
  getId(): RelationTypeId {
    return this.id
  }

  getIdentifier(): string {
    return this.identifier
  }

  getDescription(): string | null {
    return this.description
  }

  getCategory(): string | null {
    return this.category
  }

  getCreatedAt(): Date {
    return this.createdAt
  }

  getUpdatedAt(): Date {
    return this.updatedAt
  }

  // Database conversion
  toDatabase(): {
    id: string | null
    identifier: string
    description: string | null
    category: string | null
    created_at: string
    updated_at: string
  } {
    return {
      id: this.id as string | null,
      identifier: this.identifier,
      description: this.description,
      category: this.category,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
    }
  }
}

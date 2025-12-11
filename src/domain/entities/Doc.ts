import type { DocId, TableId, TimestampedEntity } from '@/core/types/CommonTypes.js'
import { DomainException } from '@/shared/exceptions/DomainException.js'

export enum DocCategory {
  USAGE = 'usage',
  GUIDE = 'guide',
  EXAMPLE = 'example',
  SPEC = 'spec',
  GENERAL = 'general',
}

export class Doc implements TimestampedEntity {
  private constructor(
    private readonly _id: DocId,
    private readonly _tableId: TableId,
    private readonly _category: DocCategory,
    private readonly _version: number,
    private _content: string,
    private _isActive: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  // Factory method for creating new docs
  static create(tableId: TableId, category: DocCategory, content: string, version: number = 1): Doc {
    if (!tableId) {
      throw new DomainException('Table ID is required for doc creation')
    }

    if (!content || content.trim().length === 0) {
      throw new DomainException('Doc content cannot be empty')
    }

    if (content.length > 50000) {
      throw new DomainException('Doc content cannot exceed 50,000 characters')
    }

    if (version < 1) {
      throw new DomainException('Doc version must be at least 1')
    }

    if (!Object.values(DocCategory).includes(category)) {
      throw new DomainException(`Invalid doc category: ${category}`)
    }

    return new Doc(
      null as any as DocId, // Will be set after database insertion
      tableId,
      category,
      version,
      content.trim(),
      true, // New docs are active by default
      new Date(),
      new Date(),
    )
  }

  // Factory method for reconstructing from database
  static fromDatabase(
    id: string,
    tableId: string,
    category: string,
    version: number,
    content: string,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date,
  ): Doc {
    return new Doc(
      id as DocId,
      tableId as TableId,
      category as DocCategory,
      version,
      content,
      isActive,
      createdAt,
      updatedAt,
    )
  }

  // Getters
  get id(): DocId {
    return this._id
  }

  get tableId(): TableId {
    return this._tableId
  }

  get category(): DocCategory {
    return this._category
  }

  get version(): number {
    return this._version
  }

  get content(): string {
    return this._content
  }

  get isActive(): boolean {
    return this._isActive
  }

  get createdAt(): Date {
    return this._createdAt
  }

  get updatedAt(): Date {
    return this._updatedAt
  }

  // Business methods
  updateContent(content: string): void {
    if (!content || content.trim().length === 0) {
      throw new DomainException('Doc content cannot be empty')
    }

    if (content.length > 50000) {
      throw new DomainException('Doc content cannot exceed 50,000 characters')
    }

    this._content = content.trim()
    this._updatedAt = new Date()
  }

  activate(): void {
    this._isActive = true
    this._updatedAt = new Date()
  }

  deactivate(): void {
    this._isActive = false
    this._updatedAt = new Date()
  }

  createNextVersion(content: string): Doc {
    return Doc.create(this._tableId, this._category, content, this._version + 1)
  }

  // Validation methods
  canBeDeleted(): boolean {
    // Docs can always be deleted (no complex business rules for now)
    return true
  }

  // Database serialization
  toDatabase(): {
    id: string | null
    table_id: string
    category: string
    version: number
    content: string
    is_active: boolean
    created_at: Date
    updated_at: Date
  } {
    return {
      id: this._id,
      table_id: this._tableId,
      category: this._category,
      version: this._version,
      content: this._content,
      is_active: this._isActive,
      created_at: this._createdAt,
      updated_at: this._updatedAt,
    }
  }
}

import type { NodeId, TableId } from '@/core/types/CommonTypes.js'
import { DomainException } from '@/shared/exceptions/DomainException.js'
import { parseSafeJson, stringifySafeJson, type SafeJsonValue } from '@/shared/utils/safeJson.js'

export class Node {
  constructor(
    private readonly id: NodeId,
    private readonly tableId: TableId,
    private readonly content: string,
    private readonly title: string | null,
    private readonly description: string | null,
    private readonly metadata: string | null,
    private readonly createdAt: Date,
    private readonly updatedAt: Date,
  ) {
    this.validateContent(content)
    this.validateTitle(title)
    this.validateMetadata(metadata)
  }

  static create(tableId: TableId, content: string, title?: string, description?: string, metadata?: unknown): Node {
    return new Node(
      '' as NodeId,
      tableId,
      content,
      title || null,
      description || null,
      stringifySafeJson(metadata),
      new Date(),
      new Date(),
    )
  }

  static fromDatabase(
    id: string,
    tableId: string,
    content: string,
    title: string | null,
    description: string | null,
    metadataOrCreatedAt: string | null | Date,
    createdAtOrUpdatedAt: Date,
    updatedAtMaybe?: Date,
  ): Node {
    const metadata = metadataOrCreatedAt instanceof Date ? null : metadataOrCreatedAt
    const createdAt = metadataOrCreatedAt instanceof Date ? metadataOrCreatedAt : createdAtOrUpdatedAt
    const updatedAt = metadataOrCreatedAt instanceof Date ? createdAtOrUpdatedAt : updatedAtMaybe

    if (!updatedAt) {
      throw new DomainException('Updated timestamp is required when restoring a node from storage', {
        code: 'DOMAIN_ERROR',
      })
    }

    return new Node(id as NodeId, tableId as TableId, content, title, description, metadata, createdAt, updatedAt)
  }

  private validateContent(content: string): void {
    if (!content || content.trim() === '') {
      throw new DomainException('Node content cannot be empty', { code: 'DOMAIN_ERROR' })
    }

    if (content.length > 20000) {
      throw new DomainException('Node content cannot exceed 20000 characters', {
        code: 'DOMAIN_ERROR',
      })
    }
  }

  private validateTitle(title: string | null): void {
    if (title && title.length > 255) {
      throw new DomainException('Node title cannot exceed 255 characters', { code: 'DOMAIN_ERROR' })
    }
  }

  private validateMetadata(metadata: string | null): void {
    if (!metadata) {
      return
    }

    try {
      parseSafeJson(metadata)
    } catch {
      throw new DomainException('Node metadata must be valid JSON', { code: 'DOMAIN_ERROR' })
    }
  }

  getId(): NodeId {
    return this.id
  }

  getTableId(): TableId {
    return this.tableId
  }

  getContent(): string {
    return this.content
  }

  getTitle(): string | null {
    return this.title
  }

  getDescription(): string | null {
    return this.description
  }

  getMetadata(): string | null {
    return this.metadata
  }

  getParsedMetadata(): SafeJsonValue | null {
    return parseSafeJson(this.metadata)
  }

  getCreatedAt(): Date {
    return this.createdAt
  }

  getUpdatedAt(): Date {
    return this.updatedAt
  }

  updateTitle(title: string | null): Node {
    this.validateTitle(title)
    return new Node(this.id, this.tableId, this.content, title, this.description, this.metadata, this.createdAt, new Date())
  }

  updateDescription(description: string | null): Node {
    return new Node(this.id, this.tableId, this.content, this.title, description, this.metadata, this.createdAt, new Date())
  }

  updateContent(content: string): Node {
    this.validateContent(content)
    return new Node(this.id, this.tableId, content, this.title, this.description, this.metadata, this.createdAt, new Date())
  }

  updateMetadata(metadata: unknown): Node {
    return new Node(
      this.id,
      this.tableId,
      this.content,
      this.title,
      this.description,
      stringifySafeJson(metadata),
      this.createdAt,
      new Date(),
    )
  }

  toDatabase(): {
    id: NodeId | null
    table_id: TableId
    content: string
    title: string | null
    description: string | null
    metadata: string | null
    created_at: string
    updated_at: string
  } {
    return {
      id: this.id,
      table_id: this.tableId,
      content: this.content,
      title: this.title,
      description: this.description,
      metadata: this.metadata,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
    }
  }
}

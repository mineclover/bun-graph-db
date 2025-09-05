import type { NodeId, TableId } from '@/core/types/CommonTypes.js'
import { DomainException } from '@/shared/exceptions/DomainException.js'

export class Node {
  constructor(
    private readonly id: NodeId,
    private readonly tableId: TableId,
    private readonly content: string,
    private readonly title: string | null,
    private readonly description: string | null,
    private readonly createdAt: Date,
    private readonly updatedAt: Date
  ) {
    this.validateContent(content)
    this.validateTitle(title)
  }

  static create(tableId: TableId, content: string, title?: string, description?: string): Node {
    return new Node(
      null as any as NodeId,
      tableId,
      content,
      title || null,
      description || null,
      new Date(),
      new Date()
    )
  }

  static fromDatabase(
    id: string,
    tableId: string,
    content: string,
    title: string | null,
    description: string | null,
    createdAt: Date,
    updatedAt: Date
  ): Node {
    return new Node(
      id as NodeId,
      tableId as TableId,
      content,
      title,
      description,
      createdAt,
      updatedAt
    )
  }

  private validateContent(content: string): void {
    if (!content || content.trim() === '') {
      throw new DomainException('Node content cannot be empty', 'DOMAIN_ERROR')
    }

    if (content.length > 1000) {
      throw new DomainException('Node content cannot exceed 1000 characters', 'DOMAIN_ERROR')
    }
  }

  private validateTitle(title: string | null): void {
    if (title && title.length > 255) {
      throw new DomainException('Node title cannot exceed 255 characters', 'DOMAIN_ERROR')
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

  getCreatedAt(): Date {
    return this.createdAt
  }

  getUpdatedAt(): Date {
    return this.updatedAt
  }

  updateTitle(title: string | null): Node {
    this.validateTitle(title)
    return new Node(
      this.id,
      this.tableId,
      this.content,
      title,
      this.description,
      this.createdAt,
      new Date()
    )
  }

  updateDescription(description: string | null): Node {
    return new Node(
      this.id,
      this.tableId,
      this.content,
      this.title,
      description,
      this.createdAt,
      new Date()
    )
  }

  updateContent(content: string): Node {
    this.validateContent(content)
    return new Node(
      this.id,
      this.tableId,
      content,
      this.title,
      this.description,
      this.createdAt,
      new Date()
    )
  }

  toDatabase(): {
    id: NodeId | null
    table_id: TableId
    content: string
    title: string | null
    description: string | null
    created_at: string
    updated_at: string
  } {
    return {
      id: this.id,
      table_id: this.tableId,
      content: this.content,
      title: this.title,
      description: this.description,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
    }
  }
}

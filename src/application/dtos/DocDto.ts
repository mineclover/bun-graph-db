import type { Doc, DocCategory } from '@/domain/entities/Doc.js'

export class DocDto {
  constructor(
    public readonly id: string,
    public readonly tableId: string,
    public readonly category: DocCategory,
    public readonly version: number,
    public readonly content: string,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static fromEntity(doc: Doc): DocDto {
    return new DocDto(
      doc.id,
      doc.tableId,
      doc.category,
      doc.version,
      doc.content,
      doc.isActive,
      doc.createdAt,
      doc.updatedAt,
    )
  }

  static fromEntities(docs: Doc[]): DocDto[] {
    return docs.map((doc) => DocDto.fromEntity(doc))
  }

  // Helper methods for GraphQL
  toGraphQL() {
    // Map domain enum values to GraphQL enum values
    const categoryMapping: Record<string, string> = {
      usage: 'USAGE',
      guide: 'GUIDE',
      example: 'EXAMPLE',
      spec: 'SPEC',
      general: 'GENERAL',
    }

    return {
      id: this.id,
      tableId: this.tableId,
      category: categoryMapping[this.category] || this.category,
      version: this.version,
      content: this.content,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}

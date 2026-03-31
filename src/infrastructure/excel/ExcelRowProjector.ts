import type {
  ExcelSheetSchema,
  ExcelTableRow,
} from './types/ExcelRowSchema.js'

export interface ExcelProjectableNode {
  id: string
  title?: string | null
  content: string
  description?: string | null
  createdAt?: string
  updatedAt?: string
  attributes?: Record<string, unknown>
}

export class ExcelRowProjector {
  projectRows(
    schema: ExcelSheetSchema,
    nodes: ExcelProjectableNode[],
  ): ExcelTableRow[] {
    return nodes.map((node) => this.projectRow(schema, node))
  }

  projectRow(
    schema: ExcelSheetSchema,
    node: ExcelProjectableNode,
  ): ExcelTableRow {
    const row: ExcelTableRow = {}

    for (const column of schema.columns) {
      if (column.sourceType === 'system') {
        row[column.columnName] = this.resolveSystemValue(node, column.sourceKey)
        continue
      }

      row[column.columnName] = this.normalizeCellValue(
        node.attributes?.[column.sourceKey],
      )
    }

    return row
  }

  private resolveSystemValue(
    node: ExcelProjectableNode,
    sourceKey: string,
  ): ExcelTableRow[string] {
    switch (sourceKey) {
      case 'id':
        return node.id
      case 'title':
        return node.title ?? ''
      case 'content':
        return node.content
      case 'description':
        return node.description ?? ''
      case 'createdAt':
        return node.createdAt ?? ''
      case 'updatedAt':
        return node.updatedAt ?? ''
      default:
        return ''
    }
  }

  private normalizeCellValue(value: unknown): ExcelTableRow[string] {
    if (value === null || value === undefined) {
      return null
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value
    }

    return JSON.stringify(value)
  }
}

import {
  type EnhancedSortOption,
  type SortContext,
  type SortResult,
  SortStrategy,
} from '@/domain/value-objects/SortStrategy.js'

export class TextSortStrategy extends SortStrategy {
  canHandle(_field: string, dataType: string): boolean {
    return (
      dataType === 'string' ||
      dataType === 'text' ||
      dataType === 'varchar' ||
      dataType === 'json' ||
      !this.isNumericOrDate(dataType)
    )
  }

  private isNumericOrDate(dataType: string): boolean {
    const numericTypes = ['number', 'integer', 'float', 'decimal', 'datetime', 'date', 'timestamp']
    return numericTypes.includes(dataType.toLowerCase())
  }

  buildSortClause(field: string, direction: 'asc' | 'desc', context: SortContext): SortResult {
    const attribute = context.availableAttributes.find((attr) => attr.identifier === field)

    if (!attribute && !['created_at', 'updated_at', 'title', 'content'].includes(field)) {
      throw new Error(`Attribute '${field}' not found for text sorting`)
    }

    // Handle system fields (node fields)
    if (['created_at', 'updated_at', 'title', 'content'].includes(field)) {
      return {
        sqlClause: `${context.nodeAlias}.${field} COLLATE NOCASE ${direction.toUpperCase()}`,
        parameters: [],
      }
    }

    // For custom text attributes with enhanced null handling and case-insensitive sorting
    const sqlClause = `
      CASE
        WHEN ${context.attributeAlias}.value IS NULL THEN ${direction === 'asc' ? '1' : '0'}
        WHEN ${context.attributeAlias}.value = '' THEN ${direction === 'asc' ? '1' : '0'}
        ELSE ${direction === 'asc' ? '0' : '1'}
      END,
      CASE
        WHEN ${context.attributeAlias}.value IS NOT NULL AND ${context.attributeAlias}.value != ''
        THEN ${context.attributeAlias}.value COLLATE NOCASE
        ELSE ${direction === 'asc' ? "'ZZZZZ'" : "'AAAAA'"}
      END ${direction.toUpperCase()}`

    return {
      sqlClause,
      parameters: [],
    }
  }

  getPriority(): number {
    return 50 // Medium priority, used as fallback for unknown types
  }

  override buildEnhancedSortClause(
    sortOption: EnhancedSortOption,
    context: SortContext
  ): SortResult {
    const field = sortOption.field
    const direction = sortOption.direction
    const attribute = context.availableAttributes.find((attr) => attr.identifier === field)

    if (!attribute && !['created_at', 'updated_at', 'title', 'content'].includes(field)) {
      throw new Error(`Attribute '${field}' not found for text sorting`)
    }

    // Handle system fields (node fields)
    if (['created_at', 'updated_at', 'title', 'content'].includes(field)) {
      const collation = sortOption.caseSensitive === true ? 'BINARY' : 'NOCASE'
      return {
        sqlClause: `${context.nodeAlias}.${field} COLLATE ${collation} ${direction.toUpperCase()}`,
        parameters: [],
      }
    }

    // For custom text attributes with enhanced options
    const collation = sortOption.caseSensitive === true ? 'BINARY' : 'NOCASE'
    const nullHandling = this.buildNullHandling(sortOption, context)

    const sqlClause = `
      ${nullHandling}
      CASE
        WHEN ${context.attributeAlias}.value IS NOT NULL AND ${context.attributeAlias}.value != ''
        THEN ${context.attributeAlias}.value COLLATE ${collation}
        ELSE ${direction === 'asc' ? "'ZZZZZ'" : "'AAAAA'"}
      END ${direction.toUpperCase()}`

    return {
      sqlClause,
      parameters: [],
    }
  }

  /**
   * Normalizes text for sorting (trim whitespace, handle empty strings)
   */
  static normalizeText(value: string): string {
    if (!value || typeof value !== 'string') return ''
    return value.trim()
  }

  /**
   * Checks if a text value is effectively empty (null, undefined, or whitespace)
   */
  static isEmptyText(value: string | null | undefined): boolean {
    return !value || value.trim() === ''
  }

  /**
   * Performs case-insensitive comparison of two text values
   */
  static compareText(a: string, b: string, direction: 'asc' | 'desc' = 'asc'): number {
    const normalizedA = TextSortStrategy.normalizeText(a).toLowerCase()
    const normalizedB = TextSortStrategy.normalizeText(b).toLowerCase()

    if (normalizedA === normalizedB) return 0

    const comparison = normalizedA < normalizedB ? -1 : 1
    return direction === 'asc' ? comparison : -comparison
  }

  /**
   * Natural sort comparison for alphanumeric strings (e.g., "item1", "item2", "item10")
   */
  static naturalCompare(a: string, b: string, direction: 'asc' | 'desc' = 'asc'): number {
    const normalizedA = TextSortStrategy.normalizeText(a)
    const normalizedB = TextSortStrategy.normalizeText(b)

    // Use Intl.Collator for natural sorting if available
    if (typeof Intl !== 'undefined' && Intl.Collator) {
      const collator = new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: 'base',
      })
      const comparison = collator.compare(normalizedA, normalizedB)
      return direction === 'asc' ? comparison : -comparison
    }

    // Fallback to basic comparison
    return TextSortStrategy.compareText(normalizedA, normalizedB, direction)
  }

  /**
   * Sorts an array of strings using natural comparison
   */
  static sortTextArray(
    values: string[],
    direction: 'asc' | 'desc' = 'asc',
    natural: boolean = true
  ): string[] {
    const compareFunction = natural ? TextSortStrategy.naturalCompare : TextSortStrategy.compareText

    return [...values].sort((a, b) => compareFunction(a, b, direction))
  }
}

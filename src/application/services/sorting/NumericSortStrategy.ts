import {
  type SortContext,
  type SortResult,
  SortStrategy,
} from '@/domain/value-objects/SortStrategy.js'

export class NumericSortStrategy extends SortStrategy {
  canHandle(_field: string, dataType: string): boolean {
    return (
      dataType === 'number' ||
      dataType === 'integer' ||
      dataType === 'float' ||
      dataType === 'decimal'
    )
  }

  buildSortClause(field: string, direction: 'asc' | 'desc', context: SortContext): SortResult {
    const attribute = context.availableAttributes.find((attr) => attr.identifier === field)

    if (!attribute) {
      throw new Error(`Attribute '${field}' not found for numeric sorting`)
    }

    // Handle system fields (created_at, updated_at) that don't need attribute joins
    if (field === 'created_at' || field === 'updated_at') {
      return {
        sqlClause: `${context.nodeAlias}.${field} ${direction.toUpperCase()}`,
        parameters: [],
      }
    }

    // For custom attributes, we need to handle numeric conversion and null values
    const _nullHandling = direction === 'asc' ? 'NULLS LAST' : 'NULLS FIRST'

    // Cast to REAL for SQLite numeric sorting with proper null handling
    const sqlClause = `
      CASE
        WHEN ${context.attributeAlias}.value IS NULL THEN ${direction === 'asc' ? '1' : '0'}
        WHEN ${context.attributeAlias}.value = '' THEN ${direction === 'asc' ? '1' : '0'}
        ELSE ${direction === 'asc' ? '0' : '1'}
      END,
      CASE
        WHEN ${context.attributeAlias}.value IS NOT NULL AND ${context.attributeAlias}.value != ''
        THEN CAST(${context.attributeAlias}.value AS REAL)
        ELSE ${direction === 'asc' ? '999999999' : '-999999999'}
      END ${direction.toUpperCase()}`

    return {
      sqlClause,
      parameters: [],
    }
  }

  getPriority(): number {
    return 100 // High priority for numeric fields
  }

  /**
   * Validates if a string value can be converted to a number
   */
  static isValidNumeric(value: string): boolean {
    if (!value || value.trim() === '') return false
    const num = Number(value)
    return !Number.isNaN(num) && Number.isFinite(num)
  }

  /**
   * Safely converts a string to number with fallback
   */
  static safeParseNumber(value: string, fallback: number = 0): number {
    if (!NumericSortStrategy.isValidNumeric(value)) return fallback
    return Number(value)
  }
}

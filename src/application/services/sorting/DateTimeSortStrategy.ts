import {
  type SortContext,
  type SortResult,
  SortStrategy,
} from '@/domain/value-objects/SortStrategy.js'

export class DateTimeSortStrategy extends SortStrategy {
  canHandle(field: string, dataType: string): boolean {
    return (
      dataType === 'datetime' ||
      dataType === 'date' ||
      dataType === 'timestamp' ||
      field === 'created_at' ||
      field === 'updated_at'
    )
  }

  buildSortClause(field: string, direction: 'asc' | 'desc', context: SortContext): SortResult {
    // Handle system fields (created_at, updated_at) that don't need attribute joins
    if (field === 'created_at' || field === 'updated_at') {
      return {
        sqlClause: `${context.nodeAlias}.${field} ${direction.toUpperCase()}`,
        parameters: [],
      }
    }

    const attribute = context.availableAttributes.find((attr) => attr.identifier === field)

    if (!attribute) {
      throw new Error(`Attribute '${field}' not found for datetime sorting`)
    }

    // For custom datetime attributes, handle various datetime formats and null values
    const sqlClause = `
      CASE
        WHEN ${context.attributeAlias}.value IS NULL THEN ${direction === 'asc' ? '1' : '0'}
        WHEN ${context.attributeAlias}.value = '' THEN ${direction === 'asc' ? '1' : '0'}
        ELSE ${direction === 'asc' ? '0' : '1'}
      END,
      CASE
        WHEN ${context.attributeAlias}.value IS NOT NULL AND ${context.attributeAlias}.value != ''
        THEN datetime(${context.attributeAlias}.value)
        ELSE datetime(${direction === 'asc' ? "'9999-12-31 23:59:59'" : "'1900-01-01 00:00:00'"})
      END ${direction.toUpperCase()}`

    return {
      sqlClause,
      parameters: [],
    }
  }

  getPriority(): number {
    return 90 // High priority for datetime fields
  }

  /**
   * Validates if a string value can be parsed as a datetime
   */
  static isValidDateTime(value: string): boolean {
    if (!value || value.trim() === '') return false

    try {
      const date = new Date(value)
      return !Number.isNaN(date.getTime())
    } catch {
      return false
    }
  }

  /**
   * Safely parses a string to ISO datetime string with fallback
   */
  static safeParseDateTime(value: string, fallback?: string): string {
    if (!DateTimeSortStrategy.isValidDateTime(value)) {
      return fallback || new Date().toISOString()
    }

    try {
      return new Date(value).toISOString()
    } catch {
      return fallback || new Date().toISOString()
    }
  }

  /**
   * Formats datetime for SQLite compatibility
   */
  static formatForSQLite(value: string | Date): string {
    const date = typeof value === 'string' ? new Date(value) : value

    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${value}`)
    }

    // SQLite datetime format: YYYY-MM-DD HH:MM:SS
    return date
      .toISOString()
      .replace('T', ' ')
      .replace(/\.\d{3}Z$/, '')
  }

  /**
   * Converts various datetime formats to SQLite-compatible format
   */
  static normalizeDateTime(value: string): string {
    if (!DateTimeSortStrategy.isValidDateTime(value)) {
      throw new Error(`Cannot normalize invalid datetime: ${value}`)
    }

    return DateTimeSortStrategy.formatForSQLite(value)
  }
}

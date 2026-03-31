import type { AttributeTypeInfo } from '@/application/services/SearchQueryParser.js'

export type SortParameterValue = unknown

export interface SortResult {
  sqlClause: string
  parameters: SortParameterValue[]
}

export interface SortContext {
  availableAttributes: AttributeTypeInfo[]
  tableAlias: string
  nodeAlias: string
  attributeAlias: string
}

export abstract class SortStrategy {
  abstract canHandle(field: string, dataType: string): boolean
  abstract buildSortClause(field: string, direction: 'asc' | 'desc', context: SortContext): SortResult
  abstract getPriority(): number

  // New enhanced method for building sort clauses with enhanced options
  buildEnhancedSortClause(sortOption: EnhancedSortOption, context: SortContext): SortResult {
    // Default implementation falls back to the basic method
    // Concrete strategies can override this for enhanced features
    return this.buildSortClause(sortOption.field, sortOption.direction, context)
  }

  // Utility method to detect data type from context
  protected detectDataType(field: string, context: SortContext, hint?: DataType): string {
    if (hint && hint !== 'auto_detect') {
      return hint
    }

    // System fields
    if (['created_at', 'updated_at'].includes(field)) {
      return 'datetime'
    }
    if (['title', 'content'].includes(field)) {
      return 'string'
    }

    // Look up in available attributes
    const attribute = context.availableAttributes.find((attr) => attr.identifier === field)
    return attribute?.dataType || 'string'
  }

  // Utility method to build null handling clause
  protected buildNullHandling(
    sortOption: EnhancedSortOption,
    context: SortContext,
    valueAlias: string = `${context.attributeAlias}.value`,
  ): string {
    const nullHandling = sortOption.nullHandling || 'default'

    switch (nullHandling) {
      case 'first':
        return `CASE WHEN ${valueAlias} IS NULL THEN 0 ELSE 1 END, `
      case 'last':
        return `CASE WHEN ${valueAlias} IS NULL THEN 1 ELSE 0 END, `
      default: {
        const direction = sortOption.direction
        return `CASE WHEN ${valueAlias} IS NULL THEN ${direction === 'asc' ? '1' : '0'} ELSE ${direction === 'asc' ? '0' : '1'} END, `
      }
    }
  }
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export interface SortOption {
  field: string
  direction: SortDirection
  nullHandling?: 'first' | 'last' | 'default'
  customWeight?: number
}

export type DataType = 'string' | 'number' | 'datetime' | 'boolean' | 'json' | 'auto_detect'
export type IndexHint = 'use' | 'ignore' | 'force' | 'auto'
export type SortOptimization = 'speed' | 'memory' | 'accuracy' | 'balanced'

export interface EnhancedSortOption extends SortOption {
  // Type-specific sorting
  dataType?: DataType

  // Text sorting options
  caseSensitive?: boolean
  locale?: string

  // Advanced options
  customComparator?: string // For special sorting logic
  indexHint?: IndexHint

  // Performance optimization
  optimization?: SortOptimization

  // Extended null handling
  nullValue?: unknown // Custom null replacement value
}

export interface MultiCriteriaSortResult {
  sqlClause: string
  parameters: SortParameterValue[]
  sortFields: string[]
}

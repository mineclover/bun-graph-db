import type { AttributeTypeInfo } from '@/application/services/SearchQueryParser.js'

export interface SortResult {
  sqlClause: string
  parameters: any[]
}

export interface SortContext {
  availableAttributes: AttributeTypeInfo[]
  tableAlias: string
  nodeAlias: string
  attributeAlias: string
}

export abstract class SortStrategy {
  abstract canHandle(field: string, dataType: string): boolean
  abstract buildSortClause(
    field: string,
    direction: 'asc' | 'desc',
    context: SortContext
  ): SortResult
  abstract getPriority(): number
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc'
}

export interface SortOption {
  field: string
  direction: SortDirection
  nullHandling?: 'first' | 'last' | 'default'
  customWeight?: number
}

export interface MultiCriteriaSortResult {
  sqlClause: string
  parameters: any[]
  sortFields: string[]
}
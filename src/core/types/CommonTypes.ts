/**
 * Common types used across the application
 */

export type ID = string | number

// Domain-specific ID types
export type TableId = string
export type NodeId = string
export type AttributeId = string
export type AttributeTypeId = string
export type RelationId = string
export type RelationTypeId = string
export type QueryTemplateId = string

export interface BaseEntity {
  id: ID
  createdAt: Date
  updatedAt: Date
}

export interface TimestampedEntity {
  createdAt: Date
  updatedAt: Date
}

export interface PaginationInput {
  limit?: number
  offset?: number
}

export interface PaginatedResult<T> {
  nodes: T[]
  totalCount: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  // Alternative properties for compatibility
  data?: T[]
  items?: T[]
  total?: number
  hasMore?: boolean
}

export interface ErrorInfo {
  message: string
  code: string
  field?: string
}

export interface OperationResult<T = any> {
  success: boolean
  data?: T
  errors: ErrorInfo[]
}

export interface FilterInput {
  search?: string
  createdAfter?: Date
  createdBefore?: Date
}

export type SortDirection = 'ASC' | 'DESC'

export interface SortInput {
  field: string
  direction: SortDirection
}

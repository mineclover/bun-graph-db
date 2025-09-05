/**
 * Common types used across the application
 */

export type ID = string | number

export interface BaseEntity {
  id: ID
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

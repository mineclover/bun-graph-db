/**
 * Common use case type patterns for Input/Output interfaces
 * These generic types improve code reusability and maintainability
 */

import type { PaginationInput } from './CommonTypes.js'

/**
 * Base interface for all entity DTOs
 * Ensures consistent structure across all domain entities
 * Note: DTOs use string timestamps (ISO format) while entities use Date objects
 */
export interface BaseEntityDto {
  id: string
  createdAt: string
  updatedAt: string
}

/**
 * Generic input type for entity creation
 * T represents the fields required to create the entity
 */
export type CreateInput<T> = T

/**
 * Generic input type for entity updates
 * Makes all fields optional (partial updates)
 */
export type UpdateInput<T> = Partial<T>

/**
 * Generic input type for single entity retrieval
 */
export interface GetByIdInput {
  id: string
}

/**
 * Generic input type for entity retrieval by identifier
 */
export interface GetByIdentifierInput {
  identifier: string
}

/**
 * Generic input type for listing entities with pagination and filters
 * T represents additional filter fields specific to the entity type
 */
export type GetManyInput<T = Record<string, never>> = PaginationInput & T

/**
 * Generic output type for entity creation
 * Wraps the created entity DTO
 */
export interface CreateOutput<TEntity> {
  [key: string]: TEntity
}

/**
 * Generic output type for single entity retrieval
 * Returns the entity or null if not found
 */
export interface GetOutput<TEntity> {
  [key: string]: TEntity | null
}

/**
 * Generic output type for listing entities
 * Includes pagination metadata
 */
export interface GetManyOutput<TEntity> {
  items: TEntity[]
  total: number
  hasMore: boolean
}

/**
 * Generic output type for entity updates
 * Returns the updated entity
 */
export interface UpdateOutput<TEntity> {
  [key: string]: TEntity
}

/**
 * Generic output type for entity deletion
 * Returns success status
 */
export interface DeleteOutput {
  success: boolean
}

/**
 * Standard success/error response pattern
 * Used for operations that may have validation or business logic errors
 */
export interface OperationResponse<TData = unknown> {
  success: boolean
  data?: TData
  errors?: Array<{
    message: string
    code: string
    field?: string
  }>
}

/**
 * Generic search input with text query and filters
 * T represents entity-specific filter fields
 */
export interface SearchInput<TFilters = Record<string, never>> extends PaginationInput {
  query?: string
  filters?: TFilters
  sortBy?: Array<{
    field: string
    direction: 'asc' | 'desc' | 'ASC' | 'DESC'
  }>
}

/**
 * Generic search output with results and pagination
 */
export interface SearchOutput<TEntity> {
  results: TEntity[]
  total: number
  totalCount: number
  hasMore: boolean
  hasNextPage: boolean
  hasPreviousPage: boolean
}

/**
 * Type helper to extract entity name from DTO interface name
 * Example: AttributeDto -> Attribute
 */
export type EntityName<T extends string> = T extends `${infer Name}Dto` ? Name : T

/**
 * Type helper to create standard output type names
 * Example: Create<'User'> -> CreateUserOutput
 */
export type OutputTypeName<TOperation extends string, TEntity extends string> = `${TOperation}${TEntity}Output`

/**
 * Common validation input patterns
 */
export interface ValidateUniqueInput {
  identifier: string
  excludeId?: string
}

/**
 * Common bulk operation patterns
 */
export interface BulkCreateInput<T> {
  items: T[]
  validateAll?: boolean
  stopOnError?: boolean
}

export interface BulkUpdateInput<T> {
  updates: Array<{ id: string } & Partial<T>>
  validateAll?: boolean
  stopOnError?: boolean
}

export interface BulkDeleteInput {
  ids: string[]
  force?: boolean
}

export interface BulkOperationResult<TEntity> {
  successful: TEntity[]
  failed: Array<{
    item: unknown
    error: string
  }>
  totalProcessed: number
  successCount: number
  failureCount: number
}

/**
 * Common metadata patterns
 */
export interface WithMetadata<T = Record<string, unknown>> {
  metadata?: T | null
}

/**
 * Common description pattern
 */
export interface WithDescription {
  description?: string | null
}

/**
 * Common identifier pattern
 */
export interface WithIdentifier {
  identifier: string
}

/**
 * Common name pattern
 */
export interface WithName {
  name: string
}

/**
 * Common optional name pattern
 */
export interface WithOptionalName {
  name?: string | null
}

/**
 * Combination patterns for common field groups
 */
export type WithIdentifierAndName = WithIdentifier & WithName
export type WithIdentifierAndOptionalName = WithIdentifier & WithOptionalName
export type WithIdentifierDescription = WithIdentifier & WithDescription
export type WithNameDescription = WithName & WithDescription

/**
 * Type guards for common patterns
 */
export function hasIdentifier(obj: unknown): obj is WithIdentifier {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'identifier' in obj &&
    typeof (obj as WithIdentifier).identifier === 'string'
  )
}

export function hasName(obj: unknown): obj is WithName {
  return typeof obj === 'object' && obj !== null && 'name' in obj && typeof (obj as WithName).name === 'string'
}

export function hasMetadata(obj: unknown): obj is WithMetadata {
  return typeof obj === 'object' && obj !== null && 'metadata' in obj
}

/**
 * Utility type to make specific fields required
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>

/**
 * Utility type to make specific fields optional
 */
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * Utility type to omit common fields (id, timestamps)
 */
export type OmitEntityFields<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>

/**
 * Utility type for creating input from DTO
 * Removes id and timestamps, makes everything optional except required fields
 */
export type ToCreateInput<TDto, TRequired extends keyof OmitEntityFields<TDto> = never> = RequireFields<
  OmitEntityFields<TDto>,
  TRequired
>

/**
 * Utility type for creating update input from DTO
 * Removes id and timestamps, makes everything optional
 */
export type ToUpdateInput<TDto> = Partial<OmitEntityFields<TDto>>

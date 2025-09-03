// Common type definitions used across the application

// Branded types for domain identifiers
export type TableId = string & { readonly __brand: 'TableId' }
export type NodeId = string & { readonly __brand: 'NodeId' }
export type AttributeId = string & { readonly __brand: 'AttributeId' }
export type AttributeTypeId = string & { readonly __brand: 'AttributeTypeId' }
export type RelationId = string & { readonly __brand: 'RelationId' }

// Result pattern for error handling
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E }

// Common interfaces
export interface TimestampedEntity {
  createdAt: Date
  updatedAt: Date
}

export interface IdentifiableEntity {
  id: string
  identifier: string
}

// Pagination
export interface PaginationOptions {
  limit?: number
  offset?: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  hasMore: boolean
}

// Search and filtering
export interface SearchOptions extends PaginationOptions {
  query?: string
  filters?: Record<string, unknown>
  sort?: SortOptions[]
}

export interface SortOptions {
  field: string
  direction: 'ASC' | 'DESC'
}

// Validation
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

// Event system
export interface DomainEvent {
  eventId: string
  eventType: string
  aggregateId: string
  timestamp: Date
  payload: unknown
}

// Cache
export interface CacheEntry<T> {
  data: T
  expiresAt: Date
  key: string
}

// Configuration
export interface DatabaseConfig {
  path: string
  poolSize?: number
  timeout?: number
}

export interface GraphQLConfig {
  port: number
  introspection: boolean
  playground: boolean
  cors: {
    origin: string | string[]
    credentials: boolean
  }
}
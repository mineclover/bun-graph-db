/**
 * Standard GraphQL Response Types
 * Provides consistent typing for GraphQL operations
 */

export interface GraphQLError {
  message: string
  code: string
  path?: string[]
  extensions?: {
    type: 'DOMAIN_ERROR' | 'APPLICATION_ERROR' | 'SYSTEM_ERROR' | 'UNKNOWN_ERROR'
    context?: string
    details?: Record<string, unknown>
    originalError?: string
  }
}

export interface StandardMutationResult<T> {
  success: boolean
  data?: T | null
  errors: GraphQLError[]
}

export interface StandardQueryResult<T> {
  data?: T | null
  errors?: GraphQLError[]
}

export interface PaginatedResult<T> {
  nodes: T[]
  totalCount: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface SearchResult<T> extends PaginatedResult<T> {
  query: {
    originalQuery: string
    parsedConditions: Record<string, unknown>
  }
}

// Node-specific response types
export interface NodeMutationResult<T = any> {
  success: boolean
  data?: T | null
  errors: GraphQLError[]
}

export interface NodeQueryResult {
  node?: any | null
  errors?: GraphQLError[]
}

export interface NodesQueryResult {
  nodes: any[]
  totalCount: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  errors?: GraphQLError[]
}

export interface DeleteResult {
  success: boolean
  errors: GraphQLError[]
}

// Template-specific response types
export interface TemplateResult<T = any> {
  success: boolean
  template?: T | null
  errors: GraphQLError[]
}

export interface TemplatesSearchResult<T = any> {
  nodes: T[]
  totalCount: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  errors?: GraphQLError[]
}

// Schema-specific response types
export interface ExportResult {
  success: boolean
  exportData?: any
  metadata?: {
    exportedAt: string
    version: string
    format: string
    size: number
  }
  errors: GraphQLError[]
}

export interface ImportResult {
  success: boolean
  importSummary?: {
    tablesImported: number
    nodesImported: number
    attributesImported: number
    relationsImported: number
  }
  errors: GraphQLError[]
}

// Validation helpers
export type NonNullable<T> = T extends null | undefined ? never : T

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>

export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// Field resolver wrapper type
export type FieldResolver<TSource, TResult, TContext = any, TArgs = Record<string, unknown>> = (
  source: TSource,
  args: TArgs,
  context: TContext,
  info?: any,
) => Promise<TResult> | TResult

// Query resolver wrapper type
export type QueryResolver<TResult, TContext = any, TArgs = Record<string, unknown>> = (
  parent: any,
  args: TArgs,
  context: TContext,
  info?: any,
) => Promise<TResult> | TResult

// Mutation resolver wrapper type
export type MutationResolver<TResult, TContext = any, TArgs = Record<string, unknown>> = (
  parent: any,
  args: TArgs,
  context: TContext,
  info?: any,
) => Promise<StandardMutationResult<TResult>> | StandardMutationResult<TResult>

// Common validation result
export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

// Context types
export interface ResolverContext {
  requestId: string
  startTime: Date
  user?: {
    id: string
    permissions: string[]
  }
  performance?: {
    queries: number
    mutations: number
    maxDepth: number
  }
}

// Performance monitoring
export interface PerformanceMetrics {
  operationType: 'query' | 'mutation' | 'field'
  operationName: string
  duration: number
  success: boolean
  errorCode?: string
}

export interface ResolverMetadata {
  resolverName: string
  methodName: string
  args: Record<string, unknown>
  context: ResolverContext
  startTime: number
}

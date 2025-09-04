/**
 * Common GraphQL types and interfaces
 */

export interface GraphQLContext {
  requestId: string
  startTime: Date
  user?: {
    id: string
    permissions: string[]
  }
  // Add database connection, services, etc.
}

export type GraphQLParent = any

export interface ResolverInfo {
  fieldName: string
  parentType: string
  path: {
    key: string | number
    prev?: ResolverInfo['path']
  }
  cacheControl?: {
    maxAge?: number
    scope?: 'PUBLIC' | 'PRIVATE'
  }
}
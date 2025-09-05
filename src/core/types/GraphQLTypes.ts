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

// Table GraphQL Arguments
export interface CreateTableArgs {
  input: {
    identifier: string
    description?: string
  }
}

export interface UpdateTableArgs {
  id: string
  input: {
    description?: string
  }
}

export interface DeleteTableArgs {
  id: string
  force?: boolean
  cascadeDelete?: boolean
}

// Node GraphQL Arguments
export interface NodeArgs {
  id: string
}

export interface NodesArgs {
  filter?: {
    tableId?: string
    search?: string
  }
  pagination?: {
    limit?: number
    offset?: number
  }
  sort?: {
    field: string
    direction: 'ASC' | 'DESC'
  }
}

export interface NodeByContentArgs {
  content: string
  tableId?: string
}

export interface SearchNodesArgs {
  filter?: {
    search?: string
    tableId?: string
  }
  pagination?: {
    limit?: number
    offset?: number
  }
  sort?: {
    field: string
    direction: 'ASC' | 'DESC'
  }
}

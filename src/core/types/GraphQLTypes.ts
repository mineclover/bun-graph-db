/**
 * Common GraphQL types and interfaces
 */

// GraphQL Input Types
export interface CreateDocInput {
  title: string
  content?: string
  tags?: string[]
  tableId?: string
  category?: string
  version?: number
  [key: string]: unknown
}

export interface CreateNodeInput {
  tableId: string
  content: string
  metadata?: Record<string, any>
}

export interface CreateRelationInput {
  fromNodeId: string
  toNodeId: string
  relationshipType: string
  properties?: Record<string, any>
}

export interface CreateTableInput {
  identifier: string
  name?: string
  description?: string
  [key: string]: unknown
}

export interface UpdateDocInput {
  title?: string
  content?: string
  tags?: string[]
}

export interface UpdateNodeInput {
  content?: string
  metadata?: Record<string, any>
}

export interface UpdateQueryTemplateInput {
  name?: string
  query?: string
  tags?: string[]
}

export interface UpdateTableInput {
  name?: string
  description?: string
}

// Filter and Pagination Types
export interface DocsFilter {
  tags?: string[]
  search?: string
  category?: string
  isActive?: boolean
  version?: number
  createdAfter?: string
  createdBefore?: string
  tableId?: string
}

export interface SearchNodesFilter {
  tableId?: string
  searchTerm?: string
  limit?: number
}

export interface SearchRelatedNodesFilter {
  nodeId: string
  relationshipType?: string
  direction?: 'incoming' | 'outgoing' | 'both'
  limit?: number
}

export interface TablesFilter {
  search?: string
  hasNodes?: boolean
  createdAfter?: string
  createdBefore?: string
}

export interface TablesPagination {
  limit?: number
  offset?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// Mutation Args Types
export interface MutationDeleteRelationTypeArgs {
  id: string
  [key: string]: unknown
}

export interface MutationUpdateRelationTypeArgs {
  id: string
  input: {
    oldType?: string
    newType?: string
    description?: string
    name?: string
  }
  [key: string]: unknown
}

// Attribute Mutation Args Types
export interface MutationCreateAttributeArgs {
  input: {
    tableId: string
    identifier: string
    name: string
    attributeTypeId: string
    description?: string
  }
  [key: string]: unknown
}

export interface MutationCreateAttributeTypeArgs {
  input: {
    identifier: string
    name: string
    dataType: string
    description?: string
    constraints?: any
    defaultValue?: string
  }
  [key: string]: unknown
}

export interface MutationDeleteAttributeArgs {
  id: string
  [key: string]: unknown
}

export interface MutationDeleteAttributeTypeArgs {
  id: string
  [key: string]: unknown
}

export interface MutationUpdateAttributeArgs {
  id: string
  input: {
    name?: string
    description?: string
  }
  [key: string]: unknown
}

export interface MutationUpdateAttributeTypeArgs {
  id: string
  input: {
    name?: string
    description?: string
    constraints?: any
    defaultValue?: string
  }
  [key: string]: unknown
}

export interface GraphQLContext {
  requestId: string
  startTime: Date
  user?: {
    id: string
    permissions: string[]
  }
  // Add database connection, services, etc.
}

// JSON Value Types
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

// Database Query Parameter Types
export type DatabaseParams = (string | number | boolean | null)[]

// Generic Property Record
export interface PropertyRecord {
  [key: string]: JsonValue
}

// GraphQL Parent Types
export type GraphQLParent = unknown

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

// AttributeFilter input for searchNodes
export interface AttributeFilterInput {
  attributeId?: string
  identifier?: string
  value: string
  operator?: string
}

export interface SearchNodesArgs {
  filter?: {
    search?: string
    tableId?: string
    query?: string // New advanced query field
    attributeFilters?: AttributeFilterInput[] // Attribute-based filtering
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

export interface CreateNodeArgs {
  input: {
    content: string
    tableId: string
    attributes?: Array<{
      attributeId: string
      value: string
    }>
  }
}

export interface UpdateNodeArgs {
  id: string
  input: {
    content: string
  }
}

export interface DeleteNodeArgs {
  id: string
}

export interface SetNodeAttributeArgs {
  input: {
    nodeId: string
    attributeId: string
    value: string
  }
}

// Table Query Arguments
export interface TableArgs {
  id: string
}

export interface TableByIdentifierArgs {
  identifier: string
}

export interface TablesArgs {
  filter?: {
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

// Relation GraphQL Arguments
export interface RelationTypeArgs {
  id: string
}

export interface NodeRelationArgs {
  id: string
}

export interface NodeRelationsArgs {
  filter?: {
    sourceNodeId?: string
    targetNodeId?: string
    relationTypeId?: string
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

export interface SearchRelatedNodesArgs {
  filter?: {
    nodeId?: string
    relationTypeId?: string
    direction?: 'OUTGOING' | 'INCOMING' | 'BOTH'
  }
  pagination?: {
    limit?: number
    offset?: number
  }
}

export interface GetDependencyChainArgs {
  nodeId: string
  maxDepth?: number
  direction?: 'OUTGOING' | 'INCOMING' | 'BOTH'
}

export interface CreateRelationTypeArgs {
  input: {
    identifier: string
    name: string
    description?: string
  }
}

export interface CreateRelationArgs {
  input: {
    tableId: string
    sourceNodeId: string
    targetNodeId: string
    relationTypeId: string
  }
}

export interface DeleteRelationArgs {
  id: string
}

// Attribute GraphQL Arguments
export interface AttributeArgs {
  id: string
}

export interface AttributeByIdentifierArgs {
  identifier: string
}

export interface AttributesArgs {
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

export interface CreateAttributeTypeArgs {
  input: {
    identifier: string
    name: string
    dataType: string
    description?: string
  }
}

export interface UpdateAttributeTypeArgs {
  id: string
  input: {
    name?: string
    description?: string
  }
}

export interface DeleteAttributeTypeArgs {
  id: string
}

export interface CreateAttributeArgs {
  input: {
    identifier: string
    tableId: string
    attributeTypeId: string
    description?: string
    isRequired?: boolean
    defaultValue?: string
    validation?: string
  }
}

export interface UpdateAttributeArgs {
  id: string
  input: {
    description?: string
    isRequired?: boolean
    defaultValue?: string
    validation?: string
  }
}

export interface DeleteAttributeArgs {
  id: string
}

// Schema Export/Import Arguments
export interface ExportTableArgs {
  tableId: string
  options?: {
    includeData?: boolean
    includeRelations?: boolean
    format?: string
    compression?: boolean
  }
}

export interface ExportAllTablesArgs {
  options?: {
    includeData?: boolean
    includeRelations?: boolean
    format?: string
    compression?: boolean
  }
}

export interface ImportSchemaArgs {
  exportData: JsonValue // JSON data
  options?: {
    overwriteExisting?: boolean
    skipDuplicates?: boolean
    validateData?: boolean
    dryRun?: boolean
    conflictResolution?: string
  }
}

// Parent types for field resolvers
export interface NodeParent {
  id: string
  tableId: string
  content: string
  title?: string
  description?: string
  createdAt: Date
  updatedAt: Date
  version: number
}

export interface TableParent {
  id: string
  identifier: string
  description?: string
  createdAt: Date
  updatedAt: Date
  version: number
}

export interface AttributeParent {
  id: string
  identifier: string
  tableId: string
  attributeTypeId: string
  description?: string
  isRequired: boolean
  defaultValue?: string
  validation?: string
  createdAt: Date
  updatedAt: Date
  version: number
}

export interface NodeRelationParent {
  id: string
  sourceNodeId: string
  targetNodeId: string
  relationTypeId: string
  tableId: string
  strength?: number
  confidence?: number
  metadata?: PropertyRecord
  createdAt: Date
  updatedAt: Date
  version: number
}

// Resolver function types
export type GraphQLResolver<TParent = unknown, TArgs = Record<string, unknown>, TResult = unknown> = (
  parent: TParent,
  args: TArgs,
  context: GraphQLContext,
  info?: ResolverInfo,
) => TResult | Promise<TResult>

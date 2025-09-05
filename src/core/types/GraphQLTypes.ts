/**
 * Common GraphQL types and interfaces
 */

// Import generated GraphQL types
export type {
  CreateTableInput,
  UpdateTableInput,
  TablesFilter,
  TablesPagination,
  CreateRelationInput,
  CreateRelationOutput,
  CreateRelationTypeOutput,
  SearchNodesFilter,
  SearchRelatedNodesFilter,
  UpdateQueryTemplateInput,
} from '../../generated/graphql.types.js'

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
  exportData: any // JSON data
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
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
  version: number
}

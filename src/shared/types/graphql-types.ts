// GraphQL-specific type definitions

// Input types
export interface CreateTableInput {
  identifier: string
  description?: string
}

export interface UpdateTableInput {
  description?: string
}

export interface TablesFilter {
  search?: string
  createdAfter?: Date
  createdBefore?: Date
}

export interface TablesPagination {
  limit?: number
  offset?: number
}

export interface CreateNodeInput {
  tableId: string
  content: string
  title?: string
  description?: string
  attributes?: NodeAttributeInput[]
}

export interface NodeAttributeInput {
  attributeId: string
  value: unknown
}

export interface UpdateNodeInput {
  content?: string
  title?: string
  description?: string
}

export interface CreateAttributeTypeInput {
  identifier: string
  jsonType: string
  format?: string
  description?: string
  validationSchema?: unknown
  referenceConfig?: unknown
  defaultValue?: unknown
  examples?: unknown[]
}

export interface CreateAttributeInput {
  tableId: string
  identifier: string
  attributeTypeId: string
  description?: string
  isRequired?: boolean
  metadata?: unknown
}

export interface UpdateAttributeInput {
  description?: string
  isRequired?: boolean
  metadata?: unknown
}

export interface NodeSearchFilter {
  tableId?: string
  content?: string
  title?: string
  hasAttributes?: string[]
  attributeValues?: AttributeValueFilter[]
  createdAfter?: Date
  createdBefore?: Date
}

export interface AttributeValueFilter {
  attributeId: string
  operator: ComparisonOperator
  value: unknown
}

export enum ComparisonOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  CONTAINS = 'CONTAINS',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  IN = 'IN',
  NOT_IN = 'NOT_IN'
}

export interface CreateRelationInput {
  tableId: string
  sourceNodeId?: string
  sourceExternalId?: string
  targetNodeId?: string
  targetExternalId?: string
  relationTypeId: string
  properties?: unknown
  strength?: number
}

// Response/Payload types
export interface GraphQLError {
  message: string
  code: string
  field?: string
}

export interface CreateTablePayload {
  table: TableResponse | null
  errors: GraphQLError[]
}

export interface UpdateTablePayload {
  table: TableResponse | null
  errors: GraphQLError[]
}

export interface DeleteTablePayload {
  success: boolean
  errors: GraphQLError[]
}

// Response types (what GraphQL returns)
export interface TableResponse {
  id: string
  identifier: string
  description: string | null
  createdAt: string
  updatedAt: string
  nodeCount: number
  attributeCount: number
}

export interface NodeResponse {
  id: string
  tableId: string
  content: string
  title: string | null
  description: string | null
  createdAt: string
  updatedAt: string
  attributeCount: number
  relationCount: number
}

export interface AttributeResponse {
  id: string
  identifier: string
  attributeTypeId: string
  tableId: string
  description: string | null
  isRequired: boolean
  metadata: unknown
  createdAt: string
  updatedAt: string
}

export interface AttributeTypeResponse {
  id: string
  identifier: string
  jsonType: string
  format: string | null
  description: string | null
  validationSchema: unknown
  referenceConfig: unknown
  defaultValue: unknown
  examples: unknown[]
  createdAt: string
  updatedAt: string
}

// Connection types for pagination
export interface Connection<T> {
  nodes: T[]
  totalCount: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export type TablesConnection = Connection<TableResponse>
export type NodesConnection = Connection<NodeResponse>
export type AttributesConnection = Connection<AttributeResponse>

// Health check
export interface HealthStatus {
  status: string
  timestamp: string
  database: boolean
  version: string
}

// Subscription event types
export interface TableDeletedEvent {
  id: string
  identifier: string
  deletedAt: string
}

export interface NodeDeletedEvent {
  id: string
  tableId: string
  content: string
  deletedAt: string
}
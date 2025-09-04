// GraphQL resolver type definitions for type safety
export type GraphQLContext = {
  // Add authentication, user context, etc. here if needed
}

export type GraphQLParent = unknown

// Base argument types
export interface BaseArgs {
  [key: string]: unknown
}

export interface IdArgs extends BaseArgs {
  id: string
}

export interface TableIdArgs extends BaseArgs {
  tableId: string
}

export interface IdentifierArgs extends BaseArgs {
  identifier: string
}

export interface PaginationArgs extends BaseArgs {
  limit?: number
  offset?: number
}

// Table resolver argument types
export interface TableArgs extends IdArgs {}
export interface TableByIdentifierArgs extends IdentifierArgs {}
export interface TablesArgs extends PaginationArgs {}
export interface CreateTableArgs extends BaseArgs {
  input: {
    identifier: string
    description?: string
    metadata?: Record<string, unknown>
  }
}
export interface UpdateTableArgs extends BaseArgs {
  id: string
  input: {
    identifier?: string
    description?: string
    metadata?: Record<string, unknown>
  }
}
export interface DeleteTableArgs extends IdArgs {}

// Attribute resolver argument types
export interface AttributeArgs extends IdArgs {}
export interface AttributeByIdentifierArgs extends IdentifierArgs {}
export interface AttributesArgs extends TableIdArgs, PaginationArgs {}
export interface CreateAttributeTypeArgs extends BaseArgs {
  input: {
    identifier: string
    description?: string
    category?: string
  }
}
export interface UpdateAttributeTypeArgs extends BaseArgs {
  id: string
  input: {
    identifier?: string
    description?: string
    category?: string
  }
}
export interface DeleteAttributeTypeArgs extends IdArgs {}
export interface CreateAttributeArgs extends BaseArgs {
  input: {
    tableId: string
    identifier: string
    attributeTypeId: string
    description?: string
    defaultValue?: unknown
    examples?: unknown[]
    isRequired?: boolean
    isSearchable?: boolean
  }
}
export interface UpdateAttributeArgs extends BaseArgs {
  id: string
  input: {
    identifier?: string
    description?: string
    defaultValue?: unknown
    examples?: unknown[]
    isRequired?: boolean
    isSearchable?: boolean
  }
}
export interface DeleteAttributeArgs extends IdArgs {}

// Node resolver argument types
export interface NodeArgs extends IdArgs {}
export interface NodeByContentArgs extends BaseArgs {
  tableId: string
  content: string
}
export interface NodesArgs extends TableIdArgs, PaginationArgs {}
export interface SearchNodesArgs extends BaseArgs {
  input: {
    tableId: string
    query?: string
    limit?: number
    offset?: number
    sortBy?: Array<{
      field: string
      direction: 'asc' | 'desc'
    }>
  }
}
export interface CreateNodeArgs extends BaseArgs {
  input: {
    tableId: string
    content: string
    description?: string
    externalId?: string
    attributes?: Array<{
      attributeId: string
      value: unknown
    }>
  }
}
export interface UpdateNodeArgs extends BaseArgs {
  id: string
  input: {
    content?: string
    description?: string
    externalId?: string
  }
}
export interface DeleteNodeArgs extends IdArgs {}
export interface SetNodeAttributeArgs extends BaseArgs {
  nodeId: string
  attributeId: string
  value: unknown
}

// Relation resolver argument types
export interface NodeRelationArgs extends IdArgs {}
export interface NodeRelationsArgs extends TableIdArgs {}
export interface SearchRelatedNodesArgs extends BaseArgs {
  input: {
    tableId: string
    sourceNodeIds?: string[]
    relationFilters?: Array<{
      relationTypes?: string[]
      properties?: Record<string, unknown>
      direction: 'INCOMING' | 'OUTGOING' | 'BOTH'
      depth: number
    }>
    pathQueries?: Array<{
      startNodeIds?: string[]
      endNodeIds?: string[]
      relationTypes?: string[]
      maxDepth?: number
      shortestPath?: boolean
    }>
    nodeFilters?: Record<string, unknown>
    limit?: number
    offset?: number
  }
}
export interface FindPathsBetweenNodesArgs extends BaseArgs {
  tableId: string
  startNodeIds: string[]
  endNodeIds: string[]
  maxDepth?: number
  relationTypes?: string[]
}
export interface GetDependencyChainArgs extends BaseArgs {
  tableId: string
  nodeId: string
  direction?: 'INCOMING' | 'OUTGOING' | 'BOTH'
  relationTypes?: string[]
}
export interface CreateRelationArgs extends BaseArgs {
  input: {
    tableId: string
    sourceNodeId?: string
    sourceExternalId?: string
    targetNodeId?: string
    targetExternalId?: string
    relationTypeId: string
    properties?: Record<string, unknown>
    strength?: number
    confidence?: number
  }
}
export interface DeleteRelationArgs extends IdArgs {}
export interface CreateRelationTypeArgs extends BaseArgs {
  input: {
    identifier: string
    description?: string
    category?: string
  }
}
export interface RelationTypeArgs extends IdArgs {}

// Analytics resolver argument types
export interface AnalyzeNodesArgs extends BaseArgs {
  input: {
    tableId: string
    analysisType: string
    nodeIds?: string[]
    filters?: Record<string, unknown>
  }
}
export interface GetPerformanceMetricsArgs extends BaseArgs {
  input: {
    tableId: string
    metricType: string
    timeRange?: {
      start: string
      end: string
    }
  }
}
export interface GetTestSuiteStatusArgs extends BaseArgs {
  tableId: string
}
export interface AggregateDataArgs extends BaseArgs {
  input: {
    tableId: string
    aggregationType: string
    groupBy?: string[]
    filters?: Record<string, unknown>
  }
}
export interface GetSystemHealthArgs extends BaseArgs {
  tableId?: string
}

// Advanced search resolver argument types
export interface AdvancedSearchArgs extends BaseArgs {
  input: {
    tableId: string
    filters: Array<{
      field: string
      operator: string
      value?: unknown
      values?: unknown[]
    }>
    logic?: Array<{
      field: string
      operator: string
      value?: unknown
      values?: unknown[]
    }>
    sorting?: Array<{
      field: string
      direction: 'asc' | 'desc'
    }>
    pagination?: {
      limit: number
      offset: number
    }
  }
}
export interface CreateAlertRuleArgs extends BaseArgs {
  input: {
    name: string
    condition: string
    action: string
    enabled?: boolean
  }
}
export interface UpdateAlertRuleArgs extends BaseArgs {
  id: string
  input: {
    name?: string
    condition?: string
    action?: string
    enabled?: boolean
  }
}
export interface DeleteAlertRuleArgs extends IdArgs {}
export interface ClearCacheArgs extends BaseArgs {
  cacheType?: string
}
export interface OptimizeDatabaseArgs extends BaseArgs {
  optimizationType?: string
}

// Schema export/import argument types
export interface ExportTableArgs extends BaseArgs {
  tableId: string
  options?: Record<string, unknown>
}
export interface ExportAllTablesArgs extends BaseArgs {
  options?: Record<string, unknown>
}
export interface ImportSchemaArgs extends BaseArgs {
  exportData: unknown
  options?: Record<string, unknown>
}

// Field resolver parent types (matching DTO interfaces)
export interface TableParent {
  id: string
  identifier: string
  description: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface AttributeParent {
  id: string
  tableId: string
  identifier: string
  attributeTypeId: string
  description: string | null
  defaultValue: unknown
  examples: unknown[] | null
  isRequired: boolean
  isSearchable: boolean
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface NodeParent {
  id: string
  tableId: string
  content: string
  title: string | null
  description: string | null
  externalId: string | null
  createdAt: string
  updatedAt: string
}

export interface NodeRelationParent {
  id: string
  tableId: string
  sourceNodeId: string | null
  sourceExternalId: string
  targetNodeId: string | null
  targetExternalId: string
  relationTypeId: string
  properties: Record<string, unknown> | null
  strength: number
  confidence: number
  createdAt: string
  updatedAt: string
}
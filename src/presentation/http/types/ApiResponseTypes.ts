// HTTP API Response Types for type safety

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// System Response Types
export interface HealthCheckData {
  status: string
  timestamp: string
  database: string
  version: string
}

export interface SystemStatsData {
  memory: {
    used: number
    total: number
    percentage: number
  }
  process: {
    pid: number
    cpu: NodeJS.CpuUsage
    platform: NodeJS.Platform
  }
}

// Table Response Types
export interface TableData {
  id: string
  identifier: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface SearchTablesData {
  tables: TableData[]
  total: number
  searchTerm: string
  limit: number
}

// Node Response Types
export interface NodeData {
  id: string
  tableId: string
  content: string
  metadata: Record<string, unknown>
  createdAt: string
}

export interface SearchNodesData {
  nodes: NodeData[]
  total: number
  tableId: string
  search: string
  limit: number
}

// Relation Response Types
export interface RelationData {
  id: string
  fromNodeId: string
  toNodeId: string
  relationshipType: string
  tableId: string
  properties: Record<string, unknown>
  createdAt: string
}

// Template Response Types
export interface TemplateData {
  id: string
  identifier: string
  name: string
  query: string
  tags: string[]
  createdAt: string
}

export interface SearchTemplatesData {
  templates: TemplateData[]
  total: number
  searchTerm: string
  tags: string[]
}

export interface ExecuteTemplateData {
  templateIdentifier: string
  variables: Record<string, unknown>
  executionResult: {
    success: boolean
    data: Record<string, unknown>
    errors: string[]
  }
  executedAt: string
}

export interface ExportTemplateData {
  templateIdentifier: string
  exportData: {
    template: TemplateData
    metadata: Record<string, unknown>
  }
  exportedAt: string
}

export interface ImportTemplateData {
  importResult: {
    success: boolean
    templateIdentifier: string
    conflicts: string[]
  }
  importedAt: string
}

// Attribute Response Types
export interface AttributeData {
  id: string
  tableId?: string
  identifier?: string
  name?: string
  attributeTypeId?: string
}

export interface NodeAttributeData {
  nodeId: string
  attributeId: string
  value: string
  success?: boolean
  updated?: boolean
  removed?: boolean
}

export interface TableAttributesData {
  tableId: string
  attributes: AttributeData[]
}

export interface NodeAttributesData {
  nodeId: string
  attributes: AttributeData[]
}

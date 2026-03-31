import type { SafeJsonValue } from '@/shared/utils/safeJson.js'

/**
 * Table Package Export/Import Types
 *
 * Type definitions for table-based data export/import system
 */

export interface TablePackageFormat {
  version: string
  exportedAt: string
  sourceTable: {
    identifier: string
    description: string | null
  }
  dependencies: string[] // Table identifiers this table depends on
  package: {
    schema: TableSchemaExport
    dataset: TableDataExport
    relations: TableRelationsExport
    templates: TableTemplatesExport
  }
}

export interface TableSchemaExport {
  table: {
    identifier: string
    description: string | null
    createdAt: string
    updatedAt: string
  }
  attributes: Array<{
    identifier: string
    attributeTypeId: string
    description: string | null
    isRequired: boolean
    metadata: string | null
    createdAt: string
    updatedAt: string
  }>
  attributeTypes: Array<{
    id: string
    identifier: string
    description: string | null
    dataType: string
    validation: string | null
    metadata: string | null
    createdAt: string
    updatedAt: string
  }>
}

export interface TableDataExport {
  nodes: Array<{
    externalId: string
    nodeType: string
    content: string | Record<string, SafeJsonValue> | null
    metadata: Record<string, SafeJsonValue> | null
    createdAt: string
    updatedAt: string
  }>
  nodeAttributes: Array<{
    nodeExternalId: string
    attributeIdentifier: string
    value: SafeJsonValue
    createdAt: string
    updatedAt: string
  }>
}

export interface TableRelationsExport {
  relationTypes: Array<{
    id: string
    identifier: string
    description: string | null
    properties: Record<string, SafeJsonValue> | null
    createdAt: string
    updatedAt: string
  }>
  nodeRelations: Array<{
    sourceExternalId: string
    targetExternalId: string
    relationTypeId: string
    properties: Record<string, SafeJsonValue> | null
    strength: number
    createdAt: string
    updatedAt: string
  }>
}

export interface TableTemplatesExport {
  templates: Array<{
    identifier: string
    name: string
    description: string | null
    query: string
    queryName: string[]
    operationType: 'query' | 'mutation' | 'subscription'
    variables: Record<string, unknown> | null
    inputSchema: QueryVariablesSchema | null
    defaultVariables: Record<string, unknown> | null
    applicableTables: string[] | null
    complexityScore: number
    version: string
    tags: string[]
    isActive: boolean
    statistics?: {
      usageCount: number
      avgExecutionTimeMs: number
      lastUsedAt: string | null
    }
  }>
}

export interface QueryVariablesSchema {
  type: string
  properties: Record<
    string,
    {
      type: string
      description?: string
      default?: unknown
      enum?: unknown[]
    }
  >
  required?: string[]
}

export interface TablePackageExportOptions {
  includeData?: boolean // Include node data (default: true)
  includeRelations?: boolean // Include relationships (default: true)
  includeTemplates?: boolean // Include query templates (default: true)
  includeStatistics?: boolean // Include usage statistics (default: false)
  resolveDependencies?: boolean // Export dependent tables (default: false)
  prettyPrint?: boolean // Format JSON (default: true)
}

export interface TablePackageImportOptions {
  conflictResolution: 'overwrite' | 'merge' | 'rename' | 'skip'
  importData?: boolean // Import node data (default: true)
  importRelations?: boolean // Import relationships (default: true)
  importTemplates?: boolean // Import query templates (default: true)
  preserveStatistics?: boolean // Keep existing statistics (default: true)
  validateIntegrity?: boolean // Validate referential integrity (default: true)
  generateTemplates?: boolean // Auto-generate CRUD templates (default: true)
  newTablePrefix?: string // Prefix for renamed tables
}

export interface TablePackageExportResult {
  success: boolean
  tablePackage?: TablePackageFormat
  dependencyOrder?: string[] // Import order for dependencies
  packagePath?: string // File system path
  errors: string[]
  warnings: string[]
}

export interface TablePackageImportResult {
  success: boolean
  importedTable?: {
    id: string
    identifier: string
    originalIdentifier: string
  }
  generatedTemplates?: Array<{
    id: string
    identifier: string
    name: string
    operationType: string
  }>
  resolvedConflicts?: Array<{
    type: 'table' | 'template' | 'attribute'
    originalName: string
    resolvedName: string
    action: 'renamed' | 'merged' | 'overwritten' | 'skipped'
  }>
  errors: string[]
  warnings: string[]
}

export interface TableDependencyInfo {
  tableIdentifier: string
  dependencies: string[] // Tables this table depends on
  dependents: string[] // Tables that depend on this table
  depth: number // Dependency depth (0 = no dependencies)
  circularReferences: string[] // Circular dependency chains
}

export interface ImportSession {
  sessionId: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back'
  startedAt: Date
  completedAt?: Date
  packagesImported: string[]
  packagesRemaining: string[]
  rollbackInfo: {
    tablesCreated: string[]
    templatesCreated: string[]
    nodesCreated: string[]
  }
  errors: string[]
}

export type TablePackageConflictType =
  | 'table_exists'
  | 'template_exists'
  | 'attribute_type_mismatch'
  | 'circular_dependency'
  | 'missing_dependency'
  | 'schema_incompatible'

export interface TablePackageConflict {
  type: TablePackageConflictType
  severity: 'error' | 'warning'
  message: string
  context: {
    tableName?: string
    templateName?: string
    attributeName?: string
    dependency?: string
  }
  suggestedResolution?: string
}

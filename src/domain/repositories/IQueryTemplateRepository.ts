import type { QueryTemplate, QueryVariablesSchema, TemplateType } from '../entities/QueryTemplate.js'

export interface QueryTemplateUpdateData {
  name?: string
  description?: string | null
  queryText?: string
  inputSchema?: QueryVariablesSchema | null
  defaultVariables?: Record<string, unknown> | null
  applicableTables?: string[] | null
  templateType?: TemplateType
  complexityScore?: number
  version?: string
  isActive?: boolean
  tags?: string[]
}

export interface SearchCriteria {
  tags?: string[]
  tagMatchMode?: 'ANY' | 'ALL'
  systemQueries?: string[]
  systemQueryMatchMode?: 'ANY' | 'ALL'
  applicableToTable?: string
  includeUniversal?: boolean
  templateType?: string
  isActive?: boolean
  orderBy?: string
  orderDirection?: 'ASC' | 'DESC'
  limit?: number
  offset?: number
}

export interface TemplateExecutionRecord {
  id: string
  templateId: string
  executedAt: string
  executionTimeMs: number
  variablesUsed: Record<string, unknown> | null
  resultCount: number
  success: boolean
  errorMessage: string | null
  userContext: string | null
}

export interface FindTemplateExecutionsOptions {
  templateId?: string
  templateIds?: string[]
  start?: string
  end?: string
  successOnly?: boolean
  minExecutionTime?: number
  maxExecutionTime?: number
  userContext?: string
  limit?: number
  offset?: number
}

export interface IQueryTemplateRepository {
  findById(id: string): Promise<QueryTemplate | null>
  findByIdentifier(identifier: string): Promise<QueryTemplate | null>
  search(criteria: SearchCriteria): Promise<{
    items: QueryTemplate[]
    total: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }>
  searchByQueryName(queryName: string): Promise<QueryTemplate[]>
  searchByOperationType(operationType: string): Promise<QueryTemplate[]>
  findByApplicableTable(tableName: string, includeUniversal?: boolean): Promise<QueryTemplate[]>
  findTemplatesWithTableDependencies(): Promise<QueryTemplate[]>
  create(template: QueryTemplate): Promise<QueryTemplate>
  update(id: string, updates: QueryTemplateUpdateData): Promise<QueryTemplate>
  deleteById(id: string): Promise<boolean>
  incrementUsage(id: string): Promise<void>
  updateExecutionStats(id: string, executionTimeMs: number): Promise<void>
  recordExecution?(input: Omit<TemplateExecutionRecord, 'id' | 'executedAt'> & { executedAt?: string }): Promise<void>
  findExecutions?(
    options?: FindTemplateExecutionsOptions,
  ): Promise<{ items: TemplateExecutionRecord[]; totalCount: number }>
  findPopular(limit?: number): Promise<QueryTemplate[]>
  updateStatus(id: string, isActive: boolean): Promise<QueryTemplate>
}

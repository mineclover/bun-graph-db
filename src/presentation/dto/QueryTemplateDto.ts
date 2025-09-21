import {
  type OperationType,
  QueryTemplate,
  type QueryVariablesSchema,
  type TemplateType,
} from '@/domain/entities/QueryTemplate.js'

export interface QueryTemplateDto {
  id: string
  identifier: string
  name: string
  description: string | null
  query: string
  queryName: string[]
  operationType: OperationType
  inputSchema: QueryVariablesSchema | null
  defaultVariables: Record<string, unknown> | null
  applicableTables: string[] | null
  templateType: TemplateType
  complexityScore: number
  usageCount: number
  lastUsedAt: Date | null
  avgExecutionTimeMs: number
  version: string
  isActive: boolean
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

export interface CreateQueryTemplateInput {
  identifier: string
  name: string
  description?: string
  query: string
  inputSchema?: QueryVariablesSchema
  defaultVariables?: Record<string, unknown>
  applicableTables?: string[]
  templateType?: TemplateType
  complexityScore?: number
  version?: string
  tags: string[]
}

export interface UpdateQueryTemplateInput {
  identifier?: string
  name?: string
  description?: string
  query?: string
  inputSchema?: QueryVariablesSchema
  defaultVariables?: Record<string, unknown>
  applicableTables?: string[]
  templateType?: TemplateType
  complexityScore?: number
  version?: string
  tags?: string[]
}

export interface SearchTemplatesInput {
  tags?: string[]
  tagMatchMode?: 'ANY' | 'ALL'
  applicableToTable?: string
  includeUniversal?: boolean
  templateType?: TemplateType
  systemQueries?: string[]
  systemQueryMatchMode?: 'ANY' | 'ALL'
  isActive?: boolean
  orderBy?: 'usage_count' | 'created_at' | 'updated_at' | 'name' | 'complexity_score'
  orderDirection?: 'ASC' | 'DESC'
  limit?: number
  offset?: number
}

export interface FindTemplatesByTableInput {
  tableName: string
  includeUniversal?: boolean
}

export interface TableDependencyTemplateResult {
  tableName: string
  templates: QueryTemplateDto[]
  totalCount: number
}

export interface ExecuteTemplateInput {
  templateId?: string
  templateIdentifier?: string
  variables?: Record<string, unknown>
  trackUsage?: boolean
  validateVariables?: boolean
}

export interface QueryTemplatesConnection {
  templates: QueryTemplateDto[]
  totalCount: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export function queryTemplateToDto(entity: QueryTemplate): QueryTemplateDto {
  return {
    id: entity.getId() || '',
    identifier: entity.getIdentifier(),
    name: entity.getName(),
    description: entity.getDescription(),
    query: entity.getQueryText(),
    queryName: entity.getQueryName(),
    operationType: entity.getOperationType(),
    inputSchema: entity.getInputSchema(),
    defaultVariables: entity.getDefaultVariables(),
    applicableTables: entity.getApplicableTables(),
    templateType: entity.getTemplateType(),
    complexityScore: entity.getComplexityScore(),
    usageCount: entity.getUsageCount(),
    lastUsedAt: entity.getLastUsedAt(),
    avgExecutionTimeMs: entity.getAvgExecutionTimeMs(),
    version: entity.getVersion(),
    isActive: entity.getIsActive(),
    tags: entity.getTags(),
    createdAt: entity.getCreatedAt(),
    updatedAt: entity.getUpdatedAt(),
  }
}

export function queryTemplatesToDtoList(entities: QueryTemplate[]): QueryTemplateDto[] {
  return entities.map((entity) => queryTemplateToDto(entity))
}

export function createInputToEntity(input: CreateQueryTemplateInput): QueryTemplate {
  return QueryTemplate.create(input.identifier, input.name, input.query, input.tags, {
    description: input.description,
    inputSchema: input.inputSchema,
    defaultVariables: input.defaultVariables,
    applicableTables: input.applicableTables,
    templateType: input.templateType,
    complexityScore: input.complexityScore,
    version: input.version,
  })
}

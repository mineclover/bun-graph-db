import {
  type OperationType,
  QueryTemplate,
  type QueryVariablesSchema,
  type TemplateType,
} from '@/domain/entities/QueryTemplate.js'

export interface QueryTemplateDto {
  id: string | null
  identifier: string
  name: string
  description: string | null
  queryText: string
  queryName: string[]
  operationType: OperationType
  variablesSchema: QueryVariablesSchema | null
  defaultVariables: Record<string, unknown> | null
  applicableTables: string[] | null
  templateType: TemplateType
  complexityScore: number
  usageCount: number
  version: string
  isActive: boolean
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface CreateQueryTemplateInput {
  identifier: string
  name: string
  description?: string
  queryText: string
  variablesSchema?: QueryVariablesSchema
  defaultVariables?: Record<string, unknown>
  applicableTables?: string[]
  templateType?: TemplateType
  complexityScore?: number
  version?: string
  tags: string[]
}

export interface UpdateQueryTemplateInput {
  id: string
  name?: string
  description?: string
  queryText?: string
  variablesSchema?: QueryVariablesSchema
  defaultVariables?: Record<string, unknown>
  applicableTables?: string[]
  templateType?: TemplateType
  complexityScore?: number
  version?: string
  isActive?: boolean
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

export class QueryTemplateDtoMapper {
  static toDto(entity: QueryTemplate): QueryTemplateDto {
    return {
      id: entity.getId(),
      identifier: entity.getIdentifier(),
      name: entity.getName(),
      description: entity.getDescription(),
      queryText: entity.getQueryText(),
      queryName: entity.getQueryName(),
      operationType: entity.getOperationType(),
      variablesSchema: entity.getVariablesSchema(),
      defaultVariables: entity.getDefaultVariables(),
      applicableTables: entity.getApplicableTables(),
      templateType: entity.getTemplateType(),
      complexityScore: entity.getComplexityScore(),
      usageCount: entity.getUsageCount(),
      version: entity.getVersion(),
      isActive: entity.getIsActive(),
      tags: entity.getTags(),
      createdAt: entity.getCreatedAt().toISOString(),
      updatedAt: entity.getUpdatedAt().toISOString(),
    }
  }

  static toDtoList(entities: QueryTemplate[]): QueryTemplateDto[] {
    return entities.map((entity) => QueryTemplateDtoMapper.toDto(entity))
  }

  static createInputToEntity(input: CreateQueryTemplateInput): QueryTemplate {
    return QueryTemplate.create(input.identifier, input.name, input.queryText, input.tags, {
      description: input.description,
      variablesSchema: input.variablesSchema,
      defaultVariables: input.defaultVariables,
      applicableTables: input.applicableTables,
      templateType: input.templateType,
      complexityScore: input.complexityScore,
      version: input.version,
    })
  }
}

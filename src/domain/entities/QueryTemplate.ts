import type { QueryTemplateId } from '@/shared/types/common.js'
import { DomainException } from '@/shared/exceptions/DomainException.js'

export interface QueryVariablesSchema {
  type: string
  properties: Record<string, {
    type: string
    description?: string
    default?: unknown
    enum?: unknown[]
  }>
  required?: string[]
}

export interface QueryTemplateMetadata {
  complexityScore: number // 1-10
  estimatedTokens?: number
  estimatedResponseTimeMs?: number
  tags: string[]
  searchKeywords: string
}

export interface QueryTemplateUsage {
  usageCount: number
  lastUsedAt?: Date
}

export class QueryTemplate {
  constructor(
    private readonly id: QueryTemplateId | null,
    private readonly identifier: string,
    private readonly name: string,
    private readonly description: string,
    private readonly categoryId: number,
    private readonly queryText: string,
    private readonly variablesSchema: QueryVariablesSchema,
    private readonly defaultVariables: Record<string, unknown>,
    private readonly metadata: QueryTemplateMetadata,
    private readonly usage: QueryTemplateUsage,
    private readonly version: string,
    private readonly isActive: boolean,
    private readonly isDeprecated: boolean,
    private readonly deprecatedReason?: string,
    private readonly replacementTemplateId?: QueryTemplateId,
    private readonly isPublic: boolean = true,
    private readonly requiredPermissions: string[] = [],
    private readonly createdAt: Date,
    private readonly updatedAt: Date,
    private readonly createdBy?: string
  ) {
    this.validateIdentifier(identifier)
    this.validateQueryText(queryText)
    this.validateComplexityScore(metadata.complexityScore)
  }

  static create(
    identifier: string,
    name: string,
    description: string,
    categoryId: number,
    queryText: string,
    variablesSchema: QueryVariablesSchema,
    defaultVariables: Record<string, unknown> = {},
    metadata: Partial<QueryTemplateMetadata> = {}
  ): QueryTemplate {
    const now = new Date()
    
    return new QueryTemplate(
      null,
      identifier,
      name,
      description,
      categoryId,
      queryText,
      variablesSchema,
      defaultVariables,
      {
        complexityScore: metadata.complexityScore || 1,
        estimatedTokens: metadata.estimatedTokens,
        estimatedResponseTimeMs: metadata.estimatedResponseTimeMs,
        tags: metadata.tags || [],
        searchKeywords: metadata.searchKeywords || ''
      },
      {
        usageCount: 0,
        lastUsedAt: undefined
      },
      '1.0.0',
      true,
      false,
      undefined,
      undefined,
      true,
      [],
      now,
      now
    )
  }

  static fromDatabase(
    id: string,
    identifier: string,
    name: string,
    description: string,
    categoryId: number,
    queryText: string,
    variablesSchema: string,
    defaultVariables: string,
    complexityScore: number,
    estimatedTokens: number | null,
    estimatedResponseTimeMs: number | null,
    usageCount: number,
    lastUsedAt: string | null,
    version: string,
    isActive: boolean,
    isDeprecated: boolean,
    deprecatedReason: string | null,
    replacementTemplateId: string | null,
    isPublic: boolean,
    requiredPermissions: string | null,
    tags: string | null,
    searchKeywords: string | null,
    createdAt: Date,
    updatedAt: Date,
    createdBy: string | null
  ): QueryTemplate {
    const parsedVariablesSchema = JSON.parse(variablesSchema) as QueryVariablesSchema
    const parsedDefaultVariables = JSON.parse(defaultVariables) as Record<string, unknown>
    const parsedTags = tags ? JSON.parse(tags) as string[] : []
    const parsedRequiredPermissions = requiredPermissions ? JSON.parse(requiredPermissions) as string[] : []
    
    return new QueryTemplate(
      id as QueryTemplateId,
      identifier,
      name,
      description,
      categoryId,
      queryText,
      parsedVariablesSchema,
      parsedDefaultVariables,
      {
        complexityScore,
        estimatedTokens: estimatedTokens || undefined,
        estimatedResponseTimeMs: estimatedResponseTimeMs || undefined,
        tags: parsedTags,
        searchKeywords: searchKeywords || ''
      },
      {
        usageCount,
        lastUsedAt: lastUsedAt ? new Date(lastUsedAt) : undefined
      },
      version,
      isActive,
      isDeprecated,
      deprecatedReason || undefined,
      replacementTemplateId as QueryTemplateId || undefined,
      isPublic,
      parsedRequiredPermissions,
      createdAt,
      updatedAt,
      createdBy || undefined
    )
  }

  private validateIdentifier(identifier: string): void {
    if (!identifier || identifier.trim().length === 0) {
      throw new DomainException('Query template identifier cannot be empty', 'VALIDATION_ERROR')
    }
    
    if (!/^[a-z0-9-_]+$/.test(identifier)) {
      throw new DomainException('Query template identifier must contain only lowercase letters, numbers, hyphens, and underscores', 'VALIDATION_ERROR')
    }
  }

  private validateQueryText(queryText: string): void {
    if (!queryText || queryText.trim().length === 0) {
      throw new DomainException('Query text cannot be empty', 'VALIDATION_ERROR')
    }
    
    if (!queryText.includes('query ')) {
      throw new DomainException('Query text must be a valid GraphQL query', 'VALIDATION_ERROR')
    }
  }

  private validateComplexityScore(score: number): void {
    if (score < 1 || score > 10) {
      throw new DomainException('Complexity score must be between 1 and 10', 'VALIDATION_ERROR')
    }
  }

  // Getters
  getId(): QueryTemplateId | null { return this.id }
  getIdentifier(): string { return this.identifier }
  getName(): string { return this.name }
  getDescription(): string { return this.description }
  getCategoryId(): number { return this.categoryId }
  getQueryText(): string { return this.queryText }
  getVariablesSchema(): QueryVariablesSchema { return this.variablesSchema }
  getDefaultVariables(): Record<string, unknown> { return this.defaultVariables }
  getMetadata(): QueryTemplateMetadata { return this.metadata }
  getUsage(): QueryTemplateUsage { return this.usage }
  getVersion(): string { return this.version }
  getIsActive(): boolean { return this.isActive }
  getIsDeprecated(): boolean { return this.isDeprecated }
  getDeprecatedReason(): string | undefined { return this.deprecatedReason }
  getReplacementTemplateId(): QueryTemplateId | undefined { return this.replacementTemplateId }
  getIsPublic(): boolean { return this.isPublic }
  getRequiredPermissions(): string[] { return this.requiredPermissions }
  getCreatedAt(): Date { return this.createdAt }
  getUpdatedAt(): Date { return this.updatedAt }
  getCreatedBy(): string | undefined { return this.createdBy }

  // Business methods
  incrementUsage(): QueryTemplate {
    return new QueryTemplate(
      this.id,
      this.identifier,
      this.name,
      this.description,
      this.categoryId,
      this.queryText,
      this.variablesSchema,
      this.defaultVariables,
      this.metadata,
      {
        usageCount: this.usage.usageCount + 1,
        lastUsedAt: new Date()
      },
      this.version,
      this.isActive,
      this.isDeprecated,
      this.deprecatedReason,
      this.replacementTemplateId,
      this.isPublic,
      this.requiredPermissions,
      this.createdAt,
      new Date(),
      this.createdBy
    )
  }

  deprecate(reason: string, replacementTemplateId?: QueryTemplateId): QueryTemplate {
    return new QueryTemplate(
      this.id,
      this.identifier,
      this.name,
      this.description,
      this.categoryId,
      this.queryText,
      this.variablesSchema,
      this.defaultVariables,
      this.metadata,
      this.usage,
      this.version,
      false, // deactivate
      true,  // mark as deprecated
      reason,
      replacementTemplateId,
      this.isPublic,
      this.requiredPermissions,
      this.createdAt,
      new Date(),
      this.createdBy
    )
  }

  validateVariables(variables: Record<string, unknown>): boolean {
    if (!this.variablesSchema.required) return true
    
    return this.variablesSchema.required.every(requiredField => 
      variables.hasOwnProperty(requiredField) && variables[requiredField] !== undefined
    )
  }

  toDatabase(): {
    id: QueryTemplateId | null
    identifier: string
    name: string
    description: string
    category_id: number
    query_text: string
    variables_schema: string
    default_variables: string
    complexity_score: number
    estimated_tokens: number | null
    estimated_response_time_ms: number | null
    usage_count: number
    last_used_at: string | null
    version: string
    is_active: boolean
    is_deprecated: boolean
    deprecated_reason: string | null
    replacement_template_id: QueryTemplateId | null
    is_public: boolean
    required_permissions: string
    tags: string
    search_keywords: string
    created_at: string
    updated_at: string
    created_by: string | null
  } {
    return {
      id: this.id,
      identifier: this.identifier,
      name: this.name,
      description: this.description,
      category_id: this.categoryId,
      query_text: this.queryText,
      variables_schema: JSON.stringify(this.variablesSchema),
      default_variables: JSON.stringify(this.defaultVariables),
      complexity_score: this.metadata.complexityScore,
      estimated_tokens: this.metadata.estimatedTokens || null,
      estimated_response_time_ms: this.metadata.estimatedResponseTimeMs || null,
      usage_count: this.usage.usageCount,
      last_used_at: this.usage.lastUsedAt?.toISOString() || null,
      version: this.version,
      is_active: this.isActive,
      is_deprecated: this.isDeprecated,
      deprecated_reason: this.deprecatedReason || null,
      replacement_template_id: this.replacementTemplateId || null,
      is_public: this.isPublic,
      required_permissions: JSON.stringify(this.requiredPermissions),
      tags: JSON.stringify(this.metadata.tags),
      search_keywords: this.metadata.searchKeywords,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
      created_by: this.createdBy || null
    }
  }
}
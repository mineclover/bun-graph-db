import { GraphQLParser } from '@/core/utils/GraphQLParser.js'
import { DomainException } from '@/shared/exceptions/DomainException.js'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
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

export type OperationType = 'query' | 'mutation' | 'subscription'
export type TemplateType = OperationType // Legacy alias

export class QueryTemplate {
  constructor(
    private readonly id: string | null,
    private readonly identifier: string,
    private readonly name: string,
    private readonly description: string | null,
    private readonly queryText: string,
    private readonly queryName: string[],
    private readonly operationType: OperationType,
    private readonly variablesSchema: QueryVariablesSchema | null,
    private readonly defaultVariables: Record<string, unknown> | null,
    private readonly applicableTables: string[] | null,
    private readonly templateType: TemplateType, // Legacy field
    private readonly complexityScore: number,
    private readonly usageCount: number,
    private readonly lastUsedAt: Date | null,
    private readonly avgExecutionTimeMs: number,
    private readonly version: string,
    private readonly isActive: boolean,
    private readonly tags: string[],
    private readonly createdAt: Date,
    private readonly updatedAt: Date
  ) {
    this.validateIdentifier(identifier)
    this.validateQueryText(queryText)
    this.validateComplexityScore(complexityScore)
    this.validateTags(tags)
  }

  static create(
    identifier: string,
    name: string,
    queryText: string,
    tags: string[],
    options?: {
      description?: string
      variablesSchema?: QueryVariablesSchema
      defaultVariables?: Record<string, unknown>
      applicableTables?: string[]
      templateType?: TemplateType // Legacy, will be overridden by parsed operationType
      complexityScore?: number
      version?: string
    }
  ): QueryTemplate {
    const now = new Date()

    // Extract operation info from GraphQL query text
    const operationInfo = GraphQLParser.extractOperationInfo(queryText)
    const systemQueries = GraphQLParser.extractSystemQueries(queryText)
    const autoComplexity =
      options?.complexityScore || GraphQLParser.calculateComplexityScore(queryText)

    return new QueryTemplate(
      null,
      identifier,
      operationInfo.queryName || name, // Use operation name as display name, fallback to provided name
      options?.description || null,
      queryText,
      systemQueries, // Store system queries in queryName field
      operationInfo.operationType,
      options?.variablesSchema || null,
      options?.defaultVariables || null,
      options?.applicableTables || null,
      operationInfo.operationType, // Use parsed type, not legacy templateType
      autoComplexity,
      0,
      null,
      0,
      options?.version || '1.0.0',
      true,
      tags,
      now,
      now
    )
  }

  static fromDatabase(
    id: string,
    identifier: string,
    name: string,
    description: string | null,
    queryText: string,
    queryName: string | null,
    operationType: string | null,
    variablesSchema: string | null,
    defaultVariables: string | null,
    applicableTables: string | null,
    templateType: string, // Legacy field
    complexityScore: number,
    usageCount: number,
    lastUsedAt: string | null,
    avgExecutionTimeMs: number | null,
    version: string,
    isActive: boolean,
    tags: string | null,
    createdAt: string,
    updatedAt: string
  ): QueryTemplate {
    const parsedVariablesSchema = variablesSchema
      ? (JSON.parse(variablesSchema) as QueryVariablesSchema)
      : null
    const parsedDefaultVariables = defaultVariables
      ? (JSON.parse(defaultVariables) as Record<string, unknown>)
      : null
    const parsedApplicableTables = applicableTables
      ? (JSON.parse(applicableTables) as string[])
      : null
    const parsedTags = tags ? (JSON.parse(tags) as string[]) : []

    // Parse queryName field - support both legacy single string and new array format
    let parsedQueryName: string[]
    if (queryName) {
      try {
        // Try parsing as JSON array first (new format)
        const parsed = JSON.parse(queryName)
        parsedQueryName = Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        // Legacy format - single string, extract system queries from queryText
        try {
          parsedQueryName = GraphQLParser.extractSystemQueries(queryText)
        } catch {
          parsedQueryName = []
        }
      }
    } else {
      // No queryName stored, extract from queryText
      try {
        parsedQueryName = GraphQLParser.extractSystemQueries(queryText)
      } catch {
        parsedQueryName = []
      }
    }

    // Use operationType if available, fallback to templateType, then parse from queryText
    let finalOperationType: OperationType
    if (operationType && ['query', 'mutation', 'subscription'].includes(operationType)) {
      finalOperationType = operationType as OperationType
    } else if (templateType && ['query', 'mutation', 'subscription'].includes(templateType)) {
      finalOperationType = templateType as OperationType
    } else {
      // Parse from queryText as fallback
      try {
        const operationInfo = GraphQLParser.extractOperationInfo(queryText)
        finalOperationType = operationInfo.operationType
      } catch {
        finalOperationType = 'query' // Default fallback
      }
    }

    return new QueryTemplate(
      id,
      identifier,
      name,
      description,
      queryText,
      parsedQueryName,
      finalOperationType,
      parsedVariablesSchema,
      parsedDefaultVariables,
      parsedApplicableTables,
      finalOperationType, // Keep templateType in sync
      complexityScore,
      usageCount,
      lastUsedAt ? new Date(lastUsedAt) : null,
      avgExecutionTimeMs || 0,
      version,
      isActive,
      parsedTags,
      new Date(createdAt),
      new Date(updatedAt)
    )
  }

  private validateIdentifier(identifier: string): void {
    if (!identifier || identifier.trim().length === 0) {
      throw new DomainException('Query template identifier cannot be empty', {
        code: 'VALIDATION_ERROR',
      })
    }

    if (!/^[a-z0-9-_]+$/.test(identifier)) {
      throw new DomainException(
        'Query template identifier must contain only lowercase letters, numbers, hyphens, and underscores',
        { code: 'VALIDATION_ERROR' }
      )
    }
  }

  private validateQueryText(queryText: string): void {
    if (!queryText || queryText.trim().length === 0) {
      throw new DomainException('Query text cannot be empty', { code: 'VALIDATION_ERROR' })
    }
  }

  private validateComplexityScore(score: number): void {
    if (score < 1 || score > 10) {
      throw new DomainException('Complexity score must be between 1 and 10', {
        code: 'VALIDATION_ERROR',
      })
    }
  }

  private validateTags(tags: string[]): void {
    if (!tags || tags.length === 0) {
      throw new DomainException('At least one tag is required', { code: 'VALIDATION_ERROR' })
    }
  }

  // Getters
  getId(): string | null {
    return this.id
  }
  getIdentifier(): string {
    return this.identifier
  }
  getName(): string {
    return this.name
  }
  getDescription(): string | null {
    return this.description
  }
  getQueryText(): string {
    return this.queryText
  }
  getQueryName(): string[] {
    return this.queryName
  }
  getOperationType(): OperationType {
    return this.operationType
  }
  getVariablesSchema(): QueryVariablesSchema | null {
    return this.variablesSchema
  }
  getDefaultVariables(): Record<string, unknown> | null {
    return this.defaultVariables
  }
  getApplicableTables(): string[] | null {
    return this.applicableTables
  }
  getTemplateType(): TemplateType {
    return this.templateType
  }
  getComplexityScore(): number {
    return this.complexityScore
  }
  getUsageCount(): number {
    return this.usageCount
  }
  getLastUsedAt(): Date | null {
    return this.lastUsedAt
  }
  getAvgExecutionTimeMs(): number {
    return this.avgExecutionTimeMs
  }
  getVersion(): string {
    return this.version
  }
  getIsActive(): boolean {
    return this.isActive
  }
  getTags(): string[] {
    return this.tags
  }
  getCreatedAt(): Date {
    return this.createdAt
  }
  getUpdatedAt(): Date {
    return this.updatedAt
  }

  // Business methods
  incrementUsage(): QueryTemplate {
    return new QueryTemplate(
      this.id,
      this.identifier,
      this.name,
      this.description,
      this.queryText,
      this.queryName,
      this.operationType,
      this.variablesSchema,
      this.defaultVariables,
      this.applicableTables,
      this.templateType,
      this.complexityScore,
      this.usageCount + 1,
      new Date(), // Update lastUsedAt
      this.avgExecutionTimeMs,
      this.version,
      this.isActive,
      this.tags,
      this.createdAt,
      new Date()
    )
  }

  updateExecutionStats(executionTimeMs: number): QueryTemplate {
    // Handle negative execution times by treating them as 0
    const validExecutionTime = Math.max(0, executionTimeMs)

    const newAvgTime =
      this.usageCount > 0
        ? Math.floor(
            (this.avgExecutionTimeMs * this.usageCount + validExecutionTime) / (this.usageCount + 1)
          )
        : Math.floor(validExecutionTime)

    return new QueryTemplate(
      this.id,
      this.identifier,
      this.name,
      this.description,
      this.queryText,
      this.queryName,
      this.operationType,
      this.variablesSchema,
      this.defaultVariables,
      this.applicableTables,
      this.templateType,
      this.complexityScore,
      this.usageCount + 1,
      new Date(),
      newAvgTime,
      this.version,
      this.isActive,
      this.tags,
      this.createdAt,
      new Date()
    )
  }

  activate(): QueryTemplate {
    return new QueryTemplate(
      this.id,
      this.identifier,
      this.name,
      this.description,
      this.queryText,
      this.queryName,
      this.operationType,
      this.variablesSchema,
      this.defaultVariables,
      this.applicableTables,
      this.templateType,
      this.complexityScore,
      this.usageCount,
      this.lastUsedAt,
      this.avgExecutionTimeMs,
      this.version,
      true,
      this.tags,
      this.createdAt,
      new Date()
    )
  }

  deactivate(): QueryTemplate {
    return new QueryTemplate(
      this.id,
      this.identifier,
      this.name,
      this.description,
      this.queryText,
      this.queryName,
      this.operationType,
      this.variablesSchema,
      this.defaultVariables,
      this.applicableTables,
      this.templateType,
      this.complexityScore,
      this.usageCount,
      this.lastUsedAt,
      this.avgExecutionTimeMs,
      this.version,
      false,
      this.tags,
      this.createdAt,
      new Date()
    )
  }

  validateVariables(variables: Record<string, unknown>): ValidationResult {
    if (!this.variablesSchema) {
      return { isValid: true, errors: [] }
    }

    const errors: string[] = []

    // Check required fields
    if (this.variablesSchema.required) {
      const missingRequired = this.variablesSchema.required.filter(
        (requiredField) =>
          !Object.hasOwn(variables, requiredField) || variables[requiredField] === undefined
      )
      if (missingRequired.length > 0) {
        errors.push(`Missing required variables: ${missingRequired.join(', ')}`)
      }
    }

    // Check type validation for each property
    if (this.variablesSchema.properties) {
      for (const [key, propSchema] of Object.entries(this.variablesSchema.properties)) {
        if (Object.hasOwn(variables, key) && variables[key] !== undefined) {
          const value = variables[key]

          // Type checking
          if (!this.validateVariableType(value, propSchema.type)) {
            errors.push(
              `Variable '${key}' expected type '${propSchema.type}' but got '${typeof value}'`
            )
          }

          // Enum validation
          if (propSchema.enum && !propSchema.enum.includes(value)) {
            errors.push(
              `Variable '${key}' must be one of: ${propSchema.enum.join(', ')}. Got: ${value}`
            )
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  private validateVariableType(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string'
      case 'number':
      case 'integer':
        return typeof value === 'number' && (expectedType === 'number' || Number.isInteger(value))
      case 'boolean':
        return typeof value === 'boolean'
      case 'array':
        return Array.isArray(value)
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value)
      default:
        return true // Unknown type, allow it
    }
  }

  isApplicableToTable(tableIdentifier: string): boolean {
    if (!this.applicableTables) return true // null means universal
    return this.applicableTables.includes(tableIdentifier)
  }

  hasTag(tag: string): boolean {
    return this.tags.includes(tag)
  }

  hasAnyTag(tags: string[]): boolean {
    return tags.some((tag) => this.hasTag(tag))
  }

  hasAllTags(tags: string[]): boolean {
    return tags.every((tag) => this.hasTag(tag))
  }

  toDatabase(): {
    id: string | null
    identifier: string
    name: string
    description: string | null
    query_text: string
    query_name: string | null
    operation_type: string
    variables_schema: string | null
    default_variables: string | null
    applicable_tables: string | null
    template_type: string // Legacy field
    complexity_score: number
    usage_count: number
    last_used_at: string | null
    avg_execution_time_ms: number
    version: string
    is_active: boolean
    tags: string
    created_at: string
    updated_at: string
  } {
    return {
      id: this.id,
      identifier: this.identifier,
      name: this.name,
      description: this.description,
      query_text: this.queryText,
      query_name: this.queryName.length > 0 ? JSON.stringify(this.queryName) : null,
      operation_type: this.operationType,
      variables_schema: this.variablesSchema ? JSON.stringify(this.variablesSchema) : null,
      default_variables: this.defaultVariables ? JSON.stringify(this.defaultVariables) : null,
      applicable_tables: this.applicableTables ? JSON.stringify(this.applicableTables) : null,
      template_type: this.templateType, // Keep for backwards compatibility
      complexity_score: this.complexityScore,
      usage_count: this.usageCount,
      last_used_at: this.lastUsedAt ? this.lastUsedAt.toISOString() : null,
      avg_execution_time_ms: this.avgExecutionTimeMs,
      version: this.version,
      is_active: this.isActive,
      tags: JSON.stringify(this.tags),
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
    }
  }
}

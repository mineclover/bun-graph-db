import type { DocumentNode } from 'graphql'
import { type GraphQLError, type GraphQLSchema, parse, validate } from 'graphql'
import type { GraphQLSchemaIntrospector, QueryPattern } from './GraphQLSchemaIntrospector'

/**
 * Template Validation Engine
 * Validates AI-generated templates against actual GraphQL schema
 */
export class TemplateValidator {
  private schemaIntrospector: GraphQLSchemaIntrospector
  private schema: GraphQLSchema

  constructor(schemaIntrospector: GraphQLSchemaIntrospector, schema: GraphQLSchema) {
    this.schemaIntrospector = schemaIntrospector
    this.schema = schema
  }

  /**
   * Validate template against GraphQL schema
   */
  async validateTemplate(template: TemplateDefinition): Promise<ValidationResult> {
    const validationErrors: ValidationError[] = []
    const corrections: Correction[] = []

    try {
      // 1. Parse GraphQL query
      const document = this.parseQuery(template.query)
      if (!document.success) {
        return {
          isValid: false,
          errors: [{ type: 'SYNTAX_ERROR', message: document.error!, field: 'query' }],
          corrections: [],
          confidence: 0,
        }
      }

      // 2. Validate against schema
      const graphqlErrors = validate(this.schema, document.document!)
      if (graphqlErrors.length > 0) {
        validationErrors.push(...this.convertGraphQLErrors(graphqlErrors))
      }

      // 3. Validate parameters against schema introspection
      const schemaIntrospection = await this.schemaIntrospector.getSchemaIntrospection()
      const parameterValidation = await this.validateParameters(template, schemaIntrospection)
      validationErrors.push(...parameterValidation.errors)
      corrections.push(...parameterValidation.corrections)

      // 4. Generate corrections for common issues
      if (validationErrors.length > 0) {
        const autoCorrections = await this.generateAutoCorrections(template, validationErrors)
        corrections.push(...autoCorrections)
      }

      return {
        isValid: validationErrors.length === 0,
        errors: validationErrors,
        corrections,
        confidence: this.calculateConfidence(validationErrors, corrections),
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [
          {
            type: 'VALIDATION_ERROR',
            message: error instanceof Error ? error.message : 'Unknown validation error',
            field: 'template',
          },
        ],
        corrections: [],
        confidence: 0,
      }
    }
  }

  /**
   * Apply corrections to template
   */
  async applyCorrections(
    template: TemplateDefinition,
    corrections: Correction[]
  ): Promise<CorrectedTemplate> {
    let correctedQuery = template.query
    const correctedVariables = { ...template.variables }
    const appliedCorrections: string[] = []

    for (const correction of corrections) {
      switch (correction.type) {
        case 'PARAMETER_RENAME':
          correctedQuery = this.renameParameter(correctedQuery, correction.from!, correction.to!)
          if (correctedVariables[correction.from!]) {
            correctedVariables[correction.to!] = correctedVariables[correction.from!]
            delete correctedVariables[correction.from!]
          }
          appliedCorrections.push(`Renamed parameter: ${correction.from} → ${correction.to}`)
          break

        case 'PARAMETER_STRUCTURE':
          correctedQuery = this.restructureParameters(
            correctedQuery,
            correction.oldStructure!,
            correction.newStructure!
          )
          appliedCorrections.push(`Restructured parameters: ${correction.description}`)
          break

        case 'OPERATION_TYPE_FIX':
          correctedQuery = this.fixOperationType(correctedQuery, correction.correctType!)
          appliedCorrections.push(`Fixed operation type: ${correction.description}`)
          break

        case 'FIELD_REPLACEMENT':
          correctedQuery = this.replaceField(correctedQuery, correction.from!, correction.to!)
          appliedCorrections.push(`Replaced field: ${correction.from} → ${correction.to}`)
          break
      }
    }

    return {
      originalTemplate: template,
      correctedTemplate: {
        ...template,
        query: correctedQuery,
        variables: correctedVariables,
      },
      appliedCorrections,
      confidence: this.calculateCorrectionConfidence(corrections),
    }
  }

  /**
   * Generate schema-compliant template from AI suggestion
   */
  async generateSchemaCompliantTemplate(
    aiSuggestion: AITemplateRequest
  ): Promise<ValidatedTemplate> {
    const queryPatterns = await this.schemaIntrospector.getQueryPatterns()

    // Find matching operation pattern
    const matchingPattern = this.findMatchingPattern(aiSuggestion, queryPatterns)
    if (!matchingPattern) {
      throw new Error(
        `No matching schema pattern found for operation: ${aiSuggestion.operationType}`
      )
    }

    // Generate schema-compliant query
    const schemaCompliantQuery = this.generateQueryFromPattern(matchingPattern, aiSuggestion)

    // Create template with correct structure
    const template: TemplateDefinition = {
      identifier: aiSuggestion.identifier,
      name: aiSuggestion.name,
      query: schemaCompliantQuery,
      variables: this.generateSchemaCompliantVariables(matchingPattern, aiSuggestion),
      tags: aiSuggestion.tags || ['ai-generated', 'schema-compliant'],
    }

    // Validate the generated template
    const validation = await this.validateTemplate(template)

    return {
      template,
      validation,
      generatedFrom: 'schema-pattern',
      schemaPattern: matchingPattern,
    }
  }

  /**
   * Parse GraphQL query with error handling
   */
  private parseQuery(query: string): { success: boolean; document?: DocumentNode; error?: string } {
    try {
      const document = parse(query)
      return { success: true, document }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Parse error',
      }
    }
  }

  /**
   * Convert GraphQL validation errors to our format
   */
  private convertGraphQLErrors(graphqlErrors: readonly GraphQLError[]): ValidationError[] {
    return graphqlErrors.map((error) => ({
      type: 'SCHEMA_VALIDATION_ERROR',
      message: error.message,
      field: this.extractFieldFromError(error),
      location: error.locations?.[0],
    }))
  }

  /**
   * Validate parameters against schema introspection
   */
  private async validateParameters(
    template: TemplateDefinition,
    schemaIntrospection: any
  ): Promise<{ errors: ValidationError[]; corrections: Correction[] }> {
    const errors: ValidationError[] = []
    const corrections: Correction[] = []

    // Extract operation from query
    const operationMatch = template.query.match(/(query|mutation)\s+(\w+)?/)
    if (!operationMatch) {
      errors.push({
        type: 'OPERATION_TYPE_ERROR',
        message: 'Could not determine operation type',
        field: 'query',
      })
      return { errors, corrections }
    }

    const operationType = operationMatch[1]
    const operations =
      operationType === 'query' ? schemaIntrospection.queries : schemaIntrospection.mutations

    // Find operation in schema
    const queryMatch = template.query.match(/(?:query|mutation)\s+\w*\s*(?:\([^)]*\))?\s*{\s*(\w+)/)
    if (!queryMatch) {
      errors.push({
        type: 'OPERATION_PARSE_ERROR',
        message: 'Could not parse operation name from query',
        field: 'query',
      })
      return { errors, corrections }
    }

    const operationName = queryMatch[1]
    const schemaOperation = operations.find((op: any) => op.name === operationName)

    if (!schemaOperation) {
      errors.push({
        type: 'OPERATION_NOT_FOUND',
        message: `Operation '${operationName}' not found in schema`,
        field: 'query',
      })
      return { errors, corrections }
    }

    // Validate parameters
    const templateParams = this.extractParametersFromQuery(template.query)
    const schemaParams = schemaOperation.args || []

    // Check for missing required parameters
    for (const schemaParam of schemaParams) {
      if (schemaParam.type.isRequired && !templateParams.includes(schemaParam.name)) {
        errors.push({
          type: 'MISSING_REQUIRED_PARAMETER',
          message: `Missing required parameter: ${schemaParam.name}`,
          field: schemaParam.name,
        })

        // Suggest correction
        corrections.push({
          type: 'PARAMETER_ADD',
          description: `Add required parameter '${schemaParam.name}'`,
          parameterName: schemaParam.name,
          parameterType: this.formatTypeInfo(schemaParam.type),
        })
      }
    }

    // Check for unknown parameters
    for (const templateParam of templateParams) {
      if (!schemaParams.find((p: any) => p.name === templateParam)) {
        errors.push({
          type: 'UNKNOWN_PARAMETER',
          message: `Unknown parameter: ${templateParam}`,
          field: templateParam,
        })

        // Try to suggest similar parameter
        const similarParam = this.findSimilarParameter(templateParam, schemaParams)
        if (similarParam) {
          corrections.push({
            type: 'PARAMETER_RENAME',
            description: `Replace '${templateParam}' with '${similarParam.name}'`,
            from: templateParam,
            to: similarParam.name,
          })
        }
      }
    }

    return { errors, corrections }
  }

  /**
   * Generate automatic corrections for common validation errors
   */
  private async generateAutoCorrections(
    template: TemplateDefinition,
    errors: ValidationError[]
  ): Promise<Correction[]> {
    const corrections: Correction[] = []

    for (const error of errors) {
      switch (error.type) {
        case 'UNKNOWN_PARAMETER': {
          // Common AI metadata parameter mappings
          const parameterMappings: Record<string, string> = {
            searchQuery: 'filter',
            tableId: 'filter.tableId',
            conditions: 'filter',
            textSearch: 'filter.searchTerm',
            sortBy: 'sort',
            limit: 'pagination.limit',
            offset: 'pagination.offset',
          }

          if (parameterMappings[error.field!]) {
            corrections.push({
              type: 'PARAMETER_RENAME',
              description: `Map AI parameter to schema parameter`,
              from: error.field!,
              to: parameterMappings[error.field!],
            })
          }
          break
        }

        case 'SCHEMA_VALIDATION_ERROR':
          if (error.message.includes('searchQuery')) {
            corrections.push({
              type: 'PARAMETER_STRUCTURE',
              description: 'Convert searchQuery structure to filter structure',
              oldStructure: 'searchQuery: { conditions: [...] }',
              newStructure: 'filter: SearchNodesFilter!',
            })
          }
          break
      }
    }

    return corrections
  }

  /**
   * Helper methods for corrections
   */
  private renameParameter(query: string, from: string, to: string): string {
    return query.replace(new RegExp(`\\$${from}\\b`, 'g'), `$${to}`)
  }

  private restructureParameters(query: string, oldStructure: string, newStructure: string): string {
    // This would implement specific restructuring logic
    // For now, return the original query with a comment
    return query.replace(oldStructure, newStructure)
  }

  private fixOperationType(query: string, correctType: string): string {
    return query.replace(/^(query|mutation)/, correctType)
  }

  private replaceField(query: string, from: string, to: string): string {
    return query.replace(new RegExp(`\\b${from}\\b`, 'g'), to)
  }

  private findMatchingPattern(
    aiSuggestion: AITemplateRequest,
    patterns: QueryPattern[]
  ): QueryPattern | null {
    return (
      patterns.find(
        (pattern) =>
          pattern.operationName === aiSuggestion.operationType ||
          pattern.description.toLowerCase().includes(aiSuggestion.intent.toLowerCase())
      ) || null
    )
  }

  private generateQueryFromPattern(pattern: QueryPattern, aiSuggestion: AITemplateRequest): string {
    // Use the pattern's example as base and adapt for specific use case
    return pattern.example.replace(/\$\w+/g, (match) => {
      const paramName = match.slice(1)
      return aiSuggestion.variables?.[paramName] ? match : `$${paramName}`
    })
  }

  private generateSchemaCompliantVariables(
    pattern: QueryPattern,
    aiSuggestion: AITemplateRequest
  ): Record<string, any> {
    const variables: Record<string, any> = {}

    pattern.parameters.forEach((param) => {
      if (aiSuggestion.variables?.[param.name]) {
        variables[param.name] = aiSuggestion.variables[param.name]
      } else {
        // Generate default value based on type
        variables[param.name] = this.generateDefaultValue(param.type)
      }
    })

    return variables
  }

  private extractParametersFromQuery(query: string): string[] {
    const matches = query.match(/\$(\w+)/g)
    return matches ? matches.map((match) => match.slice(1)) : []
  }

  private extractFieldFromError(error: GraphQLError): string {
    return error.path?.[0]?.toString() || 'unknown'
  }

  private findSimilarParameter(param: string, schemaParams: any[]): any | null {
    const threshold = 0.6
    let bestMatch: any = null
    let bestScore = 0

    for (const schemaParam of schemaParams) {
      const score = this.calculateSimilarity(param, schemaParam.name)
      if (score > threshold && score > bestScore) {
        bestScore = score
        bestMatch = schemaParam
      }
    }

    return bestMatch
  }

  private calculateSimilarity(a: string, b: string): number {
    const longer = a.length > b.length ? a : b
    const shorter = a.length > b.length ? b : a
    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = Array(b.length + 1)
      .fill(null)
      .map(() => Array(a.length + 1).fill(0))

    for (let i = 0; i <= a.length; i++) matrix[0]![i] = i
    for (let j = 0; j <= b.length; j++) matrix[j]![0] = j

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1
        matrix[j]![i] = Math.min(
          matrix[j]![i - 1]! + 1,
          matrix[j - 1]![i]! + 1,
          matrix[j - 1]![i - 1]! + indicator
        )
      }
    }

    return matrix[b.length]![a.length]!
  }

  private formatTypeInfo(typeInfo: any): string {
    if (typeInfo.kind === 'NON_NULL' && typeInfo.ofType) {
      return `${this.formatTypeInfo(typeInfo.ofType)}!`
    }
    if (typeInfo.kind === 'LIST' && typeInfo.ofType) {
      return `[${this.formatTypeInfo(typeInfo.ofType)}]`
    }
    return typeInfo.name || typeInfo.kind
  }

  private generateDefaultValue(typeInfo: any): any {
    const baseType = this.getBaseType(typeInfo)

    switch (baseType) {
      case 'String':
        return ''
      case 'Int':
        return 0
      case 'Float':
        return 0.0
      case 'Boolean':
        return false
      case 'ID':
        return ''
      default:
        return null
    }
  }

  private getBaseType(typeInfo: any): string {
    if (typeInfo.ofType) {
      return this.getBaseType(typeInfo.ofType)
    }
    return typeInfo.name || typeInfo.kind
  }

  private calculateConfidence(errors: ValidationError[], corrections: Correction[]): number {
    if (errors.length === 0) return 1.0

    const correctableErrors = errors.filter((error) =>
      corrections.some((correction) => correction.type !== 'PARAMETER_ADD')
    ).length

    const totalErrors = errors.length
    const correctionRatio = correctableErrors / totalErrors

    return Math.max(0, correctionRatio * 0.8) // Max 80% confidence for correctable issues
  }

  private calculateCorrectionConfidence(corrections: Correction[]): number {
    if (corrections.length === 0) return 1.0

    const highConfidenceTypes = ['PARAMETER_RENAME', 'FIELD_REPLACEMENT']
    const highConfidenceCorrections = corrections.filter((c) =>
      highConfidenceTypes.includes(c.type)
    ).length

    return (highConfidenceCorrections / corrections.length) * 0.9 + 0.1
  }
}

// Type definitions
export interface TemplateDefinition {
  identifier: string
  name: string
  query: string
  variables?: Record<string, any>
  tags?: string[]
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  corrections: Correction[]
  confidence: number
}

export interface ValidationError {
  type:
    | 'SYNTAX_ERROR'
    | 'SCHEMA_VALIDATION_ERROR'
    | 'OPERATION_TYPE_ERROR'
    | 'OPERATION_PARSE_ERROR'
    | 'OPERATION_NOT_FOUND'
    | 'MISSING_REQUIRED_PARAMETER'
    | 'UNKNOWN_PARAMETER'
    | 'VALIDATION_ERROR'
  message: string
  field: string
  location?: { line: number; column: number }
}

export interface Correction {
  type:
    | 'PARAMETER_RENAME'
    | 'PARAMETER_STRUCTURE'
    | 'OPERATION_TYPE_FIX'
    | 'FIELD_REPLACEMENT'
    | 'PARAMETER_ADD'
  description: string
  from?: string
  to?: string
  oldStructure?: string
  newStructure?: string
  correctType?: string
  parameterName?: string
  parameterType?: string
}

export interface CorrectedTemplate {
  originalTemplate: TemplateDefinition
  correctedTemplate: TemplateDefinition
  appliedCorrections: string[]
  confidence: number
}

export interface AITemplateRequest {
  identifier: string
  name: string
  operationType: string
  intent: string
  variables?: Record<string, any>
  tags?: string[]
}

export interface ValidatedTemplate {
  template: TemplateDefinition
  validation: ValidationResult
  generatedFrom: 'ai-suggestion' | 'schema-pattern'
  schemaPattern?: QueryPattern
}

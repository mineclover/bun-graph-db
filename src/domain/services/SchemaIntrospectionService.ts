/**
 * Schema Introspection Service for Table Packages
 *
 * Provides intelligent GraphQL schema analysis and validation
 * for table package operations including:
 * - Schema compatibility validation
 * - Type inference from existing schema
 * - Template query validation against live schema
 * - Schema evolution tracking
 * - Automatic field mapping discovery
 */

import {
  introspectionFromSchema,
  validateSchema,
  parse,
  validate
} from 'graphql'
import type { GraphQLSchema, IntrospectionQuery, GraphQLError } from 'graphql'
import type { ILogger } from '@/application/ports/ILogger.js'
import { GraphQLSchemaBuilder } from '@/presentation/graphql/GraphQLSchemaBuilder.js'
import type { DIContainer } from '@/infrastructure/container/DIContainer.js'

export interface SchemaAnalysisResult {
  isValid: boolean
  schema?: GraphQLSchema
  introspection?: IntrospectionQuery
  errors: string[]
  types: SchemaTypeInfo[]
  queries: SchemaOperationInfo[]
  mutations: SchemaOperationInfo[]
  subscriptions: SchemaOperationInfo[]
}

export interface SchemaTypeInfo {
  name: string
  kind: string
  description?: string
  fields?: SchemaFieldInfo[]
  interfaces?: string[]
  possibleTypes?: string[]
}

export interface SchemaFieldInfo {
  name: string
  type: string
  description?: string
  isRequired: boolean
  isArray: boolean
  args?: SchemaArgumentInfo[]
}

export interface SchemaArgumentInfo {
  name: string
  type: string
  description?: string
  defaultValue?: any
  isRequired: boolean
}

export interface SchemaOperationInfo {
  name: string
  type: string
  description?: string
  args: SchemaArgumentInfo[]
  returnType: string
  isArray: boolean
  complexity: number
}

export interface TemplateValidationResult {
  isValid: boolean
  query: string
  operationType: 'query' | 'mutation' | 'subscription'
  errors: GraphQLError[]
  usedFields: string[]
  missingFields: string[]
  complexity: number
  suggestions: string[]
}

export interface SchemaCompatibilityResult {
  isCompatible: boolean
  version: string
  changes: SchemaChange[]
  breakingChanges: SchemaChange[]
  recommendations: string[]
}

export interface SchemaChange {
  type: 'ADD' | 'REMOVE' | 'MODIFY'
  category: 'TYPE' | 'FIELD' | 'ARGUMENT' | 'DIRECTIVE'
  path: string
  oldValue?: any
  newValue?: any
  isBreaking: boolean
  description: string
}

export class SchemaIntrospectionService {
  private cachedSchema?: GraphQLSchema
  private cachedIntrospection?: IntrospectionQuery
  private cacheTimestamp = 0
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor(
    private readonly container: DIContainer,
    private readonly logger: ILogger
  ) {}

  /**
   * Get current GraphQL schema with caching
   */
  async getCurrentSchema(): Promise<GraphQLSchema> {
    const now = Date.now()

    if (this.cachedSchema && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.cachedSchema
    }

    try {
      const schemaBuilder = new GraphQLSchemaBuilder(this.container)
      this.cachedSchema = await schemaBuilder.build()
      this.cacheTimestamp = now

      this.logger.info('Schema loaded and cached', {
        timestamp: new Date(now).toISOString(),
        cacheValid: true
      })

      return this.cachedSchema
    } catch (error) {
      this.logger.error('Failed to load current schema', { error })
      throw new Error(`Schema loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get comprehensive schema analysis
   */
  async analyzeSchema(): Promise<SchemaAnalysisResult> {
    try {
      const schema = await this.getCurrentSchema()
      const introspection = introspectionFromSchema(schema)
      const validationErrors = validateSchema(schema)

      const result: SchemaAnalysisResult = {
        isValid: validationErrors.length === 0,
        schema,
        introspection,
        errors: validationErrors.map(error => error.message),
        types: this.extractTypeInfo(introspection),
        queries: this.extractOperationInfo(introspection, 'Query'),
        mutations: this.extractOperationInfo(introspection, 'Mutation'),
        subscriptions: this.extractOperationInfo(introspection, 'Subscription')
      }

      this.logger.info('Schema analysis completed', {
        isValid: result.isValid,
        typesCount: result.types.length,
        queriesCount: result.queries.length,
        mutationsCount: result.mutations.length,
        subscriptionsCount: result.subscriptions.length,
        errorsCount: result.errors.length
      })

      return result
    } catch (error) {
      this.logger.error('Schema analysis failed', { error })
      throw error
    }
  }

  /**
   * Validate template query against current schema
   */
  async validateTemplateQuery(query: string, _variables?: Record<string, any>): Promise<TemplateValidationResult> {
    try {
      const schema = await this.getCurrentSchema()

      // Parse the query
      const document = parse(query)

      // Validate against schema
      const validationErrors = validate(schema, document)

      // Extract operation info
      const operation = document.definitions[0]
      if (!operation || operation.kind !== 'OperationDefinition') {
        throw new Error('Invalid query: No operation definition found')
      }

      const operationType = operation.operation || 'query'
      const usedFields = this.extractUsedFields(document)
      const complexity = this.calculateQueryComplexity(document, schema)

      const result: TemplateValidationResult = {
        isValid: validationErrors.length === 0,
        query,
        operationType,
        errors: [...validationErrors],
        usedFields,
        missingFields: [], // Would be populated from schema comparison
        complexity,
        suggestions: this.generateQuerySuggestions(document, schema, [...validationErrors])
      }

      this.logger.info('Template query validated', {
        isValid: result.isValid,
        operationType: result.operationType,
        usedFieldsCount: result.usedFields.length,
        complexity: result.complexity,
        errorsCount: result.errors.length
      })

      return result
    } catch (error) {
      this.logger.error('Template query validation failed', { query, error })
      throw error
    }
  }

  /**
   * Check schema compatibility between versions
   */
  async checkSchemaCompatibility(
    previousIntrospection: IntrospectionQuery
  ): Promise<SchemaCompatibilityResult> {
    try {
      const currentSchema = await this.getCurrentSchema()
      const currentIntrospection = introspectionFromSchema(currentSchema)

      const changes = this.compareSchemas(previousIntrospection, currentIntrospection)
      const breakingChanges = changes.filter(change => change.isBreaking)

      const result: SchemaCompatibilityResult = {
        isCompatible: breakingChanges.length === 0,
        version: '1.0.0', // This would come from schema versioning
        changes,
        breakingChanges,
        recommendations: this.generateCompatibilityRecommendations(changes)
      }

      this.logger.info('Schema compatibility checked', {
        isCompatible: result.isCompatible,
        changesCount: result.changes.length,
        breakingChangesCount: result.breakingChanges.length
      })

      return result
    } catch (error) {
      this.logger.error('Schema compatibility check failed', { error })
      throw error
    }
  }

  /**
   * Generate schema-aware template suggestions
   */
  async generateTemplateForTable(tableIdentifier: string): Promise<{
    basicQueries: string[]
    mutations: string[]
    subscriptions: string[]
    fragments: string[]
  }> {
    try {
      const _schema = await this.getCurrentSchema()
      const analysis = await this.analyzeSchema()

      // Find table-related types and operations
      const tableTypes = analysis.types.filter(type =>
        type.name.toLowerCase().includes(tableIdentifier.toLowerCase()) ||
        tableIdentifier.toLowerCase().includes(type.name.toLowerCase())
      )

      const tableQueries = analysis.queries.filter(query =>
        query.name.toLowerCase().includes(tableIdentifier.toLowerCase())
      )

      const tableMutations = analysis.mutations.filter(mutation =>
        mutation.name.toLowerCase().includes(tableIdentifier.toLowerCase())
      )

      const tableSubscriptions = analysis.subscriptions.filter(subscription =>
        subscription.name.toLowerCase().includes(tableIdentifier.toLowerCase())
      )

      const basicQueries = tableQueries.map(query => this.generateQueryTemplate(query))
      const mutations = tableMutations.map(mutation => this.generateMutationTemplate(mutation))
      const subscriptions = tableSubscriptions.map(subscription => this.generateSubscriptionTemplate(subscription))
      const fragments = tableTypes.map(type => this.generateFragmentTemplate(type))

      this.logger.info('Template suggestions generated', {
        tableIdentifier,
        basicQueriesCount: basicQueries.length,
        mutationsCount: mutations.length,
        subscriptionsCount: subscriptions.length,
        fragmentsCount: fragments.length
      })

      return {
        basicQueries,
        mutations,
        subscriptions,
        fragments
      }
    } catch (error) {
      this.logger.error('Template generation failed', { tableIdentifier, error })
      throw error
    }
  }

  /**
   * Clear schema cache
   */
  clearCache(): void {
    this.cachedSchema = undefined
    this.cachedIntrospection = undefined
    this.cacheTimestamp = 0
    this.logger.info('Schema cache cleared')
  }

  // Private helper methods

  private extractTypeInfo(introspection: IntrospectionQuery): SchemaTypeInfo[] {
    const types = introspection.__schema.types || []

    return types
      .filter(type => !type.name.startsWith('__')) // Exclude introspection types
      .map(type => ({
        name: type.name,
        kind: type.kind,
        description: type.description || undefined,
        fields: (type as any).fields?.map((field: any) => ({
          name: field.name,
          type: this.getTypeString(field.type),
          description: field.description || undefined,
          isRequired: field.type.kind === 'NON_NULL',
          isArray: this.isArrayType(field.type),
          args: field.args?.map((arg: any) => ({
            name: arg.name,
            type: this.getTypeString(arg.type),
            description: arg.description || undefined,
            defaultValue: arg.defaultValue,
            isRequired: arg.type.kind === 'NON_NULL'
          }))
        })),
        interfaces: (type as any).interfaces?.map((iface: any) => iface.name),
        possibleTypes: (type as any).possibleTypes?.map((pt: any) => pt.name)
      }))
  }

  private extractOperationInfo(introspection: IntrospectionQuery, operationType: string): SchemaOperationInfo[] {
    const operationTypeObj = operationType === 'Query' ? introspection.__schema.queryType :
                            operationType === 'Mutation' ? introspection.__schema.mutationType :
                            introspection.__schema.subscriptionType

    if (!operationTypeObj) return []

    const type = introspection.__schema.types.find(t => t.name === operationTypeObj.name)
    if (!type || !(type as any).fields) return []

    return (type as any).fields.map((field: any) => ({
      name: field.name,
      type: this.getTypeString(field.type),
      description: field.description || undefined,
      args: field.args?.map((arg: any) => ({
        name: arg.name,
        type: this.getTypeString(arg.type),
        description: arg.description || undefined,
        defaultValue: arg.defaultValue,
        isRequired: arg.type.kind === 'NON_NULL'
      })) || [],
      returnType: this.getTypeString(field.type),
      isArray: this.isArrayType(field.type),
      complexity: this.estimateFieldComplexity(field)
    }))
  }

  private getTypeString(type: any): string {
    if (type.kind === 'NON_NULL') {
      return `${this.getTypeString(type.ofType)}!`
    }
    if (type.kind === 'LIST') {
      return `[${this.getTypeString(type.ofType)}]`
    }
    return type.name || 'Unknown'
  }

  private isArrayType(type: any): boolean {
    if (type.kind === 'NON_NULL') {
      return this.isArrayType(type.ofType)
    }
    return type.kind === 'LIST'
  }

  private extractUsedFields(_document: any): string[] {
    const fields: string[] = []
    // This would recursively extract all field names from the document
    // Implementation would traverse the AST and collect field names
    return fields
  }

  private calculateQueryComplexity(_document: any, _schema: GraphQLSchema): number {
    // Simplified complexity calculation
    // In practice, this would use a proper complexity analysis algorithm
    return 1
  }

  private generateQuerySuggestions(_document: any, _schema: GraphQLSchema, errors: GraphQLError[]): string[] {
    const suggestions: string[] = []

    for (const error of errors) {
      if (error.message.includes('Cannot query field')) {
        const match = error.message.match(/Cannot query field "(\w+)"/)
        if (match?.[1]) {
          suggestions.push(`Field "${match[1]}" not found. Check available fields in schema.`)
        }
      }
    }

    return suggestions
  }

  private compareSchemas(previous: IntrospectionQuery, current: IntrospectionQuery): SchemaChange[] {
    const changes: SchemaChange[] = []

    // Compare types
    const prevTypes = new Map((previous.__schema.types || []).map(t => [t.name, t]))
    const currTypes = new Map((current.__schema.types || []).map(t => [t.name, t]))

    // Find added types
    for (const [name, type] of currTypes) {
      if (!prevTypes.has(name) && !name.startsWith('__')) {
        changes.push({
          type: 'ADD',
          category: 'TYPE',
          path: `types.${name}`,
          newValue: type,
          isBreaking: false,
          description: `Added type: ${name}`
        })
      }
    }

    // Find removed types
    for (const [name, type] of prevTypes) {
      if (!currTypes.has(name) && !name.startsWith('__')) {
        changes.push({
          type: 'REMOVE',
          category: 'TYPE',
          path: `types.${name}`,
          oldValue: type,
          isBreaking: true,
          description: `Removed type: ${name}`
        })
      }
    }

    return changes
  }

  private generateCompatibilityRecommendations(changes: SchemaChange[]): string[] {
    const recommendations: string[] = []

    const breakingChanges = changes.filter(c => c.isBreaking)
    if (breakingChanges.length > 0) {
      recommendations.push('Breaking changes detected. Consider versioning your API.')
      recommendations.push('Review all templates that might use removed or modified fields.')
    }

    const addedTypes = changes.filter(c => c.type === 'ADD' && c.category === 'TYPE')
    if (addedTypes.length > 0) {
      recommendations.push('New types available. Consider creating templates for new functionality.')
    }

    return recommendations
  }

  private estimateFieldComplexity(field: any): number {
    let complexity = 1

    // Increase complexity for fields with arguments
    if (field.args && field.args.length > 0) {
      complexity += field.args.length * 0.5
    }

    // Increase complexity for list types
    if (this.isArrayType(field.type)) {
      complexity += 2
    }

    return Math.round(complexity)
  }

  private generateQueryTemplate(operation: SchemaOperationInfo): string {
    const args = operation.args.length > 0
      ? `(${operation.args.map(arg => `${arg.name}: $${arg.name}`).join(', ')})`
      : ''

    return `query ${operation.name}${args} {
  ${operation.name}${args} {
    # Add fields here based on return type
    id
  }
}`
  }

  private generateMutationTemplate(operation: SchemaOperationInfo): string {
    const args = operation.args.length > 0
      ? `(${operation.args.map(arg => `${arg.name}: $${arg.name}`).join(', ')})`
      : ''

    return `mutation ${operation.name}${args} {
  ${operation.name}${args} {
    success
    # Add result fields here
  }
}`
  }

  private generateSubscriptionTemplate(operation: SchemaOperationInfo): string {
    const args = operation.args.length > 0
      ? `(${operation.args.map(arg => `${arg.name}: $${arg.name}`).join(', ')})`
      : ''

    return `subscription ${operation.name}${args} {
  ${operation.name}${args} {
    # Add subscription fields here
    id
  }
}`
  }

  private generateFragmentTemplate(type: SchemaTypeInfo): string {
    const fields = type.fields?.slice(0, 5).map(field => `  ${field.name}`).join('\n') || '  id'

    return `fragment ${type.name}Fragment on ${type.name} {
${fields}
}`
  }
}
import { type GraphQLSchema, introspectionFromSchema } from 'graphql'

interface IntrospectionTypeRefLike {
  kind: string
  name?: string | null
  ofType?: IntrospectionTypeRefLike | null
}

interface IntrospectionArgumentLike {
  name: string
  description?: string | null
  defaultValue?: unknown
  type: IntrospectionTypeRefLike
}

interface IntrospectionFieldLike {
  name: string
  description?: string | null
  type: IntrospectionTypeRefLike
  args: readonly IntrospectionArgumentLike[]
  isDeprecated?: boolean
  deprecationReason?: string | null
}

interface IntrospectionEnumValueLike {
  name: string
  description?: string | null
  isDeprecated: boolean
}

interface IntrospectionTypeLike {
  name: string
  kind: string
  description?: string | null
  fields?: readonly IntrospectionFieldLike[]
  inputFields?: readonly IntrospectionArgumentLike[]
  enumValues?: readonly IntrospectionEnumValueLike[]
}

interface IntrospectionSchemaLike {
  __schema: {
    queryType?: { name: string } | null
    mutationType?: { name: string } | null
    types: readonly IntrospectionTypeLike[]
  }
}

/**
 * GraphQL Schema Introspection Service
 * Extracts real-time schema information for AI metadata enhancement
 */
export class GraphQLSchemaIntrospector {
  private schema: GraphQLSchema
  private lastIntrospection: Date | null = null
  private cachedIntrospection: SchemaIntrospectionResult | null = null
  private readonly CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

  constructor(schema: GraphQLSchema) {
    this.schema = schema
  }

  /**
   * Get complete schema introspection data
   */
  async getSchemaIntrospection(): Promise<SchemaIntrospectionResult> {
    if (this.isCacheValid() && this.cachedIntrospection) {
      return this.cachedIntrospection
    }

    const introspection = introspectionFromSchema(this.schema) as unknown as IntrospectionSchemaLike
    const result: SchemaIntrospectionResult = {
      schema: introspection,
      queries: this.extractQueries(introspection),
      mutations: this.extractMutations(introspection),
      types: this.extractTypes(introspection),
      lastUpdated: new Date().toISOString(),
      version: this.generateSchemaVersion(introspection),
    }

    this.cachedIntrospection = result
    this.lastIntrospection = new Date()

    return result
  }

  /**
   * Extract query field definitions
   */
  private extractQueries(introspection: IntrospectionSchemaLike): QueryFieldDefinition[] {
    const queryType = introspection.__schema.queryType
    if (!queryType) return []

    return this.extractFieldsFromType(introspection, queryType.name, 'query')
  }

  /**
   * Extract mutation field definitions
   */
  private extractMutations(introspection: IntrospectionSchemaLike): MutationFieldDefinition[] {
    const mutationType = introspection.__schema.mutationType
    if (!mutationType) return []

    return this.extractFieldsFromType(introspection, mutationType.name, 'mutation')
  }

  /**
   * Extract field definitions from a specific type
   */
  private extractFieldsFromType(
    introspection: IntrospectionSchemaLike,
    typeName: string,
    operationType: 'query' | 'mutation',
  ): QueryFieldDefinition[] {
    const types = introspection.__schema.types
    const targetType = types.find((type) => type.name === typeName)

    if (!targetType?.fields) return []

    return targetType.fields.map((field) => ({
      name: field.name,
      description: field.description || undefined,
      operationType,
      args: field.args.map((arg) => ({
        name: arg.name,
        type: this.extractTypeInfo(arg.type),
        description: arg.description || undefined,
        defaultValue: arg.defaultValue,
      })),
      returnType: this.extractTypeInfo(field.type),
      isDeprecated: field.isDeprecated ?? false,
      deprecationReason: field.deprecationReason || undefined,
    }))
  }

  /**
   * Extract type information recursively
   */
  private extractTypeInfo(type: IntrospectionTypeRefLike | null | undefined): TypeInfo {
    if (!type) {
      return {
        kind: 'UNKNOWN',
        name: null,
        isRequired: false,
        ofType: null,
      }
    }

    if (type.kind === 'NON_NULL') {
      return {
        kind: 'NON_NULL',
        name: null,
        isRequired: true,
        ofType: this.extractTypeInfo(type.ofType),
      }
    }

    if (type.kind === 'LIST') {
      return {
        kind: 'LIST',
        name: null,
        isRequired: false,
        ofType: this.extractTypeInfo(type.ofType),
      }
    }

    return {
      kind: type.kind,
      name: type.name ?? null,
      isRequired: false,
      ofType: null,
    }
  }

  /**
   * Extract all custom types from schema
   */
  private extractTypes(introspection: IntrospectionSchemaLike): TypeDefinition[] {
    return introspection.__schema.types
      .filter((type) => !type.name.startsWith('__') && type.kind !== 'SCALAR')
      .map((type) => ({
        name: type.name,
        kind: type.kind,
        description: type.description || undefined,
        fields: type.fields
          ? type.fields.map((field) => ({
              name: field.name,
              type: this.extractTypeInfo(field.type),
              description: field.description || undefined,
            }))
          : [],
        inputFields: type.inputFields
          ? type.inputFields.map((field) => ({
              name: field.name,
              type: this.extractTypeInfo(field.type),
              description: field.description || undefined,
              defaultValue: field.defaultValue,
            }))
          : [],
        enumValues: type.enumValues
          ? type.enumValues.map((value) => ({
              name: value.name,
              description: value.description || undefined,
              isDeprecated: value.isDeprecated,
            }))
          : [],
      }))
  }

  /**
   * Generate schema version hash for change detection
   */
  private generateSchemaVersion(introspection: IntrospectionSchemaLike): string {
    const schemaString = JSON.stringify(introspection, null, 0)
    // Simple hash function for version generation
    let hash = 0
    for (let i = 0; i < schemaString.length; i++) {
      const char = schemaString.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16)
  }

  /**
   * Check if cached introspection is still valid
   */
  private isCacheValid(): boolean {
    if (!this.lastIntrospection || !this.cachedIntrospection) {
      return false
    }

    const timeSinceLastIntrospection = Date.now() - this.lastIntrospection.getTime()
    return timeSinceLastIntrospection < this.CACHE_TTL_MS
  }

  /**
   * Get schema-compliant query patterns for specific operations
   */
  async getQueryPatterns(): Promise<QueryPattern[]> {
    const introspection = await this.getSchemaIntrospection()
    const patterns: QueryPattern[] = []

    // Extract searchNodes patterns
    const searchNodesQuery = introspection.queries.find((q) => q.name === 'searchNodes')
    if (searchNodesQuery) {
      patterns.push({
        operationName: 'searchNodes',
        description: 'Search nodes with filtering, pagination, and sorting',
        example: this.generateSearchNodesExample(searchNodesQuery),
        parameters: searchNodesQuery.args,
        complexity: 'medium',
      })
    }

    // Extract createNode patterns
    const createNodeMutation = introspection.mutations.find((m) => m.name === 'createNode')
    if (createNodeMutation) {
      patterns.push({
        operationName: 'createNode',
        description: 'Create a new node in a table',
        example: this.generateCreateNodeExample(createNodeMutation),
        parameters: createNodeMutation.args,
        complexity: 'simple',
      })
    }

    return patterns
  }

  /**
   * Generate working searchNodes example based on actual schema
   */
  private generateSearchNodesExample(_searchNodesQuery: QueryFieldDefinition): string {
    return `query SearchNodes($filter: SearchNodesFilter!, $pagination: NodesPagination, $sort: [NodeSortInput!]) {
  searchNodes(filter: $filter, pagination: $pagination, sort: $sort) {
    id
    title
    content
    tableId
    createdAt
    relevanceScore
  }
}`
  }

  /**
   * Generate working createNode example based on actual schema
   */
  private generateCreateNodeExample(_createNodeMutation: MutationFieldDefinition): string {
    return `mutation CreateNode($input: CreateNodeInput!) {
  createNode(input: $input) {
    success
    node {
      id
      title
      content
    }
    errors {
      message
      field
    }
  }
}`
  }
}

// Type definitions for schema introspection
export interface SchemaIntrospectionResult {
  schema: IntrospectionSchemaLike
  queries: QueryFieldDefinition[]
  mutations: MutationFieldDefinition[]
  types: TypeDefinition[]
  lastUpdated: string
  version: string
}

export interface QueryFieldDefinition {
  name: string
  description?: string
  operationType: 'query' | 'mutation'
  args: ArgumentDefinition[]
  returnType: TypeInfo
  isDeprecated: boolean
  deprecationReason?: string
}

export interface MutationFieldDefinition extends QueryFieldDefinition {}

export interface ArgumentDefinition {
  name: string
  type: TypeInfo
  description?: string
  defaultValue?: unknown
}

export interface TypeInfo {
  kind: string
  name: string | null
  isRequired: boolean
  ofType: TypeInfo | null
}

export interface TypeDefinition {
  name: string
  kind: string
  description?: string
  fields: FieldDefinition[]
  inputFields: InputFieldDefinition[]
  enumValues: EnumValueDefinition[]
}

export interface FieldDefinition {
  name: string
  type: TypeInfo
  description?: string
}

export interface InputFieldDefinition extends FieldDefinition {
  defaultValue?: unknown
}

export interface EnumValueDefinition {
  name: string
  description?: string
  isDeprecated: boolean
}

export interface QueryPattern {
  operationName: string
  description: string
  example: string
  parameters: ArgumentDefinition[]
  complexity: 'simple' | 'medium' | 'complex'
}

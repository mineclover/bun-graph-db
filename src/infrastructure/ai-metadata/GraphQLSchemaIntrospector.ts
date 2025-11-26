import {
  buildClientSchema,
  type GraphQLSchema,
  getIntrospectionQuery,
  introspectionFromSchema,
} from 'graphql'

/**
 * GraphQL Schema Introspection Service
 * Extracts real-time schema information for AI metadata enhancement
 */
export class GraphQLSchemaIntrospector {
  private schema: GraphQLSchema
  private lastIntrospection: Date | null = null
  private cachedIntrospection: any = null
  private readonly CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

  constructor(schema: GraphQLSchema) {
    this.schema = schema
  }

  /**
   * Get complete schema introspection data
   */
  async getSchemaIntrospection(): Promise<SchemaIntrospectionResult> {
    if (this.isCacheValid()) {
      return this.cachedIntrospection
    }

    const introspection = introspectionFromSchema(this.schema)
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
  private extractQueries(introspection: any): QueryFieldDefinition[] {
    const queryType = introspection.data.__schema.queryType
    if (!queryType) return []

    return this.extractFieldsFromType(introspection, queryType.name, 'query')
  }

  /**
   * Extract mutation field definitions
   */
  private extractMutations(introspection: any): MutationFieldDefinition[] {
    const mutationType = introspection.data.__schema.mutationType
    if (!mutationType) return []

    return this.extractFieldsFromType(introspection, mutationType.name, 'mutation')
  }

  /**
   * Extract field definitions from a specific type
   */
  private extractFieldsFromType(
    introspection: any,
    typeName: string,
    operationType: 'query' | 'mutation'
  ): any[] {
    const types = introspection.data.__schema.types
    const targetType = types.find((type: any) => type.name === typeName)

    if (!targetType || !targetType.fields) return []

    return targetType.fields.map((field: any) => ({
      name: field.name,
      description: field.description,
      operationType,
      args: field.args.map((arg: any) => ({
        name: arg.name,
        type: this.extractTypeInfo(arg.type),
        description: arg.description,
        defaultValue: arg.defaultValue,
      })),
      returnType: this.extractTypeInfo(field.type),
      isDeprecated: field.isDeprecated,
      deprecationReason: field.deprecationReason,
    }))
  }

  /**
   * Extract type information recursively
   */
  private extractTypeInfo(type: any): TypeInfo {
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
      name: type.name,
      isRequired: false,
      ofType: null,
    }
  }

  /**
   * Extract all custom types from schema
   */
  private extractTypes(introspection: any): TypeDefinition[] {
    return introspection.data.__schema.types
      .filter((type: any) => !type.name.startsWith('__') && type.kind !== 'SCALAR')
      .map((type: any) => ({
        name: type.name,
        kind: type.kind,
        description: type.description,
        fields: type.fields
          ? type.fields.map((field: any) => ({
              name: field.name,
              type: this.extractTypeInfo(field.type),
              description: field.description,
            }))
          : [],
        inputFields: type.inputFields
          ? type.inputFields.map((field: any) => ({
              name: field.name,
              type: this.extractTypeInfo(field.type),
              description: field.description,
              defaultValue: field.defaultValue,
            }))
          : [],
        enumValues: type.enumValues
          ? type.enumValues.map((value: any) => ({
              name: value.name,
              description: value.description,
              isDeprecated: value.isDeprecated,
            }))
          : [],
      }))
  }

  /**
   * Generate schema version hash for change detection
   */
  private generateSchemaVersion(introspection: any): string {
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
  private generateSearchNodesExample(searchNodesQuery: any): string {
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
  private generateCreateNodeExample(createNodeMutation: any): string {
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
  schema: any
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
  defaultValue?: any
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
  defaultValue?: any
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

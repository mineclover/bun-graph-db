/**
 * GraphQL service tokens for dependency injection
 */

export const GraphQLTokens = {
  // GraphQL schema and resolvers
  GRAPHQL_SCHEMA: Symbol.for('GraphqlSchema'),
  GRAPHQL_SCHEMA_BUILDER: Symbol.for('GraphQLSchemaBuilder'),
  GRAPHQL_EXECUTOR: Symbol.for('GraphQLExecutor'),

  // Consolidated resolvers (Task 2.2 - Progressive migration)
  NODE_RESOLVER: Symbol.for('NodeResolver'),
  TABLE_RESOLVER: Symbol.for('TableResolver'),
  DOC_RESOLVER: Symbol.for('DocResolver'),
  ATTRIBUTE_RESOLVER: Symbol.for('AttributeResolver'),
  RELATION_RESOLVER: Symbol.for('RelationResolver'),
  QUERY_TEMPLATE_RESOLVER: Symbol.for('QueryTemplateResolver'),

  // Query resolvers
  TABLE_QUERIES: Symbol.for('TableQueries'),
  NODE_QUERIES: Symbol.for('NodeQueries'),
  ATTRIBUTE_QUERIES: Symbol.for('AttributeQueries'),
  RELATION_QUERIES: Symbol.for('RelationQueries'),
  TEMPLATE_QUERIES: Symbol.for('TemplateQueries'),
  DOC_QUERIES: Symbol.for('DocQueries'),
  ANALYTICS_QUERIES: Symbol.for('AnalyticsQueries'),
  SYSTEM_QUERIES: Symbol.for('SystemQueries'),
  ENHANCED_ATTRIBUTE_QUERIES: Symbol.for('EnhancedAttributeQueries'),

  // Mutation resolvers
  TABLE_MUTATIONS: Symbol.for('TableMutations'),
  NODE_MUTATIONS: Symbol.for('NodeMutations'),
  ATTRIBUTE_MUTATIONS: Symbol.for('AttributeMutations'),
  RELATION_MUTATIONS: Symbol.for('RelationMutations'),
  TEMPLATE_MUTATIONS: Symbol.for('TemplateMutations'),
  DOC_MUTATIONS: Symbol.for('DocMutations'),
  EXPORT_MUTATIONS: Symbol.for('ExportMutations'),
  TABLE_PACKAGE_RESOLVER: Symbol.for('TablePackageResolver'),
  SYSTEM_RESOLVER: Symbol.for('SystemResolver'),

  // Field resolvers
  TABLE_FIELD_RESOLVERS: Symbol.for('TableFieldResolvers'),
  NODE_FIELD_RESOLVERS: Symbol.for('NodeFieldResolvers'),
  ATTRIBUTE_FIELD_RESOLVERS: Symbol.for('AttributeFieldResolvers'),
  RELATION_FIELD_RESOLVERS: Symbol.for('RelationFieldResolvers'),
  RELATION_TYPE_FIELD_RESOLVERS: Symbol.for('RelationTypeFieldResolvers'),
  QUERY_TEMPLATE_FIELD_RESOLVERS: Symbol.for('QueryTemplateFieldResolvers'),
  DOC_FIELD_RESOLVERS: Symbol.for('DocFieldResolvers'),

  // GraphQL configuration
  GRAPHQL_CONFIG: Symbol.for('GraphQLConfig'),
} as const

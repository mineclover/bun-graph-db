/**
 * GraphQL service tokens for dependency injection
 */

export const GraphQLTokens = {
  // GraphQL schema and resolvers
  GRAPHQL_SCHEMA: Symbol.for('GraphQLSchema'),
  GRAPHQL_SCHEMA_BUILDER: Symbol.for('GraphQLSchemaBuilder'),
  
  // Query resolvers
  TABLE_QUERIES: Symbol.for('TableQueries'),
  NODE_QUERIES: Symbol.for('NodeQueries'),
  ATTRIBUTE_QUERIES: Symbol.for('AttributeQueries'),
  RELATION_QUERIES: Symbol.for('RelationQueries'),
  ANALYTICS_QUERIES: Symbol.for('AnalyticsQueries'),
  TEMPLATE_QUERIES: Symbol.for('TemplateQueries'),
  
  // Mutation resolvers
  TABLE_MUTATIONS: Symbol.for('TableMutations'),
  NODE_MUTATIONS: Symbol.for('NodeMutations'),
  ATTRIBUTE_MUTATIONS: Symbol.for('AttributeMutations'),
  RELATION_MUTATIONS: Symbol.for('RelationMutations'),
  TEMPLATE_MUTATIONS: Symbol.for('TemplateMutations'),
  
  // Field resolvers
  TABLE_FIELD_RESOLVERS: Symbol.for('TableFieldResolvers'),
  NODE_FIELD_RESOLVERS: Symbol.for('NodeFieldResolvers'),
  ATTRIBUTE_FIELD_RESOLVERS: Symbol.for('AttributeFieldResolvers'),
  RELATION_FIELD_RESOLVERS: Symbol.for('RelationFieldResolvers'),
  
  // GraphQL configuration
  GRAPHQL_CONFIG: Symbol.for('GraphQLConfig')
} as const
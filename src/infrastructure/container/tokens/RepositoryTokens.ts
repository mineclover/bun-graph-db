/**
 * Repository service tokens for dependency injection
 */

export const RepositoryTokens = {
  // Domain repositories
  TABLE_REPOSITORY: Symbol.for('TableRepository'),
  ATTRIBUTE_TYPE_REPOSITORY: Symbol.for('AttributeTypeRepository'),
  ATTRIBUTE_REPOSITORY: Symbol.for('AttributeRepository'),
  NODE_REPOSITORY: Symbol.for('NodeRepository'),
  NODE_ATTRIBUTE_REPOSITORY: Symbol.for('NodeAttributeRepository'),
  NODE_RELATION_REPOSITORY: Symbol.for('NodeRelationRepository'),
  RELATION_TYPE_REPOSITORY: Symbol.for('RelationTypeRepository'),
  QUERY_TEMPLATE_REPOSITORY: Symbol.for('QueryTemplateRepository'),

  // Search repositories
  NODE_SEARCH_REPOSITORY: Symbol.for('NodeSearchRepository'),
  GRAPH_REPOSITORY: Symbol.for('GraphRepository'),
} as const

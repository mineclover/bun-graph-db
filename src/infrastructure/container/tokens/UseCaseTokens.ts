/**
 * Use case service tokens for dependency injection
 */

export const UseCaseTokens = {
  // Table use cases
  CREATE_TABLE_USE_CASE: Symbol.for('CreateTableUseCase'),
  DELETE_TABLE_USE_CASE: Symbol.for('DeleteTableUseCase'),
  
  // Attribute use cases
  CREATE_ATTRIBUTE_TYPE_USE_CASE: Symbol.for('CreateAttributeTypeUseCase'),
  CREATE_ATTRIBUTE_USE_CASE: Symbol.for('CreateAttributeUseCase'),
  
  // Node use cases
  CREATE_NODE_USE_CASE: Symbol.for('CreateNodeUseCase'),
  SEARCH_NODES_USE_CASE: Symbol.for('SearchNodesUseCase'),
  
  // Relation use cases
  CREATE_RELATION_USE_CASE: Symbol.for('CreateRelationUseCase'),
  CREATE_RELATION_TYPE_USE_CASE: Symbol.for('CreateRelationTypeUseCase'),
  SEARCH_RELATED_NODES_USE_CASE: Symbol.for('SearchRelatedNodesUseCase'),
  
  // Import/Export use cases
  SCHEMA_EXPORT_USE_CASE: Symbol.for('SchemaExportUseCase'),
  SCHEMA_IMPORT_USE_CASE: Symbol.for('SchemaImportUseCase'),
  
  // Query template use cases
  EXECUTE_QUERY_TEMPLATE_USE_CASE: Symbol.for('ExecuteQueryTemplateUseCase')
} as const
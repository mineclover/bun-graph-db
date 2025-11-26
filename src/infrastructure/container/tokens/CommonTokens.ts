/**
 * Common service tokens for dependency injection
 */

export const CommonTokens = {
  // Common services
  LOGGER: Symbol.for('Logger'),

  // Configuration
  ENVIRONMENT_CONFIG: Symbol.for('EnvironmentConfig'),

  // Application services
  SEARCH_QUERY_PARSER: Symbol.for('SearchQueryParser'),

  // Domain services
  JSON_EXPORT_SERVICE: Symbol.for('JsonExportService'),
} as const

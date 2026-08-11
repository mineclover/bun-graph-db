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
  TABLE_SCHEMA_PROJECTION_SERVICE: Symbol.for('TableSchemaProjectionService'),

  // Domain services
  JSON_EXPORT_SERVICE: Symbol.for('JsonExportService'),
  JSONL_BACKUP_SERVICE: Symbol.for('JsonlBackupService'),
  SQLITE_BACKUP_SERVICE: Symbol.for('SQLiteBackupService'),
  AUTO_PERSISTENCE_SERVICE: Symbol.for('AutoPersistenceService'),
  TABULAR_SYNC_HOOK: Symbol.for('TabularSyncHook'),
  TABULAR_SYNC_CONFIG_STORE: Symbol.for('TabularSyncConfigStore'),
  TABULAR_SYNC_CONFIG_ACTIVATION_SERVICE: Symbol.for('TabularSyncConfigActivationService'),
  TABULAR_SYNC_EVENT_STORE: Symbol.for('TabularSyncEventStore'),
} as const

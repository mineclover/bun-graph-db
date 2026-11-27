export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  DateTime: { input: string; output: string; }
  JSON: { input: any; output: any; }
};

export type AiCommonQuery = {
  __typename?: 'AICommonQuery';
  description: Scalars['String']['output'];
  example: Scalars['String']['output'];
  pattern: Scalars['String']['output'];
};

export type AiMetadata = {
  __typename?: 'AIMetadata';
  sampleData?: Maybe<AiSampleData>;
  schemaInfo: AiSchemaInfo;
  usagePatterns: AiUsagePatterns;
};

export type AiQueryComplexity =
  | 'complex'
  | 'moderate'
  | 'simple';

export type AiSampleData = {
  __typename?: 'AISampleData';
  entries: Array<AiSampleEntry>;
  hasMore: Scalars['Boolean']['output'];
  nodes: Array<AiSampleNode>;
  relationships: Array<AiSampleRelationship>;
  totalCount: Scalars['Int']['output'];
};

export type AiSampleEntry = {
  __typename?: 'AISampleEntry';
  attributes: Scalars['JSON']['output'];
  content: Scalars['String']['output'];
  nodeId: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type AiSampleNode = {
  __typename?: 'AISampleNode';
  attributes: Scalars['JSON']['output'];
  content: Scalars['String']['output'];
  id: Scalars['String']['output'];
};

export type AiSampleRelationship = {
  __typename?: 'AISampleRelationship';
  from: Scalars['String']['output'];
  to: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export type AiSchemaInfo = {
  __typename?: 'AISchemaInfo';
  dataTypes: Scalars['JSON']['output'];
  projectionVersionHash?: Maybe<Scalars['String']['output']>;
  relationshipCapabilities: Array<Scalars['String']['output']>;
  requiredFields: Array<Scalars['String']['output']>;
  searchableFields: Array<Scalars['String']['output']>;
};

export type AiTemplateRecommendation = {
  __typename?: 'AITemplateRecommendation';
  templateId: Scalars['String']['output'];
  useCase: Scalars['String']['output'];
};

export type AiUsagePatterns = {
  __typename?: 'AIUsagePatterns';
  commonQueries: Array<AiCommonQuery>;
  queryComplexity: AiQueryComplexity;
  templateRecommendations: Array<AiTemplateRecommendation>;
};

export type ActivateDocPayload = OperationResult & {
  __typename?: 'ActivateDocPayload';
  doc?: Maybe<Doc>;
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type ActivateTabularSyncConfigPayload = OperationResult & {
  __typename?: 'ActivateTabularSyncConfigPayload';
  config?: Maybe<TabularSyncConfigRecord>;
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

/**
 * Advanced nodes connection with sorting metadata
 * Includes performance insights and optimization information
 */
export type AdvancedNodesConnection = Connection & {
  __typename?: 'AdvancedNodesConnection';
  /** Whether there are more pages available */
  hasNextPage: Scalars['Boolean']['output'];
  /** Whether there are previous pages available */
  hasPreviousPage: Scalars['Boolean']['output'];
  /** Retrieved nodes matching the query */
  nodes: Array<TableNode>;
  /** Metadata about the sort execution */
  sortMetadata?: Maybe<SortResultMetadata>;
  /** Total count of nodes matching the filter (before pagination) */
  totalCount: Scalars['Int']['output'];
};

/**
 * Advanced sort input with extended options for fine-grained control
 * Provides comprehensive sorting capabilities including data type awareness,
 * null handling, case sensitivity, and locale-specific sorting
 */
export type AdvancedSortInput = {
  /** Case sensitivity for text fields */
  caseSensitive?: InputMaybe<Scalars['Boolean']['input']>;
  /** Data type hint for optimal sort strategy selection */
  dataType?: InputMaybe<SortDataType>;
  /** Sort direction (ASC or DESC) */
  direction: SortDirection;
  /** Field name to sort by */
  field: Scalars['String']['input'];
  /** Index hint to optimize query performance */
  indexHint?: InputMaybe<Scalars['String']['input']>;
  /** Locale for locale-aware text sorting */
  locale?: InputMaybe<Scalars['String']['input']>;
  /** How to handle null values in sorting */
  nullHandling?: InputMaybe<NullHandling>;
};

export type AggregateDataInput = {
  aggregateFunction: AggregateFunction;
  filters?: InputMaybe<Array<AttributeFilter>>;
  groupBy: Scalars['String']['input'];
  tableId: Scalars['ID']['input'];
};

export type AggregateFunction =
  | 'AVG'
  | 'COUNT'
  | 'DISTINCT_COUNT'
  | 'MAX'
  | 'MIN'
  | 'SUM';

export type AggregationResult = {
  __typename?: 'AggregationResult';
  count: Scalars['Int']['output'];
  field: Scalars['String']['output'];
  percentage: Scalars['Float']['output'];
  value: Scalars['String']['output'];
};

export type AlternativePath = {
  __typename?: 'AlternativePath';
  path: Array<PathNode>;
  pathQuality: PathQuality;
  qualityDifference: Scalars['Float']['output'];
  totalDistance: Scalars['Float']['output'];
};

export type AnalyticsMetric =
  | 'ALL'
  | 'BETWEENNESS_CENTRALITY'
  | 'CLUSTERING_COEFFICIENT'
  | 'DEGREE'
  | 'PAGE_RANK';

export type AnalyzeNodesInput = {
  metrics: Array<AnalyticsMetric>;
  nodeIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  tableId?: InputMaybe<Scalars['ID']['input']>;
};

export type AnalyzeNodesPayload = {
  __typename?: 'AnalyzeNodesPayload';
  analytics: Array<NodeAnalytics>;
  errors: Array<Error>;
  graphMetrics?: Maybe<GraphMetrics>;
};

export type AncestorChainResult = {
  __typename?: 'AncestorChainResult';
  ancestors: Array<HierarchyEntry>;
  depth: Scalars['Int']['output'];
  hasCycle: Scalars['Boolean']['output'];
  isRoot: Scalars['Boolean']['output'];
  node: TableNode;
  pathIds: Array<Scalars['ID']['output']>;
  rootNode?: Maybe<TableNode>;
};

/** Result of applying retention policy */
export type ApplyRetentionPolicyResult = {
  __typename?: 'ApplyRetentionPolicyResult';
  /** List of deleted backup paths */
  deletedBackups: Array<Scalars['String']['output']>;
  /** Number of backups deleted */
  deletedCount: Scalars['Int']['output'];
  /** Error messages */
  errors: Array<Scalars['String']['output']>;
  /** Space freed in bytes */
  spaceFreed: Scalars['Float']['output'];
};

export type Attribute = Node & {
  __typename?: 'Attribute';
  attributeType: AttributeType;
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  identifier: Scalars['String']['output'];
  name: Scalars['String']['output'];
  required: Scalars['Boolean']['output'];
  searchable: Scalars['Boolean']['output'];
  table: Table;
  tableId: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type AttributeByIdentifierInput = {
  identifier: Scalars['String']['input'];
  value: Scalars['String']['input'];
};

export type AttributeCompleteness = {
  __typename?: 'AttributeCompleteness';
  attributeCompleteness: Array<SingleAttributeCompleteness>;
  completeNodes: Scalars['Int']['output'];
  completenessRate: Scalars['Float']['output'];
  incompleteNodes: Scalars['Int']['output'];
  tableId: Scalars['ID']['output'];
  totalNodes: Scalars['Int']['output'];
  totalOptionalAttributes: Scalars['Int']['output'];
  totalRequiredAttributes: Scalars['Int']['output'];
};

export type AttributeDocumentation = {
  __typename?: 'AttributeDocumentation';
  attribute: Attribute;
  attributeType: AttributeType;
  nullCount: Scalars['Int']['output'];
  sampleValues?: Maybe<Array<Scalars['String']['output']>>;
  valueCount: Scalars['Int']['output'];
};

export type AttributeExport = {
  __typename?: 'AttributeExport';
  attributeType: Scalars['String']['output'];
  defaultValue?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  identifier: Scalars['String']['output'];
  isRequired: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
};

export type AttributeExportInput = {
  attributeType: Scalars['String']['input'];
  defaultValue?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  identifier: Scalars['String']['input'];
  isRequired?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
};

/**
 * Filter nodes by attribute values with flexible operators
 * Supports text matching, numeric comparisons, and range queries
 * Use either attributeId (numeric ID) or identifier (string name) to specify the attribute
 */
export type AttributeFilter = {
  /** Attribute ID to filter on (use this OR identifier) */
  attributeId?: InputMaybe<Scalars['ID']['input']>;
  /** Attribute identifier/name to filter on (use this OR attributeId) */
  identifier?: InputMaybe<Scalars['String']['input']>;
  /** Comparison operator for the filter */
  operator?: InputMaybe<FilterOperator>;
  /** Value to compare against (string representation) */
  value: Scalars['String']['input'];
};

export type AttributeFilterOperator =
  | 'BETWEEN'
  | 'CONTAINS'
  | 'ENDS_WITH'
  | 'EQUALS'
  | 'GREATER_THAN'
  | 'IN'
  | 'IS_NOT_NULL'
  | 'IS_NULL'
  | 'LESS_THAN'
  | 'NOT_EQUALS'
  | 'NOT_IN'
  | 'STARTS_WITH';

export type AttributeFormat =
  | 'COLUMNS'
  | 'KEYVALUE'
  | 'NESTED';

export type AttributeGroupBy =
  | 'ATTRIBUTE'
  | 'DATA_TYPE'
  | 'TABLE'
  | 'VALUE';

export type AttributeStats = {
  __typename?: 'AttributeStats';
  attributeId: Scalars['ID']['output'];
  completenessRate: Scalars['Float']['output'];
  dataType: Scalars['String']['output'];
  identifier: Scalars['String']['output'];
  nullValues: Scalars['Int']['output'];
  totalValues: Scalars['Int']['output'];
  uniqueValues: Scalars['Int']['output'];
};

export type AttributeType = Node & {
  __typename?: 'AttributeType';
  constraints?: Maybe<Scalars['JSON']['output']>;
  createdAt: Scalars['DateTime']['output'];
  dataType: Scalars['String']['output'];
  defaultValue?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  format?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  identifier: Scalars['String']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type AttributeTypeExport = {
  __typename?: 'AttributeTypeExport';
  dataType: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  identifier: Scalars['String']['output'];
  name: Scalars['String']['output'];
  validationRules?: Maybe<Scalars['JSON']['output']>;
};

export type AttributeTypeExportInput = {
  dataType: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  identifier: Scalars['String']['input'];
  name: Scalars['String']['input'];
  validationRules?: InputMaybe<Scalars['JSON']['input']>;
};

export type AttributeTypeStats = {
  __typename?: 'AttributeTypeStats';
  averageValuesPerNode: Scalars['Float']['output'];
  identifier: Scalars['String']['output'];
  jsonType: Scalars['String']['output'];
  typeId: Scalars['ID']['output'];
  usageCount: Scalars['Int']['output'];
};

export type AttributeTypesConnection = Connection & {
  __typename?: 'AttributeTypesConnection';
  attributeTypes: Array<AttributeType>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  totalCount: Scalars['Int']['output'];
};

export type AttributeTypesFilter = {
  createdAfter?: InputMaybe<Scalars['DateTime']['input']>;
  createdBefore?: InputMaybe<Scalars['DateTime']['input']>;
  dataType?: InputMaybe<Scalars['String']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};

export type AttributeValueGroup = {
  __typename?: 'AttributeValueGroup';
  count: Scalars['Int']['output'];
  nodes: Array<TableNode>;
  percentage: Scalars['Float']['output'];
  value: Scalars['String']['output'];
};

export type AttributeValueRange = {
  __typename?: 'AttributeValueRange';
  attributeId: Scalars['ID']['output'];
  averageLength?: Maybe<Scalars['Float']['output']>;
  commonValues: Array<Scalars['String']['output']>;
  identifier: Scalars['String']['output'];
  maxValue?: Maybe<Scalars['String']['output']>;
  minValue?: Maybe<Scalars['String']['output']>;
};

export type AttributesConnection = Connection & {
  __typename?: 'AttributesConnection';
  attributes: Array<Attribute>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  totalCount: Scalars['Int']['output'];
};

export type AttributesFilter = {
  attributeTypeId?: InputMaybe<Scalars['ID']['input']>;
  createdAfter?: InputMaybe<Scalars['DateTime']['input']>;
  createdBefore?: InputMaybe<Scalars['DateTime']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  tableId?: InputMaybe<Scalars['ID']['input']>;
};

/** Options for creating a database backup */
export type BackupDatabaseInput = {
  /** Enable gzip compression */
  compress?: InputMaybe<Scalars['Boolean']['input']>;
  /** Include Write-Ahead Log (WAL) file */
  includeWAL?: InputMaybe<Scalars['Boolean']['input']>;
  /** Custom output path (default: ./backups/database/db_{timestamp}.sqlite) */
  outputPath?: InputMaybe<Scalars['String']['input']>;
  /** Validate backup integrity after creation */
  validate?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Result of database backup operation */
export type BackupDatabaseResult = {
  __typename?: 'BackupDatabaseResult';
  /** Path to the backup file */
  backupPath: Scalars['String']['output'];
  /** SHA-256 checksum (if validation enabled) */
  checksum?: Maybe<Scalars['String']['output']>;
  /** Operation duration in milliseconds */
  duration: Scalars['Float']['output'];
  /** Error messages */
  errors: Array<Scalars['String']['output']>;
  /** Backup file size in bytes */
  sizeBytes: Scalars['Float']['output'];
  /** Operation success status */
  success: Scalars['Boolean']['output'];
  /** Warning messages */
  warnings: Array<Scalars['String']['output']>;
};

/** Individual backup item */
export type BackupItem = {
  __typename?: 'BackupItem';
  /** SHA-256 checksum */
  checksum?: Maybe<Scalars['String']['output']>;
  /** Whether backup is compressed */
  compressed: Scalars['Boolean']['output'];
  /** Creation timestamp */
  createdAt: Scalars['DateTime']['output'];
  /** Node count (for table backups) */
  nodeCount?: Maybe<Scalars['Int']['output']>;
  /** Backup file path */
  path: Scalars['String']['output'];
  /** File size in bytes */
  sizeBytes: Scalars['Float']['output'];
  /** Table identifier (for table backups) */
  tableIdentifier?: Maybe<Scalars['String']['output']>;
  /** Backup type */
  type: BackupType;
};

/** Filter for listing backups */
export type BackupListFilterInput = {
  /** Only backups created after this date */
  createdAfter?: InputMaybe<Scalars['DateTime']['input']>;
  /** Only backups created before this date */
  createdBefore?: InputMaybe<Scalars['DateTime']['input']>;
  /** Backup type filter */
  type?: InputMaybe<BackupType>;
};

/** Result of listing backups */
export type BackupListResult = {
  __typename?: 'BackupListResult';
  /** List of file-level backups */
  fileBackups: Array<BackupItem>;
  /** List of table-level backups */
  tableBackups: Array<BackupItem>;
  /** Total number of backups */
  totalCount: Scalars['Int']['output'];
  /** Total size in bytes */
  totalSizeBytes: Scalars['Float']['output'];
};

/** Backup metrics and statistics */
export type BackupMetrics = {
  __typename?: 'BackupMetrics';
  /** Average backup duration in milliseconds */
  averageBackupDuration: Scalars['Float']['output'];
  /** List of recent failed backups */
  failedBackups: Array<FailedBackupInfo>;
  /** Timestamp of last backup */
  lastBackupTime?: Maybe<Scalars['DateTime']['output']>;
  /** Success rate percentage */
  successRate: Scalars['Float']['output'];
  /** Total size of all backups in bytes */
  totalBackupSize: Scalars['Float']['output'];
  /** Total number of backups created */
  totalBackups: Scalars['Int']['output'];
};

/** Options for backup retention policy */
export type BackupRetentionPolicyInput = {
  /** Maximum age in days */
  maxAgeDays?: InputMaybe<Scalars['Int']['input']>;
  /** Maximum number of backups to keep */
  maxBackups?: InputMaybe<Scalars['Int']['input']>;
  /** Minimum free disk space in bytes */
  minFreeSpaceBytes?: InputMaybe<Scalars['Float']['input']>;
};

/** Backup type enumeration */
export type BackupType =
  /** All backup types */
  | 'ALL'
  /** File-level database backup */
  | 'FILE'
  /** Table-level JSON backup */
  | 'TABLE';

export type BatchCreateAttributeResult = {
  __typename?: 'BatchCreateAttributeResult';
  attribute?: Maybe<Attribute>;
  errors: Array<Scalars['String']['output']>;
};

export type BatchCreateAttributesPayload = {
  __typename?: 'BatchCreateAttributesPayload';
  results: Array<BatchCreateAttributeResult>;
  success: Scalars['Boolean']['output'];
  totalCreated: Scalars['Int']['output'];
  totalFailed: Scalars['Int']['output'];
};

export type BatchCreateNodeItemInput = {
  content: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type BatchCreateNodeResult = {
  __typename?: 'BatchCreateNodeResult';
  errors: Array<BatchOperationError>;
  node?: Maybe<TableNode>;
};

export type BatchCreateNodesInput = {
  nodes: Array<BatchCreateNodeItemInput>;
  options?: InputMaybe<BatchCreateNodesOptionsInput>;
  tableId: Scalars['ID']['input'];
};

export type BatchCreateNodesOptionsInput = {
  continueOnError?: InputMaybe<Scalars['Boolean']['input']>;
  validateBeforeInsert?: InputMaybe<Scalars['Boolean']['input']>;
};

export type BatchCreateNodesPayload = {
  __typename?: 'BatchCreateNodesPayload';
  averageTimePerNodeMs: Scalars['Float']['output'];
  errorSummary: BatchErrorSummary;
  errors: Array<BatchOperationError>;
  memoryUsageMB: Scalars['Float']['output'];
  nodes: Array<TableNode>;
  processingTimeMs: Scalars['Float']['output'];
  results: Array<BatchCreateNodeResult>;
  statistics: BatchCreateNodesStatistics;
  success: Scalars['Boolean']['output'];
  totalCreated: Scalars['Int']['output'];
  totalFailed: Scalars['Int']['output'];
};

export type BatchCreateNodesStatistics = {
  __typename?: 'BatchCreateNodesStatistics';
  executionTime: Scalars['Float']['output'];
  failed: Scalars['Int']['output'];
  successfullyCreated: Scalars['Int']['output'];
  totalRequested: Scalars['Int']['output'];
};

export type BatchCreateNodesTransactionalPayload = {
  __typename?: 'BatchCreateNodesTransactionalPayload';
  rollbackOccurred: Scalars['Boolean']['output'];
  success: Scalars['Boolean']['output'];
  totalCreated: Scalars['Int']['output'];
  totalFailed: Scalars['Int']['output'];
};

export type BatchCreateNodesWithProgressPayload = {
  __typename?: 'BatchCreateNodesWithProgressPayload';
  progressUpdates: Array<BatchProgressUpdate>;
  success: Scalars['Boolean']['output'];
  totalCreated: Scalars['Int']['output'];
  totalFailed: Scalars['Int']['output'];
};

export type BatchCreateRelationResult = {
  __typename?: 'BatchCreateRelationResult';
  errors: Array<Scalars['String']['output']>;
  relation?: Maybe<BatchRelationSummary>;
};

export type BatchCreateRelationsPayload = {
  __typename?: 'BatchCreateRelationsPayload';
  results: Array<BatchCreateRelationResult>;
  success: Scalars['Boolean']['output'];
  totalCreated: Scalars['Int']['output'];
  totalFailed: Scalars['Int']['output'];
};

export type BatchCreateTableResult = {
  __typename?: 'BatchCreateTableResult';
  errors: Array<Scalars['String']['output']>;
  table?: Maybe<Table>;
};

export type BatchCreateTablesPayload = {
  __typename?: 'BatchCreateTablesPayload';
  results: Array<BatchCreateTableResult>;
  success: Scalars['Boolean']['output'];
  totalCreated: Scalars['Int']['output'];
  totalFailed: Scalars['Int']['output'];
};

export type BatchDeleteTablesPayload = {
  __typename?: 'BatchDeleteTablesPayload';
  deletedCount: Scalars['Int']['output'];
  errors: Array<Scalars['String']['output']>;
  failedCount: Scalars['Int']['output'];
  success: Scalars['Boolean']['output'];
};

export type BatchErrorSummary = {
  __typename?: 'BatchErrorSummary';
  databaseErrors: Scalars['Int']['output'];
  systemErrors: Scalars['Int']['output'];
  validationErrors: Scalars['Int']['output'];
};

export type BatchImportOptionsInput = {
  conflictResolution?: InputMaybe<ConflictResolutionStrategy>;
  continueOnError?: InputMaybe<Scalars['Boolean']['input']>;
  generateTemplates?: InputMaybe<Scalars['Boolean']['input']>;
  newTablePrefix?: InputMaybe<Scalars['String']['input']>;
};

export type BatchImportResult = {
  __typename?: 'BatchImportResult';
  errors: Array<Scalars['String']['output']>;
  generatedTemplates: Array<GeneratedTemplate>;
  importedTable?: Maybe<ImportedTable>;
  packageIdentifier: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
  warnings: Array<Scalars['String']['output']>;
};

export type BatchImportSummary = {
  __typename?: 'BatchImportSummary';
  failed: Scalars['Int']['output'];
  skipped: Scalars['Int']['output'];
  succeeded: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type BatchImportTablePackagesInput = {
  createSession?: InputMaybe<Scalars['Boolean']['input']>;
  options?: InputMaybe<BatchImportOptionsInput>;
  packages: Array<TablePackageInput>;
};

export type BatchImportTablePackagesResult = {
  __typename?: 'BatchImportTablePackagesResult';
  results: Array<BatchImportResult>;
  session?: Maybe<ImportSession>;
  success: Scalars['Boolean']['output'];
  summary: BatchImportSummary;
};

export type BatchOperationError = {
  __typename?: 'BatchOperationError';
  code: Scalars['String']['output'];
  details?: Maybe<Scalars['JSON']['output']>;
  field?: Maybe<Scalars['String']['output']>;
  index?: Maybe<Scalars['Int']['output']>;
  message: Scalars['String']['output'];
};

export type BatchOperationInput = {
  data: Scalars['JSON']['input'];
  type: Scalars['String']['input'];
};

export type BatchOperationWithRollbackPayload = {
  __typename?: 'BatchOperationWithRollbackPayload';
  errors: Array<Scalars['String']['output']>;
  failedOperations: Scalars['Int']['output'];
  rollbackOccurred: Scalars['Boolean']['output'];
  success: Scalars['Boolean']['output'];
  successfulOperations: Scalars['Int']['output'];
};

export type BatchProgressUpdate = {
  __typename?: 'BatchProgressUpdate';
  completed: Scalars['Int']['output'];
  estimatedTimeRemainingMs: Scalars['Float']['output'];
  percentage: Scalars['Float']['output'];
  total: Scalars['Int']['output'];
};

export type BatchRelationSummary = {
  __typename?: 'BatchRelationSummary';
  fromNodeId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  relationshipType?: Maybe<Scalars['String']['output']>;
  tableId: Scalars['ID']['output'];
  toNodeId?: Maybe<Scalars['ID']['output']>;
};

export type BatchSetNodeAttributeResult = {
  __typename?: 'BatchSetNodeAttributeResult';
  attributeId: Scalars['ID']['output'];
  errors: Array<BatchOperationError>;
  nodeId: Scalars['ID']['output'];
  value?: Maybe<Scalars['String']['output']>;
};

export type BatchSetNodeAttributesPayload = {
  __typename?: 'BatchSetNodeAttributesPayload';
  results: Array<BatchSetNodeAttributeResult>;
  success: Scalars['Boolean']['output'];
  totalFailed: Scalars['Int']['output'];
  totalSet: Scalars['Int']['output'];
};

export type BatchSetNodeEmbeddingsPayload = OperationResult & {
  __typename?: 'BatchSetNodeEmbeddingsPayload';
  embeddings: Array<NodeEmbedding>;
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
  totalFailed: Scalars['Int']['output'];
  totalSet: Scalars['Int']['output'];
};

export type BatchUpdateNodeResult = {
  __typename?: 'BatchUpdateNodeResult';
  errors: Array<BatchOperationError>;
  node?: Maybe<TableNode>;
};

export type BatchUpdateNodesPayload = {
  __typename?: 'BatchUpdateNodesPayload';
  results: Array<BatchUpdateNodeResult>;
  success: Scalars['Boolean']['output'];
  totalFailed: Scalars['Int']['output'];
  totalUpdated: Scalars['Int']['output'];
};

/** Query complexity analysis result */
export type ComplexityAnalysis = {
  __typename?: 'ComplexityAnalysis';
  /** Estimated execution cost */
  estimatedCost: Scalars['Float']['output'];
  /** Factors contributing to complexity */
  factors: Array<ComplexityFactor>;
  /** Index utilization analysis */
  indexAnalysis?: Maybe<IndexAnalysis>;
  /** Complexity level classification */
  level: ComplexityLevel;
  /** Overall complexity score (0-100) */
  score: Scalars['Int']['output'];
};

/** Individual complexity factor */
export type ComplexityFactor = {
  __typename?: 'ComplexityFactor';
  /** Description of the factor */
  description: Scalars['String']['output'];
  /** Impact on overall complexity (0-100) */
  impact: Scalars['Int']['output'];
  /** Factor name */
  name: Scalars['String']['output'];
};

/** Complexity level classification */
export type ComplexityLevel =
  | 'EXTREME'
  | 'HIGH'
  | 'LOW'
  | 'MEDIUM';

/**
 * Computation types for derived sorting
 * Defines how computed values are calculated
 */
export type ComputationType =
  /** Aggregate functions (count, sum, avg) */
  | 'AGGREGATE_FUNCTION'
  /** Custom formula calculation */
  | 'CUSTOM_FORMULA'
  /** Geographic distance calculation */
  | 'GEO_DISTANCE'
  /** Machine learning prediction */
  | 'ML_PREDICTION'
  /** Relationship strength/importance */
  | 'RELATIONSHIP_STRENGTH'
  /** Relevance scoring based on search terms */
  | 'RELEVANCE_SCORE'
  /** Time-based scoring (recency, age) */
  | 'TEMPORAL_SCORE';

/**
 * Computed/derived sort input for advanced analytical sorting
 * Enables sorting by calculated values, aggregations, and relationships
 */
export type ComputedSortInput = {
  /** Boost factor for specific conditions */
  boost?: InputMaybe<Scalars['Float']['input']>;
  /** Parameters for the computation (JSON string) */
  computationParams?: InputMaybe<Scalars['String']['input']>;
  /** Type of computation to perform */
  computationType: ComputationType;
  /** Sort direction (ASC or DESC) */
  direction: SortDirection;
  /** Field name to sort by */
  field: Scalars['String']['input'];
  /** Weight for relevance scoring (0.0-1.0) */
  weight?: InputMaybe<Scalars['Float']['input']>;
};

export type ConfidenceDistribution = {
  __typename?: 'ConfidenceDistribution';
  autoGenerated: Scalars['Int']['output'];
  confident: Scalars['Int']['output'];
  probablyWrong: Scalars['Int']['output'];
  uncertainButValid: Scalars['Int']['output'];
  verified: Scalars['Int']['output'];
};

export type ConflictResolution = {
  __typename?: 'ConflictResolution';
  originalValue: Scalars['String']['output'];
  resolvedValue: Scalars['String']['output'];
  strategy: ConflictResolutionStrategy;
  type: Scalars['String']['output'];
};

export type ConflictResolutionStrategy =
  | 'MERGE'
  | 'OVERWRITE'
  | 'RENAME'
  | 'SKIP';

export type ConnectedNode = {
  __typename?: 'ConnectedNode';
  depth: Scalars['Int']['output'];
  node: TableNode;
  path: Array<Scalars['ID']['output']>;
};

export type Connection = {
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  totalCount: Scalars['Int']['output'];
};

export type CreateAttributeInput = {
  attributeTypeId: Scalars['ID']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  identifier: Scalars['String']['input'];
  isRequired?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  tableId: Scalars['ID']['input'];
};

export type CreateAttributePayload = OperationResult & {
  __typename?: 'CreateAttributePayload';
  attribute?: Maybe<Attribute>;
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type CreateAttributeTypeInput = {
  constraints?: InputMaybe<Scalars['JSON']['input']>;
  dataType: Scalars['String']['input'];
  defaultValue?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  format?: InputMaybe<Scalars['String']['input']>;
  identifier: Scalars['String']['input'];
  name: Scalars['String']['input'];
};

export type CreateAttributeTypePayload = OperationResult & {
  __typename?: 'CreateAttributeTypePayload';
  attributeType?: Maybe<AttributeType>;
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type CreateDocInput = {
  category: DocCategory;
  content: Scalars['String']['input'];
  tableId: Scalars['ID']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type CreateDocPayload = OperationResult & {
  __typename?: 'CreateDocPayload';
  doc?: Maybe<Doc>;
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type CreateNodeInput = {
  attributes?: InputMaybe<Array<NodeAttributeInput>>;
  content: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  tableId?: InputMaybe<Scalars['ID']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type CreateNodePayload = OperationResult & {
  __typename?: 'CreateNodePayload';
  errors: Array<Error>;
  node?: Maybe<TableNode>;
  success: Scalars['Boolean']['output'];
};

export type CreateNodeWithAttributesInput = {
  attributesByIdentifier: Array<AttributeByIdentifierInput>;
  content: Scalars['String']['input'];
  tableId: Scalars['ID']['input'];
};

export type CreateNodeWithAttributesPayload = OperationResult & {
  __typename?: 'CreateNodeWithAttributesPayload';
  attributes: Array<NodeAttribute>;
  errors: Array<Error>;
  node?: Maybe<TableNode>;
  success: Scalars['Boolean']['output'];
};

export type CreatePersonNodeInput = {
  age: Scalars['String']['input'];
  content: Scalars['String']['input'];
  name: Scalars['String']['input'];
  testName?: InputMaybe<Scalars['String']['input']>;
};

export type CreatePersonNodePayload = OperationResult & {
  __typename?: 'CreatePersonNodePayload';
  attributes: Array<NodeAttribute>;
  errors: Array<Error>;
  node?: Maybe<TableNode>;
  success: Scalars['Boolean']['output'];
};

export type CreateQueryTemplateInput = {
  applicableTables?: InputMaybe<Array<Scalars['String']['input']>>;
  complexityScore?: InputMaybe<Scalars['Int']['input']>;
  createdBy?: InputMaybe<Scalars['String']['input']>;
  defaultVariables?: InputMaybe<Scalars['JSON']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  identifier: Scalars['String']['input'];
  inputSchema?: InputMaybe<Scalars['JSON']['input']>;
  name: Scalars['String']['input'];
  query: Scalars['String']['input'];
  queryName?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  variables?: InputMaybe<Scalars['JSON']['input']>;
  version?: InputMaybe<Scalars['String']['input']>;
};

export type CreateQueryTemplatePayload = OperationResult & {
  __typename?: 'CreateQueryTemplatePayload';
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
  template?: Maybe<QueryTemplate>;
};

export type CreateRelationInput = {
  confidence?: InputMaybe<Scalars['Float']['input']>;
  fromNodeId?: InputMaybe<Scalars['ID']['input']>;
  properties?: InputMaybe<Scalars['JSON']['input']>;
  relationTypeId?: InputMaybe<Scalars['ID']['input']>;
  relationshipType?: InputMaybe<Scalars['String']['input']>;
  sourceNodeId?: InputMaybe<Scalars['ID']['input']>;
  strength?: InputMaybe<Scalars['Float']['input']>;
  tableId?: InputMaybe<Scalars['ID']['input']>;
  targetNodeId?: InputMaybe<Scalars['ID']['input']>;
  toNodeId?: InputMaybe<Scalars['ID']['input']>;
};

export type CreateRelationPayload = OperationResult & {
  __typename?: 'CreateRelationPayload';
  errors: Array<Error>;
  relation?: Maybe<NodeRelation>;
  success: Scalars['Boolean']['output'];
};

export type CreateRelationTypeInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  identifier: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
};

export type CreateRelationTypePayload = OperationResult & {
  __typename?: 'CreateRelationTypePayload';
  errors: Array<Error>;
  relationType?: Maybe<RelationType>;
  success: Scalars['Boolean']['output'];
};

export type CreateTableInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  identifier: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
};

export type CreateTablePayload = OperationResult & {
  __typename?: 'CreateTablePayload';
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
  table?: Maybe<Table>;
};

export type CustomInitializationOptions = {
  /** Create sample/demo data */
  createSampleData?: InputMaybe<Scalars['Boolean']['input']>;
  /** Initialization mode */
  initMode?: InputMaybe<SystemInitMode>;
  /** Preserve specific table IDs (for testing) */
  preserveTableIds?: InputMaybe<Array<Scalars['Int']['input']>>;
  /** Reset database to clean state */
  resetDatabase?: InputMaybe<Scalars['Boolean']['input']>;
  /** Reset performance metrics */
  resetMetrics?: InputMaybe<Scalars['Boolean']['input']>;
  /** Reset templates to baseline */
  resetTemplates?: InputMaybe<Scalars['Boolean']['input']>;
  /** Reset test data */
  resetTestData?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Usage example for custom sort functions */
export type CustomSortExample = {
  __typename?: 'CustomSortExample';
  /** Example description */
  description: Scalars['String']['output'];
  /** Sort direction in example */
  direction: SortDirection;
  /** Expected SQL output */
  expectedSql: Scalars['String']['output'];
  /** Field name used in example */
  field: Scalars['String']['output'];
  /** Parameters used in example (JSON string) */
  parameters?: Maybe<Scalars['String']['output']>;
  /** Example title */
  title: Scalars['String']['output'];
};

/**
 * Custom sort function definition
 * Represents a user-defined sorting function with metadata and examples
 */
export type CustomSortFunction = {
  __typename?: 'CustomSortFunction';
  /** Optional author information */
  author?: Maybe<Scalars['String']['output']>;
  /** Creation timestamp */
  createdAt: Scalars['DateTime']['output'];
  /** Description of what the function does */
  description: Scalars['String']['output'];
  /** Usage examples */
  examples: Array<CustomSortExample>;
  /** Unique identifier for the function */
  id: Scalars['String']['output'];
  /** Human-readable name */
  name: Scalars['String']['output'];
  /** Parameter definitions */
  parameters: Array<CustomSortParameter>;
  /** Priority for automatic selection (higher = preferred) */
  priority: Scalars['Int']['output'];
  /** Data types this function can handle */
  supportedDataTypes: Array<SortDataType>;
  /** Tags for categorization and discovery */
  tags: Array<Scalars['String']['output']>;
  /** Last updated timestamp */
  updatedAt: Scalars['DateTime']['output'];
  /** Function version */
  version: Scalars['String']['output'];
};

/** Custom sort function usage statistics */
export type CustomSortFunctionStats = {
  __typename?: 'CustomSortFunctionStats';
  /** Average execution time in milliseconds */
  averageExecutionTime: Scalars['Float']['output'];
  /** Total number of calls */
  callCount: Scalars['Int']['output'];
  /** Number of errors encountered */
  errorCount: Scalars['Int']['output'];
  /** Function identifier */
  functionId: Scalars['String']['output'];
  /** Last usage timestamp */
  lastUsed: Scalars['DateTime']['output'];
  /** Success rate percentage */
  successRate: Scalars['Float']['output'];
};

/**
 * Custom sort input for extensible sorting with user-defined functions
 * Allows integration of custom sort functions from the registry
 */
export type CustomSortInput = {
  /** Sort direction (ASC or DESC) */
  direction: SortDirection;
  /** Field name to sort by */
  field: Scalars['String']['input'];
  /** Custom sort function identifier from registry */
  functionId: Scalars['String']['input'];
  /** Parameters for the custom function (JSON string) */
  parameters?: InputMaybe<Scalars['String']['input']>;
  /** Priority for multi-criteria sorting */
  priority?: InputMaybe<Scalars['Int']['input']>;
};

/** Parameter definition for custom sort functions */
export type CustomSortParameter = {
  __typename?: 'CustomSortParameter';
  /** Default value (JSON string) */
  defaultValue?: Maybe<Scalars['String']['output']>;
  /** Parameter description */
  description: Scalars['String']['output'];
  /** Parameter name */
  name: Scalars['String']['output'];
  /** Whether parameter is required */
  required: Scalars['Boolean']['output'];
  /** Parameter data type */
  type: CustomSortParameterType;
  /** Validation rules */
  validation?: Maybe<CustomSortParameterValidation>;
};

/** Parameter types for custom sort functions */
export type CustomSortParameterType =
  | 'ARRAY'
  | 'BOOLEAN'
  | 'NUMBER'
  | 'OBJECT'
  | 'STRING';

/** Parameter validation rules */
export type CustomSortParameterValidation = {
  __typename?: 'CustomSortParameterValidation';
  /** List of allowed values */
  allowedValues?: Maybe<Array<Scalars['String']['output']>>;
  /** Maximum value for numeric parameters */
  max?: Maybe<Scalars['Float']['output']>;
  /** Minimum value for numeric parameters */
  min?: Maybe<Scalars['Float']['output']>;
  /** Regex pattern for string validation */
  pattern?: Maybe<Scalars['String']['output']>;
};

export type DataValidationError = {
  __typename?: 'DataValidationError';
  /** Standardized error code for programmatic handling (e.g., CONSTRAINT_MIN_LENGTH, TYPE_STRING_EXPECTED) */
  code: Scalars['String']['output'];
  /** Constraint that was violated (legacy, use code instead) */
  constraint?: Maybe<Scalars['String']['output']>;
  /** Expected value or type */
  expected?: Maybe<Scalars['String']['output']>;
  /** Human-readable error message */
  message: Scalars['String']['output'];
  /** JSON path to the error location (e.g., $.status) */
  path: Scalars['String']['output'];
  /** Actual value that caused the error */
  value?: Maybe<Scalars['JSON']['output']>;
};

export type DataValidationResult = {
  __typename?: 'DataValidationResult';
  /** Coerced data (with type conversions applied) */
  coercedData?: Maybe<Scalars['JSON']['output']>;
  /** List of validation errors */
  errors: Array<DataValidationError>;
  /** Human-readable formatted result */
  formattedResult: Scalars['String']['output'];
  /** Whether the data is valid according to the schema */
  valid: Scalars['Boolean']['output'];
};

export type DateFormat =
  | 'ISO'
  | 'READABLE'
  | 'TIMESTAMP';

export type DateRangeInput = {
  end?: InputMaybe<Scalars['DateTime']['input']>;
  start?: InputMaybe<Scalars['DateTime']['input']>;
};

export type DeleteAttributePayload = OperationResult & {
  __typename?: 'DeleteAttributePayload';
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type DeleteAttributeTypePayload = OperationResult & {
  __typename?: 'DeleteAttributeTypePayload';
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type DeleteDocPayload = OperationResult & {
  __typename?: 'DeleteDocPayload';
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type DeleteNodePayload = OperationResult & {
  __typename?: 'DeleteNodePayload';
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type DeleteQueryTemplatePayload = OperationResult & {
  __typename?: 'DeleteQueryTemplatePayload';
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type DeleteRelationPayload = OperationResult & {
  __typename?: 'DeleteRelationPayload';
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type DeleteRelationTypePayload = OperationResult & {
  __typename?: 'DeleteRelationTypePayload';
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type DeleteTablePayload = OperationResult & {
  __typename?: 'DeleteTablePayload';
  deletedDependencies?: Maybe<TableDependencyInfo>;
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type DependencyChainInput = {
  direction?: InputMaybe<RelationDirection>;
  maxDepth?: InputMaybe<Scalars['Int']['input']>;
  nodeId: Scalars['ID']['input'];
  relationTypeIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type DescendantsResult = {
  __typename?: 'DescendantsResult';
  entries: Array<HierarchyEntry>;
  hasCycle: Scalars['Boolean']['output'];
  leafCount: Scalars['Int']['output'];
  maxDepthReached: Scalars['Int']['output'];
  rootNode: TableNode;
  totalCount: Scalars['Int']['output'];
};

export type Doc = Node & {
  __typename?: 'Doc';
  category: DocCategory;
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  table: Table;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
};

export type DocCategory =
  | 'example'
  | 'general'
  | 'guide'
  | 'spec'
  | 'usage';

export type DocsConnection = Connection & {
  __typename?: 'DocsConnection';
  docs: Array<Doc>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  totalCount: Scalars['Int']['output'];
};

export type DocsFilter = {
  category?: InputMaybe<DocCategory>;
  createdAfter?: InputMaybe<Scalars['DateTime']['input']>;
  createdBefore?: InputMaybe<Scalars['DateTime']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  tableId?: InputMaybe<Scalars['ID']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type Edge = {
  cursor: Scalars['String']['output'];
};

export type EnhancedConnectedNode = {
  __typename?: 'EnhancedConnectedNode';
  confidence: Scalars['Int']['output'];
  distance: Scalars['Int']['output'];
  node: TableNode;
  relation: NodeRelation;
  relationPath: Array<NodeRelation>;
  strength: Scalars['Int']['output'];
};

export type Error = {
  __typename?: 'Error';
  code: Scalars['String']['output'];
  field?: Maybe<Scalars['String']['output']>;
  message: Scalars['String']['output'];
};

export type ExecuteQueryTemplateInput = {
  templateId?: InputMaybe<Scalars['ID']['input']>;
  templateIdentifier?: InputMaybe<Scalars['String']['input']>;
  variables?: InputMaybe<Scalars['JSON']['input']>;
};

export type ExecuteQueryTemplatePayload = {
  __typename?: 'ExecuteQueryTemplatePayload';
  data?: Maybe<Scalars['JSON']['output']>;
  errors: Array<Error>;
  execution?: Maybe<QueryTemplateExecution>;
  success: Scalars['Boolean']['output'];
};

export type ExecutionHistoryFilter = {
  maxExecutionTime?: InputMaybe<Scalars['Int']['input']>;
  minExecutionTime?: InputMaybe<Scalars['Int']['input']>;
  successOnly?: InputMaybe<Scalars['Boolean']['input']>;
  userContext?: InputMaybe<Scalars['String']['input']>;
};

export type ExecutionStatus =
  | 'COMPLETED'
  | 'ERROR'
  | 'IN_PROGRESS'
  | 'STARTING';

export type ExportFormat =
  | 'CSV'
  | 'EXCEL'
  | 'JSON'
  | 'XML'
  | 'YAML';

export type ExportMetadata = {
  __typename?: 'ExportMetadata';
  checksum?: Maybe<Scalars['String']['output']>;
  exportedAt: Scalars['String']['output'];
  exportedNodes: Scalars['Int']['output'];
  filePath?: Maybe<Scalars['String']['output']>;
  fileSize?: Maybe<Scalars['String']['output']>;
  format: Scalars['String']['output'];
  options?: Maybe<Scalars['JSON']['output']>;
  source: Scalars['String']['output'];
  tableId: Scalars['ID']['output'];
  tableIdentifier: Scalars['String']['output'];
  totalNodes: Scalars['Int']['output'];
  version: Scalars['String']['output'];
};

export type ExportStatistics = {
  __typename?: 'ExportStatistics';
  exportSize: Scalars['String']['output'];
  totalAttributes: Scalars['Int']['output'];
  totalNodes: Scalars['Int']['output'];
  totalRelations: Scalars['Int']['output'];
  totalTables: Scalars['Int']['output'];
};

export type ExportTablePackageInput = {
  options?: InputMaybe<TablePackageExportOptionsInput>;
  tableIdentifier: Scalars['String']['input'];
};

export type ExportTableStatistics = {
  __typename?: 'ExportTableStatistics';
  attributeCount: Scalars['Int']['output'];
  nodeCount: Scalars['Int']['output'];
  relationCount: Scalars['Int']['output'];
};

export type ExportTemplatePayload = OperationResult & {
  __typename?: 'ExportTemplatePayload';
  errors: Array<Error>;
  exportData?: Maybe<Scalars['String']['output']>;
  filename?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type ExportTemplatesPayload = OperationResult & {
  __typename?: 'ExportTemplatesPayload';
  errors: Array<Error>;
  exportedTemplates: Array<ExportedTemplateInfo>;
  outputDirectory?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
  totalCount: Scalars['Int']['output'];
};

export type ExportedAttribute = {
  __typename?: 'ExportedAttribute';
  attributeType: ExportedAttributeType;
  createdAt: Scalars['String']['output'];
  defaultValue?: Maybe<Scalars['JSON']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  identifier: Scalars['String']['output'];
  isRequired: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type ExportedAttributeType = {
  __typename?: 'ExportedAttributeType';
  allowedValues?: Maybe<Array<Scalars['String']['output']>>;
  constraints?: Maybe<Scalars['JSON']['output']>;
  dataType: Scalars['String']['output'];
  id: Scalars['String']['output'];
  identifier: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type ExportedGlobalAttributeType = {
  __typename?: 'ExportedGlobalAttributeType';
  allowedValues?: Maybe<Array<Scalars['String']['output']>>;
  constraints?: Maybe<Scalars['JSON']['output']>;
  createdAt: Scalars['String']['output'];
  dataType: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  identifier: Scalars['String']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type ExportedGlobalRelationType = {
  __typename?: 'ExportedGlobalRelationType';
  createdAt: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  identifier: Scalars['String']['output'];
  metadata?: Maybe<Scalars['JSON']['output']>;
  name: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type ExportedNode = {
  __typename?: 'ExportedNode';
  attributes?: Maybe<Scalars['JSON']['output']>;
  content: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  title?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['String']['output'];
};

export type ExportedRelation = {
  __typename?: 'ExportedRelation';
  createdAt: Scalars['String']['output'];
  id: Scalars['String']['output'];
  properties?: Maybe<Scalars['JSON']['output']>;
  relationType: ExportedRelationType;
  sourceNodeId: Scalars['String']['output'];
  strength?: Maybe<Scalars['Float']['output']>;
  targetNodeId: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type ExportedRelationType = {
  __typename?: 'ExportedRelationType';
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  identifier: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type ExportedTable = {
  __typename?: 'ExportedTable';
  attributes: Array<ExportedAttribute>;
  createdAt: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  identifier: Scalars['String']['output'];
  metadata?: Maybe<Scalars['JSON']['output']>;
  nodes: Array<ExportedNode>;
  relations: Array<ExportedRelation>;
  statistics: ExportTableStatistics;
  updatedAt: Scalars['String']['output'];
};

export type ExportedTemplateInfo = {
  __typename?: 'ExportedTemplateInfo';
  exportError?: Maybe<Scalars['String']['output']>;
  exportSuccess: Scalars['Boolean']['output'];
  filename: Scalars['String']['output'];
  templateId: Scalars['ID']['output'];
  templateIdentifier: Scalars['String']['output'];
  templateName: Scalars['String']['output'];
};

export type ExternalReferenceInput = {
  includeMetadata?: InputMaybe<Scalars['Boolean']['input']>;
  referencePatterns?: InputMaybe<Array<Scalars['String']['input']>>;
  repositories?: InputMaybe<Array<Scalars['String']['input']>>;
  resolutionDepth?: InputMaybe<Scalars['Int']['input']>;
};

export type ExternalReferenceResult = {
  __typename?: 'ExternalReferenceResult';
  resolutionStats: ResolutionStats;
  resolvedReferences: Array<ResolvedReference>;
  unresolvedReferences: Array<UnresolvedReference>;
};

/** Information about failed backup */
export type FailedBackupInfo = {
  __typename?: 'FailedBackupInfo';
  /** Error message */
  error: Scalars['String']['output'];
  /** Table identifier (for table backups) */
  tableIdentifier?: Maybe<Scalars['String']['output']>;
  /** Failure timestamp */
  timestamp: Scalars['DateTime']['output'];
};

export type FilterInput = {
  createdAfter?: InputMaybe<Scalars['DateTime']['input']>;
  createdBefore?: InputMaybe<Scalars['DateTime']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};

/**
 * Operators for attribute value comparisons
 * Supports text matching and numeric/date comparisons
 * Enhanced to support all SearchQueryParser capabilities
 */
export type FilterOperator =
  /** Contains substring (case-insensitive) */
  | 'CONTAINS'
  /** String ends with value (supports wildcards like '*smith') */
  | 'ENDS_WITH'
  /** Exact equality match */
  | 'EQUALS'
  /** Numeric/date greater than */
  | 'GREATER_THAN'
  /** Numeric/date greater than or equal */
  | 'GREATER_THAN_OR_EQUAL'
  /** Value in list of options */
  | 'IN'
  /** Field has a value */
  | 'IS_NOT_NULL'
  /** Field is null or empty */
  | 'IS_NULL'
  /** Numeric/date less than */
  | 'LESS_THAN'
  /** Numeric/date less than or equal */
  | 'LESS_THAN_OR_EQUAL'
  /** Not equal to value */
  | 'NOT_EQUALS'
  /** Value not in list of options */
  | 'NOT_IN'
  /** Value within range (supports syntax like '25..35' or date ranges) */
  | 'RANGE'
  /** String starts with value (supports wildcards like 'john*') */
  | 'STARTS_WITH';

export type FindPathsInput = {
  maxDepth?: InputMaybe<Scalars['Int']['input']>;
  relationTypeIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  sourceNodeId: Scalars['ID']['input'];
  targetNodeId: Scalars['ID']['input'];
};

export type FindTemplatesByTableInput = {
  includeUniversal?: InputMaybe<Scalars['Boolean']['input']>;
  tableName: Scalars['String']['input'];
};

export type FlatJsonExport = {
  __typename?: 'FlatJsonExport';
  exportedAt: Scalars['String']['output'];
  nodes: Array<FlatJsonNode>;
  table: FlatJsonTableInfo;
  version: Scalars['String']['output'];
};

export type FlatJsonNode = {
  __typename?: 'FlatJsonNode';
  /** Dynamic attributes as key-value pairs */
  attributes?: Maybe<Scalars['JSON']['output']>;
  content?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type FlatJsonTableInfo = {
  __typename?: 'FlatJsonTableInfo';
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  identifier: Scalars['String']['output'];
};

export type GeneratedTemplate = {
  __typename?: 'GeneratedTemplate';
  id: Scalars['ID']['output'];
  identifier: Scalars['String']['output'];
  name: Scalars['String']['output'];
  operationType: Scalars['String']['output'];
};

export type GetConnectedNodesInput = {
  depth?: InputMaybe<Scalars['Int']['input']>;
  direction?: InputMaybe<RelationDirection>;
  nodeId: Scalars['ID']['input'];
  relationTypeIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type GetNodeAttributesPayload = {
  __typename?: 'GetNodeAttributesPayload';
  attributes: Array<NodeAttribute>;
};

export type GraphMetrics = {
  __typename?: 'GraphMetrics';
  averageDegree: Scalars['Float']['output'];
  averagePathLength: Scalars['Float']['output'];
  components: Scalars['Int']['output'];
  density: Scalars['Float']['output'];
  diameter: Scalars['Int']['output'];
  totalNodes: Scalars['Int']['output'];
  totalRelations: Scalars['Int']['output'];
};

export type GraphPath = {
  __typename?: 'GraphPath';
  distance: Scalars['Int']['output'];
  nodes: Array<TableNode>;
  relations: Array<NodeRelation>;
};

export type GraphQlLocation = {
  __typename?: 'GraphQLLocation';
  column: Scalars['Int']['output'];
  line: Scalars['Int']['output'];
};

export type HfiBranchMetadata = {
  __typename?: 'HFIBranchMetadata';
  case: Scalars['String']['output'];
  color?: Maybe<Scalars['String']['output']>;
  condition?: Maybe<Scalars['JSON']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  meta?: Maybe<Scalars['JSON']['output']>;
  next?: Maybe<Scalars['JSON']['output']>;
};

export type HfiFlowEdge = {
  __typename?: 'HFIFlowEdge';
  animated?: Maybe<Scalars['Boolean']['output']>;
  id: Scalars['String']['output'];
  label?: Maybe<Scalars['String']['output']>;
  style?: Maybe<Scalars['JSON']['output']>;
};

export type HfiFlowNode = {
  __typename?: 'HFIFlowNode';
  branches?: Maybe<Array<HfiBranchMetadata>>;
  category?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  flowContext?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  payload: Array<HfiPayloadField>;
  position?: Maybe<Scalars['JSON']['output']>;
  style?: Maybe<Scalars['JSON']['output']>;
  tags?: Maybe<Array<Scalars['String']['output']>>;
  target: Scalars['String']['output'];
  title: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export type HfiPayloadField = {
  __typename?: 'HFIPayloadField';
  default?: Maybe<Scalars['JSON']['output']>;
  direction?: Maybe<Scalars['String']['output']>;
  enum?: Maybe<Array<Scalars['JSON']['output']>>;
  key: Scalars['String']['output'];
  max?: Maybe<Scalars['Float']['output']>;
  min?: Maybe<Scalars['Float']['output']>;
  pattern?: Maybe<Scalars['String']['output']>;
  required?: Maybe<Scalars['Boolean']['output']>;
  stateFrom?: Maybe<Scalars['JSON']['output']>;
  step?: Maybe<Scalars['Float']['output']>;
  type: Scalars['String']['output'];
  value: Scalars['JSON']['output'];
  widget?: Maybe<Scalars['String']['output']>;
};

export type HfiProtocolExport = {
  __typename?: 'HFIProtocolExport';
  context: Scalars['String']['output'];
  edges: Array<HfiFlowEdge>;
  metadata?: Maybe<HfiProtocolMetadata>;
  nodes: Array<HfiFlowNode>;
  protocol: Scalars['String']['output'];
  stateConnections?: Maybe<Array<HfiStateConnection>>;
  themes?: Maybe<Scalars['JSON']['output']>;
  viewport?: Maybe<Scalars['JSON']['output']>;
};

export type HfiProtocolMetadata = {
  __typename?: 'HFIProtocolMetadata';
  author?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  sourceTable?: Maybe<Scalars['JSON']['output']>;
  tags?: Maybe<Array<Scalars['String']['output']>>;
  updatedAt?: Maybe<Scalars['String']['output']>;
  version?: Maybe<Scalars['String']['output']>;
};

export type HfiStateConnection = {
  __typename?: 'HFIStateConnection';
  from: Scalars['String']['output'];
  fromField: Scalars['String']['output'];
  to: Scalars['String']['output'];
  toField: Scalars['String']['output'];
};

export type HealthStatus = {
  __typename?: 'HealthStatus';
  database: Scalars['Boolean']['output'];
  memory: MemoryHealthStatus;
  status: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
  version: Scalars['String']['output'];
};

export type HierarchyEntry = {
  __typename?: 'HierarchyEntry';
  childCount: Scalars['Int']['output'];
  childIds: Array<Scalars['ID']['output']>;
  depth: Scalars['Int']['output'];
  isLeaf: Scalars['Boolean']['output'];
  node: TableNode;
  parentId?: Maybe<Scalars['ID']['output']>;
  pathIds: Array<Scalars['ID']['output']>;
};

export type HierarchyMode =
  | 'DAG'
  | 'TREE';

export type HierarchyValidationResult = {
  __typename?: 'HierarchyValidationResult';
  cycleNodeIds: Array<Scalars['ID']['output']>;
  isolatedCount: Scalars['Int']['output'];
  leafCount: Scalars['Int']['output'];
  maxDepth: Scalars['Int']['output'];
  mode: HierarchyMode;
  multiParentNodeIds: Array<Scalars['ID']['output']>;
  relationTypeIdentifier: Scalars['String']['output'];
  rootCount: Scalars['Int']['output'];
  tableId: Scalars['ID']['output'];
  totalEdges: Scalars['Int']['output'];
  totalNodes: Scalars['Int']['output'];
  valid: Scalars['Boolean']['output'];
};

export type HighConfidenceRelation = {
  __typename?: 'HighConfidenceRelation';
  confidenceScore: Scalars['Int']['output'];
  qualityMetrics: RelationQualityMetrics;
  relation: NodeRelation;
  strengthScore: Scalars['Int']['output'];
  validationStatus: ValidationStatus;
};

export type HotQueryTemplate = {
  __typename?: 'HotQueryTemplate';
  efficiencyRatio: Scalars['Float']['output'];
  performanceScore: Scalars['Float']['output'];
  recentExecutions: Scalars['Int']['output'];
  successRate: Scalars['Float']['output'];
  template: QueryTemplate;
  usageRank: Scalars['Int']['output'];
};

export type HourlyUsageStats = {
  __typename?: 'HourlyUsageStats';
  avgExecutionTime: Scalars['Float']['output'];
  executionCount: Scalars['Int']['output'];
  hour: Scalars['Int']['output'];
};

export type HybridGraphFilterInput = {
  anchorNodeIds: Array<Scalars['ID']['input']>;
  direction?: InputMaybe<Scalars['String']['input']>;
  includeAnchors?: InputMaybe<Scalars['Boolean']['input']>;
  maxDepth?: InputMaybe<Scalars['Int']['input']>;
  relationTypes?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type HybridSearchHit = {
  __typename?: 'HybridSearchHit';
  combinedScore: Scalars['Float']['output'];
  ftsRank?: Maybe<Scalars['Int']['output']>;
  ftsScore?: Maybe<Scalars['Float']['output']>;
  hopDistance?: Maybe<Scalars['Int']['output']>;
  node: TableNode;
  vectorRank?: Maybe<Scalars['Int']['output']>;
  vectorScore?: Maybe<Scalars['Float']['output']>;
};

export type HybridSearchInput = {
  filterQuery?: InputMaybe<Scalars['String']['input']>;
  graph?: InputMaybe<HybridGraphFilterInput>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  minVectorScore?: InputMaybe<Scalars['Float']['input']>;
  model?: InputMaybe<Scalars['String']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  rrfK?: InputMaybe<Scalars['Float']['input']>;
  tableId: Scalars['ID']['input'];
  textQuery?: InputMaybe<Scalars['String']['input']>;
  vector?: InputMaybe<Array<Scalars['Float']['input']>>;
  weights?: InputMaybe<HybridSearchWeightsInput>;
};

export type HybridSearchMetrics = {
  __typename?: 'HybridSearchMetrics';
  elapsedMs: Scalars['Float']['output'];
  eligibleCandidates: Scalars['Int']['output'];
  graphCandidates?: Maybe<Scalars['Int']['output']>;
  lexicalCandidates: Scalars['Int']['output'];
  scannedVectors: Scalars['Int']['output'];
  vectorCandidates: Scalars['Int']['output'];
};

export type HybridSearchResult = {
  __typename?: 'HybridSearchResult';
  hasMore: Scalars['Boolean']['output'];
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  metrics: HybridSearchMetrics;
  results: Array<HybridSearchHit>;
  total: Scalars['Int']['output'];
};

export type HybridSearchWeightsInput = {
  fts?: InputMaybe<Scalars['Float']['input']>;
  graph?: InputMaybe<Scalars['Float']['input']>;
  vector?: InputMaybe<Scalars['Float']['input']>;
};

export type ImportIssue = {
  __typename?: 'ImportIssue';
  item?: Maybe<Scalars['JSON']['output']>;
  message: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export type ImportResult = {
  __typename?: 'ImportResult';
  errors: Array<ImportIssue>;
  executionTime: Scalars['Float']['output'];
  importedAt: Scalars['String']['output'];
  statistics: ImportStatistics;
  success: Scalars['Boolean']['output'];
  warnings: Array<ImportIssue>;
};

export type ImportSession = {
  __typename?: 'ImportSession';
  completedAt?: Maybe<Scalars['DateTime']['output']>;
  errors: Array<Scalars['String']['output']>;
  packagesImported: Array<Scalars['String']['output']>;
  packagesRemaining: Array<Scalars['String']['output']>;
  rollbackInfo: RollbackInfo;
  sessionId: Scalars['String']['output'];
  startedAt: Scalars['DateTime']['output'];
  status: ImportSessionStatus;
};

export type ImportSessionStatus =
  | 'COMPLETED'
  | 'FAILED'
  | 'IN_PROGRESS'
  | 'PENDING'
  | 'ROLLED_BACK';

export type ImportStatistics = {
  __typename?: 'ImportStatistics';
  attributeTypesImported: Scalars['Int']['output'];
  attributesImported: Scalars['Int']['output'];
  errors: Scalars['Int']['output'];
  nodesImported: Scalars['Int']['output'];
  relationTypesImported: Scalars['Int']['output'];
  relationsImported: Scalars['Int']['output'];
  skipped: Scalars['Int']['output'];
  tablesImported: Scalars['Int']['output'];
};

export type ImportTablePackageInput = {
  options?: InputMaybe<TablePackageImportOptionsInput>;
  packageData: TablePackageInput;
};

export type ImportTemplatePayload = OperationResult & {
  __typename?: 'ImportTemplatePayload';
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
  template?: Maybe<QueryTemplate>;
  warnings?: Maybe<Array<Scalars['String']['output']>>;
};

export type ImportedTable = {
  __typename?: 'ImportedTable';
  id: Scalars['ID']['output'];
  identifier: Scalars['String']['output'];
  originalIdentifier: Scalars['String']['output'];
};

/** Index utilization analysis */
export type IndexAnalysis = {
  __typename?: 'IndexAnalysis';
  /** Available indexes that could be used */
  availableIndexes: Array<Scalars['String']['output']>;
  /** Recommendations for new indexes */
  recommendations: Array<Scalars['String']['output']>;
  /** Indexes actually used in execution */
  usedIndexes: Array<Scalars['String']['output']>;
  /** Percentage of query that can use indexes */
  utilization: Scalars['Float']['output'];
};

export type IntRange = {
  __typename?: 'IntRange';
  max: Scalars['Int']['output'];
  min: Scalars['Int']['output'];
};

export type IntRangeInput = {
  max?: InputMaybe<Scalars['Int']['input']>;
  min?: InputMaybe<Scalars['Int']['input']>;
};

export type JsonExportData = FlatJsonExport | HfiProtocolExport;

export type JsonExportFormat =
  | 'FLAT'
  | 'HFI';

export type JsonExportOptions = {
  /** Export format: FLAT for simple array, HFI for full graph protocol */
  format?: JsonExportFormat;
  /** Include node positions (HFI only) */
  includePositions?: InputMaybe<Scalars['Boolean']['input']>;
  /** Include relations as branches (HFI only) */
  includeRelations?: InputMaybe<Scalars['Boolean']['input']>;
  /** Include state connections (HFI only) */
  includeStateConnections?: InputMaybe<Scalars['Boolean']['input']>;
  /** Include visual themes (HFI only) */
  includeThemes?: InputMaybe<Scalars['Boolean']['input']>;
  /** Filter by specific node IDs */
  nodeIds?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Pretty print JSON output */
  prettyPrint?: InputMaybe<Scalars['Boolean']['input']>;
  /** Filter by tags */
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type JsonExportResult = {
  __typename?: 'JsonExportResult';
  /** Parsed data (use json field for actual export) */
  data?: Maybe<Scalars['JSON']['output']>;
  errors: Array<Scalars['String']['output']>;
  format: JsonExportFormat;
  /** Raw JSON string output */
  json?: Maybe<Scalars['String']['output']>;
  nodeCount: Scalars['Int']['output'];
  success: Scalars['Boolean']['output'];
  warnings: Array<Scalars['String']['output']>;
};

/** Information about a backup manifest */
export type JsonlBackupInfo = {
  __typename?: 'JsonlBackupInfo';
  /** When the backup was created */
  createdAt: Scalars['DateTime']['output'];
  /** Whether persistent node embeddings are included */
  hasEmbeddings: Scalars['Boolean']['output'];
  /** Whether relations are included */
  hasRelations: Scalars['Boolean']['output'];
  /** Whether schema is included */
  hasSchema: Scalars['Boolean']['output'];
  /** Source identifier */
  source: Scalars['String']['output'];
  /** Tables in the backup */
  tables: Array<JsonlBackupTableInfo>;
  /** Backup version */
  version: Scalars['String']['output'];
};

/** Table information in backup manifest */
export type JsonlBackupTableInfo = {
  __typename?: 'JsonlBackupTableInfo';
  /** File path for table data */
  file: Scalars['String']['output'];
  /** Table identifier */
  identifier: Scalars['String']['output'];
  /** Number of nodes in the table */
  nodeCount: Scalars['Int']['output'];
};

/** Conflict resolution strategy for JSONL import */
export type JsonlConflictResolution =
  /** Merge attributes only */
  | 'MERGE'
  /** Overwrite existing records */
  | 'OVERWRITE'
  /** Skip existing records */
  | 'SKIP';

/** Options for JSONL export */
export type JsonlExportInput = {
  /** Include persistent node embeddings in embeddings.jsonl (default: false) */
  includeEmbeddings?: InputMaybe<Scalars['Boolean']['input']>;
  /** Include relations in export (default: true) */
  includeRelations?: InputMaybe<Scalars['Boolean']['input']>;
  /** Include schema file (default: true) */
  includeSchema?: InputMaybe<Scalars['Boolean']['input']>;
  /** Output directory path (default: ./backups/jsonl) */
  outputDir?: InputMaybe<Scalars['String']['input']>;
  /** Pretty print JSON (default: false for git diff compatibility) */
  prettyPrint?: InputMaybe<Scalars['Boolean']['input']>;
  /** Specific table identifiers to export (default: all tables) */
  tableIdentifiers?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Specific table IDs to export (default: all tables) */
  tableIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** Result of JSONL export operation */
export type JsonlExportResult = {
  __typename?: 'JsonlExportResult';
  /** Error messages */
  errors: Array<Scalars['String']['output']>;
  /** List of exported files */
  files: Array<JsonlExportedFile>;
  /** Output directory path */
  outputDir: Scalars['String']['output'];
  /** Export statistics */
  stats: JsonlExportStats;
  /** Operation success status */
  success: Scalars['Boolean']['output'];
  /** Warning messages */
  warnings: Array<Scalars['String']['output']>;
};

/** Statistics for JSONL export */
export type JsonlExportStats = {
  __typename?: 'JsonlExportStats';
  /** Number of node embeddings exported */
  embeddingsExported: Scalars['Int']['output'];
  /** Number of nodes exported */
  nodesExported: Scalars['Int']['output'];
  /** Number of relations exported */
  relationsExported: Scalars['Int']['output'];
  /** Number of tables exported */
  tablesExported: Scalars['Int']['output'];
  /** Total bytes written */
  totalBytes: Scalars['Float']['output'];
};

/** Information about a single exported file */
export type JsonlExportedFile = {
  __typename?: 'JsonlExportedFile';
  /** Number of lines in file */
  lineCount: Scalars['Int']['output'];
  /** File path */
  path: Scalars['String']['output'];
  /** File size in bytes */
  sizeBytes: Scalars['Float']['output'];
  /** Table identifier (for table files) */
  tableIdentifier?: Maybe<Scalars['String']['output']>;
  /** File type */
  type: JsonlFileType;
};

/** Type of exported file */
export type JsonlFileType =
  | 'EMBEDDINGS'
  | 'RELATIONS'
  | 'RELATION_TYPES'
  | 'SCHEMA'
  | 'TABLE';

/** Options for JSONL import */
export type JsonlImportInput = {
  /** How to handle conflicts with existing data */
  conflictResolution: JsonlConflictResolution;
  /** Dry run - validate without importing (default: false) */
  dryRun?: InputMaybe<Scalars['Boolean']['input']>;
  /** Restore embeddings.jsonl when present (default: true when manifest.hasEmbeddings) */
  includeEmbeddings?: InputMaybe<Scalars['Boolean']['input']>;
  /** Input directory path containing JSONL backup */
  inputDir: Scalars['String']['input'];
  /** Specific table identifiers to import (default: all) */
  tableIdentifiers?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Validate schema before import (default: true) */
  validateSchema?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Result of JSONL import operation */
export type JsonlImportResult = {
  __typename?: 'JsonlImportResult';
  /** Error messages */
  errors: Array<Scalars['String']['output']>;
  /** Input directory path */
  inputDir: Scalars['String']['output'];
  /** Import statistics */
  stats: JsonlImportStats;
  /** Operation success status */
  success: Scalars['Boolean']['output'];
  /** Warning messages */
  warnings: Array<Scalars['String']['output']>;
};

/** Statistics for JSONL import */
export type JsonlImportStats = {
  __typename?: 'JsonlImportStats';
  /** Number of node embeddings imported */
  embeddingsImported: Scalars['Int']['output'];
  /** Number of nodes imported */
  nodesImported: Scalars['Int']['output'];
  /** Number of nodes skipped due to conflicts */
  nodesSkipped: Scalars['Int']['output'];
  /** Number of nodes updated */
  nodesUpdated: Scalars['Int']['output'];
  /** Number of relations imported */
  relationsImported: Scalars['Int']['output'];
  /** Number of tables imported/created */
  tablesImported: Scalars['Int']['output'];
};

export type LogicalOperator =
  | 'AND'
  | 'OR';

export type LowestCommonAncestorResult = {
  __typename?: 'LowestCommonAncestorResult';
  ancestor?: Maybe<TableNode>;
  distanceFromA?: Maybe<Scalars['Int']['output']>;
  distanceFromB?: Maybe<Scalars['Int']['output']>;
  found: Scalars['Boolean']['output'];
  pathFromA: Array<Scalars['ID']['output']>;
  pathFromB: Array<Scalars['ID']['output']>;
};

export type MemoryHealthStatus = {
  __typename?: 'MemoryHealthStatus';
  message?: Maybe<Scalars['String']['output']>;
  percentage: Scalars['Float']['output'];
  status: Scalars['String']['output'];
};

export type MoveHierarchyNodeInput = {
  newParentId?: InputMaybe<Scalars['ID']['input']>;
  nodeId: Scalars['ID']['input'];
  relationTypeId?: InputMaybe<Scalars['ID']['input']>;
};

export type MoveHierarchyNodePayload = OperationResult & {
  __typename?: 'MoveHierarchyNodePayload';
  ancestors: Array<HierarchyEntry>;
  errors: Array<Error>;
  newParentId?: Maybe<Scalars['ID']['output']>;
  node?: Maybe<TableNode>;
  previousParentIds: Array<Scalars['ID']['output']>;
  relation?: Maybe<NodeRelation>;
  success: Scalars['Boolean']['output'];
};

/**
 * Multi-criteria sort input supporting different sort types
 * Enables complex sorting scenarios with multiple criteria
 */
export type MultiCriteriaSortInput = {
  /** Advanced sort criteria */
  advanced?: InputMaybe<Array<AdvancedSortInput>>;
  /** Computed sort criteria */
  computed?: InputMaybe<Array<ComputedSortInput>>;
  /** Custom sort criteria */
  custom?: InputMaybe<Array<CustomSortInput>>;
  /** Performance optimization settings */
  optimization?: InputMaybe<SortOptimizationInput>;
};

export type Mutation = {
  __typename?: 'Mutation';
  _empty?: Maybe<Scalars['String']['output']>;
  _schema?: Maybe<Scalars['String']['output']>;
  activateDoc: ActivateDocPayload;
  activateTabularSyncConfig: ActivateTabularSyncConfigPayload;
  activateTemplate?: Maybe<QueryTemplate>;
  /**
   * Apply backup retention policy
   *
   * Automatically delete old backups based on retention rules.
   * Helps manage disk space and backup organization.
   */
  applyRetentionPolicy: ApplyRetentionPolicyResult;
  /**
   * Create a full database backup
   *
   * Creates a complete SQLite database backup with optional compression and validation.
   * Uses VACUUM INTO for clean backup or falls back to file copy.
   */
  backupDatabase: BackupDatabaseResult;
  batchCreateAttributes: BatchCreateAttributesPayload;
  batchCreateNodes: BatchCreateNodesPayload;
  batchCreateNodesTransactional: BatchCreateNodesTransactionalPayload;
  batchCreateNodesWithProgress: BatchCreateNodesWithProgressPayload;
  batchCreateRelations: BatchCreateRelationsPayload;
  batchCreateTables: BatchCreateTablesPayload;
  batchDeleteTables: BatchDeleteTablesPayload;
  batchImportTablePackages: BatchImportTablePackagesResult;
  batchOperationWithRollback: BatchOperationWithRollbackPayload;
  batchSetNodeAttributes: BatchSetNodeAttributesPayload;
  batchSetNodeEmbeddings: BatchSetNodeEmbeddingsPayload;
  batchUpdateNodes: BatchUpdateNodesPayload;
  bulkSetNodeAttributes: SetNodeAttributePayload;
  createAttribute: CreateAttributePayload;
  createAttributeType: CreateAttributeTypePayload;
  createDoc: CreateDocPayload;
  createDocVersion: CreateDocPayload;
  createNode: CreateNodePayload;
  createNodeWithAttributes: CreateNodeWithAttributesPayload;
  createPersonNode: CreatePersonNodePayload;
  createRelation: CreateRelationPayload;
  createRelationType: CreateRelationTypePayload;
  createTable: CreateTablePayload;
  createTemplate: CreateQueryTemplatePayload;
  deactivateTemplate?: Maybe<QueryTemplate>;
  deleteAttribute: DeleteAttributePayload;
  deleteAttributeType: DeleteAttributeTypePayload;
  deleteDoc: DeleteDocPayload;
  deleteNode: DeleteNodePayload;
  deleteRelation: DeleteRelationPayload;
  deleteRelationType: DeleteRelationTypePayload;
  deleteTable: DeleteTablePayload;
  deleteTemplate: DeleteQueryTemplatePayload;
  executeTemplate: ExecuteQueryTemplatePayload;
  executeTemplateWithGraphQL: TemplateExecutionResult;
  /**
   * Export database to JSONL format
   *
   * Creates GitHub-friendly text-based backup with:
   * - Per-table JSONL files for granular git tracking
   * - Schema file with table and attribute definitions
   * - Relations file for node relationships
   * - Manifest file with backup metadata
   */
  exportJsonl: JsonlExportResult;
  exportMultipleTables: Array<TableNodesExportResult>;
  exportTableNodes: TableNodesExportResult;
  exportTablePackage: TablePackageExportResult;
  exportTemplate: ExportTemplatePayload;
  exportTemplates: ExportTemplatesPayload;
  /**
   * Import database from JSONL format
   *
   * Restores data from JSONL backup with:
   * - Conflict resolution strategies (skip/overwrite/merge)
   * - Schema validation before import
   * - Dry run mode for validation
   */
  importJsonl: JsonlImportResult;
  importSchema: ImportResult;
  importTablePackage: TablePackageImportResult;
  importTemplate: ImportTemplatePayload;
  initializeSystem: SystemInitializationPayload;
  /** Safely re-parent a node (or promote it to root when newParentId is null) with cycle guard */
  moveHierarchyNode: MoveHierarchyNodePayload;
  removeNodeAttribute: SetNodeAttributePayload;
  removeNodeEmbedding: RemoveNodeEmbeddingPayload;
  /**
   * Restore database from backup
   *
   * Restores the entire database from a backup file.
   * WARNING: Requires server restart to take effect.
   */
  restoreDatabase: RestoreDatabaseResult;
  resyncTabularSyncTable: ResyncTabularSyncTablePayload;
  saveTabularSyncConfig: SaveTabularSyncConfigPayload;
  setNodeAttribute: SetNodeAttributePayload;
  setNodeAttributes: SetNodeAttributesPayload;
  setNodeAttributesByIdentifier: SetNodeAttributesByIdentifierPayload;
  setNodeEmbedding: SetNodeEmbeddingPayload;
  updateAttribute: UpdateAttributePayload;
  updateAttributeType: UpdateAttributeTypePayload;
  updateDoc: UpdateDocPayload;
  updateNode: UpdateNodePayload;
  updateNodeAttributeValue: SetNodeAttributePayload;
  updateRelation: UpdateRelationPayload;
  updateRelationType: UpdateRelationTypePayload;
  updateTable: UpdateTablePayload;
  updateTemplate: UpdateQueryTemplatePayload;
  updateTemplateQuery: UpdateTemplateQueryPayload;
};


export type MutationActivateDocArgs = {
  id: Scalars['ID']['input'];
};


export type MutationActivateTabularSyncConfigArgs = {
  configKey: Scalars['String']['input'];
};


export type MutationActivateTemplateArgs = {
  id: Scalars['ID']['input'];
};


export type MutationApplyRetentionPolicyArgs = {
  policy: BackupRetentionPolicyInput;
};


export type MutationBackupDatabaseArgs = {
  input?: InputMaybe<BackupDatabaseInput>;
};


export type MutationBatchCreateAttributesArgs = {
  attributes: Array<CreateAttributeInput>;
};


export type MutationBatchCreateNodesArgs = {
  input?: InputMaybe<BatchCreateNodesInput>;
  nodes?: InputMaybe<Array<CreateNodeInput>>;
};


export type MutationBatchCreateNodesTransactionalArgs = {
  nodes: Array<CreateNodeInput>;
};


export type MutationBatchCreateNodesWithProgressArgs = {
  nodes: Array<CreateNodeInput>;
  progressCallback?: InputMaybe<Scalars['String']['input']>;
};


export type MutationBatchCreateRelationsArgs = {
  relations: Array<CreateRelationInput>;
};


export type MutationBatchCreateTablesArgs = {
  tables: Array<CreateTableInput>;
};


export type MutationBatchDeleteTablesArgs = {
  tableIds: Array<Scalars['ID']['input']>;
};


export type MutationBatchImportTablePackagesArgs = {
  input: BatchImportTablePackagesInput;
};


export type MutationBatchOperationWithRollbackArgs = {
  operations: Array<BatchOperationInput>;
};


export type MutationBatchSetNodeAttributesArgs = {
  attributeUpdates: Array<NodeAttributeUpdateInput>;
};


export type MutationBatchSetNodeEmbeddingsArgs = {
  inputs: Array<SetNodeEmbeddingInput>;
};


export type MutationBatchUpdateNodesArgs = {
  updates: Array<UpdateNodeInput>;
};


export type MutationBulkSetNodeAttributesArgs = {
  attributes: Array<NodeAttributeInput>;
  nodeId: Scalars['ID']['input'];
};


export type MutationCreateAttributeArgs = {
  input: CreateAttributeInput;
};


export type MutationCreateAttributeTypeArgs = {
  input: CreateAttributeTypeInput;
};


export type MutationCreateDocArgs = {
  input: CreateDocInput;
};


export type MutationCreateDocVersionArgs = {
  category: DocCategory;
  content: Scalars['String']['input'];
  tableId: Scalars['ID']['input'];
};


export type MutationCreateNodeArgs = {
  input: CreateNodeInput;
};


export type MutationCreateNodeWithAttributesArgs = {
  input: CreateNodeWithAttributesInput;
};


export type MutationCreatePersonNodeArgs = {
  input: CreatePersonNodeInput;
};


export type MutationCreateRelationArgs = {
  input: CreateRelationInput;
};


export type MutationCreateRelationTypeArgs = {
  input: CreateRelationTypeInput;
};


export type MutationCreateTableArgs = {
  input: CreateTableInput;
};


export type MutationCreateTemplateArgs = {
  input: CreateQueryTemplateInput;
};


export type MutationDeactivateTemplateArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteAttributeArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteAttributeTypeArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteDocArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteNodeArgs = {
  id?: InputMaybe<Scalars['ID']['input']>;
  nodeId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationDeleteRelationArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteRelationTypeArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTableArgs = {
  cascadeDelete?: InputMaybe<Scalars['Boolean']['input']>;
  force?: InputMaybe<Scalars['Boolean']['input']>;
  id: Scalars['ID']['input'];
};


export type MutationDeleteTemplateArgs = {
  id: Scalars['ID']['input'];
};


export type MutationExecuteTemplateArgs = {
  input: ExecuteQueryTemplateInput;
};


export type MutationExecuteTemplateWithGraphQlArgs = {
  templateIdentifier: Scalars['String']['input'];
  trackUsage?: InputMaybe<Scalars['Boolean']['input']>;
  variables?: InputMaybe<Scalars['JSON']['input']>;
};


export type MutationExportJsonlArgs = {
  input?: InputMaybe<JsonlExportInput>;
};


export type MutationExportMultipleTablesArgs = {
  format: ExportFormat;
  options?: InputMaybe<TableNodesExportInput>;
  tableIds: Array<Scalars['ID']['input']>;
};


export type MutationExportTableNodesArgs = {
  input: TableNodesExportInput;
};


export type MutationExportTablePackageArgs = {
  input: ExportTablePackageInput;
};


export type MutationExportTemplateArgs = {
  includeStatistics?: InputMaybe<Scalars['Boolean']['input']>;
  templateId?: InputMaybe<Scalars['ID']['input']>;
  templateIdentifier?: InputMaybe<Scalars['String']['input']>;
};


export type MutationExportTemplatesArgs = {
  filter?: InputMaybe<QueryTemplatesFilter>;
  includeStatistics?: InputMaybe<Scalars['Boolean']['input']>;
  outputDirectory?: InputMaybe<Scalars['String']['input']>;
};


export type MutationImportJsonlArgs = {
  input: JsonlImportInput;
};


export type MutationImportSchemaArgs = {
  exportData: Scalars['JSON']['input'];
  options?: InputMaybe<SchemaImportOptions>;
};


export type MutationImportTablePackageArgs = {
  input: ImportTablePackageInput;
};


export type MutationImportTemplateArgs = {
  generateNewIdentifier?: InputMaybe<Scalars['Boolean']['input']>;
  jsonData: Scalars['String']['input'];
  newIdentifierPrefix?: InputMaybe<Scalars['String']['input']>;
  overwriteExisting?: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationInitializeSystemArgs = {
  input: SystemInitializationInput;
};


export type MutationMoveHierarchyNodeArgs = {
  input: MoveHierarchyNodeInput;
};


export type MutationRemoveNodeAttributeArgs = {
  attributeId: Scalars['ID']['input'];
  nodeId: Scalars['ID']['input'];
};


export type MutationRemoveNodeEmbeddingArgs = {
  nodeId: Scalars['ID']['input'];
};


export type MutationRestoreDatabaseArgs = {
  input: RestoreDatabaseInput;
};


export type MutationResyncTabularSyncTableArgs = {
  tableIdentifier: Scalars['String']['input'];
};


export type MutationSaveTabularSyncConfigArgs = {
  input: SaveTabularSyncConfigInput;
};


export type MutationSetNodeAttributeArgs = {
  input: SetNodeAttributeInput;
};


export type MutationSetNodeAttributesArgs = {
  input: SetNodeAttributesInput;
};


export type MutationSetNodeAttributesByIdentifierArgs = {
  input: SetNodeAttributesByIdentifierInput;
};


export type MutationSetNodeEmbeddingArgs = {
  input: SetNodeEmbeddingInput;
};


export type MutationUpdateAttributeArgs = {
  id: Scalars['ID']['input'];
  input: UpdateAttributeInput;
};


export type MutationUpdateAttributeTypeArgs = {
  id: Scalars['ID']['input'];
  input: UpdateAttributeTypeInput;
};


export type MutationUpdateDocArgs = {
  id: Scalars['ID']['input'];
  input: UpdateDocInput;
};


export type MutationUpdateNodeArgs = {
  id?: InputMaybe<Scalars['ID']['input']>;
  input: UpdateNodeInput;
};


export type MutationUpdateNodeAttributeValueArgs = {
  attributeId: Scalars['ID']['input'];
  nodeId: Scalars['ID']['input'];
  value: Scalars['String']['input'];
};


export type MutationUpdateRelationArgs = {
  id: Scalars['ID']['input'];
  input: UpdateRelationInput;
};


export type MutationUpdateRelationTypeArgs = {
  id: Scalars['ID']['input'];
  input: UpdateRelationTypeInput;
};


export type MutationUpdateTableArgs = {
  id: Scalars['ID']['input'];
  input: UpdateTableInput;
};


export type MutationUpdateTemplateArgs = {
  id: Scalars['ID']['input'];
  input: UpdateQueryTemplateInput;
};


export type MutationUpdateTemplateQueryArgs = {
  newQuery: Scalars['String']['input'];
  templateId?: InputMaybe<Scalars['ID']['input']>;
  templateIdentifier?: InputMaybe<Scalars['String']['input']>;
  updateVariables?: InputMaybe<Scalars['JSON']['input']>;
};

export type NetworkMetrics = {
  __typename?: 'NetworkMetrics';
  averagePathLength: Scalars['Float']['output'];
  clustering: Scalars['Float']['output'];
  density: Scalars['Float']['output'];
  isolatedNodes: Scalars['Int']['output'];
  mostConnectedNodes: Array<NodeConnectivitySummary>;
};

export type NetworkPosition = {
  __typename?: 'NetworkPosition';
  betweenness: Scalars['Float']['output'];
  centrality: Scalars['Float']['output'];
  clustering: Scalars['Float']['output'];
  isBridge: Scalars['Boolean']['output'];
  isHub: Scalars['Boolean']['output'];
};

export type Node = {
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type NodeAnalytics = {
  __typename?: 'NodeAnalytics';
  attributeCount: Scalars['Int']['output'];
  betweennessCentrality: Scalars['Float']['output'];
  clusteringCoefficient: Scalars['Float']['output'];
  inDegree: Scalars['Int']['output'];
  nodeId: Scalars['ID']['output'];
  outDegree: Scalars['Int']['output'];
  pageRank: Scalars['Float']['output'];
  totalDegree: Scalars['Int']['output'];
};

export type NodeAttribute = {
  __typename?: 'NodeAttribute';
  attribute: Attribute;
  attributeId: Scalars['ID']['output'];
  createdAt: Scalars['DateTime']['output'];
  formattedValue: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
  value: Scalars['String']['output'];
};

export type NodeAttributeAnalytics = {
  __typename?: 'NodeAttributeAnalytics';
  attributeStats: Array<AttributeStats>;
  completenessPercentage: Scalars['Float']['output'];
  totalAttributes: Scalars['Int']['output'];
  totalNodes: Scalars['Int']['output'];
  typeDistribution: Array<AttributeTypeStats>;
  valueRanges: Array<AttributeValueRange>;
};

export type NodeAttributeAnalyticsFilter = {
  dataTypes?: InputMaybe<Array<Scalars['String']['input']>>;
  dateRange?: InputMaybe<DateRangeInput>;
  isRequired?: InputMaybe<Scalars['Boolean']['input']>;
  valuePattern?: InputMaybe<Scalars['String']['input']>;
};

export type NodeAttributeExport = {
  __typename?: 'NodeAttributeExport';
  attributeIdentifier: Scalars['String']['output'];
  metadata?: Maybe<Scalars['JSON']['output']>;
  nodeId: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type NodeAttributeExportInput = {
  attributeIdentifier: Scalars['String']['input'];
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  nodeId: Scalars['String']['input'];
  value: Scalars['String']['input'];
};

export type NodeAttributeInput = {
  attributeId: Scalars['ID']['input'];
  value: Scalars['String']['input'];
};

export type NodeAttributeSearchFilter = {
  attributeFilters: Array<SingleAttributeFilter>;
  logicalOperator?: InputMaybe<LogicalOperator>;
  tableIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type NodeAttributeUpdateInput = {
  attributeId: Scalars['ID']['input'];
  nodeId: Scalars['ID']['input'];
  value: Scalars['String']['input'];
};

export type NodeConnectivityResult = {
  __typename?: 'NodeConnectivityResult';
  centralNode: TableNode;
  connectedNodes: Array<EnhancedConnectedNode>;
  influenceScore: Scalars['Float']['output'];
  networkPosition: NetworkPosition;
  relationshipSummary: RelationshipSummary;
};

export type NodeConnectivitySummary = {
  __typename?: 'NodeConnectivitySummary';
  averageStrength: Scalars['Float']['output'];
  connectionCount: Scalars['Int']['output'];
  node: TableNode;
};

export type NodeDeletedEvent = {
  __typename?: 'NodeDeletedEvent';
  content: Scalars['String']['output'];
  deletedAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  tableId: Scalars['ID']['output'];
};

export type NodeEmbedding = {
  __typename?: 'NodeEmbedding';
  createdAt: Scalars['DateTime']['output'];
  dimension: Scalars['Int']['output'];
  model: Scalars['String']['output'];
  nodeId: Scalars['ID']['output'];
  norm: Scalars['Float']['output'];
  tableId: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
  vector: Array<Scalars['Float']['output']>;
};

export type NodeExport = {
  __typename?: 'NodeExport';
  content: Scalars['String']['output'];
  contentHash?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  id: Scalars['String']['output'];
  metadata?: Maybe<Scalars['JSON']['output']>;
  updatedAt: Scalars['String']['output'];
};

export type NodeExportInput = {
  content: Scalars['String']['input'];
  contentHash?: InputMaybe<Scalars['String']['input']>;
  createdAt: Scalars['String']['input'];
  id: Scalars['String']['input'];
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  updatedAt: Scalars['String']['input'];
};

export type NodePath = {
  __typename?: 'NodePath';
  length: Scalars['Int']['output'];
  nodes: Array<TableNode>;
  relations: Array<NodeRelation>;
  totalWeight?: Maybe<Scalars['Float']['output']>;
};

export type NodeRelation = Node & {
  __typename?: 'NodeRelation';
  confidence?: Maybe<Scalars['Int']['output']>;
  createdAt: Scalars['DateTime']['output'];
  fromNode: TableNode;
  fromNodeId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  properties?: Maybe<Scalars['JSON']['output']>;
  relationType: RelationType;
  relationshipType: Scalars['String']['output'];
  sourceNode: TableNode;
  strength?: Maybe<Scalars['Float']['output']>;
  table: Table;
  targetNode: TableNode;
  toNode: TableNode;
  toNodeId?: Maybe<Scalars['ID']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export type NodeRelationExport = {
  __typename?: 'NodeRelationExport';
  confidence?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['String']['output'];
  fromNodeId: Scalars['String']['output'];
  metadata?: Maybe<Scalars['JSON']['output']>;
  relationTypeIdentifier: Scalars['String']['output'];
  strength?: Maybe<Scalars['Float']['output']>;
  toNodeId: Scalars['String']['output'];
};

export type NodeRelationExportInput = {
  confidence?: InputMaybe<Scalars['Float']['input']>;
  createdAt: Scalars['String']['input'];
  fromNodeId: Scalars['String']['input'];
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  relationTypeIdentifier: Scalars['String']['input'];
  strength?: InputMaybe<Scalars['Float']['input']>;
  toNodeId: Scalars['String']['input'];
};

export type NodeRelationsConnection = Connection & {
  __typename?: 'NodeRelationsConnection';
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  nodes: Array<NodeRelation>;
  totalCount: Scalars['Int']['output'];
};

export type NodeRelationsFilter = {
  direction?: InputMaybe<RelationDirection>;
  relationTypeId?: InputMaybe<Scalars['ID']['input']>;
  sourceNodeId?: InputMaybe<Scalars['ID']['input']>;
  tableId?: InputMaybe<Scalars['ID']['input']>;
  targetNodeId?: InputMaybe<Scalars['ID']['input']>;
};

export type NodeWithTypedAttributes = {
  __typename?: 'NodeWithTypedAttributes';
  completenessScore: Scalars['Float']['output'];
  content: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  missingRequiredAttributes: Array<Attribute>;
  table: Table;
  typedAttributes: Array<TypedNodeAttribute>;
};

export type NodesConnection = Connection & {
  __typename?: 'NodesConnection';
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  nodes: Array<TableNode>;
  queryTime?: Maybe<Scalars['Float']['output']>;
  totalCount: Scalars['Int']['output'];
};

export type NodesFilter = {
  createdAfter?: InputMaybe<Scalars['DateTime']['input']>;
  createdBefore?: InputMaybe<Scalars['DateTime']['input']>;
  hasAttributes?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  tableId?: InputMaybe<Scalars['ID']['input']>;
};

export type NodesPagination = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};

/**
 * Nodes with sorting result including comprehensive metadata
 * Provides detailed performance analysis and recommendations
 */
export type NodesWithSortingResult = {
  __typename?: 'NodesWithSortingResult';
  /** Query complexity analysis */
  complexityAnalysis?: Maybe<ComplexityAnalysis>;
  /** Retrieved nodes */
  nodes: Array<TableNode>;
  /** Pagination information */
  pagination: PaginationInfo;
  /** Performance recommendations */
  recommendations: Array<Scalars['String']['output']>;
  /** Detailed sorting execution metadata */
  sortingMetadata: Array<SortResultMetadata>;
  /** Total count matching the filter */
  totalCount: Scalars['Int']['output'];
};

/**
 * Null handling strategies for sorting
 * Controls how null/empty values are positioned in results
 */
export type NullHandling =
  /** Exclude null values from results */
  | 'NULLS_EXCLUDE'
  /** Null values appear first in sort order */
  | 'NULLS_FIRST'
  /** Null values appear last in sort order */
  | 'NULLS_LAST'
  /** Only return null values */
  | 'NULLS_ONLY';

export type OperationResult = {
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type OperationType =
  | 'MUTATION'
  | 'QUERY'
  | 'SUBSCRIPTION';

export type OperationTypeStats = {
  __typename?: 'OperationTypeStats';
  avgExecutionTime: Scalars['Float']['output'];
  count: Scalars['Int']['output'];
  operationType: OperationType;
  successRate: Scalars['Float']['output'];
};

export type OptimalPath = {
  __typename?: 'OptimalPath';
  alternativePaths: Array<AlternativePath>;
  averageConfidence: Scalars['Float']['output'];
  averageStrength: Scalars['Float']['output'];
  path: Array<PathNode>;
  pathQuality: PathQuality;
  totalDistance: Scalars['Float']['output'];
};

export type OptimalPathInput = {
  algorithm?: InputMaybe<PathAlgorithm>;
  avoidNodes?: InputMaybe<Array<Scalars['ID']['input']>>;
  maxDepth?: InputMaybe<Scalars['Int']['input']>;
  preferredRelationTypes?: InputMaybe<Array<Scalars['String']['input']>>;
  sourceNodeId: Scalars['ID']['input'];
  targetNodeId: Scalars['ID']['input'];
  weightingStrategy?: InputMaybe<WeightingStrategy>;
};

export type PageRankEntry = {
  __typename?: 'PageRankEntry';
  node: TableNode;
  rank: Scalars['Int']['output'];
  score: Scalars['Float']['output'];
};

export type PageRankQueryResult = {
  __typename?: 'PageRankQueryResult';
  converged: Scalars['Boolean']['output'];
  dampingFactor: Scalars['Float']['output'];
  entries: Array<PageRankEntry>;
  finalDelta: Scalars['Float']['output'];
  iterations: Scalars['Int']['output'];
  tableId: Scalars['ID']['output'];
};

/** Pagination information for results */
export type PaginationInfo = {
  __typename?: 'PaginationInfo';
  /** Whether there are more pages */
  hasNextPage: Scalars['Boolean']['output'];
  /** Whether there are previous pages */
  hasPreviousPage: Scalars['Boolean']['output'];
  /** Items per page limit */
  limit: Scalars['Int']['output'];
  /** Current page offset */
  offset: Scalars['Int']['output'];
  /** Total pages available */
  totalPages: Scalars['Int']['output'];
};

export type PaginationInput = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};

export type PathAlgorithm =
  | 'BALANCED_QUALITY'
  | 'HIGHEST_CONFIDENCE'
  | 'HIGHEST_STRENGTH'
  | 'SHORTEST'
  | 'WEIGHTED_SHORTEST';

export type PathNode = {
  __typename?: 'PathNode';
  confidenceToNext?: Maybe<Scalars['Int']['output']>;
  distanceFromSource: Scalars['Int']['output'];
  node: TableNode;
  relation?: Maybe<NodeRelation>;
  strengthToNext?: Maybe<Scalars['Int']['output']>;
};

export type PathQuality =
  | 'AVERAGE'
  | 'EXCELLENT'
  | 'GOOD'
  | 'POOR'
  | 'UNRELIABLE';

export type PatternDiscoveryInput = {
  confidenceThreshold?: InputMaybe<Scalars['Float']['input']>;
  maxDepth?: InputMaybe<Scalars['Int']['input']>;
  minOccurrences?: InputMaybe<Scalars['Int']['input']>;
  patternTypes?: InputMaybe<Array<PatternType>>;
  tableIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type PatternType =
  | 'CHAIN'
  | 'CLIQUE'
  | 'CLUSTER'
  | 'CYCLE'
  | 'STAR'
  | 'TREE';

export type PerformanceCategory =
  | 'FAST'
  | 'MEDIUM'
  | 'SLOW';

export type PerformanceDistribution = {
  __typename?: 'PerformanceDistribution';
  fast: Scalars['Int']['output'];
  medium: Scalars['Int']['output'];
  percentiles: PerformancePercentiles;
  slow: Scalars['Int']['output'];
};

export type PerformanceMetrics = {
  __typename?: 'PerformanceMetrics';
  cacheHitRate: Scalars['Float']['output'];
  cpuUsage: Scalars['Float']['output'];
  memoryUsage: Scalars['Float']['output'];
  queryTime: Scalars['Float']['output'];
  throughput: Scalars['Float']['output'];
  timestamp: Scalars['DateTime']['output'];
};

export type PerformancePercentiles = {
  __typename?: 'PerformancePercentiles';
  p50: Scalars['Float']['output'];
  p75: Scalars['Float']['output'];
  p90: Scalars['Float']['output'];
  p95: Scalars['Float']['output'];
  p99: Scalars['Float']['output'];
};

export type PerformanceRequirement =
  | 'BACKGROUND'
  | 'BATCH'
  | 'INTERACTIVE'
  | 'REAL_TIME';

export type Query = {
  __typename?: 'Query';
  _empty?: Maybe<Scalars['String']['output']>;
  _schema?: Maybe<Scalars['String']['output']>;
  analyzeRelationshipStrength: RelationshipStrengthAnalysis;
  analyzeTableDependencies: Array<TableDependencyAnalysis>;
  attribute?: Maybe<Attribute>;
  attributeByIdentifier?: Maybe<Attribute>;
  attributeCompleteness: AttributeCompleteness;
  attributeType?: Maybe<AttributeType>;
  attributeTypeByIdentifier?: Maybe<AttributeType>;
  attributeTypes: AttributeTypesConnection;
  attributeValueDistribution: Array<AttributeValueGroup>;
  attributes: AttributesConnection;
  /** Get backup metrics and statistics */
  backupMetrics: BackupMetrics;
  customSortFunction?: Maybe<CustomSortFunction>;
  customSortFunctions: Array<CustomSortFunction>;
  discoverRelationPatterns: Array<RelationPattern>;
  executeTemplate: ExecuteQueryTemplatePayload;
  exportAllTables: SchemaExportResult;
  exportTable: SchemaExportResult;
  /** Export table data to JSON format (Flat or HFI Protocol) */
  exportTableJson: JsonExportResult;
  findOptimalPath: OptimalPath;
  findPathsBetweenNodes: Array<NodePath>;
  getActiveDoc?: Maybe<Doc>;
  /** Get ancestor chain from root down to parent of target node */
  getAncestors: AncestorChainResult;
  getConnectedNodes: RelatedNodesConnection;
  getDependencyChain: RelatedNodesConnection;
  /** Get descendant entries beneath a node using bounded BFS */
  getDescendants: DescendantsResult;
  getDoc?: Maybe<Doc>;
  getDocVersions: DocsConnection;
  getDocs: DocsConnection;
  getExportHistory: Array<ExportMetadata>;
  /** Get hierarchy leaf nodes within a table (out-degree == 0) */
  getHierarchyLeaves: Array<TableNode>;
  /** Get hierarchy root nodes within a table (in-degree == 0) */
  getHierarchyRoots: Array<TableNode>;
  getHighConfidenceRelations: Array<HighConfidenceRelation>;
  getHotQueries: Array<HotQueryTemplate>;
  getImportSession?: Maybe<ImportSession>;
  /** Find the lowest common ancestor (minimum combined upward distance) of two nodes */
  getLowestCommonAncestor: LowestCommonAncestorResult;
  getNodeAttributes: GetNodeAttributesPayload;
  getNodeConnectivity: NodeConnectivityResult;
  getPopularTemplates: Array<QueryTemplate>;
  getSlowQueries: Array<SlowQueryAnalysis>;
  /** Get complete subtree rooted at rootNodeId including traversed edges */
  getSubtree: SubtreeResult;
  getSupportedExportFormats: Array<ExportFormat>;
  getTables: TablesConnection;
  getTemplate?: Maybe<QueryTemplate>;
  getTemplateByIdentifier?: Maybe<QueryTemplate>;
  getTemplateExecutionHistory: TemplateExecutionConnection;
  getTemplatePerformanceTrends: Array<TemplatePerformanceTrend>;
  getTemplateRecommendations: Array<TemplateRecommendation>;
  healthCheck: HealthStatus;
  hybridSearchNodes: HybridSearchResult;
  /**
   * Inspect a JSONL backup without importing
   * Returns manifest information and validation status
   */
  inspectJsonlBackup?: Maybe<JsonlBackupInfo>;
  /** List all available backups */
  listBackups: BackupListResult;
  node?: Maybe<TableNode>;
  nodeAttributeAnalytics: NodeAttributeAnalytics;
  nodeByContent?: Maybe<TableNode>;
  nodeEmbedding?: Maybe<NodeEmbedding>;
  nodeRelation?: Maybe<NodeRelation>;
  nodeRelations: NodeRelationsConnection;
  nodeWithTypedAttributes?: Maybe<NodeWithTypedAttributes>;
  nodes: NodesConnection;
  pageRank: PageRankQueryResult;
  relationAnalytics: RelationAnalytics;
  relationType?: Maybe<RelationType>;
  relationTypeByIdentifier?: Maybe<RelationType>;
  relationTypes: Array<RelationType>;
  resolveExternalReferences: ExternalReferenceResult;
  searchDocs: DocsConnection;
  searchNodes: SearchNodesConnection;
  searchNodesByAttribute: NodesConnection;
  searchRelatedNodes: RelatedNodesConnection;
  searchTables: TablesConnection;
  searchTemplates: QueryTemplatesConnection;
  stronglyConnectedComponents: StronglyConnectedComponentsResult;
  systemStats: SystemStats;
  systemStatus: SystemStatusResult;
  table?: Maybe<Table>;
  tableByIdentifier?: Maybe<Table>;
  tableDocumentation?: Maybe<TableDocumentation>;
  tableOpenApiProjection?: Maybe<Scalars['JSON']['output']>;
  tables: TablesConnection;
  tabularSyncConfig?: Maybe<TabularSyncConfigRecord>;
  tabularSyncConfigs: Array<TabularSyncConfigRecord>;
  tabularSyncStatus: TabularSyncStatus;
  tabularSyncSummary: Array<TabularSyncEventSummary>;
  templatePerformanceAnalytics: TemplatePerformanceAnalytics;
  templatesByTable: Array<QueryTemplate>;
  /**
   * Validate runtime data against a JSON Schema.
   * Performs type checking with coercion, constraint validation, and format validation.
   * Returns coerced data if valid, or detailed errors if invalid.
   */
  validateData: ValidateDataPayload;
  validateExportOptions: ValidationResult;
  /** Validate whether a table's hierarchy conforms to TREE (no cycles, single parent) or DAG (no cycles) */
  validateHierarchy: HierarchyValidationResult;
  /**
   * Validate JSON Schema for MCP tool inputSchema compatibility.
   * Checks compliance with MCP spec (JSON Schema Draft-07, type: object required).
   * Returns detailed errors and warnings.
   */
  validateInputSchema: ValidateInputSchemaPayload;
  validateTablePackage: Array<ValidationConflict>;
};


export type QueryAnalyzeRelationshipStrengthArgs = {
  filter?: InputMaybe<StrengthAnalysisFilter>;
};


export type QueryAnalyzeTableDependenciesArgs = {
  tableIdentifiers: Array<Scalars['String']['input']>;
};


export type QueryAttributeArgs = {
  id: Scalars['ID']['input'];
};


export type QueryAttributeByIdentifierArgs = {
  identifier: Scalars['String']['input'];
  tableId: Scalars['ID']['input'];
};


export type QueryAttributeCompletenessArgs = {
  tableId: Scalars['ID']['input'];
};


export type QueryAttributeTypeArgs = {
  id: Scalars['ID']['input'];
};


export type QueryAttributeTypeByIdentifierArgs = {
  identifier: Scalars['String']['input'];
};


export type QueryAttributeTypesArgs = {
  filter?: InputMaybe<AttributeTypesFilter>;
  pagination?: InputMaybe<PaginationInput>;
  sort?: InputMaybe<Array<SortInput>>;
};


export type QueryAttributeValueDistributionArgs = {
  attributeId: Scalars['ID']['input'];
  groupBy?: InputMaybe<AttributeGroupBy>;
};


export type QueryAttributesArgs = {
  filter?: InputMaybe<AttributesFilter>;
  pagination?: InputMaybe<PaginationInput>;
  sort?: InputMaybe<Array<SortInput>>;
};


export type QueryCustomSortFunctionArgs = {
  functionId: Scalars['String']['input'];
};


export type QueryCustomSortFunctionsArgs = {
  dataType?: InputMaybe<SortDataType>;
  search?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};


export type QueryDiscoverRelationPatternsArgs = {
  input: PatternDiscoveryInput;
};


export type QueryExecuteTemplateArgs = {
  input: ExecuteQueryTemplateInput;
};


export type QueryExportAllTablesArgs = {
  options?: InputMaybe<SchemaExportOptions>;
};


export type QueryExportTableArgs = {
  options?: InputMaybe<SchemaExportOptions>;
  tableId: Scalars['String']['input'];
};


export type QueryExportTableJsonArgs = {
  options?: InputMaybe<JsonExportOptions>;
  tableId: Scalars['String']['input'];
};


export type QueryFindOptimalPathArgs = {
  input: OptimalPathInput;
};


export type QueryFindPathsBetweenNodesArgs = {
  input: FindPathsInput;
};


export type QueryGetActiveDocArgs = {
  category: DocCategory;
  tableId: Scalars['ID']['input'];
};


export type QueryGetAncestorsArgs = {
  maxDepth?: InputMaybe<Scalars['Int']['input']>;
  nodeId: Scalars['ID']['input'];
  relationTypeId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryGetConnectedNodesArgs = {
  depth?: InputMaybe<Scalars['Int']['input']>;
  direction?: InputMaybe<RelationDirection>;
  input?: InputMaybe<GetConnectedNodesInput>;
  nodeId?: InputMaybe<Scalars['ID']['input']>;
  relationTypeIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};


export type QueryGetDependencyChainArgs = {
  input: DependencyChainInput;
};


export type QueryGetDescendantsArgs = {
  maxDepth?: InputMaybe<Scalars['Int']['input']>;
  nodeId: Scalars['ID']['input'];
  relationTypeId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryGetDocArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetDocVersionsArgs = {
  category: DocCategory;
  tableId: Scalars['ID']['input'];
};


export type QueryGetDocsArgs = {
  category?: InputMaybe<DocCategory>;
  filter?: InputMaybe<DocsFilter>;
  pagination?: InputMaybe<PaginationInput>;
  sort?: InputMaybe<Array<SortInput>>;
  tableId: Scalars['ID']['input'];
};


export type QueryGetExportHistoryArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  tableId: Scalars['ID']['input'];
};


export type QueryGetHierarchyLeavesArgs = {
  includeIsolated?: InputMaybe<Scalars['Boolean']['input']>;
  relationTypeId?: InputMaybe<Scalars['ID']['input']>;
  tableId: Scalars['ID']['input'];
};


export type QueryGetHierarchyRootsArgs = {
  includeIsolated?: InputMaybe<Scalars['Boolean']['input']>;
  relationTypeId?: InputMaybe<Scalars['ID']['input']>;
  tableId: Scalars['ID']['input'];
};


export type QueryGetHighConfidenceRelationsArgs = {
  minConfidence?: InputMaybe<Scalars['Int']['input']>;
  relationTypes?: InputMaybe<Array<Scalars['String']['input']>>;
  tableIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};


export type QueryGetHotQueriesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  performanceThreshold?: InputMaybe<Scalars['Int']['input']>;
  usageThreshold?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryGetImportSessionArgs = {
  sessionId: Scalars['String']['input'];
};


export type QueryGetLowestCommonAncestorArgs = {
  maxDepth?: InputMaybe<Scalars['Int']['input']>;
  nodeIdA: Scalars['ID']['input'];
  nodeIdB: Scalars['ID']['input'];
  relationTypeId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryGetNodeAttributesArgs = {
  nodeId: Scalars['ID']['input'];
};


export type QueryGetNodeConnectivityArgs = {
  maxDepth?: InputMaybe<Scalars['Int']['input']>;
  minConfidence?: InputMaybe<Scalars['Int']['input']>;
  minStrength?: InputMaybe<Scalars['Int']['input']>;
  nodeId: Scalars['ID']['input'];
};


export type QueryGetPopularTemplatesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryGetSlowQueriesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  threshold?: InputMaybe<Scalars['Int']['input']>;
  timeRange?: InputMaybe<TimeRangeInput>;
};


export type QueryGetSubtreeArgs = {
  maxDepth?: InputMaybe<Scalars['Int']['input']>;
  relationTypeId?: InputMaybe<Scalars['ID']['input']>;
  rootNodeId: Scalars['ID']['input'];
};


export type QueryGetTablesArgs = {
  input?: InputMaybe<PaginationInput>;
};


export type QueryGetTemplateArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetTemplateByIdentifierArgs = {
  identifier: Scalars['String']['input'];
};


export type QueryGetTemplateExecutionHistoryArgs = {
  filter?: InputMaybe<ExecutionHistoryFilter>;
  pagination?: InputMaybe<PaginationInput>;
  templateId: Scalars['ID']['input'];
};


export type QueryGetTemplatePerformanceTrendsArgs = {
  granularity?: InputMaybe<TimeGranularity>;
  templateIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  timeRange: TimeRangeInput;
};


export type QueryGetTemplateRecommendationsArgs = {
  context: RecommendationContext;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryHybridSearchNodesArgs = {
  input: HybridSearchInput;
};


export type QueryInspectJsonlBackupArgs = {
  inputDir: Scalars['String']['input'];
};


export type QueryListBackupsArgs = {
  filter?: InputMaybe<BackupListFilterInput>;
};


export type QueryNodeArgs = {
  id: Scalars['ID']['input'];
};


export type QueryNodeAttributeAnalyticsArgs = {
  attributeIdentifier?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<NodeAttributeAnalyticsFilter>;
  tableId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryNodeByContentArgs = {
  content: Scalars['String']['input'];
  tableId: Scalars['ID']['input'];
};


export type QueryNodeEmbeddingArgs = {
  nodeId: Scalars['ID']['input'];
};


export type QueryNodeRelationArgs = {
  id: Scalars['ID']['input'];
};


export type QueryNodeRelationsArgs = {
  filter?: InputMaybe<NodeRelationsFilter>;
  pagination?: InputMaybe<PaginationInput>;
  sort?: InputMaybe<Array<SortInput>>;
};


export type QueryNodeWithTypedAttributesArgs = {
  nodeId: Scalars['ID']['input'];
};


export type QueryNodesArgs = {
  filter?: InputMaybe<NodesFilter>;
  pagination?: InputMaybe<NodesPagination>;
  sort?: InputMaybe<Array<SortInput>>;
};


export type QueryPageRankArgs = {
  dampingFactor?: InputMaybe<Scalars['Float']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  maxIterations?: InputMaybe<Scalars['Int']['input']>;
  relationTypes?: InputMaybe<Array<Scalars['String']['input']>>;
  tableId: Scalars['ID']['input'];
  tolerance?: InputMaybe<Scalars['Float']['input']>;
};


export type QueryRelationAnalyticsArgs = {
  filter?: InputMaybe<RelationAnalyticsFilter>;
};


export type QueryRelationTypeArgs = {
  id: Scalars['ID']['input'];
};


export type QueryRelationTypeByIdentifierArgs = {
  identifier: Scalars['String']['input'];
};


export type QueryRelationTypesArgs = {
  filter?: InputMaybe<FilterInput>;
  pagination?: InputMaybe<PaginationInput>;
  sort?: InputMaybe<Array<SortInput>>;
};


export type QueryResolveExternalReferencesArgs = {
  input: ExternalReferenceInput;
};


export type QuerySearchDocsArgs = {
  filter: DocsFilter;
  pagination?: InputMaybe<PaginationInput>;
  sort?: InputMaybe<Array<SortInput>>;
};


export type QuerySearchNodesArgs = {
  filter?: InputMaybe<SearchNodesFilter>;
  input?: InputMaybe<SearchNodesLegacyInput>;
  pagination?: InputMaybe<NodesPagination>;
  searchQuery?: InputMaybe<SearchQueryInput>;
  sort?: InputMaybe<Array<SortInput>>;
  tableId?: InputMaybe<Scalars['ID']['input']>;
};


export type QuerySearchNodesByAttributeArgs = {
  filter?: InputMaybe<NodeAttributeSearchFilter>;
  input?: InputMaybe<SearchNodesByAttributeLegacyInput>;
  pagination?: InputMaybe<PaginationInput>;
  sort?: InputMaybe<Array<SortInput>>;
};


export type QuerySearchRelatedNodesArgs = {
  filter: SearchRelatedNodesFilter;
  pagination?: InputMaybe<PaginationInput>;
};


export type QuerySearchTablesArgs = {
  filter?: InputMaybe<TablesFilter>;
};


export type QuerySearchTemplatesArgs = {
  filter?: InputMaybe<QueryTemplatesFilter>;
  input?: InputMaybe<PaginationInput>;
  pagination?: InputMaybe<PaginationInput>;
  sort?: InputMaybe<Array<SortInput>>;
};


export type QueryStronglyConnectedComponentsArgs = {
  relationTypes?: InputMaybe<Array<Scalars['String']['input']>>;
  tableId: Scalars['ID']['input'];
};


export type QueryTableArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTableByIdentifierArgs = {
  identifier: Scalars['String']['input'];
};


export type QueryTableDocumentationArgs = {
  identifier?: InputMaybe<Scalars['String']['input']>;
  includeAiMetadata?: InputMaybe<Scalars['Boolean']['input']>;
  includeDocs?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedTemplates?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelationships?: InputMaybe<Scalars['Boolean']['input']>;
  includeUsageStats?: InputMaybe<Scalars['Boolean']['input']>;
  tableId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryTableOpenApiProjectionArgs = {
  identifier?: InputMaybe<Scalars['String']['input']>;
  profile?: InputMaybe<Scalars['String']['input']>;
  tableId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryTablesArgs = {
  filter?: InputMaybe<TablesFilter>;
  pagination?: InputMaybe<TablesPagination>;
  sort?: InputMaybe<Array<SortInput>>;
};


export type QueryTabularSyncConfigArgs = {
  configKey?: InputMaybe<Scalars['String']['input']>;
};


export type QueryTabularSyncStatusArgs = {
  createdAfter?: InputMaybe<Scalars['String']['input']>;
  createdBefore?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  mode?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  tableIdentifier?: InputMaybe<Scalars['String']['input']>;
  windowPreset?: InputMaybe<Scalars['String']['input']>;
};


export type QueryTabularSyncSummaryArgs = {
  createdAfter?: InputMaybe<Scalars['String']['input']>;
  createdBefore?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  mode?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  tableIdentifier?: InputMaybe<Scalars['String']['input']>;
  windowPreset?: InputMaybe<Scalars['String']['input']>;
};


export type QueryTemplatePerformanceAnalyticsArgs = {
  filter?: InputMaybe<TemplatePerformanceFilter>;
  timeRange?: InputMaybe<TimeRangeInput>;
};


export type QueryTemplatesByTableArgs = {
  input: FindTemplatesByTableInput;
};


export type QueryValidateDataArgs = {
  input: ValidateDataInput;
};


export type QueryValidateExportOptionsArgs = {
  input: TableNodesExportInput;
};


export type QueryValidateHierarchyArgs = {
  mode?: InputMaybe<HierarchyMode>;
  relationTypeId?: InputMaybe<Scalars['ID']['input']>;
  tableId: Scalars['ID']['input'];
};


export type QueryValidateInputSchemaArgs = {
  input: ValidateInputSchemaInput;
};


export type QueryValidateTablePackageArgs = {
  options?: InputMaybe<ValidationOptionsInput>;
  packageData: TablePackageInput;
};

export type QueryTemplate = Node & {
  __typename?: 'QueryTemplate';
  applicableTables?: Maybe<Array<Scalars['String']['output']>>;
  avgExecutionTimeMs: Scalars['Int']['output'];
  complexityScore: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  createdBy?: Maybe<Scalars['String']['output']>;
  defaultVariables?: Maybe<Scalars['JSON']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  identifier: Scalars['String']['output'];
  inputSchema?: Maybe<Scalars['JSON']['output']>;
  isActive: Scalars['Boolean']['output'];
  isValid: Scalars['Boolean']['output'];
  lastUsedAt?: Maybe<Scalars['DateTime']['output']>;
  name: Scalars['String']['output'];
  operationType: OperationType;
  query: Scalars['String']['output'];
  queryName: Array<Scalars['String']['output']>;
  tags: Array<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  usageCount: Scalars['Int']['output'];
  validationErrors: Array<Scalars['String']['output']>;
  variables?: Maybe<Scalars['JSON']['output']>;
  version: Scalars['String']['output'];
};

export type QueryTemplateExecution = {
  __typename?: 'QueryTemplateExecution';
  duration: Scalars['Float']['output'];
  errorMessage?: Maybe<Scalars['String']['output']>;
  executedAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  resultCount: Scalars['Int']['output'];
  success: Scalars['Boolean']['output'];
  templateId: Scalars['ID']['output'];
};

export type QueryTemplatesConnection = Connection & {
  __typename?: 'QueryTemplatesConnection';
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  templates: Array<QueryTemplate>;
  totalCount: Scalars['Int']['output'];
};

export type QueryTemplatesFilter = {
  applicableToTable?: InputMaybe<Scalars['String']['input']>;
  complexityMax?: InputMaybe<Scalars['Int']['input']>;
  complexityMin?: InputMaybe<Scalars['Int']['input']>;
  createdAfter?: InputMaybe<Scalars['DateTime']['input']>;
  createdBefore?: InputMaybe<Scalars['DateTime']['input']>;
  createdBy?: InputMaybe<Scalars['String']['input']>;
  includeUniversal?: InputMaybe<Scalars['Boolean']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  systemQueries?: InputMaybe<Array<Scalars['String']['input']>>;
  systemQueryMatchMode?: InputMaybe<TagMatchMode>;
  tagMatchMode?: InputMaybe<TagMatchMode>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  templateType?: InputMaybe<Scalars['String']['input']>;
  usageCountMin?: InputMaybe<Scalars['Int']['input']>;
};

export type RecentPerformanceMetrics = {
  __typename?: 'RecentPerformanceMetrics';
  last7Days: TemplatePerformanceMetrics;
  last24Hours: TemplatePerformanceMetrics;
  last30Days: TemplatePerformanceMetrics;
};

export type RecommendationContext = {
  currentTemplate?: InputMaybe<Scalars['ID']['input']>;
  operationType?: InputMaybe<OperationType>;
  performanceRequirement?: InputMaybe<PerformanceRequirement>;
  tableIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  userRole?: InputMaybe<Scalars['String']['input']>;
};

export type RecommendationReason =
  | 'BETTER_PERFORMANCE'
  | 'COMPLEXITY_MATCH'
  | 'POPULAR_CHOICE'
  | 'RECENT_IMPROVEMENT'
  | 'SIMILAR_PATTERN';

export type RelatedNodesConnection = Connection & {
  __typename?: 'RelatedNodesConnection';
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  nodes: Array<TableNode>;
  relations: Array<NodeRelation>;
  totalConnections: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
};

export type RelationAnalytics = {
  __typename?: 'RelationAnalytics';
  confidenceDistribution: ConfidenceDistribution;
  externalRelations: Scalars['Int']['output'];
  internalRelations: Scalars['Int']['output'];
  networkMetrics: NetworkMetrics;
  relationTypeDistribution: Array<RelationTypeStats>;
  strengthDistribution: StrengthDistribution;
  tableConnectivity: Array<TableConnectivity>;
  totalRelations: Scalars['Int']['output'];
};

export type RelationAnalyticsFilter = {
  confidenceRange?: InputMaybe<IntRangeInput>;
  includeExternal?: InputMaybe<Scalars['Boolean']['input']>;
  relationTypes?: InputMaybe<Array<Scalars['String']['input']>>;
  strengthRange?: InputMaybe<IntRangeInput>;
  tableIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  timeRange?: InputMaybe<TimeRangeInput>;
};

/**
 * Direction for relationship traversal
 * Controls which edges to follow from a node's perspective
 */
export type RelationDirection =
  /** Follow relationships in both directions */
  | 'BOTH'
  /** Follow relationships where this node is the target */
  | 'INCOMING'
  /** Follow relationships where this node is the source */
  | 'OUTGOING';

/**
 * Filter nodes by their relationships to other nodes
 * Useful for finding nodes with specific connection patterns
 */
export type RelationFilter = {
  /** Direction of the relationship from the perspective of the node */
  direction: RelationDirection;
  /** Relationship type to filter by */
  relationTypeId: Scalars['ID']['input'];
  /** Optional: specific target node ID to match against */
  targetNodeId?: InputMaybe<Scalars['ID']['input']>;
};

export type RelationPattern = {
  __typename?: 'RelationPattern';
  confidence: Scalars['Float']['output'];
  description: Scalars['String']['output'];
  nodes: Array<TableNode>;
  occurrences: Scalars['Int']['output'];
  patternId: Scalars['String']['output'];
  relations: Array<NodeRelation>;
  significance: Scalars['Float']['output'];
  strength: Scalars['Float']['output'];
};

export type RelationQualityMetrics = {
  __typename?: 'RelationQualityMetrics';
  accuracy: Scalars['Float']['output'];
  completeness: Scalars['Float']['output'];
  consistency: Scalars['Float']['output'];
  reliability: Scalars['Float']['output'];
};

export type RelationType = Node & {
  __typename?: 'RelationType';
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  identifier: Scalars['String']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type RelationTypeCount = {
  __typename?: 'RelationTypeCount';
  count: Scalars['Int']['output'];
  relationType: RelationType;
};

export type RelationTypeExport = {
  __typename?: 'RelationTypeExport';
  description?: Maybe<Scalars['String']['output']>;
  identifier: Scalars['String']['output'];
  isDirectional: Scalars['Boolean']['output'];
  metadata?: Maybe<Scalars['JSON']['output']>;
  name: Scalars['String']['output'];
};

export type RelationTypeExportInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  identifier: Scalars['String']['input'];
  isDirectional?: InputMaybe<Scalars['Boolean']['input']>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  name: Scalars['String']['input'];
};

export type RelationTypeStats = {
  __typename?: 'RelationTypeStats';
  averageConfidence: Scalars['Float']['output'];
  averageStrength: Scalars['Float']['output'];
  count: Scalars['Int']['output'];
  externalReferences: Scalars['Int']['output'];
  relationType: RelationType;
};

export type RelationshipStrengthAnalysis = {
  __typename?: 'RelationshipStrengthAnalysis';
  overallStats: StrengthStats;
  strengthByType: Array<StrengthByType>;
  strengthEvolution: Array<StrengthEvolution>;
  strongRelations: Array<StrongRelation>;
  weakRelations: Array<WeakRelation>;
};

export type RelationshipSummary = {
  __typename?: 'RelationshipSummary';
  averageConfidence: Scalars['Float']['output'];
  averageStrength: Scalars['Float']['output'];
  bidirectionalRelations: Scalars['Int']['output'];
  count: Scalars['Int']['output'];
  incomingRelations: Scalars['Int']['output'];
  outgoingRelations: Scalars['Int']['output'];
  relatedTable: Table;
  relationTypeBreakdown: Array<RelationTypeCount>;
  relationshipType: Scalars['String']['output'];
  totalConnections: Scalars['Int']['output'];
};

export type RemoveNodeEmbeddingPayload = OperationResult & {
  __typename?: 'RemoveNodeEmbeddingPayload';
  deleted: Scalars['Boolean']['output'];
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type ResolutionStats = {
  __typename?: 'ResolutionStats';
  averageResolutionTime: Scalars['Float']['output'];
  resolutionRate: Scalars['Float']['output'];
  resolved: Scalars['Int']['output'];
  totalReferences: Scalars['Int']['output'];
  unresolved: Scalars['Int']['output'];
};

export type ResolvedReference = {
  __typename?: 'ResolvedReference';
  confidence: Scalars['Float']['output'];
  externalId: Scalars['String']['output'];
  metadata?: Maybe<Scalars['JSON']['output']>;
  relation: NodeRelation;
  resolvedData?: Maybe<Scalars['JSON']['output']>;
};

/** Options for restoring from backup */
export type RestoreDatabaseInput = {
  /** Path to the backup file */
  backupPath: Scalars['String']['input'];
  /** Create safety backup before restore */
  safetyBackup?: InputMaybe<Scalars['Boolean']['input']>;
  /** Validate backup before restore */
  validateBeforeRestore?: InputMaybe<Scalars['Boolean']['input']>;
  /** Verify database after restore */
  verifyAfterRestore?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Result of database restore operation */
export type RestoreDatabaseResult = {
  __typename?: 'RestoreDatabaseResult';
  /** Operation duration in milliseconds */
  duration: Scalars['Float']['output'];
  /** Error messages */
  errors: Array<Scalars['String']['output']>;
  /** Path to the restored database */
  restoredPath: Scalars['String']['output'];
  /** Path to safety backup (if created) */
  safetyBackupPath?: Maybe<Scalars['String']['output']>;
  /** Operation success status */
  success: Scalars['Boolean']['output'];
  /** Verification results */
  verification?: Maybe<RestoreVerification>;
  /** Warning messages */
  warnings: Array<Scalars['String']['output']>;
};

/** Verification results after restore */
export type RestoreVerification = {
  __typename?: 'RestoreVerification';
  /** Whether checksum matches */
  checksumMatch: Scalars['Boolean']['output'];
  /** Number of nodes in restored database */
  nodesCount: Scalars['Int']['output'];
  /** Number of relations in restored database */
  relationsCount: Scalars['Int']['output'];
  /** Number of tables in restored database */
  tablesCount: Scalars['Int']['output'];
};

export type ResyncTabularSyncTablePayload = OperationResult & {
  __typename?: 'ResyncTabularSyncTablePayload';
  errors: Array<Error>;
  status?: Maybe<TabularSyncStatus>;
  success: Scalars['Boolean']['output'];
  tableIdentifier?: Maybe<Scalars['String']['output']>;
};

export type RollbackInfo = {
  __typename?: 'RollbackInfo';
  nodesCreated: Array<Scalars['String']['output']>;
  tablesCreated: Array<Scalars['String']['output']>;
  templatesCreated: Array<Scalars['String']['output']>;
};

export type SaveTabularSyncConfigInput = {
  active?: InputMaybe<Scalars['Boolean']['input']>;
  config: Scalars['JSON']['input'];
  configKey: Scalars['String']['input'];
};

export type SaveTabularSyncConfigPayload = OperationResult & {
  __typename?: 'SaveTabularSyncConfigPayload';
  config?: Maybe<TabularSyncConfigRecord>;
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type SchemaExportOptions = {
  compression?: InputMaybe<Scalars['Boolean']['input']>;
  format?: InputMaybe<Scalars['String']['input']>;
  includeData?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelations?: InputMaybe<Scalars['Boolean']['input']>;
};

export type SchemaExportResult = {
  __typename?: 'SchemaExportResult';
  globalAttributeTypes: Array<ExportedGlobalAttributeType>;
  globalRelationTypes: Array<ExportedGlobalRelationType>;
  metadata: ExportMetadata;
  statistics: ExportStatistics;
  tables: Array<ExportedTable>;
};

export type SchemaImportOptions = {
  conflictResolution?: InputMaybe<Scalars['String']['input']>;
  dryRun?: InputMaybe<Scalars['Boolean']['input']>;
  overwriteExisting?: InputMaybe<Scalars['Boolean']['input']>;
  skipDuplicates?: InputMaybe<Scalars['Boolean']['input']>;
  validateData?: InputMaybe<Scalars['Boolean']['input']>;
};

export type SchemaValidationError = {
  __typename?: 'SchemaValidationError';
  /** Expected value or type */
  expected?: Maybe<Scalars['String']['output']>;
  /** Human-readable error message */
  message: Scalars['String']['output'];
  /** JSON path to the error location (e.g., $.properties.status) */
  path: Scalars['String']['output'];
  /** Actual value that caused the error */
  value?: Maybe<Scalars['JSON']['output']>;
};

export type SchemaValidationResult = {
  __typename?: 'SchemaValidationResult';
  /** List of validation errors (blocking issues) */
  errors: Array<SchemaValidationError>;
  /** Human-readable formatted result */
  formattedResult: Scalars['String']['output'];
  /** Whether the schema is valid for MCP */
  valid: Scalars['Boolean']['output'];
  /** List of validation warnings (recommendations) */
  warnings: Array<SchemaValidationError>;
};

export type SearchConditionGroupInput = {
  filters: Array<SearchFilterConditionInput>;
  logicalOperator?: InputMaybe<Scalars['String']['input']>;
};

export type SearchFilterConditionInput = {
  field: Scalars['String']['input'];
  operator: Scalars['String']['input'];
  value?: InputMaybe<Scalars['JSON']['input']>;
};

export type SearchNodeResult = {
  __typename?: 'SearchNodeResult';
  attributes?: Maybe<Scalars['JSON']['output']>;
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  node: TableNode;
  table: Table;
  title?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export type SearchNodesByAttributeLegacyInput = {
  attributeId?: InputMaybe<Scalars['ID']['input']>;
  attributeIdentifier?: InputMaybe<Scalars['String']['input']>;
  operator?: InputMaybe<AttributeFilterOperator>;
  tableId: Scalars['ID']['input'];
  value: Scalars['String']['input'];
};

export type SearchNodesConnection = Connection & {
  __typename?: 'SearchNodesConnection';
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  nodes: Array<TableNode>;
  totalCount: Scalars['Int']['output'];
};

/**
 * Advanced search filter for finding nodes with complex criteria
 * Supports full-text search, attribute filtering, and relationship filtering
 * Can be combined for sophisticated queries across the graph
 */
export type SearchNodesFilter = {
  /** Filter by node attribute values with various operators */
  attributeFilters?: InputMaybe<Array<AttributeFilter>>;
  /** Search specifically in node content field */
  content?: InputMaybe<Scalars['String']['input']>;
  /**
   * Advanced query string with natural language syntax support
   * Examples:
   * - Simple text: 'john' or 'engineer'
   * - Quoted phrases: '"senior engineer"'
   * - Attribute filters: 'age:25..35', 'name:john*', 'salary:>50000'
   * - Logical operators: 'age:>30 AND department:"Engineering"'
   * - Range queries: 'created_at:2023-01-01..2023-12-31'
   * - Wildcards: 'name:*smith', 'email:*@gmail.com'
   * - Comparisons: 'score:>=85', 'price:<100', 'rating:<=4'
   */
  query?: InputMaybe<Scalars['String']['input']>;
  /** Filter by relationship patterns and connected nodes */
  relationFilters?: InputMaybe<Array<RelationFilter>>;
  /** Full-text search across node content and attributes */
  search?: InputMaybe<Scalars['String']['input']>;
  /** Table ID to restrict search to specific node types */
  tableId: Scalars['ID']['input'];
};

export type SearchNodesLegacyInput = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  searchTerm?: InputMaybe<Scalars['String']['input']>;
  tableId: Scalars['ID']['input'];
};

export type SearchQueryInput = {
  conditions?: InputMaybe<Array<SearchConditionGroupInput>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sortBy?: InputMaybe<Array<SearchSortInput>>;
  textSearch?: InputMaybe<Scalars['String']['input']>;
};

export type SearchRelatedNodesFilter = {
  direction?: InputMaybe<RelationDirection>;
  maxDepth?: InputMaybe<Scalars['Int']['input']>;
  relationTypeIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  sourceNodeId: Scalars['ID']['input'];
};

export type SearchSortInput = {
  direction?: InputMaybe<Scalars['String']['input']>;
  field: Scalars['String']['input'];
};

export type SetNodeAttributeInput = {
  attributeId: Scalars['ID']['input'];
  nodeId: Scalars['ID']['input'];
  value: Scalars['String']['input'];
};

export type SetNodeAttributePayload = OperationResult & {
  __typename?: 'SetNodeAttributePayload';
  attribute?: Maybe<NodeAttribute>;
  errors: Array<Error>;
  nodeAttribute?: Maybe<NodeAttribute>;
  success: Scalars['Boolean']['output'];
};

export type SetNodeAttributesByIdentifierInput = {
  attributesByIdentifier: Array<AttributeByIdentifierInput>;
  nodeId: Scalars['ID']['input'];
};

export type SetNodeAttributesByIdentifierPayload = OperationResult & {
  __typename?: 'SetNodeAttributesByIdentifierPayload';
  errors: Array<Error>;
  nodeAttributes: Array<NodeAttribute>;
  success: Scalars['Boolean']['output'];
};

export type SetNodeAttributesInput = {
  attributes: Array<NodeAttributeInput>;
  nodeId: Scalars['ID']['input'];
};

export type SetNodeAttributesPayload = OperationResult & {
  __typename?: 'SetNodeAttributesPayload';
  errors: Array<Error>;
  nodeAttributes: Array<NodeAttribute>;
  success: Scalars['Boolean']['output'];
};

export type SetNodeEmbeddingInput = {
  model?: InputMaybe<Scalars['String']['input']>;
  nodeId: Scalars['ID']['input'];
  tableId?: InputMaybe<Scalars['ID']['input']>;
  vector: Array<Scalars['Float']['input']>;
};

export type SetNodeEmbeddingPayload = OperationResult & {
  __typename?: 'SetNodeEmbeddingPayload';
  embedding?: Maybe<NodeEmbedding>;
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type SingleAttributeCompleteness = {
  __typename?: 'SingleAttributeCompleteness';
  attributeId: Scalars['ID']['output'];
  completenessRate: Scalars['Float']['output'];
  emptyCount: Scalars['Int']['output'];
  filledCount: Scalars['Int']['output'];
  identifier: Scalars['String']['output'];
  isRequired: Scalars['Boolean']['output'];
};

export type SingleAttributeFilter = {
  attributeIdentifier: Scalars['String']['input'];
  dataType?: InputMaybe<Scalars['String']['input']>;
  operator: AttributeFilterOperator;
  value: Scalars['String']['input'];
};

export type SlowQueryAnalysis = {
  __typename?: 'SlowQueryAnalysis';
  averageExecutionTime: Scalars['Float']['output'];
  maxExecutionTime: Scalars['Float']['output'];
  optimizationSuggestions: Array<Scalars['String']['output']>;
  recentSlowdowns: Array<TemplateExecution>;
  slowExecutionCount: Scalars['Int']['output'];
  slowExecutionPercentage: Scalars['Float']['output'];
  template: QueryTemplate;
  totalExecutions: Scalars['Int']['output'];
};

/**
 * Data type enumeration for sort strategy selection
 * Helps the system choose optimal sorting algorithms
 */
export type SortDataType =
  | 'BOOLEAN'
  | 'CURRENCY'
  | 'DATE'
  | 'DATETIME'
  | 'EMAIL'
  | 'FLOAT'
  | 'INTEGER'
  | 'IP_ADDRESS'
  | 'JSON'
  | 'NUMBER'
  | 'PHONE'
  | 'STRING'
  | 'TEXT'
  | 'TIMESTAMP'
  | 'URL'
  | 'UUID';

export type SortDirection =
  | 'ASC'
  | 'DESC';

export type SortInput = {
  direction: SortDirection;
  field: Scalars['String']['input'];
};

/**
 * Sort optimization settings for performance tuning
 * Controls caching, complexity analysis, and execution strategies
 */
export type SortOptimizationInput = {
  /** Enable complexity analysis */
  analyzeComplexity?: InputMaybe<Scalars['Boolean']['input']>;
  /** Cache TTL in seconds */
  cacheTTL?: InputMaybe<Scalars['Int']['input']>;
  /** Enable result caching */
  enableCaching?: InputMaybe<Scalars['Boolean']['input']>;
  /** Force specific strategy by name */
  forceStrategy?: InputMaybe<Scalars['String']['input']>;
  /** Maximum allowed complexity score (0-100) */
  maxComplexity?: InputMaybe<Scalars['Int']['input']>;
};

/**
 * Sort result metadata for performance analysis
 * Provides insights into sort execution and optimization
 */
export type SortResultMetadata = {
  __typename?: 'SortResultMetadata';
  /** Complexity score (0-100) */
  complexityScore: Scalars['Int']['output'];
  /** Execution time in milliseconds */
  executionTime: Scalars['Float']['output'];
  /** Whether result was served from cache */
  fromCache: Scalars['Boolean']['output'];
  /** Index utilization percentage */
  indexUtilization: Scalars['Float']['output'];
  /** Recommendations for optimization */
  optimizationHints: Array<Scalars['String']['output']>;
  /** Strategy used for sorting */
  strategy: Scalars['String']['output'];
};

export type SourceTable = {
  __typename?: 'SourceTable';
  description?: Maybe<Scalars['String']['output']>;
  identifier: Scalars['String']['output'];
};

export type SourceTableInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  identifier: Scalars['String']['input'];
};

export type StrengthAnalysisFilter = {
  minOccurrences?: InputMaybe<Scalars['Int']['input']>;
  relationTypes?: InputMaybe<Array<Scalars['String']['input']>>;
  tableIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  timeWindow?: InputMaybe<TimeWindow>;
};

export type StrengthByType = {
  __typename?: 'StrengthByType';
  averageStrength: Scalars['Float']['output'];
  relationType: RelationType;
  reliability: Scalars['Float']['output'];
  strengthRange: IntRange;
};

export type StrengthDistribution = {
  __typename?: 'StrengthDistribution';
  autoGenerated: Scalars['Int']['output'];
  confident: Scalars['Int']['output'];
  invalid: Scalars['Int']['output'];
  uncertain: Scalars['Int']['output'];
  veryStrong: Scalars['Int']['output'];
};

export type StrengthEvolution = {
  __typename?: 'StrengthEvolution';
  averageStrength: Scalars['Float']['output'];
  timeWindow: Scalars['String']['output'];
  trend: Trend;
};

export type StrengthStats = {
  __typename?: 'StrengthStats';
  averageStrength: Scalars['Float']['output'];
  distributionSkew: Scalars['Float']['output'];
  reliabilityScore: Scalars['Float']['output'];
  strengthVariance: Scalars['Float']['output'];
};

export type StrongRelation = {
  __typename?: 'StrongRelation';
  qualityIndicators: Array<Scalars['String']['output']>;
  relation: NodeRelation;
  strengthScore: Scalars['Int']['output'];
  utilizationPotential: Scalars['Float']['output'];
};

export type StronglyConnectedComponentGroup = {
  __typename?: 'StronglyConnectedComponentGroup';
  id: Scalars['Int']['output'];
  nodeIds: Array<Scalars['ID']['output']>;
  nodes: Array<TableNode>;
  size: Scalars['Int']['output'];
};

export type StronglyConnectedComponentsResult = {
  __typename?: 'StronglyConnectedComponentsResult';
  components: Array<StronglyConnectedComponentGroup>;
  largestComponentSize: Scalars['Int']['output'];
  tableId: Scalars['ID']['output'];
  totalComponents: Scalars['Int']['output'];
};

export type Subscription = {
  __typename?: 'Subscription';
  _placeholder?: Maybe<Scalars['String']['output']>;
  _schema?: Maybe<Scalars['String']['output']>;
  executeTemplateStream: TemplateExecutionStream;
  nodeCreated: TableNode;
  nodeDeleted: NodeDeletedEvent;
  nodeUpdated: TableNode;
  performanceAlert: PerformanceMetrics;
  relationCreated: NodeRelation;
  relationDeleted: NodeRelation;
  systemHealthChanged: SystemHealth;
  tableCreated: Table;
  tableDeleted: TableDeletedEvent;
  tableUpdated: Table;
};


export type SubscriptionExecuteTemplateStreamArgs = {
  templateIdentifier: Scalars['String']['input'];
  trackUsage?: InputMaybe<Scalars['Boolean']['input']>;
  variables?: InputMaybe<Scalars['JSON']['input']>;
};


export type SubscriptionNodeCreatedArgs = {
  tableId?: InputMaybe<Scalars['ID']['input']>;
};


export type SubscriptionNodeDeletedArgs = {
  tableId?: InputMaybe<Scalars['ID']['input']>;
};


export type SubscriptionNodeUpdatedArgs = {
  tableId?: InputMaybe<Scalars['ID']['input']>;
};


export type SubscriptionRelationCreatedArgs = {
  tableId?: InputMaybe<Scalars['ID']['input']>;
};


export type SubscriptionRelationDeletedArgs = {
  tableId?: InputMaybe<Scalars['ID']['input']>;
};

export type SubtreeResult = {
  __typename?: 'SubtreeResult';
  edges: Array<NodeRelation>;
  entries: Array<HierarchyEntry>;
  hasCycle: Scalars['Boolean']['output'];
  leafCount: Scalars['Int']['output'];
  maxDepthReached: Scalars['Int']['output'];
  rootNode: TableNode;
  totalNodes: Scalars['Int']['output'];
};

export type SystemDatabaseStats = {
  __typename?: 'SystemDatabaseStats';
  averageQueryTime: Scalars['Float']['output'];
  connectionCount: Scalars['Int']['output'];
  connections: Scalars['Int']['output'];
  queries: Scalars['Int']['output'];
  queryCount: Scalars['Int']['output'];
  size: Scalars['Float']['output'];
};

export type SystemHealth = {
  __typename?: 'SystemHealth';
  activeQueries: Scalars['Int']['output'];
  databaseConnections: Scalars['Int']['output'];
  diskUsage: Scalars['Float']['output'];
  memoryUsage: Scalars['Float']['output'];
  status: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
  uptime: Scalars['Float']['output'];
};

export type SystemHeapStats = {
  __typename?: 'SystemHeapStats';
  arrayBuffers: Scalars['Float']['output'];
  external: Scalars['Float']['output'];
  total: Scalars['Float']['output'];
  used: Scalars['Float']['output'];
};

export type SystemInitMode =
  | 'DEMO'
  | 'DEVELOPMENT'
  | 'PRODUCTION'
  | 'TESTING';

export type SystemInitializationInput = {
  /** Initialization mode */
  mode: SystemInitializationMode;
  /** Custom options for 'custom' mode */
  options?: InputMaybe<CustomInitializationOptions>;
};

export type SystemInitializationMode =
  /** Custom initialization with specific options */
  | 'CUSTOM'
  /** Demo setup - creates demo data for presentations */
  | 'DEMO'
  /** Full reset - complete clean slate */
  | 'FULL'
  /** Quick reset for development - reset DB, test data, create samples */
  | 'QUICK';

export type SystemInitializationPayload = OperationResult & {
  __typename?: 'SystemInitializationPayload';
  errors: Array<Error>;
  result?: Maybe<SystemInitializationResult>;
  success: Scalars['Boolean']['output'];
};

export type SystemInitializationResult = {
  __typename?: 'SystemInitializationResult';
  /** Actions performed during initialization */
  actions: Array<Scalars['String']['output']>;
  /** Summary statistics after initialization */
  summary: SystemSummary;
  /** Performance timings for each step */
  timings: Scalars['JSON']['output'];
  /** Total execution time in milliseconds */
  totalTime: Scalars['Int']['output'];
};

export type SystemMemoryStats = {
  __typename?: 'SystemMemoryStats';
  free: Scalars['Float']['output'];
  heap: SystemHeapStats;
  heapUsed: Scalars['Float']['output'];
  percentage: Scalars['Float']['output'];
  total: Scalars['Float']['output'];
  used: Scalars['Float']['output'];
};

export type SystemProcessStats = {
  __typename?: 'SystemProcessStats';
  cpu: Scalars['Float']['output'];
  memoryDetails: Scalars['JSON']['output'];
  pid: Scalars['Int']['output'];
  platform: Scalars['String']['output'];
  uptime: Scalars['Float']['output'];
  version: Scalars['String']['output'];
};

export type SystemStats = {
  __typename?: 'SystemStats';
  database: SystemDatabaseStats;
  memory: SystemMemoryStats;
  process: SystemProcessStats;
  timestamp: Scalars['DateTime']['output'];
  uptime: Scalars['Float']['output'];
};

export type SystemStatusResult = {
  __typename?: 'SystemStatusResult';
  database: Scalars['Boolean']['output'];
  lastInitialized?: Maybe<Scalars['String']['output']>;
  summary: SystemSummary;
};

export type SystemSummary = {
  __typename?: 'SystemSummary';
  /** Number of attributes in the system */
  attributesCount: Scalars['Int']['output'];
  /** Number of nodes in the system */
  nodesCount: Scalars['Int']['output'];
  /** Number of tables in the system */
  tablesCount: Scalars['Int']['output'];
  /** Number of templates in the system */
  templatesCount: Scalars['Int']['output'];
};

export type Table = Node & {
  __typename?: 'Table';
  aiMetadata?: Maybe<AiMetadata>;
  attributeCount: Scalars['Int']['output'];
  attributeTypes: Array<AttributeType>;
  attributes: Array<Attribute>;
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  exportNodes: TableNodesExportResult;
  exportPreview: TableNodesExportResult;
  id: Scalars['ID']['output'];
  identifier: Scalars['String']['output'];
  mcpCommand: Scalars['String']['output'];
  name: Scalars['String']['output'];
  nodeCount: Scalars['Int']['output'];
  nodes: Array<TableNode>;
  tableNodeCount: Scalars['Int']['output'];
  tableNodes: Array<TableNode>;
  updatedAt: Scalars['DateTime']['output'];
};


export type TableAiMetadataArgs = {
  sampleLimit?: InputMaybe<Scalars['Int']['input']>;
};


export type TableExportNodesArgs = {
  input: TableNodesExportInput;
};


export type TableExportPreviewArgs = {
  format: ExportFormat;
};

export type TableConnectivity = {
  __typename?: 'TableConnectivity';
  averageConfidence: Scalars['Float']['output'];
  averageStrength: Scalars['Float']['output'];
  externalConnections: Scalars['Int']['output'];
  internalConnections: Scalars['Int']['output'];
  mostCommonRelationType?: Maybe<RelationType>;
  table: Table;
};

export type TableDataExport = {
  __typename?: 'TableDataExport';
  nodeAttributes: Array<NodeAttributeExport>;
  nodes: Array<NodeExport>;
};

export type TableDataExportInput = {
  nodeAttributes: Array<NodeAttributeExportInput>;
  nodes: Array<NodeExportInput>;
};

export type TableDeletedEvent = {
  __typename?: 'TableDeletedEvent';
  deletedAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  identifier: Scalars['String']['output'];
};

export type TableDependencyAnalysis = {
  __typename?: 'TableDependencyAnalysis';
  circularReferences: Array<Scalars['String']['output']>;
  dependencies: Array<Scalars['String']['output']>;
  dependents: Array<Scalars['String']['output']>;
  depth: Scalars['Int']['output'];
  tableIdentifier: Scalars['String']['output'];
};

export type TableDependencyInfo = {
  __typename?: 'TableDependencyInfo';
  attributeCount: Scalars['Int']['output'];
  relationCount: Scalars['Int']['output'];
  tableNodeCount: Scalars['Int']['output'];
};

export type TableDependencyTemplateResult = {
  __typename?: 'TableDependencyTemplateResult';
  tableName: Scalars['String']['output'];
  templates: Array<QueryTemplate>;
  totalCount: Scalars['Int']['output'];
};

export type TableDocsInfo = {
  __typename?: 'TableDocsInfo';
  allDocs: Array<Doc>;
  docCount: Scalars['Int']['output'];
  example?: Maybe<Doc>;
  general?: Maybe<Doc>;
  guide?: Maybe<Doc>;
  spec?: Maybe<Doc>;
  usage?: Maybe<Doc>;
};

export type TableDocumentation = {
  __typename?: 'TableDocumentation';
  aiMetadata?: Maybe<AiMetadata>;
  docs?: Maybe<TableDocsInfo>;
  documentation?: Maybe<TableDocumentationInfo>;
  generatedAt: Scalars['DateTime']['output'];
  relatedTemplates?: Maybe<Array<QueryTemplate>>;
  relationships?: Maybe<TableRelationshipInfo>;
  sampleNodes?: Maybe<Array<TableNode>>;
  schema: TableSchema;
  table: Table;
  usageStats?: Maybe<TableUsageStats>;
};

export type TableDocumentationInfo = {
  __typename?: 'TableDocumentationInfo';
  bestPractices: Array<Scalars['String']['output']>;
  description: Scalars['String']['output'];
  usageExamples: Array<Scalars['String']['output']>;
};

export type TableEdge = Edge & {
  __typename?: 'TableEdge';
  cursor: Scalars['String']['output'];
  node: Table;
};

export type TableInfo = {
  __typename?: 'TableInfo';
  createdAt: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  identifier: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type TableInfoInput = {
  createdAt: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  identifier: Scalars['String']['input'];
  updatedAt: Scalars['String']['input'];
};

/**
 * TableNode - Core graph entity representing any data object in the system
 * Examples: Person, Product, Company, Document, etc.
 * Supports rich attributes, bidirectional relationships, and advanced graph traversal
 */
export type TableNode = Node & {
  __typename?: 'TableNode';
  /** Total number of attributes attached to this node */
  attributeCount: Scalars['Int']['output'];
  /** All attributes attached to this node with their current values */
  attributes: Array<NodeAttribute>;
  /**
   * Find all nodes connected to this node within specified parameters
   * Uses level-order BFS and returns each connected node once, excluding this node
   * Supports depth control, direction filtering, and relationship type filtering
   */
  connectedNodes: Array<TableNode>;
  /** Primary content/description of the node - searchable text field */
  content: Scalars['String']['output'];
  /** Timestamp when the node was created */
  createdAt: Scalars['DateTime']['output'];
  /** Optional description providing additional context about the node */
  description?: Maybe<Scalars['String']['output']>;
  /** Traversal helper field used by legacy connected-node queries */
  distance: Scalars['Int']['output'];
  /** Unique identifier for the node */
  id: Scalars['ID']['output'];
  /** All relationships where this node is the target (incoming edges) */
  incomingRelations: Array<NodeRelation>;
  /** Arbitrary JSON metadata attached to the node */
  metadata?: Maybe<Scalars['JSON']['output']>;
  /**
   * Find direct neighbors connected via specific relationship types
   * More efficient than connectedNodes for direct relationships only
   */
  neighborsByRelationType: Array<TableNode>;
  /** All relationships where this node is the source (outgoing edges) */
  outgoingRelations: Array<NodeRelation>;
  /** Total number of relationships (both incoming and outgoing) */
  relationCount: Scalars['Int']['output'];
  /** Compatibility alias returning both incoming and outgoing relationships */
  relations: Array<NodeRelation>;
  /** Compatibility score field for search-oriented clients */
  relevanceScore: Scalars['Float']['output'];
  /**
   * Find the shortest path between this node and a target node
   * Uses BFS over incoming and outgoing edges for one minimum-hop path; relationship strength is not a cost
   * Returns nodes in source-to-target order; equal-length ties follow adjacency order
   * Returns empty array if no path exists within maxDepth
   */
  shortestPath: Array<TableNode>;
  /** Parent table that defines the schema and structure for this node */
  table: Table;
  /** Parent table identifier for compatibility with older queries */
  tableId: Scalars['ID']['output'];
  /** Optional title for the node - useful for display purposes */
  title?: Maybe<Scalars['String']['output']>;
  /** Timestamp when the node was last updated */
  updatedAt: Scalars['DateTime']['output'];
};


/**
 * TableNode - Core graph entity representing any data object in the system
 * Examples: Person, Product, Company, Document, etc.
 * Supports rich attributes, bidirectional relationships, and advanced graph traversal
 */
export type TableNodeConnectedNodesArgs = {
  depth?: InputMaybe<Scalars['Int']['input']>;
  direction?: InputMaybe<Scalars['String']['input']>;
  relationTypes?: InputMaybe<Array<Scalars['String']['input']>>;
};


/**
 * TableNode - Core graph entity representing any data object in the system
 * Examples: Person, Product, Company, Document, etc.
 * Supports rich attributes, bidirectional relationships, and advanced graph traversal
 */
export type TableNodeNeighborsByRelationTypeArgs = {
  direction?: InputMaybe<Scalars['String']['input']>;
  relationTypes?: InputMaybe<Array<Scalars['String']['input']>>;
};


/**
 * TableNode - Core graph entity representing any data object in the system
 * Examples: Person, Product, Company, Document, etc.
 * Supports rich attributes, bidirectional relationships, and advanced graph traversal
 */
export type TableNodeShortestPathArgs = {
  maxDepth?: InputMaybe<Scalars['Int']['input']>;
  targetNodeId: Scalars['ID']['input'];
};

export type TableNodesExportInput = {
  attributeFormat?: InputMaybe<AttributeFormat>;
  compression?: InputMaybe<Scalars['Boolean']['input']>;
  dateFormat?: InputMaybe<DateFormat>;
  filename?: InputMaybe<Scalars['String']['input']>;
  format: ExportFormat;
  includeAttributes?: InputMaybe<Scalars['Boolean']['input']>;
  includeMetadata?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  outputDirectory?: InputMaybe<Scalars['String']['input']>;
  prettyPrint?: InputMaybe<Scalars['Boolean']['input']>;
  saveToFile?: InputMaybe<Scalars['Boolean']['input']>;
  tableId: Scalars['ID']['input'];
};

export type TableNodesExportResult = {
  __typename?: 'TableNodesExportResult';
  binaryData?: Maybe<Scalars['String']['output']>;
  data?: Maybe<Scalars['String']['output']>;
  errors?: Maybe<Array<Scalars['String']['output']>>;
  filePath?: Maybe<Scalars['String']['output']>;
  format: Scalars['String']['output'];
  metadata: ExportMetadata;
  success: Scalars['Boolean']['output'];
};

export type TablePackageData = {
  __typename?: 'TablePackageData';
  dataset: TableDataExport;
  relations: TableRelationsExport;
  schema: TableSchemaExport;
  templates: TableTemplatesExport;
};

export type TablePackageDataInput = {
  dataset: TableDataExportInput;
  relations: TableRelationsExportInput;
  schema: TableSchemaExportInput;
  templates: TableTemplatesExportInput;
};

export type TablePackageExportOptionsInput = {
  format?: InputMaybe<Scalars['String']['input']>;
  includeData?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelatedTables?: InputMaybe<Scalars['Boolean']['input']>;
  includeRelations?: InputMaybe<Scalars['Boolean']['input']>;
  includeTemplates?: InputMaybe<Scalars['Boolean']['input']>;
  outputPath?: InputMaybe<Scalars['String']['input']>;
};

export type TablePackageExportResult = {
  __typename?: 'TablePackageExportResult';
  errors: Array<Scalars['String']['output']>;
  exportPath?: Maybe<Scalars['String']['output']>;
  package?: Maybe<TablePackageFormat>;
  success: Scalars['Boolean']['output'];
  warnings: Array<Scalars['String']['output']>;
};

export type TablePackageFormat = {
  __typename?: 'TablePackageFormat';
  dependencies: Array<Scalars['String']['output']>;
  exportedAt: Scalars['String']['output'];
  package: TablePackageData;
  sourceTable: SourceTable;
  version: Scalars['String']['output'];
};

export type TablePackageImportOptionsInput = {
  conflictResolution?: InputMaybe<ConflictResolutionStrategy>;
  generateTemplates?: InputMaybe<Scalars['Boolean']['input']>;
  newTablePrefix?: InputMaybe<Scalars['String']['input']>;
  overwriteExisting?: InputMaybe<Scalars['Boolean']['input']>;
};

export type TablePackageImportResult = {
  __typename?: 'TablePackageImportResult';
  errors: Array<Scalars['String']['output']>;
  generatedTemplates: Array<GeneratedTemplate>;
  importedTable?: Maybe<ImportedTable>;
  resolvedConflicts: Array<ConflictResolution>;
  success: Scalars['Boolean']['output'];
  warnings: Array<Scalars['String']['output']>;
};

export type TablePackageInput = {
  dependencies: Array<Scalars['String']['input']>;
  exportedAt: Scalars['String']['input'];
  package: TablePackageDataInput;
  sourceTable: SourceTableInput;
  version: Scalars['String']['input'];
};

export type TableRelationsExport = {
  __typename?: 'TableRelationsExport';
  nodeRelations: Array<NodeRelationExport>;
  relationTypes: Array<RelationTypeExport>;
};

export type TableRelationsExportInput = {
  nodeRelations: Array<NodeRelationExportInput>;
  relationTypes: Array<RelationTypeExportInput>;
};

export type TableRelationshipInfo = {
  __typename?: 'TableRelationshipInfo';
  incomingRelations: Array<RelationshipSummary>;
  outgoingRelations: Array<RelationshipSummary>;
  relatedTables: Array<Table>;
};

export type TableSchema = {
  __typename?: 'TableSchema';
  attributeCount: Scalars['Int']['output'];
  attributes: Array<Attribute>;
  projectionVersionHash?: Maybe<Scalars['String']['output']>;
};

export type TableSchemaExport = {
  __typename?: 'TableSchemaExport';
  attributeTypes: Array<AttributeTypeExport>;
  attributes: Array<AttributeExport>;
  table: TableInfo;
};

export type TableSchemaExportInput = {
  attributeTypes: Array<AttributeTypeExportInput>;
  attributes: Array<AttributeExportInput>;
  table: TableInfoInput;
};

export type TableTemplatesExport = {
  __typename?: 'TableTemplatesExport';
  templates: Array<TemplateExport>;
};

export type TableTemplatesExportInput = {
  templates: Array<TemplateExportInput>;
};

export type TableUsageExample = {
  __typename?: 'TableUsageExample';
  category: Scalars['String']['output'];
  description: Scalars['String']['output'];
  exampleMutation?: Maybe<Scalars['String']['output']>;
  exampleQuery?: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
};

export type TableUsageStats = {
  __typename?: 'TableUsageStats';
  averageAttributeUsage: Scalars['Float']['output'];
  frequentlyAccessedAttributes: Array<Scalars['String']['output']>;
  recentlyCreatedNodes: Scalars['Int']['output'];
  totalNodes: Scalars['Int']['output'];
};

export type TablesConnection = Connection & {
  __typename?: 'TablesConnection';
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  nodes: Array<Table>;
  tables: Array<Table>;
  totalCount: Scalars['Int']['output'];
};

export type TablesFilter = {
  createdAfter?: InputMaybe<Scalars['DateTime']['input']>;
  createdBefore?: InputMaybe<Scalars['DateTime']['input']>;
  hasNodes?: InputMaybe<Scalars['Boolean']['input']>;
  identifiers?: InputMaybe<Array<Scalars['String']['input']>>;
  nodeCountMax?: InputMaybe<Scalars['Int']['input']>;
  nodeCountMin?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};

export type TablesPagination = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};

export type TabularSyncConfigRecord = {
  __typename?: 'TabularSyncConfigRecord';
  config: Scalars['JSON']['output'];
  configKey: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  isActive: Scalars['Boolean']['output'];
  updatedAt: Scalars['String']['output'];
};

export type TabularSyncEvent = {
  __typename?: 'TabularSyncEvent';
  createdAt: Scalars['String']['output'];
  errorMessage?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  mode: Scalars['String']['output'];
  status: Scalars['String']['output'];
  tableIdentifier: Scalars['String']['output'];
};

export type TabularSyncEventSummary = {
  __typename?: 'TabularSyncEventSummary';
  eventCount: Scalars['Int']['output'];
  failureCount: Scalars['Int']['output'];
  lastCreatedAt: Scalars['String']['output'];
  latestErrorMessage?: Maybe<Scalars['String']['output']>;
  mode: Scalars['String']['output'];
  successCount: Scalars['Int']['output'];
  successRate: Scalars['Float']['output'];
  tableIdentifier: Scalars['String']['output'];
};

export type TabularSyncFailureMetric = {
  __typename?: 'TabularSyncFailureMetric';
  error: Scalars['String']['output'];
  mode: Scalars['String']['output'];
  occurredAt: Scalars['String']['output'];
  tableIdentifier: Scalars['String']['output'];
};

export type TabularSyncStatus = {
  __typename?: 'TabularSyncStatus';
  configSource: Scalars['String']['output'];
  enabled: Scalars['Boolean']['output'];
  lastFailureAt?: Maybe<Scalars['String']['output']>;
  lastSuccessAt?: Maybe<Scalars['String']['output']>;
  pendingCount: Scalars['Int']['output'];
  pendingTables: Array<Scalars['String']['output']>;
  persistedEvents: Array<TabularSyncEvent>;
  persistedSummary: Array<TabularSyncEventSummary>;
  recentFailures: Array<TabularSyncFailureMetric>;
  syncDebounceMs: Scalars['Int']['output'];
  tables: Array<TabularSyncTableMetric>;
  totalExecutions: Scalars['Int']['output'];
  totalFailed: Scalars['Int']['output'];
  totalNotifications: Scalars['Int']['output'];
  totalSucceeded: Scalars['Int']['output'];
};

export type TabularSyncTableMetric = {
  __typename?: 'TabularSyncTableMetric';
  executions: Scalars['Int']['output'];
  failures: Scalars['Int']['output'];
  lastCompletedAt?: Maybe<Scalars['String']['output']>;
  lastError?: Maybe<Scalars['String']['output']>;
  lastFailureAt?: Maybe<Scalars['String']['output']>;
  lastMode?: Maybe<Scalars['String']['output']>;
  lastScheduledAt?: Maybe<Scalars['String']['output']>;
  lastStartedAt?: Maybe<Scalars['String']['output']>;
  lastSuccessAt?: Maybe<Scalars['String']['output']>;
  notifications: Scalars['Int']['output'];
  pending: Scalars['Boolean']['output'];
  successes: Scalars['Int']['output'];
  tableIdentifier: Scalars['String']['output'];
};

export type TagMatchMode =
  | 'ALL'
  | 'ANY';

export type TemplateExecution = {
  __typename?: 'TemplateExecution';
  errorMessage?: Maybe<Scalars['String']['output']>;
  executedAt: Scalars['DateTime']['output'];
  executionTimeMs: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  resultCount: Scalars['Int']['output'];
  success: Scalars['Boolean']['output'];
  template: QueryTemplate;
  userContext?: Maybe<Scalars['String']['output']>;
  variablesUsed?: Maybe<Scalars['JSON']['output']>;
};

export type TemplateExecutionConnection = {
  __typename?: 'TemplateExecutionConnection';
  averageExecutionTime: Scalars['Float']['output'];
  edges: Array<TemplateExecutionEdge>;
  successRate: Scalars['Float']['output'];
  totalCount: Scalars['Int']['output'];
};

export type TemplateExecutionEdge = {
  __typename?: 'TemplateExecutionEdge';
  cursor: Scalars['String']['output'];
  node: TemplateExecution;
};

export type TemplateExecutionError = {
  __typename?: 'TemplateExecutionError';
  code?: Maybe<Scalars['String']['output']>;
  locations?: Maybe<Array<GraphQlLocation>>;
  message: Scalars['String']['output'];
  path?: Maybe<Array<Scalars['String']['output']>>;
};

export type TemplateExecutionMetadata = {
  __typename?: 'TemplateExecutionMetadata';
  complexityScore: Scalars['Int']['output'];
  estimatedTokens?: Maybe<Scalars['Int']['output']>;
  executionTime: Scalars['Int']['output'];
  templateId: Scalars['ID']['output'];
  templateName: Scalars['String']['output'];
  version: Scalars['String']['output'];
};

export type TemplateExecutionResult = {
  __typename?: 'TemplateExecutionResult';
  data?: Maybe<Scalars['JSON']['output']>;
  errors?: Maybe<Array<TemplateExecutionError>>;
  executionTime: Scalars['Int']['output'];
  metadata: TemplateExecutionMetadata;
  success: Scalars['Boolean']['output'];
};

export type TemplateExecutionStream = {
  __typename?: 'TemplateExecutionStream';
  data?: Maybe<Scalars['JSON']['output']>;
  error?: Maybe<Scalars['String']['output']>;
  metadata: TemplateExecutionMetadata;
  progress?: Maybe<Scalars['Float']['output']>;
  status: ExecutionStatus;
  timestamp: Scalars['DateTime']['output'];
};

export type TemplateExport = {
  __typename?: 'TemplateExport';
  complexityScore?: Maybe<Scalars['Int']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  identifier: Scalars['String']['output'];
  metadata?: Maybe<Scalars['JSON']['output']>;
  name: Scalars['String']['output'];
  operationType: Scalars['String']['output'];
  query: Scalars['String']['output'];
  tags: Array<Scalars['String']['output']>;
  variables?: Maybe<Scalars['JSON']['output']>;
};

export type TemplateExportInput = {
  complexityScore?: InputMaybe<Scalars['Int']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  identifier: Scalars['String']['input'];
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  name: Scalars['String']['input'];
  operationType: Scalars['String']['input'];
  query: Scalars['String']['input'];
  tags: Array<Scalars['String']['input']>;
  variables?: InputMaybe<Scalars['JSON']['input']>;
};

export type TemplatePerformanceAnalytics = {
  __typename?: 'TemplatePerformanceAnalytics';
  activeTemplates: Scalars['Int']['output'];
  averageExecutionTime: Scalars['Float']['output'];
  performanceDistribution: PerformanceDistribution;
  recentMetrics: RecentPerformanceMetrics;
  successRate: Scalars['Float']['output'];
  totalExecutions: Scalars['Int']['output'];
  totalTemplates: Scalars['Int']['output'];
  usagePatterns: UsagePatterns;
};

export type TemplatePerformanceFilter = {
  complexityRange?: InputMaybe<IntRangeInput>;
  onlyActive?: InputMaybe<Scalars['Boolean']['input']>;
  operationTypes?: InputMaybe<Array<OperationType>>;
  performanceCategories?: InputMaybe<Array<PerformanceCategory>>;
  usageRange?: InputMaybe<IntRangeInput>;
};

export type TemplatePerformanceMetrics = {
  __typename?: 'TemplatePerformanceMetrics';
  avgExecutionTime: Scalars['Float']['output'];
  successRate: Scalars['Float']['output'];
  totalExecutions: Scalars['Int']['output'];
  uniqueTemplates: Scalars['Int']['output'];
};

export type TemplatePerformanceTrend = {
  __typename?: 'TemplatePerformanceTrend';
  averageExecutionTime: Scalars['Float']['output'];
  executionCount: Scalars['Int']['output'];
  movingAverage: Scalars['Float']['output'];
  successRate: Scalars['Float']['output'];
  templateId: Scalars['ID']['output'];
  timestamp: Scalars['DateTime']['output'];
};

export type TemplateRecommendation = {
  __typename?: 'TemplateRecommendation';
  performanceAdvantage: Scalars['Float']['output'];
  reason: RecommendationReason;
  score: Scalars['Float']['output'];
  similarityScore: Scalars['Float']['output'];
  template: QueryTemplate;
};

export type TemplateUsageStats = {
  __typename?: 'TemplateUsageStats';
  avgExecutionTime: Scalars['Float']['output'];
  lastUsed: Scalars['DateTime']['output'];
  template: QueryTemplate;
  trend: UsageTrend;
  usageCount: Scalars['Int']['output'];
};

export type TestSuiteStatus = {
  __typename?: 'TestSuiteStatus';
  avgExecutionTime: Scalars['Float']['output'];
  failedTests: Scalars['Int']['output'];
  lastRun: Scalars['DateTime']['output'];
  passedTests: Scalars['Int']['output'];
  skippedTests: Scalars['Int']['output'];
  successRate: Scalars['Float']['output'];
  totalTests: Scalars['Int']['output'];
};

export type TimeGranularity =
  | 'DAY'
  | 'HOUR'
  | 'MINUTE'
  | 'MONTH'
  | 'WEEK';

export type TimeRangeInput = {
  end: Scalars['DateTime']['input'];
  start: Scalars['DateTime']['input'];
};

export type TimeWindow =
  | 'ALL_TIME'
  | 'LAST_DAY'
  | 'LAST_HOUR'
  | 'LAST_MONTH'
  | 'LAST_WEEK';

export type Trend =
  | 'DECREASING'
  | 'INCREASING'
  | 'STABLE'
  | 'VOLATILE';

export type TypedNodeAttribute = {
  __typename?: 'TypedNodeAttribute';
  attribute: Attribute;
  id: Scalars['ID']['output'];
  isValid: Scalars['Boolean']['output'];
  parsedValue?: Maybe<Scalars['JSON']['output']>;
  validationErrors: Array<Scalars['String']['output']>;
  value: Scalars['String']['output'];
};

export type UnresolvedReference = {
  __typename?: 'UnresolvedReference';
  externalId: Scalars['String']['output'];
  reason: Scalars['String']['output'];
  relation: NodeRelation;
  suggestions: Array<Scalars['String']['output']>;
};

export type UpdateAttributeInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  isRequired?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateAttributePayload = OperationResult & {
  __typename?: 'UpdateAttributePayload';
  attribute?: Maybe<Attribute>;
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type UpdateAttributeTypeInput = {
  constraints?: InputMaybe<Scalars['JSON']['input']>;
  defaultValue?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateAttributeTypePayload = OperationResult & {
  __typename?: 'UpdateAttributeTypePayload';
  attributeType?: Maybe<AttributeType>;
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type UpdateDocInput = {
  content?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateDocPayload = OperationResult & {
  __typename?: 'UpdateDocPayload';
  doc?: Maybe<Doc>;
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
};

export type UpdateNodeInput = {
  attributes?: InputMaybe<Scalars['JSON']['input']>;
  attributesByIdentifier?: InputMaybe<Array<AttributeByIdentifierInput>>;
  content?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  nodeId?: InputMaybe<Scalars['ID']['input']>;
  tableId?: InputMaybe<Scalars['ID']['input']>;
  tableIdentifier?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateNodePayload = OperationResult & {
  __typename?: 'UpdateNodePayload';
  errors: Array<Error>;
  node?: Maybe<TableNode>;
  success: Scalars['Boolean']['output'];
};

export type UpdateQueryTemplateInput = {
  applicableTables?: InputMaybe<Array<Scalars['String']['input']>>;
  complexityScore?: InputMaybe<Scalars['Int']['input']>;
  defaultVariables?: InputMaybe<Scalars['JSON']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  inputSchema?: InputMaybe<Scalars['JSON']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  query?: InputMaybe<Scalars['String']['input']>;
  queryName?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  variables?: InputMaybe<Scalars['JSON']['input']>;
  version?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateQueryTemplatePayload = OperationResult & {
  __typename?: 'UpdateQueryTemplatePayload';
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
  template?: Maybe<QueryTemplate>;
};

export type UpdateRelationInput = {
  confidence?: InputMaybe<Scalars['Int']['input']>;
  properties?: InputMaybe<Scalars['JSON']['input']>;
  relationTypeId?: InputMaybe<Scalars['ID']['input']>;
  strength?: InputMaybe<Scalars['Float']['input']>;
};

export type UpdateRelationPayload = OperationResult & {
  __typename?: 'UpdateRelationPayload';
  errors: Array<Error>;
  relation?: Maybe<NodeRelation>;
  success: Scalars['Boolean']['output'];
};

export type UpdateRelationTypeInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateRelationTypePayload = OperationResult & {
  __typename?: 'UpdateRelationTypePayload';
  errors: Array<Error>;
  relationType?: Maybe<RelationType>;
  success: Scalars['Boolean']['output'];
};

export type UpdateTableInput = {
  description?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateTablePayload = OperationResult & {
  __typename?: 'UpdateTablePayload';
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
  table?: Maybe<Table>;
};

export type UpdateTemplateQueryPayload = OperationResult & {
  __typename?: 'UpdateTemplateQueryPayload';
  errors: Array<Error>;
  previousQuery?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
  template?: Maybe<QueryTemplate>;
};

export type UsagePatterns = {
  __typename?: 'UsagePatterns';
  hourlyUsagePattern: Array<HourlyUsageStats>;
  mostUsedTemplates: Array<TemplateUsageStats>;
  operationTypeDistribution: Array<OperationTypeStats>;
};

export type UsageTrend =
  | 'DECREASING'
  | 'INCREASING'
  | 'STABLE';

export type ValidateDataInput = {
  /** Data to validate */
  data: Scalars['JSON']['input'];
  /** JSON Schema to validate against */
  schema: Scalars['JSON']['input'];
};

export type ValidateDataPayload = OperationResult & {
  __typename?: 'ValidateDataPayload';
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
  validation: DataValidationResult;
};

export type ValidateInputSchemaInput = {
  /** JSON Schema to validate for MCP compatibility */
  schema: Scalars['JSON']['input'];
};

export type ValidateInputSchemaPayload = OperationResult & {
  __typename?: 'ValidateInputSchemaPayload';
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
  validation: SchemaValidationResult;
};

export type ValidationConflict = {
  __typename?: 'ValidationConflict';
  context?: Maybe<Scalars['JSON']['output']>;
  message: Scalars['String']['output'];
  severity: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export type ValidationOptionsInput = {
  conflictResolution?: InputMaybe<ConflictResolutionStrategy>;
  strictValidation?: InputMaybe<Scalars['Boolean']['input']>;
};

export type ValidationResult = {
  __typename?: 'ValidationResult';
  errors: Array<Scalars['String']['output']>;
  estimatedDuration?: Maybe<Scalars['String']['output']>;
  estimatedFileSize?: Maybe<Scalars['String']['output']>;
  isValid: Scalars['Boolean']['output'];
  warnings: Array<Scalars['String']['output']>;
};

export type ValidationStatus =
  | 'CONFIDENT'
  | 'INVALID'
  | 'QUESTIONABLE'
  | 'UNCERTAIN'
  | 'VERIFIED';

export type WeakRelation = {
  __typename?: 'WeakRelation';
  improvementSuggestions: Array<Scalars['String']['output']>;
  reason: Scalars['String']['output'];
  relation: NodeRelation;
  strengthScore: Scalars['Int']['output'];
};

export type WeightingStrategy =
  | 'CONFIDENCE_ONLY'
  | 'CUSTOM'
  | 'INVERSE_STRENGTH'
  | 'STRENGTH_CONFIDENCE'
  | 'STRENGTH_ONLY';

export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
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

export type ActivateDocPayload = OperationResult & {
  __typename?: 'ActivateDocPayload';
  doc?: Maybe<Doc>;
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
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

export type Attribute = Node & {
  __typename?: 'Attribute';
  attributeType: AttributeType;
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  identifier: Scalars['String']['output'];
  name: Scalars['String']['output'];
  table: Table;
  updatedAt: Scalars['DateTime']['output'];
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

export type AttributeFilter = {
  attributeId: Scalars['ID']['input'];
  operator?: InputMaybe<FilterOperator>;
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
  name: Scalars['String']['input'];
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
  tableId: Scalars['ID']['input'];
};

export type CreateNodePayload = OperationResult & {
  __typename?: 'CreateNodePayload';
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
  name: Scalars['String']['input'];
  query: Scalars['String']['input'];
  queryName?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  variables?: InputMaybe<Scalars['JSON']['input']>;
  variablesSchema?: InputMaybe<Scalars['JSON']['input']>;
  version?: InputMaybe<Scalars['String']['input']>;
};

export type CreateQueryTemplatePayload = OperationResult & {
  __typename?: 'CreateQueryTemplatePayload';
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
  template?: Maybe<QueryTemplate>;
};

export type CreateRelationInput = {
  relationTypeId: Scalars['ID']['input'];
  sourceNodeId: Scalars['ID']['input'];
  tableId: Scalars['ID']['input'];
  targetNodeId: Scalars['ID']['input'];
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
  name: Scalars['String']['input'];
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
};

export type CreateTablePayload = OperationResult & {
  __typename?: 'CreateTablePayload';
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
  table?: Maybe<Table>;
};

export type DatabaseStats = {
  __typename?: 'DatabaseStats';
  averageQueryTime: Scalars['Float']['output'];
  connectionCount: Scalars['Int']['output'];
  queryCount: Scalars['Int']['output'];
};

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

export type ExportMetadata = {
  __typename?: 'ExportMetadata';
  checksum?: Maybe<Scalars['String']['output']>;
  exportedAt: Scalars['String']['output'];
  options?: Maybe<Scalars['JSON']['output']>;
  source: Scalars['String']['output'];
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

export type FilterInput = {
  createdAfter?: InputMaybe<Scalars['DateTime']['input']>;
  createdBefore?: InputMaybe<Scalars['DateTime']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};

export type FilterOperator =
  | 'CONTAINS'
  | 'ENDS_WITH'
  | 'EQUALS'
  | 'GREATER_THAN'
  | 'LESS_THAN'
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

export type GeneratedTemplate = {
  __typename?: 'GeneratedTemplate';
  id: Scalars['ID']['output'];
  identifier: Scalars['String']['output'];
  name: Scalars['String']['output'];
  operationType: Scalars['String']['output'];
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

export type HealthStatus = {
  __typename?: 'HealthStatus';
  database: Scalars['Boolean']['output'];
  memory: MemoryHealthStatus;
  status: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
  version: Scalars['String']['output'];
};

export type HeapStats = {
  __typename?: 'HeapStats';
  arrayBuffers: Scalars['Int']['output'];
  external: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
  used: Scalars['Int']['output'];
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

export type IntRange = {
  __typename?: 'IntRange';
  max: Scalars['Int']['output'];
  min: Scalars['Int']['output'];
};

export type IntRangeInput = {
  max?: InputMaybe<Scalars['Int']['input']>;
  min?: InputMaybe<Scalars['Int']['input']>;
};

export type LogicalOperator =
  | 'AND'
  | 'OR';

export type MemoryHealthStatus = {
  __typename?: 'MemoryHealthStatus';
  message?: Maybe<Scalars['String']['output']>;
  percentage: Scalars['Float']['output'];
  status: Scalars['String']['output'];
};

export type MemoryStats = {
  __typename?: 'MemoryStats';
  free: Scalars['Int']['output'];
  heap: HeapStats;
  percentage: Scalars['Float']['output'];
  total: Scalars['Int']['output'];
  used: Scalars['Int']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  _empty?: Maybe<Scalars['String']['output']>;
  activateDoc: ActivateDocPayload;
  activateTemplate?: Maybe<QueryTemplate>;
  batchImportTablePackages: BatchImportTablePackagesResult;
  bulkSetNodeAttributes: SetNodeAttributePayload;
  createAttribute: CreateAttributePayload;
  createAttributeType: CreateAttributeTypePayload;
  createDoc: CreateDocPayload;
  createDocVersion: CreateDocPayload;
  createNode: CreateNodePayload;
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
  exportTablePackage: TablePackageExportResult;
  exportTemplate: ExportTemplatePayload;
  importSchema: ImportResult;
  importTablePackage: TablePackageImportResult;
  importTemplate: ImportTemplatePayload;
  removeNodeAttribute: SetNodeAttributePayload;
  setNodeAttribute: SetNodeAttributePayload;
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


export type MutationActivateTemplateArgs = {
  id: Scalars['ID']['input'];
};


export type MutationBatchImportTablePackagesArgs = {
  input: BatchImportTablePackagesInput;
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
  id: Scalars['ID']['input'];
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


export type MutationExportTablePackageArgs = {
  input: ExportTablePackageInput;
};


export type MutationExportTemplateArgs = {
  includeStatistics?: InputMaybe<Scalars['Boolean']['input']>;
  templateId?: InputMaybe<Scalars['ID']['input']>;
  templateIdentifier?: InputMaybe<Scalars['String']['input']>;
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


export type MutationRemoveNodeAttributeArgs = {
  attributeId: Scalars['ID']['input'];
  nodeId: Scalars['ID']['input'];
};


export type MutationSetNodeAttributeArgs = {
  input: SetNodeAttributeInput;
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
  id: Scalars['ID']['input'];
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
  createdAt: Scalars['DateTime']['output'];
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
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  relationType: RelationType;
  sourceNode: TableNode;
  table: Table;
  targetNode: TableNode;
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

export type ProcessMemoryDetails = {
  __typename?: 'ProcessMemoryDetails';
  arrayBuffers: Scalars['Int']['output'];
  external: Scalars['Int']['output'];
  heapEfficiency: Scalars['Int']['output'];
  heapTotal: Scalars['Int']['output'];
  heapUsed: Scalars['Int']['output'];
  memoryPressure: Scalars['String']['output'];
  rss: Scalars['Int']['output'];
};

export type ProcessStats = {
  __typename?: 'ProcessStats';
  cpu: Scalars['Float']['output'];
  memoryDetails: ProcessMemoryDetails;
  pid: Scalars['Int']['output'];
  platform: Scalars['String']['output'];
  version: Scalars['String']['output'];
};

export type Query = {
  __typename?: 'Query';
  _empty?: Maybe<Scalars['String']['output']>;
  _placeholder?: Maybe<Scalars['String']['output']>;
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
  discoverRelationPatterns: Array<RelationPattern>;
  executeTemplate: ExecuteQueryTemplatePayload;
  exportAllTables: SchemaExportResult;
  exportTable: SchemaExportResult;
  findOptimalPath: OptimalPath;
  findPathsBetweenNodes: Array<NodePath>;
  getActiveDoc?: Maybe<Doc>;
  getDependencyChain: RelatedNodesConnection;
  getDoc?: Maybe<Doc>;
  getDocVersions: Array<Doc>;
  getDocs: DocsConnection;
  getHighConfidenceRelations: Array<HighConfidenceRelation>;
  getHotQueries: Array<HotQueryTemplate>;
  getImportSession?: Maybe<ImportSession>;
  getNodeConnectivity: NodeConnectivityResult;
  getPopularTemplates: Array<QueryTemplate>;
  getSlowQueries: Array<SlowQueryAnalysis>;
  getTemplate?: Maybe<QueryTemplate>;
  getTemplateByIdentifier?: Maybe<QueryTemplate>;
  getTemplateExecutionHistory: TemplateExecutionConnection;
  getTemplatePerformanceTrends: Array<TemplatePerformanceTrend>;
  getTemplateRecommendations: Array<TemplateRecommendation>;
  healthCheck: HealthStatus;
  memoryStats: MemoryStats;
  node?: Maybe<TableNode>;
  nodeAttributeAnalytics: NodeAttributeAnalytics;
  nodeByContent?: Maybe<TableNode>;
  nodeRelation?: Maybe<NodeRelation>;
  nodeRelations: NodeRelationsConnection;
  nodeWithTypedAttributes?: Maybe<NodeWithTypedAttributes>;
  nodes: NodesConnection;
  relationAnalytics: RelationAnalytics;
  relationType?: Maybe<RelationType>;
  relationTypeByIdentifier?: Maybe<RelationType>;
  relationTypes: Array<RelationType>;
  resolveExternalReferences: ExternalReferenceResult;
  searchDocs: DocsConnection;
  searchNodes: NodesConnection;
  searchNodesByAttribute: NodesConnection;
  searchRelatedNodes: RelatedNodesConnection;
  searchTemplates: QueryTemplatesConnection;
  systemHealthCheck: SystemHealthStatus;
  systemStats: SystemStats;
  table?: Maybe<Table>;
  tableByIdentifier?: Maybe<Table>;
  tableDependencyTemplates: Array<TableDependencyTemplateResult>;
  tables: TablesConnection;
  templatePerformanceAnalytics: TemplatePerformanceAnalytics;
  templatesByTable: Array<QueryTemplate>;
  templatesWithTableDependencies: Array<QueryTemplate>;
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


export type QueryGetDependencyChainArgs = {
  input: DependencyChainInput;
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
  filter: SearchNodesFilter;
  pagination?: InputMaybe<NodesPagination>;
  sort?: InputMaybe<Array<SortInput>>;
};


export type QuerySearchNodesByAttributeArgs = {
  filter: NodeAttributeSearchFilter;
  pagination?: InputMaybe<PaginationInput>;
  sort?: InputMaybe<Array<SortInput>>;
};


export type QuerySearchRelatedNodesArgs = {
  filter: SearchRelatedNodesFilter;
  pagination?: InputMaybe<PaginationInput>;
};


export type QuerySearchTemplatesArgs = {
  filter?: InputMaybe<QueryTemplatesFilter>;
  pagination?: InputMaybe<PaginationInput>;
  sort?: InputMaybe<Array<SortInput>>;
};


export type QueryTableArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTableByIdentifierArgs = {
  identifier: Scalars['String']['input'];
};


export type QueryTablesArgs = {
  filter?: InputMaybe<TablesFilter>;
  pagination?: InputMaybe<TablesPagination>;
  sort?: InputMaybe<Array<SortInput>>;
};


export type QueryTemplatePerformanceAnalyticsArgs = {
  filter?: InputMaybe<TemplatePerformanceFilter>;
  timeRange?: InputMaybe<TimeRangeInput>;
};


export type QueryTemplatesByTableArgs = {
  input: FindTemplatesByTableInput;
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
  variablesSchema?: Maybe<Scalars['JSON']['output']>;
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

export type RelationDirection =
  | 'BOTH'
  | 'INCOMING'
  | 'OUTGOING';

export type RelationFilter = {
  direction: RelationDirection;
  relationTypeId: Scalars['ID']['input'];
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
  incomingRelations: Scalars['Int']['output'];
  outgoingRelations: Scalars['Int']['output'];
  relationTypeBreakdown: Array<RelationTypeCount>;
  totalConnections: Scalars['Int']['output'];
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

export type RollbackInfo = {
  __typename?: 'RollbackInfo';
  nodesCreated: Array<Scalars['String']['output']>;
  tablesCreated: Array<Scalars['String']['output']>;
  templatesCreated: Array<Scalars['String']['output']>;
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

export type SearchNodesFilter = {
  attributeFilters?: InputMaybe<Array<AttributeFilter>>;
  content?: InputMaybe<Scalars['String']['input']>;
  relationFilters?: InputMaybe<Array<RelationFilter>>;
  search?: InputMaybe<Scalars['String']['input']>;
  tableId: Scalars['ID']['input'];
};

export type SearchRelatedNodesFilter = {
  direction?: InputMaybe<RelationDirection>;
  maxDepth?: InputMaybe<Scalars['Int']['input']>;
  relationTypeIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  sourceNodeId: Scalars['ID']['input'];
};

export type SetNodeAttributeInput = {
  attributeId: Scalars['ID']['input'];
  nodeId: Scalars['ID']['input'];
  value: Scalars['String']['input'];
};

export type SetNodeAttributePayload = OperationResult & {
  __typename?: 'SetNodeAttributePayload';
  errors: Array<Error>;
  nodeAttribute?: Maybe<NodeAttribute>;
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

export type SortDirection =
  | 'ASC'
  | 'DESC';

export type SortInput = {
  direction: SortDirection;
  field: Scalars['String']['input'];
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

export type Subscription = {
  __typename?: 'Subscription';
  _placeholder?: Maybe<Scalars['String']['output']>;
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

export type SystemHealthStatus = {
  __typename?: 'SystemHealthStatus';
  database: Scalars['Boolean']['output'];
  memory: MemoryHealthStatus;
  status: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
  version: Scalars['String']['output'];
};

export type SystemStats = {
  __typename?: 'SystemStats';
  database: DatabaseStats;
  memory: MemoryStats;
  process: ProcessStats;
  timestamp: Scalars['DateTime']['output'];
  uptime: Scalars['Int']['output'];
};

export type Table = Node & {
  __typename?: 'Table';
  attributeCount: Scalars['Int']['output'];
  attributeTypes: Array<AttributeType>;
  attributes: Array<Attribute>;
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  identifier: Scalars['String']['output'];
  tableNodeCount: Scalars['Int']['output'];
  tableNodes: Array<TableNode>;
  updatedAt: Scalars['DateTime']['output'];
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

export type TableNode = Node & {
  __typename?: 'TableNode';
  attributeCount: Scalars['Int']['output'];
  attributes: Array<NodeAttribute>;
  connectedNodes: Array<ConnectedNode>;
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  incomingRelations: Array<NodeRelation>;
  neighborsByRelationType: Array<TableNode>;
  outgoingRelations: Array<NodeRelation>;
  relationCount: Scalars['Int']['output'];
  shortestPath?: Maybe<GraphPath>;
  table: Table;
  updatedAt: Scalars['DateTime']['output'];
};


export type TableNodeConnectedNodesArgs = {
  depth?: InputMaybe<Scalars['Int']['input']>;
  direction?: InputMaybe<RelationDirection>;
  relationTypes?: InputMaybe<Array<Scalars['ID']['input']>>;
};


export type TableNodeNeighborsByRelationTypeArgs = {
  relationTypeId: Scalars['ID']['input'];
};


export type TableNodeShortestPathArgs = {
  maxDepth?: InputMaybe<Scalars['Int']['input']>;
  targetNodeId: Scalars['ID']['input'];
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

export type TablesConnection = Connection & {
  __typename?: 'TablesConnection';
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  nodes: Array<Table>;
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
  content?: InputMaybe<Scalars['String']['input']>;
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
  name?: InputMaybe<Scalars['String']['input']>;
  query?: InputMaybe<Scalars['String']['input']>;
  queryName?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  variables?: InputMaybe<Scalars['JSON']['input']>;
  variablesSchema?: InputMaybe<Scalars['JSON']['input']>;
  version?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateQueryTemplatePayload = OperationResult & {
  __typename?: 'UpdateQueryTemplatePayload';
  errors: Array<Error>;
  success: Scalars['Boolean']['output'];
  template?: Maybe<QueryTemplate>;
};

export type UpdateRelationInput = {
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

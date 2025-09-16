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
  deleteTable: DeleteTablePayload;
  deleteTemplate: DeleteQueryTemplatePayload;
  executeTemplate: ExecuteQueryTemplatePayload;
  executeTemplateWithGraphQL: TemplateExecutionResult;
  exportTablePackage: TablePackageExportResult;
  exportTemplate: ExportTemplatePayload;
  importSchema: ImportResult;
  importTablePackage: TablePackageImportResult;
  importTemplate: ImportTemplatePayload;
  setNodeAttribute: SetNodeAttributePayload;
  updateAttribute: UpdateAttributePayload;
  updateAttributeType: UpdateAttributeTypePayload;
  updateDoc: UpdateDocPayload;
  updateNode: UpdateNodePayload;
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

export type PaginationInput = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
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
  analyzeTableDependencies: Array<TableDependencyAnalysis>;
  attribute?: Maybe<Attribute>;
  attributeByIdentifier?: Maybe<Attribute>;
  attributeType?: Maybe<AttributeType>;
  attributeTypeByIdentifier?: Maybe<AttributeType>;
  attributeTypes: AttributeTypesConnection;
  attributes: AttributesConnection;
  executeTemplate: ExecuteQueryTemplatePayload;
  exportAllTables: SchemaExportResult;
  exportTable: SchemaExportResult;
  findPathsBetweenNodes: Array<NodePath>;
  getActiveDoc?: Maybe<Doc>;
  getDependencyChain: RelatedNodesConnection;
  getDoc?: Maybe<Doc>;
  getDocVersions: Array<Doc>;
  getDocs: DocsConnection;
  getImportSession?: Maybe<ImportSession>;
  getPopularTemplates: Array<QueryTemplate>;
  getTemplate?: Maybe<QueryTemplate>;
  getTemplateByIdentifier?: Maybe<QueryTemplate>;
  health: HealthStatus;
  healthCheck: HealthStatus;
  memoryStats: MemoryStats;
  node?: Maybe<TableNode>;
  nodeByContent?: Maybe<TableNode>;
  nodeRelation?: Maybe<NodeRelation>;
  nodeRelations: NodeRelationsConnection;
  nodes: NodesConnection;
  relationType?: Maybe<RelationType>;
  relationTypeByIdentifier?: Maybe<RelationType>;
  relationTypes: Array<RelationType>;
  searchDocs: DocsConnection;
  searchNodes: NodesConnection;
  searchRelatedNodes: RelatedNodesConnection;
  searchTemplates: QueryTemplatesConnection;
  systemStats: SystemStats;
  table?: Maybe<Table>;
  tableByIdentifier?: Maybe<Table>;
  tableDependencyTemplates: Array<TableDependencyTemplateResult>;
  tables: TablesConnection;
  templatesByTable: Array<QueryTemplate>;
  templatesWithTableDependencies: Array<QueryTemplate>;
  validateTablePackage: Array<ValidationConflict>;
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


export type QueryAttributesArgs = {
  filter?: InputMaybe<AttributesFilter>;
  pagination?: InputMaybe<PaginationInput>;
  sort?: InputMaybe<Array<SortInput>>;
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


export type QueryGetImportSessionArgs = {
  sessionId: Scalars['String']['input'];
};


export type QueryGetPopularTemplatesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryGetTemplateArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetTemplateByIdentifierArgs = {
  identifier: Scalars['String']['input'];
};


export type QueryNodeArgs = {
  id: Scalars['ID']['input'];
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


export type QueryNodesArgs = {
  filter?: InputMaybe<NodesFilter>;
  pagination?: InputMaybe<NodesPagination>;
  sort?: InputMaybe<Array<SortInput>>;
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

export type RelatedNodesConnection = Connection & {
  __typename?: 'RelatedNodesConnection';
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  nodes: Array<TableNode>;
  relations: Array<NodeRelation>;
  totalCount: Scalars['Int']['output'];
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

export type RelationType = Node & {
  __typename?: 'RelationType';
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  identifier: Scalars['String']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
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
  tableId?: InputMaybe<Scalars['ID']['input']>;
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

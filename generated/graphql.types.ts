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
  id: Scalars['ID']['output'];
  identifier: Scalars['String']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type AttributeTypesConnection = Connection & {
  __typename?: 'AttributeTypesConnection';
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  nodes: Array<AttributeType>;
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
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  nodes: Array<Attribute>;
  totalCount: Scalars['Int']['output'];
};

export type AttributesFilter = {
  attributeTypeId?: InputMaybe<Scalars['ID']['input']>;
  createdAfter?: InputMaybe<Scalars['DateTime']['input']>;
  createdBefore?: InputMaybe<Scalars['DateTime']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  tableId?: InputMaybe<Scalars['ID']['input']>;
};

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
  identifier: Scalars['String']['input'];
  name: Scalars['String']['input'];
};

export type CreateAttributeTypePayload = OperationResult & {
  __typename?: 'CreateAttributeTypePayload';
  attributeType?: Maybe<AttributeType>;
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
  createdBy?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  identifier: Scalars['String']['input'];
  name: Scalars['String']['input'];
  query: Scalars['String']['input'];
  variables?: InputMaybe<Scalars['JSON']['input']>;
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

export type ExportTableStatistics = {
  __typename?: 'ExportTableStatistics';
  attributeCount: Scalars['Int']['output'];
  nodeCount: Scalars['Int']['output'];
  relationCount: Scalars['Int']['output'];
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
  status: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
  version: Scalars['String']['output'];
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

export type Mutation = {
  __typename?: 'Mutation';
  _empty?: Maybe<Scalars['String']['output']>;
  activateTemplate?: Maybe<QueryTemplate>;
  createAttribute: CreateAttributePayload;
  createAttributeType: CreateAttributeTypePayload;
  createNode: CreateNodePayload;
  createRelation: CreateRelationPayload;
  createRelationType: CreateRelationTypePayload;
  createTable: CreateTablePayload;
  createTemplate: CreateQueryTemplatePayload;
  deactivateTemplate?: Maybe<QueryTemplate>;
  deleteAttribute: DeleteAttributePayload;
  deleteAttributeType: DeleteAttributeTypePayload;
  deleteNode: DeleteNodePayload;
  deleteRelation: DeleteRelationPayload;
  deleteTable: DeleteTablePayload;
  deleteTemplate: DeleteQueryTemplatePayload;
  executeTemplate: ExecuteQueryTemplatePayload;
  executeTemplateWithGraphQL: TemplateExecutionResult;
  importSchema: ImportResult;
  setNodeAttribute: SetNodeAttributePayload;
  updateAttribute: UpdateAttributePayload;
  updateAttributeType: UpdateAttributeTypePayload;
  updateNode: UpdateNodePayload;
  updateTable: UpdateTablePayload;
  updateTemplate: UpdateQueryTemplatePayload;
};


export type MutationActivateTemplateArgs = {
  id: Scalars['ID']['input'];
};


export type MutationCreateAttributeArgs = {
  input: CreateAttributeInput;
};


export type MutationCreateAttributeTypeArgs = {
  input: CreateAttributeTypeInput;
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


export type MutationImportSchemaArgs = {
  exportData: Scalars['JSON']['input'];
  options?: InputMaybe<SchemaImportOptions>;
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

export type Query = {
  __typename?: 'Query';
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
  getDependencyChain: RelatedNodesConnection;
  getPopularTemplates: Array<QueryTemplate>;
  getTemplate?: Maybe<QueryTemplate>;
  getTemplateByIdentifier?: Maybe<QueryTemplate>;
  health: HealthStatus;
  node?: Maybe<TableNode>;
  nodeByContent?: Maybe<TableNode>;
  nodeRelation?: Maybe<NodeRelation>;
  nodeRelations: NodeRelationsConnection;
  nodes: NodesConnection;
  relationType?: Maybe<RelationType>;
  relationTypeByIdentifier?: Maybe<RelationType>;
  relationTypes: Array<RelationType>;
  searchNodes: NodesConnection;
  searchRelatedNodes: RelatedNodesConnection;
  searchTemplates: QueryTemplatesConnection;
  table?: Maybe<Table>;
  tableByIdentifier?: Maybe<Table>;
  tables: TablesConnection;
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


export type QueryGetDependencyChainArgs = {
  input: DependencyChainInput;
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

export type QueryTemplate = Node & {
  __typename?: 'QueryTemplate';
  createdAt: Scalars['DateTime']['output'];
  createdBy?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  identifier: Scalars['String']['output'];
  isActive: Scalars['Boolean']['output'];
  isValid: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  query: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  usageCount: Scalars['Int']['output'];
  validationErrors: Array<Scalars['String']['output']>;
  variables?: Maybe<Scalars['JSON']['output']>;
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
  nodes: Array<QueryTemplate>;
  totalCount: Scalars['Int']['output'];
};

export type QueryTemplatesFilter = {
  createdAfter?: InputMaybe<Scalars['DateTime']['input']>;
  createdBefore?: InputMaybe<Scalars['DateTime']['input']>;
  createdBy?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
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

export type Subscription = {
  __typename?: 'Subscription';
  _placeholder?: Maybe<Scalars['String']['output']>;
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

export type Table = Node & {
  __typename?: 'Table';
  attributeCount: Scalars['Int']['output'];
  attributes: Array<Attribute>;
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  identifier: Scalars['String']['output'];
  tableNodeCount: Scalars['Int']['output'];
  tableNodes: Array<TableNode>;
  updatedAt: Scalars['DateTime']['output'];
};

export type TableDeletedEvent = {
  __typename?: 'TableDeletedEvent';
  deletedAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  identifier: Scalars['String']['output'];
};

export type TableDependencyInfo = {
  __typename?: 'TableDependencyInfo';
  attributeCount: Scalars['Int']['output'];
  relationCount: Scalars['Int']['output'];
  tableNodeCount: Scalars['Int']['output'];
};

export type TableEdge = Edge & {
  __typename?: 'TableEdge';
  cursor: Scalars['String']['output'];
  node: Table;
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
  search?: InputMaybe<Scalars['String']['input']>;
};

export type TablesPagination = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
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
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  query?: InputMaybe<Scalars['String']['input']>;
  variables?: InputMaybe<Scalars['JSON']['input']>;
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

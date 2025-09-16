export const tablePackageMutations = `
  # Export a table as a package with all its components
  exportTablePackage(input: ExportTablePackageInput!): ExportTablePackageResponse!

  # Import a table package
  importTablePackage(input: ImportTablePackageInput!): ImportTablePackageResponse!

  # Import multiple table packages in dependency order
  batchImportTablePackages(input: BatchImportTablePackagesInput!): BatchImportTablePackagesResponse!

  # Create an import session for tracking progress
  createImportSession(input: CreateImportSessionInput!): CreateImportSessionResponse!

  # Rollback an import session
  rollbackImportSession(sessionId: ID!): RollbackImportSessionResponse!

  # Generate auto-templates for a table
  generateTableTemplates(input: GenerateTableTemplatesInput!): GenerateTableTemplatesResponse!
`

export const tablePackageTypes = `
  # Export Table Package Input/Output Types

  input ExportTablePackageInput {
    tableIdentifier: String!
    options: TablePackageExportOptions
    outputPath: String # Optional file system path
  }

  input TablePackageExportOptions {
    includeData: Boolean = true
    includeRelations: Boolean = true
    includeTemplates: Boolean = true
    includeStatistics: Boolean = false
    resolveDependencies: Boolean = true
    prettyPrint: Boolean = true
  }

  type ExportTablePackageResponse {
    success: Boolean!
    packageData: TablePackageData
    exportPath: String
    dependencyOrder: [String!]
    errors: [String!]!
    warnings: [String!]!
  }

  type TablePackageData {
    version: String!
    exportedAt: String!
    sourceTable: SourceTableInfo!
    dependencies: [String!]!
    package: TablePackageContent!
  }

  type SourceTableInfo {
    identifier: String!
    description: String
  }

  type TablePackageContent {
    schema: TableSchemaExport!
    dataset: TableDataExport!
    relations: TableRelationsExport!
    templates: TableTemplatesExport!
  }

  type TableSchemaExport {
    table: TableInfo!
    attributes: [AttributeInfo!]!
    attributeTypes: [AttributeTypeInfo!]!
  }

  type TableInfo {
    identifier: String!
    description: String
    createdAt: String!
    updatedAt: String!
  }

  type AttributeInfo {
    identifier: String!
    attributeTypeId: ID!
    description: String
    isRequired: Boolean!
    metadata: String
    createdAt: String!
    updatedAt: String!
  }

  type AttributeTypeInfo {
    id: ID!
    identifier: String!
    description: String
    dataType: String!
    validation: String
    metadata: String
    createdAt: String!
    updatedAt: String!
  }

  type TableDataExport {
    nodes: [NodeExportInfo!]!
    nodeAttributes: [NodeAttributeExportInfo!]!
  }

  type NodeExportInfo {
    externalId: String!
    nodeType: String!
    content: JSON
    metadata: JSON
    createdAt: String!
    updatedAt: String!
  }

  type NodeAttributeExportInfo {
    nodeExternalId: String!
    attributeIdentifier: String!
    value: JSON!
    createdAt: String!
    updatedAt: String!
  }

  type TableRelationsExport {
    relationTypes: [RelationTypeExportInfo!]!
    nodeRelations: [NodeRelationExportInfo!]!
  }

  type RelationTypeExportInfo {
    id: ID!
    identifier: String!
    description: String
    properties: JSON
    createdAt: String!
    updatedAt: String!
  }

  type NodeRelationExportInfo {
    sourceExternalId: String!
    targetExternalId: String!
    relationTypeId: ID!
    properties: JSON
    strength: Int!
    createdAt: String!
    updatedAt: String!
  }

  type TableTemplatesExport {
    templates: [TemplateExportInfo!]!
  }

  type TemplateExportInfo {
    identifier: String!
    name: String!
    description: String
    query: String!
    queryName: [String!]!
    operationType: OperationType!
    variables: JSON
    variablesSchema: JSON
    defaultVariables: JSON
    applicableTables: [String!]
    complexityScore: Int!
    version: String!
    tags: [String!]!
    isActive: Boolean!
    statistics: TemplateStatistics
  }

  type TemplateStatistics {
    usageCount: Int!
    avgExecutionTimeMs: Int!
    lastUsedAt: String
  }

  # Import Table Package Input/Output Types

  input ImportTablePackageInput {
    packageData: TablePackageDataInput
    packagePath: String # Alternative: import from file system
    options: TablePackageImportOptions
  }

  input TablePackageDataInput {
    version: String!
    exportedAt: String!
    sourceTable: SourceTableInfoInput!
    dependencies: [String!]!
    package: TablePackageContentInput!
  }

  input SourceTableInfoInput {
    identifier: String!
    description: String
  }

  input TablePackageContentInput {
    schema: TableSchemaExportInput!
    dataset: TableDataExportInput!
    relations: TableRelationsExportInput!
    templates: TableTemplatesExportInput!
  }

  input TableSchemaExportInput {
    table: TableInfoInput!
    attributes: [AttributeInfoInput!]!
    attributeTypes: [AttributeTypeInfoInput!]!
  }

  input TableInfoInput {
    identifier: String!
    description: String
    createdAt: String!
    updatedAt: String!
  }

  input AttributeInfoInput {
    identifier: String!
    attributeTypeId: ID!
    description: String
    isRequired: Boolean!
    metadata: String
    createdAt: String!
    updatedAt: String!
  }

  input AttributeTypeInfoInput {
    id: ID!
    identifier: String!
    description: String
    dataType: String!
    validation: String
    metadata: String
    createdAt: String!
    updatedAt: String!
  }

  input TableDataExportInput {
    nodes: [NodeExportInfoInput!]!
    nodeAttributes: [NodeAttributeExportInfoInput!]!
  }

  input NodeExportInfoInput {
    externalId: String!
    nodeType: String!
    content: JSON
    metadata: JSON
    createdAt: String!
    updatedAt: String!
  }

  input NodeAttributeExportInfoInput {
    nodeExternalId: String!
    attributeIdentifier: String!
    value: JSON!
    createdAt: String!
    updatedAt: String!
  }

  input TableRelationsExportInput {
    relationTypes: [RelationTypeExportInfoInput!]!
    nodeRelations: [NodeRelationExportInfoInput!]!
  }

  input RelationTypeExportInfoInput {
    id: ID!
    identifier: String!
    description: String
    properties: JSON
    createdAt: String!
    updatedAt: String!
  }

  input NodeRelationExportInfoInput {
    sourceExternalId: String!
    targetExternalId: String!
    relationTypeId: ID!
    properties: JSON
    strength: Int!
    createdAt: String!
    updatedAt: String!
  }

  input TableTemplatesExportInput {
    templates: [TemplateExportInfoInput!]!
  }

  input TemplateExportInfoInput {
    identifier: String!
    name: String!
    description: String
    query: String!
    queryName: [String!]!
    operationType: OperationType!
    variables: JSON
    variablesSchema: JSON
    defaultVariables: JSON
    applicableTables: [String!]
    complexityScore: Int!
    version: String!
    tags: [String!]!
    isActive: Boolean!
    statistics: TemplateStatisticsInput
  }

  input TemplateStatisticsInput {
    usageCount: Int!
    avgExecutionTimeMs: Int!
    lastUsedAt: String
  }

  input TablePackageImportOptions {
    conflictResolution: ConflictResolution! = SKIP
    importData: Boolean = true
    importRelations: Boolean = true
    importTemplates: Boolean = true
    preserveStatistics: Boolean = true
    validateIntegrity: Boolean = true
    generateTemplates: Boolean = true
    newTablePrefix: String
  }

  enum ConflictResolution {
    OVERWRITE
    MERGE
    RENAME
    SKIP
  }

  type ImportTablePackageResponse {
    success: Boolean!
    importedTable: ImportedTableInfo
    generatedTemplates: [GeneratedTemplateInfo!]!
    resolvedConflicts: [ResolvedConflict!]!
    errors: [String!]!
    warnings: [String!]!
  }

  type ImportedTableInfo {
    id: ID!
    identifier: String!
    originalIdentifier: String!
  }

  type GeneratedTemplateInfo {
    id: ID!
    identifier: String!
    name: String!
    operationType: String!
  }

  type ResolvedConflict {
    type: ConflictType!
    originalName: String!
    resolvedName: String!
    action: ConflictAction!
  }

  enum ConflictType {
    TABLE
    TEMPLATE
    ATTRIBUTE
  }

  enum ConflictAction {
    RENAMED
    MERGED
    OVERWRITTEN
    SKIPPED
  }

  # Batch Import Types

  input BatchImportTablePackagesInput {
    packages: [TablePackageDataInput!]!
    options: TablePackageImportOptions
    createSession: Boolean = false
  }

  type BatchImportTablePackagesResponse {
    success: Boolean!
    results: [ImportTablePackageResponse!]!
    session: ImportSessionInfo
    summary: BatchImportSummary!
    errors: [String!]!
  }

  type BatchImportSummary {
    total: Int!
    succeeded: Int!
    failed: Int!
    skipped: Int!
  }

  # Import Session Types

  input CreateImportSessionInput {
    packages: [TablePackageDataInput!]!
  }

  type CreateImportSessionResponse {
    success: Boolean!
    session: ImportSessionInfo
    errors: [String!]!
  }

  type ImportSessionInfo {
    sessionId: ID!
    status: ImportSessionStatus!
    startedAt: String!
    completedAt: String
    packagesImported: [String!]!
    packagesRemaining: [String!]!
    rollbackInfo: RollbackInfo!
    errors: [String!]!
  }

  enum ImportSessionStatus {
    PENDING
    IN_PROGRESS
    COMPLETED
    FAILED
    ROLLED_BACK
  }

  type RollbackInfo {
    tablesCreated: [ID!]!
    templatesCreated: [ID!]!
    nodesCreated: [ID!]!
  }

  type RollbackImportSessionResponse {
    success: Boolean!
    sessionId: ID!
    errors: [String!]!
  }

  # Generate Templates Types

  input GenerateTableTemplatesInput {
    tableIdentifier: String!
    options: GenerateTemplatesOptions
  }

  input GenerateTemplatesOptions {
    includeCreate: Boolean = true
    includeRead: Boolean = true
    includeUpdate: Boolean = true
    includeDelete: Boolean = true
    includeSearch: Boolean = true
    includeBatch: Boolean = false
  }

  type GenerateTableTemplatesResponse {
    success: Boolean!
    templates: [GeneratedTemplateInfo!]!
    errors: [String!]!
  }
`
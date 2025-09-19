export const tablePackageQueries = `
  # Get table dependency information
  getTableDependencies(tableIdentifier: String!): TableDependencyInfo!

  # Validate a table package before import
  validateTablePackage(input: ValidateTablePackageInput!): ValidationResult!

  # Get import session status
  getImportSession(sessionId: ID!): ImportSessionInfo

  # List all active import sessions
  listImportSessions: [ImportSessionInfo!]!

  # Resolve import order for multiple tables
  resolveImportOrder(tableIdentifiers: [String!]!): ImportOrderResult!

  # Check if table packages exist in the system
  checkTablePackagesExist(tableIdentifiers: [String!]!): TableExistenceResult!
`

export const tablePackageQueryTypes = `
  # Table Dependencies

  type TableDependencyInfo {
    tableIdentifier: String!
    dependencies: [String!]!
    dependents: [String!]!
    depth: Int!
    circularReferences: [String!]!
  }

  # Package Validation

  input ValidateTablePackageInput {
    packageData: TablePackageDataInput!
    options: TablePackageImportOptions
  }

  type ValidationResult {
    isValid: Boolean!
    conflicts: [PackageConflict!]!
    warnings: [String!]!
  }

  type PackageConflict {
    type: PackageConflictType!
    severity: ConflictSeverity!
    message: String!
    context: ConflictContext!
    suggestedResolution: String
  }

  enum PackageConflictType {
    TABLE_EXISTS
    TEMPLATE_EXISTS
    ATTRIBUTE_TYPE_MISMATCH
    CIRCULAR_DEPENDENCY
    MISSING_DEPENDENCY
    SCHEMA_INCOMPATIBLE
  }

  enum ConflictSeverity {
    ERROR
    WARNING
  }

  type ConflictContext {
    tableName: String
    templateName: String
    attributeName: String
    dependency: String
  }

  # Import Order Resolution

  type ImportOrderResult {
    success: Boolean!
    importOrder: [String!]!
    circularDependencies: [CircularDependency!]!
    errors: [String!]!
  }

  type CircularDependency {
    cycle: [String!]!
    suggestedBreakPoint: String
  }

  # Table Existence Check

  type TableExistenceResult {
    results: [TableExistenceInfo!]!
  }

  type TableExistenceInfo {
    tableIdentifier: String!
    exists: Boolean!
    hasConflicts: Boolean!
    conflictTypes: [PackageConflictType!]!
  }
`
